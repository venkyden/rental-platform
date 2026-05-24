import asyncio
import os
import sys
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

async def inspect_db():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set!")
        return

    # Normalize url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    print(f"Connecting to database to inspect schema...")
    try:
        engine = create_async_engine(url)
        async with engine.connect() as conn:
            # Query alembic_version
            try:
                res = await conn.execute(text("SELECT version_num FROM alembic_version"))
                versions = res.scalars().all()
                print(f"--- Alembic Versions in DB: {versions} ---")
            except Exception as e:
                print(f"--- Alembic version table check failed: {e} ---")

            def do_inspect(sync_conn):
                inspector = inspect(sync_conn)
                tables = inspector.get_table_names()
                print(f"Tables in DB: {tables}")
                for table in ["users", "properties"]:
                    if table in tables:
                        cols = inspector.get_columns(table)
                        col_names = [c["name"] for c in cols]
                        print(f"Columns in '{table}': {col_names}")
                    else:
                        print(f"Table '{table}' does not exist.")

            await conn.run_sync(do_inspect)
    except Exception as e:
        print(f"Error during inspection: {e}")

if __name__ == "__main__":
    asyncio.run(inspect_db())
