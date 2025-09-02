Absolutely! Here's a polished, ready-to-go Markdown file with clickable code blocks and a Docker/Alembic cheatsheet for new team members:

````markdown
# PDF-Ingest: Alembic + Docker Guide

This guide explains how to manage **database migrations** in the PDF-Ingest project using Docker and Alembic. It includes ready-to-use commands and environment setups for both async and synchronous contexts.

---

## 1. Environment Files

### `.env` (for Web/Worker Async)

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/pdf_ingest
REDIS_URL=redis://redis:6379
````

### `.env.alembic` (for Alembic Sync)

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/pdf_ingest
```

> ⚠️ **Important**: Alembic migrations **must use the synchronous URL** (`postgresql://`). Using async (`postgresql+asyncpg://`) will cause `greenlet_spawn` errors.

---

## 2. Docker Compose Configuration

### `docker-compose.yml`

```yaml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.python311
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/pdf_ingest
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: pdf_ingest
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  worker:
    build:
      context: .
      dockerfile: Dockerfile.python311
    command: python worker_entry.py
    env_file:
      - .env
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/pdf_ingest
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

volumes:
  db_data: {}
```

### `docker-compose.override.yml` (Alembic Service)

```yaml
services:
  alembic:
    build:
      context: .
      dockerfile: Dockerfile.python311
    command: alembic
    env_file:
      - .env.alembic
    volumes:
      - .:/app
    depends_on:
      - db
```

> ✅ Using a volume ensures Alembic sees your migrations in `/app`.

---

## 3. Alembic Commands Cheat Sheet

Run these commands **inside your project root**:

| Task                                  | Command                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Stamp database to latest migration    | `bash docker-compose run --rm alembic stamp head `                           |
| Upgrade database to latest migration  | `bash docker-compose run --rm alembic upgrade head `                         |
| Show current migration                | `bash docker-compose run --rm alembic current `                              |
| Create new migration (auto-generated) | `bash docker-compose run --rm alembic revision --autogenerate -m "message" ` |
| Create new migration (manual)         | `bash docker-compose run --rm alembic revision -m "message" `                |

---

## 4. Common Errors & Fixes

### `greenlet_spawn has not been called`

* Cause: Alembic used asyncpg (`postgresql+asyncpg://`) URL.
* Fix: Use `.env.alembic` with synchronous `postgresql://` URL.

### Docker Compose Version Warning

```
WARN: the attribute `version` is obsolete
```

* Safe to ignore. You can remove the `version:` line to avoid confusion.

---

## 5. Recommended Workflow

1. Make sure `.env.alembic` exists with the correct DATABASE\_URL.
2. Build containers:

```bash
docker-compose build
```

3. Start DB (optional, if not already running):

```bash
docker-compose up -d db
```

4. Run Alembic migrations:

```bash
docker-compose run --rm alembic upgrade head
```

5. Start web and worker services:

```bash
docker-compose up -d web worker
```

6. Check migration status anytime:

```bash
docker-compose run --rm alembic current
```

---

## 6. Notes

* Always keep **Alembic migrations separate from async runtime** to avoid runtime errors.
* Use `docker-compose.override.yml` for local development-specific services like Alembic.
* Make sure the `web` and `worker` services always use `postgresql+asyncpg://` for async operations.

---

*This file is intended for new team members to get up and running quickly with Alembic migrations in Docker.*

```

---

I can also **add a visual workflow diagram showing web/worker/db/alembic interaction** for the README if you want, which makes it super clear for new devs.  

Do you want me to make that diagram too?
```
