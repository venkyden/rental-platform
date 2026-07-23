"""
Daily Gemini API quota guard, and per-minute request pacing.

Uses Redis INCR + EXPIRE for an atomic distributed counter.
Falls back to a per-process in-memory counter when Redis is unavailable
(non-atomic across workers, but prevents runaway usage in single-worker deploys).
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory fallback state
_fallback: dict = {"date": None, "count": 0}

# Per-process fallback for RPM pacing when Redis is unavailable — cannot
# coordinate across worker processes, but still prevents a single process
# from firing unbounded concurrent Gemini calls.
_RPM_MAX_WAIT_SECONDS = 45
_local_rpm_semaphore = asyncio.Semaphore(2)


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


def _minute_key() -> str:
    return "gemini:rpm:" + str(int(time.time() // 60))


@asynccontextmanager
async def gemini_slot():
    """
    Pace Gemini calls to stay under GEMINI_RPM_LIMIT requests per rolling
    minute, coordinated across worker processes via Redis.

    A burst of concurrent KYC uploads (stress test, or a real traffic spike)
    fires every request at once; each one independently hits Gemini's own
    per-minute rate limit at the same moment, so every request in the burst
    exhausts its own retry budget together and fails as a group. Smoothing
    admission here means the burst queues and drains instead of failing
    wholesale.

    Falls back to a per-process semaphore (best-effort, not coordinated
    across workers) when Redis is unavailable. Gives up waiting after
    GEMINI_RPM_LIMIT-derived backoff and lets the request through anyway —
    this paces load, it is not a hard cap; the caller's own retry/error
    handling remains the final safety net.
    """
    limit = settings.GEMINI_RPM_LIMIT
    if limit <= 0:
        yield  # 0 or negative = unlimited (useful in tests)
        return

    from app.core.cache import cache

    if not cache.redis_client:
        await _local_rpm_semaphore.acquire()
        try:
            yield
        finally:
            _local_rpm_semaphore.release()
        return

    deadline = time.monotonic() + _RPM_MAX_WAIT_SECONDS
    while True:
        try:
            raw = await cache.redis_client.get(_minute_key())
            current = int(raw) if raw else 0
            if current < limit:
                await cache.incr_with_expire(_minute_key(), 60)
                break
        except Exception as e:
            logger.warning("Gemini RPM pacer check failed, allowing request: %s", e)
            break

        if time.monotonic() >= deadline:
            logger.warning(
                "Gemini RPM pacer: no slot freed up after %ss, proceeding anyway",
                _RPM_MAX_WAIT_SECONDS,
            )
            break
        await asyncio.sleep(1)

    yield


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
