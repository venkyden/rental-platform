"""
Path A lease-generation rule-set tests (DOSSIER §5.5, LG-1..LG-6).

Pure deterministic French-law checks — fully testable offline. The lease *wording*
is out of scope (gated); these only cover the finalisation legality gate.
"""

from app.services import lease_rules as lr

# All 11 furnished categories, for building a complete inventory in tests.
ALL_FURNISHED = set(lr.FURNISHED_REQUIRED_ITEMS.keys())
ALL_ANNEXES = set(lr.MANDATORY_ANNEXES.keys())


# ── LG-1: deposit over cap ───────────────────────────────────────────────────

def test_lg1_vide_deposit_within_one_month_ok():
    assert lr.validate_deposit("vide", deposit=800, monthly_rent_hc=800) == []


def test_lg1_vide_deposit_over_one_month_blocks():
    errs = lr.validate_deposit("vide", deposit=1600, monthly_rent_hc=800)
    assert errs and "1 mois" in errs[0] and "art. 22" in errs[0]


def test_lg1_meuble_allows_two_months():
    assert lr.validate_deposit("meuble", deposit=1600, monthly_rent_hc=800) == []
    assert lr.validate_deposit("meuble", deposit=1601, monthly_rent_hc=800) != []


def test_lg1_etudiant_allows_two_months():
    assert lr.validate_deposit("etudiant", deposit=1600, monthly_rent_hc=800) == []


def test_max_deposit_helper():
    assert lr.max_deposit("vide", 800) == 800.0
    assert lr.max_deposit("meuble", 800) == 1600.0
    assert lr.max_deposit("mobilite", 800) == 0.0


# ── LG-2: bail mobilité deposit must be 0 ────────────────────────────────────

def test_lg2_mobilite_zero_deposit_ok():
    assert lr.validate_deposit("mobilite", deposit=0, monthly_rent_hc=800) == []


def test_lg2_mobilite_nonzero_deposit_blocks():
    errs = lr.validate_deposit("mobilite", deposit=500, monthly_rent_hc=800)
    assert errs and "mobilité" in errs[0].lower() and "0" in errs[0]


# ── LG-3: furnished 11-item inventory (Décret 2015-981) ──────────────────────

def test_lg3_complete_inventory_ok():
    assert lr.validate_furnished_inventory("meuble", ALL_FURNISHED) == []


def test_lg3_incomplete_inventory_blocks_and_lists_missing():
    partial = ALL_FURNISHED - {"luminaires", "table_et_sieges"}
    errs = lr.validate_furnished_inventory("meuble", partial)
    assert errs and "2/11" in errs[0]
    assert "Luminaires" in errs[0] and "Table et sièges" in errs[0]


def test_lg3_not_required_for_vide():
    assert lr.validate_furnished_inventory("vide", set()) == []


def test_lg3_mobilite_requires_furnishing():
    assert lr.validate_furnished_inventory("mobilite", set()) != []


# ── LG-4: mandatory annexes ──────────────────────────────────────────────────

def test_lg4_all_annexes_present_ok():
    assert lr.validate_annexes(ALL_ANNEXES) == []


def test_lg4_missing_annexes_block():
    errs = lr.validate_annexes({"dpe"})
    joined = " ".join(errs)
    assert "ERP" in joined and "Notice d'information" in joined
    assert len(errs) == 2


# ── LG-5: zone tendue advisory (never blocks) ────────────────────────────────

def test_lg5_zone_tendue_is_advisory():
    notes = lr.zone_tendue_advisory(in_zone_tendue=True)
    assert notes and "zone tendue" in notes[0].lower()


def test_lg5_complement_without_justification_advisory():
    notes = lr.zone_tendue_advisory(False, complement_de_loyer=150, complement_justification=" ")
    assert any("complément de loyer" in n.lower() for n in notes)


def test_lg5_complement_with_justification_no_note():
    notes = lr.zone_tendue_advisory(False, complement_de_loyer=150, complement_justification="Vue exceptionnelle")
    assert notes == []


# ── LG-6: no custom wording (loi 1971) ───────────────────────────────────────

def test_lg6_custom_clauses_blocked():
    errs = lr.reject_custom_wording(["Clause pénale maison"])
    assert errs and "1971" in errs[0]


def test_lg6_no_custom_clauses_ok():
    assert lr.reject_custom_wording(None) == []
    assert lr.reject_custom_wording([]) == []


# ── Combined finalisation gate ───────────────────────────────────────────────

def test_finalisation_fully_compliant_meuble():
    res = lr.validate_lease_finalisation(
        lease_type="meuble", deposit=1600, monthly_rent_hc=800,
        furnished_items=ALL_FURNISHED, present_annexes=ALL_ANNEXES,
    )
    assert res.ok is True
    assert res.blocking == []


def test_finalisation_accumulates_all_violations():
    res = lr.validate_lease_finalisation(
        lease_type="mobilite", deposit=900, monthly_rent_hc=900,
        furnished_items={"literie"}, present_annexes=set(),
        custom_clauses=["clause libre"],
    )
    assert res.ok is False
    # deposit (mobilité≠0) + furnished incomplete + 3 missing annexes + custom wording
    assert len(res.blocking) == 1 + 1 + 3 + 1


def test_finalisation_advisory_does_not_block():
    res = lr.validate_lease_finalisation(
        lease_type="vide", deposit=800, monthly_rent_hc=800,
        present_annexes=ALL_ANNEXES, in_zone_tendue=True,
    )
    assert res.ok is True
    assert res.advisory and "zone tendue" in res.advisory[0].lower()
