# Guarantor Verification — Design

**Phase 2, Item 11.** Date: 2026-06-12. Branch: `feat/guarantor-verification`.

## Problem

The guarantor flow has a skeleton that compiles and ships, but four critical gaps make
it **unreliable in production** and one (G-3) produces incorrect data that could corrupt
the solvency picture of a tenant dossier.

### Gap inventory

| # | File | Severity | Description |
|---|---|---|---|
| G-1 | `frontend/app/verify/guarantor/page.tsx` | 🔴 | Physical guarantor stuck at `"pending"` forever — submit button calls `checkAuth()` and redirects, no backend endpoint ever transitions the status. Users who go the physical route are silently abandoned. |
| G-2 | `backend/app/routers/verification.py` | 🔴 | `visale_id` / `garantme_ref` columns exist on the User model and are surfaced in the status response but are **never populated**. Landlords and dossier renderers checking those fields see `null` even after a successful Visale verification. |
| G-3 | `backend/app/services/employment.py` | 🔴 | Visale and Garantme certificates are piped through the **employment AI verifier** with a hacked prompt ("extract guaranteed amount as `net_salary`, institution as `employer_name`"). This uses the wrong struct, never extracts a `cert_id` or `validity_date`, and stores fabricated employment-shape data in `guarantor_data.extracted_data` — incorrect if the tenant's solvency is later derived from stored records. |
| G-4 | `backend/app/routers/verification.py` | 🟠 | No expiry check: a Visale certificate whose `validity_date` is in the past is accepted as `"verified"`. Visale validity is typically 1 year and tied to the specific lease offer. |
| G-5 | `backend/app/routers/verification.py` | 🟠 | No assurance tier on `guarantor_status`. DOSSIER §5.2 requires every verification output to carry an explicit assurance label. OCR-verified Visale/Garantme = MEDIUM; uploaded physical docs = DOCUMENT_SUBMITTED. |
| G-6 | `backend/app/routers/verification.py` | 🟡 | Name-on-certificate vs account name cross-check runs inside the employment verifier but the result is never stored as an explicit anti-fraud flag in `guarantor_data`. |

---

## Legal basis

- **No ORIAS / IDD required.** Roomivo does **not** sell, distribute, or earn commission
  on Visale or Garantme products. It verifies that the tenant *already holds* a certificate.
  This is document verification, not insurance distribution. See DOSSIER §8 for the
  GLI-removal rationale and the explicit carve-out for Visale/Garantme guarantor
  *verification* (allowed, stays).
