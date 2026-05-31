# Journal — Security, Headers & Infrastructure

## Purpose
Cross-cutting security posture: headers, CORS, secrets, request-path I/O, plus admin,
webhooks, feedback, and deploy/infra.

## Surface
- `app/main.py` (middleware, CORS, exception handlers), `app/core/*` (config, security,
  database, cache), `app/routers/{admin,webhooks,feedback}.py`,
  `nginx/nginx.conf`, `docker-compose.prod.yml`, `render.yaml`, `frontend/next.config.ts`.

## Audit findings → fixes
- 🟠 **Weak/incorrect security headers.** **Fixed** in `main.py`: added HSTS (prod only),
  `Referrer-Policy`, `Permissions-Policy`; COOP `unsafe-none` → `same-origin-allow-popups`;
  removed `'unsafe-eval'` from CSP; added `base-uri`/`frame-ancestors`/`object-src`.
  Aligned `next.config.ts` (its COOP value contradicted its own comment) + HSTS.
- 🟠 **Blocking disk I/O in the request path.** `main.py` wrote `validation_errors.log`
  on every 422. **Fixed:** log via the logger only.
- 🟡 **Over-broad CORS** (`allow_methods/headers=["*"]`). **Fixed:** explicit allow-lists.
- 🟢 **Corrected two false alarms from the audit:** `.env` secrets are **not** in git
  (never committed, gitignored) and `node_modules` is **not** tracked.

## Verified good (kept)
- Argon2 password hashing; rate limiting (slowapi + nginx); Fernet PII encryption;
  SQLAlchemy ORM (no raw SQL/injection); Render EU (Frankfurt) region; Docker multi-stage
  non-root build.

## Resolved in backlog pass (2026-05) — see `openspec/changes/2026-05-backlog-hardening`
- ✅ Redis `requirepass` + authed healthcheck + password in `REDIS_URL` (compose).
- ✅ nginx HSTS added; TLS block completed (prior `listen 443 ssl` had certs commented → couldn't start).
- ✅ CI: TruffleHog secret-scan job; fixed trigger (`main` → also `master`); new tests included.
- ✅ Docker base images pinned (`python:3.11.9-slim`, `node:20.18-alpine`, `nginx:stable-alpine`).
- ✅ Whole-app `datetime` de-deprecation via `app/core/timeutils.py`.

## Backlog (still deferred — need a live DB/runtime)
- Explicit FK `ON DELETE/UPDATE` actions migration (data-loss risk → DB test required).
- Nonce-based CSP to drop `unsafe-inline`; migrate naive timestamp columns to tz-aware.
