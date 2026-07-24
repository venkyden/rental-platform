"""
GDPR domain audit (#8) — Art. 17 erasure completeness + Art. 15/20 export coverage.

Findings fixed:
- erasure left income_data / guarantor_data / insurance_data / visale_id /
  garantme_ref in the DB (guarantor_data holds THIRD-PARTY PII) — encryption at
  rest is not erasure.
- export omitted the user's income/guarantor verification summary and visits.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.sql.dml import Update

from conftest import make_mock_user
from app.main import app
from app.core.database import get_db
from app.routers.auth import get_current_user

# Every EncryptedJSON / verification field that erasure MUST clear.
ERASURE_MUST_CLEAR = {
    "identity_data", "employment_data", "ownership_data", "deposit_binding_data",
    "income_data", "guarantor_data", "insurance_data",
    "visale_id", "garantme_ref",
    "income_status", "guarantor_status", "identity_status",
    "employment_status", "ownership_status",
}


def _client(user):
    from fastapi.testclient import TestClient
    target = app.app if hasattr(app, "app") else app
    target.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app, base_url="http://testserver/api/v1"), target


def test_erasure_clears_all_pii_columns():
    user = make_mock_user("tenant")
    user.id = uuid.uuid4()
    user.avatar_storage_key = None
    user.identity_data = user.employment_data = None

    captured = []

    def _exec(stmt, *a, **k):
        captured.append(stmt)
        res = MagicMock()
        res.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
        return res

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=_exec)
    mock_db.commit = AsyncMock()

    def _override_db():
        yield mock_db
    client, target = _client(user)
    target.dependency_overrides[get_db] = _override_db
    try:
        with patch("app.services.storage.storage") as mock_storage:
            mock_storage.delete_files_by_prefix = AsyncMock()
            mock_storage.delete_file = AsyncMock(return_value=True)
            mock_storage.purge_object = AsyncMock(return_value=True)
            resp = client.delete("/gdpr/delete")
        assert resp.status_code == 200

        updates = [s for s in captured if isinstance(s, Update)]
        assert updates, "erasure issued no UPDATE"
        cleared = set(updates[0].compile().params.keys())
        missing = ERASURE_MUST_CLEAR - cleared
        assert not missing, f"erasure does not clear: {sorted(missing)}"
    finally:
        target.dependency_overrides.clear()


def test_export_includes_verification_summary_and_visits():
    user = make_mock_user("tenant")
    user.id = uuid.uuid4()
    user.income_status = "verified"
    user.guarantor_status = "verified"
    user.visale_id = "VS-2026-1"
    user.garantme_ref = None

    res = MagicMock()
    res.scalar_one_or_none = MagicMock(return_value=user)
    res.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    mock_db = MagicMock()
    mock_db.execute = AsyncMock(return_value=res)

    def _override_db():
        yield mock_db
    client, target = _client(user)
    target.dependency_overrides[get_db] = _override_db
    try:
        resp = client.get("/gdpr/export")
        assert resp.status_code == 200
        body = resp.json()
        assert "visits" in body
        v = body["user"]["verification"]
        assert v["income_status"] == "verified"
        assert v["guarantor_status"] == "verified"
        assert v["visale_id"] == "VS-2026-1"
    finally:
        target.dependency_overrides.clear()
