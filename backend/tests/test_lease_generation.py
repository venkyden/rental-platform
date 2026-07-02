"""
Path A generation tests (v0.1 — vide core fields).

The load-bearing test is the SAFETY INVARIANT: the tokenized fillable template must
differ from the verbatim official model ONLY in the blanks — every standardized clause
byte-identical. That guarantees generation never alters blessed legal wording (LG-6).
"""

import re

import pytest

from app.services import lease_generation as gen
from app.services.lease_models import registry

_BLANK_RE = re.compile(r"\[[^\]]*\]")
_TOKEN_RE = re.compile(r"\{\{\w+\}\}")


@pytest.mark.parametrize("lease_type", ["vide", "meuble", "etudiant"])
def test_safety_invariant_all_fillables_match_verbatim(lease_type):
    """Every fillable's non-blank text is byte-identical to its verbatim model."""
    verbatim = _BLANK_RE.sub("", registry.load_model(lease_type))
    fillable = _TOKEN_RE.sub("", _BLANK_RE.sub("", registry.load_fill_model(lease_type)))
    assert fillable == verbatim, f"{lease_type}: standardized text diverged from official model"


def test_meuble_generation_fills_core_and_allows_two_month_deposit():
    fields = {**CORE_FIELDS, "duree_contrat": "1 an"}
    res = gen.generate(
        lease_type="meuble", fields=fields,
        deposit=1500, monthly_rent_hc=750,      # meublé cap = 2 months → OK
        furnished_items=set(gen.lease_rules.FURNISHED_REQUIRED_ITEMS.keys()),
        present_annexes={"dpe", "erp", "notice_information"},
    )
    assert res.ok is True and res.text is not None
    assert "1 an" in res.text and "M. Jean Bailleur" in res.text
    # meublé standardized clause + 2-month cap wording present (deposit blank filled)
    assert "reconduits tacitement à leur terme pour une durée d'un an" in res.text

# A minimal valid vide field map for the tokenized core.
CORE_FIELDS = {
    "bailleur_designation": "M. Jean Bailleur, 1 rue Test, 44000 Nantes, personne physique",
    "locataire_designation": "Mme Marie Locataire",
    "logement_localisation": "2 avenue Exemple, 44000 Nantes, 2e étage",
    "logement_surface_habitable": "42",
    "logement_nb_pieces": "2",
    "logement_dpe_classe": "C",
    "destination_locaux": "usage d'habitation",
    "date_prise_effet": "2026-08-01",
    "loyer_mensuel": "750 €",
    "depot_garantie": "750 €",
}
VALID_KW = dict(
    lease_type="vide", fields=CORE_FIELDS,
    deposit=750, monthly_rent_hc=750,          # vide: ≤ 1 month → OK
    present_annexes={"dpe", "erp", "notice_information"},
)


def test_generate_fills_core_fields_and_keeps_clauses():
    res = gen.generate(**VALID_KW)
    assert res.ok is True
    assert res.text is not None
    # filled values present
    assert "M. Jean Bailleur" in res.text and "42" in res.text and "C." in res.text
    # standardized clauses still verbatim
    assert "reconduit tacitement pour 3 ou 6 ans" in res.text
    assert "inférieur ou égal à un mois de loyers hors charges" not in res.text  # blank was filled
    # no core token left unfilled
    assert not any(t in res.text for t in ("{{bailleur_designation}}", "{{loyer_mensuel}}", "{{depot_garantie}}"))


def test_not_finalisable_while_optional_blanks_remain():
    res = gen.generate(**VALID_KW)
    assert res.finalisable is False          # optional [...] sections not yet mapped
    assert res.remaining_blanks               # and they're reported honestly


def test_lg_gate_blocks_over_cap_deposit_no_text():
    kw = {**VALID_KW, "deposit": 2000}        # vide cap is 1 month (750)
    res = gen.generate(**kw)
    assert res.ok is False
    assert res.text is None
    assert any("art. 22" in b for b in res.blocking)


def test_lg_gate_blocks_custom_clause():
    kw = {**VALID_KW, "custom_clauses": ["clause maison"]}
    res = gen.generate(**kw)
    assert res.ok is False
    assert any("1971" in b for b in res.blocking)
