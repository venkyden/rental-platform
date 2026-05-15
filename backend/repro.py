import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

async def test_sqlalchemy_query():
    try:
        from sqlalchemy import select, func, and_
        from app.models.user import User
        from app.core.database import AsyncSessionLocal
        
        print(f"Testing query with User.identity_verified...")
        stmt = select(func.count(User.id)).where(
            and_(User.role == "landlord", User.identity_verified == True)
        )
        print(f"Statement: {stmt}")
        
        # We don't need a real DB to test if the statement can be compiled
        from app.core.database import engine
        async with engine.connect() as conn:
             # Just compile it
             compiled = stmt.compile(engine.sync_engine)
             print("Query compiled successfully!")
             
    except Exception as e:
        print(f"Query test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_sqlalchemy_query())
