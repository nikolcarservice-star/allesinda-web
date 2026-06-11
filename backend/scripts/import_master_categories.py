#!/usr/bin/env python3
"""Import master category catalog from JSON into the database."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.category_catalog import import_catalog, load_catalog, remap_master_entity_categories
from app.database import SessionLocal


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
    catalog = load_catalog(path)

    db = SessionLocal()
    try:
        parents, children = import_catalog(db, catalog, deactivate_legacy=args.deactivate_legacy)
        remapped = remap_master_entity_categories(db)
        db.commit()
        print(f"Imported {parents} parent categories and {children} subcategories from {path.name}")
        print(f"Remapped {remapped} entity category references")
    finally:
        db.close()


if __name__ == "__main__":
    main()
