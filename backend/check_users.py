import asyncio

from sqlalchemy import select

import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.database import AsyncSessionLocal
from app.models.user import User


async def run():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User))
        users = res.scalars().all()
        for u in users:
            print(u.email, u.role)


asyncio.run(run())
