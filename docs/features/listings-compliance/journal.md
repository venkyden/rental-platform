# Journal — Listings & French Rental Compliance

## Purpose
Property listings (CRUD, media, publish) and enforcement of French rental law at
publish time. Also covers bulk import/export and landlord/agency stats.

## Surface
- Backend: `app/routers/properties.py` (CRUD, `publish_property`, recommendations,
  wishlist, media sessions), `app/routers/bulk.py`, `app/routers/stats.py`,
  `app/services/property.py`, **new** `app/services/french_compliance.py`.
- Model: `app/models/property.py` — money as `Numeric(10,2)`; compliance columns
  `dpe_rating`, `ges_rating`, `loyer_reference`, `loyer_reference_majore`,
  `complement_de_loyer(_justification)`, `natural_risks_compliant`.
- Frontend: `/search`, `/properties/[id]`, `/properties/new` (7-step wizard), `/bulk`.

## French-law touchpoints (enforced in `publish_property`)
- DPE mandatory + **DPE-G ban** (Loi Climat & Résilience 2023).
- Minimum habitable surface 9 m² (Décret 2002-120).
- Deposit cap: 1 month unfurnished / 2 months furnished (loi 1989, art. 22).
- **Encadrement des loyers** (loi ALUR/ELAN) — added this pass.

## Audit findings → fixes
- 🔴 **Rent control was never enforced** despite the model carrying the reference-rent
  columns. **Fixed:** `validate_rent_control()` (pure, unit-tested) rejects base rent
  above the majored reference €/m² unless a justified `complément de loyer` is provided;
  a declared complement always requires justification. Wired into `publish_property`.
- 🟡 `published_at` used naive `datetime.utcnow()` → made tz-aware (other call sites in
  this router deferred to the datetime sweep).
- 🟢 Existing DPE/surface/deposit checks verified correct and retained.

## Tests
- `tests/test_french_compliance.py` — 8 AAA unit tests (happy/edge/error) for the validator.

## Backlog
- Source `loyer_reference_majore` automatically from the address (zone tendue dataset)
  during `/location/enrich` so enforcement applies even when a landlord omits it.
- Validate `natural_risks_compliant` (ERP / état des risques) at publish.
