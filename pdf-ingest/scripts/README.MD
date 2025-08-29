# PDF Ingest

This project processes PDFs and manages LLM history, including retries for failed convex writes. This README covers setup, backfill operations, and verification.

---

## Prerequisites

- Docker & Docker Compose
- Python 3.11 (if running scripts outside Docker)
- `.env` files configured (e.g., `.env`, `.env.alembic`)

---

## Setup

1. Build and start containers:

```bash
docker-compose -f pdf-ingest/docker-compose.yml -f pdf-ingest/docker-compose.override.yml up -d
