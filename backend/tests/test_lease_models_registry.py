"""Versioned lease-model registry tests (Path A)."""

import pytest

from app.services.lease_models import registry


def test_current_version():
    assert registry.CURRENT_TEMPLATE_VERSION == "2025.01"


def test_vide_model_resolves_into_dated_dir():
    p = registry.model_path("vide")
    assert p.name == "annexe1_vide.md"
    assert "2025-01-01" in p.parts
    assert p.exists()


def test_load_model_returns_verbatim_official_text():
    text = registry.load_model("vide")
    # A standardized clause that must be present verbatim (Décret 2015-587, §III).
    assert "reconduit tacitement pour 3 ou 6 ans" in text
    # The deposit-cap wording (§VI) — cross-checks LG-1.
    assert "inférieur ou égal à un mois de loyers hors charges" in text


def test_supported_types_only_has_signed_off_models():
    types = registry.supported_types()
    assert "vide" in types
    # meublé / mobilité models are not yet fetched + signed off.
    assert "meuble" not in types
    assert "mobilite" not in types


def test_unsupported_type_raises():
    with pytest.raises(KeyError):
        registry.model_path("meuble")  # pending sign-off → not in the registry yet


def test_unknown_version_raises():
    with pytest.raises(KeyError):
        registry.model_path("vide", version="1999.01")


def test_footnotes_resolve_and_load_verbatim():
    p = registry.footnotes_path("vide")
    assert p.name == "annexe1_vide_footnotes.md"
    assert "2025-01-01" in p.parts
    text = registry.load_footnotes("vide")
    # Note (1) — société civile familiale; note (8) — zones tendues definition.
    assert "société civile constituée exclusivement entre parents et alliés" in text
    assert "plus de 50 000 habitants" in text


def test_all_body_markers_have_footnotes():
    """Every (n) marker referenced in the body must have a matching footnote text."""
    import re
    body = registry.load_model("vide")
    notes = registry.load_footnotes("vide")
    body_markers = set(re.findall(r"\((\d{1,2})\)", body))
    note_markers = set(re.findall(r"^\((\d{1,2})\)", notes, flags=re.M))
    missing = body_markers - note_markers
    assert not missing, f"body references footnotes with no text: {sorted(missing, key=int)}"
