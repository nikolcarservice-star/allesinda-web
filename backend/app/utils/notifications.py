"""Notification utility functions for creating notifications"""
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional

from sqlalchemy.orm import Session

from ..config import settings
from ..models import Notification, User
from ..utils.email import send_message_notification_email

logger = logging.getLogger(__name__)

def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    related_id: Optional[int] = None
) -> Notification:
    """Create a notification"""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        is_read=False,
        related_id=related_id
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification

def create_order_notification(
    db: Session,
    user_id: int,
    order_id: int,
    message: str,
    order_type: Optional[str] = None
):
    """Create notification for order status change and optionally send SMS"""
    notification = create_notification(
        db=db,
        user_id=user_id,
        type="order",
        title="Order Update",
        message=message,
        related_id=order_id
    )
    
    # Send SMS notification if enabled and user has phone
    try:
        user = db.get(User, user_id)
        if user and user.phone:
            from ..utils.sms import send_order_notification_sms
            send_order_notification_sms(
                phone=user.phone,
                order_id=order_id,
                order_type=order_type or "order",
                message=message
            )
    except Exception as e:
        logger.error(f"Failed to send SMS notification for order {order_id}: {e}")
    
    return notification

def create_message_notification(
    db: Session,
    user_id: int,
    conversation_id: int,
    sender_name: str
):
    """Create notification for new message and optionally send SMS"""
    notification = create_notification(
        db=db,
        user_id=user_id,
        type="message",
        title="New Message",
        message=f"You have a new message from {sender_name}",
        related_id=conversation_id
    )
    
    user = None
    try:
        user = db.get(User, user_id)
    except Exception as e:
        logger.error(f"Failed to load user for message notification {conversation_id}: {e}")

    # Send SMS notification if enabled and user has phone
    if user and user.phone:
        try:
            from ..utils.sms import send_message_notification_sms
            send_message_notification_sms(
                phone=user.phone,
                sender_name=sender_name
            )
        except Exception as e:
            logger.error(f"Failed to send SMS notification for message {conversation_id}: {e}")

    # Send email notification if SMTP configured
    if user and user.email:
        try:
            send_message_notification_email(
                email=user.email,
                recipient_name=user.name or "there",
                sender_name=sender_name,
                conversation_id=conversation_id,
            )
        except Exception as e:
            logger.error(f"Failed to send email notification for message {conversation_id}: {e}")
    
    return notification

def create_review_notification(
    db: Session,
    user_id: int,
    review_id: int,
    rating: int
):
    """Create notification for new review and optionally send SMS"""
    notification = create_notification(
        db=db,
        user_id=user_id,
        type="review",
        title="New Review",
        message=f"You received a {rating}-star review",
        related_id=review_id
    )
    
    # Send SMS notification if enabled and user has phone
    try:
        user = db.get(User, user_id)
        if user and user.phone:
            from ..utils.sms import send_review_notification_sms
            send_review_notification_sms(
                phone=user.phone,
                rating=rating
            )
    except Exception as e:
        logger.error(f"Failed to send SMS notification for review {review_id}: {e}")
    
    return notification

def create_search_alert_notification(
    db: Session,
    user_id: int,
    message: str,
    title: str = "Nearby Client Search",
    related_id: Optional[int] = None
) -> Optional[Notification]:
    """Create notification for localized searches with cooldown protection"""
    if not settings.ENABLE_SEARCH_ALERTS:
        return None

    cooldown_start = datetime.now(timezone.utc) - timedelta(minutes=settings.SEARCH_ALERT_COOLDOWN_MINUTES)
    existing = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.type == "search_alert",
            Notification.created_at >= cooldown_start,
        )
        .order_by(Notification.created_at.desc())
        .first()
    )

    if existing:
        return None

    return create_notification(
        db=db,
        user_id=user_id,
        type="search_alert",
        title=title,
        message=message,
        related_id=related_id,
    )
