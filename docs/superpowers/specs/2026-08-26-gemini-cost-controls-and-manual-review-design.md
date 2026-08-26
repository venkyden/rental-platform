# Gemini Cost Controls & Manual-Review Fallback — Design Spec

**Date:** 2026-08-26
**Status:** Approved
**Scope:** `backend/app/core/{config,gemini_quota}.py`, `backend/app/services/{identity,mrz}.py`,
`backend/app/routers/{verification,admin}.py`, `backend/app/services/email.py`,
`.github/workflows/qa_agent.yml`, `frontend/components/{DocumentCapture,VerificationUpload}.tsx`,
`frontend/lib/i18n.ts`, `frontend/app/admin/**` (new review screen).
No DB migrations — everything reuses existing Redis + `EncryptedJSON`/`encryption_service` patterns.

---

## Context

This branch stacks on `fix/qa-agent-cost-and-mrz-settings` (PR #75), which fixed a `NameError`
in `mrz.py` and a retired `GEMINI_FALLBACK_MODEL` default. During that work we discovered the
project's Gemini API key had its prepay balance fully depleted — confirmed via direct API probes
(structured `429 RESOURCE_EXHAUSTED: "Your prepayment credits are depleted"`, no `QuotaFailure`
detail, `ListModels` still succeeds) — meaning the AI Studio project has billing linked and was
running on paid pay-as-you-go, not the free tier, with zero warning before it broke every
Gemini-backed verification in production. The user topped up €25 and wants three things instead
of just "hope it doesn't happen again":

1. Don't rely on AI 100% of the time, and don't overspend the new balance without warning.
2. Help users get a usable photo in one shot, since a failed OCR extraction burns a paid call
   for nothing.
3. When Gemini is genuinely unavailable, fall back to **manual review**, not a hard failure.

### The constraint that shapes part 3

`identity_data`, `employment_data`, and `verification_data` never retain the source document —
confirmed in `admin.py`: `POST /admin/verifications/{id}/approve` already **refuses** `type ==
"identity"` with `"no document is retained post-retrofit"`. The only precedent for holding a raw
document at all is the 10-minute Redis cache in `verification.py` (`identity_doc:{user_id}:{token}`,
`ttl=600`) that bridges the ID-photo → selfie-match steps, purged immediately after.

A human cannot review what was never kept. The user explicitly chose to accept a **scoped, TTL'd
exception** to the "never store ID documents at rest" rule in CLAUDE.md, specifically for the
Gemini-down case — encrypted, 48-hour auto-purge, so it inherits the same fail-safe discipline as
everything else in this codebase rather than becoming a silent, permanent carve-out.

---

## Part 1 — Rate limiting & budget protection

Goal: don't overspend the new €25 balance without warning, and don't let a bug or a runaway
agent run drain it unnoticed the way it did before.

### `backend/app/core/config.py`

```python
GEMINI_DAILY_LIMIT: int = 500   # was 1500 — sized to a ~100-tenant burst day (~300 calls)
                                  # plus retry headroom, not to the old free-tier assumption
GEMINI_DAILY_ALERT_THRESHOLD: float = 0.7   # send a warning email at 70% of GEMINI_DAILY_LIMIT
ADMIN_ALERT_EMAIL: Optional[str] = None     # where budget + manual-review emails go
```

`GEMINI_RPM_LIMIT` stays at `10` — that's a separate, already-correct lever (concurrency
smoothing) and changing it isn't part of "don't overspend."

### `backend/app/core/gemini_quota.py` — `check_quota()`

Add one branch after the existing `count > limit` check, using the *same* counter so there's no
new Redis key or counting logic:

```python
alert_at = int(limit * settings.GEMINI_DAILY_ALERT_THRESHOLD)
if count == alert_at:  # fires exactly once per day, on the crossing increment
    from app.services.email import email_service
    await email_service.send_admin_alert(
        subject="Gemini daily usage at 70%",
        body=f"{count}/{limit} Gemini calls used today ({_today_key()}).",
    )
```

`count == alert_at` (not `>=`) so it fires once, not on every request past the threshold — Redis
`INCR` gives a strictly increasing integer per key, so exactly one call will match. Wrap in
try/except like the rest of this module: a failed alert email must never block a verification
request (`logger.warning`, allow the request through — same failure posture as the existing
`check_quota`/`gemini_slot` exception handling).

### `backend/app/services/email.py` — new method

```python
async def send_admin_alert(self, subject: str, body: str) -> None:
    """Best-effort operational alert to ADMIN_ALERT_EMAIL. Never raises."""
    if not settings.ADMIN_ALERT_EMAIL:
        logger.warning("ADMIN_ALERT_EMAIL not set, dropping alert: %s", subject)
        return
    # same resend.Emails.send(...) pattern already used elsewhere in this file
```

### `.github/workflows/qa_agent.yml`

```yaml
      - name: Run QA Agent
        id: qa_agent
        timeout-minutes: 15
```

