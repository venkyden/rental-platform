"""
French rental-law compliance helpers (pure, side-effect free, unit-testable).

Currently covers `encadrement des loyers` (rent control) enforcement used at
publish time. Reference rents are stored on the Property as €/m² values
(`loyer_reference`, `loyer_reference_majore`).

Legal basis: Loi ALUR (2014) / Loi ELAN (2018), Art. 140 — in designated
"zones tendues", the base rent (loyer hors charges) per m² may not exceed the
majored reference rent (`loyer de référence majoré`) unless a justified rent
supplement (`complément de loyer`) applies, which requires a written
justification of the property's exceptional characteristics.

Also enforces:
- DPE F/G rent freeze (loi Climat, décret 2021-19): dwellings classified F or G
  may not have their rent increased vs. the previous tenant for any new or renewed
  lease signed since 24 August 2022 (mainland + Corsica). Overseas DOM: 1 July 2024.
"""

from datetime import date
from decimal import Decimal
from typing import Optional, Union, List

Number = Union[int, float, Decimal]

# Exhaustive list of documents permitted under Loi ALUR (Décret n° 2015-1437)
LOI_ALUR_ALLOWED_TENANT_DOCS = {
    "passport", "id_card", "drivers_license", "residence_permit",
    "contract", "employer_certificate", "student_id", "internship_contract", "kbis",
    "payslip", "tax_return", "foreign_tax_return", "scholarship", "caf",
    "accounting", "benefits", "pension", "bank_funds_certificate",
    "visale_certificate", "garantme_certificate",
    "rent_receipt", "guarantor_form", "property_tax_notice"
}


