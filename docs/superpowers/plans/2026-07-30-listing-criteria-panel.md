# Listing Criteria Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a landlord's lease-duration, guarantor, and accepted-tenant-type criteria on the public listing page, plus a static "how you prove it" panel describing Roomivo's credential model — informational only, no filtering/matching.

**Architecture:** One new `Decimal` column (`guarantor_income_multiple`) on `Property`, threaded through the three Pydantic schemas, collected in both the creation wizard and the edit page (mirroring the existing `accepted_guarantor_types` toggle pattern), and rendered as a new card on `PropertyDetailClient.tsx`. No new backend logic beyond a plain column — this is a display feature.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend), Next.js/React + existing `i18n.ts` (frontend).

**Design doc:** `docs/superpowers/specs/2026-07-30-listing-criteria-and-neighborhood-map-design.md`

---

### Task 1: Backend — failing schema test for `guarantor_income_multiple`

**Files:**
- Create: `backend/tests/test_property_criteria.py`

- [ ] **Step 1: Write the failing test**

```python
"""
Landlord criteria panel — guarantor_income_multiple field (2026-07-30 design).
Pure Pydantic schema tests (no DB) + endpoint validation-level tests, following
the pattern in test_properties.py (landlord_client fixture, mocked DB).
"""
from decimal import Decimal

import pytest

from app.models.property_schemas import PropertyCreate, PropertyUpdate, PropertyResponse


def _base_create_payload(**overrides):
    payload = {
        "title": "Bel Appartement Paris 15e",
        "property_type": "apartment",
        "address_line1": "15 Rue de Vaugirard",
        "city": "Paris",
        "postal_code": "75015",
        "monthly_rent": Decimal("1500"),
        "bedrooms": 1,
    }
    payload.update(overrides)
    return payload


class TestGuarantorIncomeMultipleSchema:
    def test_property_create_accepts_guarantor_income_multiple(self):
        data = PropertyCreate(**_base_create_payload(guarantor_income_multiple=Decimal("3.0")))
        assert data.guarantor_income_multiple == Decimal("3.0")

    def test_property_create_defaults_to_none(self):
        data = PropertyCreate(**_base_create_payload())
        assert data.guarantor_income_multiple is None

    def test_property_update_accepts_guarantor_income_multiple(self):
        data = PropertyUpdate(guarantor_income_multiple=Decimal("2.5"))
        assert data.guarantor_income_multiple == Decimal("2.5")

    def test_property_response_serializes_guarantor_income_multiple(self):
        import uuid
        from datetime import datetime

        resp = PropertyResponse(
            id=uuid.uuid4(),
            landlord_id=uuid.uuid4(),
            title="Test",
            description=None,
            property_type="apartment",
            address_line1="1 Rue Test",
            address_line2=None,
            city="Paris",
            postal_code="75001",
            country="France",
            latitude=None,
            longitude=None,
            monthly_rent=Decimal("1000"),
            guarantor_income_multiple=Decimal("3.0"),
            created_at=datetime.utcnow(),
            updated_at=None,
            published_at=None,
        )
        assert resp.guarantor_income_multiple == Decimal("3.0")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_property_criteria.py -v`
Expected: FAIL — `TypeError: PropertyCreate() got unexpected keyword argument 'guarantor_income_multiple'` is NOT how Pydantic behaves (unknown kwargs are silently dropped), so the actual failure is `AttributeError: 'PropertyCreate' object has no attribute 'guarantor_income_multiple'` on the `assert` lines.

- [ ] **Step 3: Commit the failing test**

```bash
cd backend && git add tests/test_property_criteria.py
git commit -m "test: add failing schema tests for guarantor_income_multiple"
```

---

### Task 2: Backend — add the field to the three property schemas

**Files:**
- Modify: `backend/app/models/property_schemas.py:60-67` (PropertyCreate, after `accepted_tenant_types`)
- Modify: `backend/app/models/property_schemas.py:146-148` (PropertyUpdate, after `accepted_tenant_types`)
- Modify: `backend/app/models/property_schemas.py:231-233` (PropertyResponse, after `accepted_tenant_types`)

