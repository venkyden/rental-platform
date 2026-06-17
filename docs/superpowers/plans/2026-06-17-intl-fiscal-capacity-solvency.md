# INTL Fiscal-Capacity Solvency + Plain-Language Assurance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an international applicant prove banded *fiscal capacity* from funding documents (bank statement, scholarship, sponsorship, loan) into the credential, and render every claim to landlords in plain affirmative language instead of internal HIGH/MEDIUM tier words.

**Architecture:** A new self-contained `POST /verification/intl/funds` endpoint reuses the existing AI-extraction + `fx_normalise` pattern from `/intl/solvency`, writes a banded `funds_coverage` block into the existing `income_data` JSONB (no migration), and `issue_mine` emits it as a credential claim. The consumer-facing verify page and evidence PDF translate internal tiers to plain sentences; the credential JSON / B2B API response is unchanged.

**Tech Stack:** Python 3 / FastAPI, SQLAlchemy async, existing `app/services/fx_normalise.py`, Gemini extraction pattern, Ed25519 `credential_service`, Next.js 16 / React 19 frontend, reportlab PDF.

**Spec:** `docs/superpowers/specs/2026-06-17-intl-fiscal-capacity-solvency-design.md`

**Worktree (CLAUDE.md):** Before Task 1, create:
```bash
git worktree add ../rental-platform-intl-funds -b feat/intl-fiscal-capacity
cd ../rental-platform-intl-funds/backend
```
All paths below are relative to the repo root inside that worktree.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `backend/app/services/fx_normalise.py` | Banding helpers (pure functions) | Add `band_funds_coverage` |
| `backend/app/routers/verification.py` | INTL endpoints | Add `_ai_extract_intl_funds`, `_name_present`, `POST /intl/funds` |
| `backend/app/routers/credentials.py` | Credential assembly | `issue_mine` reads `funds_coverage` → claims |
| `backend/app/services/credential.py` | Evidence PDF | Plain-language assurance + funds row |
| `frontend/app/c/[credential_id]/page.tsx` | Consumer verify page | Plain-language claim rows, drop tier badges |
| `backend/tests/test_intl_rails.py` | Unit tests | Banding + name-match unit tests |
| `backend/tests/test_intl_identity.py` | Integration tests | `/intl/funds` paths + `issue_mine` funds claim |

---

## Task 1: `band_funds_coverage` banding helper

**Files:**
- Modify: `backend/app/services/fx_normalise.py` (after `band_solvency_ratio`, ~line 113)
- Test: `backend/tests/test_intl_rails.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_intl_rails.py`:

```python
class TestFundsCoverageBanding:
    def test_twelve_months_or_more(self):
        from app.services.fx_normalise import band_funds_coverage
        assert band_funds_coverage(12000.0, 1000.0) == "covers_12m_plus"

    def test_exactly_twelve_months(self):
        from app.services.fx_normalise import band_funds_coverage
        assert band_funds_coverage(12000.0, 1000.0) == "covers_12m_plus"

    def test_six_to_eleven_months(self):
        from app.services.fx_normalise import band_funds_coverage
        assert band_funds_coverage(6000.0, 1000.0) == "covers_6m"

    def test_three_to_five_months(self):
        from app.services.fx_normalise import band_funds_coverage
        assert band_funds_coverage(3000.0, 1000.0) == "covers_3m"

    def test_under_three_months(self):
        from app.services.fx_normalise import band_funds_coverage
        assert band_funds_coverage(2000.0, 1000.0) == "covers_under_3m"

    def test_zero_or_negative_rent_returns_amount_only(self):
        from app.services.fx_normalise import band_funds_coverage
        assert band_funds_coverage(5000.0, 0.0) == "amount_only"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intl_rails.py::TestFundsCoverageBanding -v`
Expected: FAIL with `ImportError: cannot import name 'band_funds_coverage'`

- [ ] **Step 3: Write minimal implementation**

In `backend/app/services/fx_normalise.py`, immediately after the `band_solvency_ratio` function (the line `    return "<2.0"`):

