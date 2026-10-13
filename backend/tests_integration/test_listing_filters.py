"""
List filters on GET /properties against real rows.

The mock-based tests in tests/test_typology_filters.py check the SQL that is
built; these check which listings actually come back.
"""

import uuid
from datetime import date

import pytest

from app.models.property import Property
from tests_integration.conftest import make_user


async def _listing(sm, landlord, title, **fields) -> str:
    async with sm() as s:
        p = Property(
            id=uuid.uuid4(),
            landlord_id=landlord.id,
            title=title,
            address_line1="1 rue de Test",
            city="Paris",
            postal_code="75011",
            property_type="studio",
            bedrooms=1,
            monthly_rent=700,
            status="active",
            **fields,
        )
        s.add(p)
        await s.commit()
        return title


async def _titles(client, query: str) -> set[str]:
    resp = await client.get(f"/properties?{query}")
    assert resp.status_code == 200, resp.text
    return {p["title"] for p in resp.json()}


@pytest.mark.asyncio
async def test_bathrooms_min_counts_a_missing_value_as_one(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    await _listing(sm, landlord, "one", bathrooms=1)
    await _listing(sm, landlord, "two", bathrooms=2)
    await _listing(sm, landlord, "unknown")

    assert await _titles(client, "bathrooms_min=2") == {"two"}
    assert await _titles(client, "bathrooms_min=1") == {"one", "two", "unknown"}


@pytest.mark.asyncio
async def test_min_duration_keeps_flexible_listings(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    await _listing(sm, landlord, "six", lease_duration_months=6)
    await _listing(sm, landlord, "twelve", lease_duration_months=12)
    await _listing(sm, landlord, "flexible")

    assert await _titles(client, "min_duration_months=9") == {"twelve", "flexible"}


@pytest.mark.asyncio
async def test_available_by_keeps_undated_listings(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    await _listing(sm, landlord, "august", available_from=date(2027, 8, 15))
    await _listing(sm, landlord, "october", available_from=date(2027, 10, 1))
    await _listing(sm, landlord, "undated")

    assert await _titles(client, "available_by=2027-09-30") == {"august", "undated"}


@pytest.mark.asyncio
async def test_a_district_postcode_finds_the_listing(client):
    # The landing page's sentence search sends "Paris 11e" as the postcode 75011.
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    await _listing(sm, landlord, "eleventh")

    assert await _titles(client, "city=75011") == {"eleventh"}
    assert await _titles(client, "city=Paris 11e") == set()


@pytest.mark.asyncio
async def test_oversized_numbers_do_not_error(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    await _listing(sm, landlord, "only")

    huge = "9" * 30
    query = f"bedrooms={huge}&rooms_count={huge}&rooms_count_min={huge}&bathrooms_min={huge}&min_duration_months={huge}"
    assert await _titles(client, query) == {"only"}
