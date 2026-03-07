import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../backend'))

from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.property import Property, PropertyMedia, PropertyMediaSession

async def main():
    property_id = "44b4a106-e5e0-4ae6-9e40-37f5b3d0365a"
    
    async with SessionLocal() as db:
        # Check property
        result = await db.execute(select(Property).where(Property.id == property_id))
        prop = result.scalar_one_or_none()
        
        if not prop:
            print(f"Property {property_id} NOT FOUND.")
            return
            
        print(f"Property found: {prop.title}")
        print(f"Photos JSONB: {prop.photos}")
        
        # Check sessions
        result = await db.execute(select(PropertyMediaSession).where(PropertyMediaSession.property_id == property_id))
        sessions = result.scalars().all()
        print(f"\nFound {len(sessions)} media sessions:")
        for s in sessions:
            print(f" - {s.id} (code: {s.verification_code}, verified: {s.location_verified})")
            
        # Check media
        result = await db.execute(select(PropertyMedia).where(PropertyMedia.property_id == property_id))
        media = result.scalars().all()
        print(f"\nFound {len(media)} media records:")
        for m in media:
            print(f" - {m.id} (url: {m.file_url}, status: {m.verification_status}, room: {m.room_label})")

if __name__ == "__main__":
    asyncio.run(main())
