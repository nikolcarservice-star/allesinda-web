from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import logging
from datetime import datetime
from ..database import get_db
from ..models import Media, MediaStatus, User, Role, Profile
from ..schemas import MediaIn, MediaOut
from ..security import get_current_user, require_role
from ..helpers import paginate_query, create_paginated_response
from ..utils.storage import get_upload_folder, get_media_subfolder, build_media_url, media_url_to_upload_relative_path
from ..config import settings

logger = logging.getLogger(__name__)

# Try to import cv2 for video thumbnail generation
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("opencv-python not available. Video thumbnail generation will be disabled.")

router = APIRouter(prefix="/media", tags=["media"])

VALID_VIDEO_EXTENSIONS = frozenset({"mp4", "mov", "avi", "webm", "mkv", "m4v", "3gp"})


def _max_video_bytes() -> int:
    return settings.MAX_VIDEO_UPLOAD_SIZE_MB * 1024 * 1024

CONTENT_TYPE_TO_VIDEO_EXT = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/mov": "mov",
    "video/x-msvideo": "avi",
    "video/avi": "avi",
    "video/x-matroska": "mkv",
    "video/mkv": "mkv",
    "video/3gpp": "3gp",
    "video/3gp": "3gp",
    "video/x-m4v": "m4v",
    "application/mp4": "mp4",
}


def _extension_from_filename(filename: Optional[str]) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def _resolve_video_extension(content_type: str, file_ext: str) -> str:
    normalized_type = (content_type or "").lower().split(";")[0].strip()
    ext = (file_ext or "").lower()
    if ext in VALID_VIDEO_EXTENSIONS:
        return ext
    mapped = CONTENT_TYPE_TO_VIDEO_EXT.get(normalized_type)
    if mapped:
        return mapped
    if normalized_type.startswith("video/"):
        subtype = normalized_type.split("/", 1)[1]
        if subtype in VALID_VIDEO_EXTENSIONS:
            return subtype
    return "mp4"


def _is_allowed_video_upload(content_type: str, file_ext: str) -> bool:
    normalized_type = (content_type or "").lower().split(";")[0].strip()
    ext = (file_ext or "").lower()
    if ext in VALID_VIDEO_EXTENSIONS:
        return True
    if normalized_type.startswith("video/"):
        return True
    if normalized_type in ("application/octet-stream", "application/mp4"):
        return True
    # Mobile gallery often sends empty MIME and no extension; trust media_type=video from the form.
    if not normalized_type and not ext:
        return True
    return False


