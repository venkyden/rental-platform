import os

from sqlalchemy.ext.asyncio import (AsyncSession, async_sessionmaker,
                                    create_async_engine)
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import QueuePool

from app.core.config import settings

# Netflix-style connection pooling for high load
# Adjust these based on your database limits
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "30"))

# Render provides `postgres://` but we need `postgresql+asyncpg://`
url = settings.DATABASE_URL
if url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql+asyncpg://", 1)
elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
    url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Create async engine with connection pooling
engine = create_async_engine(
    url,
    echo=os.getenv("DB_ECHO", "false").lower() == "true",  # Disable in production
    future=True,
    # Connection pool settings
    pool_size=POOL_SIZE,  # Base number of connections
    max_overflow=MAX_OVERFLOW,  # Extra connections under load
    pool_timeout=30,  # Wait for connection before error
    pool_recycle=1800,  # Recycle connections every 30 min
    pool_pre_ping=True,  # Health check connections
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Base class for models
Base = declarative_base()


# Dependency to get DB session
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
