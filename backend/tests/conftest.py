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

from app.core.database import get_db, AsyncSessionLocal
from app.main import app as main_app
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
    user.hashed_password = "$argon2id$v=19$m=65536,t=3,p=4$I+ScU2ptzRlDaC0FoLS2Ng$FqCEMSmSbogAGkouI7YR+twSn5by1ojMvpbyy944E50"
    user.identity_verified = False
    user.employment_verified = False
    user.trust_score = 50
    user.segment = None
    user.available_roles = ["tenant"]
    user.onboarding_status = {}
    user.onboarding_completed = False
    user.nationality = None
    user.languages = None
    user.gender = None
    user.birth_date = None
    user.bio = None
    user.profile_picture_url = None
    user.created_at = datetime.utcnow()
    user.preferences = {}
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
            scalar=MagicMock(return_value="encrypted_mock_value"),
        )
    )
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.close = AsyncMock()
    # Mocking context manager behavior for 'async with AsyncSessionLocal() as db'
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)
    yield mock_session

# Create a stable mock session for direct AsyncSessionLocal() usage
_mock_session_instance = next(mock_get_db())

# Global override for direct AsyncSessionLocal() usage
import app.core.database
app.core.database.AsyncSessionLocal = MagicMock(return_value=_mock_session_instance)


# ─── Fixtures ─────────────────────────────────────────────────────


@pytest.fixture
def client():
    """TestClient with mocked DB, no auth."""
    # Handle CORSSafetyNet wrapper if present
    target_app = main_app.app if hasattr(main_app, 'app') else main_app
    target_app.dependency_overrides[get_db] = mock_get_db
    target_app.dependency_overrides.pop(get_current_user, None)
    with TestClient(main_app) as c:
        yield c
    target_app.dependency_overrides.clear()


@pytest.fixture
def tenant_client():
    """TestClient authenticated as a tenant."""
    target_app = main_app.app if hasattr(main_app, 'app') else main_app
    target_app.dependency_overrides[get_db] = mock_get_db
    target_app.dependency_overrides[get_current_user] = lambda: MOCK_TENANT
    with TestClient(main_app) as c:
        yield c
    target_app.dependency_overrides.clear()


@pytest.fixture
def landlord_client():
    """TestClient authenticated as a landlord."""
    target_app = main_app.app if hasattr(main_app, 'app') else main_app
    target_app.dependency_overrides[get_db] = mock_get_db
    target_app.dependency_overrides[get_current_user] = lambda: MOCK_LANDLORD
    with TestClient(main_app) as c:
        yield c
    target_app.dependency_overrides.clear()


@pytest.fixture
def admin_client():
    """TestClient authenticated as an admin."""
    target_app = main_app.app if hasattr(main_app, 'app') else main_app
    target_app.dependency_overrides[get_db] = mock_get_db
    target_app.dependency_overrides[get_current_user] = lambda: MOCK_ADMIN
    with TestClient(main_app) as c:
        yield c
    target_app.dependency_overrides.clear()
