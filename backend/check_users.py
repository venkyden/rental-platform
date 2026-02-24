from app.database import SessionLocal
from app.models.user import User
from sqlalchemy import select
import asyncio

async def run():
    async with SessionLocal() as db:
        res = await db.execute(select(User))
        users = res.scalars().all()
        for u in users:
            print(u.email, u.role)

asyncio.run(run())