- [ ] **Step 1: Add to `PropertyCreate`**

In `backend/app/models/property_schemas.py`, replace:

```python
    accepted_tenant_types: Optional[List[str]] = (
        []
    )  # employee, student, freelancer, retired, other
```

with:

```python
    accepted_tenant_types: Optional[List[str]] = (
        []
    )  # employee, student, freelancer, retired, other
    guarantor_income_multiple: Optional[Decimal] = Field(
        None, ge=Decimal("0")
    )  # e.g. 3.0 = tenant income must be >= 3x rent
```

- [ ] **Step 2: Add to `PropertyUpdate`**

Replace:

```python
    accepted_tenant_types: Optional[List[str]] = None
```

with:

```python
    accepted_tenant_types: Optional[List[str]] = None
    guarantor_income_multiple: Optional[Decimal] = Field(None, ge=Decimal("0"))
```

- [ ] **Step 3: Add to `PropertyResponse`**

Replace:

```python
    accepted_guarantor_types: Optional[list] = []
    accepted_tenant_types: Optional[list] = []
```

with:

```python
    accepted_guarantor_types: Optional[list] = []
    accepted_tenant_types: Optional[list] = []
    guarantor_income_multiple: Optional[Decimal] = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_property_criteria.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
cd backend && git add app/models/property_schemas.py
git commit -m "feat(properties): add guarantor_income_multiple to property schemas"
```

---

### Task 3: Backend — add the column to the `Property` model + migration

**Files:**
- Modify: `backend/app/models/property.py:60-67`
- Create: `backend/alembic/versions/c7f139a2d5b6_add_guarantor_income_multiple.py`

- [ ] **Step 1: Add the column**

In `backend/app/models/property.py`, replace:

```python
    accepted_tenant_types = Column(
        JSONB
    )  # ['employee', 'student', 'freelancer', 'retired', 'other']
```

with:

```python
    accepted_tenant_types = Column(
        JSONB
    )  # ['employee', 'student', 'freelancer', 'retired', 'other']
    guarantor_income_multiple = Column(DECIMAL(3, 1))  # e.g. 3.0 = 3x rent required
```

(Check the exact surrounding text first — `accepted_tenant_types` sits right after `accepted_guarantor_types` per the earlier `Read` of this file; match on the real content, not line numbers, since the file may have shifted.)

- [ ] **Step 2: Write the migration**

```python
"""add properties.guarantor_income_multiple

Revision ID: c7f139a2d5b6
Revises: b4d2f6a8c1e3
Create Date: 2026-07-30

Landlord criteria panel (2026-07-30 design): a transparent, uniformly-applied
income-to-rent ratio, e.g. 3.0 = tenant income must be >= 3x rent. Not a
protected-characteristic filter — see the design doc's Légifrance section for
why age/guarantor-residency fields were explicitly excluded from this feature.
"""

import sqlalchemy as sa

from alembic import op

revision = "c7f139a2d5b6"
down_revision = "b4d2f6a8c1e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("guarantor_income_multiple", sa.DECIMAL(3, 1), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("properties", "guarantor_income_multiple")
```

- [ ] **Step 3: Verify the migration is a valid single head**

Run: `cd backend && python -m alembic heads`
Expected: `c7f139a2d5b6 (head)`

- [ ] **Step 4: Run the full schema test file again (sanity check nothing broke)**

Run: `cd backend && python -m pytest tests/test_property_criteria.py tests/test_properties.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd backend && git add app/models/property.py alembic/versions/c7f139a2d5b6_add_guarantor_income_multiple.py
git commit -m "feat(properties): add guarantor_income_multiple column + migration"
```

---

### Task 4: Backend — endpoint validation-level test

**Files:**
- Modify: `backend/tests/test_property_criteria.py`

