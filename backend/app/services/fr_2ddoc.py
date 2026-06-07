"""
Avis d'imposition 2D-Doc pipeline: decode -> parse -> ANTS ECDSA verify -> solvency.

Used by:
  - Sub-feature #3 (identity cross-check): name match, assurance stays MEDIUM.
  - Sub-feature #4 (FR HIGH solvency): RFR from signed payload -> banded ratio.

No source document is stored. Verification is fully offline against the ANTS
Trusted Service List bundled in betagouv/2ddoc-parser.
See docs/superpowers/specs/2026-06-06-fr-identity-medium-rail-design.md §5.
"""
import io
import logging
import unicodedata
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# 2D-Doc document types for avis d'imposition.
# Type 28: current format. Type 04: legacy format (same declarant field names).
AVIS_TYPE_IDS = {"28", "04"}
_MATCH_THRESHOLD = 0.5       # Jaccard over normalized name tokens

# Recency window: flag if RFR year is more than 2 years before current year.
_RECENCY_YEARS = 2


# ── errors ──────────────────────────────────────────────────────────────────

class TwoDDocError(Exception):
    """Base error for the avis 2D-Doc pipeline."""


class BarcodeUnreadable(TwoDDocError):
    """No DataMatrix barcode could be decoded from the upload."""


class SignatureInvalid(TwoDDocError):
    """The 2D-Doc ANTS ECDSA signature failed verification (forgery or too-new cert)."""


class WrongDocumentType(TwoDDocError):
    """The 2D-Doc is valid but not an avis d'imposition (types 28 or 04)."""


@dataclass
class AvisParsed:
    """All fields extracted from the SIGNED avis 2D-Doc payload.

    revenu_fiscal_de_reference: RFR in euros, or None if absent in payload.
    annee_des_revenus: fiscal year of the income (not the current year).
    nombre_de_parts: household fiscal parts (Decimal as str to avoid float).
    declarant_names: [declarant_1, declarant_2?] for name matching.
    reference_avis: avis reference number (for logging/audit only; never stored).
    """
    declarant_names: list
    revenu_fiscal_de_reference: Optional[int] = None
    annee_des_revenus: int = 0
    nombre_de_parts: str = "0"
    reference_avis: str = ""


# Backward-compat alias — existing tests use svc.AvisIdentity(declarant_names=...).
AvisIdentity = AvisParsed


# ── name matching ─────────────────────────────────────────────────────────────

def _normalize(name: str) -> set:
    norm = "".join(
        c for c in unicodedata.normalize("NFD", (name or "").lower())
        if unicodedata.category(c) != "Mn"
    )
    return {t for t in norm.replace("-", " ").split() if t}


def name_matches_any(id_name: str, candidate_names: list, threshold: float = _MATCH_THRESHOLD) -> bool:
    """True if id_name token-overlaps any candidate at/above the threshold (accent/order tolerant)."""
    a = _normalize(id_name)
    if not a:
        return False
    for cand in candidate_names:
        b = _normalize(cand)
        if not b:
            continue
        if len(a & b) / len(a | b) >= threshold:
            return True
    return False


# ── solvency banding ─────────────────────────────────────────────────────────

# Bands: consistent with DOSSIER §2 credential schema and SV-7 honesty rule.
# Banded strings match what credential_service.issue() expects (starts with >=/<).
_SOLVENCY_BANDS = [
    (3.0, ">=3.0"),
    (2.5, ">=2.5"),
    (2.0, ">=2.0"),
]


def band_solvency_ratio(rfr: int, monthly_rent_euros: int) -> str:
    """
    Band the fiscal solvency ratio (RFR / annual gross rent) into a credential-safe string.

    Standard FR rental rule: RFR >= 3 × annual gross rent → ">=3.0".
    Never returns the raw RFR or raw ratio. Monthly rent is the caller's input;
    we compute annual internally and discard it. DOSSIER SV-7: honest, never rounded up.
    """
    if monthly_rent_euros <= 0:
        raise ValueError("monthly_rent_euros must be positive")
    annual_rent = monthly_rent_euros * 12
    ratio = rfr / annual_rent
    for threshold, label in _SOLVENCY_BANDS:
        if ratio >= threshold:
            return label
    return "<2.0"


