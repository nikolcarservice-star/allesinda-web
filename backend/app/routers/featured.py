from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session, aliased, joinedload, selectinload
from sqlalchemy.sql import exists

logger = logging.getLogger(__name__)

from ..config import settings
from ..category_filter import resolve_category_ids
from ..database import get_db
from ..helpers import create_paginated_response
from ..profile_queries import public_master_profile_query
from ..utils.storage import normalize_response_media_url, media_out_with_local_urls
from ..models import (
    Category,
    CategoryType,
    Favorite,
    FeaturedItem,
    ItemRelationship,
    Media,
    MediaStatus,
    Order,
    OrderStatus,
    OrderType,
    Product,
    Profile,
    RecentlyViewedItem,
    Rental,
    Review,
    Role,
    Service,
    User,
    City,
)
from ..schemas import (
    CategoryOut,
    FeaturedDetailOut,
    FeaturedItemOut,
    HomeContentOut,
    MediaOut,
    RelatedItemSummary,
    ServiceOut,
)
from ..security import get_current_user, get_current_user_optional

router = APIRouter(prefix="/featured", tags=["featured"])

COMPLETED_ORDER_STATUSES = (OrderStatus.paid, OrderStatus.completed)


def _best_media_url(media_collection, *, require_approved: bool = True) -> str | None:
    # require_approved parameter is deprecated - all media is now automatically approved
    if not media_collection:
        return None
    media_list = list(media_collection)
    for media in sorted(media_list, key=lambda m: (m.sort_order or 0, m.id)):
        thumbnail = getattr(media, "thumbnail_url", None)
        if thumbnail:
            return thumbnail
        url = getattr(media, "url", None)
        if url:
            return url
    return None


def _favorite_type_for_category(item_type: CategoryType) -> str:
    if item_type == CategoryType.master:
        return "profile"
    if item_type == CategoryType.product:
        return "product"
    return "rental"


def _master_display_title(user: User | None, profile_id: int) -> str:
    """Pydantic requires a non-null title; some legacy rows have users without names."""
    if user and user.name:
        name = str(user.name).strip()
        if name:
            return name
    return f"Master #{profile_id}"


def _safe_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        result = float(value)
        if result != result:  # NaN
            return None
        return result
    except (TypeError, ValueError):
        return None


def _load_like_counts(db: Session, item_type: CategoryType, item_ids: List[int]) -> Dict[int, int]:
    if not item_ids:
        return {}
    favorite_type = _favorite_type_for_category(item_type)
    try:
        rows = (
            db.query(
                Favorite.favorite_id,
                func.count(Favorite.id).label("likes_count"),
            )
            .filter(
                Favorite.favorite_type == favorite_type,
                Favorite.favorite_id.in_(item_ids),
            )
            .group_by(Favorite.favorite_id)
            .all()
        )
        return {favorite_id: int(likes or 0) for favorite_id, likes in rows}
    except Exception as exc:
        logger.warning("Failed to load like counts for %s: %s", item_type, exc)
        return {}


def _collect_master_category_labels(profile: Profile) -> list[str]:
    """Human-readable category labels for master profile display."""
    labels: list[str] = []
    seen: set[str] = set()

    def add(value: Optional[str]) -> None:
        text = (value or "").strip()
        if not text:
            return
        key = text.casefold()
        if key in seen:
            return
        seen.add(key)
        labels.append(text)

    if profile.profession:
        add(profile.profession)

    category = getattr(profile, "category_ref", None)
    if category:
        parent = getattr(category, "parent", None)
        if parent:
            add(parent.name)
        add(category.name)

    return labels


