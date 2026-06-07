"""
Property verification — ADEME DPE lookup + taxe foncière control check
(DOSSIER §5.4 PR-1..PR-8, sub-feature #5).
"""
import pytest
from datetime import date, timedelta
from app.services import ademe_dpe


# ── unit: DPEResult helpers ──────────────────────────────────────────────────

def test_is_expired_old_methodology():
    # Pre-July 2021 → old methodology → always expired (PR-5)
    result = ademe_dpe._is_expired(date(2020, 1, 1), valid_until=date(2030, 1, 1))
    assert result is True


def test_is_expired_past_valid_until():
    result = ademe_dpe._is_expired(date(2022, 1, 1), valid_until=date(2023, 1, 1))
    assert result is True


def test_is_expired_still_valid():
    future = date.today() + timedelta(days=365)
    result = ademe_dpe._is_expired(date(2022, 1, 1), valid_until=future)
    assert result is False


def test_parse_date_iso():
    assert ademe_dpe._parse_date("2025-06-01") == date(2025, 6, 1)


def test_parse_date_french():
    assert ademe_dpe._parse_date("01/06/2025") == date(2025, 6, 1)


def test_parse_date_none():
    assert ademe_dpe._parse_date(None) is None
    assert ademe_dpe._parse_date("") is None


# ── unit: lookup_dpe format validation ──────────────────────────────────────

@pytest.mark.asyncio
async def test_lookup_dpe_invalid_number():
    # PR-2 / format guard: too short
    with pytest.raises(ademe_dpe.InvalidDPENumber):
        await ademe_dpe.lookup_dpe("ABC")


@pytest.mark.asyncio
async def test_lookup_dpe_empty():
    with pytest.raises(ademe_dpe.InvalidDPENumber):
        await ademe_dpe.lookup_dpe("")


# ── unit: lookup_dpe via mocked HTTP ────────────────────────────────────────

class _MockResponse:
    def __init__(self, status_code, json_data):
        self.status_code = status_code
        self._json = json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            from httpx import HTTPStatusError, Request, Response
            raise HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._json


class _MockClient:
    def __init__(self, status_code, json_data):
        self._resp = _MockResponse(status_code, json_data)

    async def get(self, url, params=None):
        return self._resp

    async def aclose(self):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        pass


def _ademe_row(energy_class="B", established="2023-01-01", valid_until="2033-01-01", address="1 rue Test 75001 Paris"):
    return {
        "numero_dpe": "1234567890123",
        "etiquette_dpe": energy_class,
        "date_etablissement_dpe": established,
        "date_fin_validite_dpe": valid_until,
        "adresse_ban": address,
    }


@pytest.mark.asyncio
async def test_lookup_dpe_success():
    client = _MockClient(200, {"results": [_ademe_row("B")]})
    result = await ademe_dpe.lookup_dpe("1234567890123", http_client=client)
    assert result.energy_class == "B"
    assert result.assurance == "HIGH"
    assert result.expired is False


@pytest.mark.asyncio
async def test_lookup_dpe_class_g_surfaced_not_blocked():
    # PR-1: Phase 1 surfaces G but does NOT block — blocking is Phase 2.
    client = _MockClient(200, {"results": [_ademe_row("G")]})
    result = await ademe_dpe.lookup_dpe("1234567890123", http_client=client)
    assert result.energy_class == "G"
    assert result.assurance == "HIGH"


@pytest.mark.asyncio
async def test_lookup_dpe_no_class_h():
    # PR-2: scale is A-G only; "H" would come back as unrecognised.
    client = _MockClient(200, {"results": [_ademe_row("H")]})
    with pytest.raises(ademe_dpe.DPENotFound):
        await ademe_dpe.lookup_dpe("1234567890123", http_client=client)


@pytest.mark.asyncio
async def test_lookup_dpe_not_found():
    # PR-4: empty results → DPENotFound (caller uses UNVERIFIED)
    client = _MockClient(200, {"results": []})
    with pytest.raises(ademe_dpe.DPENotFound):
        await ademe_dpe.lookup_dpe("1234567890123", http_client=client)


