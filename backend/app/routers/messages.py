"""
Messaging API router for Unified Inbox.
Handles conversations, messages, and read status.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.property import Property
from app.models.messages import Conversation, Message

router = APIRouter(tags=["Messaging"])


# --- Schemas ---

class MessageCreate(BaseModel):
    content: str
    message_type: str = "text"
    metadata: dict = {}


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    sender_name: Optional[str] = None
    content: str
    message_type: str
    metadata: dict
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    property_id: UUID
    tenant_email: str
    subject: Optional[str] = None
    initial_message: str


class ConversationSummary(BaseModel):
    id: UUID
    property_id: UUID
    property_title: Optional[str] = None
    property_address: Optional[str] = None
    other_party_name: str
    other_party_email: str
    subject: Optional[str] = None
    status: str
    last_message_preview: Optional[str] = None
    last_message_at: datetime
    unread_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    id: UUID
    property_id: UUID
    property_title: Optional[str] = None
    landlord_name: str
    tenant_name: str
    subject: Optional[str] = None
    status: str
    messages: List[MessageResponse]
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    total_unread: int
    by_property: dict


# --- Endpoints ---

@router.get("/inbox", response_model=List[ConversationSummary])
async def get_inbox(
    status: Optional[str] = Query(None, description="Filter by status: active, archived, resolved"),
    property_id: Optional[UUID] = Query(None, description="Filter by property"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all conversations for the current user (landlord or tenant).
    Sorted by last message date, most recent first.
    """
    # Build query - user can be either landlord or tenant
    query = select(Conversation).where(
        or_(
            Conversation.landlord_id == current_user.id,
            Conversation.tenant_id == current_user.id
        )
    )
    
    if status:
        query = query.where(Conversation.status == status)
    if property_id:
        query = query.where(Conversation.property_id == property_id)
    
    query = query.order_by(desc(Conversation.last_message_at)).offset(offset).limit(limit)
    
    result = await db.execute(query)
    conversations = result.scalars().all()
    
    # Build response with additional context
    summaries = []
    for conv in conversations:
        # Determine if user is landlord or tenant
        is_landlord = conv.landlord_id == current_user.id
        unread = conv.unread_count_landlord if is_landlord else conv.unread_count_tenant
        
        # Get property info
        prop_query = select(Property).where(Property.id == conv.property_id)
        prop = (await db.execute(prop_query)).scalar_one_or_none()
        
        # Get other party info
        other_id = conv.tenant_id if is_landlord else conv.landlord_id
        other_query = select(User).where(User.id == other_id)
        other_user = (await db.execute(other_query)).scalar_one_or_none()
        
        # Get last message preview
        last_msg_query = select(Message).where(
            Message.conversation_id == conv.id
        ).order_by(desc(Message.created_at)).limit(1)
        last_msg = (await db.execute(last_msg_query)).scalar_one_or_none()
        
        summaries.append(ConversationSummary(
            id=conv.id,
            property_id=conv.property_id,
            property_title=prop.title if prop else None,
            property_address=f"{prop.address_line1}, {prop.city}" if prop else None,
            other_party_name=other_user.full_name if other_user else "Unknown",
            other_party_email=other_user.email if other_user else "",
            subject=conv.subject,
            status=conv.status,
            last_message_preview=last_msg.content[:100] if last_msg else None,
            last_message_at=conv.last_message_at,
            unread_count=unread,
            created_at=conv.created_at
        ))
    
    return summaries


