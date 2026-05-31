from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from ..database import get_db
from ..models import Review, Order, OrderStatus, User, Profile, Role
from ..schemas import ReviewIn, ReviewOut, ReviewDetailedOut, PaginationParams, ReviewReplyIn, ReviewReportIn
from ..security import get_current_user
from ..helpers import paginate_query, create_paginated_response, update_rating
from ..utils.notifications import create_notification, create_review_notification

router = APIRouter(prefix="/reviews", tags=["reviews"])

def _serialize_review(review: Review, db: Session) -> dict:
    data = ReviewOut.model_validate(review).model_dump()
    order = review.order
    buyer = db.get(User, order.buyer_id) if order else None
    data["buyer_name"] = buyer.name if buyer else None
    return data

@router.get("/my", response_model=dict)
def get_my_reviews(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List reviews created by the current (buyer) user"""
    query = (
        db.query(Review)
        .join(Order)
        .filter(Order.buyer_id == user.id)
        .order_by(Review.created_at.desc())
    )
    items, total = paginate_query(query, page, page_size)
    review_out_items = [ReviewOut.model_validate(item) for item in items]
    return create_paginated_response(review_out_items, total, page, page_size)

@router.post("", response_model=ReviewOut, status_code=201)
def create_review(
    data: ReviewIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a review for a completed order"""
    # Validate order exists
    order = db.get(Order, data.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only buyer can review
    if order.buyer_id != user.id:
        raise HTTPException(status_code=403, detail="Only buyer can review")
    
    # Order must be completed
    if order.status != OrderStatus.completed:
        raise HTTPException(status_code=400, detail="Order must be completed before reviewing")
    
    # Check if review already exists
    existing_review = db.query(Review).filter(Review.order_id == order.id).first()
    if existing_review:
        raise HTTPException(status_code=400, detail="Review already exists for this order")
    
    # Validate rating
    if not (1 <= data.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Create review
    review = Review(
        order_id=order.id,
        rating=data.rating,
        text=data.text
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    
    # Update seller profile rating
    if order.seller_id:
        profile = db.query(Profile).filter(Profile.user_id == order.seller_id).first()
        if profile:
            update_rating(profile.id, db, Profile)
        
        # Create notification for seller
        try:
            create_review_notification(
                db=db,
                user_id=order.seller_id,
                review_id=review.id,
                rating=data.rating
            )
        except Exception as e:
            # Don't fail review creation if notification fails
            pass
    
    return review

@router.get("", response_model=dict)
def list_reviews(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    seller_id: Optional[int] = None,
    order_id: Optional[int] = None
):
    """List reviews with pagination"""
    query = db.query(Review).join(Order)
    
    if seller_id:
        query = query.filter(Order.seller_id == seller_id)
    
    if order_id:
        query = query.filter(Review.order_id == order_id)
    
    query = query.order_by(Review.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Convert SQLAlchemy models to Pydantic models
    review_out_items = [ReviewOut.model_validate(item) for item in items]
    
    return create_paginated_response(review_out_items, total, page, page_size)

def _ensure_review_belongs_to_master(review: Review, user: User) -> None:
    if not review.order or review.order.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

@router.post("/{review_id}/reply", response_model=ReviewOut)
def reply_to_review(
    review_id: int,
    data: ReviewReplyIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allow a master to write or update their public response to a review."""
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    _ensure_review_belongs_to_master(review, user)
    review.master_response = data.response.strip()
    db.commit()
    db.refresh(review)
    return review

@router.post("/{review_id}/report", response_model=ReviewOut)
def report_review(
    review_id: int,
    data: ReviewReportIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allow a master to report a customer review for moderation."""
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    _ensure_review_belongs_to_master(review, user)

    review.report_reason = data.reason
    review.report_status = "in_review"
    review.reported_by_id = user.id
    review.reported_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)

    admins = db.query(User).filter(User.role == Role.admin, User.is_active == True).all()
    for admin in admins:
        try:
            create_notification(
                db=db,
                user_id=admin.id,
                type="review_report",
                title="Review report",
                message=f"{user.name} reported review #{review.id}: {data.reason}",
                related_id=review.id,
            )
        except Exception:
            pass

    return review

@router.get("/{review_id}", response_model=ReviewDetailedOut)
def get_review(review_id: int, db: Session = Depends(get_db)):
    """Get review by ID"""
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review

@router.get("/seller/{seller_id}", response_model=dict)
def get_seller_reviews(
    seller_id: int,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """Get all reviews for a seller"""
    query = (
        db.query(Review)
        .join(Order)
        .filter(Order.seller_id == seller_id)
        .filter(Order.status == OrderStatus.completed)
    )
    
    query = query.order_by(Review.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    review_out_items = [_serialize_review(item, db) for item in items]
    
    return create_paginated_response(review_out_items, total, page, page_size)
