# WP2 — Colocation First-Class Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `is_colocation` as an explicit, authoritative signal (decoupled from the overloaded `property_type='room'` value), per-room pricing in the existing room editor, and "À partir de €X" display on cards + a per-room availability table on the detail page.

**Re-evaluation note (2026-07-28):** ~100 commits landed on master since WP1/WP3 merged. Re-audited before writing this plan — key findings that reshape scope vs. the original 2026-07-17 spec:
- A full per-room editor **already exists** (`Step4Layout.tsx`): surface, occupancy, bedding, status (available/occupied), available_from, description — populated for every property with bedrooms, not gated by any colocation flag. **No need to build this from scratch.**
- `d197a53` already broadened the colocation *filter* to match `property_type in ('room','colocation')` OR `amenities contains 'colocation'`; `62151d4` broadened `getTypology()` the same way (plus title-text sniffing). This stays as a legacy-data fallback — the new `is_colocation` column becomes the authoritative signal, ORed in alongside it, not replacing it.
- **The one genuinely missing piece is per-room pricing** — no `monthly_rent` on room objects, no "À partir de" display anywhere. That's this plan's real payoff.
- No `is_colocation` column exists. `property_type='room'` is ambiguous (could mean "renting a single room in someone's home" vs. "this flat is offered room-by-room") — a dedicated boolean removes that ambiguity going forward.

**Architecture:** One migration (`is_colocation` boolean). Room-level pricing lives in the existing `room_details` JSONB (add `monthly_rent` key — no schema change needed there). A `colocation_summary` `@computed_field` on `PropertyResponse` (same pattern as the existing `is_zone_tendue` computed field) derives `{available_rooms, total_rooms, min_room_rent}` from `room_details` on read — no stored duplication.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + pytest; Next.js + TypeScript; i18n via `frontend/lib/i18n.ts`.

---

## Setup