def _serialize_master(profile: Profile, *, lowest_price: Optional[float] = None, likes_count: int = 0) -> dict:
    """
    Serialize a master profile to FeaturedItemOut format.
    
    IMPORTANT: For masters, image_url is always the profile image (profile.image_url),
    not portfolio or media images. This ensures consistency across all master card displays
    (featured items, recently viewed, search results, etc.).
    """
    user = profile.user
    title = _master_display_title(user, profile.id)
    subtitle = profile.city_ref.name if getattr(profile, "city_ref", None) else None
    price_value = _safe_float(lowest_price)
    category_labels = _collect_master_category_labels(profile)
    return {
        "id": profile.id,
        "type": CategoryType.master,
        "title": title,
        "subtitle": subtitle,
        "description": profile.about,
        "image_url": normalize_response_media_url(profile.image_url),
        "rating": _safe_float(profile.rating),
        "total_reviews": int(profile.total_reviews) if profile.total_reviews is not None else None,
        "price": price_value,
        "price_per_day": None,
        "city_id": profile.city_id,
        "city_name": profile.city_ref.name if getattr(profile, "city_ref", None) else None,
        "category_id": profile.category_id,
        "category": category_labels[0] if category_labels else None,
        "created_at": profile.created_at,
        "likes_count": likes_count,
    }


def _serialize_product(product: Product, media_items=None, *, likes_count: int = 0) -> dict:
    image_candidates = media_items if media_items is not None else getattr(product, "media", None)
    image_url = product.image_url or _best_media_url(image_candidates)
    return {
        "id": product.id,
        "type": CategoryType.product,
        "title": product.title,
        "subtitle": product.brand,
        "description": product.description,
        "image_url": image_url,
        "rating": float(product.rating) if product.rating is not None else None,
        "total_reviews": product.total_reviews,
        "price": float(product.price) if product.price is not None else None,
        "price_per_day": None,
        "city_id": product.city_id,
        "city_name": product.city_ref.name if getattr(product, "city_ref", None) else None,
        "category_id": product.category_id,
        "created_at": product.created_at,
        "likes_count": likes_count,
    }


def _get_rental_review_stats(
    db: Session,
    rental_ids: List[int],
) -> Dict[int, Tuple[Optional[float], Optional[int]]]:
    """
    Return mapping of rental_id -> (average_rating, review_count)
    """
    if not rental_ids:
        return {}

    stats = (
        db.query(
            Order.rental_id.label("rental_id"),
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("review_count"),
        )
        .join(Review, Review.order_id == Order.id)
        .filter(
            Order.rental_id.in_(set(rental_ids)),
            Order.order_type == OrderType.rental,
            Order.status.in_(COMPLETED_ORDER_STATUSES),
        )
        .group_by(Order.rental_id)
        .all()
    )

    results: Dict[int, Tuple[Optional[float], Optional[int]]] = {
        rental_id: (
            float(avg_rating) if avg_rating is not None else None,
            int(review_count) if review_count is not None else None,
        )
        for rental_id, avg_rating, review_count in stats
    }
    return results


def _serialize_rental(
    rental: Rental,
    media_items=None,
    *,
    rating: Optional[float] = None,
    total_reviews: Optional[int] = None,
    likes_count: int = 0,
) -> dict:
    image_candidates = media_items if media_items is not None else getattr(rental, "media", None)
    image_url = rental.image_url or _best_media_url(image_candidates)
    rating_value = rating
    reviews_value = total_reviews
    if rating_value is None:
        rating_value = getattr(rental, "avg_rating", None)
    if reviews_value is None:
        reviews_value = getattr(rental, "review_count", None)
    if rating_value is not None:
        rating_value = float(rating_value)
    if reviews_value is not None:
        reviews_value = int(reviews_value)
    return {
        "id": rental.id,
        "type": CategoryType.rental,
        "title": rental.title,
        "subtitle": rental.city_ref.name if getattr(rental, "city_ref", None) else None,
        "description": rental.description,
        "image_url": image_url,
        "rating": rating_value,
        "total_reviews": reviews_value,
        "price": None,
        "price_per_day": float(rental.price_per_day) if rental.price_per_day is not None else None,
        "stock": rental.stock,
        "city_id": rental.city_id,
        "city_name": rental.city_ref.name if getattr(rental, "city_ref", None) else None,
        "category_id": rental.category_id,
        "created_at": rental.created_at,
        "likes_count": likes_count,
    }


