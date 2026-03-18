#!/usr/bin/env python3
"""
Backfill script: scan llm_history rows with convex_write_status IS NULL and call
the API endpoint POST /api/v1/convex-persist-retry { "placeholderId": "<uuid>" }

Usage:
  python pdf-ingest/scripts/backfill_convex_retry.py \
    --base-url http://localhost:8000 \
    --limit 100 \
    --sleep 0.5 \
    --dry-run

Notes:
- By default the script will connect to the local DB (using pdf-ingest/db.get_sync_session)
  to discover pending placeholders and will call the provided base-url endpoint to retry.
- If you only want to print candidates, use --dry-run.
- Be careful running against production; use rate-limiting (--sleep) and small --limit/batch sizes.
"""
from __future__ import annotations

import argparse
import logging
import time
from typing import List

import requests

from sqlalchemy import text

# Use the project's sync DB session helper (for worker processes)
try:
    from db import get_sync_session
except Exception:
    # If called from outside PYTHONPATH, try relative import fallback
    from pdf_ingest.db import get_sync_session  # type: ignore

logger = logging.getLogger("pdf-ingest.backfill_convex_retry")
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logger.addHandler(ch)


def get_pending_placeholders(limit: int = 100, offset: int = 0) -> List[str]:
    """
    Query the llm_history table synchronously and return a list of placeholder ids (UUID strings)
    where convex_write_status IS NULL and profile_id IS NOT NULL.

    Limit/offset are used for batching.
    """
    results: List[str] = []
    with get_sync_session() as session:
        try:
            q = text(
                "SELECT id::text FROM llm_history WHERE convex_write_status IS NULL AND profile_id IS NOT NULL ORDER BY run_time ASC LIMIT :limit OFFSET :offset"
            )
            rows = session.execute(q, {"limit": limit, "offset": offset}).fetchall()
            for r in rows:
                results.append(str(r[0]))
        except Exception:
            logger.exception("Failed to query pending placeholders")
    return results


def retry_placeholder_via_api(base_url: str, placeholder_id: str, timeout: int = 30) -> dict:
    """
    Call the convex-persist-retry endpoint for a placeholderId.
    Returns the parsed JSON response on HTTP 2xx, otherwise raises.
    """
    url = base_url.rstrip("/") + "/api/v1/convex-persist-retry"
    payload = {"placeholderId": placeholder_id}
    logger.info("Calling retry endpoint for placeholder %s -> %s", placeholder_id, url)
    resp = requests.post(url, json=payload, timeout=timeout)
    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}
    if 200 <= resp.status_code < 300:
        logger.info("Retry accepted for %s: status=%s", placeholder_id, resp.status_code)
        return body
    else:
        # raise an informative exception
        msg = f"Retry call failed for {placeholder_id}: status={resp.status_code} body={body}"
        logger.error(msg)
        resp.raise_for_status()


def run_backfill(base_url: str, batch_limit: int = 100, sleep_seconds: float = 0.5, dry_run: bool = False, max_batches: int = 100):
    """
    Main loop:
     - Fetch a batch of pending placeholders
     - For each placeholder call retry endpoint (or print if dry-run)
     - Sleep between calls to avoid rate-limits
     - Continue until no more placeholders or max_batches reached
    """
    offset = 0
    batch_no = 0
    total_processed = 0
    while batch_no < max_batches:
        placeholders = get_pending_placeholders(limit=batch_limit, offset=offset)
        if not placeholders:
            logger.info("No more pending placeholders (offset=%d). Exiting.", offset)
            break

        logger.info("Processing batch %d: %d placeholders (offset=%d)", batch_no + 1, len(placeholders), offset)
        for ph in placeholders:
            if dry_run:
                logger.info("[dry-run] Would retry placeholder %s", ph)
            else:
                try:
                    resp = retry_placeholder_via_api(base_url, ph)
                    logger.debug("Retry response for %s: %s", ph, resp)
                except Exception:
                    logger.exception("Retry failed for %s — moving on", ph)
            total_processed += 1
            time.sleep(sleep_seconds)
        # Move to next batch window
        offset += batch_limit
        batch_no += 1

    logger.info("Backfill complete. Total processed: %d", total_processed)


def parse_args():
    p = argparse.ArgumentParser(description="Backfill llm_history placeholders to call convex-persist-retry")
    p.add_argument("--base-url", "-b", required=False, default="http://localhost:8000", help="Base URL for pdf-ingest API (must be reachable)")
    p.add_argument("--batch-limit", "-n", type=int, default=50, help="Number of placeholders to fetch per batch")
    p.add_argument("--sleep", "-s", type=float, default=0.5, help="Seconds to sleep between API calls")
    p.add_argument("--dry-run", action="store_true", help="Do not call the API, only print candidates")
    p.add_argument("--max-batches", type=int, default=100, help="Maximum number of batches to process")
    p.add_argument("--log-level", default="INFO", help="Log level")
    return p.parse_args()


def main():
    args = parse_args()
    logger.setLevel(getattr(logging, args.log_level.upper(), logging.INFO))
    run_backfill(base_url=args.base_url, batch_limit=args.batch_limit, sleep_seconds=args.sleep, dry_run=args.dry_run, max_batches=args.max_batches)


if __name__ == "__main__":
    main()
