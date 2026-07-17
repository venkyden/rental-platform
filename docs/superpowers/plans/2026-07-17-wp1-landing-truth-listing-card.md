# WP1 — Landing Truth + Typology Entry + Shared ListingCard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the fake hardcoded landing listings, add typology entry points (Studio/T1/T2/T3+/Colocation, Meublé/Vide) that deep-link into search, and replace the generic listing cards with one curated shared `ListingCard` used by landing and search.

**Architecture:** Backend gains two query filters (`rooms_count`, `rooms_count_min`) and two response fields (`landlord_first_name`, `landlord_identity_verified`) on the existing `GET /properties` endpoints. Frontend gains pure display helpers (`lib/listingDisplay.ts`), a shared `components/ListingCard.tsx`, and rewires `SearchHero`, `FeaturedListings`, and `app/search/page.tsx` onto them. Colocation still filters via the amenity tag until WP2; "À partir de" pricing activates in WP2.

**Tech Stack:** FastAPI + SQLAlchemy (async) + pytest; Next.js App Router + TypeScript + Tailwind + framer-motion + Playwright. i18n via `frontend/lib/i18n.ts` and `t(key, vars, fallback)`.

**Spec:** `docs/superpowers/specs/2026-07-17-real-user-onboarding-experience-design.md` (WP1 section)

---

## Setup

