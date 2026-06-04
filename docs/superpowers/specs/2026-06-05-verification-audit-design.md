# Verification System — Full Audit & Remediation
**Date:** 2026-06-05  
**Scope:** All verification-related pages, backend routes, schema, i18n, UI, browser compat, security, and performance  
**Delivery:** Two PRs — `hotfix/verification-critical` then `feat/verification-cleanup`

---

## Audit Summary

18 source files analysed. 27 real issues found across 8 domains. 3 false alarms cleared (identity service methods exist in `identity.py`; session store is Redis-first; trust score mutation ordering is safe within SQLAlchemy session).

**Files in scope:**
- `frontend/app/verify/identity/page.tsx`
- `frontend/app/verify/income/page.tsx`
- `frontend/app/verify/guarantor/page.tsx`
- `frontend/app/auth/verify-email/page.tsx`
- `frontend/app/auth/verify-email-change/page.tsx`
- `frontend/app/verify-capture/[code]/page.tsx`
- `frontend/app/verify/error.tsx`
- `frontend/app/verify-capture/error.tsx`
- `frontend/components/VerificationUpload.tsx`
- `frontend/components/VerificationGate.tsx`
- `frontend/components/EmailVerificationRequired.tsx`
- `frontend/lib/i18n.ts`
- `backend/app/routers/verification.py`
- `backend/app/services/identity.py`
- `backend/app/services/identity_service.py`
- `backend/app/models/user.py`
- `backend/app/utils/watermark.py`
- `backend/tests_integration/test_verification_kyc.py`

---

## PR 1 — Hotfix (`hotfix/verification-critical`)

**Target:** Merge immediately. ~85 lines changed. No schema migrations. No new dependencies.

### Fix 1 — VerificationGate routing (CRITICAL)
**File:** `frontend/components/VerificationGate.tsx` lines 58–70  
**Problem:** All CTA paths use `/verification/*` prefix. Pages live at `/verify/*`. Every gated action leads to a 404.  
**Fix:** Replace all six route strings:
- `/verification/identity` → `/verify/identity`
- `/verification/email` → `/verify/email`  
- `/verification/income` → `/verify/income`
- `/verification/employment` → `/verify/identity` (same page handles both)
- `/verification/documents` → `/verify/identity`
- `/verification` → `/verify/identity`

### Fix 2 — Guarantor "none" sets wrong status (CRITICAL)
**File:** `backend/app/routers/verification.py` — guarantor init endpoint  
**Problem:** `guarantor_type="none"` sets `guarantor_status="verified"`. User bypasses guarantor requirement and gains unearned trust score.  
**Fix:** Set `guarantor_status="unverified"` when type is "none". Do not adjust trust score.

### Fix 3 — Identity contradictory state flags (CRITICAL)
**File:** `backend/app/routers/verification.py` — two-step identity upload, document side  
**Problem:** After front-of-ID upload, code sets both `identity_verified=False` and `identity_status="document_verified"`. The status string implies progress; the bool implies nothing has happened. Any check reading the bool sees "not verified" even when the document passed AI checks.  
**Fix:** Rename the intermediate status to `"document_uploaded"` (unambiguous pending state). The bool `identity_verified` is only set `True` on full completion (selfie pass). Rule: `identity_verified` is the authoritative field; `identity_status` is a display/audit field only.

### Fix 4 — Guarantor file URLs in API response (CRITICAL — Security)
**File:** `backend/app/routers/verification.py` — verification status endpoint  
**Problem:** Full decrypted `guarantor_data` JSON, including `files[].file_url` (signed GCS URLs), returned to frontend. Any XSS, logged response, or MITM exposes document storage paths.  
**Fix:** Before returning, strip `files` from `guarantor_data`. Replace with `file_count: int`. Frontend only needs to know how many documents have been uploaded, not their storage URLs.

```python
safe_guarantor = {k: v for k, v in guarantor_data.items() if k != "files"}
safe_guarantor["file_count"] = len(guarantor_data.get("files", []))
```

### Fix 5 — Error pages hardcoded English (HIGH — Silent failure)
**Files:** `frontend/app/verify/error.tsx`, `frontend/app/verify-capture/error.tsx`  
**Problem:** "Something went wrong", "Try Again", "Go to Dashboard", "Secure Capture" are hardcoded. French users see English error text.  
**Fix:** Add keys to `i18n.ts` under `errors.*` and `verify.capture.*` namespaces, wire `useTranslation()` in both error components.

