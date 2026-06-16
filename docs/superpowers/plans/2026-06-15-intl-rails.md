# INTL Rails (Item 11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the INTL MEDIUM rail — web MRZ hybrid OCR + face-match for identity, FX-normalised foreign income for solvency — via three new dedicated endpoints.

**Architecture:** Two pure service files (`mrz.py`, `fx_normalise.py`) with clean interfaces; three new endpoints appended to the existing `verification.py` router; stateless verify-and-forget using Redis TTL-600 / R2 fallback identical to PR #4 pattern. Every external service has a plan B; no step can block a user from getting a result.

**Tech Stack:** Python/FastAPI, `pytesseract` (MRZ OCR fallback), Gemini AI (MRZ primary + income extraction), `httpx` (Frankfurter ECB FX API), existing `cache` layer (Redis), existing `storage` service (R2), existing `compare_faces` in `identity_service`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/requirements.txt` | Modify | Add `pytesseract>=0.3.13` |
| `backend/app/services/mrz.py` | Create | MRZ extraction + ICAO mod-10 checksum validation — pure, no DB |
| `backend/app/services/fx_normalise.py` | Create | FX conversion, static table, Redis cache — pure, no DB |
| `backend/app/routers/verification.py` | Modify | Add `_ai_extract_intl_income` helper + 3 INTL endpoints |
| `backend/tests/test_intl_rails.py` | Create | Unit tests for mrz.py and fx_normalise.py (mock AI, no HTTP) |
| `backend/tests/test_intl_identity.py` | Create | Endpoint tests for 3 INTL routes (mock DB + mock services) |
| `docs/features/trust-layer/DOSSIER.md` | Modify | Mark ID-5/6/7/8/9 + SV-5/6/7/SV-8-analog as covered |

---

## Task 0: Create worktree

**Files:** Worktree at `../rental-platform-intl-rails` on branch `feat/intl-rails`

- [ ] **Step 1: Create worktree from master**

```bash
git worktree add ../rental-platform-intl-rails -b feat/intl-rails
```

- [ ] **Step 2: Verify clean state**

```bash
cd ../rental-platform-intl-rails && git status
```
Expected: `On branch feat/intl-rails` / `nothing to commit, working tree clean`

- [ ] **Step 3: All remaining work happens in `../rental-platform-intl-rails`**

---

## Task 1: Add pytesseract dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add the dependency**

Open `backend/requirements.txt`. After the `pillow>=10.2.0` line, add:
```
pytesseract>=0.3.13
```

- [ ] **Step 2: Install**

```bash
cd backend && pip install "pytesseract>=0.3.13"
```

Note: `tesseract-ocr` binary must be installed separately (`brew install tesseract` on macOS, `apt-get install tesseract-ocr` on Linux/Docker). The service gracefully degrades if the binary is absent — Tesseract is the fallback, not the primary path.

- [ ] **Step 3: Verify import works**

```bash
python -c "import pytesseract; print('ok')"
```
Expected: `ok` (a `TesseractNotFoundError` only fires when you call OCR functions, not at import time — that's intentional).

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore(deps): add pytesseract for MRZ fallback OCR"
```

---

## Task 2: mrz.py — checksum + dataclass (TDD)

**Files:**
- Create: `backend/app/services/mrz.py`
- Create: `backend/tests/test_intl_rails.py` (checksum tests only — will be extended in Task 3)

The ICAO Doc 9303 mod-10 algorithm:
- Weight sequence: 7, 3, 1 (cyclically repeating by position index).
- Char values: `<` → 0, digits → face value, A–Z → 10–35.
- Result: `sum(char_value × weight) % 10`.

TD3 passport line 2 (44 chars) has 4 check digits:
1. `line2[0:9]` = doc number, check at `line2[9]`
2. `line2[13:19]` = DOB, check at `line2[19]`
3. `line2[21:27]` = expiry, check at `line2[27]`
4. `line2[0:10] + line2[13:43]` = composite, check at `line2[43]`

**Known-good test data** (pre-verified by hand against ICAO algorithm):
- doc_num = `"A1234567<"` → check digit = `"6"` (176 % 10 = 6)
- dob = `"900101"` → check digit = `"1"` (71 % 10 = 1)
- expiry = `"320101"` → check digit = `"5"` (35 % 10 = 5)
- optional (14 × `<`) → check digit = `"0"` (0 % 10 = 0)
- composite → check digit = `"0"` (350 % 10 = 0)

Valid 44-char line 2: `"A1234567<6GBR9001011M3201015<<<<<<<<<<<<<<00"`

- [ ] **Step 1: Write failing checksum + dataclass tests**

Create `backend/tests/test_intl_rails.py`:

```python
"""
Unit tests for INTL rails: mrz.py and fx_normalise.py pure functions.
No DB, no HTTP, no AI — pure function tests only.
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

import dataclasses
import pytest

# ── Helpers ────────────────────────────────────────────────────────────────────

_VALID_LINE1 = "P<GBRSMITH<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
_VALID_LINE2 = "A1234567<6GBR9001011M3201015<<<<<<<<<<<<<<00"

# ── MRZ checksum ───────────────────────────────────────────────────────────────

class TestMRZChecksum:
    def test_valid_td3_line2_passes(self):
        from app.services.mrz import _validate_checksums
        assert _validate_checksums(_VALID_LINE2) is True

    def test_corrupted_doc_number_fails(self):
        from app.services.mrz import _validate_checksums
        # Position 0: A → X  (invalidates both doc-number and composite checks)
        corrupted = "X" + _VALID_LINE2[1:]
        assert _validate_checksums(corrupted) is False

    def test_corrupted_dob_fails(self):
        from app.services.mrz import _validate_checksums
        # Position 13: 9 → 0  (invalidates DOB checksum)
        corrupted = _VALID_LINE2[:13] + "0" + _VALID_LINE2[14:]
        assert _validate_checksums(corrupted) is False

    def test_corrupted_expiry_fails(self):
        from app.services.mrz import _validate_checksums
        # Position 21: 3 → 9  (invalidates expiry checksum)
        corrupted = _VALID_LINE2[:21] + "9" + _VALID_LINE2[22:]
        assert _validate_checksums(corrupted) is False

    def test_too_short_returns_false(self):
        from app.services.mrz import _validate_checksums
        assert _validate_checksums("ABC") is False

    def test_exactly_43_chars_returns_false(self):
        from app.services.mrz import _validate_checksums
        assert _validate_checksums(_VALID_LINE2[:43]) is False


class TestMRZDataclass:
    def test_nationality_field_absent(self):
        """nationality must never be a field on MRZResult — GDPR art. 9."""
        from app.services.mrz import MRZResult
        field_names = {f.name for f in dataclasses.fields(MRZResult)}
        assert "nationality" not in field_names

    def test_assurance_field_exists_and_is_string(self):
        from app.services.mrz import MRZResult
        field_names = {f.name for f in dataclasses.fields(MRZResult)}
        assert "assurance" in field_names

    def test_required_fields_present(self):
        from app.services.mrz import MRZResult
        field_names = {f.name for f in dataclasses.fields(MRZResult)}
        for required in ("surname", "given_names", "doc_number", "dob", "expiry",
                         "mrz_valid", "rescan_required", "assurance", "extraction_path"):
            assert required in field_names, f"Missing field: {required}"
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && python -m pytest tests/test_intl_rails.py -v 2>&1 | head -15
```
Expected: `ModuleNotFoundError: No module named 'app.services.mrz'`

- [ ] **Step 3: Create mrz.py with checksum logic and dataclass**

Create `backend/app/services/mrz.py`:

```python
"""
MRZ (Machine Readable Zone) extraction and validation for INTL identity rail.

Primary: Gemini AI extracts raw TD3 MRZ lines.
Fallback: pytesseract with MRZ-specific PSM if AI lines empty or checksums fail.
Both fail: mrz_valid=False, rescan_required=True — endpoint returns 422.

assurance is always "MEDIUM" — web path cannot do NFC Passive Auth (ID-5, ID-7).
nationality: extracted internally for checksum only, never stored or emitted (GDPR art. 9).
"""
import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types as genai_types
    _GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    genai_types = None
    _GEMINI_AVAILABLE = False

try:
    import pytesseract
    from PIL import Image
    import io as _io
    _TESSERACT_AVAILABLE = True
except ImportError:
    pytesseract = None
    _TESSERACT_AVAILABLE = False


@dataclass
class MRZResult:
    surname: str
    given_names: str
    doc_number: str
    dob: str            # YYMMDD
    expiry: str         # YYMMDD
    mrz_valid: bool
    rescan_required: bool
    assurance: str      # always "MEDIUM" — enforced by extract_mrz, never "HIGH"
    extraction_path: str  # "ai" | "tesseract" | "ai+tesseract" | "failed"
    # nationality: intentionally absent — never stored (GDPR art. 9)


_CHAR_VALUES: dict[str, int] = {str(i): i for i in range(10)}
_CHAR_VALUES.update({chr(ord("A") + i): 10 + i for i in range(26)})
_CHAR_VALUES["<"] = 0
_WEIGHTS = [7, 3, 1]


def _check_digit(s: str) -> str:
    """Compute ICAO mod-10 check digit for a field string."""
    total = sum(_CHAR_VALUES.get(c, 0) * _WEIGHTS[i % 3] for i, c in enumerate(s))
    return str(total % 10)


def _validate_checksums(line2: str) -> bool:
    """
    Validate all 4 ICAO TD3 check digits in line 2 (44 chars).
    Returns True only if all four pass.
    """
    if len(line2) < 44:
        return False
    checks = [
        (line2[0:9],                  line2[9]),   # document number
        (line2[13:19],                line2[19]),  # date of birth
        (line2[21:27],                line2[27]),  # expiry date
        (line2[0:10] + line2[13:43],  line2[43]),  # composite
    ]
    return all(_check_digit(field) == check for field, check in checks)


def _parse_td3_line2(line2: str) -> dict:
    """Extract non-sensitive fields from a validated TD3 line 2."""
    return {
        "doc_number": line2[0:9].rstrip("<"),
        # line2[10:13] is nationality — read internally but not returned
        "dob": line2[13:19],
        "expiry": line2[21:27],
    }


def _parse_td3_line1(line1: str) -> tuple[str, str]:
    """Extract surname and given names from TD3 line 1."""
    if len(line1) < 44:
        return "", ""
    name_part = line1[5:44]  # skip P, sub-type (1), country code (3)
    parts = name_part.split("<<", 1)
    surname = parts[0].replace("<", " ").strip()
    given_names = parts[1].replace("<", " ").strip() if len(parts) > 1 else ""
    return surname, given_names


def _tesseract_extract(image_bytes: bytes) -> tuple[str, str]:
    """Run Tesseract with MRZ-optimised config. Returns (line1, line2) or ('', '')."""
    if not _TESSERACT_AVAILABLE:
        return "", ""
    try:
        img = Image.open(_io.BytesIO(image_bytes))
        cfg = (
            "--psm 6 --oem 1 "
            "-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"
        )
        raw = pytesseract.image_to_string(img, config=cfg)
        candidates = re.findall(r"[A-Z0-9<]{44}", raw.replace(" ", "").replace("\n", ""))
        if len(candidates) >= 2:
            return candidates[-2], candidates[-1]
    except Exception as exc:
        logger.warning("Tesseract MRZ extraction failed: %s", exc)
    return "", ""
```

- [ ] **Step 4: Run checksum + dataclass tests — verify they pass**

```bash
python -m pytest tests/test_intl_rails.py::TestMRZChecksum tests/test_intl_rails.py::TestMRZDataclass -v
```
Expected: all 8 pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/mrz.py backend/tests/test_intl_rails.py
git commit -m "feat(intl): mrz.py — MRZResult dataclass + ICAO mod-10 checksum validator"
```

---

## Task 3: mrz.py — `extract_mrz` function (TDD)

**Files:**
- Modify: `backend/app/services/mrz.py`
- Modify: `backend/tests/test_intl_rails.py`

- [ ] **Step 1: Add extraction tests**

Append to `backend/tests/test_intl_rails.py`:

```python
# ── MRZ extraction (AI + Tesseract) ───────────────────────────────────────────

class TestMRZExtraction:
    def test_ai_valid_lines_returns_mrz_result(self):
        """AI returns valid lines + checksums pass → MRZResult(mrz_valid=True, assurance=MEDIUM)."""
        import asyncio
        from unittest.mock import AsyncMock, patch
        from app.services.mrz import extract_mrz

        with patch("app.services.mrz._GEMINI_AVAILABLE", True), \
             patch("app.services.mrz._ai_extract_mrz", new=AsyncMock(
                 return_value={"mrz_line1": _VALID_LINE1, "mrz_line2": _VALID_LINE2}
             )):
            result = asyncio.get_event_loop().run_until_complete(
                extract_mrz(b"fake", "image/jpeg")
            )

        assert result.mrz_valid is True
        assert result.assurance == "MEDIUM"
        assert result.rescan_required is False
        assert result.extraction_path == "ai"
        assert result.surname == "SMITH"
        assert result.given_names == "JOHN"
        assert result.doc_number == "A1234567"
        assert result.expiry == "320101"

    def test_ai_bad_checksum_triggers_tesseract_fallback(self):
        """AI returns corrupted line2 → Tesseract re-runs and returns valid lines."""
        import asyncio
        from unittest.mock import AsyncMock, patch
        from app.services.mrz import extract_mrz

        corrupt = "X" + _VALID_LINE2[1:]  # invalid doc-number checksum

        with patch("app.services.mrz._GEMINI_AVAILABLE", True), \
             patch("app.services.mrz._ai_extract_mrz", new=AsyncMock(
                 return_value={"mrz_line1": _VALID_LINE1, "mrz_line2": corrupt}
             )), \
             patch("app.services.mrz._tesseract_extract",
                   return_value=(_VALID_LINE1, _VALID_LINE2)):
            result = asyncio.get_event_loop().run_until_complete(
                extract_mrz(b"fake", "image/jpeg")
            )

        assert result.mrz_valid is True
        assert "tesseract" in result.extraction_path

    def test_both_fail_returns_rescan_required(self):
        """Both AI and Tesseract produce bad checksums → mrz_valid=False, rescan_required=True."""
        import asyncio
        from unittest.mock import AsyncMock, patch
        from app.services.mrz import extract_mrz

        junk = "X" * 44

        with patch("app.services.mrz._GEMINI_AVAILABLE", True), \
             patch("app.services.mrz._ai_extract_mrz", new=AsyncMock(
                 return_value={"mrz_line1": "", "mrz_line2": junk}
             )), \
             patch("app.services.mrz._tesseract_extract", return_value=("", junk)):
            result = asyncio.get_event_loop().run_until_complete(
                extract_mrz(b"fake", "image/jpeg")
            )

        assert result.mrz_valid is False
        assert result.rescan_required is True
        assert result.assurance == "MEDIUM"

    def test_assurance_is_always_medium(self):
        """extract_mrz can never emit assurance='HIGH' — the field is hard-coded."""
        import asyncio
        from unittest.mock import AsyncMock, patch
        from app.services.mrz import extract_mrz

        with patch("app.services.mrz._GEMINI_AVAILABLE", True), \
             patch("app.services.mrz._ai_extract_mrz", new=AsyncMock(
                 return_value={"mrz_line1": _VALID_LINE1, "mrz_line2": _VALID_LINE2}
             )):
            result = asyncio.get_event_loop().run_until_complete(
                extract_mrz(b"fake", "image/jpeg")
            )

        assert result.assurance == "MEDIUM"
        assert result.assurance != "HIGH"

    def test_nationality_never_in_result(self):
        """nationality must not be accessible on the returned MRZResult."""
        import asyncio
        from unittest.mock import AsyncMock, patch
        from app.services.mrz import extract_mrz

        with patch("app.services.mrz._GEMINI_AVAILABLE", True), \
             patch("app.services.mrz._ai_extract_mrz", new=AsyncMock(
                 return_value={"mrz_line1": _VALID_LINE1, "mrz_line2": _VALID_LINE2}
             )):
            result = asyncio.get_event_loop().run_until_complete(
                extract_mrz(b"fake", "image/jpeg")
            )

        assert not hasattr(result, "nationality")
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
python -m pytest tests/test_intl_rails.py::TestMRZExtraction -v 2>&1 | head -10
```
Expected: `AttributeError: module 'app.services.mrz' has no attribute 'extract_mrz'`

- [ ] **Step 3: Add `_ai_extract_mrz` and `extract_mrz` to mrz.py**

Append to `backend/app/services/mrz.py`:

```python
async def _ai_extract_mrz(image_bytes: bytes, content_type: str, ai_client=None) -> dict:
    """Ask Gemini to return raw TD3 MRZ line1 and line2 strings."""
    if not _GEMINI_AVAILABLE:
        return {"mrz_line1": "", "mrz_line2": ""}

    prompt = (
        "You are a passport MRZ extraction system. Extract the two machine-readable zone "
        "lines from this passport bio page.\n\n"
        "Return ONLY this JSON — no markdown, no extra text:\n"
        '{"mrz_line1": "<44-char string or empty>", "mrz_line2": "<44-char string or empty>"}\n\n'
        "Rules:\n"
        "- MRZ lines contain only uppercase A-Z, digits 0-9, and < filler characters\n"
        "- Each TD3 line is exactly 44 characters — copy exactly, do not correct\n"
        "- If no MRZ is visible, return empty strings"
    )

    from app.core.config import settings
    client = ai_client
    if client is None and _GEMINI_AVAILABLE and getattr(settings, "GEMINI_API_KEY", None):
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
    if client is None:
        return {"mrz_line1": "", "mrz_line2": ""}

    image_part = genai_types.Part.from_bytes(data=image_bytes, mime_type=content_type)
    for model in ("gemini-2.0-flash", "gemini-1.5-flash"):
        try:
            response = client.models.generate_content(
                model=model,
                contents=[image_part, prompt],
            )
            import json
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1].lstrip("json").strip()
            return json.loads(text)
        except Exception as exc:
            logger.warning("AI MRZ extraction (%s) failed: %s", model, exc)
    return {"mrz_line1": "", "mrz_line2": ""}


