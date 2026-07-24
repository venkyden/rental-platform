"""
GDPR purge-parity tests: any endpoint that drops the last reference to a stored
document must also delete the underlying storage object (no orphaned PII at rest).

Covers the three orphaning paths found in the 2026-07-02 stress test:
  - DELETE /verification/guarantor left all guarantor files in storage
  - POST /verification/guarantor/upload orphaned the replaced same-type file
  - DELETE /documents/{id} deleted the DB row but not the storage object

Mocks storage and DB — no real I/O.
"""

import io
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from conftest import make_mock_user

FAKE_PDF = b"%PDF-1.4 fake pdf content for testing"


def _guarantor_user(files):
    user = make_mock_user("tenant", "purge_test@example.com")
    user.full_name = "Jean Dupont"
    user.guarantor_type = "physical"
    user.guarantor_status = "submitted"
    user.guarantor_data = {"files": files}
    return user


def _override_db_and_user(app_obj, user):
    from app.core.database import get_db
    from app.routers.auth import get_current_user

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(return_value=MagicMock())
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.delete = AsyncMock()
    mock_db.add = MagicMock()

    async def override_db():
        yield mock_db

    target = app_obj.app if hasattr(app_obj, "app") else app_obj
    target.dependency_overrides[get_db] = override_db
    target.dependency_overrides[get_current_user] = lambda: user
    return target, mock_db


class TestDeleteGuarantorPurgesFiles:
    def test_delete_guarantor_deletes_each_stored_file(self):
        from app.main import app
        from app.services.storage import storage

        files = [
            {"document_type": "id_card", "file_url": "http://r2/id.pdf", "storage_key": "g/id-key"},
            {"document_type": "payslip", "file_url": "http://r2/pay.pdf", "storage_key": "g/pay-key"},
        ]
        user = _guarantor_user(files)
        target, _ = _override_db_and_user(app, user)

        try:
            with patch.object(storage, "delete_file", new=AsyncMock(return_value=True)) as mock_delete:
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.delete("/verification/guarantor")

            assert resp.status_code == 200
            deleted_keys = {call.args[0] for call in mock_delete.await_args_list}
            assert deleted_keys == {"g/id-key", "g/pay-key"}
        finally:
            target.dependency_overrides.clear()

    def test_delete_guarantor_survives_storage_failure(self):
        """A failing storage delete must not block the guarantor reset."""
        from app.main import app
        from app.services.storage import storage

        files = [{"document_type": "id_card", "file_url": "http://r2/id.pdf", "storage_key": "g/id-key"}]
        user = _guarantor_user(files)
        target, _ = _override_db_and_user(app, user)

        try:
            with patch.object(storage, "delete_file", new=AsyncMock(side_effect=RuntimeError("boom"))):
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.delete("/verification/guarantor")

            assert resp.status_code == 200
        finally:
            target.dependency_overrides.clear()

    def test_legacy_entries_without_storage_key_are_skipped(self):
        from app.main import app
        from app.services.storage import storage

        files = [{"document_type": "id_card", "file_url": "http://r2/id.pdf"}]
        user = _guarantor_user(files)
        target, _ = _override_db_and_user(app, user)

        try:
            with patch.object(storage, "delete_file", new=AsyncMock(return_value=True)) as mock_delete:
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.delete("/verification/guarantor")

            assert resp.status_code == 200
            mock_delete.assert_not_awaited()
        finally:
            target.dependency_overrides.clear()