```python
def band_funds_coverage(eur_funds: float, monthly_rent: float) -> str:
    """Band available funds by months of rent covered. Never round up.

    Mirrors band_solvency_ratio's floor-not-ceiling discipline: a value on the
    boundary lands in the band it meets, never the one above.
    """
    if not monthly_rent or monthly_rent <= 0:
        return "amount_only"
    months = eur_funds / monthly_rent
    if months >= 12:
        return "covers_12m_plus"
    if months >= 6:
        return "covers_6m"
    if months >= 3:
        return "covers_3m"
    return "covers_under_3m"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intl_rails.py::TestFundsCoverageBanding -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/fx_normalise.py backend/tests/test_intl_rails.py
git commit -m "feat(fx): add band_funds_coverage helper for fiscal-capacity rail"
```

---

## Task 2: `_name_present` anti-fraud helper

**Files:**
- Modify: `backend/app/routers/verification.py` (in the INTL rails section, after `_ai_extract_intl_income`, ~line 1705)
- Test: `backend/tests/test_intl_rails.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_intl_rails.py`:

```python
class TestNamePresent:
    def test_exact_match_true(self):
        from app.routers.verification import _name_present
        assert _name_present("Priya Sharma", "Priya Sharma") is True

    def test_shared_surname_true(self):
        # Sponsor doc names the student among other text
        from app.routers.verification import _name_present
        assert _name_present("Priya Sharma", "Account holder: Sharma, Priya R.") is True

    def test_no_overlap_false(self):
        from app.routers.verification import _name_present
        assert _name_present("Priya Sharma", "Account holder: John Smith") is False

    def test_empty_doc_name_false(self):
        from app.routers.verification import _name_present
        assert _name_present("Priya Sharma", None) is False

    def test_empty_user_name_false(self):
        from app.routers.verification import _name_present
        assert _name_present("", "Priya Sharma") is False

    def test_ignores_short_tokens(self):
        # single-letter / 1-char tokens must not create false matches
        from app.routers.verification import _name_present
        assert _name_present("A B", "Zoe Q") is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intl_rails.py::TestNamePresent -v`
Expected: FAIL with `ImportError: cannot import name '_name_present'`

- [ ] **Step 3: Write minimal implementation**

In `backend/app/routers/verification.py`, immediately after the `_ai_extract_intl_income` function (after its final `return None`):

```python
def _name_present(user_full_name: str, document_name: str | None) -> bool:
    """MEDIUM-grade anti-fraud flag: does the applicant's name appear on the doc?

    For self-funds the applicant is the account holder; for sponsor-funds the
    applicant should appear as the named beneficiary. Token-overlap check only —
    this raises a flag, never an assurance tier.
    """
    if not user_full_name or not document_name:
        return False

    def _tokens(s: str) -> set:
        return {t for t in "".join(c.lower() if c.isalnum() else " " for c in s).split() if len(t) >= 2}

    return bool(_tokens(user_full_name) & _tokens(document_name))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intl_rails.py::TestNamePresent -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/verification.py backend/tests/test_intl_rails.py
git commit -m "feat(intl): add _name_present anti-fraud helper"
```

---

## Task 3: `_ai_extract_intl_funds` extraction helper

**Files:**
- Modify: `backend/app/routers/verification.py` (after `_name_present`)
- Test: `backend/tests/test_intl_rails.py`