- [ ] **Create the worktree** (per user's global worktree rule):

```bash
cd /Users/venkat/rental-platform
git worktree add ../rental-platform-landing-truth -b feat/landing-truth-listing-card
cd ../rental-platform-landing-truth
```

All paths below are relative to the worktree root.

---

### Task 1: Backend — typology filter params

**Files:**
- Modify: `backend/app/routers/properties.py` (function `_apply_property_filters`, lines ~211–310)
- Test: `backend/tests/test_typology_filters.py` (create)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_typology_filters.py`:

```python
"""Tests for typology filters (rooms_count / rooms_count_min) on GET /properties."""

from sqlalchemy import select

from app.models.property import Property
from app.routers.properties import _apply_property_filters


def _where_sql(query) -> str:
    """Compile only the WHERE clause (the SELECT list always contains column names)."""
    return str(query.whereclause) if query.whereclause is not None else ""


def _build(params: dict):
    return _apply_property_filters(
        query=select(Property),
        params=params,
        amenities=[],
        default_sort_col=Property.created_at.desc(),
        current_user=None,
    )


class TestTypologyFilters:
    def test_rooms_count_exact_filter(self):
        query = _build({"rooms_count": "2"})
        assert "rooms_count =" in _where_sql(query)

    def test_rooms_count_min_filter(self):
        query = _build({"rooms_count_min": "3"})
        assert "rooms_count >=" in _where_sql(query)

    def test_invalid_rooms_count_is_ignored(self):
        query = _build({"rooms_count": "abc"})
        assert "rooms_count" not in _where_sql(query)

    def test_no_rooms_params_no_filter(self):
        query = _build({})
        assert "rooms_count" not in _where_sql(query)


class TestTypologyEndpoint:
    def test_list_properties_accepts_rooms_count(self, client):
        resp = client.get("/properties?rooms_count=2")
        assert resp.status_code == 200

    def test_list_properties_accepts_rooms_count_min(self, client):
        resp = client.get("/properties?rooms_count_min=3")
        assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_typology_filters.py -v
```

Expected: the four `TestTypologyFilters` tests FAIL (no `rooms_count` handling in `_apply_property_filters` yet — `test_rooms_count_exact_filter` and `test_rooms_count_min_filter` assert clauses that don't exist). Endpoint tests may already pass (unknown params are ignored) — that's fine.

- [ ] **Step 3: Implement the filters**

In `backend/app/routers/properties.py`, inside `_apply_property_filters`, add param extraction next to the existing `bedrooms = params.get("bedrooms")` line:

```python
    rooms_count = params.get("rooms_count")
    rooms_count_min = params.get("rooms_count_min")
```

Then, directly after the existing `bedrooms` filter block (`if bedrooms and bedrooms != "": ...`), add:

```python
    if rooms_count and rooms_count != "":
        try:
            query = query.where(Property.rooms_count == int(rooms_count))
        except (ValueError, TypeError):
            pass

    if rooms_count_min and rooms_count_min != "":
        try:
            query = query.where(Property.rooms_count >= int(rooms_count_min))
        except (ValueError, TypeError):
            pass
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_typology_filters.py tests/test_properties.py -v
```

Expected: all PASS (including the pre-existing property tests — no regression).

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/properties.py backend/tests/test_typology_filters.py
git commit -m "feat(properties): rooms_count / rooms_count_min typology filters"
```

---

### Task 2: Backend — landlord trust fields on property responses

**Files:**
- Modify: `backend/app/models/property_schemas.py` (class `PropertyResponse`, ~line 182)
- Modify: `backend/app/routers/properties.py` (`list_properties` ~line 382, `get_property` ~line 488)
- Test: `backend/tests/test_typology_filters.py` (extend)

- [ ] **Step 1: Write the failing tests** — append to `backend/tests/test_typology_filters.py`:

```python
from app.models.property_schemas import PropertyResponse
from app.routers.properties import _landlord_trust_fields


class TestLandlordTrustFields:
    def test_response_schema_has_trust_fields(self):
        fields = PropertyResponse.model_fields
        assert "landlord_first_name" in fields
        assert "landlord_identity_verified" in fields

    def test_trust_fields_default_safe(self):
        assert _landlord_trust_fields(None) == {
            "landlord_first_name": None,
            "landlord_identity_verified": False,
        }

    def test_trust_fields_first_name_only(self):
        class FakeLandlord:
            full_name = "Marc Dupont"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] == "Marc"  # never the full name
        assert result["landlord_identity_verified"] is True

    def test_trust_fields_empty_name(self):
        class FakeLandlord:
            full_name = "   "
            identity_verified = False

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] is None
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && python -m pytest tests/test_typology_filters.py -v
```

Expected: FAIL with `ImportError: cannot import name '_landlord_trust_fields'`.

- [ ] **Step 3: Implement**

In `backend/app/models/property_schemas.py`, inside `PropertyResponse` next to `ownership_verified: bool = False`, add:

```python
    # Trust line (WP1): first name only + identity verification state — never full PII
    landlord_first_name: Optional[str] = None
    landlord_identity_verified: bool = False
```

In `backend/app/routers/properties.py`, add a module-level helper above `_apply_property_filters`:

```python
def _landlord_trust_fields(landlord) -> dict:
    """First name + identity flag for the listing trust line. Never exposes full name."""
    if landlord is None:
        return {"landlord_first_name": None, "landlord_identity_verified": False}
    first = (landlord.full_name or "").strip().split(" ")[0]
    return {
        "landlord_first_name": first or None,
        "landlord_identity_verified": bool(landlord.identity_verified),
    }
```

In `list_properties` (~line 396), eager-load the landlord — change:

```python
    query = select(Property)
```

to:

```python
    from sqlalchemy.orm import selectinload
    query = select(Property).options(selectinload(Property.landlord))
```

and in the response loop:

```python
    for prop in properties:
        prop_dict = PropertyResponse.model_validate(prop).model_dump()
        prop_dict["is_saved"] = prop.id in saved_property_ids
        prop_dict.update(_landlord_trust_fields(prop.landlord))
        response.append(prop_dict)
```

In `get_property` (~line 504), change:

```python
    result = await db.execute(select(Property).where(Property.id == prop_uuid))
```

to:

```python
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.landlord))
        .where(Property.id == prop_uuid)
    )
```

and after `prop_dict = PropertyResponse.model_validate(property_obj).model_dump()` (~line 573):

```python
    prop_dict.update(_landlord_trust_fields(property_obj.landlord))
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python -m pytest tests/test_typology_filters.py tests/test_properties.py -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/property_schemas.py backend/app/routers/properties.py backend/tests/test_typology_filters.py
git commit -m "feat(properties): landlord trust fields (first name + identity flag) on responses"
```

---

### Task 3: Frontend — listing display helpers

**Files:**
- Create: `frontend/lib/listingDisplay.ts`

No unit-test runner exists in the frontend (Playwright only) — verification is `tsc --noEmit` here and e2e in Task 7.

- [ ] **Step 1: Create `frontend/lib/listingDisplay.ts`** with exactly:

```typescript
// Pure display helpers for listing cards. Shared by landing + search.

export interface ListingSummary {
    id: string;
    title: string;
    description?: string | null;
    city: string;
    postal_code?: string | null;
    monthly_rent: number;
    charges?: number | null;
    charges_included?: boolean;
    bedrooms: number;
    rooms_count?: number | null;
    property_type: string;
    furnished: boolean;
    size_sqm?: number | null;
    photos?: { url: string }[] | null;
    amenities?: string[] | null;
    available_from?: string | null;
    dpe_rating?: string | null;
    ownership_verified?: boolean;
    is_saved?: boolean;
    landlord_first_name?: string | null;
    landlord_identity_verified?: boolean;
}

// 'Studio' / 'T2' / 'Colocation' are language-neutral tokens; returns null when
// only a translated type name (apartment/house) applies — caller falls back to t().
export function getTypology(p: ListingSummary): string | null {
    if (p.property_type === 'studio') return 'Studio';
    if (p.property_type === 'room') return 'Colocation';
    if (p.amenities?.some(a => a.toLowerCase().includes('colocation'))) return 'Colocation';
    if (p.rooms_count && p.rooms_count >= 1) {
        return p.rooms_count >= 6 ? 'T6+' : `T${p.rooms_count}`;
    }
    return null;
}

export function getDisplayPrice(p: ListingSummary): { amount: number; suffix: 'cc' | 'hc' } {
    const rent = Number(p.monthly_rent) || 0;
    if (p.charges_included) return { amount: rent, suffix: 'cc' };
    const charges = Number(p.charges) || 0;
    if (charges > 0) return { amount: rent + charges, suffix: 'cc' };
    return { amount: rent, suffix: 'hc' };
}

export function getDescriptionPreview(description?: string | null, maxLength = 160): string | null {
    if (!description) return null;
    const cleaned = description
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return null;
    if (cleaned.length <= maxLength) return cleaned;
    const cut = cleaned.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export function getAvailability(availableFrom?: string | null): { immediate: boolean; date: Date | null } {
    if (!availableFrom) return { immediate: true, date: null };
    const date = new Date(`${availableFrom}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date <= new Date()) return { immediate: true, date: null };
    return { immediate: false, date };
}