def is_avis_stale(annee_des_revenus: int, current_year: Optional[int] = None) -> bool:
    """True if the avis income year is more than _RECENCY_YEARS before current_year."""
    if current_year is None:
        from datetime import datetime
        current_year = datetime.utcnow().year
    return (current_year - annee_des_revenus) > _RECENCY_YEARS


# ── decode ────────────────────────────────────────────────────────────────────

def _to_images(file_content: bytes, content_type: str) -> list:
    """Return a list of PIL images for the upload (rasterize PDF pages, else one image)."""
    from PIL import Image
    if content_type == "application/pdf":
        import fitz  # PyMuPDF
        images = []
        with fitz.open(stream=file_content, filetype="pdf") as pdf:
            for page in pdf:
                pix = page.get_pixmap(dpi=300)
                images.append(Image.open(io.BytesIO(pix.tobytes("png"))))
        return images
    return [Image.open(io.BytesIO(file_content))]


def decode_2ddoc(file_content: bytes, content_type: str) -> str:
    """Decode the first DataMatrix 2D-Doc barcode found in the upload to its raw string."""
    from pylibdmtx.pylibdmtx import decode as dmtx_decode
    for img in _to_images(file_content, content_type):
        results = dmtx_decode(img)
        if results:
            return results[0].data.decode("ascii", errors="replace")
    raise BarcodeUnreadable("No 2D-Doc DataMatrix barcode found in the document")


# ── parse + verify ─────────────────────────────────────────────────────────────

def parse_and_verify_avis(raw: str) -> AvisParsed:
    """
    Parse a raw 2D-Doc string, verify the ANTS signature, require avis
    (type 28 or 04), and return all fields from the SIGNED payload.

    The api.decode_2d_doc() function from fr_2ddoc_parser:
      - Raises fr_2ddoc_parser.exception.exceptions.TwoDDocFormatError on
        malformed/unparseable strings.
      - Calls verify() internally: sets doc.is_valid=True on good sig,
        False on bad sig (does not raise on bad signature).
      - Populates doc.typed (AvisImposition/AvisImpositionV1) and doc.header.doc_type.
    Declarant attributes: typed.declarant_1 (str), typed.declarant_2 (Optional[str]).
    RFR attribute: typed.revenu_fiscal_de_reference (Optional[int], euros).
    """
    import warnings
    from fr_2ddoc_parser.api import decode_2d_doc
    from fr_2ddoc_parser.exception.exceptions import TwoDDocError as LibTwoDDocError

    try:
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=UserWarning, module="fr_2ddoc_parser")
            doc = decode_2d_doc(raw)
    except LibTwoDDocError as exc:
        logger.info("2D-Doc parse/format error: %s", exc)
        raise SignatureInvalid(str(exc)) from exc
    except Exception as exc:
        logger.info("2D-Doc unexpected parse error: %s", exc)
        raise SignatureInvalid(str(exc)) from exc

    if not doc.is_valid:
        raise SignatureInvalid("2D-Doc signature verification failed")

    type_id = str(doc.header.doc_type)
    if type_id not in AVIS_TYPE_IDS:
        raise WrongDocumentType(f"2D-Doc type {type_id!r} is not an avis d'imposition")

    typed = doc.typed
    if typed is None:
        raise WrongDocumentType("avis 2D-Doc contained no typed payload")

    names = []
    d1 = getattr(typed, "declarant_1", None)
    if d1:
        names.append(str(d1).strip())
    d2 = getattr(typed, "declarant_2", None)
    if d2:
        names.append(str(d2).strip())
    if not names:
        raise WrongDocumentType("avis 2D-Doc contained no declarant name")

    rfr = getattr(typed, "revenu_fiscal_de_reference", None)
    annee = getattr(typed, "annee_des_revenus", 0) or 0
    parts = getattr(typed, "nombre_de_parts", None)
    ref = getattr(typed, "reference_avis", "") or ""

    return AvisParsed(
        declarant_names=names,
        revenu_fiscal_de_reference=rfr,
        annee_des_revenus=int(annee),
        nombre_de_parts=str(parts) if parts is not None else "0",
        reference_avis=str(ref).strip(),
    )