This mirrors `_ai_extract_intl_income` exactly (same Gemini client bootstrap, same model fallback, same markdown-fence stripping) but with a funding-document prompt. The unit test only covers the no-client short-circuit (the AI call itself is exercised via the integration tests in Task 4 with the function patched).

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_intl_rails.py`:

```python
class TestIntlFundsExtraction:
    def test_no_ai_client_returns_none(self):
        import asyncio
        from app.routers.verification import _ai_extract_intl_funds
        # ai_client=None and no GEMINI_API_KEY configured in test env → None
        result = asyncio.get_event_loop().run_until_complete(
            _ai_extract_intl_funds(b"fake", "image/jpeg", ai_client=None)
        )
        assert result is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intl_rails.py::TestIntlFundsExtraction -v`
Expected: FAIL with `ImportError: cannot import name '_ai_extract_intl_funds'`

- [ ] **Step 3: Write minimal implementation**

In `backend/app/routers/verification.py`, immediately after `_name_present`:

```python
async def _ai_extract_intl_funds(
    file_content: bytes, content_type: str, ai_client=None
) -> Optional[dict]:
    """Extract fiscal-capacity data from a funding document via Gemini AI.

    Covers bank statements, scholarship/sponsorship letters, and loan approvals.
    """
    prompt = (
        "Extract funding/fiscal-capacity data from this document "
        "(bank statement, scholarship award letter, sponsorship letter, or "
        "education loan approval).\n\n"
        "Return ONLY this JSON — no markdown:\n"
        '{"funds_amount": <number or null>, "funds_currency": "<ISO 4217>", '
        '"coverage_period_months": <number or null>, '
        '"beneficiary_name": "<name or null>", '
        '"issuer": "<bank/awarding body/sponsor/lender or null>"}\n\n'
        "Rules:\n"
        "- funds_amount: total available balance, awarded amount, sponsored sum, "
        "or sanctioned loan amount\n"
        "- funds_currency: must be ISO 4217 (INR, USD, GBP, CNY, EUR, etc.)\n"
        "- coverage_period_months: for time-bounded funding (scholarship/loan/"
        "sponsorship) the number of months it covers; null for a bank balance\n"
        "- beneficiary_name: the person who holds or receives the funds\n"
        "- Return null for funds_amount if you cannot determine it"
    )
    try:
        from google import genai as _genai
        from google.genai import types as _types
        from app.core.config import settings

        client = ai_client
        if client is None and getattr(settings, "GEMINI_API_KEY", None):
            client = _genai.Client(api_key=settings.GEMINI_API_KEY)
        if client is None:
            return None

        image_part = _types.Part.from_bytes(data=file_content, mime_type=content_type)
        for model in ("gemini-2.0-flash", "gemini-1.5-flash"):
            try:
                response = client.models.generate_content(
                    model=model, contents=[image_part, prompt]
                )
                import json as _json
                text = response.text.strip()
                if text.startswith("```"):
                    text = text.split("```")[1].lstrip("json").strip()
                return _json.loads(text)
            except Exception as _exc:
                logger.warning("AI intl funds extraction (%s) failed: %s", model, _exc)
    except Exception as _exc:
        logger.error("_ai_extract_intl_funds crashed: %s", _exc)
    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intl_rails.py::TestIntlFundsExtraction -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/verification.py backend/tests/test_intl_rails.py
git commit -m "feat(intl): add _ai_extract_intl_funds extraction helper"
```

---

## Task 4: `POST /verification/intl/funds` endpoint

**Files:**
- Modify: `backend/app/routers/verification.py` (after the `/intl/solvency` endpoint, ~line 2062)
- Test: `backend/tests/test_intl_identity.py`

The endpoint reads the funding document, FX-normalises, bands, computes flags, writes `income_data["funds_coverage"]` (merged, not replacing existing income solvency), discards the doc, and bumps trust only if the user had no prior verified solvency.

- [ ] **Step 1: Write the failing tests**

First inspect the existing `make_intl_client` / mock-user helper at the top of `backend/tests/test_intl_identity.py` and reuse it. Append:

```python
# ── POST /verification/intl/funds ──────────────────────────────────────────────

def _mock_user_id_verified():
    from tests.conftest import make_mock_user
    u = make_mock_user("tenant")
    u.identity_verified = True
    u.full_name = "Priya Sharma"
    u.income_verified = False
    u.income_data = None
    u.trust_score = 50
    # set the JSONB attrs _build_claims_for_user reads, so MagicMock auto-attrs
    # don't leak into claim assembly (Task 5)
    u.identity_data = {"identity_assurance": "MEDIUM"}
    u.ownership_data = None
    u.insurance_data = None
    return u


