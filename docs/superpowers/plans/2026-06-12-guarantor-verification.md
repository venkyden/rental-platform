# Guarantor Verification — Implementation Plan

Date: 2026-06-12. Branch: `feat/guarantor-verification`.
Spec: `docs/superpowers/specs/2026-06-12-guarantor-verification-design.md`.

---

## Task 1 — Pure `guarantor_compliance.py` service + unit tests

**Files:**
- CREATE `backend/app/services/guarantor_compliance.py`
- CREATE `backend/tests/test_guarantor_compliance.py`

**Deliverable:** pure, side-effect-free service.
- `GuarantorCertData`, `GuarantorWarning`, `GuarantorAssessment` dataclasses.
- `assess_guarantor_cert(cert_type, cert_data, expected_name, today)` logic:
  - Fuzzy name match (reuse `_fuzzy_name_match` from `employment.py` via import, or
    inline a simple difflib ratio — do NOT import from `employment.py` to avoid coupling).
  - Expiry check: `cert_data.validity_date is not None and cert_data.validity_date < today`.
  - Produce `warnings` list; no DB access.
- 8 unit tests (see spec §E).
- **Verify:** `cd backend && python -m pytest tests/test_guarantor_compliance.py -v` all pass.

---

## Task 2 — AI extraction method + endpoint rewrites

**Files:**
- MODIFY `backend/app/services/employment.py` (add `extract_guarantor_cert` method)
- MODIFY `backend/app/routers/verification.py` (update Visale + Garantme endpoints,
  add physical submit endpoint, update status response)

**Deliverable:**
1. `employment_service.extract_guarantor_cert(file_content, file_type, cert_type)` — new
   async method, dedicated AI prompt, returns `Optional[GuarantorCertData]`.
2. `POST /guarantor/visale` — uses new extractor + `assess_guarantor_cert`; populates
   `visale_id`; stores `assurance`, `name_matched`, `guaranteed_amount`, `validity_date`,
   `warnings` in `guarantor_data`.
3. `POST /guarantor/garantme` — same, sets `garantme_ref`.
4. `POST /guarantor/physical/submit` — new endpoint; validates docs + consent; transitions
   to "submitted" + stores `assurance = "DOCUMENT_SUBMITTED"`.
5. `GET /verification/status` — adds `guarantor_assurance` to response.
- **Verify:** `cd backend && python -m pytest tests/test_verification_guarantor.py -v` all pass.
  Full suite: `python -m pytest -x --tb=short` green.

---

## Task 3 — Frontend physical submit + assurance display

**Files:**
- MODIFY `frontend/app/verify/guarantor/page.tsx`
- MODIFY `frontend/app/verification/page.tsx` (dashboard guarantor tab assurance badge)

**Deliverable:**
1. Physical submit button calls `POST /verification/guarantor/physical/submit` with
   `{ consent: consentChecked }`. Handle 400 errors. On success, show "submitted" status.
2. Status display: `guarantor_assurance` badge in both pages — amber "OCR verified" for
   MEDIUM, zinc "Documents on file" for DOCUMENT_SUBMITTED.
3. tsc clean.
- **Verify:** `cd frontend && npx tsc --noEmit` 0 errors.

---

## Task 4 — DOSSIER update + i18n parity

**Files:**
- MODIFY `docs/features/trust-layer/DOSSIER.md` (§5.3 SV-3 → ✅, add "Done this pass")
- MODIFY `frontend/lib/i18n.ts` (any new keys added in Task 3)

**Deliverable:** DOSSIER §5.3 SV-3 row updated, "Done this pass" section added. i18n
keys in both EN and FR for any strings added in Task 3.
- **Verify:** grep for hardcoded EN-only strings in Task 3 changes; all i18n'd.

---

## Quality gate (after all tasks)

```
cd backend && python -m pytest -x --tb=short   # full suite green
cd frontend && npx tsc --noEmit                # 0 errors
```
