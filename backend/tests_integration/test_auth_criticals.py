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


# ── emailed links name their account ────────────────────────────────────────

@pytest.fixture
def mailbox(monkeypatch):
    """Tokens and notices the auth routes email, by kind."""
    from app.routers import auth as auth_router

    box: dict[str, list] = {"email_change": [], "reset": [], "notice": []}

    async def _change(to_email, token, full_name):
        box["email_change"].append(token)

    async def _reset(to_email, token, full_name):
        box["reset"].append(token)

    async def _send(to_email, subject, html_content, text_content=None):
        box["notice"].append((to_email, text_content or html_content))
        return True

    monkeypatch.setattr(auth_router.email_service, "send_email_change_verification", _change)
    monkeypatch.setattr(auth_router.email_service, "send_password_reset_email", _reset)
    monkeypatch.setattr(auth_router.email_service, "send_email", _send)
    return box


async def _login(client, user) -> dict:
    r = await client.post("/auth/login", data={"username": user.email, "password": "Passw0rd!23"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_email_change_link_dies_when_google_proves_the_real_owner(client, sessionmaker_, google, mailbox):
    """Someone pre-registered the address and queued a move to their own address."""
    squatter = await make_user(sessionmaker_)
    await _set(sessionmaker_, squatter.id, email_verified=False)
    r = await client.post("/auth/request-email-change", json={"new_email": f"evil_{uuid.uuid4().hex[:6]}@test.com",
                                                              "password": "Passw0rd!23"}, headers=await _login(client, squatter))
    assert r.status_code == 200, r.text

    google(squatter.email, verified=True)
    assert (await client.post("/auth/google", json={"credential": "x"})).status_code == 200

    r = await client.post("/auth/confirm-email-change", json={"token": mailbox["email_change"][0]})
    assert r.status_code == 400, r.text
    assert (await _reload(sessionmaker_, squatter.id)).email == squatter.email


@pytest.mark.asyncio
async def test_email_change_still_works(client, sessionmaker_, mailbox):
    user = await make_user(sessionmaker_)
    new_email = f"moved_{uuid.uuid4().hex[:6]}@test.com"
    r = await client.post("/auth/request-email-change", json={"new_email": new_email, "password": "Passw0rd!23"},
                          headers=await _login(client, user))
    assert r.status_code == 200, r.text

    r = await client.post("/auth/confirm-email-change", json={"token": mailbox["email_change"][0]})
    assert r.status_code == 200, r.text
    assert (await _reload(sessionmaker_, user.id)).email == new_email


@pytest.mark.asyncio
async def test_reset_link_does_not_reach_a_new_account_with_the_same_email(client, sessionmaker_, mailbox):
    email = f"reused_{uuid.uuid4().hex[:8]}@test.com"
    first = await make_user(sessionmaker_, email=email)
    assert (await client.post("/auth/forgot-password", json={"email": email})).status_code == 200
    token = mailbox["reset"][0]

    await _set(sessionmaker_, first.id, email=f"deleted_{first.id}@anonymised.roomivo.internal", is_active=False)
    second = await make_user(sessionmaker_, email=email)

    r = await client.post("/auth/reset-password", json={"token": token, "new_password": "Takeover!234"})
    assert r.status_code == 400, r.text
    r = await client.post("/auth/login", data={"username": email, "password": "Passw0rd!23"})
    assert r.status_code == 200, "the new account's password must be unchanged"
    assert (await _reload(sessionmaker_, second.id)).refresh_token_version == 1


@pytest.mark.asyncio
async def test_reset_link_still_works_once(client, sessionmaker_, mailbox):
    user = await make_user(sessionmaker_)
    await client.post("/auth/forgot-password", json={"email": user.email})
    token = mailbox["reset"][0]

    assert (await client.post("/auth/reset-password", json={"token": token, "new_password": "Brandnew!234"})).status_code == 200
    assert (await client.post("/auth/reset-password", json={"token": token, "new_password": "Again!23456"})).status_code == 400


# ── a takeover blocked at Google ends every session at once ─────────────────

@pytest.mark.asyncio
async def test_squatters_access_token_dies_when_google_proves_the_real_owner(client, sessionmaker_, google, mailbox):
    squatter = await make_user(sessionmaker_)
    await _set(sessionmaker_, squatter.id, email_verified=False)
    squatter_session = await _login(client, squatter)

    google(squatter.email, verified=True)
    assert (await client.post("/auth/google", json={"credential": "x"})).status_code == 200

    assert (await client.get("/auth/me", headers=squatter_session)).status_code == 401
    assert mailbox["notice"] and mailbox["notice"][0][0] == squatter.email
    assert "password was removed" in mailbox["notice"][0][1]


@pytest.mark.asyncio
async def test_linking_google_to_a_password_account_tells_the_owner(client, sessionmaker_, google, mailbox):
    owner = await make_user(sessionmaker_)
    google(owner.email, verified=True)
    assert (await client.post("/auth/google", json={"credential": "x"})).status_code == 200
    assert [to for to, _ in mailbox["notice"]] == [owner.email]


@pytest.mark.asyncio
async def test_logout_with_a_stale_token_does_not_touch_the_new_account(client, sessionmaker_):
    email = f"reused_{uuid.uuid4().hex[:8]}@test.com"
    first = await make_user(sessionmaker_, email=email)
    old_token = auth(first)
    await _set(sessionmaker_, first.id, email=f"deleted_{first.id}@anonymised.roomivo.internal", is_active=False)
    second = await make_user(sessionmaker_, email=email)

    r = await client.post("/auth/logout", headers=old_token)
    assert r.status_code == 200, r.text
    assert (await _reload(sessionmaker_, second.id)).refresh_token_version == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("user_id", ["not-a-uuid", 123, ["x"], {"a": 1}])
async def test_malformed_account_id_is_refused_not_an_error(client, sessionmaker_, user_id):
    user = await make_user(sessionmaker_)
    token = create_access_token({"sub": user.email, "user_id": user_id})
    assert (await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})).status_code == 401
    refresh = create_refresh_token({"sub": user.email, "user_id": user_id, "version": 1})
    assert (await client.post("/auth/refresh", cookies={"refresh_token": refresh})).status_code == 401


