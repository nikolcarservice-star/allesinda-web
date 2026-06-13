from collections import defaultdict
import logging
from urllib.parse import urljoin, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..config import settings
from ..database import get_db
from ..helpers import create_paginated_response, paginate_query
from ..models import Category, CategoryType, Role, User, Media
from ..schemas import CategoryIn, CategoryOut, CategoryTreeOut, CategoryUpdate
from ..security import get_current_user, require_role
from ..utils.storage import get_media_subfolder, build_media_url, get_upload_folder, media_url_to_upload_relative_path
from datetime import datetime
import os
from urllib.parse import unquote

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/categories", tags=["categories"])


def _validate_parent_category(
    db: Session,
    category_type: CategoryType,
    parent_id: Optional[int],
    category_id: Optional[int] = None,
) -> Optional[Category]:
    """Validate provided parent_id belongs to same type and is not cyclic."""
    if parent_id is None:
        return None

    parent = db.get(Category, parent_id)
    if not parent:
        raise HTTPException(status_code=400, detail="Parent category not found")

    if parent.type != category_type:
        raise HTTPException(status_code=400, detail="Parent category must have the same type")

    if category_id and parent_id == category_id:
        raise HTTPException(status_code=400, detail="Category cannot be its own parent")

    # Prevent circular references by walking up the tree
    current_parent = parent
    while current_parent.parent_id is not None:
        if current_parent.parent_id == category_id:
            raise HTTPException(status_code=400, detail="Cannot assign a descendant as the parent category")
        current_parent = db.get(Category, current_parent.parent_id)
        if current_parent is None:
            break

    return parent


def _normalize_media_url(value: Optional[str]) -> Optional[str]:
    """Ensure media URLs use web-friendly separators and expected prefixes."""
    if not value:
        return None

    normalized = value.strip().replace("\\", "/")
    if not normalized:
        return None

    original_normalized = normalized

    lowered = normalized.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        parsed = urlparse(normalized)
        placeholder_hosts = {"your-cdn-url.com", "your-cdn-url.com:443", "your-cdn-url.com:80"}
        if parsed.hostname and parsed.hostname.lower() in placeholder_hosts:
            normalized = parsed.path.lstrip("/")
            if parsed.query:
                normalized = f"{normalized}?{parsed.query}"
            logger.debug(
                "Stripped placeholder CDN host from category media URL",
                extra={"original": value, "hostname": parsed.hostname, "result": normalized},
            )
        else:
            return normalized
    elif lowered.startswith("data:"):
        return normalized
    if normalized.startswith("//"):
        return f"https:{normalized}"

    segment = normalized.lstrip("/")

    media_prefix = settings.MEDIA_URL_PREFIX.strip("/")
    if media_prefix and (
        segment == media_prefix
        or segment.startswith(f"{media_prefix}/")
        or segment.startswith("categories/")
    ):
        prefix = settings.MEDIA_URL_PREFIX if settings.MEDIA_URL_PREFIX.startswith("/") else f"/{settings.MEDIA_URL_PREFIX}"
        prefix = prefix.rstrip("/")
        if segment.startswith(media_prefix):
            return f"/{segment}"
        return f"{prefix}/{segment}"

    cdn_prefix = (settings.CDN_URL or "").strip()
    if cdn_prefix and "your-cdn-url.com" not in cdn_prefix.lower():
        base = cdn_prefix.rstrip("/")
        if "://" not in base:
            base = f"https://{base.lstrip('/')}"
        return urljoin(f"{base}/", segment)

    media_prefix = settings.MEDIA_URL_PREFIX.rstrip("/")

    if "://" in media_prefix:
        base = media_prefix if media_prefix.endswith("/") else f"{media_prefix}/"
        return urljoin(base, segment)

    prefix = media_prefix if media_prefix.startswith("/") else f"/{media_prefix}" if media_prefix else ""
    prefix = prefix.rstrip("/")

    if prefix and segment.startswith(prefix.lstrip("/")):
        return f"/{segment}"

    if prefix:
        return f"{prefix}/{segment}" if segment else prefix or None

    result = f"/{segment}" if segment else "/"

    if result != original_normalized:
        logger.debug(
            "Normalized category media URL",
            extra={
                "original": value,
                "normalized": result,
                "cdn_prefix": settings.CDN_URL,
                "media_prefix": settings.MEDIA_URL_PREFIX,
            },
        )

    return result


