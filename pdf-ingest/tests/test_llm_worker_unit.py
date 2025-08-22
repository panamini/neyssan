import importlib.util
import os
import json
import uuid
from pathlib import Path

# Load modules by path so tests can run similar to existing tests
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKER_PATH = os.path.join(PROJECT_ROOT, "worker.py")
DB_PATH = os.path.join(PROJECT_ROOT, "db.py")
MODELS_PATH = os.path.join(PROJECT_ROOT, "models.py")
LLM_PATH = os.path.join(PROJECT_ROOT, "llm.py")

spec_worker = importlib.util.spec_from_file_location("worker", WORKER_PATH)
worker = importlib.util.module_from_spec(spec_worker)
spec_worker.loader.exec_module(worker)

spec_db = importlib.util.spec_from_file_location("db", DB_PATH)
db_mod = importlib.util.module_from_spec(spec_db)
spec_db.loader.exec_module(db_mod)

spec_models = importlib.util.spec_from_file_location("models", MODELS_PATH)
models_mod = importlib.util.module_from_spec(spec_models)
spec_models.loader.exec_module(models_mod)
Profile = models_mod.Profile

spec_llm = importlib.util.spec_from_file_location("llm", LLM_PATH)
llm_mod = importlib.util.module_from_spec(spec_llm)
spec_llm.loader.exec_module(llm_mod)

def load_sample_profile():
    path = Path(PROJECT_ROOT) / "sample_profile.json"
    if not path.exists():
        # fall back to llm._load_sample_profile if available
        try:
            return llm_mod._load_sample_profile()
        except Exception:
            return {
                "name": "Mock Name",
                "email": "mock@example.com",
                "summary": "Mock summary",
                "skills": ["Python", "FastAPI"],
                "experience": [],
                "education": [],
                "achievements": [],
                "rawText": "mock raw",
                "confidence": 0.95,
                "metadata": {"source": "llm_mock"},
            }
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def test_llm_refine_profile_updates_db_row():
    sample = load_sample_profile()
    # Create a test profile row synchronously using the sync session helper
    test_id = uuid.uuid4()
    # Keep the session open and inject it into the worker so updates are visible in the same transactional context.
    with db_mod.get_sync_session() as session:
        p = Profile(
            id=test_id,
            name="Before",
            email="before@example.com",
            summary="before",
            skills=["old"],
            experience=[{"company": "OldCo", "title": "Dev"}],
            raw_text="some raw text to be refined",
            confidence=0.2,
            meta={"test": True},
        )
        session.add(p)
        session.commit()

        # Monkeypatch worker to use a mock LLM response (ensure worker uses this patched function)
        def mock_refine(raw_text, mock=True, examples=None, timeout=30):
            # Return the sample JSON, but ensure rawText contains the provided raw_text
            out = dict(sample)
            out["rawText"] = raw_text or out.get("rawText")
            return out

        # Replace the refine function on the module used by worker
        worker.refine_with_llm = mock_refine

        # Run the worker task, injecting the same sync session so updates are visible to the test
        res = worker.llm_refine_profile(str(test_id), session=session)
        assert isinstance(res, dict)
        assert res.get("status") == "ok"
    
    # After the worker has committed, tests below will open a fresh session to verify persisted values.

from sqlalchemy import text

# Verify DB row updated using a fresh session + raw SQL check (prints for pytest -s)
with db_mod.get_sync_session() as session:
    # raw SQL read to confirm what is in DB (visible in pytest -s)
    row = session.execute(text("SELECT meta FROM profiles WHERE id = :id"), {"id": str(test_id)}).fetchone()
    print("RAW_SQL_META", row[0] if row else None)

    # Now load ORM object fresh and refresh to avoid cache problems
    got = session.get(Profile, test_id)
    try:
        session.refresh(got)
    except Exception:
        session.expire_all()
        got = session.get(Profile, test_id)

    print("ORM_META", got.meta)
    # skills should match sample profile's skills
    assert got.skills == sample.get("skills") or got.skills == mock_refine(got.raw_text)["skills"]
    # meta should contain llmRefined flag
    assert got.meta and got.meta.get("llmRefined") is True
    # confidence should be updated to sample confidence
    assert abs(float(got.confidence) - float(sample.get("confidence", 0.9))) < 1e-6
