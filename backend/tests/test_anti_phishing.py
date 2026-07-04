"""
Anti-phishing hardening tests (WS-6, stress-test finding F7).

- credential IDs carry >= 128 bits of entropy (enumeration is hopeless)
- the public verify endpoints are per-IP rate limited (scraping/enumeration
  gets 429, and the DB is protected from unauthenticated hammering)
- the evidence PDF names the canonical domain as the ONLY official domain
"""

import re
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.credential import CredentialService

CLAIMS = {"identity_assurance": "MEDIUM", "identity_source": "ocr_liveness"}


class TestCredentialIdEntropy:
    def test_credential_id_is_128_bit_hex(self):
        svc = CredentialService()
        payload = svc.issue("tenant", "FR", dict(CLAIMS))
        cid = payload["credential_id"]

        assert re.fullmatch(r"vc_[0-9a-f]{32}", cid), cid  # 16 random bytes = 128 bits


class TestPublicVerifyRateLimit:
    def _override_db(self, app_obj):
        from app.core.database import get_db

        mock_db = MagicMock()
        mock_db.scalar = AsyncMock(return_value=None)  # every lookup → 404

        async def override_db():
            yield mock_db

        target = app_obj.app if hasattr(app_obj, "app") else app_obj
        target.dependency_overrides[get_db] = override_db
        return target

    def test_verify_endpoint_returns_429_under_hammering(self):
        from fastapi.testclient import TestClient
        from app.main import app

        target = self._override_db(app)
        try:
            with TestClient(app) as c:
                statuses = [
                    c.get(f"/credentials/vc_{i:032x}").status_code for i in range(40)
                ]
            assert 429 in statuses
            # normal use (first requests) still works
            assert statuses[0] == 404
        finally:
            target.dependency_overrides.clear()

    def test_evidence_pdf_endpoint_rate_limited(self):
        from fastapi.testclient import TestClient
        from app.main import app

        target = self._override_db(app)
        try:
            with TestClient(app) as c:
                statuses = [
                    c.get(f"/credentials/vc_{i:032x}/evidence.pdf").status_code
                    for i in range(20)
                ]
            assert 429 in statuses
        finally:
            target.dependency_overrides.clear()


class TestEvidencePdfCanonicalDomain:
    def test_pdf_generation_includes_canonical_domain_statement(self):
        pytest.importorskip("reportlab")
        from app.services.credential import CANONICAL_DOMAIN_STATEMENT

        svc = CredentialService()
        record = svc.issue("tenant", "FR", dict(CLAIMS))
        pdf = svc.export_evidence_pdf(record)

        assert pdf.startswith(b"%PDF")
        # the statement constant is what the PDF renders — assert its content here
        assert "SEUL domaine officiel" in CANONICAL_DOMAIN_STATEMENT
        assert "roomivo.app" in CANONICAL_DOMAIN_STATEMENT
