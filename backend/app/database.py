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
    except Exception as e:
        # Never crash startup if schema checks fail
        logger.warning(f"Schema ensure failed: {e}")

def drop_db():
    """Drop all tables - use with caution!"""
    from .models import Base
    Base.metadata.drop_all(bind=engine)
    logger.warning("Database dropped")
