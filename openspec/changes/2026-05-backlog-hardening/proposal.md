# Change: Backlog hardening (2026-05-30, follow-up to critical remediation)

## Why
Continue the documented backlog from `2026-05-critical-remediation` with the items
that can be done safely and verified without a live DB/runtime.

## What changed
- **Timezone-aware datetime sweep.** New `backend/app/core/timeutils.py`
  (`utcnow()` aware / `naive_utcnow()` naive drop-in). Converted **all 51 remaining
  `datetime.utcnow()` calls + 16 callable column defaults across 24 files** — naive
  helper for the (still) timezone-naive columns, aware `utcnow()` for the tz-aware
  visit SQL filters. De-deprecates Python 3.12 with zero behaviour change. Zero
  `datetime.utcnow()` left in `app/`.
- **CI** (`.github/workflows/ci.yml`): fixed the trigger (was `main`; repo default is
  **`master`**), added a **TruffleHog secret-scan job**, and included the new tests.
  Scoped the over-broad `test_*.py` gitignore to root so `backend/tests/` is tracked.
- **Redis auth** (`docker-compose.prod.yml`): `--requirepass` + authenticated
  healthcheck + password in `api`/`worker` `REDIS_URL`.
- **Docker base images pinned**: `python:3.11.9-slim`, `node:20.18-alpine`,
  `nginx:stable-alpine`.
- **nginx TLS/HSTS** (`nginx/nginx.conf`): added HSTS; completed the TLS block (the
  prior `listen 443 ssl` had its cert lines commented out, so it could not start);
  documented the cert requirement + optional HTTP→HTTPS redirect.
- **Email offload completed**: the remaining synchronous sends (team invite,
  verification success/failed in `team.py` + `webhooks.py`) now use `BackgroundTasks`.
  Zero `await email_service.*` left in request/webhook paths.

## Corrected assumption
- The "duplicate `legal` i18n blocks" smell was a **misread** — the second block is
  `settings.legal` (under `settings:`), a different namespace from the top-level
  `legal` the Mentions Légales page uses. No real duplicate-key bug; no change needed.

## Verification
- `pytest`: 69 passed. App imports cleanly; `compileall` clean; CI + compose YAML valid.

## Remaining backlog (needs a live DB/runtime to do safely)
- Migrate the naive timestamp columns to `DateTime(timezone=True)` then flip their
  call sites to `utcnow()` (the helper is the single chokepoint).
- Explicit FK `ON DELETE/UPDATE` actions migration (data-loss risk → needs DB test).
- Nonce-based CSP to drop `unsafe-inline` (needs Next/GSI runtime testing).
- Real-DB IDOR/concurrency integration tests; applications `(tenant_id, property_id)`
  unique constraint. Run the k6 baseline.
