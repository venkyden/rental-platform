"""
Pure, side-effect-free guarantor certificate assessment.
No DB access, no I/O — fully unit-testable.
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass
class GuarantorCertData:
    cert_id: Optional[str]
    guaranteed_amount: Optional[float]
    validity_date: Optional[date]
    tenant_name: Optional[str]
    institution: Optional[str]


@dataclass
class GuarantorWarning:
    code: str      # CERT_EXPIRED | NAME_MISMATCH | AMOUNT_NOT_EXTRACTED | CERT_ID_NOT_EXTRACTED
    severity: str  # "error" | "info"
    en: str
    fr: str


@dataclass
class GuarantorAssessment:
    cert_ref: Optional[str]
    guaranteed_amount: Optional[float]
    validity_date: Optional[date]
    assurance: str   # "MEDIUM" (OCR-verified) for Visale/Garantme
    name_matched: bool
    name_match_score: float
    expired: bool
    warnings: list[GuarantorWarning] = field(default_factory=list)


def _name_similarity(a: Optional[str], b: Optional[str]) -> float:
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(
        None,
        a.strip().lower(),
        b.strip().lower(),
    ).ratio()


def assess_guarantor_cert(
    cert_type: str,              # "visale" | "garantme"
    cert_data: GuarantorCertData,
    expected_name: str,
    today: date,
) -> GuarantorAssessment:
    warnings: list[GuarantorWarning] = []

    # Expiry check
    expired = (
        cert_data.validity_date is not None
        and cert_data.validity_date < today
    )
    if expired:
        warnings.append(GuarantorWarning(
            code="CERT_EXPIRED",
            severity="error",
            en=f"This {cert_type.capitalize()} certificate expired on "
               f"{cert_data.validity_date.isoformat()}. Please obtain a current certificate.",
            fr=f"Ce certificat {cert_type.capitalize()} a expiré le "
               f"{cert_data.validity_date.isoformat()}. Veuillez obtenir un certificat valide.",
        ))

    # Name cross-check
    score = _name_similarity(cert_data.tenant_name, expected_name)
    name_matched = score >= 0.5
    if not name_matched:
        warnings.append(GuarantorWarning(
            code="NAME_MISMATCH",
            severity="error",
            en="The name on the certificate does not match your account name. "
               "Please upload the certificate issued for your name.",
            fr="Le nom figurant sur le certificat ne correspond pas au nom de votre compte. "
               "Veuillez téléverser le certificat établi à votre nom.",
        ))

    # Missing cert ID
    if not cert_data.cert_id:
        warnings.append(GuarantorWarning(
            code="CERT_ID_NOT_EXTRACTED",
            severity="info",
            en="The certificate number could not be read automatically. "
               "Your landlord can verify it from the uploaded document.",
            fr="Le numéro de certificat n'a pas pu être lu automatiquement. "
               "Votre propriétaire pourra le vérifier sur le document téléversé.",
        ))

    # Missing guaranteed amount
    if cert_data.guaranteed_amount is None:
        warnings.append(GuarantorWarning(
            code="AMOUNT_NOT_EXTRACTED",
            severity="info",
            en="The guaranteed amount could not be read automatically.",
            fr="Le montant garanti n'a pas pu être lu automatiquement.",
        ))

    return GuarantorAssessment(
        cert_ref=cert_data.cert_id,
        guaranteed_amount=cert_data.guaranteed_amount,
        validity_date=cert_data.validity_date,
        assurance="MEDIUM",
        name_matched=name_matched,
        name_match_score=round(score, 3),
        expired=expired,
        warnings=warnings,
    )
