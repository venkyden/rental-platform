# WP3 — Bios Both Sides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A required short bio (40–300 chars) on both sides — landlords can't publish without one, tenants can't apply without one — displayed on the listing detail ("Qui propose ce logement") and on applications, with a dedicated `first_name` column replacing the surname-leak-prone full_name parsing on the trust line.

**Architecture:** Backend: `users.first_name` column (Alembic), bio validation (length + contact-info soft block) on profile update, publish/apply gates returning 422 with actionable messages, `landlord_bio`/`landlord_member_since` on the property detail response, `bio` on `TenantSummary`, GDPR export/erasure coverage for both fields. Frontend: profile page capture with neutral anti-discrimination guidance, gate-error prompts in publish/apply flows, display cards on listing detail and application review. i18n FR+EN throughout.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + pytest; Next.js App Router + TypeScript; i18n via `frontend/lib/i18n.ts`.

**Spec:** `docs/superpowers/specs/2026-07-17-real-user-onboarding-experience-design.md` (WP3) + security-sweep follow-up (first_name column, commit 830556e).

**Note on order:** WP2 (colocation) deferred by owner instruction 2026-07-18 — WP3 proceeds first.

---

## Setup

- [ ] `git worktree add ../rental-platform-bios -b feat/bios-both-sides && cd ../rental-platform-bios`

### Task 1: `users.first_name` column + schema exposure

**Files:** `backend/app/models/user.py`, new Alembic migration, `backend/app/models/schemas.py`, `backend/tests/test_bios.py` (create)

- Add `first_name = Column(String, nullable=True)` next to `full_name`.
- Alembic revision (follow existing pattern in `backend/alembic/versions/`): `op.add_column("users", sa.Column("first_name", sa.String(), nullable=True))`, matching downgrade. No backfill — parsing full_name is exactly what the security fix removed.
- `UserUpdate` (schemas.py ~L95): add `first_name: Optional[str] = Field(None, max_length=100)`; `UserResponse` (~L55): add `first_name: Optional[str] = None`.
- `auth.py` profile update (~L415): persist `first_name` when provided (strip; empty → None).
- TDD: test first_name round-trips through PATCH profile mock; test schema fields exist.

### Task 2: Bio validation (server-side)

**Files:** `backend/app/models/schemas.py`, `backend/tests/test_bios.py`

- On `UserUpdate.bio`: validator — strip; if non-empty: 40 ≤ len ≤ 300 else 422; reject when matching email (`\S+@\S+\.\S+`) or FR/intl phone (`(\+?\d[\d .-]{8,})`) patterns with message "bio must not contain contact details" (i18n done client-side; API message English like the rest of the file).
- Tests: too short, too long, email inside, phone inside, valid bio passes, empty clears.

### Task 3: Trust line prefers `first_name`

**Files:** `backend/app/routers/properties.py`, `backend/tests/test_typology_filters.py`

- `_landlord_trust_fields`: if `landlord.first_name` (stripped) non-empty → use it; else existing all-caps-safe heuristic.
- Tests: first_name wins over ambiguous full_name; absent first_name falls back.

### Task 4: Publish gate (landlord bio required)

**Files:** `backend/app/routers/properties.py` (`publish_property` ~L747), `backend/tests/test_bios.py`

- Load `property_obj.landlord` (selectinload or explicit User query). If `not (landlord.bio or "").strip()` → 422 `{"detail": "landlord_bio_required"}` (machine-readable token — frontend maps to i18n copy).
- Tests: publish without bio → 422 token; with bio proceeds past the gate (mock).

### Task 5: Apply gate (tenant bio required) + tenant bio on applications

**Files:** `backend/app/routers/applications.py`, `backend/app/models/schemas.py` (`TenantSummary`), `backend/tests/test_bios.py`

- `create_application`: `if not (current_user.bio or "").strip(): raise 422 {"detail": "tenant_bio_required"}`.
- `TenantSummary`: add `bio: Optional[str] = None` (auto-populates via from_attributes → landlord sees it on received applications).
- Tests: apply without bio 422; TenantSummary has bio field.

### Task 6: Listing detail landlord card data

**Files:** `backend/app/routers/properties.py` (`get_property`), `backend/app/models/property_schemas.py`

- `PropertyResponse`: add `landlord_bio: Optional[str] = None`, `landlord_member_since: Optional[datetime] = None`.
- In `get_property` only (not list — payload minimization): `prop_dict["landlord_bio"] = landlord.bio`, `landlord_member_since = landlord.created_at`.
- Test: schema fields exist with None defaults.

### Task 7: GDPR coverage

**Files:** `backend/app/routers/gdpr.py`, `backend/tests/test_bios.py`

- Export: ensure user block includes `bio` and `first_name` (check `_collect`/user serialization; add if missing).
- Erasure: already `bio=None` (~L305) — add `first_name=None` beside it.
- Test: erasure sets both None (mock-level assertion consistent with existing gdpr tests).

### Task 8: Frontend — profile capture + gates + display + i18n

**Files:** `frontend/app/profile/page.tsx`, `frontend/app/properties/[id]/PropertyDetailClient.tsx`, applications review UI (locate: `frontend/app/applications/`), publish flow (`frontend/app/properties/new/steps/` final step + edit page), `frontend/lib/i18n.ts`

- Profile: "Prénom" input + "Bio" textarea (char counter 40–300) with neutral guided placeholder ("Votre situation — étudiant·e ou en poste —, votre rythme de vie, pourquoi cette ville") and a warning line: no origin/religion/family/health/contact info (discrimination + GDPR guardrail).
- Publish flow: map `landlord_bio_required` 422 → toast + link to `/profile`.
- Apply flow: map `tenant_bio_required` 422 → toast + link to `/profile`.
- Listing detail: "Qui propose ce logement" card — first name, identity-verified badge, bio, "Membre depuis {month year}" — rendered only when `landlord_bio` present.
- Applications (landlord view): tenant bio paragraph next to credential/verification summary.
- i18n namespace `bio.*` + `listing.landlordCard.*` FR/EN.
- Verify: `npx tsc --noEmit`, lint.

### Task 9: Verification sweep

- Backend: full pytest. Frontend: tsc + lint + build + landing/search/properties e2e specs (chromium, stop dev docker on 3001 during run).
- Migration: `alembic upgrade head` against dev DB.
- Merge flow per finishing-a-development-branch (Option 1 merge to master authorized by standing instruction, push, clean worktree).
