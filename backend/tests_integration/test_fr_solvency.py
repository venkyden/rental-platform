"""
FR HIGH solvency rail — unit + integration (DOSSIER §5.3 SV-1..SV-8).
"""
import pytest
from app.services import fr_2ddoc


# ── unit: band_solvency_ratio ────────────────────────────────────────────────

def test_band_at_exactly_3():
    # RFR 36 000, rent 1 000/mo → ratio exactly 3.0 → ">=3.0"
    assert fr_2ddoc.band_solvency_ratio(36_000, 1_000) == ">=3.0"


def test_band_above_3():
    assert fr_2ddoc.band_solvency_ratio(50_000, 1_000) == ">=3.0"


def test_band_between_2_5_and_3():
    # SV-7: 30 000 / 12 000 = 2.5 → ">=2.5", not silently bumped to ">=3.0"
    assert fr_2ddoc.band_solvency_ratio(30_000, 1_000) == ">=2.5"


def test_band_at_exactly_2_5():
    assert fr_2ddoc.band_solvency_ratio(30_000, 1_000) == ">=2.5"


def test_band_between_2_and_2_5():
    # 25 200 / 12 000 = 2.1
    assert fr_2ddoc.band_solvency_ratio(25_200, 1_000) == ">=2.0"


def test_band_below_2():
    # 20 000 / 12 000 ≈ 1.67
    assert fr_2ddoc.band_solvency_ratio(20_000, 1_000) == "<2.0"


def test_band_just_below_3_not_rounded_up():
    # SV-7: 35 999 / 12 000 ≈ 2.9999 — must not round to ">=3.0"
    assert fr_2ddoc.band_solvency_ratio(35_999, 1_000) == ">=2.5"


def test_band_invalid_rent():
    with pytest.raises(ValueError):
        fr_2ddoc.band_solvency_ratio(36_000, 0)


# ── unit: is_avis_stale ──────────────────────────────────────────────────────

def test_stale_detection_old_year():
    # 2021 income, checked in 2024 → 3 years > 2 → stale
    assert fr_2ddoc.is_avis_stale(2021, current_year=2024) is True


def test_stale_detection_recent():
    # 2023 income, checked in 2024 → 1 year ≤ 2 → not stale
    assert fr_2ddoc.is_avis_stale(2023, current_year=2024) is False


def test_stale_detection_exactly_at_boundary():
    # 2022 income, checked in 2024 → exactly 2 years → not stale
    assert fr_2ddoc.is_avis_stale(2022, current_year=2024) is False


# ── endpoint integration ─────────────────────────────────────────────────────

from tests_integration.conftest import make_user, auth

PDF = ("avis.pdf", b"%PDF-1.4 fake", "application/pdf")


async def _make_verified_tenant(sm, full_name="Jean Dupont"):
    tenant = await make_user(sm, role="tenant")
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
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


def _patch_pipeline(monkeypatch, *, names=None, rfr=None, annee=2024, error=None):
    import app.services.fr_2ddoc as svc
    monkeypatch.setattr(svc, "decode_2ddoc", lambda content, ct: "RAW2DDOC")
    if error is not None:
        def _raise(raw):
            raise error
        monkeypatch.setattr(svc, "parse_and_verify_avis", _raise)
    else:
        monkeypatch.setattr(
            svc,
            "parse_and_verify_avis",
            lambda raw: svc.AvisParsed(
                declarant_names=names or [],
                revenu_fiscal_de_reference=rfr,
                annee_des_revenus=annee,
            ),
        )


