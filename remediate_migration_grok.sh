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

# Function to check if migration is needed
migration_needed() {
    # Check if alembic_version table exists
    TABLE_EXISTS=$(dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version');" | tr -d '\r')
    
    if [ "$TABLE_EXISTS" = "f" ]; then
        echo "No alembic_version table found, migration needed."
        return 0  # Migration needed (no table exists)
    fi
    
    # Get current and head revisions
    CURRENT=$(dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT version_num FROM alembic_version LIMIT 1;" | tr -d '\r')
    HEAD=$(dcompose run --rm $ALEMBIC_SERVICE alembic heads | awk '{print $1}' | head -n1)
    
    echo "Current revision: $CURRENT"
    echo "Head revision: $HEAD"
    
    if [ "$CURRENT" != "$HEAD" ]; then
        echo "Revisions mismatch, migration needed."
        return 0  # Migration needed
    else
        echo "Database is already up to date."
        return 1  # No migration needed
    fi
}

# Essential schema remediation for tables and columns referenced in migrations
echo "🔧 Performing essential schema remediation for migration dependencies..."
execute_sql() {
    local sql_command="$1"
    local description="$2"
    
    echo "   $description"
    dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -c "$sql_command" >/dev/null 2>&1 || true
    echo "   ✅ Done: $description"
}

# First, check if llm_history table exists
TABLE_EXISTS=$(dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'llm_history');" | tr -d '\r')

if [ "$TABLE_EXISTS" = "f" ]; then
    echo "   Creating llm_history table..."
    execute_sql "CREATE TABLE llm_history (
        id SERIAL PRIMARY KEY,
        convex_attempts INTEGER DEFAULT 0,
        convex_idempotency_key TEXT,
        convex_last_attempt_at BIGINT,
        convex_write_status TEXT,
        convex_error TEXT,
        convex_written_at BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );" "Creating llm_history table with essential columns"
else
    echo "   llm_history table exists, ensuring columns..."
    # Ensure convex_attempts column exists (referenced in migration d41cf677615d_add_new_column_xyz.py)
    execute_sql "ALTER TABLE llm_history ADD COLUMN IF NOT EXISTS convex_attempts INTEGER DEFAULT 0;" \
      "Ensuring llm_history.convex_attempts exists for migration dependencies"

    # Ensure other convex-related columns exist
    execute_sql "ALTER TABLE llm_history ADD COLUMN IF NOT EXISTS convex_idempotency_key TEXT;" \
      "Ensuring llm_history.convex_idempotency_key exists"
    execute_sql "ALTER TABLE llm_history ADD COLUMN IF NOT EXISTS convex_last_attempt_at BIGINT;" \
      "Ensuring llm_history.convex_last_attempt_at exists"
    execute_sql "ALTER TABLE llm_history ADD COLUMN IF NOT EXISTS convex_write_status TEXT;" \
      "Ensuring llm_history.convex_written_status exists"
    execute_sql "ALTER TABLE llm_history ADD COLUMN IF NOT EXISTS convex_error TEXT;" \
      "Ensuring llm_history.convex_error exists"
    execute_sql "ALTER TABLE llm_history ADD COLUMN IF NOT EXISTS convex_written_at BIGINT;" \
      "Ensuring llm_history.convex_written_at exists"
fi

echo "✅ Essential schema remediation complete."

# Main execution
echo "🔍 Checking if database migrations are needed..."
if migration_needed; then
    echo "📦 Database migrations required, applying..."
    if ! dcompose run --rm $ALEMBIC_SERVICE alembic upgrade head; then
        echo "❌ ERROR: Migration failed. Manual intervention required."
        echo "   Do not force-update alembic_version as this can cause schema inconsistencies."
        echo "   Please check the migration errors and resolve them manually."
        exit 1
    fi
    echo "✅ Migrations applied successfully."
else
    echo "✅ Database is already up to date."
fi

# Final verification
echo "🔍 Verifying final database state..."
CURRENT_AFTER=$(dcompose exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT version_num FROM alembic_version LIMIT 1;" | tr -d '\r')
HEAD=$(dcompose run --rm $ALEMBIC_SERVICE alembic heads | awk '{print $1}' | head -n1)

if [ "$CURRENT_AFTER" = "$HEAD" ]; then
    echo "✅ Database schema verified and up to date."
else
    echo "❌ ERROR: Database schema verification failed."
    echo "   Current revision: $CURRENT_AFTER"
    echo "   Expected revision: $HEAD"
    exit 1
fi

echo "🎉 Database migration process completed successfully!"
