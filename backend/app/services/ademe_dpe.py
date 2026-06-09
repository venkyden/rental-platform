"""
ADEME DPE open-data lookup service (DOSSIER §5.4, sub-feature #5).

Reads the DPE energy class from the live ADEME API — never hard-coded (PR-3:
the Jan 2026 coefficient reclassification means cached/hard-coded classes are wrong).
"""
import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ADEME open-data DPE endpoint for existing dwellings.
ADEME_DPE_URL = (
    "https://data.ademe.fr/data-fair/api/v1/datasets/"
    "dpe-v2-logements-existants/lines"
)
_TIMEOUT_SECONDS = 10.0
_VALID_CLASSES = set("ABCDEFG")

# DPEs established before July 2021 used the old methodology (loi Climat);
# they are treated as expired regardless of their stated validity date (PR-5).
_OLD_DPE_CUTOFF = date(2021, 7, 1)


# ── errors ───────────────────────────────────────────────────────────────────

class ADEMEError(Exception):
    """Base ADEME lookup error."""


class ADEMEUnavailable(ADEMEError):
    """4xx/5xx / timeout — non-blocking; caller marks the result as PENDING (PR-6)."""


class DPENotFound(ADEMEError):
    """DPE number not in ADEME database — result is UNVERIFIED (PR-4)."""


class InvalidDPENumber(ADEMEError):
    """DPE number format is invalid."""


# ── result ───────────────────────────────────────────────────────────────────

@dataclass
class DPEResult:
    dpe_number: str
    energy_class: str            # A–G (never H — ADEME scale has no H, PR-2)
    established_date: Optional[date]
    valid_until: Optional[date]
    expired: bool                # past valid_until OR old-methodology (PR-5)
    address_line: Optional[str]  # for landlord address corroboration
    assurance: str               # "HIGH" (live ADEME) always when returned


# ── helpers ──────────────────────────────────────────────────────────────────

def _parse_date(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(raw[:10], fmt).date()
        except ValueError:
            continue
    return None


def _is_expired(established: Optional[date], valid_until: Optional[date]) -> bool:
    today = date.today()
    if established and established < _OLD_DPE_CUTOFF:
        return True   # old-methodology DPE always expired (PR-5)
    if valid_until and today > valid_until:
        return True
    return False


# ── lookup ───────────────────────────────────────────────────────────────────

async def lookup_dpe(
    dpe_number: str,
    *,
    http_client: Optional[httpx.AsyncClient] = None,
) -> DPEResult:
    """
    Look up a DPE by its ADEME identifier via the open-data API.

    http_client is injectable for testing without real HTTP calls.

    Raises:
        InvalidDPENumber  — format obviously wrong (empty / non-alphanumeric)
        ADEMEUnavailable  — 4xx/5xx or timeout; caller should treat as PENDING (PR-6)
        DPENotFound       — no matching record; caller should treat as UNVERIFIED (PR-4)
    """
    clean = (dpe_number or "").strip()
    if not clean or len(clean) < 6 or not clean.replace("-", "").replace(" ", "").isalnum():
        raise InvalidDPENumber(f"DPE number format invalid: {clean!r}")

    params = {
        "qs": f"numero_dpe:{clean}",
        "size": 1,
        "select": "numero_dpe,etiquette_dpe,date_etablissement_dpe,date_fin_validite_dpe,adresse_ban",
    }

    own_client = http_client is None
    client = http_client or httpx.AsyncClient(timeout=_TIMEOUT_SECONDS)
    try:
        try:
            resp = await client.get(ADEME_DPE_URL, params=params)
        except httpx.TimeoutException as exc:
            raise ADEMEUnavailable("ADEME API timeout") from exc
        except httpx.RequestError as exc:
            raise ADEMEUnavailable(f"ADEME API request error: {exc}") from exc

        if resp.status_code >= 400:
            raise ADEMEUnavailable(f"ADEME API HTTP {resp.status_code}")
        data = resp.json()
    finally:
        if own_client:
            await client.aclose()

    results = data.get("results", [])
    if not results:
        raise DPENotFound(f"DPE {clean!r} not found in ADEME database")

    row = results[0]
    raw_class = (row.get("etiquette_dpe") or "").upper().strip()

    # PR-2: scale is A–G only; "H" does not exist — reject if ADEME returns garbage.
    if raw_class not in _VALID_CLASSES:
        raise DPENotFound(f"DPE {clean!r} returned unrecognised class {raw_class!r}")

    established = _parse_date(row.get("date_etablissement_dpe"))
    valid_until = _parse_date(row.get("date_fin_validite_dpe"))
    expired = _is_expired(established, valid_until)
    address_line = row.get("adresse_ban") or None

    return DPEResult(
        dpe_number=clean,
        energy_class=raw_class,
        established_date=established,
        valid_until=valid_until,
        expired=expired,
        address_line=address_line,
        assurance="HIGH",
    )
