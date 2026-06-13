from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import Session, sessionmaker, DeclarativeBase
from sqlalchemy.engine import Engine
from sqlalchemy import inspect, text
from sqlalchemy.exc import ProgrammingError
from .config import settings
import logging

logger = logging.getLogger(__name__)

# Check if using async driver
USE_ASYNC = "asyncpg" in settings.DATABASE_URL or "aiosqlite" in settings.DATABASE_URL

# Connection arguments for different database types
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    # Enable foreign keys for SQLite
    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

if USE_ASYNC:
    # Use the DATABASE_URL as-is (should already have asyncpg://)
    async_database_url = settings.DATABASE_URL
    
    # Create async engine
    async_engine = create_async_engine(
        async_database_url,
        echo=False,
        future=True,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=10,  # Connection pool size
        max_overflow=20,  # Max overflow connections
        pool_recycle=3600,  # Recycle connections after 1 hour to prevent stale connections
        pool_timeout=30,  # Timeout when getting connection from pool (seconds)
        connect_args={"connect_timeout": 10}  # Connection timeout
    )
    
    AsyncSessionLocal = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )
    
    # For sync operations (like migrations), create sync engine with psycopg2
    sync_database_url = async_database_url.replace("+asyncpg", "+psycopg2")
    if not sync_database_url.startswith("postgresql"):
        sync_database_url = sync_database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    
    engine = create_engine(
        sync_database_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,  # Recycle connections after 1 hour to prevent stale connections
        pool_timeout=30,  # Timeout when getting connection from pool (seconds)
        connect_args={"connect_timeout": 10}  # Connection timeout
    )
else:
    # Create sync engine
    # Add connection timeout to connect_args if not SQLite
    if not settings.DATABASE_URL.startswith("sqlite"):
        connect_args["connect_timeout"] = 10
    
    engine = create_engine(
        settings.DATABASE_URL,
        echo=False,
        future=True,
        connect_args=connect_args,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=10,  # Connection pool size
        max_overflow=20,  # Max overflow connections
        pool_recycle=3600,  # Recycle connections after 1 hour to prevent stale connections
        pool_timeout=30  # Timeout when getting connection from pool (seconds)
    )
    async_engine = None
    AsyncSessionLocal = None

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

class Base(DeclarativeBase):
    pass

def get_db():
    """Dependency to get database session (sync)"""
    db = SessionLocal()
    ready, _ = database_schema_ready()
    if not ready:
        try:
            repair_profiles_schema(db)
        except Exception as exc:
            logger.error("Runtime database schema repair failed: %s", exc, exc_info=True)
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

async def get_async_db():
    """Dependency to get async database session"""
    if not USE_ASYNC:
        raise RuntimeError("Async database not configured. Use sync get_db() instead.")
    
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

def safe_create_all() -> None:
    """Create missing tables; ignore duplicate index/table errors on legacy DBs."""
    from .models import Base  # noqa: F401 — registers all models on metadata

    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
        logger.info("Database tables verified/created successfully")
    except ProgrammingError as exc:
        logger.warning(
            "create_all skipped existing DDL (duplicate table/index): %s",
            getattr(exc, "orig", exc),
        )
    except Exception as exc:
        logger.warning("create_all failed: %s", exc)

    _ensure_user_reports_table()


def _ensure_user_reports_table() -> None:
    """Create user_reports if missing (complaints from chat)."""
    from .models import UserReport  # noqa: F401

    insp = inspect(engine)
    if "user_reports" in insp.get_table_names():
        return

    try:
        UserReport.__table__.create(bind=engine, checkfirst=True)
        logger.info("Created table user_reports")
        return
    except Exception as exc:
        logger.warning("SQLAlchemy create user_reports failed: %s", exc)

    if engine.dialect.name == "postgresql":
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS user_reports (
                            id SERIAL PRIMARY KEY,
                            reporter_id INTEGER NOT NULL REFERENCES users(id),
                            reported_user_id INTEGER NOT NULL REFERENCES users(id),
                            conversation_id INTEGER REFERENCES conversations(id),
                            reason VARCHAR(64) NOT NULL,
                            details TEXT,
                            status VARCHAR(32) NOT NULL DEFAULT 'in_review',
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_user_reports_reporter_id "
                        "ON user_reports (reporter_id)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_user_reports_reported_user_id "
                        "ON user_reports (reported_user_id)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_user_reports_status "
                        "ON user_reports (status)"
                    )
                )
            logger.info("Created table user_reports via SQL")
        except Exception as sql_exc:
            logger.error("Failed to create user_reports table: %s", sql_exc)
            raise