@router.get("/inbox/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get total unread message count and breakdown by property."""
    # Get conversations where user has unread messages
    query = select(Conversation).where(
        or_(
            and_(Conversation.landlord_id == current_user.id, Conversation.unread_count_landlord > 0),
            and_(Conversation.tenant_id == current_user.id, Conversation.unread_count_tenant > 0)
        )
    )
    
    result = await db.execute(query)
    conversations = result.scalars().all()
    
    total = 0
    by_property = {}
    
    for conv in conversations:
        is_landlord = conv.landlord_id == current_user.id
        unread = conv.unread_count_landlord if is_landlord else conv.unread_count_tenant
        total += unread
        
        prop_id = str(conv.property_id)
        by_property[prop_id] = by_property.get(prop_id, 0) + unread
    
    return UnreadCountResponse(total_unread=total, by_property=by_property)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a conversation with all messages."""
    query = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(query)
    conv = result.scalar_one_or_none()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Verify access
    if conv.landlord_id != current_user.id and conv.tenant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this conversation")
    
    # Get property
    prop = (await db.execute(select(Property).where(Property.id == conv.property_id))).scalar_one_or_none()
    
    # Get users
    landlord = (await db.execute(select(User).where(User.id == conv.landlord_id))).scalar_one_or_none()
    tenant = (await db.execute(select(User).where(User.id == conv.tenant_id))).scalar_one_or_none()
    
    # Get messages with sender names
    msg_query = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    messages_result = await db.execute(msg_query)
    messages = messages_result.scalars().all()
    
    message_responses = []
    for msg in messages:
        sender = (await db.execute(select(User).where(User.id == msg.sender_id))).scalar_one_or_none()
        message_responses.append(MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            sender_name=sender.full_name if sender else "Unknown",
            content=msg.content,
            message_type=msg.message_type,
            metadata=msg.extra_data or {},
            is_read=msg.is_read,
            created_at=msg.created_at
        ))
    
    return ConversationDetail(
        id=conv.id,
        property_id=conv.property_id,
        property_title=prop.title if prop else None,
        landlord_name=landlord.full_name if landlord else "Unknown",
        tenant_name=tenant.full_name if tenant else "Unknown",
        subject=conv.subject,
        status=conv.status,
        messages=message_responses,
        created_at=conv.created_at
    )


@router.post("/conversations", response_model=ConversationSummary)
async def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation about a property."""
    # Verify property exists and user is landlord
    prop = (await db.execute(select(Property).where(Property.id == data.property_id))).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if prop.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only property owner can initiate conversations")
    
    # Find tenant by email
    tenant = (await db.execute(select(User).where(User.email == data.tenant_email))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found with that email")
    
    # Check if conversation already exists
    existing = await db.execute(
        select(Conversation).where(
            and_(
                Conversation.property_id == data.property_id,
                Conversation.landlord_id == current_user.id,
                Conversation.tenant_id == tenant.id
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Conversation already exists for this property and tenant")
    
    # Create conversation
    subject = data.subject or f"Regarding: {prop.title}"
    conv = Conversation(
        property_id=data.property_id,
        landlord_id=current_user.id,
        tenant_id=tenant.id,
        subject=subject,
        status='active',
        unread_count_tenant=1  # Tenant has 1 unread (the initial message)
    )
    db.add(conv)
    await db.flush()  # Get conv.id
    
    # Add initial message
    msg = Message(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=data.initial_message,
        message_type='text'
    )
    db.add(msg)
    
    await db.commit()
    await db.refresh(conv)
    
    return ConversationSummary(
        id=conv.id,
        property_id=conv.property_id,
        property_title=prop.title,
        property_address=f"{prop.address_line1}, {prop.city}",
        other_party_name=tenant.full_name,
        other_party_email=tenant.email,
        subject=conv.subject,
        status=conv.status,
        last_message_preview=data.initial_message[:100],
        last_message_at=conv.last_message_at,
        unread_count=0,  # Sender has 0 unread
        created_at=conv.created_at
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: UUID,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a message in a conversation."""
    # Get conversation
    conv = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Verify access
    if conv.landlord_id != current_user.id and conv.tenant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create message
    msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=data.content,
        message_type=data.message_type,
        extra_data=data.metadata
    )
    db.add(msg)
    
    # Update conversation
    conv.last_message_at = datetime.utcnow()
    
    # Increment unread count for the OTHER party
    if current_user.id == conv.landlord_id:
        conv.unread_count_tenant += 1
    else:
        conv.unread_count_landlord += 1
    
    await db.commit()
    await db.refresh(msg)
    
    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender_name=current_user.full_name,
        content=msg.content,
        message_type=msg.message_type,
        metadata=msg.extra_data or {},
        is_read=msg.is_read,
        created_at=msg.created_at
    )


@router.post("/conversations/{conversation_id}/read")
async def mark_as_read(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all messages in a conversation as read."""
    conv = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conv.landlord_id != current_user.id and conv.tenant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Reset unread count for current user
    if current_user.id == conv.landlord_id:
        conv.unread_count_landlord = 0
    else:
        conv.unread_count_tenant = 0
    
    # Mark messages as read
    await db.execute(
        Message.__table__.update()
        .where(
            and_(
                Message.conversation_id == conversation_id,
                Message.sender_id != current_user.id,
                Message.is_read == False
            )
        )
        .values(is_read=True, read_at=datetime.utcnow())
    )
    
    await db.commit()
    
    return {"message": "Marked as read"}


@router.post("/conversations/{conversation_id}/archive")
async def archive_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Archive a conversation."""
    conv = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conv.landlord_id != current_user.id and conv.tenant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    conv.status = 'archived'
    await db.commit()
    
    return {"message": "Conversation archived"}


# --- Helper function for auto-creating messages from other features ---

async def create_system_message(
    db: AsyncSession,
    property_id: UUID,
    landlord_id: UUID,
    tenant_id: UUID,
    content: str,
    message_type: str,
    metadata: dict = None
) -> Message:
    """
    Create or get conversation and add a system message.
    Used by visit booking, lease generation, etc.
    """
    # Get or create conversation
    conv = (await db.execute(
        select(Conversation).where(
            and_(
                Conversation.property_id == property_id,
                Conversation.landlord_id == landlord_id,
                Conversation.tenant_id == tenant_id
            )
        )
    )).scalar_one_or_none()
    
    if not conv:
        # Get property for subject
        prop = (await db.execute(select(Property).where(Property.id == property_id))).scalar_one_or_none()
        conv = Conversation(
            property_id=property_id,
            landlord_id=landlord_id,
            tenant_id=tenant_id,
            subject=f"Regarding: {prop.title if prop else 'Property'}",
            status='active'
        )
        db.add(conv)
        await db.flush()
    
    # Create message
    msg = Message(
        conversation_id=conv.id,
        sender_id=landlord_id,  # System messages attributed to landlord
        content=content,
        message_type=message_type,
        extra_data=metadata or {}
    )
    db.add(msg)
    
    # Update conversation
    conv.last_message_at = datetime.utcnow()
    conv.unread_count_tenant += 1
    
    await db.commit()
    await db.refresh(msg)
    
    return msg
