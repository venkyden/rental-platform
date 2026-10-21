"""
Account takeovers and identity drift found by the 2026-10-21 stress test, against
real rows:

- a session outlived its account: tokens were looked up by email alone, so after
  an email change or erasure they logged into whoever registered that email next;
- a verified identity survived a change of name, and the credential then signed
  the new name;
- Google sign-in linked to an account by an email Google had not verified, and a
  password set by whoever pre-registered the address kept working afterwards;
- Google sign-in from the login page (no role) turned a landlord into a tenant.
"""

import uuid

import pytest

from app.core.security import create_access_token, create_refresh_token
from app.models.user import User
from tests_integration.conftest import auth, make_user


async def _reload(sm, user_id) -> User:
    async with sm() as s:
        return await s.get(User, user_id)


async def _set(sm, user_id, **fields) -> None:
    async with sm() as s:
        row = await s.get(User, user_id)
        for key, value in fields.items():
            setattr(row, key, value)
        await s.commit()


# ── sessions belong to an account, not to an email address ──────────────────

@pytest.mark.asyncio
async def test_access_token_does_not_follow_the_email_to_a_new_account(client, sessionmaker_):
    email = f"reused_{uuid.uuid4().hex[:8]}@test.com"
    first = await make_user(sessionmaker_, email=email)
    old_token = auth(first)

    await _set(sessionmaker_, first.id, email=f"deleted_{first.id}@anonymised.roomivo.internal", is_active=False)
    second = await make_user(sessionmaker_, email=email)

    r = await client.get("/auth/me", headers=old_token)
    assert r.status_code == 401, r.text
    r = await client.get("/auth/me", headers=auth(second))
    assert r.status_code == 200 and r.json()["id"] == str(second.id)


