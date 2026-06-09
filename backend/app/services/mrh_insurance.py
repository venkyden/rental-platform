"""
MRH Insurance Verification Service
Checks French Multirisques Habitation (MRH) insurance certificates.
Implements DOSSIER §5.8 checks IN-1 through IN-5.
"""

import json
import logging
import re
import unicodedata
from typing import Optional

logger = logging.getLogger(__name__)

# Optional AI imports
try:
    from google import genai
    from google.genai import types

    GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    types = None
    GEMINI_AVAILABLE = False

_EXTRACTION_PROMPT = """\
You are an assistant that extracts structured data from French MRH (Multirisques Habitation)
insurance documents. Extract the following fields from the document text or image and return
a JSON object with EXACTLY these keys:

- document_type: "certificate" if this is a final attestation/certificate, "quote" if it is
  a devis or proposition, or "unknown" if you cannot determine.
- insurer_name: the name of the insurance company.
- insurer_country: the ISO-3166-1 alpha-2 country code of the insurer (e.g. "FR" for France).
  Return null if you cannot determine.
- insured_name: the full name of the insured person.
- property_address: the insured property address.
- cover_start: the policy start date in YYYY-MM-DD format, or null.
- cover_end: the policy end date in YYYY-MM-DD format, or null.

Respond with JSON only. No explanation."""


def _strip_accents(text: str) -> str:
    """Normalize NFD and drop combining diacritics."""
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _is_valid_date(value) -> bool:
    return isinstance(value, str) and bool(_ISO_DATE.match(value))


def _text_contains_normalized(extracted: str, expected: str) -> bool:
    """
    Return True when expected is contained in extracted (accent-insensitive,
    case-insensitive, substring match).

    NEVER builds a RegExp from user-provided strings (ReDoS / injection prevention).
    """
    norm_extracted = _strip_accents(extracted).lower()
    norm_expected = _strip_accents(expected).lower()
    return norm_expected in norm_extracted


def check_mrh_extraction(
    extracted: dict,
    expected_name: str,
    expected_address: str,
) -> dict:
    """
    Pure-function check of Gemini-extracted MRH fields.

    IN-1: document is a quote → hard reject
    IN-2: name / address mismatch → soft flag
    IN-3: non-FR insurer → hard reject
    IN-4: cover dates missing → soft flag
    IN-5: flags never gate (flagged → 200, landlord decides)

    Returns the result dict; never raises.
    """
    if not isinstance(extracted, dict):
        raise TypeError(f"extracted must be a dict, got {type(extracted).__name__}")

    flags: list[str] = []
    rejection_reason: Optional[str] = None
    status = "verified"

    document_type: str = extracted.get("document_type", "unknown") or "unknown"
    insurer_country: Optional[str] = extracted.get("insurer_country")
    insured_name: str = extracted.get("insured_name") or ""
    property_address: str = extracted.get("property_address") or ""
    cover_start: Optional[str] = extracted.get("cover_start")
    cover_end: Optional[str] = extracted.get("cover_end")

    # Compute insurer_fr before any early return
    insurer_fr = (insurer_country.upper() == "FR") if insurer_country is not None else None

    # IN-1: quote is a hard reject
    if document_type == "quote":
        status = "rejected"
        rejection_reason = "IN-1: document is a quote, not a final certificate"
        return {
            "verified": False,
            "status": status,
            "mrh_assurance": "MEDIUM",
            "mrh_insurer_fr": insurer_fr,
            "mrh_cert_type": document_type,
            "mrh_cover_start": cover_start,
            "mrh_cover_end": cover_end,
            "flags": flags,
            "rejection_reason": rejection_reason,
        }

    # IN-3: non-FR insurer is a hard reject (None is a soft flag handled below)
    if insurer_country is not None and insurer_country != "FR":
        status = "rejected"
        rejection_reason = "IN-3: non-French insurer — French MRH required for French property"
        return {
            "verified": False,
            "status": status,
            "mrh_assurance": "MEDIUM",
            "mrh_insurer_fr": False,
            "mrh_cert_type": document_type,
            "mrh_cover_start": cover_start,
            "mrh_cover_end": cover_end,
            "flags": flags,
            "rejection_reason": rejection_reason,
        }

    # From here on, only soft flags remain — no hard rejects.

    # document_type unknown → soft flag
    if document_type == "unknown":
        flags.append("doc_type_unknown")

    # insurer_country unknown → soft flag
    if insurer_country is None:
        flags.append("insurer_country_unknown")
        mrh_insurer_fr = None
    else:
        mrh_insurer_fr = True  # insurer_country == "FR" confirmed above

    # IN-2: name mismatch — no RegExp, accent-stripped substring only
    if insured_name and expected_name:
        if not _text_contains_normalized(insured_name, expected_name):
            flags.append("name_mismatch")

    # IN-2: address mismatch
    if property_address and expected_address:
        if not _text_contains_normalized(property_address, expected_address):
            flags.append("address_mismatch")

    # IN-4: cover dates missing or malformed → soft flag
    dates_present = cover_start is not None and cover_end is not None
    if not dates_present:
        flags.append("cover_dates_missing")
    else:
        if not _is_valid_date(cover_start) or not _is_valid_date(cover_end):
            flags.append("cover_dates_malformed")

    if flags:
        status = "flagged"

    return {
        "verified": status == "verified",
        "status": status,
        "mrh_assurance": "MEDIUM",
        "mrh_insurer_fr": mrh_insurer_fr,
        "mrh_cert_type": document_type,
        "mrh_cover_start": cover_start,
        "mrh_cover_end": cover_end,
        "flags": flags,
        "rejection_reason": rejection_reason,
    }


class MrhInsuranceService:
    """
    MRH insurance verification service.

    Uses Gemini to extract fields from the uploaded document, then
    runs the pure-function check_mrh_extraction checks.
    """

    def __init__(self) -> None:
        self.ai_client = None

        from app.core.config import settings

        if GEMINI_AVAILABLE and settings.GEMINI_API_KEY:
            self.ai_client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def _extract(self, file_content: bytes, file_type: str) -> Optional[dict]:
        """Call Gemini and return the parsed JSON dict, or None on failure."""
        if not self.ai_client:
            return None

        try:
            document_part = types.Part.from_bytes(
                data=file_content,
                mime_type=file_type,
            )
            response = self.ai_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[document_part, _EXTRACTION_PROMPT],
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                ),
            )
            import json
            return json.loads(response.text)
        except Exception as exc:
            logger.error("MRH AI extraction failed: %s", exc, exc_info=True)
            return None

    async def verify(
        self,
        file_content: bytes,
        file_type: str,
        expected_name: str,
        expected_address: str,
    ) -> dict:
        """
        Full verification pipeline: extract → check → return result dict.

        If extraction fails, returns a hard reject with flags=["extraction_failed"].
        """
        extracted = await self._extract(file_content, file_type)

        if extracted is None:
            return {
                "verified": False,
                "status": "rejected",
                "mrh_assurance": "MEDIUM",
                "mrh_insurer_fr": None,
                "mrh_cert_type": "unknown",
                "mrh_cover_start": None,
                "mrh_cover_end": None,
                "flags": ["extraction_failed"],
                "rejection_reason": (
                    "Could not extract data from document — check file quality"
                ),
            }

        return check_mrh_extraction(extracted, expected_name, expected_address)


# Singleton
mrh_insurance_service = MrhInsuranceService()
