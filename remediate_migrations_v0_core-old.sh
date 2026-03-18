#!/bin/bash

# --- Configuration ---
COMPOSE_BASE="-f pdf-ingest/docker-compose.yml"
OVERRIDE_FILE="pdf-ingest/docker-compose.override.yml"
COMPOSE_OVERRIDE=""
[ -f "$OVERRIDE_FILE" ] && COMPOSE_OVERRIDE="-f $OVERRIDE_FILE"
COMPOSE_FILES="$COMPOSE_BASE $COMPOSE_OVERRIDE"

DB_SERVICE="db"
ALEMBIC_SERVICE="alembic"
DB_USER="postgres"
DB_NAME="pdf_ingest"

# --- Alembic revisions ---
REV_0001="0001_add_llm_history_and_profile_version"
REV_0002="0002_add_convex_fields_llm_history"

# --- Functions ---
run_psql() {
    local query="$1"
    shift
    docker-compose $COMPOSE_FILES exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME "$@" -c "$query"
}

run_alembic() {
    docker-compose $COMPOSE_FILES run --rm $ALEMBIC_SERVICE alembic "$@"
}

# --- Step 1: Wait for PostgreSQL readiness ---
echo "Waiting for DB to be ready..."
until docker-compose $COMPOSE_FILES exec -T $DB_SERVICE pg_isready -U $DB_USER -d $DB_NAME; do
    sleep 2
done
echo "DB is ready."

# --- Step 2: Get Alembic head dynamically ---
ALEMBIC_HEADS_OUTPUT=$(run_alembic heads)
REV_HEAD=$(echo "$ALEMBIC_HEADS_OUTPUT" | head -n 1 | sed 's/ (head)//' | sed 's/ //g')
if [ -z "$REV_HEAD" ]; then
    echo "Failed to detect Alembic head revision. Check if migration files are mounted in the container."
    exit 1
fi
echo "Alembic head revision: $REV_HEAD"

# --- Step 3: Inspect current DB state ---
echo "Inspecting current DB state..."
LLM_HISTORY_EXISTS=$(run_psql "\dt llm_history;" | grep -c "llm_history")
PROFILES_EXISTS=$(run_psql "\dt profiles;" | grep -c "profiles")

if [ $PROFILES_EXISTS -gt 0 ]; then
    VERSION_COLUMN_EXISTS=$(run_psql "\d profiles;" | grep -c "version")
else
    VERSION_COLUMN_EXISTS=0
fi

# Detect a specific column from 0002 (convex_write_status)
if [ $LLM_HISTORY_EXISTS -gt 0 ]; then
    CONVEX_COLUMN_EXISTS=$(run_psql "\d llm_history;" | grep -c "convex_write_status")
else
    CONVEX_COLUMN_EXISTS=0
fi

ALEMBIC_VERSION_EXISTS=$(run_psql "\dt alembic_version;" | grep -c "alembic_version")
if [ $ALEMBIC_VERSION_EXISTS -gt 0 ]; then
    CURRENT_VERSION=$(run_psql "SELECT version_num FROM alembic_version;" -t -A | xargs)
else
    CURRENT_VERSION="none"
fi

echo "Inspection results:"
echo "- llm_history exists: $LLM_HISTORY_EXISTS"
echo "- profiles exists: $PROFILES_EXISTS"
echo "- version column in profiles: $VERSION_COLUMN_EXISTS"
echo "- convex_write_status column exists: $CONVEX_COLUMN_EXISTS"
echo "- alembic_version exists: $ALEMBIC_VERSION_EXISTS"
echo "- Current Alembic version: $CURRENT_VERSION"

# --- Step 4: Ensure alembic_version table exists and can handle long IDs ---
if [ $ALEMBIC_VERSION_EXISTS -eq 0 ]; then
    echo "Creating alembic_version table with VARCHAR(255)."
    run_psql "CREATE TABLE alembic_version (version_num VARCHAR(255) NOT NULL PRIMARY KEY);"
else
    echo "Ensuring alembic_version.version_num is VARCHAR(255)."
    run_psql "ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255);"
fi

# --- Step 5: Remediation logic ---
if [ $LLM_HISTORY_EXISTS -eq 0 ] && [ $PROFILES_EXISTS -eq 0 ] && [ "$CURRENT_VERSION" = "none" ]; then
    echo "Fresh DB detected. Running full migrations to head."
    run_alembic upgrade head
else
    echo "Partial DB detected. Ensuring schema and running missing migrations."

    # Create missing llm_history table
    if [ $LLM_HISTORY_EXISTS -eq 0 ]; then
        echo "Creating missing llm_history table..."
        run_psql "
        CREATE TABLE llm_history (
            id UUID PRIMARY KEY,
            profile_id UUID NOT NULL,
            run_time TIMESTAMPTZ DEFAULT now() NOT NULL,
            provider TEXT,
            model TEXT,
            job_id TEXT,
            request_payload JSONB,
            response_snippet TEXT,
            full_response JSONB,
            confidence FLOAT,
            merged BOOLEAN DEFAULT false NOT NULL,
            merge_notes TEXT
        );
        CREATE INDEX ix_llm_history_profile_id ON llm_history (profile_id);
        CREATE INDEX ix_llm_history_job_id ON llm_history (job_id);
        "
    fi

    # Create missing profiles table or add version column
    if [ $PROFILES_EXISTS -eq 0 ]; then
        echo "Creating missing profiles table..."
        run_psql "
        CREATE TABLE profiles (
            id UUID PRIMARY KEY,
            name VARCHAR NOT NULL,
            version INTEGER DEFAULT 1 NOT NULL
        );
        "
    elif [ $VERSION_COLUMN_EXISTS -eq 0 ]; then
        echo "Adding missing version column to profiles..."
        run_psql "ALTER TABLE profiles ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;"
    fi

    # Run migration 0002 if convex_write_status column is missing
    if [ $CONVEX_COLUMN_EXISTS -eq 0 ]; then
        echo "Column 'convex_write_status' missing. Running migration $REV_0002..."
        run_alembic upgrade "$REV_0002"
        DETECTED_REV="$REV_0002"
    else
        DETECTED_REV="$REV_0002"
    fi

    # Stamp DB if current version is behind
    if [ "$CURRENT_VERSION" != "$DETECTED_REV" ]; then
        echo "Stamping revision $DETECTED_REV."
        run_alembic stamp "$DETECTED_REV"
    fi

    # Upgrade remaining migrations to head
    echo "Upgrading to head revision ($REV_HEAD)."
    run_alembic upgrade head
fi

# --- Step 6: Verification ---
echo "Verifying final DB state..."
run_psql "\d llm_history;"
run_psql "\d profiles;"
FINAL_VERSION=$(run_psql "SELECT version_num FROM alembic_version;" -t -A | xargs)

if [ "$FINAL_VERSION" = "$REV_HEAD" ]; then
    echo "Verification successful: At head revision $REV_HEAD."
else
    echo "Verification failed: Current version is $FINAL_VERSION, expected $REV_HEAD."
    exit 1
fi