- **Loi 89-462, art. 22-2 (ALUR):** landlord may request a guarantor dossier (identité,
  ressources, avis d'imposition, justif de domicile) only for a **physical** guarantor.
  For institutional guarantees (Visale, Garantme), the certificate itself is the
  credential — no additional dossier request is permitted.
- **GDPR / CNIL art. 5:** for physical guarantor documents, explicit consent of the data
  subject (the guarantor, not the tenant) is required. The UI already has a consent
  checkbox; the backend must record the consent timestamp.
- **Assurance labelling (DOSSIER §5.2):** OCR + AI extraction = MEDIUM. Never upgraded
  to HIGH. Physical documents submitted = DOCUMENT_SUBMITTED (no cryptographic proof).

---

## Decisions

1. **New pure service `guarantor_compliance.py`** — side-effect-free, injectable `today`,
   mirroring `dpe_compliance.py`. Produces facts only, never writes to DB.
2. **Dedicated AI extraction** for Visale/Garantme via a new method in `employment.py`
   (`extract_guarantor_cert`) — a focused prompt extracting `cert_id`/`cert_ref`,
   `guaranteed_amount`, `validity_date` (ISO), `tenant_name`, `institution`. Completely
   separate from employment extraction.
3. **Reject expired certificates** at verify time (400, bilingual error). This is not a
   platform over-reach — an expired Visale cert is legally worthless to the landlord.
4. **Physical guarantor submit endpoint** — `POST /verification/guarantor/physical/submit`
   transitions "pending" → "submitted". Documents are on file; assurance = DOCUMENT_SUBMITTED
   (landlord reviews them; Roomivo is not an employment verifier for third-party individuals).
5. **Assurance field in status response** — `guarantor_assurance: "MEDIUM" | "DOCUMENT_SUBMITTED" | null`.

---

## Design

### A. New pure service — `backend/app/services/guarantor_compliance.py`

```python
@dataclass
class GuarantorCertData:
    cert_id: Optional[str]         # Visale certificate number / Garantme reference
    guaranteed_amount: Optional[float]
    validity_date: Optional[date]  # ISO-parsed from AI extraction
    tenant_name: Optional[str]
    institution: Optional[str]

@dataclass
class GuarantorWarning:
    code: str         # CERT_EXPIRED | NAME_MISMATCH | AMOUNT_NOT_EXTRACTED | CERT_ID_NOT_EXTRACTED
    severity: str     # "error" | "info"
    en: str
    fr: str

@dataclass
class GuarantorAssessment:
    cert_ref: Optional[str]        # normalised cert ID/ref for storing in visale_id / garantme_ref
    guaranteed_amount: Optional[float]
    validity_date: Optional[date]
    assurance: str                 # "MEDIUM" always for OCR; caller sets "DOCUMENT_SUBMITTED"
    name_matched: bool
    name_match_score: float
    expired: bool
    warnings: list[GuarantorWarning]

def assess_guarantor_cert(
    cert_type: str,                # "visale" | "garantme"
    cert_data: GuarantorCertData,
    expected_name: str,            # current_user.full_name
    today: date,                   # injectable
) -> GuarantorAssessment: ...
```

Warning codes:
- `CERT_EXPIRED` — `validity_date < today`. Severity: error (blocks verify).
- `NAME_MISMATCH` — fuzzy score < 0.5. Severity: error (blocks verify for Visale — the
  Action Logement cert names a specific person; Garantme is the same). Anti-fraud flag stored.
- `AMOUNT_NOT_EXTRACTED` — `guaranteed_amount` is None. Severity: info (cert stored, field
  just missing; landlord can review the cert).
- `CERT_ID_NOT_EXTRACTED` — `cert_id` is None. Severity: info (cannot populate `visale_id`/
  `garantme_ref`, but cert still accepted).

### B. AI extraction method — `employment_service.extract_guarantor_cert(file_content, file_type, cert_type)`

Dedicated prompt:

```
You are extracting data from a French guarantee certificate ({cert_type}).
Return ONLY valid JSON:
{{
  "cert_id": "certificate number / reference visible on document",
  "guaranteed_amount": 1200.00,
  "validity_date": "YYYY-MM-DD or null",
  "tenant_name": "full name of the guaranteed tenant",
  "institution": "Visale / Action Logement / Garantme / etc."
}}
If a field is not visible, return null for that field.
```

Returns `Optional[GuarantorCertData]`. Failure → `None` (caller treats as unverified).

This method is **purely additive** to `employment.py` — existing extraction logic is
untouched. Visale/Garantme cert verification endpoints stop calling `verify_document` and
call `extract_guarantor_cert` instead.

### C. Endpoint updates — `backend/app/routers/verification.py`

**`POST /verification/guarantor/visale`** (existing, updated):
1. Call `employment_service.extract_guarantor_cert(content, content_type, "visale")`.
2. If extraction returns `None` → 422 "Could not read the certificate".
3. Call `assess_guarantor_cert("visale", cert_data, current_user.full_name, date.today())`.
4. If any warning with `severity == "error"` → 422, detail = bilingual warning messages.
5. Store watermarked cert.
6. Set `current_user.visale_id = assessment.cert_ref` (if not None).
7. `current_user.guarantor_data = {... "assurance": "MEDIUM", "name_matched": ..., "name_match_score": ..., "guaranteed_amount": ..., "validity_date": ..., "warnings": [...]}`.
8. `current_user.guarantor_status = "verified"`.

**`POST /verification/guarantor/garantme`** (existing, updated): identical pattern,
sets `current_user.garantme_ref`.

**`POST /verification/guarantor/physical/submit`** (NEW):
- Checks `current_user.guarantor_type == "physical"`.
- Checks `current_user.guarantor_status == "pending"` and that 4 required docs are in
  `guarantor_data.files` (id_card, payslip, tax_assessment, proof_address).
- Accepts `consent: bool` in the request body (the GDPR consent from the UI checkbox).
- If consent is False → 400.
- Sets `current_user.guarantor_status = "submitted"`.
- Records `guarantor_data.consent_at`, `guarantor_data.assurance = "DOCUMENT_SUBMITTED"`.
- Returns `{ guarantor_status: "submitted", guarantor_assurance: "DOCUMENT_SUBMITTED" }`.

**`GET /verification/status`** (updated):
- Add `guarantor_assurance` field: read from `guarantor_data.assurance` if present, else `null`.

### D. Frontend — `frontend/app/verify/guarantor/page.tsx`

Physical guarantor submit button: call `POST /verification/guarantor/physical/submit`
with `{ consent: true }` (the checkbox is already there). Handle errors. On success,
show "submitted" status (not "verified" — the assurance is DOCUMENT_SUBMITTED).

Status display: show the `guarantor_assurance` badge alongside `guarantor_status`. Map:
- `"MEDIUM"` → amber chip "OCR verified"
- `"DOCUMENT_SUBMITTED"` → zinc chip "Documents on file"
- `null` → nothing

### E. Tests

`backend/tests/test_guarantor_compliance.py` (unit, pure function):
- Valid Visale cert, name matches, not expired → no error warnings, name_matched=True.
- Valid cert, name mismatch (score < 0.5) → NAME_MISMATCH error warning.
- Valid cert, validity_date yesterday → CERT_EXPIRED error warning.
- validity_date today → not expired (boundary).
- cert_id None → CERT_ID_NOT_EXTRACTED info warning, cert still valid (no error).
- guaranteed_amount None → AMOUNT_NOT_EXTRACTED info warning, cert still valid.
- Garantme cert: same expiry / name-match paths (parameterised, same service).

`backend/tests/test_verification_guarantor.py` (integration, new file):
- Visale verify: valid cert mock → 200, visale_id set, assurance MEDIUM.
- Visale verify: expired cert → 422.
- Visale verify: name mismatch → 422.
- Garantme verify: valid cert mock → 200, garantme_ref set.
- Physical submit: all 4 docs present, consent=True → 200, status "submitted".
- Physical submit: missing docs → 400.
- Physical submit: consent=False → 400.
- Status: guarantor_assurance present after verify.

---

## Out of scope

- Visale API direct validation (no public API; cert OCR is the only viable path).
- Garantme direct API integration (not a free/public API).
- Admin review workflow for physical guarantors (landlord reviews the dossier directly —
  that's the intended flow under loi 89 ALUR; Roomivo only certifies "documents on file").
- HIGH assurance guarantor path (would require the guarantor themselves to do an identity
  verification flow — out of scope for Phase 2).
- Solvency calculation from guaranteed amounts (the guaranteed amount is stored but not
  used to compute a solvency ratio — that conflation is exactly what G-3 introduced via
  the employment-service hack, and this design explicitly avoids it).
