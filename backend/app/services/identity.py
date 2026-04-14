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
        """Extract data from document using AI OCR with retry and model fallback"""

        if not self.ai_client:
            logger.warning("AI client not initialized — skipping verification")
            return None

        import asyncio

        models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash"]
        max_retries = 2

        document_part = types.Part.from_bytes(
            data=file_content,
            mime_type=file_type,
        )

        prompt = f"""You are a STRICT identity document verification assistant. Your job is to determine if an image shows a REAL government-issued photo ID.

An identity document is ONLY one of these:
- Passport (booklet with bio page containing photo, name, passport number, expiry)
- National ID Card / Carte Nationale d'Identité (plastic card with photo, name, ID number)
- Residence Permit / Titre de séjour (card with photo, name, permit number)
- Driver's License / Permis de conduire (card with photo, name, license number)

The following are NOT identity documents and MUST be rejected (is_identity_document = false):
- Payslips / bulletins de salaire
- Tax returns / avis d'imposition  
- Employment contracts
- Bank statements
- Student IDs or enrollment certificates
- Utility bills
- Screenshots, selfies, random photos
- Any document without a government-issued photo ID format

The user claims this is a '{document_type}'.

Return a JSON object:

{{
    "is_identity_document": true or false,
    "full_name": "Person's full name from the ID, or 'Unknown'",
    "document_number": "ID number, passport number, permit number, or license number. 'Unknown' if not an ID",
    "expiry_date": "YYYY-MM-DD or null",
    "document_type": "passport, id_card, residence_permit, or drivers_license. Use 'other' if it's not any of these",
    "has_face_photo": true or false,
    "confidence_score": 0.0 to 1.0
}}

Strict rules:
- Set is_identity_document to false if the image is NOT a government photo ID. Be strict.
- Set document_type to "other" if it's not one of the 4 valid types listed above.
- A real ID card always has a face photo. If there's no face photo, it's likely not an ID.
- If confidence is low or the image is unclear, set confidence_score below 0.3.

Return ONLY the JSON."""

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

                    logger.info(f"AI extracted data for {document_type} (model={model_name}): {data}")

                    return IdentityData(
                        full_name=data.get("full_name", "Unknown"),
                        document_number=data.get("document_number", "Unknown"),
                        expiry_date=data.get("expiry_date"),
                        document_type=data.get("document_type", document_type),
                        is_identity_document=bool(data.get("is_identity_document", False)),
                        has_face_photo=bool(data.get("has_face_photo", False)),
                        confidence_score=float(data.get("confidence_score") if data.get("confidence_score") is not None else 0.0),
                    )

                except Exception as e:
                    last_error = e
                    error_str = str(e)
                    # Retry on 503 (overloaded) or 429 (rate limit)
                    if "503" in error_str or "UNAVAILABLE" in error_str or "429" in error_str:
                        wait_time = (attempt + 1) * 2  # 2s, 4s, 6s
                        logger.warning(f"Model {model_name} unavailable (attempt {attempt+1}/{max_retries+1}), retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    # For 404 (model not found), skip to next model immediately
                    elif "404" in error_str or "NOT_FOUND" in error_str:
                        logger.warning(f"Model {model_name} not found, trying next model...")
                        break
                    else:
                        logger.error(f"AI identity extraction failed: {e}", exc_info=True)
                        return None

        logger.error(f"All AI models failed for identity extraction. Last error: {last_error}")
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

        # 2. CRITICAL: Document type must be a valid ID type (not 'other')
        valid_id_types = {"passport", "id_card", "residence_permit", "drivers_license"}
        is_valid_type = data.document_type.lower().replace(" ", "_") in valid_id_types
        checks.append(
            {
                "name": "valid_document_type",
                "description": "Document is a recognized identity document type",
                "passed": is_valid_type,
                "critical": True,
                "details": f"Detected type: {data.document_type}" if is_valid_type else f"'{data.document_type}' is not a valid identity document type",
            }
        )

        # 3. CRITICAL: Confidence score (prevents garbage/blurry images)
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

        # 5. CRITICAL: Face photo present (all valid IDs have a face photo)
        checks.append(
            {
                "name": "has_face_photo",
                "description": "Document contains a photograph of a face",
                "passed": data.has_face_photo,
                "critical": True,
                "details": "Photo detected" if data.has_face_photo else "No face photo detected — this may not be a valid ID",
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
