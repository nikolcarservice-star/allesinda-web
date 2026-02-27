from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File,
    Form,
    status,
)
from fastapi.encoders import jsonable_encoder
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from typing import Dict, List, Optional
from ..database import get_db, SessionLocal
from ..models import Conversation, Message, MessageAttachment, User, Profile, Service, Notification, BlockedUser
from ..security import get_current_user
from ..schemas import MessageIn, MessageOut, MessageDetailOut, ConversationOut, ConversationDetailOut, PaginationParams
from ..helpers import paginate_query, create_paginated_response
from ..utils.notifications import create_message_notification
from datetime import datetime, timezone, timedelta
import logging
import os
import re
import uuid
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

# Connection manager for WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active: Dict[int, List[WebSocket]] = {}
        self.user_connections: Dict[int, List[WebSocket]] = {}  # Track user connections for online status
    
    async def connect(self, conv_id: int, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active.setdefault(conv_id, []).append(websocket)
        self.user_connections.setdefault(user_id, []).append(websocket)
        logger.info(f"WebSocket connected: conversation_id={conv_id}, user_id={user_id}, total={len(self.active.get(conv_id, []))}")
    
    def disconnect(self, conv_id: int, websocket: WebSocket, user_id: int):
        if conv_id in self.active and websocket in self.active[conv_id]:
            self.active[conv_id].remove(websocket)
            # Clean up empty conversation lists
            if not self.active[conv_id]:
                del self.active[conv_id]
        if user_id in self.user_connections and websocket in self.user_connections[user_id]:
            self.user_connections[user_id].remove(websocket)
            # Clean up empty user connection lists
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        logger.info(f"WebSocket disconnected: conversation_id={conv_id}, user_id={user_id}")
    
    async def broadcast(self, conv_id: int, message: dict):
        disconnected = []
        for ws in self.active.get(conv_id, []):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to WebSocket: {e}")
                disconnected.append(ws)
        
        # Remove disconnected websockets from both dictionaries
        for ws in disconnected:
            if conv_id in self.active:
                self.active[conv_id].remove(ws)
            # Also remove from user_connections to prevent memory leak
            for user_id, connections in list(self.user_connections.items()):
                if ws in connections:
                    connections.remove(ws)
                    # Clean up empty lists
                    if not connections:
                        del self.user_connections[user_id]
    
    def is_user_online(self, user_id: int) -> bool:
        """Check if user has active WebSocket connections"""
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0

manager = ConnectionManager()

ATTACHMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
ALLOWED_IMAGE_PREFIXES = ("image/",)
ALLOWED_VIDEO_PREFIXES = ("video/",)
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def _sanitize_display_name(filename: Optional[str]) -> str:
    if not filename:
        return "attachment"
    name = os.path.basename(filename)
    # Replace problematic characters
    name = re.sub(r"[^A-Za-z0-9._\- ]+", "_", name)
    name = name.strip()
    return name or "attachment"


def _is_allowed_content_type(content_type: Optional[str]) -> bool:
    if not content_type:
        return True
    if any(content_type.startswith(prefix) for prefix in (*ALLOWED_IMAGE_PREFIXES, *ALLOWED_VIDEO_PREFIXES)):
        return True
    if content_type in ALLOWED_DOCUMENT_TYPES:
        return True
    # Allow generic binary streams to avoid blocking uncommon file types
    return content_type in {"application/octet-stream"}


def _get_chat_upload_directory() -> str:
    upload_root = settings.UPLOAD_FOLDER
    if not os.path.isabs(upload_root):
        upload_root = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), upload_root)
    chat_root = os.path.join(upload_root, "chat")
    os.makedirs(chat_root, exist_ok=True)
    return chat_root


def _build_attachment_paths(filename: str) -> tuple[str, str]:
    now = datetime.now()
    root = _get_chat_upload_directory()
    full_dir = os.path.join(root, now.strftime("%Y"), now.strftime("%m"))
    os.makedirs(full_dir, exist_ok=True)
    stored_filename = filename
    file_path = os.path.join(full_dir, stored_filename)
    url_prefix = settings.MEDIA_URL_PREFIX.rstrip("/")
    url = f"{url_prefix}/chat/{now.strftime('%Y')}/{now.strftime('%m')}/{stored_filename}"
    return file_path, url


def _prepare_attachment_filenames(original_filename: Optional[str]) -> tuple[str, str]:
    display_name = _sanitize_display_name(original_filename)
    _, ext = os.path.splitext(display_name)
    ext = ext.lower()
    stored_filename = f"{uuid.uuid4().hex}{ext}" if ext else uuid.uuid4().hex
    return stored_filename, display_name


