# Legifrance décret watchlist — detect changes to the 6 hardcoded legal parameters

Date: 2026-08-29. Status: design (not yet built).

## Problem

CLAUDE.md's "French law specifics (enforce these in code)" section hardcodes six
legal parameters, each tied to a specific loi/décret:

1. Deposit caps — Loi n°89-462, art. 22
2. Furnished-rental checklist (11 items) — Décret n°2015-981
3. DPE class-G blocking threshold — Loi Climat et Résilience (n°2021-1104)
4. Lease template (mandatory model wording) — Décret n°2015-587
5. Mandatory annexes list — Décret n°2015-587 / loi ALUR
6. MRH insurance requirement — Loi n°89-462, art. 7g

There is currently no mechanism to learn when one of these texts is amended.
The existing process ([[legal-sources-and-watchlist]]) is "consult Legifrance
manually before implementing a new feature" — nothing re-checks texts already
implemented. A décret amendment (e.g. a new deposit cap, or revised wording in
the mandatory lease model) could silently make the app non-compliant with no
signal until a human happens to notice.

## Decision: alert only, no auto-apply

When a tracked text changes, Roomivo **notifies a human** (email) with what
changed. It does **not** modify code, config, or any compliance-relevant
constant automatically. This matches the project's existing compliance
posture (lawyer sign-off gates lease/e-sign features; MEDIUM assurance is
never silently inflated to HIGH) — legal-text changes get the same discipline
as everything else on the legal surface. A person decides what, if anything,
needs to change in the code, same as today, just with a monthly nudge instead
of no signal at all.

## Architecture

```
scripts/periodic_sweep.py (existing cron, runs every 15 min)
  └─ maybe_check_legal_watchlist()          [new step, 3rd in the sweep]
       ├─ no-op if < 30 days since oldest legal_watchlist_state.last_checked_at
       └─ else: app.services.legifrance_watch.check_watchlist()
            ├─ authenticate to PISTE (OAuth2 client-credentials)
            ├─ for each of the 6 watchlist items:
            │    fetch current article text via PISTE consult/getArticle
            │    hash it (SHA-256)
            │    compare to legal_watchlist_state.last_hash
            │    if different (and not first run) → mark changed
            │    update legal_watchlist_state row regardless of outcome
            └─ for each changed item → send one alert email via
                 app.services.email._send_via_resend (existing Resend path)
```

No new Render service. No new Redis/queue dependency. Reuses the cron job
and email path built for [[render-deploy-topology]]'s periodic-sweep work.

## Data model

