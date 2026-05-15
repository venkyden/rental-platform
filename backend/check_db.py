import asyncio
import sys
import os
from sqlalchemy import inspect

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

async def check_db_schema():
    try:
        from app.core.database import engine
        async with engine.connect() as conn:
            def get_cols(sync_conn):
                inspector = inspect(sync_conn)
                return inspector.get_columns('users')
            
            columns = await conn.run_sync(get_cols)
            print("Columns in 'users' table:")
            for c in columns:
                print(f"  - {c['name']}")
    except Exception as e:
        print(f"Failed to check DB schema: {e}")

if __name__ == "__main__":
    asyncio.run(check_db_schema())
