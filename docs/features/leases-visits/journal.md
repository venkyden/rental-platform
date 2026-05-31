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
- 🔴 **Fixed: double-booking race.** `POST /visits/book/{slot_id}` read `is_booked`
  then wrote with no lock → two concurrent bookings double-booked. Now uses
  `SELECT … FOR UPDATE` (`with_for_update()`); proven by
  `tests_integration/test_concurrency.py` (one 200, one 400).
- 🟡 Lease PDF download authorization scoped to lease parties — confirmed by code review.

## Backlog
- Consider a partial unique index on `visit_slots(id) where is_booked` as defence-in-depth.