def _ensure_category_image(slug: str, label: str, category_type: CategoryType, db: Session, sort_order: Optional[int] = None) -> str:
    """Generate image URL for category (similar to seed.py) - only for main categories, not subcategories
    Format: "{type}-{index:02d}.jpeg" for master, product, and rental categories
    Examples: "master-01.jpeg", "product-01.jpeg", "rental-01.jpeg"
    """
    # Use numbered format for master, product, and rental categories
    if category_type in (CategoryType.master, CategoryType.product, CategoryType.rental):
        # Determine index based on sort_order or count of existing categories
        if sort_order is not None:
            index = sort_order + 1  # 1-based indexing
        else:
            # Count existing main categories of the same type to determine next index
            existing_count = db.query(Category).filter(
                Category.type == category_type,
                Category.parent_id.is_(None)
            ).count()
            index = existing_count + 1  # Next available index
        filename = f"{category_type.value}-{index:02d}.jpeg"
    else:
        # Fallback to slug-based format for other category types
        filename = f"{slug}.jpeg"
    now = datetime.now()
    subfolder = get_media_subfolder("photo", now, entity_type="category")
    return build_media_url(subfolder, filename)


def _category_image_urls_equal(url_a: Optional[str], url_b: Optional[str]) -> bool:
    if not url_a and not url_b:
        return True
    if not url_a or not url_b:
        return False
    path_a = media_url_to_upload_relative_path(url_a)
    path_b = media_url_to_upload_relative_path(url_b)
    if not path_a or not path_b:
        return False
    return path_a.lower() == path_b.lower()


def _delete_category_image(image_url: Optional[str], db: Session) -> bool:
    """Delete category image file from server and related Media records from database"""
    if not image_url:
        return False
    
    try:
        # Extract file path from URL
        upload_folder = get_upload_folder()
        deleted_files = []
        
        file_path = media_url_to_upload_relative_path(image_url)
        if not file_path:
            logger.warning(f"Category image URL is not a local path, skipping file deletion: {image_url}")
        
        # Delete file from filesystem if it's a local path
        if file_path:
            full_path = os.path.join(upload_folder, file_path.replace("/", os.sep))
            
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                    deleted_files.append(full_path)
                    logger.info(f"Deleted category image file: {full_path}")
                except OSError as e:
                    logger.error(f"Failed to delete category image file {full_path}: {e}")
        
        # Delete related Media records that reference this URL
        # Match by exact URL or by filename in the path
        if file_path:
            filename = os.path.basename(file_path)
            # Also try without extension
            filename_no_ext = os.path.splitext(filename)[0]
            media_records = db.query(Media).filter(
                (Media.url == image_url) | 
                (Media.url.like(f"%{filename}%")) |
                (Media.url.like(f"%{filename_no_ext}%")) |
                (Media.url.like(f"%{file_path}%"))
            ).all()
        else:
            media_records = db.query(Media).filter(Media.url == image_url).all()
        
        for media in media_records:
            # Also try to delete the media file if it exists
            if media.url and media.url not in deleted_files:
                try:
                    media_file_path = media_url_to_upload_relative_path(media.url)
                    if media_file_path:
                        full_media_path = os.path.join(upload_folder, media_file_path.replace("/", os.sep))
                        if os.path.exists(full_media_path) and full_media_path not in deleted_files:
                            os.remove(full_media_path)
                            deleted_files.append(full_media_path)
                            logger.info(f"Deleted media file: {full_media_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete media file for record {media.id}: {e}")
            
            db.delete(media)
            logger.info(f"Deleted media record: {media.id}")
        
        if media_records:
            db.commit()
        
        return True
    except Exception as e:
        logger.error(f"Error deleting category image: {e}")
        return False


def _normalize_category_output(category: Category | CategoryOut) -> CategoryOut:
    base = CategoryOut.model_validate(category)
    return base.model_copy(
        update={
            "image_url": _normalize_media_url(base.image_url),
        }
    )


def _build_category_tree(categories: List[Category]) -> List[CategoryTreeOut]:
    """Convert flat category list to hierarchical tree structure."""
    by_parent: defaultdict[Optional[int], List[Category]] = defaultdict(list)
    for category in categories:
        by_parent[category.parent_id].append(category)

    # Ensure deterministic ordering for each group
    for category_list in by_parent.values():
        category_list.sort(key=lambda c: (c.sort_order, c.name.lower()))

    def serialize(category: Category) -> CategoryTreeOut:
        base_data = _normalize_category_output(category).model_dump()
        children = [serialize(child) for child in by_parent.get(category.id, [])]
        base_data["children"] = children
        return CategoryTreeOut.model_validate(base_data)

    root_categories = by_parent.get(None, [])
    return [serialize(category) for category in root_categories]

