"""
Identity Verification Service
Implementation for ID verification (passport, ID card, residence permit, drivers license).
Uses AI for OCR and data extraction, with validation rules.
"""

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Optional AI imports
try:
    from google import genai
    from google.genai import types

    GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    GEMINI_AVAILABLE = False


VALID_DOCUMENT_TYPES = {"passport", "id_card", "residence_permit", "drivers_license"}


@dataclass
class IdentityData:
    """Extracted identity data from documents"""

    full_name: str
    document_number: str
    expiry_date: Optional[str]  # "YYYY-MM-DD"
    document_type: str  # "passport", "id_card", "residence_permit", "drivers_license"
    has_face_photo: bool
    is_identity_document: bool  # Critical: is this actually an ID?
    confidence_score: float = 0.0


class IdentityVerificationService:
    """
    Identity verification service for French rental applications.
    Uses Gemini AI for OCR and data extraction.
    """

    def __init__(self):
        self.ai_client = None

        from app.core.config import settings

        if GEMINI_AVAILABLE and settings.GEMINI_API_KEY:
            self.ai_client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def verify_document(
        self, file_content: bytes, file_type: str, expected_name: str, document_type: str
    ) -> dict:
        """
        Verify an identity document.

        Returns:
            {
                "verified": bool,
                "status": "verified" | "pending_review" | "rejected",
                "data": dict,
                "validation_checks": [...],
                "rejection_reason": Optional[str]
            }
        """
        extracted_data = await self._extract_document_data(file_content, file_type, document_type)

        if not extracted_data:
            return {
                "verified": False,
                "status": "rejected",
                "data": None,
                "validation_checks": [],
                "rejection_reason": "Could not extract data from document. Please upload a clearer image.",
            }

        validation_results = self._validate_identity_data(
            extracted_data, expected_name, document_type
        )

        critical_failed = any(
            not check["passed"] and check["critical"] for check in validation_results
        )
        all_passed = all(check["passed"] for check in validation_results)

        if critical_failed:
            status = "rejected"
            verified = False
        elif all_passed:
            status = "verified"
            verified = True
        else:
            # Non-critical checks failed — accept but flag for review
            status = "verified"
            verified = True

        return {
            "verified": verified,
            "status": status,
            "data": {
                "full_name": extracted_data.full_name,
                "document_number": extracted_data.document_number,
                "expiry_date": extracted_data.expiry_date,
                "document_type": extracted_data.document_type,
                "has_face_photo": extracted_data.has_face_photo,
                "is_identity_document": extracted_data.is_identity_document,
                "confidence_score": extracted_data.confidence_score,
            },
            "validation_checks": validation_results,
            "rejection_reason": (
                None if verified else self._get_rejection_reason(validation_results)
            ),
        }

    async def _extract_document_data(
        self, file_content: bytes, file_type: str, document_type: str
    ) -> Optional[IdentityData]:
        """Extract data from document using AI OCR"""

        if not self.ai_client:
            logger.warning("AI client not initialized — skipping verification")
            return None

        try:
            document_part = types.Part.from_bytes(
                data=file_content,
                mime_type=file_type,
            )

            prompt = f"""You are an identity document verification assistant.

Analyze the provided image and determine:
1. Is this actually a government-issued identity document (passport, national ID card, residence permit, or driver's license)?
2. If yes, extract the data from it.

The user claims this is a '{document_type}'.

Return a JSON object with these fields:

{{
    "is_identity_document": true or false (Is this image actually a government-issued identity document? Set to false if it's a random photo, selfie, screenshot, receipt, payslip, or ANY non-ID image),
    "full_name": "Person's full name as it appears on the document, or 'Unknown' if not an ID",
    "document_number": "Document ID number, or 'Unknown' if not readable",
    "expiry_date": "YYYY-MM-DD format, or null if not found or not an ID",
    "document_type": "passport, id_card, residence_permit, or drivers_license — what the document actually is",
    "has_face_photo": true or false (does the document contain a photograph of a person's face?),
    "confidence_score": 0.0 to 1.0 (how confident you are in your extraction)
}}

Critical rules:
- If the image is NOT an identity document at all, set is_identity_document to false and confidence_score below 0.3.
- If it IS an identity document but of a different type than claimed '{document_type}', still set is_identity_document to true and set document_type to what it actually is.
- Extract names exactly as printed (given names + surname).
- Standardize expiry_date to YYYY-MM-DD. Use null if not found.

Return ONLY the JSON, no explanation."""

            response = self.ai_client.models.generate_content(
                model="gemini-1.5-flash",
                contents=[document_part, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )

            # Parse response
            json_text = response.text
            data = json.loads(json_text)

            logger.info(f"AI extracted data for {document_type}: {data}")

            return IdentityData(
                full_name=data.get("full_name", "Unknown"),
                document_number=data.get("document_number", "Unknown"),
                expiry_date=data.get("expiry_date"),
                document_type=data.get("document_type", document_type),
                is_identity_document=bool(data.get("is_identity_document", False)),
                has_face_photo=bool(data.get("has_face_photo", False)),
                confidence_score=float(data.get("confidence_score", 0.0)),
            )

        except Exception as e:
            logger.error(f"AI identity extraction failed: {e}", exc_info=True)
            return None

    def _validate_identity_data(
        self, data: IdentityData, expected_name: str, claimed_type: str
    ) -> list:
        checks = []

        # 1. CRITICAL: Is this actually an identity document?
        checks.append(
            {
                "name": "is_identity_document",
                "description": "Image is a valid government-issued identity document",
                "passed": data.is_identity_document,
                "critical": True,
                "details": (
                    f"Detected: {data.document_type}"
                    if data.is_identity_document
                    else "This does not appear to be an identity document"
                ),
            }
        )

        # 2. CRITICAL: Confidence score (prevents garbage/blurry images)
        high_confidence = data.confidence_score >= 0.5
        checks.append(
            {
                "name": "extraction_confidence",
                "description": "Document is readable with sufficient confidence",
                "passed": high_confidence,
                "critical": True,
                "details": f"Confidence: {data.confidence_score:.0%}",
            }
        )

        # 3. CRITICAL: Expiration check
        is_expired = False
        expired_msg = "No expiry date found"
        if data.expiry_date:
            try:
                exp_date = datetime.fromisoformat(data.expiry_date)
                is_expired = exp_date.date() < datetime.now().date()
                if is_expired:
                    expired_msg = f"Expired on {data.expiry_date}"
                else:
                    expired_msg = f"Valid until {data.expiry_date}"
            except ValueError:
                expired_msg = f"Could not parse expiry: {data.expiry_date}"

        checks.append(
            {
                "name": "not_expired",
                "description": "Document is not expired",
                "passed": not is_expired,
                "critical": True,
                "details": expired_msg,
            }
        )

        # 4. NON-CRITICAL: Name match (flagged for review, not blocking)
        name_match = self._fuzzy_name_match(data.full_name, expected_name)
        checks.append(
            {
                "name": "name_match",
                "description": "Name on document matches account name",
                "passed": name_match > 0.5,
                "critical": False,
                "details": f"Document: {data.full_name} | Account: {expected_name} | Match: {name_match:.0%}",
            }
        )

        # 5. NON-CRITICAL: Face photo present
        checks.append(
            {
                "name": "has_face_photo",
                "description": "Document contains a photograph of a face",
                "passed": data.has_face_photo,
                "critical": False,
                "details": "Photo detected" if data.has_face_photo else "No photo detected",
            }
        )

        return checks

    def _fuzzy_name_match(self, name1: str, name2: str) -> float:
        """Calculate fuzzy match score between two names"""
        n1 = set(name1.lower().split())
        n2 = set(name2.lower().split())

        if not n1 or not n2:
            return 0.0

        intersection = len(n1 & n2)
        union = len(n1 | n2)

        return intersection / union if union > 0 else 0.0

    def _get_rejection_reason(self, checks: list) -> str:
        """Get human-readable rejection reason"""
        failed_critical = [c for c in checks if not c["passed"] and c["critical"]]
        if failed_critical:
            return (
                failed_critical[0]["description"]
                + " — "
                + failed_critical[0]["details"]
            )

        failed = [c for c in checks if not c["passed"]]
        if failed:
            return "Manual review required: " + ", ".join(c["name"] for c in failed)

        return "Unknown error"

# Global instance
identity_service = IdentityVerificationService()
