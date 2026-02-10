from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from ..database import get_db
from ..models import User, Role, Profile
from ..schemas import (
    ProfileIn, ProfileOut,
    PaginationParams, PaginatedResponse, SearchParams
)
from ..security import require_role, get_current_user
from ..helpers import paginate_query, create_paginated_response

router = APIRouter(prefix="/sellers", tags=["sellers"])

@router.post("/me", response_model=ProfileOut, dependencies=[Depends(require_role(Role.seller))])
def update_my_profile(
    data: ProfileIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update seller profile"""
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

@router.get("/me", response_model=ProfileOut, dependencies=[Depends(require_role(Role.seller))])
def get_my_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's seller profile. Auto-creates if it doesn't exist."""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        # Auto-create profile if it doesn't exist
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