# ── a checked name stays the checked name ───────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("bound", [
    {"income_verified": True},
    {"guarantor_status": "verified"},
    {"kbis_verified": True},
    {"deposit_binding_data": {"binding": {"payee_name_match": "MATCH"}}},
])
async def test_name_stays_frozen_while_any_check_holds(client, sessionmaker_, bound):
    """Re-uploading an identity document clears identity_verified; the other checks remain."""
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name="Jean Dupont", identity_verified=False, **bound)

    r = await client.patch("/auth/me", json={"full_name": "Someone Else"}, headers=auth(user))
    assert r.status_code == 409, r.text


@pytest.mark.asyncio
async def test_verified_first_name_must_be_one_of_the_checked_names(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name="Jean Dupont", identity_verified=True, identity_status="verified")

    r = await client.patch("/auth/me", json={"first_name": "Someone"}, headers=auth(user))
    assert r.status_code == 409, r.text
    r = await client.patch("/auth/me", json={"first_name": "jean"}, headers=auth(user))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_verified_name_tolerates_spacing_and_case(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name="Jean Dupont", identity_verified=True, identity_status="verified")

    r = await client.patch("/auth/me", json={"full_name": "jean   DUPONT"}, headers=auth(user))
    assert r.status_code == 200, r.text
    assert (await _reload(sessionmaker_, user.id)).full_name == "Jean Dupont"


@pytest.mark.asyncio
async def test_identity_check_needs_an_account_name():
    from app.services.identity import identity_service

    check = await identity_service._name_check("JEAN DUPONT", None, inclusive=True)
    assert check["passed"] is False and check["critical"] is True


@pytest.mark.asyncio
async def test_international_identity_check_needs_an_account_name(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name=None)
    r = await client.post("/verification/intl/identity/upload",
                          files={"file": ("passport.jpg", b"\xff\xd8\xff" + b"0" * 100, "image/jpeg")}, headers=auth(user))
    assert r.status_code == 422, r.text
    assert "full name" in r.json()["detail"]


# ── Google identities and roles ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_a_second_google_account_cannot_reach_a_linked_account(client, sessionmaker_, google):
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, google_id="g-original")
    google(user.email, verified=True, sub="g-other")

    r = await client.post("/auth/google", json={"credential": "x"})
    assert r.status_code == 409, r.text
    assert (await _reload(sessionmaker_, user.id)).google_id == "g-original"


