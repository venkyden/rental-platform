"""
IBAN validation + masking for the deposit-binding evidence layer (item 15).

Roomivo is NEVER in the money flow (DOSSIER §0.15). This module does not initiate,
verify at the bank, or confirm ownership of any account. It performs an offline
structural check (ISO 13616 length + mod-97 checksum) so that an obviously malformed
or typo'd payee IBAN is caught before it is bound into an evidence document, and masks
the IBAN so only a non-identifying fragment is ever stored or displayed.

The payee-name↔landlord-name match is done by the caller via
``fr_2ddoc.name_matches_any`` — the same accent/order-tolerant matcher used for the
2D-Doc and insurance name cross-checks. We do not reinvent it here.
"""
from __future__ import annotations

# ISO 13616 IBAN length by country (SEPA + common). A country absent from this table
# is validated on the mod-97 checksum alone (structural length unknown, not rejected).
_IBAN_LENGTHS = {
    "AT": 20, "BE": 16, "BG": 22, "CH": 21, "CY": 28, "CZ": 24, "DE": 22, "DK": 18,
    "EE": 20, "ES": 24, "FI": 18, "FR": 27, "GB": 22, "GR": 27, "HR": 21, "HU": 28,
    "IE": 22, "IS": 26, "IT": 27, "LI": 21, "LT": 20, "LU": 20, "LV": 21, "MC": 27,
    "MT": 31, "NL": 18, "NO": 15, "PL": 28, "PT": 25, "RO": 24, "SE": 24, "SI": 19,
    "SK": 24, "SM": 27,
}


def _normalize(iban: str) -> str:
    return "".join((iban or "").split()).upper()


def _mod97(iban: str) -> int:
    # Move the first four chars to the end, map A-Z -> 10-35, take the integer mod 97.
    rearranged = iban[4:] + iban[:4]
    digits = "".join(str(int(c, 36)) if c.isalpha() else c for c in rearranged)
    return int(digits) % 97


def mask_iban(iban: str) -> str:
    """Non-identifying display form: country + check digits, middle masked, last char kept.

    e.g. ``FR7630006000011234567890189`` -> ``FR76 **** **** **** **** ***9``.
    Returns the input (normalized) unchanged if it is too short to mask meaningfully.
    """
    n = _normalize(iban)
    if len(n) <= 5:
        return n
    body = n[4:]
    masked_body = "*" * (len(body) - 1) + body[-1]
    grouped = " ".join((n[:4] + masked_body)[i : i + 4] for i in range(0, len(n), 4))
    return grouped


def validate_iban(iban: str) -> dict:
    """Offline structural validation. Returns ``{valid, country, masked, error?}``.

    NEVER stored raw — the caller keeps only ``masked``. This does not prove the account
    exists or belongs to anyone (disclosed limit in the evidence document).
    """
    n = _normalize(iban)
    # ASCII guard: str.isalpha()/isdigit()/isalnum() are Unicode-aware, but the mod-97
    # step (int(c, 36)) only accepts ASCII — reject non-ASCII here so a unicode payload
    # fails closed as invalid instead of raising downstream.
    if not n.isascii():
        return {"valid": False, "country": None, "masked": None,
                "error": "Format IBAN invalide."}
    if len(n) < 15 or not n[:2].isalpha() or not n[2:4].isdigit():
        return {"valid": False, "country": None, "masked": None,
                "error": "Format IBAN invalide."}

    country = n[:2]
    expected = _IBAN_LENGTHS.get(country)
    if expected is not None and len(n) != expected:
        return {"valid": False, "country": country, "masked": None,
                "error": f"Longueur IBAN incorrecte pour {country} (attendu {expected})."}

    if not n[4:].isalnum():
        return {"valid": False, "country": country, "masked": None,
                "error": "Caractères IBAN invalides."}

    if _mod97(n) != 1:
        return {"valid": False, "country": country, "masked": None,
                "error": "Clé de contrôle IBAN invalide (mod-97)."}

    return {"valid": True, "country": country, "masked": mask_iban(n), "error": None}
