from typing import Literal, Optional, Set, Tuple
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Float, cast, func, or_, and_, case
from sqlalchemy.sql import exists
from sqlalchemy.orm import Session, aliased

from ..config import settings
from ..database import get_db
from ..helpers import calculate_distance, create_paginated_response, paginate_query

from ..models import (
    CategoryType,
    Favorite,
    Product,
    Profile,
    Rental,
    Role,
    Service,
    User,
    City,
    Category,
    Review,
    Order,
)
from ..security import get_current_user_optional
from ..utils.notifications import create_search_alert_notification

router = APIRouter(prefix="/search", tags=["search"])


def _build_distance_expression(lat_column, lon_column, latitude: float, longitude: float):
    """
    Build a database-side haversine distance expression (in kilometers).
    Falls back to mathematical functions available in most SQL dialects.
    """
    d_lat = func.radians(lat_column - latitude)
    d_lon = func.radians(lon_column - longitude)
    rad_lat1 = func.radians(latitude)
    rad_lat2 = func.radians(lat_column)

    sin_dlat = func.sin(d_lat / 2.0)
    sin_dlon = func.sin(d_lon / 2.0)

    a = func.pow(sin_dlat, 2) + func.cos(rad_lat1) * func.cos(rad_lat2) * func.pow(sin_dlon, 2)
    a = func.least(func.greatest(a, 0.0), 1.0)
    c = 2.0 * func.atan2(func.sqrt(a), func.sqrt(func.greatest(0.0, 1.0 - a)))
    return 6371.0 * c


def _apply_ordering(query, primary_column, sort_order: str, default_columns: list):
    """Apply ordering to a query with optional fallbacks."""
    orderings = []
    order = (sort_order or "desc").lower()
    if primary_column is not None:
        if order == "asc":
            orderings.append(primary_column.asc())
        else:
            orderings.append(primary_column.desc())

    orderings.extend(default_columns)

    return query.order_by(*orderings)


def _build_search_conditions(query_text: str, fields: list, use_fulltext: bool = True):
    """
    Build comprehensive search conditions with weighted relevance scoring.
    
    Args:
        query_text: The search query string
        fields: List of tuples (column, weight) where weight determines search priority
        use_fulltext: Whether to use PostgreSQL full-text search (if available)
    
    Returns:
        Tuple of (filter_condition, relevance_score_expression)
    """
    if not query_text or not query_text.strip():
        return None, None
    
    # Normalize query: remove extra spaces, lowercase
    normalized = re.sub(r'\s+', ' ', query_text.strip().lower())
    words = normalized.split()
    
    if not words:
        return None, None
    
    # Build ILIKE conditions for each word (fuzzy matching)
    conditions = []
    relevance_parts = []
    
    for word in words:
        word_pattern = f"%{word}%"
        word_conditions = []
        word_relevance = []
        
        for field, weight in fields:
            if field is None:
                continue
            
            # Use CASE to convert boolean to numeric (Postgres-safe)
            exact_match = case((field.ilike(word), 1.0), else_=0.0) * weight * 10.0
            starts_with = case((field.ilike(f"{word}%"), 1.0), else_=0.0) * weight * 5.0
            contains = case((field.ilike(word_pattern), 1.0), else_=0.0) * weight * 1.0
            
            word_conditions.append(field.ilike(word_pattern))
            word_relevance.append(exact_match)
            word_relevance.append(starts_with)
            word_relevance.append(contains)
        
        if word_conditions:
            conditions.append(or_(*word_conditions))
            # Sum all relevance scores for this word
            if word_relevance:
                relevance_parts.append(func.coalesce(func.greatest(*word_relevance), 0.0))
    
    # All words must match (AND logic)
    filter_condition = and_(*conditions) if conditions else None
    
    # Total relevance is sum of all word relevances
    if relevance_parts:
        # Use SQL coalesce and addition to sum relevance scores
        relevance_score = relevance_parts[0]
        for part in relevance_parts[1:]:
            relevance_score = func.coalesce(relevance_score, 0.0) + func.coalesce(part, 0.0)
    else:
        relevance_score = func.cast(0.0, Float)
    
    return filter_condition, relevance_score


