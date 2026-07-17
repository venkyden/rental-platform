# Real-User Onboarding Experience — Design

**Date:** 2026-07-17
**Status:** Approved decisions — colocation as first-class data (improving on the Studapart reference), bios required (short), build order: landing → colocation → bios → room media → stress test.
**Goal:** Make the marketplace ready for real users on both sides: truthful landing page, curated listing cards (no generic placeholders), typology entry points (Studio/T1/T2/T3+, colocation, meublé/vide, room count), required bios on both sides, room-labeled media, and a full stress-test pass over every user action.

Reference: Studapart card layout (screenshot 2026-07-17) — used as inspiration only; we improve on it with Roomivo's trust angle (verified badges, cc/hc honesty, landlord identity line).

---

## Current state (verified in code)

| Capability | State |
|---|---|
| Property typology data | `property_type` ('apartment','house','studio','room'), `rooms_count` (pièces), `bedrooms`, `furnished`, `size_sqm` — all exist ([property.py](../../../backend/app/models/property.py)) |
| Colocation | **Hack**: search sends `amenities=['colocation']`; nothing in the wizard captures it; no model field |
| Charges honesty | `charges_included` (cc/hc) + `charges` exist; not surfaced on cards |
| Per-room media | `PropertyMedia.room_label`/`room_index` + GPS-verified capture sessions exist; no per-room size; labels not enforced |
| Bios | `user.bio` column exists; never captured or displayed |
| Landing | `FeaturedListings.tsx` is 3 **hardcoded fake cards** linking to dead `/properties/1..3`; hero has no typology filters |
| Search cards | Price, title, city, m², amenity initials-in-circles; no typology label, no chambres, no meublé/vide, no description preview, no availability |
| Auth | Complete (login, register, email verify, forgot pwd/email, Google) |
| Verification | Both-sides identity (MEDIUM OCR+selfie), solvency 2D-Doc, property GPS media + ownership "control not ownership" — already live |

---

## WP1 — Landing truth + typology entry + shared listing card

### 1a. Shared `ListingCard` component (used by landing + search)

Label hierarchy, top → bottom (the answer to "most important labels"):

1. **Typology line**: `COLOCATION · MEUBLÉ` / `T2 · MEUBLÉ` / `STUDIO · VIDE`.
   - Typology derived, no new column: `studio` type → "Studio"; `room`/colocation → "Colocation"; else `T{rooms_count}` (cap display at T6+).
   - Meublé/Vide from `furnished`.
