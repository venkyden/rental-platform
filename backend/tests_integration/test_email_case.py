"""
Emails are one address whatever their case: "Jean@x.com" and "jean@x.com" were
two accounts, and a case variant could be registered beside the real one
(2026-10-21 stress test). Every write stores the lowercase form, every lookup
lowercases what was typed, and the database refuses a mixed-case address.
"""

import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from tests_integration.conftest import auth, make_user

BACKEND = Path(__file__).resolve().parents[1]
PASSWORD = "Passw0rd!23"


def _unique(prefix="Jean.Dupont") -> str:
    return f"{prefix}.{uuid.uuid4().hex[:6]}@Example.COM"


async def _user_by(sm, email: str):
    async with sm() as s:
        return (await s.execute(select(User).where(User.email == email))).scalar_one_or_none()


@pytest.mark.asyncio
async def test_registration_stores_the_lowercase_address(client, sessionmaker_):
    typed = _unique()
    r = await client.post("/auth/register", json={"email": typed, "password": PASSWORD, "full_name": "Jean Dupont",
                                                  "role": "tenant"})
    assert r.status_code == 201, r.text
    assert await _user_by(sessionmaker_, typed.lower()) is not None


@pytest.mark.asyncio
async def test_a_case_variant_cannot_be_registered_beside_the_real_account(client, sessionmaker_):
    typed = _unique()
    await client.post("/auth/register", json={"email": typed.lower(), "password": PASSWORD, "full_name": "Jean Dupont",
                                              "role": "tenant"})
    r = await client.post("/auth/register", json={"email": typed.upper(), "password": PASSWORD, "full_name": "Not Jean",
                                                  "role": "tenant"})
    assert r.status_code == 400, r.text


@pytest.mark.asyncio
async def test_sign_in_works_whatever_the_case_typed(client, sessionmaker_):
    user = await make_user(sessionmaker_, email=_unique().lower())
    r = await client.post("/auth/login", data={"username": user.email.upper(), "password": PASSWORD})
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_password_reset_finds_the_account_whatever_the_case(client, sessionmaker_, monkeypatch):
    from app.routers import auth as auth_router

    sent = []

    async def _reset(to_email, token, full_name):
        sent.append(to_email)

    monkeypatch.setattr(auth_router.email_service, "send_password_reset_email", _reset)
    user = await make_user(sessionmaker_, email=_unique().lower())
    r = await client.post("/auth/forgot-password", json={"email": user.email.upper()})
    assert r.status_code == 200
    assert sent == [user.email]


@pytest.mark.asyncio
async def test_email_change_stores_lowercase_and_sees_case_variants_as_taken(client, sessionmaker_, monkeypatch):
    from app.routers import auth as auth_router

    tokens = []

    async def _change(to_email, token, full_name):
        tokens.append(token)

    monkeypatch.setattr(auth_router.email_service, "send_email_change_verification", _change)
    taken = await make_user(sessionmaker_, email=_unique("taken").lower())
    user = await make_user(sessionmaker_, email=_unique().lower())
    login = await client.post("/auth/login", data={"username": user.email, "password": PASSWORD})
    session = {"Authorization": f"Bearer {login.json()['access_token']}"}

    r = await client.post("/auth/request-email-change", json={"new_email": taken.email.upper(), "password": PASSWORD},
                          headers=session)
    assert r.status_code == 400, r.text

    new_email = _unique("Moved")
    r = await client.post("/auth/request-email-change", json={"new_email": new_email, "password": PASSWORD}, headers=session)
    assert r.status_code == 200, r.text
    r = await client.post("/auth/confirm-email-change", json={"token": tokens[-1]})
    assert r.status_code == 200, r.text
    async with sessionmaker_() as s:
        assert (await s.get(User, user.id)).email == new_email.lower()


@pytest.mark.asyncio
async def test_google_reaches_the_account_whatever_the_case(client, sessionmaker_, monkeypatch):
    from app.core.config import settings
    from google.oauth2 import id_token

    user = await make_user(sessionmaker_, email=_unique().lower())
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(id_token, "verify_oauth2_token", lambda c, t, i: {
        "sub": f"g-{uuid.uuid4().hex[:8]}", "email": user.email.upper(), "email_verified": True})

    r = await client.post("/auth/google", json={"credential": "x"})
    assert r.status_code == 200, r.text
    async with sessionmaker_() as s:
        assert (await s.get(User, user.id)).google_id is not None
        count = (await s.execute(select(User).where(User.email.ilike(user.email)))).scalars().all()
    assert len(count) == 1


@pytest.mark.asyncio
async def test_the_database_refuses_a_mixed_case_address(sessionmaker_):
    with pytest.raises(IntegrityError):
        await make_user(sessionmaker_, email=_unique())


def _alembic(*args):
    result = subprocess.run([sys.executable, "-m", "alembic", *args], cwd=BACKEND, env={**os.environ},
                            capture_output=True, text=True, timeout=120)
    assert result.returncode == 0, result.stderr[-2000:]
    return result.stdout + result.stderr


@pytest.mark.asyncio
async def test_migration_lowercases_stored_addresses_and_reports_collisions(sessionmaker_):
    _alembic("downgrade", "f4b6d8e0a2c3")
    plain, dup = uuid.uuid4().hex[:6], uuid.uuid4().hex[:6]
    try:
        async with sessionmaker_() as s:
            for email in (f"Mixed.{plain}@Example.com", f"Dup.{dup}@x.com", f"dup.{dup}@x.com"):
                await s.execute(text(
                    "INSERT INTO users (id, email, role, is_active, email_verified, refresh_token_version, created_at, updated_at) "
                    "VALUES (:id, :email, 'tenant', true, false, 1, now(), now())"), {"id": uuid.uuid4(), "email": email})
            await s.commit()
    finally:
        output = _alembic("upgrade", "head")

    async with sessionmaker_() as s:
        emails = set((await s.execute(text(
            "SELECT email FROM users WHERE lower(email) IN (:a, :b)"),
            {"a": f"mixed.{plain}@example.com", "b": f"dup.{dup}@x.com"})).scalars().all())
        # Clean up the collision so the constraint can be validated by later runs.
        await s.execute(text("DELETE FROM users WHERE lower(email) = :b"), {"b": f"dup.{dup}@x.com"})
        await s.commit()
    assert emails == {f"mixed.{plain}@example.com", f"Dup.{dup}@x.com", f"dup.{dup}@x.com"}
    assert "differ only by case" in output
