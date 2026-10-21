# Compliance pack — DOSSIER

Built 2026-10-20 from the gaps in `docs/legal/2026-10-20-council-legal-review.md` §4 (not legal
advice; no lawyer budget, see the founders' decision recorded there).

## What it covers

| Duty | Where |
|---|---|
| Notice and action: anyone can report illegal content (DSA art. 16) | `/report?listing=…`, `POST /reports`, link "Report this listing" on every listing a visitor does not own |
| Receipt and decision sent to the reporter (art. 16(4)–(5)) | `backend/app/routers/reports.py` |
| Statement of reasons to the owner when a listing is taken down (art. 17) | same; email states the facts, the ground (illegal or terms), that a person decided, and how to contest |
| No automated decision on reports (art. 16(6)) | the queue at `/admin/reports`; nothing decides a report automatically |
| Contact points for authorities and users (art. 11–12) | legal notice, section "Contact points" |
| Terms describe the moderation rules (art. 14) | terms §4: non-discrimination (Code pénal 225-1), how to report, what happens next |
| Legal notice (LCEN art. 1-1) | `/legal/mentions-legales`; publication director, postal address and phone come from `frontend/lib/legalEntity.ts` |
| Privacy notice (GDPR art. 13) | `/legal/privacy`: controller, data, purposes and legal bases, recipients, transfers, retention, automated checks, rights and the CNIL |

Exempt as a micro or small enterprise (DSA art. 15(2), 19): transparency reports, internal
complaint-handling system, out-of-court settlement, trusted flaggers. The owner can still contest
by email and a person reviews; an upheld report can be reversed.

## How a report moves

`received` → `upheld` (listing goes `inactive`; publishing refused with 409
`listing_taken_down_after_report` while it stands) or `rejected` (listing untouched; owner not
emailed). `upheld` → `reversed` when the owner contests successfully; the owner can then republish.

The reporter's name and email are erased when the report is decided, and when the reporter deletes
their Roomivo account (matched on email, case-insensitive). The report text is kept.

## Rules

- The owner is never told who reported the listing; tests check the owner's email.
- A decision needs a reason of 20 characters or more; an upheld one also needs a ground.
- The report form is rate-limited to 5 per hour per IP address.
- The privacy notice states only what the code does today (see "Known gaps").

## Known gaps (not fixed here)

- **Publisher (decided 2026-10-21):** Roomivo Technologies Private Limited (India, CIN
  U58200PY2026PTC009828) publishes the site and is the GDPR controller; its registered office is
  on the notice, with the publication director (Nallam Venkataramaya, a director) and a contact
  phone, all set in `frontend/lib/legalEntity.ts`.
- **EU representative:** with an Indian controller, GDPR art. 27 and DSA art. 13 representatives
  apply unless the founders' work from France makes France an establishment (council review §4,
  confidence medium). The privacy notice names no representative; revisit when a lawyer can be
  consulted.
- **Scheduled clean-ups (fixed 2026-10-21, PR "fix(workers)"):** the embedded Celery worker in
  the backend web service (`start.sh`) ran the identity sweep every 15 minutes, but every run
  failed in production (a model not imported in the worker; pooled connections bound to an
  earlier event loop). The applications purge was never scheduled. Both now run; the privacy
  notice states the resulting deadlines.
- **Credential lifetime is unbounded:** `POST /credentials` accepts any `ttl_days`.
- **Validation errors from model validators return 500:** the app's `RequestValidationError`
  handler returns `exc.errors()` without `jsonable_encoder`, so a `ValueError` in a validator cannot
  be serialised. `reports.py` checks the ground in the route instead.
- **Host phone number:** LCEN asks for the host's phone; Render's is not on the notice.
- **No link to `/admin/reports`** in the admin navigation; admins open it directly.
- **Emails to arbitrary addresses:** the receipt goes to whatever email the reporter types,
  limited by the rate limit only.

## Tests

- `backend/tests_integration/test_content_reports.py` — 15 tests against real rows.
- `frontend/e2e/compliance_pack.spec.ts` — the form, the queue, the legal pages, in both languages.
