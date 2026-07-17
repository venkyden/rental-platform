import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def delete_properties():
    from app.core.database import engine
    from app.models.property import Property
    from sqlalchemy import delete

    async with engine.connect() as conn:
        result = await conn.execute(
            delete(Property).where(Property.status == "draft")
        )
        await conn.commit()
        print(f"Deleted {result.rowcount} draft properties.")

if __name__ == "__main__":
    asyncio.run(delete_properties())