def _build_master_search_conditions(
    query_text: str,
    profile_alias,
    user_alias,
    extra_fields: Optional[list] = None,
):
    """Build search conditions for masters/profiles with comprehensive field coverage."""
    if not query_text or not query_text.strip():
        return None, None
    
    # Name and keywords first; category fields supplied via outer join (see _perform_search)
    fields = [
        (user_alias.name, 10.0),
        (profile_alias.keywords, 8.0),
        (profile_alias.about, 5.0),
    ]
    if extra_fields:
        fields.extend(extra_fields)

    filter_condition, relevance_score = _build_search_conditions(query_text, fields)
    
    # Also search in services (related entities)
    if query_text:
        normalized = query_text.strip().lower()
        words = normalized.split()
        service_conditions = []
        review_conditions = []
        
        for word in words:
            word_pattern = f"%{word}%"
            # Search in services
            service_conditions.append(
                exists().where(
                    (Service.profile_id == profile_alias.id) &
                    (
                        Service.title.ilike(word_pattern) |
                        Service.description.ilike(word_pattern)
                    )
                )
            )
            # Search in reviews (via Order -> Service -> Profile)
            review_conditions.append(
                exists().where(
                    (Review.text.isnot(None)) &
                    (Review.text.ilike(word_pattern)) &
                    (Order.service_id.isnot(None)) &
                    (Service.profile_id == profile_alias.id) &
                    (Order.id == Review.order_id) &
                    (Order.service_id == Service.id)
                )
            )
        
        # Combine service and review matches
        service_match = None
        review_match = None
        
        if service_conditions:
            service_match = or_(*service_conditions)
        if review_conditions:
            review_match = or_(*review_conditions)
        
        # Combine all related matches
        related_conditions = []
        if service_match is not None:
            related_conditions.append(service_match)
        if review_match is not None:
            related_conditions.append(review_match)
        
        # At least one service or review must match
        if related_conditions:
            related_match = or_(*related_conditions)
            
            # Add related match to relevance (lower weight since it's indirect)
            # Service matches get weight 4.0, review matches get weight 3.0
            service_relevance = case((service_match, 1.0), else_=0.0) * 4.0 if service_match is not None else func.cast(0.0, Float)
            review_relevance = case((review_match, 1.0), else_=0.0) * 3.0 if review_match is not None else func.cast(0.0, Float)
            related_relevance = service_relevance + review_relevance
            
            if filter_condition is not None:
                filter_condition = or_(filter_condition, related_match)
            else:
                filter_condition = related_match
            
            if relevance_score is not None:
                relevance_score = func.coalesce(relevance_score, 0.0) + related_relevance
            else:
                relevance_score = related_relevance
    
    return filter_condition, relevance_score


def _build_product_search_conditions(
    query_text: str,
    product_alias,
    extra_fields: Optional[list] = None,
):
    """Build search conditions for products with comprehensive field coverage."""
    if not query_text or not query_text.strip():
        return None, None
    
    fields = [
        (product_alias.title, 10.0),
        (product_alias.brand, 8.0),
        (product_alias.description, 5.0),
    ]
    if extra_fields:
        fields.extend(extra_fields)

    filter_condition, relevance_score = _build_search_conditions(query_text, fields)
    
    # Also search in reviews (via Order -> Product)
    if query_text:
        normalized = query_text.strip().lower()
        words = normalized.split()
        review_conditions = []
        
        for word in words:
            word_pattern = f"%{word}%"
            review_conditions.append(
                exists().where(
                    (Review.text.isnot(None)) &
                    (Review.text.ilike(word_pattern)) &
                    (Order.product_id == product_alias.id) &
                    (Order.id == Review.order_id)
                )
            )
        
        # At least one review must match
        if review_conditions:
            review_match = or_(*review_conditions)
            
            # Add review match to relevance (lower weight since it's indirect)
            review_relevance = case((review_match, 1.0), else_=0.0) * 3.0
            
            if filter_condition is not None:
                filter_condition = or_(filter_condition, review_match)
            else:
                filter_condition = review_match
            
            if relevance_score is not None:
                relevance_score = func.coalesce(relevance_score, 0.0) + review_relevance
            else:
                relevance_score = review_relevance
    
    return filter_condition, relevance_score


