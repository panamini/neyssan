from __future__ import with_statement
import os
import sys
from logging.config import fileConfig
import asyncio
import logging
from typing import Any

from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine.base import Connection
from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Add project directory to path so models can be imported when running inside container
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import your model's MetaData object here for 'autogenerate' support
try:
    from models import Base  # noqa: E402
    target_metadata = Base.metadata
except ImportError as e:
    # Hard failure for missing models - critical error
    raise ImportError(
        "Failed to import models module. This is a critical error that must be fixed. "
        "Please ensure the models.py file exists and is accessible. "
        f"Original error: {e}"
    ) from e

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url if DATABASE_URL env var is present
db_url = os.getenv("DATABASE_URL")
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)
else:
    # Fallback to ini file configuration
    db_url = config.get_main_option("sqlalchemy.url")

# Set up logger
logger = logging.getLogger('alembic.env')

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        # Use NullPool for offline mode as well for consistency
        poolclass=pool.NullPool,
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    """Actual migration runner that works with both sync and async connections."""
    context.configure(
        connection=connection, 
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    """Run migrations with async engine."""
    connectable = create_async_engine(
        config.get_main_option("sqlalchemy.url"),
        poolclass=pool.NullPool,
        echo=True if os.getenv('ALEMBIC_ECHO') == '1' else False,
    )

    async with connectable.connect() as connection:
        logger.info("Running async migrations")
        await connection.run_sync(do_run_migrations)
    
    await connectable.dispose()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    try:
        # Try running asynchronously first
        asyncio.run(run_async_migrations())
    except Exception as e:
        logger.error(f"Async migration failed: {e}")
        
        # Fallback to sync engine for compatibility
        connectable = engine_from_config(
            config.get_section(config.config_ini_section),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )

        with connectable.connect() as connection:
            logger.info("Running sync migrations (fallback)")
            do_run_migrations(connection)

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()