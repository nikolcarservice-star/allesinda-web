from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from ..database import get_db
from ..models import City, Role, User
from ..schemas import CityIn, CityOut, CityUpdate, PaginationParams
from ..security import get_current_user, require_role
from ..helpers import paginate_query, create_paginated_response
from sqlalchemy import asc

router = APIRouter(prefix="/cities", tags=["cities"])

@router.get("", response_model=dict)
def list_cities(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="Search by name (case-insensitive)"),
    state: Optional[str] = Query(None, description="Filter by state"),
    active_only: bool = Query(False, description="Only active cities if true"),
):
    query = db.query(City)
    if q:
        like = f"%{q}%"
        query = query.filter(City.name.ilike(like))
    if state:
        query = query.filter(City.state == state)
    if active_only:
        query = query.filter(City.is_active == True)
    query = query.order_by(asc(City.name))
    items, total = paginate_query(query, page, page_size)
    return create_paginated_response([CityOut.model_validate(c) for c in items], total, page, page_size)

@router.get("/{city_id}", response_model=CityOut)
def get_city(city_id: int, db: Session = Depends(get_db)):
    city = db.get(City, city_id)
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    return city

@router.post("", response_model=CityOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role(Role.admin))])
def create_city(
    data: CityIn,
    db: Session = Depends(get_db),
):
    # Prevent duplicate by (name, state)
    exists = (
        db.query(City)
        .filter(City.name == data.name, City.state == data.state)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="City with same name/state already exists")
    city = City(
        name=data.name,
        state=data.state,
        latitude=data.latitude,
        longitude=data.longitude,
        is_active=data.is_active if data.is_active is not None else True,
    )
    db.add(city)
    db.commit()
    db.refresh(city)
    return city

@router.patch("/{city_id}", response_model=CityOut, dependencies=[Depends(require_role(Role.admin))])
def update_city(
    city_id: int,
    data: CityUpdate,
    db: Session = Depends(get_db),
):
    city = db.get(City, city_id)
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    update_data = data.dict(exclude_unset=True)
    # Check duplicate if name/state is changing
    new_name = update_data.get("name", city.name)
    new_state = update_data.get("state", city.state)
    dup = (
        db.query(City)
        .filter(
            City.id != city.id,
            City.name == new_name,
            City.state == new_state,
        )
        .first()
    )
    if dup:
        raise HTTPException(status_code=400, detail="Another city with same name/state exists")
    for key, value in update_data.items():
        setattr(city, key, value)
    db.commit()
    db.refresh(city)
    return city

@router.delete("/{city_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(Role.admin))])
def delete_city(city_id: int, db: Session = Depends(get_db)):
    city = db.get(City, city_id)
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    db.delete(city)
    db.commit()
    return {"ok": True}

@router.post("/{city_id}/toggle", response_model=CityOut, dependencies=[Depends(require_role(Role.admin))])
def toggle_city_active(city_id: int, db: Session = Depends(get_db)):
    city = db.get(City, city_id)
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    city.is_active = not bool(city.is_active)
    db.commit()
    db.refresh(city)
    return city


