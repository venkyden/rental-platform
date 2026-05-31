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

## Bug found via real-DB IDOR test (2026-05-31)
- 🔴 **Team enum mismatch.** `InviteStatus`/`PermissionLevel` columns lacked
  `values_callable`, so SQLAlchemy bound uppercase member names while the PG enums
  use lowercase values → every team-permission query crashed
  (`InvalidTextRepresentationError`). This made non-owner property update return
  **500 instead of 403** and broke team-member property editing entirely.
  **Fixed** in `app/models/team.py`. Covered by `tests_integration/test_idor.py`.

## Resolved in backlog pass (2026-05)
- Naive `datetime.utcnow()` across `auth.py` → centralized `naive_utcnow()` (whole-app sweep).
- Remaining email senders (team invite, verification success/failed in `team.py` /
  `webhooks.py`) now offloaded via `BackgroundTasks` — zero synchronous `await email_service.*`.
