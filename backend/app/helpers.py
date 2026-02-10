from typing import TypeVar, Generic, List, Callable
from sqlalchemy.orm import Query
from sqlalchemy import func as sql_func
from .schemas import PaginationParams, PaginatedResponse
from .config import settings

T = TypeVar('T')

def paginate_query(
    query: Query,
    page: int = 1,
    page_size: int = None,
    max_page_size: int = None
) -> tuple[List[T], int]:
    """
    Paginate a SQLAlchemy query.
    Returns (items, total_count)
    """
    if page_size is None:
        page_size = settings.DEFAULT_PAGE_SIZE
    if max_page_size is None:
        max_page_size = settings.MAX_PAGE_SIZE
    
    page_size = min(page_size, max_page_size)
    page = max(1, page)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    return items, total

def create_paginated_response(
    items: List[T],
    total: int,
    page: int,
    page_size: int
) -> dict:
    """Create a paginated response dictionary"""
    total_pages = (total + page_size - 1) // page_size
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two points using Haversine formula.
    Returns distance in kilometers.
    """
    from math import radians, sin, cos, sqrt, atan2
    
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    
    a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    
    return R * c

def calculate_commission(amount: float, rate: float = None) -> float:
    """Calculate commission amount"""
    if rate is None:
        rate = settings.STRIPE_COMMISSION_RATE
    return round(amount * rate, 2)

def update_rating(profile_id: int, db, Model):
    """Update profile rating based on reviews"""
    from .models import Review, Order, Profile, OrderStatus
    
    # Get all completed orders for this profile
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        return
    
    user = profile.user
    if user.role.value != "master":
        return
    
    # Get all reviews for orders where this user is the seller
    reviews = (
        db.query(Review)
        .join(Order)
        .filter(Order.seller_id == user.id)
        .filter(Order.status == OrderStatus.completed)
        .all()
    )
    
    if not reviews:
        profile.rating = 0.0
        profile.total_reviews = 0
    else:
        total_rating = sum(r.rating for r in reviews)
        profile.rating = round(total_rating / len(reviews), 2)
        profile.total_reviews = len(reviews)
    
    db.commit()

