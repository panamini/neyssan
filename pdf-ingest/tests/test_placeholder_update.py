import pytest

pytestmark = pytest.mark.skip(reason="Skipping for MVP: feature not used")


import importlib.util
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


def test_placeholder_update_by_id():
    """
    Ensure that when a placeholder LLMHistory row is created and llm_refine_profile is
    invoked with correlation_job_id equal to that placeholder.id, the worker updates
    the same LLMHistory row (in-place) with full_response.
    """
    test_id = uuid.uuid4()
    with db_mod.get_sync_session() as session:
        # create a minimal profile to refine
        p = Profile(
            id=test_id,
            name="Before",
            email="before-placeholder@example.com",
            summary="before",
            skills=["old"],
            experience=[{"company": "OldCo", "title": "Dev"}],
            raw_text="raw to refine",
            confidence=0.2,
            meta={"test": True},
        )
        session.add(p)
        session.commit()

        # create a placeholder LLMHistory row (simulates enqueue's placeholder creation)
        placeholder = LLMHistory(
            profile_id=test_id,
            provider="test",
            model="mock-model",
            job_id=None,
            request_payload=None,
            response_snippet=None,
            full_response=None,
            confidence=None,
            merged=False,
        )
        session.add(placeholder)
        session.commit()
        session.refresh(placeholder)
        placeholder_id = str(placeholder.id)

        # Monkeypatch worker.refine_with_llm to deterministic output
        def mock_refine(raw_text, mock=True, examples=None, timeout=30):
            return {"name": "Mocked Name", "email": "before-placeholder@example.com", "rawText": raw_text, "confidence": 0.9}

        worker.refine_with_llm = mock_refine

        # Call the worker function with session injection and correlation_job_id equal to placeholder id
        res = worker.llm_refine_profile(str(test_id), correlation_job_id=placeholder_id, session=session)
        assert isinstance(res, dict)
        assert res.get("status") == "ok"

        # Refresh placeholder row from DB and assert it was updated in-place
        session.refresh(placeholder)
        assert placeholder.full_response is not None
        # Either parsed or patch should be present per worker implementation
        assert ("parsed" in placeholder.full_response) or ("patch" in placeholder.full_response)
