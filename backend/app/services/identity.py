"""
Identity Verification Service
Implementation for ID verification (passport, ID card, residence permit, drivers license).
Uses AI for OCR and data extraction, with validation rules.
"""

import json
import hashlib
import logging
import asyncio
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from app.core.database import AsyncSessionLocal
from app.models.document import DocumentExtraction
from sqlalchemy import select

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

    def _get_file_hash(self, file_content: bytes) -> str:
        """Generate a SHA-256 hash of the file content."""
        return hashlib.sha256(file_content).hexdigest()

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
        file_hash = self._get_file_hash(file_content)
        cached_extraction = None

        # Try to get from cache
        async with AsyncSessionLocal() as session:
            stmt = select(DocumentExtraction).where(DocumentExtraction.file_hash == file_hash)
            result = await session.execute(stmt)
            db_extraction = result.scalar_one_or_none()
            
            if db_extraction:
                logger.info(f"Identity OCR Cache Hit for hash {file_hash}")
                data = db_extraction.extraction_data
                cached_extraction = IdentityData(
                    full_name=data.get("full_name", "Unknown"),
                    document_number=data.get("document_number", "Unknown"),
                    expiry_date=data.get("expiry_date"),
                    document_type=data.get("document_type", document_type),
                    is_identity_document=bool(data.get("is_identity_document", False)),
                    has_face_photo=bool(data.get("has_face_photo", False)),
                    confidence_score=float(data.get("confidence_score", 1.0)),
                )

        if cached_extraction:
            extracted_data = cached_extraction
        else:
            extracted_data = await self._extract_document_data(file_content, file_type, document_type)
            
            # Store in cache if successful
            if extracted_data:
                async with AsyncSessionLocal() as session:
                    new_extraction = DocumentExtraction(
                        file_hash=file_hash,
                        extraction_data={
                            "full_name": extracted_data.full_name,
                            "document_number": extracted_data.document_number,
                            "expiry_date": extracted_data.expiry_date,
                            "document_type": extracted_data.document_type,
                            "is_identity_document": extracted_data.is_identity_document,
                            "has_face_photo": extracted_data.has_face_photo,
                            "confidence_score": float(extracted_data.confidence_score),
                        }
                    )
                    session.add(new_extraction)
                    try:
                        await session.commit()
                    except Exception as e:
                        await session.rollback()
                        logger.warning(f"Failed to cache identity extraction: {e}")

        if not extracted_data:
            return {
                "verified": True,
                "status": "pending_review",
                "data": None,
                "validation_checks": [],
                "rejection_reason": None,
            }

        validation_results = self._validate_identity_data(extracted_data, expected_name, document_type)

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

        from app.core.gemini_quota import check_quota
        await check_quota()

        start_time = time.time()

        models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash"]
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
- French Residence Permit / Titre de séjour (Must be valid, check expiry)

Special for French context:
- Carte Nationale d'Identité (CNI): Modern (format carte bancaire) or Legacy (large blue plastic).
- Titre de séjour: Check the 'Valable du... au...' dates.

The user claims this is a '{document_type}'.

Return a JSON object:

{{
    "is_identity_document": true or false,
    "full_name": "Person's full name from the ID, or 'Unknown'. Include middle names if present.",
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
- For Titre de séjour, verify it's the actual permit, not just a 'récépissé' (unless specified).
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

                    duration = time.time() - start_time
                    logger.info(f"AI extracted data for {document_type} (model={model_name}) in {duration:.2f}s: {data}")

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
        self, data: IdentityData, expected_name: str, expected_document_type: str = None
    ) -> list:
        checks = []

        # Check if the document type matches the expected document type
        if expected_document_type:
            french_mappings = {
                "passport": {"passeport"},
                "id_card": {"carte_d_identite", "carte_nationale_d_identite", "cni", "national_id", "national_id_card", "id"},
                "residence_permit": {"titre_de_sejour", "carte_de_sejour", "residence_card", "permit", "french_residence_permit"},
                "drivers_license": {"permis_de_conduire", "driver_license", "license"},
            }
            def get_canonical_type(val: str) -> str:
                import unicodedata
                import re
                # Strip accents and lower-case
                norm = ''.join(c for c in unicodedata.normalize('NFD', val.lower())
                              if unicodedata.category(c) != 'Mn')
                # Replace any sequence of non-alphanumeric chars with a single underscore
                norm = re.sub(r'[^a-z0-9]+', '_', norm).strip('_')
                for canonical, synonyms in french_mappings.items():
                    if norm == canonical or norm in synonyms:
                        return canonical
                return norm

            expected_canonical = get_canonical_type(expected_document_type)
            detected_canonical = get_canonical_type(data.document_type)
            type_matches = (expected_canonical == detected_canonical)

            checks.append(
                {
                    "name": "document_type_match",
                    "description": "Document type matches the selected type",
                    "passed": type_matches,
                    "critical": True,
                    "details": f"Expected: {expected_document_type} | Detected: {data.document_type}",
                }
            )

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

        # 4. CRITICAL: Name match (Blocking in production)
        name_match = self._fuzzy_name_match(data.full_name, expected_name)
        checks.append(
            {
                "name": "name_match",
                "description": "Name on document matches account name",
                "passed": name_match > 0.5,
                "critical": True,
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

    async def verify_selfie_with_id(
        self,
        file_content: bytes,
        file_type: str,
        document_type: str,
        expected_name: str,
    ) -> dict:
        """
        Verify a single photo of a person holding their ID beside their face.
        Combines OCR, liveness check, and face-match in one AI call.
        """
        if not self.ai_client:
            return {
                "verified": True,
                "status": "pending_review",
                "data": None,
                "validation_checks": [],
                "rejection_reason": None,
            }

        start_time = time.time()
        image_part = types.Part.from_bytes(data=file_content, mime_type=file_type)

        doc_hints = {
            "passport": "bio page with photo, full name, passport number, and MRZ visible",
            "id_card": "front side with face photo, full name, and ID number visible",
            "drivers_license": "front side with face photo, full name, and license number visible",
            "residence_permit": "front side with face photo, full name, and permit number visible",
        }
        doc_hint = doc_hints.get(document_type, "front side of a government-issued photo ID")

        prompt = f"""You are a strict KYC identity verification system for a French rental platform.

The image shows a person holding their government-issued ID document next to their face.
Claimed document type: '{document_type}' ({doc_hint}).

Return ONLY this JSON — no markdown, no extra text:

{{
    "has_live_face": true or false,
    "has_id_document": true or false,
    "id_has_face_photo": true or false,
    "is_same_person": true or false,
    "full_name": "full name from the ID or 'Unknown'",
    "document_number": "document/passport/license number from the ID or 'Unknown'",
    "expiry_date": "YYYY-MM-DD or null",
    "detected_document_type": "passport, id_card, residence_permit, or drivers_license",
    "confidence_score": 0.0 to 1.0
}}

Rules:
- has_live_face: a real human face is clearly visible in the photo (not a printout/screen)
- has_id_document: a government ID is clearly present and its text is legible
- id_has_face_photo: the ID itself contains a portrait/face photo
- is_same_person: the live face and the face on the ID appear to be the same person (allow for lighting/angle)
- confidence_score below 0.4 if: blurry, poorly lit, ID text unreadable, or face obscured"""

        models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash"]
        last_error = None

        for model_name in models_to_try:
            for attempt in range(3):
                try:
                    response = self.ai_client.models.generate_content(
                        model=model_name,
                        contents=[image_part, prompt],
                        config=types.GenerateContentConfig(response_mime_type="application/json"),
                    )
                    data = json.loads(response.text)
                    logger.info(f"Selfie+ID verification (model={model_name}) in {time.time()-start_time:.2f}s: {data}")

                    checks = [
                        {
                            "name": "live_face_present",
                            "description": "Live face clearly visible in photo",
                            "passed": bool(data.get("has_live_face", False)),
                            "critical": True,
                            "details": "Face detected" if data.get("has_live_face") else "No live face visible — ensure your face is fully in frame",
                        },
                        {
                            "name": "id_document_visible",
                            "description": "Government ID document visible and readable",
                            "passed": bool(data.get("has_id_document", False)),
                            "critical": True,
                            "details": "ID detected" if data.get("has_id_document") else "ID not clearly visible — hold it steady beside your face",
                        },
                        {
                            "name": "id_has_face_photo",
                            "description": "ID document contains a face photo",
                            "passed": bool(data.get("id_has_face_photo", False)),
                            "critical": True,
                            "details": "Face photo found on ID" if data.get("id_has_face_photo") else "No face photo visible on the ID document",
                        },
                        {
                            "name": "same_person",
                            "description": "Live face matches face on ID",
                            "passed": bool(data.get("is_same_person", False)),
                            "critical": True,
                            "details": "Identity confirmed" if data.get("is_same_person") else "Live face does not match the face on the ID",
                        },
                        {
                            "name": "image_quality",
                            "description": "Image quality sufficient for verification",
                            "passed": float(data.get("confidence_score", 0)) >= 0.4,
                            "critical": True,
                            "details": f"Confidence: {float(data.get('confidence_score', 0)):.0%}",
                        },
                    ]

                    detected_type = data.get("detected_document_type", document_type)
                    french_mappings = {
                        "passport": {"passeport"},
                        "id_card": {"carte_d_identite", "carte_nationale_d_identite", "cni", "national_id", "national_id_card", "id"},
                        "residence_permit": {"titre_de_sejour", "carte_de_sejour", "residence_card", "permit", "french_residence_permit"},
                        "drivers_license": {"permis_de_conduire", "driver_license", "license"},
                    }
                    def get_canonical_type(val: str) -> str:
                        import unicodedata
                        import re
                        # Strip accents and lower-case
                        norm = ''.join(c for c in unicodedata.normalize('NFD', val.lower())
                                      if unicodedata.category(c) != 'Mn')
                        # Replace any sequence of non-alphanumeric chars with a single underscore
                        norm = re.sub(r'[^a-z0-9]+', '_', norm).strip('_')
                        for canonical, synonyms in french_mappings.items():
                            if norm == canonical or norm in synonyms:
                                return canonical
                        return norm

                    expected_canonical = get_canonical_type(document_type)
                    detected_canonical = get_canonical_type(detected_type)
                    type_matches = (expected_canonical == detected_canonical)

                    checks.append({
                        "name": "document_type_match",
                        "description": "Document type matches the selected type",
                        "passed": type_matches,
                        "critical": True,
                        "details": f"Expected: {document_type} | Detected: {detected_type}",
                    })

                    full_name = data.get("full_name", "Unknown")
                    if full_name and full_name != "Unknown" and expected_name:
                        match = self._fuzzy_name_match(full_name, expected_name)
                        checks.append({
                            "name": "name_match",
                            "description": "Name on ID matches account name",
                            "passed": match > 0.5,
                            "critical": True,
                            "details": f"ID: {full_name} | Account: {expected_name} | Match: {match:.0%}",
                        })

                    expiry_date = data.get("expiry_date")
                    if expiry_date:
                        try:
                            exp = datetime.fromisoformat(expiry_date)
                            is_expired = exp.date() < datetime.now().date()
                            checks.append({
                                "name": "not_expired",
                                "description": "Document is not expired",
                                "passed": not is_expired,
                                "critical": True,
                                "details": f"Expired on {expiry_date}" if is_expired else f"Valid until {expiry_date}",
                            })
                        except ValueError:
                            pass

                    critical_failed = any(not c["passed"] and c["critical"] for c in checks)
                    verified = not critical_failed

                    return {
                        "verified": verified,
                        "status": "verified" if verified else "rejected",
                        "data": {
                            "full_name": full_name,
                            "document_number": data.get("document_number", "Unknown"),
                            "expiry_date": expiry_date,
                            "document_type": data.get("detected_document_type", document_type),
                            "confidence_score": float(data.get("confidence_score", 0)),
                            "is_same_person": bool(data.get("is_same_person", False)),
                            "verification_method": "selfie_with_id",
                        },
                        "validation_checks": checks,
                        "rejection_reason": self._get_rejection_reason(checks) if not verified else None,
                    }

                except Exception as e:
                    last_error = e
                    err = str(e)
                    if "503" in err or "UNAVAILABLE" in err or "429" in err:
                        await asyncio.sleep((attempt + 1) * 2)
                        continue
                    elif "404" in err or "NOT_FOUND" in err:
                        break
                    logger.error(f"Selfie+ID verification failed: {e}", exc_info=True)
                    return {"verified": True, "status": "pending_review", "data": None, "validation_checks": [], "rejection_reason": None}

        logger.error(f"All models failed for selfie+ID verification. Last error: {last_error}")
        return {"verified": True, "status": "pending_review", "data": None, "validation_checks": [], "rejection_reason": None}

    async def compare_faces(
        self,
        id_image: bytes,
        id_file_type: str,
        selfie: bytes,
        selfie_file_type: str,
    ) -> dict:
        """
        Compare the face on an identity document against a live selfie.

        Returns:
            {"match": bool, "confidence": float, "reason": str}
        """
        if not self.ai_client:
            logger.warning("AI client not initialised — face comparison unavailable")
            return {"match": False, "confidence": 0.0, "reason": "AI service unavailable"}

        id_part = types.Part.from_bytes(data=id_image, mime_type=id_file_type)
        selfie_part = types.Part.from_bytes(data=selfie, mime_type=selfie_file_type)

        prompt = """You are a strict face-verification assistant.

Image 1 is a government-issued identity document (passport, ID card, etc.).
Image 2 is a live selfie photo.

Compare the faces in both images and determine whether they belong to the same person.

Rules:
- Compare face shape, eyes, nose, mouth, and overall appearance.
- The ID photo may be older or lower quality — allow for reasonable aging.
- If you cannot clearly see a face in either image, set match=false.
- Be strict: a confidence below 0.6 should produce match=false.

Return ONLY this JSON:
{
    "match": true or false,
    "confidence": 0.0 to 1.0,
    "reason": "one-sentence explanation"
}"""

        models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash"]
        for model_name in models_to_try:
            for attempt in range(3):
                try:
                    response = self.ai_client.models.generate_content(
                        model=model_name,
                        contents=[id_part, selfie_part, prompt],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                        ),
                    )
                    data = json.loads(response.text)
                    return {
                        "match": bool(data.get("match", False)),
                        "confidence": float(data.get("confidence", 0.0)),
                        "reason": data.get("reason", ""),
                    }
                except Exception as e:
                    err = str(e)
                    if "503" in err or "UNAVAILABLE" in err or "429" in err:
                        await asyncio.sleep((attempt + 1) * 2)
                        continue
                    elif "404" in err or "NOT_FOUND" in err:
                        break
                    logger.error(f"Face comparison failed: {e}", exc_info=True)
                    return {"match": False, "confidence": 0.0, "reason": "Comparison failed"}

        return {"match": False, "confidence": 0.0, "reason": "AI models unavailable"}


# Global instance
identity_service = IdentityVerificationService()