- [ ] **Step 1: Add the test**

Append to `backend/tests/test_property_criteria.py`:

```python
class TestGuarantorIncomeMultipleEndpoint:
    def test_create_property_with_guarantor_income_multiple(self, landlord_client):
        """Same mocked-DB pattern as test_create_property_as_landlord: with a
        mocked DB the response may 500, but request validation (422) must pass."""
        resp = landlord_client.post(
            "/properties",
            json=_base_create_payload(
                guarantor_required=True,
                accepted_guarantor_types=["visale", "garantme"],
                guarantor_income_multiple=3.0,
            ),
        )
        assert resp.status_code != 422

    def test_create_property_rejects_negative_multiple(self, landlord_client):
        resp = landlord_client.post(
            "/properties",
            json=_base_create_payload(guarantor_income_multiple=-1.0),
        )
        assert resp.status_code == 422
```

- [ ] **Step 2: Run to verify it passes**

Run: `cd backend && python -m pytest tests/test_property_criteria.py -v`
Expected: PASS (6 passed)

- [ ] **Step 3: Commit**

```bash
cd backend && git add tests/test_property_criteria.py
git commit -m "test: endpoint-level validation for guarantor_income_multiple"
```

---

### Task 5: Frontend — creation wizard: types + Step5Pricing UI

**Files:**
- Modify: `frontend/app/properties/new/steps/types.ts:46-49`
- Modify: `frontend/app/properties/new/steps/Step5Pricing.tsx:202-241`

- [ ] **Step 1: Extend `PropertyFormData`**

In `frontend/app/properties/new/steps/types.ts`, replace:

```typescript
    caf_eligible: boolean;
    guarantor_required: boolean;
    accepted_guarantor_types: string[];
```

with:

```typescript
    caf_eligible: boolean;
    guarantor_required: boolean;
    accepted_guarantor_types: string[];
    accepted_tenant_types: string[];
    guarantor_income_multiple?: number;
```

- [ ] **Step 2: Add the tenant-types + income-multiple UI to `Step5Pricing.tsx`**

In `frontend/app/properties/new/steps/Step5Pricing.tsx`, replace the guarantor block:

```tsx
            {/* Guarantor */}
            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => updateFormData({ guarantor_required: !formData.guarantor_required })}
                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                        formData.guarantor_required ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100'
                    }`}
                    aria-pressed={formData.guarantor_required}
                >
                    <div className="text-xs font-black uppercase tracking-[0.2em] mb-1">
                        {t('property.create.pricing.guarantor.title', undefined, 'Guarantor Required')}
                    </div>
                    <div className="text-sm font-bold">
                        {t('property.create.pricing.guarantor.elanNotice', undefined, 'ELAN Law Compliant')}
                    </div>
                </button>
                {formData.guarantor_required && (
                    <div className="flex flex-wrap gap-3 pl-4">
                        {['physical', 'visale', 'garantme', 'organisation'].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => {
                                    const types = formData.accepted_guarantor_types.includes(type)
                                        ? formData.accepted_guarantor_types.filter((t) => t !== type)
                                        : [...formData.accepted_guarantor_types, type];
                                    updateFormData({ accepted_guarantor_types: types });
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    formData.accepted_guarantor_types.includes(type) ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
                                }`}
                                aria-pressed={formData.accepted_guarantor_types.includes(type)}
                            >
                                {t(`property.guarantor.${type}`, undefined, type)}
                            </button>
                        ))}
                    </div>
                )}
            </div>
```

with:

```tsx
            {/* Guarantor */}
            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => updateFormData({ guarantor_required: !formData.guarantor_required })}
                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                        formData.guarantor_required ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100'
                    }`}
                    aria-pressed={formData.guarantor_required}
                >
                    <div className="text-xs font-black uppercase tracking-[0.2em] mb-1">
                        {t('property.create.pricing.guarantor.title', undefined, 'Guarantor Required')}
                    </div>
                    <div className="text-sm font-bold">
                        {t('property.create.pricing.guarantor.elanNotice', undefined, 'ELAN Law Compliant')}
                    </div>
                </button>
                {formData.guarantor_required && (
                    <div className="space-y-4 pl-4">
                        <div className="flex flex-wrap gap-3">
                            {['physical', 'visale', 'garantme', 'organisation'].map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                        const types = formData.accepted_guarantor_types.includes(type)
                                            ? formData.accepted_guarantor_types.filter((t) => t !== type)
                                            : [...formData.accepted_guarantor_types, type];
                                        updateFormData({ accepted_guarantor_types: types });
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                        formData.accepted_guarantor_types.includes(type) ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
                                    }`}
                                    aria-pressed={formData.accepted_guarantor_types.includes(type)}
                                >
                                    {t(`property.guarantor.${type}`, undefined, type)}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-2 max-w-xs">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                                {t('property.create.pricing.guarantor.incomeMultipleLabel', undefined, 'Required income multiple (x rent)')}
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={formData.guarantor_income_multiple ?? ''}
                                onChange={(e) =>
                                    updateFormData({ guarantor_income_multiple: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })
                                }
                                placeholder="e.g. 3.0"
                                className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-lg"
                                aria-label={t('property.create.pricing.guarantor.incomeMultipleLabel', undefined, 'Required income multiple')}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Accepted tenant types */}
            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('properties.edit.acceptedTenants', undefined, 'Accepted Tenant Types')}
                </label>
                <div className="flex flex-wrap gap-3">
                    {['student', 'employee', 'freelancer', 'family'].map((tt) => (
                        <button
                            key={tt}
                            type="button"
                            onClick={() => {
                                const current = formData.accepted_tenant_types;
                                const updated = current.includes(tt) ? current.filter((x) => x !== tt) : [...current, tt];
                                updateFormData({ accepted_tenant_types: updated });
                            }}
                            aria-label={t(`settings.preferences.options.${tt}`, undefined, tt)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                formData.accepted_tenant_types.includes(tt) ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
                            }`}
                            aria-pressed={formData.accepted_tenant_types.includes(tt)}
                        >
                            {t(`settings.preferences.options.${tt}`, undefined, tt)}
                        </button>
                    ))}
                </div>
            </div>
```

(Tenant-type values `['student', 'employee', 'freelancer', 'family']` and the `settings.preferences.options.${tt}` translation key match the existing, already-shipped toggle in `frontend/app/properties/[id]/edit/page.tsx:1561-1573` — reusing the same set keeps the two entry points consistent instead of introducing a second vocabulary.)

- [ ] **Step 3: Commit**

```bash
git add frontend/app/properties/new/steps/types.ts frontend/app/properties/new/steps/Step5Pricing.tsx
git commit -m "feat(properties): collect accepted_tenant_types + guarantor_income_multiple in creation wizard"
```

---

### Task 6: Frontend — wire new fields into the creation wizard's initial state

**Files:**
- Modify: `frontend/app/properties/new/page.tsx:83-85`

- [ ] **Step 1: Add defaults**

In `frontend/app/properties/new/page.tsx`, replace:

```tsx
        caf_eligible: false,
        guarantor_required: false,
        accepted_guarantor_types: [],
```

with:

```tsx
        caf_eligible: false,
        guarantor_required: false,
        accepted_guarantor_types: [],
        accepted_tenant_types: [],
        guarantor_income_multiple: undefined,
```

(`handleSubmit` at line 221 already does `const payload = { ...formData }`, so both new fields flow to `POST /properties` / `PUT /properties/{id}` automatically — no other change needed in this file.)

- [ ] **Step 2: Manual verification**

Run: `cd frontend && npm run dev`, open `/properties/new`, go to the Pricing step, toggle "Guarantor Required" — confirm the income-multiple input and the tenant-type buttons both appear and are clickable, and the "Accepted Tenant Types" section shows even when guarantor is not required (it's outside the `guarantor_required` conditional, matching the design's "these are independent criteria" framing).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/properties/new/page.tsx
git commit -m "feat(properties): default accepted_tenant_types/guarantor_income_multiple in new-listing wizard"
```