def _build_rental_search_conditions(
    query_text: str,
    rental_alias,
    extra_fields: Optional[list] = None,
):
    """Build search conditions for rentals with comprehensive field coverage."""
    if not query_text or not query_text.strip():
        return None, None
    
    fields = [
        (rental_alias.title, 10.0),
        (rental_alias.description, 5.0),
    ]
    if extra_fields:
        fields.extend(extra_fields)

    filter_condition, relevance_score = _build_search_conditions(query_text, fields)
    
    # Also search in reviews (via Order -> Rental)
    if query_text:
        normalized = query_text.strip().lower()
        words = normalized.split()
        review_conditions = []
        
        for word in words:
            word_pattern = f"%{word}%"
            review_conditions.append(
                exists().where(
                    (Review.text.isnot(None)) &
                    (Review.text.ilike(word_pattern)) &
                    (Order.rental_id == rental_alias.id) &
                    (Order.id == Review.order_id)
                )
            )
        
        # At least one review must match
        if review_conditions:
            review_match = or_(*review_conditions)
            
            # Add review match to relevance (lower weight since it's indirect)
            review_relevance = case((review_match, 1.0), else_=0.0) * 3.0
            
            if filter_condition is not None:
                filter_condition = or_(filter_condition, review_match)
            else:
                filter_condition = review_match
            
            if relevance_score is not None:
                relevance_score = func.coalesce(relevance_score, 0.0) + review_relevance
            else:
                relevance_score = review_relevance
    
    return filter_condition, relevance_score

