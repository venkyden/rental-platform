"""WP2 — colocation first-class: is_colocation flag, colocation_summary,
and the search filter's authoritative-signal + legacy-fallback behavior.
"""

from sqlalchemy import select

from app.models.property import Property
from app.models.property_schemas import PropertyCreate, PropertyResponse, PropertyUpdate
from app.routers.properties import _apply_property_filters


def _where_sql(query) -> str:
    return str(query.whereclause) if query.whereclause is not None else ""


def _build(params: dict, amenities=None):
    return _apply_property_filters(
        query=select(Property),
        params=params,
        amenities=amenities or [],
        default_sort_col=Property.created_at.desc(),
        current_user=None,
    )


class TestIsColocationSchemaFields:
    def test_create_defaults_false(self):
        assert PropertyCreate.model_fields["is_colocation"].default is False

    def test_update_defaults_none(self):
        assert PropertyUpdate.model_fields["is_colocation"].default is None

    def test_response_defaults_false(self):
        assert PropertyResponse.model_fields["is_colocation"].default is False


class TestColocationSummary:
    def _response(self, **overrides):
        base = dict(
            id="00000000-0000-0000-0000-000000000000",
            landlord_id="00000000-0000-0000-0000-000000000000",
            title="Test", description=None, property_type="apartment",
            address_line1="1 rue Test", address_line2=None, city="Nantes",
            postal_code="44000", country="France", latitude=None, longitude=None,
            bedrooms=3, monthly_rent=1500, created_at="2026-01-01T00:00:00",
            is_colocation=False, room_details=[],
        )
        base.update(overrides)
        return PropertyResponse.model_construct(**base)

    def test_not_colocation_returns_none(self):
        r = self._response(is_colocation=False, room_details=[{"monthly_rent": 500}])
        assert r.colocation_summary is None

    def test_no_room_details_returns_none(self):
        r = self._response(is_colocation=True, room_details=[])
        assert r.colocation_summary is None

    def test_counts_and_min_rent(self):
        r = self._response(is_colocation=True, room_details=[
            {"monthly_rent": 600, "status": "available"},
            {"monthly_rent": 550, "status": "occupied"},
            {"monthly_rent": 580, "status": "available"},
        ])
        summary = r.colocation_summary
        assert summary["total_rooms"] == 3
        assert summary["available_rooms"] == 2
        assert summary["min_room_rent"] == 550  # min across ALL rooms, not just available

    def test_no_rent_set_yields_none_min_rent_but_keeps_counts(self):
        r = self._response(is_colocation=True, room_details=[
            {"status": "available"}, {"status": "occupied"},
        ])
        summary = r.colocation_summary
        assert summary["total_rooms"] == 2
        assert summary["available_rooms"] == 1
        assert summary["min_room_rent"] is None


class TestColocationFilter:
    def test_is_colocation_param_filters_on_column(self):
        query = _build({"is_colocation": "true"})
        assert "is_colocation" in _where_sql(query)

    def test_legacy_colocation_param_includes_is_colocation_in_or(self):
        query = _build({"colocation": "1"})
        sql = _where_sql(query)
        assert "is_colocation" in sql

    def test_legacy_colocation_param_no_longer_matches_bare_room_details(self):
        # Regression: 62151d4's room_details.isnot(None) matched EVERY
        # multi-bedroom property (Step4Layout populates room_details for all
        # of them), not just colocations. is_colocation replaces that intent.
        query = _build({"colocation": "1"})
        sql = _where_sql(query)
        assert "room_details IS NOT NULL" not in sql

    def test_amenities_colocation_branch_includes_is_colocation(self):
        query = _build({}, amenities=["colocation"])
        sql = _where_sql(query)
        assert "is_colocation" in sql
        assert "room_details IS NOT NULL" not in sql

    def test_no_colocation_param_no_filter(self):
        query = _build({})
        assert "is_colocation" not in _where_sql(query)
