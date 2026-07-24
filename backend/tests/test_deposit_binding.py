"""
Deposit-binding evidence layer (item 15) — edge-case matrix.

Covers the pure decision logic (IBAN validation, deposit-cap reuse, claim assembly,
evidence rendering) plus the endpoint guard rails and the emit-and-forget invariant
(raw IBAN + raw declared holder name are NEVER persisted).
"""
import types
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.main import app as main_app
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.services.iban import validate_iban, mask_iban
from app.services.lease_rules import validate_deposit
from app.routers.credentials import _build_claims_for_user
from app.services.credential import _evidence_claim_rows

from fastapi.testclient import TestClient


# ── IBAN validation (A1) ─────────────────────────────────────────────────────

class TestIban:
    @pytest.mark.parametrize("iban,country", [
        ("FR7630006000011234567890189", "FR"),
        ("DE89 3704 0044 0532 0130 00", "DE"),
        ("GB82WEST12345698765432", "GB"),
        ("ES9121000418450200051332", "ES"),
    ])
    def test_valid_ibans_pass(self, iban, country):
        r = validate_iban(iban)
        assert r["valid"] is True
        assert r["country"] == country
        assert r["masked"] and "*" in r["masked"]

    def test_lowercase_and_spaced_normalized(self):
        assert validate_iban("fr76 3000 6000 0112 3456 7890 189")["valid"] is True

    def test_bad_checksum_rejected(self):
        r = validate_iban("FR7630006000011234567890188")  # last digit flipped
        assert r["valid"] is False and "mod-97" in r["error"]

    def test_wrong_length_for_country_rejected(self):
        r = validate_iban("DE0037040044053201300")  # DE must be 22
        assert r["valid"] is False and "Longueur" in r["error"]

    def test_malformed_rejected(self):
        for bad in ["FR76", "1234", "XX00", ""]:
            assert validate_iban(bad)["valid"] is False

    def test_unicode_alnum_fails_closed_not_crash(self):
        # Fullwidth / non-ASCII alphanumerics pass str.isalnum() but must not crash
        # the mod-97 step — they fail closed as invalid.
        for bad in ["FR76" + "Ａ" * 23, "FR76" + "٤" * 23, "FR７６" + "0" * 23]:
            assert validate_iban(bad)["valid"] is False

    def test_mask_hides_middle_keeps_last(self):
        masked = mask_iban("FR7630006000011234567890189")
        assert masked.startswith("FR76")
        assert masked.rstrip().endswith("9")  # last char preserved
        assert "1234" not in masked  # body digits hidden


# ── Deposit cap reuse (A2 — lease_rules.validate_deposit) ─────────────────────

class TestDepositCap:
    def test_bail_mobilite_must_be_zero(self):
        assert validate_deposit("mobilite", 500.0, 500.0)  # non-empty = rejected

    def test_mobilite_zero_ok(self):
        assert validate_deposit("mobilite", 0.0, 500.0) == []

    def test_vide_over_one_month_rejected(self):
        assert validate_deposit("vide", 1000.0, 500.0)  # 2x > 1x cap

    def test_meuble_two_months_ok(self):
        assert validate_deposit("meuble", 1000.0, 500.0) == []  # 2x cap


# ── Claim assembly (A4) ──────────────────────────────────────────────────────

def _user_with(deposit_binding_data):
    return types.SimpleNamespace(
        identity_data=None, income_data=None, ownership_data=None,
        insurance_data=None, deposit_binding_data=deposit_binding_data,
    )


class TestClaimsBuilder:
    def test_binding_surfaces_without_inflation(self):
        u = _user_with({"binding": {
            "deposit_amount": 800, "lease_type": "vide",
            "payee_iban_masked": "FR76 **** ***9", "payee_name_match": "MISMATCH",
            "payee_match_target": "individual", "bound_at": "2026-07-05T10:00:00",
        }})
        claims = _build_claims_for_user(u)
        db = claims["deposit_binding"]
        assert db["payee_name_match"] == "MISMATCH"  # never inflated
        assert db["bank_ownership_confirmed"] is False
        assert db["deposit_amount"] == 800

    def test_no_binding_no_claim(self):
        assert "deposit_binding" not in _build_claims_for_user(_user_with(None))

    def test_entity_surfaces(self):
        u = _user_with({"landlord_entity": {
            "type": "sci", "denomination": "SCI DU MOULIN", "gerant_match": True,
        }})
        claims = _build_claims_for_user(u)
        assert claims["landlord_type"] == "sci"
        assert claims["entity_verified"]["denomination"] == "SCI DU MOULIN"


# ── Evidence rendering (A4) ──────────────────────────────────────────────────