_FAILED_RESULT = MRZResult(
    surname="", given_names="", doc_number="", dob="", expiry="",
    mrz_valid=False, rescan_required=True, assurance="MEDIUM",
    extraction_path="failed",
)


async def extract_mrz(image_bytes: bytes, content_type: str, ai_client=None) -> MRZResult:
    """
    Extract and validate MRZ from a passport image.

    Pass 1 — AI (Gemini): extract raw lines → validate checksums.
    Pass 2 — Tesseract: triggered if AI lines empty or any checksum fails.
    Both fail → mrz_valid=False, rescan_required=True.

    assurance is always "MEDIUM" — no code path emits HIGH (ID-5, ID-7).
    nationality is used for checksum computation only, never returned (GDPR art. 9).
    """
    # ── Pass 1: AI ──────────────────────────────────────────────────────────
    ai_data = await _ai_extract_mrz(image_bytes, content_type, ai_client)
    line1_ai = ai_data.get("mrz_line1") or ""
    line2_ai = ai_data.get("mrz_line2") or ""

    if len(line2_ai) == 44 and _validate_checksums(line2_ai):
        fields = _parse_td3_line2(line2_ai)
        surname, given_names = _parse_td3_line1(line1_ai)
        return MRZResult(
            surname=surname, given_names=given_names,
            doc_number=fields["doc_number"],
            dob=fields["dob"], expiry=fields["expiry"],
            mrz_valid=True, rescan_required=False,
            assurance="MEDIUM", extraction_path="ai",
        )

    # ── Pass 2: Tesseract ───────────────────────────────────────────────────
    line1_t, line2_t = _tesseract_extract(image_bytes)
    path = "ai+tesseract" if line2_ai else "tesseract"

    if len(line2_t) == 44 and _validate_checksums(line2_t):
        fields = _parse_td3_line2(line2_t)
        surname, given_names = _parse_td3_line1(line1_t)
        return MRZResult(
            surname=surname, given_names=given_names,
            doc_number=fields["doc_number"],
            dob=fields["dob"], expiry=fields["expiry"],
            mrz_valid=True, rescan_required=False,
            assurance="MEDIUM", extraction_path=path,
        )

    # ── Both failed ─────────────────────────────────────────────────────────
    logger.warning("MRZ extraction failed for both AI and Tesseract")
    return _FAILED_RESULT
```

- [ ] **Step 4: Run all MRZ tests — verify they pass**

```bash
python -m pytest tests/test_intl_rails.py::TestMRZChecksum tests/test_intl_rails.py::TestMRZDataclass tests/test_intl_rails.py::TestMRZExtraction -v
```
Expected: all 13 pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/mrz.py backend/tests/test_intl_rails.py
git commit -m "feat(intl): mrz.py — extract_mrz with AI-primary + Tesseract fallback"
```

---

## Task 4: fx_normalise.py (TDD)

**Files:**
- Create: `backend/app/services/fx_normalise.py`
- Modify: `backend/tests/test_intl_rails.py`

- [ ] **Step 1: Add FX + banding + period-normalisation tests**

Append to `backend/tests/test_intl_rails.py`:

```python
# ── FX normalisation ──────────────────────────────────────────────────────────

class TestFXLivePath:
    def test_frankfurter_hit_returns_live_source_with_margin(self):
        """Frankfurter API returns rate → source='live', 5% margin applied."""
        import asyncio
        from unittest.mock import AsyncMock, MagicMock, patch
        from app.services.fx_normalise import convert_to_eur

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"rates": {"EUR": 0.011}}
        mock_resp.raise_for_status = MagicMock()

        mock_http = MagicMock()
        mock_http.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=mock_resp))
        )
        mock_http.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.fx_normalise.httpx.AsyncClient", return_value=mock_http), \
             patch("app.services.fx_normalise.cache") as mc:
            mc.redis_client = None
            result = asyncio.get_event_loop().run_until_complete(
                convert_to_eur(80000.0, "INR")
            )

        assert result.fx_source == "live"
        assert result.margin_applied == 0.05
        assert result.fx_margin_label == "currency volatility buffer"
        assert result.eur_amount is not None
        assert abs(result.eur_amount - round(80000.0 * 0.011 * 0.95, 2)) < 0.01

    def test_fx_margin_label_exact_string(self):
        """fx_margin_label must be this exact string — never varies by currency (art. 225-2)."""
        from app.services.fx_normalise import FXResult
        r = FXResult(
            eur_amount=100.0, currency="JPY", rate=0.006,
            margin_applied=0.05, fx_source="live",
            fx_margin_label="currency volatility buffer",
        )
        assert r.fx_margin_label == "currency volatility buffer"


class TestFXStaticFallback:
    def test_api_timeout_falls_back_to_static_table(self):
        """Frankfurter timeout → static table used → fx_source='static'."""
        import asyncio, httpx
        from unittest.mock import AsyncMock, MagicMock, patch
        from app.services.fx_normalise import convert_to_eur

        mock_http = MagicMock()
        mock_http.__aenter__ = AsyncMock(
            return_value=MagicMock(
                get=AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            )
        )
        mock_http.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.fx_normalise.httpx.AsyncClient", return_value=mock_http), \
             patch("app.services.fx_normalise.cache") as mc:
            mc.redis_client = None
            result = asyncio.get_event_loop().run_until_complete(
                convert_to_eur(1000.0, "USD")
            )

        assert result.fx_source == "static"
        assert result.eur_amount is not None
        assert result.margin_applied == 0.05

    def test_eur_passthrough_no_api_call(self):
        """EUR input never calls Frankfurter — converted at 1.0 with margin."""
        import asyncio
        from unittest.mock import patch
        from app.services.fx_normalise import convert_to_eur

        with patch("app.services.fx_normalise.httpx.AsyncClient") as mock_cls, \
             patch("app.services.fx_normalise.cache") as mc:
            mc.redis_client = None
            result = asyncio.get_event_loop().run_until_complete(
                convert_to_eur(1000.0, "EUR")
            )

        mock_cls.assert_not_called()
        assert result.fx_source == "live"
        assert abs(result.eur_amount - 950.0) < 0.01


class TestFXUnknownCurrency:
    def test_unknown_currency_api_down_returns_unavailable(self):
        """Currency not in static table + API down → fx_source='unavailable', eur_amount=None."""
        import asyncio, httpx
        from unittest.mock import AsyncMock, MagicMock, patch
        from app.services.fx_normalise import convert_to_eur

        mock_http = MagicMock()
        mock_http.__aenter__ = AsyncMock(
            return_value=MagicMock(
                get=AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            )
        )
        mock_http.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.fx_normalise.httpx.AsyncClient", return_value=mock_http), \
             patch("app.services.fx_normalise.cache") as mc:
            mc.redis_client = None
            result = asyncio.get_event_loop().run_until_complete(
                convert_to_eur(5000.0, "XYZ")
            )

        assert result.fx_source == "unavailable"
        assert result.eur_amount is None
        assert result.fx_margin_label == "currency volatility buffer"


class TestRatioBanding:
    def test_3_0_bands_to_gte_3(self):
        from app.services.fx_normalise import band_solvency_ratio
        assert band_solvency_ratio(3.0) == ">=3.0"

    def test_3_5_bands_to_gte_3(self):
        from app.services.fx_normalise import band_solvency_ratio
        assert band_solvency_ratio(3.5) == ">=3.0"

    def test_2_97_bands_to_gte_2_not_gte_3(self):
        """Post-margin 2.97 must not be rounded up to >=3.0 — SV-7 honest banding."""
        from app.services.fx_normalise import band_solvency_ratio
        assert band_solvency_ratio(2.97) == ">=2.0"

    def test_2_0_bands_to_gte_2(self):
        from app.services.fx_normalise import band_solvency_ratio
        assert band_solvency_ratio(2.0) == ">=2.0"

    def test_1_9_bands_to_lt_2(self):
        from app.services.fx_normalise import band_solvency_ratio
        assert band_solvency_ratio(1.9) == "<2.0"


class TestIncomePeriodNormalisation:
    def test_annual_divides_by_12(self):
        from app.services.fx_normalise import normalise_income_to_monthly
        amount, period, unclear = normalise_income_to_monthly(60000.0, "annual")
        assert abs(amount - 5000.0) < 0.01
        assert period == "monthly"
        assert unclear is False

    def test_monthly_unchanged(self):
        from app.services.fx_normalise import normalise_income_to_monthly
        amount, period, unclear = normalise_income_to_monthly(5000.0, "monthly")
        assert amount == 5000.0
        assert period == "monthly"
        assert unclear is False

    def test_unknown_no_division_unclear_flagged(self):
        """Conservative: unknown period → no division, income_period_unclear=True."""
        from app.services.fx_normalise import normalise_income_to_monthly
        amount, period, unclear = normalise_income_to_monthly(5000.0, "unknown")
        assert amount == 5000.0  # no division
        assert unclear is True
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
python -m pytest tests/test_intl_rails.py::TestFXLivePath tests/test_intl_rails.py::TestFXStaticFallback tests/test_intl_rails.py::TestFXUnknownCurrency tests/test_intl_rails.py::TestRatioBanding tests/test_intl_rails.py::TestIncomePeriodNormalisation -v 2>&1 | head -10
```
Expected: `ModuleNotFoundError: No module named 'app.services.fx_normalise'`

