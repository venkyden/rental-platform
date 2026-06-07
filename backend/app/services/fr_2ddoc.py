"""
Avis d'imposition 2D-Doc pipeline: decode -> parse -> ANTS ECDSA verify -> names.

Corroborates the OCR'd identity name against the DGFiP-signed payload
(sub-feature #3 — assurance stays MEDIUM; the avis has no presenter binding).
Sub-feature #4 will reuse parse_and_verify_avis() for the banded solvency ratio.

No source document is stored. Verification is fully offline against the ANTS
Trusted Service List bundled in betagouv/2ddoc-parser.
See docs/superpowers/specs/2026-06-06-fr-identity-medium-rail-design.md §5.
"""
import io
import logging
import unicodedata
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# 2D-Doc document types for avis d'imposition.
# Type 28: current format. Type 04: legacy format (same declarant field names).
AVIS_TYPE_IDS = {"28", "04"}
_MATCH_THRESHOLD = 0.5       # Jaccard over normalized name tokens


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
class AvisIdentity:
    declarant_names: list[str]   # declarant_1 (+ declarant_2 if a couple)


# ── name matching ─────────────────────────────────────────────────────────────

def _normalize(name: str) -> set[str]:
    norm = "".join(
        c for c in unicodedata.normalize("NFD", (name or "").lower())
        if unicodedata.category(c) != "Mn"
    )
    return {t for t in norm.replace("-", " ").split() if t}


def name_matches_any(id_name: str, candidate_names: list[str], threshold: float = _MATCH_THRESHOLD) -> bool:
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

def parse_and_verify_avis(raw: str) -> AvisIdentity:
    """
    Parse a raw 2D-Doc string, verify the ANTS signature, require avis
    (type 28 or 04), and return the declarant name(s) from the SIGNED payload.

    The api.decode_2d_doc() function from fr_2ddoc_parser:
      - Raises fr_2ddoc_parser.exception.exceptions.TwoDDocFormatError on
        malformed/unparseable strings.
      - Calls verify() internally: sets doc.is_valid=True on good sig,
        False on bad sig (does not raise on bad signature).
      - Populates doc.typed (AvisImposition) and doc.header.doc_type.
    Declarant attributes: typed.declarant_1 (str), typed.declarant_2 (Optional[str]).
    """
    import warnings
    from fr_2ddoc_parser.api import decode_2d_doc
    from fr_2ddoc_parser.exception.exceptions import TwoDDocError as LibTwoDDocError

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
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
    return AvisIdentity(declarant_names=names)
