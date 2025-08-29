Here’s a **ready-to-run Markdown + structured JSON-style handover**:

---

# PDF-Ingest Handover Script for AI

```json
{
  "project": "pdf-ingest",
  "stack": {
    "api": "FastAPI",
    "worker": "Python RQ",
    "database": "Postgres",
    "queue": "Redis",
    "containerization": "Docker Compose"
  },
  "smoke_tests": [
    {
      "name": "Confirm-save (sample profile)",
      "description": "Persist sample profile to DB",
      "command": "cd pdf-ingest && curl -s -X POST http://localhost:8000/api/v1/confirm-save -H 'Content-Type: application/json' -d @sample_profile.json",
      "expected": {
        "status": "200 OK",
        "json_fields": ["id", "created_at", "updated_at", "status"],
        "id_type": "UUID"
      }
    },
    {
      "name": "LLM refine (real profile UUID)",
      "description": "Enqueue LLM refine job for real profile",
      "command": "curl -s -X POST http://localhost:8000/api/v1/llm-refine -H 'Content-Type: application/json' -d '{\"profileId\":\"<REAL_UUID>\"}'",
      "expected": {
        "job_enqueued": true,
        "placeholderId": "UUID",
        "db_row_created": true
      }
    },
    {
      "name": "LLM refine (placeholder-invalid-uuid)",
      "description": "Enqueue LLM refine job for malformed placeholder",
      "command": "curl -s -X POST http://localhost:8000/api/v1/llm-refine -H 'Content-Type: application/json' -d '{\"profileId\":\"placeholder-invalid-uuid\"}'",
      "expected": {
        "job_enqueued": true,
        "placeholderId": null,
        "db_row_created": false
      }
    }
  ],
  "db_checks": [
    {
      "name": "Inspect recent llm_history rows",
      "command": "docker compose exec db psql -U postgres -d pdf_ingest -c \"SELECT id, profile_id, job_id, convex_write_status FROM llm_history ORDER BY run_time DESC LIMIT 10;\"",
      "expected": {
        "valid_uuid_rows": "only real profile UUIDs",
        "placeholder_rows": "none for invalid placeholder tokens"
      }
    }
  ],
  "log_checks": [
    {
      "name": "Tail web and worker logs",
      "command": "docker compose logs -f --tail=200 web worker",
      "expected": {
        "no_errors": ["ValueError: badly formed hexadecimal UUID string", "psycopg2.errors.InFailedSqlTransaction"],
        "observe_job_processing": true
      }
    }
  ],
  "code_changes": [
    {
      "file": "app.py",
      "change": "Added parse_profile_uuid_safe(profile_id) and guarded rawText persistence with rollback"
    },
    {
      "file": "worker.py",
      "change": "Mirrored UUID parser, skip DB placeholder creation if invalid, defensive candidate handling"
    }
  ],
  "next_steps": [
    {
      "task": "Tail live logs",
      "description": "Observe runtime processing, watch for warnings or errors"
    },
    {
      "task": "Re-run full test suite",
      "command": "cd pdf-ingest && docker compose exec web pytest -q",
      "description": "Ensure all tests pass after recent fixes"
    },
    {
      "task": "Deep inspection of specific llm_history rows",
      "command": "docker compose exec db psql -U postgres -d pdf_ingest -c \"SELECT * FROM llm_history WHERE id = '<placeholder-id>'\\G\""
    }
  ],
  "notes_for_next_AI": [
    "Verify docker services are running (docker compose ps)",
    "Execute smoke tests and confirm expected behavior",
    "Analyze raw DB outputs and logs; classify anomalies if present",
    "Monitor RQ jobs and Convex write status",
    "Use unclassified stdout/log data for further testing or suggestion generation"
  ]
}
```

---

✅ **How the next AI can use this**:

1. Follow the `smoke_tests` sequentially and compare outputs to `expected`.
2. Run `db_checks` and confirm that only valid UUIDs are present for real profiles.
3. Tail logs and observe for errors/warnings.
4. Optionally run full test suite inside `web` container.
5. Feed raw stdout, logs, and DB outputs into classification logic to generate insights or anomalies.

?