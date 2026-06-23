"""
Daily Gemini API quota guard.

Uses Redis INCR + EXPIRE for an atomic distributed counter.
Falls back to a per-process in-memory counter when Redis is unavailable
(non-atomic across workers, but prevents runaway usage in single-worker deploys).
"""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory fallback state
_fallback: dict = {"date": None, "count": 0}


def _today_key() -> str:
    return "gemini:daily:" + datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _increment_fallback() -> int:
    today = datetime.now(timezone.utc).date()
    if _fallback["date"] != today:
        _fallback["date"] = today
        _fallback["count"] = 0
    _fallback["count"] += 1
    return _fallback["count"]


async def check_quota() -> None:
    """
    Increment the daily Gemini request counter and raise HTTP 503 if the
    configured limit is exceeded. Call once per document verification attempt.
    """
    limit = settings.GEMINI_DAILY_LIMIT
    if limit <= 0:
        return  # 0 or negative = unlimited (useful in tests)

    try:
        from app.core.cache import cache
        if cache.redis_client:
            count = await cache.incr_with_expire(_today_key(), 90000)
        else:
            count = _increment_fallback()
    except Exception as e:
        logger.warning("Gemini quota check failed, allowing request: %s", e)
        return

    logger.debug("Gemini daily usage: %d / %d", count, limit)

    if count > limit:
        logger.error("Gemini daily quota exceeded: %d > %d", count, limit)
        raise HTTPException(
            status_code=503,
            detail="Document verification is temporarily unavailable due to high demand. Please try again tomorrow.",
        )


async def get_usage() -> dict:
    """Return current daily usage — exposed via the health endpoint."""
    try:
        from app.core.cache import cache
        if cache.redis_client:
            raw_val = await cache.redis_client.get(_today_key())
            count = int(raw_val) if raw_val is not None else 0
        else:
            today = datetime.now(timezone.utc).date()
            count = _fallback["count"] if _fallback["date"] == today else 0
    except Exception:
        count = -1  # unknown

    return {"used": count, "limit": settings.GEMINI_DAILY_LIMIT}
