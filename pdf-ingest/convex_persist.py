# convex_persist.py
from __future__ import annotations
import re
import json
import os
import uuid
import logging
import asyncio
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin
import random

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError, DBAPIError, SQLAlchemyError

from models import Profile, LLMHistory
from schemas import NormalizedProfile
import worker

logger = logging.getLogger("convex_persist")
logger.setLevel(logging.INFO)


class ConvexPersistError(Exception):
    pass


async def call_convex_action(action_path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Async HTTP call to Convex with exponential backoff and jitter."""
    convex_url = os.getenv("CONVEX_SITE_URL") or os.getenv("CONVEX_URL") or os.getenv("VITE_CONVEX_URL") or os.getenv("NEXT_PUBLIC_CONVEX_URL")
    service_token = os.getenv("CONVEX_SERVICE_TOKEN")
    timeout = float(os.getenv("CONVEX_TIMEOUT_MS", "10000")) / 1000
    attempts = int(os.getenv("CONVEX_RETRY_ATTEMPTS", "4"))
    base_delay = float(os.getenv("CONVEX_BACKOFF_BASE", "0.5"))

    if action_path.startswith("http://") or action_path.startswith("https://"):
        url = action_path
    elif convex_url:
        url = urljoin(convex_url.rstrip("/") + "/", action_path.lstrip("/"))
    else:
        raise ConvexPersistError("Convex base URL not configured")

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "pdf-ingest/1.0",
        "X-Request-ID": str(uuid.uuid4()),
    }
    if service_token:
        headers["Authorization"] = f"Bearer {service_token}"

    last_exc: Optional[Exception] = None
    async with httpx.AsyncClient() as client:
        for attempt in range(1, attempts + 1):
            try:
                resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
                if 200 <= resp.status_code < 300:
                    try:
                        return resp.json()
                    except Exception:
                        return {"raw_text": resp.text}
                elif 400 <= resp.status_code < 500 and resp.status_code != 429:
                    raise ConvexPersistError(f"Client error {resp.status_code}: {resp.text}")
                elif resp.status_code == 429 or resp.status_code >= 500:
                    last_exc = ConvexPersistError(f"Retryable status {resp.status_code}: {resp.text}")
                else:
                    raise ConvexPersistError(f"Unexpected status {resp.status_code}: {resp.text}")
            except httpx.RequestError as e:
                last_exc = e

            if attempt < attempts:
                sleep_time = base_delay * (2 ** (attempt - 1)) + random.uniform(0, 0.1)  # jitter
                logger.info("Retrying Convex call after %.2fs (attempt %d/%d)", sleep_time, attempt, attempts)
                await asyncio.sleep(sleep_time)

    raise ConvexPersistError(f"Failed to call Convex after {attempts} attempts: {last_exc}")