def init_db():
    """Initialize database - create all tables"""
    safe_create_all()

def _ensure_column(table: str, column: str, column_type: str) -> None:
    """Add a column when missing. Uses IF NOT EXISTS on PostgreSQL."""
    dialect_name = engine.dialect.name
    try:
        with engine.begin() as conn:
            if dialect_name == "postgresql":
                conn.execute(
                    text(
                        f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{column}" {column_type}'
                    )
                )
            else:
                insp = inspect(engine)
                if table not in insp.get_table_names():
                    return
                cols = {c.get("name") for c in insp.get_columns(table)}
                if column not in cols:
                    conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
                    )
        logger.info("Schema updated: ensured %s.%s exists", table, column)
    except Exception as exc:
        logger.error("Failed to ensure column %s.%s: %s", table, column, exc)
        raise


def profiles_schema_ready() -> tuple[bool, str | None]:
    """Return whether profiles table supports current ORM columns."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT keywords, profession FROM profiles LIMIT 1"))
        return True, None
    except Exception as exc:
        return False, str(exc)


def users_schema_ready() -> tuple[bool, str | None]:
    """Return whether users table supports current ORM columns."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT deletion_requested_at FROM users LIMIT 1"))
        return True, None
    except Exception as exc:
        return False, str(exc)


def user_reports_table_ready() -> tuple[bool, str | None]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1 FROM user_reports LIMIT 1"))
        return True, None
    except Exception as exc:
        return False, str(exc)


def database_schema_ready() -> tuple[bool, str | None]:
    """Return whether core tables match the current SQLAlchemy models."""
    profiles_ok, profiles_error = profiles_schema_ready()
    if not profiles_ok:
        return False, profiles_error
    users_ok, users_error = users_schema_ready()
    if not users_ok:
        return False, users_error
    reports_ok, reports_error = user_reports_table_ready()
    if not reports_ok:
        return False, reports_error
    return True, None


def repair_profiles_schema(db: Session | None = None) -> None:
    """Self-heal missing columns on legacy databases (startup and first failing request)."""
    insp = inspect(engine)
    table_names = set(insp.get_table_names())
    def _try_ensure_column(table: str, column: str, column_type: str) -> None:
        try:
            _ensure_column(table, column, column_type)
        except Exception as exc:
            logger.error("Could not add %s.%s: %s", table, column, exc)

    if "users" in table_names:
        _try_ensure_column("users", "deletion_requested_at", "TIMESTAMPTZ")
        _try_ensure_column("users", "suspended_until", "TIMESTAMPTZ")

    if "user_reports" in table_names:
        report_columns = {
            "violation_type": "VARCHAR(32)",
            "action_taken": "VARCHAR(32)",
            "admin_note": "TEXT",
            "resolved_at": "TIMESTAMPTZ",
            "resolved_by_id": "INTEGER",
        }
        for column_name, column_type in report_columns.items():
            _try_ensure_column("user_reports", column_name, column_type)

    profile_columns = {
        "keywords": "TEXT",
        "profession": "VARCHAR(255)",
    }
    review_columns = {
        "master_response": "TEXT",
        "report_reason": "VARCHAR(64)",
        "report_status": "VARCHAR(32)",
        "reported_by_id": "INTEGER",
        "reported_at": "TIMESTAMP",
    }
    if "profiles" in table_names:
        for column_name, column_type in profile_columns.items():
            _try_ensure_column("profiles", column_name, column_type)

    if "reviews" in table_names:
        for column_name, column_type in review_columns.items():
            _try_ensure_column("reviews", column_name, column_type)

    _ensure_user_reports_table()
    safe_create_all()

    ready, schema_error = database_schema_ready()
    if ready:
        logger.info("Database schema repair: compatible")
    else:
        logger.error("Database schema repair incomplete: %s", schema_error)

    if db is not None:
        db.commit()

    if ready:
        ensure_master_category_updates()
        from .category_catalog import sync_master_categories_catalog

        # Do not deactivate legacy categories on redeploy — admin active/inactive state must persist.
        sync_master_categories_catalog(deactivate_legacy=False)
        _ensure_category_media_on_startup()


