# Multi-stage build for production
FROM mirror.gcr.io/library/python:3.11.9-slim AS builder

WORKDIR /app

# Install system dependencies (libGL etc. for opencv-python video thumbnail generation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into /usr/local (available to all users in runtime image)
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Production stage
FROM mirror.gcr.io/library/python:3.11.9-slim

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app && \
    chown -R appuser:appuser /app

WORKDIR /app

# Copy installed packages and console scripts from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Install system dependencies for runtime (libGL for opencv video thumbnails)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    bash \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy application code (excluding files in .dockerignore)
COPY --chown=appuser:appuser . .

# Copy and set up entrypoint script
COPY --chown=appuser:appuser docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Switch to root for entrypoint (fixes volume permissions), then drops to appuser for uvicorn
USER root

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Use entrypoint script to handle seeding and start server
ENTRYPOINT ["/bin/bash", "/app/docker-entrypoint.sh"]
