import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def count_properties():
    from app.core.database import engine
    from app.models.property import Property
    from sqlalchemy import select, func

    async with engine.connect() as conn:
        result = await conn.execute(
            select(Property.status, func.count(Property.id)).group_by(Property.status)
        )
        counts = result.fetchall()
        print("Property counts by status:")
        for status, count in counts:
            print(f"  - {status}: {count}")

        # total properties
        result_total = await conn.execute(select(func.count(Property.id)))
        print(f"Total: {result_total.scalar()}")

if __name__ == "__main__":
    asyncio.run(count_properties())
