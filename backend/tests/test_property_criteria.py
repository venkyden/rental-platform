"""
Landlord criteria panel — guarantor_income_multiple field (2026-07-30 design).
Pure Pydantic schema tests (no DB) + endpoint validation-level tests, following
the pattern in test_properties.py (landlord_client fixture, mocked DB).
"""
from decimal import Decimal

import pytest

from app.models.property_schemas import PropertyCreate, PropertyUpdate, PropertyResponse


def _base_create_payload(**overrides):
    payload = {
        "title": "Bel Appartement Paris 15e",
        "property_type": "apartment",
        "address_line1": "15 Rue de Vaugirard",
        "city": "Paris",
        "postal_code": "75015",
        "monthly_rent": Decimal("1500"),
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
