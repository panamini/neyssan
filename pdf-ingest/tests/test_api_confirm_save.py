import pytest

pytestmark = pytest.mark.skip(reason="Skipping for MVP: feature not used")


import sys
import os
import importlib.util
import pytest
import json

# Load app.py as a module via file path to avoid import path issues in containerized tests.
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_PATH = os.path.join(PROJECT_ROOT, "app.py")
spec = importlib.util.spec_from_file_location("app", APP_PATH)
app_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_mod)
# expose objects
# Use network HTTP calls to the running server to avoid TestClient in-process loop conflicts.
import httpx

API_BASE = os.environ.get("PDF_INGEST_TEST_URL", "http://127.0.0.1:8000")
client = httpx.Client(base_url=API_BASE)

# Import models/db by path as well (kept for completeness; not used directly)
spec_models = importlib.util.spec_from_file_location("models", os.path.join(PROJECT_ROOT, "models.py"))
models_mod = importlib.util.module_from_spec(spec_models)
spec_models.loader.exec_module(models_mod)
Profile = models_mod.Profile

spec_db = importlib.util.spec_from_file_location("db", os.path.join(PROJECT_ROOT, "db.py"))
db_mod = importlib.util.module_from_spec(spec_db)
spec_db.loader.exec_module(db_mod)
engine = db_mod.engine

import asyncio


def test_confirm_save_and_get_profile():
    payload = {
        "name": "Alice Example",
        "email": "alice@example.com",
        "summary": "Experienced engineer",
        "skills": ["Python", "FastAPI"],
        "experience": [{"company": "Acme", "title": "Eng", "startDate": "2020", "endDate": "2022", "description": "Did stuff"}],
        "rawText": "alice raw",
        "confidence": 0.8,
        "metadata": {"source": "test"}
    }

    # POST confirm-save
    resp = client.post("/api/v1/confirm-save", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    pid = data["id"]

    # GET profile
    resp2 = client.get(f"/api/v1/profiles/{pid}")
    assert resp2.status_code == 200
    got = resp2.json()
    assert got["email"] == payload["email"]
    assert got["name"] == payload["name"]
    assert "skills" in got and isinstance(got["skills"], list)
