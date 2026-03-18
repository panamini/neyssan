import pytest

pytestmark = pytest.mark.skip(reason="Skipping for MVP: feature not used")


import time
from unittest.mock import patch

from db import get_sync_session
from models import Profile, LLMHistory
from worker import llm_refine_profile

def create_profile(session, name="Test"):
    p = Profile(name=name, email="test@example.com", summary="x", confidence=0.1)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p

def test_worker_marks_pending_then_success(monkeypatch):
    # Setup DB profile and placeholder
    with get_sync_session() as s:
        p = create_profile(s, "MarkPending")
        # create placeholder
        hist = LLMHistory(profile_id=p.id, full_response=None, merged=False)
        s.add(hist)
        s.commit()
        s.refresh(hist)
        placeholder_id = str(hist.id)

    # Mock refine_with_llm to return a simple parsed dict and mock call_convex_action success
    def fake_refine(raw_text, mock=True):
        return {"parsed": {"summary": "refined"}}

    def fake_call_convex_action(path, payload):
        # Simulate Convex returning a JSON object
        return {"written": True}

    # Patch names in the worker module
    monkeypatch.setattr("worker.refine_with_llm", fake_refine)
    monkeypatch.setattr("worker.call_convex_action", fake_call_convex_action)

    # Run worker for the profile (synchronous path using correlation_job_id)
    res = llm_refine_profile(str(p.id), correlation_job_id=placeholder_id)

    # Verify LLMHistory updated to success and idempotency key set
    with get_sync_session() as s2:
        from uuid import UUID
        hid = UUID(placeholder_id)
        row = s2.get(LLMHistory, hid)
        assert row is not None, "LLMHistory row should exist"
        assert row.convex_write_status == "success", f"expected success, got {row.convex_write_status}"
        assert row.convex_written_at is not None, "convex_written_at should be set on success"
        assert row.convex_idempotency_key is not None, "convex_idempotency_key should be persisted"

def test_worker_convex_failure_marks_failed(monkeypatch):
    with get_sync_session() as s:
        p = create_profile(s, "MarkFailed")
        hist = LLMHistory(profile_id=p.id, full_response=None, merged=False)
        s.add(hist)
        s.commit()
        s.refresh(hist)
        placeholder_id = str(hist.id)

    def fake_refine(raw_text, mock=True):
        return {"parsed": {"summary": "refined"}}

    def fake_call_convex_action(path, payload):
        # Simulate network/Convex failure
        raise Exception("convex unreachable")

    monkeypatch.setattr("worker.refine_with_llm", fake_refine)
    monkeypatch.setattr("worker.call_convex_action", fake_call_convex_action)

    res = llm_refine_profile(str(p.id), correlation_job_id=placeholder_id)

    with get_sync_session() as s2:
        from uuid import UUID
        hid = UUID(placeholder_id)
        row = s2.get(LLMHistory, hid)
        assert row is not None, "LLMHistory row should exist"
        assert row.convex_write_status == "failed", f"expected failed, got {row.convex_write_status}"
        assert row.convex_error is not None, "convex_error should be set on failure"
