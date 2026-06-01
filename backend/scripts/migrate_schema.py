"""Run database schema upgrades manually (e.g. in Coolify one-off command)."""
from app.database import ensure_schema, database_schema_ready


def main() -> None:
    ensure_schema()
    ready, error = database_schema_ready()
    if ready:
        print("OK: database schema is compatible")
    else:
        print(f"ERROR: database schema still incompatible: {error}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
