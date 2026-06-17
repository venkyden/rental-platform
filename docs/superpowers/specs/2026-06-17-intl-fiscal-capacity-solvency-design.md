# INTL Fiscal-Capacity Solvency + Plain-Language Assurance — Design Spec

**Date:** 2026-06-17
**Status:** Draft for review
**Scope:** `backend/app/routers/verification.py`, `backend/app/routers/credentials.py`,
`backend/app/services/credential.py` (evidence PDF), `frontend/app/c/[credential_id]/page.tsx`
— no DB migrations (reuses `income_data` JSONB + existing claim store).

---

## Context

The international rail (Item 11) ships a MEDIUM solvency check that FX-normalises an
**income** document into a rent-ratio (`/intl/solvency` → `income_data.solvency_ratio`).
That fits a salaried applicant. It does **not** fit the dominant international user — the
**student** — who has no salary, no French tax history, and no avis d'imposition. Their
solvency is a **pool of funds** (parental support, savings, scholarship, sponsorship, an
education loan), not a monthly wage.

Two concrete gaps were confirmed in code:

1. **The credential only understands income.** `issue_mine`
   (`credentials.py`) builds solvency purely from `solvency_ratio` (income ÷ rent). A
   student with €8 000 of parental funds and zero income produces nothing the credential
   can express — there is no funds/assets claim.

2. **Assurance tiers leak to the landlord as friction.** The verify page renders the raw
   internal grades — `HIGH` (green), `MEDIUM` (**amber**), `UNVERIFIED` (grey)
   (`frontend/app/c/[credential_id]/page.tsx:39-41`). Because HIGH identity is deferred
   everywhere (FranceConnect / EUDI not live), almost every honest user is MEDIUM and
   therefore shows an amber "caution"-coloured badge. The internal grade — essential for
   honesty, audit, and the B2B insurer API — is the wrong thing to show a layperson making
   a trust decision.

### Why a document rail (not Open Banking)

