"""
Relying-party UX / anti-amplification (WS-5, stress-test findings F5 + F4).

F5: an official-looking evidence document must state, prominently, what it does
NOT prove — a MEDIUM identity can be passed with a stolen ID, and property
control is a document check, not an ownership proof. Otherwise the credential
AMPLIFIES the deposit-theft scam it is meant to prevent.

F4 / DG-2 (non-gating stance): the candidate-listing surface must not expose the
assurance tier as a filterable/sortable field to landlords.
"""

from app.services.credential import (
    CredentialService,
    TRUST_DISCLOSURE_POINTS,
    TRUST_DISCLOSURE_TITLE,
    _evidence_claim_rows,
)

MEDIUM_CLAIMS = {"identity_assurance": "MEDIUM", "identity_source": "ocr_liveness"}


class TestEvidenceDisclosure:
    def test_disclosure_names_the_f5_attack_surface(self):
        joined = " ".join(TRUST_DISCLOSURE_POINTS).lower()
        assert "medium" in joined
        assert "usurpation" in joined                 # stolen-ID impersonation
        assert "n'atteste pas la propriété" in joined  # property control ≠ ownership
        assert "dépôt de garantie" in joined           # never pay a deposit on MEDIUM

    def test_evidence_pdf_renders_does_not_prove_block(self):
        import pytest
        pytest.importorskip("reportlab")
        svc = CredentialService()
        record = svc.issue("tenant", "FR", dict(MEDIUM_CLAIMS))
        pdf = svc.export_evidence_pdf(record)
        assert pdf.startswith(b"%PDF")
        assert TRUST_DISCLOSURE_TITLE == "Ce que ce document NE prouve PAS"

    def test_property_row_labels_control_as_non_ownership(self):
        rows = _evidence_claim_rows({
            "property_control_label": "Contrôle documentaire",
            "property_control_assurance": "MEDIUM",
        })
        prop = [r for r in rows if "bien" in r[0].lower()]
        assert prop, "property row missing"
        assert "n'atteste PAS la propriété" in prop[0][0]


class TestVerifyResponseDisclosure:
    def test_verify_response_carries_does_not_prove(self):
        from unittest.mock import AsyncMock, MagicMock
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.database import get_db
        from app.core.timeutils import naive_utcnow
        from datetime import timedelta

        row = MagicMock()
        row.id = "vc_" + "a" * 32
        row.subject_role = "tenant"
        row.subject_display_name = "Jean D."
        row.rail = "FR"
        row.claims = dict(MEDIUM_CLAIMS)
        row.disclaimer = "…"
        row.signature = "00"
        row.kid = None
        row.revoked = False
        row.issued_at = naive_utcnow()
        row.expires_at = naive_utcnow() + timedelta(days=30)

        mock_db = MagicMock()
        mock_db.scalar = AsyncMock(return_value=row)

        async def override_db():
            yield mock_db

        # WS-6 puts a shared-scope per-IP limit on this public endpoint; earlier
        # anti-phishing tests exhaust the in-process MemoryStorage bucket, so reset
        # it to isolate this assertion from suite ordering.
        from app.routers.credentials import limiter
        limiter.limiter.storage.storage.clear()

        target = app.app if hasattr(app, "app") else app
        target.dependency_overrides[get_db] = override_db
        try:
            with TestClient(app) as c:
                resp = c.get(f"/credentials/{row.id}")
            assert resp.status_code == 200
            body = resp.json()
            assert isinstance(body["does_not_prove"], list) and body["does_not_prove"]
            assert any("MEDIUM" in p for p in body["does_not_prove"])
        finally:
            target.dependency_overrides.clear()


class TestNonGatingStance:
    def test_application_list_does_not_expose_assurance_tier(self):
        """DG-2: landlords must not be able to filter/sort candidates by tier.
        The list-serialization must not surface an assurance field."""
        import inspect
        from app.routers import applications

        src = inspect.getsource(applications)
        # If a future change surfaces the assurance tier in the candidate-listing
        # router, it becomes filterable/sortable — the F4 nationality-filter risk.
        # This guard fails so that stance is a deliberate, reviewed decision.
        assert "identity_assurance" not in src, (
            "applications router exposes assurance tier — DG-2 non-gating stance requires "
            "it stay off the candidate-listing surface"
        )
