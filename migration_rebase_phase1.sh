#!/bin/bash
set -e

echo "=== DATABASE MIGRATION REBASE - PHASE 1: Environment Reset ==="

# 1.1 Backup Existing Data (If Needed)
echo "Creating database backup..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
docker-compose -f pdf-ingest/docker-compose.yml exec -T db pg_dump -U postgres pdf_ingest > $BACKUP_FILE

# 1.2 Stop and Remove Docker Containers & Volumes
echo "Stopping and removing Docker containers and volumes..."
docker-compose -f pdf-ingest/docker-compose.yml down -v

# 1.3 Backup and Clear Migration History
echo "Backing up and clearing old migration history..."
mkdir -p alembic_backups
mv pdf-ingest/alembic/versions/* alembic_backups/ 2>/dev/null || echo "No existing migrations to backup"

# 1.4 Clean Python Cache Files
echo "Cleaning Python cache files..."
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "*.pyo" -delete 2>/dev/null || true

echo "Phase 1 complete! Environment has been reset."
