"""Smoke test — validates the real-DB harness (auth + a DB round-trip)."""

import pytest

from tests_integration.conftest import make_user, auth


@pytest.mark.asyncio
async def test_authenticated_me_roundtrip(client):
    sm = client._sessionmaker
    user = await make_user(sm, role="tenant")

    # Unauthenticated -> 401
    r = await client.get("/auth/me")
    assert r.status_code == 401

    # Authenticated -> 200 with our user
    r = await client.get("/auth/me", headers=auth(user))
    assert r.status_code == 200, r.text
    assert r.json()["email"] == user.email
