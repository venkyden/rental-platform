"""
Disputes Router — Facilitation Only.
Roomivo does NOT adjudicate disputes. The platform:
  1. Collects timestamped evidence from both parties
  2. Provides inventory diff (move-in vs move-out)
  3. Redirects to official mediation when needed

Legal basis: Loi ALUR, Article 22 (deposit return),
Decree 2015-1437 (état des lieux), EU ODR Regulation.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.dispute import Dispute, DisputeStatus
from app.models.dispute_schemas import (
    DisputeAddEvidence,
    DisputeAdminUpdate,
    DisputeCreate,
    DisputeRespond,
    DisputeResponse,
)
from app.models.inventory import Inventory, InventoryType
from app.models.property import Property
from app.models.user import User
from app.models.visits_and_leases import Lease
from app.routers.auth import get_current_user

router = APIRouter(prefix="/disputes", tags=["Disputes"])


# ──────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────


def _require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


async def _get_dispute_or_404(dispute_id: UUID, db: AsyncSession) -> Dispute:
    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    return dispute


async def _verify_participant(dispute: Dispute, user: User, db: AsyncSession):
    """Check that user is raised_by, accused, or landlord of the lease."""
    if user.role == "admin":
        return
    if dispute.raised_by_id == user.id:
        return
    if dispute.accused_id and dispute.accused_id == user.id:
        return
    # Check if user is landlord of the lease
    lease_result = await db.execute(select(Lease).where(Lease.id == dispute.lease_id))
    lease = lease_result.scalar_one_or_none()
    if lease and lease.landlord_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Not authorized to view this dispute")


async def _check_rate_limit(lease_id: UUID, db: AsyncSession):
    """Max 3 disputes per lease per 24 hours."""
    cutoff = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(Dispute)
        .where(Dispute.lease_id == lease_id)
        .where(Dispute.created_at >= cutoff)
    )
    today_count = len(result.scalars().all())
    if today_count >= 3:
        raise HTTPException(
            status_code=429,
            detail="Maximum 3 incident reports per lease per day. Please try again tomorrow.",
        )


# ──────────────────────────────────────────────
# Tenant Endpoints — Incident Reporting
# ──────────────────────────────────────────────


@router.post("/", response_model=DisputeResponse)
async def create_dispute(
    dispute_in: DisputeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Report an incident (Live Reporting).
    Creates a timestamped record with evidence for tenant protection.

    French law: Tenants have a duty to report damage/issues (devoir de signalement).
    This timestamped report serves as evidence of diligence.
    """
    # Verify Lease exists and user is a participant
    result = await db.execute(select(Lease).where(Lease.id == dispute_in.lease_id))
    lease = result.scalar_one_or_none()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")

    if lease.tenant_id != current_user.id and lease.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not a participant in this lease")

    # Rate limiting
    await _check_rate_limit(dispute_in.lease_id, db)

    # Validate evidence count
    if len(dispute_in.evidence_urls) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 photos per incident report")

    new_dispute = Dispute(
        lease_id=dispute_in.lease_id,
        inventory_id=dispute_in.inventory_id,
        raised_by_id=current_user.id,
        accused_id=dispute_in.accused_id,
        category=dispute_in.category,
        title=dispute_in.title,
        description=dispute_in.description,
        evidence_urls=dispute_in.evidence_urls or [],
        amount_claimed=dispute_in.amount_claimed,
        location_verified=dispute_in.location_verified,
        report_distance_meters=dispute_in.report_distance_meters,
        status=DisputeStatus.OPEN,
    )

    db.add(new_dispute)
    await db.commit()
    await db.refresh(new_dispute)

    # TODO: Send notification to accused party (if set) or landlord
    # This would use the existing notification system

    return new_dispute


