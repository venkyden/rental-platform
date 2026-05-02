import asyncio
from app.core.database import engine
from sqlalchemy import text

async def check_leases():
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT * FROM leases LIMIT 5"))
            columns = result.keys()
            print(f"Columns: {list(columns)}")
            rows = result.fetchall()
            for row in rows:
                print(row)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_leases())
