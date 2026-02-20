import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from app.main import app
from app.routers.media import storage
from app.routers.auth import get_current_user

client = TestClient(app)

# Mock User
async def mock_get_current_user():
    return type("User", (), {"id": "123", "email": "test@example.com", "is_active": True})

app.dependency_overrides[get_current_user] = mock_get_current_user

def test_upload_media_success():
    # Mock storage service
    with patch.object(storage, 'upload_file', new_callable=AsyncMock) as mock_upload:
        mock_upload.return_value = {
            "url": "https://fake-r2.com/test.jpg",
            "key": "inventory/test.jpg",
            "storage": "cloud"
        }
        
        # Create a fake file
        files = {'file': ('test.jpg', b'fake image content', 'image/jpeg')}
        
        response = client.post("/api/v1/media/upload?folder=inventory", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "https://fake-r2.com/test.jpg"
        assert data["key"] == "inventory/test.jpg"
        
        # Verify storage called with correct params
        mock_upload.assert_called_once()
        assert mock_upload.call_args[1]["folder"] == "inventory"

def test_upload_media_invalid_type():
    files = {'file': ('malware.exe', b'bad content', 'application/x-msdownload')}
    response = client.post("/api/v1/media/upload", files=files)
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]

def test_upload_media_invalid_folder():
    # Should default to "general" or fallback, or error if strict.
    # Code says: if folder not in allowed, folder = "general"
    with patch.object(storage, 'upload_file', new_callable=AsyncMock) as mock_upload:
        mock_upload.return_value = {"url": "url", "key": "key", "storage": "local"}
        
        files = {'file': ('test.png', b'content', 'image/png')}
        client.post("/api/v1/media/upload?folder=hacker_folder", files=files)
        
        # Verify fallback
        assert mock_upload.call_args[1]["folder"] == "general"
