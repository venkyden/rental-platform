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
"""

from decimal import Decimal
from typing import Optional, Union

Number = Union[int, float, Decimal]


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