def _load_item_summaries(db: Session, ids_by_type: Dict[CategoryType, set[int]]) -> Dict[Tuple[CategoryType, int], Dict[str, Optional[str]]]:
    summaries: Dict[Tuple[CategoryType, int], Dict[str, Optional[str]]] = {}

    if CategoryType.master in ids_by_type and ids_by_type[CategoryType.master]:
        profiles = (
            public_master_profile_query(db, with_category=True)
            .filter(Profile.id.in_(ids_by_type[CategoryType.master]))
            .all()
        )
        for profile in profiles:
            user = profile.user
            summaries[(CategoryType.master, profile.id)] = {
                "title": _master_display_title(user, profile.id),
                "image_url": normalize_response_media_url(profile.image_url),
            }

    if CategoryType.product in ids_by_type and ids_by_type[CategoryType.product]:
        products = (
            db.query(Product)
            .options(selectinload(Product.media))
            .filter(Product.id.in_(ids_by_type[CategoryType.product]))
            .all()
        )
        for product in products:
            summaries[(CategoryType.product, product.id)] = {
                "title": product.title,
                "image_url": product.image_url or _best_media_url(product.media),
            }

    if CategoryType.rental in ids_by_type and ids_by_type[CategoryType.rental]:
        rentals = (
            db.query(Rental)
            .options(selectinload(Rental.media))
            .filter(Rental.id.in_(ids_by_type[CategoryType.rental]))
            .all()
        )
        for rental in rentals:
            summaries[(CategoryType.rental, rental.id)] = {
                "title": rental.title,
                "image_url": rental.image_url or _best_media_url(rental.media),
            }

    return summaries


def _build_relationship_mapping(
    db: Session,
    featured_items: List[FeaturedItemOut],
) -> Dict[Tuple[CategoryType, int], List[RelatedItemSummary]]:
    if not featured_items:
        return {}

    items_by_type: Dict[CategoryType, set[int]] = defaultdict(set)
    for item in featured_items:
        items_by_type[item.type].add(item.id)

    filters = []
    for item_type, ids in items_by_type.items():
        if not ids:
            continue
        filters.append(
            and_(
                ItemRelationship.source_type == item_type,
                ItemRelationship.source_id.in_(ids),
            )
        )
        filters.append(
            and_(
                ItemRelationship.target_type == item_type,
                ItemRelationship.target_id.in_(ids),
            )
        )

    if not filters:
        return {}

    relationships = db.query(ItemRelationship).filter(or_(*filters)).all()
    if not relationships:
        return {}

    ids_by_type: Dict[CategoryType, set[int]] = defaultdict(set)
    for rel in relationships:
        ids_by_type[rel.source_type].add(rel.source_id)
        ids_by_type[rel.target_type].add(rel.target_id)

    summaries = _load_item_summaries(db, ids_by_type)
    mapping: Dict[Tuple[CategoryType, int], List[RelatedItemSummary]] = defaultdict(list)

    item_lookup = {(item.type, item.id) for item in featured_items}

    for rel in relationships:
        source_key = (rel.source_type, rel.source_id)
        target_key = (rel.target_type, rel.target_id)

        if source_key in item_lookup:
            summary = summaries.get(target_key)
            if summary:
                mapping[source_key].append(
                    RelatedItemSummary(
                        relationship_id=rel.id,
                        id=rel.target_id,
                        type=rel.target_type,
                        title=summary["title"],
                        image_url=summary.get("image_url"),
                    )
                )

        if target_key in item_lookup:
            summary = summaries.get(source_key)
            if summary:
                mapping[target_key].append(
                    RelatedItemSummary(
                        relationship_id=rel.id,
                        id=rel.source_id,
                        type=rel.source_type,
                        title=summary["title"],
                        image_url=summary.get("image_url"),
                    )
                )

    return mapping


def _attach_relationships(db: Session, items: List[FeaturedItemOut]) -> None:
    if not items:
        return
    try:
        mapping = _build_relationship_mapping(db, items)
        for item in items:
            key = (item.type, item.id)
            item.relationships = mapping.get(key, [])
    except Exception as exc:
        logger.warning("Failed to load item relationships, continuing without them: %s", exc)
        for item in items:
            item.relationships = []


