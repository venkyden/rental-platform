"""
Go-Live Comprehensive Stress & Edge Case Test Suite.
Tests all Landlord and Tenant journeys and edge cases.
"""

import uuid
import json
from datetime import datetime, timedelta
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock
from app.main import app
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.property import Property, PropertyMediaSession
from app.models.user import User
from conftest import MOCK_LANDLORD, MOCK_TENANT, make_mock_user


def make_test_property(**kwargs):
    """Helper to instantiate a real Property model with safe defaults."""
    defaults = {
        "id": uuid.uuid4(),
        "landlord_id": MOCK_LANDLORD.id,
        "title": "Test Apartment Title",
        "description": "A wonderful apartment in Paris",
        "property_type": "apartment",
        "address_line1": "10 Rue de Rivoli",
        "address_line2": None,
        "city": "Paris",
        "postal_code": "75001",
        "country": "France",
        "latitude": None,
        "longitude": None,
        "bedrooms": 1,
        "bathrooms": None,
        "size_sqm": None,
        "floor_number": None,
        "furnished": False,
        "accommodation_capacity": None,
        "rooms_count": None,
        "living_room_type": None,
        "kitchen_type": None,
        "room_details": [],
        "monthly_rent": 1000,
        "deposit": None,
        "charges": None,
        "charges_included": False,
        "charges_description": None,
        "available_from": None,
        "lease_duration_months": None,
        "amenities": [],
        "custom_amenities": [],
        "public_transport": [],
        "nearby_landmarks": [],
        "utilities_included": [],
        "caf_eligible": False,
        "guarantor_required": False,
        "accepted_guarantor_types": [],
        "accepted_tenant_types": [],
        "dpe_rating": None,
        "dpe_value": None,
        "ges_rating": None,
        "ges_value": None,
        "surface_type": None,
        "construction_year": None,
        "loyer_reference": None,
        "loyer_reference_majore": None,
        "complement_de_loyer": None,
        "complement_de_loyer_justification": None,
        "natural_risks_compliant": False,
        "previous_tenant_rent": None,
        "is_overseas_dom": False,
        "photos": [],
        "ownership_verified": False,
        "status": "draft",
        "views_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": None,
        "published_at": None,
    }
    defaults.update(kwargs)
    prop = Property(**defaults)
    prop.landlord = MOCK_LANDLORD
    return prop


def test_publish_without_bio_fails(landlord_client):
    """Landlord without a bio gets 422 landlord_bio_required when publishing."""
    prop = make_test_property()
    no_bio_user = make_mock_user("landlord", "nobio@test.com")
    no_bio_user.bio = ""
    no_bio_user.id = MOCK_LANDLORD.id
    prop.landlord = no_bio_user

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=prop))
    )
    mock_db.commit = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return no_bio_user

    target_app = app.app if hasattr(app, 'app') else app
    target_app.dependency_overrides[get_db] = override_get_db
    target_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        resp = landlord_client.post(f"/properties/{prop.id}/publish")
        assert resp.status_code == 422
        assert resp.json()["detail"] == "landlord_bio_required"
    finally:
        target_app.dependency_overrides.pop(get_current_user, None)


def test_publish_without_media_fails(landlord_client):
    """Landlord publishing property with 0 photos/videos gets 400 Bad Request."""
    prop = make_test_property(photos=[], room_details=[])
    bio_user = make_mock_user("landlord", "landlord@test.com")
    bio_user.bio = "Experienced landlord in Paris"
    bio_user.id = MOCK_LANDLORD.id
    prop.landlord = bio_user

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=prop))
    )
    mock_db.commit = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return bio_user

    target_app = app.app if hasattr(app, 'app') else app
    target_app.dependency_overrides[get_db] = override_get_db
    target_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        resp = landlord_client.post(f"/properties/{prop.id}/publish")
        assert resp.status_code == 400
        assert "at least 1 photo or video" in resp.json()["detail"]
    finally:
        target_app.dependency_overrides.pop(get_current_user, None)


def test_publish_missing_room_media_fails(landlord_client):
    """Colocation listing with 2 rooms fails publish if Bedroom 2 has no media."""
    prop = make_test_property(
        room_details=[
            {"index": 0, "label": "Bedroom 1"},
            {"index": 1, "label": "Bedroom 2"}
        ],
        photos=[]
    )
    bio_user = make_mock_user("landlord", "landlord@test.com")
    bio_user.bio = "Colocation Specialist Landlord"
    bio_user.id = MOCK_LANDLORD.id
    prop.landlord = bio_user

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=MagicMock(return_value=prop)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]
    )
    mock_db.commit = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return bio_user

    target_app = app.app if hasattr(app, 'app') else app
    target_app.dependency_overrides[get_db] = override_get_db
    target_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        resp = landlord_client.post(f"/properties/{prop.id}/publish")
        assert resp.status_code == 400
        assert "Missing media for: Bedroom 1, Bedroom 2" in resp.json()["detail"]
    finally:
        target_app.dependency_overrides.pop(get_current_user, None)


def test_video_upload_limit_enforced(client):
    """Uploading a 2nd video walkthrough for a property returns 400 Bad Request."""
    code = "test_video_code_123"
    mock_session = MagicMock(spec=PropertyMediaSession)
    mock_session.verification_code = code
    mock_session.is_active = True
    mock_session.expires_at = MagicMock(__lt__=lambda self, other: False)
    mock_session.property_id = uuid.uuid4()

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=MagicMock(return_value=mock_session)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=1)),
        ]
    )
    mock_db.commit = AsyncMock()

    async def override_get_db():
        yield mock_db

    target_app = app.app if hasattr(app, 'app') else app
    target_app.dependency_overrides[get_db] = override_get_db

    video_file = BytesIO(b"fake_video_bytes")
    meta = json.dumps({"media_type": "video", "captured_at": "2026-07-23T12:00:00Z"})

    resp = client.post(
        f"/properties/media/upload?verification_code={code}&metadata={meta}",
        files={"file": ("walkthrough2.mp4", video_file, "video/mp4")},
    )
    assert resp.status_code == 400
    assert "maximum 1 video allowed" in resp.json()["detail"]


