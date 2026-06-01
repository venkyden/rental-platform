"""
Real-Postgres integration test harness (separate from the mock-based `tests/`).

Runs against a dedicated DB (roomivo_test by default). Each test gets a clean
schema (TRUNCATE) and a real async session injected into the app via the
`get_db` dependency override, so authorization, transactions and DB-level
constraints/locks are exercised for real.

Run:  cd backend && DATABASE_URL=... pytest tests_integration/ -q
"""

import os
import uuid

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://127.0.0.1:5432/roomivo_test"
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-aaaa")
os.environ.setdefault("ENVIRONMENT", "test")

import pytest
import pytest_asyncio
import httpx
from httpx import ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool

from app.main import app as asgi_app, fastapi_app
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.property import Property
from app.models.application import Application
from app.models.visits_and_leases import VisitSlot

TEST_URL = os.environ["DATABASE_URL"]

_TABLES = (
    "applications, properties, visit_slots, leases, conversations, messages, "
    "disputes, inventories, inventory_items, notifications, team_members, "
    "team_member_properties, documents, saved_properties, property_media, "
    "property_media_sessions, users"
)


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(TEST_URL, poolclass=NullPool)
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest_asyncio.fixture
async def sessionmaker_(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(autouse=True)
def _disable_rate_limiter():
    """Per-IP rate limits (register/login/etc.) would trip during a full suite
    run from a single test IP. Disable slowapi for tests; production keeps it."""
    from app.routers.auth import limiter
    previous = limiter.enabled
    limiter.enabled = False
    yield
    limiter.enabled = previous


@pytest_asyncio.fixture
async def client(engine, sessionmaker_):
    # Clean slate
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {_TABLES} RESTART IDENTITY CASCADE"))

    async def _get_db():
        async with sessionmaker_() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    fastapi_app.dependency_overrides[get_db] = _get_db
    transport = ASGITransport(app=asgi_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        c._sessionmaker = sessionmaker_  # expose for data setup
        yield c
    fastapi_app.dependency_overrides.pop(get_db, None)


# ── data helpers ──────────────────────────────────────────────────────────

async def make_user(sm, role="tenant", email=None) -> User:
    email = email or f"{role}_{uuid.uuid4().hex[:8]}@test.com"
    async with sm() as s:
        u = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=get_password_hash("Passw0rd!23"),
            role=role,
            full_name=f"{role.title()} User",
            is_active=True,
            email_verified=True,
            trust_score=50,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u


async def make_property(sm, landlord) -> Property:
    async with sm() as s:
        p = Property(
            id=uuid.uuid4(),
            landlord_id=landlord.id,
            title="Test Flat",
            address_line1="1 rue de Test",
            city="Nantes",
            postal_code="44000",
            bedrooms=2,
            monthly_rent=900,
        )
        s.add(p)
        await s.commit()
        await s.refresh(p)
        return p


async def make_slot(sm, prop, landlord) -> VisitSlot:
    from datetime import timedelta
    from app.core.timeutils import utcnow

    async with sm() as s:
        slot = VisitSlot(
            id=uuid.uuid4(),
            property_id=prop.id,
            landlord_id=landlord.id,
            start_time=utcnow() + timedelta(days=1),
            end_time=utcnow() + timedelta(days=1, hours=1),
            is_booked=False,
        )
        s.add(slot)
        await s.commit()
        await s.refresh(slot)
        return slot


async def make_application(sm, tenant, prop) -> Application:
    async with sm() as s:
        a = Application(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            property_id=prop.id,
            status="pending",
        )
        s.add(a)
        await s.commit()
        await s.refresh(a)
        return a


def auth(user) -> dict:
    token = create_access_token(data={"sub": user.email, "user_id": str(user.id)})
    return {"Authorization": f"Bearer {token}"}
