from __future__ import annotations

import argparse
import contextlib
import io
import json
import mimetypes
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from cv_parser_service.mistral_resume_v3.annotation_parser import AnnotationParserError, parse_document_annotation
from cv_parser_service.mistral_resume_v3.app_mapper import build_canonical_payload
from cv_parser_service.mistral_resume_v3.ocr_client import run_annotated_ocr_from_bytes, serialize_for_json
from cv_parser_service.mistral_resume_v3.post_validation import normalize_extraction

DEFAULT_OUTPUT_ROOT = REPO_ROOT / "experiments" / "mistral_document_annotation_eval_v3" / "output"
REQUIRED_ARTIFACTS = [
    "annotation_raw.json",
    "annotation_structured.json",
    "annotation_markdown.md",
    "baseline_current_mistral_path.json",
    "evaluation.md",
    "run_metadata.json",
    "result_summary.json",
]


@dataclass
class FixtureRun:
    fixture_path: Path
    output_dir: Path


def _stderr(message: str) -> None:
    print(message, file=sys.stderr)


def _parse_env_file(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    output: Dict[str, str] = {}
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        output[key] = value
    return output


def _load_env_layers() -> None:
    for env_file in [
        REPO_ROOT / ".env.local",
        REPO_ROOT / ".env",
        REPO_ROOT / "my-app" / ".env.local",
        REPO_ROOT / "my-app" / ".env",
    ]:
        for key, value in _parse_env_file(env_file).items():
            os.environ.setdefault(key, value)


def _slugify_fixture_name(path: Path) -> str:
    stem = path.stem.strip() or path.name
    slug = re.sub(r"[^A-Za-z0-9]+", "_", stem).strip("_").lower()
    return slug or "fixture"


def _json_dump(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(serialize_for_json(payload), indent=2, ensure_ascii=False) + "\n")


def _markdown_from_pages(pages: Iterable[Dict[str, Any]]) -> str:
    parts: List[str] = []
    for page in pages:
        index = int(page.get("index", 0)) + 1
        markdown = str(page.get("markdown") or "").strip()
        parts.append(f"# Page {index}\n\n{markdown}".rstrip())
    return "\n\n---\n\n".join(parts).strip() + "\n"


def _artifact_presence(output_dir: Path) -> Dict[str, bool]:
    return {name: (output_dir / name).exists() for name in REQUIRED_ARTIFACTS}


def _single_fixture_summary(summary_path: Path) -> Dict[str, Any]:
    return json.loads(summary_path.read_text())


def _run_direct_annotation(fixture_path: Path, api_key: str, model_name: str) -> Dict[str, Any]:
    mime_type = mimetypes.guess_type(fixture_path.name)[0] or "application/octet-stream"
    started_at = time.perf_counter()
    ocr_result = run_annotated_ocr_from_bytes(
        file_name=fixture_path.name,
        content_type=mime_type,
        data=fixture_path.read_bytes(),
        api_key=api_key,
        model_name=model_name,
    )
    ocr_elapsed_ms = round((time.perf_counter() - started_at) * 1000, 1)

    extraction = None
    extraction_error: Optional[Dict[str, Any]] = None
    normalized = None
    canonical_payload = None
    parser_status = "failed"
    parser_error_type: Optional[str] = None
    parser_error_message: Optional[str] = None

    parse_started_at = time.perf_counter()
    try:
        extraction = parse_document_annotation(ocr_result.annotation_raw)
        normalized = normalize_extraction(
            extraction,
            raw_text="\n\n---\n\n".join((page.get("markdown") or "").strip() for page in ocr_result.pages if (page.get("markdown") or "").strip()),
            page_count=ocr_result.page_count,
            document_name=fixture_path.name,
        )
        canonical_payload = build_canonical_payload(normalized)
        parser_status = normalized.status
        parser_error_type = normalized.errorType
        parser_error_message = normalized.errorMessage
    except AnnotationParserError as exc:
        parser_status = "failed"
        parser_error_type = "annotation_parse_failed"
        parser_error_message = str(exc)
        extraction_error = {
            "status": parser_status,
            "errorType": parser_error_type,
            "errorMessage": parser_error_message,
            "errorDetails": exc.details,
        }
    parse_elapsed_ms = round((time.perf_counter() - parse_started_at) * 1000, 1)

    return {
        "ocr_result": ocr_result,
        "ocr_elapsed_ms": ocr_elapsed_ms,
        "parse_elapsed_ms": parse_elapsed_ms,
        "extraction": extraction.model_dump(exclude_none=True) if extraction is not None else extraction_error,
        "normalized": normalized.model_dump(exclude_none=True) if normalized is not None else None,
        "canonical_payload": canonical_payload,
        "parser_status": parser_status,
        "parser_error_type": parser_error_type,
        "parser_error_message": parser_error_message,
    }


def _run_baseline_current_path(fixture_path: Path) -> Dict[str, Any]:
    os.environ["API_ENABLE_MISTRAL_OCR"] = "1"
    captured_stdout = io.StringIO()
    captured_stderr = io.StringIO()
    with contextlib.redirect_stdout(captured_stdout), contextlib.redirect_stderr(captured_stderr):
        from cv_parser_service.main import app

        client = TestClient(app)
        mime_type = mimetypes.guess_type(fixture_path.name)[0] or "application/octet-stream"
        started_at = time.perf_counter()
        with fixture_path.open("rb") as handle:
            response = client.post(
                "/mistral-ocr/parse",
                files={"file": (fixture_path.name, handle.read(), mime_type)},
            )
        elapsed_ms = round((time.perf_counter() - started_at) * 1000, 1)

    noisy_stdout = captured_stdout.getvalue().strip()
    noisy_stderr = captured_stderr.getvalue().strip()
    try:
        payload = response.json()
    except Exception:
        payload = {"non_json_body": response.text}
    return {
        "http_status": int(response.status_code),
        "ok": bool(response.status_code < 400),
        "elapsed_ms": elapsed_ms,
        "route": "/mistral-ocr/parse",
        "payload": payload,
        "suppressed_stdout": noisy_stdout or None,
        "suppressed_stderr": noisy_stderr or None,
    }


def _build_evaluation_markdown(
    fixture: FixtureRun,
    direct: Dict[str, Any],
    baseline: Dict[str, Any],
    artifact_presence: Dict[str, bool],
) -> str:
    ocr_result = direct["ocr_result"]
    canonical_payload = direct.get("canonical_payload") or {}
    app_document = canonical_payload.get("appDocument") or {}
    diagnostics = baseline.get("payload", {}).get("diagnostics", {}) if isinstance(baseline.get("payload"), dict) else {}
    warning_count = len(canonical_payload.get("warnings") or [])
    section_types = [section.get("type") for section in app_document.get("sections", []) if isinstance(section, dict)]
    lines = [
        f"# Evaluation: {fixture.fixture_path.name}",
        "",
        "## Direct v3 Annotation Run",
        f"- parser_status: `{direct['parser_status']}`",
        f"- parser_error_type: `{direct.get('parser_error_type') or ''}`",
        f"- parser_error_message: `{direct.get('parser_error_message') or ''}`",
        f"- page_count: `{ocr_result.page_count}`",
        f"- model: `{ocr_result.diagnostics.get('model')}`",
        f"- warnings: `{warning_count}`",
        f"- section_types: `{section_types}`",
        "",
        "## Baseline Current Mistral Path",
        f"- http_status: `{baseline['http_status']}`",
        f"- ok: `{baseline['ok']}`",
        f"- mistral_runtime: `{diagnostics.get('mistral_runtime')}`",
        f"- mistral_fallback: `{diagnostics.get('mistral_fallback')}`",
        f"- route_status_summary: `{(baseline.get('payload') or {}).get('summaryFirstSentence', '') if isinstance(baseline.get('payload'), dict) else ''}`",
        "",
        "## Artifact Check",
    ]
    for name in REQUIRED_ARTIFACTS:
        lines.append(f"- {name}: `{'yes' if artifact_presence.get(name) else 'no'}`")
    return "\n".join(lines).rstrip() + "\n"


def _result_summary(
    fixture: FixtureRun,
    direct: Dict[str, Any],
    baseline: Dict[str, Any],
    artifact_presence: Dict[str, bool],
) -> Dict[str, Any]:
    ocr_result = direct["ocr_result"]
    canonical_payload = direct.get("canonical_payload") or {}
    baseline_payload = baseline.get("payload") if isinstance(baseline.get("payload"), dict) else {}
    baseline_diag = baseline_payload.get("diagnostics", {}) if isinstance(baseline_payload, dict) else {}
    artifacts_complete = all(artifact_presence.values())
    direct_status = direct["parser_status"]
    verdict = "success"
    if direct_status not in {"success", "partial"}:
        verdict = "failed"
    elif not baseline.get("ok"):
        verdict = "failed"
    elif baseline_diag.get("mistral_fallback") is True:
        verdict = "partial"
    elif not artifacts_complete:
        verdict = "failed"

    app_document = canonical_payload.get("appDocument") or {}
    normalized = canonical_payload.get("normalized") or {}
    return {
        "fixture": fixture.fixture_path.name,
        "fixturePath": str(fixture.fixture_path),
        "outputDir": str(fixture.output_dir),
        "verdict": verdict,
        "status": direct_status,
        "artifactsComplete": artifacts_complete,
        "artifactPresence": artifact_presence,
        "directParser": {
            "status": direct_status,
            "errorType": direct.get("parser_error_type"),
            "errorMessage": direct.get("parser_error_message"),
            "pageCount": ocr_result.page_count,
            "model": ocr_result.diagnostics.get("model"),
            "warningCount": len(canonical_payload.get("warnings") or []),
            "sectionTypes": [section.get("type") for section in app_document.get("sections", []) if isinstance(section, dict)],
            "summaryFirstSentence": canonical_payload.get("summaryFirstSentence"),
        },
        "baselineCurrentMistralPath": {
            "ok": baseline.get("ok"),
            "httpStatus": baseline.get("http_status"),
            "mistralRuntime": baseline_diag.get("mistral_runtime"),
            "mistralFallback": baseline_diag.get("mistral_fallback"),
            "mistralModel": baseline_diag.get("mistral_model"),
        },
        "counts": {
            "experience": len(normalized.get("experience") or []),
            "education": len(normalized.get("education") or []),
            "skills": len(normalized.get("skills") or []),
            "languages": len(normalized.get("languages") or []),
            "projects": len(normalized.get("projects") or []),
            "certifications": len(normalized.get("certifications") or []),
            "achievements": len(normalized.get("achievements") or []),
            "sections": len(app_document.get("sections") or []),
        },
    }


def run_fixture(fixture_path: Path, output_root: Path, api_key: str, model_name: str) -> Dict[str, Any]:
    fixture = FixtureRun(
        fixture_path=fixture_path.resolve(),
        output_dir=(output_root / _slugify_fixture_name(fixture_path)),
    )
    fixture.output_dir.mkdir(parents=True, exist_ok=True)
    started_epoch = time.time()
    started_perf = time.perf_counter()

    direct = _run_direct_annotation(fixture.fixture_path, api_key, model_name)
    ocr_result = direct["ocr_result"]
    baseline = _run_baseline_current_path(fixture.fixture_path)

    _json_dump(fixture.output_dir / "annotation_raw.json", ocr_result.response_payload)
    _json_dump(fixture.output_dir / "annotation_structured.json", direct["extraction"])
    (fixture.output_dir / "annotation_markdown.md").write_text(_markdown_from_pages(ocr_result.pages))
    _json_dump(fixture.output_dir / "baseline_current_mistral_path.json", baseline)

    elapsed_ms = round((time.perf_counter() - started_perf) * 1000, 1)
    run_metadata = {
        "fixture": fixture.fixture_path.name,
        "fixturePath": str(fixture.fixture_path),
        "outputDir": str(fixture.output_dir),
        "startedAtEpoch": started_epoch,
        "elapsedMs": elapsed_ms,
        "model": model_name,
        "pageCount": ocr_result.page_count,
        "directRun": {
            "ocrElapsedMs": direct["ocr_elapsed_ms"],
            "parseElapsedMs": direct["parse_elapsed_ms"],
            "parserStatus": direct["parser_status"],
            "parserErrorType": direct["parser_error_type"],
            "parserErrorMessage": direct["parser_error_message"],
        },
        "baselineRun": {
            "elapsedMs": baseline["elapsed_ms"],
            "httpStatus": baseline["http_status"],
            "ok": baseline["ok"],
        },
    }
    _json_dump(fixture.output_dir / "run_metadata.json", run_metadata)

    artifact_presence = _artifact_presence(fixture.output_dir)
    summary = _result_summary(fixture, direct, baseline, artifact_presence)
    _json_dump(fixture.output_dir / "result_summary.json", summary)

    evaluation_md = _build_evaluation_markdown(fixture, direct, baseline, _artifact_presence(fixture.output_dir))
    (fixture.output_dir / "evaluation.md").write_text(evaluation_md)

    artifact_presence = _artifact_presence(fixture.output_dir)
    summary = _result_summary(fixture, direct, baseline, artifact_presence)
    _json_dump(fixture.output_dir / "result_summary.json", summary)

    evaluation_md = _build_evaluation_markdown(fixture, direct, baseline, artifact_presence)
    (fixture.output_dir / "evaluation.md").write_text(evaluation_md)

    if not all(artifact_presence.values()):
        raise RuntimeError(f"Missing required artifacts for {fixture.fixture_path.name}: {[name for name, present in artifact_presence.items() if not present]}")

    return summary


def _resolve_fixtures(args: argparse.Namespace) -> List[Path]:
    fixtures = [Path(item).expanduser().resolve() for item in (args.file or [])]
    if args.fixture_name:
        fixtures.extend((REPO_ROOT / "fixtures" / name).resolve() for name in args.fixture_name)
    unique: List[Path] = []
    seen: set[str] = set()
    for path in fixtures:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)
    return unique


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run the v3 Mistral document-annotation evaluator and write per-fixture artifacts.")
    parser.add_argument("--file", action="append", help="Absolute or relative fixture path. Repeatable.")
    parser.add_argument("--fixture-name", action="append", help="Fixture filename under ./fixtures. Repeatable.")
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT), help="Artifact output root.")
    parser.add_argument("--stdout-json", action="store_true", help="Print only the final summary JSON to stdout.")
    args = parser.parse_args(argv)

    _load_env_layers()
    api_key = (os.environ.get("MISTRAL_API_KEY") or "").strip()
    if not api_key:
        parser.error("MISTRAL_API_KEY not found in env or local .env files.")
    model_name = (os.environ.get("MISTRAL_OCR_MODEL") or "mistral-ocr-latest").strip() or "mistral-ocr-latest"

    fixtures = _resolve_fixtures(args)
    if not fixtures:
        parser.error("Provide at least one --file or --fixture-name.")

    output_root = Path(args.output_root).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    summaries: List[Dict[str, Any]] = []
    for fixture_path in fixtures:
        if not fixture_path.exists():
            parser.error(f"Fixture not found: {fixture_path}")
        _stderr(f"[eval-v3] running {fixture_path.name}")
        summaries.append(run_fixture(fixture_path, output_root, api_key, model_name))

    if args.stdout_json:
        payload: Any = summaries[0] if len(summaries) == 1 else summaries
        json.dump(payload, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
    else:
        json.dump(summaries[0] if len(summaries) == 1 else summaries, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
