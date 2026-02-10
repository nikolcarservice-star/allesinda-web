from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Notification, User
from ..schemas import NotificationOut, PaginationParams
from ..security import get_current_user
from ..helpers import paginate_query, create_paginated_response

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("", response_model=dict)
def list_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False, description="Only show unread notifications")
):
    """List user's notifications"""
    query = db.query(Notification).filter(Notification.user_id == user.id)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Serialize notifications to dictionaries with ISO format datetimes
    results = []
    for notification in items:
        notification_dict = {
            "id": notification.id,
            "user_id": notification.user_id,
            "type": notification.type,
            "title": notification.title,
            "message": notification.message,
            "is_read": notification.is_read,
            "related_id": notification.related_id,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
        }
        results.append(notification_dict)
    
    return create_paginated_response(results, total, page, page_size)

@router.get("/unread/count")
def get_unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get count of unread notifications"""
    count = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False
    ).count()
    
    return {"count": count}

@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark notification as read"""
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    notification.is_read = True
    db.commit()
    return {"ok": True}

@router.post("/read-all")
def mark_all_as_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete notification"""
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(notification)
    db.commit()
    return {"ok": True}

