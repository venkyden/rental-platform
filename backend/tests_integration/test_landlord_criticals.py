"""
Landlord-side findings of the 2026-10-21 stress test, against real rows:

- a landlord could store a nationality preference ("French preferred") and list a
  home as closed to families; nationality and family situation are protected
  grounds (Code pénal 225-1, loi 89-462 art. 1);
- preferences saved by onboarding were mutated in place and could be lost;
- the deposit payee was matched against an SCI's name even when the person was
  not found among its gérants;
- choosing "manager" marked the account as holding a carte G without any check.
"""

import uuid

import pytest

from app.models.property import Property
from app.models.user import User
from tests_integration.conftest import auth, make_property, make_user


async def _reload(sm, model, row_id):
    async with sm() as s:
        return await s.get(model, row_id)


async def _set(sm, model, row_id, **fields):
    async with sm() as s:
        row = await s.get(model, row_id)
        for key, value in fields.items():
            setattr(row, key, value)
        await s.commit()


# ── no nationality or family criteria ───────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("route", ["/onboarding/preferences", "/onboarding/complete"])
@pytest.mark.parametrize("responses", [
    {"nationality_preference": "french"},
    {"accepted_tenant_types": ["student", "family"]},
    {"nationality": "british"},
    {"gender": "female"},
])
async def test_preferences_refuse_nationality_and_family_criteria(client, sessionmaker_, route, responses):
    landlord = await make_user(sessionmaker_, role="landlord")
    method = client.put if route.endswith("preferences") else client.post

    r = await method(route, json={"responses": responses}, headers=auth(landlord))

    assert r.status_code == 422, r.text
    assert (await _reload(sessionmaker_, User, landlord.id)).preferences is None


@pytest.mark.asyncio
async def test_listing_refuses_family_as_a_tenant_type(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    prop = await make_property(sessionmaker_, landlord)
    await _set(sessionmaker_, Property, prop.id, property_type="studio")

    r = await client.put(f"/properties/{prop.id}", json={"accepted_tenant_types": ["student", "family"]},
                         headers=auth(landlord))
    assert r.status_code == 422, r.text
    r = await client.put(f"/properties/{prop.id}", json={"accepted_tenant_types": ["student", "employee"]},
                         headers=auth(landlord))
    assert r.status_code == 200, r.text
    assert (await _reload(sessionmaker_, Property, prop.id)).accepted_tenant_types == ["student", "employee"]


# ── preferences are saved ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_preference_updates_are_saved(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    await _set(sessionmaker_, User, landlord.id, preferences={"landlord": {"house_rules": ["no_smoking"]}})

    r = await client.put("/onboarding/preferences", json={"responses": {"accepted_tenant_types": ["student"]}},
                         headers=auth(landlord))
    assert r.status_code == 200, r.text

    prefs = (await _reload(sessionmaker_, User, landlord.id)).preferences
    assert prefs["landlord"] == {"house_rules": ["no_smoking"], "accepted_tenant_types": ["student"]}


@pytest.mark.asyncio
async def test_completing_a_second_role_keeps_both_roles_answers(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="landlord")
    await _set(sessionmaker_, User, user.id, preferences={"tenant": {"budget": 600}})

    r = await client.post("/onboarding/complete", json={"responses": {"house_rules": ["no_pets"]}}, headers=auth(user))
    assert r.status_code == 200, r.text

    prefs = (await _reload(sessionmaker_, User, user.id)).preferences
    assert prefs == {"tenant": {"budget": 600}, "landlord": {"house_rules": ["no_pets"]}}


# ── deposit payee and landlord entity ───────────────────────────────────────

VALID_IBAN = "FR7630006000011234567890189"


async def _deposit_ready_landlord(sm, entity):
    landlord = await make_user(sm, role="landlord")
    await _set(sm, User, landlord.id, full_name="Jean Dupont", identity_verified=True, identity_status="verified",
               deposit_binding_data={"landlord_entity": entity})
    prop = await make_property(sm, landlord, status="active")
    return landlord, prop


async def _bind(client, landlord, prop, holder):
    return await client.post("/verification/deposit/bind", json={
        "property_id": str(prop.id), "lease_type": "vide", "monthly_rent_hors_charges": 800,
        "deposit_amount": 800, "payee_iban": VALID_IBAN, "payee_holder_name": holder, "consent": True,
    }, headers=auth(landlord))


@pytest.mark.asyncio
async def test_payee_is_not_matched_to_an_sci_whose_gerant_was_not_found(client, sessionmaker_):
    landlord, prop = await _deposit_ready_landlord(sessionmaker_, {
        "type": "sci", "siren": "123456789", "denomination": "SCI LES TILLEULS", "gerant_match": False,
    })
    r = await _bind(client, landlord, prop, "SCI LES TILLEULS")
    assert r.status_code == 200, r.text
    assert r.json()["payee_match_target"] == "individual"
    assert r.json()["payee_name_match"] == "MISMATCH"


@pytest.mark.asyncio
async def test_payee_is_matched_to_an_sci_its_gerant_runs(client, sessionmaker_):
    landlord, prop = await _deposit_ready_landlord(sessionmaker_, {
        "type": "sci", "siren": "123456789", "denomination": "SCI LES TILLEULS", "gerant_match": True,
    })
    r = await _bind(client, landlord, prop, "SCI LES TILLEULS")
    assert r.status_code == 200, r.text
    assert r.json()["payee_match_target"] == "sci"
    assert r.json()["payee_name_match"] == "MATCH"


@pytest.mark.asyncio
async def test_choosing_manager_does_not_mark_a_carte_g_as_verified(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    await _set(sessionmaker_, User, landlord.id, identity_verified=True, identity_status="verified")

    r = await client.post("/verification/landlord-entity/verify", json={"landlord_type": "manager"},
                          headers=auth(landlord))
    assert r.status_code == 200, r.text
    assert (await _reload(sessionmaker_, User, landlord.id)).carte_g_verified is False


@pytest.mark.asyncio
async def test_leaving_an_sci_clears_its_verification(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    await _set(sessionmaker_, User, landlord.id, identity_verified=True, identity_status="verified",
               kbis_verified=True, deposit_binding_data={"landlord_entity": {"type": "sci", "gerant_match": True}})

    r = await client.post("/verification/landlord-entity/verify", json={"landlord_type": "individual"},
                          headers=auth(landlord))
    assert r.status_code == 200, r.text
    assert (await _reload(sessionmaker_, User, landlord.id)).kbis_verified is False
