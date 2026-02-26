"""
Shared test fixtures for the Roomivo backend test suite.

Uses TestClient with dependency overrides for get_db and get_current_user.
The DB is not created here — endpoint tests override get_db with a mock
session since the real schema uses Postgres-specific types (UUID, JSONB).
Schema/validation tests (test_config, test_auth schemas) don't need a DB at all.
"""

import os

# Set required env vars BEFORE any app imports trigger Settings() initialization
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.models.user import UserRole
from app.routers.auth import get_current_user

# ─── Mock Users ───────────────────────────────────────────────────


def make_mock_user(role: str = "tenant", email: str = "test@example.com"):
    """Create a mock User object with all required attributes."""
    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = email
    user.full_name = "Test User"
    user.role = UserRole(role)
    user.is_active = True
    user.email_verified = True
    user.identity_verified = False
    user.employment_verified = False
    user.trust_score = 50
    user.segment = None
    user.onboarding_completed = False
    user.nationality = None
    user.languages = None
    user.gender = None
    user.birth_date = None
    user.created_at = datetime.utcnow()
    user.preferences = None
    user.contact_preferences = {"email_notifications": True}
    return user


MOCK_TENANT = make_mock_user("tenant", "tenant@test.com")
MOCK_LANDLORD = make_mock_user("landlord", "landlord@test.com")
MOCK_ADMIN = make_mock_user("admin", "admin@test.com")


# ─── Mock DB Session ─────────────────────────────────────────────


def mock_get_db():
    """Yield a mock async session that won't hit a real database."""
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(
        return_value=MagicMock(
            scalars=MagicMock(
                return_value=MagicMock(
                    first=MagicMock(return_value=None),
                    all=MagicMock(return_value=[]),
                )
            ),
            scalar_one_or_none=MagicMock(return_value=None),
        )
    )
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.close = AsyncMock()
    yield mock_session


# ─── Fixtures ─────────────────────────────────────────────────────


@pytest.fixture
def client():
    """TestClient with mocked DB, no auth."""
    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides.pop(get_current_user, None)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def tenant_client():
    """TestClient authenticated as a tenant."""
    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[get_current_user] = lambda: MOCK_TENANT
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def landlord_client():
    """TestClient authenticated as a landlord."""
    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[get_current_user] = lambda: MOCK_LANDLORD
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client():
    """TestClient authenticated as an admin."""
    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[get_current_user] = lambda: MOCK_ADMIN
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