- [ ] **Step 3: Create fx_normalise.py**

Create `backend/app/services/fx_normalise.py`:

```python
"""
FX normalisation for INTL solvency rail.

Primary: Frankfurter API (ECB-backed, free), cached 24h in Redis by currency+date.
Fallback: static table of 29 currencies — update quarterly.
Unavailable: currency not in table + API down → eur_amount=None, source='unavailable'.

5% margin applied at every path — labelled 'currency volatility buffer' (art. 225-2 safe,
never varies by currency or country of origin).
"""
import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional

import httpx

from app.core.cache import cache

logger = logging.getLogger(__name__)

FRANKFURTER_URL = "https://api.frankfurter.app/latest"
_FX_CACHE_TTL = 86_400  # 24 hours
_MARGIN = 0.05
_MARGIN_LABEL = "currency volatility buffer"

# Static fallback rates: 1 unit foreign currency = N EUR.
# Approximate ECB mid-market rates — update quarterly.
_STATIC_RATES: dict[str, float] = {
    # Major
    "USD": 0.93, "GBP": 1.19, "CHF": 1.07, "CAD": 0.70, "AUD": 0.62,
    # Scandinavian
    "SEK": 0.088, "NOK": 0.088, "DKK": 0.134,
    # Eastern European
    "PLN": 0.232, "CZK": 0.041, "HUF": 0.0026, "RON": 0.201,
    # North African / Maghreb
    "MAD": 0.093, "DZD": 0.0069, "TND": 0.29,
    # South Asia
    "INR": 0.011, "PKR": 0.0034, "BDT": 0.0079, "LKR": 0.0029, "NPR": 0.0069,
    # Southeast Asia
    "VND": 0.000037, "PHP": 0.016, "IDR": 0.000057, "THB": 0.026,
    "MYR": 0.20, "SGD": 0.69,
    # East Asia
    "CNY": 0.13, "JPY": 0.0062, "KRW": 0.00068,
}


@dataclass
class FXResult:
    eur_amount: Optional[float]   # None if fx_source == "unavailable"
    currency: str                 # ISO 4217
    rate: Optional[float]
    margin_applied: float         # always 0.05
    fx_source: str                # "live" | "static" | "unavailable"
    fx_margin_label: str          # always "currency volatility buffer"


async def convert_to_eur(amount: float, currency_code: str) -> FXResult:
    """
    Convert foreign-currency monthly amount to EUR with 5% volatility margin.

    Plan B chain: Redis cache → Frankfurter → static table → UNVERIFIED.
    Never raises — worst case returns FXResult(eur_amount=None, fx_source='unavailable').
    """
    code = currency_code.upper()

    if code == "EUR":
        return FXResult(
            eur_amount=round(amount * (1 - _MARGIN), 2), currency=code,
            rate=1.0, margin_applied=_MARGIN, fx_source="live",
            fx_margin_label=_MARGIN_LABEL,
        )

    today = date.today().isoformat()
    cache_key = f"fx_rate:{code}:{today}"

    # ── Step 1: Redis cache ──────────────────────────────────────────────────
    if cache.redis_client:
        cached = await cache.get(cache_key)
        if cached and isinstance(cached, dict):
            return _make_result(amount, code, float(cached["rate"]), cached.get("source", "live"))

    # ── Step 2: Frankfurter live API ─────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(FRANKFURTER_URL, params={"from": code, "to": "EUR"})
            resp.raise_for_status()
            rate = float(resp.json()["rates"]["EUR"])
            if cache.redis_client:
                await cache.set(cache_key, {"rate": rate, "source": "live"}, ttl=_FX_CACHE_TTL)
            return _make_result(amount, code, rate, "live")
    except Exception as exc:
        logger.warning("Frankfurter FX lookup failed for %s: %s", code, exc)

    # ── Step 3: Static table ─────────────────────────────────────────────────
    static_rate = _STATIC_RATES.get(code)
    if static_rate is not None:
        if cache.redis_client:
            await cache.set(cache_key, {"rate": static_rate, "source": "static"}, ttl=_FX_CACHE_TTL)
        return _make_result(amount, code, static_rate, "static")

    # ── Step 4: Unavailable ──────────────────────────────────────────────────
    logger.warning("FX rate unavailable for %s", code)
    return FXResult(
        eur_amount=None, currency=code, rate=None,
        margin_applied=_MARGIN, fx_source="unavailable",
        fx_margin_label=_MARGIN_LABEL,
    )


def _make_result(amount: float, code: str, rate: float, source: str) -> FXResult:
    return FXResult(
        eur_amount=round(amount * rate * (1 - _MARGIN), 2), currency=code,
        rate=rate, margin_applied=_MARGIN, fx_source=source,
        fx_margin_label=_MARGIN_LABEL,
    )


def band_solvency_ratio(ratio: float) -> str:
    """Band a computed solvency ratio (post-margin). Never round up. SV-7."""
    if ratio >= 3.0:
        return ">=3.0"
    if ratio >= 2.0:
        return ">=2.0"
    return "<2.0"


def normalise_income_to_monthly(
    amount: float, income_period: str
) -> tuple[float, str, bool]:
    """
    Normalise income to monthly equivalent.
    Returns (normalised_amount, normalised_period, income_period_unclear).
    Conservative: unknown period → no division, flag unclear.
    """
    if income_period == "annual":
        return round(amount / 12, 2), "monthly", False
    if income_period == "monthly":
        return amount, "monthly", False
    return amount, income_period, True
```

- [ ] **Step 4: Run all FX + banding + period tests**

```bash
python -m pytest tests/test_intl_rails.py::TestFXLivePath tests/test_intl_rails.py::TestFXStaticFallback tests/test_intl_rails.py::TestFXUnknownCurrency tests/test_intl_rails.py::TestRatioBanding tests/test_intl_rails.py::TestIncomePeriodNormalisation -v
```
Expected: all 13 pass.

- [ ] **Step 5: Run full unit test file to confirm no regressions**

```bash
python -m pytest tests/test_intl_rails.py -v
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/fx_normalise.py backend/tests/test_intl_rails.py
git commit -m "feat(intl): fx_normalise.py — Frankfurter→static→unavailable + banding + period normalise"
```

---

## Task 5: `POST /verification/intl/identity/upload` endpoint (TDD)

**Files:**
- Modify: `backend/app/routers/verification.py`
- Create: `backend/tests/test_intl_identity.py`

