"""
Lease legality red-line screen (DOSSIER §5.6) — uploaded-lease Path B.

A **deterministic, heuristic** screen over the uploaded lease text. It assigns one of
two acceptance tiers (DOSSIER §5.6):

- **VALIDATED** — passed every red-line check below.
- **ATTACHED / NOT LEGALITY-VERIFIED** — any check failed/uncertain, OR no text layer.

It is a *screen*, not legal advice, and **never hard-blocks** signing (LU-6: the landlord
may proceed; the flags are recorded as shown-and-overridden). False-negatives (under-
flagging) are preferred to wrongly downgrading — ATTACHED is the safe default anyway.

Sources: loi n°89-462 du 6 juillet 1989 (art. 3-3 annexes, art. 4 clauses réputées non
écrites, art. 22 dépôt de garantie); décret n°2015-1437 (notice d'information). All
patterns are matched against fixed, hardcoded legal phrasing — never against DB/user
strings — so there is no ReDoS / injection surface.

AI extraction (Gemini) for amounts/clauses is a future enhancement; v1 is rule-based so
it is testable offline and does not over-claim.
"""

import re
import logging
import unicodedata
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

VALIDATED = "VALIDATED"
ATTACHED = "ATTACHED_NOT_LEGALITY_VERIFIED"

# Minimum extracted characters to consider the PDF to have a real text layer (LU-1).
_MIN_TEXT_CHARS = 200


class LegalityExtractError(Exception):
    """The PDF text could not be extracted (missing extractor or unreadable file).
    Distinct from a genuine 'no text layer' so we don't record a false 'scanned' verdict."""


@dataclass
class LegalityResult:
    status: str                       # VALIDATED | ATTACHED
    flags: list[str] = field(default_factory=list)   # machine codes (LU-*)
    notes: list[str] = field(default_factory=list)   # human-readable FR notes

    def as_dict(self) -> dict:
        return {"status": self.status, "flags": self.flags, "notes": self.notes}


