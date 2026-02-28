"""
Cities API: list of German cities (id + name) for search, filters, signup.
"""
from fastapi import APIRouter, HTTPException

from app.data.german_cities import get_cities_list, get_city_by_id

router = APIRouter(prefix="/cities", tags=["cities"])


@router.get("")
def list_cities():
    """Return all 80 German cities. Used by frontend for dropdowns and search."""
    return get_cities_list()


@router.get("/{city_id:int}")
def get_city(city_id: int):
    """Return one city by id (1–80)."""
    name = get_city_by_id(city_id)
    if name is None:
        raise HTTPException(status_code=404, detail="City not found")
    return {"id": city_id, "name": name}
