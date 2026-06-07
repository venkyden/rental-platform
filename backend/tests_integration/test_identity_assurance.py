"""
FR identity MEDIUM rail — assurance labelling (DOSSIER §5.2: AS-1, AS-4).
"""
import pytest
from app.services.identity_assurance import (
    OCR_LIVENESS_LABEL,
    derive_identity_assurance,
)


def test_label_is_medium_ocr_liveness():
    assert OCR_LIVENESS_LABEL == {
        "identity_assurance": "MEDIUM",
        "identity_source": "ocr_liveness",
    }


def test_explicit_label_is_returned():
    data = {"identity_assurance": "MEDIUM", "identity_source": "ocr_liveness"}
    assert derive_identity_assurance(True, data) == "MEDIUM"


def test_verified_but_unlabelled_infers_medium():
    # Legacy user verified before labelling existed.
    assert derive_identity_assurance(True, {"verified": True, "status": "verified"}) == "MEDIUM"


def test_unverified_is_unverified():
    assert derive_identity_assurance(False, {"status": "document_uploaded"}) == "UNVERIFIED"
    assert derive_identity_assurance(False, None) == "UNVERIFIED"


def test_unknown_label_falls_back_to_inference():
    # A garbage label is ignored; falls back to verified→MEDIUM.
    assert derive_identity_assurance(True, {"identity_assurance": "SUPER"}) == "MEDIUM"