// One differentiator max, by priority. Returns an i18n key.
const DIFFERENTIATOR_PRIORITY: Array<[RegExp, string]> = [
    [/salle de bain priv|private bath/i, 'listing.diff.privateBathroom'],
    [/balcon|balcony/i, 'listing.diff.balcony'],
    [/terrasse|terrace/i, 'listing.diff.terrace'],
    [/parking|garage/i, 'listing.diff.parking'],
    [/ascenseur|elevator|lift/i, 'listing.diff.elevator'],
];

export function getDifferentiatorKey(amenities?: string[] | null): string | null {
    if (!amenities?.length) return null;
    for (const [pattern, key] of DIFFERENTIATOR_PRIORITY) {
        if (amenities.some(a => pattern.test(a))) return key;
    }
    return null;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0 (pre-existing errors, if any, must not mention `listingDisplay.ts`).

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/listingDisplay.ts
git commit -m "feat(frontend): listing display helpers (typology, price cc/hc, preview, availability)"
```

---

### Task 4: Frontend — shared ListingCard + i18n keys

**Files:**
- Create: `frontend/components/ListingCard.tsx`
- Modify: `frontend/lib/i18n.ts` (add `listing` namespace under both `en:` and `fr:` roots — `en:` root is at the top of the file, `fr:` root near line 2583)

- [ ] **Step 1: Add i18n keys.** In `frontend/lib/i18n.ts`, add a top-level `listing` object inside the `en:` root object (same depth as `esign`):

```typescript
        listing: {
            perMonth: "/ month",
            cc: "incl. charges",
            hc: "excl. charges",
            furnished: "Furnished",
            unfurnished: "Unfurnished",
            bedroom: "bedroom",
            bedrooms: "bedrooms",
            availableNow: "Available now",
            availableFrom: "Available from",
            publishedBy: "Listed by",
            identityVerified: "verified identity",
            gpsVerified: "GPS-verified photos",
            noPhotos: "Photos coming soon",
            type: { apartment: "Apartment", house: "House", studio: "Studio", room: "Room" },
            diff: {
                privateBathroom: "Private bathroom",
                balcony: "Balcony",
                terrace: "Terrace",
                parking: "Parking",
                elevator: "Elevator",
            },
        },
```

and the same inside the `fr:` root object:

```typescript
        listing: {
            perMonth: "/ mois",
            cc: "cc",
            hc: "hc",
            furnished: "Meublé",
            unfurnished: "Vide",
            bedroom: "chambre",
            bedrooms: "chambres",
            availableNow: "Disponible immédiatement",
            availableFrom: "Disponible à partir du",
            publishedBy: "Publié par",
            identityVerified: "identité vérifiée",
            gpsVerified: "Photos vérifiées GPS",
            noPhotos: "Photos en cours d'ajout",
            type: { apartment: "Appartement", house: "Maison", studio: "Studio", room: "Chambre" },
            diff: {
                privateBathroom: "Salle de bain privée",
                balcony: "Balcon",
                terrace: "Terrasse",
                parking: "Parking",
                elevator: "Ascenseur",
            },
        },
```

- [ ] **Step 2: Create `frontend/components/ListingCard.tsx`** with exactly:

```tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, MapPin, ShieldCheck, BadgeCheck, Camera } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import {
    ListingSummary,
    getTypology,
    getDisplayPrice,
    getDescriptionPreview,
    getAvailability,
    getDifferentiatorKey,
} from '@/lib/listingDisplay';

