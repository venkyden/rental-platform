"""
Tests for app.core.gemini_quota.gemini_slot — RPM pacing for Gemini calls.
"""

import asyncio
import time

from app.core.config import settings
from app.core.cache import cache
from app.core.gemini_quota import gemini_slot

_real_sleep = asyncio.sleep  # captured before any test monkeypatches it


class _FakeRedis:
    """Minimal async fake standing in for cache.redis_client."""

    def __init__(self):
        self.store: dict[str, int] = {}

    async def get(self, key):
        val = self.store.get(key)
        return str(val) if val is not None else None

    async def incr(self, key):
        self.store[key] = self.store.get(key, 0) + 1
        return self.store[key]

    async def expire(self, key, ttl):
        return True

    def pipeline(self):
        return _FakePipeline(self)


class _FakePipeline:
    def __init__(self, redis):
        self._redis = redis
        self._ops = []

    async def incr(self, key):
        self._ops.append(("incr", key))

    async def expire(self, key, ttl):
        self._ops.append(("expire", key, ttl))

    async def execute(self):
        results = []
        for op in self._ops:
            if op[0] == "incr":
                results.append(await self._redis.incr(op[1]))
            else:
                results.append(True)
        return results


async def test_unlimited_when_limit_is_zero(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_RPM_LIMIT", 0)
    # Should return immediately without touching cache at all.
    async with gemini_slot():
        pass


async def test_allows_calls_under_the_limit(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_RPM_LIMIT", 3)
    fake_redis = _FakeRedis()
    monkeypatch.setattr(cache, "redis_client", fake_redis)

    # Three calls under the limit of 3 should all proceed without delay.
    start = time.monotonic()
    for _ in range(3):
        async with gemini_slot():
            pass
    assert time.monotonic() - start < 1, "calls under the limit must not be paced"


async def test_blocks_a_second_call_over_the_limit_then_admits_it(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_RPM_LIMIT", 1)
    fake_redis = _FakeRedis()
    monkeypatch.setattr(cache, "redis_client", fake_redis)
    # Speed up the poll loop so the test doesn't take a full second per retry.
    monkeypatch.setattr("app.core.gemini_quota.asyncio.sleep", lambda _: _real_sleep(0.01))

    # Consume the only slot for the current minute.
    async with gemini_slot():
        pass

    polls = {"n": 0}
    real_get = fake_redis.get

    async def _get_then_clear(key):
        # First couple of polls see the bucket still full; then it clears,
        # simulating the minute rolling over while the caller was waiting.
        polls["n"] += 1
        if polls["n"] >= 3:
            fake_redis.store.pop(key, None)
        return await real_get(key)

    monkeypatch.setattr(fake_redis, "get", _get_then_clear)

    start = time.monotonic()
    async with gemini_slot():
        pass
    elapsed = time.monotonic() - start
    assert elapsed > 0, "second call over the limit should have had to wait"
    assert polls["n"] >= 3, "pacer should have polled more than once before admitting the call"


async def test_gives_up_waiting_after_max_wait_and_proceeds_anyway(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_RPM_LIMIT", 1)
    monkeypatch.setattr("app.core.gemini_quota._RPM_MAX_WAIT_SECONDS", 0.05)
    monkeypatch.setattr("app.core.gemini_quota.asyncio.sleep", lambda _: _real_sleep(0.01))
    fake_redis = _FakeRedis()
    monkeypatch.setattr(cache, "redis_client", fake_redis)

    # Consume the only slot; it never frees up again within this test.
    async with gemini_slot():
        pass

    # Pacing must fail open: give up waiting and let the request through
    # rather than hang forever when Gemini's real limit is genuinely saturated.
    start = time.monotonic()
    async with gemini_slot():
        pass
    assert time.monotonic() - start < 1


async def test_falls_back_to_local_semaphore_without_redis(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_RPM_LIMIT", 5)
    monkeypatch.setattr(cache, "redis_client", None)

    # Should not raise and should not hang for a single call.
    async with gemini_slot():
        pass
