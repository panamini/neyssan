Deprecation & Backfill Plan — Legacy Python Ingest Service (pdf-ingest)
=====================================================================

Goal
----
Safely retire the legacy Python ingestion service (pdf-ingest) while ensuring no data loss and providing a clear rollback path. Keep the ability to backfill historical data into the new Convex-based pipeline.

Summary
-------
- Keep the Python service available as "read-only / backfill" initially.
- Run parallel production traffic (client-side parser → Convex HTTP action) + optional Python ingestion for a short validation window.
- Backfill any historical or missed profiles from the Python service into Convex using a controlled backfill script.
- Once confidence is high, stop running the Python service and archive the code / docker image.

Preconditions (must be completed first)
---------------------------------------
- Convex codegen run and generated types present.
- Convex migrations applied successfully (llmJobs, llmHistory, raw_text rename).
- Client-side parser hooked to /api/ingestProfile and working end-to-end.
- A Convex HTTP ingest endpoint accessible with a service token for script/backfill auth.
- Backups/snapshots of Convex data or an export existing before bulk backfill.

Deprecation stages
------------------

1) Observe & Validate (2–7 days)
   - Mark Python service as "deprecated" in README & monitoring dashboards.
   - Route new UI uploads to client-side parser → Convex ingestion.
   - Keep Python service running but disable any scheduled/automatic ingestion triggers if possible.
   - Monitor:
     - Success/failure rates for client-side ingestion.
     - llmJobs queue growth and worker processing metrics.
     - Any parsing edge-cases where Python produces better results.

2) Backfill historical data (controlled)
   - Run the backfill script (see my-app/scripts/backfill_legacy_to_convex.ts).
   - Backfill in small batches (e.g., 100 profiles) and validate:
     - userProfiles created/updated,
     - llmJobs enqueued,
     - llmHistory written by worker after processing.
   - Check logs and sample profiles for correctness.

3) Cutover & Shutdown (after validation)
   - Stop Python ingestion workers / cron jobs.
   - Keep the repo archived and tag a release (e.g., pdf-ingest@archive/2025-08-28).
   - Keep one read-only instance for emergency backfills (optional).

4) Cleanup (after a waiting period, e.g., 30 days)
   - Remove service from CI/CD and infrastructure.
   - Delete Docker images (after archiving/tagging).
   - Remove or move python code to an archive folder or separate repo for historical purposes.

Rollback plan
-------------
- If backfill produced incorrect data, revert by:
  - Restoring Convex from backup (if available) or
  - Re-running a reversing migration (if you preserved original fields and wrote merge flags).
- Keep original python outputs and backfill logs so we can trace and fix mistakes.

Operational runbook for backfill (short)
---------------------------------------
1. Prepare: ensure CONVEX_URL and BACKFILL_SERVICE_TOKEN are available.
2. Run backfill in dry-run mode (script supports dry-run flag).
3. Inspect a sample (10-20) of uploaded profiles.
4. Run full backfill in batches, monitoring logs and queue depth.
5. Validate with worker output -> llmHistory.

Security
--------
- Use a short-lived or rotated service token for the backfill script / service-to-service requests.
- Store tokens in your secret store (not in git).
- Limit the token scope to only the required Convex HTTP actions.

Artifacts
---------
- Backfill script (my-app/scripts/backfill_legacy_to_convex.ts) — reads a JSONL file export from the Python service and POSTs to /api/ingestProfile using a SERVICE_TOKEN env var.
- Audit log: persist mapping of legacy id -> new Convex profile id and llmJob ids (script will write a local log file).

Checklist
---------
- [ ] Confirm Convex migrations completed
- [ ] Confirm client-side parsing end-to-end in staging
- [ ] Run a dry-run backfill on a small sample
- [ ] Perform full backfill in controlled batches
- [ ] Stop Python service ingestion triggers
- [ ] Archive Python repo / Docker images
- [ ] Cleanup infra and CI references

Notes
-----
- Keep the Python service around for backfills until you are confident in the quality of the new parser/path. Some PDF/LinkedIn edge cases may require refinement in the client parser — keep example failing files for tuning prompts and OCR thresholds.
