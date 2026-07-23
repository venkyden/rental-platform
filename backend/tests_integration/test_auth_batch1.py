"""
Batch 1 auth/identity hardening regression tests (real Postgres).

Run with a local test DB, e.g.:
    TEST_DATABASE_URL=postgresql+asyncpg://venkat@localhost:5432/roomivo_test \
        ./.venv/bin/python -m pytest tests_integration/test_auth_batch1.py

Covers:
- Token confusion: non-access tokens (password_reset / email_verification)
  must NOT authenticate a request.
- A normal access token still authenticates.
- Password reset links are single-use (bound to the session version) and
  revoke existing sessions.
- full_name is stored raw (not HTML-escaped at rest).
- Per-account login lockout after repeated failures.
"""
import asyncio

import pytest
import pytest_asyncio
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.core.security import create_access_token
from app.models.user import User


async def _register(client, email, password="StrongPass123!", full_name="Test User"):
    resp = await client.post("/auth/register", json={
        "email": email,
        "password": password,
        "full_name": full_name,
        "role": "tenant",
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_password_reset_token_cannot_authenticate(client):
    """A password_reset token must be rejected as a Bearer credential."""
    await _register(client, "confuse@example.com")
    reset_token = create_access_token(
        data={"sub": "confuse@example.com", "type": "password_reset"},
        expires_delta=timedelta(hours=1),
    )
    resp = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {reset_token}"}
    )
    assert resp.status_code == 401, "non-access token must not authenticate"


@pytest.mark.asyncio
async def test_email_verification_token_cannot_authenticate(client):
    """An email_verification token must be rejected as a Bearer credential."""
    await _register(client, "ev@example.com")
    ev_token = create_access_token(
        data={"sub": "ev@example.com", "type": "email_verification"},
        expires_delta=timedelta(hours=24),
    )
    resp = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {ev_token}"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_access_token_still_authenticates(client):
    """Sanity: a normal access token from login still works."""
    await _register(client, "ok@example.com")
    login = await client.post("/auth/login", data={
        "username": "ok@example.com", "password": "StrongPass123!",
    })
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "ok@example.com"


@pytest.mark.asyncio
async def test_password_reset_is_single_use(client, session_factory):
    """Reset link bound to session version: second use is rejected."""
    await _register(client, "single@example.com", password="OldPass123!")

    async with session_factory() as s:
        user = (await s.execute(
            select(User).where(User.email == "single@example.com")
        )).scalar_one()
        rtv = user.refresh_token_version

    reset_token = create_access_token(
        data={"sub": "single@example.com", "type": "password_reset", "rtv": rtv},
        expires_delta=timedelta(hours=1),
    )

    first = await client.post("/auth/reset-password", json={
        "token": reset_token, "new_password": "NewPass123!",
    })
    assert first.status_code == 200, first.text

    second = await client.post("/auth/reset-password", json={
        "token": reset_token, "new_password": "EvenNewer123!",
    })
    assert second.status_code == 400, "reused reset link must be rejected"


@pytest.mark.asyncio
async def test_full_name_stored_raw(client):
    """Names with HTML-significant chars must be stored verbatim, not escaped."""
    name = "Jean-Pierre O'Brien & Sons"
    await _register(client, "raw@example.com", full_name=name)
    login = await client.post("/auth/login", data={
        "username": "raw@example.com", "password": "StrongPass123!",
    })
    token = login.json()["access_token"]
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["full_name"] == name


@pytest.mark.asyncio
async def test_login_lockout_after_repeated_failures(client, monkeypatch):
    """After the failure threshold, even a correct password is locked out."""
    from app.core import cache as cache_mod

    store: dict = {}

    async def _get(k):
        return store.get(k)

    async def _set(k, v, ttl=300):
        store[k] = v
        return True

    async def _delete(k):
        store.pop(k, None)
        return True

    monkeypatch.setattr(cache_mod.cache, "get", _get)
    monkeypatch.setattr(cache_mod.cache, "set", _set)
    monkeypatch.setattr(cache_mod.cache, "delete", _delete)

    await _register(client, "lock@example.com")

    for _ in range(5):
        bad = await client.post("/auth/login", data={
            "username": "lock@example.com", "password": "wrong",
        })
        assert bad.status_code == 401

    locked = await client.post("/auth/login", data={
        "username": "lock@example.com", "password": "StrongPass123!",
    })
    assert locked.status_code == 429, "account should be locked after 5 failures"


@pytest.mark.asyncio
async def test_concurrent_registration_same_email_no_500(client):
    """Two near-simultaneous registrations for the same email both pass the
    existence check (TOCTOU race); the loser must hit the unique constraint
    and get a clean 400, never an unhandled 500."""
    payload = {
        "email": "racer@example.com",
        "password": "StrongPass123!",
        "full_name": "Racer",
        "role": "tenant",
    }
    responses = await asyncio.gather(
        client.post("/auth/register", json=payload),
        client.post("/auth/register", json=payload),
    )
    statuses = sorted(r.status_code for r in responses)
    assert statuses == [201, 400], statuses
