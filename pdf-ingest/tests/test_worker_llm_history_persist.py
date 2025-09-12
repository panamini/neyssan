import importlib.util
import json
import os
import uuid
from pathlib import Path

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
LLMHistory = models_mod.LLMHistory

spec_llm = importlib.util.spec_from_file_location("llm", LLM_PATH)
llm_mod = importlib.util.module_from_spec(spec_llm)
spec_llm.loader.exec_module(llm_mod)


def load_sample_profile():
    path = Path(PROJECT_ROOT) / "sample_profile.json"
    if not path.exists():
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


def test_llm_history_written_on_refine():
    sample = load_sample_profile()
    test_id = uuid.uuid4()
    with db_mod.get_sync_session() as session:
        p = Profile(
            id=test_id,
            name="Before",
            email="before2@example.com",
            summary="before",
            skills=["old"],
            experience=[{"company": "OldCo", "title": "Dev"}],
            raw_text="some raw text to be refined",
            confidence=0.2,
            meta={"test": True},
        )
        session.add(p)
        session.commit()

    # Monkeypatch worker to use a mock LLM response
    def mock_refine(raw_text, mock=True, examples=None, timeout=30):
        out = dict(sample)
        out["rawText"] = raw_text or out.get("rawText")
        return out

    worker.refine_with_llm = mock_refine

    res = worker.llm_refine_profile(str(test_id))
    assert isinstance(res, dict)
    assert res.get("status") == "ok"

    # Verify an LLMHistory row exists for this profile
    with db_mod.get_sync_session() as session:
        rows = session.query(LLMHistory).filter(LLMHistory.profile_id == test_id).all()
        assert len(rows) >= 1
        hist = rows[0]
        assert hist.full_response is not None
        # full_response should contain a 'patch' key per our worker implementation
        assert isinstance(hist.full_response, dict)
        assert "patch" in hist.full_response or "parsed" in hist.full_response