The endpoint does:
1. Validate file type + size
2. Rate limit
3. Purge previous temp doc (same GDPR pattern as FR front-doc from PR #4)
4. `extract_mrz()` → 422 `MRZ_CHECKSUM_FAIL` if `mrz_valid=False`
5. Expiry check → 422 `PASSPORT_EXPIRED` if expired
6. Name fuzzy match (advisory; flags `name_mismatch` or `name_transliteration_mismatch`, never blocks)
7. Store in Redis (TTL 600s) if available → R2 fallback
8. Update `identity_data` with `identity_rail: "INTL"`, `status: "document_uploaded"`

- [ ] **Step 1: Write endpoint tests**

Create `backend/tests/test_intl_identity.py`:

```python
"""
Endpoint tests for INTL identity + solvency endpoints (Item 11).
Uses mock DB + mock services — no real I/O. Same pattern as test_verification_fixes.py.
"""
import io
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.routers.auth import get_current_user
from tests.conftest import make_mock_user, mock_get_db


_FAKE_JPEG = b"\xff\xd8\xff" + b"\x00" * 100  # minimal JPEG header


def make_client(mock_user):
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: mock_user
    target_app.dependency_overrides[get_db] = mock_get_db
    return TestClient(app)


def _valid_mrz_result():
    from app.services.mrz import MRZResult
    return MRZResult(
        surname="SMITH", given_names="JOHN",
        doc_number="A1234567", dob="900101", expiry="320101",
        mrz_valid=True, rescan_required=False,
        assurance="MEDIUM", extraction_path="ai",
    )


# ── POST /verification/intl/identity/upload ────────────────────────────────────

class TestIntlIdentityUpload:
    def test_valid_passport_200(self):
        user = make_mock_user("tenant")
        user.full_name = "John Smith"
        user.identity_data = None
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.mrz.extract_mrz", new=AsyncMock(return_value=_valid_mrz_result())), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = True
            mc.set = AsyncMock()
            mc.delete = AsyncMock(return_value=True)
            response = client.post(
                "/verification/intl/identity/upload",
                files={"file": ("p.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200
        stored = user.identity_data
        assert stored["status"] == "document_uploaded"
        assert stored["identity_rail"] == "INTL"
        assert "nationality" not in stored
        assert "redis_key" in stored

    def test_mrz_checksum_fail_returns_422(self):
        from app.services.mrz import MRZResult
        user = make_mock_user("tenant")
        user.identity_data = None
        client = make_client(user)

        bad = MRZResult(
            surname="", given_names="", doc_number="", dob="", expiry="",
            mrz_valid=False, rescan_required=True, assurance="MEDIUM",
            extraction_path="failed",
        )
        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.mrz.extract_mrz", new=AsyncMock(return_value=bad)), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = True
            mc.delete = AsyncMock(return_value=True)
            response = client.post(
                "/verification/intl/identity/upload",
                files={"file": ("p.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 422
        assert "MRZ_CHECKSUM_FAIL" in response.json()["detail"]

    def test_expired_passport_returns_422(self):
        from app.services.mrz import MRZResult
        user = make_mock_user("tenant")
        user.identity_data = None
        client = make_client(user)

        expired = MRZResult(
            surname="SMITH", given_names="JOHN",
            doc_number="A1234567", dob="900101", expiry="200101",  # 2020-01-01
            mrz_valid=True, rescan_required=False,
            assurance="MEDIUM", extraction_path="ai",
        )
        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.mrz.extract_mrz", new=AsyncMock(return_value=expired)), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = True
            mc.delete = AsyncMock(return_value=True)
            response = client.post(
                "/verification/intl/identity/upload",
                files={"file": ("p.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 422
        assert "PASSPORT_EXPIRED" in response.json()["detail"]

    def test_non_ascii_name_sets_transliteration_flag(self):
        """Arabic/Chinese profile name vs Latin MRZ → transliteration flag, not plain mismatch."""
        user = make_mock_user("tenant")
        user.full_name = "محمد علي"  # Arabic name
        user.identity_data = None
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.mrz.extract_mrz", new=AsyncMock(return_value=_valid_mrz_result())), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = True
            mc.set = AsyncMock()
            mc.delete = AsyncMock(return_value=True)
            response = client.post(
                "/verification/intl/identity/upload",
                files={"file": ("p.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200  # never blocked — advisory only
        stored = user.identity_data
        assert stored["name_transliteration_mismatch"] is True
        assert stored["name_mismatch"] is False
```

- [ ] **Step 2: Run tests — verify 404**

```bash
python -m pytest tests/test_intl_identity.py::TestIntlIdentityUpload -v 2>&1 | head -10
```
Expected: 404 (route not registered yet).

- [ ] **Step 3: Add the upload endpoint to verification.py**

Find the end of the last existing endpoint in `backend/app/routers/verification.py` (after the DPE/property endpoints section). Add the following block. Note: `extract_mrz` is imported inside the function to keep the module pattern consistent with existing endpoint code.

```python
# ── INTL rails ─────────────────────────────────────────────────────────────────

@router.post("/intl/identity/upload")
async def upload_intl_identity_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Passport upload for INTL MEDIUM rail: MRZ scan + expiry check + temp store."""
    import base64
    from datetime import date
    from difflib import SequenceMatcher
    from app.services.mrz import extract_mrz

    allowed = {"image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
    await _validate_file_size(file)
    content = await file.read()
    await _check_upload_rate_limit(str(current_user.id), "intl_identity")

    # Purge previous temp doc before overwriting pointer — GDPR (same pattern as FR front-doc)
    _prev = current_user.identity_data or {}
    if _prev.get("redis_key"):
        deleted = await cache.delete(str(_prev["redis_key"]))
        if not deleted:
            logger.warning("purge_intl_doc: redis delete failed for %s", _prev["redis_key"])
    elif _prev.get("storage_key"):
        try:
            await storage.delete_file(str(_prev["storage_key"]))
        except Exception as _exc:
            logger.warning("purge_intl_doc: storage delete failed for %s: %s", _prev["storage_key"], _exc)

    # MRZ extraction — AI primary, Tesseract fallback
    mrz = await extract_mrz(content, file.content_type or "image/jpeg")
    if not mrz.mrz_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "MRZ_CHECKSUM_FAIL — Le document ne peut pas être lu. Veuillez reprendre "
                "une photo nette de la page de données du passeport. / "
                "The document could not be read. Please retake a clear photo of the passport data page."
            ),
        )

    # Expiry check: YYMMDD where YY < 50 → 2000s, YY >= 50 → 1900s
    try:
        exp_yy = int(mrz.expiry[0:2])
        exp_year = 2000 + exp_yy if exp_yy < 50 else 1900 + exp_yy
        if date(exp_year, int(mrz.expiry[2:4]), int(mrz.expiry[4:6])) < date.today():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "PASSPORT_EXPIRED — Passeport expiré. Veuillez utiliser un passeport en cours "
                    "de validité. / Passport expired. Please use a valid passport."
                ),
            )
    except HTTPException:
        raise
    except Exception:
        pass  # malformed expiry date — not a hard block; surface advisory in UI if needed

    # Name match — advisory only, never blocks (same pattern as FR avis cross-check)
    name_mismatch = False
    name_transliteration_mismatch = False
    mrz_name = f"{mrz.surname} {mrz.given_names}".strip()
    if current_user.full_name and mrz_name:
        similarity = SequenceMatcher(
            None,
            current_user.full_name.upper(),
            mrz_name.upper(),
        ).ratio()
        if similarity < 0.6:
            if not current_user.full_name.isascii():
                name_transliteration_mismatch = True  # ID-9
            else:
                name_mismatch = True

    # Store temp doc in Redis (TTL 600s) or R2 fallback
    _redis_key = f"intl_passport:{current_user.id}:{secrets.token_hex(8)}"
    if cache.redis_client:
        await cache.set(
            _redis_key,
            {"b64": base64.b64encode(content).decode(), "content_type": file.content_type},
            ttl=600,
        )
        current_user.identity_data = {
            "verified": False,
            "upload_date": naive_utcnow().isoformat(),
            "redis_key": _redis_key,
            "identity_rail": "INTL",
            "status": "document_uploaded",
            "name_mismatch": name_mismatch,
            "name_transliteration_mismatch": name_transliteration_mismatch,
            "mrz_valid": True,
            "extraction_path": mrz.extraction_path,
        }
    else:
        from io import BytesIO
        r2 = await storage.upload_file(
            file_data=BytesIO(content),
            filename=file.filename or "passport.jpg",
            content_type=file.content_type or "image/jpeg",
            folder=f"verification/intl/identity/{current_user.id}",
        )
        current_user.identity_data = {
            "verified": False,
            "upload_date": naive_utcnow().isoformat(),
            "file_url": r2["url"],
            "storage_key": r2.get("key"),
            "identity_rail": "INTL",
            "status": "document_uploaded",
            "name_mismatch": name_mismatch,
            "name_transliteration_mismatch": name_transliteration_mismatch,
            "mrz_valid": True,
            "extraction_path": mrz.extraction_path,
        }

    current_user.identity_verified = False
    current_user.identity_status = "document_uploaded"
    await db.commit()
    await db.refresh(current_user)

    return {
        "message": (
            "Passeport scanné — veuillez compléter la vérification de vivacité. / "
            "Passport scanned — please complete the liveness check."
        ),
        "verified": False,
        "status": "document_uploaded",
        "identity_rail": "INTL",
        "name_mismatch": name_mismatch,
        "name_transliteration_mismatch": name_transliteration_mismatch,
    }
```

- [ ] **Step 4: Run upload tests**

```bash
python -m pytest tests/test_intl_identity.py::TestIntlIdentityUpload -v
```
Expected: all 4 pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/verification.py backend/tests/test_intl_identity.py
git commit -m "feat(intl): POST /verification/intl/identity/upload — MRZ scan + temp store"
```

---

## Task 6: `POST /verification/intl/identity/selfie` endpoint (TDD)

**Files:**
- Modify: `backend/app/routers/verification.py`
- Modify: `backend/tests/test_intl_identity.py`

Mirrors the FR `upload-selfie` flow: retrieve stored passport → `compare_faces` in `try/finally` (finally always purges) → emit MEDIUM credential.

- [ ] **Step 1: Add selfie endpoint tests**

Append to `backend/tests/test_intl_identity.py`:

```python
# ── POST /verification/intl/identity/selfie ────────────────────────────────────

class TestIntlIdentitySelfie:
    def test_face_match_emits_intl_medium_credential(self):
        """Face matches → 200, identity_assurance=MEDIUM, identity_rail=INTL, passport purged."""
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        user.identity_data = {
            "status": "document_uploaded",
            "storage_key": "intl-passport-key",
            "file_url": "https://example.com/passport.jpg",
            "identity_rail": "INTL",
        }
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.identity.IdentityVerificationService.compare_faces",
                   new=AsyncMock(return_value={"match": True, "confidence": 0.88, "reason": "ok"})), \
             patch("app.routers.verification.storage") as mock_storage, \
             patch("app.routers.verification.cache") as mc, \
             patch("app.routers.verification.httpx") as mock_httpx:
            mc.redis_client = None
            mock_resp = MagicMock()
            mock_resp.content = b"passport_bytes"
            mock_resp.headers = {"content-type": "image/jpeg"}
            mock_resp.raise_for_status = MagicMock()
            inner = MagicMock()
            inner.get = AsyncMock(return_value=mock_resp)
            ctx = MagicMock()
            ctx.__aenter__ = AsyncMock(return_value=inner)
            ctx.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = ctx
            mock_storage.delete_file = AsyncMock(return_value=True)

            response = client.post(
                "/verification/intl/identity/selfie",
                files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200
        stored = user.identity_data
        assert stored["identity_assurance"] == "MEDIUM"
        assert stored["identity_rail"] == "INTL"
        assert stored["verified"] is True
        assert "storage_key" not in stored
        assert "file_url" not in stored
        mock_storage.delete_file.assert_called_once_with("intl-passport-key")

    def test_face_mismatch_422_and_passport_purged(self):
        """Face mismatch → 422, passport doc purged regardless (GDPR)."""
        user = make_mock_user("tenant")
        user.identity_data = {
            "status": "document_uploaded",
            "storage_key": "intl-key-mismatch",
            "file_url": "https://example.com/pp.jpg",
            "identity_rail": "INTL",
        }
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.identity.IdentityVerificationService.compare_faces",
                   new=AsyncMock(return_value={"match": False, "confidence": 0.1, "reason": "mismatch"})), \
             patch("app.routers.verification.storage") as mock_storage, \
             patch("app.routers.verification.cache") as mc, \
             patch("app.routers.verification.httpx") as mock_httpx:
            mc.redis_client = None
            mock_resp = MagicMock()
            mock_resp.content = b"pp"
            mock_resp.headers = {"content-type": "image/jpeg"}
            mock_resp.raise_for_status = MagicMock()
            inner = MagicMock()
            inner.get = AsyncMock(return_value=mock_resp)
            ctx = MagicMock()
            ctx.__aenter__ = AsyncMock(return_value=inner)
            ctx.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = ctx
            mock_storage.delete_file = AsyncMock(return_value=True)

            response = client.post(
                "/verification/intl/identity/selfie",
                files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 422
        mock_storage.delete_file.assert_called_once_with("intl-key-mismatch")

    def test_compare_faces_exception_purges_passport(self):
        """compare_faces raises → 500, passport still purged via finally (GDPR)."""
        user = make_mock_user("tenant")
        user.identity_data = {
            "status": "document_uploaded",
            "storage_key": "intl-key-exception",
            "file_url": "https://example.com/pp.jpg",
            "identity_rail": "INTL",
        }
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.identity.IdentityVerificationService.compare_faces",
                   new=AsyncMock(side_effect=RuntimeError("GPU OOM"))), \
             patch("app.routers.verification.storage") as mock_storage, \
             patch("app.routers.verification.cache") as mc, \
             patch("app.routers.verification.httpx") as mock_httpx:
            mc.redis_client = None
            mock_resp = MagicMock()
            mock_resp.content = b"pp"
            mock_resp.headers = {"content-type": "image/jpeg"}
            mock_resp.raise_for_status = MagicMock()
            inner = MagicMock()
            inner.get = AsyncMock(return_value=mock_resp)
            ctx = MagicMock()
            ctx.__aenter__ = AsyncMock(return_value=inner)
            ctx.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = ctx
            mock_storage.delete_file = AsyncMock(return_value=True)

            response = client.post(
                "/verification/intl/identity/selfie",
                files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 500
        mock_storage.delete_file.assert_called_once_with("intl-key-exception")
```

- [ ] **Step 2: Run tests — verify 404**

```bash
python -m pytest tests/test_intl_identity.py::TestIntlIdentitySelfie -v 2>&1 | head -5
```

- [ ] **Step 3: Add the selfie endpoint to verification.py**

Append after the `/intl/identity/upload` handler:

```python
@router.post("/intl/identity/selfie")
async def upload_intl_identity_selfie(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Selfie face-match against stored INTL passport → MEDIUM identity credential."""
    import base64
    from app.services.identity import identity_service

    allowed = {"image/jpeg", "image/png", "image/jpg", "image/heic", "image/heif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
    await _validate_file_size(file)
    content = await file.read()
    await _check_upload_rate_limit(str(current_user.id), "intl_selfie")

    if not current_user.identity_data or current_user.identity_data.get("status") != "document_uploaded":
        raise HTTPException(
            status_code=400,
            detail="Upload passport first / Veuillez d'abord télécharger votre passeport.",
        )

    _id_data = current_user.identity_data or {}
    _redis_key = _id_data.get("redis_key")
    _storage_key = _id_data.get("storage_key")
    _file_url = _id_data.get("file_url")

    # Retrieve stored passport
    id_bytes: bytes = b""
    id_content_type = "image/jpeg"

    if _redis_key:
        cached = await cache.get(str(_redis_key))
        if cached and isinstance(cached, dict):
            id_bytes = base64.b64decode(cached["b64"])
            id_content_type = cached.get("content_type", "image/jpeg")

    if not id_bytes and _file_url:
        try:
            async with httpx.AsyncClient(timeout=15.0) as http:
                resp = await http.get(_file_url)
                resp.raise_for_status()
                id_bytes = resp.content
                id_content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
        except Exception as exc:
            logger.error("Failed to retrieve INTL passport for face compare: %s", exc)
            raise HTTPException(status_code=500, detail="Could not retrieve passport for comparison.")

    # Face-match in try/except/finally — finally always purges stored passport (GDPR)
    try:
        face_result = await identity_service.compare_faces(
            id_image=id_bytes,
            id_file_type=id_content_type,
            selfie=content,
            selfie_file_type=file.content_type or "image/jpeg",
        )
    except HTTPException:
        raise
    except Exception as _exc:
        logger.error("compare_faces failed (INTL): %s", _exc)
        raise HTTPException(status_code=500, detail="Face comparison failed.") from _exc
    finally:
        if _redis_key:
            deleted = await cache.delete(str(_redis_key))
            if not deleted:
                logger.warning("purge_intl_passport: redis delete failed for %s", _redis_key)
        elif _storage_key:
            try:
                await storage.delete_file(str(_storage_key))
            except Exception as _del:
                logger.warning("purge_intl_passport: storage delete failed for %s: %s", _storage_key, _del)

    if not face_result["match"] or face_result["confidence"] < 0.6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face does not match passport. {face_result['reason']}",
        )

    if not current_user.identity_verified:
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 30))
        )
        await db.refresh(current_user)

    prev = _id_data
    current_user.identity_verified = True
    current_user.identity_status = "verified"
    current_user.identity_data = {
        "verified": True,
        "verified_at": naive_utcnow().isoformat(),
        "status": "verified",
        "identity_assurance": "MEDIUM",
        "identity_rail": "INTL",
        "verification_method": "mrz_selfie",
        "mrz_valid": prev.get("mrz_valid", True),
        "name_mismatch": prev.get("name_mismatch", False),
        "name_transliteration_mismatch": prev.get("name_transliteration_mismatch", False),
        "face_match_confidence": face_result["confidence"],
        # storage_key, file_url, redis_key intentionally NOT carried forward
    }
    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Identité vérifiée (MEDIUM) / Identity verified (MEDIUM)",
        "verified": True,
        "status": "verified",
        "identity_assurance": "MEDIUM",
        "identity_rail": "INTL",
        "trust_score": current_user.trust_score,
    }
```

- [ ] **Step 4: Run selfie tests**

```bash
python -m pytest tests/test_intl_identity.py::TestIntlIdentitySelfie -v
```
Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/verification.py backend/tests/test_intl_identity.py
git commit -m "feat(intl): POST /verification/intl/identity/selfie — face-match + GDPR purge"
```

---

## Task 7: `POST /verification/intl/solvency` endpoint (TDD)

**Files:**
- Modify: `backend/app/routers/verification.py`
- Modify: `backend/tests/test_intl_identity.py`

The endpoint: file upload → AI income extraction → period normalisation → FX conversion → banded ratio → MEDIUM (or UNVERIFIED if FX unavailable). Raw amounts discarded after banding.

- [ ] **Step 1: Add solvency tests**

Append to `backend/tests/test_intl_identity.py`:

```python
# ── POST /verification/intl/solvency ──────────────────────────────────────────

def _fx_inr_live():
    from app.services.fx_normalise import FXResult
    return FXResult(
        eur_amount=836.0, currency="INR", rate=0.011,
        margin_applied=0.05, fx_source="live",
        fx_margin_label="currency volatility buffer",
    )


def _fx_unavailable():
    from app.services.fx_normalise import FXResult
    return FXResult(
        eur_amount=None, currency="XYZ", rate=None,
        margin_applied=0.05, fx_source="unavailable",
        fx_margin_label="currency volatility buffer",
    )


class TestIntlSolvency:
    def test_inr_income_returns_medium_solvency(self):
        """INR payslip → MEDIUM, fx_source present, no raw amounts in stored data."""
        user = make_mock_user("tenant")
        user.income_verified = False
        user.income_data = None
        client = make_client(user)

        ai_extraction = {
            "income_amount": 80000.0, "income_currency": "INR",
            "income_period": "monthly", "employee_name": "Test User",
            "document_type": "payslip",
        }

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.routers.verification._ai_extract_intl_income",
                   new=AsyncMock(return_value=ai_extraction)), \
             patch("app.services.fx_normalise.convert_to_eur",
                   new=AsyncMock(return_value=_fx_inr_live())), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = None
            response = client.post(
                "/verification/intl/solvency",
                data={"monthly_rent": "800"},
                files={"file": ("slip.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200
        stored = user.income_data
        assert stored["solvency_assurance"] == "MEDIUM"
        assert stored["income_currency"] == "INR"
        assert stored["fx_source"] == "live"
        assert stored["fx_margin_label"] == "currency volatility buffer"
        assert stored["décret_2015_1437_disclaimer"] is True
        # Raw amounts must NOT be stored
        assert "eur_amount" not in stored
        assert "income_amount" not in stored

    def test_unknown_currency_fx_unavailable_returns_200_unverified(self):
        """Unknown currency + API down → 200 (never blocked), solvency_assurance=UNVERIFIED."""
        user = make_mock_user("tenant")
        user.income_data = None
        client = make_client(user)

        ai_extraction = {
            "income_amount": 5000.0, "income_currency": "XYZ",
            "income_period": "monthly", "employee_name": "Test User",
            "document_type": "payslip",
        }

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.routers.verification._ai_extract_intl_income",
                   new=AsyncMock(return_value=ai_extraction)), \
             patch("app.services.fx_normalise.convert_to_eur",
                   new=AsyncMock(return_value=_fx_unavailable())), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = None
            response = client.post(
                "/verification/intl/solvency",
                files={"file": ("slip.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200
        assert user.income_data["solvency_assurance"] == "UNVERIFIED"

    def test_ai_extraction_failure_returns_422(self):
        """AI cannot extract income → 422 (not a silent failure)."""
        user = make_mock_user("tenant")
        user.income_data = None
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.routers.verification._ai_extract_intl_income",
                   new=AsyncMock(return_value=None)), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = None
            response = client.post(
                "/verification/intl/solvency",
                files={"file": ("slip.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 422
```

- [ ] **Step 2: Run tests — verify 404**

```bash
python -m pytest tests/test_intl_identity.py::TestIntlSolvency -v 2>&1 | head -5
```

- [ ] **Step 3: Add `_ai_extract_intl_income` helper to verification.py**

Add this function before the INTL endpoints section (after `_check_upload_rate_limit` helper):

```python
async def _ai_extract_intl_income(
    file_content: bytes, content_type: str, ai_client=None
) -> Optional[dict]:
    """Extract income data from a foreign income document via Gemini AI."""
    prompt = (
        "Extract income data from this foreign income document "
        "(payslip, tax return, bank statement, or equivalent).\n\n"
        "Return ONLY this JSON — no markdown:\n"
        '{"income_amount": <number or null>, "income_currency": "<ISO 4217>", '
        '"income_period": "monthly"|"annual"|"unknown", '
        '"employee_name": "<name or null>", '
        '"document_type": "payslip"|"tax_return"|"bank_statement"|"other"}\n\n'
        "Rules:\n"
        "- income_amount: the primary gross/net income figure (not deductions)\n"
        "- income_currency: must be ISO 4217 (INR, USD, GBP, CNY, JPY, etc.)\n"
        "- income_period: monthly for payslips, annual for tax returns\n"
        "- Return null for income_amount if you cannot determine it"
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
                logger.warning("AI intl income extraction (%s) failed: %s", model, _exc)
    except Exception as _exc:
        logger.error("_ai_extract_intl_income crashed: %s", _exc)
    return None
```

- [ ] **Step 4: Add the solvency endpoint to verification.py**

Append after the `/intl/identity/selfie` handler:

```python
@router.post("/intl/solvency")
async def upload_intl_solvency_document(
    file: UploadFile = File(...),
    monthly_rent: Optional[float] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foreign income doc → FX-normalised banded solvency → MEDIUM (or UNVERIFIED if FX unavailable)."""
    from app.services.fx_normalise import convert_to_eur, normalise_income_to_monthly, band_solvency_ratio

    allowed = {"image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
    await _validate_file_size(file)
    content = await file.read()
    await _check_upload_rate_limit(str(current_user.id), "intl_solvency")

    extraction = await _ai_extract_intl_income(content, file.content_type or "image/jpeg")
    if not extraction or extraction.get("income_amount") is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Impossible d'extraire les revenus du document. / "
                "Could not extract income from document."
            ),
        )

    raw_amount = float(extraction["income_amount"])
    currency = str(extraction.get("income_currency", "EUR")).upper()
    income_period = str(extraction.get("income_period", "unknown"))

    monthly_amount, normalised_period, period_unclear = normalise_income_to_monthly(
        raw_amount, income_period
    )

    fx = await convert_to_eur(monthly_amount, currency)

    # Band ratio — raw amounts discarded after this point (data minimisation)
    if fx.eur_amount is not None and monthly_rent and monthly_rent > 0:
        solvency_ratio = band_solvency_ratio(fx.eur_amount / monthly_rent)
        solvency_assurance = "MEDIUM"
    elif fx.eur_amount is not None:
        solvency_ratio = "income_only"
        solvency_assurance = "MEDIUM"
    else:
        solvency_ratio = "unavailable"
        solvency_assurance = "UNVERIFIED"

    current_user.income_verified = fx.eur_amount is not None
    current_user.income_status = "verified" if fx.eur_amount is not None else "unverified"
    current_user.income_data = {
        "verified": current_user.income_verified,
        "upload_date": naive_utcnow().isoformat(),
        "solvency_assurance": solvency_assurance,
        "solvency_ratio": solvency_ratio,
        "income_currency": currency,
        "income_period": income_period,
        "income_period_normalised": normalised_period,
        "income_period_unclear": period_unclear,
        "fx_source": fx.fx_source,
        "fx_margin_applied": fx.margin_applied,
        "fx_margin_label": fx.fx_margin_label,
        "décret_2015_1437_disclaimer": True,
        "status": current_user.income_status,
        # raw eur_amount, raw foreign amount intentionally NOT stored
    }

    if fx.eur_amount is not None and not current_user.income_verified:
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 20))
        )
        await db.refresh(current_user)

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Revenus vérifiés / Income verified",
        "verified": current_user.income_verified,
        "solvency_assurance": solvency_assurance,
        "solvency_ratio": solvency_ratio,
        "income_currency": currency,
        "fx_source": fx.fx_source,
        "décret_2015_1437_disclaimer": True,
        "trust_score": current_user.trust_score,
    }