def test_invalid_file_type_rejected(client):
    """Uploading an invalid file type (.exe) returns 400 Bad Request."""
    code = "test_exe_code"
    file_data = BytesIO(b"binary_executable_data")
    meta = json.dumps({"media_type": "photo", "captured_at": "2026-07-23T12:00:00Z"})

    resp = client.post(
        f"/properties/media/upload?verification_code={code}&metadata={meta}",
        files={"file": ("malicious.exe", file_data, "application/octet-stream")},
    )
    assert resp.status_code == 400
    assert "Invalid file type" in resp.json()["detail"]


def test_dpe_acknowledgment_flow(landlord_client):
    """Publishing DPE G property returns 409 Conflict until acknowledged."""
    prop = make_test_property(
        dpe_rating="G",
        dpe_value=450,
        photos=["photo1.jpg"]
    )
    bio_user = make_mock_user("landlord", "landlord@test.com")
    bio_user.bio = "Certified Landlord"
    bio_user.id = MOCK_LANDLORD.id
    prop.landlord = bio_user

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=prop))
    )
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return bio_user

    target_app = app.app if hasattr(app, 'app') else app
    target_app.dependency_overrides[get_db] = override_get_db
    target_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        # Unacknowledged -> 409
        resp1 = landlord_client.post(f"/properties/{prop.id}/publish")
        assert resp1.status_code == 409
        assert resp1.json()["detail"]["code"] == "dpe_acknowledgment_required"

        # Acknowledged -> 200
        resp2 = landlord_client.post(
            f"/properties/{prop.id}/publish",
            json={"acknowledge_dpe_warning": True}
        )
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "active"
    finally:
        target_app.dependency_overrides.pop(get_current_user, None)


def test_room_status_patch_success(landlord_client):
    """Landlord can patch occupancy status and available_from date of a colocation room."""
    prop = make_test_property(
        room_details=[
            {"index": 0, "label": "Bedroom 1", "status": "available"},
            {"index": 1, "label": "Bedroom 2", "status": "available"}
        ]
    )

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=prop))
    )
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db

    target_app = app.app if hasattr(app, 'app') else app
    target_app.dependency_overrides[get_db] = override_get_db

    resp = landlord_client.patch(
        f"/properties/{prop.id}/rooms/0/status",
        json={"status": "occupied"}
    )
    assert resp.status_code == 200
    assert prop.room_details[0]["status"] == "occupied"


def test_room_status_patch_invalid_room_index(landlord_client):
    """Patching a non-existent room index returns 400 Bad Request."""
    prop = make_test_property(room_details=[{"index": 0, "label": "Bedroom 1"}])

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=prop))
    )
    mock_db.commit = AsyncMock()

    async def override_get_db():
        yield mock_db

    target_app = app.app if hasattr(app, 'app') else app
    target_app.dependency_overrides[get_db] = override_get_db

    resp = landlord_client.patch(
        f"/properties/{prop.id}/rooms/99/status",
        json={"status": "occupied"}
    )
    assert resp.status_code == 400
    assert "Invalid room index" in resp.json()["detail"]


def test_tenant_search_colocation(tenant_client):
    """Tenant searching with colocation=1 filter returns 200 OK."""
    resp = tenant_client.get("/properties?colocation=1")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_tenant_property_detail_view(tenant_client):
    """Tenant retrieving property details gets photos, room_details, and landlord_first_name."""
    mock_landlord = make_mock_user("landlord", "jean@test.com")
    mock_landlord.first_name = "Jean"
    mock_landlord.identity_verified = True
    mock_landlord.bio = "Paris Landlord"

    prop = make_test_property(
        title="Colocation in Paris",
        bedrooms=2,
        monthly_rent=1200,
        photos=[
            {"url": "https://example.com/p1.jpg", "media_type": "photo"},
            {"url": "https://example.com/v1.mp4", "media_type": "video"}
        ],
        room_details=[
            {"index": 0, "label": "Bedroom 1", "status": "available"},
            {"index": 1, "label": "Bedroom 2", "status": "occupied"}
        ],
        status="active"
    )
    prop.landlord = mock_landlord

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=MagicMock(return_value=prop)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=mock_landlord)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]
    )
    mock_db.commit = AsyncMock()

    async def override_get_db():
        yield mock_db

    target_app = app.app if hasattr(app, 'app') else app
    target_app.dependency_overrides[get_db] = override_get_db

    resp = tenant_client.get(f"/properties/{prop.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["landlord_first_name"] == "Jean"
    assert data["landlord_identity_verified"] is True
    assert len(data["room_details"]) == 2
    assert data["room_details"][1]["status"] == "occupied"


def test_tenant_save_unsave_wishlist(tenant_client):
    """Tenant can save and unsave properties to wishlist."""
    prop = make_test_property()

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=prop))
    )
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db

    target_app = app.app if hasattr(app, 'app') else app
    target_app.dependency_overrides[get_db] = override_get_db

    # Save
    res_save = tenant_client.post(f"/properties/{prop.id}/save")
    assert res_save.status_code == 200 or res_save.status_code == 201

    # Unsave
    res_unsave = tenant_client.delete(f"/properties/{prop.id}/save")
    assert res_unsave.status_code == 204