- [ ] `git worktree add ../rental-platform-colocation -b feat/colocation-first-class && cd ../rental-platform-colocation`
- [ ] `cp ../rental-platform/backend/.env backend/.env` (worktrees don't inherit untracked `.env`)

### Task 1: `is_colocation` column + migration + schema exposure

**Files:** `backend/app/models/property.py`, new Alembic migration, `backend/app/models/property_schemas.py`, `backend/tests/test_colocation.py` (create)

- `Property.is_colocation = Column(Boolean, default=False)` next to `furnished`.
- Migration: `op.add_column("properties", sa.Column("is_colocation", sa.Boolean(), nullable=False, server_default=sa.false()))`; downgrade drops it. Check current alembic head first (`python -m alembic heads`) — chain off it, not off the WP3 revision (more migrations have landed since).
- `PropertyResponse`/`PropertyCreate`/`PropertyUpdate` in `property_schemas.py`: add `is_colocation: bool = False` (Create/Update: `Optional[bool] = None` where the file's convention is Optional-everywhere for Update).
- Tests: field present on all three schemas; default False.

### Task 2: `colocation_summary` computed field

**Files:** `backend/app/models/property_schemas.py`, `backend/tests/test_colocation.py`

- Add near the existing `is_zone_tendue` computed field:
```python
@computed_field
@property
def colocation_summary(self) -> Optional[dict]:
    if not self.is_colocation or not self.room_details:
        return None
    rents = [r.get("monthly_rent") for r in self.room_details if isinstance(r, dict) and r.get("monthly_rent")]
    available = sum(1 for r in self.room_details if isinstance(r, dict) and r.get("status") != "occupied")
    return {
        "total_rooms": len(self.room_details),
        "available_rooms": available,
        "min_room_rent": min(rents) if rents else None,
    }
```
- Tests: `is_colocation=False` → None; no `room_details` → None; mixed available/occupied rooms → correct counts; rooms without `monthly_rent` → `min_room_rent=None` but counts still populate.

### Task 3: Filter param — `is_colocation` authoritative, legacy OR preserved

**Files:** `backend/app/routers/properties.py` (`_apply_property_filters`), `backend/tests/test_colocation.py`

- Extend the existing `colocation` param block (added in `d197a53`): when true, OR in `Property.is_colocation == True` alongside the existing `property_type.in_(["room","colocation"])` / `amenities.contains(["colocation"])` clauses. Do the same in the `amenities=['colocation']` legacy branch.
- Test: query with `colocation=1` matches a property that only has `is_colocation=True` (property_type='apartment', no colocation amenity tag) — this is the regression the old filter would have missed.

### Task 4: Wizard — colocation toggle + per-room rent + per-room décence warning

**Files:** `frontend/app/properties/new/steps/types.ts`, `frontend/app/properties/new/steps/Step4Layout.tsx`, `frontend/app/properties/new/page.tsx`

- `types.ts`: add `is_colocation: boolean` to `PropertyFormData`; add `monthly_rent?: number` to the `room_details` array element type.
- `page.tsx`: initialize `is_colocation: false`; include it in the property-create payload.
- `Step4Layout.tsx`: add a toggle ("Louez-vous à la chambre (colocation) ?" / "Renting room-by-room?") near the Total Rooms control, wired to `updateFormData({ is_colocation })`. When `is_colocation` is true, add a "Loyer (€/mois)" number input to each room card (alongside surface/capacity/bedding), and a per-room décence warning: `room.surface < 9 && <amber warning>` (mirrors the existing whole-property decency check's styling, not a new pattern).

### Task 5: Card + search display — "À partir de"

**Files:** `frontend/lib/listingDisplay.ts`, `frontend/components/ListingCard.tsx`

- `ListingSummary`: add `is_colocation?: boolean`, `colocation_summary?: { total_rooms: number; available_rooms: number; min_room_rent: number | null } | null`.
- `getTypology`: check `p.is_colocation` first (before the existing property_type/amenities/title heuristics — those stay as the fallback for older records without the flag).
- New `getColocationPricing(p)`: returns `{ fromPrice: number; availableRooms: number; totalRooms: number } | null` — null unless `is_colocation && colocation_summary?.min_room_rent`.
- `ListingCard.tsx`: when `getColocationPricing` returns non-null, render "À partir de {fromPrice}€ {cc/hc}" instead of the flat price, and "{availableRooms}/{totalRooms} chambres disponibles" in the spec line instead of the bedroom count.

### Task 6: Detail page — per-room availability table

**Files:** `frontend/app/properties/[id]/PropertyDetailClient.tsx`

- `RoomDetail` interface: add `monthly_rent?: number`.
- When `property.is_colocation && property.room_details?.length`, render a table/list below the existing room gallery: per room — label ("Chambre N"), surface, rent (if set), status badge (available/occupied), available_from date. Reuses the room ordering already established by the wizard (array index = room number).

### Task 7: i18n

**Files:** `frontend/lib/i18n.ts`

- FR/EN keys: `property.create.layout.colocationToggle`, `.roomRent`, `.roomDecencyWarning`; `listing.colocationFrom` ("À partir de" / "From"), `listing.roomsAvailable` ("{available}/{total} chambres disponibles" / "{available}/{total} rooms available"); `property.rooms.title`, `.status.available`, `.status.occupied`, `.rentLabel`.

### Task 8: Verification

- Backend: `python -m pytest tests/ -q` (accept the pre-existing, documented `test_intl_rails.py` event-loop failures as unrelated — don't chase them here).
- Frontend: `npx tsc --noEmit`, `npm run lint`, `npx next build`.
- Migration: `python -m alembic upgrade head` against dev DB.
- Manual: run the wizard end-to-end for a colocation property (toggle on, set 3 rooms with rent, publish), confirm the card shows "À partir de" and the detail page shows the room table.
- Finish per finishing-a-development-branch: merge to master, push, remove worktree.

## Out of scope (deferred)

- New Playwright e2e for the wizard colocation flow — folds into WP5's stress-test pass, which already covers "wizard end-to-end (studio/T2/colocation × meublé/vide)".
- Per-room individual lease generation (bail de colocation individuel) — explicitly out of scope in the original spec.
- Backfilling `is_colocation=True` on existing rows that only match via the legacy heuristics — the OR-fallback in Task 3 makes backfill unnecessary for search correctness; a landlord editing an old listing can flip the toggle.
