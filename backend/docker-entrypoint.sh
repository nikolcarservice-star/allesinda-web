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

echo "Ensuring database schema is up to date..."
python -c "
from app.database import ensure_schema, database_schema_ready
ensure_schema()
ready, err = database_schema_ready()
if ready:
    print('Database schema OK')
else:
    print(f'WARNING: schema incomplete after repair: {err}')
    print('App will start; if login fails, run:')
    print('  ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;')
    print('  Or run backend/scripts/create_user_reports_table.sql on PostgreSQL')
" || echo "WARNING: schema ensure script failed, starting server anyway..."

echo "Ensuring category image files exist on disk..."
python -c "
from app.database import _ensure_category_media_on_startup
_ensure_category_media_on_startup()
" || echo "WARNING: category media ensure failed, starting server anyway..."
echo ""

echo "Starting FastAPI server..."
echo ""

# Start uvicorn
# Using single worker to avoid async database connection pool issues
# For production with multiple workers, consider using Gunicorn with Uvicorn workers
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info --no-access-log