```

- [ ] **Step 5: Run solvency tests**

```bash
python -m pytest tests/test_intl_identity.py::TestIntlSolvency -v
```
Expected: all 3 pass.

- [ ] **Step 6: Run full suite — verify no regressions**

```bash
cd backend && python -m pytest tests/ -q
```
Expected: all pass. If any existing test fails, fix the regression before continuing.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/verification.py backend/tests/test_intl_identity.py
git commit -m "feat(intl): POST /verification/intl/solvency — FX normalise + banded ratio"
```

---

## Task 8: DOSSIER update

**Files:**
- Modify: `docs/features/trust-layer/DOSSIER.md`

- [ ] **Step 1: Update identity edge-case table**

Find the identity edge-case table in DOSSIER.md (section on identity edge cases / §ID rows). Update rows ID-5 through ID-9:

| Row | Find | Replace with |
|---|---|---|
| ID-5 | whatever the current text says | `\| ID-5 \| Web NFC cannot read passport chip (impossible on web) \| `assurance: "MEDIUM"` hard-coded — no path emits HIGH \| ✅ `assurance` field set to `"MEDIUM"` unconditionally in `extract_mrz`; `_FAILED_RESULT` also uses MEDIUM \|` |
| ID-6 | current text | `\| ID-6 \| MRZ checksum (ICAO mod-10) fails \| re-scan prompt \| ✅ `_validate_checksums` in `mrz.py`; AI pass 1 → Tesseract pass 2 → 422 `MRZ_CHECKSUM_FAIL` bilingual if both fail \|` |
| ID-7 | current text | `\| ID-7 \| Passport without NFC chip (older book) \| MEDIUM labelled, user not blocked \| ✅ MRZ parsed normally → `identity_assurance: "MEDIUM"`; chip presence irrelevant on web path \|` |
| ID-8 | current text | `\| ID-8 \| Liveness spoof (photo-of-photo / replay) \| face-match rejects obvious spoofs \| 🟡 AI face-match rejects clear spoofs; true replay detection not possible with MEDIUM OSS path — pre-existing gap, same as FR rail \|` |
| ID-9 | current text | `\| ID-9 \| Non-Latin name in profile (Arabic, Chinese, Devanagari…) \| MRZ is always Latin (ICAO); surface transliteration flag \| ✅ `name_transliteration_mismatch: true` when `full_name` is non-ASCII + fuzzy match < 0.6; MEDIUM still granted — never blocks \|` |

