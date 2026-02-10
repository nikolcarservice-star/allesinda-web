from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, and_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    CategoryType,
    ItemRelationship,
    Profile,
    Product,
    Rental,
    Role,
    User,
)
from ..schemas import ItemRelationshipIn, ItemRelationshipOut
from ..security import get_current_user

router = APIRouter(prefix="/relationships", tags=["relationships"])


def _resolve_item(db: Session, item_type: CategoryType, item_id: int):
    if item_type == CategoryType.master:
        return db.get(Profile, item_id)
    if item_type == CategoryType.product:
        return db.get(Product, item_id)
    if item_type == CategoryType.rental:
        return db.get(Rental, item_id)
    return None


def _assert_item_exists(db: Session, item_type: CategoryType, item_id: int):
    item = _resolve_item(db, item_type, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"{item_type.value.title()} not found")
    return item


def _assert_permissions(user: User, item_type: CategoryType, item, owning_required: bool = True):
    if user.role == Role.admin:
        return

    if item_type == CategoryType.master:
        if user.role != Role.master:
            raise HTTPException(status_code=403, detail="Only masters can manage master relationships")
        if owning_required and getattr(item, "user_id", None) != user.id:
            raise HTTPException(status_code=403, detail="You can only manage links for your profile")
    elif item_type in (CategoryType.product, CategoryType.rental):
        if user.role != Role.seller:
            raise HTTPException(status_code=403, detail="Only sellers can manage item relationships")
        owner_field = "seller_id"
        if owning_required and getattr(item, owner_field, None) != user.id:
            raise HTTPException(status_code=403, detail="You can only manage links for your listings")
    else:
        raise HTTPException(status_code=400, detail="Unsupported item type")


def _relationship_exists(db: Session, source_type: CategoryType, source_id: int, target_type: CategoryType, target_id: int) -> bool:
    return db.query(ItemRelationship).filter(
        or_(
            and_(
                ItemRelationship.source_type == source_type,
                ItemRelationship.source_id == source_id,
                ItemRelationship.target_type == target_type,
                ItemRelationship.target_id == target_id,
            ),
            and_(
                ItemRelationship.source_type == target_type,
                ItemRelationship.source_id == target_id,
                ItemRelationship.target_type == source_type,
                ItemRelationship.target_id == source_id,
            ),
        )
    ).first() is not None


class SearchItemResult(BaseModel):
    id: int
    type: CategoryType
    title: str
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    
    class Config:
        from_attributes = True


# IMPORTANT: This route must be defined BEFORE /{item_type}/{item_id} 
# to avoid route matching conflicts
@router.get("/search/{item_type}", response_model=List[SearchItemResult])
def search_items_for_linking(
    item_type: CategoryType,
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=50, description="Maximum number of results"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Search for items by name/title to link them.
    Returns a list of items matching the search query.
    """
    results = []
    search_pattern = f"%{q.lower()}%"
    
    if item_type == CategoryType.master:
        # Search profiles (masters)
        query = db.query(Profile).join(User).filter(
            func.lower(User.name).like(search_pattern)
        ).limit(limit)
        
        for profile in query.all():
            user_obj = profile.user
            results.append(SearchItemResult(
                id=profile.id,
                type=CategoryType.master,
                title=user_obj.name,
                subtitle=profile.about[:100] if profile.about else None,
                image_url=profile.image_url,
            ))
    
    elif item_type == CategoryType.product:
        # Search products
        query = db.query(Product).filter(
            func.lower(Product.title).like(search_pattern)
        ).limit(limit)
        
        for product in query.all():
            results.append(SearchItemResult(
                id=product.id,
                type=CategoryType.product,
                title=product.title,
                subtitle=product.description[:100] if product.description else None,
                image_url=product.image_url,
            ))
    
    elif item_type == CategoryType.rental:
        # Search rentals
        query = db.query(Rental).filter(
            func.lower(Rental.title).like(search_pattern)
        ).limit(limit)
        
        for rental in query.all():
            results.append(SearchItemResult(
                id=rental.id,
                type=CategoryType.rental,
                title=rental.title,
                subtitle=rental.description[:100] if rental.description else None,
                image_url=rental.image_url,
            ))
    
    return results


@router.get("/{item_type}/{item_id}", response_model=dict)
def list_relationships(
    item_type: CategoryType,
    item_id: int,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List relationships for an item with pagination"""
    from ..helpers import paginate_query, create_paginated_response
    
    _assert_item_exists(db, item_type, item_id)

    query = db.query(ItemRelationship).filter(
        or_(
            and_(
                ItemRelationship.source_type == item_type,
                ItemRelationship.source_id == item_id,
            ),
            and_(
                ItemRelationship.target_type == item_type,
                ItemRelationship.target_id == item_id,
            ),
        )
    ).order_by(ItemRelationship.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    relationship_items = [ItemRelationshipOut.model_validate(rel) for rel in items]
    
    return create_paginated_response(relationship_items, total, page, page_size)


@router.post("", response_model=ItemRelationshipOut, status_code=201)
def create_relationship(
    payload: ItemRelationshipIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    source_item = _assert_item_exists(db, payload.source_type, payload.source_id)
    _assert_permissions(user, payload.source_type, source_item)

    _assert_item_exists(db, payload.target_type, payload.target_id)

    if _relationship_exists(db, payload.source_type, payload.source_id, payload.target_type, payload.target_id):
        raise HTTPException(status_code=400, detail="Relationship already exists")

    relationship = ItemRelationship(
        source_type=payload.source_type,
        source_id=payload.source_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        created_by=user.id,
    )
    db.add(relationship)
    db.commit()
    db.refresh(relationship)
    return relationship


@router.delete("/{relationship_id}")
def delete_relationship(
    relationship_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    relationship = db.get(ItemRelationship, relationship_id)
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")

    if user.role != Role.admin:
        source_item = _resolve_item(db, relationship.source_type, relationship.source_id)
        target_item = _resolve_item(db, relationship.target_type, relationship.target_id)

        can_manage_source = False
        can_manage_target = False

        if source_item:
            try:
                _assert_permissions(user, relationship.source_type, source_item, owning_required=True)
                can_manage_source = True
            except HTTPException:
                can_manage_source = False

        if target_item:
            try:
                _assert_permissions(user, relationship.target_type, target_item, owning_required=True)
                can_manage_target = True
            except HTTPException:
                can_manage_target = False

        if not (can_manage_source or can_manage_target):
            raise HTTPException(status_code=403, detail="You do not have permission to remove this relationship")

    db.delete(relationship)
    db.commit()
    return {"ok": True}
