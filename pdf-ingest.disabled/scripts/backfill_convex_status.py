#!/usr/bin/env python3
"""
Backfill Convex status fields for llm_history.

This script ensures llm_history rows have convex_* fields set,
and optionally retries placeholders by calling the Convex API.

Usage examples:
---------------
# Dry-run to see what would be retried
docker-compose -f pdf-ingest/docker-compose.yml run --rm web \
  bash -lc "PYTHONPATH=/app python scripts/backfill_convex_status.py --dry-run --batch-limit 50 --log-level INFO"

# Run a live backfill against the running API
docker-compose -f pdf-ingest/docker-compose.yml run --rm web \
  bash -lc "PYTHONPATH=/app python scripts/backfill_convex_status.py --base-url http://web:8000 --batch-limit 10 --sleep 1.0 --log-level INFO"

When to run:
------------
- **Local dev**: If your DB is missing convex_* fields or you want to test retries.
- **CI**: As part of smoke tests (dry-run mode only).
- **Production**: Run once after deploying new convex_* schema changes,
  then optionally schedule as a periodic cron job if retry gaps are common.
"""

import argparse
import logging
import time
from typing import Any, Dict

import requests
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from db import get_sync_session  # fallback if available
# If project is installed as package, also works as:
# from pdf_ingest.db import get_sync_session

logger = logging.getLogger(__name__)


def retry_placeholder_via_api(base_url: str, placeholder: Dict[str, Any], timeout: float = 5.0) -> requests.Response:
    url = f"{base_url.rstrip('/')}/api/v1/convex-persist-retry"
    payload = {"id": str(placeholder["id"])}
    logger.info(f"Calling retry endpoint for placeholder {payload['id']} -> {url}")
    return requests.post(url, json=payload, timeout=timeout)


def run_backfill(
    dry_run: bool,
    batch_limit: int,
    sleep: float,
    base_url: str | None,
) -> None:
    with get_sync_session() as session:  # type: Session
        stmt = (
            select("*")
            .select_from(text("llm_history"))
            .where(text("convex_write_status IS NULL OR convex_write_status = 'failed'"))
            .limit(batch_limit)
        )
        rows = session.execute(stmt).fetchall()

        if not rows:
            logger.info("No rows found needing backfill.")
            return

        logger.info(f"Found {len(rows)} placeholders needing retry/backfill")

        for row in rows:
            placeholder = dict(row._mapping)
            if dry_run:
                logger.info(f"[DRY RUN] Would retry placeholder {placeholder['id']} (convex_idempotency_key={placeholder.get('convex_idempotency_key')})")
                continue

            if not base_url:
                logger.warning("Skipping retry: no base_url provided")
                continue

            try:
                resp = retry_placeholder_via_api(base_url, placeholder)
                if resp.ok:
                    logger.info(f"Retry succeeded for {placeholder['id']}")
                else:
                    logger.error(
                        f"Retry failed for {placeholder['id']} -> status {resp.status_code}: {resp.text}"
                    )
            except Exception as e:
                logger.exception(f"Retry failed for {placeholder['id']} — moving on")

            if sleep > 0:
                time.sleep(sleep)


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill Convex status fields in llm_history")
    parser.add_argument("--dry-run", action="store_true", help="List placeholders without retrying")
    parser.add_argument("--batch-limit", type=int, default=50, help="Number of rows to process per run")
    parser.add_argument("--sleep", type=float, default=0.0, help="Seconds to sleep between retries")
    parser.add_argument("--base-url", type=str, help="Base URL of API (required if not dry-run)")
    parser.add_argument("--log-level", type=str, default="INFO", help="Logging level")
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
    )

    run_backfill(
        dry_run=args.dry_run,
        batch_limit=args.batch_limit,
        sleep=args.sleep,
        base_url=args.base_url,
    )


if __name__ == "__main__":
    main()