def generate_video_thumbnail(video_path: str, thumbnail_path: str, timestamp_seconds: float = 1.0) -> bool:
    """Generate a thumbnail image from a video file
    
    Args:
        video_path: Path to the video file
        thumbnail_path: Path where the thumbnail should be saved
        timestamp_seconds: Time in seconds to extract the frame (default: 1 second)
    
    Returns:
        True if thumbnail was generated successfully, False otherwise
    """
    if not CV2_AVAILABLE:
        logger.warning("cv2 not available, cannot generate thumbnail")
        return False
    
    try:
        # Open video file
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            logger.error(f"Failed to open video file: {video_path}")
            return False
        
        # Get video FPS to calculate frame number
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30  # Default FPS if not available
        
        # Calculate frame number at the specified timestamp
        frame_number = int(fps * timestamp_seconds)
        
        # Set video position to the desired frame
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        
        # Read frame
        ret, frame = cap.read()
        
        if not ret or frame is None:
            # If frame extraction failed, try to get first frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
            if not ret or frame is None:
                logger.error(f"Failed to extract frame from video: {video_path}")
                cap.release()
                return False
        
        # Release video capture
        cap.release()
        
        # Resize frame to a reasonable thumbnail size (max 1280px width, maintain aspect ratio)
        height, width = frame.shape[:2]
        max_width = 1280
        if width > max_width:
            scale = max_width / width
            new_width = max_width
            new_height = int(height * scale)
            frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)
        
        # Save thumbnail as JPEG
        cv2.imwrite(thumbnail_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        
        logger.info(f"Successfully generated thumbnail: {thumbnail_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error generating video thumbnail: {str(e)}")
        return False

@router.post("/upload", response_model=MediaOut)
async def upload_media(
    file: UploadFile = File(...),
    media_type: str = Form("photo"),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    profile_id: Optional[int] = Form(None),
    product_id: Optional[int] = Form(None),
    rental_id: Optional[int] = Form(None),
    order_id: Optional[int] = Form(None),
    before_url: Optional[str] = Form(None),
    after_url: Optional[str] = Form(None),
    is_before_after: bool = Form(False),
    category: Optional[str] = Form(None),  # Deprecated: category slug (will be resolved to category_id)
    category_id: Optional[int] = Form(None),  # Category ID (preferred)
    sort_order: int = Form(0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload media for work gallery, products, or rentals
    
    Supports:
    - Photos: regular photos for work gallery, products, or rentals
    - Videos: short vertical format videos (like stories) - recommended 9:16 aspect ratio
    - Before/After pairs: upload with both before_url and after_url
    - Multiple files: upload multiple images/videos for products and rentals
    """
    if media_type not in ("photo", "video"):
        raise HTTPException(400, "Invalid media_type. Must be 'photo' or 'video'")
    
    # Validate that only one of profile_id, product_id, or rental_id is provided
    entity_count = sum([bool(profile_id), bool(product_id), bool(rental_id)])
    if entity_count > 1:
        raise HTTPException(400, "Only one of profile_id, product_id, or rental_id can be provided")
    
    # For work gallery (profile_id), ensure ownership (role-independent)
    # Role enforcement is handled by frontend route guards
    
    # For products and rentals, only sellers can upload
    if (product_id or rental_id) and user.role != Role.seller:
        raise HTTPException(403, "Only sellers can upload product or rental media")
    
    # Verify profile exists for work gallery
    if profile_id:
        profile = db.query(Profile).filter(Profile.id == profile_id).first()
        if not profile or profile.user_id != user.id:
            raise HTTPException(400, "Profile not found or access denied")
    
    # Verify product exists and belongs to user
    if product_id:
        from ..models import Product
        product = db.get(Product, product_id)
        if not product or product.seller_id != user.id:
            raise HTTPException(400, "Product not found or access denied")
    
    # Verify rental exists and belongs to user
    if rental_id:
        from ..models import Rental
        rental = db.get(Rental, rental_id)
        if not rental or rental.seller_id != user.id:
            raise HTTPException(400, "Rental not found or access denied")
    
    # Validate before/after pair
    if is_before_after:
        if not before_url or not after_url:
            raise HTTPException(
                400, 
                "Both before_url and after_url are required for before/after pairs"
            )
    
    # Category image uploads take precedence over the uploader's master profile.
    is_category_upload = False
    category_slug = None
    category_obj = None
    if not product_id and not rental_id and (category_id or category):
        from ..models import Category

        if category_id:
            category_obj = db.get(Category, category_id)
        elif category:
            category_obj = db.query(Category).filter(Category.slug == category).first()
        if category_obj and not category_obj.parent_id:
            if user.role != Role.admin:
                raise HTTPException(403, "Only admins can upload category images")
            is_category_upload = True
            category_slug = category_obj.slug

    # Resolve profile context only for non-category uploads.
    final_profile_id = profile_id
    if not is_category_upload and not final_profile_id:
        profile = db.query(Profile).filter(Profile.user_id == user.id).first()
        if profile:
            final_profile_id = profile.id
    
    # Determine storage entity type for structured folders
    if is_category_upload:
        entity_type = "category"  # Only main categories
    elif product_id:
        entity_type = "product"
    elif rental_id:
        entity_type = "rental"
    elif final_profile_id:
        entity_type = "master"
    else:
        entity_type = None
    
    # Determine content type and file extension
    content_type = getattr(file, "content_type", None) or ""
    file_ext = _extension_from_filename(file.filename)
    if not file_ext:
        normalized_type = content_type.lower().split(";")[0].strip()
        if normalized_type in ("image/jpeg", "image/jpg"):
            file_ext = "jpg"
        elif normalized_type == "image/png":
            file_ext = "png"
        elif normalized_type == "image/webp":
            file_ext = "webp"
        elif normalized_type == "image/gif":
            file_ext = "gif"
        elif normalized_type == "image/bmp":
            file_ext = "bmp"
        elif media_type == "video":
            file_ext = _resolve_video_extension(content_type, file_ext)
    
    # Validate video format (check file extension and size)
    if media_type == "video":
        if not _is_allowed_video_upload(content_type, file_ext):
            raise HTTPException(
                400,
                "Invalid video format. Supported: MP4, MOV, AVI, WebM, MKV, M4V, 3GP",
            )
        file_ext = _resolve_video_extension(content_type, file_ext)
        
        # Check file size (supports ~1 min clips at typical phone bitrates)
        max_video_bytes = _max_video_bytes()
        file_size = 0
        try:
            content = await file.read()
            file_size = len(content)
            await file.seek(0)  # Reset file pointer
        except Exception as read_err:
            logger.warning("Could not read video for size check: %s", read_err)
        
        if file_size > max_video_bytes:
            raise HTTPException(
                400,
                f"Video file too large. Maximum size is {settings.MAX_VIDEO_UPLOAD_SIZE_MB}MB",
            )
        if file_size == 0:
            raise HTTPException(400, "Video file is empty")
        
        # Note: In production, you would validate aspect ratio (9:16 for vertical/stories)
        # This requires video processing which would be done after upload
    
    # Validate photo format
    if media_type == "photo":
        valid_image_exts = ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp')
        if (file_ext and file_ext not in valid_image_exts) and not content_type.startswith("image/"):
            raise HTTPException(400, "Invalid photo format. Supported: JPG, JPEG, PNG, GIF, WebP, BMP")
    
    # Resolve category slug to category_id if provided
    resolved_category_id = category_id
    if not resolved_category_id and category:
        from ..models import Category
        category_obj_lookup = db.query(Category).filter(Category.slug == category).first()
        if category_obj_lookup:
            resolved_category_id = category_obj_lookup.id
    if is_category_upload and category_obj:
        resolved_category_id = category_obj.id
    
    # Generate filename: use category slug for category uploads, human-readable format for others
    if is_category_upload and category_slug:
        # Format: "{type}-{category-slug}.jpeg"
        # Examples: "master-security.jpeg", "rental-concrete.jpeg", "product-power-tools.jpeg"
        unique_filename = f"{category_slug}.jpeg"
    else:
        # Generate human-readable filename with user_id and timestamp
        # Format: {user_id}_{YYYYMMDD}_{HHMMSS}_{microseconds}.{ext}
        now = datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        microseconds = f"{now.microsecond:06d}"
        unique_filename = f"{user.id}_{timestamp}_{microseconds}.{file_ext}" if file_ext else f"{user.id}_{timestamp}_{microseconds}"
    
    # Get upload folder and subfolder structure
    upload_folder = get_upload_folder()
    subfolder = get_media_subfolder(media_type, entity_type=entity_type)
    
    # Create full directory path: uploads/photos/2024/03/ or uploads/categories/
    full_dir_path = os.path.join(upload_folder, subfolder)
    try:
        os.makedirs(full_dir_path, exist_ok=True)
    except OSError as e:
        logger.error("Cannot create upload directory %s: %s", full_dir_path, e)
        raise HTTPException(500, f"Failed to create upload directory: {e}")
    
    # Save file to disk in the organized subfolder
    file_path = os.path.join(full_dir_path, unique_filename)
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(500, f"Failed to save file: {str(e)}")
    
    # Generate URL for the saved file using structured format
    file_url = build_media_url(
        subfolder,
        unique_filename,
        use_cdn=not is_category_upload,
    )
    
    # If this is a category image upload, update the category's image_url in the database
    if is_category_upload and category_slug:
        from ..models import Category
        cat = db.query(Category).filter(Category.slug == category_slug).first()
        if cat:
            # Delete old image file if it exists
            if cat.image_url:
                old_image_url = cat.image_url
                old_file_path = media_url_to_upload_relative_path(old_image_url)

                # Delete old file from filesystem
                if old_file_path:
                    old_full_path = os.path.join(upload_folder, old_file_path.replace("/", os.sep))
                    if os.path.exists(old_full_path) and old_full_path != file_path:
                        try:
                            os.remove(old_full_path)
                            logger.info(f"Deleted old category image file: {old_full_path}")
                        except OSError as e:
                            logger.warning(f"Failed to delete old category image file {old_full_path}: {e}")
                
                # Delete old Media records
                old_media_records = db.query(Media).filter(Media.url == old_image_url).all()
                for old_media in old_media_records:
                    db.delete(old_media)
                    logger.info(f"Deleted old media record: {old_media.id}")
                if old_media_records:
                    db.commit()
            
            # Update category with new image URL
            cat.image_url = file_url
            db.commit()
            db.refresh(cat)
            logger.info(f"Updated category {cat.id} ({category_slug}) image_url to {file_url}")
        else:
            # Category doesn't exist yet (will be created later), but we still save the file
            logger.info(f"Category {category_slug} not found yet, image saved for later use")
    
    # Generate thumbnail for videos
    thumbnail_url = file_url  # Default: use video URL as fallback
    if media_type == "video":
        try:
            # Generate human-readable thumbnail filename with user_id and timestamp
            # Use slightly different timestamp to ensure uniqueness
            thumbnail_now = datetime.now()
            thumbnail_timestamp = thumbnail_now.strftime("%Y%m%d_%H%M%S")
            thumbnail_microseconds = f"{thumbnail_now.microsecond:06d}"
            thumbnail_filename = f"{user.id}_{thumbnail_timestamp}_{thumbnail_microseconds}.jpg"
            thumbnail_path = os.path.join(full_dir_path, thumbnail_filename)
            
            # Generate thumbnail from video
            if generate_video_thumbnail(file_path, thumbnail_path):
                # Generate URL for thumbnail
                thumbnail_subfolder = get_media_subfolder(media_type, date=thumbnail_now, entity_type=entity_type)
                thumbnail_url = build_media_url(thumbnail_subfolder, thumbnail_filename)
                logger.info(f"Generated video thumbnail: {thumbnail_url}")
            else:
                logger.warning(f"Failed to generate thumbnail for video {file_path}, using video URL as fallback")
        except Exception as e:
            logger.error(f"Error generating video thumbnail: {str(e)}, using video URL as fallback")
            # Continue with video URL as thumbnail fallback
    
    m = Media(
        owner_id=user.id,
        profile_id=None if is_category_upload else final_profile_id,
        product_id=product_id,
        rental_id=rental_id,
        url=file_url,
        thumbnail_url=thumbnail_url,
        media_type=media_type,
        status=MediaStatus.approved,  # All media is automatically approved
        title=title,
        description=description,
        before_url=before_url,
        after_url=after_url,
        is_before_after=is_before_after,
        category_id=resolved_category_id,
        sort_order=sort_order,
        order_id=order_id
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m

@router.post("/upload/batch", response_model=List[MediaOut])
async def upload_media_batch(
    files: List[UploadFile] = File(...),
    media_type: str = Form("photo"),
    product_id: Optional[int] = Form(None),
    rental_id: Optional[int] = Form(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload multiple media files for products or rentals (sellers only)
    
    Supports batch upload of multiple images/videos for products or rentals.
    Files are automatically approved and ordered by upload sequence.
    """
    if media_type not in ("photo", "video"):
        raise HTTPException(400, "Invalid media_type. Must be 'photo' or 'video'")
    
    # Only sellers can upload product/rental media
    if user.role != Role.seller:
        raise HTTPException(403, "Only sellers can upload product or rental media")
    
    # Validate that only one of product_id or rental_id is provided
    if not product_id and not rental_id:
        raise HTTPException(400, "Either product_id or rental_id must be provided")
    if product_id and rental_id:
        raise HTTPException(400, "Only one of product_id or rental_id can be provided")
    
    # Verify product exists and belongs to user
    if product_id:
        from ..models import Product
        product = db.get(Product, product_id)
        if not product or product.seller_id != user.id:
            raise HTTPException(400, "Product not found or access denied")
    
    # Verify rental exists and belongs to user
    if rental_id:
        from ..models import Rental
        rental = db.get(Rental, rental_id)
        if not rental or rental.seller_id != user.id:
            raise HTTPException(400, "Rental not found or access denied")
    
    # Validate file count (max 20 files per batch)
    if len(files) > 20:
        raise HTTPException(400, "Maximum 20 files allowed per batch upload")
    
    entity_type = "product" if product_id else "rental"
    upload_folder = get_upload_folder()
    subfolder = get_media_subfolder(media_type, entity_type=entity_type)
    full_dir_path = os.path.join(upload_folder, subfolder)
    os.makedirs(full_dir_path, exist_ok=True)
    
    uploaded_media = []
    
    for idx, file in enumerate(files):
        try:
            # Get file extension
            file_ext = ""
            if file.filename:
                file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
            
            # Validate file format
            if media_type == "video":
                if not _is_allowed_video_upload(getattr(file, "content_type", None) or "", file_ext):
                    continue  # Skip invalid files
                file_ext = _resolve_video_extension(getattr(file, "content_type", None) or "", file_ext)
            else:
                if file_ext not in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'):
                    continue  # Skip invalid files
            
            # Generate human-readable filename with user_id and timestamp
            # Generate timestamp for each file to ensure uniqueness in bulk uploads
            now = datetime.now()
            timestamp = now.strftime("%Y%m%d_%H%M%S")
            microseconds = f"{now.microsecond:06d}"
            # Add index to ensure uniqueness even if timestamps are identical
            unique_filename = f"{user.id}_{timestamp}_{microseconds}_{idx}.{file_ext}" if file_ext else f"{user.id}_{timestamp}_{microseconds}_{idx}"
            
            content = await file.read()
            if media_type == "video" and len(content) > _max_video_bytes():
                logger.warning("Skipping oversized video in batch: %s", file.filename)
                continue
            if len(content) == 0:
                continue

            # Save file to disk
            file_path = os.path.join(full_dir_path, unique_filename)
            with open(file_path, "wb") as f:
                f.write(content)
            
            # Generate URL
            file_url = build_media_url(subfolder, unique_filename)
            
            # Generate thumbnail for videos
            thumbnail_url = file_url
            if media_type == "video":
                try:
                    # Generate human-readable thumbnail filename with user_id and timestamp
                    # Use slightly different timestamp to ensure uniqueness
                    thumbnail_now = datetime.now()
                    thumbnail_timestamp = thumbnail_now.strftime("%Y%m%d_%H%M%S")
                    thumbnail_microseconds = f"{thumbnail_now.microsecond:06d}"
                    thumbnail_filename = f"{user.id}_{thumbnail_timestamp}_{thumbnail_microseconds}.jpg"
                    thumbnail_path = os.path.join(full_dir_path, thumbnail_filename)
                    if generate_video_thumbnail(file_path, thumbnail_path):
                        thumbnail_subfolder = get_media_subfolder(media_type, date=thumbnail_now, entity_type=entity_type)
                        thumbnail_url = build_media_url(thumbnail_subfolder, thumbnail_filename)
                except Exception as e:
                    logger.error(f"Error generating thumbnail: {str(e)}")
            
            # Create media record
            m = Media(
                owner_id=user.id,
                product_id=product_id,
                rental_id=rental_id,
                url=file_url,
                thumbnail_url=thumbnail_url,
                media_type=media_type,
                status=MediaStatus.approved,  # Auto-approve product/rental media
                sort_order=idx,
                created_at=datetime.now()
            )
            db.add(m)
            uploaded_media.append(m)
        except Exception as e:
            logger.error(f"Error uploading file {file.filename}: {str(e)}")
            continue
    
    db.commit()
    
    # Refresh all uploaded media
    for m in uploaded_media:
        db.refresh(m)
    
    return [MediaOut.model_validate(m) for m in uploaded_media]

@router.get("", response_model=dict)
async def list_media(
    status: Optional[MediaStatus] = None,
    profile_id: Optional[int] = None,
    product_id: Optional[int] = None,
    rental_id: Optional[int] = None,
    user_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List media with pagination"""
    query = db.query(Media)
    
    if status:
        query = query.filter(Media.status == status)
    if profile_id:
        query = query.filter(Media.profile_id == profile_id)
    if product_id:
        query = query.filter(Media.product_id == product_id)
    if rental_id:
        query = query.filter(Media.rental_id == rental_id)
    if user_id:
        query = query.filter(Media.owner_id == user_id)
    
    query = query.order_by(Media.sort_order.asc(), Media.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Convert SQLAlchemy models to Pydantic models
    media_out_items = [MediaOut.model_validate(item) for item in items]
    
    return create_paginated_response(media_out_items, total, page, page_size)

@router.get("/me", response_model=dict)
async def my_media(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """Get current user's media"""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        return create_paginated_response([], 0, page, page_size)
    
    query = db.query(Media).filter(Media.profile_id == profile.id)
    query = query.order_by(Media.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Convert SQLAlchemy models to Pydantic models
    media_out_items = [MediaOut.model_validate(item) for item in items]
    
    return create_paginated_response(media_out_items, total, page, page_size)


def _delete_media_files(*urls: Optional[str]) -> None:
    upload_folder = get_upload_folder()
    seen: set[str] = set()
    for url in urls:
        if not url or url in seen:
            continue
        seen.add(url)
        relative_path = media_url_to_upload_relative_path(url)
        if not relative_path:
            continue
        full_path = os.path.join(upload_folder, relative_path.replace("/", os.sep))
        if os.path.isfile(full_path):
            try:
                os.remove(full_path)
                logger.info("Deleted media file: %s", full_path)
            except OSError as exc:
                logger.warning("Failed to delete media file %s: %s", full_path, exc)


def _user_can_delete_media(db: Session, media: Media, user: User) -> bool:
    if media.owner_id == user.id:
        return True
    if media.profile_id:
        profile = db.get(Profile, media.profile_id)
        if profile and profile.user_id == user.id:
            return True
    if media.product_id:
        from ..models import Product
        product = db.get(Product, media.product_id)
        if product and product.seller_id == user.id:
            return True
    if media.rental_id:
        from ..models import Rental
        rental = db.get(Rental, media.rental_id)
        if rental and rental.seller_id == user.id:
            return True
    return False


@router.delete("/me/{media_id}", status_code=204)
def delete_my_media(
    media_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete current user's media item by id."""
    media = db.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    if not _user_can_delete_media(db, media, user):
        raise HTTPException(status_code=403, detail="Not allowed to delete this media")
    _delete_media_files(media.url, media.thumbnail_url, media.before_url, media.after_url)
    db.delete(media)
    db.commit()
    return None
