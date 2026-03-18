#!/usr/bin/env python3
"""
A/B/C CLI runner for structuredUpload parser smoke tests.

Scenarios:
  A (a-multicol)   – PDF only, text extracted if needed.
  B (b-orphan)     – First TXT (fixtures/ResumesTXT or fixtures/golden).
  C (c-edu-noise)  – Additional PDF (prefers the second entry when available).

Each scenario runs twice (text + ocr), writes artifacts to /tmp/structured/, emits
raw JSON for every run, then invokes the validator to print the acceptance table.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import textwrap
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import shutil

try:  # pragma: no cover - optional dependency
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except Exception:  # pragma: no cover - requests optional
    requests = None
    HTTPAdapter = None
    Retry = None

REPO_ROOT = Path(__file__).resolve().parents[1]
SKIP_TS_CANONICALIZE = (
    os.environ.get("SKIP_TS_CANONICALIZE", "0").strip().lower() in {"1", "true", "yes", "on"}
)


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module {name} from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


quick_pdf_text_module = load_module("quick_pdf_text", REPO_ROOT / "scripts" / "quick_pdf_text.py")
validator_module = load_module("validator", REPO_ROOT / "scripts" / "validator.py")

extract_pdf_text = quick_pdf_text_module.extract_pdf_text
PdfExtractionError = quick_pdf_text_module.PdfExtractionError
MISSING_PARSER_REASON = "no parser endpoint configured (set PARSER_URL or CONVEX_PARSER_URL)"
PDF_FIXTURES = REPO_ROOT / "fixtures" / "ResumesPDF"
TXT_FIXTURES = REPO_ROOT / "fixtures" / "ResumesTXT"
GOLDEN_FIXTURES = REPO_ROOT / "fixtures" / "golden"
FIXTURE_TEST_DIR = REPO_ROOT / "fixtures" / "fixturetest"
DEFAULT_OUTPUT_DIR = Path("/tmp/structured")
DEFAULT_TIMEOUT_SECONDS = int(os.environ.get("SMOKE_TIMEOUT", "180"))
DEFAULT_CONCURRENCY = int(os.environ.get("SMOKE_CONCURRENCY", "1"))
HTTP_CONNECT_TIMEOUT = float(os.environ.get("SMOKE_CONNECT_TIMEOUT", "10"))
HTTP_TOTAL_RETRIES = int(os.environ.get("SMOKE_HTTP_RETRIES", "3"))
HTTP_BACKOFF = float(os.environ.get("SMOKE_HTTP_BACKOFF", "0.5"))
HTTP_ALLOWED_METHODS = frozenset({"POST"})
TIMEOUT_SECONDS = DEFAULT_TIMEOUT_SECONDS
_HTTP_SESSION: Optional["requests.Session"] = None


@dataclass
class Scenario:
    label: str  # A / B / C
    slug: str
    pdf_path: Optional[Path]
    text_path: Optional[Path]


@dataclass
class RunRecord:
    scenario: Scenario
    mode: str  # "text" or "ocr"
    output_path: Path
    blocked: bool
    reason: Optional[str] = None


def _get_http_session() -> Optional["requests.Session"]:
    global _HTTP_SESSION
    if requests is None:
        return None
    if _HTTP_SESSION is not None:
        return _HTTP_SESSION
    session = requests.Session()
    if HTTPAdapter is not None and Retry is not None:
        retry = Retry(
            total=HTTP_TOTAL_RETRIES,
            backoff_factor=HTTP_BACKOFF,
            status_forcelist=(502, 503, 504),
            allowed_methods=HTTP_ALLOWED_METHODS,
            raise_on_status=False,
            respect_retry_after_header=True,
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
    _HTTP_SESSION = session
    return _HTTP_SESSION

def _gather_fixture_paths(pattern: str) -> List[Path]:
    ordered_dirs = [
        FIXTURE_TEST_DIR,
        PDF_FIXTURES if pattern.endswith("*.pdf") else TXT_FIXTURES,
    ]
    if pattern.endswith("*.txt"):
        ordered_dirs.append(GOLDEN_FIXTURES)
    seen: set[Path] = set()
    results: List[Path] = []
    for directory in ordered_dirs:
        if not directory.exists():
            continue
        for candidate in sorted(directory.glob(pattern)):
            resolved = candidate.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            results.append(candidate)
    return results


def first_pdf(index: int = 0) -> Optional[Path]:
    pdfs = _gather_fixture_paths("*.pdf")
    if not pdfs:
        return None
    if index < len(pdfs):
        return pdfs[index]
    return pdfs[-1]


def first_text_path() -> Optional[Path]:
    candidates = _gather_fixture_paths("*.txt")
    return candidates[0] if candidates else None


def build_scenarios() -> Tuple[List[Scenario], List[str]]:
    errors: List[str] = []

    pdf_a = first_pdf(0)
    second_pdf = first_pdf(1)
    pdf_c = second_pdf if second_pdf is not None else pdf_a
    txt_b = first_text_path()

    if pdf_a is None:
        errors.append("Scenario A: no PDF found in fixtures/ResumesPDF/")
    if pdf_c is None:
        errors.append("Scenario C: no PDF found in fixtures/ResumesPDF/")
    if txt_b is None:
        errors.append("Scenario B: no TXT fixture found in fixtures/ResumesTXT/ or fixtures/golden/")

    scenarios: List[Scenario] = [
        Scenario(label="A", slug="a-multicol", pdf_path=pdf_a, text_path=None),
        Scenario(label="B", slug="b-orphan", pdf_path=pdf_a, text_path=txt_b),
        Scenario(label="C", slug="c-edu-noise", pdf_path=pdf_c, text_path=None),
    ]

    return scenarios, errors


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def create_stub_json(scenario: Scenario, mode: str, target_path: Path, reason: str, source_path: Optional[Path]) -> str:
    payload = {
        "status": "BLOCKED",
        "reason": reason,
        "input": {
            "cv": scenario.label,
            "mode": mode,
            "path": str(source_path.resolve()) if source_path else "",
        },
        "diagnostics": {
            "engine": None,
            "dpi_used": None,
        },
    }
    text = json.dumps(payload, ensure_ascii=False)
    target_path.write_text(text, encoding="utf-8")
    return text


def detect_parser_backend() -> Tuple[str, str]:
    parser_url = os.environ.get("PARSER_URL", "").strip()
    if parser_url:
        return "http", parser_url

    convex_parser_url = os.environ.get("CONVEX_PARSER_URL", "").strip()
    if convex_parser_url:
        return "http", convex_parser_url

    tunnel_file = REPO_ROOT / "my-app" / ".parser-tunnel-url"
    if tunnel_file.exists():
        try:
            base = tunnel_file.read_text(encoding="utf-8").strip()
        except OSError:
            base = ""
        if base:
            parsed = urllib.parse.urlsplit(base)
            path = parsed.path or ""
            if path.endswith("/parse-cv"):
                endpoint = base
            else:
                new_path = (path.rstrip("/") + "/parse-cv") if path else "/parse-cv"
                endpoint = urllib.parse.urlunsplit(
                    (parsed.scheme, parsed.netloc, new_path, parsed.query, parsed.fragment)
                )
            return "http", endpoint

    convex_deployment = os.environ.get("CONVEX_DEPLOYMENT", "").strip()
    if convex_deployment:
        return "convex", convex_deployment

    return "none", ""


def canonicalize_http_payload(payload: str, mode: str, raw_text: str, parser_url: str) -> str:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return payload
    if isinstance(data, dict) and isinstance(data.get("result"), dict):
        result_data = data["result"]
    elif isinstance(data, dict):
        result_data = data
    else:
        return payload

    canonical = run_ts_canonicalize(result_data, mode, raw_text, parser_url)
    if canonical is not None:
        return json.dumps(canonical, ensure_ascii=False)
    return json.dumps(result_data, ensure_ascii=False)


def run_ts_canonicalize(result_data: dict, mode: str, raw_text: str, parser_url: str) -> Optional[dict]:
    if SKIP_TS_CANONICALIZE or shutil.which("npx") is None:
        return None
    raw_text_value = raw_text or extract_raw_text(result_data)
    script_template = (
        "import fs from 'node:fs';\n"
        f"import {{ canonicalizeParserResult }} from '{(REPO_ROOT / 'my-app' / 'convex' / 'lib' / 'parsing' / 'canonicalize').as_posix()}';\n"
        "const [inputPath, outputPath, rawText, modeArg, parserUrl] = process.argv.slice(2);\n"
        "const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));\n"
        "const canonical = canonicalizeParserResult(raw, { rawText, mode: modeArg, parserUrl });\n"
        "fs.writeFileSync(outputPath, JSON.stringify(canonical));\n"
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        input_path = tmpdir_path / "input.json"
        output_path = tmpdir_path / "output.json"
        script_path = tmpdir_path / "canonicalize.ts"
        input_path.write_text(json.dumps(result_data, ensure_ascii=False), encoding="utf-8")
        script_path.write_text(script_template, encoding="utf-8")

        cmd = [
            "npx",
            "tsx",
            str(script_path),
            str(input_path),
            str(output_path),
            raw_text_value,
            mode,
            parser_url,
        ]
        proc = subprocess.run(
            cmd,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            error_msg = proc.stderr.strip() or proc.stdout.strip()
            if error_msg:
                print(error_msg, file=sys.stderr)
            return None
        try:
            return json.loads(output_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None


def extract_raw_text(result_data: dict) -> str:
    if not isinstance(result_data, dict):
        return ""
    text = result_data.get("rawText")
    if isinstance(text, str) and text.strip():
        return text
    normalized = result_data.get("normalized")
    if isinstance(normalized, dict):
        text = normalized.get("rawText") or normalized.get("raw")
        if isinstance(text, str) and text.strip():
            return text
    return ""


def annotate_payload_with_fallback(payload: str, reason: str) -> str:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return payload
    diagnostics_target: Optional[dict] = None
    if isinstance(data, dict):
        result_section = data.get("result")
        if isinstance(result_section, dict):
            diagnostics_target = result_section.setdefault("diagnostics", {})
        else:
            diagnostics_target = data.setdefault("diagnostics", {})
    if isinstance(diagnostics_target, dict):
        diagnostics_target["text_fallback_used"] = True
        diagnostics_target["text_fallback_reason"] = reason
        return json.dumps(data, ensure_ascii=False)
    return payload


def run_http_text(parser_url: str, raw_text: str, timeout: int) -> Tuple[int, str, str]:
    parsed = urllib.parse.urlsplit(parser_url)
    query = parsed.query
    query = f"{query}&mode=text" if query else "mode=text"
    text_url = urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment)
    )
    session = _get_http_session()
    if session is not None:
        try:
            response = session.post(
                text_url,
                files={"raw_text": (None, raw_text)},
                timeout=(HTTP_CONNECT_TIMEOUT, timeout),
            )
            body = response.text
            if response.ok:
                return 0, body, ""
            return response.status_code or 1, body, response.reason or ""
        except requests.RequestException as exc:  # pragma: no cover - network failures
            resp = exc.response
            body = resp.text if resp is not None else ""
            status = resp.status_code if resp is not None else 1
            return status or 1, body, str(exc)
    boundary = f"----runnerBoundary{uuid.uuid4().hex}"
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    body_parts = [
        f"--{boundary}\r\n".encode("utf-8"),
        b'Content-Disposition: form-data; name="raw_text"\r\n\r\n',
        raw_text.encode("utf-8"),
        b"\r\n",
        f"--{boundary}--\r\n".encode("utf-8"),
    ]
    data = b"".join(body_parts)
    request = urllib.request.Request(
        text_url,
        data=data,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
        return 0, body, ""
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="ignore")
        return err.code or 1, body, str(err)
    except Exception as exc:  # pragma: no cover - network failures
        return 1, "", str(exc)


def run_http_ocr(parser_url: str, pdf_path: Path, timeout: int) -> Tuple[int, str, str]:
    parsed = urllib.parse.urlsplit(parser_url)
    query = parsed.query
    query = f"{query}&mode=auto" if query else "mode=auto"
    ocr_url = urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment)
    )
    file_bytes = pdf_path.read_bytes()
    session = _get_http_session()
    if session is not None:
        try:
            files = {"file": (pdf_path.name, file_bytes, "application/pdf")}
            response = session.post(
                ocr_url,
                files=files,
                timeout=(HTTP_CONNECT_TIMEOUT, timeout),
            )
            body = response.text
            if response.ok:
                return 0, body, ""
            return response.status_code or 1, body, response.reason or ""
        except requests.RequestException as exc:  # pragma: no cover
            resp = exc.response
            body = resp.text if resp is not None else ""
            status = resp.status_code if resp is not None else 1
            return status or 1, body, str(exc)
    boundary = f"----runnerBoundary{uuid.uuid4().hex}"
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    body_parts = [
        f"--{boundary}\r\n".encode("utf-8"),
        (
            f'Content-Disposition: form-data; name="file"; filename="{pdf_path.name}"\r\n'
            "Content-Type: application/pdf\r\n\r\n"
        ).encode("utf-8"),
        file_bytes,
        b"\r\n",
        f"--{boundary}--\r\n".encode("utf-8"),
    ]
    data = b"".join(body_parts)
    request = urllib.request.Request(
        ocr_url,
        data=data,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
        return 0, body, ""
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="ignore")
        return err.code or 1, body, str(err)
    except Exception as exc:  # pragma: no cover
        return 1, "", str(exc)


def run_convex_text(raw_text: str, timeout: int) -> Tuple[int, str, str]:
    payload = json.dumps({"mode": "text", "rawText": raw_text})
    cmd = [
        "npx",
        "convex",
        "run",
        "--typecheck",
        "disable",
        "actions/structuredUpload:structuredUpload",
        payload,
    ]
    proc = subprocess.run(
        cmd,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return proc.returncode, proc.stdout, proc.stderr


def run_convex_ocr(pdf_path: Path, timeout: int) -> Tuple[int, str, str]:
    cmd = [
        "npx",
        "convex",
        "run",
        "--typecheck",
        "disable",
        "actions/structuredUpload:structuredUpload",
        json.dumps({"mode": "auto"}),
    ]
    with pdf_path.open("rb") as handle:
        proc = subprocess.run(
            cmd,
            input=handle.read(),
            check=False,
            capture_output=True,
            text=False,
            timeout=timeout,
        )
    stdout = proc.stdout.decode("utf-8", errors="ignore")
    stderr = proc.stderr.decode("utf-8", errors="ignore")
    return proc.returncode, stdout, stderr


def extract_text_source(scenario: Scenario) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    if scenario.text_path and scenario.text_path.exists():
        try:
            text = scenario.text_path.read_text(encoding="utf-8", errors="ignore")
        except Exception as exc:
            return None, None, f"failed to read text fixture ({exc})"
        cleaned = text.strip()
        if not cleaned:
            return None, None, "text fixture empty"
        return cleaned, str(scenario.text_path.resolve()), None
    if scenario.pdf_path is None:
        return None, None, "no text or PDF source available"
    try:
        text = extract_pdf_text(scenario.pdf_path, max_pages=2)
    except PdfExtractionError as exc:
        return None, None, f"pdf text extract failed ({exc})"
    cleaned = text.strip()
    if not cleaned:
        return None, None, "pdf text extraction returned empty content"
    return cleaned, f"{scenario.pdf_path.resolve()}#text", None


def print_paths(scenarios: List[Scenario]) -> None:
    for scenario in scenarios:
        if scenario.pdf_path:
            print(f"{scenario.label} pdf: {scenario.pdf_path.resolve()}", file=sys.stderr)
        else:
            print(f"{scenario.label} pdf: <missing>", file=sys.stderr)
        if scenario.text_path and scenario.text_path.exists():
            print(f"{scenario.label} text: {scenario.text_path.resolve()}", file=sys.stderr)
        elif scenario.pdf_path:
            print(f"{scenario.label} text: {scenario.pdf_path.resolve()} (extract)", file=sys.stderr)
        else:
            print(f"{scenario.label} text: <missing>", file=sys.stderr)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run A/B/C structured upload scenarios (text + ocr).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """
            Scenarios:
              A - Multi-column PDF (first PDF in fixtures/ResumesPDF/).
              B - Orphan narrative (first TXT in fixtures/ResumesTXT/ or fixtures/golden/).
              C - Education noise PDF (next PDF in fixtures/ResumesPDF/).
            """
        ),
    )
    docker_env = Path("/.dockerenv").exists()
    default_save_path = os.getenv(
        "SMOKE_SAVE",
        "/tmp/abc_smoke_result.txt" if docker_env else str(Path("artifacts") / "abc_smoke_result.txt"),
    )

    parser.add_argument(
        "--out-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Directory for output JSON files (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--save",
        default=default_save_path,
        help="Path to write smoke summary (env SMOKE_SAVE overrides). Use '-' to skip writing.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=None,
        help="Per-request timeout in seconds (defaults to env SMOKE_TIMEOUT or 180).",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=None,
        help="Max concurrency (default from env SMOKE_CONCURRENCY; execution remains sequential).",
    )
    args = parser.parse_args(argv)

    timeout_arg = args.timeout if args.timeout is not None else DEFAULT_TIMEOUT_SECONDS
    if timeout_arg is None or timeout_arg <= 0:
        timeout_arg = DEFAULT_TIMEOUT_SECONDS
    concurrency_arg = args.concurrency if args.concurrency is not None else DEFAULT_CONCURRENCY
    if concurrency_arg is None or concurrency_arg <= 0:
        concurrency_arg = 1

    global TIMEOUT_SECONDS
    TIMEOUT_SECONDS = timeout_arg
    print(
        f"[run_abc] configuration timeout={TIMEOUT_SECONDS}s concurrency={concurrency_arg}",
        file=sys.stderr,
    )

    out_dir = Path(args.out_dir).expanduser()
    ensure_output_dir(out_dir)

    scenarios, setup_errors = build_scenarios()
    if setup_errors:
        for message in setup_errors:
            print(message, file=sys.stderr)
    if not scenarios:
        return 2

    print_paths(scenarios)

    run_records: List[RunRecord] = []

    backend_mode, backend_hint = detect_parser_backend()
    missing_parser_reason = MISSING_PARSER_REASON
    ocr_cache: Dict[str, Tuple[int, str, str]] = {}

    def fetch_ocr_result(scenario: Scenario) -> Tuple[int, str, str]:
        cached = ocr_cache.get(scenario.slug)
        if cached is not None:
            return cached
        if scenario.pdf_path is None:
            raise ValueError("OCR requires PDF fixture")
        if backend_mode == "http":
            result = run_http_ocr(backend_hint or "", scenario.pdf_path, TIMEOUT_SECONDS)
        else:
            result = run_convex_ocr(scenario.pdf_path, TIMEOUT_SECONDS)
        ocr_cache[scenario.slug] = result
        return result

    def process_stdout(
        mode: str,
        stdout: str,
        *,
        raw_text_value: str,
        annotate: Optional[str] = None,
    ) -> Optional[str]:
        payload = stdout.strip()
        if not payload:
            return None
        processed = payload
        if backend_mode == "http":
            processed = canonicalize_http_payload(
                processed,
                mode=mode,
                raw_text=raw_text_value,
                parser_url=backend_hint or "",
            )
        if annotate:
            processed = annotate_payload_with_fallback(processed, annotate)
        return processed

    for scenario in scenarios:
        if backend_mode == "none":
            text_output_path = out_dir / f"{scenario.slug}_text.json"
            text_source_path = scenario.text_path or scenario.pdf_path
            text_stub = create_stub_json(
                scenario,
                mode="text",
                target_path=text_output_path,
                reason=missing_parser_reason,
                source_path=text_source_path,
            )
            print(text_stub)
            run_records.append(RunRecord(scenario, "text", text_output_path, True, missing_parser_reason))

            ocr_output_path = out_dir / f"{scenario.slug}_ocr.json"
            ocr_stub = create_stub_json(
                scenario,
                mode="ocr",
                target_path=ocr_output_path,
                reason=missing_parser_reason,
                source_path=scenario.pdf_path,
            )
            print(ocr_stub)
            run_records.append(RunRecord(scenario, "ocr", ocr_output_path, True, missing_parser_reason))
            continue

        # TEXT MODE
        text_output_path = out_dir / f"{scenario.slug}_text.json"
        raw_text, text_source, text_error = extract_text_source(scenario)
        if text_error:
            fallback_reason = text_error
            if scenario.pdf_path is None:
                stub = create_stub_json(
                    scenario,
                    mode="text",
                    target_path=text_output_path,
                    reason=text_error,
                    source_path=scenario.text_path or scenario.pdf_path,
                )
                print(stub)
                run_records.append(RunRecord(scenario, "text", text_output_path, True, text_error))
            else:
                try:
                    rc, stdout, err_output = fetch_ocr_result(scenario)
                except subprocess.TimeoutExpired:
                    reason = f"text extraction failed ({text_error}); ocr fallback timed out"
                    stub = create_stub_json(
                        scenario,
                        mode="text",
                        target_path=text_output_path,
                        reason=reason,
                        source_path=scenario.pdf_path,
                    )
                    print(stub)
                    run_records.append(RunRecord(scenario, "text", text_output_path, True, reason))
                except ValueError as exc:
                    reason = f"text extraction failed ({text_error}); {exc}"
                    stub = create_stub_json(
                        scenario,
                        mode="text",
                        target_path=text_output_path,
                        reason=reason,
                        source_path=scenario.pdf_path,
                    )
                    print(stub)
                    run_records.append(RunRecord(scenario, "text", text_output_path, True, reason))
                else:
                    if rc != 0:
                        if err_output:
                            print(err_output.strip(), file=sys.stderr)
                        reason = f"text extraction failed ({text_error}); ocr status {rc}"
                        stub = create_stub_json(
                            scenario,
                            mode="text",
                            target_path=text_output_path,
                            reason=reason,
                            source_path=scenario.pdf_path,
                        )
                        print(stub)
                        run_records.append(RunRecord(scenario, "text", text_output_path, True, reason))
                    else:
                        processed_payload = process_stdout(
                            "ocr",
                            stdout,
                            raw_text_value="",
                            annotate=fallback_reason,
                        )
                        if processed_payload is None:
                            reason = f"text extraction failed ({text_error}); ocr returned empty payload"
                            stub = create_stub_json(
                                scenario,
                                mode="text",
                                target_path=text_output_path,
                                reason=reason,
                                source_path=scenario.pdf_path,
                            )
                            print(stub)
                            run_records.append(RunRecord(scenario, "text", text_output_path, True, reason))
                        else:
                            print(f"[run_abc] scenario {scenario.label}: text fallback to OCR ({text_error})", file=sys.stderr)
                            text_output_path.write_text(processed_payload, encoding="utf-8")
                            print(processed_payload)
                            run_records.append(
                                RunRecord(
                                    scenario,
                                    "text",
                                    text_output_path,
                                    False,
                                    f"fallback_to_ocr:{text_error}",
                                )
                            )
        else:
            try:
                if backend_mode == "http":
                    rc, stdout, err_output = run_http_text(backend_hint or "", raw_text or "", TIMEOUT_SECONDS)
                else:
                    rc, stdout, err_output = run_convex_text(raw_text or "", TIMEOUT_SECONDS)
            except subprocess.TimeoutExpired:
                reason = "text mode command timed out"
                stub = create_stub_json(
                    scenario,
                    mode="text",
                    target_path=text_output_path,
                    reason=reason,
                    source_path=scenario.text_path or scenario.pdf_path,
                )
                print(stub)
                run_records.append(RunRecord(scenario, "text", text_output_path, True, reason))
            else:
                if rc != 0:
                    if backend_mode == "http":
                        reason = f"http text request failed (status {rc})"
                    else:
                        reason = f"convex text exit {rc}"
                    if err_output:
                        print(err_output.strip(), file=sys.stderr)
                    stub = create_stub_json(
                        scenario,
                        mode="text",
                        target_path=text_output_path,
                        reason=reason,
                        source_path=scenario.text_path or scenario.pdf_path,
                    )
                    print(stub)
                    run_records.append(RunRecord(scenario, "text", text_output_path, True, reason))
                else:
                    processed_payload = process_stdout(
                        "text",
                        stdout,
                        raw_text_value=raw_text or "",
                    )
                    if processed_payload is None:
                        reason = "text mode returned empty stdout"
                        stub = create_stub_json(
                            scenario,
                            mode="text",
                            target_path=text_output_path,
                            reason=reason,
                            source_path=scenario.text_path or scenario.pdf_path,
                        )
                        print(stub)
                        run_records.append(RunRecord(scenario, "text", text_output_path, True, reason))
                    else:
                        text_output_path.write_text(processed_payload, encoding="utf-8")
                        print(processed_payload)
                        run_records.append(RunRecord(scenario, "text", text_output_path, False))

        # OCR MODE
        ocr_output_path = out_dir / f"{scenario.slug}_ocr.json"
        if scenario.pdf_path is None:
            reason = "ocr mode requires PDF fixture"
            stub = create_stub_json(
                scenario,
                mode="ocr",
                target_path=ocr_output_path,
                reason=reason,
                source_path=None,
            )
            print(stub)
            run_records.append(RunRecord(scenario, "ocr", ocr_output_path, True, reason))
        else:
            try:
                rc, stdout, err_output = fetch_ocr_result(scenario)
            except subprocess.TimeoutExpired:
                reason = "ocr mode command timed out"
                stub = create_stub_json(
                    scenario,
                    mode="ocr",
                    target_path=ocr_output_path,
                    reason=reason,
                    source_path=scenario.pdf_path,
                )
                print(stub)
                run_records.append(RunRecord(scenario, "ocr", ocr_output_path, True, reason))
            except ValueError as exc:
                reason = str(exc)
                stub = create_stub_json(
                    scenario,
                    mode="ocr",
                    target_path=ocr_output_path,
                    reason=reason,
                    source_path=scenario.pdf_path,
                )
                print(stub)
                run_records.append(RunRecord(scenario, "ocr", ocr_output_path, True, reason))
            else:
                if rc != 0:
                    if backend_mode == "http":
                        reason = f"http ocr request failed (status {rc})"
                    else:
                        reason = f"convex ocr exit {rc}"
                    if err_output:
                        print(err_output.strip(), file=sys.stderr)
                    stub = create_stub_json(
                        scenario,
                        mode="ocr",
                        target_path=ocr_output_path,
                        reason=reason,
                        source_path=scenario.pdf_path,
                    )
                    print(stub)
                    run_records.append(RunRecord(scenario, "ocr", ocr_output_path, True, reason))
                else:
                    processed_payload = process_stdout(
                        "ocr",
                        stdout,
                        raw_text_value="",
                    )
                    if processed_payload is None:
                        reason = "ocr mode returned empty stdout"
                        stub = create_stub_json(
                            scenario,
                            mode="ocr",
                            target_path=ocr_output_path,
                            reason=reason,
                            source_path=scenario.pdf_path,
                        )
                        print(stub)
                        run_records.append(RunRecord(scenario, "ocr", ocr_output_path, True, reason))
                    else:
                        ocr_output_path.write_text(processed_payload, encoding="utf-8")
                        print(processed_payload)
                        run_records.append(RunRecord(scenario, "ocr", ocr_output_path, False))

    # Invoke validator on all six outputs
    validation_paths = [record.output_path for record in run_records]
    validator_results = [validator_module.validate_file(path) for path in validation_paths]
    table = validator_module.render_table(validator_results)
    print(table, file=sys.stderr)

    failure_lines = validator_module.render_failures(validator_results)
    for line in failure_lines:
        print(line, file=sys.stderr)

    summary_lines = [table, ""]
    summary_lines.extend(failure_lines)
    summary_lines.append("")
    if args.save and args.save != "-":
        save_target = Path(args.save).expanduser()
        try:
            save_target.parent.mkdir(parents=True, exist_ok=True)
            save_target.write_text("\n".join(summary_lines), encoding="utf-8")
        except Exception as exc:  # pragma: no cover - best effort
            print(f"[WARN] Unable to write smoke summary to {save_target}: {exc}", file=sys.stderr)

    expected_names = [
        "a-multicol_text.json",
        "a-multicol_ocr.json",
        "b-orphan_text.json",
        "b-orphan_ocr.json",
        "c-edu-noise_text.json",
        "c-edu-noise_ocr.json",
    ]
    missing_artifacts = False
    for name in expected_names:
        path = out_dir / name
        if not path.exists() or path.stat().st_size == 0:
            print(f"Artifact missing or empty: {path}", file=sys.stderr)
            missing_artifacts = True

    any_blocked = any(record.blocked for record in run_records) or any(result.any_blocked for result in validator_results)
    any_fail = any(result.any_failure for result in validator_results)

    if missing_artifacts or any_blocked:
        return 2
    if any_fail:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
