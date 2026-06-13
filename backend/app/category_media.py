"""Keep parent category images on disk across backend redeploys."""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from .config import settings
from .models import Category, CategoryType
from .utils.storage import (
    build_media_url,
    get_media_subfolder,
    get_upload_folder,
    media_url_to_upload_relative_path,
)

logger = logging.getLogger(__name__)

try:
    from PIL import Image, ImageDraw, ImageFont

    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


def _category_image_filename(category: Category) -> str:
    if category.type in (CategoryType.master, CategoryType.product, CategoryType.rental):
        return f"{category.type.value}-{category.sort_order + 1:02d}.jpeg"
    return f"{category.slug}.jpeg"


def default_parent_category_image_url(category: Category) -> str:
    """Relative media URL for a parent category (no CDN host in DB)."""
    subfolder = get_media_subfolder("photo", datetime.now(), entity_type="category")
    return build_media_url(subfolder, _category_image_filename(category), use_cdn=False)


def _upload_relative_path(image_url: str) -> Optional[str]:
    relative = media_url_to_upload_relative_path(image_url)
    if not relative:
        return None

    media_prefix = settings.MEDIA_URL_PREFIX.strip("/")
    if media_prefix and relative.startswith(f"{media_prefix}/"):
        relative = relative[len(media_prefix) + 1 :]
    return relative.replace("\\", "/")


def _is_remote_only_url(image_url: str) -> bool:
    lowered = image_url.strip().lower()
    if lowered.startswith("data:"):
        return True
    if not lowered.startswith(("http://", "https://")):
        return False

    from urllib.parse import urlparse

    parsed = urlparse(image_url)
    host = (parsed.hostname or "").lower()
    if host in {"your-cdn-url.com", "your-cdn-url.com:443", "your-cdn-url.com:80"}:
        return False

    upload_root = os.path.abspath(get_upload_folder())
    relative = _upload_relative_path(image_url)
    if not relative:
        return True
    local_path = os.path.abspath(os.path.join(upload_root, relative.replace("/", os.sep)))
    if os.path.commonpath([upload_root, local_path]) != upload_root:
        return True
    return not os.path.isfile(local_path)


def write_category_placeholder_file(full_path: str, label: str) -> bool:
    """Create a JPEG placeholder at full_path if missing."""
    if os.path.isfile(full_path):
        return False

    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    if not PIL_AVAILABLE:
        logger.warning("Pillow unavailable; cannot restore category image at %s", full_path)
        return False

    width, height = 800, 600
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    draw = ImageDraw.Draw(img)
    for y_pos in range(height):
        ratio = y_pos / height
        r = int(100 * (1 - ratio * 0.2))
        g = int(150 * (1 - ratio * 0.2))
        b = int(200 * (1 - ratio * 0.2))
        draw.line([(0, y_pos), (width, y_pos)], fill=(r, g, b))

    text = (label or "Category")[:40]
    try:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
        except OSError:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        draw.text(((width - text_w) // 2, (height - text_h) // 2), text, fill=(255, 255, 255), font=font)
    except Exception:
        pass

    img.save(full_path, format="JPEG", quality=85)
    return True


def ensure_category_media_files(db: Session) -> tuple[int, int]:
    """Ensure parent categories have image_url and local files exist.

    Returns (files_restored, urls_assigned).
    """
    upload_root = os.path.abspath(get_upload_folder())
    files_restored = 0
    urls_assigned = 0

    parents = (
        db.query(Category)
        .filter(Category.parent_id.is_(None), Category.is_active.is_(True))
        .order_by(Category.type.asc(), Category.sort_order.asc(), Category.id.asc())
        .all()
    )

    for category in parents:
        image_url = (category.image_url or "").strip()
        if not image_url:
            image_url = default_parent_category_image_url(category)
            category.image_url = image_url
            urls_assigned += 1

        if _is_remote_only_url(image_url):
            continue

        relative = _upload_relative_path(image_url)
        if not relative:
            continue

        full_path = os.path.abspath(os.path.join(upload_root, relative.replace("/", os.sep)))
        if os.path.commonpath([upload_root, full_path]) != upload_root:
            continue

        if write_category_placeholder_file(full_path, category.name):
            files_restored += 1
            logger.info("Restored category image file for %s (%s)", category.slug, relative)

    return files_restored, urls_assigned
