"""
Avatar purge parity (WS-1b — closes the gap annotated in test_doctrine_guard).

Avatar keys are randomized under shared avatars/ folder (no per-user prefix),
so replace and erasure purge rely on users.avatar_storage_key.
"""

import io
from unittest.mock import AsyncMock, MagicMock, patch

from conftest import make_mock_user

FAKE_PNG = b"\x89PNG fake image bytes"


def _override(app_obj, user):
    from app.core.database import get_db
    from app.routers.auth import get_current_user

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_db():
        yield mock_db

    target = app_obj.app if hasattr(app_obj, "app") else app_obj
    target.dependency_overrides[get_db] = override_db
    target.dependency_overrides[get_current_user] = lambda: user
    return target


class TestAvatarReuploadPurge:
    def test_reupload_purges_old_key_and_stores_new(self):
        from app.main import app
        from app.services.storage import storage

        user = make_mock_user("tenant", "avatar@example.com")
        user.avatar_storage_key = "avatars/2026/06/01/old-key.png"
        target = _override(app, user)
        try:
            with (
                patch.object(storage, "upload_file", new=AsyncMock(
                    return_value={"url": "http://r2/new.png", "key": "avatars/2026/07/04/new-key.png"}
                )),
                patch.object(storage, "purge_object", new=AsyncMock(return_value=True)) as mock_purge,
            ):
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.post(
                        "/auth/me/avatar",
                        files={"file": ("me.png", io.BytesIO(FAKE_PNG), "image/png")},
                    )

            assert resp.status_code == 200
            mock_purge.assert_awaited_once_with("avatars/2026/06/01/old-key.png", "avatar_reupload")
            assert user.avatar_storage_key == "avatars/2026/07/04/new-key.png"
            assert user.profile_picture_url == "http://r2/new.png"
        finally:
            target.dependency_overrides.clear()

    def test_first_upload_purges_nothing(self):
        from app.main import app
        from app.services.storage import storage

        user = make_mock_user("tenant", "avatar2@example.com")
        user.avatar_storage_key = None
        target = _override(app, user)
        try:
            with (
                patch.object(storage, "upload_file", new=AsyncMock(
                    return_value={"url": "http://r2/first.png", "key": "avatars/2026/07/04/first.png"}
                )),
                patch.object(storage, "purge_object", new=AsyncMock(return_value=True)) as mock_purge,
            ):
                from fastapi.testclient import TestClient
                with TestClient(app, base_url="http://testserver/api/v1") as c:
                    resp = c.post(
                        "/auth/me/avatar",
                        files={"file": ("me.png", io.BytesIO(FAKE_PNG), "image/png")},
                    )

            assert resp.status_code == 200
            mock_purge.assert_not_awaited()
            assert user.avatar_storage_key == "avatars/2026/07/04/first.png"
        finally:
            target.dependency_overrides.clear()