---

### Task 7: Frontend — wire `guarantor_income_multiple` into the edit page

**Files:**
- Modify: `frontend/app/properties/[id]/edit/page.tsx:74-86` (type)
- Modify: `frontend/app/properties/[id]/edit/page.tsx:160` (initial state)
- Modify: `frontend/app/properties/[id]/edit/page.tsx:255` (fetched-property mapping)
- Modify: `frontend/app/properties/[id]/edit/page.tsx:1190-1217` (guarantor UI block)

`accepted_tenant_types` is already fully wired in this file (type, state, fetch mapping, UI toggle at lines 85, 171, 266, 1555-1576) — only `guarantor_income_multiple` is missing.

- [ ] **Step 1: Add to the type**

Replace:

```typescript
    guarantor_required: boolean;
    accepted_guarantor_types: string[];
```

with:

```typescript
    guarantor_required: boolean;
    accepted_guarantor_types: string[];
    guarantor_income_multiple?: number;
```

- [ ] **Step 2: Add to the initial state**

Find the `useState<PropertyFormData>({...})` block (starts at line 135) and, next to the existing `accepted_guarantor_types: [],` at line 160, add:

```typescript
        guarantor_income_multiple: undefined,
```

- [ ] **Step 3: Add to the fetched-property mapping**

Find the block starting near line 255 that maps the fetched `property` object onto form state (same block containing `accepted_guarantor_types: property.accepted_guarantor_types || [],`), and add:

```typescript
                    guarantor_income_multiple: property.guarantor_income_multiple ?? undefined,
```

- [ ] **Step 4: Add the income-multiple input to the guarantor UI block**

Replace:

```tsx
                                {formData.guarantor_required && (
                                    <div className="space-y-4">
                                        <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                                            {t('property.create.pricing.guarantor.typesLabel', undefined, 'Accepted Guarantors')}
                                        </label>
                                        <div className="flex flex-wrap gap-3">
                                            {GUARANTOR_TYPES.map(gt => (
                                                <button
                                                    key={gt}
                                                    onClick={() => {
                                                        const current = formData.accepted_guarantor_types;
                                                        const updated = current.includes(gt) ? current.filter(g => g !== gt) : [...current, gt];
                                                        updateFormData({ accepted_guarantor_types: updated });
                                                    }}
                                                    aria-label={t(`property.guarantor.${gt}`, undefined, gt)}
                                                    className={`px-6 py-3 rounded-2xl border-2 text-sm font-black transition-all ${formData.accepted_guarantor_types.includes(gt) ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-100 text-zinc-600'}`}
                                                >
                                                    {t(`property.guarantor.${gt}`, undefined, gt)}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-zinc-400 italic">
                                            {t('property.create.pricing.guarantor.elanNotice', undefined, 'ELAN Law Compliant')}
                                        </p>
                                    </div>
                                )}
