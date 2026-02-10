from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import os
import re
from ..database import get_db
from ..models import User, Role, Profile, Service, AvailabilitySlot, Promotion, City
from ..schemas import (
    ProfileIn, ProfileOut, ProfileDetailedOut,
    ServiceIn, ServiceOut,
    AvailabilitySlotIn, AvailabilitySlotOut,
    PromotionIn, PromotionOut,
    PaginationParams, PaginatedResponse, SearchParams
)
from ..security import require_role, get_current_user
from ..helpers import paginate_query, create_paginated_response, calculate_distance
from ..config import settings
from ..utils.storage import get_upload_folder, build_media_url

router = APIRouter(prefix="/masters", tags=["masters"])

@router.get("/cities")
def list_german_cities(
    q: Optional[str] = Query(None, description="Optional search filter"),
    limit: int = Query(0, ge=0, le=1000),
    db: Session = Depends(get_db),
):
    """
    Return a list of German cities (id, name, coordinates).
    Optionally filter by substring 'q' (case-insensitive).
    """
    from sqlalchemy import asc
    qset = db.query(City).filter(City.is_active == True)
    if q:
        like = f"%{q}%"
        qset = qset.filter(City.name.ilike(like))
    qset = qset.order_by(asc(City.name))
    total_q = qset
    if limit and limit > 0:
        qset = qset.limit(limit)
    items = [{"id": c.id, "name": c.name, "latitude": float(c.latitude), "longitude": float(c.longitude)} for c in qset.all()]
    total = total_q.count()
    return {"items": items, "total": total}
@router.get("")
def list_masters(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    city: Optional[str] = None,
    city_id: Optional[int] = None,
    q: Optional[str] = None,
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    verified_only: Optional[bool] = False,
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: Optional[float] = Query(None, ge=0),
    sort_by: str = Query("rating", pattern="^(rating|price|reviews|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$")
):
    """Delegate to unified search for masters"""
    from .search import _perform_search
    # Preserve old behavior: masters list showed only verified profiles
    verified_flag = True
    return _perform_search(
        scope="masters",
        q=q,
        city=city,
        city_id=city_id,
        category=None,
        min_price=None,
        max_price=None,
        min_rating=min_rating,
        verified_only=verified_flag,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
        current_user=None,
        db=db,
    )

# NOTE: keep '/me' routes above the '/{profile_id}' route to avoid 'me' matching as an int.

@router.post("/me/profile-image", response_model=ProfileOut)
async def upload_profile_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload profile image for master. Image is stored in uploads/profiles/ directory with filename format: user_id_name.ext"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.flush()
    
    # Validate file type (images only)
    content_type = getattr(file, "content_type", None) or ""
    if not content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are allowed for profile images")
    
    # Get file extension
    file_ext = ""
    if file.filename:
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    
    # Validate image format
    valid_image_exts = ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp')
    if file_ext not in valid_image_exts:
        raise HTTPException(400, "Invalid image format. Supported: JPG, JPEG, PNG, GIF, WebP, BMP")
    
    # Create safe filename from user name: replace spaces and special chars with underscores
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', user.name.lower().strip())
    safe_name = re.sub(r'_+', '_', safe_name)  # Replace multiple underscores with single
    safe_name = safe_name[:50]  # Limit length
    
    # Generate filename: user_id_name.ext
    filename = f"{user.id}_{safe_name}.{file_ext}"
    
    # Create profiles directory
    upload_folder = get_upload_folder()
    profiles_dir = os.path.join(upload_folder, "profiles")
    os.makedirs(profiles_dir, exist_ok=True)
    
    # Delete old profile image if it exists
    if profile.image_url:
        old_image_url = profile.image_url
        media_prefix = settings.MEDIA_URL_PREFIX.rstrip("/")
        
        # Extract file path from old image URL
        if old_image_url.startswith(media_prefix):
            old_file_path = old_image_url[len(media_prefix):].lstrip("/")
        elif old_image_url.startswith("/"):
            old_file_path = old_image_url.lstrip("/")
        else:
            old_file_path = None
        
        # Delete old file from filesystem
        if old_file_path:
            old_full_path = os.path.join(upload_folder, old_file_path.replace("/", os.sep))
            if os.path.exists(old_full_path):
                try:
                    os.remove(old_full_path)
                except OSError:
                    pass  # Ignore errors when deleting old file
    
    # Save new file
    file_path = os.path.join(profiles_dir, filename)
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(500, f"Failed to save file: {str(e)}")
    
    # Generate URL for the saved file
    file_url = build_media_url("profiles", filename)
    
    # Update profile with new image URL
    profile.image_url = file_url
    db.commit()
    db.refresh(profile)
    return profile