- [ ] **Step 2: Update solvency edge-case table**

Find SV-5 through SV-8 rows. Update:

| Row | Replace with |
|---|---|
| SV-5 | `\| SV-5 \| Foreign income doc not in loi 89 art. 22-2 list \| MEDIUM + Décret 2015-1437 disclaimer \| ✅ `POST /intl/solvency`; `décret_2015_1437_disclaimer: true` stored in `income_data` \|` |
| SV-6 | `\| SV-6 \| FX volatility over lease term \| 5% margin labelled "currency volatility buffer" \| ✅ `_MARGIN = 0.05`, `fx_margin_label = "currency volatility buffer"` in `fx_normalise.py`; never varies by currency \|` |
| SV-7 | `\| SV-7 \| Income just under 3.0× threshold after margin \| Band honestly, never round up \| ✅ `band_solvency_ratio()` — post-margin figure banded; 2.97 → ">=2.0" not ">=3.0" (unit tested) \|` |
| SV-8 analog | `\| SV-8a \| Foreign doc shows annual figure \| ÷12 or flag unclear \| ✅ `normalise_income_to_monthly()` — annual ÷12; unknown → no division + `income_period_unclear: true` (conservative) \|` |

- [ ] **Step 3: Update Item 11 in the open-items / phase list**

