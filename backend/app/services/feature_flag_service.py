from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional
from app.models.feature_flag import FeatureFlag
from app.core.cache import cache

class FeatureFlagService:
    def __init__(self):
        pass

    async def get_flag_state(self, db: AsyncSession, name: str, default: bool = False) -> bool:
        """
        Check if feature is enabled.
        Strategy: Cache -> DB -> Default
        """
        cache_key = f"flag:{name}"
        
        # 1. Check Cache
        cached_state = await cache.get(cache_key)
        if cached_state is not None:
            return bool(cached_state)
            
        # 2. Check DB
        result = await db.execute(select(FeatureFlag).where(FeatureFlag.name == name))
        flag = result.scalar_one_or_none()
        
        if flag:
            state = flag.is_enabled
            # Cache for 60 seconds (short TTL for safety, rely on Toggle to update)
            await cache.set(cache_key, state, ttl=60)
            return state
            
        # 3. Fallback
        return default

    async def create_flag(self, db: AsyncSession, name: str, description: str = None, is_enabled: bool = False):
        # Check existing first
        stmt = select(FeatureFlag).where(FeatureFlag.name == name)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        new_flag = FeatureFlag(name=name, description=description, is_enabled=is_enabled)
        db.add(new_flag)
        try:
            await db.commit()
            await db.refresh(new_flag)
        except Exception:
            await db.rollback()
            # Race condition fallback
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        
        # Update Cache
        await cache.set(f"flag:{name}", is_enabled, ttl=60)
        return new_flag

    async def toggle_flag(self, db: AsyncSession, name: str, is_enabled: bool) -> bool:
        """Update flag and invalidate cache immediately"""
        stmt = update(FeatureFlag).where(FeatureFlag.name == name).values(is_enabled=is_enabled)
        result = await db.execute(stmt)
        await db.commit()
        
        if result.rowcount == 0:
            return False
        
        # Immediate Cache Update (Kill Switch speed)
        await cache.set(f"flag:{name}", is_enabled, ttl=60)
        return True

feature_flag_service = FeatureFlagService()
