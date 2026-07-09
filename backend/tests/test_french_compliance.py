"""
Unit tests for French rent-control (encadrement des loyers) enforcement.

These are pure-function tests (no DB) for app.services.french_compliance,
which gates property publication. AAA structure: Arrange / Act / Assert.
"""

from app.services.french_compliance import validate_rent_control


# ── Happy path ────────────────────────────────────────────────────────────

def test_rent_within_majored_reference_is_compliant():
    # Arrange: 30 m² flat, rent 600€ -> 20€/m², majored ref 25€/m²
    # Act
    err = validate_rent_control(600, 30, 25, None, None)
    # Assert
    assert err is None


def test_no_reference_rent_recorded_cannot_be_assessed():
    # Arrange: zone reference not on file (majored None) -> not assessable
    # Act
    err = validate_rent_control(2000, 20, None, None, None)
    # Assert
    assert err is None


def test_rent_over_majored_with_justification_is_allowed():
    # Arrange: 20€/m² over a 15€/m² cap, but a justified supplement is provided
    # Act
    err = validate_rent_control(600, 30, 15, 150, "Exceptional terrace and river view")
    # Assert
    assert err is None


# ── Error cases ───────────────────────────────────────────────────────────

def test_rent_over_majored_without_justification_is_rejected():
    # Arrange: 30€/m² well above a 20€/m² cap, no justification
    # Act
    err = validate_rent_control(900, 30, 20, None, None)
    # Assert
    assert err is not None
    assert "encadrement" in err.lower() or "reference" in err.lower()


def test_declared_complement_without_justification_is_rejected():
    # Arrange: a supplement is declared but no justification text
    # Act
    err = validate_rent_control(500, 30, 100, 80, "   ")
    # Assert
    assert err is not None
    assert "complément" in err.lower() or "supplement" in err.lower()


# ── Edge cases ────────────────────────────────────────────────────────────

def test_zero_surface_does_not_crash():
    # Arrange: surface 0 would divide by zero if unguarded
    # Act
    err = validate_rent_control(900, 0, 20, None, None)
    # Assert
    assert err is None


def test_none_inputs_are_safe():
    # Act
    err = validate_rent_control(None, None, None, None, None)
    # Assert
    assert err is None


def test_one_cent_tolerance_not_rejected():
    # Arrange: rent per m² exactly at the cap (boundary)
    # Act
    err = validate_rent_control(20 * 30, 30, 20, None, None)
    # Assert
    assert err is None


# ── Deposit cap: hors charges (loi 1989 Art. 22) ──────────────────────────

from types import SimpleNamespace
from app.services.french_compliance import validate_property_compliance


def _prop(**kw):
    """Minimal property stub; only the fields the compliance check reads."""
    base = dict(
        deposit=None, monthly_rent=None, charges=None, charges_included=False,
        furnished=False, size_sqm=30,
        loyer_reference_majore=None, complement_de_loyer=None,
        complement_de_loyer_justification=None, dpe_rating="D",
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_deposit_cap_uses_rent_hors_charges_when_charges_included():
    # 1000€ CC incl. 100€ charges -> 900€ HC -> unfurnished cap = 900€.
    # A 1000€ deposit is over the legal max and must be rejected.
    errors = validate_property_compliance(
        _prop(deposit=1000, monthly_rent=1000, charges=100, charges_included=True)
    )
    assert any("hors charges" in e for e in errors), errors


def test_deposit_at_hors_charges_cap_is_compliant():
    # Same listing, deposit exactly 900€ (1 month HC) -> compliant.
    errors = validate_property_compliance(
        _prop(deposit=900, monthly_rent=1000, charges=100, charges_included=True)
    )
    assert errors == []


def test_deposit_cap_ignores_charges_when_rent_is_hors_charges():
    # charges_included=False -> monthly_rent is already HC; full amount is the base.
    errors = validate_property_compliance(
        _prop(deposit=1000, monthly_rent=1000, charges=100, charges_included=False)
    )
    assert errors == []