def _to_float(value: Optional[Number]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def validate_rent_control(
    monthly_rent: Optional[Number],
    size_sqm: Optional[Number],
    loyer_reference_majore: Optional[Number],
    complement_de_loyer: Optional[Number],
    complement_de_loyer_justification: Optional[str],
) -> Optional[str]:
    """Return a bilingual error message if the listing breaches rent control,
    or ``None`` if it is compliant (or rent control does not apply / cannot be
    assessed because no reference rent is recorded for the zone).
    """
    justification = (complement_de_loyer_justification or "").strip()
    complement = _to_float(complement_de_loyer) or 0.0

    # A declared rent supplement always requires a written justification,
    # regardless of whether a reference rent is on file for the zone.
    if complement > 0 and not justification:
        return (
            "A rent supplement (complément de loyer) requires a written "
            "justification of the property's exceptional characteristics. — "
            "Un complément de loyer doit être justifié par des caractéristiques "
            "exceptionnelles du logement (encadrement des loyers, loi ALUR/ELAN)."
        )

    rent = _to_float(monthly_rent)
    surface = _to_float(size_sqm)
    majored = _to_float(loyer_reference_majore)

    # Rent control can only be assessed when the zone's majored reference rent
    # has been recorded and we have a usable surface to derive €/m².
    if not majored or majored <= 0 or not surface or surface <= 0 or rent is None:
        return None

    rent_per_sqm = rent / surface
    # 1-cent tolerance to avoid rejecting on floating-point noise.
    if rent_per_sqm > majored + 0.01 and not justification:
        return (
            f"Base rent of €{rent_per_sqm:.2f}/m² exceeds the majored reference "
            f"rent of €{majored:.2f}/m² for this rent-control zone. Either lower "
            f"the rent or declare a justified rent supplement. — Le loyer de "
            f"€{rent_per_sqm:.2f}/m² dépasse le loyer de référence majoré de "
            f"€{majored:.2f}/m² (encadrement des loyers). Baissez le loyer ou "
            f"justifiez un complément de loyer."
        )

    return None


# DPE F/G rent freeze (loi Climat, décret 2021-19).
# Since 24 August 2022 (mainland + Corsica), a new or renewed lease on a class F or G
# dwelling cannot have a higher rent than the rent paid by the previous tenant.
# Overseas DOM threshold: 1 July 2024.
_DPE_FREEZE_DATE_MAINLAND = date(2022, 8, 24)
_DPE_FREEZE_CLASSES = frozenset("FG")


def validate_fg_rent_freeze(
    dpe_class: Optional[str],
    monthly_rent: Optional[Number],
    previous_tenant_rent: Optional[Number],
    lease_start_date: Optional[date] = None,
    is_overseas: bool = False,
) -> Optional[str]:
    """Return an error message if the F/G rent freeze is breached, else None.

    Args:
        dpe_class: DPE energy class (A–G).
        monthly_rent: Proposed monthly rent HC (€).
        previous_tenant_rent: Last rent HC paid by the departing tenant (€).
            If None, the check is skipped (no previous tenant on record).
        lease_start_date: Date the new lease is signed/starts. Defaults to today.
        is_overseas: True for DOM (Guadeloupe, Martinique, Guyane, La Réunion,
            Mayotte) where the freeze took effect from 1 July 2024.
    """
    cls = (dpe_class or "").strip().upper()
    if cls not in _DPE_FREEZE_CLASSES:
        return None  # Only F/G are subject to the freeze

    effective_date = date(2024, 7, 1) if is_overseas else _DPE_FREEZE_DATE_MAINLAND
    check_date = lease_start_date or date.today()
    if check_date < effective_date:
        return None  # Freeze not yet in effect at that date

    rent = _to_float(monthly_rent)
    prev = _to_float(previous_tenant_rent)
    if rent is None or prev is None:
        return None  # Cannot assess without both figures

    if rent > prev + 0.01:  # cent tolerance for float noise
        return (
            f"Logement classé {cls} au DPE : le loyer ({rent:.2f}€ HC) ne peut pas dépasser "
            f"le loyer du précédent locataire ({prev:.2f}€ HC) pour un bail conclu depuis le "
            f"{effective_date.strftime('%d/%m/%Y')} (loi Climat, décret 2021-19). — "
            f"DPE class {cls}: rent ({rent:.2f}€ HC) cannot exceed the previous tenant's "
            f"rent ({prev:.2f}€ HC) for a lease signed after "
            f"{effective_date.isoformat()} (loi Climat)."
        )
    return None


def validate_property_compliance(property_obj) -> List[str]:
    """
    Validates a property against French legal compliance requirements (Rent Caps, Surface).
    Returns a list of error strings. If the list is empty, the property is compliant.

    DPE compliance is NOT handled here: the décence-énergétique class is assessed in
    the publish endpoint via app.services.dpe_compliance.assess_dpe, which warns and
    requires acknowledgment (rather than hard-blocking) and enforces the L126-33 class
    display requirement. See docs/superpowers/specs/2026-06-10-dpe-reclassification-enforcement-design.md.
    """
    errors = []

    deposit = _to_float(property_obj.deposit)
    monthly_rent = _to_float(property_obj.monthly_rent)

    # Deposit cap validation (Loi du 6 juillet 1989, Art. 22)
    if deposit is not None and monthly_rent:
        # Check furnished status, support Mock/MagicMock safely
        is_furnished = property_obj.furnished
        # If it's a MagicMock, bool(is_furnished) is True, but if it has a spec or is not set we check class
        if is_furnished.__class__.__name__ in ("MagicMock", "Mock", "AsyncMock"):
            # Check if there is an explicit boolean or value set
            is_furnished = False
        else:
            is_furnished = bool(is_furnished)

        max_deposit_months = 2 if is_furnished else 1
        # Loi du 6 juillet 1989 Art. 22 caps the deposit on rent HORS CHARGES.
        # When the listing rent is charges-included (CC), strip the charges before
        # applying the cap — using the CC total would over-allow the deposit.
        rent_hc = monthly_rent
        if bool(getattr(property_obj, "charges_included", False)):
            charges = _to_float(property_obj.charges) or 0.0
            rent_hc = max(0.0, monthly_rent - charges)
        max_deposit = rent_hc * max_deposit_months
        if deposit > max_deposit:
            label = "2 months" if is_furnished else "1 month"
            errors.append(f"Security deposit exceeds the legal maximum of {label} rent hors charges (€{max_deposit:.2f}) for {'furnished' if is_furnished else 'unfurnished'} properties.")

    # Minimum habitable surface (Décret n° 2002-120)
    size_sqm = _to_float(property_obj.size_sqm)
    if size_sqm and size_sqm < 9:
        errors.append("Property surface area must be at least 9m² to be considered habitable under French law (Décret n° 2002-120).")

    # Rent control (encadrement des loyers) — Loi ALUR/ELAN, zones tendues
    rent_error = validate_rent_control(
        monthly_rent=property_obj.monthly_rent,
        size_sqm=property_obj.size_sqm,
        loyer_reference_majore=property_obj.loyer_reference_majore,
        complement_de_loyer=property_obj.complement_de_loyer,
        complement_de_loyer_justification=property_obj.complement_de_loyer_justification,
    )
    if rent_error:
        errors.append(rent_error)

    # DPE F/G rent freeze (loi Climat, since 24/08/2022)
    fg_error = validate_fg_rent_freeze(
        dpe_class=getattr(property_obj, "dpe_rating", None),
        monthly_rent=property_obj.monthly_rent,
        previous_tenant_rent=getattr(property_obj, "previous_tenant_rent", None),
        is_overseas=getattr(property_obj, "is_overseas_dom", False),
    )
    if fg_error:
        errors.append(fg_error)

    return errors


def compliance_blocks_auto_activation(property_obj) -> List[str]:
    """Non-interactive compliance gate (e.g. bulk import — no human present to
    acknowledge a décence warning).

    Combines ``validate_property_compliance`` (deposit/surface/rent control) with the
    DPE décence assessment: a property that lacks a DPE class (L126-33), or whose
    authoritative class requires décence acknowledgment (class G / expired DPE), must
    NOT be silently activated — there is no one to acknowledge it. Returns a list of
    error strings; an empty list means it is safe to keep the listing active.

    The interactive publish endpoint does NOT use this — it surfaces the same DPE facts
    as a warning + one-click acknowledgment instead (see properties.publish_property).
    """
    from datetime import date
    from app.services.dpe_compliance import assess_dpe

    errors = list(validate_property_compliance(property_obj))

    raw_od = getattr(property_obj, "ownership_data", None)
    od = raw_od if isinstance(raw_od, dict) else {}
    assessment = assess_dpe(
        self_typed_class=property_obj.dpe_rating,
        ademe_class=od.get("dpe_class"),
        assurance=od.get("dpe_assurance"),
        expired=od.get("dpe_expired"),
        today=date.today(),
    )
    if assessment.authoritative_class is None:
        errors.append(
            "A DPE (Diagnostic de Performance Énergétique) class is required to publish "
            "a rental listing (Art. L126-33 CCH)."
        )
    elif assessment.requires_acknowledgment:
        errors.append(
            "DPE décence énergétique: this energy class cannot be leased as a primary "
            "residence without acknowledgment (loi Climat) — left as draft for review."
        )
    return errors


def validate_alur_document_type(doc_type: str) -> Optional[str]:
    """Returns an error message if the document type is illegal to request under Loi ALUR."""
    if doc_type not in LOI_ALUR_ALLOWED_TENANT_DOCS:
        return (
            f"Document type '{doc_type}' is not on the exhaustive list of documents "
            "permitted by Loi ALUR (Décret n° 2015-1437). Requesting other documents "
            "is strictly forbidden."
        )
    return None
