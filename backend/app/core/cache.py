"""
Redis Caching Layer - Netflix Style
Provides distributed caching with automatic invalidation and TTL management.
"""

import hashlib
import json
import os
from functools import wraps
from typing import Any, Callable, Optional

# Optional Redis import - graceful fallback if not installed
try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False


class CacheLayer:
    """
    Netflix-style caching layer with:
    - Automatic serialization/deserialization
    - Cache-aside pattern
    - TTL management
    - Cache invalidation
    - Graceful degradation
    """

    def __init__(self):
        self.redis_client = None
        self._connect()

    def _connect(self):
        """Connect to Redis if available"""
        if not REDIS_AVAILABLE:
            print("⚠️ Redis not installed. Running without cache (pip install redis)")
            return

        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                self.redis_client = redis.Redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_timeout=5,
                    socket_connect_timeout=5,
                )
                # Test connection
                self.redis_client.ping()
                print("✅ Redis cache connected")
            except Exception as e:
                print(f"⚠️ Redis connection failed: {e}. Running without cache.")
                self.redis_client = None
        else:
            print("⚠️ REDIS_URL not set. Running without cache.")

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
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            print(f"Cache get error: {e}")
        return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL (default 5 minutes)"""
        if not self.redis_client:
            return False
        try:
            self.redis_client.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.redis_client:
            return False
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern"""
        if not self.redis_client:
            return 0
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
        except Exception as e:
            print(f"Cache invalidate error: {e}")
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