def _normalise(text: str) -> str:
    """Lowercase + strip accents so patterns match regardless of accentuation."""
    stripped = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in stripped if not unicodedata.combining(c))
    return stripped.lower()


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """
    Extract the embedded text layer (no OCR). Returns "" only when the PDF genuinely
    has no/empty text layer. A missing extractor or an unreadable/corrupt file raises
    LegalityExtractError — so the caller records an honest "could not analyse" flag
    instead of a false "scanned document" verdict, and a prod misconfig is loud.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        logger.error("PyMuPDF (fitz) unavailable — lease legality screen cannot run")
        raise LegalityExtractError("extractor_unavailable") from exc
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            return "\n".join(page.get_text() for page in doc)
    except Exception as exc:
        logger.exception("Lease PDF text extraction failed")
        raise LegalityExtractError("parse_failed") from exc


# ── French-law anchor (LU-5) ─────────────────────────────────────────────────
# A genuine French residential lease references loi 89 and/or core bail vocabulary.
_FR_ANCHORS = (
    "loi du 6 juillet 1989",
    "loi n 89-462",
    "89-462",
    "bailleur",
    "locataire",
    "depot de garantie",
)

# Explicit foreign governing-law signals → never VALIDATED (LU-5).
_FOREIGN_LAW = (
    "governing law",
    "submitted to the laws of",
)
# Whitespace-tolerant FR phrasing: real PDFs extract "Loi applicable: droit anglais",
# "régi par le droit belge", etc. with arbitrary spacing/newlines (substring matching
# on the fixed literal silently missed these).
_FOREIGN_LAW_RE = re.compile(
    r"(loi applicable\s*:?\s*droit|regi par le droit)\s+"
    r"(anglais|belge|suisse|luxembourgeois|allemand|espagnol|italien|etranger)"
)

# ── Mandatory annexes (LU-4) — loi 89 art. 3-3 + décret 2015-1437 ────────────
# code → (human note, accepted phrasings)
_MANDATORY_ANNEXES = {
    "dpe": ("Diagnostic de performance énergétique (DPE) absent ou non référencé",
            ("diagnostic de performance energetique", "dpe")),
    "erp": ("État des risques (ERP) absent ou non référencé",
            ("etat des risques", "erp", "ernmt", "errial")),
    "notice": ("Notice d'information (décret 2015-1437) absente ou non référencée",
               ("notice d information", "notice d'information")),
}

# ── Clauses réputées non écrites (LU-2) — loi 89 art. 4 ──────────────────────
# Conservative, high-precision phrasings. code → (art.4 letter + human note, pattern).
# Patterns are fixed legal phrasing (never DB/user input) → no ReDoS/injection surface.
# Several entries below are drawn from real-world leases seen in the wild.
_PROHIBITED_CLAUSES = {
    "art4_salaire": ("art. 4 c) — prélèvement automatique sur salaire interdit",
                     "prelevement automatique sur (le )?salaire"),
    "art4_penalite": ("art. 4 g) — pénalité/amende en cas d'infraction au règlement interdite",
                      "(penalite|amende) en cas d infraction"),
    "art4_clause_penale": ("art. 4 g) — clause pénale / majoration forfaitaire interdite",
                           "clauses? penales?"),
    "art4_astreinte": ("art. 4 g) — astreinte journalière de retard interdite",
                       "astreinte par jour"),
    "art4_renonciation": ("art. 4 l) — renonciation du locataire à ses droits interdite",
                          "le locataire renonce a (tout|son|ses)"),
    "art4_renonciation_maintien": ("art. 4 — renonciation au maintien dans les lieux interdite",
                                   "renonc(e|iation) a tout maintien dans les lieux"),
    "art4_quittance": ("art. 4 e) — frais de délivrance de quittance à la charge du locataire interdits",
                       "frais (de|d envoi|d edition) (de )?quittance"),
}

# LU-5 — a residential lease that opts OUT of the protective loi 89 regime. Largely
# ineffective for a principal residence (the protections are public-order), so its
# penalty / no-maintien clauses are typically réputées non écrites. Strong red flag.
# `d['’ ]application` tolerates the apostrophe (straight or curly) and the space form,
# since `_normalise` does not collapse apostrophes.
_EXCLUDES_LOI_89_RE = re.compile(
    r"(sorti|exclu)(e|es|s)? du champ d['’ ]application de la loi|"
    r"hors du champ d['’ ]application de la loi"
)

# LU-2 — clause résolutoire delay possibly outdated: the loi du 27 juillet 2023 reduced
# the commandement-de-payer delay from two months to **six weeks** for unpaid rent.
_STALE_COMMANDEMENT_RE = re.compile(r"deux mois (apres|suivant)?\s*(un )?commandement")


def screen_lease_text(text: str) -> LegalityResult:
    """Run the deterministic red-line checks; return the tier + flags."""
    if not text or len(text.strip()) < _MIN_TEXT_CHARS:
        return LegalityResult(
            status=ATTACHED,
            flags=["LU1_no_text_layer"],
            notes=["Document scanné sans couche de texte — vérification de légalité impossible."],
        )

    norm = _normalise(text)
    flags: list[str] = []
    notes: list[str] = []

    # LU-5 — French-law lease?
    if not any(anchor in norm for anchor in _FR_ANCHORS):
        flags.append("LU5_not_french_law")
        notes.append("Le document ne référence pas le droit locatif français (loi du 6 juillet 1989).")
    if any(sig in norm for sig in _FOREIGN_LAW) or _FOREIGN_LAW_RE.search(norm):
        flags.append("LU5_foreign_governing_law")
        notes.append("Une clause de droit applicable étranger a été détectée.")

    # LU-5 — opts out of loi 89 (only meaningful if it actually references loi 89).
    if _EXCLUDES_LOI_89_RE.search(norm) and ("89-462" in norm or "6 juillet 1989" in norm):
        flags.append("LU5_excludes_loi_89")
        notes.append("Le bail se déclare exclu du champ d'application de la loi du 6 juillet 1989 — "
                     "régime protecteur potentiellement écarté à tort pour une résidence principale.")

    # LU-2 — clauses réputées non écrites (art. 4)
    for code, (note, pattern) in _PROHIBITED_CLAUSES.items():
        if re.search(pattern, norm):
            flags.append(f"LU2_{code}")
            notes.append(f"Clause possiblement réputée non écrite — {note}.")

    # LU-2 — possibly outdated commandement-de-payer delay (loi 2023 → six semaines).
    if _STALE_COMMANDEMENT_RE.search(norm):
        flags.append("LU2_stale_commandement_delay")
        notes.append("Délai de commandement de payer de deux mois possiblement obsolète "
                     "(depuis la loi du 27 juillet 2023, le délai est de six semaines).")

    # LU-4 — mandatory annexes referenced
    for code, (note, phrasings) in _MANDATORY_ANNEXES.items():
        if not any(p in norm for p in phrasings):
            flags.append(f"LU4_missing_{code}")
            notes.append(note + ".")

    status = VALIDATED if not flags else ATTACHED
    return LegalityResult(status=status, flags=flags, notes=notes)


def screen_lease_pdf(pdf_bytes: bytes) -> LegalityResult:
    """
    Extract the text layer then screen it. An extraction failure (corrupt file or
    missing extractor) yields ATTACHED with an honest `LU1_extract_failed` flag —
    never a false "scanned document" verdict, and never VALIDATED.
    """
    try:
        text = extract_pdf_text(pdf_bytes)
    except LegalityExtractError:
        return LegalityResult(
            status=ATTACHED,
            flags=["LU1_extract_failed"],
            notes=["Le contenu du document n'a pas pu être analysé (fichier illisible ou corrompu)."],
        )
    return screen_lease_text(text)