class TestEvidenceRows:
    def _row(self, match):
        rows = _evidence_claim_rows({"deposit_binding": {
            "deposit_amount": 800, "payee_iban_masked": "FR76 **** ***9",
            "payee_name_match": match,
        }})
        return next(r for r in rows if "Dépôt de garantie" in r[0])

    def test_match_renders_checkmark(self):
        label, value, assurance = self._row("MATCH")
        assert "✓" in value and "800" in value
        assert "propriété du compte non confirmée" in assurance

    def test_mismatch_renders_warning(self):
        _, value, _ = self._row("MISMATCH")
        assert "n'envoyez rien" in value


# ── Endpoint (A3) ────────────────────────────────────────────────────────────

def _verified_landlord():
    return types.SimpleNamespace(
        id=uuid.uuid4(), full_name="Jean Dupont",
        identity_verified=True, deposit_binding_data=None,
        kbis_verified=False, carte_g_verified=False,
    )


def _client(user, property_obj):
    """TestClient with get_current_user + get_db overridden for a happy-path bind."""
    target = main_app.app if hasattr(main_app, "app") else main_app
    sess = MagicMock()
    sess.execute = AsyncMock(return_value=MagicMock(
        scalar_one_or_none=MagicMock(return_value=property_obj)))
    sess.commit = AsyncMock()
    sess.refresh = AsyncMock()

    def _get_db():
        yield sess

    target.dependency_overrides[get_db] = _get_db
    target.dependency_overrides[get_current_user] = lambda: user
    return TestClient(main_app, base_url="http://testserver/api/v1"), target


_VALID_BODY = {
    "property_id": str(uuid.uuid4()), "lease_type": "vide",
    "monthly_rent_hors_charges": 800.0, "deposit_amount": 800.0,
    "payee_iban": "FR7630006000011234567890189",
    "payee_holder_name": "Jean Dupont", "consent": True,
}


class TestBindEndpoint:
    def test_no_consent_403(self):
        user = _verified_landlord()
        client, target = _client(user, types.SimpleNamespace(id=uuid.uuid4()))
        try:
            r = client.post("/verification/deposit/bind", json={**_VALID_BODY, "consent": False})
            assert r.status_code == 403
        finally:
            target.dependency_overrides.clear()

    def test_unverified_identity_403(self):
        user = _verified_landlord()
        user.identity_verified = False
        client, target = _client(user, types.SimpleNamespace(id=uuid.uuid4()))
        try:
            r = client.post("/verification/deposit/bind", json=_VALID_BODY)
            assert r.status_code == 403
        finally:
            target.dependency_overrides.clear()

    def test_property_not_found_404(self):
        user = _verified_landlord()
        client, target = _client(user, None)  # DB returns no property
        try:
            r = client.post("/verification/deposit/bind", json=_VALID_BODY)
            assert r.status_code == 404
        finally:
            target.dependency_overrides.clear()

    def test_invalid_iban_422(self):
        user = _verified_landlord()
        client, target = _client(user, types.SimpleNamespace(id=uuid.uuid4()))
        try:
            r = client.post("/verification/deposit/bind",
                            json={**_VALID_BODY, "payee_iban": "FR7630006000011234567890188"})
            assert r.status_code == 422
        finally:
            target.dependency_overrides.clear()

    def test_mobilite_nonzero_deposit_422(self):
        user = _verified_landlord()
        client, target = _client(user, types.SimpleNamespace(id=uuid.uuid4()))
        try:
            r = client.post("/verification/deposit/bind",
                            json={**_VALID_BODY, "lease_type": "mobilite", "deposit_amount": 800.0})
            assert r.status_code == 422
        finally:
            target.dependency_overrides.clear()

    def test_happy_path_match_and_emit_and_forget(self):
        user = _verified_landlord()
        client, target = _client(user, types.SimpleNamespace(id=uuid.uuid4()))
        try:
            r = client.post("/verification/deposit/bind", json=_VALID_BODY)
            assert r.status_code == 200
            data = r.json()
            assert data["payee_name_match"] == "MATCH"
            assert data["bank_ownership_confirmed"] is False
            assert "*" in data["payee_iban_masked"]
            # Emit-and-forget: what was persisted must NOT contain the raw IBAN or name.
            stored = user.deposit_binding_data["binding"]
            blob = str(stored)
            assert "FR7630006000011234567890189" not in blob
            assert "payee_holder_name" not in stored
            assert stored["payee_iban_masked"] and "*" in stored["payee_iban_masked"]
        finally:
            target.dependency_overrides.clear()

    def test_happy_path_mismatch_still_binds(self):
        user = _verified_landlord()
        client, target = _client(user, types.SimpleNamespace(id=uuid.uuid4()))
        try:
            r = client.post("/verification/deposit/bind",
                            json={**_VALID_BODY, "payee_holder_name": "Autre Personne"})
            assert r.status_code == 200
            assert r.json()["payee_name_match"] == "MISMATCH"  # evidence, never blocked
        finally:
            target.dependency_overrides.clear()


