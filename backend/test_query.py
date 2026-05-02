import asyncio
import uuid
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import create_async_session_maker, create_async_engine
from app.models.visits_and_leases import Lease
from app.models.property import Property
from app.core.config import settings

async def test_query():
    # Use the real DB URL if possible, or just check the SQL generation
    engine = create_async_engine(settings.DATABASE_URL)
    
    current_user_id = uuid.uuid4()
    
    landlord_props = select(Property.id).where(
        Property.landlord_id == current_user_id
    )
    
    query = select(Lease).where(
        or_(
            Lease.tenant_id == current_user_id,
            Lease.property_id.in_(landlord_props),
        )
    )
    
    print("Query generated:")
    print(query)

if __name__ == "__main__":
    asyncio.run(test_query())
