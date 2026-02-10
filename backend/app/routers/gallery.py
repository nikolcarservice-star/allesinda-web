from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import logging
from ..database import get_db
from ..models import Media, MediaStatus, User, Profile
from ..schemas import MediaOut, PaginationParams
from ..security import get_current_user
from ..helpers import paginate_query, create_paginated_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gallery", tags=["gallery"])

@router.get("/work", response_model=dict)
def get_work_gallery(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    profile_id: Optional[int] = None,
    approved_only: bool = Query(True, description="Deprecated: All media is now automatically approved"),
    show_before_after_only: bool = Query(False, description="Only show before/after pairs"),
    photos_only: bool = Query(False, description="Only show photos, exclude videos"),
    videos_only: bool = Query(False, description="Only show videos, exclude photos")
):
    """Get work gallery feed - aggregated before/after photos and videos from all masters"""
    from ..models import Role
    
    # Validate that photos_only and videos_only are not both True
    if photos_only and videos_only:
        raise HTTPException(status_code=400, detail="photos_only and videos_only cannot both be True")
    
    # Start with Media query and join User through owner relationship
    # Use joinedload to eagerly load the owner relationship
    query = db.query(Media).join(User, Media.owner_id == User.id).options(
        joinedload(Media.owner)
    ).filter(
        User.role == Role.master
    ).filter(Media.profile_id.isnot(None))
    
    # All media is now automatically approved, no status filtering needed
    
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
    
    # Filter by profile if provided
    if profile_id:
        query = query.filter(Media.profile_id == profile_id)
    
    # Filter for before/after pairs only if requested
    if show_before_after_only:
        query = query.filter(Media.is_before_after == True)
    
    # Filter to exclude videos if photos_only is True
    if photos_only:
        query = query.filter(Media.media_type == "photo")
    
    # Filter to exclude photos if videos_only is True
    if videos_only:
        query = query.filter(Media.media_type == "video")
    
    # Order by before/after first, then by most recent
    # is_before_after DESC means True (1) comes before False (0)
    query = query.order_by(Media.is_before_after.desc(), Media.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Enhance with user/profile info
    enhanced_items = []
    for media in items:
        try:
            media_dict = MediaOut.model_validate(media).model_dump()
            # Add master info
            if media.owner:
                media_dict["master_name"] = media.owner.name
            if media.profile_id:
                profile = db.get(Profile, media.profile_id)
                if profile:
                    media_dict["master_profile_id"] = profile.id
                    media_dict["master_verified"] = profile.verified
                    media_dict["master_image_url"] = profile.image_url  # Include profile image URL
            # For before/after pairs, ensure both URLs are present
            if media.is_before_after:
                if not media.before_url or not media.after_url:
                    # Skip incomplete before/after pairs in gallery
                    continue
            enhanced_items.append(media_dict)
        except Exception as e:
            # Log error but continue processing other items
            logger.error(f"Error processing media {media.id}: {e}")
            continue
    
    return create_paginated_response(enhanced_items, total, page, page_size)

@router.get("/profile/{profile_id}", response_model=dict)
def get_profile_gallery(
    profile_id: int,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    approved_only: bool = Query(True, description="Deprecated: All media is now automatically approved")
):
    """Get work gallery for a specific master profile"""
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    query = db.query(Media).filter(Media.profile_id == profile_id)
    
    # All media is now automatically approved, no status filtering needed
    
    # Order by before/after first, then by most recent
    query = query.order_by(Media.is_before_after.desc(), Media.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    enhanced_items = [MediaOut.model_validate(media).model_dump() for media in items]
    
    return create_paginated_response(enhanced_items, total, page, page_size)

@router.get("/debug", response_model=dict)
def debug_gallery(
    db: Session = Depends(get_db)
):
    """Debug endpoint to check media records in database"""
    from ..models import Role
    
    # Count all media
    total_media = db.query(Media).count()
    
    # Count media from masters
    master_media = db.query(Media).join(User, Media.owner_id == User.id).filter(
        User.role == Role.master
    ).count()
    
    # Count approved media from masters
    approved_master_media = db.query(Media).join(User, Media.owner_id == User.id).filter(
        User.role == Role.master
    ).count()
    
    # Count media with profile_id
    media_with_profile = db.query(Media).filter(Media.profile_id.isnot(None)).count()
    
    # Get sample media records
    sample_media = db.query(Media).join(User, Media.owner_id == User.id).filter(
        User.role == Role.master
    ).limit(5).all()
    
    sample_data = []
    for media in sample_media:
        sample_data.append({
            "id": media.id,
            "owner_id": media.owner_id,
            "profile_id": media.profile_id,
            "status": media.status.value if media.status else None,
            "url": media.url,
            "category_id": media.category_id,
            "is_before_after": media.is_before_after,
            "before_url": media.before_url,
            "after_url": media.after_url,
            "owner_role": media.owner.role.value if media.owner else None
        })
    
    return {
        "total_media": total_media,
        "master_media": master_media,
        "approved_master_media": approved_master_media,
        "media_with_profile": media_with_profile,
        "sample_media": sample_data
    }

