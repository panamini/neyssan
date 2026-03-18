#!/usr/bin/env python3
"""
Start an RQ worker programmatically.

We avoid calling the `rq` CLI directly because some versions of the CLI
have click option defaults that can raise errors when invoked in container
environments. This script connects to Redis and starts a Worker that
listens on the 'default' queue.

Place next to worker.py so it can import the same code if needed.
"""
import logging
import os
import time
from redis import Redis
from rq import Worker, Queue, Connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pdf-ingest.worker_entry")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

def main():
    logger.info("Connecting to Redis at %s", REDIS_URL)
    redis_conn = Redis.from_url(REDIS_URL)

    # Retry loop in case Redis isn't ready yet (compose startup race)
    retries = 30
    while retries > 0:
        try:
            redis_conn.ping()
            break
        except Exception as e:
            logger.warning("Redis not ready yet (%s). Retrying... (%d left)", e, retries)
            retries -= 1
            time.sleep(1)
    else:
        logger.error("Redis did not become ready, exiting.")
        return

    with Connection(redis_conn):
        q = Queue("default", connection=redis_conn)
        worker = Worker([q], connection=redis_conn)
        logger.info("Starting RQ worker (listening on queue: default)")
        # Call work() without kwargs to support various rq versions.
        worker.work()

if __name__ == "__main__":
    main()