@router.delete("/me/profile-image", response_model=ProfileOut)
async def delete_profile_image(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete profile image for master"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Delete old profile image file if it exists
    if profile.image_url:
        old_image_url = profile.image_url
        media_prefix = settings.MEDIA_URL_PREFIX.rstrip("/")
        upload_folder = get_upload_folder()
        
        # Extract file path from old image URL
        if old_image_url.startswith(media_prefix):
            old_file_path = old_image_url[len(media_prefix):].lstrip("/")
        elif old_image_url.startswith("/"):
            old_file_path = old_image_url.lstrip("/")
        else:
            old_file_path = None
        
        # Delete old file from filesystem
        if old_file_path:
            old_full_path = os.path.join(upload_folder, old_file_path.replace("/", os.sep))
            if os.path.exists(old_full_path):
                try:
                    os.remove(old_full_path)
                except OSError:
                    pass  # Ignore errors when deleting old file
    
    # Set image_url to None
    profile.image_url = None
    db.commit()
    db.refresh(profile)
    return profile

@router.patch("/me", response_model=ProfileOut)
def update_my_profile(
    data: ProfileIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update master profile"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)
    
    # Update fields
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)
    
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/me", response_model=ProfileOut)
def get_my_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's master profile. Auto-creates if it doesn't exist."""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        # Auto-create profile if it doesn't exist
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.post("/me/services", response_model=ServiceOut, dependencies=[Depends(require_role(Role.master))])
def add_service(
    data: ServiceIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add service to master profile"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile missing. Please create your profile first.")
    
    service = Service(
        profile_id=profile.id,
        title=data.title,
        description=data.description,
        price_from=data.price_from
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service

@router.get("/me/services", response_model=dict, dependencies=[Depends(require_role(Role.master))])
def list_my_services(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """List current user's services with pagination"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        return create_paginated_response([], 0, page, page_size)
    
    query = db.query(Service).filter(Service.profile_id == profile.id).order_by(Service.created_at.desc())
    items, total = paginate_query(query, page, page_size)
    
    service_items = [ServiceOut.model_validate(s) for s in items]
    return create_paginated_response(service_items, total, page, page_size)

@router.get("/{profile_id}/services", response_model=dict)
def list_services(
    profile_id: int,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """List services for a master profile (all services are automatically approved) with pagination"""
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    # All services are automatically approved
    query = db.query(Service).filter(Service.profile_id == profile_id).order_by(Service.created_at.desc())
    items, total = paginate_query(query, page, page_size)
    
    service_items = [ServiceOut.model_validate(s) for s in items]
    return create_paginated_response(service_items, total, page, page_size)

@router.patch("/me/services/{service_id}", response_model=ServiceOut, dependencies=[Depends(require_role(Role.master))])
def update_service(
    service_id: int,
    data: ServiceIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a service"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    service = db.get(Service, service_id)
    if not service or service.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Update fields
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(service, key, value)
    
    db.commit()
    db.refresh(service)
    return service

@router.delete("/me/services/{service_id}", dependencies=[Depends(require_role(Role.master))])
def delete_service(
    service_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a service"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    service = db.get(Service, service_id)
    if not service or service.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Service not found")
    
    db.delete(service)
    db.commit()
    return {"ok": True}

# Availability Slots endpoints
@router.post("/me/availability", response_model=AvailabilitySlotOut, dependencies=[Depends(require_role(Role.master))])
def add_availability_slot(
    data: AvailabilitySlotIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add availability slot"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile missing. Please create your profile first.")
    
    slot = AvailabilitySlot(
        profile_id=profile.id,
        start_time=data.start_time,
        end_time=data.end_time,
        is_available=data.is_available if data.is_available is not None else True
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot

@router.get("/me/availability", response_model=dict, dependencies=[Depends(require_role(Role.master))])
def list_my_availability_slots(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """List current user's availability slots with pagination"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        return create_paginated_response([], 0, page, page_size)
    
    query = db.query(AvailabilitySlot).filter(AvailabilitySlot.profile_id == profile.id).order_by(AvailabilitySlot.start_time)
    items, total = paginate_query(query, page, page_size)
    
    slot_items = [AvailabilitySlotOut.model_validate(s) for s in items]
    return create_paginated_response(slot_items, total, page, page_size)

@router.delete("/me/availability/{slot_id}", dependencies=[Depends(require_role(Role.master))])
def delete_availability_slot(
    slot_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete availability slot"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    slot = db.get(AvailabilitySlot, slot_id)
    if not slot or slot.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Availability slot not found")
    
    db.delete(slot)
    db.commit()
    return {"ok": True}

# Keep this route AFTER '/me' registrations so '/me' doesn't match here
@router.get("/{profile_id}", response_model=ProfileDetailedOut)
def get_master(profile_id: int, db: Session = Depends(get_db)):
    """Get master profile by ID"""
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Master profile not found")
    
    if profile.user.role != Role.master:
        raise HTTPException(status_code=404, detail="Profile is not a master")
    
    return profile
# Promotions endpoints
@router.post("/me/promotions", response_model=PromotionOut, dependencies=[Depends(require_role(Role.master))])
def create_promotion(
    data: PromotionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create promotion"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile missing. Please create your profile first.")
    
    promotion = Promotion(
        profile_id=profile.id,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=True
    )
    db.add(promotion)
    db.commit()
    db.refresh(promotion)
    return promotion

@router.get("/me/promotions", response_model=dict, dependencies=[Depends(require_role(Role.master))])
def list_my_promotions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """List current user's promotions with pagination"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        return create_paginated_response([], 0, page, page_size)
    
    query = db.query(Promotion).filter(Promotion.profile_id == profile.id).order_by(Promotion.start_date.desc())
    items, total = paginate_query(query, page, page_size)
    
    promotion_items = [PromotionOut.model_validate(p) for p in items]
    return create_paginated_response(promotion_items, total, page, page_size)

@router.delete("/me/promotions/{promotion_id}", dependencies=[Depends(require_role(Role.master))])
def delete_promotion(
    promotion_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete promotion"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    promotion = db.get(Promotion, promotion_id)
    if not promotion or promotion.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    db.delete(promotion)
    db.commit()
    return {"ok": True}
