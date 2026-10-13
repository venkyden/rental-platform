"""Tests for the list filters on GET /properties (typology, bedrooms, bathrooms_min,
min_duration_months, available_by) and the landlord trust fields."""

from sqlalchemy import select

from app.models.property import Property
from app.models.property_schemas import PropertyResponse
from app.routers.properties import _apply_property_filters, _landlord_trust_fields


def _where_sql(query) -> str:
    """Compile only the WHERE clause (the SELECT list always contains column names)."""
    return str(query.whereclause) if query.whereclause is not None else ""


def _where_literal(query) -> str:
    """The WHERE clause as PostgreSQL would receive it, with bound values inlined."""
    from sqlalchemy.dialects import postgresql

    return str(query.whereclause.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


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


class TestLenientListFilters:
    """bathrooms_min, min_duration_months, available_by and the bounded room counts.

    These compile the WHERE clause with its values inlined, so a wrong bound or an
    AND where an OR is meant fails the test. Row-level proof is in
    tests_integration/test_listing_filters.py.
    """

    def test_bathrooms_min_treats_a_missing_count_as_one(self):
        assert "coalesce(properties.bathrooms, 1) >= 2" in _where_literal(_build({"bathrooms_min": "2"}))

    def test_bathrooms_min_ignores_bad_values(self):
        for bad in ["abc", "0", "-1", "21", "nan", "1e9", "9" * 40, "", "2.5"]:
            assert "bathrooms" not in _where_sql(_build({"bathrooms_min": bad})), bad

    def test_min_duration_keeps_flexible_listings(self):
        sql = _where_literal(_build({"min_duration_months": "9"}))
        assert "properties.lease_duration_months IS NULL OR properties.lease_duration_months >= 9" in sql

    def test_min_duration_ignores_bad_values(self):
        for bad in ["abc", "0", "37", "inf", ""]:
            assert "lease_duration_months" not in _where_sql(_build({"min_duration_months": bad})), bad

    def test_available_by_keeps_undated_listings(self):
        sql = _where_literal(_build({"available_by": "2027-09-30"}))
        assert "properties.available_from IS NULL OR properties.available_from <= '2027-09-30'" in sql

    def test_available_by_accepts_only_year_month_day(self):
        for bad in ["2027-13-01", "tomorrow", "2027-09", "20270930", "2027-W39-3", "", "' OR 1=1 --"]:
            assert "available_from" not in _where_sql(_build({"available_by": bad})), bad

    def test_bedrooms_is_a_minimum(self):
        assert "properties.bedrooms >= 2" in _where_literal(_build({"bedrooms": "2"}))

    def test_room_counts_ignore_values_that_would_overflow(self):
        for name in ["bedrooms", "rooms_count", "rooms_count_min"]:
            for bad in ["9" * 30, "-1", "51", "abc"]:
                sql = _where_sql(_build({name: bad}))
                assert "bedrooms" not in sql and "rooms_count" not in sql, (name, bad)


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

    def test_trust_fields_nom_prenom_convention_ambiguous(self):
        # "DUPONT Marc" (NOM Prénom) and "MARC Dupont" (caps given name) share the
        # same shape — casing can't tell them apart, so neither may emit anything.
        class FakeLandlord:
            full_name = "DUPONT Marc"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] is None

    def test_trust_fields_caps_given_name_never_leaks_surname(self):
        # Regression (security sweep): the previous casing swap emitted "Dupont".
        class FakeLandlord:
            full_name = "MARC Dupont"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] is None

    def test_trust_fields_all_caps_only_never_emitted(self):
        class FakeLandlord:
            full_name = "DUPONT MARTIN"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] is None

    def test_trust_fields_first_name_column_wins(self):
        # Dedicated column is authoritative — even over an ambiguous full_name.
        class FakeLandlord:
            first_name = "Marc"
            full_name = "DUPONT Marc"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] == "Marc"

    def test_trust_fields_blank_first_name_falls_back(self):
        class FakeLandlord:
            first_name = "   "
            full_name = "Marc Dupont"
            identity_verified = True

        result = _landlord_trust_fields(FakeLandlord())
        assert result["landlord_first_name"] == "Marc"


class TestSmartSearchEndpoint:
    def test_list_properties_accepts_smart_search_params(self, client):
        resp = client.get(
            "/properties?bathrooms_min=2&min_duration_months=9&available_by=2027-09-30&amenities=balcony"
        )
        assert resp.status_code == 200

    def test_list_properties_survives_hostile_smart_search_params(self, client):
        resp = client.get(
            "/properties?bathrooms_min=999999999999999999999&min_duration_months=nan&available_by=%00%27"
        )
        assert resp.status_code == 200
