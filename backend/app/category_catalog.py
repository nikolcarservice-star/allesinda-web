"""Sync master category catalog from bundled JSON."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Category, CategoryType

logger = logging.getLogger(__name__)

CATALOG_PATH = Path(__file__).resolve().parent / "data" / "master_categories.json"


def build_slug(category_type: CategoryType, base_slug: str, parent: Optional[Category] = None) -> str:
    type_prefix = f"{category_type.value}-"
    if parent:
        parent_base = parent.slug
        if parent_base.startswith(type_prefix):
            parent_base = parent_base[len(type_prefix) :]
        return f"{type_prefix}{parent_base}-{base_slug}"
    return f"{type_prefix}{base_slug}"


def upsert_category(
    db: Session,
    *,
    name: str,
    base_slug: str,
    description: Optional[str],
    sort_order: int,
    parent: Optional[Category] = None,
    is_active: bool = True,
) -> Category:
    slug = build_slug(CategoryType.master, base_slug, parent)
    parent_id = parent.id if parent else None

    existing = db.query(Category).filter(Category.slug == slug).first()
    if existing:
        existing.name = name
        existing.description = description
        existing.sort_order = sort_order
        existing.parent_id = parent_id
        existing.is_active = is_active
        existing.type = CategoryType.master
        return existing

    category = Category(
        name=name,
        slug=slug,
        type=CategoryType.master,
        description=description,
        sort_order=sort_order,
        parent_id=parent_id,
        is_active=is_active,
    )
    db.add(category)
    db.flush()
    return category


def _group_name(group: dict) -> str:
    return group.get("category_name") or group["name"]


def _group_sort_order(group: dict) -> int:
    return int(group.get("sort_order", group.get("category_id", 0)))


def _sub_sort_order(sub: dict, fallback: int) -> int:
    sub_id = sub.get("sub_id")
    if isinstance(sub_id, int):
        return sub_id % 1000
    return fallback


def import_catalog(
    db: Session,
    catalog: list[dict],
    *,
    deactivate_legacy: bool = False,
) -> tuple[int, int]:
    parents = 0
    children = 0
    imported_slugs: set[str] = set()

    for group in catalog:
        parent = upsert_category(
            db,
            name=_group_name(group),
            base_slug=group["slug"],
            description=group.get("meta_description") or group.get("description"),
            sort_order=_group_sort_order(group),
            parent=None,
        )
        imported_slugs.add(parent.slug)
        parents += 1

        for sub_index, sub in enumerate(group.get("subcategories", [])):
            child = upsert_category(
                db,
                name=sub["name"],
                base_slug=sub["slug"],
                description=sub.get("meta_description") or sub.get("description"),
                sort_order=_sub_sort_order(sub, sub_index),
                parent=parent,
            )
            imported_slugs.add(child.slug)
            children += 1

    if deactivate_legacy and imported_slugs:
        stale = (
            db.query(Category)
            .filter(Category.type == CategoryType.master, ~Category.slug.in_(imported_slugs))
            .all()
        )
        for category in stale:
            category.is_active = False

    db.commit()
    return parents, children


def load_catalog(path: Path | None = None) -> list[dict]:
    catalog_path = path or CATALOG_PATH
    with catalog_path.open(encoding="utf-8") as handle:
        return json.load(handle)


def sync_master_categories_catalog(
    *,
    deactivate_legacy: bool = True,
    catalog_path: Path | None = None,
) -> tuple[int, int] | None:
    """Upsert bundled master categories; safe to run on every backend startup."""
    path = catalog_path or CATALOG_PATH
    if not path.is_file():
        logger.warning("Master category catalog not found at %s", path)
        return None

    session = SessionLocal()
    try:
        catalog = load_catalog(path)
        parents, children = import_catalog(session, catalog, deactivate_legacy=deactivate_legacy)
        logger.info(
            "Master category catalog synced: %s parents, %s children (legacy deactivated=%s)",
            parents,
            children,
            deactivate_legacy,
        )
        return parents, children
    except Exception:
        session.rollback()
        logger.exception("Failed to sync master category catalog")
        return None
    finally:
        session.close()
