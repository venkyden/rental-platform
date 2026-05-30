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

## Backlog (deferred, documented in the change proposal)
- Redis `requirepass`; uncomment nginx TLS + HSTS at the proxy; secret-scanning in CI;
  nonce-based CSP to drop `unsafe-inline`; patch-pin Docker base images;
  explicit FK `ON DELETE/UPDATE` actions.
