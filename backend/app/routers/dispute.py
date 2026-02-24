from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.dispute import Dispute, DisputeStatus, DisputeVerdict
from app.models.dispute_schemas import (DisputeCreate, DisputeResponse,
                                        DisputeVerdictUpdate)
from app.models.inventory import Inventory, InventoryType
from app.models.user import User
from app.models.visits_and_leases import Lease
from app.routers.auth import get_current_user

router = APIRouter(prefix="/disputes", tags=["Disputes"])


@router.post("/", response_model=DisputeResponse)
async def create_dispute(
    dispute_in: DisputeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Report an incident (Live Reporting).
    Docs: "Duty to Report" - timestamped evidence preventing Move-Out shocks.
    """
    # Verify Lease
    result = await db.execute(select(Lease).where(Lease.id == dispute_in.lease_id))
    lease = result.scalar_one_or_none()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")

    new_dispute = Dispute(
        lease_id=dispute_in.lease_id,
        inventory_id=dispute_in.inventory_id,
        raised_by_id=current_user.id,
        accused_id=dispute_in.accused_id,
        category=dispute_in.category,
        title=dispute_in.title,
        description=dispute_in.description,
        amount_claimed=dispute_in.amount_claimed,
        status=DisputeStatus.OPEN,
    )

    db.add(new_dispute)
    await db.commit()
    await db.refresh(new_dispute)
    return new_dispute


@router.get("/", response_model=List[DisputeResponse])
async def list_my_disputes(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    # Retrieve disputes where user is raised_by OR accused OR landlord of lease
    # Simplified query for MVP: Just raised_by
    result = await db.execute(
        select(Dispute).where(Dispute.raised_by_id == current_user.id)
    )
    return result.scalars().all()


# ──────────────────────────────────────────────
# Admin Endpoints — Dispute Resolution & Diff Viewer
# ──────────────────────────────────────────────

from datetime import datetime

from sqlalchemy.orm import selectinload


def _require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/admin/list", response_model=List[DisputeResponse])
async def admin_list_disputes(
    status_filter: str = None,
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
    """Get full dispute detail including inventory and lease info."""
    _require_admin(current_user)

    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    # Get the lease info
    lease_result = await db.execute(select(Lease).where(Lease.id == dispute.lease_id))
    lease = lease_result.scalar_one_or_none()

    # Get the raised_by user
    user_result = await db.execute(select(User).where(User.id == dispute.raised_by_id))
    raised_by = user_result.scalar_one_or_none()

    return {
        "id": str(dispute.id),
        "title": dispute.title,
        "description": dispute.description,
        "category": dispute.category.value if dispute.category else None,
        "status": dispute.status.value if dispute.status else None,
        "verdict": dispute.verdict.value if dispute.verdict else None,
        "amount_claimed": dispute.amount_claimed,
        "admin_notes": dispute.admin_notes,
        "created_at": dispute.created_at.isoformat() if dispute.created_at else None,
        "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
        "raised_by": (
            {
                "id": str(raised_by.id),
                "full_name": raised_by.full_name,
                "email": raised_by.email,
            }
            if raised_by
            else None
        ),
        "lease": (
            {
                "id": str(lease.id),
                "property_id": str(lease.property_id) if lease.property_id else None,
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
    """
    _require_admin(current_user)

    # Get the dispute
    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

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
            "date": move_out.date.isoformat() if move_out and move_out.date else None,
            "status": move_out.status.value if move_out else None,
            "items": move_out_items,
        },
        "diff": diff_rows,
        "total_changes": sum(1 for d in diff_rows if d["changed"]),
    }


@router.put("/{dispute_id}/verdict", response_model=DisputeResponse)
async def admin_update_verdict(
    dispute_id: UUID,
    verdict_in: DisputeVerdictUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin sets the verdict and optionally resolves the dispute."""
    _require_admin(current_user)

    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    dispute.verdict = verdict_in.verdict
    if verdict_in.admin_notes:
        dispute.admin_notes = verdict_in.admin_notes
    if verdict_in.final_report_path:
        dispute.final_report_path = verdict_in.final_report_path
    if verdict_in.resolve:
        dispute.status = DisputeStatus.RESOLVED
        dispute.resolved_at = datetime.utcnow()
    else:
        dispute.status = DisputeStatus.UNDER_REVIEW

    await db.commit()
    await db.refresh(dispute)
    return dispute
