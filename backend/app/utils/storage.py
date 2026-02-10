from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from ..config import settings

# Maps alternate entity names to their canonical storage folder key
_ENTITY_ALIASES: dict[str, str] = {
    "masters": "master",
    "profiles": "master",
    "profile": "master",
    "user-profile": "master",
    "user_profile": "master",
    "products": "product",
    "product-image": "product",
    "product_images": "product",
    "rentals": "rental",
    "rental-item": "rental",
    "category-icon": "category",
    "category_icon": "category",
    "category-hero": "category",
    "category_hero": "category",
    "subcategory-icon": "subcategory",
    "subcategory_icon": "subcategory",
    "subcategory-hero": "subcategory",
    "subcategory_hero": "subcategory",
}

# Entity types that should be placed under a dated folder hierarchy YYYY/MM/{entity}
_DATED_ENTITY_TYPES = {"master", "product", "rental"}

# Entity types that should be grouped into static, easy to browse folders
_STATIC_ENTITY_FOLDERS = {
    "category": os.path.join("categories"),
    "subcategory": os.path.join("subcategories"),
}


def _normalize_entity(entity_type: Optional[str]) -> Optional[str]:
    """Normalize entity type inputs to canonical folder keys."""
    if not entity_type:
        return None

    normalized = entity_type.strip().lower().replace("\\", "/")
    if "/" in normalized:
        normalized = normalized.split("/")[-1]

    return _ENTITY_ALIASES.get(normalized, normalized)


def get_upload_folder() -> str:
    """Return the absolute path to the upload/root media folder."""
    upload_folder = settings.UPLOAD_FOLDER
    if not os.path.isabs(upload_folder):
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        upload_folder = os.path.join(base_dir, upload_folder)
    return upload_folder


def get_media_subfolder(
    media_type: str = "photo",
    date: Optional[datetime] = None,
    entity_type: Optional[str] = None,
) -> str:
    """Compute a structured subfolder for storing media assets.

    The folder strategy follows these rules:
    - master/product/rental assets are grouped under YYYY/MM/{entity}
    - category and subcategory assets are grouped under dedicated folders
    - all other media fall back to {photos|videos}/YYYY/MM
    """
    if date is None:
        date = datetime.now()

    normalized_entity = _normalize_entity(entity_type)

    if normalized_entity in _DATED_ENTITY_TYPES:
        year = date.strftime("%Y")
        month = date.strftime("%m")
        return os.path.join(year, month, normalized_entity)

    if normalized_entity in _STATIC_ENTITY_FOLDERS:
        return _STATIC_ENTITY_FOLDERS[normalized_entity]

    suffix = "videos" if media_type == "video" else "photos"
    year = date.strftime("%Y")
    month = date.strftime("%m")
    return os.path.join(suffix, year, month)


def build_media_url(subfolder: str, filename: str, use_cdn: bool = True) -> str:
    """Construct a media URL path using POSIX separators.
    
    Args:
        subfolder: Media subfolder path
        filename: Filename
        use_cdn: Whether to use CDN URL if configured
    
    Returns:
        Full media URL (with CDN prefix if configured, otherwise local path or absolute URL if BASE_URL is set)
    """
    from posixpath import join as posix_join

    # Build the relative path first
    normalized_subfolder = subfolder.replace("\\", "/").strip("/")
    if normalized_subfolder:
        relative_path = posix_join(settings.MEDIA_URL_PREFIX.rstrip("/"), normalized_subfolder, filename)
    else:
        relative_path = posix_join(settings.MEDIA_URL_PREFIX.rstrip("/"), filename)
    
    # Use CDN URL if configured, enabled, and not a placeholder
    if use_cdn and settings.CDN_URL:
        cdn_url = settings.CDN_URL.strip()
        # Check if it's not a placeholder value
        if cdn_url and "your-cdn-url.com" not in cdn_url.lower():
            base = cdn_url.rstrip("/")
            # Replace MEDIA_URL_PREFIX with CDN URL
            path_without_prefix = relative_path[len(settings.MEDIA_URL_PREFIX.rstrip("/")):].lstrip("/")
            return posix_join(base, path_without_prefix)
    
    # If BASE_URL is set, return absolute URL
    if settings.BASE_URL:
        base_url = settings.BASE_URL.rstrip("/")
        return posix_join(base_url, relative_path.lstrip("/"))
    
    # Otherwise, return relative path
    return relative_path


