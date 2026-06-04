"""
System canary test — one assertion per critical user-facing path.

Run this FIRST. If any test fails the system is broken in a user-visible
way and deployment should stop.

    cd backend
    DATABASE_URL=postgresql+asyncpg://... pytest tests_integration/test_system_canary.py -v

All tests are marked `canary` so CI can gate on them with:
    pytest -m canary tests_integration/test_system_canary.py
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.routers.verification import _upload_rate_limits
from tests_integration.conftest import auth, make_user

pytestmark = pytest.mark.canary


# ── 1. DB + API liveness ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_check_reports_db_up(client):
    """GET /health must report the database as 'up'.

    If this fails: the DB connection pool is broken, migrations failed,
    or the app cannot start. Nothing else matters — fix this first.
    """
    r = await client.get("/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["checks"]["database"]["status"] == "up", (
        f"Database reported as down: {body['checks']['database']}"
    )


# ── 2. Auth pipeline ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_login_me_roundtrip(client):
    """Register → login → /auth/me must return the same email.

    If this fails: JWT signing, password hashing, or DB writes are broken.
    Users cannot log in.
    """
    email = f"canary_{uuid.uuid4().hex[:8]}@roomivo-test.eu"
    password = "Canary_P@ss99"

    reg = await client.post("/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Canary User",
        "role": "tenant",
    })
    assert reg.status_code == 201, f"Register failed: {reg.text}"

    login = await client.post("/auth/login", data={
        "username": email,
        "password": password,
    })
    assert login.status_code == 200, f"Login failed: {login.text}"
    token = login.json()["access_token"]

    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, f"/auth/me failed: {me.text}"
    assert me.json()["email"] == email


# ── 3. Property creation ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_landlord_can_create_property(client, sessionmaker_):
    """A landlord must be able to create a property listing.

    If this fails: the properties table, schema validation, or landlord
    role check is broken. Landlords cannot list flats.
    """
    landlord = await make_user(sessionmaker_, role="landlord")

    r = await client.post("/properties", json={
        "title": "Canary Test Apartment Nantes",
        "property_type": "apartment",
        "address_line1": "1 rue du Canari",
        "city": "Nantes",
        "postal_code": "44000",
        "country": "France",
        "bedrooms": 2,
        "monthly_rent": "800.00",
    }, headers=auth(landlord))

    assert r.status_code == 201, f"Property creation failed: {r.text}"
    assert r.json()["city"] == "Nantes"


# ── 4. Application submission ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tenant_can_apply_to_property(client, sessionmaker_):
    """A tenant must be able to submit an application for a property.

    If this fails: the application FK constraints, status defaults, or
    tenant role check is broken. Tenants cannot apply.
    """
    landlord = await make_user(sessionmaker_, role="landlord")
    tenant = await make_user(sessionmaker_, role="tenant")

    prop = await client.post("/properties", json={
        "title": "Canary Application Target Flat",
        "property_type": "studio",
        "address_line1": "2 allée du Test",
        "city": "Paris",
        "postal_code": "75001",
        "country": "France",
        "bedrooms": 0,
        "monthly_rent": "950.00",
    }, headers=auth(landlord))
    assert prop.status_code == 201
    property_id = prop.json()["id"]

    app = await client.post("/applications", json={
        "property_id": property_id,
    }, headers=auth(tenant))
    assert app.status_code == 201, f"Application failed: {app.text}"
    assert app.json()["status"] == "pending"


# ── 5. Verification pipeline ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_identity_upload_pipeline_reachable(client, sessionmaker_):
    """Identity upload endpoint must route through AI verification.

    If this fails: the verification router, AI service wiring, or
    storage dependency is broken. Tenants cannot get verified.
    """
    user = await make_user(sessionmaker_, role="tenant")
    key = f"{user.id}:identity"
    _upload_rate_limits.pop(key, None)

    with patch("app.services.identity.identity_service") as mock_svc:
        mock_svc.verify_document = AsyncMock(return_value={
            "verified": True,
            "status": "verified",
            "data": {"name": "Canary User"},
            "validation_checks": [],
            "rejection_reason": None,
        })
        r = await client.post(
            "/verification/identity/upload?document_type=passport",
            files={"file": ("passport.jpg", b"fake-image-bytes", "image/jpeg")},
            headers=auth(user),
        )

    assert r.status_code == 200, f"Identity upload failed: {r.text}"
    assert r.json()["status"] == "document_verified"

    _upload_rate_limits.pop(key, None)


# ── 6. Webhook signature verification ────────────────────────────────────

@pytest.mark.asyncio
async def test_webhook_callback_accepts_correct_hmac(client, sessionmaker_, monkeypatch):
    """Verification webhook must accept a correctly signed payload.

    If this fails: HMAC verification or webhook routing is broken.
    Third-party verification callbacks will be silently rejected.
    """
    import hashlib
    import hmac
    import json

    secret = "canary-webhook-secret"
    monkeypatch.setenv("VERIFICATION_WEBHOOK_SECRET", secret)

    user = await make_user(sessionmaker_, role="tenant")
    payload = json.dumps({
        "event": "verification.completed",
        "user_id": str(user.id),
        "verification_type": "identity",
        "status": "verified",
        "data": {},
    }).encode()

    sig = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    with patch("app.routers.webhooks.email_service") as mock_email:
        mock_email.send_verification_failed_email = AsyncMock()
        r = await client.post(
            "/webhooks/verification/callback",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Signature": sig,
            },
        )

    assert r.status_code == 200, f"Webhook rejected valid HMAC: {r.text}"
