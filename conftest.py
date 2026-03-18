# Root-level pytest hook to avoid pytest returning a non-zero code when
# the pdf-ingest tests are intentionally skipped/deselected.
#
# Behavior:
# - If ENABLE_PDF_INGEST_TESTS is not set (tests are skipped/deselected)
#   and pytest would otherwise exit with code 5 (no tests collected / all
#   deselected), normalize the exit code to 0 so CI / git hooks do not fail.
import os

def pytest_sessionfinish(session, exitstatus):
    try:
        enabled = os.getenv("ENABLE_PDF_INGEST_TESTS", "").lower() in ("1", "true", "yes")
        # Exit code 5 is used by pytest when no tests were collected / selected.
        if not enabled and exitstatus == 5:
            session.exitstatus = 0
    except Exception:
        # Fail-safe: don't raise from pytest hooks
        pass