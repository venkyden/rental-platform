"""
Lease legality red-line screen tests (DOSSIER §5.6, LU-1..LU-5).

Deterministic rule-set, so fully testable offline. Asserts the VALIDATED vs ATTACHED
tier and the specific flags raised.
"""

from app.services import lease_legality as ll

# A compliant-looking French lease body: FR-law anchors, all 3 mandatory annexes,
# no prohibited clause, comfortably over the text-layer threshold.
COMPLIANT = (
    "CONTRAT DE LOCATION soumis à la loi du 6 juillet 1989. "
    "Entre le bailleur et le locataire désignés ci-dessus, il est convenu ce qui suit. "
    "Le présent bail porte sur un logement loué à usage de résidence principale. "
    "Un dépôt de garantie d'un montant d'un mois de loyer hors charges est versé. "
    "Annexes obligatoires jointes au contrat : le diagnostic de performance énergétique, "
    "l'état des risques et pollutions, ainsi que la notice d'information réglementaire. "
    "Le loyer est payable mensuellement à terme échu. "
    "Fait en deux exemplaires originaux remis à chacune des parties."
)


def test_compliant_lease_is_validated():
    res = ll.screen_lease_text(COMPLIANT)
    assert res.status == ll.VALIDATED
    assert res.flags == []


def test_no_text_layer_is_attached_lu1():
    res = ll.screen_lease_text("   ")
    assert res.status == ll.ATTACHED
    assert "LU1_no_text_layer" in res.flags


def test_short_text_is_attached_lu1():
    res = ll.screen_lease_text("Bail loi du 6 juillet 1989.")  # below the min-chars threshold
    assert res.status == ll.ATTACHED
    assert "LU1_no_text_layer" in res.flags


def test_missing_annexes_flagged_lu4():
    text = (
        "CONTRAT DE LOCATION soumis à la loi du 6 juillet 1989 entre le bailleur et le "
        "locataire. Un dépôt de garantie est versé. Le loyer est payable mensuellement. "
        "Le présent bail ne comporte aucune annexe particulière jointe à ce jour, ce qui "
        "doit être complété ultérieurement par les parties avant la remise des clés."
    )
    res = ll.screen_lease_text(text)
    assert res.status == ll.ATTACHED
    assert "LU4_missing_dpe" in res.flags
    assert "LU4_missing_erp" in res.flags
    assert "LU4_missing_notice" in res.flags


def test_not_french_law_flagged_lu5():
    text = (
        "RESIDENTIAL TENANCY AGREEMENT. This contract sets out the terms agreed between the "
        "parties for the rental of the premises described above for residential occupation. "
        "The security amount and the monthly payment are set out in the schedule attached "
        "hereto and form part of this agreement between the contracting parties hereunder."
    )
    res = ll.screen_lease_text(text)
    assert res.status == ll.ATTACHED
    assert "LU5_not_french_law" in res.flags


def test_foreign_governing_law_flagged_lu5():
    text = COMPLIANT + " This agreement is submitted to the laws of England and Wales."
    res = ll.screen_lease_text(text)
    assert res.status == ll.ATTACHED
    assert "LU5_foreign_governing_law" in res.flags


def test_prohibited_clause_salaire_flagged_lu2():
    text = COMPLIANT + " Le loyer est recouvré par prélèvement automatique sur salaire du locataire."
    res = ll.screen_lease_text(text)
    assert res.status == ll.ATTACHED
    assert "LU2_art4_salaire" in res.flags


def test_prohibited_clause_renonciation_flagged_lu2():
    text = COMPLIANT + " Par les présentes, le locataire renonce à tout recours prévu par la loi."
    res = ll.screen_lease_text(text)
    assert "LU2_art4_renonciation" in res.flags


def test_as_dict_shape():
    d = ll.screen_lease_text(COMPLIANT).as_dict()
    assert set(d.keys()) == {"status", "flags", "notes"}
    assert d["status"] == ll.VALIDATED


def test_extract_pdf_text_handles_garbage_bytes():
    # Non-PDF bytes must not raise — just yields empty text → ATTACHED downstream.
    assert ll.extract_pdf_text(b"not a pdf") == ""
