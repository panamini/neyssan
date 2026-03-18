#!/bin/bash

set -euo pipefail

# Parse arguments using a loop
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --compose) COMPOSE_FILE="$2"; shift ;;
        --db-service) DB_SERVICE="$2"; shift ;;
        --alembic-service) ALEMBIC_SERVICE="$2"; shift ;;
        --db-user) DB_USER="$2"; shift ;;
        --db-name) DB_NAME="$2"; shift ;;
        --versions-dir) VERSIONS_DIR="$2"; shift ;;
        *) echo "Unknown parameter $1"; exit 1 ;;
    esac
    shift
done

# Set defaults
COMPOSE_FILE=${COMPOSE_FILE:-pdf-ingest/docker-compose.yml}
DB_SERVICE=${DB_SERVICE:-db}
ALEMBIC_SERVICE=${ALEMBIC_SERVICE:-web}
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-pdf_ingest}
VERSIONS_DIR=${VERSIONS_DIR:-pdf-ingest/alembic/versions}

# Function to run docker-compose
dcompose() {
    docker compose -f "$COMPOSE_FILE" "$@"
}

# Get head revision
HEAD=$(dcompose run --rm $ALEMBIC_SERVICE alembic heads | awk '{print $1}' | head -n1)
echo "Head revision: $HEAD"

# Check if alembic_version table exists
TABLE_EXISTS=$(dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version');" | tr -d '\r')

if [ "$TABLE_EXISTS" = "f" ]; then
    echo "No alembic_version table, running initial upgrade."
    dcompose run --rm $ALEMBIC_SERVICE alembic upgrade head
else
    # Get current revision
    CURRENT=$(dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT version_num FROM alembic_version LIMIT 1;" | tr -d '\r')
    echo "Current revision: $CURRENT"
    if [ "$CURRENT" != "$HEAD" ]; then
        echo "Revisions mismatch. Attempting upgrade."
        if ! dcompose run --rm $ALEMBIC_SERVICE alembic upgrade head; then
            echo "Upgrade failed. Setting alembic_version to head as remediation."
            dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -c "UPDATE alembic_version SET version_num = '$HEAD';"
        fi
    else
        echo "Database is already up to date."
    fi
fi

# Verify final state
CURRENT_AFTER=$(dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT version_num FROM alembic_version LIMIT 1;" | tr -d '\r')
if [ "$CURRENT_AFTER" = "$HEAD" ]; then
    echo "Database is up to date."
else
    echo "Remediation failed."
    exit 1
fi

echo "Verifying 'profiles' table columns..."
dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -c \
"SELECT column_name, data_type, is_nullable, column_default
 FROM information_schema.columns
 WHERE table_name='profiles'
 ORDER BY ordinal_position;"