# ── Entity / SCI landlord verification (item 16) ─────────────────────────────

from app.services.french_government_api import french_gov_service

_SCI_OK = {
    "valid": True, "denomination": "SCI DU MOULIN", "is_active": True,
    "legal_form": "6540", "location": "Nantes",
    "dirigeants": [{"nom": "DUPONT", "prenoms": "JEAN", "qualite": "Gérant"}],
}


class TestVerifyEntityFormat:
    @pytest.mark.asyncio
    async def test_bad_siren_format_rejected_without_network(self):
        for bad in ["123", "12345678a", "", "1234567890"]:
            r = await french_gov_service.verify_entity(bad)
            assert r["valid"] is False


class TestLandlordEntityEndpoint:
    def _run(self, user, body, entity_result=None):
        client, target = _client(user, None)
        try:
            with patch.object(french_gov_service, "verify_entity",
                              AsyncMock(return_value=entity_result)):
                return client.post("/verification/landlord-entity/verify", json=body)
        finally:
            target.dependency_overrides.clear()

    def test_invalid_type_400(self):
        r = self._run(_verified_landlord(), {"landlord_type": "corp"})
        assert r.status_code == 400

    def test_unverified_identity_403(self):
        u = _verified_landlord(); u.identity_verified = False
        r = self._run(u, {"landlord_type": "individual"})
        assert r.status_code == 403

    def test_sci_requires_siren_422(self):
        r = self._run(_verified_landlord(), {"landlord_type": "sci"})
        assert r.status_code == 422

    def test_sci_invalid_entity_422(self):
        r = self._run(_verified_landlord(), {"landlord_type": "sci", "siren": "123456789"},
                      entity_result={"valid": False, "error": "SIREN not found"})
        assert r.status_code == 422

    def test_sci_inactive_422(self):
        inactive = {**_SCI_OK, "is_active": False}
        r = self._run(_verified_landlord(), {"landlord_type": "sci", "siren": "123456789"},
                      entity_result=inactive)
        assert r.status_code == 422

    def test_sci_gerant_match_sets_kbis(self):
        user = _verified_landlord()  # full_name "Jean Dupont"
        r = self._run(user, {"landlord_type": "sci", "siren": "123456789"}, entity_result=_SCI_OK)
        assert r.status_code == 200
        data = r.json()
        assert data["gerant_match"] is True
        assert data["denomination"] == "SCI DU MOULIN"
        assert user.kbis_verified is True
        assert user.deposit_binding_data["landlord_entity"]["type"] == "sci"

    def test_sci_gerant_mismatch_records_but_no_kbis(self):
        user = _verified_landlord(); user.full_name = "Autre Personne"
        r = self._run(user, {"landlord_type": "sci", "siren": "123456789"}, entity_result=_SCI_OK)
        assert r.status_code == 200
        assert r.json()["gerant_match"] is False
        # Chain broken → entity NOT marked verified (anti-spoofing).
        assert user.kbis_verified is False
        assert user.deposit_binding_data["landlord_entity"]["gerant_match"] is False

    def test_manager_sets_carte_g_only(self):
        user = _verified_landlord()
        r = self._run(user, {"landlord_type": "manager"})
        assert r.status_code == 200
        assert user.carte_g_verified is True
        assert user.kbis_verified is False  # never set for manager


class TestSciBindingIntegration:
    """After SCI verification, the deposit name-match targets the SCI denomination."""

    def test_payee_matching_sci_denomination_is_match(self):
        user = _verified_landlord()  # personal name "Jean Dupont"
        user.deposit_binding_data = {"landlord_entity": {
            "type": "sci", "denomination": "SCI DU MOULIN", "gerant_match": True,
        }}
        client, target = _client(user, types.SimpleNamespace(id=uuid.uuid4()))
        try:
            # Payee account is in the SCI's name, NOT the gérant's personal name.
            r = client.post("/verification/deposit/bind",
                            json={**_VALID_BODY, "payee_holder_name": "SCI DU MOULIN"})
            assert r.status_code == 200
            data = r.json()
            assert data["payee_name_match"] == "MATCH"
            assert data["payee_match_target"] == "sci"
        finally:
            target.dependency_overrides.clear()
