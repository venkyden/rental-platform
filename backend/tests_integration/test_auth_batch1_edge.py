"""
Batch 1 auth/identity hardening — EDGE CASE matrix.

Complements test_auth_batch1.py (happy paths). Covers boundaries and
error/abuse cases for every feature Batch 1 touched:
  - token-type guard (refresh token, garbage token at /auth/me)
  - password reset (expired, wrong-type, tampered, weak password, session revoke)
  - email verification (expired, wrong-type, already-verified, end-to-end)
  - email change (taken email, wrong password, expired token, session revoke)
  - login lockout (per-account isolation, reset on success)
  - production secret / encryption boot guards
"""
import importlib
import os
import uuid
from datetime import timedelta

import pytest
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User


# ── shared helpers ─────────────────────────────────────────────────────────

async def _register(client, email, password="StrongPass123!", full_name="Test User"):
    resp = await client.post("/auth/register", json={
        "email": email, "password": password,
        "full_name": full_name, "role": "tenant",
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture
def session_factory(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _get_user(sf, email) -> User:
    async with sf() as s:
        return (await s.execute(select(User).where(User.email == email))).scalar_one()


def _expired(data: dict) -> str:
    """Mint a token that is already expired but otherwise valid."""
    return create_access_token(data=data, expires_delta=timedelta(seconds=-10))


@pytest.fixture
def fake_cache(monkeypatch):
    """In-memory async cache so lockout state is observable and isolated."""
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
    return store


# ── token-type guard edges ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_token_rejected_at_me(client):
    """A refresh-type token must not authenticate /auth/me."""
    await _register(client, "rt@example.com")
    rt = create_refresh_token({"sub": "rt@example.com", "version": 1})
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {rt}"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_garbage_token_rejected_at_me(client):
    """A structurally invalid token is rejected, not a 500."""
    resp = await client.get(
        "/auth/me", headers={"Authorization": "Bearer not.a.jwt"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_wrong_signature_token_rejected(client):
    """A token signed with a different key must be rejected."""
    forged = jwt.encode(
        {"sub": "x@example.com", "type": "access"},
        "totally-different-secret-key-not-the-real-one",
        algorithm=settings.ALGORITHM,
    )
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert resp.status_code == 401


# ── password reset edges ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reset_expired_token(client):
    await _register(client, "rexp@example.com")
    tok = _expired({"sub": "rexp@example.com", "type": "password_reset"})
    resp = await client.post("/auth/reset-password", json={
        "token": tok, "new_password": "NewStrong123!",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_wrong_type_token(client):
    """An access token presented to reset-password is rejected (type mismatch)."""
    await _register(client, "rwt@example.com")
    access = create_access_token({"sub": "rwt@example.com"})  # type defaults to access
    resp = await client.post("/auth/reset-password", json={
        "token": access, "new_password": "NewStrong123!",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_tampered_token(client):
    await _register(client, "rtam@example.com")
    tok = create_access_token({"sub": "rtam@example.com", "type": "password_reset"})
    resp = await client.post("/auth/reset-password", json={
        "token": tok + "x", "new_password": "NewStrong123!",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_weak_password_rejected(client):
    """Reset must enforce the same complexity as registration (422 validation)."""
    await _register(client, "rweak@example.com")
    tok = create_access_token({"sub": "rweak@example.com", "type": "password_reset"})
    resp = await client.post("/auth/reset-password", json={
        "token": tok, "new_password": "weak",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_reset_revokes_existing_sessions(client, session_factory):
    """After reset, a refresh token issued before the reset is invalid."""
    await _register(client, "rrev@example.com", password="OldStrong123!")
    login = await client.post("/auth/login", data={
        "username": "rrev@example.com", "password": "OldStrong123!",
    })
    assert login.status_code == 200

    user = await _get_user(session_factory, "rrev@example.com")
    old_refresh = create_refresh_token(
        {"sub": "rrev@example.com", "version": user.refresh_token_version}
    )
    reset_tok = create_access_token({
        "sub": "rrev@example.com", "type": "password_reset",
        "rtv": user.refresh_token_version,
    })
    done = await client.post("/auth/reset-password", json={
        "token": reset_tok, "new_password": "BrandNew123!",
    })
    assert done.status_code == 200

    # Old refresh cookie must now be rejected (version bumped).
    client.cookies.set("refresh_token", old_refresh)
    refreshed = await client.post("/auth/refresh")
    assert refreshed.status_code == 401
    client.cookies.clear()


@pytest.mark.asyncio
async def test_reset_then_login_with_new_password(client):
    """End-to-end: reset, then the new password actually logs in and old fails."""
    await _register(client, "re2e@example.com", password="OldStrong123!")
    tok = create_access_token({"sub": "re2e@example.com", "type": "password_reset"})
    await client.post("/auth/reset-password", json={
        "token": tok, "new_password": "BrandNew123!",
    })
    old = await client.post("/auth/login", data={
        "username": "re2e@example.com", "password": "OldStrong123!",
    })
    assert old.status_code == 401
    new = await client.post("/auth/login", data={
        "username": "re2e@example.com", "password": "BrandNew123!",
    })
    assert new.status_code == 200


# ── email verification edges ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_email_end_to_end(client, session_factory):
    await _register(client, "ve2e@example.com")
    tok = create_access_token({"sub": "ve2e@example.com", "type": "email_verification"})
    resp = await client.get(f"/auth/verify-email?token={tok}")
    assert resp.status_code == 200
    user = await _get_user(session_factory, "ve2e@example.com")
    assert user.email_verified is True


@pytest.mark.asyncio
async def test_verify_email_expired(client):
    await _register(client, "vexp@example.com")
    tok = _expired({"sub": "vexp@example.com", "type": "email_verification"})
    resp = await client.get(f"/auth/verify-email?token={tok}")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_wrong_type(client):
    """A password_reset token cannot be used to verify email."""
    await _register(client, "vwt@example.com")
    tok = create_access_token({"sub": "vwt@example.com", "type": "password_reset"})
    resp = await client.get(f"/auth/verify-email?token={tok}")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_idempotent(client):
    await _register(client, "videm@example.com")
    tok = create_access_token({"sub": "videm@example.com", "type": "email_verification"})
    first = await client.get(f"/auth/verify-email?token={tok}")
    assert first.status_code == 200
    second = await client.get(f"/auth/verify-email?token={tok}")
    assert second.status_code == 200  # already verified → still OK


# ── email change edges ──────────────────────────────────────────────────────

async def _auth_headers(client, email, password="StrongPass123!"):
    login = await client.post("/auth/login", data={"username": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.mark.asyncio
async def test_email_change_to_taken_email(client):
    await _register(client, "ecown@example.com")
    await _register(client, "ectaken@example.com")
    headers = await _auth_headers(client, "ecown@example.com")
    resp = await client.post("/auth/request-email-change", json={
        "new_email": "ectaken@example.com", "password": "StrongPass123!",
    }, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_email_change_wrong_password(client):
    await _register(client, "ecwp@example.com")
    headers = await _auth_headers(client, "ecwp@example.com")
    resp = await client.post("/auth/request-email-change", json={
        "new_email": "ecnew@example.com", "password": "WrongPass123!",
    }, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_email_change_confirm_revokes_sessions(client, session_factory):
    await _register(client, "ecrev@example.com")
    user = await _get_user(session_factory, "ecrev@example.com")
    old_refresh = create_refresh_token(
        {"sub": "ecrev@example.com", "version": user.refresh_token_version}
    )
    change_tok = create_access_token({
        "sub": "ecrev@example.com", "type": "email_change",
        "new_email": "ecmoved@example.com",
    })
    confirm = await client.post("/auth/confirm-email-change", json={"token": change_tok})
    assert confirm.status_code == 200

    client.cookies.set("refresh_token", old_refresh)
    refreshed = await client.post("/auth/refresh")
    assert refreshed.status_code == 401
    client.cookies.clear()


@pytest.mark.asyncio
async def test_email_change_expired_token(client):
    await _register(client, "ecexp@example.com")
    tok = _expired({
        "sub": "ecexp@example.com", "type": "email_change",
        "new_email": "ecx@example.com",
    })
    resp = await client.post("/auth/confirm-email-change", json={"token": tok})
    assert resp.status_code == 400


# ── login lockout edges ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_lockout_is_per_account(client, fake_cache):
    await _register(client, "lockA@example.com")
    await _register(client, "lockB@example.com")
    for _ in range(5):
        await client.post("/auth/login", data={"username": "lockA@example.com", "password": "x"})
    # A is locked...
    a = await client.post("/auth/login", data={"username": "lockA@example.com", "password": "StrongPass123!"})
    assert a.status_code == 429
    # ...but B is unaffected.
    b = await client.post("/auth/login", data={"username": "lockB@example.com", "password": "StrongPass123!"})
    assert b.status_code == 200


@pytest.mark.asyncio
async def test_lockout_counter_resets_on_success(client, fake_cache):
    await _register(client, "lockreset@example.com")
    for _ in range(4):  # below threshold
        await client.post("/auth/login", data={"username": "lockreset@example.com", "password": "x"})
    ok = await client.post("/auth/login", data={"username": "lockreset@example.com", "password": "StrongPass123!"})
    assert ok.status_code == 200
    # After a success the counter is cleared; 4 more fails must not lock.
    for _ in range(4):
        await client.post("/auth/login", data={"username": "lockreset@example.com", "password": "x"})
    still_ok = await client.post("/auth/login", data={"username": "lockreset@example.com", "password": "StrongPass123!"})
    assert still_ok.status_code == 200


# ── production secret / encryption boot guards (pure unit) ───────────────────

def test_config_rejects_production_without_master_key(monkeypatch):
    from app.core.config import Settings
    with pytest.raises(Exception):
        Settings(
            DATABASE_URL="postgresql+asyncpg://x@localhost/x",
            SECRET_KEY="a" * 40,
            ENVIRONMENT="production",
            MASTER_ENCRYPTION_KEY=None,
            CREDENTIAL_SIGNING_KEY="a" * 64,
        )


def test_config_rejects_production_with_weak_secret(monkeypatch):
    from app.core.config import Settings
    with pytest.raises(Exception):
        Settings(
            DATABASE_URL="postgresql+asyncpg://x@localhost/x",
            SECRET_KEY="short",
            ENVIRONMENT="production",
            MASTER_ENCRYPTION_KEY="k" * 44,
            CREDENTIAL_SIGNING_KEY="a" * 64,
        )


def test_config_accepts_production_with_strong_secrets():
    from cryptography.fernet import Fernet
    from app.core.config import Settings
    s = Settings(
        DATABASE_URL="postgresql+asyncpg://x@localhost/x",
        SECRET_KEY="a" * 40,
        ENVIRONMENT="production",
        MASTER_ENCRYPTION_KEY=Fernet.generate_key().decode(),
        CREDENTIAL_SIGNING_KEY="a" * 64,
    )
    assert s.ENVIRONMENT == "production"


# ── forgot-email privacy (no account enumeration) ───────────────────────────

@pytest.mark.asyncio
async def test_forgot_email_no_enumeration_when_missing(client):
    """Unknown name/phone must return a generic 200, never a 404."""
    resp = await client.post("/auth/forgot-email", json={
        "full_name": "Nobody Here", "phone": "+33600000000",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "masked_email" not in body  # must not leak any address


@pytest.mark.asyncio
async def test_forgot_email_identical_response_when_found(client):
    """A real match returns the SAME generic 200 (no masked email, no signal)."""
    name = "Forgot Emailtest"
    phone = "+33611223344"
    reg = await client.post("/auth/register", json={
        "email": "found@example.com", "password": "StrongPass123!",
        "full_name": name, "phone": phone, "role": "tenant",
    })
    assert reg.status_code == 201, reg.text

    found = await client.post("/auth/forgot-email", json={"full_name": name, "phone": phone})
    missing = await client.post("/auth/forgot-email", json={"full_name": "No One", "phone": "+33600000000"})

    # Response must be indistinguishable between match and no-match.
    assert found.status_code == missing.status_code == 200
    assert found.json() == missing.json()
    assert "masked_email" not in found.json()
