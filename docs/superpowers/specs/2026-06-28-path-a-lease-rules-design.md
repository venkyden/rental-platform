# Path A — lease-generation legal rule-set (LG-1..LG-6)

Date: 2026-06-28. Status: built (branch `feat/path-a-lease-rules`).
Source of truth: `docs/features/trust-layer/DOSSIER.md` §5.5, §0.16, French-law specifics.

## Why this is the *safe* slice of Path A
Path A (Roomivo-generated lease) splits into two parts:
1. **Deterministic legal enforcement** (LG-1..LG-6) — well-defined French law, no wording. ← this PR
2. **The lease body wording** — must be the official **Décret n°2015-587** model. **Gated:**
   the lawyer's opinion (`docs/legal/2026-06-20-...`) conditions deployment on enforcing all
   mandatory provisions + annexes and using model wording only (loi 1971). The existing
   `lease_templates.py` is **custom-drafted prose**, not the official model — it must be
   replaced/blessed before generation can ship. Not in this PR.

So this PR builds the rule-set that the (future, gated) generation finaliser will call, with
zero legal-wording risk.

## What's built — `app/services/lease_rules.py` (pure, 21 tests)
Lease-type-aware (vide / meublé / étudiant / mobilité), independent of `french_compliance.py`
(which is property-publish-focused and only furnished/unfurnished).

| LG | Function | Rule |
|----|----------|------|
| LG-1 | `validate_deposit` | deposit ≤ cap (vide 1 / meublé·étudiant 2 mois HC) — loi 89 art. 22 |
| LG-2 | `validate_deposit` | bail mobilité: deposit must be 0 — loi ELAN art. 25-12 (`max_deposit`→0 to clamp) |
| LG-3 | `validate_furnished_inventory` | furnished leases need all 11 Décret 2015-981 categories; lists what's missing |
| LG-4 | `validate_annexes` | block while DPE / ERP / notice d'information missing |
| LG-5 | `zone_tendue_advisory` | advisory flag (never blocks) |
| LG-6 | `reject_custom_wording` | no custom clauses — only the Décret 2015-587 model (loi 1971) |
| — | `validate_lease_finalisation` | runs all of the above → `{ok, blocking[], advisory[]}` |

## Out of scope / gated (next)
- The **Décret 2015-587 model wording** + the lawyer's mandatory-provisions checklist (gated input).
- Wiring the rule-set into a generation **finaliser** endpoint (depends on the above).
- LG-4 **auto-stitch** of the notice d'information + **property-specific diagnostics**
  (CREP plomb pre-1949, amiante, gaz/élec > 15 ans, surface Boutin/Carrez) — generator concern.
