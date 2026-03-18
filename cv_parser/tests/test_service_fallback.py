import io
import pytest

# Skip these tests entirely if FastAPI isn't available in the current test env
pytest.importorskip("fastapi")

from fastapi.testclient import TestClient  # type: ignore
from cv_parser_service import main as svc


client = TestClient(svc.app)


def test_healthz_ok():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_parse_cv_returns_minimal_schema_on_timeout(monkeypatch):
    # Force immediate timeout at the module level (env var is read at import time)
    monkeypatch.setattr(svc, "PIPELINE_TIMEOUT_SECONDS", 0)

    fake_pdf = io.BytesIO(b"%PDF-1.4 fake payload")
    r = client.post(
        "/parse-cv",
        files={"file": ("test.pdf", fake_pdf, "application/pdf")},
        data={"mode": "auto"},
    )
    assert r.status_code == 200
    payload = r.json()["result"]

    assert "normalized" in payload
    norm = payload["normalized"]

    # Minimal normalized schema defaults
    assert norm.get("name") is None
    assert isinstance(norm.get("summary"), str)
    for key in ["experience", "education", "skills", "languages", "achievements"]:
        assert isinstance(norm.get(key), list)

    diag = payload.get("diagnostics", {})
    assert diag.get("fallback_used") is True
    # When timeout is forced, expect reason to contain a timeout token
    assert "timeout" in (diag.get("error") or diag.get("reason") or "")

