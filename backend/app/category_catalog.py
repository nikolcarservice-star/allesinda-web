"""Sync master category catalog from bundled JSON."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from collections import defaultdict

from .database import SessionLocal
from .models import Category, CategoryType, Product, Profile, Rental

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
        existing.type = CategoryType.master
        # Preserve admin choices across redeploys (image_url, active/inactive state).
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
    if parent is None and not category.image_url:
        from .category_media import default_parent_category_image_url

        category.image_url = default_parent_category_image_url(category)
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


def _normalize_category_name(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def remap_entity_categories(db: Session, model, category_type: CategoryType) -> int:
    """Move profiles/products/rentals from deactivated categories to active name matches."""
    from .category_filter import _category_names_related, _normalize_name

    inactive = (
        db.query(Category)
        .filter(Category.type == category_type, Category.is_active.is_(False))
        .all()
    )
    if not inactive:
        return 0

    active_categories = (
        db.query(Category)
        .filter(Category.type == category_type, Category.is_active.is_(True))
        .all()
    )
    active_by_name: dict[str, list[Category]] = defaultdict(list)
    for active in active_categories:
        active_by_name[_normalize_name(active.name)].append(active)

    def pick_target(candidates: list[Category]) -> Optional[int]:
        if not candidates:
            return None
        if len(candidates) == 1:
            return candidates[0].id
        subcategories = [item for item in candidates if item.parent_id]
        return subcategories[0].id if subcategories else candidates[0].id

    def find_remap_target(old: Category) -> Optional[int]:
        exact_targets = active_by_name.get(_normalize_name(old.name), [])
        target_id = pick_target(exact_targets)
        if target_id:
            return target_id

        same_level = [
            active
            for active in active_categories
            if bool(active.parent_id) == bool(old.parent_id)
            and _category_names_related(active.name, old.name)
        ]
        target_id = pick_target(same_level)
        if target_id:
            return target_id

        if old.parent_id:
            old_parent = db.get(Category, old.parent_id)
            if old_parent:
                related_parents = [
                    active
                    for active in active_categories
                    if active.parent_id is None
                    and _category_names_related(active.name, old_parent.name)
                ]
                if related_parents:
                    parent = related_parents[0]
                    children = [active for active in active_categories if active.parent_id == parent.id]
                    child_matches = [
                        child for child in children if _category_names_related(child.name, old.name)
                    ]
                    if child_matches:
                        return child_matches[0].id
                    if children:
                        return children[0].id
                    return parent.id

        if old.parent_id is None:
            related_parents = [
                active
                for active in active_categories
                if active.parent_id is None and _category_names_related(active.name, old.name)
            ]
            return pick_target(related_parents)

        return None

    updated = 0
    for old in inactive:
        new_id = find_remap_target(old)
        if not new_id:
            continue
        count = (
            db.query(model)
            .filter(model.category_id == old.id)
            .update({model.category_id: new_id}, synchronize_session=False)
        )
        updated += count
    return updated


def remap_master_entity_categories(db: Session) -> int:
    return (
        remap_entity_categories(db, Profile, CategoryType.master)
        + remap_entity_categories(db, Product, CategoryType.product)
        + remap_entity_categories(db, Rental, CategoryType.rental)
    )


def load_catalog(path: Path | None = None) -> list[dict]:
    catalog_path = path or CATALOG_PATH
    with catalog_path.open(encoding="utf-8") as handle:
        return json.load(handle)


def sync_master_categories_catalog(
    *,
    deactivate_legacy: bool = False,
    catalog_path: Path | None = None,
) -> tuple[int, int] | None:
    """Upsert bundled master categories; safe to run on every backend startup.

    Preserves admin is_active toggles. Legacy deactivation is opt-in (CLI import script).
    """
    path = catalog_path or CATALOG_PATH
    if not path.is_file():
        logger.warning("Master category catalog not found at %s", path)
        return None

    session = SessionLocal()
    try:
        catalog = load_catalog(path)
        parents, children = import_catalog(session, catalog, deactivate_legacy=deactivate_legacy)
        remapped = remap_master_entity_categories(session)
        from .category_media import ensure_category_media_files

        files_restored, urls_assigned = ensure_category_media_files(session)
        session.commit()
        logger.info(
            "Master category catalog synced: %s parents, %s children (legacy deactivated=%s, remapped=%s, "
            "category_images_restored=%s, category_urls_assigned=%s)",
            parents,
            children,
            deactivate_legacy,
            remapped,
            files_restored,
            urls_assigned,
        )
        return parents, children
    except Exception:
        session.rollback()
        logger.exception("Failed to sync master category catalog")
        return None
    finally:
        session.close()
