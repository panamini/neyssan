import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator, Generator, ContextManager
from contextlib import contextmanager
import logging

# import models so Base is defined
from models import Base

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@db:5432/pdf_ingest"
)

# Async engine + session for FastAPI app
engine = create_async_engine(DATABASE_URL, echo=True, future=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """
    Create database tables (dev-time). Uses run_sync to call SQLAlchemy metadata.create_all.

    Additionally applies a small, safe dev-time migration to add the `version` column
    to `profiles` and create the `llm_history` table if they don't already exist.
    This keeps local Docker-based integration tests working when the DB was created
    before these schema additions.
    """
    async with engine.begin() as conn:
        # Create any missing tables defined in metadata
        await conn.run_sync(Base.metadata.create_all)

        # Run safe DDL to add new columns / tables for local dev (no-op if already present)
        def _ensure_migration(sync_conn):
            from sqlalchemy import text

            # Add version column to profiles if missing (default 1)
            try:
                sync_conn.execute(
                    text(
                        "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1"
                    )
                )
            except Exception:
                # Best-effort; ignore errors so create_all remains the primary init path
                pass

            # Create llm_history table if it doesn't exist (simple schema mirroring models.LLMHistory)
            try:
                sync_conn.execute(
                    text("""
                        CREATE TABLE IF NOT EXISTS llm_history (
                            id UUID PRIMARY KEY,
                            profile_id UUID NOT NULL,
                            run_time TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
                            provider TEXT,
                            model TEXT,
                            job_id TEXT,
                            request_payload JSONB,
                            response_snippet TEXT,
                            full_response JSONB,
                            confidence DOUBLE PRECISION,
                            merged BOOLEAN DEFAULT FALSE,
                            merge_notes TEXT
                        );
                        CREATE INDEX IF NOT EXISTS ix_llm_history_profile_id ON llm_history (profile_id);
                        CREATE INDEX IF NOT EXISTS ix_llm_history_job_id ON llm_history (job_id);
                        """)
                )
            except Exception:
                # Best-effort; ignore errors
                pass

        await conn.run_sync(_ensure_migration)


# --- Synchronous helpers for worker processes (RQ) ---
# RQ workers are synchronous; provide a small sync engine + sessionmaker that
# reuses the DATABASE_URL but converts the async driver scheme if necessary.
from sqlalchemy import create_engine as create_sync_engine
from sqlalchemy.orm import sessionmaker as sync_sessionmaker, Session as SyncSession

# Allow overriding the sync URL via env var if desired (recommended for production)
SYNC_DATABASE_URL = os.getenv("DATABASE_SYNC_URL", None)
if not SYNC_DATABASE_URL:
    # Convert async URL like "postgresql+asyncpg://..." -> "postgresql://..."
    if "+asyncpg" in DATABASE_URL:
        SYNC_DATABASE_URL = DATABASE_URL.replace("+asyncpg", "")
    else:
        SYNC_DATABASE_URL = DATABASE_URL

# Create sync engine and session factory
sync_engine = create_sync_engine(SYNC_DATABASE_URL, echo=False, future=True)
SyncSessionLocal = sync_sessionmaker(bind=sync_engine, autoflush=False, autocommit=False, future=True, expire_on_commit=False)

# Run a best-effort synchronous migration for local/dev tests so the sync path
# (used by worker and unit tests) has the required columns/tables.
def _ensure_sync_migration():
    from sqlalchemy import text
    try:
        with sync_engine.begin() as conn:
            # Add version column to profiles if missing
            try:
                conn.execute(
                    text(
                        "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1"
                    )
                )
            except Exception:
                pass
            # Create llm_history table if missing
            try:
                conn.execute(
                    text("""CREATE TABLE IF NOT EXISTS llm_history (
                            id UUID PRIMARY KEY,
                            profile_id UUID NOT NULL,
                            run_time TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
                            provider TEXT,
                            model TEXT,
                            job_id TEXT,
                            request_payload JSONB,
                            response_snippet TEXT,
                            full_response JSONB,
                            confidence DOUBLE PRECISION,
                            merged BOOLEAN DEFAULT FALSE,
                            merge_notes TEXT
                        ); CREATE INDEX IF NOT EXISTS ix_llm_history_profile_id ON llm_history (profile_id); CREATE INDEX IF NOT EXISTS ix_llm_history_job_id ON llm_history (job_id);
                        """)
                )
                # Best-effort: ensure the convex_* columns exist for local/dev environments
                # (These are added by Alembic migration 0002; this ensures tests/local runs don't fail if migration wasn't applied.)
                try:
                    conn.execute(text("ALTER TABLE IF EXISTS llm_history ADD COLUMN IF NOT EXISTS convex_write_status TEXT"))
                    conn.execute(text("ALTER TABLE IF EXISTS llm_history ADD COLUMN IF NOT EXISTS convex_error TEXT"))
                    conn.execute(text("ALTER TABLE IF EXISTS llm_history ADD COLUMN IF NOT EXISTS convex_written_at BIGINT"))
                except Exception:
                    # ignore failures (e.g., insufficient permissions or table not yet present)
                    pass
            except Exception:
                pass
    except Exception:
        # swallow any errors in best-effort migration
        pass

# Attempt to run sync migration now (best-effort; will be no-op if DB not reachable)
try:
    _ensure_sync_migration()
except Exception:
    pass


@contextmanager
def get_sync_session() -> Generator[SyncSession, None, None]:
    """
    Context manager that yields a synchronous SQLAlchemy Session for worker processes.
    Usage:
        with get_sync_session() as session:
            ... use session (session.add, session.commit, session.query, etc.)
    """
    session = SyncSessionLocal()
    try:
        yield session
    finally:
        session.close()
