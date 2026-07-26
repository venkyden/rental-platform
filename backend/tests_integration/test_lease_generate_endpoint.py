"""
Real-DB integration tests for POST /leases/generate — the live lease
generation endpoint (app/services/lease_generator.py). Previously exercised
only indirectly (test_bail_mobilite_block.py calls the service layer directly
for one edge case) and never through the HTTP route itself, leaving the
actual auth/status/ownership gating in app/routers/leases.py untested.
"""

import uuid

import pytest
from sqlalchemy import select

from app.models.application import Application
from app.models.user import User

from tests_integration.conftest import auth, make_application, make_property, make_user


async def _set_application_status(sessionmaker_, application_id, status):
    async with sessionmaker_() as session:
        result = await session.execute(
            select(Application).where(Application.id == application_id)
        )
        app_obj = result.scalar_one()
        app_obj.status = status
        await session.commit()


async def _verify_identity(sessionmaker_, user_id):
    async with sessionmaker_() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one()
        user.identity_verified = True
        await session.commit()


@pytest.mark.asyncio
async def test_generate_lease_returns_html_for_approved_application(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    tenant = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord)
    application = await make_application(sessionmaker_, tenant, prop)

    await _set_application_status(sessionmaker_, application.id, "approved")
    await _verify_identity(sessionmaker_, landlord.id)

    r = await client.post(
        "/leases/generate",
        json={
            "application_id": str(application.id),
            "lease_type": "meuble",
            "start_date": "2026-09-01",
            "duration_months": 12,
        },
        headers=auth(landlord),
    )

    assert r.status_code == 200, r.text
    assert "text/html" in r.headers["content-type"]
    assert tenant.full_name in r.text
    assert "900" in r.text  # property.monthly_rent from make_property


@pytest.mark.asyncio
async def test_generate_lease_404_when_application_missing(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")

    r = await client.post(
        "/leases/generate",
        json={
            "application_id": str(uuid.uuid4()),
            "start_date": "2026-09-01",
        },
        headers=auth(landlord),
    )

    assert r.status_code == 404


@pytest.mark.asyncio
async def test_generate_lease_400_when_application_not_approved(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    tenant = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord)
    application = await make_application(sessionmaker_, tenant, prop)  # defaults to "pending"

    await _verify_identity(sessionmaker_, landlord.id)

    r = await client.post(
        "/leases/generate",
        json={
            "application_id": str(application.id),
            "start_date": "2026-09-01",
        },
        headers=auth(landlord),
    )

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_generate_lease_403_when_not_the_landlord(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    other_landlord = await make_user(sessionmaker_, role="landlord")
    tenant = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord)
    application = await make_application(sessionmaker_, tenant, prop)

    await _set_application_status(sessionmaker_, application.id, "approved")
    await _verify_identity(sessionmaker_, other_landlord.id)

    r = await client.post(
        "/leases/generate",
        json={
            "application_id": str(application.id),
            "start_date": "2026-09-01",
        },
        headers=auth(other_landlord),
    )

    assert r.status_code == 403


@pytest.mark.asyncio
async def test_generate_lease_403_when_landlord_identity_unverified(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    tenant = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord)
    application = await make_application(sessionmaker_, tenant, prop)

    await _set_application_status(sessionmaker_, application.id, "approved")
    # deliberately skip _verify_identity — landlord.identity_verified stays False

    r = await client.post(
        "/leases/generate",
        json={
            "application_id": str(application.id),
            "start_date": "2026-09-01",
        },
        headers=auth(landlord),
    )

    assert r.status_code == 403
