import os
import sys
import json
from unittest.mock import MagicMock

# Add parent directory of backend/ (which is the current workspace directory) to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Set mock env vars for postgresql engine compatibility
os.environ["SECRET_KEY"] = "mock-secret-key-for-test-purposes"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://mockuser:mockpass@localhost/mock_db"

from app.services.identity import identity_service, IdentityData

def test_validate_identity_data_matching_types():
    # Arrange
    data = IdentityData(
        full_name="Tenant User",
        document_number="AB123456",
        expiry_date="2030-01-01",
        document_type="passport",
        has_face_photo=True,
        is_identity_document=True,
        confidence_score=0.9
    )
    
    # Act
    checks = identity_service._validate_identity_data(
        data=data,
        expected_name="Tenant User",
        expected_document_type="passport"
    )
    
    # Assert
    type_match_check = next(c for c in checks if c["name"] == "document_type_match")
    assert type_match_check["passed"] is True
    print("✅ test_validate_identity_data_matching_types passed")

def test_validate_identity_data_matching_types_synonyms():
    # Arrange
    data = IdentityData(
        full_name="Tenant User",
        document_number="AB123456",
        expiry_date="2030-01-01",
        document_type="carte nationale d'identité",
        has_face_photo=True,
        is_identity_document=True,
        confidence_score=0.9
    )
    
    # Act
    checks = identity_service._validate_identity_data(
        data=data,
        expected_name="Tenant User",
        expected_document_type="id_card"
    )
    
    # Assert
    type_match_check = next(c for c in checks if c["name"] == "document_type_match")
    assert type_match_check["passed"] is True
    print("✅ test_validate_identity_data_matching_types_synonyms passed")

def test_validate_identity_data_mismatched_types():
    # Arrange
    data = IdentityData(
        full_name="Tenant User",
        document_number="AB123456",
        expiry_date="2030-01-01",
        document_type="drivers_license",
        has_face_photo=True,
        is_identity_document=True,
        confidence_score=0.9
    )
    
    # Act
    checks = identity_service._validate_identity_data(
        data=data,
        expected_name="Tenant User",
        expected_document_type="passport"
    )
    
    # Assert
    type_match_check = next(c for c in checks if c["name"] == "document_type_match")
    assert type_match_check["passed"] is False
    assert type_match_check["critical"] is True
    print("✅ test_validate_identity_data_mismatched_types passed")

import asyncio

async def test_verify_selfie_with_id_match():
    # Arrange
    mock_ai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "has_live_face": True,
        "has_id_document": True,
        "id_has_face_photo": True,
        "is_same_person": True,
        "full_name": "Tenant User",
        "document_number": "AB123456",
        "expiry_date": "2030-01-01",
        "detected_document_type": "passeport", # synonym of passport
        "confidence_score": 0.9
    })
    mock_ai_client.models.generate_content = MagicMock(return_value=mock_response)
    
    # Temporarily assign mock client
    original_client = identity_service.ai_client
    identity_service.ai_client = mock_ai_client
    
    try:
        # Act
        result = await identity_service.verify_selfie_with_id(
            file_content=b"dummy_image",
            file_type="image/jpeg",
            document_type="passport",
            expected_name="Tenant User"
        )
        
        # Assert
        assert result["verified"] is True
        assert result["status"] == "verified"
        type_match_check = next(c for c in result["validation_checks"] if c["name"] == "document_type_match")
        assert type_match_check["passed"] is True
        print("✅ test_verify_selfie_with_id_match passed")
    finally:
        identity_service.ai_client = original_client

async def test_verify_selfie_with_id_mismatch():
    # Arrange
    mock_ai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "has_live_face": True,
        "has_id_document": True,
        "id_has_face_photo": True,
        "is_same_person": True,
        "full_name": "Tenant User",
        "document_number": "AB123456",
        "expiry_date": "2030-01-01",
        "detected_document_type": "id_card", # mismatch with expected "passport"
        "confidence_score": 0.9
    })
    mock_ai_client.models.generate_content = MagicMock(return_value=mock_response)
    
    # Temporarily assign mock client
    original_client = identity_service.ai_client
    identity_service.ai_client = mock_ai_client
    
    try:
        # Act
        result = await identity_service.verify_selfie_with_id(
            file_content=b"dummy_image",
            file_type="image/jpeg",
            document_type="passport",
            expected_name="Tenant User"
        )
        
        # Assert
        assert result["verified"] is False
        assert result["status"] == "rejected"
        type_match_check = next(c for c in result["validation_checks"] if c["name"] == "document_type_match")
        assert type_match_check["passed"] is False
        assert type_match_check["critical"] is True
        print("✅ test_verify_selfie_with_id_mismatch passed")
    finally:
        identity_service.ai_client = original_client

if __name__ == "__main__":
    test_validate_identity_data_matching_types()
    test_validate_identity_data_matching_types_synonyms()
    test_validate_identity_data_mismatched_types()
    asyncio.run(test_verify_selfie_with_id_match())
    asyncio.run(test_verify_selfie_with_id_mismatch())
    print("🎉 All document type validation tests passed!")
