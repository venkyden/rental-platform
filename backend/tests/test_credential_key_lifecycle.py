"""
Key-lifecycle tests for the credential service (WS-3, stress-test finding F12).

Invariants:
- every newly signed credential carries a `kid` bound inside the signed payload
- rotation: a credential signed under a retired key still verifies when that
  key's public half is kept in the retired verify set
- fail-closed: a credential whose kid matches no known key never verifies
- legacy records (signed before kid existed) still verify by key trial
"""

import hashlib

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.services.credential import CredentialService, _canonical_payload

KEY_A = Ed25519PrivateKey.generate()
KEY_B = Ed25519PrivateKey.generate()


def _seed_hex(private_key) -> str:
    from cryptography.hazmat.primitives.serialization import (
        NoEncryption, PrivateFormat,
    )
    return private_key.private_bytes(
        Encoding.Raw, PrivateFormat.Raw, NoEncryption()
    ).hex()


def _pub_hex(private_key) -> str:
    return private_key.public_key().public_bytes(
        Encoding.Raw, PublicFormat.Raw
    ).hex()


def _expected_kid(private_key) -> str:
    raw = private_key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    return hashlib.sha256(raw).hexdigest()[:16]


CLAIMS = {"identity_assurance": "MEDIUM", "identity_source": "ocr_liveness"}


class TestKidIssuance:
    def test_issue_includes_kid_bound_in_signature(self):
        svc = CredentialService(signing_key_hex=_seed_hex(KEY_A))
        payload = svc.issue("tenant", "FR", dict(CLAIMS))

        assert payload["kid"] == _expected_kid(KEY_A)
        assert svc.verify_signature(payload) is True

    def test_tampered_kid_invalidates_signature(self):
        """kid is inside the signed payload — swapping it must break the sig."""
        svc = CredentialService(signing_key_hex=_seed_hex(KEY_A))
        payload = svc.issue("tenant", "FR", dict(CLAIMS))
        payload["kid"] = "0" * 16

        assert svc.verify_signature(payload) is False


class TestRotation:
    def test_old_credential_verifies_after_rotation(self):
        svc_old = CredentialService(signing_key_hex=_seed_hex(KEY_A))
        record = svc_old.issue("tenant", "FR", dict(CLAIMS))

        svc_new = CredentialService(
            signing_key_hex=_seed_hex(KEY_B),
            retired_verify_keys_hex=[_pub_hex(KEY_A)],
        )
        assert svc_new.verify_signature(record) is True
        # and new issuance signs under the new kid
        assert svc_new.issue("tenant", "FR", dict(CLAIMS))["kid"] == _expected_kid(KEY_B)

    def test_unknown_kid_fails_closed(self):
        svc_old = CredentialService(signing_key_hex=_seed_hex(KEY_A))
        record = svc_old.issue("tenant", "FR", dict(CLAIMS))

        svc_new = CredentialService(signing_key_hex=_seed_hex(KEY_B))
        assert svc_new.verify_signature(record) is False

    def test_legacy_record_without_kid_verifies_by_key_trial(self):
        svc_old = CredentialService(signing_key_hex=_seed_hex(KEY_A))
        payload = {
            "credential_id": "vc_legacy",
            "subject_role": "tenant",
            "issued_at": "2026-01-01T00:00:00Z",
            "expires_at": "2026-02-01T00:00:00Z",
            "rail": "FR",
            "claims": dict(CLAIMS),
            "disclaimer": "legacy",
        }
        payload["signature"] = svc_old.sign_payload(
            {k: v for k, v in payload.items() if k != "signature"}
        )

        svc_new = CredentialService(
            signing_key_hex=_seed_hex(KEY_B),
            retired_verify_keys_hex=[_pub_hex(KEY_A)],
        )
        assert svc_new.verify_signature(payload) is True

    def test_generic_payload_signature_survives_rotation(self):
        """E-sign signatures (no kid) must verify against the retired set too."""
        svc_old = CredentialService(signing_key_hex=_seed_hex(KEY_A))
        doc = {"lease_id": "l1", "hash": "abc"}
        sig = svc_old.sign_payload(doc)

        svc_new = CredentialService(
            signing_key_hex=_seed_hex(KEY_B),
            retired_verify_keys_hex=[_pub_hex(KEY_A)],
        )
        assert svc_new.verify_payload(doc, sig) is True
        assert svc_new.verify_payload({"lease_id": "l1", "hash": "TAMPERED"}, sig) is False


class TestKeyHistory:
    def test_key_history_lists_active_then_retired(self):
        svc = CredentialService(
            signing_key_hex=_seed_hex(KEY_B),
            retired_verify_keys_hex=[_pub_hex(KEY_A)],
        )
        history = svc.key_history()

        assert history[0]["kid"] == _expected_kid(KEY_B)
        assert history[0]["status"] == "active"
        assert history[1]["kid"] == _expected_kid(KEY_A)
        assert history[1]["status"] == "retired"
        for entry in history:
            assert entry["public_key_pem"].startswith("-----BEGIN PUBLIC KEY-----")

    def test_bad_retired_key_rejected(self):
        import pytest
        with pytest.raises(ValueError):
            CredentialService(
                signing_key_hex=_seed_hex(KEY_A),
                retired_verify_keys_hex=["deadbeef"],  # not 32 bytes
            )


class TestPublicKeysEndpoint:
    def test_public_keys_endpoint_returns_history(self):
        from fastapi.testclient import TestClient
        from app.main import app

        with TestClient(app) as c:
            resp = c.get("/credentials/public-keys")

        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body["keys"], list)
        assert body["keys"][0]["status"] == "active"
        assert set(body["keys"][0]) == {"kid", "public_key_pem", "status"}