@router.get("/", response_model=List[DisputeResponse])
async def list_my_disputes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all disputes involving the current user.
    Includes disputes where user is reporter, accused, or landlord of the lease.
    """
    # Get property IDs where user is landlord
    landlord_leases = select(Lease.id).join(Property).where(
        Property.landlord_id == current_user.id
    )

    result = await db.execute(
        select(Dispute)
        .where(
            or_(
                Dispute.raised_by_id == current_user.id,
                Dispute.accused_id == current_user.id,
                Dispute.lease_id.in_(landlord_leases),
            )
        )
        .order_by(Dispute.created_at.desc())
    )
    return result.scalars().all()


@router.get("/by-lease/{lease_id}", response_model=List[DisputeResponse])
async def get_disputes_by_lease(
    lease_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all disputes for a specific lease."""
    # Verify user is participant in the lease
    result = await db.execute(select(Lease).where(Lease.id == lease_id))
    lease = result.scalar_one_or_none()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")

    if (
        lease.tenant_id != current_user.id
        and lease.landlord_id != current_user.id
        and current_user.role != "admin"
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(Dispute)
        .where(Dispute.lease_id == lease_id)
        .order_by(Dispute.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{dispute_id}", response_model=DisputeResponse)
async def get_dispute_detail(
    dispute_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full dispute detail for any participant."""
    dispute = await _get_dispute_or_404(dispute_id, db)
    await _verify_participant(dispute, current_user, db)
    return dispute


@router.post("/{dispute_id}/evidence", response_model=DisputeResponse)
async def add_evidence(
    dispute_id: UUID,
    evidence_in: DisputeAddEvidence,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Append additional evidence photos to an existing dispute.
    Only the reporter can add evidence. Max 5 photos total.
    """
    dispute = await _get_dispute_or_404(dispute_id, db)

    if dispute.raised_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the reporter can add evidence")

    if dispute.status == DisputeStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot add evidence to a closed dispute")

    # Check total count
    current_urls = dispute.evidence_urls or []
    new_total = len(current_urls) + len(evidence_in.evidence_urls)
    if new_total > 5:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum 5 photos allowed. You have {len(current_urls)}, trying to add {len(evidence_in.evidence_urls)}.",
        )

    dispute.evidence_urls = current_urls + evidence_in.evidence_urls
    await db.commit()
    await db.refresh(dispute)
    return dispute


@router.post("/{dispute_id}/respond", response_model=DisputeResponse)
async def respond_to_dispute(
    dispute_id: UUID,
    response_in: DisputeRespond,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accused party submits their counter-evidence and explanation.
    Can only be done once per dispute.
    """
    dispute = await _get_dispute_or_404(dispute_id, db)

    # Verify user is the accused or the landlord of the lease
    is_accused = dispute.accused_id and dispute.accused_id == current_user.id
    lease_result = await db.execute(select(Lease).where(Lease.id == dispute.lease_id))
    lease = lease_result.scalar_one_or_none()
    is_landlord = lease and lease.landlord_id == current_user.id

    if not is_accused and not is_landlord:
        raise HTTPException(status_code=403, detail="Only the accused party can respond")

    if dispute.raised_by_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot respond to your own dispute")

    if dispute.responded_at:
        raise HTTPException(status_code=400, detail="Response already submitted")

    if dispute.status == DisputeStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot respond to a closed dispute")

    # Validate evidence count
    if len(response_in.response_evidence_urls) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 photos per response")

    dispute.response_description = response_in.response_description
    dispute.response_evidence_urls = response_in.response_evidence_urls or []
    dispute.responded_at = datetime.utcnow()
    dispute.status = DisputeStatus.UNDER_REVIEW  # Move to next stage for admin facilitation

    await db.commit()
    await db.refresh(dispute)
    return dispute


# ──────────────────────────────────────────────
# Admin Endpoints — Facilitation Only
# ──────────────────────────────────────────────


@router.get("/admin/list", response_model=List[DisputeResponse])
async def admin_list_disputes(
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all disputes (admin only)."""
    _require_admin(current_user)
    query = select(Dispute).order_by(Dispute.created_at.desc())
    if status_filter:
        query = query.where(Dispute.status == status_filter)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{dispute_id}/detail")
async def admin_get_dispute_detail(
    dispute_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full dispute detail including user info and lease context (admin only)."""
    _require_admin(current_user)

    dispute = await _get_dispute_or_404(dispute_id, db)

    # Get the lease info
    lease_result = await db.execute(select(Lease).where(Lease.id == dispute.lease_id))
    lease = lease_result.scalar_one_or_none()

    # Get the raised_by user
    user_result = await db.execute(select(User).where(User.id == dispute.raised_by_id))
    raised_by = user_result.scalar_one_or_none()

    # Get accused user
    accused = None
    if dispute.accused_id:
        accused_result = await db.execute(
            select(User).where(User.id == dispute.accused_id)
        )
        accused = accused_result.scalar_one_or_none()

    # Late-filing detection: filed in last 30 days of lease
    is_late_filing = False
    if lease and lease.end_date and dispute.created_at:
        from datetime import timedelta

        days_before_end = (lease.end_date - dispute.created_at.date()).days
        is_late_filing = 0 <= days_before_end <= 30

    return {
        "id": str(dispute.id),
        "title": dispute.title,
        "description": dispute.description,
        "category": dispute.category.value if dispute.category else None,
        "status": dispute.status.value if dispute.status else None,
        "evidence_urls": dispute.evidence_urls or [],
        "response_description": dispute.response_description,
        "response_evidence_urls": dispute.response_evidence_urls or [],
        "responded_at": (
            dispute.responded_at.isoformat() if dispute.responded_at else None
        ),
        "amount_claimed": dispute.amount_claimed,
        "admin_observations": dispute.admin_observations,
        "mediation_redirect_url": dispute.mediation_redirect_url,
        "mediation_redirected_at": (
            dispute.mediation_redirected_at.isoformat()
            if dispute.mediation_redirected_at
            else None
        ),
        "location_verified": dispute.location_verified,
        "report_distance_meters": dispute.report_distance_meters,
        "is_late_filing": is_late_filing,
        "created_at": dispute.created_at.isoformat() if dispute.created_at else None,
        "updated_at": dispute.updated_at.isoformat() if dispute.updated_at else None,
        "closed_at": dispute.closed_at.isoformat() if dispute.closed_at else None,
        "raised_by": (
            {
                "id": str(raised_by.id),
                "full_name": raised_by.full_name,
                "email": raised_by.email,
            }
            if raised_by
            else None
        ),
        "accused": (
            {
                "id": str(accused.id),
                "full_name": accused.full_name,
                "email": accused.email,
            }
            if accused
            else None
        ),
        "lease": (
            {
                "id": str(lease.id),
                "property_id": (
                    str(lease.property_id) if lease.property_id else None
                ),
            }
            if lease
            else None
        ),
        "inventory_id": str(dispute.inventory_id) if dispute.inventory_id else None,
    }


@router.get("/{dispute_id}/diff")
async def admin_get_dispute_diff(
    dispute_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Before vs After comparison for a dispute.
    Compares Move-In inventory items against Move-Out inventory items for the same lease.
    Neutral evidence tool — no adjudication.
    """
    _require_admin(current_user)

    dispute = await _get_dispute_or_404(dispute_id, db)

    # Get all inventories for this lease
    from app.models.inventory import InventoryType as InvType

    inv_result = await db.execute(
        select(Inventory)
        .options(selectinload(Inventory.items))
        .where(Inventory.lease_id == dispute.lease_id)
        .order_by(Inventory.date)
    )
    inventories = inv_result.scalars().all()

    move_in = None
    move_out = None
    for inv in inventories:
        if inv.type == InvType.MOVE_IN:
            move_in = inv
        elif inv.type == InvType.MOVE_OUT:
            move_out = inv

    def serialize_items(inventory):
        if not inventory:
            return []
        return [
            {
                "id": str(item.id),
                "name": item.name,
                "category": item.category,
                "condition": item.condition.value if item.condition else None,
                "photos": item.photos or [],
                "notes": item.notes,
            }
            for item in (inventory.items or [])
        ]

    move_in_items = serialize_items(move_in)
    move_out_items = serialize_items(move_out)

    # Build diff: Match items by name+category, show condition changes
    diff_rows = []
    move_in_map = {(i["name"], i["category"]): i for i in move_in_items}
    move_out_map = {(i["name"], i["category"]): i for i in move_out_items}

    all_keys = set(move_in_map.keys()) | set(move_out_map.keys())
    for key in sorted(all_keys):
        before = move_in_map.get(key)
        after = move_out_map.get(key)
        changed = False
        if before and after:
            changed = before["condition"] != after["condition"]
        elif before and not after:
            changed = True  # item missing at move-out
        elif after and not before:
            changed = True  # new item at move-out

        diff_rows.append(
            {
                "name": key[0],
                "category": key[1],
                "before": before,
                "after": after,
                "changed": changed,
            }
        )

    return {
        "dispute_id": str(dispute.id),
        "lease_id": str(dispute.lease_id),
        "move_in": {
            "id": str(move_in.id) if move_in else None,
            "date": move_in.date.isoformat() if move_in and move_in.date else None,
            "status": move_in.status.value if move_in else None,
            "items": move_in_items,
        },
        "move_out": {
            "id": str(move_out.id) if move_out else None,
            "date": (
                move_out.date.isoformat() if move_out and move_out.date else None
            ),
            "status": move_out.status.value if move_out else None,
            "items": move_out_items,
        },
        "diff": diff_rows,
        "total_changes": sum(1 for d in diff_rows if d["changed"]),
    }


@router.put("/{dispute_id}/admin-update", response_model=DisputeResponse)
async def admin_update_dispute(
    dispute_id: UUID,
    update_in: DisputeAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin facilitation — add observations and manage status.
    Roomivo does NOT render verdicts. Admin can:
    - Add factual observations
    - Change dispute status
    - Redirect to official mediation
    - Close the dispute
    """
    _require_admin(current_user)

    dispute = await _get_dispute_or_404(dispute_id, db)

    if update_in.admin_observations is not None:
        dispute.admin_observations = update_in.admin_observations

    if update_in.status:
        dispute.status = update_in.status

    if update_in.mediation_redirect_url:
        dispute.mediation_redirect_url = update_in.mediation_redirect_url
        dispute.mediation_redirected_at = datetime.utcnow()

    if update_in.close:
        dispute.status = DisputeStatus.CLOSED
        dispute.closed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(dispute)
    return dispute