@pytest.mark.asyncio
async def test_google_does_not_unlock_the_frozen_agency_role(client, sessionmaker_, google):
    tenant = await make_user(sessionmaker_, role="tenant")
    await _set(sessionmaker_, tenant.id, available_roles=["tenant"])
    google(tenant.email, verified=True)

    r = await client.post("/auth/google", json={"credential": "x", "role": "property_manager"})
    assert r.status_code == 403, r.text
    row = await _reload(sessionmaker_, tenant.id)
    assert row.role == "tenant" and row.available_roles == ["tenant"]


@pytest.mark.asyncio
@pytest.mark.parametrize("role,expected", [(None, "tenant"), ("landlord", "landlord")])
async def test_google_creates_a_new_account_with_the_right_role(client, sessionmaker_, google, role, expected):
    email = f"new_{uuid.uuid4().hex[:8]}@test.com"
    google(email, verified=True)
    r = await client.post("/auth/google", json={"credential": "x", **({"role": role} if role else {})})
    assert r.status_code == 200, r.text
    async with sessionmaker_() as s:
        from sqlalchemy import select
        row = (await s.execute(select(User).where(User.email == email))).scalar_one()
    assert row.role == expected and row.available_roles == [expected]


@pytest.mark.asyncio
async def test_switch_role_saves_the_unlocked_role(client, sessionmaker_):
    tenant = await make_user(sessionmaker_, role="tenant")
    await _set(sessionmaker_, tenant.id, available_roles=["tenant"])

    r = await client.post("/auth/switch-role", json={"role": "landlord"}, headers=auth(tenant))
    assert r.status_code == 200, r.text
    assert sorted((await _reload(sessionmaker_, tenant.id)).available_roles) == ["landlord", "tenant"]


# ── regressions found by the review council ─────────────────────────────────

@pytest.mark.asyncio
async def test_an_unchanged_first_name_always_saves(client, sessionmaker_):
    """The profile page sends the stored first_name with every bio save."""
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name="Jean Dupont", first_name="JD", identity_verified=True)

    r = await client.patch("/auth/me", json={"first_name": "JD", "bio": "Student in Nantes, quiet and tidy, looking for a room near campus."},
                           headers=auth(user))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
@pytest.mark.parametrize("full_name,first_name", [
    ("Marie Claire Dupont", "Marie Claire"),
    ("Jean Pierre Martin", "Jean-Pierre"),
    ("Jean-Pierre Martin", "jean pierre"),
])
async def test_first_name_may_be_several_checked_words(client, sessionmaker_, full_name, first_name):
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name=full_name, identity_verified=True)
    r = await client.patch("/auth/me", json={"first_name": first_name}, headers=auth(user))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_first_name_may_not_skip_words(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name="Marie Claire Dupont", identity_verified=True)
    r = await client.patch("/auth/me", json={"first_name": "Marie Dupont"}, headers=auth(user))
    assert r.status_code == 409, r.text


@pytest.mark.asyncio
async def test_a_verified_account_without_a_name_can_set_one_and_redo_the_check(client, sessionmaker_):
    """Verified before a name was required (a Google account with no name)."""
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name=None, identity_verified=True, identity_status="verified",
               identity_data={"identity_assurance": "MEDIUM"})

    r = await client.patch("/auth/me", json={"full_name": "Jean Dupont"}, headers=auth(user))
    assert r.status_code == 200, r.text
    row = await _reload(sessionmaker_, user.id)
    assert row.full_name == "Jean Dupont"
    assert row.identity_verified is False and row.identity_status == "unverified" and row.identity_data is None


@pytest.mark.asyncio
async def test_identity_entry_points_ask_for_a_name_first(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    await _set(sessionmaker_, user.id, full_name=None)

    r = await client.post("/verification/identity/session", headers=auth(user))
    assert r.status_code == 422 and "full name" in r.json()["detail"], r.text
    r = await client.post("/verification/identity/upload",
                          files={"file": ("id.jpg", b"\xff\xd8\xff" + b"0" * 100, "image/jpeg")}, headers=auth(user))
    assert r.status_code == 422 and "full name" in r.json()["detail"], r.text


@pytest.mark.asyncio
async def test_changing_the_password_hands_back_a_working_session(client, sessionmaker_):
    user = await make_user(sessionmaker_)
    session = await _login(client, user)

    r = await client.post("/auth/change-password", json={"old_password": "Passw0rd!23", "new_password": "Newpass!2345"},
                          headers=session)
    assert r.status_code == 200, r.text
    assert (await client.get("/auth/me", headers=session)).status_code == 401
    fresh = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert (await client.get("/auth/me", headers=fresh)).status_code == 200