def _perform_search(
    scope: Literal["masters", "products", "rentals", "all"],
    q: Optional[str] = None,
    city: Optional[str] = None,
    city_id: Optional[int] = None,
    category: Optional[str] = None,  # Deprecated: category slug (kept for backward compatibility)
    category_id: Optional[int] = None,  # Category ID (preferred)
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    verified_only: bool = False,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = None,
    sort_by: str = "rating",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
    current_user: Optional[User] = None,
    db: Session = None
):
    """Unified search across masters, products, and rentals"""
    # Normalize search query: strip whitespace, return None if empty
    normalized_query = None
    if q and isinstance(q, str):
        stripped = q.strip()
        normalized_query = stripped if stripped else None
    results = {}
    
    # Convert category slug to category_id if provided (for backward compatibility)
    # Also handle parent categories by including all subcategories
    resolved_category_ids = None
    if category_id:
        # Direct category_id provided
        category_obj = db.query(Category).filter(
            Category.id == category_id,
            Category.is_active == True
        ).first()
        if category_obj:
            if category_obj.parent_id is None:
                # Parent category: get all active subcategory IDs
                subcategory_ids = [
                    subcat.id for subcat in db.query(Category)
                    .filter(
                        Category.parent_id == category_obj.id,
                        Category.is_active == True
                    )
                    .all()
                ]
                resolved_category_ids = subcategory_ids if subcategory_ids else [category_obj.id]
            else:
                # Subcategory: use exact category_id
                resolved_category_ids = [category_obj.id]
    elif category:
        # Look up category by slug
        category_obj = db.query(Category).filter(
            Category.slug == category,
            Category.is_active == True
        ).first()
        if category_obj:
            if category_obj.parent_id is None:
                # Parent category: get all active subcategory IDs
                subcategory_ids = [
                    subcat.id for subcat in db.query(Category)
                    .filter(
                        Category.parent_id == category_obj.id,
                        Category.is_active == True
                    )
                    .all()
                ]
                resolved_category_ids = subcategory_ids if subcategory_ids else [category_obj.id]
            else:
                # Subcategory: use exact category_id
                resolved_category_ids = [category_obj.id]
    
    if scope in ["masters", "all"]:
        query = db.query(Profile).join(User).filter(User.role == Role.master)
        price_stats_subq = None
        likes_subq = (
            db.query(
                Favorite.favorite_id.label("profile_id"),
                func.count(Favorite.id).label("likes_count"),
            )
            .filter(Favorite.favorite_type == "profile")
            .group_by(Favorite.favorite_id)
            .subquery()
        )
        query = query.outerjoin(likes_subq, Profile.id == likes_subq.c.profile_id)

        MasterCategory = aliased(Category)
        MasterCategoryParent = aliased(Category)
        query = query.outerjoin(
            MasterCategory,
            and_(
                Profile.category_id == MasterCategory.id,
                MasterCategory.type == CategoryType.master,
            ),
        )
        query = query.outerjoin(
            MasterCategoryParent,
            and_(
                MasterCategory.parent_id == MasterCategoryParent.id,
                MasterCategoryParent.type == CategoryType.master,
            ),
        )
        
        # City filtering: support both normalized city_id and legacy textual city field
        # If both city and city_id are provided, city_id takes precedence for exact matching
        if city_id is not None:
            query = query.filter(Profile.city_id == city_id)
        elif city:
            # Filter by city name via normalized city reference
            query = (
                query.outerjoin(City, Profile.city_id == City.id)
                .filter(City.name.ilike(f"%{city}%"))
            )
        
        if resolved_category_ids:
            query = query.filter(Profile.category_id.in_(resolved_category_ids))
        
        # Use improved search with weighted relevance scoring
        search_condition = None
        relevance_score = None
        if normalized_query:
            search_condition, relevance_score = _build_master_search_conditions(
                normalized_query,
                Profile,
                User,
                extra_fields=[
                    (MasterCategory.name, 9.0),
                    (MasterCategory.slug, 7.0),
                    (MasterCategoryParent.name, 8.0),
                    (MasterCategoryParent.slug, 6.0),
                ],
            )
            if search_condition is not None:
                query = query.filter(search_condition)
        
        if min_rating is not None:
            query = query.filter(Profile.rating >= min_rating)
        
        if verified_only:
            query = query.filter(Profile.verified == True)
        
        requires_price_join = any([
            min_price is not None,
            max_price is not None,
            sort_by == "price",
        ])
        
        if requires_price_join:
            price_stats_subq = (
                db.query(
                    Service.profile_id.label("profile_id"),
                    func.min(Service.price_from).label("min_service_price"),
                )
                .group_by(Service.profile_id)
                .subquery()
            )
            query = query.outerjoin(price_stats_subq, Profile.id == price_stats_subq.c.profile_id)
            
            if min_price is not None:
                query = query.filter(price_stats_subq.c.min_service_price >= min_price)
            if max_price is not None:
                query = query.filter(price_stats_subq.c.min_service_price <= max_price)
        
        distance_expr = None
        needs_distance = (
            latitude is not None
            and longitude is not None
            and (radius_km is not None or sort_by == "distance")
        )
        if needs_distance:
            if settings.ENABLE_POSTGIS:
                geom_profile = func.ST_MakePoint(
                    cast(Profile.longitude, Float),
                    cast(Profile.latitude, Float)
                )
                geom_search = func.ST_MakePoint(longitude, latitude)
                distance_expr = func.ST_DistanceSphere(geom_profile, geom_search) / 1000.0
                query = query.filter(Profile.latitude.isnot(None), Profile.longitude.isnot(None))
                if radius_km is not None:
                    query = query.filter(distance_expr <= radius_km)
            else:
                query = query.filter(Profile.latitude.isnot(None), Profile.longitude.isnot(None))
                distance_expr = _build_distance_expression(Profile.latitude, Profile.longitude, latitude, longitude)
                if radius_km is not None:
                    query = query.filter(distance_expr <= radius_km)
        
        likes_column = func.coalesce(likes_subq.c.likes_count, 0)
        
        # If we have a search query, prioritize relevance score, then apply user's sort preference
        if normalized_query and relevance_score is not None:
            # Combine relevance with other factors for best results
            # Relevance (40%) + Rating (30%) + Reviews (20%) + Likes (10%)
            combined_score = (
                relevance_score * 0.4 +
                Profile.rating * 0.3 * 20.0 +  # Scale rating to 0-100
                Profile.total_reviews * 0.2 * 0.1 +  # Scale reviews
                likes_column * 0.1 * 0.1  # Scale likes
            )
            primary_order_column = combined_score
        else:
            # No search query, use standard sorting
            primary_order_column = Profile.rating
            if sort_by == "reviews":
                primary_order_column = Profile.total_reviews
            elif sort_by == "price" and price_stats_subq is not None:
                primary_order_column = price_stats_subq.c.min_service_price
            elif sort_by == "distance" and distance_expr is not None:
                primary_order_column = distance_expr
            elif sort_by == "created_at":
                primary_order_column = Profile.created_at
            elif sort_by == "likes":
                primary_order_column = likes_column
        
        fallback_ordering = []
        # When sorting by relevance, still include quality metrics as tiebreakers
        if normalized_query and relevance_score is not None:
            # Relevance is primary, but use quality metrics as fallbacks
            fallback_ordering.append(Profile.rating.desc())
            fallback_ordering.append(Profile.total_reviews.desc())
            fallback_ordering.append(likes_column.desc())
            fallback_ordering.append(Profile.created_at.desc())
        else:
            # Standard fallback ordering
            if sort_by != "likes":
                fallback_ordering.append(likes_column.desc())
            if sort_by != "rating":
                fallback_ordering.append(Profile.rating.desc())
            if sort_by != "reviews":
                fallback_ordering.append(Profile.total_reviews.desc())
            fallback_ordering.append(Profile.created_at.desc())
        
        query = _apply_ordering(
            query,
            primary_order_column,
            sort_order if not (normalized_query and relevance_score is not None) else "desc",  # Always desc for relevance
            fallback_ordering,
        )
        
        items, total = paginate_query(query, page, page_size)

        profile_ids = [p.id for p in items]
        likes_counts: dict[int, int] = {}
        service_prices: dict[int, float] = {}
        if profile_ids:
            price_rows = (
                db.query(Service.profile_id, func.min(Service.price_from).label("lowest_price"))
                .filter(Service.profile_id.in_(profile_ids))
                .group_by(Service.profile_id)
                .all()
            )
            for profile_id, lowest_price in price_rows:
                if lowest_price is not None:
                    service_prices[profile_id] = float(lowest_price)
            likes_rows = (
                db.query(
                    Favorite.favorite_id,
                    func.count(Favorite.id).label("likes_count"),
                )
                .filter(
                    Favorite.favorite_type == "profile",
                    Favorite.favorite_id.in_(profile_ids),
                )
                .group_by(Favorite.favorite_id)
                .all()
            )
            likes_counts = {favorite_id: int(count or 0) for favorite_id, count in likes_rows}
        
        masters_list = []
        notification_targets: list[Tuple[int, float, Profile]] = []
        for p in items:
            user = p.user
            display_name = None
            if user and user.name:
                stripped = str(user.name).strip()
                display_name = stripped or None
            master_dict = {
                "id": p.id,
                "user_id": p.user_id,
                "name": display_name,
                "user_name": display_name,  # Alias for consistency with frontend
                "city_id": p.city_id,
                "city_name": p.city_ref.name if getattr(p, "city_ref", None) else None,
                "image_url": p.image_url,
                "about": p.about,
                "profession": p.profession,
                "verified": p.verified,
                "rating": p.rating,
                "total_reviews": p.total_reviews,
                "latitude": float(p.latitude) if p.latitude else None,
                "longitude": float(p.longitude) if p.longitude else None,
                "contact_phone": user.phone if user else None,
                "contact_email": user.email if user else None,
                "profile_id": p.id,
                "can_chat": True,
                "lowest_service_price": service_prices.get(p.id),
                "likes_count": likes_counts.get(p.id, 0),
            }
            master_dict.pop("city", None)
            computed_distance = None
            if latitude is not None and longitude is not None and p.latitude and p.longitude:
                computed_distance = calculate_distance(
                    latitude, longitude,
                    float(p.latitude), float(p.longitude)
                )
                master_dict["distance_km"] = round(computed_distance, 2)
            masters_list.append(master_dict)
            
            if (
                computed_distance is not None
                and radius_km is not None
                and user
            ):
                notification_targets.append((user.id, computed_distance, p))
        
        results["masters"] = {
            "items": masters_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
        
        if (
            latitude is not None
            and longitude is not None
            and radius_km is not None
            and notification_targets
            and settings.ENABLE_SEARCH_ALERTS
        ):
            notified_users: Set[int] = set()
            max_recipients = max(settings.SEARCH_ALERT_MAX_RECIPIENTS, 0)
            search_subject = category or q or "services like yours"
            location_hint = city or "their area"
            radius_hint = f"within {radius_km:.0f} km" if radius_km else "nearby"
            searcher_label = current_user.name if current_user else "A nearby client"
            
            for user_id, distance, profile in sorted(notification_targets, key=lambda item: item[1]):
                if max_recipients and len(notified_users) >= max_recipients:
                    break
                if current_user and user_id == current_user.id:
                    continue
                if user_id in notified_users:
                    continue
                
                distance_hint = f" (~{distance:.1f} km away)" if distance is not None else ""
                profile_location = location_hint
                if profile.city_ref:
                    profile_location = profile.city_ref.name or profile_location
                message = (
                    f"{searcher_label} is searching for {search_subject} "
                    f"{radius_hint} around {location_hint}{distance_hint}. "
                    f"Your profile in {profile_location} matches the request."
                )
                
                create_search_alert_notification(
                    db=db,
                    user_id=user_id,
                    message=message,
                    related_id=current_user.id if current_user else None,
                )
                notified_users.add(user_id)
    
    if scope in ["products", "all"]:
        query = db.query(Product).filter(Product.stock > 0)  # All products are automatically approved
        likes_subq = (
            db.query(
                Favorite.favorite_id.label("product_id"),
                func.count(Favorite.id).label("likes_count"),
            )
            .filter(Favorite.favorite_type == "product")
            .group_by(Favorite.favorite_id)
            .subquery()
        )
        query = query.outerjoin(likes_subq, Product.id == likes_subq.c.product_id)

        ProductCategory = aliased(Category)
        ProductCategoryParent = aliased(Category)
        query = query.outerjoin(
            ProductCategory,
            and_(
                Product.category_id == ProductCategory.id,
                ProductCategory.type == CategoryType.product,
            ),
        )
        query = query.outerjoin(
            ProductCategoryParent,
            and_(
                ProductCategory.parent_id == ProductCategoryParent.id,
                ProductCategoryParent.type == CategoryType.product,
            ),
        )
        
        # City filtering: support both normalized city_id and legacy textual city field
        # If both city and city_id are provided, city_id takes precedence for exact matching
        if city_id is not None:
            query = query.filter(Product.city_id == city_id)
        elif city:
            # Filter by city name via normalized city reference
            query = (
                query.outerjoin(City, Product.city_id == City.id)
                .filter(City.name.ilike(f"%{city}%"))
            )
        
        if resolved_category_ids:
            query = query.filter(Product.category_id.in_(resolved_category_ids))
        
        # Use improved search with weighted relevance scoring
        search_condition = None
        relevance_score = None
        if normalized_query:
            search_condition, relevance_score = _build_product_search_conditions(
                normalized_query,
                Product,
                extra_fields=[
                    (ProductCategory.name, 9.0),
                    (ProductCategory.slug, 7.0),
                    (ProductCategoryParent.name, 8.0),
                    (ProductCategoryParent.slug, 6.0),
                ],
            )
            if search_condition is not None:
                query = query.filter(search_condition)
        
        if min_price is not None:
            query = query.filter(Product.price >= min_price)
        
        if max_price is not None:
            query = query.filter(Product.price <= max_price)
        
        if min_rating is not None:
            query = query.filter(Product.rating >= min_rating)
        
        likes_column = func.coalesce(likes_subq.c.likes_count, 0)
        
        # If we have a search query, prioritize relevance score
        if normalized_query and relevance_score is not None:
            # Combine relevance with other factors
            combined_score = (
                relevance_score * 0.4 +
                Product.rating * 0.3 * 20.0 +
                Product.total_reviews * 0.2 * 0.1 +
                likes_column * 0.1 * 0.1
            )
            primary_order_column = combined_score
        else:
            primary_order_column = Product.rating
            if sort_by == "price":
                primary_order_column = Product.price
            elif sort_by == "reviews":
                primary_order_column = Product.total_reviews
            elif sort_by == "created_at":
                primary_order_column = Product.created_at
            elif sort_by == "distance":
                primary_order_column = None  # Products do not track geo-coordinates
            elif sort_by == "likes":
                primary_order_column = likes_column
        
        fallback_ordering = []
        if normalized_query and relevance_score is not None:
            fallback_ordering.append(Product.rating.desc())
            fallback_ordering.append(Product.total_reviews.desc())
            fallback_ordering.append(likes_column.desc())
            fallback_ordering.append(Product.created_at.desc())
        else:
            if sort_by != "likes":
                fallback_ordering.append(likes_column.desc())
            if sort_by != "rating":
                fallback_ordering.append(Product.rating.desc())
            if sort_by != "reviews":
                fallback_ordering.append(Product.total_reviews.desc())
            fallback_ordering.append(Product.created_at.desc())
        
        query = _apply_ordering(
            query,
            primary_order_column,
            sort_order if not (normalized_query and relevance_score is not None) else "desc",
            fallback_ordering,
        )
        
        items, total = paginate_query(query, page, page_size)
        product_ids = [product.id for product in items]
        likes_counts: dict[int, int] = {}
        if product_ids:
            likes_rows = (
                db.query(
                    Favorite.favorite_id,
                    func.count(Favorite.id).label("likes_count"),
                )
                .filter(
                    Favorite.favorite_type == "product",
                    Favorite.favorite_id.in_(product_ids),
                )
                .group_by(Favorite.favorite_id)
                .all()
            )
            likes_counts = {favorite_id: int(count or 0) for favorite_id, count in likes_rows}
        product_list = []
        for product in items:
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
                "likes_count": likes_counts.get(product.id, 0),
            }
            product_list.append(product_dict)
        
        results["products"] = create_paginated_response(product_list, total, page, page_size)
    
    if scope in ["rentals", "all"]:
        query = db.query(Rental).filter(Rental.available == True, Rental.stock > 0)  # All rentals are automatically approved
        likes_subq = (
            db.query(
                Favorite.favorite_id.label("rental_id"),
                func.count(Favorite.id).label("likes_count"),
            )
            .filter(Favorite.favorite_type == "rental")
            .group_by(Favorite.favorite_id)
            .subquery()
        )
        query = query.outerjoin(likes_subq, Rental.id == likes_subq.c.rental_id)

        RentalCategory = aliased(Category)
        RentalCategoryParent = aliased(Category)
        query = query.outerjoin(
            RentalCategory,
            and_(
                Rental.category_id == RentalCategory.id,
                RentalCategory.type == CategoryType.rental,
            ),
        )
        query = query.outerjoin(
            RentalCategoryParent,
            and_(
                RentalCategory.parent_id == RentalCategoryParent.id,
                RentalCategoryParent.type == CategoryType.rental,
            ),
        )
        
        # City filtering: support both normalized city_id and legacy textual city field
        # If both city and city_id are provided, city_id takes precedence for exact matching
        if city_id is not None:
            query = query.filter(Rental.city_id == city_id)
        elif city:
            # Filter by city name via normalized city reference
            query = (
                query.outerjoin(City, Rental.city_id == City.id)
                .filter(City.name.ilike(f"%{city}%"))
            )
        
        if resolved_category_ids:
            query = query.filter(Rental.category_id.in_(resolved_category_ids))
        
        # Use improved search with weighted relevance scoring
        search_condition = None
        relevance_score = None
        if normalized_query:
            search_condition, relevance_score = _build_rental_search_conditions(
                normalized_query,
                Rental,
                extra_fields=[
                    (RentalCategory.name, 9.0),
                    (RentalCategory.slug, 7.0),
                    (RentalCategoryParent.name, 8.0),
                    (RentalCategoryParent.slug, 6.0),
                ],
            )
            if search_condition is not None:
                query = query.filter(search_condition)
        
        if min_price is not None:
            query = query.filter(Rental.price_per_day >= min_price)
        
        if max_price is not None:
            query = query.filter(Rental.price_per_day <= max_price)
        
        likes_column = func.coalesce(likes_subq.c.likes_count, 0)
        
        # If we have a search query, prioritize relevance score
        if normalized_query and relevance_score is not None:
            # Combine relevance with other factors (use epoch for timestamp ordering in Postgres)
            combined_score = (
                relevance_score * 0.5 +
                likes_column * 0.3 * 0.1 +
                func.extract('epoch', Rental.created_at) * 0.2 * 0.0001  # Recent items get slight boost
            )
            primary_order_column = combined_score
        else:
            primary_order_column = None
            if sort_by == "price":
                primary_order_column = Rental.price_per_day
            elif sort_by == "created_at":
                primary_order_column = Rental.created_at
            elif sort_by == "likes":
                primary_order_column = likes_column
        
        fallback_ordering = []
        if normalized_query and relevance_score is not None:
            fallback_ordering.append(likes_column.desc())
            fallback_ordering.append(Rental.created_at.desc())
            fallback_ordering.append(Rental.price_per_day.asc())
        else:
            if sort_by != "likes":
                fallback_ordering.append(likes_column.desc())
            fallback_ordering.append(Rental.created_at.desc())
            if sort_by != "price":
                fallback_ordering.append(Rental.price_per_day.asc())
        
        query = _apply_ordering(
            query,
            primary_order_column,
            sort_order if not (normalized_query and relevance_score is not None) else "desc",
            fallback_ordering,
        )
        
        items, total = paginate_query(query, page, page_size)
        rental_ids = [rental.id for rental in items]
        likes_counts: dict[int, int] = {}
        if rental_ids:
            likes_rows = (
                db.query(
                    Favorite.favorite_id,
                    func.count(Favorite.id).label("likes_count"),
                )
                .filter(
                    Favorite.favorite_type == "rental",
                    Favorite.favorite_id.in_(rental_ids),
                )
                .group_by(Favorite.favorite_id)
                .all()
            )
            likes_counts = {favorite_id: int(count or 0) for favorite_id, count in likes_rows}
        rental_list = []
        for rental in items:
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
                "likes_count": likes_counts.get(rental.id, 0),
            }
            rental_list.append(rental_dict)
        
        results["rentals"] = create_paginated_response(rental_list, total, page, page_size)
    
    if scope == "all":
        return results
    
    if scope not in results:
        raise HTTPException(status_code=400, detail="Invalid scope")
    
    return results[scope]

@router.get("")
def search(
    scope: Literal["masters", "products", "rentals", "all"],
    q: Optional[str] = None,
    city: Optional[str] = None,
    city_id: Optional[int] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    verified_only: Optional[bool] = False,
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: Optional[float] = Query(None, ge=0),
    sort_by: Optional[str] = Query("rating", pattern="^(rating|price|reviews|distance|created_at|likes)$"),
    sort_order: Optional[str] = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Unified search endpoint"""
    return _perform_search(
        scope=scope,
        q=q,
        city=city,
        city_id=city_id,
        category=category,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        verified_only=verified_only or False,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        sort_by=sort_by or "rating",
        sort_order=sort_order or "desc",
        page=page,
        page_size=page_size,
        current_user=current_user,
        db=db,
    )
