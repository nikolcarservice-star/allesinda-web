"""
Image optimization utilities for improving loading speed.
Supports compression, resizing, and format conversion.
"""
import os
import hashlib
import logging
import time
from pathlib import Path
from typing import Optional, Tuple
from io import BytesIO

logger = logging.getLogger(__name__)

try:
    from PIL import Image, ImageOps
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("PIL/Pillow not available. Image optimization will be disabled.")


def get_image_cache_path(original_path: str, width: Optional[int] = None, 
                        height: Optional[int] = None, quality: int = 85) -> str:
    """Generate a cache path for optimized/resized images."""
    cache_dir = os.path.join(os.path.dirname(original_path), ".cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    # Create a hash of the original path and parameters
    cache_key = f"{original_path}_{width}_{height}_{quality}"
    cache_hash = hashlib.md5(cache_key.encode()).hexdigest()
    
    # Get original extension
    ext = Path(original_path).suffix.lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
        ext = '.jpg'
    
    return os.path.join(cache_dir, f"{cache_hash}{ext}")


def optimize_image(
    image_path: str,
    max_width: Optional[int] = None,
    max_height: Optional[int] = None,
    quality: int = 85,
    format: str = "JPEG",
    use_cache: bool = True
) -> Optional[bytes]:
    """
    Optimize an image by resizing and compressing.
    
    Args:
        image_path: Path to the original image
        max_width: Maximum width (maintains aspect ratio)
        max_height: Maximum height (maintains aspect ratio)
        quality: JPEG quality (1-100, default 85)
        format: Output format (JPEG, WEBP, PNG)
        use_cache: Whether to use cached optimized images
    
    Returns:
        Optimized image bytes or None if optimization fails
    """
    if not PIL_AVAILABLE:
        return None
    
    if not os.path.exists(image_path):
        return None
    
    try:
        # Check cache first
        if use_cache:
            cache_path = get_image_cache_path(image_path, max_width, max_height, quality)
            if os.path.exists(cache_path):
                with open(cache_path, 'rb') as f:
                    return f.read()
        
        # Open and optimize image
        with Image.open(image_path) as img:
            # Auto-rotate based on EXIF data
            img = ImageOps.exif_transpose(img)
            
            # Convert RGBA to RGB for JPEG
            if format == "JPEG" and img.mode in ('RGBA', 'LA', 'P'):
                # Create white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            
            # Resize if needed
            original_width, original_height = img.size
            if max_width or max_height:
                # Calculate new dimensions maintaining aspect ratio
                if max_width and max_height:
                    # Fit within both constraints
                    ratio = min(max_width / original_width, max_height / original_height)
                elif max_width:
                    ratio = max_width / original_width
                elif max_height:
                    ratio = max_height / original_height
                else:
                    ratio = 1.0
                
                if ratio < 1.0:  # Only downscale, never upscale
                    new_width = int(original_width * ratio)
                    new_height = int(original_height * ratio)
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Save to bytes
            output = BytesIO()
            
            # Choose format based on quality and original format
            save_format = format
            if format == "JPEG":
                img.save(output, format='JPEG', quality=quality, optimize=True, progressive=True)
            elif format == "WEBP":
                img.save(output, format='WEBP', quality=quality, method=6)
            else:
                img.save(output, format=format, optimize=True)
            
            output.seek(0)
            optimized_bytes = output.read()
            
            # Save to cache
            if use_cache:
                try:
                    cache_path = get_image_cache_path(image_path, max_width, max_height, quality)
                    with open(cache_path, 'wb') as f:
                        f.write(optimized_bytes)
                except Exception as e:
                    logger.warning(f"Failed to cache optimized image: {e}")
            
            return optimized_bytes
            
    except Exception as e:
        logger.error(f"Error optimizing image {image_path}: {e}")
        return None


def get_image_info(image_path: str) -> Optional[Tuple[int, int, str]]:
    """
    Get image dimensions and format.
    
    Returns:
        Tuple of (width, height, format) or None if unavailable
    """
    if not PIL_AVAILABLE or not os.path.exists(image_path):
        return None
    
    try:
        with Image.open(image_path) as img:
            return (img.width, img.height, img.format or 'UNKNOWN')
    except Exception as e:
        logger.error(f"Error getting image info for {image_path}: {e}")
        return None


def should_optimize_image(image_path: str, max_size_kb: int = 500) -> bool:
    """
    Determine if an image should be optimized based on file size.
    
    Args:
        image_path: Path to the image
        max_size_kb: Maximum size in KB before optimization is recommended
    
    Returns:
        True if image should be optimized
    """
    if not os.path.exists(image_path):
        return False
    
    file_size_kb = os.path.getsize(image_path) / 1024
    return file_size_kb > max_size_kb


def cleanup_image_cache(upload_folder: str, max_age_days: int = 30, max_cache_size_mb: int = 5000) -> dict:
    """
    Clean up old and oversized image cache files to prevent disk space issues.
    
    Args:
        upload_folder: Root folder containing uploads and cache directories
        max_age_days: Delete cache files older than this many days (default 30)
        max_cache_size_mb: Maximum total cache size in MB before aggressive cleanup (default 5000MB = 5GB)
    
    Returns:
        Dictionary with cleanup statistics
    """
    stats = {
        "files_deleted": 0,
        "bytes_freed": 0,
        "errors": 0
    }
    
    try:
        current_time = time.time()
        max_age_seconds = max_age_days * 24 * 60 * 60
        max_cache_size_bytes = max_cache_size_mb * 1024 * 1024
        
        # Find all .cache directories
        cache_dirs = []
        for root, dirs, files in os.walk(upload_folder):
            if '.cache' in dirs:
                cache_dirs.append(os.path.join(root, '.cache'))
        
        total_cache_size = 0
        cache_files = []
        
        # Collect all cache files with their sizes and ages
        for cache_dir in cache_dirs:
            if not os.path.exists(cache_dir):
                continue
            try:
                for filename in os.listdir(cache_dir):
                    filepath = os.path.join(cache_dir, filename)
                    if os.path.isfile(filepath):
                        try:
                            stat = os.stat(filepath)
                            file_age = current_time - stat.st_mtime
                            file_size = stat.st_size
                            total_cache_size += file_size
                            cache_files.append({
                                "path": filepath,
                                "age": file_age,
                                "size": file_size,
                                "mtime": stat.st_mtime
                            })
                        except OSError as e:
                            logger.warning(f"Error accessing cache file {filepath}: {e}")
                            stats["errors"] += 1
            except OSError as e:
                logger.warning(f"Error accessing cache directory {cache_dir}: {e}")
                stats["errors"] += 1
        
        # Sort by age (oldest first) and size (largest first) for cleanup priority
        cache_files.sort(key=lambda x: (x["age"], -x["size"]))
        
        # Delete old files first
        for file_info in cache_files:
            if file_info["age"] > max_age_seconds:
                try:
                    file_size = file_info["size"]
                    os.remove(file_info["path"])
                    stats["files_deleted"] += 1
                    stats["bytes_freed"] += file_size
                    total_cache_size -= file_size
                except OSError as e:
                    logger.warning(f"Error deleting cache file {file_info['path']}: {e}")
                    stats["errors"] += 1
        
        # If cache is still too large, delete oldest files until under limit
        if total_cache_size > max_cache_size_bytes:
            remaining_files = [f for f in cache_files if os.path.exists(f["path"])]
            remaining_files.sort(key=lambda x: (x["age"], -x["size"]))
            
            for file_info in remaining_files:
                if total_cache_size <= max_cache_size_bytes:
                    break
                try:
                    if os.path.exists(file_info["path"]):
                        file_size = file_info["size"]
                        os.remove(file_info["path"])
                        stats["files_deleted"] += 1
                        stats["bytes_freed"] += file_size
                        total_cache_size -= file_size
                except OSError as e:
                    logger.warning(f"Error deleting cache file {file_info['path']}: {e}")
                    stats["errors"] += 1
        
        # Remove empty cache directories
        for cache_dir in cache_dirs:
            try:
                if os.path.exists(cache_dir) and not os.listdir(cache_dir):
                    os.rmdir(cache_dir)
            except OSError:
                pass  # Directory not empty or other error, ignore
        
        logger.info(f"Image cache cleanup completed: {stats['files_deleted']} files deleted, "
                   f"{stats['bytes_freed'] / (1024*1024):.2f} MB freed")
        
    except Exception as e:
        logger.error(f"Error during image cache cleanup: {e}", exc_info=True)
        stats["errors"] += 1
    
    return stats

