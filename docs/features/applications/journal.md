# Journal — Applications (Candidatures)

## Purpose
Tenants apply to properties with a profile snapshot; landlords review/approve/reject.

## Surface
- `app/routers/applications.py`, `app/models/application.py`
  (`tenant_id`, `property_id`, `status`, `cover_letter`, immutable `snapshot_data` JSONB).
- Frontend: `/applications`, `/applications/received`, `/applications/[id]/lease`.

## Audit findings
- 🟢 `snapshot_data` captures the dossier at apply-time (immutable) — good for fair review.
- 🟢 Now surfaced in the GDPR export (was previously absent).
- 🟡 **Authz/IDOR & concurrency** verified by code review only (mocked-DB harness): a tenant
  should only read their own applications; `received` only the landlord's; duplicate
  submissions to the same property should be prevented at the DB (unique constraint) — confirm.

## Backlog
- Add a unique constraint `(tenant_id, property_id)` (+ migration) to prevent double-submit;
  real-DB IDOR test for `GET /applications/{id}` across users.
