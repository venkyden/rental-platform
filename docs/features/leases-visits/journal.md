# Journal — Visits & Leases

## Purpose
Visit-slot scheduling/booking and French-compliant lease generation/signing.

## Surface
- `app/routers/{visits,leases}.py`, `app/services/lease_generator.py`,
  `app/models/visits_and_leases.py` (money as `Numeric(10,2)`; tz-aware DateTime here —
  one of the few models already timezone-correct).
- Frontend: `/leases`, `/leases/[id]/incident`, `components/{VisitScheduler,VisitBookingWizard,LeaseManager}.tsx`.

## French-law touchpoints
- Lease types: meublé (1 yr), vide (3 yr), mobilité (1–10 mo), étudiant (9 mo); ALUR clauses,
  deposit caps, notice periods embedded by `lease_generator`.

## Audit findings
- 🟢 Lease/visit models already use timezone-aware datetimes.
- 🟡 **Concurrency:** double-booking a single visit slot must be prevented atomically
  (row lock / unique booking). Verify; add a real-DB concurrency test (backlog).
- 🟡 Lease PDF download authorization scoped to lease parties — confirmed by code review.

## Backlog
- Real-DB concurrency test for `POST /visits/book/{slot_id}` (two tenants, one slot).
