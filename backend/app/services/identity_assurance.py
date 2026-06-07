"""
Identity assurance labelling for the OCR+selfie (MEDIUM) rail.

Single source of truth for:
- the label stamped onto an OCR+selfie verification, and
- the inference-on-read rule for users verified before labelling existed.

See DOSSIER §5.2 (AS-1 / AS-4) and
docs/superpowers/specs/2026-06-06-fr-identity-medium-rail-design.md.
The OCR+selfie path is MEDIUM by definition (OSS liveness is not forgery-proof)
and is NEVER presented as HIGH. "ocr_liveness" is already a MEDIUM-only source
in app/services/credential.py.
"""

# Stamped into identity_data when an OCR+selfie verification succeeds.
OCR_LIVENESS_LABEL = {
    "identity_assurance": "MEDIUM",
    "identity_source": "ocr_liveness",
}

_VALID_BANDS = ("HIGH", "MEDIUM", "UNVERIFIED")


def derive_identity_assurance(identity_verified: bool, identity_data: dict | None) -> str:
    """
    Report the assurance band for a user's identity.

    - Explicit valid label present in identity_data -> use it.
    - Verified but unlabelled (legacy) -> MEDIUM (every existing verification is OCR+selfie).
    - Otherwise -> UNVERIFIED.
    """
    data = identity_data or {}
    label = data.get("identity_assurance")
    if label in _VALID_BANDS:
        return label
    if identity_verified:
        return "MEDIUM"
    return "UNVERIFIED"
