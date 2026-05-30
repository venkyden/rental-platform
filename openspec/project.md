# OpenSpec — Roomivo

Spec-driven context for the Roomivo rental platform, per
`.agent/rules/master_rules.md` (which mandates OpenSpec + a `journal.md` per feature).

## Product
AI-assisted rental platform for the French market (6 segments: D1–D3 demand /
S1–S3 supply). Tenants build a verified digital dossier; landlords/agencies list
properties, screen applicants, generate French-compliant leases, and resolve
disputes.

## Stack
- **Backend:** FastAPI (async) + SQLAlchemy/asyncpg + PostgreSQL, Alembic migrations,
  Redis (cache + Celery broker), Cloudflare R2 (S3-compatible) object storage,
  Resend (email), Stripe Identity / Fourthline (KYC), Sentry.
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind v4, context-based state,
  i18n (en/fr) via `frontend/lib/i18n.ts`, Playwright e2e.
- **Hosting:** Render (EU / Frankfurt data region). Deploy via `render.yaml`.

## Hard constraints (compliance)
- **France first.** DPE mandatory + DPE-G ban, 9 m² minimum, deposit caps (loi 1989),
  rent control / encadrement des loyers (loi ALUR/ELAN), Visale/GLI, GDPR/CNIL.
- **No SIRET.** Roomivo operates as a **student-entrepreneur project under the SNEE**
  (PÉPITE Pays de la Loire / Audencia), not yet incorporated. Mentions Légales must
  reflect this and must never fabricate a SAS/capital/SIRET. (Backend `verify_siret`
  is for verifying *tenants' employers*, unrelated to Roomivo's own status.)

## Engineering conventions
- Money columns: `Numeric(10,2)`. PII: encrypted JSON columns (Fernet, MASTER_ENCRYPTION_KEY).
- Datetimes should be timezone-aware (`datetime.now(timezone.utc)`); legacy naive calls
  are being migrated (see backlog).
- No blocking I/O in request handlers — email goes via `BackgroundTasks` / Celery.
- No secrets in git (`.env` is gitignored); secrets via Render env (`sync: false`).

## Layout
- `openspec/changes/` — change proposals (one folder per change).
- `docs/features/*/journal.md` — per-feature engineering journals (audit + decisions).
