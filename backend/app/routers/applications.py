"""
API endpoints for managing Rental Applications (Candidatures).
"""

from datetime import datetime
from app.core.timeutils import naive_utcnow
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.application import Application, ApplicationStatus
from app.models.property import Property
from app.models.schemas import ApplicationCreate, ApplicationResponse
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.post(
    "", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED
)
async def create_application(
    application_in: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a new application for a property"""

    # 1. Check if property exists
    result = await db.execute(
        select(Property).where(Property.id == application_in.property_id)
    )
    property_obj = result.scalar_one_or_none()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    # 2. Check if already applied
    result = await db.execute(
        select(Application)
        .where(Application.tenant_id == current_user.id)
        .where(Application.property_id == application_in.property_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400, detail="You have already applied to this property"
        )

    # 3. Create Application
    new_app = Application(
        tenant_id=current_user.id,
        property_id=application_in.property_id,
        status=ApplicationStatus.PENDING,
        cover_letter=application_in.cover_letter,
    )

    db.add(new_app)
    await db.commit()

    # Load with details for response and notifications
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.tenant),
            selectinload(Application.property)
        )
        .where(Application.id == new_app.id)
    )
    new_app = result.scalar_one()

    # Notify Landlord
    notification_service = NotificationService(db)
    await notification_service.notify_application_received(
        landlord_id=new_app.property.landlord_id,
        tenant_name=current_user.full_name or current_user.email,
        property_title=new_app.property.title,
        application_id=new_app.id,
    )

    return new_app


@router.get("/me", response_model=List[ApplicationResponse])
async def list_my_applications(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """List applications submitted by the current user"""
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.tenant),
            selectinload(Application.property)
        )
        .where(Application.tenant_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    return result.scalars().all()


@router.get("/received", response_model=List[ApplicationResponse])
async def list_received_applications(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """List applications received for my properties (Landlord)"""
    # Join with Property to filter by landlord_id
    result = await db.execute(
        select(Application)
        .join(Application.property)
        .options(
            selectinload(Application.tenant),
            selectinload(Application.property)
        )
        .where(Property.landlord_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed application by ID"""
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.tenant),
            selectinload(Application.property)
        )
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Authorize: Only the applying tenant or the property landlord can view it
    if (application.tenant_id != current_user.id and 
        application.property.landlord_id != current_user.id):
        raise HTTPException(
            status_code=403, detail="Not authorized to view this application"
        )

    return application


class ApplicationUpdate(PydanticBaseModel):
    status: ApplicationStatus


@router.patch("/{application_id}", response_model=ApplicationResponse)
async def update_application_status(
    application_id: UUID,
    update_data: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update application status (Landlord only)"""
    # 1. Get Application + Property + Tenant
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.property),
            selectinload(Application.tenant)
        )
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # 2. Verify Ownership
    if application.property.landlord_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to manage this application"
        )

    # 3. Update
    application.status = update_data.status
    application.updated_at = naive_utcnow()

    await db.commit()
    await db.refresh(application)

    # Send notification
    notification_service = NotificationService(db)
    await notification_service.notify_application_status_changed(
        tenant_id=application.tenant_id,
        property_title=application.property.title,
        new_status=update_data.status.value,
        application_id=application.id,
    )

    return application


@router.delete("/{application_id}", response_model=ApplicationResponse)
async def withdraw_application(
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Withdraw application (Tenant applicant only)"""
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.tenant),
            selectinload(Application.property)
        )
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Only applicant can withdraw
    if application.tenant_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the applying tenant can withdraw this application"
        )

    application.status = ApplicationStatus.WITHDRAWN
    application.updated_at = naive_utcnow()

    await db.commit()
    await db.refresh(application)

    # Notify Landlord
    notification_service = NotificationService(db)
    await notification_service.create_notification(
        user_id=application.property.landlord_id,
        notification_type="application",
        title="Application Withdrawn",
        message=f"The application for {application.property.title} was withdrawn by the applicant.",
        action_url=f"/applications/received"
    )

    return application
