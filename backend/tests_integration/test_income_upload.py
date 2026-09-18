"""
POST /verification/income/upload — integration tests.

Focus: income_data is shared with the fr/solvency and intl/solvency rails
(see test_fr_solvency.py). income/upload must merge into it, not replace it
wholesale, or whichever of the three rails runs last wins and destroys the
other two's banded claims.
"""
import pytest
from tests_integration.conftest import make_user, auth


PAYSLIP = ("payslip.pdf", b"%PDF-1.4 fake", "application/pdf")


def _patch_verify_document(monkeypatch, *, verified=True, status="verified", checks=None):
    import app.services.employment as svc

    async def _fake_verify_document(self, file_content, file_type, expected_name, document_type="payslip"):
        return {
            "verified": verified,
            "status": status,
            "validation_checks": checks or [{"name": "name_match", "passed": True, "critical": True}],
            "rejection_reason": None,
        }

    monkeypatch.setattr(svc.EmploymentVerificationService, "verify_document", _fake_verify_document)


@pytest.mark.asyncio
async def test_income_upload_preserves_prior_fr_solvency_claim(client, monkeypatch):
    """Regression: income/upload must not clobber a solvency_assurance/ratio
    already stored by the FR 2D-Doc rail on the same income_data blob."""
    from app.models.user import User

    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    async with sm() as s:
        u = await s.get(User, tenant.id)
        u.income_data = {
            "solvency_assurance": "HIGH",
            "solvency_ratio": ">=3.0",
            "solvency_source": "fr_2ddoc_avis",
        }
        await s.commit()

    _patch_verify_document(monkeypatch)

    r = await client.post(
        "/verification/income/upload",
        headers=auth(tenant),
        files={"file": PAYSLIP},
        data={"document_type": "payslip"},
    )
    assert r.status_code == 200, r.text

    async with sm() as s:
        u = await s.get(User, tenant.id)
        assert u.income_data["solvency_assurance"] == "HIGH"
        assert u.income_data["solvency_ratio"] == ">=3.0"
        assert u.income_data["status"] == "verified"
        assert u.income_verified is True


@pytest.mark.asyncio
async def test_income_upload_result_survives_a_later_fr_solvency_check(client, monkeypatch):
    """Regression, other direction: a solvency check run AFTER income/upload
    must not lose the payslip verification's own fields either (both rails
    merge into the same blob)."""
    from app.models.user import User
    from app.services import fr_2ddoc

    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    async with sm() as s:
        u = await s.get(User, tenant.id)
        u.full_name = "Jean Dupont"
        u.identity_verified = True
        u.identity_status = "verified"
        u.identity_data = {"status": "verified", "identity_assurance": "MEDIUM", "identity_source": "ocr_liveness"}
        await s.commit()

    _patch_verify_document(monkeypatch)
    r1 = await client.post(
        "/verification/income/upload",
        headers=auth(tenant),
        files={"file": PAYSLIP},
        data={"document_type": "payslip"},
    )
    assert r1.status_code == 200, r1.text

    monkeypatch.setattr(fr_2ddoc, "decode_2ddoc", lambda content, ct: "RAW2DDOC")
    monkeypatch.setattr(
        fr_2ddoc,
        "parse_and_verify_avis",
        lambda raw: fr_2ddoc.AvisParsed(
            declarant_names=["DUPONT JEAN"],
            revenu_fiscal_de_reference=36_000,
            annee_des_revenus=2024,
        ),
    )
    r2 = await client.post(
        "/verification/fr/solvency",
        headers=auth(tenant),
        files={"file": ("avis.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"monthly_rent": "1000"},
    )
    assert r2.status_code == 200, r2.text

    async with sm() as s:
        u = await s.get(User, tenant.id)
        assert u.income_data["solvency_assurance"] == "HIGH"
        assert u.income_data["solvency_ratio"] == ">=3.0"
        # The payslip-upload fields from the first call must still be present.
        assert u.income_data["status"] == "verified"
        assert "checks" in u.income_data
