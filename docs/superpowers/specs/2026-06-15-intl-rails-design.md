# INTL Rails — Design Spec (Item 11)

**Date:** 2026-06-15  
**Status:** Approved — ready for implementation plan  
**Scope:** INTL MEDIUM rail (web MRZ-OCR + face-match + FX-normalised solvency). INTL HIGH (NFC chip / Passive Auth) deferred — blocked on CSCA master list.

---

## 1. Problem & constraints

Roomivo's verification layer is FR-only today. Non-FR users (passport holders, foreign income earners) have no verification path, blocking them from the anti-scam credential entirely.

**Non-negotiable constraints (from DOSSIER §1 + §4):**

- Rail selected by **documents held**, never by nationality or immigration status (art. 225-1/225-2 Code pénal).
- INTL MEDIUM can never emit `identity_assurance: "HIGH"` — web path cannot do Passive Auth.
- MRZ nationality field extracted internally (for checksum) but **never stored** in `identity_data` or the credential (GDPR art. 9 — national origin inference).
- INTL solvency credential carries Décret 2015-1437 disclaimer: foreign income docs not enumerated in loi 89 art. 22-2 exhaustive list; advisory only.
- FX margin labelled as `"currency volatility buffer"`, never as a nationality-based penalty.
- Raw amounts (foreign or EUR) discarded after ratio band computed — data minimisation.
- `income_period` normalised before ratio calculation: annual → ÷12; unknown → conservative (no division); present as "fiscal capacity" not "monthly net income" (SV-8 analog).
- `monthly_rent` accepted as optional form field on `/intl/solvency`; if absent, ratio stored as `"income_only"` with no rent comparator.
- Every step has a plan B: no external service dependency can block a user from getting a result.

---

## 2. Endpoints

Three new routes under `/verification/intl/`. Dedicated endpoints so the INTL path is independently evolvable and the FR path (mature, tested) stays untouched.

| Endpoint | Method | Purpose |
|---|---|---|
| `POST /verification/intl/identity/upload` | multipart/form-data | Passport scan → MRZ extract + checksum + AI field extraction → store for face-match |
| `POST /verification/intl/identity/selfie` | multipart/form-data | Live selfie → face-match against stored passport → emit MEDIUM identity credential |
| `POST /verification/intl/solvency` | multipart/form-data | Foreign income doc → AI extract → FX normalise → banded solvency ratio → MEDIUM credential |

