from fastapi import APIRouter, FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .database import Base, engine, init_db, ensure_schema
from .routers import auth, masters, sellers, products, rentals, media, orders, reviews, search, admin, payments, chat, gallery, favorites, featured, relationships,notifications, categories, users, trending, cities
from .config import settings
from .utils.image_optimizer import cleanup_image_cache
import logging
import sys
import os
import io
import asyncio
from datetime import datetime
from typing import Optional

# Configure structured logging
log_level = getattr(logging, settings.LOG_LEVEL, logging.INFO)
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Initialize database tables (if they don't exist)
# This is safe to run at module level as it only creates missing tables
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully")
    ensure_schema()
except Exception as e:
    logger.error(f"Error creating database tables: {e}")
    # Don't crash on startup - tables might already exist or DB might not be ready yet
    # The startup event or entrypoint script will handle retries if needed

# Create upload folder if it doesn't exist
upload_folder = settings.UPLOAD_FOLDER
if not os.path.isabs(upload_folder):
    # If relative path, make it relative to the project root
    upload_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), upload_folder)

os.makedirs(upload_folder, exist_ok=True)
logger.info(f"Upload folder initialized: {upload_folder}")

app = FastAPI(
    title="Allesinda API",
    version="0.1.0",
    description="Three-sided marketplace API for repair ecosystem",
    docs_url="/docs" if not settings.IS_PRODUCTION else None,  # Disable docs in production
    redoc_url="/redoc" if not settings.IS_PRODUCTION else None  # Disable redoc in production
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(SlowAPIMiddleware)

# CORS middleware - tightened for production
allowed_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
allowed_headers = [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
    "X-CSRF-Token"
]

# Normalize CORS origins from settings
cors_setting = settings.CORS_ORIGINS
allow_all_origins = False

if isinstance(cors_setting, (list, tuple, set)):
    cors_origins = list(cors_setting)
    # Check if list contains "*"
    if "*" in cors_origins:
        allow_all_origins = True
        cors_origins = ["*"]
elif isinstance(cors_setting, str):
    cors_origins = [
        origin.strip()
        for origin in cors_setting.split(",")
        if origin and origin.strip()
    ]
    # Check if string contains "*"
    if "*" in cors_origins:
        allow_all_origins = True
        cors_origins = ["*"]
else:
    cors_origins = []

# Ensure localhost:3000 is always included in development (unless allow_all_origins is True)
if not settings.IS_PRODUCTION and not allow_all_origins:
    dev_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    for origin in dev_origins:
        if origin not in cors_origins:
            cors_origins.append(origin)

# Note: When allow_origins=["*"], allow_credentials must be False per CORS spec
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False if allow_all_origins else True,
    allow_methods=allowed_methods if settings.IS_PRODUCTION else ["*"],
    allow_headers=allowed_headers if settings.IS_PRODUCTION else ["*"],
    expose_headers=["X-Total-Count", "X-Page", "X-Page-Size"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Optional API prefix (e.g. API_PREFIX=/api → routes at /api/auth, /api/media, ...)
# Set in backend env if your proxy serves the API under a path. Then set NEXT_PUBLIC_API_URL to https://api.allesinda.com/api
_api_prefix = os.getenv("API_PREFIX", "").strip().rstrip("/")

def _include_routers(target):
    target.include_router(auth.router)
    target.include_router(users.router)
    target.include_router(masters.router)
    target.include_router(sellers.router)
    target.include_router(products.router)
    target.include_router(rentals.router)
    target.include_router(media.router)
    target.include_router(orders.router)
    target.include_router(reviews.router)
    target.include_router(search.router)
    target.include_router(admin.router)
    target.include_router(payments.router)
    target.include_router(chat.router)
    target.include_router(gallery.router)
    target.include_router(favorites.router)
    target.include_router(featured.router)
    target.include_router(relationships.router)
    target.include_router(notifications.router)
    target.include_router(categories.router)
    target.include_router(trending.router)
    target.include_router(cities.router)

if _api_prefix:
    _api = APIRouter()
    _include_routers(_api)
    app.include_router(_api, prefix=_api_prefix)
    logger.info(f"API mounted under prefix: {_api_prefix}")
else:
    _include_routers(app)

# Handler for media files - serve existing files or generate placeholders
from fastapi import Request
from fastapi.responses import FileResponse, Response
from starlette.exceptions import HTTPException
import hashlib
import time

@app.get(f"{settings.MEDIA_URL_PREFIX}/{{file_path:path}}")
async def serve_media_file(
    request: Request, 
    file_path: str,
    w: Optional[int] = None,  # Width parameter for resizing
    h: Optional[int] = None,   # Height parameter for resizing
    q: int = 85                # Quality parameter (1-100)
):
    """Serve media files with optimization, caching, and resizing support.
    
    Query parameters:
    - w: Maximum width (maintains aspect ratio)
    - h: Maximum height (maintains aspect ratio)
    - q: JPEG quality (1-100, default 85)
    """
    import os
    from .utils.image_optimizer import optimize_image, get_image_info
    
    # Construct full file path and prevent path traversal
    upload_root = os.path.abspath(upload_folder)
    full_path = os.path.abspath(os.path.join(upload_root, file_path))
    if os.path.commonpath([upload_root, full_path]) != upload_root:
        raise HTTPException(status_code=403, detail="Invalid file path")
    
    # Check if file exists
    if os.path.exists(full_path) and os.path.isfile(full_path):
        # Get file stats for ETag and Last-Modified
        stat = os.stat(full_path)
        mtime = stat.st_mtime
        file_size = stat.st_size
        
        # Generate ETag from file path, size, mtime, and query params
        etag_data = f"{file_path}_{file_size}_{mtime}_{w}_{h}_{q}"
        etag = hashlib.md5(etag_data.encode()).hexdigest()
        
        # Check If-None-Match header for 304 Not Modified
        if_none_match = request.headers.get("if-none-match")
        if if_none_match == etag:
            return Response(status_code=304)
        
        # Check If-Modified-Since header
        if_modified_since = request.headers.get("if-modified-since")
        if if_modified_since:
            try:
                import email.utils
                if_modified_since_time = email.utils.parsedate_to_datetime(if_modified_since).timestamp()
                if mtime <= if_modified_since_time:
                    return Response(status_code=304)
            except:
                pass
        
        # Determine if this is an image that can be optimized
        file_ext = os.path.splitext(full_path)[1].lower()
        is_image = file_ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
        
        # Auto-optimize large images (over 500KB) even without query params
        should_auto_optimize = is_image and file_size > 500 * 1024
        
        # If resizing/optimization is requested or auto-optimization is needed
        if is_image and (w or h or q != 85 or should_auto_optimize):
            try:
                # Validate quality parameter
                q = max(1, min(100, q))
                
                # For auto-optimization without size params, limit to reasonable web size
                max_w = w
                max_h = h
                if should_auto_optimize and not w and not h:
                    # Get image dimensions to determine appropriate max size
                    img_info = get_image_info(full_path)
                    if img_info:
                        img_width, img_height, _ = img_info
                        # Limit to 1920px on longest side for auto-optimization
                        if img_width > img_height:
                            if img_width > 1920:
                                max_w = 1920
                        else:
                            if img_height > 1920:
                                max_h = 1920
                
                # Optimize/resize image
                optimized_bytes = optimize_image(
                    full_path,
                    max_width=max_w,
                    max_height=max_h,
                    quality=q,
                    format="JPEG" if file_ext in ('.jpg', '.jpeg') else "WEBP",
                    use_cache=True
                )
                
                if optimized_bytes:
                    # Determine content type
                    content_type = "image/jpeg" if file_ext in ('.jpg', '.jpeg') else f"image/{file_ext[1:]}"
                    if file_ext == '.webp':
                        content_type = "image/webp"
                    
                    # Create response with caching headers
                    response = Response(
                        content=optimized_bytes,
                        media_type=content_type,
                        headers={
                            "Cache-Control": "public, max-age=31536000, immutable",  # 1 year
                            "ETag": etag,
                            "Last-Modified": time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime(mtime)),
                            "Content-Length": str(len(optimized_bytes)),
                        }
                    )
                    return response
            except Exception as e:
                logger.warning(f"Image optimization failed for {file_path}: {e}, serving original")
        
        # Serve original file with caching headers
        response = FileResponse(
            full_path,
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",  # 1 year
                "ETag": etag,
                "Last-Modified": time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime(mtime)),
            }
        )
        return response
    
    # File doesn't exist - generate placeholder
    try:
        # Try to import PIL
        try:
            from PIL import Image, ImageDraw, ImageFont
            PIL_AVAILABLE = True
        except ImportError:
            PIL_AVAILABLE = False
            logger.warning("PIL/Pillow not available, cannot generate placeholder images")
            return Response(status_code=404, content="Image not found")
        
        # Extract filename and determine type
        filename = os.path.basename(file_path)
        
        # Determine text label from filename
        text_label = "Placeholder"
        if "work_" in filename:
            text_label = "Work Gallery\nPlaceholder"
        elif "product_" in filename:
            text_label = "Product\nPlaceholder"
        elif "rental_" in filename:
            text_label = "Rental\nPlaceholder"
        elif "before_" in filename or "after_" in filename:
            text_label = "Before/After\nPlaceholder"
        
        # Create placeholder image
        width, height = 800, 600
        if "work_" in filename:
            width, height = 1200, 800
        
        img = Image.new('RGB', (width, height), color=(200, 200, 200))
        
        # Add gradient
        draw = ImageDraw.Draw(img)
        for y_pos in range(height):
            ratio = y_pos / height
            r = int(200 * (1 - ratio * 0.2))
            g = int(200 * (1 - ratio * 0.2))
            b = int(200 * (1 - ratio * 0.2))
            draw.line([(0, y_pos), (width, y_pos)], fill=(r, g, b))
        
        # Add text
        try:
            font_size = min(width, height) // 12
            if font_size < 20:
                font_size = 20
            try:
                font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", font_size)
            except:
                try:
                    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
                except:
                    font = ImageFont.load_default()
            
            lines = text_label.split('\n')
            line_heights = []
            line_widths = []
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                line_heights.append(bbox[3] - bbox[1])
                line_widths.append(bbox[2] - bbox[0])
            
            total_height = sum(line_heights) + (len(lines) - 1) * 10
            max_width = max(line_widths) if line_widths else 0
            
            x = (width - max_width) // 2
            y = (height - total_height) // 2
            
            # Draw background
            padding = 30
            overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            overlay_draw.rectangle(
                [x - padding, y - padding, x + max_width + padding, y + total_height + padding],
                fill=(0, 0, 0, 180)
            )
            img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
            draw = ImageDraw.Draw(img)
            
            # Draw text
            current_y = y
            for i, line in enumerate(lines):
                line_bbox = draw.textbbox((0, 0), line, font=font)
                line_width = line_bbox[2] - line_bbox[0]
                line_x = (width - line_width) // 2
                draw.text((line_x, current_y), line, fill=(255, 255, 255), font=font)
                current_y += line_heights[i] + 10
        except Exception as e:
            logger.warning(f"Could not add text to placeholder: {e}")
        
        # Convert to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG', quality=85)
        img_bytes.seek(0)
        
        return Response(content=img_bytes.read(), media_type="image/jpeg")
    except Exception as e:
        logger.error(f"Error generating placeholder image: {e}")
        # Return a simple 404
        return Response(status_code=404)

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with CORS headers"""
    response = JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code
        },
        headers=dict(exc.headers) if exc.headers else {}
    )
    # Ensure CORS headers are added to error responses
    origin = request.headers.get("origin")
    if origin:
        if allow_all_origins:
            response.headers["Access-Control-Allow-Origin"] = "*"
        elif origin in cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            if not allow_all_origins:
                response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    response = JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "status_code": 422
        }
    )
    # Ensure CORS headers are added to error responses
    origin = request.headers.get("origin")
    if origin:
        if allow_all_origins:
            response.headers["Access-Control-Allow-Origin"] = "*"
        elif origin in cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            if not allow_all_origins:
                response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    response = JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "status_code": 500
        }
    )
    # Ensure CORS headers are added to error responses
    origin = request.headers.get("origin")
    if origin:
        if allow_all_origins:
            response.headers["Access-Control-Allow-Origin"] = "*"
        elif origin in cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            if not allow_all_origins:
                response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.get("/")
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute") if settings.RATE_LIMIT_ENABLED else lambda f: f
def root(request: Request):
    """Root endpoint"""
    out = {
        "ok": True,
        "name": "Allesinda API",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if not settings.IS_PRODUCTION else None
    }
    if _api_prefix:
        out["api_prefix"] = _api_prefix  # API routes live under this path (e.g. NEXT_PUBLIC_API_URL = base + prefix)
    return out

@app.get("/health")
def health_check():
    """Health check endpoint - no rate limiting for monitoring"""
    from .database import engine
    
    health_status = {
        "status": "healthy",
        "ok": True,
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.ENVIRONMENT
    }
    
    # Check database connection pool status
    try:
        pool = engine.pool
        if hasattr(pool, 'size') and hasattr(pool, 'checked_in') and hasattr(pool, 'checked_out'):
            health_status["database_pool"] = {
                "size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow() if hasattr(pool, 'overflow') else 0,
                "invalid": pool.invalid() if hasattr(pool, 'invalid') else 0
            }
            
            # Warn if pool is getting exhausted
            total_connections = pool.size() + (pool.overflow() if hasattr(pool, 'overflow') else 0)
            checked_out = pool.checkedout()
            if total_connections > 0:
                utilization = (checked_out / total_connections) * 100
                if utilization > 80:
                    logger.warning(f"Database connection pool utilization is {utilization:.1f}% ({checked_out}/{total_connections})")
                    health_status["database_pool"]["warning"] = f"High utilization: {utilization:.1f}%"
    except Exception as e:
        logger.warning(f"Could not get database pool status: {e}")
        health_status["database_pool"] = {"error": str(e)}
    
    return health_status

async def periodic_cache_cleanup():
    """Background task to periodically clean up image cache"""
    while True:
        try:
            # Run cleanup every 24 hours
            await asyncio.sleep(24 * 60 * 60)
            logger.info("Running periodic image cache cleanup...")
            stats = cleanup_image_cache(upload_folder, max_age_days=30, max_cache_size_mb=5000)
            logger.info(f"Cache cleanup stats: {stats}")
        except Exception as e:
            logger.error(f"Error in periodic cache cleanup: {e}", exc_info=True)
            # Wait 1 hour before retrying on error
            await asyncio.sleep(60 * 60)

@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    logger.info("=" * 60)
    logger.info("Allesinda API starting up...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Database URL: {settings.DATABASE_URL[:30]}...")
    logger.info(f"CORS origins: {settings.CORS_ORIGINS}")
    logger.info(f"Rate limiting: {'Enabled' if settings.RATE_LIMIT_ENABLED else 'Disabled'}")
    if settings.RATE_LIMIT_ENABLED:
        logger.info(f"  - Per minute: {settings.RATE_LIMIT_PER_MINUTE}")
        logger.info(f"  - Per hour: {settings.RATE_LIMIT_PER_HOUR}")
    logger.info(f"Log level: {settings.LOG_LEVEL}")
    logger.info(f"Upload folder: {upload_folder}")
    logger.info(f"Media URL prefix: {settings.MEDIA_URL_PREFIX}")
    
    # Note: Database seeding is handled in docker-entrypoint.sh before starting the server
    # This prevents race conditions when using multiple workers and ensures seeding
    # happens only once, not per worker process
    if settings.SEED_DB_ON_START and settings.IS_PRODUCTION:
        logger.error("=" * 60)
        logger.error("WARNING: SEED_DB_ON_START is enabled in PRODUCTION!")
        logger.error("This is a security risk. Database seeding should be disabled in production.")
        logger.error("=" * 60)
    
    # Run initial cache cleanup on startup (non-blocking)
    try:
        logger.info("Running initial image cache cleanup...")
        stats = cleanup_image_cache(upload_folder, max_age_days=30, max_cache_size_mb=5000)
        logger.info(f"Initial cache cleanup stats: {stats}")
    except Exception as e:
        logger.warning(f"Error during initial cache cleanup: {e}")
    
    # Start background task for periodic cache cleanup
    asyncio.create_task(periodic_cache_cleanup())
    
    logger.info("=" * 60)

@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    logger.info("Allesinda API shutting down...")
