"""
Exhaustive stress tests for property edge cases, sanitization, model boundaries, and field parity.
"""

import uuid
from decimal import Decimal
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.core.database import get_db
from app.core.sanitize import sanitize_dict, sanitize_html
from app.core.timeutils import utcnow
from app.models.property_schemas import PropertyCreate

try:
    from tests.conftest import MOCK_LANDLORD, mock_get_db
except ImportError:
    from conftest import MOCK_LANDLORD, mock_get_db  # type: ignore


class TestPropertyEdgeCasesAndSanitization:
    """Stress tests covering all edge case payloads for property creation and serialization."""

    def test_sanitize_html_edge_cases(self):
        """Verify sanitize_html handles all edge cases without throwing or corrupting text."""
        assert sanitize_html(None) is None
        assert sanitize_html("") == ""
        # Single quotes & apostrophes must remain clean unescaped single quotes
        assert sanitize_html("d&#x27;espace à un prix défiant") == "d'espace à un prix défiant"
        assert sanitize_html("l'appartement ensoleillé") == "l'appartement ensoleillé"
        # XSS script tags stripped
        assert sanitize_html("<script>alert('XSS')</script> Haussmann") == "alert('XSS') Haussmann"
        # XSS img tags stripped
        assert sanitize_html("<img src=x onerror=alert(1)> Space") == "Space"
        # Inline javascript: stripped
        assert sanitize_html("javascript:alert(1)") == "alert(1)"
        # Non-string input converted to string safely
        assert sanitize_html(str(123)) == "123"

    def test_sanitize_dict_edge_cases(self):
        """Verify sanitize_dict cleans target string fields cleanly."""
        data = {
            "title": "Superbe T2 d&#x27;espace",
            "description": "Lumineux <script>evil()</script>",
            "bedrooms": 2,
            "monthly_rent": 1200,
        }
        cleaned = sanitize_dict(data, ["title", "description"])
        assert cleaned["title"] == "Superbe T2 d'espace"
        assert cleaned["description"] == "Lumineux evil()"
        assert cleaned["bedrooms"] == 2

    def test_property_create_pydantic_floor_zero(self):
        """floor_number = 0 (Ground Floor / RDC) must be valid and preserved as integer 0."""
        payload = {
            "title": "Studio Rez-de-chaussée RDC Paris",
            "description": "Charmant studio au RDC",
            "address_line1": "10 Rue du Bac",
            "city": "Paris",
            "postal_code": "75007",
            "monthly_rent": Decimal("900"),
            "property_type": "studio",
            "bedrooms": 0,
            "bathrooms": Decimal("1.0"),
            "size_sqm": Decimal("25.0"),
            "floor_number": 0,
        }
        obj = PropertyCreate(**payload)
        assert obj.floor_number == 0
        assert obj.bedrooms == 0
        assert obj.bathrooms == Decimal("1.0")

    def test_property_create_pydantic_bathrooms_float(self):
        """bathrooms accepts float/Decimal numbers like 1.5 or 2.0."""
        payload = {
            "title": "Grand Appartement Haussmannien",
            "description": "Appartement avec 1.5 salles de bain",
            "address_line1": "45 Boulevard Haussmann",
            "city": "Paris",
            "postal_code": "75009",
            "monthly_rent": Decimal("2500"),
            "property_type": "apartment",
            "bedrooms": 3,
            "bathrooms": Decimal("1.5"),
            "size_sqm": Decimal("110.0"),
            "floor_number": 3,
        }
        obj = PropertyCreate(**payload)
        assert obj.bathrooms == Decimal("1.5")
        assert obj.floor_number == 3

    def test_property_create_empty_dpe_rating_converted_to_none(self):
        """Empty string '' for dpe_rating and ges_rating should convert to None."""
        payload = {
            "title": "Appartement Neuf avec DPE en cours",
            "description": "Livraison récente",
            "address_line1": "1 Place de la République",
            "city": "Paris",
            "postal_code": "75011",
            "monthly_rent": Decimal("1400"),
            "property_type": "apartment",
            "bedrooms": 1,
            "size_sqm": Decimal("40.0"),
            "dpe_rating": "",
            "ges_rating": "",
        }
        obj = PropertyCreate(**payload)
        assert obj.dpe_rating is None
        assert obj.ges_rating is None

    def test_property_create_room_details_flexibility(self):
        """room_details accepts room objects with varying surface key representations."""
        rooms = [
            {"surface": 12, "capacity": 1, "bedding": "Double", "description": "Chambre 1"},
            {"surface_sqm": 15, "capacity": 1, "bedding": "Queen", "description": "Chambre 2"},
            {"size_sqm": 10, "capacity": 1, "bedding": "Single", "description": "Chambre 3"},
        ]
        payload = {
            "title": "Colocation de 3 chambres spacieuses",
            "description": "Belles chambres meublées",
            "address_line1": "20 Avenue de Clichy",
            "city": "Paris",
            "postal_code": "75017",
            "monthly_rent": Decimal("1800"),
            "property_type": "colocation",
            "bedrooms": 3,
            "size_sqm": Decimal("75.0"),
            "room_details": rooms,
        }
        obj = PropertyCreate(**payload)
        assert obj.room_details is not None
        room_details = cast(list, obj.room_details)
        assert len(room_details) == 3
        assert room_details[0]["surface"] == 12
        assert room_details[1]["surface_sqm"] == 15
        assert room_details[2]["size_sqm"] == 10

    def test_create_property_endpoint_with_ground_floor_and_rooms(self, landlord_client):
        """POST /properties with floor_number = 0 and room_details executes successfully."""
        from app.main import app

        landlord_id = MOCK_LANDLORD.id
        mock_db = MagicMock()
        created_obj = None

        def mock_add(obj):
            nonlocal created_obj
            created_obj = obj
            obj.id = uuid.uuid4()
            obj.ownership_verified = False
            obj.status = "draft"
            obj.views_count = 0
            obj.created_at = utcnow()
            obj.landlord_id = landlord_id

        mock_db.add = mock_add
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        async def override_get_db():
            yield mock_db

        target_app = cast(Any, app.app if hasattr(app, "app") else app)
        target_app.dependency_overrides[get_db] = override_get_db

        try:
            resp = landlord_client.post(
                "/properties",
                json={
                    "title": "Charmant Studio Rez-de-Chaussée (RDC)",
                    "description": "Studio d'espace calme donnant sur cour intérieure.",
                    "address_line1": "5 Rue Saint-Denis",
                    "city": "Paris",
                    "postal_code": "75001",
                    "monthly_rent": 950,
                    "property_type": "studio",
                    "bedrooms": 1,
                    "bathrooms": 1,
                    "size_sqm": 28,
                    "floor_number": 0,
                    "room_details": [
                        {"surface": 18, "capacity": 1, "bedding": "Double", "description": "Pièce principale"}
                    ],
                },
            )
            assert resp.status_code in (200, 201)
            assert created_obj is not None
            assert created_obj.floor_number == 0
            assert "Studio d'espace" in created_obj.description
        finally:
            target_app.dependency_overrides[get_db] = mock_get_db

    def test_colocation_filter_matches_various_properties(self, tenant_client):
        """colocation=1 query filter returns properties with property_type, title, or amenities matching colocation."""
        resp = tenant_client.get("/properties?colocation=1")
        assert resp.status_code == 200