Find the Item 11 line (currently shows ❌ or blocked). Replace with:

```
11. 🟡 **INTL rails** — MEDIUM rail shipped (2026-06-15): `mrz.py` hybrid AI+Tesseract+checksum; `fx_normalise.py` Frankfurter→static→UNVERIFIED; 3 endpoints: `POST /verification/intl/identity/upload`, `/intl/identity/selfie`, `/intl/solvency`. HIGH (NFC chip / Passive Auth) still blocked on CSCA master-list assembly. Spec: `docs/superpowers/specs/2026-06-15-intl-rails-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/features/trust-layer/DOSSIER.md
git commit -m "docs(dossier): mark Item 11 INTL MEDIUM rail shipped; update ID-5/6/7/8/9 + SV-5/6/7/SV-8a"
```

---

## Task 9: Open PR

- [ ] **Step 1: Final full suite run**

```bash
cd backend && python -m pytest tests/ -q
```
Expected: all pass, 0 errors.

- [ ] **Step 2: Push branch**

```bash
cd .. && git push -u origin feat/intl-rails
```

(Run from the worktree root `../rental-platform-intl-rails`, not the main repo.)

- [ ] **Step 3: Create PR**

```bash
gh pr create \
  --title "feat(intl): INTL MEDIUM rail — MRZ hybrid OCR + FX-normalised solvency (Item 11)" \
  --body "$(cat <<'EOF'
## Summary

- **mrz.py**: Gemini AI-primary MRZ extraction → ICAO mod-10 checksum validation → pytesseract fallback if AI fails; `assurance` hard-coded to `"MEDIUM"`; nationality extracted for checksum only, never stored (GDPR art. 9)
- **fx_normalise.py**: Frankfurter live API → Redis 24h cache → static 29-currency table → UNVERIFIED; 5% margin labelled `"currency volatility buffer"` (art. 225-2 safe, never varies by country)
- **3 new endpoints**: `POST /verification/intl/identity/upload`, `/intl/identity/selfie`, `/intl/solvency` — all stateless verify-and-forget; passport purged in `finally` regardless of face-match outcome
- Edge cases covered: ID-5 (assurance guard), ID-6 (checksum fail → 422), ID-7 (chipless passport), ID-9 (transliteration flag), SV-5 (Décret 2015-1437 disclaimer), SV-6 (FX margin label), SV-7 (honest banding), SV-8a (annual÷12)
- ID-8 (replay liveness spoof): pre-existing gap, same as FR rail — not regressed

## Test plan
- [ ] `pytest backend/tests/ -q` — all pass
- [ ] `POST /intl/identity/upload` valid passport → 200, `identity_rail=INTL`, no nationality in DB
- [ ] `POST /intl/identity/upload` corrupted MRZ → 422 `MRZ_CHECKSUM_FAIL`
- [ ] `POST /intl/identity/upload` expired passport → 422 `PASSPORT_EXPIRED`
- [ ] `POST /intl/identity/upload` Arabic profile name → 200, `name_transliteration_mismatch=true`
- [ ] `POST /intl/identity/selfie` face match → 200, `identity_assurance=MEDIUM`, passport purged from storage
- [ ] `POST /intl/identity/selfie` face mismatch → 422, passport purged (GDPR)
- [ ] `POST /intl/identity/selfie` compare_faces exception → 500, passport purged (GDPR)
- [ ] `POST /intl/solvency` INR income → `solvency_assurance=MEDIUM`, `fx_source` present, no raw amounts in DB
- [ ] `POST /intl/solvency` unknown currency + Frankfurter down → 200, `solvency_assurance=UNVERIFIED`
- [ ] `POST /intl/solvency` AI extraction fails → 422

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Reference

- Spec: [`docs/superpowers/specs/2026-06-15-intl-rails-design.md`](docs/superpowers/specs/2026-06-15-intl-rails-design.md)
- Existing selfie pattern (FR): `backend/app/routers/verification.py` (search `"selfie"`)
- Redis/cache API: `backend/app/core/cache.py` — `cache.set(key, data, ttl)`, `cache.get(key)`, `cache.delete(key) → bool`
- Storage API: `backend/app/services/storage.py` — `storage.upload_file(file_data, filename, content_type, folder) → {"url", "key", "size", "storage"}`, `storage.delete_file(key) → bool`
- `compare_faces`: `backend/app/services/identity.py` — `identity_service.compare_faces(id_image, id_file_type, selfie, selfie_file_type) → {"match": bool, "confidence": float, "reason": str}`
- `make_mock_user`, `mock_get_db`: `backend/tests/conftest.py`
- `make_client` pattern: copy from `backend/tests/test_verification_fixes.py:22-28`
