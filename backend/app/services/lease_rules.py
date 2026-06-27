"""
Path A lease-generation legal enforcement (DOSSIER §5.5, LG-1..LG-6).

A deterministic French-law rule-set evaluated at lease **finalisation**. It is
independent of the lease body **wording** — this module draws NO clauses and asserts
no model text. The lease body must be the official Décret n°2015-587 model (the gated
part of Path A); this module only blocks a finalisation that would produce an illegal
lease and carries advisory flags into it.

Pure + side-effect-free + unit-testable: every function takes explicit parameters, no
DB/model coupling.

Legal basis (sourced, factual — not legal advice):
- Deposit caps — loi n°89-462 du 6 juillet 1989, art. 22 (vide ≤ 1 mois de loyer hors
  charges ; meublé/étudiant ≤ 2 mois) ; bail mobilité : dépôt de garantie **interdit**
  (loi ELAN n°2018-1021, art. 25-12) → 0.
- Furnished equipment — Décret n°2015-981 du 31 juillet 2015 : 11 catégories obligatoires.
- Mandatory annexes — loi 89 art. 3-3 ; DPE (art. L126-33 CCH) ; état des risques /
  ERP (art. L125-5 CCH) ; notice d'information (Décret n°2015-1437).
- Model wording only — Décret n°2015-587 ; aucune clause libre (loi du 31 déc. 1971).
"""

from dataclasses import dataclass, field

# Lease type → deposit cap (months of rent HORS CHARGES) and whether it must be furnished.
LEASE_TYPES: dict[str, dict] = {
    "vide":     {"deposit_max_months": 1, "furnished_required": False, "label": "bail vide (non meublé)"},
    "meuble":   {"deposit_max_months": 2, "furnished_required": True,  "label": "bail meublé"},
    "etudiant": {"deposit_max_months": 2, "furnished_required": True,  "label": "bail étudiant meublé"},
    "mobilite": {"deposit_max_months": 0, "furnished_required": True,  "label": "bail mobilité"},
}

# Décret n°2015-981 — 11 mandatory equipment categories for a furnished lease.
FURNISHED_REQUIRED_ITEMS: dict[str, str] = {
    "literie": "Literie avec couette ou couverture",
    "occultation_chambres": "Dispositif d'occultation des fenêtres dans les chambres",
    "plaques_cuisson": "Plaques de cuisson",
    "four_ou_micro_ondes": "Four ou four à micro-ondes",
    "refrigerateur_congelateur": "Réfrigérateur et congélateur (ou compartiment ≤ -6 °C)",
    "vaisselle": "Vaisselle nécessaire à la prise des repas",
    "ustensiles_cuisine": "Ustensiles de cuisine",
    "table_et_sieges": "Table et sièges",
    "etageres_rangement": "Étagères de rangement",
    "luminaires": "Luminaires",
    "materiel_entretien": "Matériel d'entretien ménager adapté au logement",
}

# Universally mandatory annexes for a residential lease.
MANDATORY_ANNEXES: dict[str, str] = {
    "dpe": "Diagnostic de performance énergétique (DPE)",
    "erp": "État des risques et pollutions (ERP)",
    "notice_information": "Notice d'information (Décret n°2015-1437)",
}


@dataclass
class LeaseRuleResult:
    """Outcome of the finalisation screen.

    `blocking` MUST be empty to finalise (each entry is an illegal condition).
    `advisory` is carried into the lease as informational flags (does not block).
    """
    blocking: list[str] = field(default_factory=list)
    advisory: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.blocking

    def as_dict(self) -> dict:
        return {"ok": self.ok, "blocking": self.blocking, "advisory": self.advisory}


def max_deposit(lease_type: str, monthly_rent_hc: float) -> float:
    """Legal deposit ceiling (€) for the type. Returns 0 for bail mobilité."""
    months = LEASE_TYPES.get(lease_type, {}).get("deposit_max_months", 1)
    return round(months * max(monthly_rent_hc, 0.0), 2)