def _intl_client_for(user):
    from app.main import app
    from app.core.database import get_db
    from app.routers.auth import get_current_user
    from tests.conftest import mock_get_db
    from fastapi.testclient import TestClient
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: user
    target_app.dependency_overrides[get_db] = mock_get_db
    return target_app, TestClient(app)


class TestIntlFunds:
    def _patches(self, extraction):
        from unittest.mock import AsyncMock, patch
        return [
            patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()),
            patch("app.routers.verification._ai_extract_intl_funds",
                  new=AsyncMock(return_value=extraction)),
            patch("app.routers.verification.cache"),
        ]

    def test_self_bank_statement_funds_covers_12m(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 13000.0, "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "Revolut",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        body = resp.json()
        assert body["funds_band"] == "covers_12m_plus"
        assert body["funds_source"] == "self"
        assert body["source_strength"] == "proof"
        assert body["assurance"] == "MEDIUM"
        assert user.income_data["funds_coverage"]["funds_band"] == "covers_12m_plus"
        assert user.income_data["funds_coverage"]["flags"]["name_present"] is True
        # bank statement has no duration → null, never False
        assert user.income_data["funds_coverage"]["flags"]["duration_covers_lease"] is None

    def test_sponsor_loan_is_promise_and_duration_flag(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 8000.0, "funds_currency": "EUR",
            "coverage_period_months": 6,
            "beneficiary_name": "Priya Sharma", "issuer": "HDFC Credila",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "loan_approval", "funds_source": "sponsor",
                          "monthly_rent": "1000", "lease_months": "12"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        body = resp.json()
        assert body["source_strength"] == "promise"
        # 6 months funding < 12 month lease → flag False
        assert user.income_data["funds_coverage"]["flags"]["duration_covers_lease"] is False

    def test_fx_unavailable_returns_unverified(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 500000.0, "funds_currency": "XYZ",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "Bank",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        assert resp.json()["assurance"] == "UNVERIFIED"

    def test_name_mismatch_sets_flag_false(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 13000.0, "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "John Smith", "issuer": "Revolut",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        assert user.income_data["funds_coverage"]["flags"]["name_present"] is False

    def test_no_rent_gives_amount_only(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 13000.0, "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "Revolut",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        assert resp.json()["funds_band"] == "amount_only"

    def test_extraction_failure_returns_422(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(None):  # extraction returns None
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_intl_identity.py::TestIntlFunds -v`
Expected: FAIL with 404 (endpoint not registered yet)

- [ ] **Step 3: Write the endpoint**

In `backend/app/routers/verification.py`, immediately after the `/intl/solvency` endpoint's final `return {...}` block (~line 2062), add:

```python
@router.post("/intl/funds")
async def upload_intl_funds_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),   # bank_statement|scholarship_letter|sponsorship_letter|loan_approval
    funds_source: str = Form(...),    # self|sponsor
    monthly_rent: Optional[float] = Form(None),
    lease_months: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foreign funding doc -> FX-normalised banded fiscal capacity -> MEDIUM.

    Document discarded after banding (verify-and-forget). Never inflates to HIGH.
    """
    from app.services.fx_normalise import convert_to_eur, band_funds_coverage

    if not current_user.identity_verified:
        raise HTTPException(
            status_code=400,
            detail=(
                "Vérifiez d'abord votre identité. / "
                "Identity verification required before funds check."
            ),
        )

    valid_types = {"bank_statement", "scholarship_letter", "sponsorship_letter", "loan_approval"}
    if document_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid document_type: {document_type}")
    if funds_source not in {"self", "sponsor"}:
        raise HTTPException(status_code=400, detail=f"Invalid funds_source: {funds_source}")

    allowed = {"image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
    await _validate_file_size(file)
    await _check_upload_rate_limit(str(current_user.id), "intl_funds")
    content = await file.read()

    extraction = await _ai_extract_intl_funds(content, file.content_type or "image/jpeg")
    if not extraction or extraction.get("funds_amount") is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Impossible d'extraire les fonds du document. / "
                "Could not extract funds from document."
            ),
        )

    raw_amount = float(extraction["funds_amount"])
    currency = str(extraction.get("funds_currency", "EUR")).upper()
    coverage_period = extraction.get("coverage_period_months")
    beneficiary_name = extraction.get("beneficiary_name")

    fx = await convert_to_eur(raw_amount, currency)

    if fx.eur_amount is not None:
        funds_band = band_funds_coverage(fx.eur_amount, monthly_rent or 0.0)
        funds_assurance = "MEDIUM"
    else:
        funds_band = "unavailable"
        funds_assurance = "UNVERIFIED"

    source_strength = "proof" if document_type == "bank_statement" else "promise"

    # duration flag: only meaningful for time-bounded funding with a known lease term
    if coverage_period is not None and lease_months:
        duration_flag = int(coverage_period) >= int(lease_months)
    else:
        duration_flag = None  # N/A (bank balance, or lease term unknown) — never False

    name_present = _name_present(current_user.full_name or "", beneficiary_name)

    # had a verified solvency signal already? (income rail OR a prior MEDIUM funds block)
    prior = current_user.income_data or {}
    prior_funds = prior.get("funds_coverage") or {}
    had_solvency = bool(current_user.income_verified) or prior_funds.get("assurance") == "MEDIUM"

    new_income = dict(prior)
    new_income["funds_coverage"] = {
        "funds_band": funds_band,
        "funds_source": funds_source,
        "document_type": document_type,
        "source_strength": source_strength,
        "assurance": funds_assurance,
        "flags": {"name_present": name_present, "duration_covers_lease": duration_flag},
        "fx_source": fx.fx_source,
        "fx_margin_applied": fx.margin_applied,
        "fx_margin_label": fx.fx_margin_label,
        "upload_date": naive_utcnow().isoformat(),
        # raw eur_amount and raw foreign amount intentionally NOT stored
    }
    current_user.income_data = new_income

    if funds_assurance == "MEDIUM" and not had_solvency:
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 20))
        )

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Capacité fiscale vérifiée / Fiscal capacity verified",
        "funds_band": funds_band,
        "funds_source": funds_source,
        "source_strength": source_strength,
        "assurance": funds_assurance,
        "fx_source": fx.fx_source,
        "trust_score": current_user.trust_score,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_intl_identity.py::TestIntlFunds -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/verification.py backend/tests/test_intl_identity.py
git commit -m "feat(intl): add POST /intl/funds fiscal-capacity endpoint"
```

---

## Task 5: `issue_mine` emits the `funds_coverage` claim

**Files:**
- Modify: `backend/app/routers/credentials.py:298-310` (the claim-assembly block in `issue_mine`)
- Test: `backend/tests/test_intl_identity.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_intl_identity.py`:

```python
class TestIssueMineFundsClaim:
    def test_medium_funds_emitted(self):
        from app.routers.credentials import issue_mine  # noqa: F401 (import sanity)
        from app.routers.credentials import _build_claims_for_user
        user = _mock_user_id_verified()
        user.income_data = {
            "funds_coverage": {
                "funds_band": "covers_12m_plus", "funds_source": "sponsor",
                "assurance": "MEDIUM",
            }
        }
        claims = _build_claims_for_user(user)
        assert claims["funds_coverage_band"] == "covers_12m_plus"
        assert claims["funds_coverage_source"] == "sponsor"
        assert claims["funds_coverage_assurance"] == "MEDIUM"

    def test_unverified_funds_not_emitted(self):
        from app.routers.credentials import _build_claims_for_user
        user = _mock_user_id_verified()
        user.income_data = {"funds_coverage": {"funds_band": "unavailable", "assurance": "UNVERIFIED"}}
        claims = _build_claims_for_user(user)
        assert "funds_coverage_band" not in claims
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intl_identity.py::TestIssueMineFundsClaim -v`
Expected: FAIL with `ImportError: cannot import name '_build_claims_for_user'`

- [ ] **Step 3: Extract the claim-builder and add the funds claim**

In `backend/app/routers/credentials.py`, replace the inline claim assembly inside `issue_mine` (lines 298-327, from `identity_data = current_user.identity_data or {}` through the MRH block) by **extracting it into a module-level helper** and calling it. Add this function above `issue_mine`:

```python
def _build_claims_for_user(current_user) -> dict:
    """Assemble banded claims from the user's verified state. Never inflates."""
    identity_data = current_user.identity_data or {}
    income_data = current_user.income_data or {}
    ownership_data = current_user.ownership_data or {}

    identity_assurance = identity_data.get("identity_assurance", "UNVERIFIED")
    solvency_assurance = income_data.get("solvency_assurance", "UNVERIFIED")
    solvency_ratio = income_data.get("solvency_ratio")

    claims: dict = {"identity_assurance": identity_assurance}

    if solvency_ratio and solvency_assurance != "UNVERIFIED":
        claims["solvency_ratio"] = solvency_ratio
        claims["solvency_assurance"] = solvency_assurance

    # Fiscal-capacity (funds) claim — MEDIUM only, never inflated
    funds = income_data.get("funds_coverage") or {}
    if funds.get("assurance") == "MEDIUM" and funds.get("funds_band") not in (None, "unavailable"):
        claims["funds_coverage_band"] = funds["funds_band"]
        claims["funds_coverage_source"] = funds.get("funds_source", "self")
        claims["funds_coverage_assurance"] = "MEDIUM"

    dpe_assurance = ownership_data.get("dpe_assurance") or ownership_data.get("assurance")
    control_label = ownership_data.get("label")
    if dpe_assurance and dpe_assurance not in ("UNVERIFIED", "PENDING"):
        claims["property_control_assurance"] = dpe_assurance
    if control_label:
        claims["property_control_label"] = control_label

    insurance_data = current_user.insurance_data or {}
    mrh_status = insurance_data.get("status")
    if mrh_status in ("verified", "flagged"):
        claims["mrh_insurance_verified"] = mrh_status == "verified"
        claims["mrh_insurance_assurance"] = "MEDIUM"
        claims["mrh_insurance_status"] = mrh_status
        if insurance_data.get("flags"):
            claims["mrh_insurance_flags"] = insurance_data["flags"]

    return claims
```

Then in `issue_mine`, replace lines 298-327 with:

```python
    claims = _build_claims_for_user(current_user)
```

(Leave the `subject_role`/`rail`/`credential_service.issue(...)` code below unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intl_identity.py::TestIssueMineFundsClaim -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Run the credential integration suite for regressions**

Run: `python -m pytest tests_integration/test_credential_core.py -v`
Expected: PASS (existing issue-mine tests still green — claim output unchanged for non-funds users)

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/credentials.py backend/tests/test_intl_identity.py
git commit -m "feat(credentials): emit funds_coverage claim from issue_mine"
```

---

## Task 6: Plain-language assurance rendering — verify page

**Files:**
- Modify: `frontend/app/c/[credential_id]/page.tsx:38-60, 201-215`

Replace the tier-word/amber badge rendering with green-check affirmative sentences. UNVERIFIED claims are simply absent from the credential (issue_mine never emits them), so no special hiding is needed, but the renderer must skip any claim it has no sentence for.

- [ ] **Step 1: Replace the badge + label maps with a sentence map**

Replace `ASSURANCE_BADGE` (lines 38-43), `CLAIM_LABELS` (lines 45-51), and `AssuranceBadge` (lines 53-60) with:

```tsx
// Plain-language statements of what was verified. Internal tiers (HIGH/MEDIUM)
// are intentionally NOT shown to the landlord — only the affirmative fact.
function claimSentence(key: string, value: string, claims: Record<string, string>): string | null {
    switch (key) {
        case 'identity_assurance':
            return value === 'HIGH'
                ? "Identité confirmée auprès des registres de l'État"
                : value === 'MEDIUM'
                ? "Pièce d'identité vérifiée + selfie concordant"
                : null;
        case 'solvency_assurance':
            return value === 'UNVERIFIED' ? null : 'Revenus vérifiés (capacité fiscale)';
        case 'funds_coverage_assurance': {
            const band = claims['funds_coverage_band'];
            const months: Record<string, string> = {
                covers_12m_plus: '12 mois ou plus',
                covers_6m: '6 à 11 mois',
                covers_3m: '3 à 5 mois',
                covers_under_3m: 'moins de 3 mois',
                amount_only: '',
            };
            const span = months[band] ? ` couvrant ${months[band]} de loyer` : '';
            const sponsor = claims['funds_coverage_source'] === 'sponsor' ? ' (via un garant/sponsor)' : '';
            return `Fonds vérifiés${span}${sponsor}`;
        }
        case 'property_control_assurance':
            return 'Documents de contrôle du bien vérifiés';
        case 'mrh_insurance_assurance':
            return String(claims['mrh_insurance_verified']) === 'true'
                ? 'Assurance habitation (MRH) vérifiée'
                : 'Assurance habitation (MRH) signalée pour vérification';
        default:
            return null; // raw bands / labels / sources are inputs to other sentences
    }
}
```

- [ ] **Step 2: Replace the claims table render (lines 201-215)**

Replace the `{/* Claims table */}` block with:

```tsx
                {/* Claims table — plain-language, no tier words */}
                <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
                    {(() => {
                        const rows = claimEntries
                            .map(([key, value]) => claimSentence(key, String(value), data.claims))
                            .filter((s): s is string => Boolean(s));
                        if (rows.length === 0) {
                            return <div className="p-5 text-sm text-zinc-400">Aucune vérification enregistrée.</div>;
                        }
                        return rows.map((sentence, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                <span className="text-sm text-zinc-800">{sentence}</span>
                            </div>
                        ));
                    })()}
                </div>
```

(`CheckCircle2` is already imported — it's used by `StatusBanner`.)

- [ ] **Step 3: Verify the build compiles**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no errors referencing `page.tsx` (pre-existing unrelated errors elsewhere are acceptable; confirm none point at the edited file).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/c/[credential_id]/page.tsx
git commit -m "feat(verify): plain-language claim rendering, drop HIGH/MEDIUM badges"
```

---

## Task 7: Plain-language assurance + funds row — evidence PDF

**Files:**
- Modify: `backend/app/services/credential.py:284, 297-324`
- Test: `backend/tests/test_intl_identity.py`

Replace the tier-word assurance column (`assurance_fr` with "INTERMÉDIAIRE ⚠") with plain affirmative phrasing, and add a `funds_coverage` row. The PDF is bytes; the test asserts it generates without error and that tier words are absent from a funds credential.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_intl_identity.py`:

```python
class TestEvidencePdfFunds:
    def test_funds_credential_pdf_has_no_tier_words(self):
        from app.services.credential import credential_service
        record = {
            "subject_role": "tenant",
            "subject_display_name": "Priya Sharma",
            "rail": "INTL",
            "issued_at": "2026-06-17T00:00:00",
            "expires_at": "2026-07-17T00:00:00",
            "credential_id": "test-id",
            "claims": {
                "identity_assurance": "MEDIUM",
                "funds_coverage_band": "covers_12m_plus",
                "funds_coverage_source": "sponsor",
                "funds_coverage_assurance": "MEDIUM",
            },
            "disclaimer": "x", "signature": "y",
        }
        pdf = credential_service.export_evidence_pdf(record)
        assert isinstance(pdf, bytes) and len(pdf) > 800
        # tier jargon must not be baked into the consumer evidence doc
        assert b"INTERM" not in pdf  # 'INTERMÉDIAIRE'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intl_identity.py::TestEvidencePdfFunds -v`
Expected: FAIL (the current `assurance_fr` map bakes "INTERMÉDIAIRE" into the PDF; also no funds row)

- [ ] **Step 3: Replace the assurance map and add the funds row**

In `backend/app/services/credential.py`, replace line 284:

```python
        assurance_fr = {"HIGH": "ÉLEVÉE ✓ (cryptographique d'État)", "MEDIUM": "INTERMÉDIAIRE ⚠ (OCR + vivacité)", "UNVERIFIED": "NON VÉRIFIÉE"}
```

with a plain-language helper:

```python
        def _verified_phrase(level: str) -> str:
            # Consumer-facing: affirmative, no internal tier words
            return "Vérifié ✓" if level in ("HIGH", "MEDIUM") else "Non vérifié"
```

Then replace every `assurance_fr.get(claims.get(..., "UNVERIFIED"), "—")` call in the claims rows (lines ~295, 301, 307, 313, 323) with `_verified_phrase(claims.get(<same key>, "UNVERIFIED"))`. For example line 295 becomes:

```python
                Paragraph(_verified_phrase(claims.get("identity_assurance", "UNVERIFIED")), body),
```

Apply the identical substitution to the `solvency_assurance`, `property_assurance` (×2), and `mrh_insurance_assurance` rows.

Then, immediately after the `solvency_ratio` row block (after line 302), add a funds row:

```python
        if "funds_coverage_band" in claims:
            band_fr = {
                "covers_12m_plus": "couvre 12 mois ou plus de loyer",
                "covers_6m": "couvre 6 à 11 mois de loyer",
                "covers_3m": "couvre 3 à 5 mois de loyer",
                "covers_under_3m": "couvre moins de 3 mois de loyer",
                "amount_only": "fonds vérifiés",
            }
            src = " (via garant/sponsor)" if claims.get("funds_coverage_source") == "sponsor" else ""
            claims_rows.append([
                Paragraph("Capacité fiscale (fonds)", body),
                Paragraph(band_fr.get(claims["funds_coverage_band"], "fonds vérifiés") + src, body),
                Paragraph(_verified_phrase(claims.get("funds_coverage_assurance", "UNVERIFIED")), body),
            ])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intl_identity.py::TestEvidencePdfFunds -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/credential.py backend/tests/test_intl_identity.py
git commit -m "feat(evidence): plain-language assurance + funds row in evidence PDF"
```

---

## Task 8: Full-suite regression + DOSSIER update

**Files:**
- Modify: `docs/features/trust-layer/DOSSIER.md`

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && python -m pytest tests/ tests_integration/ --tb=short 2>&1 | tail -15`
Expected: all green (prior baseline 208 + the new tests). No failures.

- [ ] **Step 2: Update the DOSSIER**

In `docs/features/trust-layer/DOSSIER.md`, append to the changelog list near the top (after the INTL item):

```markdown
- **INTL fiscal-capacity solvency landed 2026-06-17:** `POST /verification/intl/funds`
  — bank statement / scholarship / sponsorship / loan-approval → FX-normalised banded
  `funds_coverage` claim (MEDIUM, funds-not-income, self-contained, no third-party
  aggregator). Sponsor funds captured as fiscal-capacity signal (not guarantor brokering).
  `issue_mine` emits `funds_coverage_*`. Plain-language assurance rendering: verify page +
  evidence PDF show affirmative sentences, internal HIGH/MEDIUM tiers retained in credential
  JSON / B2B API only. Spec: `docs/superpowers/specs/2026-06-17-intl-fiscal-capacity-solvency-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/features/trust-layer/DOSSIER.md
git commit -m "docs(dossier): record INTL fiscal-capacity solvency + plain-language assurance"
```

---

## Notes for the implementer

- **Out of scope (do not build):** the guarantor subsystem (`guarantor_type`/`guarantor_data`), Open Banking/AIS, visa verification, issuer-recognition registry, EUDI Wallet. Sponsor funds are handled purely as a `funds_source: sponsor` flag on the funds claim.
- **Pre-existing divergence (leave alone):** the evidence PDF reads some claim keys (`identity_verified`, `property_dpe_class`) that `issue_mine` does not currently emit. That mismatch predates this work — do not "fix" it here; only touch the assurance-phrase rendering and add the funds row.
- **Statelessness:** never persist the raw funds amount or the document — only the band + flags. The endpoint already discards `content` (no storage call).
- **Honesty guard:** `funds_coverage` is MEDIUM, permanently. No code path may set it to HIGH.
