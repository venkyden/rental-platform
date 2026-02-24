import asyncio
import os
import sys
from datetime import date, datetime
from uuid import uuid4

# Add the backend directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select

import app.models.dispute
import app.models.document
import app.models.feature_flag
import app.models.feedback
import app.models.inventory
import app.models.messages
import app.models.notification
import app.models.property_manager
import app.models.team
import app.models.user
import app.models.visits_and_leases
import app.models.webhook_subscriptions
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.application import Application, ApplicationStatus
from app.models.property import Property
from app.models.user import User, UserRole


async def main():
    async with AsyncSessionLocal() as db:
        # Create Landlord
        stmt = select(User).where(User.email == "landlord-test@example.com")
        res = await db.execute(stmt)
        landlord = res.scalar_one_or_none()
        if not landlord:
            landlord = User(
                email="landlord-test@example.com",
                hashed_password=get_password_hash("password123"),
                role=UserRole.LANDLORD,
                full_name="Jean Dupont (Test Landlord)",
                email_verified=True,
                identity_verified=True,
            )
            db.add(landlord)
            await db.commit()
            await db.refresh(landlord)
            print("Created Landlord")

        # Create Tenant
        stmt = select(User).where(User.email == "tenant-test@example.com")
        res = await db.execute(stmt)
        tenant = res.scalar_one_or_none()
        if not tenant:
            tenant = User(
                email="tenant-test@example.com",
                hashed_password=get_password_hash("password123"),
                role=UserRole.TENANT,
                full_name="Marie Martin (Test Tenant)",
                email_verified=True,
                identity_verified=True,
            )
            db.add(tenant)
            await db.commit()
            await db.refresh(tenant)
            print("Created Tenant")

        # Create Property
        stmt = select(Property).where(Property.title == "Appartement Test")
        res = await db.execute(stmt)
        prop = res.scalar_one_or_none()
        if not prop:
            prop = Property(
                landlord_id=landlord.id,
                title="Appartement Test",
                description="Test property for lease generation",
                property_type="apartment",
                address_line1="123 Rue de Test",
                city="Paris",
                postal_code="75001",
                bedrooms=1,
                bathrooms=1,
                size_sqm=40.5,
                monthly_rent=1000.0,
                deposit=2000.0,
                charges=50.0,
                status="active",
            )
            db.add(prop)
            await db.commit()
            await db.refresh(prop)
            print("Created Property")

        # Create Application
        stmt = select(Application).where(
            Application.tenant_id == tenant.id, Application.property_id == prop.id
        )
        res = await db.execute(stmt)
        app = res.scalar_one_or_none()
        if not app:
            app = Application(
                tenant_id=tenant.id,
                property_id=prop.id,
                status=ApplicationStatus.APPROVED.value,
                cover_letter="Test application",
            )
            db.add(app)
            await db.commit()
            print("Created Application")

        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