A hard wall-clock ceiling on the one workflow step that calls Gemini via `google.antigravity`
(not the FastAPI app, so it can't go through `gemini_quota.py` — this is the only lever available
without introspecting the SDK, which isn't installed locally to check for a native turn/step cap).
Combined with the already-shipped `ENABLE_VERIFIER=false`, this bounds a single run's worst case
without guessing at undocumented SDK internals.

---

## Part 2 — Capture guidance copy (no new logic)

Every failed OCR extraction costs a paid call for nothing and pushes the user into a retry loop.
`frontend/components/DocumentCapture.tsx` already has a per-document-type tips list shown during
live capture — the tips exist but are vague ("Don't rush - take your time", "Ensure good focus").
Replace with the concrete framing/lighting/stillness guidance that actually predicts a clean
Gemini extraction:

```ts
passport: tips: [
    "Fill the frame — all four corners of the bio page visible, nothing cropped",
    "Hold flat, not tilted — a skewed angle blurs the text Gemini needs to read",
    "Angle away from overhead lights and windows — no glare, no flash",
    "Hold steady for 2 seconds before it captures — motion blur is the #1 reason scans fail",
],
id_card front: tips: [
    "Fill the frame — all four corners of the card visible, nothing cropped",
    "Hold flat and parallel to your camera — don't tilt",
    "Angle away from overhead lights — no glare, no flash",
    "Hold steady for 2 seconds — don't capture while still moving into frame",
],
id_card back: tips: [
    "Fill the frame with all four corners of the card visible",
    "Same flat angle as the front — don't flip at a tilt",
    "Good, even lighting — avoid shadows across the text",
    "Hold steady for 2 seconds before it captures",
],
drivers_license front/back: same pattern, keep the existing barcode-visibility tip verbatim
  (domain-specific, still correct) and replace only the vague ones.
```

Also tighten `frontend/lib/i18n.ts`'s
`dashboard.verification.verification.instructions.step3` (both `en` ~line 1112 and `fr` ~line
4052 — this string IS localized, unlike `DocumentCapture.tsx`) from "Capture clear photos of
front & back" / "Capturez des photos claires du recto et du verso" to name the same concrete
failure modes: fill the frame, flat angle, no glare, hold steady.

Not in scope: adding i18n to `DocumentCapture.tsx` (it's hardcoded English today; that's a
pre-existing gap, not something this change should fix) and any client-side blur/glare detection
(explicitly deferred per the earlier "copy only" decision).

---

## Part 3 — Manual review when Gemini is unavailable

**Trigger**: in `identity.py::_extract_document_data` and `mrz.py::_ai_extract_mrz`, both entries
in `models_to_try` (`GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`) exhaust their retries. Today that
path returns a failure result straight to the user. New behavior: stash the document for review
instead of just failing.

### Storage — extends the existing `verification.py` Redis pattern

```python
# app/routers/verification.py (new helper, used by identity.py/mrz.py on AI exhaustion)
async def stash_for_manual_review(user_id: UUID, image_bytes: bytes, content_type: str, doc_type: str) -> str:
    from app.utils.encryption import encryption_service
    token = secrets.token_hex(16)
    payload = {
        "user_id": str(user_id),   # recovered from the payload, not the key — see below
        "image_b64": base64.b64encode(image_bytes).decode(),
        "content_type": content_type,
        "doc_type": doc_type,
        "stashed_at": datetime.now(timezone.utc).isoformat(),
    }
    encrypted = encryption_service.encrypt_json(payload)
    await cache.set(f"identity_review:{token}", {"encrypted": encrypted}, ttl=48 * 3600)
    return token
```

The Redis key is `identity_review:{token}` only — `token` is a 32-hex-char random value
(`secrets.token_hex(16)`), unguessable on its own, so it's safe to put directly in the admin
review URL and email link. `user_id` lives *inside* the encrypted payload and is recovered after
decryption, not parsed from the key — the earlier `{user_id}:{token}` key shape would have left
the endpoint with no way to reconstruct the key from `token` alone.

Same `encryption_service` (Fernet, `MASTER_ENCRYPTION_KEY`) already required in production for
every other piece of PII this app touches — no new crypto primitive introduced. Same Redis-with-TTL
pattern as the existing 600s bridge — just a longer, explicitly-labeled window and a distinct key
prefix (`identity_review:` vs `identity_doc:`) so it's never confused with the short-lived
face-match bridge in code or in an audit.

### Notification

On stash, call `email_service.send_admin_alert(...)` with a link to
`/admin/verifications/review/{token}` (the token returned by `stash_for_manual_review`, already
URL-safe hex). Reuses the Part 1 email plumbing — no second notification path to maintain.

### New admin endpoints — `backend/app/routers/admin.py`

```python
@router.get("/verifications/review/{token}")
async def get_review_document(token: str, _: User = Depends(require_admin)):
    """Decrypt and return the stashed document for manual review. Admin-only."""
    raw = await cache.get(f"identity_review:{token}")
    if not raw:
        raise HTTPException(404, "Review item not found or expired")
    payload = encryption_service.decrypt_json(raw["encrypted"])
    return {"image_data_url": f"data:{payload['content_type']};base64,{payload['image_b64']}",
            "doc_type": payload["doc_type"], "stashed_at": payload["stashed_at"]}

@router.post("/verifications/review/{token}/approve")
async def approve_reviewed_document(token: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    """Manually approve after visual review. Sets MEDIUM assurance, labeled reviewer-approved."""
    raw = await cache.get(f"identity_review:{token}")
    if not raw:
        raise HTTPException(404, "Review item not found or expired")
    payload = encryption_service.decrypt_json(raw["encrypted"])
    user = await db.get(User, UUID(payload["user_id"]))
    if not user:
        raise HTTPException(404, "User not found")
    user.identity_verified = True
    user.identity_status = "verified"
    user.identity_data = {
        "assurance": "MEDIUM",
        "verification_method": "manual_review",
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.commit()
    await cache.delete(f"identity_review:{token}")  # purge immediately on approval, don't wait for TTL
    return {"status": "approved", "user_id": payload["user_id"]}
```

`verification_method: "manual_review"` is a new, explicit field — distinguishes this from an
AI-verified MEDIUM in `identity_data`, consistent with the project's "never inflate a MEDIUM to
HIGH" discipline: this is a *different provenance*, not a higher tier, and should be visibly
labeled as such everywhere `identity_data` is read.

The existing identity `/approve` guard (`"no document is retained post-retrofit"`) stays exactly
as-is for the *undifferentiated* case — it only ever applied to "no AI attempt was made," which
remains true outside this new stash path.

### Employment / property — no new retention needed

Their existing `/admin/verifications/{id}/approve` already approves without a document (a pure
judgment call). On Gemini exhaustion in `employment.py`/`property.py`, just route to the same
`send_admin_alert` + existing `/admin/verifications/pending` queue — no stash, no new endpoint.

### Frontend — new admin review screen

`frontend/app/admin/verifications/review/[token]/page.tsx` (new route): fetches
`GET /admin/verifications/review/{token}`, renders the image, shows doc type + stash timestamp,
one **Approve** button calling the approve endpoint. Minimal — this is an internal ops tool, not
end-user-facing, so it doesn't need the same design polish as `VerificationUpload.tsx`.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Both Gemini attempts fail, Tesseract fallback succeeds (MRZ only) | No stash — Tesseract success is still a valid automated result, distinct from "AI unavailable" |
| Admin never reviews within 48h | Redis TTL expires, key auto-purges — same fail-safe as the rest of the codebase, no orphaned PII |
| User re-attempts upload before admin reviews the stash | New stash created under a new token; old one still expires on its own TTL — mild duplication, acceptable, matches how `identity_doc:` already handles re-uploads (`purge_identity_doc` on the *old* redis_key when set) |
| `ADMIN_ALERT_EMAIL` unset | Alert is dropped with a logged warning, never blocks the verification request itself |
| Daily counter crosses 70% more than once due to a Redis restart resetting the key mid-day | Rare, acceptable — worst case is one duplicate alert email, not a missed one |
| Employment/property Gemini exhaustion | Alert + existing pending-review queue, no stash (see above) |

---

## What This Does NOT Change

- `GEMINI_RPM_LIMIT` — unchanged, out of scope for this pass
- The existing 10-minute `identity_doc:` face-match bridge — untouched, different key prefix
- Employment/property `/approve` — already works, no document dependency added
- No new DB tables/migrations — Redis TTL + existing `EncryptedJSON`/`encryption_service` cover everything
- `DocumentCapture.tsx` gains no i18n support and no client-side quality detection (both explicitly deferred)

---

## Files Changed

| File | Change |
|---|---|
| `backend/app/core/config.py` | `GEMINI_DAILY_LIMIT` 1500→500, add `GEMINI_DAILY_ALERT_THRESHOLD`, `ADMIN_ALERT_EMAIL` |
| `backend/app/core/gemini_quota.py` | Alert branch in `check_quota()` |
| `backend/app/services/email.py` | New `send_admin_alert()` |
| `.github/workflows/qa_agent.yml` | `timeout-minutes: 15` on the QA agent step |
| `frontend/components/DocumentCapture.tsx` | Rewrite `tips` arrays, all document types |
| `frontend/lib/i18n.ts` | Tighten `instructions.step3` (en + fr) |
| `backend/app/routers/verification.py` | New `stash_for_manual_review()` helper |
| `backend/app/services/identity.py` | Call stash on AI-exhausted `_extract_document_data` |
| `backend/app/services/mrz.py` | Call stash on AI-exhausted `_ai_extract_mrz` |
| `backend/app/services/employment.py`, `property.py` | Call `send_admin_alert` (no stash) on AI exhaustion |
| `backend/app/routers/admin.py` | New `GET/POST /verifications/review/{token}` endpoints |
| `frontend/app/admin/verifications/review/[token]/page.tsx` | New admin review screen |
| Tests | New coverage for: alert-threshold firing once, stash/decrypt/approve/purge round-trip, TTL expiry, employment/property alert-only path |
