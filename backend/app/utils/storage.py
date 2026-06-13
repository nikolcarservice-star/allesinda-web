from __future__ import annotations

import os
from datetime import datetime
from typing import Optional
from urllib.parse import unquote, urlparse

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


def media_url_to_upload_relative_path(url: Optional[str]) -> Optional[str]:
    """Path under UPLOAD_FOLDER (e.g. categories/foo.jpeg) from any media URL form."""
    if not url:
        return None

    normalized = unquote(url.strip().replace("\\", "/"))
    if not normalized:
        return None

    if "?" in normalized:
        normalized = normalized.split("?", 1)[0]

    lowered = normalized.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        parsed = urlparse(normalized)
        normalized = parsed.path or ""

    normalized = normalized.lstrip("/")
    media_prefix = settings.MEDIA_URL_PREFIX.strip("/")
    if media_prefix and normalized.startswith(media_prefix):
        normalized = normalized[len(media_prefix) :].lstrip("/")

    cdn_prefix = (settings.CDN_URL or "").strip()
    if cdn_prefix and "your-cdn-url.com" not in cdn_prefix.lower():
        cdn_segment = cdn_prefix
        if "://" in cdn_segment:
            cdn_segment = urlparse(cdn_segment).path.lstrip("/")
        else:
            cdn_segment = cdn_segment.lstrip("/")
        if cdn_segment and normalized.startswith(cdn_segment):
            normalized = normalized[len(cdn_segment) :].lstrip("/")

    return normalized if normalized else None


def normalize_response_media_url(value: Optional[str]) -> Optional[str]:
    """Serve stored uploads through this API (/media/files), not CDN paths without files."""
    if not value:
        return None

    stripped = value.strip()
    if not stripped:
        return None

    lowered = stripped.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        if "your-cdn-url.com" in lowered:
            stripped = urlparse(stripped).path or stripped
        elif not media_url_to_upload_relative_path(stripped):
            return stripped

    relative = media_url_to_upload_relative_path(stripped)
    if not relative:
        return stripped

    from posixpath import join as posix_join

    prefix = settings.MEDIA_URL_PREFIX.strip("/")
    if not prefix.startswith("/"):
        prefix = f"/{prefix}"
    prefix = prefix.rstrip("/")
    return posix_join(prefix, relative.replace("\\", "/"))


def media_out_with_local_urls(media) -> "MediaOut":
    """Serialize media with URLs the frontend can load from this API."""
    from ..schemas import MediaOut

    item = MediaOut.model_validate(media)
    return item.model_copy(
        update={
            "url": normalize_response_media_url(item.url) or item.url,
            "thumbnail_url": normalize_response_media_url(item.thumbnail_url) or item.thumbnail_url,
            "before_url": normalize_response_media_url(item.before_url) or item.before_url,
            "after_url": normalize_response_media_url(item.after_url) or item.after_url,
        }
    )


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


