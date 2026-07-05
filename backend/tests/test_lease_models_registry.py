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


def test_supported_types_present_and_absent():
    types = registry.supported_types()
    assert {"vide", "meuble", "etudiant"}.issubset(types)
    # bail mobilité (loi ELAN) model not fetched + signed off yet.
    assert "mobilite" not in types


def test_meuble_model_and_deposit_cap():
    p = registry.model_path("meuble")
    assert p.name == "annexe2_meuble.md"
    assert "2025-01-01" in p.parts
    text = registry.load_model("meuble")
    # §VI meublé cap = two months (vs one for vide) — cross-checks LG-1.
    assert "inférieur ou égal à deux mois de loyers hors charges" in text
    # §III carries the 9-month student variant.
    assert "neuf mois" in text


def test_etudiant_uses_the_meuble_model():
    assert registry.model_path("etudiant").name == "annexe2_meuble.md"


def test_mobilite_is_a_reference_not_a_fillable_model():
    # bail mobilité has no decree contrat-type → it must NOT be a fillable model.
    with pytest.raises(KeyError):
        registry.model_path("mobilite")
    assert "mobilite" not in registry.supported_types()
    # …but its legal-requirement reference resolves and carries the key rules.
    p = registry.reference_path("mobilite")
    assert p.name == "bail_mobilite_requirements.md"
    text = registry.load_reference("mobilite")
    assert "interdiction pour le bailleur d'exiger le versement d'un dépôt de garantie" in text
    assert "non renouvelable et non reconductible" in text


def test_unsupported_type_raises():
    with pytest.raises(KeyError):
        registry.model_path("colocation")  # unknown type → not registered


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


@pytest.mark.parametrize("lease_type", ["vide", "meuble", "etudiant"])
def test_body_and_footnote_markers_match_bidirectionally(lease_type):
    """Every body (n) marker has a footnote text AND every footnote has a body marker
    (no orphan notes) — catches both dropped markers and orphaned footnotes."""
    import re
    body = registry.load_model(lease_type)
    notes = registry.load_footnotes(lease_type)
    body_markers = set(re.findall(r"\((\d{1,2})\)", body))
    note_markers = set(re.findall(r"^\((\d{1,2})\)", notes, flags=re.M))
    assert body_markers == note_markers, (
        f"{lease_type}: marker mismatch — "
        f"body-only {sorted(body_markers - note_markers, key=int)}, "
        f"orphan notes {sorted(note_markers - body_markers, key=int)}"
    )
