# DPE Reclassification Enforcement — Design

**Phase 2, Item 9.** Date: 2026-06-10. Branch: `feat/dpe-reclassification-enforcement`.

## Problem

At publish, the property gate ([properties.py:819-831](../../../backend/app/routers/properties.py))
hard-blocks listings whose `dpe_rating == "G"` and requires a non-empty `dpe_rating`.
But `dpe_rating` is a **self-typed letter** from the wizard's Step 3 — never validated
against ADEME. A landlord can type "F" on an actually-"G" unit and publish straight
through the ban. Separately, the Jan 2026 ADEME coefficient reform reclassified ~850k
units, so any stored or self-typed class can be stale.

## Legal basis (sources consulted)

- **Art. L126-33 CCH** — the DPE class **must appear in every rental ad, including on a
  digital platform** ("y compris celles diffusées sur une plateforme numérique").
  A *professionnel*'s breach is an administrative fine ≤ **€3,000** (personne physique) /
  **€15,000** (personne morale). → The platform must display a class, and it must be
  **accurate**. Sources:
  [Légifrance L126-33](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041565291/2021-07-01),
  [ANIL DPE annonces](https://www.anil.org/aj-dpe-mentions-obligatoires-annonces-baux-immobiliers/).
- **Décence énergétique (loi Climat, via Art. 6 loi 89)** — the class-G prohibition bites
  at **lease formation**: *"contrat de location nouvellement signé… qui se reconduit ou se
  renouvelle"* — **not at advertising**. Since 1 Jan 2025 the dwelling must be A–F to be
  leased/renewed. Sanction falls on the **landlord** (allocation withholding, court-ordered
  works / rent reduction / damages). There is **no advertising ban** on G dwellings.
  Sources:
  [ANIL décence](https://www.anil.org/aj-logement-decent-performance-energetique/),
  [Service-Public A17975](https://www.service-public.fr/particuliers/actualites/A17975?lang=fr).
- **Décence calendar:** G prohibited from 1 Jan 2025; F from 1 Jan 2028; E from 1 Jan 2034.

### Legal conclusions that shape the design

1. The platform is **not** legally required to block G listings — the décence breach is the
   landlord's, at lease time. So **warn, don't block** is correct; the prior hard-block was
   the platform over-enforcing.
2. The platform **is** required to **display a correct class** (L126-33). So: a missing
   class stays a publish **requirement** (it's the law, not a chosen guardrail), and a
   self-typed class that contradicts ADEME is itself an accuracy breach → prefer the
   ADEME-verified class whenever one exists.

## Decisions

- **Warn, don't block** on class G / expired DPE.
- **Require a one-click acknowledgment** before publishing a G / expired listing (audit
  trail that the platform informed the landlord — DSA / liability posture). The class is
  displayed either way, so L126-33 is satisfied regardless.
- **No new required field.** Do not force landlords to obtain/enter an ADEME DPE number
  (friction, and not legally required). The free `/dpe` verification stays an opt-in CTA.
- **Authoritative class:** the HIGH ADEME class in `ownership_data` (from `/dpe`) wins over
  the self-typed `dpe_rating`; self-typed is the fallback, labelled *déclaré, non vérifié*.

## Design

### A. New pure service — `backend/app/services/dpe_compliance.py`

Side-effect-free and fully unit-testable, mirroring `french_compliance.py`. It produces
**facts only** — it makes no publish decision.

```
@dataclass
class DPEAssessment:
    authoritative_class: Optional[str]   # ADEME HIGH class if present, else self-typed
    class_source: str                    # "ademe_verified" | "self_declared" | "none"
    expired: bool
    requires_acknowledgment: bool        # True if décence-prohibited now OR expired
    warnings: list[DPEWarning]           # bilingual, each with code + legal cite + severity

def assess_dpe(
    self_typed_class: Optional[str],
    ademe_class: Optional[str],
    assurance: Optional[str],            # "HIGH" | "PENDING" | "UNVERIFIED" | None
    expired: Optional[bool],
    today: date,                         # injectable for date-aware calendar tests
) -> DPEAssessment: ...
```

Warning codes (date-aware against the décence calendar, so they stay correct over time):
- `DECENCE_PROHIBITED` — authoritative class is below the threshold in force on `today`
  (G today; F from 2028-01-01; E from 2034-01-01). Severity: blocks-acknowledgment.
- `DECENCE_UPCOMING` — class becomes prohibited at a known future date (informational).
- `DPE_EXPIRED` — past `valid_until` or old-methodology (established < 2021-07-01).
- `SELF_DECLARED_UNVERIFIED` — class came from landlord input, not ADEME; may be subject
  to the Jan 2026 reclassification. Informational; pairs with the `/dpe` CTA.

### B. Publish gate — `backend/app/routers/properties.py`

Replace the `dpe_rating` block at lines 819-831:

1. Read `ownership_data` → derive `ademe_class`, `assurance`, `expired`.
2. Call `assess_dpe(...)`.
3. **Missing authoritative class → 400** (L126-33: the ad must state a class). Bilingual
   detail citing L126-33.
4. If `assessment.authoritative_class` differs from stored `dpe_rating` → overwrite
   `property_obj.dpe_rating` with the authoritative class (keeps the ad accurate).
5. If `assessment.requires_acknowledgment` and the request did **not** pass
   `acknowledge_dpe_warning: true` → **409** with the warning payload (frontend shows
   warning + checkbox, resubmits). Otherwise stamp
   `ownership_data.dpe_decence_acknowledged_at` (UTC ISO) + `dpe_decence_acknowledged_class`
   and proceed.
6. Persist the resolved warnings onto the property so the listing can display them.

The publish endpoint gains an optional `acknowledge_dpe_warning: bool` body field (default
`False`). Existing non-G / non-expired publishes are unaffected (no acknowledgment needed).

### C. Frontend

- Step 3 / review step ([Step3Details.tsx:79-82](../../../frontend/app/properties/new/steps/Step3Details.tsx)):
  replace the simplistic "banned since 2023" copy with the accurate, date-aware décence
  notice text returned by the assessment.
- On publish, if the API returns 409 with a décence warning, render the warning + a
  **required** acknowledgment checkbox; resubmit with `acknowledge_dpe_warning: true`.
- Display the class with an assurance label — *Vérifié ADEME* vs *Déclaré* — and offer the
  free `/dpe` verification as an opt-in CTA when the class is self-declared.
- FR/EN i18n parity for all new strings.

### D. Tests

`backend/tests/test_dpe_compliance.py` (unit, pure function):
- G today → `DECENCE_PROHIBITED`, `requires_acknowledgment=True`.
- F today → no current prohibition; `DECENCE_UPCOMING` (2028). With `today=2028-06-01` → F
  becomes `DECENCE_PROHIBITED`. With `today=2034-06-01` → E prohibited.
- expired / old-methodology → `DPE_EXPIRED`, `requires_acknowledgment=True`.
- HIGH ADEME "G" overrides self-typed "F" → authoritative `G`, `class_source=ademe_verified`.
- self-typed only → `SELF_DECLARED_UNVERIFIED`, `class_source=self_declared`.
- no class anywhere → `class_source=none`.

Publish integration (`backend/tests/test_properties.py` or integration suite):
- missing class → 400 (L126-33).
- G without acknowledgment → 409 with warning payload.
- G with `acknowledge_dpe_warning=true` → publishes; ack timestamp stored.
- HIGH ADEME "G" + self-typed "F" → `dpe_rating` overwritten to "G", acknowledgment required.
- class A–F, not expired → publishes unchanged (regression guard).

## Out of scope

- Forcing ADEME number capture in the wizard (rejected: friction, not legally required).
- F/E prohibition enforcement beyond the date-aware calendar (handled generically; no
  special-casing needed before 2028).
- Re-verifying every listing live against ADEME on a schedule (separate concern).
```
