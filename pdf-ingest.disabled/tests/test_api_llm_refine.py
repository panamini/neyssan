import os
import sys
import importlib.util
import pytest
import json
import httpx

# Load app.py as a module via file path to avoid import path issues in containerized tests.
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_PATH = os.path.join(PROJECT_ROOT, "app.py")
spec = importlib.util.spec_from_file_location("app", APP_PATH)
app_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_mod)

API_BASE = os.environ.get("PDF_INGEST_TEST_URL", "http://127.0.0.1:8000")
client = httpx.Client(base_url=API_BASE, timeout=10.0)

def test_llm_refine_accepts_profile_payload():
    payload = {
        "profile": {
            "name": "Bob Test",
            "email": "bob.test+llm@example.com",
            "summary": "Short summary for LLM refine test",
            "skills": ["Python", "FastAPI"],
            "experience": [{"company": "ExampleCo", "title": "Engineer", "startDate": "2020", "endDate": "2022", "description": "Work"}],
            "rawText": "Some raw text for Bob",
            "confidence": 0.9,
            "metadata": {"source": "test"}
        }
    }

    resp = client.post("/api/v1/llm-refine", json=payload)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    # Server should return a jobId and a profileId when provided with a full profile payload
    assert ("jobId" in data) and ("profileId" in data), f"Unexpected response shape: {data}"
    # profileId should look like a UUID string (basic check)
    assert isinstance(data["profileId"], str) and len(data["profileId"]) >= 8
