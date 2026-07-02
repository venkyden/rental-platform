"""
Central field schema for Path A lease generation.

One source of truth per template `{{token}}`: required?, type, allowed enum values,
a safe default (for optional blanks not provided), a UI label, and the legal source.
The generator validates required fields + enum values and fills optional blanks from
input-or-default; the frontend can drive its form off the same schema.

The schema is a SUPERSET — each template uses a subset of these tokens (enforced by
test: every template token must exist here).
"""

from dataclasses import dataclass, field as _dc_field


@dataclass(frozen=True)
class Field:
    required: bool = False
    type: str = "text"                 # text | number | enum | date
    enum: tuple = ()
    default: str = ""                  # used for OPTIONAL blanks when not provided
    label: str = ""
    source: str = ""                   # décret / loi reference


FIELDS: dict[str, Field] = {
    # I. Désignation des parties
    "bailleur_designation": Field(required=True, label="Bailleur (désignation)", source="Annexe I"),
    "locataire_designation": Field(required=True, label="Locataire (désignation)", source="Annexe I"),
    "mandataire_designation": Field(default="Néant", label="Mandataire", source="Annexe I"),
    "carte_pro_garant": Field(default="Néant", label="Carte professionnelle / garant", source="Annexe I"),
    # II. Objet du contrat — consistance
    "logement_localisation": Field(required=True, label="Adresse du logement", source="Annexe II.A"),
    "logement_id_fiscal": Field(required=True, label="Identifiant fiscal du logement", source="Annexe II.A"),
    "logement_type_habitat": Field(required=True, type="enum",
                                   enum=("immeuble collectif", "immeuble individuel"),
                                   label="Type d'habitat", source="Annexe II.A"),
    "logement_regime": Field(required=True, type="enum", enum=("mono propriété", "copropriété"),
                             label="Régime juridique", source="Annexe II.A"),
    "logement_periode_construction": Field(required=True, label="Période de construction", source="Annexe II.A"),
    "logement_surface_habitable": Field(required=True, type="number", label="Surface habitable (m²)", source="Annexe II.A"),
    "logement_nb_pieces": Field(required=True, type="number", label="Nombre de pièces principales", source="Annexe II.A"),
    "chauffage_modalite": Field(required=True, type="enum", enum=("individuel", "collectif"),
                                label="Chauffage", source="Annexe II.A"),
    "ecs_modalite": Field(required=True, type="enum", enum=("individuelle", "collective"),
                          label="Eau chaude sanitaire", source="Annexe II.A"),
    "logement_dpe_classe": Field(required=True, type="enum", enum=tuple("ABCDEFG"),
                                 label="Classe DPE", source="Annexe II.A (LG-7)"),
    "destination_locaux": Field(required=True, default="usage d'habitation",
                                label="Destination des locaux", source="Annexe II.B"),
    # III. Durée
    "date_prise_effet": Field(required=True, type="date", label="Date de prise d'effet", source="Annexe III"),
    "duree_contrat": Field(required=True, label="Durée du contrat", source="Annexe III"),
    # IV / VI. Financier
    "loyer_mensuel": Field(required=True, type="number", label="Loyer mensuel (€)", source="Annexe IV.A"),
    "depot_garantie": Field(required=True, type="number", label="Dépôt de garantie (€)", source="Annexe VI"),
    # Signature
    "date_signature": Field(required=True, type="date", label="Date de signature", source="Signature"),
    "lieu_signature": Field(required=True, label="Lieu de signature", source="Signature"),
}
