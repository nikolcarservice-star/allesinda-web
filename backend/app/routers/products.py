from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Product, User, Role, Media, MediaStatus, City, Category, CategoryType
from sqlalchemy.orm import joinedload, selectinload
from ..schemas import ProductIn, ProductOut, PaginationParams, MediaOut
from ..security import require_role, get_current_user
from ..helpers import paginate_query, create_paginated_response

router = APIRouter(prefix="/products", tags=["products"])

@router.get("", response_model=dict)
def list_products(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    city: Optional[str] = None,
    city_id: Optional[int] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    brand: Optional[str] = None,
    sort_by: str = Query("created_at", pattern="^(rating|price|reviews|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$")
):
    """Delegate to unified search for products"""
    from .search import _perform_search
    # Unified search handles: stock>0 (all products are automatically approved)
    # brand filter isn't supported in unified search; apply simple brand filter by q when provided
    # Prefer passing exact params; brand can be folded into q to avoid changing unified API
    q_effective = q
    if brand:
        q_effective = f"{q} {brand}" if q else brand
    return _perform_search(
        scope="products",
        q=q_effective,
        city=city,
        city_id=city_id,
        category=category,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
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

@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get product by ID with media (all products are automatically approved)"""
    # Use selectinload to explicitly load all media items
    product = db.query(Product).options(selectinload(Product.media)).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get all media items for this product (all media is automatically approved)
    approved_media = (
        db.query(Media)
        .filter(Media.product_id == product_id)
        .order_by(Media.sort_order.asc().nullslast())
        .all()
    )
    
    # Convert to dict and include all media with full MediaOut schema
    product_dict = {
        "id": product.id,
        "seller_id": product.seller_id,
        "title": product.title,
        "description": product.description,
        "price": product.price,
        "stock": product.stock,
        "city_id": product.city_id,
        "city_name": product.city_ref.name if getattr(product, "city_ref", None) else None,
        "image_url": product.image_url,
        "brand": product.brand,
        "category_id": product.category_id,
        "rating": product.rating,
        "total_reviews": product.total_reviews,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
        "media": [MediaOut.model_validate(m) for m in sorted(approved_media, key=lambda x: x.sort_order or 0)]
    }
    return product_dict

@router.post("", response_model=ProductOut, status_code=201, dependencies=[Depends(require_role(Role.seller))])
def create_product(
    data: ProductIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new product"""
    payload = data.dict()
    city_id = payload.pop("city_id", None)
    category_id = payload.get("category_id")
    
    # Validate category_id if provided
    if category_id is not None:
        category = db.get(Category, category_id)
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
        if category.type != CategoryType.product:
            raise HTTPException(status_code=400, detail="Category must be of type 'product'")
    
    product = Product(seller_id=user.id, **payload)
    if city_id is not None:
        product.city_id = city_id
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.patch("/{product_id}", response_model=ProductOut, dependencies=[Depends(require_role(Role.seller))])
def update_product(
    product_id: int,
    data: ProductIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a product"""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = data.dict(exclude_unset=True)
    city_id_update = update_data.pop("city_id", None)
    category_id_update = update_data.get("category_id")
    
    # Validate category_id if being updated
    if category_id_update is not None:
        category = db.get(Category, category_id_update)
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
        if category.type != CategoryType.product:
            raise HTTPException(status_code=400, detail="Category must be of type 'product'")
    
    for key, value in update_data.items():
        setattr(product, key, value)
    if city_id_update is not None:
        product.city_id = city_id_update
    
    db.commit()
    db.refresh(product)
    return product

@router.delete("/{product_id}", dependencies=[Depends(require_role(Role.seller))])
def delete_product(
    product_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a product"""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(product)
    db.commit()
    return {"ok": True}

@router.get("/seller/me", response_model=dict, dependencies=[Depends(require_role(Role.seller))])
def my_products(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """Get current user's products"""
    query = db.query(Product).options(joinedload(Product.media)).filter(Product.seller_id == user.id)
    query = query.order_by(Product.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Convert SQLAlchemy models to Pydantic models with media
    product_out_items = []
    for item in items:
        # Get all media items for this product (no status filtering)
        all_media = db.query(Media).filter(Media.product_id == item.id).order_by(Media.sort_order).all()
        
        product_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "stock": item.stock,
            "city_id": item.city_id,
            "city_name": item.city_ref.name if getattr(item, "city_ref", None) else None,
            "image_url": item.image_url,
            "brand": item.brand,
            "category_id": item.category_id,
            "rating": item.rating,
            "total_reviews": item.total_reviews,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "media": [MediaOut.model_validate(m) for m in sorted(all_media, key=lambda x: x.sort_order or 0)]
        }
        product_out_items.append(product_dict)
    
    return create_paginated_response(product_out_items, total, page, page_size)
