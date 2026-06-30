"""
§5.6 legality screen — real-world hardening corpus.

These fixtures are **synthetic and de-identified**: they reproduce only the *structural
clause patterns* observed across a sample of real uploaded leases (furnished/colocation,
foreign-student rentals), with fabricated parties ("Monsieur X" / "Madame Y") and NO
personal data whatsoever. No real lease text, names, addresses, or other PII is stored.

Each fixture exercises a pattern the screen must catch (or correctly clear):
- a clean official-style meublé → VALIDATED
- a "hors loi 89" dodge with penalty/astreinte/no-maintien clauses → flagged
- a bare informal lease missing the mandatory annexes → flagged
- an outdated clause résolutoire delay (pre-loi-2023) → flagged
"""

from app.services import lease_legality as ll

# Clean furnished lease, official-style: FR anchors + all annexes + current résolutoire.
COMPLIANT_MEUBLE = (
    "CONTRAT DE LOCATION DE LOGEMENT MEUBLÉ soumis au titre Ier bis de la loi n° 89-462 "
    "du 6 juillet 1989. Entre le bailleur Monsieur X et le locataire Madame Y, il a été "
    "convenu ce qui suit. Le présent contrat a pour objet la location d'un logement meublé "
    "à usage de résidence principale. Le dépôt de garantie est fixé à deux mois de loyer "
    "hors charges. Sont annexés au contrat : un diagnostic de performance énergétique, un "
    "état des risques et pollutions, et une notice d'information relative aux droits et "
    "obligations des locataires et des bailleurs. La clause résolutoire s'applique six "
    "semaines après commandement de payer demeuré infructueux."
)

# Lease that opts out of loi 89 and bundles penalty / astreinte / no-maintien clauses.
HORS_LOI_89 = (
    "BAIL D'HABITATION sorti du champ d'application de la loi n°89-462 du 6 juillet 1989. "
    "Entre le propriétaire Monsieur X et le preneur Madame Y. Le présent contrat est exclu "
    "du champ d'application de la loi numéro 89-462 du 6 juillet 1989 et régi par les "
    "articles 1714 à 1762 du code civil. En cas de retard dans la libération des lieux, le "
    "locataire devra une astreinte par jour de retard. La clause pénale incluse au présent "
    "contrat sera immédiatement applicable. La notification de fin de bail vaudra "
    "renonciation à tout maintien dans les lieux."
)

# Bare informal lease — references loi 89 but attaches no mandatory annexes.
MINIMAL_NO_ANNEXES = (
    "CONTRAT DE LOCATION. Entre le bailleur Monsieur X et le locataire Madame Y. Le présent "
    "contrat a pour objet la location d'un logement à usage d'habitation principale soumis "
    "à la loi du 6 juillet 1989. Le loyer mensuel charges comprises est payable d'avance le "
    "premier jour du mois. Le dépôt de garantie est versé à la signature. Fait en deux "
    "exemplaires originaux remis à chacune des parties."
)

# Same as compliant, but with the pre-loi-2023 two-month commandement delay.
STALE_RESOLUTOIRE = COMPLIANT_MEUBLE.replace(
    "La clause résolutoire s'applique six semaines après commandement de payer demeuré infructueux.",
    "La clause résolutoire s'applique deux mois après un commandement demeuré infructueux à défaut de paiement.",
)


def test_compliant_meuble_is_validated():
    res = ll.screen_lease_text(COMPLIANT_MEUBLE)
    assert res.status == ll.VALIDATED, res.flags
    assert res.flags == []


def test_hors_loi_89_dodge_is_flagged():
    res = ll.screen_lease_text(HORS_LOI_89)
    assert res.status == ll.ATTACHED
    assert "LU5_excludes_loi_89" in res.flags
    assert "LU2_art4_clause_penale" in res.flags
    assert "LU2_art4_astreinte" in res.flags
    assert "LU2_art4_renonciation_maintien" in res.flags


def test_hors_loi_89_curly_apostrophe_still_flagged():
    # Word-processor / OCR output uses a curly apostrophe (d’application); the opt-out
    # must still fire so punctuation can't silently regress LU5_excludes_loi_89.
    res = ll.screen_lease_text(HORS_LOI_89.replace("d'application", "d’application"))
    assert "LU5_excludes_loi_89" in res.flags


def test_minimal_lease_flags_missing_annexes():
    res = ll.screen_lease_text(MINIMAL_NO_ANNEXES)
    assert res.status == ll.ATTACHED
    for f in ("LU4_missing_dpe", "LU4_missing_erp", "LU4_missing_notice"):
        assert f in res.flags
    # No false prohibited-clause hits on a bare-but-legal lease.
    assert not any(f.startswith("LU2_") for f in res.flags)


def test_stale_commandement_delay_is_flagged():
    res = ll.screen_lease_text(STALE_RESOLUTOIRE)
    assert res.status == ll.ATTACHED
    assert "LU2_stale_commandement_delay" in res.flags


def test_deposit_two_months_does_not_trigger_stale_delay():
    # "deux mois de loyer" (a deposit cap) must NOT be read as a commandement delay.
    assert "LU2_stale_commandement_delay" not in ll.screen_lease_text(COMPLIANT_MEUBLE).flags


def test_non_payment_commandement_does_not_trigger_stale_delay():
    # A "deux mois … commandement" that is NOT about unpaid rent (e.g. quitter les lieux)
    # must not be read as the outdated payment delay.
    text = COMPLIANT_MEUBLE + (
        " Le locataire dispose de deux mois après un commandement de quitter les lieux "
        "pour former un recours."
    )
    res = ll.screen_lease_text(text)
    assert "LU2_stale_commandement_delay" not in res.flags
    assert res.status == ll.VALIDATED
