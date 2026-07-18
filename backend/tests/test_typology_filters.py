"""Tests for typology filters (rooms_count / rooms_count_min) on GET /properties."""

from sqlalchemy import select

from app.models.property import Property
from app.models.property_schemas import PropertyResponse
from app.routers.properties import _apply_property_filters, _landlord_trust_fields


def _where_sql(query) -> str:
    """Compile only the WHERE clause (the SELECT list always contains column names)."""
    return str(query.whereclause) if query.whereclause is not None else ""


def _build(params: dict):
    return _apply_property_filters(
        query=select(Property),
        params=params,
        amenities=[],
        default_sort_col=Property.created_at.desc(),
        current_user=None,
    )


class TestTypologyFilters:
    def test_rooms_count_exact_filter(self):
        query = _build({"rooms_count": "2"})
        assert "rooms_count =" in _where_sql(query)

    def test_rooms_count_min_filter(self):
        query = _build({"rooms_count_min": "3"})
        assert "rooms_count >=" in _where_sql(query)

    def test_invalid_rooms_count_is_ignored(self):
        query = _build({"rooms_count": "abc"})
        assert "rooms_count" not in _where_sql(query)

    def test_no_rooms_params_no_filter(self):
        query = _build({})
        assert "rooms_count" not in _where_sql(query)


class TestTypologyEndpoint:
    def test_list_properties_accepts_rooms_count(self, client):
        resp = client.get("/properties?rooms_count=2")
        assert resp.status_code == 200

    def test_list_properties_accepts_rooms_count_min(self, client):
        resp = client.get("/properties?rooms_count_min=3")
        assert resp.status_code == 200


class TestLandlordTrustFields:
    def test_response_schema_has_trust_fields(self):
        fields = PropertyResponse.model_fields
        assert "landlord_first_name" in fields
        assert "landlord_identity_verified" in fields

    def test_trust_fields_default_safe(self):
        assert _landlord_trust_fields(None) == {
            "landlord_first_name": None,
            "landlord_identity_verified": False,
        }

    def test_trust_fields_first_name_only(self):
        class FakeLandlord:
            full_name = "Marc Dupont"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] == "Marc"  # never the full name
        assert result["landlord_identity_verified"] is True

    def test_trust_fields_empty_name(self):
        class FakeLandlord:
            full_name = "   "
            identity_verified = False

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] is None

    def test_trust_fields_single_token_never_emitted(self):
        # A lone token may be a bare surname — degrade to None, don't leak.
        class FakeLandlord:
            full_name = "Dupont"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] is None

    def test_trust_fields_nom_prenom_convention(self):
        # French "NOM Prénom": all-caps leading token is the surname.
        class FakeLandlord:
            full_name = "DUPONT Marc"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] == "Marc"

    def test_trust_fields_all_caps_only_never_emitted(self):
        class FakeLandlord:
            full_name = "DUPONT MARTIN"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] is None
