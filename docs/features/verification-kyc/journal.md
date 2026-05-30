# Journal — Verification / KYC, Guarantor (GLI/Visale) & Documents

## Purpose
Tenant dossier verification: identity (Stripe Identity / Fourthline), employment & income
(incl. SIRET check of the **tenant's employer**), property ownership, guarantor
(Visale / Garantme), GLI insurance, and the document vault.

## Surface
- `app/routers/{verification,identity,documents,webhooks}.py`,
  `app/services/{identity,employment,gli,french_government_api,storage}.py`.
- Frontend: `/verify/{identity,income,guarantor}`, `/verification`, `/documents`,
  `/capture/[code]`, `components/VerificationUpload.tsx`.

## French-law touchpoints
- `verify_siret` validates an employer against the public Recherche-Entreprises API.
  **This is about tenants' employers, NOT Roomivo** (which has no SIRET — see
  [[roomivo-legal-status-snee]] / gdpr-privacy journal).
- GLI (Garantie Loyers Impayés) and Visale guarantor flows.
- Uploads go to Cloudflare R2 via presigned URLs (object storage, not app disk); GDPR
  erasure deletes verification prefixes per user.

## Audit findings
- 🟢 Storage uses presigned R2 URLs + folder/extension allow-lists + random filenames
  (no path traversal). PII stored in Fernet-encrypted JSON columns.
- 🟡 Identity webhook/callback signature verification should be re-confirmed end-to-end
  against Stripe/Fourthline secrets (reviewed, not changed this pass).
- 🟡 `employment.py` treats SIRET as optional and verifies when present — fine for
  self-employed/foreign cases; no change needed.

## Backlog
- Real-DB integration tests for the verification state machine and webhook idempotency.
