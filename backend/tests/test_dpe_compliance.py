"""
Unit tests for DPE décence-énergétique compliance (loi Climat) + class accuracy.

Pure-function tests (no DB) for app.services.dpe_compliance. AAA structure.
Legal calendar: G prohibited from 2025-01-01, F from 2028-01-01, E from 2034-01-01.
"""
from datetime import date

from app.services.dpe_compliance import assess_dpe


def test_class_g_today_is_prohibited_and_requires_ack():
    a = assess_dpe("G", None, None, False, date(2026, 6, 10))
    assert a.authoritative_class == "G"
    assert a.class_source == "self_declared"
    assert a.requires_acknowledgment is True
    assert any(w.code == "DECENCE_PROHIBITED" for w in a.warnings)


def test_class_f_today_is_allowed_but_flagged_upcoming():
    a = assess_dpe("F", None, None, False, date(2026, 6, 10))
    assert a.requires_acknowledgment is False
    codes = {w.code for w in a.warnings}
    assert "DECENCE_PROHIBITED" not in codes
    assert "DECENCE_UPCOMING" in codes


def test_class_f_becomes_prohibited_in_2028():
    a = assess_dpe("F", None, None, False, date(2028, 6, 1))
    assert a.requires_acknowledgment is True
    assert any(w.code == "DECENCE_PROHIBITED" for w in a.warnings)


def test_class_e_prohibited_from_2034():
    before = assess_dpe("E", None, None, False, date(2033, 12, 31))
    after = assess_dpe("E", None, None, False, date(2034, 1, 1))
    assert before.requires_acknowledgment is False
    assert after.requires_acknowledgment is True


def test_expired_dpe_requires_ack():
    a = assess_dpe("C", None, None, True, date(2026, 6, 10))
    assert a.requires_acknowledgment is True
    assert any(w.code == "DPE_EXPIRED" for w in a.warnings)


def test_high_ademe_class_overrides_self_typed():
    # Landlord typed F, but ADEME says G (post-reclassification)
    a = assess_dpe("F", "G", "HIGH", False, date(2026, 6, 10))
    assert a.authoritative_class == "G"
    assert a.class_source == "ademe_verified"
    assert a.requires_acknowledgment is True


def test_non_high_ademe_does_not_override():
    # PENDING/UNVERIFIED assurance must not be trusted over self-typed
    a = assess_dpe("D", "G", "UNVERIFIED", False, date(2026, 6, 10))
    assert a.authoritative_class == "D"
    assert a.class_source == "self_declared"


def test_self_declared_class_is_flagged_unverified():
    a = assess_dpe("D", None, None, False, date(2026, 6, 10))
    assert a.class_source == "self_declared"
    assert any(w.code == "SELF_DECLARED_UNVERIFIED" for w in a.warnings)


def test_no_class_anywhere():
    a = assess_dpe(None, None, None, None, date(2026, 6, 10))
    assert a.authoritative_class is None
    assert a.class_source == "none"
    assert a.requires_acknowledgment is False


def test_warnings_are_bilingual():
    a = assess_dpe("G", None, None, False, date(2026, 6, 10))
    w = next(w for w in a.warnings if w.code == "DECENCE_PROHIBITED")
    assert w.en and w.fr
    assert "G" in w.en
