import pytest
import os as _os
# Allow disabling these worker tests in CI or local runs by setting SKIP_PDF_INGEST_TEST=1 (or "true")
if _os.getenv("SKIP_PDF_INGEST_TEST", "").lower() in ("1", "true", "yes"):
    pytest.skip("Skipping pdf-ingest worker unit tests (SKIP_PDF_INGEST_TEST set)", allow_module_level=True)

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

# Force-import the exact worker file to ensure pytest uses the edited module.
import sys
if "worker" in sys.modules:
    del sys.modules["worker"]
spec_worker = importlib.util.spec_from_file_location("worker", WORKER_PATH)
print("TEST_WORKER_PATH", WORKER_PATH)
worker = importlib.util.module_from_spec(spec_worker)
spec_worker.loader.exec_module(worker)
print("LOADED_WORKER_FILE", getattr(worker, "__file__", None))

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
                "meta": {"source": "llm_mock"},
            }
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def test_llm_refine_profile_updates_db_row():
    sample = load_sample_profile()
    test_id = uuid.uuid4()

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

        # Monkeypatch worker to use a mock LLM response that merges DB meta
        def mock_refine(raw_text, profile_id=None, session=None, **kwargs):
            """
            Mock LLM refinement that merges existing DB profile.meta and persists it to the DB.
            """
            out = dict(sample)
            out["rawText"] = raw_text or out.get("rawText")

            # Start with sample's meta
            merged_meta = dict(out.get("meta") or {})

            # If a session and profile_id are provided, pull existing DB meta and merge it.
            try:
                if profile_id and session:
                    import uuid as _uuid
                    pid = _uuid.UUID(profile_id)
                    existing_profile = session.get(Profile, pid)
                    if existing_profile and getattr(existing_profile, "meta", None):
                        # Start with existing DB keys to preserve them (e.g., {"test": True})
                        existing_meta = dict(existing_profile.meta)
                        # Merge sample meta over existing (sample keys take precedence)
                        existing_meta.update(merged_meta)
                        merged_meta = existing_meta
            except Exception:
                # Fall back to sample meta if anything goes wrong
                pass

            # Inject LLM flags
            merged_meta["llmRefined"] = True
            merged_meta["llmConfidence"] = float(out.get("confidence", 0.9))
            out["meta"] = merged_meta

            # Persist merged meta back to the DB so other sessions can see it immediately.
            try:
                if profile_id and session:
                    import uuid as _uuid
                    pid = _uuid.UUID(profile_id)
                    profile_row = session.get(Profile, pid)
                    if profile_row:
                        profile_row.meta = merged_meta
                        session.add(profile_row)
                        try:
                            session.commit()
                        except Exception:
                            try:
                                session.rollback()
                            except Exception:
                                pass
            except Exception:
                # Non-fatal: if persistence fails, the worker path will still be tested for logic
                pass

            return out

        # Ensure the worker's refine_with_llm will see the current session and profile id
        # Patch both the imported llm module and the worker binding to be safe across import styles.
        def simple_mock(raw_text, mock=True, examples=None, timeout=30, **kwargs):
            out = dict(sample)
            out["rawText"] = raw_text or out.get("rawText")
            out.setdefault("meta", {})
            out["meta"]["llmRefined"] = True
            out["meta"]["llmConfidence"] = float(out.get("confidence", 0.9))
            return out

        llm_mod.refine_with_llm = simple_mock
        worker.refine_with_llm = llm_mod.refine_with_llm

        res = worker.llm_refine_profile(str(test_id), session=session)
        assert isinstance(res, dict)
        assert res.get("status") == "ok"

        try:
            session.close()
            print("INJECTED_SESSION_CLOSED", flush=True)
        except Exception:
            pass

        from sqlalchemy import text as _text
        with db_mod.get_sync_session() as raw_session:
            row = raw_session.execute(
                _text("SELECT meta FROM profiles WHERE id = :id"),
                {"id": str(test_id)}
            ).fetchone()
            print("IMMEDIATE_RAW_SQL_META", row[0] if row else None)

    from sqlalchemy import text

    with db_mod.get_sync_session() as session:
        row = session.execute(
            text("SELECT meta FROM profiles WHERE id = :id"),
            {"id": str(test_id)}
        ).fetchone()
        print("RAW_SQL_META", row[0] if row else None)

        got = session.get(Profile, test_id)
        try:
            session.refresh(got)
        except Exception:
            session.expire_all()
            got = session.get(Profile, test_id)

        print("ORM_META", got.meta)
        assert got.skills == sample.get("skills") or got.skills == mock_refine(got.raw_text)["skills"]
        assert got.meta and got.meta.get("llmRefined") is True
        assert abs(float(got.confidence) - float(sample.get("confidence", 0.9))) < 1e-6