Live bank-account reads (PSD2 AIS) were considered and rejected: they require either a
commercial aggregator (a paid data-processor in the sensitive-data path — counter to the
project's "consume state rails, never commercial intermediaries" posture) or becoming a
registered AISP (licensing cost; edges toward the regulated-financial-activity zone the
project avoids). See **Rejected Alternatives**. The self-contained, zero-dependency path is
to parse the funding documents students already hold.

---

## Goal

Let an international applicant prove **fiscal capacity** from the funding documents they
actually have, expressed as a banded claim the credential can carry — and render every
claim to the landlord in plain, affirmative language instead of internal tier words.

---

## Regulatory boundaries (enforced in this design)

- **Never inflate MEDIUM → HIGH.** Every document here is a forgeable PDF with no
  cryptographic verification path. The rail is **MEDIUM**, permanently. The deferred "HIGH"
  funds path is EUDI Wallet (offline-verified verifiable credential), recorded as future.
- **Fiscal capacity, not income.** Present banded *funds coverage* ("funds cover ~N months
  of rent"), never as income. Consistent with `CLAUDE.md` ("present RFR as fiscal capacity").
- **No guarantor brokering.** A sponsor's funds document is treated as a *fiscal-capacity
  signal with `funds_source: sponsor`*, not as the sale or arrangement of a guarantee
  product (Hoguet / insurance boundary). Verification only.
- **Statelessness.** Extract the banded claim, then discard the document immediately —
  same verify-and-forget path as the rest of the INTL rail. No source document at rest.
- **No nationality/status routing.** This rail is selected by *which document the user
  holds*, offered identically to everyone. Visa/immigration status is explicitly **not** a
  signal here (see Rejected Alternatives — discrimination, Code pénal 225-1/225-2).

---

## Design

### 1. Fiscal-capacity rail — one endpoint, several document types

`POST /verification/intl/funds`

Accepts one funding document plus a declared `document_type` and `funds_source`:

```
document_type: "bank_statement" | "scholarship_letter"
             | "sponsorship_letter" | "loan_approval"
funds_source:  "self" | "sponsor"
monthly_rent:  optional float (target rent, for coverage banding)
```

**Flow (mirrors `/intl/solvency`):**

1. AI-extract (reuse the `_ai_extract_intl_*` pattern): `amount`, `currency`,
   `coverage_period` (e.g. months the funding spans), `issuer` (bank / awarding body /
   sponsor / lender), and the named person.
2. FX-normalise the amount to EUR via existing `fx_normalise.convert_to_eur`. If the
   currency is unconvertible → assurance `UNVERIFIED` (reuse the existing FX fallback).
3. Band the result (see §1.1).
4. Record **source strength** — `proof` (bank statement: shows money now) vs `promise`
   (scholarship / sponsorship / loan: committed future funds). The band is the same; the
   strength is a recorded flag, not an inflation.
5. Compute **anti-fraud flags** (§1.2).
6. Write a `funds_coverage` block to `income_data`, set assurance MEDIUM (or UNVERIFIED on
   FX failure). Bump trust score (+20, mirroring `/intl/solvency`) **only if the applicant
   has no already-verified solvency signal** — funds and income must not double-count.
7. **Discard the document** (no storage; nothing persisted but the band + flags).

#### 1.1 Banding

`months_covered = eur_funds / monthly_rent` (when `monthly_rent` is given):

| months_covered | `funds_band` |
|---|---|
| ≥ 12 | `covers_12m_plus` |
| 6–11 | `covers_6m` |
| 3–5 | `covers_3m` |
| < 3 | `covers_under_3m` |

If `monthly_rent` is absent, store `eur_funds` banded coarsely and `funds_band:
"amount_only"` (no coverage ratio possible). Raw EUR amount is **not** persisted in the
credential — only the band.

#### 1.2 Anti-fraud flags (stay MEDIUM — flags, never upgrades)

- **`name_present`** — the applicant's name (from `identity_data`) must appear: as the
  *account holder* for `funds_source: self`, or as the named *beneficiary / sponsored
  party* for `funds_source: sponsor`. Absent → flag (mirrors the FR avis name cross-check).
- **`duration_covers_lease`** — for time-bounded funding (scholarship / loan / sponsorship),
  does `coverage_period` span the lease term? A 12-month loan against a 24-month lease → flag.
  **Not applicable** to a bank-statement balance (no duration); record `null`, never `false`.
- (Deferred — YAGNI for v1) issuer-recognition against a seed list of known scholarships /
  education lenders.

#### 1.3 `income_data.funds_coverage` shape

```python
income_data["funds_coverage"] = {
    "funds_band": "covers_12m_plus",      # banded, never raw amount
    "funds_source": "sponsor",            # self | sponsor
    "document_type": "bank_statement",
    "source_strength": "proof",           # proof | promise
    "assurance": "MEDIUM",                # never HIGH
    "flags": {"name_present": True, "duration_covers_lease": True},
    "fx_source": "...", "fx_margin_applied": ...,   # reuse FX metadata
}
```

This is additive — it does **not** replace `solvency_ratio`. An applicant may have income
*or* funds *or* both; the credential surfaces whichever exist.

### 2. `funds_coverage` claim in the credential

Extend `issue_mine` (`credentials.py`) to read `income_data.funds_coverage` and, when
present and not UNVERIFIED, add:

```python
claims["funds_coverage_band"] = fc["funds_band"]
claims["funds_coverage_source"] = fc["funds_source"]
claims["funds_coverage_assurance"] = fc["assurance"]   # MEDIUM
```

Honesty guard (mirrors existing logic): UNVERIFIED funds are not emitted; MEDIUM stays
MEDIUM. No interaction with the existing `solvency_ratio` claim — both can coexist.

### 3. Plain-language assurance presentation (consumer surfaces)

**Principle:** internal assurance tiers (`HIGH` / `MEDIUM` / `UNVERIFIED`) are retained in
the credential JSON and the B2B API response (insurers price on them), but **never shown as
raw tier words to the consumer**. Consumer surfaces render an **affirmative statement of
what was actually checked**.

A single mapping drives it (claim key + tier → human sentence):

| Claim / tier | Landlord sees |
|---|---|
| `identity_assurance: MEDIUM` | "ID document checked + live selfie match" |
| `identity_assurance: HIGH` | "Identity confirmed against government records" |
| `solvency_assurance: MEDIUM` (ratio) | "Income verified to cover rent" |
| `funds_coverage_band: covers_12m_plus` | "Funds verified to cover 12+ months' rent" |
| `funds_coverage_source: sponsor` | "(backed by a sponsor)" appended |
| `property_control_*` | "Property control documents checked" |
| `*: UNVERIFIED` | claim row hidden (not shown as a red/grey "fail") |

**Changes:**
- `frontend/app/c/[credential_id]/page.tsx`: replace the `ASSURANCE_BADGE` tier-word/amber
  rendering with a green-check + plain-sentence row driven by the mapping. UNVERIFIED rows
  are omitted, not shown as caution badges.
- Evidence PDF (`backend/app/services/credential.py`): same mapping — affirmative
  statements, no tier words.
- The credential JSON returned by the API is **unchanged** (still carries the tiers).

---

## Edge cases

| Scenario | Handling |
|---|---|
| Currency unconvertible | `UNVERIFIED`; claim not emitted (existing FX fallback) |
| No `monthly_rent` supplied | `funds_band: "amount_only"`; coverage ratio skipped |
| Sponsor doc, student not named as beneficiary | `name_present: false` flag; stays MEDIUM |
| Scholarship covers tuition only, not living costs | Banded on the stated amount; `source_strength: promise`; landlord sentence still says "funds" — documented limitation, not inflated |
| Loan/scholarship shorter than lease | `duration_covers_lease: false` flag |
| Applicant has both income and funds | Both claims coexist in the credential |
| Funds amount present but rent unknown at issue | Band coarsely; verify page shows "Funds verified" without a month figure |
| Document is a forgery | Out of scope to detect cryptographically — this is why the tier is MEDIUM, by design |

---

## What this does NOT change

- The existing `/intl/solvency` income rail — kept as-is for salaried applicants.
- The `solvency_ratio` claim and FR avis rail — untouched.
- The guarantor subsystem (`guarantor_type` visale/garantme/physical, `guarantor_data`) —
  **not** modified here. Sponsor funds are captured as a fiscal-capacity *signal*, not as a
  legal guarantor entity. (Wiring `guarantor_data` into the credential is a separate
  follow-up, noted but out of scope.)
- The credential JSON / B2B API response shape — tiers remain; only consumer *rendering*
  changes.
- No DB migration — `income_data` is existing JSONB.

---

## Files changed

| File | Change |
|---|---|
| `backend/app/routers/verification.py` | New `POST /intl/funds` endpoint + `_ai_extract_intl_funds` helper |
| `backend/app/routers/credentials.py` | `issue_mine` reads `funds_coverage` → emits claim |
| `backend/app/services/credential.py` | Evidence PDF: plain-language assurance mapping |
| `frontend/app/c/[credential_id]/page.tsx` | Plain-language claim rows; drop tier-word/amber badges |
| `backend/tests/test_intl_rails.py` | Unit tests: extraction, banding, flags, source strength |
| `backend/tests_integration/test_intl_identity.py` (or new) | `/intl/funds` happy + edge paths; `issue_mine` funds claim; verify-page mapping |

---

## Rejected alternatives

- **Open Banking AIS (GoCardless / Tink / etc.):** strongest signal, but requires a
  commercial data-processor in the sensitive-data path or AISP licensing. Rejected on the
  "no commercial intermediary / no licensing" constraint. EUDI Wallet (state-issued,
  offline-verified VC) is the deferred replacement once live.
- **Visa / titre de séjour as a solvency signal:** floor-only (proves the minimum, not
  capacity), stale (issuance-time snapshot), and inherently nationality-coupled (EU
  students hold no visa) — which violates the "same tiers for everyone" principle and lands
  on the Code pénal 225-1/225-2 discrimination boundary. Rejected.
- **Income-based banding for students:** the shipped `/intl/solvency` rail; measures the
  wrong axis (students have funds, not salary). Kept for salaried applicants, not extended
  to students.
- **Collapsing all assurance to a single "Verified ✓":** frictionless but recreates the
  fake-trust-badge problem the product exists to solve, and destroys the dispute-evidence
  and B2B-pricing value of precise tiers. Rejected in favour of plain-language-per-claim.
