import os as _os
import pytest as _pytest
# Hard-disable all pdf-ingest tests unless explicitly enabled.
# Set ENABLE_PDF_INGEST_TESTS=1 (or "true"/"yes") to run them.
if _os.getenv("ENABLE_PDF_INGEST_TESTS", "").lower() not in ("1", "true", "yes"):
    _pytest.skip("Skipping pdf-ingest tests (ENABLE_PDF_INGEST_TESTS not set)", allow_module_level=True)

import sys
import os

# Ensure the project root is on sys.path so test modules can import app via file path if needed.
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