2. **Price**: colocation → `À partir de 510€ cc / mois` (min per-room price); else `1 250€ cc / mois` or `hc` when `charges_included` is false. Never show a bare price without cc/hc. (Ordering note: until WP2 lands, per-room prices don't exist — WP1 renders the plain `monthly_rent` for all listings and the "À partir de" form activates with WP2.)
3. **Title** (landlord's, 200 chars, single line clamp).
4. **Location**: `Nantes (44300)` — city + postal code, never full address pre-application.
5. **Spec line**: `240m² · 5 chambres · Salle de bain privée` — surface, chambres (`bedrooms`), plus at most one differentiator amenity (priority: private bathroom > balcony/terrace > parking > elevator).
6. **Description preview**: first ~160 chars of `description`, 2-line clamp, emoji stripped for the preview only.
7. **Availability**: `● Disponible immédiatement` (green, `available_from` ≤ today or null) / `● Disponible à partir du 3 août 2026` (neutral).
8. **Trust line**: `Publié par Marc — identité vérifiée` (first name only + verification state; MEDIUM shown as "vérifiée", never inflated).

Photo overlay badges: `⛨ Photos vérifiées GPS` (only when GPS-verified media exists), `DPE C`. Heart/save stays. Photo carousel with order from `order_index`, cover first.

**No generic placeholders anywhere**: amenity initials-in-circles are removed; if a listing has no photo the card shows a neutral "Photos en cours d'ajout" state, not the ROOMIVO wordmark filler.

### 1b. Landing changes

- **SearchHero**: add a typology chip row under the search bar — `Studio`, `T1`, `T2`, `T3+`, `Colocation`, plus a `Meublé / Vide / Indifférent` toggle. Chips deep-link to `/search?typology=t2&furnished=true…` (search page reads these params on load).
- **FeaturedListings**: replace hardcoded cards with the newest `active` listings from the API (limit 6, `ownership_verified` and photo-bearing listings ranked first). If fewer than 3 real listings exist, the section renders a "Publiez la première annonce vérifiée de votre ville" landlord CTA instead of fakes. Never render a card that links nowhere.
- Copy pass over hero/value-prop/how-it-works: concrete, curated French-first copy (i18n keys as today), no lorem-adjacent filler.

### Search page

- Replace its inline card markup with `ListingCard`.
- Add typology filter (Studio/T1/T2/T3+) mapped to `rooms_count`/`property_type`; keep furnished; colocation filter switches to the new field (WP2).
- Reads landing deep-link params.

---

## WP2 — Colocation as first-class data

Schema (Alembic migration):

- `Property.is_colocation` Boolean, default false, indexed.
- Per-room detail lives in existing `room_details` JSONB, normalized shape:
  `[{"index": 0, "label": "Chambre 1", "size_sqm": 12.5, "monthly_rent": 510, "available_from": "2026-08-03", "private_bathroom": true, "status": "available"|"taken"}]`
- Backfill: `is_colocation = true` where amenities JSONB contains 'colocation' or `property_type = 'room'`.

Wizard (properties/new steps):

- Basic step asks: type (Appartement/Maison/Studio), pièces (`rooms_count`), chambres, meublé/vide.
- New question: "Louez-vous à la chambre (colocation) ?" → if yes: per-room editor (label, size, rent, availability, private bathroom). Sum of room sizes validated ≤ total `size_sqm`; each room ≥ 9m² warning (décence).
- Meublé triggers the existing Décret 2015-981 furnished checklist gate (already enforced at deposit level; surface it here too).

API/search: `is_colocation` filter param; listing responses expose `colocation_summary` (rooms total/available, min rent) — per-room data sanitized (no tenant info).

Display: card shows `À partir de {min available room rent}` and `X chambres dont Y disponibles`; detail page gets a per-room availability table.

---

## WP3 — Bios on both sides (required, short)

- **Capture**: onboarding questionnaire step per role; also blocking prompts — landlord cannot **publish** and tenant cannot **apply** without a bio. 40–300 chars.
- **Guided neutral prompt** (anti-discrimination + GDPR): placeholder/help steer to situation (student/employed), rhythm of life, why this city. Inline warning not to include origin, religion, family status, health, or contact details (Code pénal 225-1/225-2 exposure; bio is free text ⇒ GDPR minimization). Soft regex block on emails/phone numbers.
- **Display**:
  - Landlord bio → listing detail "Qui propose ce logement" card: first name, verification badge, bio, member-since. Also the card trust line (WP1).
  - Tenant bio → application view for the landlord, next to the credential summary.
- Bio is included in GDPR export and cleared on erasure (verify the existing GDPR erasure covers `bio` — test in WP5).

---

## WP4 — Room-labeled media

- Upload/capture flow: room label selection required per photo (Chambre N / Séjour / Cuisine / Salle de bain / Extérieur / Autre); colocation rooms map to `room_details` indices; optional per-room `size_sqm` shown as `Chambre 1 — 12m²` chips.
- Detail-page gallery grouped by room with chip navigation; GPS-verified badge per photo where session verified.
- Publish gating (soft): warn if fewer than 3 photos or no cover; never block on media (photos may legitimately lag), but the card's no-photo state (WP1) is the visible cost.

---

## WP5 — Stress test (both sides, every action)

Playwright e2e (frontend) + pytest (backend) matrix; fix-as-found. Actions covered:

- **Auth**: register (both roles), email verify, login, Google, logout, forgot password, forgot email, reset, email change, rate limits, expired tokens.
- **Tenant**: onboarding + bio gate, identity MEDIUM flow, 2D-Doc solvency (valid/invalid/tampered), search + every filter combo + deep-link params, save/unsave, listing detail, apply (with/without bio, with/without verification), visit booking, messaging, credential share/QR.
- **Landlord**: onboarding + bio gate, identity, wizard end-to-end (studio/T2/colocation × meublé/vide), deposit caps (vide 1 mois / meublé 2), DPE G block, rent-control fields, GPS media session (in/out of radius, expired link), publish gates, applications review, visit slots, lease gen + e-sign Path B.
- **Cross-cutting**: GDPR export/erasure (incl. bio), i18n FR/EN on all new copy, mobile viewport for landing/search/wizard, empty states (0 listings, 0 results, 0 applications), dead-link scan on landing.

Success criterion per flow: e2e green + no console errors + French-law gates firing.

---

## User flows (published as the canonical reference)

**Tenant**: Landing (city + typology chips) → results (ListingCard) → listing detail (room gallery, landlord bio, trust badges) → sign up + email verify → onboarding (bio, preferences) → identity (MEDIUM) + solvency (2D-Doc) → apply (credential + bio) → visit → messaging → e-sign → inventory.

**Landlord**: Landing ("Publier une annonce") → sign up + email verify → onboarding (bio) → identity (MEDIUM) → wizard (typology, meublé/vide, colocation rooms, pricing cc/hc, DPE/compliance gates) → property verification (GPS room-by-room, taxe foncière "control, not ownership") → publish (bio + compliance gates) → applications (tenant credential + bio) → visits → lease → e-sign.

## Guardrails (unchanged, enforced in this work)

No matching/recommendation of counterparties (passive publisher only — "newest first" ranking, no personalization). No nationality/origin routing. cc/hc always explicit. DPE G lease block stays. MEDIUM never displayed as more than "vérifiée" (no "guaranteed" language). No funds, no success fees.

## Out of scope

Per-room individual leases (bail de colocation individuel generation), tenant-side public profiles/browse (would drift toward matching), reviews/ratings, paid placement.
