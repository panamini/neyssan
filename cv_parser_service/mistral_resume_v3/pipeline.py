from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from .annotation_parser import AnnotationParserError, parse_document_annotation
from .app_mapper import build_canonical_payload
from .ocr_client import (
    OCRAnnotationResult,
    run_annotated_ocr_from_bytes,
    run_annotated_ocr_from_url,
    serialize_for_json,
)
from .post_validation import normalize_extraction


INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY = "_mistral_resume_v3_canonical_payload"


def _join_markdown_pages(pages: list[dict[str, Any]], delimiter: str = "\n\n---\n\n") -> str:
    parts = [(page.get("markdown") or "").strip() for page in pages]
    return delimiter.join(part for part in parts if part)


def _build_failure_payload(
    *,
    status: str,
    stage: str,
    error_type: str,
    error_message: str,
    error_details: Optional[Dict[str, Any]],
    ocr_result: OCRAnnotationResult,
) -> Dict[str, Any]:
    return {
        "status": status,
        "fallback_to_legacy": True,
        "stage": stage,
        "errorType": error_type,
        "errorMessage": error_message,
        "warnings": [],
        "pages": ocr_result.pages,
        "rawText": _join_markdown_pages(ocr_result.pages),
        "diagnostics": {
            **ocr_result.diagnostics,
            "mistral_parser_status": status,
            "mistral_parser_failure_stage": stage,
            "mistral_parser_error_type": error_type,
            "mistral_parser_error_message": error_message,
            "mistral_parser_error_details": error_details or None,
        },
    }


def _run_resume_pipeline_from_ocr_result(ocr_result: OCRAnnotationResult) -> Dict[str, Any]:
    raw_text = _join_markdown_pages(ocr_result.pages)
    try:
        extraction = parse_document_annotation(ocr_result.annotation_raw)
    except AnnotationParserError as exc:
        return _build_failure_payload(
            status="failed",
            stage="annotation_parse",
            error_type="annotation_parse_failed",
            error_message=str(exc),
            error_details=exc.details,
            ocr_result=ocr_result,
        )

    normalized = normalize_extraction(
        extraction,
        raw_text=raw_text,
        page_count=ocr_result.page_count,
        document_name=ocr_result.diagnostics.get("document_name"),
    )
    canonical_payload = build_canonical_payload(normalized)
    diagnostics = dict(canonical_payload.get("diagnostics") or {})
    diagnostics.update(
        {
            **ocr_result.diagnostics,
            "mistral_parser_status": normalized.status,
            "mistral_parser_failure_stage": normalized.failureStage,
            "mistral_parser_error_type": normalized.errorType,
            "mistral_parser_error_message": normalized.errorMessage,
            "mistral_parser_warning_codes": [warning["code"] for warning in canonical_payload.get("warnings", [])],
        }
    )
    canonical_payload["diagnostics"] = diagnostics

    if normalized.status in {"failed", "unavailable"}:
        return {
            "status": normalized.status,
            "fallback_to_legacy": True,
            "stage": normalized.failureStage or "validation",
            "errorType": normalized.errorType or "annotation_invalid",
            "errorMessage": normalized.errorMessage or "Annotation did not contain usable resume content.",
            "warnings": canonical_payload.get("warnings", []),
            "pages": ocr_result.pages,
            "rawText": raw_text,
            "diagnostics": diagnostics,
        }

    return {
        "status": normalized.status,
        "fallback_to_legacy": False,
        "pages": ocr_result.pages,
        "canonical_payload": canonical_payload,
        "diagnostics": diagnostics,
        "rawText": raw_text,
    }


def run_resume_pipeline_from_bytes(
    *,
    file_name: Optional[str],
    content_type: Optional[str],
    data: bytes,
    api_key: str,
    model_name: Optional[str],
) -> Dict[str, Any]:
    ocr_result = run_annotated_ocr_from_bytes(
        file_name=file_name,
        content_type=content_type,
        data=data,
        api_key=api_key,
        model_name=model_name,
    )
    return _run_resume_pipeline_from_ocr_result(ocr_result)


def run_resume_pipeline_from_url(
    *,
    url: str,
    api_key: str,
    model_name: Optional[str],
) -> Dict[str, Any]:
    ocr_result = run_annotated_ocr_from_url(
        url=url,
        api_key=api_key,
        model_name=model_name,
    )
    return _run_resume_pipeline_from_ocr_result(ocr_result)


def _fixture_path(fixture_name: str) -> Path:
    return Path(__file__).resolve().parents[2] / "fixtures" / fixture_name


def _result_summary(result: Dict[str, Any]) -> Dict[str, Any]:
    canonical_payload = result.get("canonical_payload") or {}
    normalized = canonical_payload.get("normalized") or {}
    app_document = canonical_payload.get("appDocument") or {}
    return {
        "status": result.get("status"),
        "fallback_to_legacy": result.get("fallback_to_legacy"),
        "errorType": result.get("errorType"),
        "errorMessage": result.get("errorMessage"),
        "pages": (result.get("diagnostics") or {}).get("page_count"),
        "warningCount": len(canonical_payload.get("warnings") or result.get("warnings") or []),
        "sectionTypes": [section.get("type") for section in app_document.get("sections", []) if isinstance(section, dict)],
        "rawSectionLabels": [section.get("label") for section in canonical_payload.get("rawSections", []) if isinstance(section, dict)],
        "experienceCount": len(normalized.get("experience") or []),
        "educationCount": len(normalized.get("education") or []),
        "languageCount": len(normalized.get("languages") or []),
        "projectCount": len(normalized.get("projects") or []),
        "certificationCount": len(normalized.get("certifications") or []),
    }


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Mistral resume v3 pipeline on a fixture or local file.")
    parser.add_argument("--file", help="Absolute or relative path to a local file.")
    parser.add_argument("--fixture-name", help="Fixture filename under ./fixtures.")
    parser.add_argument("--stdout-json", action="store_true", help="Print only the final summary JSON to stdout.")
    args = parser.parse_args(argv)

    source_path: Optional[Path] = None
    if args.file:
        source_path = Path(args.file).expanduser().resolve()
    elif args.fixture_name:
        source_path = _fixture_path(args.fixture_name)

    if source_path is None:
        parser.error("Provide --file or --fixture-name.")
    if not source_path.exists():
        parser.error(f"File not found: {source_path}")

    api_key = (sys.modules.get("os") or __import__("os")).environ.get("MISTRAL_API_KEY", "").strip()
    if not api_key:
        parser.error("MISTRAL_API_KEY is required.")
    model_name = (sys.modules.get("os") or __import__("os")).environ.get("MISTRAL_OCR_MODEL", "mistral-ocr-latest").strip() or "mistral-ocr-latest"

    mime_type = mimetypes.guess_type(source_path.name)[0] or "application/octet-stream"
    result = run_resume_pipeline_from_bytes(
        file_name=source_path.name,
        content_type=mime_type,
        data=source_path.read_bytes(),
        api_key=api_key,
        model_name=model_name,
    )
    summary = _result_summary(result)
    if args.stdout_json:
        json.dump(summary, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
    else:
        json.dump(serialize_for_json(result), sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
