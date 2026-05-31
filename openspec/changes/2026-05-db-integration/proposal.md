# Change: Real-DB integration tests + concurrency/constraint hardening (2026-05-31)

## Why
The mock-DB test harness couldn't exercise authorization, locks, or DB
constraints. Standing up a real Postgres test DB (`roomivo_test`) let us verify
IDOR/authz, surface real concurrency races, and add DB-level guarantees.

## What changed
- **Integration harness** — `backend/tests_integration/` (separate from the
  mock-based `tests/`): real async session injected via `get_db` override,
  per-test TRUNCATE, real JWT auth, ASGITransport client. 7 tests
  (smoke + IDOR + concurrency + cascade).
- **Bug: team enum mismatch (found by an IDOR test).** `InviteStatus` /
  `PermissionLevel` SQLEnum columns lacked `values_callable`, so SQLAlchemy bound
  the uppercase member name (`ACTIVE`) while the PG enum uses lowercase values
  (`active`) → every team-permission query raised `InvalidTextRepresentationError`.
  This crashed property update/publish for non-owners (500 instead of 403) and
  broke team-member property editing entirely. **Fixed** in `app/models/team.py`.
- **Bug: visit-booking TOCTOU race.** `book_visit` read `is_booked` then wrote with
  no row lock → two concurrent bookings double-booked. **Fixed** with
  `SELECT … FOR UPDATE` (`with_for_update()`); proven by a concurrency test
  (one 200, one 400).
- **Duplicate-application race.** App-level pre-check has a TOCTOU window.
  **Fixed** with a DB unique constraint `uq_application_tenant_property`
  (migration `a1f2e3d4c5b6`, with production-safe de-dup) + `IntegrityError → 409`
  in `create_application`; proven by a concurrency test (one 201, one 409).
- **FK ON DELETE CASCADE** (migration `b2c3d4e5f6a7`) for 10 owned-child/junction
  FKs (property_media, media_sessions, saved_properties, inventory_items,
  messages, team_member_properties, webhook_deliveries, notifications). Models
  updated to match. Reversible; cascade proven by a test. Legal/financial FKs
  (leases, disputes, applications, documents, properties.landlord_id) intentionally
  left NO ACTION pending a retention decision.
- **CI**: runs `alembic upgrade head` + `tests_integration/` against the Postgres service.

## Verification
- `pytest tests/` → 69 passed; `pytest tests_integration/` → 7 passed (76 total).
- Migrations: single head `b2c3d4e5f6a7`; up/down reversibility checked.

## Local test DB
`createdb roomivo_test` then
`DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test alembic upgrade head`.
