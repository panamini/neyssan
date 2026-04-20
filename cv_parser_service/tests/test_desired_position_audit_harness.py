from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from cv_parser_service.mistral_resume_v3.annotation_parser import parse_document_annotation
from cv_parser_service.mistral_resume_v3.ocr_client import OCRAnnotationResult
from cv_parser_service.mistral_resume_v3.pipeline import _run_resume_pipeline_from_ocr_result
from cv_parser_service.mistral_resume_v3.post_validation import normalize_extraction


def _load_audit_cases() -> list[dict[str, Any]]:
    fixture_path = (
        Path(__file__).parent
        / "fixtures"
        / "mistral_resume_v3"
        / "desired_position_audit_cases.json"
    )
    return json.loads(fixture_path.read_text())


@pytest.mark.parametrize(
    "case",
    _load_audit_cases(),
    ids=lambda case: str(case["id"]),
)
def test_desired_position_normalization_audit_cases(case: dict[str, Any]) -> None:
    extraction = parse_document_annotation(case["annotation_raw"])

    normalized = normalize_extraction(
        extraction,
        raw_text=case["raw_text"],
        page_count=1,
        document_name=case["document_name"],
    )

    warning_codes = [warning.code for warning in normalized.warnings]

    assert normalized.identity.desiredPosition == case["expected_desired_position"]
    assert warning_codes == case["expected_warning_codes"]


def test_desired_position_pipeline_audit_does_not_backfill_from_recovered_jessica_experience() -> None:
    markdown = (
        "JESSICA CLAIRE\n"
        "resumeexample@example.com(555) 432-1000\n\n"
        "# WORK HISTORY\n\n"
        "## Spring Education Group - Middle School Language Arts Teacher\n\n"
        "Issaquah, WA • 08/2010 - Current\n\n"
        "- Taught all levels of English language arts including intensive, regular, and advanced students\n"
        "- Taught seventh and eight grade students\n\n"
        "# EDUCATION\n"
        "Cedarville University\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "jessica.jpg",
            },
            annotation_raw={
                "identity": {
                    "name": "Jessica Claire",
                },
                "contact": {
                    "email": "resumeexample@example.com",
                    "phone": "(555) 432-1000",
                },
                "experience": [],
                "education": [{"institution": "Cedarville University"}],
                "sectionOrder": [
                    {"family": "experience", "ordinal": 0, "title": "WORK HISTORY"},
                    {"family": "education", "ordinal": 0, "title": "EDUCATION"},
                ],
            },
            response_payload={},
        )
    )

    normalized = result["canonical_payload"]["normalized"]
    assert normalized["profile"]["desiredPosition"] is None
    assert normalized["experience"][0]["position"] == "Middle School Language Arts Teacher"
    assert result["diagnostics"]["sectionRecovery"]["experience"]["applied"] is True


def test_desired_position_pipeline_audit_keeps_explicit_fixture_headline() -> None:
    fixture_path = (
        Path(__file__).parent
        / "fixtures"
        / "mistral_resume_v3"
        / "cv_surname_en_case.json"
    )
    fixture = json.loads(fixture_path.read_text())

    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=fixture["pages"],
            page_count=fixture["diagnostics"]["page_count"],
            diagnostics=fixture["diagnostics"],
            annotation_raw=fixture["annotation_raw"],
            response_payload={"document_annotation": fixture["annotation_raw"]},
        )
    )

    normalized = result["canonical_payload"]["normalized"]
    assert normalized["profile"]["desiredPosition"] == "Software Engineer"
    assert normalized["identitySchema"]["desiredPosition"] == "Software Engineer"
