"""
Bail mobilité generation via the schema-driven Path A path.

DERIVED template (no decree contrat-type) — owner risk-accepted 2026-07-05,
pending counsel verification. These tests pin the requalification shield: the
art. 25-13 mandatory elements (bail-mobilité statement, motif 8°, no-deposit
11°) are present and the meublé tacit-renewal clause is absent.
"""

import pytest

from app.services import lease_generation as g, lease_fields, lease_rules
from app.services.lease_models import registry

_TOKEN_RE = __import__("re").compile(r"\{\{(\w+)\}\}")

BASE_FIELDS = {
    "bailleur_designation": "M. Bailleur",
    "locataire_designation": "Mme Locataire",
    "logement_localisation": "2 rue B, 44000 Nantes",
    "logement_surface_habitable": "25",
    "logement_nb_pieces": "1",
    "logement_dpe_classe": "D",
    "destination_locaux": "usage d'habitation",
    "date_prise_effet": "2026-09-01",
    "duree_contrat": "6 mois",
    "motif_mobilite": "études supérieures",
    "loyer_mensuel": "600 €",
}
FURNITURE = set(lease_rules.FURNISHED_REQUIRED_ITEMS.keys())
ANNEXES = {"dpe", "erp", "notice_information"}


def _gen(fields, deposit=0):
    return g.generate(
        lease_type="mobilite", fields=fields, deposit=deposit,
        monthly_rent_hc=600, furnished_items=FURNITURE, present_annexes=ANNEXES,
    )


def test_mobilite_every_template_token_in_schema():
    tokens = set(_TOKEN_RE.findall(registry.load_fill_model("mobilite")))
    assert tokens - set(lease_fields.FIELDS) == set()


def test_mobilite_generates_with_mandatory_art_25_13_mentions():
    r = _gen(BASE_FIELDS)
    assert r.ok
    # requalification shield: statement + motif (8°) + no-deposit (11°) all present
    assert "bail mobilité régi par les dispositions du titre Ier ter" in r.text
    assert "études supérieures" in r.text
    assert "aucun dépôt de garantie ne peut être exigé" in r.text
    # meublé tacit-renewal clause must NOT leak into a mobilité lease
    assert "reconduits tacitement" not in r.text


def test_mobilite_missing_motif_blocks_generation():
    fields = {k: v for k, v in BASE_FIELDS.items() if k != "motif_mobilite"}
    r = _gen(fields)
    assert not r.ok
    assert r.text is None


def test_mobilite_rejects_invalid_motif():
    r = _gen({**BASE_FIELDS, "motif_mobilite": "vacances"})
    assert not r.ok
    assert any("Motif" in b or "motif" in b for b in r.blocking)


def test_mobilite_deposit_must_be_zero():
    r = _gen(BASE_FIELDS, deposit=600)
    assert not r.ok
    assert any("dépôt de garantie" in b for b in r.blocking)


def test_mobilite_template_carries_provenance_and_risk_marker():
    raw = registry.fill_model_path("mobilite").read_text(encoding="utf-8")
    assert "DERIVED TEMPLATE" in raw
    assert "NOT YET COUNSEL-VERIFIED" in raw
