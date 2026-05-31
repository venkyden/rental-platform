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

## Resolved with real-DB tests (2026-05-31)
- ✅ DB unique constraint `uq_application_tenant_property` (migration `a1f2e3d4c5b6`,
  with prod-safe de-dup) + `IntegrityError → 409` closes the concurrent double-submit
  race. Proven by `tests_integration/test_concurrency.py`.
- ✅ IDOR confirmed against a real DB (`tests_integration/test_idor.py`): unrelated
  users get 403 on `GET /applications/{id}`; `/me` only returns own rows.
