#!/usr/bin/env python3
"""Import master category catalog from JSON into the database."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models import Category, CategoryType


def build_slug(category_type: CategoryType, base_slug: str, parent: Optional[Category] = None) -> str:
    type_prefix = f"{category_type.value}-"
    if parent:
        parent_base = parent.slug
        if parent_base.startswith(type_prefix):
            parent_base = parent_base[len(type_prefix) :]
        return f"{type_prefix}{parent_base}-{base_slug}"
    return f"{type_prefix}{base_slug}"


def upsert_category(
    db,
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


def import_catalog(db, catalog: list[dict], *, deactivate_legacy: bool = False) -> tuple[int, int]:
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

    if deactivate_legacy:
        stale = (
            db.query(Category)
            .filter(Category.type == CategoryType.master, ~Category.slug.in_(imported_slugs))
            .all()
        )
        for category in stale:
            category.is_active = False

    db.commit()
    return parents, children


def main() -> None:
    parser = argparse.ArgumentParser(description="Import master categories from JSON catalog")
    default_path = Path(__file__).resolve().parents[1] / "app" / "data" / "master_categories.json"
    parser.add_argument("json_path", nargs="?", default=str(default_path))
    parser.add_argument(
        "--deactivate-legacy",
        action="store_true",
        help="Deactivate old master categories that are not in the imported catalog",
    )
    args = parser.parse_args()

    path = Path(args.json_path)
    with path.open(encoding="utf-8") as handle:
        catalog = json.load(handle)

    db = SessionLocal()
    try:
        parents, children = import_catalog(db, catalog, deactivate_legacy=args.deactivate_legacy)
        print(f"Imported {parents} parent categories and {children} subcategories from {path.name}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