New table `legal_watchlist_state` (one row per tracked item, seeded once at
migration time with the 6 items' names + Legifrance article IDs):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `key` | str, unique | e.g. `"deposit_caps"`, `"furnished_checklist"` — stable identifier, matches a constant in `legifrance_watch.py` |
| `label` | str | Human-readable name for the alert email, e.g. "Deposit caps (Loi 89, art. 22)" |
| `legifrance_article_id` | str | The `LEGIARTI...`/`LEGITEXT...` ID — **must be researched and pinned down during implementation**, not guessed |
| `last_hash` | str, nullable | SHA-256 of the article text as of the last check; null until the first successful check |
| `last_checked_at` | datetime, nullable | Null until the first check ever runs |
| `consecutive_failures` | int, default 0 | Incremented on fetch failure, reset to 0 on success; see error handling below |

No encryption needed — this holds public government legal text, not PII.

## `app/services/legifrance_watch.py`

One primary function:

```python
async def check_watchlist(db: AsyncSession) -> list[WatchlistChange]:
```

- Authenticates to PISTE via OAuth2 client-credentials flow using
  `LEGIFRANCE_CLIENT_ID`/`LEGIFRANCE_CLIENT_SECRET` (new settings fields,
  `sync: false` in render.yaml like every other secret). Token is fetched
  once per call and used for all 6 lookups in that run — PISTE tokens are
  short-lived, no need to cache across runs.
- For each row in `legal_watchlist_state`: GET the article via PISTE's
  `consult/getArticle` (or the closest equivalent endpoint — confirmed
  against PISTE's published API docs during implementation, not assumed),
  hash the returned text body.
  - **First-ever check for that item** (`last_hash is None`): store the hash
    silently, no alert. There's nothing to diff against yet.
  - **Hash matches**: update `last_checked_at`, reset `consecutive_failures`,
    no alert.
  - **Hash differs**: update `last_hash`/`last_checked_at`, reset
    `consecutive_failures`, return a `WatchlistChange` (key, label, article
    URL, short excerpt of old vs. new text) for the caller to alert on.
  - **Fetch fails** (network error, 404, PISTE auth failure): log a warning,
    increment `consecutive_failures`, leave `last_hash`/`last_checked_at`
    unchanged for that item so it's retried on the next monthly window — but
    still counts as "checked" at the sweep level so a single item's outage
    doesn't block the others. If `consecutive_failures` reaches 3, also
    return a `WatchlistChange`-shaped alert for that item saying "this item
    has failed to check 3 times in a row, something's wrong with the
    watchlist entry itself" — so a stale/broken article ID doesn't fail
    silently forever.

`check_watchlist()` never raises — mirrors the existing sweep tasks'
"log and continue" discipline so one broken item can't take down the whole
periodic sweep.

## Cron integration

`scripts/periodic_sweep.py`'s `main()` gets a third awaited step after the
existing two:

```python
changes = await maybe_check_legal_watchlist(db)
for change in changes:
    await send_legal_watchlist_alert_email(change)
```

`maybe_check_legal_watchlist` does the "has it been 30 days" gate (query the
oldest `last_checked_at`, including nulls-first for never-checked items) then
delegates to `check_watchlist()`. Kept as a separate thin function so the
30-day gate is trivially unit-testable without mocking PISTE.

## Alert email

One email per changed item (not batched into one digest — each is a distinct
decision a human needs to make, and batching risks one getting skipped in a
list). Sent via the existing `_send_via_resend` helper.

- **To:** `LEGAL_ALERTS_EMAIL` (new env var, defaults to the founder email
  already used for other operational alerts)
- **Subject:** `⚠️ Legifrance: {label} changed`
- **Body:** the label, a direct link to the article on legifrance.gouv.fr,
  and a short excerpt (first ~300 chars) of old vs. new text side by side —
  enough for a human to judge whether it's substantive before clicking
  through, not a full diff.
- The "3 consecutive failures" alert uses a different subject
  (`⚠️ Legifrance watchlist: {label} failing to check`) so it's not confused
  with an actual legal change.

## Error handling summary

| Failure | Behavior |
|---|---|
| PISTE auth fails entirely (bad/expired credentials) | Whole `check_watchlist()` call logs one warning and returns empty list; every item's `consecutive_failures` increments; retried next sweep tick |
| One article's fetch 404s / errors | That item's `consecutive_failures` increments; others still checked normally |
| Resend email send fails | Logged, not retried within the same run (matches existing `_send_via_resend` behavior elsewhere in the codebase) — the change is still recorded as detected (hash already updated), so it won't re-alert on the next run for the same change, but also won't re-attempt the failed send. Acceptable given this is a low-frequency, human-reviewed alert, not a transactional flow. |
| 3 consecutive failures on one item | Extra "watchlist entry broken" alert, separate from a "text changed" alert |

## Prerequisites (blocking, external to this codebase)

**You need to register a developer account and application at
https://piste.gouv.fr/ to obtain `LEGIFRANCE_CLIENT_ID` and
`LEGIFRANCE_CLIENT_SECRET`.** This is not something that can be done from
inside this repo or by an agent — it's an account-registration step on a
government developer portal. The integration can be built and unit-tested
against PISTE's documented API shape without these credentials, but cannot be
verified against the real live API (the way ADEME/Overpass/Frankfurter were
verified with real calls) until they're provided, same situation as the
currently-untested Gemini/Twilio/Google-OAuth/Sentry/R2 credentials.

**The six Legifrance article IDs must be researched and confirmed during
implementation** (via legifrance.gouv.fr or PISTE's search endpoint) — this
spec deliberately does not guess them, since a wrong ID means silently
watching the wrong text.

## Testing

- Unit tests for `check_watchlist()` against a mocked PISTE client covering:
  first-run seeding (no alert), hash-match (no alert), hash-mismatch (alert
  with correct fields), fetch failure (failure counted, no crash), and the
  3-failures-triggers-its-own-alert path.
- Unit test for `maybe_check_legal_watchlist`'s 30-day gate (mocked
  `last_checked_at` values: null, 29 days ago, 31 days ago).
- No live PISTE integration test is possible until credentials are provided
  (matches how ORS/Resend/ADEME tests in this codebase are structured: mocked
  by default, with a documented manual live-check path).

## Out of scope (this pass)

- Auto-applying any detected change to code/config.
- An admin-panel UI for reviewing changes (email only, per your answer).
- Tracking any legal text beyond the 6 named in CLAUDE.md.
- Diffing beyond a short excerpt (no full text-diff rendering).
