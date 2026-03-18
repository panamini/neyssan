import importlib.util
import os
from pathlib import Path
import json

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKER_PATH = os.path.join(PROJECT_ROOT, "worker.py")

spec_worker = importlib.util.spec_from_file_location("worker", WORKER_PATH)
worker = importlib.util.module_from_spec(spec_worker)
spec_worker.loader.exec_module(worker)


def test_compute_minimal_patch_simple_changes():
    original = {
        "name": "Alice",
        "email": "alice@example.com",
        "summary": "Old summary",
        "skills": ["Python", "SQL"],
        "experience": [{"company": "OldCo", "title": "Dev"}],
        "rawText": "old raw",
        "confidence": 0.2,
    }

    candidate = {
        "name": "Alice B.",
        "email": "alice@example.com",
        "summary": "New summary from LLM",
        "skills": ["Python", "SQL", "FastAPI"],
        "experience": [{"company": "OldCo", "title": "Senior Dev"}],
        "rawText": "old raw",
        "confidence": 0.9,
    }

    patch = worker.compute_minimal_patch(original, candidate)
    assert isinstance(patch, dict)
    assert "ops" in patch
    ops = patch["ops"]
    # Expect changes for name, summary, skills, experience, confidence (5 ops)
    paths = sorted([op["path"] for op in ops])
    expected_paths = sorted(["/name", "/summary", "/skills", "/experience", "/confidence"])
    assert paths == expected_paths
    # Check one op value
    name_op = next(op for op in ops if op["path"] == "/name")
    assert name_op["op"] == "replace"
    assert name_op["value"] == "Alice B."