def _get_other_user_id(conversation: Conversation, current_user_id: int) -> int:
    if conversation.buyer_id == current_user_id:
        return conversation.seller_id
    if conversation.seller_id == current_user_id:
        return conversation.buyer_id
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


def _get_block_record(db: Session, user_id: int, other_user_id: int) -> Optional[BlockedUser]:
    return db.query(BlockedUser).filter(
        or_(
            (BlockedUser.blocker_id == user_id) & (BlockedUser.blocked_id == other_user_id),
            (BlockedUser.blocker_id == other_user_id) & (BlockedUser.blocked_id == user_id),
        )
    ).first()


def _ensure_not_blocked(db: Session, sender_id: int, recipient_id: int):
    block_record = _get_block_record(db, sender_id, recipient_id)
    if not block_record:
        return
    if block_record.blocker_id == sender_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You have blocked this user. Unblock them to send messages.",
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are blocked by this user.",
    )

def format_timestamp(dt: Optional[datetime]) -> str:
    """Format datetime to relative time string"""
    if not dt:
        return ""
    
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    diff = now - dt
    
    if diff < timedelta(minutes=1):
        return "Just now"
    elif diff < timedelta(hours=1):
        minutes = int(diff.total_seconds() / 60)
        return f"{minutes}m ago"
    elif diff < timedelta(days=1):
        hours = int(diff.total_seconds() / 3600)
        return f"{hours}h ago"
    elif diff < timedelta(days=7):
        days = int(diff.total_seconds() / 86400)
        return f"{days}d ago"
    else:
        return dt.strftime("%b %d, %Y")

def format_message_timestamp(dt: datetime) -> str:
    """Format datetime to message timestamp"""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    return dt.strftime("%I:%M %p").lstrip("0")

def get_conversation_detail(conversation: Conversation, current_user: User, db: Session) -> dict:
    """Get enhanced conversation details for frontend"""
    # Get the other user (not current user)
    other_user_id = conversation.seller_id if conversation.buyer_id == current_user.id else conversation.buyer_id
    other_user = db.get(User, other_user_id)
    
    if not other_user:
        return None
    
    # Get profile for profession and avatar
    profile = db.query(Profile).filter(Profile.user_id == other_user_id).first()
    
    # Get last message
    last_message = (
        db.query(Message)
        .options(joinedload(Message.attachments))
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .first()
    )
    
    # Get unread count
    unread_count = db.query(Message).filter(
        Message.conversation_id == conversation.id,
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).count()
    
    # Determine profession/location
    profession = "User"
    if profile and profile.city_id:
        city_name = profile.city_ref.name if getattr(profile, "city_ref", None) else None
        profession = city_name or profession
    else:
        if other_user.role.value == "master":
            services = db.query(Service).filter(Service.profile_id == profile.id).first() if profile else None
            profession = services.title if services else "Master"
        elif other_user.role.value == "seller":
            profession = "Seller"
        else:
            profession = "Client"
    
    # Get avatar
    avatar = None
    if profile and profile.image_url:
        avatar = profile.image_url
    elif other_user.role.value == "master":
        avatar = "/professional-plumber-portrait.png"  # Default master avatar
    else:
        avatar = "/placeholder-user.jpg"  # Default user avatar
    
    last_message_preview = "No messages yet"
    if last_message:
        if last_message.body:
            last_message_preview = last_message.body
        elif last_message.attachments:
            last_message_preview = last_message.attachments[0].file_name

    block_record = _get_block_record(db, current_user.id, other_user_id)

    return {
        "id": conversation.id,
        "name": other_user.name,
        "avatar": avatar,
        "lastMessage": last_message_preview,
        "timestamp": format_timestamp(conversation.last_message_at or conversation.created_at),
        "unread": unread_count,
        "online": manager.is_user_online(other_user_id),
        "profession": profession or "Client",
        "buyer_id": conversation.buyer_id,
        "seller_id": conversation.seller_id,
        "order_id": conversation.order_id,
        "created_at": conversation.created_at,
        "lastMessageRead": last_message.is_read if last_message else True,
        "lastMessageSenderId": last_message.sender_id if last_message else None,
        "other_user_id": other_user.id,
        "other_user_email": other_user.email,
        "other_user_phone": other_user.phone,
        "other_user_role": other_user.role.value,
        "other_profile_id": profile.id if profile else None,
        "is_blocked": bool(block_record),
        "blocked_by_user_id": block_record.blocker_id if block_record else None,
    }

