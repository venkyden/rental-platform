"""
Property Verification Service
Implementation for verifying property ownership (Titre de propriété, Taxe foncière).
Uses AI for OCR and data extraction, with fuzzy matching for ownership validation.
"""

import json
import logging
import asyncio
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# Optional AI imports
try:
    from google import genai
    from google.genai import types

    GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    GEMINI_AVAILABLE = False


@dataclass
class PropertyData:
    owner_name: str
    property_address: str
    confidence_score: float = 0.0


class PropertyVerificationService:
    def __init__(self):
        self.ai_client = None

        from app.core.config import settings

        if GEMINI_AVAILABLE and settings.GEMINI_API_KEY:
            self.ai_client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def verify_document(
        self, file_content: bytes, file_type: str, expected_owner_name: str, expected_address: str, document_type: str
    ) -> dict:
        """
        Verify Property Ownership Document (Deed or Tax Notice).
        """
        extracted_data = await self._extract_document_data(file_content, file_type, document_type)

        if not extracted_data:
            return {
                "verified": False,
                "status": "rejected",
                "data": None,
                "validation_checks": [],
                "rejection_reason": "Could not extract data from document",
            }

        validation_results = self._validate_property_data(
            extracted_data, expected_owner_name, expected_address
        )

        all_passed = all(check["passed"] for check in validation_results)

        if all_passed:
            status = "verified"
            verified = True
        else:
            status = "pending_review"
            verified = False

        return {
            "verified": verified,
            "status": status,
            "data": {
                "owner_name": extracted_data.owner_name,
                "property_address": extracted_data.property_address,
                "confidence_score": float(extracted_data.confidence_score),
            },
            "validation_checks": validation_results,
            "rejection_reason": (
                None if verified else self._get_rejection_reason(validation_results)
            ),
        }

    async def _extract_document_data(
        self, file_content: bytes, file_type: str, document_type: str
    ) -> Optional[PropertyData]:
        if not self.ai_client:
            return None

        models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash"]
        max_retries = 2

        document_part = types.Part.from_bytes(
            data=file_content,
            mime_type=file_type,
        )

        prompt = f"""Analyze this document of type '{document_type}' (likely a Property Deed or Tax Notice) and extract the following information in JSON format:

{{
    "owner_name": "Full name of the property owner",
    "property_address": "Full address of the property listed",
    "confidence_score": 0.0 to 1.0
}}

Important Context:
- Extract the owner's name as accurately as possible. Ignore notaries or agents.
- Extract the full address of the property being taxed or transferred.

Return ONLY the JSON, no explanation."""

        last_error = None
        for model_name in models_to_try:
            for attempt in range(max_retries + 1):
                try:
                    response = self.ai_client.models.generate_content(
                        model=model_name,
                        contents=[document_part, prompt],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                        ),
                    )

                    json_text = response.text
                    data = json.loads(json_text)

                    return PropertyData(
                        owner_name=data.get("owner_name", "Unknown"),
                        property_address=data.get("property_address", "Unknown"),
                        confidence_score=data.get("confidence_score", 0.5),
                    )

                except Exception as e:
                    last_error = e
                    error_str = str(e)
                    if "503" in error_str or "UNAVAILABLE" in error_str or "429" in error_str:
                        wait_time = (attempt + 1) * 2
                        logger.warning(f"Model {model_name} unavailable, retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    elif "404" in error_str or "NOT_FOUND" in error_str:
                        break
                    else:
                        logger.error(f"AI extraction failed: {e}", exc_info=True)
                        return None

        logger.error(f"All AI models failed for property extraction. Last error: {last_error}")
        return None

    def _validate_property_data(
        self, data: PropertyData, expected_owner_name: str, expected_address: str
    ) -> list:
        checks = []

        # 1. Owner Name match
        name_match = self._fuzzy_match(data.owner_name, expected_owner_name)
        checks.append(
            {
                "name": "owner_name_match",
                "description": "Owner name matches account",
                "passed": name_match > 0.5,
                "critical": True,
                "details": f"Document: {data.owner_name} | Account: {expected_owner_name} | Match: {name_match:.0%}",
            }
        )

        # 2. Address match
        addr_match = self._fuzzy_match(data.property_address, expected_address)
        checks.append(
            {
                "name": "address_match",
                "description": "Address matches listed property",
                "passed": addr_match > 0.4, # More lenient for addresses
                "critical": True,
                "details": f"Document: {data.property_address} | Listed: {expected_address} | Match: {addr_match:.0%}",
            }
        )

        # 3. Confidence score check
        high_confidence = data.confidence_score >= 0.7
        checks.append(
            {
                "name": "extraction_confidence",
                "description": "High extraction confidence",
                "passed": high_confidence,
                "critical": False,
                "details": f"Confidence: {data.confidence_score:.0%}",
            }
        )

        return checks

    def _fuzzy_match(self, s1: str, s2: str) -> float:
        if not s1 or not s2:
            return 0.0
        n1 = set(s1.lower().replace(",", "").replace(".", "").split())
        n2 = set(s2.lower().replace(",", "").replace(".", "").split())
        
        if not n1 or not n2:
            return 0.0

        intersection = len(n1 & n2)
        union = len(n1 | n2)
        return intersection / union if union > 0 else 0.0

    def _get_rejection_reason(self, checks: list) -> str:
        failed_critical = [c for c in checks if not c["passed"] and c["critical"]]
        if failed_critical:
            return failed_critical[0]["description"] + " - " + failed_critical[0]["details"]

        failed = [c for c in checks if not c["passed"]]
        if failed:
            return "Manual review required: " + ", ".join(c["name"] for c in failed)

        return "Unknown error"


# Global instance
property_verification_service = PropertyVerificationService()
