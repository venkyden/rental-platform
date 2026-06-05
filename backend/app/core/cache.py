"""
Redis Caching Layer - Netflix Style
Provides distributed caching with automatic invalidation and TTL management.
"""

import hashlib
import json
import logging
import os
from functools import wraps
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# Optional Redis import - graceful fallback if not installed
try:
    from redis.asyncio import Redis as AsyncRedis

    REDIS_AVAILABLE = True
except ImportError:
    try:
        # Older redis package: redis < 4.2 ships asyncio under redis.asyncio too,
        # but if completely absent fall back gracefully.
        AsyncRedis = None  # type: ignore
        REDIS_AVAILABLE = False
    except Exception:
        AsyncRedis = None  # type: ignore
        REDIS_AVAILABLE = False


class CacheLayer:
    """
    Netflix-style caching layer with:
    - Automatic serialization/deserialization
    - Cache-aside pattern
    - TTL management
    - Cache invalidation
    - Graceful degradation

    Uses redis.asyncio so all I/O is non-blocking and safe inside an async
    event loop (the previous sync redis.Redis client would block the loop).
    """

    def __init__(self):
        self.redis_client: Optional[AsyncRedis] = None  # type: ignore
        # Connection is deferred to first use (or explicit connect call)
        # because __init__ cannot be async. Call await cache.connect() on
        # startup, or let the first operation lazily connect.
        self._connected = False

    async def connect(self):
        """Async connect to Redis. Call once from app startup."""
        if self._connected:
            return
        await self._connect()

    async def _connect(self):
        """Connect to Redis if available"""
        if not REDIS_AVAILABLE or AsyncRedis is None:
            logger.warning("Redis not installed. Running without cache (pip install redis>=4.2)")
            return

        from app.core.config import settings
        redis_url = settings.REDIS_URL
        if not redis_url:
            logger.warning("REDIS_URL not set. Running without cache.")
            return

        ssl_kwargs = {}
        if redis_url.startswith("rediss://"):
            ssl_kwargs["ssl_cert_reqs"] = None

        for attempt in range(2):
            try:
                import asyncio
                client = AsyncRedis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_timeout=5,
                    socket_connect_timeout=5,
                    **ssl_kwargs,
                )
                await client.ping()
                self.redis_client = client
                self._connected = True
                logger.info("✅ Redis cache connected (async)")
                return
            except Exception as e:
                error_msg = str(e)
                dns_error = any(s in error_msg for s in (
                    "Name or service not known",
                    "nodename nor servname",
                    "Name does not resolve",
                ))
                if attempt == 0 and dns_error:
                    logger.warning("⚠️ Redis DNS resolution failed (attempt 1/2), retrying in 2s...")
                    import asyncio as _asyncio
                    await _asyncio.sleep(2)
                    continue

                # Final failure
                self.redis_client = None
                if dns_error:
                    logger.error(
                        "⚠️ Redis connection failed: DNS cannot resolve the host. "
                        "The Redis instance may have been deleted or the URL is stale. "
                        "Check your Upstash/Redis dashboard and update REDIS_URL. "
                        "Running without cache."
                    )
                else:
                    logger.error(f"⚠️ Redis connection failed: {e}. Running without cache.")
                return

    def _make_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from function arguments"""
        key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True)
        key_hash = hashlib.md5(key_data.encode()).hexdigest()[:12]
        return f"{prefix}:{key_hash}"

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.redis_client:
            return None
        try:
            value = await self.redis_client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.error(f"Cache get error: {e}")
        return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL (default 5 minutes)"""
        if not self.redis_client:
            return False
        try:
            await self.redis_client.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.redis_client:
            return False
        try:
            await self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern"""
        if not self.redis_client:
            return 0
        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                return await self.redis_client.delete(*keys)
        except Exception as e:
            logger.error(f"Cache invalidate error: {e}")
        return 0

    async def incr_with_expire(self, key: str, ttl: int) -> int:
        """Atomically increment a counter and set TTL on first write. Returns new count."""
        if not self.redis_client:
            return 0
        try:
            pipe = self.redis_client.pipeline()
            await pipe.incr(key)
            await pipe.expire(key, ttl)
            results = await pipe.execute()
            return int(results[0])
        except Exception as e:
            logger.error(f"Cache incr error: {e}")
            return 0

    def cached(self, prefix: str, ttl: int = 300):
        """
        Decorator for caching function results.

        Usage:
            @cache.cached("properties", ttl=600)
            async def get_property(property_id: str):
                return await db.fetch_property(property_id)
        """

        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Generate cache key
                cache_key = self._make_key(prefix, *args, **kwargs)

                # Try cache first
                cached_value = await self.get(cache_key)
                if cached_value is not None:
                    return cached_value

                # Execute function
                result = await func(*args, **kwargs)

                # Cache result
                if result is not None:
                    await self.set(cache_key, result, ttl)

                return result

            return wrapper

        return decorator


# Global cache instance
cache = CacheLayer()


# Convenience functions
async def get_cached_property(property_id: str):
    """Example: Get property with caching"""
    cache_key = f"property:{property_id}"

    cached = await cache.get(cache_key)
    if cached:
        return cached

    # Fetch from DB (placeholder)
    # property_data = await db.get_property(property_id)
    # await cache.set(cache_key, property_data, ttl=300)
    # return property_data
    return None


async def invalidate_property_cache(property_id: str):
    """Invalidate property cache after updates"""
    await cache.delete(f"property:{property_id}")
    await cache.invalidate_pattern(f"properties:*")  # Invalidate listings


async def invalidate_user_cache(user_id: str):
    """Invalidate user-related caches"""
    await cache.invalidate_pattern(f"user:{user_id}:*")
