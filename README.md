# Roomivo

**A rental marketplace with a built-in trust layer for the French rental market.**

Roomivo does two things with one engine:

1. **Marketplace** — landlords publish listings, tenants search and apply. Roomivo is a
   *passive publisher*: it never matches, recommends, or brokers counterparties, never
   touches funds, and never acts on a party's behalf (Loi Hoguet boundaries, enforced
   in code and CI).
2. **Trust layer** — either side verifies identity, solvency, and property control
   against free French state cryptography, and receives a **signed, expiring, portable
   credential** plus a watermarked evidence document. Credentials are verifiable by
   anyone at `roomivo.app` (no account) — usable inside Roomivo *and* on open
   classifieds (Leboncoin, PAP, Facebook Marketplace). Source documents are discarded
   after verification: **no PII at rest**.

The wedge: **deposit-theft prevention**. Both strangers become provable before any
money changes hands — and the money never moves through Roomivo.

## How verification works

| Check | Mechanism | Assurance |
|---|---|---|
| FR identity | OCR + selfie face-match (+ avis 2D-Doc name cross-check) | MEDIUM |
| FR solvency | Avis d'imposition 2D-Doc — DGFiP ECDSA signature verified offline | HIGH (banded, never raw figures) |
| INTL identity | MRZ OCR + ICAO checksums + selfie | MEDIUM |
| INTL solvency | Funds-coverage documents, FX-normalised, banded | MEDIUM |
| Property | Taxe foncière document + ADEME DPE open data | "control, not ownership-attested" |
| Insurance (MRH) | Attestation parsing — verification only, never sold | — |

Credentials are Ed25519-signed JSON with banded claims and a short TTL. Assurance
tiers are never inflated; MEDIUM is always labelled MEDIUM.

Leases: generated from the official Décret 2015-587 model only (no custom wording,
loi 1971) or uploaded and legality-screened; e-signature is in-house Ed25519
(eIDAS simple), lawyer-cleared 2026-06-24.

## Stack

- **Backend:** FastAPI · SQLAlchemy/AsyncPG · PostgreSQL · Redis (transient doc
  store, 10-min TTL) · Celery
- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind
- **Verification:** betagouv/2ddoc-parser · Tesseract · Ed25519 (cryptography)
- **Infra:** Render (backend + worker + Postgres), Upstash Redis, Cloudflare R2
- Philosophy: open-source + free state APIs, minimal third-party dependence, low OPEX.

## Quick start

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # set DATABASE_URL etc.
alembic upgrade head
uvicorn app.main:app --reload --port 8000   # docs at :8000/docs

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev               # :3000
```

## Testing

```bash
make test-unit           # backend unit tests (no DB)
make test-integration    # backend integration tests (needs Postgres)
cd frontend && npx tsc --noEmit && npx playwright test
```

## Project docs

- `CLAUDE.md` — condensed working context + regulatory red lines (read first)
- `PRD-TrustLayer-v2.md` — full product spec
- `docs/features/trust-layer/DOSSIER.md` — feature dossier, edge-case matrix, roadmap
- `docs/legal/` — lawyer opinions and counsel briefs
- `docs/business/` — pitch dossier (EN/FR)

## Deployment

Monorepo on Render via `render.yaml` (backend, Celery worker, Postgres); frontend as
a separate Render Web Service; auto-deploy on push to `master`.

## Legal posture (non-negotiable)

Pure SaaS. No carte professionnelle activities: no counterparty matching or
recommendation, no mandate, no fund handling, no success fees, no custom lease
drafting, no insurance distribution, no nationality-based routing. See the red-line
table in `CLAUDE.md` — every feature is checked against it before merge.

## License

MIT
