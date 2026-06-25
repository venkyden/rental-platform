"""
E-sign Path B service tests — the cryptographic + SG-* edge-case core.

The suite targets the pure service layer (no DB) where correctness lives: the SG-1
verified-party gate, the SG-2 both-parties gate, the SG-3 tamper anchor, manifest
signing against the shared Ed25519 key, and the SG-4 evidence pack.
"""

import asyncio
import types
import uuid
from io import BytesIO

from app.services import esign
from app.services.credential import credential_service
from app.services.storage import storage


def _user(uid=None, identity_verified=True, full_name="Jean Dupont"):
    return types.SimpleNamespace(
        id=uid or uuid.uuid4(),
        identity_verified=identity_verified,
        full_name=full_name,
    )


def _lease(landlord_id, tenant_id, document_source="uploaded"):
    return types.SimpleNamespace(
        id=uuid.uuid4(),
        property_id=uuid.uuid4(),
        landlord_id=landlord_id,
        tenant_id=tenant_id,
        document_source=document_source,
    )


def _entries():
    return [
        {"party": "landlord", "display_name": "A", "consent": True, "signed_at": "2026-06-24T10:00:00"},
        {"party": "tenant", "display_name": "B", "consent": True, "signed_at": "2026-06-24T10:05:00"},
    ]


# ── document hash (SG-3 anchor) ───────────────────────────────────────────────

def test_compute_document_hash_deterministic_and_unique():
    assert esign.compute_document_hash(b"%PDF-1.7 abc") == esign.compute_document_hash(b"%PDF-1.7 abc")
    assert esign.compute_document_hash(b"a") != esign.compute_document_hash(b"b")
    assert len(esign.compute_document_hash(b"x")) == 64  # sha256 hex


# ── SG-1: signer must be a verified party ────────────────────────────────────

def test_can_sign_blocks_non_party():
    lease = _lease(_user().id, _user().id)
    ok, reason = esign.can_sign(_user(), lease)
    assert ok is False
    assert "party" in reason.lower()


def test_can_sign_blocks_unverified_party():
    landlord = _user(identity_verified=False)
    lease = _lease(landlord.id, _user().id)
    ok, reason = esign.can_sign(landlord, lease)
    assert ok is False
    assert "verification" in reason.lower()


def test_can_sign_allows_verified_party():
    tenant = _user()
    lease = _lease(_user().id, tenant.id)
    ok, reason = esign.can_sign(tenant, lease)
    assert ok is True
    assert reason is None


def test_party_of_resolves_role():
    landlord, tenant = _user(), _user()
    lease = _lease(landlord.id, tenant.id)
    assert esign.party_of(landlord, lease) == "landlord"
    assert esign.party_of(tenant, lease) == "tenant"
    assert esign.party_of(_user(), lease) is None


# ── SG-2: manifest only when BOTH parties signed ─────────────────────────────

def test_is_fully_signed_requires_both_parties():
    lease = _lease(_user().id, _user().id)
    assert esign.is_fully_signed([{"party": "landlord"}], lease) is False
    assert esign.is_fully_signed([{"party": "landlord"}, {"party": "tenant"}], lease) is True


def test_is_fully_signed_false_without_tenant():
    lease = _lease(_user().id, None)
    assert esign.is_fully_signed([{"party": "landlord"}], lease) is False


# ── manifest signing / verification (shared credential key) ──────────────────

def test_manifest_sign_verify_roundtrip():
    lease = _lease(_user().id, _user().id)
    h = esign.compute_document_hash(b"%PDF doc")
    manifest = esign.sign_manifest(esign.build_manifest(lease, h, _entries()))
    assert "signature" in manifest
    assert esign.verify_manifest(manifest) is True
    assert esign.verify_manifest(manifest, current_document_hash=h) is True


def test_manifest_verifiable_by_published_credential_key():
    """Lease signatures and credentials must verify against the same public key."""
    lease = _lease(_user().id, _user().id)
    manifest = esign.sign_manifest(esign.build_manifest(lease, "deadbeef", _entries()))
    payload = {k: v for k, v in manifest.items() if k != "signature"}
    assert credential_service.verify_payload(payload, manifest["signature"]) is True


def test_unsigned_manifest_does_not_verify():
    lease = _lease(_user().id, _user().id)
    manifest = esign.build_manifest(lease, "abc", _entries())
    assert esign.verify_manifest(manifest) is False


def test_verify_manifest_detects_payload_tamper():
    lease = _lease(_user().id, _user().id)
    h = esign.compute_document_hash(b"%PDF doc")
    manifest = esign.sign_manifest(esign.build_manifest(lease, h, _entries()))
    manifest["document_hash"] = esign.compute_document_hash(b"%PDF EVIL")
    assert esign.verify_manifest(manifest) is False


def test_verify_manifest_detects_altered_document_sg3():
    lease = _lease(_user().id, _user().id)
    h = esign.compute_document_hash(b"%PDF doc")
    manifest = esign.sign_manifest(esign.build_manifest(lease, h, _entries()))
    altered = esign.compute_document_hash(b"%PDF altered after signing")
    assert esign.verify_manifest(manifest, current_document_hash=altered) is False


# ── audit entry shape ────────────────────────────────────────────────────────

def test_build_audit_entry_records_facts_no_pii_source():
    user = _user(full_name="Marie Curie")
    entry = esign.build_audit_entry("tenant", user, ip="1.2.3.4", user_agent="UA", consent="ok")
    assert entry["party"] == "tenant"
    assert entry["display_name"] == "Marie Curie"
    assert entry["identity_verified"] is True
    assert entry["ip"] == "1.2.3.4"
    assert entry["consent"] == "ok"
    assert "signed_at" in entry


# ── SG-4: evidence pack ───────────────────────────────────────────────────────

def test_evidence_pdf_is_a_pdf():
    lease = _lease(_user().id, _user().id)
    manifest = esign.sign_manifest(
        esign.build_manifest(lease, esign.compute_document_hash(b"%PDF x"), _entries())
    )
    pdf = esign.export_signature_evidence_pdf(manifest)
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 500


# ── storage round-trip (load-bearing SG-3 retrieval) ─────────────────────────

def test_storage_upload_download_roundtrip():
    """The stored lease PDF must come back byte-identical so the SG-3 re-hash holds."""
    content = b"%PDF-1.7 e-sign storage roundtrip"
    key = None
    try:
        result = asyncio.run(storage.upload_file(
            BytesIO(content), filename="rt.pdf", content_type="application/pdf", folder="leases/test-rt",
        ))
        key = result["key"]
        fetched = asyncio.run(storage.download_file(key))
        assert fetched == content
        assert esign.compute_document_hash(fetched) == esign.compute_document_hash(content)
    finally:
        if key:
            asyncio.run(storage.delete_file(key))


def test_storage_download_missing_returns_none():
    assert asyncio.run(storage.download_file("leases/does-not-exist/nope.pdf")) is None
