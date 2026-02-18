#!/usr/bin/env python3
"""
Sync img_backup to uploads and update category image_url in database.

Expected img_backup structure:
  img_backup/
    categories/
      master-01.jpeg, master-02.jpeg, ... (for master categories)
      product-01.jpeg, product-02.jpeg, ... (for product categories)
      rental-01.jpeg, rental-02.jpeg, ... (for rental categories)

Run: python -m scripts.update_category_images
Or from backend/: python scripts/update_category_images.py
"""
from __future__ import annotations

import os
import shutil
import sys
from typing import Optional

# Add parent to path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.database import SessionLocal
from app.models import Category, CategoryType
from app.utils.storage import get_upload_folder, get_media_subfolder, build_media_url
from datetime import datetime


def get_img_backup_path() -> str:
    """Return path to img_backup folder (next to backend)."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(backend_dir, "img_backup")


def sync_img_backup_to_uploads() -> int:
    """Copy img_backup/* to uploads/, preserving structure. Returns count of files copied."""
    img_backup = get_img_backup_path()
    upload_folder = get_upload_folder()
    if not os.path.isdir(img_backup):
        print(f"img_backup not found at {img_backup}, skipping sync")
        return 0
    count = 0
    for root, dirs, files in os.walk(img_backup):
        rel = os.path.relpath(root, img_backup)
        if rel == ".":
            rel = ""
        for f in files:
            src = os.path.join(root, f)
            dst_dir = os.path.join(upload_folder, rel) if rel else upload_folder
            os.makedirs(dst_dir, exist_ok=True)
            dst = os.path.join(dst_dir, f)
            try:
                shutil.copy2(src, dst)
                count += 1
                print(f"  Copied: {os.path.join(rel, f) if rel else f}")
            except Exception as e:
                print(f"  ERROR copying {src}: {e}")
    return count


def _find_existing_image(upload_folder: str, subfolder: str, base_name: str) -> Optional[str]:
    """Find existing image file (jpeg, jpg, png, webp) and return filename with extension."""
    dir_path = os.path.join(upload_folder, subfolder)
    if not os.path.isdir(dir_path):
        return None
    for ext in (".jpeg", ".jpg", ".png", ".webp"):
        f = base_name + ext
        if os.path.isfile(os.path.join(dir_path, f)):
            return f
    return None


def update_category_image_urls() -> int:
    """Set image_url for all main categories to /media/files/categories/{type}-{index:02d}.{ext}."""
    db = SessionLocal()
    upload_folder = get_upload_folder()
    subfolder = get_media_subfolder("photo", datetime.now(), entity_type="category")
    updated = 0
    try:
        for cat_type in (CategoryType.master, CategoryType.product, CategoryType.rental):
            cats = (
                db.query(Category)
                .filter(Category.type == cat_type, Category.parent_id.is_(None))
                .order_by(Category.sort_order, Category.id)
                .all()
            )
            for idx, cat in enumerate(cats):
                index = idx + 1
                base_name = f"{cat_type.value}-{index:02d}"
                # Prefer .jpeg, fall back to any existing image
                filename = _find_existing_image(upload_folder, subfolder, base_name)
                if not filename:
                    filename = base_name + ".jpeg"  # Default
                new_url = build_media_url(subfolder, filename)
                if cat.image_url != new_url:
                    cat.image_url = new_url
                    updated += 1
                    print(f"  Updated {cat_type.value} category '{cat.name}' (id={cat.id}) -> {new_url}")
        db.commit()
    finally:
        db.close()
    return updated


def main() -> None:
    print("========================================")
    print(" Update Category Images")
    print("========================================")
    print()
    print("1. Syncing img_backup to uploads...")
    copied = sync_img_backup_to_uploads()
    print(f"   Copied {copied} files")
    print()
    print("2. Updating category image_url in database...")
    updated = update_category_image_urls()
    print(f"   Updated {updated} categories")
    print()
    print("Done.")


if __name__ == "__main__":
    main()
