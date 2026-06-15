"""
MRZ (Machine Readable Zone) extraction and validation for INTL identity rail.

Primary: Gemini AI extracts raw TD3 MRZ lines.
Fallback: pytesseract with MRZ-specific PSM if AI lines empty or checksums fail.
Both fail: mrz_valid=False, rescan_required=True — endpoint returns 422.

assurance is always "MEDIUM" — web path cannot do NFC Passive Auth (ID-5, ID-7).
nationality: extracted internally for checksum only, never stored or emitted (GDPR art. 9).
"""
import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types as genai_types
    _GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    genai_types = None
    _GEMINI_AVAILABLE = False

try:
    import pytesseract
    from PIL import Image
    import io as _io
    _TESSERACT_AVAILABLE = True
except ImportError:
    pytesseract = None
    _TESSERACT_AVAILABLE = False


@dataclass
class MRZResult:
    surname: str
    given_names: str
    doc_number: str
    dob: str            # YYMMDD
    expiry: str         # YYMMDD
    mrz_valid: bool
    rescan_required: bool
    assurance: str      # always "MEDIUM" — enforced by extract_mrz, never "HIGH"
    extraction_path: str  # "ai" | "tesseract" | "ai+tesseract" | "failed"
    # nationality: intentionally absent — never stored (GDPR art. 9)


_CHAR_VALUES: dict[str, int] = {str(i): i for i in range(10)}
_CHAR_VALUES.update({chr(ord("A") + i): 10 + i for i in range(26)})
_CHAR_VALUES["<"] = 0
_WEIGHTS = [7, 3, 1]


def _check_digit(s: str) -> str:
    """Compute ICAO mod-10 check digit for a field string."""
    total = sum(_CHAR_VALUES.get(c, 0) * _WEIGHTS[i % 3] for i, c in enumerate(s))
    return str(total % 10)


def _validate_checksums(line2: str) -> bool:
    """
    Validate all 4 ICAO TD3 check digits in line 2 (44 chars).
    Returns True only if all four pass.
    """
    if len(line2) < 44:
        return False
    checks = [
        (line2[0:9],                  line2[9]),   # document number
        (line2[13:19],                line2[19]),  # date of birth
        (line2[21:27],                line2[27]),  # expiry date
        (line2[0:10] + line2[13:43],  line2[43]),  # composite
    ]
    return all(_check_digit(field) == check for field, check in checks)


def _parse_td3_line2(line2: str) -> dict:
    """Extract non-sensitive fields from a validated TD3 line 2."""
    return {
        "doc_number": line2[0:9].rstrip("<"),
        # line2[10:13] is nationality — read internally but not returned
        "dob": line2[13:19],
        "expiry": line2[21:27],
    }


def _parse_td3_line1(line1: str) -> tuple[str, str]:
    """Extract surname and given names from TD3 line 1."""
    if len(line1) < 44:
        return "", ""
    name_part = line1[5:44]  # skip P, sub-type (1), country code (3)
    parts = name_part.split("<<", 1)
    surname = parts[0].replace("<", " ").strip()
    given_names = parts[1].replace("<", " ").strip() if len(parts) > 1 else ""
    return surname, given_names


def _tesseract_extract(image_bytes: bytes) -> tuple[str, str]:
    """Run Tesseract with MRZ-optimised config. Returns (line1, line2) or ('', '')."""
    if not _TESSERACT_AVAILABLE:
        return "", ""
    try:
        img = Image.open(_io.BytesIO(image_bytes))
        cfg = (
            "--psm 6 --oem 1 "
            "-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"
        )
        raw = pytesseract.image_to_string(img, config=cfg)
        candidates = re.findall(r"[A-Z0-9<]{44}", raw.replace(" ", "").replace("\n", ""))
        if len(candidates) >= 2:
            return candidates[-2], candidates[-1]
    except Exception as exc:
        logger.warning("Tesseract MRZ extraction failed: %s", exc)
    return "", ""