@pytest.mark.asyncio
async def test_lookup_dpe_5xx_raises_unavailable():
    # PR-6: 5xx → ADEMEUnavailable (non-blocking)
    client = _MockClient(503, {})
    with pytest.raises(ademe_dpe.ADEMEUnavailable):
        await ademe_dpe.lookup_dpe("1234567890123", http_client=client)


@pytest.mark.asyncio
async def test_lookup_dpe_expired_old_methodology():
    # PR-5: pre-Jul-2021 DPE → expired=True even if valid_until is future.
    future = (date.today() + timedelta(days=365)).isoformat()
    row = _ademe_row("C", established="2020-06-01", valid_until=future)
    client = _MockClient(200, {"results": [row]})
    result = await ademe_dpe.lookup_dpe("1234567890123", http_client=client)
    assert result.expired is True


@pytest.mark.asyncio
async def test_lookup_dpe_expired_past_validity():
    # PR-5: past valid_until → expired=True
    row = _ademe_row("D", established="2022-01-01", valid_until="2023-01-01")
    client = _MockClient(200, {"results": [row]})
    result = await ademe_dpe.lookup_dpe("1234567890123", http_client=client)
    assert result.expired is True


# ── endpoint integration ─────────────────────────────────────────────────────

from tests_integration.conftest import make_user, make_property, auth


def _patch_ademe(monkeypatch, *, result=None, error=None):
    import app.services.ademe_dpe as svc
    if error is not None:
        async def _raise(dpe_number, **kw):
            raise error
        monkeypatch.setattr(svc, "lookup_dpe", _raise)
    else:
        async def _ok(dpe_number, **kw):
            return result
        monkeypatch.setattr(svc, "lookup_dpe", _ok)


def _dpe_result(cls="B", expired=False):
    future = date.today() + timedelta(days=3650)
    return ademe_dpe.DPEResult(
        dpe_number="1234567890123",
        energy_class=cls,
        established_date=date(2022, 1, 1),
        valid_until=future,
        expired=expired,
        address_line="1 rue Test 75001 Paris",
        assurance="HIGH",
    )