@pytest.mark.asyncio
async def test_solvency_requires_verified_identity(client):
    """Requires identity verification before solvency check."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    r = await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": PDF},
        data={"monthly_rent": "1000"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_solvency_high_ratio_stored_banded(client, monkeypatch):
    """SV-1: signed RFR present, ratio >= 3.0 → HIGH assurance, banded claim stored, raw RFR discarded."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm, full_name="Jean Dupont")
    _patch_pipeline(monkeypatch, names=["DUPONT JEAN"], rfr=36_000, annee=2024)

    r = await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": PDF},
        data={"monthly_rent": "1000"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["solvency_assurance"] == "HIGH"
    assert body["solvency_ratio"] == ">=3.0"
    assert body["annee_des_revenus"] == 2024
    assert body["recency_flag"] is False
    assert body["avis_corroborated_name"] is True

    # Verify only banded data is persisted — no raw RFR.
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        assert u.identity_data["solvency_assurance"] == "HIGH"
        assert u.identity_data["solvency_ratio"] == ">=3.0"
        assert "revenu_fiscal_de_reference" not in u.identity_data
        # Identity assurance must remain MEDIUM — solvency HIGH never inflates it.
        assert u.identity_data["identity_assurance"] == "MEDIUM"


@pytest.mark.asyncio
async def test_solvency_below_3_honest_band(client, monkeypatch):
    """SV-7: ratio 2.5 → '>=2.5', never silently bumped to '>=3.0'."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    _patch_pipeline(monkeypatch, names=["Tenant User"], rfr=30_000, annee=2024)

    r = await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": PDF},
        data={"monthly_rent": "1000"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["solvency_ratio"] == ">=2.5"
    assert body["solvency_assurance"] == "HIGH"


@pytest.mark.asyncio
async def test_solvency_stale_avis_recency_flag(client, monkeypatch):
    """SV-2: avis income year more than 2 years ago → recency_flag=True (not blocked)."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    # Use a year that is guaranteed stale (5 years before current year).
    from datetime import datetime
    stale_year = datetime.utcnow().year - 5
    _patch_pipeline(monkeypatch, names=["Tenant User"], rfr=36_000, annee=stale_year)

    r = await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": PDF},
        data={"monthly_rent": "1000"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["recency_flag"] is True
    # Still returns the banded ratio — recency is a flag, not a block.
    assert body["solvency_ratio"] == ">=3.0"
    assert body["solvency_assurance"] == "HIGH"


@pytest.mark.asyncio
async def test_solvency_rfr_absent_returns_unverified(client, monkeypatch):
    """RFR absent in signed payload → solvency_assurance=UNVERIFIED, no ratio."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    _patch_pipeline(monkeypatch, names=["Tenant User"], rfr=None, annee=2024)

    r = await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": PDF},
        data={"monthly_rent": "1000"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["solvency_assurance"] == "UNVERIFIED"
    assert body["solvency_ratio"] is None


@pytest.mark.asyncio
async def test_solvency_fiscal_capacity_label_not_monthly_income(client, monkeypatch):
    """SV-8: response label must say 'fiscal capacity', never 'monthly income'."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    _patch_pipeline(monkeypatch, names=["Tenant User"], rfr=36_000)

    r = await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": PDF},
        data={"monthly_rent": "1000"},
    )
    assert r.status_code == 200
    label = r.json()["fiscal_capacity_label"].lower()
    assert "fiscal" in label or "rfr" in label or "référence" in label
    assert "monthly" not in label
    assert "mensuel" not in label


@pytest.mark.asyncio
async def test_solvency_signature_invalid_returns_422(client, monkeypatch):
    """Forged / unknown-cert 2D-Doc → 422 (not 200 with bad data)."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    _patch_pipeline(monkeypatch, error=fr_2ddoc.SignatureInvalid("bad sig"))

    r = await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": PDF},
        data={"monthly_rent": "1000"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_solvency_barcode_unreadable_returns_422(client, monkeypatch):
    """Unreadable barcode → 422 rescan (never silently passes)."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    import app.services.fr_2ddoc as svc
    def _raise(c, ct):
        raise svc.BarcodeUnreadable("nope")
    monkeypatch.setattr(svc, "decode_2ddoc", _raise)

    r = await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": PDF},
        data={"monthly_rent": "1000"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_solvency_identity_assurance_not_inflated(client, monkeypatch):
    """HIGH solvency must never inflate identity_assurance from MEDIUM to HIGH."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    _patch_pipeline(monkeypatch, names=["Tenant User"], rfr=36_000)

    await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": PDF},
        data={"monthly_rent": "1000"},
    )
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        assert u.identity_data["identity_assurance"] == "MEDIUM"
