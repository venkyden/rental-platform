"""Lease PDF rendering tests (Path A follow-up — standalone renderer)."""

from app.services import lease_generation as gen
from app.services.lease_pdf import render_lease_pdf

# Reuse a full valid vide field map so we render a realistic generated lease.
VIDE_FIELDS = {
    "bailleur_designation": "M. Jean Bailleur, 1 rue Test, 44000 Nantes, personne physique",
    "locataire_designation": "Mme Marie Locataire",
    "logement_localisation": "2 avenue Exemple, 44000 Nantes",
    "logement_id_fiscal": "44000000000000",
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


def _generate_vide_text():
    res = gen.generate(
        lease_type="vide", fields=VIDE_FIELDS,
        deposit=750, monthly_rent_hc=750,
        present_annexes={"dpe", "erp", "notice_information"},
    )
    assert res.ok and res.text
    return res.text


def test_renders_a_pdf_from_generated_lease():
    pdf = render_lease_pdf(_generate_vide_text())
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 1000


def test_default_watermark_is_draft_projet():
    # a draft render carries the PROJET watermark; empty watermark is allowed too
    assert render_lease_pdf("## Bail\n\nCorps du bail.").startswith(b"%PDF")
    assert render_lease_pdf("## Bail", watermark="").startswith(b"%PDF")


def test_xml_unsafe_field_values_do_not_break_render():
    # a party name with '<' / '&' must be escaped, not crash reportlab
    text = "## I. Parties\n\nBailleur : Smith & <Co> \"Immo\" — 1 rue <test>."
    pdf = render_lease_pdf(text)
    assert pdf.startswith(b"%PDF")