New keys (EN + FR required):
- `errors.somethingWentWrong`
- `errors.tryAgain`
- `errors.goToDashboard`
- `verify.capture.title`

### Fix 6 — EmailVerificationRequired route regex (HIGH — Silent failure)
**File:** `frontend/components/EmailVerificationRequired.tsx` line ~21  
**Problem:** Route sensitivity check uses `startsWith` string matching. Misses sub-paths like `/applications/123/edit`. Also doesn't correctly cover all `/verify/*` paths.  
**Fix:** Replace string array with regex array:

```ts
const sensitiveRoutes = [
  /^\/properties\/new$/,
  /^\/applications/,
  /^\/leases/,
  /^\/disputes/,
  /^\/verify/,
  /^\/gli/,
]
const isSensitive = sensitiveRoutes.some(r => r.test(path))
```

### Fix 7 — Canvas toBlob() silent failure + HEIC on iOS (HIGH — Browser / Silent failure)
**File:** `frontend/components/VerificationUpload.tsx` — image compression block  
**Problem:** (a) `canvas.toBlob()` can return `null` on iOS under memory pressure or with unsupported input types — code dereferences it with `blob!` causing a silent undefined. (b) HEIC/HEIF files passed through canvas on iOS fail silently; Gemini handles HEIC natively so compression is unnecessary.  
**Fix:**
1. Skip canvas entirely for `image/heic` and `image/heif` — return original file.
2. Add null guard: if `toBlob` callback receives `null`, resolve with original file.

---

## PR 2 — Cleanup (`feat/verification-cleanup`)

**Target:** Built on top of hotfix. Pure quality work — no user-blocking bugs. ~400 lines across 12 files.

### Domain: i18n / Dual Language

**Guarantor page — 4 hardcoded blocks**  
`frontend/app/verify/guarantor/page.tsx`  
Add keys under `verify.guarantor.physical.*`:
- `instructions` — physical guarantor section header
- `alurNotice` — ALUR law reference paragraph
- `gdprConsent` — GDPR/CNIL consent checkbox label
- `submitCta` — "Complete Registration" button

**VerificationGate modal — all benefit text, titles, CTA**  
`frontend/components/VerificationGate.tsx`  
Add `gate.modal.*` namespace with per-requirement variants for titles, benefit strings, and "Verify Now" CTA. Remove the `benefit.split(' ').slice(1).join(' ')` emoji-strip hack — store clean text in i18n keys with emoji as a separate prefix key or remove entirely.

**EmailVerificationRequired — confirmation CTA**  
Add `auth.emailVerification.confirmedCta` key for "I've verified my email →".

**verify-capture language toggle mutation**  
Replace direct context state mutation with `setLocale()` call through i18n provider.

---

### Domain: Schema / State Machine

**employment_status sync**  
`backend/app/routers/verification.py` line 759  
Current: `employment_status = income_status` (wrong field copied).  
Fix: set `employment_status` from the employment verification result directly. Include `employment_status` in the status response payload so frontend can display it.

**ownership_status update on property verification**  
Add `current_user.ownership_status = "verified"` (or `"rejected"`) to the property verification endpoint, matching the pattern used by identity and employment.

**Trust score atomic update**  
All trust score increment/decrement sites currently use Python addition (`user.trust_score += N`). Replace with SQLAlchemy column expression to let the DB handle atomicity:
```python
from sqlalchemy import func, update
# instead of: user.trust_score = min(100, user.trust_score + 30)
await db.execute(
    update(User)
    .where(User.id == user.id)
    .values(trust_score=func.least(100, User.trust_score + 30))
)
await db.refresh(user)  # reload updated value into the session object
```
Apply at all 4+ increment sites and both decrement sites (`func.greatest(0, ...)` for decrements).

---

### Domain: Logic / Reliability

**Employment doc upload — transaction safety**  
Wrap the multi-file loop in a single transaction. On any file failure: rollback all, return error. Commit only after all files processed successfully.

**Physical guarantor — doc type deduplication**  
On upload, check if `guarantor_data["files"]` already contains an entry with the same `doc_type`. If yes, replace it (last-write-wins). Prevents unbounded list growth from re-uploads.

