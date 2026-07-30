# Listing Criteria Panel + Neighborhood Map/Directions — Design

Date: 2026-07-30.

## Problem

Two gaps on the public listing page (`PropertyDetailClient.tsx`), both prompted by a
Studapart reference screenshot:

1. **No landlord-criteria display.** A landlord's lease-duration, guarantor, and
   accepted-tenant-type preferences are captured on `Property` but never shown to a
   prospective applicant on the listing page.
2. **Static-only map.** `StaticMapView.tsx` already renders a pin at the property's
   prefilled `latitude`/`longitude` (working, no change needed there), but there is no
   way for a visitor to search an address and see walk/bike/car distance to the
   property, unlike the Studapart reference.

---

## Legal basis (Légifrance cross-check, done before design)

Studapart's reference screenshot cannot be cloned as-is. Two of its criteria conflict
with French law if Roomivo were to bake them in or enforce them:

- **Article 22-1, Loi n°89-462 du 6 juillet 1989**: a landlord may not refuse a
  guarantor solely for lacking French nationality or not residing in metropolitan
  France. Studapart's "Garant résidant en Zone Euro ou Garantie Studapart" sits
  directly on top of this. **Excluded from this design**: no guarantor-residency field.
- **Code pénal Art. 225-1 / 225-2**: age and place of residence are both listed
  protected characteristics; conditioning a good/service on them is a criminal offense.
  Studapart's "Âge maximum : 35 ans" is excluded. No `age_max` field exists on
  `Property` today and none is added.
- **Décret n°2015-1437 (Annexes I & II)**: exhaustive list of documents a landlord may
  request from tenant/guarantor (already encoded as `LOI_ALUR_ALLOWED_TENANT_DOCS` in
  `french_compliance.py`). Notably, Studapart's "Attestation parentale" is not on
  either annex.
- **DOSSIER §0.20 ("credential, never documents")**: independent of the décret
  question above, Roomivo's product model is verify-once → issue a signed credential
  → discard the source. A literal "documents à fournir" checklist (Studapart's
  paper-dossier pattern) contradicts this positioning. This design replaces the
  document-checklist idea with credential/assurance-level copy instead (see below).

Everything reused in this design (`lease_duration_months`, `guarantor_required`,
`accepted_guarantor_types`, `accepted_tenant_types`, a new `guarantor_income_multiple`)
is a neutral, non-protected-characteristic, uniformly-applied criterion — none of it
implicates Art. 225-1/225-2, and nothing here is used for search filtering, matching,
or application gating; it is informational only, consistent with Roomivo's
passive-publisher posture (matching stays disabled).

**Accuracy check on assurance claims**: the INTL identity rail currently ships MEDIUM
only (MRZ-OCR + selfie liveness) — `mrz.py` and `credential.py` both note the web path
cannot do NFC Passive Auth. Passport-NFC → HIGH (JMRTD/AndyQ) and FranceConnect → HIGH
are both still aspirational (CLAUDE.md stack table), gated on a native mobile app and
the CSCA master list / incorporation respectively, neither of which exist yet. This
design's credential copy states **MEDIUM only, for both rails**, with no HIGH/NFC/
FranceConnect mention on this public-facing page — stating unavailable tiers would be
exactly the "inflate MEDIUM to HIGH" mistake DOSSIER forbids.

---

## Decisions

1. Criteria panel is **informational only** — no new filtering, matching, or
   application-blocking logic anywhere in this design.
2. No age field, no guarantor-residency field, no raw document checklist. Confirmed
   with the user (2026-07-30): omit these entirely rather than a free-text
   landlord-disclaimer alternative.
3. Directions feature uses **openrouteservice** (free tier, 2000 req/day) called
   server-side only — API key never reaches the client.
4. Map interactivity (address search + route) lives in a **new component**
   (`NeighborhoodMap.tsx`), not bolted onto `StaticMapView.tsx` — `StaticMapView` is
   used elsewhere as a simple read-only pin and its contract shouldn't change for
   existing callers.