def validate_deposit(lease_type: str, deposit: float, monthly_rent_hc: float) -> list[str]:
    """LG-1 (over cap) + LG-2 (bail mobilité must be 0)."""
    cfg = LEASE_TYPES.get(lease_type)
    if cfg is None:
        return [f"Type de bail inconnu : « {lease_type} »."]
    deposit = deposit or 0.0
    if cfg["deposit_max_months"] == 0:
        if deposit > 0:
            return ["Le bail mobilité interdit tout dépôt de garantie — il doit être de 0 € "
                    "(loi ELAN art. 25-12)."]
        return []
    cap = max_deposit(lease_type, monthly_rent_hc)
    if deposit > cap + 0.01:  # cent tolerance for float noise
        return [f"Le dépôt de garantie de {deposit:.2f} € dépasse le maximum légal de "
                f"{cfg['deposit_max_months']} mois de loyer hors charges ({cap:.2f} €) "
                f"pour un {cfg['label']} (loi 89 art. 22)."]
    return []


def validate_furnished_inventory(lease_type: str, provided_items) -> list[str]:
    """LG-3 — furnished leases require all 11 Décret 2015-981 categories."""
    cfg = LEASE_TYPES.get(lease_type)
    if not cfg or not cfg["furnished_required"]:
        return []
    provided = set(provided_items or [])
    missing = [label for key, label in FURNISHED_REQUIRED_ITEMS.items() if key not in provided]
    if missing:
        return [f"Mobilier obligatoire manquant ({len(missing)}/11, Décret 2015-981) : "
                + " ; ".join(missing) + "."]
    return []


def validate_annexes(present_annexes) -> list[str]:
    """LG-4 — block finalisation while a mandatory annex is missing."""
    present = set(present_annexes or [])
    return [f"Annexe obligatoire manquante : {label}."
            for key, label in MANDATORY_ANNEXES.items() if key not in present]


def zone_tendue_advisory(
    in_zone_tendue: bool, complement_de_loyer: float = 0.0, complement_justification: str | None = None
) -> list[str]:
    """LG-5 — carry an advisory flag (does not block)."""
    notes: list[str] = []
    if in_zone_tendue:
        notes.append("Bien situé en zone tendue — encadrement des loyers applicable "
                     "(loi ALUR/ELAN).")
    if (complement_de_loyer or 0) > 0 and not (complement_justification or "").strip():
        notes.append("Complément de loyer déclaré sans justification écrite des "
                     "caractéristiques exceptionnelles du logement.")
    return notes


def reject_custom_wording(custom_clauses) -> list[str]:
    """LG-6 — only the Décret 2015-587 model wording is permitted (loi 1971)."""
    if custom_clauses:
        return ["Les clauses personnalisées ne sont pas autorisées : seul le modèle "
                "réglementaire (Décret 2015-587) est utilisé (loi du 31 déc. 1971)."]
    return []


def validate_lease_finalisation(
    *,
    lease_type: str,
    deposit: float,
    monthly_rent_hc: float,
    furnished_items=None,
    present_annexes=None,
    in_zone_tendue: bool = False,
    complement_de_loyer: float = 0.0,
    complement_justification: str | None = None,
    custom_clauses=None,
) -> LeaseRuleResult:
    """Run all LG-1..LG-6 checks. `blocking` must be empty to finalise."""
    blocking: list[str] = []
    blocking += validate_deposit(lease_type, deposit, monthly_rent_hc)
    blocking += validate_furnished_inventory(lease_type, furnished_items)
    blocking += validate_annexes(present_annexes)
    blocking += reject_custom_wording(custom_clauses)
    advisory = zone_tendue_advisory(in_zone_tendue, complement_de_loyer, complement_justification)
    return LeaseRuleResult(blocking=blocking, advisory=advisory)
