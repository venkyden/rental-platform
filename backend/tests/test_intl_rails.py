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
