# Journal — Applications (Candidatures)

## Purpose
Tenants apply to properties with a profile snapshot; landlords review/approve/reject.

## Surface
- `app/routers/applications.py`, `app/models/application.py`
  (`tenant_id`, `property_id`, `status`, `cover_letter`, immutable `snapshot_data` JSONB).
- Frontend: `/applications`, `/applications/received`, `/applications/[id]/lease`.

## Audit findings (verified by code review 2026-05)
- 🟢 `snapshot_data` captures the dossier at apply-time (immutable) — good for fair review.
- 🟢 Now surfaced in the GDPR export (was previously absent).
- 🟢 **No N+1:** all list endpoints (`/me`, `/received`, `/{id}`) use `selectinload`
  for `tenant` + `property`.
- 🟢 **Authz:** `get_application` is scoped to the applying tenant or the property
  landlord (no IDOR).
- 🟢 **Double-submit:** an app-level guard rejects a second application for the same
  property; upgraded to **409 Conflict** (was 400) per API design standards.

## Backlog (needs DB)
- Add a DB unique constraint `(tenant_id, property_id)` (+ migration) to close the
  TOCTOU race in the app-level check; real-DB IDOR test across users.
