"""Cache recovers when Redis was down at boot.

A failed connect at startup used to leave redis_client None for the life of
the process: the login lockout, refresh-replay detection, the identity-doc
handoff and the Gemini quota all silently ran without Redis until a restart.
"""

import asyncio

import pytest

from app.core import cache as cache_module
from app.core.cache import CacheLayer
from app.core.config import settings


class _FakeRedis:
    pings_failing = 0

    async def ping(self):
        if _FakeRedis.pings_failing > 0:
            _FakeRedis.pings_failing -= 1
            raise ConnectionError("Connection refused")
        return True


@pytest.fixture
def fake_redis(monkeypatch):
    monkeypatch.setattr(cache_module, "REDIS_AVAILABLE", True)
    monkeypatch.setattr(cache_module, "AsyncRedis", type("R", (), {"from_url": staticmethod(lambda *a, **k: _FakeRedis())}))
    monkeypatch.setattr(settings, "REDIS_URL", "redis://example:6379/0")
    monkeypatch.setattr(CacheLayer, "_RECONNECT_DELAYS", (0.01,))


async def _wait_for(predicate, timeout=2.0):
    loop = asyncio.get_running_loop()
    end = loop.time() + timeout
    while not predicate() and loop.time() < end:
        await asyncio.sleep(0.01)


async def test_reconnects_in_background_after_boot_failure(fake_redis):
    _FakeRedis.pings_failing = 3
    layer = CacheLayer()
    await layer.connect()
    assert layer.redis_client is None  # boot attempt failed

    await _wait_for(lambda: layer.redis_client is not None)
    assert layer.redis_client is not None
    assert layer._reconnect_task.done()


async def test_no_retry_loop_when_redis_is_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "REDIS_URL", None)
    layer = CacheLayer()
    await layer.connect()
    assert layer.redis_client is None
    assert layer._reconnect_task is None


async def test_connect_succeeds_first_time_without_a_loop(fake_redis):
    _FakeRedis.pings_failing = 0
    layer = CacheLayer()
    await layer.connect()
    assert layer.redis_client is not None
    assert layer._reconnect_task is None
