from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from ..database import get_db
from ..helpers import create_paginated_response, paginate_query
from ..models import (
    CategoryType,
    Favorite,
    Product,
    Profile,
    Rental,
    Role,
    Service,
    User,
)
from ..schemas import TrendingItemOut

router = APIRouter(prefix="/trending", tags=["trending"])


def _first_media_url(media_collection) -> str | None:
    if not media_collection:
        return None
    for media in sorted(media_collection, key=lambda m: (m.sort_order or 0, m.id)):
        thumbnail = getattr(media, "thumbnail_url", None)
        if thumbnail:
            return thumbnail
        if getattr(media, "url", None):
            return media.url
    return None


@router.get("", response_model=dict)
def list_trending_items(
    item_type: CategoryType = Query(CategoryType.product, alias="type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(6, ge=1, le=48),
    db: Session = Depends(get_db),
):
    """
    Return paginated list of trending items for the given type, sorted by likes count.
    """
    if item_type == CategoryType.product:
        return _get_trending_products(db, page, page_size)
    if item_type == CategoryType.rental:
        return _get_trending_rentals(db, page, page_size)
    return _get_trending_masters(db, page, page_size)


def _get_trending_products(db: Session, page: int, page_size: int) -> dict:
    likes_subquery = (
        db.query(
            Favorite.favorite_id.label("product_id"),
            func.count(Favorite.id).label("likes_count"),
        )
        .filter(Favorite.favorite_type == "product")
        .group_by(Favorite.favorite_id)
        .subquery()
    )

    likes_column = func.coalesce(likes_subquery.c.likes_count, 0)

    query = (
        db.query(Product, likes_column.label("likes_count"))
        .outerjoin(likes_subquery, Product.id == likes_subquery.c.product_id)
        .options(selectinload(Product.media))
        .filter(Product.stock > 0)
        .order_by(likes_column.desc(), Product.rating.desc(), Product.created_at.desc())
    )

    rows, total = paginate_query(query, page=page, page_size=page_size)

    items: List[TrendingItemOut] = []
    for product, likes_count in rows:
        image_url = product.image_url or _first_media_url(product.media)
        subtitle = product.brand or (getattr(getattr(product, "city_ref", None), "name", None) or None)
        normalized_likes = int(likes_count or 0)
        items.append(
            TrendingItemOut(
                id=product.id,
                type=CategoryType.product,
                title=product.title or "Product",
                subtitle=subtitle or None,
                image_url=image_url,
                rating=float(product.rating) if product.rating is not None else None,
                total_reviews=product.total_reviews,
                price=float(product.price) if product.price is not None else None,
                likes_count=normalized_likes,
                sold_count=normalized_likes,
                city_id=product.city_id,
                city_name=(product.city_ref.name if getattr(product, "city_ref", None) else None),
            )
        )

    return create_paginated_response(items, total, page, page_size)


def _get_trending_rentals(db: Session, page: int, page_size: int) -> dict:
    likes_subquery = (
        db.query(
            Favorite.favorite_id.label("rental_id"),
            func.count(Favorite.id).label("likes_count"),
        )
        .filter(Favorite.favorite_type == "rental")
        .group_by(Favorite.favorite_id)
        .subquery()
    )

    likes_column = func.coalesce(likes_subquery.c.likes_count, 0)

    query = (
        db.query(Rental, likes_column.label("likes_count"))
        .outerjoin(likes_subquery, Rental.id == likes_subquery.c.rental_id)
        .options(selectinload(Rental.media))
        .filter(Rental.available.is_(True), Rental.stock > 0)
        .order_by(likes_column.desc(), Rental.created_at.desc())
    )

    rows, total = paginate_query(query, page=page, page_size=page_size)

    items: List[TrendingItemOut] = []
    for rental, likes_count in rows:
        image_url = rental.image_url or _first_media_url(rental.media)
        subtitle = getattr(getattr(rental, "city_ref", None), "name", None) or None
        normalized_likes = int(likes_count or 0)
        items.append(
            TrendingItemOut(
                id=rental.id,
                type=CategoryType.rental,
                title=rental.title or "Rental",
                subtitle=subtitle or None,
                image_url=image_url,
                price_per_day=float(rental.price_per_day) if rental.price_per_day is not None else None,
                likes_count=normalized_likes,
                sold_count=normalized_likes,
                city_id=rental.city_id,
                city_name=(rental.city_ref.name if getattr(rental, "city_ref", None) else None),
            )
        )

    return create_paginated_response(items, total, page, page_size)


def _get_trending_masters(db: Session, page: int, page_size: int) -> dict:
    likes_subquery = (
        db.query(
            Favorite.favorite_id.label("profile_id"),
            func.count(Favorite.id).label("likes_count"),
        )
        .filter(Favorite.favorite_type == "profile")
        .group_by(Favorite.favorite_id)
        .subquery()
    )

    service_prices = (
        db.query(
            Service.profile_id.label("profile_id"),
            func.min(Service.price_from).label("min_service_price"),
        )
        .group_by(Service.profile_id)
        .subquery()
    )

    likes_column = func.coalesce(likes_subquery.c.likes_count, 0)

    query = (
        db.query(Profile, likes_column.label("likes_count"), service_prices.c.min_service_price)
        .join(User, Profile.user_id == User.id)
        .outerjoin(likes_subquery, Profile.id == likes_subquery.c.profile_id)
        .outerjoin(service_prices, Profile.id == service_prices.c.profile_id)
        .options(joinedload(Profile.user))
        .filter(User.role == Role.master, User.is_active.is_(True))
        .order_by(likes_column.desc(), Profile.rating.desc(), Profile.created_at.desc())
    )

    rows, total = paginate_query(query, page=page, page_size=page_size)

    items: List[TrendingItemOut] = []
    for profile, likes_count, min_price in rows:
        user = profile.user
        subtitle = getattr(getattr(profile, "city_ref", None), "name", None) or None
        normalized_likes = int(likes_count or 0)
        items.append(
            TrendingItemOut(
                id=profile.id,
                type=CategoryType.master,
                title=(user.name if user else "Master"),
                subtitle=subtitle or None,
                image_url=profile.image_url,
                rating=float(profile.rating) if profile.rating is not None else None,
                total_reviews=profile.total_reviews,
                price=float(min_price) if min_price is not None else None,
                likes_count=normalized_likes,
                sold_count=normalized_likes,
                city_id=profile.city_id,
                city_name=(profile.city_ref.name if getattr(profile, "city_ref", None) else None),
                category_id=profile.category_id,
                completed_jobs=profile.completed_jobs,
            )
        )

    return create_paginated_response(items, total, page, page_size)

