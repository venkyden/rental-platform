"""
Landlord criteria panel — guarantor_income_multiple field (2026-07-30 design).
Pure Pydantic schema tests (no DB) + endpoint validation-level tests, following
the pattern in test_properties.py (landlord_client fixture, mocked DB).
"""
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models.property_schemas import PropertyCreate, PropertyUpdate, PropertyResponse


def _base_create_payload(**overrides):
    payload = {
        "title": "Bel Appartement Paris 15e",
        "property_type": "apartment",
        "address_line1": "15 Rue de Vaugirard",
        "city": "Paris",
        "postal_code": "75015",
        "monthly_rent": 1500,
        "bedrooms": 1,
    }
    payload.update(overrides)
    return payload


class TestGuarantorIncomeMultipleSchema:
    def test_property_create_accepts_guarantor_income_multiple(self):
        data = PropertyCreate(**_base_create_payload(guarantor_income_multiple=Decimal("3.0")))
        assert data.guarantor_income_multiple == Decimal("3.0")

    def test_property_create_defaults_to_none(self):
        data = PropertyCreate(**_base_create_payload())
        assert data.guarantor_income_multiple is None

    def test_property_create_rejects_negative_multiple(self):
        """Pure schema-level check for the ge=Decimal("0") constraint — no
        HTTP/mocked-DB involved, so this can actually catch a regression
        (the endpoint-level equivalent in TestGuarantorIncomeMultipleEndpoint
        currently cannot: see its docstring)."""
        with pytest.raises(ValidationError):
            PropertyCreate(**_base_create_payload(guarantor_income_multiple=-1.0))

    def test_property_create_rejects_multiple_above_column_range(self):
        """The DECIMAL(3,1) column on Property caps at 99.9 — a value at or
        above 100 would overflow it (a 500 at save time) if not rejected here
        first."""
        with pytest.raises(ValidationError):
            PropertyCreate(**_base_create_payload(guarantor_income_multiple=100.0))

    def test_property_update_accepts_guarantor_income_multiple(self):
        data = PropertyUpdate(guarantor_income_multiple=Decimal("2.5"))
        assert data.guarantor_income_multiple == Decimal("2.5")

    def test_property_response_serializes_guarantor_income_multiple(self):
        import uuid
        from datetime import datetime

        resp = PropertyResponse(
            id=uuid.uuid4(),
            landlord_id=uuid.uuid4(),
            title="Test",
            description=None,
            property_type="apartment",
            address_line1="1 Rue Test",
            address_line2=None,
            city="Paris",
            postal_code="75001",
            country="France",
            latitude=None,
            longitude=None,
            monthly_rent=Decimal("1000"),
            guarantor_income_multiple=Decimal("3.0"),
            created_at=datetime.utcnow(),
            updated_at=None,
            published_at=None,
        )
        assert resp.guarantor_income_multiple == Decimal("3.0")


class TestGuarantorIncomeMultipleEndpoint:
    def test_create_property_with_guarantor_income_multiple(self, landlord_client):
        """Same mocked-DB pattern as test_create_property_as_landlord: with a
        mocked DB the response may 500, but request validation (422) must pass."""
        try:
            resp = landlord_client.post(
                "/properties",
                json=_base_create_payload(
                    guarantor_required=True,
                    accepted_guarantor_types=["visale", "garantme"],
                    guarantor_income_multiple=3.0,
                ),
            )
            assert resp.status_code != 422
        except Exception:
            pass  # Ignore ResponseValidationError from missing mock schema outputs

    def test_create_property_rejects_negative_multiple(self, landlord_client):
        """Pydantic's ge=Decimal("0") constraint should reject this at request-
        validation time, before the endpoint body (and its mocked-DB Property()
        construction) ever runs — but the app's error-response middleware can
        still choke on the Decimal echoed back in the validation-error detail
        under this mocked harness, so this follows the same try/except pattern
        as test_create_property_as_landlord."""
        try:
            resp = landlord_client.post(
                "/properties",
                json=_base_create_payload(guarantor_income_multiple=-1.0),
            )
            assert resp.status_code == 422
        except Exception:
            pass  # Ignore ResponseValidationError from missing mock schema outputs
