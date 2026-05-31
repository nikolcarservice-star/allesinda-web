"""Run database schema upgrades manually (e.g. in Coolify one-off command)."""
from app.database import init_db, ensure_schema, profiles_schema_ready


def main() -> None:
    init_db()
    ensure_schema()
    ready, error = profiles_schema_ready()
    if ready:
        print("OK: profiles schema is compatible")
    else:
        print(f"ERROR: profiles schema still incompatible: {error}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
