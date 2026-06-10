"""
DPE décence-énergétique compliance (loi Climat) + class-accuracy assessment.

Pure and side-effect-free (mirrors french_compliance.py). Produces facts only;
the caller (publish endpoint) decides what to block on.

Legal basis:
  - Art. L126-33 CCH: the DPE class must appear in the rental ad (incl. digital
    platforms); the platform must therefore display a class, and it must be accurate.
  - Décence énergétique (loi Climat, via Art. 6 loi 89): a dwelling below the class
    in force may not be the object of a NEW or RENEWED lease. The prohibition bites at
    lease formation, not at advertising — so this module flags it for acknowledgment
    rather than blocking. Calendar: min class F from 2025-01-01, E from 2028-01-01,
    D from 2034-01-01.
  - The Jan 2026 ADEME coefficient reform reclassified ~850k units, so a self-typed
    class is unreliable — an ADEME-verified (HIGH) class wins when present.
"""
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

_VALID = "ABCDEFG"
_RANK = {c: i for i, c in enumerate(_VALID, start=1)}  # A=1 (best) .. G=7 (worst)

# (effective_date, minimum allowed class in force from that date)
_DECENCE_CALENDAR = [
    (date(2025, 1, 1), "F"),
    (date(2028, 1, 1), "E"),
    (date(2034, 1, 1), "D"),
]


@dataclass
class DPEWarning:
    code: str         # DECENCE_PROHIBITED | DECENCE_UPCOMING | DPE_EXPIRED | SELF_DECLARED_UNVERIFIED
    severity: str     # "error" (requires ack) | "info"
    en: str
    fr: str


@dataclass
class DPEAssessment:
    authoritative_class: Optional[str]
    class_source: str                 # "ademe_verified" | "self_declared" | "none"
    expired: bool
    requires_acknowledgment: bool
    warnings: list = field(default_factory=list)


def _clean(cls: Optional[str]) -> Optional[str]:
    c = (cls or "").upper().strip()
    return c if c in _VALID else None


def _min_class_in_force(today: date) -> Optional[str]:
    minc = None
    for eff, mc in _DECENCE_CALENDAR:
        if today >= eff:
            minc = mc
    return minc


def _upcoming_prohibition_date(cls: str, today: date) -> Optional[date]:
    for eff, mc in _DECENCE_CALENDAR:
        if eff > today and _RANK[cls] > _RANK[mc]:
            return eff
    return None


def assess_dpe(
    self_typed_class: Optional[str],
    ademe_class: Optional[str],
    assurance: Optional[str],
    expired: Optional[bool],
    today: date,
) -> DPEAssessment:
    """Resolve the authoritative DPE class and produce décence/accuracy warnings."""
    ademe = _clean(ademe_class)
    typed = _clean(self_typed_class)

    if assurance == "HIGH" and ademe:
        authoritative, source = ademe, "ademe_verified"
    elif typed:
        authoritative, source = typed, "self_declared"
    else:
        authoritative, source = None, "none"

    expired = bool(expired)
    warnings: list = []

    if authoritative:
        min_in_force = _min_class_in_force(today)
        prohibited_now = min_in_force is not None and _RANK[authoritative] > _RANK[min_in_force]
        if prohibited_now:
            warnings.append(DPEWarning(
                code="DECENCE_PROHIBITED",
                severity="error",
                en=(f"This dwelling is class {authoritative}. Since it is below the "
                    f"minimum energy class required for rental, it cannot be the object "
                    f"of a new or renewed lease as a primary residence (décence "
                    f"énergétique, loi Climat). The listing may still be published with "
                    f"its true class displayed."),
                fr=(f"Ce logement est classé {authoritative}. Étant sous la classe "
                    f"minimale exigée pour la location, il ne peut faire l'objet d'un "
                    f"nouveau bail ou d'un renouvellement en résidence principale "
                    f"(décence énergétique, loi Climat). L'annonce reste publiable avec "
                    f"sa classe réelle affichée."),
            ))
        else:
            upcoming = _upcoming_prohibition_date(authoritative, today)
            if upcoming:
                warnings.append(DPEWarning(
                    code="DECENCE_UPCOMING",
                    severity="info",
                    en=(f"Class {authoritative} dwellings become prohibited for new "
                        f"leases from {upcoming.isoformat()} (décence énergétique)."),
                    fr=(f"Les logements classés {authoritative} seront interdits à la "
                        f"location à compter du {upcoming.isoformat()} (décence "
                        f"énergétique)."),
                ))

    if expired:
        warnings.append(DPEWarning(
            code="DPE_EXPIRED",
            severity="error",
            en=("This DPE has expired or uses the pre-July-2021 methodology; a valid "
                "DPE is required for a new lease."),
            fr=("Ce DPE est expiré ou utilise l'ancienne méthode (avant juillet 2021) ; "
                "un DPE valide est requis pour un nouveau bail."),
        ))

    if source == "self_declared":
        warnings.append(DPEWarning(
            code="SELF_DECLARED_UNVERIFIED",
            severity="info",
            en=("This DPE class was declared by the owner and not verified against "
                "ADEME; it may be affected by the Jan 2026 reclassification."),
            fr=("Cette classe DPE est déclarée par le propriétaire et non vérifiée "
                "auprès de l'ADEME ; elle peut être concernée par la reclassification "
                "de janvier 2026."),
        ))

    requires_ack = any(w.severity == "error" for w in warnings)

    return DPEAssessment(
        authoritative_class=authoritative,
        class_source=source,
        expired=expired,
        requires_acknowledgment=requires_ack,
        warnings=warnings,
    )