@router.get("", response_model=dict)
def list_categories(
    db: Session = Depends(get_db),
    type: Optional[CategoryType] = None,
    active_only: Optional[bool] = None,
    parent_id: Optional[int] = Query(None),
    root_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000)
):
    """List categories with pagination (public endpoint)"""
    query = db.query(Category)
    
    if type:
        query = query.filter(Category.type == type)
    
    if active_only is not None:
        query = query.filter(Category.is_active == active_only)
    
    if parent_id is not None:
        query = query.filter(Category.parent_id == parent_id)
    elif root_only:
        query = query.filter(Category.parent_id.is_(None))

    query = query.order_by(Category.sort_order.asc(), Category.name.asc())
    
    items, total = paginate_query(query, page, page_size)
    
    category_out_items = [_normalize_category_output(item) for item in items]
    
    return create_paginated_response(category_out_items, total, page, page_size)

@router.get("/{category_id}", response_model=CategoryOut)
def get_category(category_id: int, db: Session = Depends(get_db)):
    """Get category by ID (public endpoint)"""
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return _normalize_category_output(category)

@router.get("/slug/{slug}", response_model=CategoryOut)
def get_category_by_slug(slug: str, db: Session = Depends(get_db)):
    """Get category by slug (public endpoint)"""
    category = db.query(Category).filter(Category.slug == slug).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return _normalize_category_output(category)

