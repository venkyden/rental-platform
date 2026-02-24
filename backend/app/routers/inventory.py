from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.inventory import Inventory, InventoryItem, InventoryStatus
from app.models.inventory_schemas import (InventoryCreate, InventoryItemCreate,
                                          InventoryResponse,
                                          InventorySignRequest)
from app.models.user import User
from app.models.visits_and_leases import Lease
from app.routers.auth import get_current_user

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.post("/", response_model=InventoryResponse)
async def create_inventory(
    inventory_in: InventoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new Inventory Draft.
    Only the Landlord of the linked Lease or the Tenant (with self-check) can create?
    For now, assume Landlord or Admin starts it, OR Tenant for 'Move-In Self Report'.
    """
    # 1. Verify Lease exists
    result = await db.execute(select(Lease).where(Lease.id == inventory_in.lease_id))
    lease = result.scalar_one_or_none()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")

    # 2. Permission Check (Basic: User must be part of the lease)
    if str(current_user.id) not in [str(lease.landlord_id), str(lease.tenant_id)]:
        # Allow Admin bypass if implemented, else 403
        raise HTTPException(status_code=403, detail="Not authorized for this lease")

    # 3. Create Inventory
    new_inventory = Inventory(
        lease_id=inventory_in.lease_id,
        type=inventory_in.type,
        general_notes=inventory_in.general_notes,
        status=InventoryStatus.DRAFT,
    )
    db.add(new_inventory)
    await db.flush()  # Get ID

    # 4. Create Items if any
    for item_in in inventory_in.items:
        new_item = InventoryItem(
            inventory_id=new_inventory.id,
            name=item_in.name,
            category=item_in.category,
            condition=item_in.condition,
            photos=item_in.photos,
            notes=item_in.notes,
        )
        db.add(new_item)

    await db.commit()

    # Reload with items
    result = await db.execute(
        select(Inventory)
        .options(selectinload(Inventory.items))
        .where(Inventory.id == new_inventory.id)
    )
    return result.scalar_one()


@router.get("/{id}", response_model=InventoryResponse)
async def get_inventory(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch with relationships (Lease -> Property)
    result = await db.execute(
        select(Inventory)
        .options(
            selectinload(Inventory.items),
            selectinload(Inventory.lease).selectinload(Lease.property),
        )
        .where(Inventory.id == id)
    )
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")

    # Map to schema manually or let Pydantic handle if structure matches?
    # Schema expects 'property_location' at top level. Inventory model doesn't have it.
    # We cheat by attaching it dynamically before returning.

    response = InventoryResponse.model_validate(inventory)

    if inventory.lease and inventory.lease.property:
        prop = inventory.lease.property
        # Ensure decimals are converted to float
        if prop.latitude and prop.longitude:
            response.property_location = {
                "lat": float(prop.latitude),
                "lng": float(prop.longitude),
            }

    return response


@router.post("/{id}/items", response_model=InventoryResponse)
async def add_inventory_items(
    id: UUID,
    items: List[InventoryItemCreate],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),  # Authorization skipped for brevity in this snippet
):
    """Add items to an existing draft inventory"""
    result = await db.execute(select(Inventory).where(Inventory.id == id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")

    if inventory.status != InventoryStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Cannot edit signed inventory")

    for item_in in items:
        new_item = InventoryItem(
            inventory_id=inventory.id,
            name=item_in.name,
            category=item_in.category,
            condition=item_in.condition,
            photos=item_in.photos,
            notes=item_in.notes,
        )
        db.add(new_item)

    await db.commit()

    # Refresh
    result = await db.execute(
        select(Inventory)
        .options(selectinload(Inventory.items))
        .where(Inventory.id == id)
    )
    return result.scalar_one()


@router.post("/{id}/sign", response_model=InventoryResponse)
async def sign_inventory(
    id: UUID,
    sign_req: InventorySignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sign the inventory. Supports single or dual (in-person) signing.
    """
    result = await db.execute(select(Inventory).where(Inventory.id == id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")

    # Update Signatures if provided
    if sign_req.signature_tenant:
        inventory.signature_tenant = sign_req.signature_tenant

    if sign_req.signature_landlord:
        inventory.signature_landlord = sign_req.signature_landlord

    # Update Status Logic
    has_tenant = inventory.signature_tenant is not None
    has_landlord = inventory.signature_landlord is not None

    if has_tenant and has_landlord:
        inventory.status = InventoryStatus.COMPLETED
    elif has_tenant:
        inventory.status = InventoryStatus.PENDING_LANDLORD_SIGNATURE
    elif has_landlord:
        inventory.status = InventoryStatus.PENDING_TENANT_SIGNATURE

    await db.commit()
    return inventory
