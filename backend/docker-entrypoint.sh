#!/bin/bash
set -e

PYTHON="/usr/local/bin/python3"
UVICORN="/usr/local/bin/uvicorn"

echo "========================================"
echo " Allesinda Backend - Starting"
echo "========================================"
echo ""

# Create uploads directory if it doesn't exist
set +e
UPLOAD_DIR=$("$PYTHON" -c "from app.utils.storage import get_upload_folder; print(get_upload_folder())" 2>/dev/null)
upload_resolve_status=$?
set -e
if [ "$upload_resolve_status" -ne 0 ] || [ -z "$UPLOAD_DIR" ]; then
    echo "Warning: could not resolve upload folder via app, using UPLOAD_FOLDER"
    UPLOAD_DIR="${UPLOAD_FOLDER:-uploads}"
fi
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
    set -e
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
    "$PYTHON" -m app.seed
    if [ $? -eq 0 ]; then
        echo "Database seeding completed successfully"
    else
        echo "WARNING: Database seeding failed, but continuing with server start..."
    fi
    echo ""
fi

echo "Verifying Python environment..."
if [ ! -x "$PYTHON" ]; then
    echo "ERROR: Python not found at $PYTHON"
    exit 1
fi
if [ ! -x "$UVICORN" ]; then
    echo "ERROR: uvicorn not found at $UVICORN (PATH=$PATH)"
    exit 1
fi

echo "Verifying app.main import..."
if ! "$PYTHON" -c "import app.main" 2>&1; then
    echo "ERROR: app.main failed to import (see traceback above)"
    exit 1
fi

echo "Starting FastAPI server..."
echo ""

UVICORN_CMD="cd /app && PATH=/usr/local/bin:/usr/bin:/bin exec $UVICORN app.main:app --host 0.0.0.0 --port 8000 --log-level info --no-access-log"

APP_USER="appuser"
if [ "$(id -u)" = "0" ] && id "$APP_USER" >/dev/null 2>&1; then
    exec su -s /bin/bash "$APP_USER" -c "$UVICORN_CMD"
fi

exec $UVICORN app.main:app --host 0.0.0.0 --port 8000 --log-level info --no-access-log
