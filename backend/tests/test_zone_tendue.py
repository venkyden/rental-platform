"""
Unit tests for zone tendue detection (PR-7) and ADEME PENDING retry wiring (PR-6).

All pure-function tests — no DB, no HTTP.
"""
from app.services.zone_tendue import is_zone_tendue


# ── is_zone_tendue ────────────────────────────────────────────────────────────

class TestIsZoneTendue:
    def test_paris_75001(self):
        assert is_zone_tendue("75001") is True

    def test_idf_hauts_de_seine(self):
        assert is_zone_tendue("92100") is True

    def test_idf_seine_saint_denis(self):
        assert is_zone_tendue("93200") is True

    def test_lyon_69001(self):
        assert is_zone_tendue("69001") is True

    def test_bordeaux_33000(self):
        assert is_zone_tendue("33000") is True

    def test_montpellier_34000(self):
        assert is_zone_tendue("34000") is True

    def test_lille_59000(self):
        assert is_zone_tendue("59000") is True

    def test_grenoble_38000(self):
        assert is_zone_tendue("38000") is True

    def test_strasbourg_67000(self):
        assert is_zone_tendue("67000") is True

    def test_toulouse_31000(self):
        assert is_zone_tendue("31000") is True

    def test_nice_06000(self):
        assert is_zone_tendue("06000") is True

    def test_rural_dept_not_zone_tendue(self):
        # Lozère (48) — no zone tendue agglomération
        assert is_zone_tendue("48000") is False

    def test_creuse_not_zone_tendue(self):
        assert is_zone_tendue("23000") is False

    def test_empty_string(self):
        assert is_zone_tendue("") is False

    def test_none(self):
        assert is_zone_tendue(None) is False

    def test_too_short(self):
        assert is_zone_tendue("7") is False

    def test_corsica_2a_not_zone_tendue(self):
        # 2A / 2B — Corsica, excluded (non-digit dept prefix)
        assert is_zone_tendue("2A000") is False
        assert is_zone_tendue("2B000") is False

    def test_overseas_not_zone_tendue(self):
        # Martinique 972, Réunion 974 — different legal framework
        assert is_zone_tendue("97200") is False
        assert is_zone_tendue("97400") is False

    def test_strips_spaces(self):
        assert is_zone_tendue(" 75001 ") is True

    def test_postal_code_with_internal_space(self):
        # Some inputs may arrive with a space in the middle
        assert is_zone_tendue("75 001") is True


# ── PropertyResponse.is_zone_tendue computed field ───────────────────────────

class TestPropertyResponseIsZoneTendue:
    """Verify the model_validator populates is_zone_tendue correctly."""

    def _make_response(self, postal_code: str, **overrides):
        from datetime import datetime
        from decimal import Decimal
        from uuid import uuid4
        from app.models.property_schemas import PropertyResponse

        base = dict(
            id=uuid4(),
            landlord_id=uuid4(),
            title="Test",
            description=None,
            property_type="apartment",
            address_line1="1 rue de la Paix",
            address_line2=None,
            city="Paris",
            postal_code=postal_code,
            country="France",
            latitude=None,
            longitude=None,
            bedrooms=1,
            monthly_rent=Decimal("1000"),
            created_at=datetime.now(),
            updated_at=None,
            published_at=None,
        )
        base.update(overrides)
        return PropertyResponse(**base)

    def test_paris_is_true(self):
        r = self._make_response("75001")
        assert r.is_zone_tendue is True

    def test_rural_is_false(self):
        r = self._make_response("48000")
        assert r.is_zone_tendue is False