```

with:

```tsx
                                {formData.guarantor_required && (
                                    <div className="space-y-4">
                                        <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                                            {t('property.create.pricing.guarantor.typesLabel', undefined, 'Accepted Guarantors')}
                                        </label>
                                        <div className="flex flex-wrap gap-3">
                                            {GUARANTOR_TYPES.map(gt => (
                                                <button
                                                    key={gt}
                                                    onClick={() => {
                                                        const current = formData.accepted_guarantor_types;
                                                        const updated = current.includes(gt) ? current.filter(g => g !== gt) : [...current, gt];
                                                        updateFormData({ accepted_guarantor_types: updated });
                                                    }}
                                                    aria-label={t(`property.guarantor.${gt}`, undefined, gt)}
                                                    className={`px-6 py-3 rounded-2xl border-2 text-sm font-black transition-all ${formData.accepted_guarantor_types.includes(gt) ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-100 text-zinc-600'}`}
                                                >
                                                    {t(`property.guarantor.${gt}`, undefined, gt)}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="space-y-2 max-w-xs">
                                            <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                                                {t('property.create.pricing.guarantor.incomeMultipleLabel', undefined, 'Required income multiple (x rent)')}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                value={formData.guarantor_income_multiple ?? ''}
                                                onChange={(e) => updateFormData({ guarantor_income_multiple: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                                                placeholder="e.g. 3.0"
                                                className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-lg"
                                                aria-label={t('property.create.pricing.guarantor.incomeMultipleLabel', undefined, 'Required income multiple')}
                                            />
                                        </div>
                                        <p className="text-xs text-zinc-400 italic">
                                            {t('property.create.pricing.guarantor.elanNotice', undefined, 'ELAN Law Compliant')}
                                        </p>
                                    </div>
                                )}
```

- [ ] **Step 5: Manual verification**

Run: `cd frontend && npm run dev`, open the edit page for an existing property owned by the logged-in landlord, toggle guarantor required, confirm the income-multiple input appears, save, reload the page, confirm the value persisted.

- [ ] **Step 6: Commit**

```bash
git add "frontend/app/properties/[id]/edit/page.tsx"
git commit -m "feat(properties): edit guarantor_income_multiple from the property edit page"
```

---

### Task 8: Frontend — i18n keys

**Files:**
- Modify: `frontend/lib/i18n.ts`

- [ ] **Step 1: Add English keys**

In the `en.property` object (starts at line 1793), next to `locationTitle: "Verified location",` (line 1807), add:

```typescript
            criteria: {
                title: "Landlord criteria",
                whatLandlordRequires: "What this landlord requires",
                minLeaseDuration: "Minimum lease duration",
                flexible: "Flexible",
                months: "{{count}} months",
                guarantorRequired: "Guarantor required",
                guarantorIncomeMultiple: "Income must be at least {{multiple}}x rent",
                acceptedTenantTypes: "Accepted tenant types",
                howToProve: "How you prove it",
                identityMedium: "Identity verified via Roomivo — MEDIUM assurance (OCR + selfie liveness), FR and INTL rails both supported.",
                solvencyMedium: "Solvency verified via avis d'imposition 2D-Doc (FR) or funds-coverage rail (INTL) — both MEDIUM.",
                guarantorMedium: "Guarantor certificates (Visale/Garantme) verified — MEDIUM.",
            },
```

- [ ] **Step 2: Add French keys**

In the `fr.property` object (`locationTitle: "Localisation Vérifiée",` at line 5083), add:

```typescript
            criteria: {
                title: "Critères du loueur",
                whatLandlordRequires: "Ce que demande le bailleur",
                minLeaseDuration: "Durée de location minimum",
                flexible: "Flexible",
                months: "{{count}} mois",
                guarantorRequired: "Garant requis",
                guarantorIncomeMultiple: "Revenus ≥ {{multiple}}x le loyer",
                acceptedTenantTypes: "Profils de locataires acceptés",
                howToProve: "Comment le prouver",
                identityMedium: "Identité vérifiée via Roomivo — assurance MEDIUM (OCR + selfie liveness), rails FR et INTL pris en charge.",
                solvencyMedium: "Solvabilité vérifiée via l'avis d'imposition 2D-Doc (FR) ou le rail de couverture de fonds (INTL) — MEDIUM.",
                guarantorMedium: "Certificats de garantie (Visale/Garantme) vérifiés — MEDIUM.",
            },
```

- [ ] **Step 3: Verify the file still parses**

Run: `cd frontend && npx tsc --noEmit lib/i18n.ts 2>&1 | head -30`
Expected: no new syntax errors introduced by this edit (pre-existing unrelated errors, if any, are not this task's concern).

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/i18n.ts
git commit -m "feat(i18n): add landlord-criteria panel translation keys"
```

---

### Task 9: Frontend — the "Critères du loueur" display card

**Files:**
- Modify: `frontend/app/properties/[id]/PropertyDetailClient.tsx:54-110` (local `Property` interface)
- Modify: `frontend/app/properties/[id]/PropertyDetailClient.tsx:19-22` (icon imports)
- Modify: `frontend/app/properties/[id]/PropertyDetailClient.tsx:794-812` (new card, right before the "Verified Location" block)

- [ ] **Step 1: Extend the local `Property` interface**

The `Property` interface in this file (lines 54-110) is hand-maintained and doesn't yet
have `lease_duration_months`, `accepted_tenant_types`, or `guarantor_income_multiple` —
without this, the JSX in Step 3 won't type-check. Replace:

```typescript
    guarantor_required?: boolean;
    accepted_guarantor_types?: string[];
    caf_eligible?: boolean;
```

with:

```typescript
    guarantor_required?: boolean;
    accepted_guarantor_types?: string[];
    accepted_tenant_types?: string[];
    guarantor_income_multiple?: number;
    lease_duration_months?: number;
    caf_eligible?: boolean;
```

- [ ] **Step 2: Add icon imports**

Replace:

```tsx
import {
    MapPin, Share2, Shield, Zap, Wind, Check, LayoutGrid, Info,
    TrendingUp, Heart, Navigation, Building2, Flame, AlertTriangle, Calendar, BadgeCheck, Download, Video
} from 'lucide-react';
```

with:

```tsx
import {
    MapPin, Share2, Shield, Zap, Wind, Check, LayoutGrid, Info,
    TrendingUp, Heart, Navigation, Building2, Flame, AlertTriangle, Calendar, BadgeCheck, Download, Video,
    Users, ShieldCheck,
} from 'lucide-react';
```

- [ ] **Step 3: Insert the criteria card**

Insert this new block immediately before the existing `{/* Location Intelligence */}` block (the one starting `{property.latitude && property.longitude && (`):

```tsx
                            {/* Landlord Criteria */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="glass-card !p-12 rounded-[3rem] border-zinc-100 space-y-10"
                            >
                                <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-4">
                                    <Users className="w-6 h-6 text-zinc-900" />
                                    {t('property.criteria.title', undefined, 'Landlord criteria')}
                                </h2>

                                <div className="space-y-6">
                                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">
                                        {t('property.criteria.whatLandlordRequires', undefined, 'What this landlord requires')}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                                            <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                                                {t('property.criteria.minLeaseDuration', undefined, 'Minimum lease duration')}
                                            </span>
                                            <span className="text-xs text-zinc-500 font-bold">
                                                {property.lease_duration_months
                                                    ? t('property.criteria.months', { count: property.lease_duration_months })
                                                    : t('property.criteria.flexible', undefined, 'Flexible')}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                                            <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                                                {t('property.criteria.guarantorRequired', undefined, 'Guarantor required')}
                                            </span>
                                            <span className="text-xs text-zinc-500 font-bold">
                                                {property.guarantor_required
                                                    ? t('property.guarantor.required', undefined, 'Required')
                                                    : t('property.guarantor.notRequired', undefined, 'Not required')}
                                            </span>
                                        </div>
                                        {property.guarantor_required && (property.accepted_guarantor_types?.length ?? 0) > 0 && (
                                            <div className="flex items-center justify-between py-2 border-b border-zinc-100 sm:col-span-2">
                                                <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                                                    {t('property.create.pricing.guarantor.typesLabel', undefined, 'Accepted Guarantors')}
                                                </span>
                                                <span className="text-xs text-zinc-500 font-bold">
                                                    {property.accepted_guarantor_types.map((g: string) => t(`property.guarantor.${g}`, undefined, g)).join(', ')}
                                                </span>
                                            </div>
                                        )}
                                        {property.guarantor_required && property.guarantor_income_multiple && (
                                            <div className="flex items-center justify-between py-2 border-b border-zinc-100 sm:col-span-2">
                                                <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                                                    {t('property.criteria.guarantorRequired', undefined, 'Guarantor required')}
                                                </span>
                                                <span className="text-xs text-zinc-500 font-bold">
                                                    {t('property.criteria.guarantorIncomeMultiple', { multiple: property.guarantor_income_multiple })}
                                                </span>
                                            </div>
                                        )}
                                        {(property.accepted_tenant_types?.length ?? 0) > 0 && (
                                            <div className="flex items-center justify-between py-2 border-b border-zinc-100 sm:col-span-2">
                                                <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                                                    {t('property.criteria.acceptedTenantTypes', undefined, 'Accepted tenant types')}
                                                </span>
                                                <span className="text-xs text-zinc-500 font-bold capitalize">
                                                    {property.accepted_tenant_types.join(', ')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-6 pt-6 border-t border-zinc-100">
                                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4" />
                                        {t('property.criteria.howToProve', undefined, 'How you prove it')}
                                    </h3>
                                    <ul className="space-y-3 text-xs text-zinc-500 font-medium leading-relaxed">
                                        <li>{t('property.criteria.identityMedium', undefined, "Identity verified via Roomivo — MEDIUM assurance (OCR + selfie liveness), FR and INTL rails both supported.")}</li>
                                        <li>{t('property.criteria.solvencyMedium', undefined, "Solvency verified via avis d'imposition 2D-Doc (FR) or funds-coverage rail (INTL) — both MEDIUM.")}</li>
                                        {property.guarantor_required && (
                                            <li>{t('property.criteria.guarantorMedium', undefined, "Guarantor certificates (Visale/Garantme) verified — MEDIUM.")}</li>
                                        )}
                                    </ul>
                                </div>
                            </motion.div>
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors from `PropertyDetailClient.tsx` (pre-existing unrelated errors elsewhere in the repo, if any, are not this task's concern).

- [ ] **Step 5: Manual verification**

Run: `cd frontend && npm run dev`, open an existing active listing at `/properties/{id}`. Confirm the new "Landlord criteria" card renders above "Verified Location" with: min lease duration (or "Flexible"), guarantor required/not-required, guarantor types + income multiple when applicable, accepted tenant types when set, and the three "How you prove it" bullets (only 2 bullets — no guarantor line — when `guarantor_required` is false). Toggle the language switcher and confirm the French strings render.

- [ ] **Step 6: Commit**

```bash
git add "frontend/app/properties/[id]/PropertyDetailClient.tsx"
git commit -m "feat(properties): display landlord criteria panel on the listing page"
```

---

## Self-review

**Spec coverage:**
- "What this landlord requires" (duration, guarantor + types + multiple, tenant types) — Task 9 ✅
- "How you prove it" credential copy, MEDIUM only, no HIGH/NFC mention — Task 9 ✅ (copy matches the corrected, user-confirmed wording from the design doc verbatim)
- `guarantor_income_multiple` field, wizard + edit page + display — Tasks 1-3, 5-7, 9 ✅
- `accepted_tenant_types` wired into the creation wizard (edit page already had it) — Task 5 ✅
- No age field, no guarantor-residency field — never introduced anywhere in this plan ✅
- No raw document checklist — replaced by static credential copy per Task 9 ✅
- No filtering/matching logic — every task is read/display or a plain passthrough field ✅

**Placeholder scan:** no TBD/TODO; every step has literal code, not descriptions of code.

**Type consistency:** `guarantor_income_multiple` is `Decimal` backend / `number | undefined` frontend throughout (Tasks 1-3 backend, Tasks 5-7 frontend, Task 9 display) — consistent. `accepted_tenant_types` values (`student/employee/freelancer/family`) match between Task 5 (new wizard) and the pre-existing edit-page `TENANT_TYPES` constant — consistent, not the differently-worded backend model comment (`employee/student/freelancer/retired/other`), which is pre-existing drift out of scope for this plan.