def _ensure_category_media_on_startup() -> None:
    """Restore missing category image files after redeploy (uploads volume may be empty)."""
    from .category_media import ensure_category_media_files

    session = SessionLocal()
    try:
        files_restored, urls_assigned = ensure_category_media_files(session)
        if files_restored or urls_assigned:
            session.commit()
            logger.info(
                "Category media ensure: restored %s file(s), assigned %s image_url(s)",
                files_restored,
                urls_assigned,
            )
    except Exception:
        session.rollback()
        logger.exception("Failed to ensure category media files on startup")
    finally:
        session.close()


def ensure_schema():
    """
    Lightweight schema upgrader for projects without migrations.
    Creates missing tables and adds missing columns in-place when safe.
    """
    try:
        repair_profiles_schema()
    except Exception as e:
        logger.error("Schema ensure failed: %s", e, exc_info=True)

def ensure_master_category_updates():
    """Rename/merge master categories for existing databases without re-seeding."""
    from .models import Category, Profile, CategoryType

    session = SessionLocal()
    try:
        renames = {
            "master-auto": "KFZ & Fahrzeugservice",
            "master-handwerker": "Bau & Renovierung",
            "master-sanitär": "Sanitär & Heizung",
        }
        for slug, new_name in renames.items():
            category = session.query(Category).filter(
                Category.slug == slug,
                Category.type == CategoryType.master,
            ).first()
            if category and category.name != new_name:
                category.name = new_name

        sanitär = session.query(Category).filter(
            Category.slug == "master-sanitär",
            Category.type == CategoryType.master,
        ).first()
        hlk = session.query(Category).filter(
            Category.slug == "master-hlk",
            Category.type == CategoryType.master,
        ).first()
        if sanitär and hlk:
            hlk_subcategories = session.query(Category).filter(
                Category.parent_id == hlk.id,
                Category.type == CategoryType.master,
            ).all()
            sanitär_subs = {
                sub.name.lower(): sub.id
                for sub in session.query(Category).filter(
                    Category.parent_id == sanitär.id,
                    Category.type == CategoryType.master,
                ).all()
            }
            migrated_profiles = 0
            for sub in hlk_subcategories:
                target_id = sanitär_subs.get(sub.name.lower()) or sanitär.id
                migrated_profiles += (
                    session.query(Profile)
                    .filter(Profile.category_id == sub.id)
                    .update({Profile.category_id: target_id}, synchronize_session=False)
                    or 0
                )
            migrated_profiles += (
                session.query(Profile)
                .filter(Profile.category_id == hlk.id)
                .update({Profile.category_id: sanitär.id}, synchronize_session=False)
                or 0
            )
            if migrated_profiles > 0:
                hlk.is_active = False
                for sub in hlk_subcategories:
                    sub.is_active = False

        schneider = session.query(Category).filter(
            Category.slug == "master-schneider-naeherei",
            Category.type == CategoryType.master,
        ).first()
        if not schneider:
            schneider = Category(
                name="Schneider / Näherei",
                slug="master-schneider-naeherei",
                type=CategoryType.master,
                description="Schneiderei und Nähservice für Kleidung, Vorhänge und Textilien.",
                sort_order=99,
                is_active=True,
            )
            session.add(schneider)
            session.flush()
            for idx, (sub_name, sub_desc) in enumerate([
                ("Änderungen", "Kleidungsänderungen und Anpassungen."),
                ("Reparaturen", "Reparatur von Kleidung und Textilien."),
                ("Maßanfertigung", "Individuelle Maßanfertigungen."),
                ("Reißverschluss", "Reißverschluss-Reparatur und -ersatz."),
                ("Vorhänge", "Vorhangnähen und -anpassung."),
                ("Hemden", "Hemden- und Blusenänderungen."),
            ]):
                session.add(Category(
                    name=sub_name,
                    slug=f"master-schneider-naeherei-{sub_name.lower().replace('ä', 'ae').replace('ß', 'ss')}",
                    type=CategoryType.master,
                    description=sub_desc,
                    parent_id=schneider.id,
                    sort_order=idx,
                    is_active=True,
                ))

        session.commit()
    except Exception as e:
        session.rollback()
        logger.warning(f"Master category updates failed: {e}")
    finally:
        session.close()

def drop_db():
    """Drop all tables - use with caution!"""
    from .models import Base
    Base.metadata.drop_all(bind=engine)
    logger.warning("Database dropped")