def get_message_detail(message: Message, current_user_id: int) -> dict:
    """Get enhanced message details for frontend"""
    attachments = [
        {
            "id": attachment.id,
            "file_url": attachment.file_url,
            "file_name": attachment.file_name,
            "file_type": attachment.file_type,
            "file_size": attachment.file_size,
            "created_at": attachment.created_at,
        }
        for attachment in getattr(message, "attachments", [])
    ]
    return {
        "id": message.id,
        "sender": "me" if message.sender_id == current_user_id else "them",
        "content": message.body,
        "timestamp": format_message_timestamp(message.created_at),
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "is_read": message.is_read,
        "created_at": message.created_at,
        "attachments": attachments,
    }

@router.get("/unread/count")
def get_unread_messages_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Total count of unread messages for the current user (for header badge)."""
    count = (
        db.query(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(
            or_(Conversation.buyer_id == user.id, Conversation.seller_id == user.id),
            Message.sender_id != user.id,
            Message.is_read == False,
        )
        .count()
    )
    return {"count": count}


@router.get("/conversations", response_model=dict)
def list_conversations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """List user's conversations with enhanced details"""
    query = db.query(Conversation).filter(
        (Conversation.buyer_id == user.id) | (Conversation.seller_id == user.id)
    )
    query = query.order_by(Conversation.last_message_at.desc().nulls_last(), Conversation.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Enhance conversations with user details
    enhanced_items = []
    for conv in items:
        detail = get_conversation_detail(conv, user, db)
        if detail:
            enhanced_items.append(detail)
    
    return create_paginated_response(enhanced_items, total, page, page_size)

@router.post("/conversations", response_model=ConversationOut, status_code=201)
def create_conversation(
    seller_id: int,
    order_id: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or get existing conversation"""
    # Validate seller exists
    seller = db.get(User, seller_id)
    if not seller or not seller.is_active:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    # Check if conversation already exists
    existing = db.query(Conversation).filter(
        (Conversation.buyer_id == user.id) & (Conversation.seller_id == seller_id)
    ).first()
    
    if existing:
        return existing
    
    # Create new conversation
    conversation = Conversation(
        buyer_id=user.id,
        seller_id=seller_id,
        order_id=order_id
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation

@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get conversation by ID"""
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation.buyer_id != user.id and conversation.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return conversation

@router.get("/conversations/{conversation_id}/messages", response_model=dict)
def list_messages(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """List messages in a conversation with enhanced details"""
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation.buyer_id != user.id and conversation.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = (
        db.query(Message)
        .options(joinedload(Message.attachments))
        .filter(Message.conversation_id == conversation_id)
    )
    query = query.order_by(Message.created_at.desc())  # Newest first; frontend normalizes order
    
    items, total = paginate_query(query, page, page_size)
    
    # Enhance messages for frontend
    enhanced_items = [get_message_detail(msg, user.id) for msg in items]
    
    return create_paginated_response(enhanced_items, total, page, page_size)

@router.post("/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    conversation_id: int,
    data: MessageIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message in a conversation"""
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation.buyer_id != user.id and conversation.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    recipient_id = _get_other_user_id(conversation, user.id)
    _ensure_not_blocked(db, user.id, recipient_id)
    
    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_id=user.id,
        body=data.body
    )
    db.add(message)
    
    # Update conversation last_message_at
    conversation.last_message_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(message)
    db.refresh(conversation)
    
    # Create notification for recipient (in-app + email if SMTP configured)
    try:
        sender_display = (user.name or user.email or "Someone").strip() or "Someone"
        create_message_notification(
            db=db,
            user_id=recipient_id,
            conversation_id=conversation_id,
            sender_name=sender_display,
        )
    except Exception as e:
        logger.error(f"Error creating notification: {e}")

    # Broadcast to WebSocket connections (non-blocking)
    try:
        attachments_payload: List[dict] = []
        await manager.broadcast(conversation_id, {
            "type": "new_message",
            "id": message.id,
            "conversation_id": conversation_id,
            "sender_id": message.sender_id,
            "body": message.body,
            "created_at": message.created_at.isoformat(),
            "is_read": message.is_read,
            "attachments": attachments_payload,
        })
    except Exception as e:
        logger.error(f"Error broadcasting message: {e}")
    
    return message


@router.post("/conversations/{conversation_id}/attachments", response_model=MessageDetailOut, status_code=201)
async def upload_message_attachment(
    conversation_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload an attachment and create a message containing it"""
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.buyer_id != user.id and conversation.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    recipient_id = _get_other_user_id(conversation, user.id)
    _ensure_not_blocked(db, user.id, recipient_id)

    file_content = await file.read()
    file_size = len(file_content)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if file_size > ATTACHMENT_MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Attachment too large. Maximum size is 25MB")

    content_type = file.content_type or "application/octet-stream"
    if not _is_allowed_content_type(content_type):
        raise HTTPException(status_code=400, detail="Unsupported attachment type")

    stored_filename, display_name = _prepare_attachment_filenames(file.filename)
    file_path, file_url = _build_attachment_paths(stored_filename)

    try:
        with open(file_path, "wb") as f:
            f.write(file_content)
    except Exception as exc:
        logger.error(f"Failed to save attachment: {exc}")
        raise HTTPException(status_code=500, detail="Failed to store attachment")

    message_body = (caption or "").strip() or display_name

    message = Message(
        conversation_id=conversation_id,
        sender_id=user.id,
        body=message_body,
    )
    db.add(message)
    db.flush()

    attachment = MessageAttachment(
        message_id=message.id,
        file_url=file_url,
        file_name=display_name,
        file_type=content_type,
        file_size=file_size,
    )
    db.add(attachment)

    conversation.last_message_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(message)
    db.refresh(attachment)

    message_with_attachments = (
        db.query(Message)
        .options(joinedload(Message.attachments))
        .filter(Message.id == message.id)
        .first()
    )

    try:
        sender_display = (user.name or user.email or "Someone").strip() or "Someone"
        create_message_notification(
            db=db,
            user_id=recipient_id,
            conversation_id=conversation_id,
            sender_name=sender_display,
        )
    except Exception as e:
        logger.error(f"Error creating attachment notification: {e}")

    detail_source = message_with_attachments or message
    detail = get_message_detail(detail_source, user.id)
    detail_json = jsonable_encoder(detail)

    try:
        await manager.broadcast(conversation_id, {
            "type": "new_message",
            "id": detail_json["id"],
            "conversation_id": conversation_id,
            "sender_id": user.id,
            "body": detail_json["content"],
            "created_at": detail_json["created_at"],
            "is_read": detail_json["is_read"],
            "attachments": detail_json.get("attachments", []),
        })
    except Exception as e:
        logger.error(f"Error broadcasting attachment message: {e}")

    return detail_json

@router.post("/conversations/{conversation_id}/read", response_model=dict)
async def mark_conversation_read(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all received messages in a conversation as read"""
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.buyer_id != user.id and conversation.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Safety limit: prevent loading too many unread messages (shouldn't happen, but safety first)
    MAX_UNREAD_MESSAGES = 1000
    unread_messages = db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.sender_id != user.id,
        Message.is_read == False
    ).limit(MAX_UNREAD_MESSAGES).all()
    if len(unread_messages) >= MAX_UNREAD_MESSAGES:
        logger.warning(f"Unread messages query hit safety limit of {MAX_UNREAD_MESSAGES} for conversation {conversation_id}")

    message_ids = []
    for msg in unread_messages:
        msg.is_read = True
        message_ids.append(msg.id)

    # Mark related notifications as read
    # Safety limit: prevent loading too many notifications
    MAX_UNREAD_NOTIFICATIONS = 1000
    unread_notifications = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.type == "message",
        Notification.related_id == conversation_id,
        Notification.is_read == False
    ).limit(MAX_UNREAD_NOTIFICATIONS).all()
    if len(unread_notifications) >= MAX_UNREAD_NOTIFICATIONS:
        logger.warning(f"Unread notifications query hit safety limit of {MAX_UNREAD_NOTIFICATIONS} for user {user.id}")

    for notification in unread_notifications:
        notification.is_read = True

    db.commit()

    if message_ids:
        await manager.broadcast(conversation_id, {
            "type": "read_receipt",
            "conversation_id": conversation_id,
            "message_ids": message_ids,
            "reader_id": user.id,
        })

    return {"ok": True, "updated": len(message_ids)}


@router.post("/conversations/{conversation_id}/block", response_model=dict)
def block_conversation_user(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.buyer_id != user.id and conversation.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    other_user_id = _get_other_user_id(conversation, user.id)

    existing = db.query(BlockedUser).filter(
        BlockedUser.blocker_id == user.id,
        BlockedUser.blocked_id == other_user_id,
    ).first()

    if existing:
        return {"ok": True, "blocked": True, "blocked_by_user_id": user.id}

    block = BlockedUser(blocker_id=user.id, blocked_id=other_user_id)
    db.add(block)
    db.commit()
    db.refresh(block)

    return {"ok": True, "blocked": True, "blocked_by_user_id": user.id}


@router.post("/conversations/{conversation_id}/unblock", response_model=dict)
def unblock_conversation_user(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.buyer_id != user.id and conversation.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    other_user_id = _get_other_user_id(conversation, user.id)

    existing = db.query(BlockedUser).filter(
        BlockedUser.blocker_id == user.id,
        BlockedUser.blocked_id == other_user_id,
    ).first()

    if not existing:
        return {"ok": True, "blocked": False, "blocked_by_user_id": None}

    db.delete(existing)
    db.commit()

    return {"ok": True, "blocked": False, "blocked_by_user_id": None}


@router.delete("/conversations/{conversation_id}", response_model=dict)
async def delete_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.buyer_id != user.id and conversation.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(conversation)
    db.commit()

    try:
        await manager.broadcast(conversation_id, {
            "type": "conversation_deleted",
            "conversation_id": conversation_id,
        })
    except Exception as e:
        logger.error(f"Error broadcasting conversation deletion: {e}")

    return {"ok": True}


@router.websocket("/ws/{conversation_id}")
async def ws_chat(
    websocket: WebSocket,
    conversation_id: int,
    token: Optional[str] = None
):
    """WebSocket endpoint for real-time chat"""
    # CRITICAL FIX: Don't use Depends(get_db) for WebSocket - it holds the session for the entire connection lifetime
    # Instead, create sessions only when needed and close them immediately
    
    # Extract user_id from token (simplified - in production use proper JWT validation)
    user_id = None
    if token:
        try:
            from jose import jwt
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = int(payload.get("sub"))
        except:
            pass
    
    if not user_id:
        await websocket.close(code=1008, reason="Authentication required")
        return
    
    # Get conversation and verify access - use a short-lived session
    db = SessionLocal()
    recipient_id = None
    try:
        conversation = db.get(Conversation, conversation_id)
        if not conversation:
            await websocket.close(code=1008, reason="Conversation not found")
            return
        
        # Verify user has access to this conversation
        if conversation.buyer_id != user_id and conversation.seller_id != user_id:
            await websocket.close(code=1008, reason="Access denied")
            return
        
        recipient_id = _get_other_user_id(conversation, user_id)
    except Exception as e:
        logger.error(f"Error during WebSocket connection setup: {e}", exc_info=True)
        await websocket.close(code=1011, reason="Internal server error")
        return
    finally:
        db.close()  # Close session immediately after initial checks
    
    # Safety check: recipient_id should always be set at this point
    if recipient_id is None:
        logger.error(f"recipient_id is None for conversation {conversation_id}, user {user_id}")
        await websocket.close(code=1011, reason="Internal server error")
        return
    
    await manager.connect(conversation_id, websocket, user_id)

    # Notify other participants that this user came online
    try:
        await manager.broadcast(conversation_id, {
            "type": "user_status",
            "conversation_id": conversation_id,
            "user_id": user_id,
            "online": True,
        })
    except Exception as e:
        logger.error(f"Error broadcasting user online status: {e}")

    try:
        while True:
            data = await websocket.receive_json()

            # Validate message data
            if "body" not in data:
                await websocket.send_json({"error": "Invalid message format"})
                continue

            # Create a new session for each database operation
            db = SessionLocal()
            try:
                # Re-fetch conversation to ensure we have latest data
                conversation = db.get(Conversation, conversation_id)
                if not conversation:
                    await websocket.send_json({"error": "Conversation not found"})
                    continue
                
                # Check if blocked
                try:
                    _ensure_not_blocked(db, user_id, recipient_id)
                except HTTPException as exc:
                    await websocket.send_json({"error": exc.detail})
                    continue

                # Create message
                message = Message(
                    conversation_id=conversation_id,
                    sender_id=user_id,
                    body=data["body"]
                )
                db.add(message)
                conversation.last_message_at = datetime.now(timezone.utc)
                db.commit()
                db.refresh(message)
                
                message_id = message.id
                message_body = message.body
                message_created_at = message.created_at.isoformat()
                message_is_read = message.is_read
            except Exception as e:
                logger.error(f"Error saving message: {e}", exc_info=True)
                db.rollback()  # Rollback on error
                await websocket.send_json({"error": "Failed to save message"})
                continue
            finally:
                db.close()  # Close session immediately after database operation

            # Broadcast to all connected clients (outside of DB session)
            await manager.broadcast(conversation_id, {
                "type": "new_message",
                "id": message_id,
                "conversation_id": conversation_id,
                "sender_id": user_id,
                "body": message_body,
                "created_at": message_created_at,
                "is_read": message_is_read,
                "attachments": [],
            })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(conversation_id, websocket, user_id)
        try:
            await manager.broadcast(conversation_id, {
                "type": "user_status",
                "conversation_id": conversation_id,
                "user_id": user_id,
                "online": False,
            })
        except Exception as e:
            logger.error(f"Error broadcasting user offline status: {e}")