5. Credential copy in the panel states only what's actually live (MEDIUM identity on
   both rails, MEDIUM solvency, MEDIUM guarantor certs) — confirmed with the user
   (2026-07-30): omit any "coming soon" HIGH-tier caveat.

---

## Design: Criteria panel

### Data model

`backend/app/models/property.py` — new column:

```python
guarantor_income_multiple = Column(DECIMAL(3, 1))  # e.g. 3.0 = 3x rent required
```

New Alembic migration adding this column. Mirrored in `property_schemas.py` (create,
update, and read schemas — same three places `guarantor_required` currently appears).

### Wizard (`frontend/app/properties/new/steps/Step5Pricing.tsx`)

- Add `accepted_tenant_types` multi-select toggle group (employee / student /
  freelancer / retired / other), same visual pattern as the existing
  `accepted_guarantor_types` toggle block in this file. Already declared in
  `types.ts`; just needs to be collected.
- Add a numeric input for `guarantor_income_multiple`, rendered only inside the
  existing `{formData.guarantor_required && (...)}` block, next to the guarantor-type
  toggles.

### Display (`frontend/app/properties/[id]/PropertyDetailClient.tsx`)

New "Critères du loueur" card, placed near the existing "Verified Location" section
(around line 795). Two sub-sections:

**"Ce que demande le bailleur"** (landlord-authored, from `Property` fields):
- Min lease duration (`lease_duration_months`, "flexible" if null)
- Guarantor required + accepted types + income multiple (only if `guarantor_required`)
- Accepted tenant/occupancy types

**"Comment le prouver"** (static product copy, not landlord-editable, tone matches
`CredentialExplainer.tsx`):
- Identity: MEDIUM assurance (OCR + selfie liveness) — FR and INTL rails both
  supported.
- Solvency: verified ≥ {multiple}× rent via avis d'imposition 2D-Doc (FR) or
  funds-coverage rail (INTL) — both MEDIUM.
- Guarantor (if required): Visale/Garantme certificates, MEDIUM.

This sub-section renders even if the exact wording needs i18n keys added to
`lib/i18n.ts`, following the existing `t('property.xxx', undefined, 'fallback')`
pattern used throughout this file.

---

## Design: Neighborhood map + directions

### Backend

New endpoint on the properties router:

```
GET /properties/{id}/directions?address={text}&mode=walking|cycling|driving
```

- Geocode `address` via the existing Photon-based geocoding already used behind
  `AddressAutocomplete` (no new geocoder dependency).
- Call openrouteservice Directions API server-side using `mode` → ORS profile
  (`foot-walking`, `cycling-regular`, `driving-car`).
- Response: `{ distance_m: number, duration_s: number, geometry: GeoJSON LineString }`.
- New env var `ORS_API_KEY` (backend only).
- No persistence — this is a stateless lookup, same pattern as the existing
  enrichment endpoint.

### Frontend

New component `frontend/components/NeighborhoodMap.tsx`, used in place of
`StaticMapView` in the "Verified Location" section of `PropertyDetailClient.tsx`
(`StaticMapView.tsx` itself is unchanged — it's used elsewhere as a plain pin).

- Renders the same Leaflet base map as `StaticMapView` (marker at
  `property.latitude`/`longitude`, prefilled exactly as today — this part already
  works and is not being rebuilt).
- Adds an address-search input, reusing `AddressAutocomplete` for the typed-address
  field, plus a "Rechercher" button.
- Adds walk/bike/car mode toggles.
- On search: calls the new `/properties/{id}/directions` endpoint, draws the returned
  route as a Leaflet `Polyline`, and displays distance + duration text near the map.

---

## Out of scope

- Studapart's per-profile document tabs (Étudiants / Jeunes actifs, Garant en France /
  hors de France) — replaced by the single flat "How you prove it" credential
  sub-section described above.
- Any use of these criteria for search filtering, ranking, or application
  auto-rejection — matching stays disabled per CLAUDE.md.
- Mobile-app passport NFC / FranceConnect HIGH-tier work — unrelated to this feature,
  tracked separately per CLAUDE.md's stated next-build order.
