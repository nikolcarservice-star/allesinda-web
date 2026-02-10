from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Rental, User, Role, Media, MediaStatus, City, Category, CategoryType
from sqlalchemy.orm import joinedload
from ..schemas import RentalIn, RentalOut, PaginationParams, MediaOut
from ..security import require_role, get_current_user
from ..helpers import paginate_query, create_paginated_response

router = APIRouter(prefix="/rentals", tags=["rentals"])

@router.get("", response_model=dict)
def list_rentals(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    city: Optional[str] = None,
    city_id: Optional[int] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    available_only: Optional[bool] = True,
    sort_by: str = Query("created_at", pattern="^(rating|price|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$")
):
    """Delegate to unified search for rentals"""
    from .search import _perform_search
    # Unified search already filters available == True and stock > 0
    # It also supports category, price, rating, and city params
    # For sort_by compatibility, pass through provided values
    return _perform_search(
        scope="rentals",
        q=q,
        city=city,
        city_id=city_id,
        category=category,
        min_price=min_price,
        max_price=max_price,
        min_rating=None,
        verified_only=False,
        latitude=None,
        longitude=None,
        radius_km=None,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
        current_user=None,
        db=db,
    )

@router.get("/{rental_id}", response_model=RentalOut)
def get_rental(rental_id: int, db: Session = Depends(get_db)):
    """Get rental by ID with media (all rentals are automatically approved)"""
    rental = db.query(Rental).options(joinedload(Rental.media)).filter(Rental.id == rental_id).first()
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    
    # Get all media items for this rental (all media is automatically approved)
    approved_media = (
        db.query(Media)
        .filter(Media.rental_id == rental_id)
        .order_by(Media.sort_order.asc().nullslast())
        .all()
    )
    
    # Convert to dict and include media with full MediaOut schema
    rental_dict = {
        "id": rental.id,
        "seller_id": rental.seller_id,
        "title": rental.title,
        "description": rental.description,
        "price_per_day": rental.price_per_day,
        "stock": rental.stock,
        "available": rental.available,
        "city_id": rental.city_id,
        "city_name": rental.city_ref.name if getattr(rental, "city_ref", None) else None,
        "image_url": rental.image_url,
        "category_id": rental.category_id,
        "created_at": rental.created_at,
        "updated_at": rental.updated_at,
        "media": [MediaOut.model_validate(m) for m in sorted(approved_media, key=lambda x: x.sort_order or 0)]
    }
    return rental_dict

@router.post("", response_model=RentalOut, status_code=201, dependencies=[Depends(require_role(Role.seller))])
def create_rental(
    data: RentalIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new rental"""
    payload = data.dict()
    city_id = payload.pop("city_id", None)
    category_id = payload.get("category_id")
    
    # Validate category_id if provided
    if category_id is not None:
        category = db.get(Category, category_id)
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
        if category.type != CategoryType.rental:
            raise HTTPException(status_code=400, detail="Category must be of type 'rental'")
    
    payload["stock"] = max(payload.get("stock", 0), 0)
    payload["available"] = payload.get("available", True) and payload["stock"] > 0
    rental = Rental(seller_id=user.id, **payload)
    if city_id is not None:
        rental.city_id = city_id
    db.add(rental)
    db.commit()
    db.refresh(rental)
    return rental

@router.patch("/{rental_id}", response_model=RentalOut, dependencies=[Depends(require_role(Role.seller))])
def update_rental(
    rental_id: int,
    data: RentalIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a rental"""
    rental = db.get(Rental, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    
    if rental.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = data.dict(exclude_unset=True)
    city_id_update = update_data.pop("city_id", None)
    stock_update = update_data.pop("stock", None)
    available_update = update_data.pop("available", None)
    category_id_update = update_data.get("category_id")
    
    # Validate category_id if being updated
    if category_id_update is not None:
        category = db.get(Category, category_id_update)
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
        if category.type != CategoryType.rental:
            raise HTTPException(status_code=400, detail="Category must be of type 'rental'")

    for key, value in update_data.items():
        setattr(rental, key, value)
    if city_id_update is not None:
        rental.city_id = city_id_update

    if stock_update is not None:
        rental.stock = max(stock_update, 0)

    if available_update is not None:
        rental.available = available_update

    if rental.stock <= 0:
        rental.available = False
    
    db.commit()
    db.refresh(rental)
    return rental

@router.delete("/{rental_id}", dependencies=[Depends(require_role(Role.seller))])
def delete_rental(
    rental_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a rental"""
    rental = db.get(Rental, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    
    if rental.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(rental)
    db.commit()
    return {"ok": True}

@router.get("/seller/me", response_model=dict, dependencies=[Depends(require_role(Role.seller))])
def my_rentals(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """Get current user's rentals"""
    query = db.query(Rental).options(joinedload(Rental.media)).filter(Rental.seller_id == user.id)
    query = query.order_by(Rental.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Convert SQLAlchemy models to Pydantic models with media
    rental_out_items = []
    for item in items:
        # Get all media items for this rental
        all_media = db.query(Media).filter(Media.rental_id == item.id).order_by(Media.sort_order.asc().nullslast()).all()
        
        rental_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "title": item.title,
            "description": item.description,
            "price_per_day": item.price_per_day,
            "stock": item.stock,
            "available": item.available,
            "city_id": item.city_id,
            "city_name": item.city_ref.name if getattr(item, "city_ref", None) else None,
            "image_url": item.image_url,
            "category_id": item.category_id,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "media": [MediaOut.model_validate(m) for m in sorted(all_media, key=lambda x: x.sort_order or 0)]
        }
        rental_out_items.append(rental_dict)
    
    return create_paginated_response(rental_out_items, total, page, page_size)