@pytest.mark.asyncio
async def test_access_token_stops_working_after_an_email_change(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    old_token = auth(user)
    await _set(sessionmaker_, user.id, email=f"new_{uuid.uuid4().hex[:8]}@test.com")

    r = await client.get("/auth/me", headers=old_token)
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_does_not_follow_the_email_to_a_new_account(client, sessionmaker_):
    email = f"reused_{uuid.uuid4().hex[:8]}@test.com"
    first = await make_user(sessionmaker_, email=email)
    old_refresh = create_refresh_token({"sub": email, "user_id": str(first.id), "version": 1})

    await _set(sessionmaker_, first.id, email=f"deleted_{first.id}@anonymised.roomivo.internal", is_active=False)
    await make_user(sessionmaker_, email=email)  # a new account, refresh_token_version 1 again

    r = await client.post("/auth/refresh", cookies={"refresh_token": old_refresh})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_without_an_account_id_is_refused(client, sessionmaker_):
    """Tokens issued before this fix name only the email; they cannot be told apart."""
    user = await make_user(sessionmaker_)
    legacy = create_refresh_token({"sub": user.email, "version": 1})

    r = await client.post("/auth/refresh", cookies={"refresh_token": legacy})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_then_refresh_still_works(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    r = await client.post("/auth/login", data={"username": user.email, "password": "Passw0rd!23"})
    assert r.status_code == 200, r.text
    refresh = r.cookies.get("refresh_token")
    assert refresh

    r = await client.post("/auth/refresh", cookies={"refresh_token": refresh})
    assert r.status_code == 200, r.text
    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert r.status_code == 200 and r.json()["id"] == str(user.id)


@pytest.mark.asyncio
async def test_access_token_without_an_account_id_is_refused(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    token = create_access_token({"sub": user.email})
    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


# ── a verified name does not change ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_verified_name_cannot_be_changed(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name="Jean Dupont", identity_verified=True, identity_status="verified")

    r = await client.patch("/auth/me", json={"full_name": "Someone Else"}, headers=auth(user))
    assert r.status_code == 409, r.text
    assert (await _reload(sessionmaker_, user.id)).full_name == "Jean Dupont"


@pytest.mark.asyncio
async def test_verified_user_can_still_edit_the_rest(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name="Jean Dupont", identity_verified=True, identity_status="verified")

    r = await client.patch("/auth/me", json={"full_name": "  Jean Dupont ", "bio": "Student in Nantes, quiet and tidy, looking for a room near campus."},
                           headers=auth(user))
    assert r.status_code == 200, r.text
    row = await _reload(sessionmaker_, user.id)
    assert row.full_name == "Jean Dupont" and row.identity_verified is True


@pytest.mark.asyncio
async def test_unverified_user_can_change_name(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    r = await client.patch("/auth/me", json={"full_name": "Jean Dupont"}, headers=auth(user))
    assert r.status_code == 200, r.text
    assert (await _reload(sessionmaker_, user.id)).full_name == "Jean Dupont"


# ── Google sign-in ──────────────────────────────────────────────────────────

@pytest.fixture
def google(monkeypatch):
    """Stand in for Google's token check; returns a setter for the next token's claims."""
    from app.core.config import settings
    from google.oauth2 import id_token

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    claims: dict = {}
    monkeypatch.setattr(id_token, "verify_oauth2_token", lambda credential, transport, client_id: dict(claims))

    def _next(email, verified=True, sub=None):
        claims.clear()
        claims.update({"sub": sub or f"g-{uuid.uuid4().hex[:10]}", "email": email, "email_verified": verified})

    return _next


@pytest.mark.asyncio
async def test_google_does_not_link_by_an_unverified_email(client, sessionmaker_, google):
    user = await make_user(sessionmaker_)
    google(user.email, verified=False)

    r = await client.post("/auth/google", json={"credential": "x"})
    assert r.status_code == 409, r.text
    assert (await _reload(sessionmaker_, user.id)).google_id is None


@pytest.mark.asyncio
async def test_google_link_removes_a_password_nobody_proved(client, sessionmaker_, google):
    """Someone registered the address with a password but never confirmed it."""
    squatter = await make_user(sessionmaker_)
    await _set(sessionmaker_, squatter.id, email_verified=False)
    google(squatter.email, verified=True)

    r = await client.post("/auth/google", json={"credential": "x"})
    assert r.status_code == 200, r.text
    row = await _reload(sessionmaker_, squatter.id)
    assert row.google_id is not None and row.email_verified is True
    assert row.hashed_password is None
    assert row.refresh_token_version > 1

    r = await client.post("/auth/login", data={"username": squatter.email, "password": "Passw0rd!23"})
    assert r.status_code in (400, 401), r.text


@pytest.mark.asyncio
async def test_google_link_keeps_the_password_of_a_confirmed_account(client, sessionmaker_, google):
    owner = await make_user(sessionmaker_)  # email_verified=True
    google(owner.email, verified=True)

    r = await client.post("/auth/google", json={"credential": "x"})
    assert r.status_code == 200, r.text
    row = await _reload(sessionmaker_, owner.id)
    assert row.hashed_password is not None
    r = await client.post("/auth/login", data={"username": owner.email, "password": "Passw0rd!23"})
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_google_sign_in_without_a_role_keeps_a_landlord_a_landlord(client, sessionmaker_, google):
    landlord = await make_user(sessionmaker_, role="landlord")
    await _set(sessionmaker_, landlord.id, available_roles=["landlord"])
    google(landlord.email, verified=True)

    r = await client.post("/auth/google", json={"credential": "x"})
    assert r.status_code == 200, r.text
    row = await _reload(sessionmaker_, landlord.id)
    assert row.role == "landlord"
    assert row.available_roles == ["landlord"]


@pytest.mark.asyncio
async def test_google_sign_in_with_a_role_still_unlocks_it(client, sessionmaker_, google):
    tenant = await make_user(sessionmaker_, role="tenant")
    await _set(sessionmaker_, tenant.id, available_roles=["tenant"])
    google(tenant.email, verified=True)

    r = await client.post("/auth/google", json={"credential": "x", "role": "landlord"})
    assert r.status_code == 200, r.text
    row = await _reload(sessionmaker_, tenant.id)
    assert row.role == "landlord"
    assert sorted(row.available_roles) == ["landlord", "tenant"]
