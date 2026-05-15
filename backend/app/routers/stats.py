"""
Analytics and Statistics API router.
Aggregates data for dashboards — Overview, Alerts, Revenue Chart.
"""

from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Float, and_, case, cast, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.application import Application
from app.models.messages import Conversation
from app.models.property import Property
from app.models.user import User
from app.models.visits_and_leases import Lease
from app.routers.auth import get_current_user

router = APIRouter(prefix="/stats", tags=["Stats"])


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────


class LandlordStats(BaseModel):
    active_properties: int
    pending_applications: int
    total_views: int
    unread_messages: int
    revenue: float
    occupancy_rate: float


class TenantStats(BaseModel):
    total_applications: int
    scheduled_visits: int
    active_disputes: int
    trust_score: int


class AlertItem(BaseModel):
    type: str  # "expiring_lease" | "pending_application" | "unread_messages" | "vacant_property"
    severity: str  # "critical" | "warning" | "info"
    title: str
    description: str
    count: int
    action_url: str  # Frontend route to navigate to


class AlertsResponse(BaseModel):
    total_alerts: int
    alerts: List[AlertItem]


class PublicStats(BaseModel):
    total_properties: int
    verified_landlords: int
    matches_last_30_days: int
    active_cities: int


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────


def _require_landlord(user: User):
    if user.role not in ["landlord", "property_manager", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only landlords or managers can access these stats"
        )


# ──────────────────────────────────────────────
# 1. Overview (existing, improved)
# ──────────────────────────────────────────────


