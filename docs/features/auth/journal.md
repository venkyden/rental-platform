# Journal — Authentication, Accounts, Teams & Onboarding

## Purpose
Registration/login (email + Google OAuth), JWT access/refresh, profile, email change,
password reset, multi-role switching, team membership, onboarding/segments, notifications.

## Surface
- `app/routers/auth.py` (19 endpoints), `app/core/security.py`,
  `app/routers/{team,property_manager,onboarding,notifications}.py`.
- Frontend: `/auth/*`, `lib/AuthContext.tsx`, `components/ProtectedRoute.tsx`.

## Audit findings → fixes
- 🟠 **Emails sent synchronously on the event loop.** `email.py` awaited the *blocking*
  `resend.Emails.send()` inside request handlers (register, password reset, email change,
  resend, forgot-email). **Fixed:** the blocking call runs in a thread executor; the auth
  routes schedule it via `BackgroundTasks`; a Celery `send_email_task` is the durable path.
- 🟠 **Naive token datetimes.** `create_access_token`/`create_refresh_token` used
  `datetime.utcnow()`. **Fixed:** `datetime.now(timezone.utc)`.
- 🟢 Verified: Argon2 hashing; password-reset uses generic responses (no user enumeration);
  forgot-email masks the address; team/property update paths enforce ownership + team
  permission levels (no IDOR found in the update/publish authorization logic).

## Tests
- `tests/test_security_headers.py::test_protected_endpoint_requires_auth` — `/auth/me`
  rejects unauthenticated access.
- Existing `tests/test_auth.py` (schemas/flows) still green.

## Backlog
- Remaining naive `datetime.utcnow()` in `auth.py` (e.g. `marketing_consent_at`) → datetime sweep.
- Convert remaining non-auth email senders (team invite, verification success/failed) to
  `BackgroundTasks`/Celery for consistency.
