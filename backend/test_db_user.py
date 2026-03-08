import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import sys
import os

# Ensure the app module is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.user import User

DATABASE_URL = "postgresql+asyncpg://localhost/rental_platform"

async def test():
    try:
        engine = create_async_engine(DATABASE_URL)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            result = await session.execute(select(User).limit(1))
            user = result.scalar_one_or_none()
            
            if not user:
                print("No users in DB!")
                return
                
            print(f"User email: {user.email}")
            print(f"User role type: {type(user.role)}")
            print(f"User role value: {user.role}")
            print(f"Has value attr? {hasattr(user.role, 'value')}")
            
            from app.routers.auth import get_my_segment_config
            res = await get_my_segment_config(user)
            print("Success!", res.keys())
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