**Visale/Garantme — name validation**  
Reuse existing `_fuzzy_name_match()` from `identity.py`. Extract name from certificate via the existing AI verification call. Reject if match < 0.5. Flag for manual review if 0.5–0.75.

**Session cleanup — async background**  
Move `_cleanup_expired_sessions()` out of the hot path. Use FastAPI `BackgroundTasks` or a timestamp throttle (run only if last cleanup > 60s ago).

**Watermark ordering**  
Current order: upload → watermark bytes → store → run AI verification. Problem: rejected documents are watermarked and stored unnecessarily (GDPR data minimisation concern, wasted GCS storage).  
Fix order: upload → run AI verification → if passed: watermark bytes → store. Rejected documents are never written to storage. The `file_content` bytes are already in memory before the storage call, so this is a code-order change only.

---

### Domain: Browser Compat / Mobile

**capture="environment" desktop fallback**  
`frontend/app/verify-capture/[code]/page.tsx`  
`isMobile` detection already exists in the component. Conditionally set `capture="environment"` only on mobile. On desktop: change label text from "Take a photo" to "Upload a photo of your ID" and remove the `capture` attribute entirely.

**SSE polling exponential backoff**  
`frontend/components/VerificationUpload.tsx`  
On SSE error, fall back to polling with: initial 2s, double each miss, cap at 30s, reset on success.

---

### Domain: UI / Animation / Style

**verify-capture step transitions**  
Add CSS fade + slide between steps. Use Tailwind `transition-all duration-200` with a `translate-y-2 opacity-0` → `translate-y-0 opacity-100` class swap. No library needed.

**Guarantor flow progress indicator**  
Add a 4-step pill progress bar at the top of the guarantor page: Select type → Upload docs → Consent → Confirm. Current step highlighted. Matches existing design system pill style.

**VerificationGate modal icon**  
Replace empty whitespace at line 181 with a shield SVG icon from the existing icon set used in dashboard cards.

**QR code "Copy link" fallback**  
Below the QR code on the desktop identity flow: add a "Copy link" button using `navigator.clipboard.writeText()`. Show a 2s "Copied!" flash on success.

---

### Domain: Performance

**GLI rate limiting**  
`backend/app/routers/verification.py` — GLI quote endpoint  
Add per-user rate limit: 10 quote requests per user per 24 hours. Counter stored in Redis with 24h TTL (use existing `cache` layer). Return `429` with message when exceeded.

---

## Testing

### Backend — Integration Tests (new, in `test_verification_kyc.py`)
- `test_guarantor_none_status_is_unverified` — type="none" → status="unverified", score unchanged
- `test_identity_document_uploaded_state` — intermediate state flags are consistent
- `test_guarantor_data_strips_file_urls` — response has `file_count`, no `files`
- `test_employment_upload_transaction_rollback` — partial upload rolls back completely
- `test_guarantor_dedup_same_doc_type` — re-upload same type produces list of length 1
- `test_trust_score_concurrent_update` — concurrent requests produce correct final score
- `test_ownership_status_set_on_verification` — ownership_status set after property upload
- `test_gli_rate_limit` — 11th request returns 429
- Extend existing webhook tests with visale/garantme name mismatch cases

### Frontend — Component Tests
- `VerificationGate.test.tsx` — `getVerificationPath()` always returns `/verify/*`
- `VerificationUpload.test.tsx` — HEIC skips canvas; `toBlob(null)` returns original file
- `EmailVerificationRequired.test.tsx` — sensitive and non-sensitive route coverage
- `i18n.test.ts` — assert all referenced keys exist in both EN and FR

### E2E — Playwright (`verification_flows.spec.ts`)
- Unverified user → gate CTA → lands on `/verify/identity` (not 404)
- Guarantor "none" → status shows "No guarantor", score unchanged
- verify-capture step transition CSS class applied on step change
- Error page in FR locale contains no hardcoded English strings
- Desktop viewport → QR screen shows "Copy link" button

### Run order
Backend integration → Frontend unit → E2E. All must pass before either PR merges.

---

## Constraints
- No new npm packages or Python packages introduced
- No Alembic migrations needed (all schema columns already exist)
- `employment_status` and `ownership_status` column writes are additive — no read-path breakage
- All backend changes maintain existing API contract shapes (additions only, no removals except `files` key replaced by `file_count`)
- Browser targets: iOS Safari 15+, Chrome 110+, Firefox 115+, Android Chrome 110+