@router.get("/type/{category_type}", response_model=List[CategoryOut])
def get_categories_by_type(
    category_type: CategoryType,
    active_only: bool = True,
    parent_id: Optional[int] = Query(None),
    root_only: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Get all categories by type (public endpoint)"""
    query = db.query(Category).filter(Category.type == category_type)
    
    if active_only:
        query = query.filter(Category.is_active == True)
    
    if parent_id is not None:
        query = query.filter(Category.parent_id == parent_id)
    elif root_only:
        query = query.filter(Category.parent_id.is_(None))

    query = query.order_by(Category.sort_order.asc(), Category.name.asc())
    
    categories = query.all()
    return [_normalize_category_output(cat) for cat in categories]


@router.get("/type/{category_type}/tree", response_model=List[CategoryTreeOut])
def get_category_tree(
    category_type: CategoryType,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Get hierarchical category tree for a given type (public endpoint)"""
    query = db.query(Category).filter(Category.type == category_type)

    if active_only:
        query = query.filter(Category.is_active == True)

    categories = query.order_by(Category.sort_order.asc(), Category.name.asc()).all()

    return _build_category_tree(categories)

# Admin-only endpoints
@router.post("", response_model=CategoryOut, status_code=201, dependencies=[Depends(require_role(Role.admin))])
def create_category(
    data: CategoryIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new category (admin only)"""
    # Ensure slug format includes type prefix to prevent duplicates across types
    # Format: "{type}-{category-slug}" for main categories
    # Format: "{type}-{parent-slug}-{subcategory-slug}" for subcategories
    type_prefix = f"{data.type.value}-"
    final_slug = data.slug
    
    if not final_slug.startswith(type_prefix):
        # Slug doesn't have type prefix - add it
        if data.parent_id:
            # Subcategory: need parent slug
            parent = db.get(Category, data.parent_id)
            if not parent:
                raise HTTPException(status_code=400, detail="Parent category not found")
            parent_base_slug = parent.slug
            if parent_base_slug.startswith(type_prefix):
                parent_base_slug = parent_base_slug[len(type_prefix):]
            final_slug = f"{data.type.value}-{parent_base_slug}-{data.slug}"
        else:
            # Main category: just add type prefix
            final_slug = f"{data.type.value}-{data.slug}"
    
    # Check if slug already exists (globally unique)
    existing = db.query(Category).filter(Category.slug == final_slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this slug already exists")
    
    # Check if name already exists for the same type and parent
    # Names can be the same across different types (e.g., "Drills" in Product and Master)
    existing_name = db.query(Category).filter(
        Category.name == data.name,
        Category.type == data.type,
        Category.parent_id == data.parent_id
    ).first()
    if existing_name:
        raise HTTPException(status_code=400, detail="Category with this name already exists for this type and parent")
    
    _validate_parent_category(db, data.type, data.parent_id)

    category_data = data.dict()
    category_data["slug"] = final_slug  # Use the normalized slug with type prefix
    
    # Auto-generate image_url only for main categories (not subcategories)
    if not data.parent_id and not category_data.get("image_url"):
        category_data["image_url"] = _ensure_category_image(
            final_slug, 
            data.name, 
            category_type=data.type, 
            db=db, 
            sort_order=category_data.get("sort_order")
        )

    category = Category(**category_data)
    db.add(category)
    db.commit()
    db.refresh(category)
    return _normalize_category_output(category)

@router.patch("/{category_id}", response_model=CategoryOut, dependencies=[Depends(require_role(Role.admin))])
def update_category(
    category_id: int,
    data: CategoryUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a category (admin only)"""
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = data.dict(exclude_unset=True)
    
    # Ensure slug format includes type prefix if slug is being updated
    if 'slug' in update_data and update_data['slug'] != category.slug:
        type_prefix = f"{category.type.value}-"
        final_slug = update_data['slug']
        
        if not final_slug.startswith(type_prefix):
            # Slug doesn't have type prefix - add it
            parent_id_to_check = update_data.get('parent_id', category.parent_id)
            if parent_id_to_check:
                # Subcategory: need parent slug
                parent = db.get(Category, parent_id_to_check)
                if not parent:
                    raise HTTPException(status_code=400, detail="Parent category not found")
                parent_base_slug = parent.slug
                if parent_base_slug.startswith(type_prefix):
                    parent_base_slug = parent_base_slug[len(type_prefix):]
                final_slug = f"{category.type.value}-{parent_base_slug}-{update_data['slug']}"
            else:
                # Main category: just add type prefix
                final_slug = f"{category.type.value}-{update_data['slug']}"
        
        # Check if slug already exists (globally unique)
        existing = db.query(Category).filter(Category.slug == final_slug).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category with this slug already exists")
        
        update_data['slug'] = final_slug
    
    # Check if name already exists for the same type and parent (if being updated)
    # Names can be the same across different types (e.g., "Drills" in Product and Master)
    if 'name' in update_data and update_data['name'] != category.name:
        parent_id_to_check = update_data.get('parent_id', category.parent_id)
        existing_name = db.query(Category).filter(
            Category.name == update_data['name'],
            Category.type == category.type,
            Category.parent_id == parent_id_to_check,
            Category.id != category_id
        ).first()
        if existing_name:
            raise HTTPException(status_code=400, detail="Category with this name already exists for this type and parent")
    
    if 'parent_id' in update_data:
        _validate_parent_category(db, category.type, update_data['parent_id'], category_id=category.id)

    slug_to_use = update_data.get('slug', category.slug)
    name_to_use = update_data.get('name', category.name)
    is_subcategory = update_data.get('parent_id') or category.parent_id
    
    # Handle image_url: if empty string (deleted), delete file and set to None; if not provided, preserve existing or auto-generate
    # Only auto-generate images for main categories (not subcategories)
    if 'image_url' in update_data:
        if update_data['image_url'] == '':
            # User deleted image - delete file from server and Media records
            if category.image_url:
                _delete_category_image(category.image_url, db)
            update_data['image_url'] = None
        elif update_data['image_url'] is None:
            # Explicitly set to None - preserve None (don't auto-generate)
            pass
        elif update_data.get('image_url'):
            new_image_url = update_data['image_url']
            if _category_image_urls_equal(new_image_url, category.image_url):
                # Same file, different URL representation (relative vs CDN/API) — keep DB value
                update_data.pop('image_url', None)
            else:
                # Image URL changed - delete old image file if it exists
                if category.image_url:
                    _delete_category_image(category.image_url, db)
                update_data['image_url'] = _normalize_media_url(new_image_url)
    # else: image_url not in update_data — keep existing value (do not auto-generate on update)

    for key, value in update_data.items():
        setattr(category, key, value)
    
    db.commit()
    db.refresh(category)
    return _normalize_category_output(category)

@router.delete("/{category_id}", dependencies=[Depends(require_role(Role.admin))])
def delete_category(
    category_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a category (admin only)"""
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    child_count = db.query(Category).filter(Category.parent_id == category.id).count()
    if child_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete category with active subcategories. Remove or reassign them first.")

    # Check if category is being used by any products, rentals, media, or profiles
    from ..models import Product, Rental, Media, Profile
    
    # Count usage by category_id (preferred) or fallback to slug for backward compatibility
    product_count = db.query(Product).filter(Product.category_id == category.id).count()
    rental_count = db.query(Rental).filter(Rental.category_id == category.id).count()
    media_count = db.query(Media).filter(Media.category_id == category.id).count()
    profile_count = 0
    
    # Check if master category is being used by profiles
    if category.type == CategoryType.master:
        profile_count = db.query(Profile).filter(Profile.category_id == category.id).count()
    
    if product_count > 0 or rental_count > 0 or media_count > 0 or profile_count > 0:
        usage_details = []
        if product_count > 0:
            usage_details.append(f"{product_count} products")
        if rental_count > 0:
            usage_details.append(f"{rental_count} rentals")
        if media_count > 0:
            usage_details.append(f"{media_count} media items")
        if profile_count > 0:
            usage_details.append(f"{profile_count} profiles")
        
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category. It is being used by {', '.join(usage_details)}."
        )
    
    db.delete(category)
    db.commit()
    return {"ok": True, "message": "Category deleted successfully"}

