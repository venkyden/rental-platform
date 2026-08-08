"""
Path A generation tests.

Load-bearing: the SAFETY INVARIANT — each tokenized fillable differs from the verbatim
official model ONLY in the blanks (standardized clauses byte-identical), so generation
never alters blessed legal wording (LG-6). Plus schema-driven required/enum validation.
"""

import re

import pytest

from app.services import lease_fields
from app.services import lease_generation as gen
from app.services.lease_models import registry

_BLANK_RE = re.compile(r"\[[^\]]*\]")
_TOKEN_RE = re.compile(r"\{\{(\w+)\}\}")

# A full valid vide field map (every required token + valid enum values).
VIDE_FIELDS = {
    "bailleur_designation": "M. Jean Bailleur, 1 rue Test, 44000 Nantes, personne physique",
    "locataire_designation": "Mme Marie Locataire",
    "logement_localisation": "2 avenue Exemple, 44000 Nantes, 2e étage",
    "logement_type_habitat": "immeuble collectif",
    "logement_regime": "copropriété",
    "logement_periode_construction": "de 1975 à 1989",
    "logement_surface_habitable": "42",
    "logement_nb_pieces": "2",
    "chauffage_modalite": "individuel",
    "ecs_modalite": "individuelle",
    "logement_dpe_classe": "C",
    "destination_locaux": "usage d'habitation",
    "date_prise_effet": "2026-08-01",
    "duree_contrat": "3 ans",
    "loyer_mensuel": "750 €",
    "depot_garantie": "750 €",
    "date_signature": "2026-07-15",
    "lieu_signature": "Nantes",
}
VALID_KW = dict(
    lease_type="vide", fields=VIDE_FIELDS,
    deposit=750, monthly_rent_hc=750,          # vide: ≤ 1 month → OK
    present_annexes={"dpe", "erp", "notice_information"},
)


@pytest.mark.parametrize("lease_type", ["vide", "meuble", "etudiant"])
def test_safety_invariant_all_fillables_match_verbatim(lease_type):
    verbatim = _BLANK_RE.sub("", registry.load_model(lease_type))
    fillable = re.sub(r"\{\{\w+\}\}", "", _BLANK_RE.sub("", registry.load_fill_model(lease_type)))
    assert fillable == verbatim, f"{lease_type}: standardized text diverged from official model"


@pytest.mark.parametrize("lease_type", ["vide", "meuble", "etudiant"])
def test_every_template_token_is_in_the_schema(lease_type):
    """No template may reference a token missing from the central field schema."""
    tokens = set(_TOKEN_RE.findall(registry.load_fill_model(lease_type)))
    unknown = tokens - set(lease_fields.FIELDS)
    assert not unknown, f"{lease_type}: tokens absent from schema: {sorted(unknown)}"


def test_generate_fills_fields_and_keeps_clauses():
    res = gen.generate(**VALID_KW)
    assert res.ok is True and res.text is not None
    assert "M. Jean Bailleur" in res.text and "42" in res.text
    # optional field defaulted (mandataire not provided → schema default "Néant")
    assert "Néant" in res.text
    # standardized clauses still verbatim; the filled blanks are gone
    assert "reconduit tacitement pour 3 ou 6 ans" in res.text
    assert "inférieur ou égal à un mois de loyers hors charges" not in res.text
    # none of the tokenized fields left unfilled
    assert not any(f"{{{{{tok}}}}}" in res.text for tok in VIDE_FIELDS)


def test_missing_required_field_blocks():
    kw = {**VALID_KW, "fields": {k: v for k, v in VIDE_FIELDS.items() if k != "logement_localisation"}}
    res = gen.generate(**kw)
    assert res.ok is False and res.text is None
    assert any("obligatoire manquant" in b.lower() for b in res.blocking)


def test_invalid_enum_value_blocks():
    kw = {**VALID_KW, "fields": {**VIDE_FIELDS, "chauffage_modalite": "solaire"}}
    res = gen.generate(**kw)
    assert res.ok is False
    assert any("invalide" in b.lower() for b in res.blocking)


def test_optional_field_uses_schema_default():
    res = gen.generate(**VALID_KW)      # mandataire_designation not supplied
    assert res.text is not None and "{{mandataire_designation}}" not in res.text


def test_meuble_generation_fills_core_and_allows_two_month_deposit():
    res = gen.generate(
        lease_type="meuble", fields={**VIDE_FIELDS, "duree_contrat": "1 an"},
        deposit=1500, monthly_rent_hc=750,      # meublé cap = 2 months → OK
        furnished_items=set(gen.lease_rules.FURNISHED_REQUIRED_ITEMS.keys()),
        present_annexes={"dpe", "erp", "notice_information"},
    )
    assert res.ok is True and res.text is not None
    assert "1 an" in res.text and "M. Jean Bailleur" in res.text
    assert "reconduits tacitement à leur terme pour une durée d'un an" in res.text


def test_lg_gate_blocks_over_cap_deposit_no_text():
    res = gen.generate(**{**VALID_KW, "deposit": 2000})   # vide cap is 1 month (750)
    assert res.ok is False and res.text is None
    assert any("art. 22" in b for b in res.blocking)


def test_lg_gate_blocks_custom_clause():
    res = gen.generate(**{**VALID_KW, "custom_clauses": ["clause maison"]})
    assert res.ok is False
    assert any("1971" in b for b in res.blocking)


def test_lg_gate_blocks_dpe_class_g():
    kw = {**VALID_KW, "fields": {**VIDE_FIELDS, "logement_dpe_classe": "G"}}
    res = gen.generate(**kw)
    assert res.ok is False and res.text is None
    assert any("loi Climat" in b for b in res.blocking)