@router.get("/landlord/overview", response_model=LandlordStats)
async def get_landlord_stats(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Get high-level stats for landlord dashboard."""
    _require_landlord(current_user)

    # 1. Properties count
    result_props = await db.execute(
        select(func.count(Property.id)).where(Property.landlord_id == current_user.id)
    )
    total_properties = result_props.scalar_one_or_none() or 0

    # 2. Total Views & Potential Revenue
    result_views_rev = await db.execute(
        select(func.sum(Property.views_count), func.sum(Property.monthly_rent)).where(
            Property.landlord_id == current_user.id
        )
    )
    row = result_views_rev.fetchone()
    if row:
        total_views, potential_revenue = row
    else:
        total_views, potential_revenue = 0, 0.0
    
    total_views = total_views or 0
    potential_revenue = potential_revenue or 0.0

    # 3. Pending Applications
    result_apps = await db.execute(
        select(func.count(Application.id))
        .join(Application.property)
        .where(
            and_(
                Property.landlord_id == current_user.id, Application.status == "pending"
            )
        )
    )
    pending_applications = result_apps.scalar_one_or_none() or 0

    # 4. Unread Messages
    result_msgs = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(
                Conversation.landlord_id == current_user.id,
                Conversation.unread_count_landlord > 0,
            )
        )
    )
    unread_messages = result_msgs.scalar_one_or_none() or 0

    # 5. Occupancy Rate (active leases / total properties)
    occupancy_rate = 0.0
    if total_properties > 0:
        result_leases = await db.execute(
            select(func.count(Lease.id)).where(
                and_(Lease.landlord_id == current_user.id, Lease.status == "active")
            )
        )
        active_leases = result_leases.scalar_one_or_none() or 0
        occupancy_rate = round((active_leases / total_properties) * 100, 1)

    return LandlordStats(
        active_properties=total_properties,
        pending_applications=pending_applications,
        total_views=total_views,
        unread_messages=unread_messages,
        revenue=float(potential_revenue),
        occupancy_rate=occupancy_rate,
    )


@router.get("/tenant/overview", response_model=TenantStats)
async def get_tenant_stats(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Get high-level stats for tenant dashboard."""
    # 1. Total Applications
    result_apps = await db.execute(
        select(func.count(Application.id)).where(Application.tenant_id == current_user.id)
    )
    total_applications = result_apps.scalar_one_or_none() or 0

    # 2. Scheduled Visits (Mocked to 0 for now as visits model might be in transition)
    scheduled_visits = 0 

    # 3. Active Disputes
    from app.models.dispute import Dispute
    result_disputes = await db.execute(
        select(func.count(Dispute.id)).where(
            and_(Dispute.user_id == current_user.id, Dispute.status != "resolved")
        )
    )
    active_disputes = result_disputes.scalar_one_or_none() or 0

    return TenantStats(
        total_applications=total_applications,
        scheduled_visits=scheduled_visits,
        active_disputes=active_disputes,
        trust_score=current_user.trust_score or 0
    )


# ──────────────────────────────────────────────
# 2. Alerts — "Henri's Morning Coffee"
# ──────────────────────────────────────────────


@router.get("/landlord/alerts", response_model=AlertsResponse)
async def get_landlord_alerts(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Priority alerts for the landlord action center."""
    _require_landlord(current_user)

    alerts: List[AlertItem] = []
    today = date.today()
    thirty_days = today + timedelta(days=30)

    # A. Expiring Leases (end_date within 30 days)
    result_exp = await db.execute(
        select(func.count(Lease.id)).where(
            and_(
                Lease.landlord_id == current_user.id,
                Lease.status == "active",
                Lease.end_date != None,
                Lease.end_date <= thirty_days,
                Lease.end_date >= today,
            )
        )
    )
    expiring = result_exp.scalar_one_or_none() or 0
    if expiring > 0:
        alerts.append(
            AlertItem(
                type="expiring_lease",
                severity="critical" if expiring >= 3 else "warning",
                title=f"{expiring} bail{'s' if expiring > 1 else ''} expire{'nt' if expiring > 1 else ''} bientôt",
                description=f"Dans les 30 prochains jours",
                count=expiring,
                action_url="/leases",
            )
        )

    # B. Pending Applications
    result_apps = await db.execute(
        select(func.count(Application.id))
        .join(Application.property)
        .where(
            and_(
                Property.landlord_id == current_user.id, Application.status == "pending"
            )
        )
    )
    pending = result_apps.scalar_one_or_none() or 0
    if pending > 0:
        alerts.append(
            AlertItem(
                type="pending_application",
                severity="warning" if pending >= 5 else "info",
                title=f"{pending} candidature{'s' if pending > 1 else ''} en attente",
                description="Des locataires potentiels attendent votre réponse",
                count=pending,
                action_url="/applications/received",
            )
        )

    # C. Unread Messages
    result_msgs = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(
                Conversation.landlord_id == current_user.id,
                Conversation.unread_count_landlord > 0,
            )
        )
    )
    unread = result_msgs.scalar_one_or_none() or 0
    if unread > 0:
        alerts.append(
            AlertItem(
                type="unread_messages",
                severity="info",
                title=f"{unread} message{'s' if unread > 1 else ''} non lu{'s' if unread > 1 else ''}",
                description="Conversations en attente de réponse",
                count=unread,
                action_url="/inbox",
            )
        )

    # D. Vacant Properties (no active lease)
    result_total = await db.execute(
        select(func.count(Property.id)).where(Property.landlord_id == current_user.id)
    )
    total_props = result_total.scalar_one_or_none() or 0

    result_occupied = await db.execute(
        select(func.count(func.distinct(Lease.property_id))).where(
            and_(Lease.landlord_id == current_user.id, Lease.status == "active")
        )
    )
    occupied = result_occupied.scalar_one_or_none() or 0
    vacant = total_props - occupied
    if vacant > 0:
        alerts.append(
            AlertItem(
                type="vacant_property",
                severity="warning" if vacant >= 3 else "info",
                title=f"{vacant} bien{'s' if vacant > 1 else ''} vacant{'s' if vacant > 1 else ''}",
                description="Sans locataire actif — revenu potentiel perdu",
                count=vacant,
                action_url="/properties",
            )
        )

    return AlertsResponse(total_alerts=len(alerts), alerts=alerts)


@router.get("/public/overview", response_model=PublicStats)
async def get_public_stats(db: AsyncSession = Depends(get_db)):
    """Get public statistics for the landing page."""
    try:
        # 1. Total active properties
        result_props = await db.execute(
            select(func.count(Property.id)).where(Property.status == "active")
        )
        total_properties = result_props.scalar_one_or_none() or 0

        # 2. Verified landlords
        result_landlords = await db.execute(
            select(func.count(User.id)).where(
                and_(User.role == "landlord", User.identity_verified == True)
            )
        )
        verified_landlords = result_landlords.scalar_one_or_none() or 0

        # 3. Matches (Leases) in last 30 days
        thirty_days_ago = date.today() - timedelta(days=30)
        result_matches = await db.execute(
            select(func.count(Lease.id)).where(
                and_(Lease.status == "active", Lease.created_at >= thirty_days_ago)
            )
        )
        matches_last_30_days = result_matches.scalar_one_or_none() or 0

        # 4. Active cities
        result_cities = await db.execute(
            select(func.count(func.distinct(Property.city))).where(Property.status == "active")
        )
        active_cities = result_cities.scalar_one_or_none() or 0

        return PublicStats(
            total_properties=total_properties,
            verified_landlords=verified_landlords,
            matches_last_30_days=matches_last_30_days,
            active_cities=active_cities,
        )
    except Exception as e:
        print(f"CRITICAL ERROR in get_public_stats: {str(e)}")
        # Return zeros instead of crashing to keep landing page functional
        return PublicStats(
            total_properties=0,
            verified_landlords=0,
            matches_last_30_days=0,
            active_cities=0,
        )
