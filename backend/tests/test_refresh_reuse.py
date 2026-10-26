"""Refresh-token reuse detection (policy 3.1, session management).

Rotation alone leaves the presented refresh token valid until it expires, so
a stolen one keeps working. A spent token replayed after a short grace window
means two parties hold it: every session of that user is revoked.
"""

import time
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import create_refresh_token, verify_token
from app.main import app
from app.routers import auth
from tests.conftest import make_mock_user


@pytest.fixture
def user():
    u = make_mock_user("tenant")
    u.is_active = True
    u.refresh_token_version = 2
    u.segment = None
    u.available_roles = ["tenant"]
    return u


@pytest.fixture
def client(user, monkeypatch):
    store = {}

    async def get(key):
        return store.get(key)

    async def set_(key, value, ttl=300):
        store[key] = value
        return True

    monkeypatch.setattr(auth.cache, "get", get)
    monkeypatch.setattr(auth.cache, "set", set_)

    async def db_returning_user():
        session = MagicMock()
        session.get = AsyncMock(return_value=user)
        session.commit = AsyncMock()
        yield session

    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_db] = db_returning_user
    yield TestClient(app, base_url="http://testserver/api/v1")
    target_app.dependency_overrides.clear()


def _refresh(client, token):
    client.cookies.clear()
    client.cookies.set("refresh_token", token)
    return client.post("/auth/refresh")


def _token(user):
    return create_refresh_token(
        data={"sub": user.email, "user_id": str(user.id), "version": user.refresh_token_version}
    )


def test_refresh_tokens_are_unique():
    a = verify_token(create_refresh_token(data={"sub": "a@x", "version": 1}))
    b = verify_token(create_refresh_token(data={"sub": "a@x", "version": 1}))
    assert a["jti"] and a["jti"] != b["jti"]


def test_concurrent_use_inside_grace_is_tolerated(client, user):
    token = _token(user)
    assert _refresh(client, token).status_code == 200
    assert _refresh(client, token).status_code == 200  # second tab, same moment
    assert user.refresh_token_version == 2


def test_replay_after_grace_revokes_every_session(client, user, monkeypatch):
    token = _token(user)
    assert _refresh(client, token).status_code == 200
    monkeypatch.setattr(auth, "_REFRESH_REUSE_GRACE_SECONDS", 0)
    time.sleep(0.01)
    resp = _refresh(client, token)
    assert resp.status_code == 401
    assert user.refresh_token_version == 3


def test_token_without_jti_still_refreshes(client, user, monkeypatch):
    # Tokens minted before reuse detection shipped carry no jti.
    import jwt
    from app.core.config import settings

    payload = verify_token(_token(user))
    del payload["jti"]
    legacy = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    assert _refresh(client, legacy).status_code == 200