@pytest.mark.asyncio
async def test_dpe_endpoint_success(client, monkeypatch):
    """PR-3: live ADEME data → dpe_rating updated on property."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    _patch_ademe(monkeypatch, result=_dpe_result("B"))

    r = await client.post(
        f"/verification/property/{prop.id}/dpe",
        headers=auth(landlord),
        data={"dpe_number": "1234567890123"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dpe_assurance"] == "HIGH"
    assert body["dpe_class"] == "B"
    assert body["expired"] is False

    async with sm() as s:
        from app.models.property import Property as P
        p = await s.get(P, prop.id)
        # PR-3: property.dpe_rating updated from ADEME, never from caller input
        assert p.dpe_rating == "B"
        assert p.ownership_data["dpe_assurance"] == "HIGH"


@pytest.mark.asyncio
async def test_dpe_endpoint_g_class_note(client, monkeypatch):
    """PR-1 Phase 1: G class is returned with advisory note, not blocked."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    _patch_ademe(monkeypatch, result=_dpe_result("G"))

    r = await client.post(
        f"/verification/property/{prop.id}/dpe",
        headers=auth(landlord),
        data={"dpe_number": "1234567890123"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["dpe_class"] == "G"
    assert body["note"] is not None  # advisory note present
    # Not blocked — Phase 1 only surfaces the class


@pytest.mark.asyncio
async def test_dpe_endpoint_not_found_returns_unverified(client, monkeypatch):
    """PR-4: DPE not in ADEME → UNVERIFIED, non-blocking (200)."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    _patch_ademe(monkeypatch, error=ademe_dpe.DPENotFound("not found"))

    r = await client.post(
        f"/verification/property/{prop.id}/dpe",
        headers=auth(landlord),
        data={"dpe_number": "1234567890123"},
    )
    assert r.status_code == 200
    assert r.json()["dpe_assurance"] == "UNVERIFIED"


@pytest.mark.asyncio
async def test_dpe_endpoint_ademe_unavailable_returns_pending(client, monkeypatch):
    """PR-6: ADEME 5xx → PENDING (200, non-blocking)."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    _patch_ademe(monkeypatch, error=ademe_dpe.ADEMEUnavailable("503"))

    r = await client.post(
        f"/verification/property/{prop.id}/dpe",
        headers=auth(landlord),
        data={"dpe_number": "1234567890123"},
    )
    assert r.status_code == 200
    assert r.json()["dpe_assurance"] == "PENDING"


@pytest.mark.asyncio
async def test_dpe_endpoint_expired_flag(client, monkeypatch):
    """PR-5: expired DPE flagged in response."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    _patch_ademe(monkeypatch, result=_dpe_result("C", expired=True))

    r = await client.post(
        f"/verification/property/{prop.id}/dpe",
        headers=auth(landlord),
        data={"dpe_number": "1234567890123"},
    )
    assert r.status_code == 200
    assert r.json()["expired"] is True


@pytest.mark.asyncio
async def test_dpe_endpoint_wrong_landlord(client, monkeypatch):
    """Can't verify someone else's property."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    other = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)

    r = await client.post(
        f"/verification/property/{prop.id}/dpe",
        headers=auth(other),
        data={"dpe_number": "1234567890123"},
    )
    assert r.status_code == 403


# ── property upload: PR-8 ownership overclaim fix ────────────────────────────

def _patch_property_service(monkeypatch, *, control_documented=True, address_match=True):
    import app.services.property as svc
    async def _mock(file_content, file_type, expected_owner_name, expected_address, document_type):
        if control_documented:
            return {
                "verified": address_match,
                "status": "verified" if address_match else "pending_review",
                "data": {"owner_name": "Jean Dupont", "property_address": "1 rue Test 75001 Paris", "confidence_score": 0.9},
                "validation_checks": [],
                "rejection_reason": None,
            }
        return {
            "verified": False,
            "status": "rejected",
            "data": None,
            "validation_checks": [],
            "rejection_reason": "Could not extract data",
        }
    monkeypatch.setattr(svc.property_verification_service, "verify_document", _mock)


PDF = ("taxe.pdf", b"%PDF-1.4 fake", "application/pdf")


@pytest.mark.asyncio
async def test_property_upload_control_not_ownership(client, monkeypatch):
    """PR-8: upload sets control_not_ownership_attested, never ownership_verified overclaim."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    _patch_property_service(monkeypatch, control_documented=True)

    r = await client.post(
        f"/verification/property/upload?property_id={prop.id}&document_type=taxe_fonciere",
        headers=auth(landlord),
        files={"file": PDF},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # PR-8: response must never claim "ownership" or "verified" without qualification
    assert body["property_control"] is True
    assert body["property_control_assurance"] == "MEDIUM"
    assert "control_not_ownership" in body["label"]

    async with sm() as s:
        from app.models.property import Property as P
        p = await s.get(P, prop.id)
        assert p.ownership_data["label"] == "control_not_ownership_attested"
        # No file_url — document not stored (GDPR / stateless design)
        assert "file_url" not in p.ownership_data


@pytest.mark.asyncio
async def test_property_upload_no_document_stored(client, monkeypatch):
    """Source document must never be stored in ownership_data (GDPR / stateless)."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    _patch_property_service(monkeypatch, control_documented=True)

    await client.post(
        f"/verification/property/upload?property_id={prop.id}&document_type=taxe_fonciere",
        headers=auth(landlord),
        files={"file": PDF},
    )
    async with sm() as s:
        from app.models.property import Property as P
        p = await s.get(P, prop.id)
        data = p.ownership_data or {}
        assert "file_url" not in data
        assert "filename" not in data


@pytest.mark.asyncio
async def test_property_upload_user_status_control_not_verified(client, monkeypatch):
    """User ownership_status must say 'control_documented', not 'verified'."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    _patch_property_service(monkeypatch, control_documented=True)

    await client.post(
        f"/verification/property/upload?property_id={prop.id}&document_type=taxe_fonciere",
        headers=auth(landlord),
        files={"file": PDF},
    )
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, landlord.id)
        assert u.ownership_status == "control_documented"
        # The user_level ownership_data also must never claim ownership proven
        assert u.ownership_data.get("label") == "control_not_ownership_attested"
