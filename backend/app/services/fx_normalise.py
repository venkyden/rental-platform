"""
FX normalisation for INTL solvency rail.

Primary: Frankfurter API (ECB-backed, free), cached 24h in Redis by currency+date.
Fallback: static table of 29 currencies — update quarterly.
Unavailable: currency not in table + API down -> eur_amount=None, source='unavailable'.

5% margin applied at every path — labelled 'currency volatility buffer' (art. 225-2 safe,
never varies by currency or country of origin).
"""
import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional

import httpx

from app.core.cache import cache

logger = logging.getLogger(__name__)

FRANKFURTER_URL = "https://api.frankfurter.app/latest"
_FX_CACHE_TTL = 86_400  # 24 hours
_MARGIN = 0.05
_MARGIN_LABEL = "currency volatility buffer"

# Static fallback rates: 1 unit foreign currency = N EUR.
# Approximate ECB mid-market rates — update quarterly.
_STATIC_RATES: dict[str, float] = {
    "USD": 0.93, "GBP": 1.19, "CHF": 1.07, "CAD": 0.70, "AUD": 0.62,
    "SEK": 0.088, "NOK": 0.088, "DKK": 0.134,
    "PLN": 0.232, "CZK": 0.041, "HUF": 0.0026, "RON": 0.201,
    "MAD": 0.093, "DZD": 0.0069, "TND": 0.29,
    "INR": 0.011, "PKR": 0.0034, "BDT": 0.0079, "LKR": 0.0029, "NPR": 0.0069,
    "VND": 0.000037, "PHP": 0.016, "IDR": 0.000057, "THB": 0.026,
    "MYR": 0.20, "SGD": 0.69,
    "CNY": 0.13, "JPY": 0.0062, "KRW": 0.00068,
}


@dataclass
class FXResult:
    eur_amount: Optional[float]
    currency: str
    rate: Optional[float]
    margin_applied: float
    fx_source: str
    fx_margin_label: str


async def convert_to_eur(amount: float, currency_code: str) -> FXResult:
    """
    Convert foreign-currency monthly amount to EUR with 5% volatility margin.
    Plan B chain: Redis cache -> Frankfurter -> static table -> UNVERIFIED.
    Never raises.
    """
    code = currency_code.upper()

    if code == "EUR":
        return FXResult(
            eur_amount=round(amount * (1 - _MARGIN), 2), currency=code,
            rate=1.0, margin_applied=_MARGIN, fx_source="live",
            fx_margin_label=_MARGIN_LABEL,
        )

    today = date.today().isoformat()
    cache_key = f"fx_rate:{code}:{today}"

    if cache.redis_client:
        cached = await cache.get(cache_key)
        if cached and isinstance(cached, dict):
            return _make_result(amount, code, float(cached["rate"]), cached.get("source", "live"))

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(FRANKFURTER_URL, params={"from": code, "to": "EUR"})
            resp.raise_for_status()
            rate = float(resp.json()["rates"]["EUR"])
            if cache.redis_client:
                await cache.set(cache_key, {"rate": rate, "source": "live"}, ttl=_FX_CACHE_TTL)
            return _make_result(amount, code, rate, "live")
    except Exception as exc:
        logger.warning("Frankfurter FX lookup failed for %s: %s", code, exc)

    static_rate = _STATIC_RATES.get(code)
    if static_rate is not None:
        if cache.redis_client:
            await cache.set(cache_key, {"rate": static_rate, "source": "static"}, ttl=_FX_CACHE_TTL)
        return _make_result(amount, code, static_rate, "static")

    logger.warning("FX rate unavailable for %s", code)
    return FXResult(
        eur_amount=None, currency=code, rate=None,
        margin_applied=_MARGIN, fx_source="unavailable",
        fx_margin_label=_MARGIN_LABEL,
    )


def _make_result(amount: float, code: str, rate: float, source: str) -> FXResult:
    return FXResult(
        eur_amount=round(amount * rate * (1 - _MARGIN), 2), currency=code,
        rate=rate, margin_applied=_MARGIN, fx_source=source,
        fx_margin_label=_MARGIN_LABEL,
    )


def band_solvency_ratio(ratio: float) -> str:
    """Band a computed solvency ratio (post-margin). Never round up. SV-7."""
    if ratio >= 3.0:
        return ">=3.0"
    if ratio >= 2.0:
        return ">=2.0"
    return "<2.0"


def band_funds_coverage(eur_funds: float, monthly_rent: float) -> str:
    """Band available funds by months of rent covered. Never round up.

    Mirrors band_solvency_ratio's floor-not-ceiling discipline: a value on the
    boundary lands in the band it meets, never the one above.
    """
    if not monthly_rent or monthly_rent <= 0:
        return "amount_only"
    months = eur_funds / monthly_rent
    if months >= 12:
        return "covers_12m_plus"
    if months >= 6:
        return "covers_6m"
    if months >= 3:
        return "covers_3m"
    return "covers_under_3m"


def normalise_income_to_monthly(
    amount: float, income_period: str
) -> tuple[float, str, bool]:
    """
    Normalise income to monthly equivalent.
    Returns (normalised_amount, normalised_period, income_period_unclear).
    """
    if income_period == "annual":
        return round(amount / 12, 2), "monthly", False
    if income_period == "monthly":
        return amount, "monthly", False
    return amount, income_period, True