class TestGuarantorReuploadPurgesReplacedFile:
    def test_same_type_reupload_deletes_old_storage_object(self):
        from app.main import app
        from app.services.storage import storage

        files = [{"document_type": "id_card", "file_url": "http://r2/old.pdf", "storage_key": "g/old-key"}]
        user = _guarantor_user(files)
        user.guarantor_status = "pending"
        target, _ = _override_db_and_user(app, user)

        try:
            with (
                patch.object(storage, "upload_file", new=AsyncMock(return_value={"url": "http://r2/new.pdf", "key": "g/new-key"})),
                patch.object(storage, "delete_file", new=AsyncMock(return_value=True)) as mock_delete,
                patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()),
                patch("app.routers.verification.apply_watermark", return_value=FAKE_PDF),
            ):
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.post(
                        "/verification/guarantor/upload",
                        data={"document_type": "id_card"},
                        files={"file": ("id.pdf", io.BytesIO(FAKE_PDF), "application/pdf")},
                    )

            assert resp.status_code == 200
            mock_delete.assert_awaited_once_with("g/old-key")
            # The new entry replaces the old one
            entries = [f for f in resp.json()["files"] if f["document_type"] == "id_card"]
            assert len(entries) == 1
            assert entries[0]["storage_key"] == "g/new-key"
        finally:
            target.dependency_overrides.clear()

    def test_different_type_upload_deletes_nothing(self):
        from app.main import app
        from app.services.storage import storage

        files = [{"document_type": "id_card", "file_url": "http://r2/old.pdf", "storage_key": "g/old-key"}]
        user = _guarantor_user(files)
        user.guarantor_status = "pending"
        target, _ = _override_db_and_user(app, user)

        try:
            with (
                patch.object(storage, "upload_file", new=AsyncMock(return_value={"url": "http://r2/pay.pdf", "key": "g/pay-key"})),
                patch.object(storage, "delete_file", new=AsyncMock(return_value=True)) as mock_delete,
                patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()),
                patch("app.routers.verification.apply_watermark", return_value=FAKE_PDF),
            ):
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.post(
                        "/verification/guarantor/upload",
                        data={"document_type": "payslip"},
                        files={"file": ("pay.pdf", io.BytesIO(FAKE_PDF), "application/pdf")},
                    )

            assert resp.status_code == 200
            mock_delete.assert_not_awaited()
        finally:
            target.dependency_overrides.clear()


class TestDeleteDocumentPurgesStorage:
    def _doc(self, owner_id, storage_key="documents/u/doc-key"):
        doc = MagicMock()
        doc.id = uuid.uuid4()
        doc.user_id = owner_id
        doc.extra_data = {"storage_key": storage_key} if storage_key else None
        return doc

    def test_delete_document_deletes_storage_object_then_row(self):
        from app.main import app
        from app.services.storage import storage

        user = make_mock_user("tenant", "purge_doc@example.com")
        target, mock_db = _override_db_and_user(app, user)
        doc = self._doc(owner_id=user.id)
        result = MagicMock()
        result.scalar_one_or_none.return_value = doc
        mock_db.execute = AsyncMock(return_value=result)

        try:
            with patch.object(storage, "delete_file", new=AsyncMock(return_value=True)) as mock_delete:
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.delete(f"/documents/{doc.id}")

            assert resp.status_code == 204
            mock_delete.assert_awaited_once_with("documents/u/doc-key")
            mock_db.delete.assert_awaited_once_with(doc)
        finally:
            target.dependency_overrides.clear()

    def test_delete_document_without_storage_key_still_deletes_row(self):
        from app.main import app
        from app.services.storage import storage

        user = make_mock_user("tenant", "purge_doc2@example.com")
        target, mock_db = _override_db_and_user(app, user)
        doc = self._doc(owner_id=user.id, storage_key=None)
        result = MagicMock()
        result.scalar_one_or_none.return_value = doc
        mock_db.execute = AsyncMock(return_value=result)

        try:
            with patch.object(storage, "delete_file", new=AsyncMock(return_value=True)) as mock_delete:
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.delete(f"/documents/{doc.id}")

            assert resp.status_code == 204
            mock_delete.assert_not_awaited()
            mock_db.delete.assert_awaited_once_with(doc)
        finally:
            target.dependency_overrides.clear()

    def test_delete_document_survives_storage_failure(self):
        from app.main import app
        from app.services.storage import storage

        user = make_mock_user("tenant", "purge_doc3@example.com")
        target, mock_db = _override_db_and_user(app, user)
        doc = self._doc(owner_id=user.id)
        result = MagicMock()
        result.scalar_one_or_none.return_value = doc
        mock_db.execute = AsyncMock(return_value=result)

        try:
            with patch.object(storage, "delete_file", new=AsyncMock(side_effect=RuntimeError("boom"))):
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.delete(f"/documents/{doc.id}")

            assert resp.status_code == 204
            mock_db.delete.assert_awaited_once_with(doc)
        finally:
            target.dependency_overrides.clear()
