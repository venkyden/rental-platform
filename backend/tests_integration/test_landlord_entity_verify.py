"""
POST /verification/landlord-entity/verify — integration tests.

Regression: the "manager" (Hoguet carte G mandataire) branch used to set
carte_g_verified=True unconditionally — a self-declared type with ZERO
registry check (unlike the sci branch, which really verifies via SIREN +
gérant name-match before setting kbis_verified). That false "verified"
professional-license claim flowed straight into the externally-shareable
credential (credentials.py _build_claims_for_user reads
deposit_binding_data.landlord_entity into claims["landlord_type"]).
"""
from unittest.mock import AsyncMock

import pytest

from tests_integration.conftest import make_user, auth


async def _verified_landlord(sm, email="landlord_entity@test.com"):
    from app.models.user import User
    landlord = await make_user(sm, role="landlord", email=email)
    async with sm() as s:
        u = await s.get(User, landlord.id)
        u.identity_verified = True
        await s.commit()
        await s.refresh(u)
        return u


@pytest.mark.asyncio
async def test_manager_self_declaration_does_not_set_carte_g_verified(client, sessionmaker_):
    """A bare self-declaration of "manager" must never flip the verified flag —
    there is no registry check behind this branch."""
    sm = sessionmaker_
    landlord = await _verified_landlord(sm)

    r = await client.post(
        "/verification/landlord-entity/verify",
        headers=auth(landlord),
        json={"landlord_type": "manager"},
    )
    assert r.status_code == 200, r.text

    async with sm() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, landlord.id)
        assert refreshed.carte_g_verified is False


@pytest.mark.asyncio
async def test_manager_declaration_does_not_leak_into_shared_credential(client, sessionmaker_):
    """Even if landlord_type=manager is recorded, no unverified professional-license
    claim should ride along into the self-issued, publicly-verifiable credential
    looking like an attested fact."""
    sm = sessionmaker_
    landlord = await _verified_landlord(sm, email="landlord_entity2@test.com")

    r = await client.post(
        "/verification/landlord-entity/verify",
        headers=auth(landlord),
        json={"landlord_type": "manager"},
    )
    assert r.status_code == 200, r.text

    r2 = await client.post("/credentials/issue-mine", headers=auth(landlord))
    assert r2.status_code == 201, r2.text
    claims = r2.json()["claims"]
    # landlord_type is bare self-declared metadata (like "individual") and is not
    # itself a false verification claim, but there must be no entity_verified /
    # carte_g claim implying a licence was actually checked.
    assert "entity_verified" not in claims
    assert "carte_g" not in str(claims).lower()


@pytest.mark.asyncio
async def test_sci_gerant_match_still_sets_kbis_verified(client, sessionmaker_, monkeypatch):
    """Confirm the fix didn't collaterally break the sci branch's real verification path."""
    sm = sessionmaker_
    landlord = await _verified_landlord(sm, email="landlord_sci@test.com", )
    async with sm() as s:
        from app.models.user import User
        u = await s.get(User, landlord.id)
        u.full_name = "Jean Dupont"
        await s.commit()

    from app.services.french_government_api import french_gov_service
    monkeypatch.setattr(french_gov_service, "verify_entity", AsyncMock(return_value={
        "valid": True,
        "is_active": True,
        "denomination": "SCI DUPONT IMMOBILIER",
        "legal_form": "SCI",
        "dirigeants": [{"qualite": "Gérant", "prenoms": "Jean", "nom": "Dupont"}],
    }))

    r = await client.post(
        "/verification/landlord-entity/verify",
        headers=auth(landlord),
        json={"landlord_type": "sci", "siren": "123456789"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["gerant_match"] is True

    async with sm() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, landlord.id)
        assert refreshed.kbis_verified is True


@pytest.mark.asyncio
async def test_sci_gerant_mismatch_does_not_set_kbis_verified(client, sessionmaker_, monkeypatch):
    """A real SCI's SIREN with a DIFFERENT gérant must not verify this claimant."""
    sm = sessionmaker_
    landlord = await _verified_landlord(sm, email="landlord_sci2@test.com")
    async with sm() as s:
        from app.models.user import User
        u = await s.get(User, landlord.id)
        u.full_name = "Someone Else"
        await s.commit()

    from app.services.french_government_api import french_gov_service
    monkeypatch.setattr(french_gov_service, "verify_entity", AsyncMock(return_value={
        "valid": True,
        "is_active": True,
        "denomination": "SCI DUPONT IMMOBILIER",
        "legal_form": "SCI",
        "dirigeants": [{"qualite": "Gérant", "prenoms": "Jean", "nom": "Dupont"}],
    }))

    r = await client.post(
        "/verification/landlord-entity/verify",
        headers=auth(landlord),
        json={"landlord_type": "sci", "siren": "123456789"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["gerant_match"] is False

    async with sm() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, landlord.id)
        assert refreshed.kbis_verified is False
