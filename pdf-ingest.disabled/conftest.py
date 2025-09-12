# Conftest to disable running pdf-ingest tests by default.
# Set ENABLE_PDF_INGEST_TESTS=1 (or "true") to enable them in CI/local runs.
#
# This is a fast safety switch so environments without the pdf-ingest
# runtime (DB or HTTP services) won't fail the overall test run.
import os
import pytest

if os.getenv("ENABLE_PDF_INGEST_TESTS", "").lower() not in ("1", "true", "yes"):
    pytest.skip("Skipping pdf-ingest tests (ENABLE_PDF_INGEST_TESTS not set)", allow_module_level=True)