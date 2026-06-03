from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
import logging
from ..database import get_db
from ..models import (
    Media,
    MediaStatus,
    Profile,
    User,
    Role,
    Order,
    OrderStatus,
    OrderType,
    FeaturedItem,
    CategoryType,
    Product,
    Rental,
    Service,
    Category,
    UserReport,
)
from ..security import require_role
from ..helpers import paginate_query, create_paginated_response
from ..schemas import (
    FeaturedSelectionCreate,
    FeaturedSelectionUpdate,
    FeaturedSelectionOut,
    UserUpdate,
    ReviewReportStatusIn,
)
from ..routers.orders import load_order_relations
from .featured import _build_featured_item_from_type

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role(Role.admin))])

@router.get("/moderation/media")
def moderation_media(
    db: Session = Depends(get_db),
    status: Optional[MediaStatus] = Query(None, description="Filter by status (pending, approved, rejected). If not provided, returns all statuses."),
    media_type: Optional[str] = Query(None, description="Filter by media type: photo or video"),
    category: Optional[str] = Query(None, description="Filter by category"),
    owner_role: Optional[Role] = Query(None, description="Filter by owner role"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """List media for moderation with pagination - excludes admin-uploaded media"""
    from ..helpers import paginate_query, create_paginated_response
    
    # Query media with owner information
    query = db.query(Media).join(User, Media.owner_id == User.id)
    
    # Exclude admin-uploaded media - only show media from master/seller/client
    query = query.filter(User.role != Role.admin)
    
    # Filter by status (only if provided)
    if status:
        query = query.filter(Media.status == status)
    
    # Filter by media type
    if media_type:
        query = query.filter(Media.media_type == media_type)
    
    # Filter by category_id if provided
    if category:
        # Try to resolve as category_id first (if it's numeric)
        try:
            category_id = int(category)
            query = query.filter(Media.category_id == category_id)
        except ValueError:
            # If not numeric, look up category by slug and get its ID
            from ..models import Category
            category_obj = db.query(Category).filter(Category.slug == category).first()
            if category_obj:
                query = query.filter(Media.category_id == category_obj.id)
    
    # Filter by owner role
    if owner_role:
        query = query.filter(User.role == owner_role)
    
    query = query.order_by(Media.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    media_list = [
        {
            "id": m.id,
            "owner_id": m.owner_id,
            "owner_name": m.owner.name,
            "owner_role": m.owner.role.value,
            "url": m.url,
            "thumbnail_url": m.thumbnail_url,
            "type": m.media_type,
            "title": m.title,
            "category_id": m.category_id,
            "is_before_after": m.is_before_after,
            "before_url": m.before_url,
            "after_url": m.after_url,
            "status": m.status.value,
            "created_at": m.created_at.isoformat()
        }
        for m in items
    ]
    
    return create_paginated_response(media_list, total, page, page_size)

@router.post("/moderation/media/{media_id}/approve")
def approve_media(media_id: int, db: Session = Depends(get_db)):
    m = db.get(Media, media_id)
    if not m:
        raise HTTPException(404, "Not found")
    m.status = MediaStatus.approved
    from datetime import datetime, timezone
    m.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}

@router.post("/moderation/media/{media_id}/reject")
def reject_media(media_id: int, db: Session = Depends(get_db)):
    m = db.get(Media, media_id)
    if not m:
        raise HTTPException(404, "Not found")
    m.status = MediaStatus.rejected
    from datetime import datetime, timezone
    m.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}

@router.delete("/moderation/media/{media_id}")
def delete_media(media_id: int, db: Session = Depends(get_db)):
    """Delete media permanently"""
    m = db.get(Media, media_id)
    if not m:
        raise HTTPException(404, "Not found")
    
    # Optionally delete the file from storage
    # This would require file path resolution logic
    
    db.delete(m)
    db.commit()
    return {"ok": True, "message": "Media deleted successfully"}

@router.get("/moderation/profiles")
def moderation_profiles(
    db: Session = Depends(get_db),
    verified_only: bool = False,
    unverified_only: bool = False,
    role: Optional[Role] = Query(None, description="Filter by role: master or seller"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """List profiles for moderation with pagination (masters and sellers)
    
    For sellers without profiles, auto-creates a profile so they can be moderated.
    """
    from ..helpers import paginate_query, create_paginated_response
    
    # First, ensure all sellers have profiles (auto-create if missing)
    sellers_without_profiles = db.query(User).filter(
        User.role == Role.seller
    ).outerjoin(Profile, User.id == Profile.user_id).filter(Profile.id.is_(None)).all()
    
    for seller in sellers_without_profiles:
        # Auto-create profile for seller
        profile = Profile(user_id=seller.id)
        db.add(profile)
    
    if sellers_without_profiles:
        db.commit()
    
    # Include both masters and sellers
    query = db.query(Profile).options(joinedload(Profile.user)).join(User).filter(
        or_(User.role == Role.master, User.role == Role.seller)
    )
    
    # Filter by role if specified
    if role:
        query = query.filter(User.role == role)
    
    if verified_only:
        query = query.filter(Profile.verified == True)
    elif unverified_only:
        query = query.filter(Profile.verified == False)
    
    query = query.order_by(Profile.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    profiles_list = []
    for p in items:
        # Guard against any unexpected missing user relations
        user = p.user
        if not user:
            # Skip orphaned profiles defensively
            continue
        profiles_list.append({
            "id": p.id,
            "user_id": p.user_id,
            "user_name": user.name,
            "user_email": user.email,
            "user_role": user.role.value,
            "image_url": p.image_url,
            "city_id": p.city_id,
            "city_name": p.city_ref.name if getattr(p, "city_ref", None) else None,
            "verified": p.verified,
            "rating": float(p.rating) if isinstance(p.rating, (int, float)) else 0.0,
            "total_reviews": int(p.total_reviews) if isinstance(p.total_reviews, int) else 0,
            "created_at": p.created_at.isoformat()
        })
    
    return create_paginated_response(profiles_list, total, page, page_size)

@router.post("/moderation/profiles/{profile_id}/verify")
def verify_profile(profile_id: int, db: Session = Depends(get_db)):
    """Verify a master or seller profile"""
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(404, "Profile not found")
    
    if profile.user.role not in (Role.master, Role.seller):
        raise HTTPException(400, "Only master or seller profiles can be verified")
    
    profile.verified = True
    db.commit()
    return {"ok": True, "message": "Profile verified successfully"}

@router.post("/moderation/profiles/{profile_id}/reject")
def reject_profile(profile_id: int, db: Session = Depends(get_db)):
    """Reject/unverify a master profile"""
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(404, "Profile not found")
    
    profile.verified = False
    db.commit()
    return {"ok": True, "message": "Profile verification removed"}

@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_masters = db.query(User).filter(User.role == Role.master).count()
    total_sellers = db.query(User).filter(User.role == Role.seller).count()
    total_clients = db.query(User).filter(User.role == Role.client).count()
    # Count pending media excluding admin-uploaded media
    total_media_pending = db.query(Media).join(User, Media.owner_id == User.id).filter(
        Media.status == MediaStatus.pending,
        User.role != Role.admin
    ).count()
    total_profiles_unverified = db.query(Profile).join(User).filter(
        or_(User.role == Role.master, User.role == Role.seller),
        Profile.verified == False
    ).count()
    total_products = db.query(Product).count()
    total_rentals = db.query(Rental).count()
    total_orders = db.query(Order).count()
    total_orders_pending = db.query(Order).filter(Order.status == OrderStatus.created).count()
    total_orders_completed = db.query(Order).filter(Order.status == OrderStatus.completed).count()
    total_services = db.query(Service).count()
    total_services_unapproved = db.query(Service).filter(Service.approved == False).count()
    total_services_approved = db.query(Service).filter(Service.approved == True).count()
    total_products_unapproved = db.query(Product).filter(Product.approved == False).count()
    total_products_approved = db.query(Product).filter(Product.approved == True).count()
    total_rentals_unapproved = db.query(Rental).filter(Rental.approved == False).count()
    total_rentals_approved = db.query(Rental).filter(Rental.approved == True).count()
    total_profiles_verified = db.query(Profile).join(User).filter(
        or_(User.role == Role.master, User.role == Role.seller),
        Profile.verified == True
    ).count()
    total_media_approved = db.query(Media).join(User, Media.owner_id == User.id).filter(
        Media.status == MediaStatus.approved,
        User.role != Role.admin
    ).count()
    total_media_rejected = db.query(Media).join(User, Media.owner_id == User.id).filter(
        Media.status == MediaStatus.rejected,
        User.role != Role.admin
    ).count()
    total_orders_canceled = db.query(Order).filter(Order.status == OrderStatus.canceled).count()
    return {
        "total_users": total_users,
        "total_masters": total_masters,
        "total_sellers": total_sellers,
        "total_clients": total_clients,
        "media_pending": total_media_pending,
        "media_approved": total_media_approved,
        "media_rejected": total_media_rejected,
        "profiles_unverified": total_profiles_unverified,
        "profiles_verified": total_profiles_verified,
        "total_products": total_products,
        "products_approved": total_products_approved,
        "products_unapproved": total_products_unapproved,
        "total_rentals": total_rentals,
        "rentals_approved": total_rentals_approved,
        "rentals_unapproved": total_rentals_unapproved,
        "total_orders": total_orders,
        "total_orders_pending": total_orders_pending,
        "total_orders_completed": total_orders_completed,
        "total_orders_canceled": total_orders_canceled,
        "total_services": total_services,
        "services_approved": total_services_approved,
        "total_services_unapproved": total_services_unapproved,
    }

@router.get("/orders")
def get_all_orders(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[OrderStatus] = None,
    order_type: Optional[OrderType] = None,
    q: Optional[str] = None
):
    """Get all orders (admin only)"""
    query = db.query(Order).options(
        joinedload(Order.seller),
        joinedload(Order.buyer)
    )
    
    if status:
        query = query.filter(Order.status == status)
    
    if order_type:
        query = query.filter(Order.order_type == order_type)
    
    if q:
        # Search in buyer/seller names, order notes, or order ID
        from sqlalchemy import or_
        from sqlalchemy.orm import aliased
        buyer_alias = aliased(User)
        seller_alias = aliased(User)
        query = query.outerjoin(buyer_alias, Order.buyer_id == buyer_alias.id).outerjoin(seller_alias, Order.seller_id == seller_alias.id).filter(
            or_(
                buyer_alias.name.ilike(f"%{q}%"),
                buyer_alias.email.ilike(f"%{q}%"),
                seller_alias.name.ilike(f"%{q}%"),
                seller_alias.email.ilike(f"%{q}%"),
                Order.notes.ilike(f"%{q}%") if hasattr(Order, 'notes') else False,
                Order.id == int(q) if q.isdigit() else False
            )
        ).distinct()
    
    query = query.order_by(Order.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Load related service/product/rental data
    for order in items:
        load_order_relations(order, db)
    
    return create_paginated_response(items, total, page, page_size)

@router.get("/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    """Get order by ID (admin only)"""
    order = db.query(Order).options(
        joinedload(Order.seller),
        joinedload(Order.buyer)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Load related service/product/rental data
    load_order_relations(order, db)
    
    return order


@router.get("/featured")
def list_featured_selections(
    db: Session = Depends(get_db),
    item_type: Optional[CategoryType] = Query(None, description="Filter by item type"),
    is_active: Optional[bool] = Query(None, description="Filter by active state"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = db.query(FeaturedItem)
    if item_type:
        query = query.filter(FeaturedItem.item_type == item_type)
    if is_active is not None:
        query = query.filter(FeaturedItem.is_active.is_(is_active))

    query = query.order_by(FeaturedItem.priority.desc(), FeaturedItem.updated_at.desc(), FeaturedItem.id.desc())

    # Safety limit: prevent loading too many featured items into memory
    MAX_FEATURED_ITEMS = 1000
    entries = query.limit(MAX_FEATURED_ITEMS).all()
    if len(entries) >= MAX_FEATURED_ITEMS:
        logger.warning(f"Admin featured items query hit safety limit of {MAX_FEATURED_ITEMS}")
    total = len(entries)
    start = (page - 1) * page_size
    end = start + page_size
    page_entries = entries[start:end]

    results: List[dict] = []
    for entry in page_entries:
        item_data = _build_featured_item_from_type(db, entry.item_type, entry.item_id)
        selection = FeaturedSelectionOut(
            id=entry.id,
            item_type=entry.item_type,
            item_id=entry.item_id,
            priority=entry.priority,
            is_active=entry.is_active,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
            item=item_data,
        )
        results.append(selection.model_dump(mode="json"))

    return create_paginated_response(results, total, page, page_size)


@router.post("/featured", response_model=FeaturedSelectionOut)
def create_or_update_featured_selection(
    payload: FeaturedSelectionCreate,
    db: Session = Depends(get_db),
):
    item = _build_featured_item_from_type(db, payload.item_type, payload.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Referenced item not found")

    existing = (
        db.query(FeaturedItem)
        .filter(
            FeaturedItem.item_type == payload.item_type,
            FeaturedItem.item_id == payload.item_id,
        )
        .first()
    )

    if existing:
        existing.priority = payload.priority
        existing.is_active = payload.is_active
        db.commit()
        db.refresh(existing)
        entry = existing
    else:
        entry = FeaturedItem(
            item_type=payload.item_type,
            item_id=payload.item_id,
            priority=payload.priority,
            is_active=payload.is_active,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

    return FeaturedSelectionOut(
        id=entry.id,
        item_type=entry.item_type,
        item_id=entry.item_id,
        priority=entry.priority,
        is_active=entry.is_active,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        item=item,
    )


@router.patch("/featured/{featured_id}", response_model=FeaturedSelectionOut)
def update_featured_selection(
    featured_id: int,
    payload: FeaturedSelectionUpdate,
    db: Session = Depends(get_db),
):
    entry = db.get(FeaturedItem, featured_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Featured selection not found")

    if payload.priority is not None:
        entry.priority = payload.priority
    if payload.is_active is not None:
        entry.is_active = payload.is_active

    db.commit()
    db.refresh(entry)

    item = _build_featured_item_from_type(db, entry.item_type, entry.item_id)

    return FeaturedSelectionOut(
        id=entry.id,
        item_type=entry.item_type,
        item_id=entry.item_id,
        priority=entry.priority,
        is_active=entry.is_active,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        item=item,
    )


@router.delete("/featured/{featured_id}")
def delete_featured_selection(
    featured_id: int,
    db: Session = Depends(get_db),
):
    entry = db.get(FeaturedItem, featured_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Featured selection not found")

    db.delete(entry)
    db.commit()

    return {"ok": True}

@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[Role] = None,
    is_active: Optional[bool] = None,
    q: Optional[str] = None
):
    """Get all users (admin only)"""
    query = db.query(User)
    
    if role:
        query = query.filter(User.role == role)
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    if q:
        query = query.filter(
            (User.name.ilike(f"%{q}%")) |
            (User.email.ilike(f"%{q}%"))
        )
    
    query = query.order_by(User.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Get profile images for users
    users_list = []
    for u in items:
        profile = db.query(Profile).filter(Profile.user_id == u.id).first()
        users_list.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role.value,
            "phone": u.phone,
            "is_active": u.is_active,
            "email_verified": u.email_verified,
            "image_url": profile.image_url if profile else None,
            "created_at": u.created_at.isoformat(),
            "updated_at": u.updated_at.isoformat() if u.updated_at else None,
        })
    
    return create_paginated_response(users_list, total, page, page_size)

@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
):
    """Update user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.phone is not None:
        user.phone = data.phone
    
    db.commit()
    db.refresh(user)
    
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "phone": user.phone,
        "is_active": user.is_active,
        "email_verified": user.email_verified,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }

@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Reset user password to default 'password123' (admin only)"""
    from ..security import get_password_hash
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    
    default_password = "password123"
    user.hashed_password = get_password_hash(default_password)
    db.commit()
    
    return {"ok": True, "message": f"Password reset to default for user {user.email}"}

@router.get("/products")
def get_all_products(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_stock: Optional[int] = None,
    include_out_of_stock: bool = True
):
    """Get all products (admin only) - includes out of stock items"""
    query = db.query(Product).options(joinedload(Product.seller))
    
    if q:
        query = query.filter(Product.title.ilike(f"%{q}%"))
    
    if category:
        # Try to resolve as category_id first (if it's numeric)
        try:
            category_id = int(category)
            query = query.filter(Product.category_id == category_id)
        except ValueError:
            # If not numeric, look up category by slug and get its ID
            from ..models import Category
            category_obj = db.query(Category).filter(Category.slug == category).first()
            if category_obj:
                query = query.filter(Product.category_id == category_obj.id)
    
    if min_stock is not None:
        query = query.filter(Product.stock >= min_stock)
    
    if not include_out_of_stock:
        query = query.filter(Product.stock > 0)
    
    query = query.order_by(Product.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    products_list = [
        {
            "id": p.id,
            "seller_id": p.seller_id,
            "seller_name": p.seller.name if p.seller else None,
            "title": p.title,
            "description": p.description,
            "price": float(p.price),
            "stock": p.stock,
            "city_id": p.city_id,
            "city_name": p.city_ref.name if getattr(p, "city_ref", None) else None,
            "image_url": p.image_url,
            "brand": p.brand,
            "category_id": p.category_id,
            "rating": float(p.rating),
            "total_reviews": p.total_reviews,
            "approved": p.approved,
            "created_at": p.created_at.isoformat(),
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in items
    ]
    
    return create_paginated_response(products_list, total, page, page_size)

@router.get("/rentals")
def get_all_rentals(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    category: Optional[str] = None,
    available_only: Optional[bool] = None
):
    """Get all rentals (admin only)"""
    query = db.query(Rental).options(joinedload(Rental.lessor))
    
    if q:
        query = query.filter(Rental.title.ilike(f"%{q}%"))
    
    if category:
        # Try to resolve as category_id first (if it's numeric)
        try:
            category_id = int(category)
            query = query.filter(Rental.category_id == category_id)
        except ValueError:
            # If not numeric, look up category by slug and get its ID
            from ..models import Category
            category_obj = db.query(Category).filter(Category.slug == category).first()
            if category_obj:
                query = query.filter(Rental.category_id == category_obj.id)
    
    if available_only is not None:
        query = query.filter(Rental.available == available_only)
    
    query = query.order_by(Rental.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    rentals_list = [
        {
            "id": r.id,
            "seller_id": r.seller_id,
            "owner_name": r.lessor.name if r.lessor else None,
            "title": r.title,
            "description": r.description,
            "price_per_day": float(r.price_per_day),
            "stock": r.stock,
            "available": r.available,
            "city_id": r.city_id,
            "city_name": r.city_ref.name if getattr(r, "city_ref", None) else None,
            "image_url": r.image_url,
            "category_id": r.category_id,
            "approved": r.approved,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in items
    ]
    
    return create_paginated_response(rentals_list, total, page, page_size)

@router.patch("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    status: OrderStatus = Query(...),
    db: Session = Depends(get_db)
):
    """Update order status (admin only)"""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    order.status = status
    if status == OrderStatus.completed:
        from datetime import datetime, timezone
        order.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(order)
    
    # Load relations for response
    load_order_relations(order, db)
    
    return order

@router.get("/reviews")
def get_all_reviews(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    seller_id: Optional[int] = None,
    min_rating: Optional[int] = None,
    max_rating: Optional[int] = None
):
    """Get all reviews (admin only)"""
    from ..models import Review
    from ..schemas import ReviewOut
    
    query = db.query(Review).join(Order)
    
    if seller_id:
        query = query.filter(Order.seller_id == seller_id)
    
    if min_rating is not None:
        query = query.filter(Review.rating >= min_rating)
    
    if max_rating is not None:
        query = query.filter(Review.rating <= max_rating)
    
    query = query.order_by(Review.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    reviews_list = []
    for review in items:
        order = review.order
        buyer = db.get(User, order.buyer_id) if order else None
        seller = db.get(User, order.seller_id) if order else None
        
        # Get category and subcategory from the order item
        category = None
        subcategory = None
        
        if order:
            if order.order_type == OrderType.service and order.service_id:
                service = db.get(Service, order.service_id)
                if service and service.profile and service.profile.category_id:
                    cat_obj = db.get(Category, service.profile.category_id)
                    if cat_obj:
                        if cat_obj.parent_id:
                            parent_cat = db.get(Category, cat_obj.parent_id)
                            if parent_cat:
                                subcategory = cat_obj.slug
                                category = parent_cat.slug
                        else:
                            category = cat_obj.slug
            elif order.order_type == OrderType.product and order.product_id:
                product = db.get(Product, order.product_id)
                if product and product.category_id:
                    cat_obj = db.get(Category, product.category_id)
                    if cat_obj:
                        if cat_obj.parent_id:
                            parent_cat = db.get(Category, cat_obj.parent_id)
                            if parent_cat:
                                subcategory = cat_obj.slug
                                category = parent_cat.slug
                        else:
                            category = cat_obj.slug
            elif order.order_type == OrderType.rental and order.rental_id:
                rental = db.get(Rental, order.rental_id)
                if rental and rental.category_id:
                    cat_obj = db.get(Category, rental.category_id)
                    if cat_obj:
                        if cat_obj.parent_id:
                            parent_cat = db.get(Category, cat_obj.parent_id)
                            if parent_cat:
                                subcategory = cat_obj.slug
                                category = parent_cat.slug
                        else:
                            category = cat_obj.slug
        
        reviews_list.append({
            "id": review.id,
            "order_id": review.order_id,
            "rating": review.rating,
            "text": review.text,
            "created_at": review.created_at.isoformat(),
            "master_response": review.master_response,
            "report_reason": review.report_reason,
            "report_status": review.report_status,
            "reported_at": review.reported_at.isoformat() if review.reported_at else None,
            "buyer_id": order.buyer_id if order else None,
            "buyer_name": buyer.name if buyer else None,
            "seller_id": order.seller_id if order else None,
            "seller_name": seller.name if seller else None,
            "order_type": order.order_type.value if order else None,
            "order_amount": float(order.amount) if order else None,
            "category": category,
            "subcategory": subcategory,
        })
    
    return create_paginated_response(reviews_list, total, page, page_size)

@router.patch("/reviews/{review_id}/report-status")
def moderate_review_report(
    review_id: int,
    data: ReviewReportStatusIn,
    db: Session = Depends(get_db),
):
    """Resolve a master review report (admin only)."""
    from ..models import Review
    from ..utils.notifications import create_notification

    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.report_status != "in_review":
        raise HTTPException(status_code=400, detail="Review is not pending moderation")

    review.report_status = data.status
    db.commit()
    db.refresh(review)

    order = review.order
    if order and order.seller_id:
        status_label = "Entfernt" if data.status == "removed" else "Abgelehnt"
        try:
            create_notification(
                db=db,
                user_id=order.seller_id,
                type="review_report_resolved",
                title="Meldung bearbeitet",
                message=f"Ihre Meldung zu Bewertung #{review.id} wurde bearbeitet: {status_label}",
                related_id=review.id,
            )
        except Exception:
            pass

    return {"ok": True, "review_id": review.id, "report_status": review.report_status}

@router.delete("/reviews/{review_id}")
def delete_review(
    review_id: int,
    db: Session = Depends(get_db)
):
    """Delete a review (admin only)"""
    from ..models import Review
    from ..helpers import update_rating
    from ..models import Profile
    
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    
    order = review.order
    seller_id = order.seller_id if order else None
    
    db.delete(review)
    db.commit()
    
    # Recalculate seller rating
    if seller_id:
        profile = db.query(Profile).filter(Profile.user_id == seller_id).first()
        if profile:
            update_rating(profile.id, db, Profile)
    
    return {"ok": True, "message": "Review deleted successfully"}

# Services moderation endpoints
@router.get("/services")
def get_all_services(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    approved_only: Optional[bool] = None,
    unapproved_only: Optional[bool] = None
):
    """Get all services (admin only)"""
    query = db.query(Service).options(joinedload(Service.profile).joinedload(Profile.user))
    
    if q:
        query = query.filter(Service.title.ilike(f"%{q}%"))
    
    if approved_only:
        query = query.filter(Service.approved == True)
    elif unapproved_only:
        query = query.filter(Service.approved == False)
    
    query = query.order_by(Service.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    services_list = [
        {
            "id": s.id,
            "profile_id": s.profile_id,
            "master_name": s.profile.user.name if s.profile and s.profile.user else None,
            "master_id": s.profile.user_id if s.profile else None,
            "master_image_url": s.profile.image_url if s.profile else None,
            "title": s.title,
            "description": s.description,
            "price_from": float(s.price_from),
            "approved": s.approved,
            "created_at": s.created_at.isoformat(),
        }
        for s in items
    ]
    
    return create_paginated_response(services_list, total, page, page_size)

@router.post("/services/{service_id}/approve")
def approve_service(service_id: int, db: Session = Depends(get_db)):
    """Approve a service"""
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Service not found")
    service.approved = True
    db.commit()
    return {"ok": True, "message": "Service approved successfully"}

@router.post("/services/{service_id}/reject")
def reject_service(service_id: int, db: Session = Depends(get_db)):
    """Reject/unapprove a service"""
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Service not found")
    service.approved = False
    db.commit()
    return {"ok": True, "message": "Service rejected successfully"}

# Products approval endpoints
@router.post("/products/{product_id}/approve")
def approve_product(product_id: int, db: Session = Depends(get_db)):
    """Approve a product"""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    product.approved = True
    db.commit()
    return {"ok": True, "message": "Product approved successfully"}

@router.post("/products/{product_id}/reject")
def reject_product(product_id: int, db: Session = Depends(get_db)):
    """Reject/unapprove a product"""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    product.approved = False
    db.commit()
    return {"ok": True, "message": "Product rejected successfully"}

# Rentals approval endpoints
@router.post("/rentals/{rental_id}/approve")
def approve_rental(rental_id: int, db: Session = Depends(get_db)):
    """Approve a rental"""
    rental = db.get(Rental, rental_id)
    if not rental:
        raise HTTPException(404, "Rental not found")
    rental.approved = True
    db.commit()
    return {"ok": True, "message": "Rental approved successfully"}

@router.post("/rentals/{rental_id}/reject")
def reject_rental(rental_id: int, db: Session = Depends(get_db)):
    """Reject/unapprove a rental"""
    rental = db.get(Rental, rental_id)
    if not rental:
        raise HTTPException(404, "Rental not found")
    rental.approved = False
    db.commit()
    return {"ok": True, "message": "Rental rejected successfully"}

# Admin preview endpoints (bypass approval filters)
@router.get("/preview/master/{profile_id}")
def preview_master(profile_id: int, db: Session = Depends(get_db)):
    """Preview master profile (admin only, shows unapproved)"""
    from sqlalchemy.orm import joinedload
    profile = db.query(Profile).options(joinedload(Profile.user)).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(404, "Profile not found")
    
    if profile.user.role != Role.master:
        raise HTTPException(404, "Profile is not a master")
    
    # Get all services (including unapproved)
    services = db.query(Service).filter(Service.profile_id == profile_id).all()
    
    # Get all media (including unapproved)
    from ..models import Media, MediaStatus
    media = db.query(Media).filter(Media.profile_id == profile_id).all()
    
    return {
        "profile": {
            "id": profile.id,
            "user_id": profile.user_id,
            "user_name": profile.user.name,
            "user_email": profile.user.email,
            "city_id": profile.city_id,
            "city_name": profile.city_ref.name if getattr(profile, "city_ref", None) else None,
            "about": profile.about,
            "image_url": profile.image_url,
            "category_id": profile.category_id,
            "verified": profile.verified,
            "rating": float(profile.rating),
            "total_reviews": profile.total_reviews,
            "created_at": profile.created_at.isoformat(),
        },
        "services": [
            {
                "id": s.id,
                "title": s.title,
                "description": s.description,
                "price_from": float(s.price_from),
                "approved": s.approved,
                "created_at": s.created_at.isoformat(),
            }
            for s in services
        ],
        "media": [
            {
                "id": m.id,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "type": m.media_type,
                "status": m.status.value,
                "created_at": m.created_at.isoformat(),
            }
            for m in media
        ]
    }

@router.get("/preview/product/{product_id}")
def preview_product(product_id: int, db: Session = Depends(get_db)):
    """Preview product (admin only, shows unapproved)"""
    from sqlalchemy.orm import joinedload, selectinload
    product = db.query(Product).options(joinedload(Product.seller), selectinload(Product.media)).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    
    # Get all media (including unapproved)
    from ..models import Media
    media = db.query(Media).filter(Media.product_id == product_id).all()
    
    return {
        "product": {
            "id": product.id,
            "seller_id": product.seller_id,
            "seller_name": product.seller.name if product.seller else None,
            "title": product.title,
            "description": product.description,
            "price": float(product.price),
            "stock": product.stock,
            "city_id": product.city_id,
            "city_name": product.city_ref.name if getattr(product, "city_ref", None) else None,
            "image_url": product.image_url,
            "brand": product.brand,
            "category_id": product.category_id,
            "rating": float(product.rating),
            "total_reviews": product.total_reviews,
            "approved": product.approved,
            "created_at": product.created_at.isoformat(),
            "updated_at": product.updated_at.isoformat() if product.updated_at else None,
        },
        "media": [
            {
                "id": m.id,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "type": m.media_type,
                "status": m.status.value,
                "created_at": m.created_at.isoformat(),
            }
            for m in media
        ]
    }

@router.get("/preview/rental/{rental_id}")
def preview_rental(rental_id: int, db: Session = Depends(get_db)):
    """Preview rental (admin only, shows unapproved)"""
    from sqlalchemy.orm import joinedload, selectinload
    rental = db.query(Rental).options(joinedload(Rental.lessor), selectinload(Rental.media)).filter(Rental.id == rental_id).first()
    if not rental:
        raise HTTPException(404, "Rental not found")
    
    # Get all media (including unapproved)
    from ..models import Media
    media = db.query(Media).filter(Media.rental_id == rental_id).all()
    
    return {
        "rental": {
            "id": rental.id,
            "seller_id": rental.seller_id,
            "owner_name": rental.lessor.name if rental.lessor else None,
            "title": rental.title,
            "description": rental.description,
            "price_per_day": float(rental.price_per_day),
            "stock": rental.stock,
            "available": rental.available,
            "city_id": rental.city_id,
            "city_name": rental.city_ref.name if getattr(rental, "city_ref", None) else None,
            "image_url": rental.image_url,
            "category_id": rental.category_id,
            "approved": rental.approved,
            "created_at": rental.created_at.isoformat(),
            "updated_at": rental.updated_at.isoformat() if rental.updated_at else None,
        },
        "media": [
            {
                "id": m.id,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "type": m.media_type,
                "status": m.status.value,
                "created_at": m.created_at.isoformat(),
            }
            for m in media
        ]
    }


@router.get("/user-reports")
def list_user_reports(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter: in_review, resolved, rejected"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List user complaints (chat reports) for moderation."""
    query = db.query(UserReport).order_by(UserReport.created_at.desc())
    if status:
        query = query.filter(UserReport.status == status)
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    result = []
    for report in items:
        reporter = db.get(User, report.reporter_id)
        reported = db.get(User, report.reported_user_id)
        result.append(
            {
                "id": report.id,
                "reporter_id": report.reporter_id,
                "reporter_name": reporter.name if reporter else None,
                "reported_user_id": report.reported_user_id,
                "reported_user_name": reported.name if reported else None,
                "conversation_id": report.conversation_id,
                "reason": report.reason,
                "details": report.details,
                "status": report.status,
                "created_at": report.created_at.isoformat() if report.created_at else None,
            }
        )
    return create_paginated_response(result, total, page, page_size)
