"""Unit tests for guarantor_compliance.py — pure function, no I/O."""

import pytest
from datetime import date

from app.services.guarantor_compliance import (
    GuarantorCertData,
    assess_guarantor_cert,
)

TODAY = date(2026, 6, 12)


def _valid_visale(
    cert_id="VS-2025-123456",
    guaranteed_amount=1200.0,
    validity_date=date(2027, 1, 1),
    tenant_name="Jean Dupont",
    institution="Visale",
):
    return GuarantorCertData(
        cert_id=cert_id,
        guaranteed_amount=guaranteed_amount,
        validity_date=validity_date,
        tenant_name=tenant_name,
        institution=institution,
    )


# --- Happy path ---

def test_valid_visale_cert_no_warnings():
    a = assess_guarantor_cert("visale", _valid_visale(), "Jean Dupont", TODAY)
    error_warnings = [w for w in a.warnings if w.severity == "error"]
    assert not error_warnings
    assert a.name_matched is True
    assert a.expired is False
    assert a.assurance == "MEDIUM"
    assert a.cert_ref == "VS-2025-123456"
    assert a.guaranteed_amount == 1200.0


def test_valid_garantme_cert():
    cert = GuarantorCertData(
        cert_id="GM-REF-789",
        guaranteed_amount=900.0,
        validity_date=date(2027, 6, 1),
        tenant_name="Marie Martin",
        institution="Garantme",
    )
    a = assess_guarantor_cert("garantme", cert, "Marie Martin", TODAY)
    error_warnings = [w for w in a.warnings if w.severity == "error"]
    assert not error_warnings
    assert a.cert_ref == "GM-REF-789"
    assert a.name_matched is True


# --- Expiry ---

def test_expired_cert_produces_error_warning():
    cert = _valid_visale(validity_date=date(2026, 6, 11))  # yesterday
    a = assess_guarantor_cert("visale", cert, "Jean Dupont", TODAY)
    codes = [w.code for w in a.warnings]
    assert "CERT_EXPIRED" in codes
    assert any(w.severity == "error" for w in a.warnings if w.code == "CERT_EXPIRED")
    assert a.expired is True


def test_cert_expiring_today_is_not_expired():
    cert = _valid_visale(validity_date=TODAY)
    a = assess_guarantor_cert("visale", cert, "Jean Dupont", TODAY)
    assert a.expired is False
    assert all(w.code != "CERT_EXPIRED" for w in a.warnings)


def test_no_validity_date_is_not_expired():
    cert = _valid_visale(validity_date=None)
    a = assess_guarantor_cert("visale", cert, "Jean Dupont", TODAY)
    assert a.expired is False


# --- Name mismatch ---

def test_name_mismatch_produces_error_warning():
    cert = _valid_visale(tenant_name="Pierre Durand")
    a = assess_guarantor_cert("visale", cert, "Jean Dupont", TODAY)
    codes = [w.code for w in a.warnings]
    assert "NAME_MISMATCH" in codes
    assert a.name_matched is False


def test_minor_name_variation_passes():
    # Accent differences / short form
    cert = _valid_visale(tenant_name="jean dupont")
    a = assess_guarantor_cert("visale", cert, "Jean Dupont", TODAY)
    assert a.name_matched is True


# --- Missing fields (info-only, not errors) ---

def test_missing_cert_id_is_info_not_error():
    cert = _valid_visale(cert_id=None)
    a = assess_guarantor_cert("visale", cert, "Jean Dupont", TODAY)
    codes_by_sev = {w.code: w.severity for w in a.warnings}
    assert codes_by_sev.get("CERT_ID_NOT_EXTRACTED") == "info"
    error_warnings = [w for w in a.warnings if w.severity == "error"]
    assert not error_warnings  # cert is still accepted


def test_missing_amount_is_info_not_error():
    cert = _valid_visale(guaranteed_amount=None)
    a = assess_guarantor_cert("visale", cert, "Jean Dupont", TODAY)
    codes_by_sev = {w.code: w.severity for w in a.warnings}
    assert codes_by_sev.get("AMOUNT_NOT_EXTRACTED") == "info"
    error_warnings = [w for w in a.warnings if w.severity == "error"]
    assert not error_warnings
