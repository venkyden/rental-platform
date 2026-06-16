"""
Avis d'imposition 2D-Doc pipeline — unit + integration (DOSSIER §5.3 SV-1, §5.1 C-1..C-8).
"""
import pytest
from app.services import fr_2ddoc


# ── name matching ───────────────────────────────────────────────────────────

def test_name_match_exact():
    assert fr_2ddoc.name_matches_any("Jean Dupont", ["Jean Dupont"]) is True


def test_name_match_reordered_and_case():
    assert fr_2ddoc.name_matches_any("Jean Dupont", ["DUPONT JEAN"]) is True


def test_name_match_accents_stripped():
    assert fr_2ddoc.name_matches_any("Helene Cesar", ["Hélène César"]) is True


def test_name_match_against_declarant2():
    # ID holder is the spouse (second declarant on a couple's avis).
    assert fr_2ddoc.name_matches_any("Marie Martin", ["Jean Dupont", "Marie Martin"]) is True


def test_name_mismatch():
    assert fr_2ddoc.name_matches_any("Jean Dupont", ["Paul Durand"]) is False


def test_name_match_empty_inputs():
    assert fr_2ddoc.name_matches_any("", ["Jean Dupont"]) is False
    assert fr_2ddoc.name_matches_any("Jean Dupont", []) is False


# ── decode/parse error mapping (libs mocked) ────────────────────────────────

def test_decode_raises_barcode_unreadable_when_no_barcode(monkeypatch):
    monkeypatch.setattr(fr_2ddoc, "_to_images", lambda c, t: ["img"])
    import pylibdmtx.pylibdmtx as dmtx
    monkeypatch.setattr(dmtx, "decode", lambda img: [])
    with pytest.raises(fr_2ddoc.BarcodeUnreadable):
        fr_2ddoc.decode_2ddoc(b"x", "image/png")


# ── endpoint integration ────────────────────────────────────────────────────

from tests_integration.conftest import make_user, auth


async def _make_verified_tenant(sm, full_name="Jean Dupont"):
    tenant = await make_user(sm, role="tenant")
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        u.full_name = full_name  # PR #4: name read from user.full_name, not extracted_data
        u.identity_verified = True
        u.identity_status = "verified"
        u.identity_data = {
            "status": "verified",
            "identity_assurance": "MEDIUM",
            "identity_source": "ocr_liveness",
            "extracted_data": {"full_name": full_name},
        }
        await s.commit()
    return tenant


def _patch_pipeline(monkeypatch, *, names=None, error=None):
    import app.services.fr_2ddoc as svc
    monkeypatch.setattr(svc, "decode_2ddoc", lambda content, ct: "RAW2DDOC")
    if error is not None:
        def _raise(raw):
            raise error
        monkeypatch.setattr(svc, "parse_and_verify_avis", _raise)
    else:
        monkeypatch.setattr(svc, "parse_and_verify_avis",
                            lambda raw: svc.AvisIdentity(declarant_names=names or []))


PDF = ("avis.pdf", b"%PDF-1.4 fake", "application/pdf")


@pytest.mark.asyncio
async def test_avis_requires_verified_identity(client):
    """C-6: avis before identity exists -> 400."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_avis_name_match_sets_flag(client, monkeypatch):
    """SV-1 / C-1: signed declarant name matches ID name -> corroborated + flag stored."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm, full_name="Jean Dupont")
    _patch_pipeline(monkeypatch, names=["DUPONT JEAN"])

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 200, r.text
    assert r.json()["corroborated"] is True

    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        assert u.identity_data["identity_name_corroborated_by"] == "avis_2ddoc"
        # assurance stays MEDIUM — never upgraded
        assert u.identity_data["identity_assurance"] == "MEDIUM"


@pytest.mark.asyncio
async def test_avis_name_mismatch_no_flag(client, monkeypatch):
    """C-5: declarant name differs -> not corroborated, no flag."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm, full_name="Jean Dupont")
    _patch_pipeline(monkeypatch, names=["Paul Durand"])

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 200
    assert r.json()["corroborated"] is False
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        assert "identity_name_corroborated_by" not in u.identity_data


@pytest.mark.asyncio
async def test_avis_signature_invalid_returns_not_corroborated(client, monkeypatch):
    """C-3 / C-8: bad ECDSA -> 200 not corroborated, no crash."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    _patch_pipeline(monkeypatch, error=fr_2ddoc.SignatureInvalid("bad sig"))

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 200
    assert r.json()["corroborated"] is False
    assert r.json()["reason"] == "signature_invalid"


@pytest.mark.asyncio
async def test_avis_barcode_unreadable_returns_422(client, monkeypatch):
    """C-2: unreadable barcode -> 422 rescan."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    import app.services.fr_2ddoc as svc
    def _raise(content, ct):
        raise svc.BarcodeUnreadable("nope")
    monkeypatch.setattr(svc, "decode_2ddoc", _raise)

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_avis_wrong_type_returns_422(client, monkeypatch):
    """C-4: valid 2D-Doc but not an avis -> 422 reject."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    _patch_pipeline(monkeypatch, error=fr_2ddoc.WrongDocumentType("type 00"))

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 422