def _apply_sort(items: List[dict], sort_by: str, sort_order: str) -> None:
    reverse = sort_order == "desc"

    def _sort_key(item: dict):
        if sort_by == "likes":
            return item.get("likes_count") or 0
        if sort_by == "rating":
            return item.get("rating") or 0.0
        if sort_by == "price":
            if item["type"] == CategoryType.product:
                return item.get("price") or 0.0
            if item["type"] == CategoryType.rental:
                return item.get("price_per_day") or 0.0
            return 0.0
        if sort_by == "created_at":
            created = item.get("created_at")
            if isinstance(created, datetime):
                return created.timestamp()
            return 0.0
        created = item.get("created_at")
        created_ts = created.timestamp() if isinstance(created, datetime) else 0.0
        return (item.get("rating") or 0.0, created_ts)

    items.sort(key=_sort_key, reverse=reverse)


def _record_recent_view(db: Session, user_id: int, item_type: CategoryType, item_id: int) -> None:
    existing = (
        db.query(RecentlyViewedItem)
        .filter(
            RecentlyViewedItem.user_id == user_id,
            RecentlyViewedItem.item_type == item_type,
            RecentlyViewedItem.item_id == item_id,
        )
        .first()
    )
    now = datetime.now(timezone.utc)
    if existing:
        existing.viewed_at = now
    else:
        record = RecentlyViewedItem(
            user_id=user_id,
            item_type=item_type,
            item_id=item_id,
            viewed_at=now,
        )
        db.add(record)
    db.commit()


def _build_featured_item_from_type(db: Session, item_type: CategoryType, item_id: int) -> Optional[FeaturedItemOut]:
    if item_type == CategoryType.master:
        profile = public_master_profile_query(db, with_category=True).filter(Profile.id == item_id).first()
        if not profile:
            return None
        lowest_price = (
            db.query(func.min(Service.price_from))
            .filter(Service.profile_id == profile.id)
            .scalar()
        )
        return FeaturedItemOut(**_serialize_master(profile, lowest_price=lowest_price))
    if item_type == CategoryType.product:
        product = (
            db.query(Product)
            .options(selectinload(Product.media))
            .filter(Product.id == item_id)
            .first()
        )
        if not product:
            return None
        return FeaturedItemOut(**_serialize_product(product))
    if item_type == CategoryType.rental:
        rental = (
            db.query(Rental)
            .options(selectinload(Rental.media))
            .filter(Rental.id == item_id)
            .first()
        )
        if not rental:
            return None
        stats = _get_rental_review_stats(db, [rental.id])
        avg_rating, review_count = stats.get(rental.id, (None, None))
        return FeaturedItemOut(**_serialize_rental(rental, rating=avg_rating, total_reviews=review_count))
    return None