interface ListingCardProps {
    property: ListingSummary;
    onToggleSave?: (id: string) => void;
    index?: number;
}

export default function ListingCard({ property, onToggleSave, index = 0 }: ListingCardProps) {
    const { t, language } = useLanguage();

    const typology =
        getTypology(property) ??
        t(`listing.type.${property.property_type}`, undefined, property.property_type);
    const price = getDisplayPrice(property);
    const preview = getDescriptionPreview(property.description);
    const availability = getAvailability(property.available_from);
    const differentiatorKey = getDifferentiatorKey(property.amenities);
    const cover = property.photos?.[0];

    const specParts: string[] = [];
    if (property.size_sqm) specParts.push(`${Math.round(Number(property.size_sqm))}m²`);
    if (property.bedrooms > 0) {
        const key = property.bedrooms > 1 ? 'listing.bedrooms' : 'listing.bedroom';
        specParts.push(`${property.bedrooms} ${t(key, undefined, 'chambres')}`);
    }
    if (differentiatorKey) specParts.push(t(differentiatorKey, undefined, ''));

    const availableDate = availability.date
        ? new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
          }).format(availability.date)
        : null;

    return (
        <motion.article
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="group bg-white rounded-[2rem] overflow-hidden border border-zinc-100 hover:border-zinc-200 hover:shadow-2xl hover:shadow-zinc-900/5 transition-all duration-500 flex flex-col"
        >
            {/* ── Photo ── */}
            <Link href={`/properties/${property.id}`} className="relative aspect-[4/3] block overflow-hidden bg-zinc-100">
                {cover ? (
                    <Image
                        src={resolveMediaUrl(cover.url)}
                        alt={property.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-1000"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-400">
                        <Camera className="w-6 h-6" />
                        <span className="text-xs font-semibold">{t('listing.noPhotos', undefined, 'Photos en cours d’ajout')}</span>
                    </div>
                )}
                <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
                    {property.ownership_verified && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                            <ShieldCheck className="w-3 h-3" />
                            {t('listing.gpsVerified', undefined, 'Photos vérifiées GPS')}
                        </span>
                    )}
                    {property.dpe_rating && (
                        <span className="px-3 py-1.5 bg-white/90 backdrop-blur text-zinc-900 text-[10px] font-bold rounded-full">
                            DPE {property.dpe_rating}
                        </span>
                    )}
                </div>
                {onToggleSave && (
                    <button
                        aria-label="save"
                        onClick={(e) => {
                            e.preventDefault();
                            onToggleSave(property.id);
                        }}
                        className={`absolute top-4 right-4 p-2.5 rounded-full backdrop-blur transition-colors ${
                            property.is_saved ? 'bg-white text-zinc-900' : 'bg-black/20 text-white hover:bg-black/40'
                        }`}
                    >
                        <Heart className={`w-4 h-4 ${property.is_saved ? 'fill-current' : ''}`} />
                    </button>
                )}
            </Link>

            {/* ── Content ── */}
            <div className="p-6 flex flex-col flex-1 gap-2">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                            {typology} · {t(property.furnished ? 'listing.furnished' : 'listing.unfurnished', undefined, property.furnished ? 'Meublé' : 'Vide')}
                        </p>
                        <Link href={`/properties/${property.id}`}>
                            <h3 className="text-lg font-bold text-zinc-900 truncate group-hover:text-zinc-600 transition-colors">
                                {property.title}
                            </h3>
                        </Link>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xl font-black text-zinc-900 tracking-tight">
                            {Math.round(price.amount)}€{' '}
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">{t(`listing.${price.suffix}`, undefined, price.suffix)}</span>
                        </p>
                        <p className="text-[10px] font-semibold text-zinc-400">{t('listing.perMonth', undefined, '/ mois')}</p>
                    </div>
                </div>

                <p className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {property.city}
                    {property.postal_code ? ` (${property.postal_code})` : ''}
                </p>

                {specParts.length > 0 && (
                    <p className="text-sm font-medium text-zinc-700">{specParts.join(' · ')}</p>
                )}

                {preview && <p className="text-sm text-zinc-500 line-clamp-2">{preview}</p>}

                <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-zinc-100">
                    <p className="flex items-center gap-2 text-xs font-semibold">
                        <span className={`w-2 h-2 rounded-full ${availability.immediate ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        <span className={availability.immediate ? 'text-emerald-700' : 'text-zinc-600'}>
                            {availability.immediate
                                ? t('listing.availableNow', undefined, 'Disponible immédiatement')
                                : `${t('listing.availableFrom', undefined, 'Disponible à partir du')} ${availableDate}`}
                        </span>
                    </p>
                    {property.landlord_first_name && (
                        <p className="flex items-center gap-1.5 text-xs text-zinc-500 truncate">
                            {t('listing.publishedBy', undefined, 'Publié par')} {property.landlord_first_name}
                            {property.landlord_identity_verified && (
                                <span className="inline-flex items-center gap-1 text-zinc-700 font-semibold">
                                    <BadgeCheck className="w-3.5 h-3.5" />
                                    {t('listing.identityVerified', undefined, 'identité vérifiée')}
                                </span>
                            )}
                        </p>
                    )}
                </div>
            </div>
        </motion.article>
    );
}
```

- [ ] **Step 3: Verify compile + lint**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Expected: no new errors referencing `ListingCard.tsx` or `i18n.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ListingCard.tsx frontend/lib/i18n.ts
git commit -m "feat(frontend): shared curated ListingCard + listing i18n namespace"
```

---

### Task 5: Search page — ListingCard, typology filter, deep-link params

**Files:**
- Modify: `frontend/app/search/page.tsx`

- [ ] **Step 1: Read deep-link params and add typology/furnished-mode state.** In `SearchContent`, next to `initialQuery` (~line 49):

```typescript
    const initialTypology = searchParams.get('typology') || '';
    const initialFurnishedParam = searchParams.get('furnished'); // 'true' | 'false' | null
    const initialColocation = searchParams.get('colocation') === '1';
```

Replace the `furnished` boolean state and add typology (~lines 60–61):

```typescript
    const [furnishedMode, setFurnishedMode] = useState<'' | 'furnished' | 'unfurnished'>(
        initialFurnishedParam === 'true' ? 'furnished' : initialFurnishedParam === 'false' ? 'unfurnished' : ''
    );
    const [typology, setTypology] = useState<string>(initialTypology);
    const [colocation, setColocation] = useState(initialColocation);
```

Update the segment-config effect (~line 79): `setFurnished(true)` becomes `setFurnishedMode('furnished')`.

- [ ] **Step 2: Map state to API params.** In `fetchProperties`, replace `if (furnished) params.furnished = true;` with:

```typescript
            if (furnishedMode === 'furnished') params.furnished = true;
            if (furnishedMode === 'unfurnished') params.furnished = false;
            if (typology === 'studio') params.property_type = 'studio';
            else if (typology === 't1') params.rooms_count = 1;
            else if (typology === 't2') params.rooms_count = 2;
            else if (typology === 't3plus') params.rooms_count_min = 3;
```

Keep `if (colocation) params.amenities = ['colocation'];` (WP2 replaces it). Update the debounce effect dependency array: replace `furnished` with `furnishedMode, typology`.

- [ ] **Step 3: Filter UI.** Replace the furnished entry in the toggle-chip array (~line 280) with two mutually exclusive chips and add a typology chip row. The chip array becomes:

```typescript
                        [
                            { state: furnishedMode === 'furnished', setter: () => setFurnishedMode(furnishedMode === 'furnished' ? '' : 'furnished'), label: t('listing.furnished', undefined, 'Meublé') },
                            { state: furnishedMode === 'unfurnished', setter: () => setFurnishedMode(furnishedMode === 'unfurnished' ? '' : 'unfurnished'), label: t('listing.unfurnished', undefined, 'Vide') },
                            { state: colocation, setter: () => setColocation(!colocation), label: t('search.filters.colocation', undefined, 'Colocation') },
                            { state: cafOnly, setter: () => setCafOnly(!cafOnly), label: t('search.filters.caf', undefined, 'CAF') },
                            { state: savedOnly, setter: () => setSavedOnly(!savedOnly), label: t('search.filters.wishlist', undefined, 'Wishlist'), icon: Heart }
                        ].map((filter, i) => (
```

(adjust the chip `onClick` to call `filter.setter()` with no argument). Directly above that row, add typology chips:

```tsx
                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: 'studio', label: 'Studio' },
                            { key: 't1', label: 'T1' },
                            { key: 't2', label: 'T2' },
                            { key: 't3plus', label: 'T3+' },
                        ].map((c) => (
                            <button
                                key={c.key}
                                onClick={() => setTypology(typology === c.key ? '' : c.key)}
                                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-700 ${typology === c.key ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
```

- [ ] **Step 4: Replace the card markup.** Import the shared card and its type:

```typescript
import ListingCard from '@/components/ListingCard';
import type { ListingSummary } from '@/lib/listingDisplay';
```

Replace the local `Property` interface usage with `ListingSummary` (delete the local interface; `ListingSummary` is a superset of what the page uses — keep `latitude`/`longitude`/`status`/`deposit`/`guarantor_required` by extending locally if referenced: `type Property = ListingSummary & { latitude?: number; longitude?: number; status: string; deposit?: number; guarantor_required?: boolean };`). Replace the entire grid card `<motion.div>` (lines ~379–505, from `key={property.id}` through its closing tag) with:

```tsx
                                        <ListingCard
                                            key={property.id}
                                            property={property}
                                            index={idx}
                                            onToggleSave={toggleSaveProperty}
                                        />
```

Remove imports that become unused (`Maximize`, `ShieldCheck`, `Image` if no longer referenced elsewhere in the file).

- [ ] **Step 5: Verify**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Then run the app (`docker compose -f docker-compose.dev.yml up` or `npm run dev` with the backend up) and manually check `/search?typology=t2&furnished=true`: T2 + Meublé chips are pre-activated and results load.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/search/page.tsx
git commit -m "feat(search): shared ListingCard, typology filter, deep-link params"
```

---

### Task 6: SearchHero typology chips

**Files:**
- Modify: `frontend/components/landing/SearchHero.tsx` (replace the Trending Cities block, lines ~109–120)

- [ ] **Step 1: Replace the trending-cities buttons** with typology chips that deep-link to search (keep the city buttons above them — cities set the query, typology chips navigate):

```tsx
            {/* ─── Typology quick entry ─── */}
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              {['Paris', 'Lyon', 'Bordeaux', 'Nice', 'Lille'].map((city) => (
                <button
                  key={city}
                  onClick={() => setQuery(city)}
                  className="px-8 py-3 rounded-full bg-zinc-50 hover:bg-zinc-900 hover:text-white text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 border border-zinc-100 hover:border-zinc-900"
                >
                  {city}
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {[
                { label: 'Studio', href: '/search?typology=studio' },
                { label: 'T1', href: '/search?typology=t1' },
                { label: 'T2', href: '/search?typology=t2' },
                { label: 'T3+', href: '/search?typology=t3plus' },
                { label: t('landing.hero.colocation', undefined, 'Colocation'), href: '/search?colocation=1' },
                { label: t('listing.furnished', undefined, 'Meublé'), href: '/search?furnished=true' },
                { label: t('listing.unfurnished', undefined, 'Vide'), href: '/search?furnished=false' },
              ].map((chip) => (
                <Link
                  key={chip.label}
                  href={query.trim() ? `${chip.href}&q=${encodeURIComponent(query.trim())}` : chip.href}
                  className="px-6 py-2.5 rounded-full bg-white text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] border border-zinc-200 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all duration-300"
                >
                  {chip.label}
                </Link>
              ))}
            </div>
```

(`Link` is already imported in this file.)

- [ ] **Step 2: Verify** — `cd frontend && npx tsc --noEmit`, then load `/` and click T2 → lands on `/search?typology=t2` with the chip active.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/landing/SearchHero.tsx
git commit -m "feat(landing): typology quick-entry chips (Studio/T1/T2/T3+/Colocation/Meublé/Vide)"
```

---

### Task 7: FeaturedListings — real data, zero fakes

**Files:**
- Modify: `frontend/components/landing/FeaturedListings.tsx` (full rewrite of the data section; keep the section header markup)

- [ ] **Step 1: Rewrite** the component so it fetches real listings. Replace the hardcoded `listings` array and card grid with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { Sparkles, Building2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import ListingCard from '@/components/ListingCard';
import type { ListingSummary } from '@/lib/listingDisplay';
import { PropertyCardSkeleton } from '@/components/SkeletonLoaders';

export default function FeaturedListings() {
  const { t } = useLanguage();
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.getProperties({
          status: 'active',
          limit: 12,
          sort_by: 'created_at',
          order_direction: 'desc',
        });
        if (cancelled) return;
        const score = (p: ListingSummary) =>
          (p.photos?.length ? 2 : 0) + (p.ownership_verified ? 1 : 0);
        const ranked = [...response].sort((a, b) => score(b) - score(a));
        setListings(ranked.slice(0, 6));
      } catch {
        if (!cancelled) setListings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fewer than 3 real listings → honest landlord CTA instead of thin/fake content
  const showListings = listings.length >= 3;

  return (
    <section className="py-24 sm:py-36 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* (keep the existing section header block: badge + title + subtitle) */}

        {loading ? (
          <div className="grid md:grid-cols-3 gap-10">
            {[0, 1, 2].map((i) => <PropertyCardSkeleton key={i} />)}
          </div>
        ) : showListings ? (
          <div className="grid md:grid-cols-3 gap-10">
            {listings.map((listing, i) => (
              <ListingCard key={listing.id} property={listing} index={i} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-[2.5rem] border border-zinc-100 bg-zinc-50 p-12 sm:p-20 text-center"
          >
            <Building2 className="w-8 h-8 mx-auto mb-6 text-zinc-400" />
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 uppercase mb-4">
              {t('landing.featured.emptyTitle', undefined, 'Publiez la première annonce vérifiée de votre ville')}
            </h3>
            <p className="text-zinc-500 max-w-xl mx-auto mb-8">
              {t('landing.featured.emptySubtitle', undefined, 'Photos vérifiées par GPS, identité vérifiée, dossier locataire certifié — publiez gratuitement.')}
            </p>
            <Link
              href="/properties/new"
              className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white rounded-full text-[11px] font-black uppercase tracking-[0.2em] hover:bg-zinc-800 transition-colors"
            >
              {t('landing.featured.emptyCta', undefined, 'Publier une annonce')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
```

Keep the existing animated section-header JSX (badge/title/subtitle) where the comment indicates. Add the three new i18n keys (`landing.featured.emptyTitle`, `emptySubtitle`, `emptyCta`) to both `en:` (English strings: "Publish the first verified listing in your city" / "GPS-verified photos, verified identity, certified tenant file — publish for free." / "Publish a listing") and `fr:` (the French strings used as fallbacks above) in `frontend/lib/i18n.ts`.

- [ ] **Step 2: Verify** — `npx tsc --noEmit`, then load `/`: with seeded listings the section shows real cards linking to real detail pages; with an empty DB it shows the landlord CTA. Confirm `/apartment_1.png` era cards and `/properties/1` links are gone.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/landing/FeaturedListings.tsx frontend/lib/i18n.ts
git commit -m "feat(landing): real featured listings, honest empty state, no fake cards"
```

---

### Task 8: E2E coverage + full verification

**Files:**
- Modify: `frontend/e2e/landing.spec.ts`

- [ ] **Step 1: Add e2e tests** to `frontend/e2e/landing.spec.ts` (follow the file's existing describe/test structure):

```typescript
test.describe('Landing truth (WP1)', () => {
    test('no dead placeholder listing links', async ({ page }) => {
        await page.goto('/');
        for (const fakeId of ['1', '2', '3']) {
            await expect(page.locator(`a[href="/properties/${fakeId}"]`)).toHaveCount(0);
        }
    });

    test('typology chip deep-links into search', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: 'T2', exact: true }).click();
        await expect(page).toHaveURL(/\/search\?typology=t2/);
    });

    test('colocation chip deep-links into search', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: /colocation/i }).first().click();
        await expect(page).toHaveURL(/\/search\?colocation=1/);
    });
});
```

- [ ] **Step 2: Run the e2e suite**

```bash
cd frontend && npm run test:e2e -- e2e/landing.spec.ts
```

Expected: PASS (requires dev servers per `playwright.config.ts` — start them the way the existing e2e suite expects).

- [ ] **Step 3: Full verification sweep**

```bash
cd backend && python -m pytest tests/ -x -q
cd ../frontend && npx tsc --noEmit && npm run lint && npm run test:e2e
```

Expected: backend green, no new type/lint errors, e2e green (pre-existing unrelated failures: note them, don't fix in this branch).

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/landing.spec.ts
git commit -m "test(e2e): landing truth — no dead links, typology deep-links"
```

- [ ] **Step 5: Push and open PR** (title: `feat: landing truth + typology entry + shared ListingCard (WP1)`), body referencing the spec. After merge: `git worktree remove ../rental-platform-landing-truth`.

---

## Note on the spec's "copy pass"

The spec's WP1 copy pass is satisfied within Tasks 4–7: every string this plan introduces is concrete, French-first with English equivalents, and no lorem-adjacent filler survives in the files touched (fake cards, amenity initials, dead links all removed). A broader wording review of untouched landing sections (ValuePropSection, HowItWorks) belongs to WP5's polish sweep — do not restyle files this plan doesn't touch.

## Out of scope for this plan (later WPs)

- `is_colocation` column, per-room pricing, "À partir de" (WP2 — the colocation filter stays on the amenity tag here)
- Bio capture/display (WP3)
- Room-label enforcement on media (WP4)
- Full both-sides stress-test matrix (WP5)
