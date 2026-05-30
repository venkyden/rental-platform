# Change: Critical security & France-compliance remediation (2026-05-30)

## Why
A full audit against `.agent/rules/master_rules.md` found critical compliance and
security defects: a silently-broken GDPR export, unenforced rent control, a legal
notice misrepresenting the operator, weak security headers, event-loop-blocking
email, naive datetimes, and tracked junk. This change fixes the critical set
(phased, critical-first) and leaves a documented backlog.

## What changed
- **GDPR export (Art. 20)** — `backend/app/routers/gdpr.py`: fixed `Property.owner_id`
  → `landlord_id` and the wrong `app.models.message` import; replaced the silent
  `except: pass` with per-table logged guards; export now includes properties,
  messages, applications, documents, leases, disputes.
- **Rent control (encadrement des loyers)** — new pure validator
  `backend/app/services/french_compliance.py`, enforced in `publish_property`
  (`backend/app/routers/properties.py`). Rejects base rent above the majored
  reference €/m² without a justified `complément de loyer`.
- **Mentions Légales (no SIRET)** — `frontend/app/legal/mentions-legales/page.tsx` +
  `legal.notice.*` (en/fr) and `GlobalFooter.tsx`: now state the **SNEE
  student-entrepreneur** status (PÉPITE Pays de la Loire / Audencia), real host
  (Render / EU Frankfurt). Removed fabricated "Roomivo SAS / 10 000 € capital".
- **CNIL** — `frontend/sentry.client.config.ts`: Session Replay (non-essential
  tracking) now gated on analytics consent from the cookie banner.
- **Security headers** — `backend/app/main.py`: added HSTS (prod), Referrer-Policy,
  Permissions-Policy; COOP → `same-origin-allow-popups`; removed `unsafe-eval` from
  CSP; tightened CORS methods/headers. Aligned `frontend/next.config.ts`.
- **Blocking I/O** — removed `validation_errors.log` disk write from the request path;
  email send moved off the event loop (executor) + `BackgroundTasks` on auth routes
  + Celery `send_email_task` (`backend/app/workers/tasks.py`).
- **Datetime** — token create/expiry + GDPR now timezone-aware.
- **Repo hygiene** — removed tracked junk (incl. 6 MB `large_dummy.jpg`) and `scratch/`
  dirs; expanded `.gitignore`.

## Verification
- `pytest` (backend): 67 passed (55 existing + 12 new: rent-control unit tests,
  security-header/auth tests).
- App imports cleanly; `curl -I` shows the new headers; Mentions Légales renders
  SNEE status in en + fr with no SIRET.

## Backlog (deferred)
Full naive-datetime sweep (~50 sites) · explicit FK `ON DELETE/UPDATE` actions ·
Celery tasks for notifications/OCR · Redis `requirepass` + nginx TLS/HSTS · nonce-based
CSP (drop `unsafe-inline`) · de-duplicate `legal` i18n blocks · real-DB integration
tests for IDOR/concurrency · run k6 baseline.
