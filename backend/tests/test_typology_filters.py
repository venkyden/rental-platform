"""Tests for typology filters (rooms_count / rooms_count_min) on GET /properties."""

from sqlalchemy import select

from app.models.property import Property
from app.routers.properties import _apply_property_filters


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