@router.get("/curated", response_model=dict)
def list_curated_featured_items(
    db: Session = Depends(get_db),
    types: Optional[str] = Query(None, description="Comma-separated item types"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    requested_types = (
        {
            CategoryType[t.strip()]
            for t in types.split(",")
            if t.strip() in CategoryType.__members__
        }
        if types
        else {CategoryType.master, CategoryType.product, CategoryType.rental}
    )

    query = (
        db.query(FeaturedItem)
        .filter(FeaturedItem.is_active.is_(True))
        .order_by(FeaturedItem.priority.desc(), FeaturedItem.updated_at.desc(), FeaturedItem.id.desc())
    )
    if requested_types:
        query = query.filter(FeaturedItem.item_type.in_(list(requested_types)))

    # Safety limit: prevent loading too many featured items into memory
    MAX_FEATURED_ITEMS = 1000
    entries = query.limit(MAX_FEATURED_ITEMS).all()
    if len(entries) >= MAX_FEATURED_ITEMS:
        logger.warning(f"Featured items query hit safety limit of {MAX_FEATURED_ITEMS}")

    curated_items: List[dict] = []
    for entry in entries:
        try:
            item = _build_featured_item_from_type(db, entry.item_type, entry.item_id)
        except Exception as exc:
            logger.warning(
                "Skipping curated featured item %s/%s: %s",
                entry.item_type,
                entry.item_id,
                exc,
            )
            continue
        if not item:
            continue
        item_dict = item.model_dump(mode="json")
        item_dict["priority"] = entry.priority
        item_dict["featured_id"] = entry.id
        curated_items.append(item_dict)

    total = len(curated_items)
    start = (page - 1) * page_size
    end = start + page_size
    paged = curated_items[start:end]

    return create_paginated_response(paged, total, page, page_size)


@router.get("", response_model=dict)
def list_featured_items(
    db: Session = Depends(get_db),
    types: Optional[str] = Query(None, description="Comma-separated item types"),
    category: Optional[str] = Query(None, description="Filter by category slug"),
    city: Optional[str] = None,
    city_id: Optional[int] = None,
    q: Optional[str] = Query(None, description="Search query"),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    sort_by: str = Query("rating", pattern="^(rating|price|created_at|likes)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    requested_types = set(
        [CategoryType(t.strip()) for t in types.split(",") if t.strip() in CategoryType.__members__]
    ) if types else {CategoryType.master, CategoryType.product, CategoryType.rental}

    search_term = (q or "").strip()

    aggregated: List[dict] = []

    if CategoryType.master in requested_types:
        master_query = public_master_profile_query(db, with_category=True)
        if category:
            category_ids = resolve_category_ids(db, category)
            if category_ids:
                master_query = master_query.filter(Profile.category_id.in_(category_ids))
        if city:
            # Filter by city name via normalized city reference
            master_query = (
                master_query.outerjoin(City, Profile.city_id == City.id)
                .filter(City.name.ilike(f"%{city}%"))
            )
        if city_id is not None:
            master_query = master_query.filter(Profile.city_id == city_id)
        if search_term:
            pattern = f"%{search_term}%"
            MasterCategory = aliased(Category)
            MasterCategoryParent = aliased(Category)
            master_query = (
                master_query.outerjoin(
                    MasterCategory,
                    and_(
                        Profile.category_id == MasterCategory.id,
                        MasterCategory.type == CategoryType.master,
                    ),
                ).outerjoin(
                    MasterCategoryParent,
                    and_(
                        MasterCategory.parent_id == MasterCategoryParent.id,
                        MasterCategoryParent.type == CategoryType.master,
                    ),
                )
            )
            service_match = exists().where(
                and_(
                    Service.profile_id == Profile.id,
                    or_(
                        Service.title.ilike(pattern),
                        Service.description.ilike(pattern),
                    ),
                )
            )
            master_query = master_query.filter(
                or_(
                    Profile.about.ilike(pattern),
                    User.name.ilike(pattern),
                    Profile.keywords.ilike(pattern),
                    MasterCategory.name.ilike(pattern),
                    MasterCategory.slug.ilike(pattern),
                    MasterCategoryParent.name.ilike(pattern),
                    MasterCategoryParent.slug.ilike(pattern),
                    service_match,
                )
            )
        if min_rating is not None:
            master_query = master_query.filter(Profile.rating >= min_rating)
        
        # Safety limit: prevent loading too many masters into memory
        MAX_SEARCH_RESULTS = 500
        masters = master_query.limit(MAX_SEARCH_RESULTS).all()
        if len(masters) >= MAX_SEARCH_RESULTS:
            logger.warning(f"Featured masters search hit safety limit of {MAX_SEARCH_RESULTS}")
        price_map: Dict[int, Optional[float]] = {}
        likes_map: Dict[int, int] = {}
        if masters:
            profile_ids = [profile.id for profile in masters]
            price_rows = (
                db.query(Service.profile_id, func.min(Service.price_from).label("min_price"))
                .filter(Service.profile_id.in_(profile_ids))
                .group_by(Service.profile_id)
                .all()
            )
            price_map = {
                profile_id: float(min_price) if min_price is not None else None
                for profile_id, min_price in price_rows
            }
            likes_map = _load_like_counts(db, CategoryType.master, profile_ids)
        aggregated.extend(
            _serialize_master(
                profile,
                lowest_price=price_map.get(profile.id),
                likes_count=likes_map.get(profile.id, 0),
            )
            for profile in masters
        )

    if CategoryType.product in requested_types:
        product_query = db.query(Product).options(selectinload(Product.media))
        if category:
            category_ids = resolve_category_ids(db, category)
            if category_ids:
                product_query = product_query.filter(Product.category_id.in_(category_ids))
        if city:
            # Filter by city name via normalized city reference
            product_query = (
                product_query.outerjoin(City, Product.city_id == City.id)
                .filter(City.name.ilike(f"%{city}%"))
            )
        if city_id is not None:
            product_query = product_query.filter(Product.city_id == city_id)
        if search_term:
            pattern = f"%{search_term}%"
            ProductCategory = aliased(Category)
            ProductCategoryParent = aliased(Category)
            product_query = (
                product_query.outerjoin(
                    ProductCategory,
                    and_(
                        Product.category_id == ProductCategory.id,
                        ProductCategory.type == CategoryType.product,
                    ),
                ).outerjoin(
                    ProductCategoryParent,
                    and_(
                        ProductCategory.parent_id == ProductCategoryParent.id,
                        ProductCategoryParent.type == CategoryType.product,
                    ),
                )
            )
            product_query = product_query.filter(
                or_(
                    Product.title.ilike(pattern),
                    Product.description.ilike(pattern),
                    Product.brand.ilike(pattern),
                    ProductCategory.name.ilike(pattern),
                    ProductCategory.slug.ilike(pattern),
                    ProductCategoryParent.name.ilike(pattern),
                    ProductCategoryParent.slug.ilike(pattern),
                )
            )
        if min_price is not None:
            product_query = product_query.filter(Product.price >= min_price)
        if max_price is not None:
            product_query = product_query.filter(Product.price <= max_price)
        if min_rating is not None:
            product_query = product_query.filter(Product.rating >= min_rating)
        # Safety limit: prevent loading too many products into memory
        MAX_SEARCH_RESULTS = 500
        products = product_query.limit(MAX_SEARCH_RESULTS).all()
        if len(products) >= MAX_SEARCH_RESULTS:
            logger.warning(f"Featured products search hit safety limit of {MAX_SEARCH_RESULTS}")
        product_ids = [product.id for product in products]
        likes_map = _load_like_counts(db, CategoryType.product, product_ids)
        aggregated.extend(
            _serialize_product(product, likes_count=likes_map.get(product.id, 0))
            for product in products
        )

    if CategoryType.rental in requested_types:
        rental_query = db.query(Rental).options(selectinload(Rental.media))
        if category:
            category_ids = resolve_category_ids(db, category)
            if category_ids:
                rental_query = rental_query.filter(Rental.category_id.in_(category_ids))
        if city:
            # Filter by city name via normalized city reference
            rental_query = (
                rental_query.outerjoin(City, Rental.city_id == City.id)
                .filter(City.name.ilike(f"%{city}%"))
            )
        if city_id is not None:
            rental_query = rental_query.filter(Rental.city_id == city_id)
        if search_term:
            pattern = f"%{search_term}%"
            RentalCategory = aliased(Category)
            RentalCategoryParent = aliased(Category)
            rental_query = (
                rental_query.outerjoin(
                    RentalCategory,
                    and_(
                        Rental.category_id == RentalCategory.id,
                        RentalCategory.type == CategoryType.rental,
                    ),
                ).outerjoin(
                    RentalCategoryParent,
                    and_(
                        RentalCategory.parent_id == RentalCategoryParent.id,
                        RentalCategoryParent.type == CategoryType.rental,
                    ),
                )
            )
            rental_query = rental_query.filter(
                or_(
                    Rental.title.ilike(pattern),
                    Rental.description.ilike(pattern),
                    RentalCategory.name.ilike(pattern),
                    RentalCategory.slug.ilike(pattern),
                    RentalCategoryParent.name.ilike(pattern),
                    RentalCategoryParent.slug.ilike(pattern),
                )
            )
        if min_price is not None:
            rental_query = rental_query.filter(Rental.price_per_day >= min_price)
        if max_price is not None:
            rental_query = rental_query.filter(Rental.price_per_day <= max_price)
        # Safety limit: prevent loading too many rentals into memory
        MAX_SEARCH_RESULTS = 500
        rentals = rental_query.limit(MAX_SEARCH_RESULTS).all()
        if len(rentals) >= MAX_SEARCH_RESULTS:
            logger.warning(f"Featured rentals search hit safety limit of {MAX_SEARCH_RESULTS}")
        rental_ids = [rental.id for rental in rentals]
        rental_stats = _get_rental_review_stats(db, rental_ids)
        likes_map = _load_like_counts(db, CategoryType.rental, rental_ids)
        aggregated.extend(
            _serialize_rental(
                rental,
                rating=(rental_stats.get(rental.id) or (None, None))[0],
                total_reviews=(rental_stats.get(rental.id) or (None, None))[1],
                likes_count=likes_map.get(rental.id, 0),
            )
            for rental in rentals
        )

    _apply_sort(aggregated, sort_by, sort_order)

    total = len(aggregated)
    start = (page - 1) * page_size
    end = start + page_size
    paged_items = aggregated[start:end]

    featured_items: List[FeaturedItemOut] = []
    for item in paged_items:
        try:
            featured_items.append(FeaturedItemOut(**item))
        except Exception as exc:
            logger.warning(
                "Skipping featured item %s/%s during validation: %s",
                item.get("type"),
                item.get("id"),
                exc,
            )

    _attach_relationships(db, featured_items)

    return create_paginated_response(
        [item.model_dump(mode="json") for item in featured_items],
        total,
        page,
        page_size,
    )


@router.get("/{item_type}/{item_id}", response_model=FeaturedDetailOut)
def get_featured_detail(
    item_type: CategoryType,
    item_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user_optional),
):
    if item_type == CategoryType.master:
        profile = (
            public_master_profile_query(db, with_category=True)
            .options(joinedload(Profile.services))
            .filter(Profile.id == item_id)
            .first()
        )
        if not profile:
            raise HTTPException(status_code=404, detail="Master not found")
        lowest_service_price = None
        if profile.services:
            prices = [
                service.price_from
                for service in profile.services
                if service.price_from is not None
            ]
            if prices:
                lowest_service_price = min(prices)
        if lowest_service_price is None:
            lowest_service_price = (
                db.query(func.min(Service.price_from))
                .filter(Service.profile_id == profile.id)
                .scalar()
            )
        item_data = _serialize_master(profile, lowest_price=lowest_service_price)
        detail = FeaturedDetailOut(**item_data)
        detail.services = [ServiceOut.model_validate(service) for service in profile.services]
        media_items = (
            db.query(Media)
            .filter(Media.profile_id == profile.id)
            .order_by(Media.sort_order.asc().nullslast(), Media.created_at.desc())
            .all()
        )
        detail.portfolio = [media_out_with_local_urls(m) for m in media_items]
        category_labels = _collect_master_category_labels(profile)
        detail.extra = {
            "verified": profile.verified,
            "completed_jobs": profile.completed_jobs,
            "response_time_hours": profile.response_time_hours,
            "seller_id": profile.user_id,
            "profile_id": profile.id,
            "keywords": profile.keywords,
            "profession": profile.profession,
            "category_names": category_labels,
        }
    elif item_type == CategoryType.product:
        product = (
            db.query(Product)
            .options(selectinload(Product.media))
            .filter(Product.id == item_id)
            .first()
        )
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        media_items = (
            db.query(Media)
            .filter(Media.product_id == product.id)
            .order_by(Media.sort_order.asc().nullslast(), Media.created_at.desc())
            .all()
        )
        item_data = _serialize_product(product, media_items)
        detail = FeaturedDetailOut(**item_data)
        detail.media = [MediaOut.model_validate(m) for m in media_items]
        if not detail.image_url:
            detail.image_url = _best_media_url(media_items, require_approved=False)
        detail.stock = product.stock
        detail.brand = product.brand
        detail.extra = {
            "seller_id": product.seller_id,
        }
    elif item_type == CategoryType.rental:
        rental = (
            db.query(Rental)
            .options(selectinload(Rental.media))
            .filter(Rental.id == item_id)
            .first()
        )
        if not rental:
            raise HTTPException(status_code=404, detail="Rental not found")
        media_items = (
            db.query(Media)
            .filter(Media.rental_id == rental.id)
            .order_by(Media.sort_order.asc().nullslast(), Media.created_at.desc())
            .all()
        )
        stats = _get_rental_review_stats(db, [rental.id])
        avg_rating, review_count = stats.get(rental.id, (None, None))
        item_data = _serialize_rental(rental, media_items, rating=avg_rating, total_reviews=review_count)
        detail = FeaturedDetailOut(**item_data)
        detail.media = [MediaOut.model_validate(m) for m in media_items]
        if not detail.image_url:
            detail.image_url = _best_media_url(media_items, require_approved=False)
        detail.available = rental.available
        detail.stock = rental.stock
        detail.extra = {
            "seller_id": rental.seller_id,
        }
    else:
        raise HTTPException(status_code=400, detail="Unsupported item type")

    _attach_relationships(db, [detail])

    if user:
        _record_recent_view(db, user.id, item_type, item_id)

    return detail


@router.post("/{item_type}/{item_id}/view", status_code=204)
def track_featured_view(
    item_type: CategoryType,
    item_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    if not _build_featured_item_from_type(db, item_type, item_id):
        raise HTTPException(status_code=404, detail="Item not found")

    if user:
        _record_recent_view(db, user.id, item_type, item_id)
    return None


@router.get("/home", response_model=HomeContentOut)
def get_home_content(
    db: Session = Depends(get_db),
    user = Depends(get_current_user_optional),
):
    subcategory_limit = 8
    gallery_limit = 12
    recently_viewed_limit = 6

    subcategories = (
        db.query(Category)
        .filter(Category.parent_id.isnot(None))
        .filter(Category.is_active == True)
        .order_by(Category.sort_order.asc(), Category.name.asc())
        .limit(subcategory_limit)
        .all()
    )
    featured_subcategories = [CategoryOut.model_validate(cat) for cat in subcategories]

    # Get gallery items from masters only (consistent with /gallery/work endpoint)
    # For homepage: only show before-and-after photos (no videos)
    # All media is now automatically approved
    gallery_items = (
        db.query(Media)
        .join(User, Media.owner_id == User.id)
        .filter(User.role == Role.master)
        .filter(Media.profile_id.isnot(None))
        .filter(Media.is_before_after == True)  # Only before-and-after pairs
        .filter(Media.media_type == "photo")  # Only photos, no videos
        .order_by(Media.created_at.desc())
        .limit(5)  # Only 5 items for homepage
        .all()
    )
    # Filter out incomplete before/after pairs
    filtered_gallery_items = [
        media for media in gallery_items
        if media.before_url and media.after_url
    ]
    work_gallery = [MediaOut.model_validate(media) for media in filtered_gallery_items]

    recently_viewed: List[FeaturedItemOut] = []
    if user:
        recent_records = (
            db.query(RecentlyViewedItem)
            .filter(RecentlyViewedItem.user_id == user.id)
            .order_by(RecentlyViewedItem.viewed_at.desc())
            .limit(recently_viewed_limit)
            .all()
        )
        for record in recent_records:
            featured = _build_featured_item_from_type(db, record.item_type, record.item_id)
            if featured:
                recently_viewed.append(featured)
        _attach_relationships(db, recently_viewed)

    return HomeContentOut(
        featured_subcategories=featured_subcategories,
        work_gallery=work_gallery,
        recently_viewed=recently_viewed,
    )