All three are stateless (verify-and-forget). `/intl/identity/upload` stores the passport image in Redis (10-min TTL) with R2 fallback — identical pattern to the FR front+selfie flow (PR #4). Document is purged in the `finally` block of `/intl/identity/selfie` regardless of face-match outcome.

---

## 3. New service: `app/services/mrz.py`

Pure function, no DB access. Called only by `/intl/identity/upload`.

### 3.1 MRZResult dataclass

```python
@dataclass
class MRZResult:
    surname: str
    given_names: str
    doc_number: str
    dob: str           # YYMMDD
    expiry: str        # YYMMDD
    mrz_valid: bool
    rescan_required: bool
    assurance: str     # always "MEDIUM" — hard-coded, never "HIGH"
    extraction_path: str  # "ai" | "tesseract" | "ai+tesseract"
    # nationality: intentionally absent — never stored
```

### 3.2 `extract_mrz(image_bytes, content_type) → MRZResult`

**Pass 1 — AI (Gemini):**
- Prompt requests `mrz_line1` (44 chars, TD3), `mrz_line2` (44 chars), plus parsed fields.
- Run `_validate_checksums(line1, line2)` — pure Python mod-10 on doc_number (chars 0–8 + check digit 9), DOB (chars 13–18 + check 19), expiry (chars 21–26 + check 27), composite (chars 0–9 + 13–43 + check digit 43).
- If all checksums pass → return result, `extraction_path: "ai"`.

**Pass 2 — Tesseract fallback (triggered if AI lines empty or any checksum fails):**
- `pytesseract.image_to_string(img, config="--psm 6 --oem 1 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<")`
- Extract line1/line2 from raw output (regex: two consecutive 44-char MRZ-format lines).
- Re-run `_validate_checksums`.
- If pass → return result, `extraction_path: "ai+tesseract"` (or `"tesseract"` if AI returned nothing).

**Both fail:**
- Return `MRZResult(mrz_valid=False, rescan_required=True, assurance="MEDIUM", ...)`.
- Endpoint returns HTTP 422 with code `MRZ_CHECKSUM_FAIL` and bilingual message prompting rescan.

**Assurance guard:**
- `assurance` field is set to `"MEDIUM"` unconditionally in the constructor — no code path can override it to `"HIGH"`. This is the mechanical enforcement of ID-5 (web NFC impossible) and ID-7 (chipless passport).

### 3.3 `_validate_checksums(line1, line2) → bool`

Pure Python mod-10 Luhn per ICAO Doc 9303 Part 3:
- Weight sequence: 7, 3, 1 (cyclic).
- Characters mapped: `<` → 0, A–Z → 10–35, 0–9 → face value.
- Validates 4 check digits: doc_number, DOB, expiry, composite.
- Returns `True` only if all 4 pass.

---

## 4. New service: `app/services/fx_normalise.py`

Pure function, Redis for cache. Called only by `/intl/solvency`.

### 4.1 FXResult dataclass

```python
@dataclass
class FXResult:
    eur_amount: float | None    # None if fx_source == "unavailable"
    currency: str               # ISO 4217
    rate: float | None
    margin_applied: float       # 0.05
    fx_source: str              # "live" | "static" | "unavailable"
    fx_margin_label: str        # "currency volatility buffer" — always this string
```

### 4.2 `convert_to_eur(amount, currency_code) → FXResult`

**Step 1 — Redis cache:**
- Key: `fx_rate:{currency_code}:{today}` (date in YYYY-MM-DD).
- Cache hit → use stored rate, `fx_source: "live"` or `"static"` (store source alongside rate).

**Step 2 — Frankfurter (ECB-backed, free):**
- `GET https://api.frankfurter.app/latest?from={currency}&to=EUR`, 5 s timeout.
- On success → store in Redis (TTL 86 400 s) with `source: "live"` → apply 5 % margin.
- On failure (timeout, 4xx, 5xx) → fall through to Step 3.

**Step 3 — Static table:**
- 29 currencies, rates updated quarterly in code:
  USD, GBP, CHF, CAD, AUD, SEK, NOK, DKK, PLN, CZK, HUF, RON,
  MAD, DZD, TND,
  INR, PKR, BDT, LKR, NPR,
  VND, PHP, IDR, THB, MYR, SGD,
  CNY, JPY, KRW.
- Store in Redis with `source: "static"` for the rest of the day.
- `fx_source: "static"`.

**Step 4 — Unavailable:**
- Currency not in static table OR static table unreachable (shouldn't happen, it's in-process).
- Return `FXResult(eur_amount=None, fx_source="unavailable")`.
- Endpoint stores `solvency_assurance: "UNVERIFIED"` — user receives result immediately, never blocked.

**Margin application:**
- `eur_amount = converted_amount × 0.95` — applied at every step where a rate exists.
- `fx_margin_label` always `"currency volatility buffer"` — never varies by currency or country.

### 4.3 Ratio banding after conversion

After `convert_to_eur`, the endpoint computes `solvency_ratio = eur_amount / monthly_rent` (monthly_rent from the user's active listing if present, else stored in session). Ratio is banded:

| Computed ratio | Band stored |
|---|---|
| ≥ 3.0 | `">=3.0"` |
| ≥ 2.0 | `">=2.0"` |
| < 2.0 | `"<2.0"` |

Raw `eur_amount`, raw foreign amount, and the intermediate rate are **discarded** after banding. Only the band, `income_currency`, `fx_source`, and `fx_margin_applied` are stored.

---

## 5. Stored shapes (stateless, verify-and-forget)

### `identity_data` after `/intl/identity/selfie` completes

```json
{
  "verified": true,
  "identity_assurance": "MEDIUM",
  "identity_rail": "INTL",
  "mrz_valid": true,
  "verified_at": "2026-06-15T12:00:00",
  "verification_method": "mrz_selfie",
  "status": "verified"
}
```

No nationality, no doc number, no DOB.

### `income_data` after `/intl/solvency` completes

```json
{
  "verified": true,
  "solvency_assurance": "MEDIUM",
  "solvency_ratio": ">=3.0",
  "income_currency": "INR",
  "fx_source": "live",
  "fx_margin_applied": 0.05,
  "fx_margin_label": "currency volatility buffer",
  "income_period": "annual",
  "income_period_normalised": "monthly",
  "income_period_unclear": false,
  "décret_2015_1437_disclaimer": true,
  "status": "verified"
}
```

No raw EUR amount, no raw foreign amount.

### Credential `claims` for INTL user

```json
{
  "identity_verified": true,
  "identity_assurance": "MEDIUM",
  "identity_rail": "INTL",
  "solvency_ratio": ">=3.0",
  "solvency_assurance": "MEDIUM",
  "solvency_disclaimer": "foreign_income_doc_advisory"
}
```

---

## 6. Edge cases

| # | Trigger | Response | Endpoint |
|---|---|---|---|
| ID-5 | Web path, any passport | `assurance: "MEDIUM"` hard-coded — no path emits HIGH | `/intl/identity/upload` |
| ID-6 | MRZ checksum fails after AI + Tesseract | 422 `MRZ_CHECKSUM_FAIL`, bilingual rescan prompt | `/intl/identity/upload` |
| ID-7 | Passport without chip (older book) | MRZ parsed normally → MEDIUM, labelled — user not blocked | `/intl/identity/upload` |
| ID-8 | Liveness spoof (photo-of-photo / replay) | Inherited gap from FR rail: AI face-match rejects obvious spoofs; true replay detection 🟡 — pre-existing, not regressed | `/intl/identity/selfie` |
| ID-9 | Non-Latin name in profile (Arabic, Chinese, Devanagari…) | MRZ is always Latin (ICAO). Fuzzy match will fail on non-Latin `full_name` → flag `name_transliteration_mismatch: true`, MEDIUM still granted, advisory note. Never block — user self-selected this rail. | `/intl/identity/upload` |
| SV-5 | Foreign income doc | FX normalised → MEDIUM + Décret 2015-1437 disclaimer | `/intl/solvency` |
| SV-6 | FX margin | 5 % applied, `fx_margin_label: "currency volatility buffer"` | `/intl/solvency` |
| SV-7 | Income just under 3.0 threshold after margin | Band honestly to `">=2.0"` — never round up. Banding applied to post-margin figure only. | `/intl/solvency` |
| SV-8 analog | Foreign doc shows annual figure | AI extracts `income_period: "monthly"\|"annual"\|"unknown"`. Annual → ÷12. Unknown → `income_period_unclear: true`, no division (conservative). Present as "fiscal capacity" not "monthly net income". | `/intl/solvency` |
| FX API down + in static table | Frankfurter timeout | `fx_source: "static"`, proceeds normally | `/intl/solvency` |
| FX API down + not in table | No rate available | `fx_source: "unavailable"`, `solvency_assurance: "UNVERIFIED"`, user not blocked | `/intl/solvency` |
| `compare_faces` exception | Any error | `finally` block purges stored passport (Redis/R2) before propagating — GDPR guarantee | `/intl/identity/selfie` |
| Expired passport | `expiry` before today | 422 `PASSPORT_EXPIRED`, bilingual message | `/intl/identity/upload` |
| Name mismatch (MRZ vs profile, Latin match) | Surname/given_names differ after fuzzy match | Flag `name_mismatch: true`, MEDIUM still granted — advisory, not block (same pattern as FR avis cross-check) | `/intl/identity/upload` |

---

## 7. Testing

### Unit: `backend/tests/test_intl_rails.py`

- `TestMRZChecksum`: valid TD3 lines → pass; single digit corrupted → fail; both AI and Tesseract fail → `rescan_required: True`
- `TestMRZAssuranceGuard`: `extract_mrz` return value can never have `assurance != "MEDIUM"`
- `TestMRZNationalityAbsent`: `MRZResult` has no `nationality` attribute; raw AI response nationality never surfaces in returned dict
- `TestFXLivePath`: Frankfurter mocked → `fx_source: "live"`, margin applied, ratio banded
- `TestFXStaticFallback`: Frankfurter timeout → static table used → `fx_source: "static"`
- `TestFXUnknownCurrency`: currency not in table, API down → `fx_source: "unavailable"`, `solvency_assurance: "UNVERIFIED"`
- `TestFXMarginLabel`: `fx_margin_label` always exactly `"currency volatility buffer"` regardless of currency
- `TestRatioBanding`: amounts at 2.9, 3.0, 2.0, 1.9 → correct bands; post-margin 2.97 bands to `">=2.0"` not `">=3.0"` (SV-7 honest banding)
- `TestIncomePeriodNormalisation`: annual figure ÷12; monthly unchanged; unknown → no division, `income_period_unclear: true`
- `TestNameTransliterationFlag`: non-Latin `full_name` → `name_transliteration_mismatch: true`, MEDIUM still granted

### Integration: `backend/tests_integration/test_intl_identity.py`

- `/intl/identity/upload` valid passport → 200, `status: "document_uploaded"`, no nationality in `identity_data`
- `/intl/identity/upload` MRZ checksum fail → 422 `MRZ_CHECKSUM_FAIL`
- `/intl/identity/upload` expired passport → 422 `PASSPORT_EXPIRED`
- `/intl/identity/selfie` face match → 200, `identity_assurance: "MEDIUM"`, `identity_rail: "INTL"`, no raw PII in DB
- `/intl/identity/selfie` face mismatch → 422, passport doc purged from storage
- `/intl/identity/selfie` `compare_faces` exception → 500, passport doc purged (GDPR)
- `/intl/solvency` INR income → `solvency_assurance: "MEDIUM"`, `fx_source` present, no raw amounts in DB
- `/intl/solvency` unknown currency + Frankfurter down → `solvency_assurance: "UNVERIFIED"`, 200 (not blocked)

---

## 8. Out of scope

- **INTL HIGH** (NFC chip / BAC-PACE / Passive Auth) — deferred, blocked on CSCA master list assembly (§11 DOSSIER).
- **SVAIR equivalent for INTL** — no foreign tax-authority recency API at €0; deferred.
- **FX rate audit trail** — rate snapshot stored as `fx_source` only; no rate history. Add if compliance requires it.
- **Non-TD3 formats** (TD1 ID cards, TD2) — MRZ parser targets TD3 (passport booklet) only. Extend in a later pass.

---

## 9. Dependencies

| Dependency | Already in requirements? | Notes |
|---|---|---|
| `pytesseract` | Check — used for lease parse | If absent, add + `tesseract-ocr` system dep |
| `httpx` | Yes (used in verification router) | For Frankfurter call |
| Redis cache | Yes (PR #4) | FX rate cache reuses existing `cache` layer |
| Gemini AI client | Yes | MRZ primary extraction |
