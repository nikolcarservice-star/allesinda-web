#!/bin/bash
set -e

echo "========================================"
echo " Allesinda Backend - Starting"
echo "========================================"
echo ""

# Create uploads directory if it doesn't exist
# Use Python to get the exact path that the application will use
UPLOAD_DIR=$(python -c "from app.utils.storage import get_upload_folder; print(get_upload_folder())" 2>/dev/null || echo "${UPLOAD_FOLDER:-uploads}")
if [ ! -d "$UPLOAD_DIR" ]; then
    echo "Creating uploads directory: $UPLOAD_DIR"
    mkdir -p "$UPLOAD_DIR"
    echo "Uploads directory created successfully"
    echo ""
fi
mkdir -p "$UPLOAD_DIR/categories"
# Coolify/docker volumes may be root-owned; ensure app user (uid 1000) can write uploads.
if [ "$(id -u)" = "0" ]; then
    chown -R 1000:1000 "$UPLOAD_DIR" 2>/dev/null || true
fi
chmod -R u+rwX "$UPLOAD_DIR" 2>/dev/null || true

# Copy img_backup to uploads if it exists (do not overwrite existing uploads)
if [ -d "img_backup" ] && [ "$(ls -A img_backup 2>/dev/null)" ]; then
    echo "Copying img_backup to uploads directory (existing files preserved)..."
    set +e
    cp -rn img_backup/* "$UPLOAD_DIR/" 2>/dev/null
    copy_result=$?
    set -e  # Re-enable exit on error
    if [ $copy_result -eq 0 ]; then
        echo "img_backup copied to uploads successfully"
    else
        echo "Warning: Some files from img_backup may not have been copied (exit code: $copy_result)"
    fi
    echo ""
else
    if [ -d "img_backup" ]; then
        echo "img_backup directory is empty, skipping copy"
    else
        echo "img_backup directory not found, skipping copy"
    fi
    echo ""
fi

# Run database seeding if SEED_DB_ON_START is enabled
if [ "${SEED_DB_ON_START}" = "true" ]; then
    echo "SEED_DB_ON_START is enabled - Running seed script..."
    python -m app.seed
    if [ $? -eq 0 ]; then
        echo "Database seeding completed successfully"
    else
        echo "WARNING: Database seeding failed, but continuing with server start..."
    fi
    echo ""
fi

echo "Starting FastAPI server..."
echo ""

APP_USER="appuser"
if [ "$(id -u)" = "0" ] && id "$APP_USER" >/dev/null 2>&1; then
    exec su -s /bin/bash "$APP_USER" -c "uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info --no-access-log"
fi

# Start uvicorn
# Using single worker to avoid async database connection pool issues
# For production with multiple workers, consider using Gunicorn with Uvicorn workers
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info --no-access-log

