from __future__ import annotations

import json
import mimetypes
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cv_parser_service.main import app


FIXTURES = [
    Path("/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/fixtures/jessicaclaire.png"),
    Path("/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/fixtures/sample_textpdf_resume.pdf"),
]


def _live_mistral_ready() -> bool:
    return bool(os.environ.get("API_ENABLE_MISTRAL_OCR")) and bool(os.environ.get("MISTRAL_API_KEY"))


@pytest.mark.integration
@pytest.mark.skipif(
    not _live_mistral_ready(),
    reason="Live Mistral OCR audit requires API_ENABLE_MISTRAL_OCR=1 and MISTRAL_API_KEY",
)
def test_mistral_desired_position_live_audit(capsys: pytest.CaptureFixture[str]) -> None:
    client = TestClient(app)
    reports: list[dict[str, object]] = []

    for fixture in FIXTURES:
        if not fixture.exists():
            pytest.skip(f"fixture missing: {fixture}")

        mime_type = mimetypes.guess_type(fixture.name)[0] or "application/octet-stream"
        with fixture.open("rb") as fh:
            response = client.post(
                "/mistral-ocr/parse",
                files={"file": (fixture.name, fh, mime_type)},
            )

        payload = response.json()
        result = payload.get("result") if isinstance(payload, dict) else {}
        normalized = result.get("normalized") if isinstance(result, dict) else {}
        profile = normalized.get("profile") if isinstance(normalized, dict) else {}
        contact = normalized.get("contact") if isinstance(normalized, dict) else {}
        diagnostics = payload.get("diagnostics") if isinstance(payload, dict) else {}

        reports.append(
            {
                "fixture": fixture.name,
                "status": response.status_code,
                "name": normalized.get("name") if isinstance(normalized, dict) else None,
                "profile_desiredPosition": profile.get("desiredPosition") if isinstance(profile, dict) else None,
                "contact_desiredPosition": contact.get("desiredPosition") if isinstance(contact, dict) else None,
                "mistral_runtime": diagnostics.get("mistral_runtime") if isinstance(diagnostics, dict) else None,
                "mistral_model": diagnostics.get("mistral_model") if isinstance(diagnostics, dict) else None,
                "ocr_request_path": diagnostics.get("ocr_request_path") if isinstance(diagnostics, dict) else None,
                "route": diagnostics.get("route") if isinstance(diagnostics, dict) else None,
            }
        )
        assert response.status_code == 200
        assert isinstance(diagnostics, dict)
        assert diagnostics.get("mistral_runtime") == "mistral"
        assert diagnostics.get("mistral_fallback") is False

    print(json.dumps(reports, indent=2, default=str))
    captured = capsys.readouterr()
    assert reports
    assert captured.out.strip()
