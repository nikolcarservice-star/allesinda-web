from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.engine import Engine
from sqlalchemy import inspect, text
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

def init_db():
    """Initialize database - create all tables"""
    from .models import Base
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized")

def ensure_schema():
    """
    Lightweight schema upgrader for projects without migrations.
    Adds missing columns in-place when safe.
    """
    try:
        insp = inspect(engine)
        if "profiles" in insp.get_table_names():
            cols = {c.get("name") for c in insp.get_columns("profiles")}
            if "keywords" not in cols:
                with engine.begin() as conn:
                    # SQLite and Postgres both support this simple ADD COLUMN
                    conn.execute(text("ALTER TABLE profiles ADD COLUMN keywords TEXT"))
                logger.info("Schema updated: added profiles.keywords column")
            if "profession" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE profiles ADD COLUMN profession VARCHAR(255)"))
                logger.info("Schema updated: added profiles.profession column")
        if "users" in insp.get_table_names():
            cols = {c.get("name") for c in insp.get_columns("users")}
            if "deletion_requested_at" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN deletion_requested_at TIMESTAMP"))
                logger.info("Schema updated: added users.deletion_requested_at column")
        if "reviews" in insp.get_table_names():
            cols = {c.get("name") for c in insp.get_columns("reviews")}
            review_columns = {
                "master_response": "TEXT",
                "report_reason": "VARCHAR(64)",
                "report_status": "VARCHAR(32)",
                "reported_by_id": "INTEGER",
                "reported_at": "TIMESTAMP",
            }
            for column_name, column_type in review_columns.items():
                if column_name not in cols:
                    with engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE reviews ADD COLUMN {column_name} {column_type}"))
                    logger.info(f"Schema updated: added reviews.{column_name} column")
        ensure_master_category_updates()
    except Exception as e:
        # Never crash startup if schema checks fail
        logger.warning(f"Schema ensure failed: {e}")

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
            for sub in hlk_subcategories:
                target_id = sanitär_subs.get(sub.name.lower()) or sanitär.id
                session.query(Profile).filter(Profile.category_id == sub.id).update(
                    {Profile.category_id: target_id},
                    synchronize_session=False,
                )
            session.query(Profile).filter(Profile.category_id == hlk.id).update(
                {Profile.category_id: sanitär.id},
                synchronize_session=False,
            )
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
