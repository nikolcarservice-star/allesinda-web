"""Resolve category URL/API params to database category IDs for search filters."""

from __future__ import annotations

import re
from typing import Optional

from sqlalchemy.orm import Session

from .models import Category, CategoryType, Profile


def _normalize_name(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _category_name_tokens(value: Optional[str]) -> set[str]:
    normalized = _normalize_name(value)
    if not normalized:
        return set()
    return {token for token in re.split(r"[^a-z0-9]+", normalized) if len(token) >= 3}


def _category_names_related(left: Optional[str], right: Optional[str]) -> bool:
    """Fuzzy match for catalog migrations where parent/subcategory names changed."""
    a = _normalize_name(left)
    b = _normalize_name(right)
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True

    tokens_a = _category_name_tokens(a)
    tokens_b = _category_name_tokens(b)
    if tokens_a & tokens_b:
        return True

    for token_a in tokens_a:
        for token_b in tokens_b:
            if len(token_a) >= 4 and len(token_b) >= 4 and (
                token_a.startswith(token_b) or token_b.startswith(token_a)
            ):
                return True
    return False


def _lookup_category(db: Session, category: str) -> Optional[Category]:
    if not category:
        return None

    stripped = category.strip()
    if stripped.isdigit():
        category_id = int(stripped)
        active = (
            db.query(Category)
            .filter(Category.id == category_id, Category.is_active.is_(True))
            .first()
        )
        if active:
            return active
        return db.query(Category).filter(Category.id == category_id).first()

    return (
        db.query(Category)
        .filter(Category.slug == stripped, Category.is_active.is_(True))
        .first()
    )


def _resolve_active_category(db: Session, category_obj: Category) -> Category:
    if category_obj.is_active:
        return category_obj

    target_name = _normalize_name(category_obj.name)
    active_match = (
        db.query(Category)
        .filter(
            Category.type == category_obj.type,
            Category.is_active.is_(True),
        )
        .all()
    )
    for candidate in active_match:
        if _normalize_name(candidate.name) == target_name:
            return candidate

    for candidate in active_match:
        if bool(candidate.parent_id) != bool(category_obj.parent_id):
            continue
        if _category_names_related(candidate.name, category_obj.name):
            return candidate

    return category_obj


def _legacy_category_ids_by_name(db: Session, category_obj: Category) -> set[int]:
    """Inactive categories with the same name that still have linked profiles."""
    target_name = _normalize_name(category_obj.name)
    legacy_ids: set[int] = set()
    inactive_rows = (
        db.query(Category)
        .join(Profile, Profile.category_id == Category.id)
        .filter(
            Category.type == category_obj.type,
            Category.is_active.is_(False),
            Category.id != category_obj.id,
        )
        .distinct()
        .all()
    )
    for legacy in inactive_rows:
        if _normalize_name(legacy.name) == target_name:
            legacy_ids.add(legacy.id)
            continue
        if _category_names_related(legacy.name, category_obj.name):
            legacy_ids.add(legacy.id)
    return legacy_ids


def _legacy_profile_category_ids(db: Session, category_obj: Category) -> set[int]:
    """Include inactive categories that still have profiles and belong to the same group."""
    if category_obj.parent_id is not None:
        return set()

    active_child_names = {
        _normalize_name(row.name)
        for row in db.query(Category.name)
        .filter(
            Category.parent_id == category_obj.id,
            Category.is_active.is_(True),
            Category.type == category_obj.type,
        )
        .all()
    }

    legacy_ids: set[int] = set()
    inactive_rows = (
        db.query(Category)
        .join(Profile, Profile.category_id == Category.id)
        .filter(
            Category.type == category_obj.type,
            Category.is_active.is_(False),
        )
        .distinct()
        .all()
    )

    for legacy in inactive_rows:
        legacy_name = _normalize_name(legacy.name)
        if legacy_name in active_child_names:
            legacy_ids.add(legacy.id)
            continue

        if legacy.parent_id is None:
            if _category_names_related(legacy.name, category_obj.name):
                legacy_ids.add(legacy.id)
                for child in (
                    db.query(Category)
                    .filter(Category.parent_id == legacy.id, Category.type == category_obj.type)
                    .all()
                ):
                    legacy_ids.add(child.id)
            continue

        legacy_parent = db.get(Category, legacy.parent_id)
        if not legacy_parent:
            continue
        if _category_names_related(legacy_parent.name, category_obj.name):
            legacy_ids.add(legacy.id)

    return legacy_ids


def _legacy_subcategory_parent_ids(db: Session, category_obj: Category) -> set[int]:
    """Include legacy parent/subcategory IDs still referenced by master profiles."""
    if category_obj.parent_id is None:
        return set()

    legacy_ids: set[int] = set()
    inactive_parents = (
        db.query(Category)
        .join(Profile, Profile.category_id == Category.id)
        .filter(
            Category.type == category_obj.type,
            Category.is_active.is_(False),
            Category.parent_id.is_(None),
        )
        .distinct()
        .all()
    )
    active_parent = db.get(Category, category_obj.parent_id)
    if not active_parent:
        return legacy_ids

    for legacy_parent in inactive_parents:
        if not _category_names_related(legacy_parent.name, active_parent.name):
            continue
        legacy_ids.add(legacy_parent.id)
        for child in (
            db.query(Category)
            .filter(
                Category.parent_id == legacy_parent.id,
                Category.type == category_obj.type,
            )
            .all()
        ):
            if _category_names_related(child.name, category_obj.name):
                legacy_ids.add(child.id)

    return legacy_ids


def resolve_category_ids(db: Session, category: Optional[str]) -> Optional[list[int]]:
    """Resolve slug or numeric category param to profile/product/rental category IDs."""
    if not category:
        return None

    category_obj = _lookup_category(db, category)
    if not category_obj:
        stripped = category.strip()
        if not stripped.isdigit():
            category_obj = (
                db.query(Category)
                .filter(Category.slug == stripped)
                .first()
            )
    if not category_obj:
        return None

    legacy_id = category_obj.id if not category_obj.is_active else None
    category_obj = _resolve_active_category(db, category_obj)

    ids: set[int] = {category_obj.id}
    if legacy_id is not None and legacy_id != category_obj.id:
        ids.add(legacy_id)

    if category_obj.parent_id is None:
        for subcat in (
            db.query(Category)
            .filter(
                Category.parent_id == category_obj.id,
                Category.is_active.is_(True),
                Category.type == category_obj.type,
            )
            .all()
        ):
            ids.add(subcat.id)
        ids.update(_legacy_profile_category_ids(db, category_obj))
    else:
        ids.add(category_obj.parent_id)
        ids.update(_legacy_category_ids_by_name(db, category_obj))
        ids.update(_legacy_subcategory_parent_ids(db, category_obj))

    return sorted(ids)