async def _ai_extract_mrz(image_bytes: bytes, content_type: str, ai_client=None) -> dict:
    """Ask Gemini to return raw TD3 MRZ line1 and line2 strings."""
    if not _GEMINI_AVAILABLE:
        return {"mrz_line1": "", "mrz_line2": ""}

    prompt = (
        "You are a passport MRZ extraction system. Extract the two machine-readable zone "
        "lines from this passport bio page.\n\n"
        "Return ONLY this JSON — no markdown, no extra text:\n"
        '{"mrz_line1": "<44-char string or empty>", "mrz_line2": "<44-char string or empty>"}\n\n'
        "Rules:\n"
        "- MRZ lines contain only uppercase A-Z, digits 0-9, and < filler characters\n"
        "- Each TD3 line is exactly 44 characters — copy exactly, do not correct\n"
        "- If no MRZ is visible, return empty strings"
    )

    from app.core.config import settings
    client = ai_client
    if client is None and _GEMINI_AVAILABLE and getattr(settings, "GEMINI_API_KEY", None):
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
    if client is None:
        return {"mrz_line1": "", "mrz_line2": ""}

    image_part = genai_types.Part.from_bytes(data=image_bytes, mime_type=content_type)
    for model in ("gemini-2.0-flash", "gemini-1.5-flash"):
        try:
            response = client.models.generate_content(
                model=model,
                contents=[image_part, prompt],
            )
            import json
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1].lstrip("json").strip()
            return json.loads(text)
        except Exception as exc:
            logger.warning("AI MRZ extraction (%s) failed: %s", model, exc)
    return {"mrz_line1": "", "mrz_line2": ""}


_FAILED_RESULT = MRZResult(
    surname="", given_names="", doc_number="", dob="", expiry="",
    mrz_valid=False, rescan_required=True, assurance="MEDIUM",
    extraction_path="failed",
)


async def extract_mrz(image_bytes: bytes, content_type: str, ai_client=None) -> MRZResult:
    """
    Extract and validate MRZ from a passport image.

    Pass 1 — AI (Gemini): extract raw lines → validate checksums.
    Pass 2 — Tesseract: triggered if AI lines empty or any checksum fails.
    Both fail → mrz_valid=False, rescan_required=True.

    assurance is always "MEDIUM" — no code path emits HIGH (ID-5, ID-7).
    nationality is used for checksum computation only, never returned (GDPR art. 9).
    """
    # ── Pass 1: AI ──────────────────────────────────────────────────────────
    ai_data = await _ai_extract_mrz(image_bytes, content_type, ai_client)
    line1_ai = ai_data.get("mrz_line1") or ""
    line2_ai = ai_data.get("mrz_line2") or ""

    if len(line2_ai) == 44 and _validate_checksums(line2_ai):
        fields = _parse_td3_line2(line2_ai)
        surname, given_names = _parse_td3_line1(line1_ai)
        return MRZResult(
            surname=surname, given_names=given_names,
            doc_number=fields["doc_number"],
            dob=fields["dob"], expiry=fields["expiry"],
            mrz_valid=True, rescan_required=False,
            assurance="MEDIUM", extraction_path="ai",
        )

    # ── Pass 2: Tesseract ───────────────────────────────────────────────────
    line1_t, line2_t = _tesseract_extract(image_bytes)
    path = "ai+tesseract" if line2_ai else "tesseract"

    if len(line2_t) == 44 and _validate_checksums(line2_t):
        fields = _parse_td3_line2(line2_t)
        surname, given_names = _parse_td3_line1(line1_t)
        return MRZResult(
            surname=surname, given_names=given_names,
            doc_number=fields["doc_number"],
            dob=fields["dob"], expiry=fields["expiry"],
            mrz_valid=True, rescan_required=False,
            assurance="MEDIUM", extraction_path=path,
        )

    # ── Both failed ─────────────────────────────────────────────────────────
    logger.warning("MRZ extraction failed for both AI and Tesseract")
    return _FAILED_RESULT
