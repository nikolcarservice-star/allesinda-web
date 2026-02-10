from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Favorite, User, Profile, Product, Rental
from ..schemas import FavoriteIn, FavoriteOut, PaginationParams
from ..security import get_current_user, get_current_user_optional
from ..helpers import paginate_query, create_paginated_response

router = APIRouter(prefix="/favorites", tags=["favorites"])

@router.post("", response_model=FavoriteOut, status_code=201)
def add_favorite(
    data: FavoriteIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add item to favorites"""
    # Validate favorite exists
    if data.favorite_type == "profile":
        profile = db.get(Profile, data.favorite_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
    elif data.favorite_type == "product":
        product = db.get(Product, data.favorite_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
    elif data.favorite_type == "rental":
        rental = db.get(Rental, data.favorite_id)
        if not rental:
            raise HTTPException(status_code=404, detail="Rental not found")
    else:
        raise HTTPException(status_code=400, detail="Invalid favorite_type")
    
    # Check if already favorited
    existing = db.query(Favorite).filter(
        Favorite.user_id == user.id,
        Favorite.favorite_type == data.favorite_type,
        Favorite.favorite_id == data.favorite_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Already favorited")
    
    favorite = Favorite(
        user_id=user.id,
        favorite_type=data.favorite_type,
        favorite_id=data.favorite_id
    )
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return favorite

@router.delete("/{favorite_id}")
def remove_favorite(
    favorite_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove item from favorites"""
    favorite = db.get(Favorite, favorite_id)
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    if favorite.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(favorite)
    db.commit()
    return {"ok": True}

@router.get("", response_model=dict)
def list_favorites(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    favorite_type: Optional[str] = Query(None, pattern="^(profile|product|rental)$")
):
    """List user's favorites"""
    query = db.query(Favorite).filter(Favorite.user_id == user.id)
    
    if favorite_type:
        query = query.filter(Favorite.favorite_type == favorite_type)
    
    query = query.order_by(Favorite.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Enhance with item details
    enhanced_items = []
    for fav in items:
        fav_dict = FavoriteOut.model_validate(fav).model_dump()
        
        # Add item details
        if fav.favorite_type == "profile":
            profile = db.get(Profile, fav.favorite_id)
            if profile:
                fav_dict["item"] = {
                    "id": profile.id,
                    "name": profile.user.name if profile.user else None,
                    "city_id": profile.city_id,
                    "city_name": profile.city_ref.name if getattr(profile, "city_ref", None) else None,
                    "rating": profile.rating,
                    "total_reviews": profile.total_reviews
                }
        elif fav.favorite_type == "product":
            product = db.get(Product, fav.favorite_id)
            if product:
                fav_dict["item"] = {
                    "id": product.id,
                    "title": product.title,
                    "price": product.price,
                    "image_url": product.image_url
                }
        elif fav.favorite_type == "rental":
            rental = db.get(Rental, fav.favorite_id)
            if rental:
                fav_dict["item"] = {
                    "id": rental.id,
                    "title": rental.title,
                    "price_per_day": rental.price_per_day,
                    "image_url": rental.image_url
                }
        
        enhanced_items.append(fav_dict)
    
    return create_paginated_response(enhanced_items, total, page, page_size)

@router.get("/check")
def check_favorite(
    favorite_type: str = Query(..., pattern="^(profile|product|rental)$"),
    favorite_id: int = Query(..., ge=1),
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Check if item is favorited by user. Returns false if user is not authenticated."""
    if not user:
        return {"is_favorited": False, "favorite_id": None}
    
    favorite = db.query(Favorite).filter(
        Favorite.user_id == user.id,
        Favorite.favorite_type == favorite_type,
        Favorite.favorite_id == favorite_id
    ).first()
    
    return {"is_favorited": favorite is not None, "favorite_id": favorite.id if favorite else None}

