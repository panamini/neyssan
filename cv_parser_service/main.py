from __future__ import annotations

# Hardened canonicalizer import to keep uvicorn reload children stable.
import asyncio
import importlib.util
import io
import json
import logging
import os
import platform
import re
import sys
import threading
import time
import unicodedata
from pathlib import Path
import site
from urllib.parse import urlparse
from typing import Any, Dict, List, Optional, Tuple
import tempfile

from fastapi import APIRouter, Body, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.datastructures import UploadFile as StarletteUploadFile

# Optional OCR backend (lazy/defensive import for dev images without Paddle/docTR)
try:
    from cv_parser.extract.ocr_pdf import (  # type: ignore
        extract_text_from_pdf as ocr_extract_text_from_pdf,
        prewarm_paddle as _prewarm_paddle_impl,
        prewarm_doctr as _prewarm_doctr_impl,
        resolve_effective_ocr_engine as _resolve_engine_impl,
        _normalize_pdf_source,
    )

    def _resolve_effective_ocr_engine() -> str:
        return _resolve_engine_impl()

    def _prewarm_paddle_safe() -> None:
        _prewarm_paddle_impl()

    def _prewarm_doctr_safe() -> None:
        _prewarm_doctr_impl()

except Exception:

    def ocr_extract_text_from_pdf(*_args: Any, **_kwargs: Any) -> Any:
        raise RuntimeError("ocr_backend_unavailable")

    def _resolve_effective_ocr_engine() -> str:
        # Fall back to env; default to doctr to avoid pulling Paddle in dev.
        return (
            os.environ.get("CV_OCR_ENGINE")
            or os.environ.get("OCR_ENGINE")
            or "doctr"
        ).strip().lower()

    def _prewarm_paddle_safe() -> None:
        # No-op when OCR backend is unavailable.
        return

    def _prewarm_doctr_safe() -> None:
        return

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))  # /app/cv_parser_service
_REPO_ROOT = os.path.dirname(_THIS_DIR) or "/app"
for _CANDIDATE in (_REPO_ROOT, "/app"):
    if _CANDIDATE and _CANDIDATE not in sys.path:
        sys.path.insert(0, _CANDIDATE)

_DOCTR_SITE_PACKAGES = Path(os.environ.get("CV_DOCTR_SITE_PACKAGES", "/opt/doctr"))
if _DOCTR_SITE_PACKAGES.is_dir():
    try:  # pragma: no cover - optional path
        site.addsitedir(str(_DOCTR_SITE_PACKAGES))
    except Exception:
        logging.getLogger(__name__).debug("Unable to register docTR site-packages path %s", _DOCTR_SITE_PACKAGES, exc_info=True)

from .mistral_ocr import (
    derive_raw_sections_from_markdown_pages,
    MistralOCRError,
    join_markdown_pages,
    run_mistral_ocr_from_bytes,
    run_mistral_ocr_from_url,
    should_use_ocr_raw_sections,
)
from .document_export import create_document_export_response


def _load_canonicalize_module_via_path():
    """Fallback import loader when cv_parser is missing on sys.path."""
    canon_path = os.path.join(_REPO_ROOT, "cv_parser", "canonicalize.py")
    if not os.path.isfile(canon_path):
        raise ModuleNotFoundError(f"canonicalize.py not found at {canon_path}")
    spec = importlib.util.spec_from_file_location("cv_parser.canonicalize", canon_path)
    if not spec or not spec.loader:  # pragma: no cover - defensive
        raise ModuleNotFoundError(f"Cannot create spec for {canon_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


try:
    from cv_parser.canonicalize import canonicalize_cv, extract_education_markdown_table_region, extract_language_markdown_table_region, has_parseable_education_markdown_table, has_parseable_language_markdown_table  # type: ignore
except ModuleNotFoundError:
    _canonicalize_module = _load_canonicalize_module_via_path()
    canonicalize_cv = _canonicalize_module.canonicalize_cv  # type: ignore[attr-defined]
    extract_education_markdown_table_region = getattr(
        _canonicalize_module,
        "extract_education_markdown_table_region",
        lambda _block: None,
    )
    extract_language_markdown_table_region = getattr(
        _canonicalize_module,
        "extract_language_markdown_table_region",
        lambda _block: None,
    )
    has_parseable_education_markdown_table = getattr(
        _canonicalize_module,
        "has_parseable_education_markdown_table",
        lambda _block: False,
    )
    has_parseable_language_markdown_table = getattr(
        _canonicalize_module,
        "has_parseable_language_markdown_table",
        lambda _block: False,
    )

# FastAPI service that exposes canonical CV parsing for text and PDF inputs.

DEFAULT_DPI = 300
ALLOWED_MODES = {"auto", "text", "ocr"}
TEXT_PARAM_KEYS = {"engine", "dpi", "lang_hint", "page_range", "max_pages", "password"}
KNOWN_JSON_KEYS = {"mode", "rawtext", "raw_text", "raw", "text", "force_ocr"}
KNOWN_FORM_KEYS = KNOWN_JSON_KEYS | {"file"}
KNOWN_QUERY_KEYS = {"mode", "force_ocr"}

READY = False
PREWARM_PENDING = False
PREWARM_LOCK = threading.Lock()
_PREWARM_ENV = (
    os.environ.get("PREWARM")
    or os.environ.get("PADDLE_PREWARM")
    or "0"
).strip().lower()
DO_PREWARM = _PREWARM_ENV in {"1", "true", "yes", "on"}
OCR_ENGINE = _resolve_effective_ocr_engine()
OCR_READY = False

DEFAULT_LOCAL_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)
DEFAULT_PRODUCTION_CORS_ORIGINS = (
    "https://dasti.ai",
    "https://www.dasti.ai",
    "https://app.dasti.ai",
)
CORS_ALLOWED_METHODS = ("GET", "POST", "OPTIONS")
CORS_ALLOWED_HEADERS = (
    "Accept",
    "Authorization",
    "Content-Type",
    "Origin",
    "X-Requested-With",
)
CORS_EXPOSED_HEADERS = ("Content-Disposition",)

# Track requested vs selected OCR engines with probe status
OCR_STATE: Dict[str, Any] = {
    "requested": os.environ.get("CV_OCR_ENGINE", os.environ.get("OCR_ENGINE", "auto")).strip().lower() or "auto",
    "selected": None,
    "probed": {"doctr": False, "paddle": False},
    "available": {"doctr": False, "paddle": False},
    "reason": {"doctr": None, "paddle": None},
}

try:  # pragma: no cover - optional dependency
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        Counter,
        Gauge,
        Histogram,
        generate_latest,
        make_asgi_app,
    )
except Exception:  # pragma: no cover - metrics optional
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4"
    Counter = Gauge = Histogram = None
    generate_latest = None
make_asgi_app = None


print("PY", sys.executable, "OCR_ENGINE", os.getenv("OCR_ENGINE") or os.getenv("CV_OCR_ENGINE"))
if os.getenv("VERBOSE_DOCTR_IMPORT", "0") == "1":
    try:
        import doctr  # type: ignore
        print("DOCTR", getattr(doctr, "__version__", "unknown"))
    except Exception as exc:  # pragma: no cover
        print("DOCTR import failed (non-fatal)", exc)


def _split_csv_env(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _is_production_environment() -> bool:
    raw = (
        os.environ.get("CV_PARSER_ENV")
        or os.environ.get("APP_ENV")
        or os.environ.get("ENVIRONMENT")
        or os.environ.get("FASTAPI_ENV")
        or os.environ.get("ENV")
        or ""
    ).strip().lower()
    return raw in {"prod", "production"}


def _resolve_cors_allowed_origins() -> List[str]:
    configured = (
        _split_csv_env(os.environ.get("CV_PARSER_CORS_ALLOW_ORIGINS"))
        or _split_csv_env(os.environ.get("CLIENT_ORIGIN_WHITELIST"))
        or _split_csv_env(os.environ.get("CLIENT_ORIGIN"))
    )
    if configured:
        return configured

    if _is_production_environment():
        return list(DEFAULT_PRODUCTION_CORS_ORIGINS)

    combined = list(DEFAULT_PRODUCTION_CORS_ORIGINS)
    combined.extend(DEFAULT_LOCAL_CORS_ORIGINS)
    return combined


def _run_subproc_probe(
    code: str,
    timeout_sec: float = 25.0,
    python_path: Optional[str] = None,
    extra_env: Optional[dict[str, str]] = None,
    allow_env_python: bool = True,
    probe_label: str = "probe",
) -> tuple[bool, Optional[str]]:
    import subprocess, os, sys

    try:
        env = os.environ.copy()
        if extra_env:
            env.update(extra_env)

        requested_py = (python_path or "").strip() or None
        env_doctr = env.get("DOCTR_PY")
        candidates: list[str] = []
        missing: list[str] = []

        def _append(path: Optional[str], source: str) -> None:
            if not path or path in candidates:
                return
            if os.path.exists(path):
                candidates.append(path)
            else:
                missing.append(f"{path} ({source})")

        _append(requested_py, "requested")
        if allow_env_python:
            if requested_py and requested_py == env_doctr and requested_py and not os.path.exists(requested_py):
                LOGGER.warning("[probe] DOCTR_PY=%s does not exist; will try fallbacks", requested_py)
            _append(env_doctr, "env:DOCTR_PY")
        _append(sys.executable, "sys.executable")

        last_reason = ""
        last_candidate = None
        for py in candidates:
            last_candidate = py
            sub_env = dict(env)
            doc_site = sub_env.get("CV_DOCTR_SITE_PACKAGES")
            if doc_site:
                existing = sub_env.get("PYTHONPATH", "")
                sub_env["PYTHONPATH"] = f"{existing}:{doc_site}" if existing else doc_site
            try:
                proc = subprocess.run(
                    [py, "-c", code],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=timeout_sec,
                    env=sub_env,
                    check=False,
                )
            except FileNotFoundError as missing_err:
                last_reason = f"not_found:{missing_err}"
                continue

            stdout_text = proc.stdout.decode("utf-8", "ignore")
            stderr_text = proc.stderr.decode("utf-8", "ignore")
            if proc.returncode == 0 and "ok" in stdout_text.lower():
                LOGGER.info("[probe:%s] ok via %s", probe_label, py)
                return True, None
            last_reason = (stderr_text or stdout_text)[:400]

        if missing:
            LOGGER.debug("[probe] skipped interpreters: %s", ", ".join(missing))
        tried_desc = ", ".join(candidates) if candidates else "none"
        failure_info = f"{probe_label}_probe_failed; last_candidate={last_candidate}; last_reason={last_reason}; interpreters_tried={tried_desc}"
        return False, failure_info
    except Exception as exc:  # pragma: no cover - diagnostic
        return False, f"probe_exception: {exc}"


def _probe_doctr() -> tuple[bool, Optional[str]]:
    code = (
        "import tensorflow as tf, doctr;"
        "from doctr.models import ocr_predictor;"
        "print('ok', tf.__version__, getattr(doctr, '__version__', 'unknown'))"
    )
    # Prefer explicit DOCTR_PY when present so the subprocess runs in the isolated venv if available.
    doctr_py = os.environ.get("DOCTR_PY")
    ok, reason = _run_subproc_probe(
        code,
        timeout_sec=120.0,
        python_path=doctr_py,
        probe_label="doctr",
    )
    if not ok and doctr_py:
        # If the requested interpreter failed due to missing tensorflow on TF backend,
        # attempt to retry using sys.executable so the readiness message is more informative.
        if "ModuleNotFoundError" in (reason or "") and "tensorflow" in (reason or "").lower():
            # Try system python for comparison
            ok2, reason2 = _run_subproc_probe(
                code,
                timeout_sec=120.0,
                python_path=sys.executable,
                probe_label="doctr-fallback",
            )
            # If system python succeeds, prefer that as the successful result and note it.
            if ok2:
                return True, None
            # Otherwise enrich the reason with both attempts
            combined = f"requested_python={doctr_py} failed: {reason}; sys_executable={sys.executable} failed: {reason2}"
            return False, combined[:400]
    return ok, reason


def _probe_paddle() -> tuple[bool, Optional[str]]:
    # Keep Paddle probe lightweight to avoid heavy model download/segfault during readiness
    code = (
        'import importlib, json, sys\n'
        'P = importlib.import_module("paddleocr")\n'
        'print("ok")\n'
    )
    # Do NOT run the Paddle probe inside the docTR venv; probe with the default interpreter.
    return _run_subproc_probe(
        code,
        timeout_sec=15.0,
        python_path=None,
        allow_env_python=False,
        probe_label="paddle",
    )


def _refresh_ocr_selection() -> None:
    """Probe engines and set OCR_STATE['selected'] based on availability and request."""
    requested = (os.environ.get("CV_OCR_ENGINE") or os.environ.get("OCR_ENGINE") or OCR_STATE.get("requested") or "auto").strip().lower() or "auto"
    OCR_STATE["requested"] = requested
    # Probe each engine once per process boot
    if not OCR_STATE["probed"]["doctr"]:
        ok, reason = _probe_doctr()
        OCR_STATE["probed"]["doctr"] = True
        OCR_STATE["available"]["doctr"] = bool(ok)
        OCR_STATE["reason"]["doctr"] = None if ok else (reason or "unknown")
    if not OCR_STATE["probed"]["paddle"]:
        ok, reason = _probe_paddle()
        OCR_STATE["probed"]["paddle"] = True
        OCR_STATE["available"]["paddle"] = bool(ok)
        OCR_STATE["reason"]["paddle"] = None if ok else (reason or "unknown")

    selected: Optional[str] = None
    if requested == "doctr":
        # Honor explicit docTR request even on ARM64, even if probe failed.
        selected = "doctr"
    elif requested == "paddle":
        selected = "paddle" if OCR_STATE["available"].get("paddle") else "pdfplumber"
    else:  # auto / disabled / unknown
        selected = "doctr" if OCR_STATE["available"].get("doctr") else ("paddle" if OCR_STATE["available"].get("paddle") else "pdfplumber")

    # On arm64, prefer running paddle in an isolated subprocess to avoid segfaults
    if selected == "paddle":
        try:
            if platform.machine().lower() in {"arm64", "aarch64"}:
                selected = "paddle_subproc"
        except Exception:
            selected = "paddle_subproc"

    OCR_STATE["selected"] = selected
    # Mark readiness only if selected neural engine actually probed OK
    global OCR_READY
    if selected == "doctr":
        OCR_READY = bool(OCR_STATE["available"].get("doctr"))
    elif selected in {"paddle", "paddle_subproc"}:
        OCR_READY = bool(OCR_STATE["available"].get("paddle"))
    else:
        OCR_READY = False


def _is_pdf_payload(data: Optional[bytes]) -> bool:
    return isinstance(data, (bytes, bytearray)) and data.startswith(b"%PDF")


_ZERO_WIDTH_RE = re.compile(r"[\u200B-\u200D\uFEFF]")
_WHITESPACE_RE = re.compile(r"\s+")


def _truthy(value: Optional[Any]) -> bool:
    if value is None:
        return False
    normalized = str(value).strip().lower()
    return normalized in {"1", "true", "yes", "on"}


def _normalize_pdf_measure_text(text: str) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", text)
    normalized = _ZERO_WIDTH_RE.sub("", normalized)
    normalized = _WHITESPACE_RE.sub(" ", normalized)
    return normalized.strip()


def _analyze_pdf_bytes(pdf_bytes: bytes) -> Dict[str, Any]:
    """Inspect a PDF payload to estimate text availability for routing."""
    analysis: Dict[str, Any] = {
        "text": "",
        "text_len": 0,
        "pages": 0,
        "density": 0.0,
        "error": None,
    }
    try:
        import pdfplumber  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dependency
        analysis["error"] = f"pdfplumber_unavailable:{exc}"
        return analysis

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:  # type: ignore[attr-defined]
            texts: List[str] = []
            page_count = len(pdf.pages)
            for page in pdf.pages:
                try:
                    extracted = page.extract_text() or ""
                except Exception:
                    extracted = ""
                if extracted:
                    texts.append(extracted)
            raw_text = "\n".join(texts).strip()
            normalized = _normalize_pdf_measure_text(raw_text)
            text_len = len(normalized)
            analysis.update(
                {
                    "text": raw_text,
                    "text_len": text_len,
                    "pages": page_count,
                    "density": text_len / max(1, page_count),
                }
            )
    except Exception as exc:  # pragma: no cover - defensive
        analysis["error"] = f"pdf_analysis_failed:{exc}"
    return analysis


class _NoopMetric:
    __slots__ = ()

    def labels(self, *args: Any, **kwargs: Any) -> "_NoopMetric":
        return self

    def inc(self, *args: Any, **kwargs: Any) -> None:
        return None

    def observe(self, *args: Any, **kwargs: Any) -> None:
        return None

    def set(self, *args: Any, **kwargs: Any) -> None:
        return None


def _metric(factory: Optional[Any], *args: Any, **kwargs: Any) -> Any:
    if factory is None:
        return _NoopMetric()
    return factory(*args, **kwargs)


OCR_ENGINE_COUNTER = _metric(
    Counter,
    "cv_parser_ocr_engine_total",
    "Count of OCR responses by engine",
    ["engine"],
)
ROUTE_COUNTER = _metric(
    Counter,
    "cv_parser_route_total",
    "Count of parser routing decisions",
    ["route"],
)
for route_name in (
    "mistral_ocr_probe",
    "mistral_ocr_parse",
    "mistral_ocr_invalid",
    "mistral_ocr_disabled",
    "mistral_ocr_failed",
):
    ROUTE_COUNTER.labels(route=route_name).inc(0)
PADDLE_TIMEOUT_COUNTER = _metric(
    Counter,
    "cv_parser_paddle_timeouts_total",
    "Count of Paddle timeout events",
)
PADDLE_CRASH_COUNTER = _metric(
    Counter,
    "cv_parser_paddle_crashes_total",
    "Count of Paddle worker crashes or exits",
)
FALLBACK_REASON_COUNTER = _metric(
    Counter,
    "cv_parser_fallback_reason_total",
    "Count of OCR fallback invocations by reason",
    ["reason"],
)
OCR_LATENCY_SECONDS = _metric(
    Histogram,
    "cv_parser_ocr_latency_seconds",
    "Seconds spent handling OCR requests (Paddle + fallbacks)",
)
PADDLE_AVAILABLE_GAUGE = _metric(
    Gauge,
    "cv_parser_paddle_available",
    "1 when the most recent Paddle attempt succeeded, else 0",
)
PADDLE_AVAILABLE_GAUGE.set(0)

# Ensure counters appear in /metrics even before first observation.
for engine_label in ("doctr", "paddle"):
    OCR_ENGINE_COUNTER.labels(engine=engine_label).inc(0)
for reason in ("high_dpi", "adaptive_predictor", "rotate90", "rotate270"):
    FALLBACK_REASON_COUNTER.labels(reason=reason).inc(0)
for route_label in ("non_pdf_text", "pdf_has_text", "pdf_image_only", "override", "unknown", "invalid"):
    ROUTE_COUNTER.labels(route=route_label).inc(0)


def _record_ocr_metrics(diagnostics: Dict[str, Any], duration_seconds: float) -> None:
    safe_duration = max(0.0, float(duration_seconds))
    OCR_LATENCY_SECONDS.observe(safe_duration)

    engine_label = str(diagnostics.get("engine") or "unknown")
    OCR_ENGINE_COUNTER.labels(engine=engine_label).inc()

    fallback_reason = diagnostics.get("fallback_reason")
    if fallback_reason:
        FALLBACK_REASON_COUNTER.labels(reason=str(fallback_reason)).inc()

    error = str(diagnostics.get("error") or "")
    if error == "paddle_timeout":
        PADDLE_TIMEOUT_COUNTER.inc()
    elif error:
        for token in ("subprocess_exit", "crash", "paddle_failure", "paddle_exception"):
            if token in error:
                PADDLE_CRASH_COUNTER.inc()
                break

    paddle_success = engine_label == "paddle" and not diagnostics.get("fallback_reason") and not error
    PADDLE_AVAILABLE_GAUGE.set(1 if paddle_success else 0)


def _failure_response(diagnostics: Dict[str, Any]) -> Dict[str, Any]:
    diag = dict(diagnostics or {})
    route = diag.get("route") or "invalid"
    route_reason = diag.get("route_reason") or "invalid"
    diag["route"] = route
    diag["route_reason"] = route_reason
    engine = diag.get("engine")
    if not engine:
        engine = diag.get("engine_final") or "unknown"
        diag["engine"] = engine
    diag.setdefault("engine_final", engine)
    diag.setdefault("ocr_retry_count", 0)
    diag.setdefault("pdf_pages", 0)
    diag.setdefault("pdf_text_len", 0)
    diag.setdefault("text_density", 0.0)
    return {
        "ok": False,
        "normalized": None,
        "sections": [],
        "diagnostics": diag,
        "result": None,
    }

app = FastAPI(
    title="CV Parser Service",
    description="Canonical CV parser with text and OCR flows.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_allowed_origins(),
    allow_credentials=True,
    allow_methods=list(CORS_ALLOWED_METHODS),
    allow_headers=list(CORS_ALLOWED_HEADERS),
    expose_headers=list(CORS_EXPOSED_HEADERS),
)

if make_asgi_app is not None:
    app.mount("/metrics", make_asgi_app())
else:
    @app.get("/metrics")
    def metrics() -> Response:
        if generate_latest is None:
            raise HTTPException(status_code=503, detail="prometheus metrics unavailable")
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


mistral_router = APIRouter(prefix="/mistral-ocr", tags=["mistral-ocr"])


@mistral_router.post("/probe")
async def mistral_ocr_probe(
    file: UploadFile | None = File(None),
    url: Optional[str] = Form(None),
) -> JSONResponse:
    api_key, model_name, config_error = _resolve_mistral_runtime()
    if config_error is not None:
        ROUTE_COUNTER.labels(route="mistral_ocr_disabled").inc()
        return config_error

    payload, payload_error = await _resolve_mistral_payload(file, url)
    if payload_error is not None or payload is None:
        ROUTE_COUNTER.labels(route="mistral_ocr_invalid").inc()
        return payload_error or _json_error(status.HTTP_400_BAD_REQUEST, "empty_payload")

    try:
        pages, diagnostics = await _call_mistral_ocr(payload, api_key, model_name)
    except MistralOCRError:
        ROUTE_COUNTER.labels(route="mistral_ocr_failed").inc()
        return _json_error(status.HTTP_502_BAD_GATEWAY, "mistral_ocr_failed")
    payload.pop("data", None)

    if not pages:
        ROUTE_COUNTER.labels(route="mistral_ocr_failed").inc()
        return _json_error(status.HTTP_502_BAD_GATEWAY, "mistral_ocr_empty")

    ROUTE_COUNTER.labels(route="mistral_ocr_probe").inc()
    return JSONResponse({"ok": True, "pages": pages, "diag": diagnostics})


@mistral_router.post("/parse")
async def mistral_ocr_parse(
    file: UploadFile | None = File(None),
    url: Optional[str] = Form(None),
) -> JSONResponse:
    api_key, model_name, config_error = _resolve_mistral_runtime()
    if config_error is not None:
        ROUTE_COUNTER.labels(route="mistral_ocr_disabled").inc()
        return config_error

    payload, payload_error = await _resolve_mistral_payload(file, url)
    if payload_error is not None or payload is None:
        ROUTE_COUNTER.labels(route="mistral_ocr_invalid").inc()
        return payload_error or _json_error(status.HTTP_400_BAD_REQUEST, "empty_payload")

    try:
        pages, diagnostics = await _call_mistral_ocr(payload, api_key, model_name)
    except MistralOCRError:
        ROUTE_COUNTER.labels(route="mistral_ocr_failed").inc()
        return _json_error(status.HTTP_502_BAD_GATEWAY, "mistral_ocr_failed")
    payload.pop("data", None)

    if not pages:
        ROUTE_COUNTER.labels(route="mistral_ocr_failed").inc()
        return _json_error(status.HTTP_502_BAD_GATEWAY, "mistral_ocr_empty")

    ocr_raw_sections, ocr_structure_diag = derive_raw_sections_from_markdown_pages(pages)
    use_ocr_raw_sections, ocr_activation_diag = should_use_ocr_raw_sections(
        ocr_raw_sections,
        ocr_structure_diag,
    )
    scoped_ocr_raw_sections, carried_families = _select_family_scoped_ocr_raw_sections(
        ocr_raw_sections,
        use_ocr_raw_sections,
    )
    joined_text = join_markdown_pages(pages)
    if not joined_text.strip():
        ROUTE_COUNTER.labels(route="mistral_ocr_failed").inc()
        return _json_error(status.HTTP_502_BAD_GATEWAY, "mistral_ocr_empty_text")

    forced_diag = dict(diagnostics or {})
    forced_diag.update({
        "engine": "external_ocr",
        "engine_final": "text",
        "ocr_engine": "mistral",
        "ocr_request_path": "/mistral-ocr/parse",
        "ocr_provider": "mistral_route",
        "route": "external_ocr",
        "fallback_used": False,
        "pages": diagnostics.get("pages", len(pages)),
        "ocr_chars": diagnostics.get("ocr_chars", len(joined_text)),
    })
    forced_diag.update(ocr_structure_diag)
    forced_diag.update(ocr_activation_diag)
    forced_diag["ocr_markdown_family_carry_through"] = carried_families

    canonical_payload = _canonicalize_text(
        joined_text,
        diagnostics=dict(forced_diag),
        raw_sections=scoped_ocr_raw_sections,
    )
    diag_payload = canonical_payload.get("diagnostics")
    if not isinstance(diag_payload, dict):
        diag_payload = {}
    diag_payload.update(forced_diag)
    mistral_model = diagnostics.get("model")
    mistral_fallback = bool(diagnostics.get("fallback")) or mistral_model == "mistral-fallback-dev"
    if mistral_model:
        diag_payload["mistral_model"] = mistral_model
    diag_payload["mistral_fallback"] = mistral_fallback
    diag_payload["mistral_runtime"] = "local_fallback" if mistral_fallback else "mistral"
    if "doc_size_bytes" in diagnostics:
        diag_payload.setdefault("doc_size_bytes", diagnostics["doc_size_bytes"])
    canonical_payload["diagnostics"] = diag_payload

    LOGGER.info(
        "[mistral-ocr] parse evidence=%s",
        {
            "path": "/mistral-ocr/parse",
            "ocr_engine": diag_payload.get("ocr_engine"),
            "mistral_model": diag_payload.get("mistral_model"),
            "mistral_fallback": diag_payload.get("mistral_fallback"),
            "pages": diag_payload.get("pages"),
        },
    )

    response_payload = {
        "ok": True,
        "normalized": canonical_payload.get("normalized"),
        "sections": canonical_payload.get("rawSections") or [],
        "diagnostics": diag_payload,
        "summary": canonical_payload.get("summary"),
        "summaryFirstSentence": canonical_payload.get("summaryFirstSentence"),
        "result": canonical_payload,
    }

    ROUTE_COUNTER.labels(route="mistral_ocr_parse").inc()
    return JSONResponse(response_payload)


app.include_router(mistral_router)


def _failure_payload_from_exception(exc: Exception) -> Dict[str, Any]:
    error_message = str(exc).strip()
    if error_message:
        combined = f"{type(exc).__name__}: {error_message}"
    else:
        combined = type(exc).__name__
    if len(combined) > 400:
        combined = combined[:397] + "..."
    diagnostics = {
        "route": "invalid",
        "route_reason": "unhandled_exception",
        "engine": "text",
        "engine_final": "text",
        "error": combined,
        "ocr_retry_count": 0,
        "pdf_pages": 0,
        "pdf_text_len": 0,
        "text_density": 0.0,
    }
    return _failure_response(diagnostics)


@app.middleware("http")
async def _fail_safe_envelope(request: Request, call_next):
    try:
        return await call_next(request)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        LOGGER.exception("[middleware] unhandled exception: %s", exc)
        payload = _failure_payload_from_exception(exc)
        return JSONResponse(payload, status_code=500)


@app.exception_handler(Exception)
async def _catch_all_exception_handler(request: Request, exc: Exception):  # pragma: no cover - defensive
    LOGGER.exception("[handler] unhandled exception: %s", exc)
    payload = _failure_payload_from_exception(exc)
    return JSONResponse(payload, status_code=500)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}

# Readiness endpoint flips true once startup hook runs (prewarm remains async).
@app.get("/ready")
def ready() -> Dict[str, Any]:
    # Keep selection fresh; cheap no-op after first probe
    _refresh_ocr_selection()
    requested = OCR_STATE.get("requested") or OCR_ENGINE
    selected = OCR_STATE.get("selected") or "pdfplumber"
    # available reflects probe outcome for the selected engine
    if selected == "doctr":
        available = bool(OCR_STATE.get("available", {}).get("doctr"))
    elif selected in {"paddle", "paddle_subproc"}:
        available = bool(OCR_STATE.get("available", {}).get("paddle"))
    else:
        available = False
    reason: Optional[str] = None
    reason_map = OCR_STATE.get("reason", {})
    if requested in {"doctr", "paddle"}:
        reason = reason_map.get(requested)
    if not reason and not OCR_STATE.get("available", {}).get("doctr"):
        reason = reason_map.get("doctr")
    return {
        "ok": READY,
        "prewarm": PREWARM_PENDING,
        "ocr": {
            "engine": requested,
            "selected": selected,
            "available": available,
            "reason": reason,
        },
    }


@app.post("/warmup")
def warmup() -> Dict[str, Any]:
    """Explicit endpoint to warm OCR models on demand.

    Runs asynchronously in a daemon thread and returns immediately.
    """
    global PREWARM_PENDING
    engine_override = os.environ.get("CV_OCR_ENGINE", "").strip().lower()

    def _background_warm() -> None:
        global PREWARM_PENDING
        if engine_override == "tesseract":
            LOGGER.info("[warmup] skipping Paddle warmup (CV_OCR_ENGINE=tesseract)")
            with PREWARM_LOCK:
                PREWARM_PENDING = False
            return
        try:
            LOGGER.info("[warmup] starting")
            # Prefer a generic build function if available; otherwise use Paddle prewarm
            try:
                from cv_parser.extract.ocr_pdf import prewarm_paddle as _do_warmup  # type: ignore
            except Exception:  # pragma: no cover - optional path
                _do_warmup = _prewarm_paddle_safe
            engine = _resolve_effective_ocr_engine()
            if engine == "paddle":
                _do_warmup()
                LOGGER.info("[warmup] done")
            else:
                LOGGER.info("[warmup] skipping Paddle warmup (engine=%s)", engine)
        except Exception as exc:  # pragma: no cover - best effort
            LOGGER.error("[warmup] failed: %s", exc, exc_info=True)
        finally:
            with PREWARM_LOCK:
                PREWARM_PENDING = False

    with PREWARM_LOCK:
        PREWARM_PENDING = True
    threading.Thread(target=_background_warm, name="cv-warmup", daemon=True).start()
    return {"ok": True}

# Optional debug endpoint for environment visibility (enable with DEBUG_SYSINFO=1)
if str(os.environ.get("DEBUG_SYSINFO", "")).strip().lower() in {"1", "true", "yes", "on"}:
    @app.get("/debug/sysinfo")
    async def debug_sysinfo() -> Dict[str, Any]:  # pragma: no cover - dev aid only
        return {
            "cwd": os.getcwd(),
            "pythonpath_env": os.environ.get("PYTHONPATH"),
            "sys_path_head": sys.path[:20],
        }

LOGGER = logging.getLogger("cv_parser_service")
if not LOGGER.handlers:
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    handler.setFormatter(formatter)
    LOGGER.addHandler(handler)
LOGGER.setLevel(logging.INFO)

# Suppress noisy downstream logging that would drown service logs.
logging.getLogger("spacy").setLevel(logging.ERROR)
logging.getLogger("srsly").setLevel(logging.ERROR)

# Prevent OCR libraries from spawning too many worker threads.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("PADDLE_CPU_MATH_LIBRARY_NUM_THREADS", "1")


def _prewarm_ocr_engine() -> None:
    """Load the active OCR engine so that first requests are responsive."""
    global PREWARM_PENDING
    try:
        engine = _resolve_effective_ocr_engine()
        if engine == "paddle":
            _prewarm_paddle_safe()
            LOGGER.info("[startup] PaddleOCR prewarm complete")
        elif engine == "doctr":
            _prewarm_doctr_safe()
            LOGGER.info("[startup] docTR prewarm complete")
        else:
            LOGGER.info("[startup] OCR prewarm skipped (engine=%s)", engine)
    except Exception as exc:  # pragma: no cover - best effort
        LOGGER.warning("[startup] OCR prewarm failed: %s", exc)
    finally:
        with PREWARM_LOCK:
            PREWARM_PENDING = False


@app.on_event("startup")
async def _startup() -> None:
    global READY, PREWARM_PENDING

    # Explicit, low-noise startup flag log required by acceptance criteria
    LOGGER.info("[cv_parser_service] [startup] PREWARM=%s", "on" if DO_PREWARM else "off")
    engine_override = os.environ.get("CV_OCR_ENGINE", "").strip().lower()

    if DO_PREWARM:
        LOGGER.info("[startup] scheduling OCR prewarm (async)")
        if engine_override == "tesseract":
            LOGGER.info("[startup] CV_OCR_ENGINE=tesseract; skipping OCR warmup")
            with PREWARM_LOCK:
                PREWARM_PENDING = False
        else:
            with PREWARM_LOCK:
                PREWARM_PENDING = True
            threading.Thread(
                target=_prewarm_ocr_engine,
                name="ocr-prewarm",
                daemon=True,
            ).start()
    else:
        LOGGER.info("[startup] PREWARM disabled; skipping OCR prewarm")
        with PREWARM_LOCK:
            PREWARM_PENDING = False

    # Probe engines and decide selection
    threading.Thread(target=_refresh_ocr_selection, name="ocr-probe", daemon=True).start()
    READY = True


def _extract_pdf_text(path: Path, max_pages: int = 6) -> str:
    """Lightweight text fallback for PDFs when OCR yields nothing."""
    try:
        import pdfplumber  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dependency
        LOGGER.warning("[fallback] pdfplumber unavailable: %s", exc)
        return ""

    try:
        texts: list[str] = []
        with pdfplumber.open(path) as pdf:  # type: ignore[attr-defined]
            for page in pdf.pages[:max_pages]:
                page_text = page.extract_text() or ""
                page_text = page_text.strip()
                if page_text:
                    texts.append(page_text)
        combined = "\n".join(texts).strip()
        return combined
    except Exception as exc:  # pragma: no cover - defensive
        LOGGER.warning("[fallback] pdf text extraction failed: %s", exc)
        return ""


def _paddle_subprocess_ocr(source: Path, dpi_retry: int, lang: str) -> tuple[str, Dict[str, Any]]:
    """Invoke Paddle OCR via the guarded subprocess worker."""
    try:
        from cv_parser.extract.ocr_pdf import (  # type: ignore
            PaddleWorkerFailure,
            _run_paddle_in_worker,
        )
    except Exception as exc:  # pragma: no cover - defensive
        LOGGER.warning("[paddle-subproc] worker unavailable: %s", exc)
        return "", {
            "engine": "paddle",
            "failure_reason": "worker_import_failed",
            "error": str(exc),
            "ocr_blocks": 0,
            "ocr_chars": 0,
            "pdf_pages_rendered": 0,
        }

    lang_normalized = (lang or "en").strip() or "en"
    dpi_primary = min(max(DEFAULT_DPI - 40, 260), dpi_retry)
    dpi_secondary = max(dpi_retry, dpi_primary + 20)

    try:
        text, diagnostics = _run_paddle_in_worker(
            source,
            dpi_primary=dpi_primary,
            dpi_retry=dpi_secondary,
            lang=lang_normalized,
        )
    except PaddleWorkerFailure as worker_exc:
        reason = worker_exc.reason or "paddle_failure"
        LOGGER.warning("[paddle-subproc] worker failed: %s", reason)
        return "", {
            "engine": "paddle",
            "failure_reason": reason,
            "error": reason,
            "ocr_blocks": 0,
            "ocr_chars": 0,
            "pdf_pages_rendered": 0,
        }

    diagnostics = dict(diagnostics or {})
    diagnostics["engine"] = "paddle"
    diagnostics.setdefault("lang_hint", lang_normalized)
    diagnostics.setdefault("dpi_used", dpi_primary)
    diagnostics.setdefault("pdf_pages_rendered", diagnostics.get("pages", 0))
    diagnostics.setdefault("fallback_reason", diagnostics.get("failure_reason"))
    diagnostics["ocr_chars"] = len(text or "")
    return text or "", diagnostics


def _normalize_mode(value: Optional[Any]) -> Optional[str]:
    if value is None:
        return None
    candidate = str(value).strip().lower()
    if not candidate:
        return None
    if candidate not in ALLOWED_MODES:
        raise HTTPException(status_code=422, detail=f"Unsupported mode '{value}'")
    return candidate


def _resolve_effective_mode(
    json_mode: Optional[Any],
    query_mode: Optional[Any],
    raw_text: Optional[str],
    pdf_bytes: Optional[bytes],
) -> str:
    for source in (json_mode, query_mode):
        normalized = _normalize_mode(source)
        if normalized:
            return normalized
    if raw_text:
        return "text"
    if pdf_bytes:
        return "ocr"
    return "auto"


def _canonicalize_text(
    raw_text: str,
    diagnostics: Optional[Dict[str, Any]] = None,
    raw_sections: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    try:
        return canonicalize_cv(raw_text, mode="text", diagnostics=diagnostics, raw_sections=raw_sections)
    except Exception as exc:  # pragma: no cover - defensive
        LOGGER.exception("[text] canonicalize failed")
        fallback_diag = dict(diagnostics or {})
        fallback_diag["error"] = str(exc)
        fallback_diag["fallback_used"] = True
        return canonicalize_cv(raw_text or "", mode="text", diagnostics=fallback_diag, raw_sections=raw_sections)


def _select_family_scoped_ocr_raw_sections(
    ocr_raw_sections: List[Dict[str, Any]],
    use_ocr_raw_sections: bool,
) -> Tuple[Optional[List[Dict[str, str]]], List[str]]:
    if use_ocr_raw_sections:
        return (ocr_raw_sections or None), []

    carried: List[Dict[str, str]] = []
    carried_families: List[str] = []
    explicit_language_carried = False
    for section in ocr_raw_sections or []:
        label = str(section.get("label") or "").upper().strip()
        content = str(section.get("content") or "")
        if label == "EDUCATION" and has_parseable_education_markdown_table(content):
            region = extract_education_markdown_table_region(content)
            if not region:
                continue
            carried.append({"label": label, "content": region})
            carried_families.append("EDUCATION")
        elif label == "LANGUAGES" and has_parseable_language_markdown_table(content):
            region = extract_language_markdown_table_region(content)
            if not region:
                continue
            carried.append({"label": label, "content": region})
            carried_families.append("LANGUAGES")
            explicit_language_carried = True
    if not explicit_language_carried:
        for section in ocr_raw_sections or []:
            content = str(section.get("content") or "")
            if not has_parseable_language_markdown_table(content):
                continue
            region = extract_language_markdown_table_region(content)
            if not region:
                continue
            carried.append({"label": "LANGUAGES", "content": region})
            carried_families.append("LANGUAGES")
            break
    return (carried or None), carried_families


def _json_error(status_code: int, error_code: str, message: Optional[str] = None) -> JSONResponse:
    payload = {"ok": False, "error": error_code}
    if message:
        payload["message"] = message
    return JSONResponse(payload, status_code=status_code)


def _resolve_mistral_runtime() -> Tuple[Optional[str], Optional[str], Optional[JSONResponse]]:
    enabled_flag = os.environ.get("API_ENABLE_MISTRAL_OCR", "")
    if not _truthy(enabled_flag):
        return None, None, _json_error(status.HTTP_503_SERVICE_UNAVAILABLE, "mistral_ocr_disabled")

    api_key = (os.environ.get("MISTRAL_API_KEY") or "").strip()
    if not api_key:
        return None, None, _json_error(status.HTTP_503_SERVICE_UNAVAILABLE, "mistral_api_key_missing")

    model = (os.environ.get("MISTRAL_OCR_MODEL") or "mistral-ocr-latest").strip() or "mistral-ocr-latest"
    return api_key, model, None


async def _resolve_mistral_payload(
    file: UploadFile | None,
    url_value: Optional[str],
) -> Tuple[Optional[Dict[str, Any]], Optional[JSONResponse]]:
    if file is not None and url_value:
        return None, _json_error(status.HTTP_400_BAD_REQUEST, "mixed_payload")

    if file is not None:
        data = await file.read()
        if not data:
            return None, _json_error(status.HTTP_400_BAD_REQUEST, "empty_upload")
        return (
            {
                "kind": "file",
                "file_name": getattr(file, "filename", None),
                "content_type": getattr(file, "content_type", None),
                "data": data,
            },
            None,
        )

    if url_value:
        candidate = url_value.strip()
        if not candidate:
            return None, _json_error(status.HTTP_400_BAD_REQUEST, "invalid_url")
        parsed = urlparse(candidate)
        if parsed.scheme.lower() not in {"http", "https"}:
            return None, _json_error(status.HTTP_400_BAD_REQUEST, "invalid_url_scheme")
        return ({"kind": "url", "url": candidate}, None)

    return None, _json_error(status.HTTP_400_BAD_REQUEST, "empty_payload")


async def _call_mistral_ocr(payload: Dict[str, Any], api_key: str, model_name: Optional[str]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if payload.get("kind") == "file":
        return await asyncio.to_thread(
            run_mistral_ocr_from_bytes,
            file_name=payload.get("file_name"),
            content_type=payload.get("content_type"),
            data=payload.get("data", b""),
            api_key=api_key,
            model_name=model_name,
        )
    return await asyncio.to_thread(
        run_mistral_ocr_from_url,
        url=payload.get("url"),
        api_key=api_key,
        model_name=model_name,
    )


def _canonicalize_ocr(
    pdf_bytes: bytes,
    diagnostics_seed: Optional[Dict[str, Any]] = None,
    text_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    global OCR_READY
    temp_path: Optional[Path] = None
    text_output = ""
    diag_seed = dict(diagnostics_seed) if isinstance(diagnostics_seed, dict) else {}
    diagnostics: Dict[str, Any] = dict(diag_seed)
    fallback_attempted = False
    params = text_params or {}
    option_notes: Dict[str, Any] = {}
    ocr_kwargs: Dict[str, Any] = {}
    fallback_max_pages: Optional[int] = None
    start_time = time.perf_counter()
    disable_backfill = os.environ.get("CV_OCR_DISABLE_PADDLE_FALLBACK", "").strip().lower() in {"1", "true", "yes", "on"}

    def _apply_option_notes(target: Dict[str, Any]) -> None:
        if option_notes:
            section = target.setdefault("text_options", {})
            for key, value in option_notes.items():
                section[key] = value

    def _finalize(text_value: str, diag: Dict[str, Any]) -> Dict[str, Any]:
        duration = time.perf_counter() - start_time
        _record_ocr_metrics(diag, duration)
        return canonicalize_cv(text_value, mode="ocr", diagnostics=diag)

    if isinstance(pdf_bytes, (bytes, bytearray)) and not pdf_bytes.startswith(b"%PDF"):
        text_payload = pdf_bytes.decode("utf-8", errors="ignore")
        diagnostics.setdefault("engine", "text")
        diagnostics["engine_final"] = "text"
        diagnostics["fallback_used"] = False
        diagnostics.setdefault("non_pdf_payload", True)
        if "debug" not in diagnostics and "debug" in diag_seed:
            diagnostics["debug"] = diag_seed["debug"]
        _apply_option_notes(diagnostics)
        return canonicalize_cv(text_payload, mode="text", diagnostics=diagnostics)

    if params:
        raw_dpi = params.get("dpi")
        if raw_dpi is not None:
            try:
                dpi_int = int(str(raw_dpi).strip())
                if dpi_int > 0:
                    ocr_kwargs["dpi_primary"] = dpi_int
                    ocr_kwargs["dpi_retry"] = max(dpi_int, dpi_int + 40)
                    option_notes["dpi"] = dpi_int
                else:
                    option_notes["dpi_ignored"] = raw_dpi
            except (TypeError, ValueError):
                option_notes["dpi_error"] = str(raw_dpi)

        raw_lang = params.get("lang_hint")
        if isinstance(raw_lang, str) and raw_lang.strip():
            lang_clean = raw_lang.strip()
            ocr_kwargs["lang"] = lang_clean
            option_notes["lang_hint"] = lang_clean

        raw_max_pages = params.get("max_pages")
        if raw_max_pages is not None:
            try:
                limit = int(str(raw_max_pages).strip())
                if limit > 0:
                    fallback_max_pages = limit
                    option_notes["max_pages"] = limit
                else:
                    option_notes["max_pages_ignored"] = raw_max_pages
            except (TypeError, ValueError):
                option_notes["max_pages_error"] = str(raw_max_pages)

        ignored_keys = sorted(
            key for key in params.keys() if key not in {"dpi", "lang_hint", "max_pages"}
        )
        if ignored_keys:
            option_notes["ignored_params"] = ignored_keys

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            temp_path = Path(tmp.name)

        allow_doctr_arm = os.environ.get("CV_ALLOW_DOCTR_ON_ARM", "").strip().lower() in {"1", "true", "yes", "on"}
        if OCR_ENGINE == "doctr" and platform.machine().lower() in {"arm64", "aarch64"}:
            # Always allow docTR on ARM64 when explicitly requested; caller controls backend via DOCTR_BACKEND
            if allow_doctr_arm:
                option_notes.setdefault("engine_guard", "doctr_arm64_allowed")
            else:
                option_notes.setdefault("engine_guard", "doctr_arm64_forced")

        try:
            text_output, ocr_diag = ocr_extract_text_from_pdf(temp_path, **ocr_kwargs)
            if isinstance(ocr_diag, dict):
                diagnostics.update(ocr_diag)
            if "debug" not in diagnostics and "debug" in diag_seed:
                diagnostics["debug"] = diag_seed["debug"]
            diagnostics.setdefault("pdf_valid", True)
        except BaseException as exc:  # pragma: no cover - defensive
            LOGGER.exception("[ocr] extraction failed")
            diagnostics = dict(diag_seed)
            diagnostics["engine"] = OCR_ENGINE
            diagnostics["error"] = str(exc)
            text_output = ""

        text_output = (text_output or "").strip()
        if not text_output:
            engine_label = str(diagnostics.get("engine_final") or diagnostics.get("engine") or "").lower()
            enforce_no_fallback = disable_backfill and engine_label in {"paddle", "paddle_subproc"}
            if enforce_no_fallback:
                diagnostics["engine_final"] = diagnostics.get("engine_final") or "doctr"
                diagnostics.setdefault("engine", OCR_ENGINE)
                diagnostics.setdefault("failure_reason", diagnostics.get("failure_reason") or "doctr_empty")
            else:
                fallback_attempted = True
                fallback_limit = fallback_max_pages or 6
                fallback_text = _extract_pdf_text(temp_path, max_pages=fallback_limit)
                option_notes.setdefault("fallback_max_pages", fallback_limit)
                text_output = fallback_text or ""
                diagnostics.setdefault("engine", OCR_ENGINE)
                diagnostics["engine_final"] = "pdfplumber"
                if fallback_text:
                    diagnostics["ocr_chars"] = len(text_output)
                    diagnostics["fallback_reason"] = diagnostics.get("failure_reason") or "doctr_failure"
                else:
                    diagnostics["fallback_reason"] = diagnostics.get("failure_reason") or "doctr_empty"

        diagnostics = diagnostics or {}
        diagnostics["fallback_used"] = bool(diagnostics.get("fallback_used")) or fallback_attempted
        dpi_value = diagnostics.get("dpi_used")
        if not isinstance(dpi_value, (int, float)) or dpi_value <= 0:
            diagnostics["dpi_used"] = DEFAULT_DPI
        rendered_pages = diagnostics.get("pages")
        if isinstance(rendered_pages, int):
            diagnostics["pdf_pages_rendered"] = rendered_pages
            diagnostics.setdefault("pdf_pages", rendered_pages)
        else:
            diagnostics["pdf_pages_rendered"] = diagnostics.get("pdf_pages_rendered", 0)
        retry_value = diagnostics.get("ocr_retry_count")
        if retry_value is None:
            retry_value = diagnostics.get("retry_count") or diagnostics.get("retries")
        try:
            diagnostics["ocr_retry_count"] = int(retry_value or 0)
        except (TypeError, ValueError):
            diagnostics["ocr_retry_count"] = 0
        _apply_option_notes(diagnostics)

        final_engine = diagnostics.get("engine_final") or diagnostics.get("engine") or OCR_ENGINE
        diagnostics["engine_final"] = final_engine
        diagnostics.setdefault("engine_attempted", OCR_ENGINE)
        if final_engine in {"doctr", "paddle", "paddle_subproc"}:
            OCR_READY = True

        return _finalize(text_output, diagnostics)
    except BaseException as exc:  # pragma: no cover - defensive
        LOGGER.exception("[ocr] canonicalize failed")
        fallback_diag = dict(diagnostics or diag_seed)
        fallback_diag.setdefault("engine", OCR_ENGINE)
        fallback_diag["error"] = str(exc)
        fallback_diag["fallback_used"] = True
        fallback_diag.setdefault("dpi_used", DEFAULT_DPI)
        if "debug" not in fallback_diag and "debug" in diag_seed:
            fallback_diag["debug"] = diag_seed["debug"]
        _apply_option_notes(fallback_diag)
        fallback_diag.setdefault("engine_attempted", OCR_ENGINE)
        fallback_diag["engine_final"] = fallback_diag.get("engine_final") or "fallback_text"
        return _finalize(text_output or "", fallback_diag)
    finally:
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


@app.post("/parse-cv")
async def parse_cv(
    request: Request,
    file: UploadFile | None = File(None),
    text: Optional[str] = Body(None),
    mode: Optional[str] = Query(None),
    force_ocr: Optional[bool] = Query(None),
) -> Dict[str, Any]:
    """Unified endpoint for text and OCR canonicalization."""
    content_type = (request.headers.get("content-type") or "").lower()

    raw_text: Optional[str] = text.strip() if isinstance(text, str) and text else text
    pdf_bytes: Optional[bytes] = None
    json_mode: Optional[str] = None

    json_payload_keys: Optional[List[str]] = None

    text_param_overrides: Dict[str, Any] = {}
    ignored_param_names: set[str] = set()
    file_was_text = False
    force_ocr_flag = bool(force_ocr) if force_ocr is not None else False
    uploaded_filename: Optional[str] = None

    def _record_param(name: str, value: Any, known_keys: set[str]) -> None:
        key_lower = str(name).lower()
        if key_lower in TEXT_PARAM_KEYS:
            if isinstance(value, (UploadFile, StarletteUploadFile)):
                ignored_param_names.add(key_lower)
                return
            text_param_overrides[key_lower] = value
        elif key_lower not in known_keys:
            ignored_param_names.add(key_lower)

    if file is not None:
        uploaded_filename = str(getattr(file, "filename", "") or "")
        file_bytes = await file.read()
        if file_bytes and _is_pdf_payload(file_bytes):
            pdf_bytes = bytes(file_bytes)
        elif file_bytes:
            raw_text = (file_bytes or b"").decode("utf-8", errors="ignore")
            file_was_text = True
        else:
            pdf_bytes = b""

    if content_type.startswith("application/json"):
        try:
            body_bytes = await request.body()
        except Exception as exc:
            diag = {
                "route": "invalid",
                "route_reason": "json_read_error",
                "engine": "text",
                "error": f"Unable to read JSON payload ({exc})",
            }
            ROUTE_COUNTER.labels(route="invalid").inc()
            return _failure_response(diag)
        payload: Any = {}
        if body_bytes:
            try:
                payload = json.loads(body_bytes.decode("utf-8"))
            except json.JSONDecodeError as exc:
                diag = {
                    "route": "invalid",
                    "route_reason": "invalid_json",
                    "engine": "text",
                    "error": f"Invalid JSON payload ({exc})",
                    "payload_preview": body_bytes[:120].decode("utf-8", errors="ignore"),
                }
                ROUTE_COUNTER.labels(route="invalid").inc()
                return _failure_response(diag)
        if isinstance(payload, dict):
            json_payload_keys = list(payload.keys())
            json_mode = payload.get("mode")
            for key, value in payload.items():
                _record_param(key, value, KNOWN_JSON_KEYS)
            if not force_ocr_flag and _truthy(payload.get("force_ocr")):
                force_ocr_flag = True
            for key in ("rawText", "raw_text", "raw", "text"):
                if raw_text is not None:
                    break
                if key in payload and payload[key] is not None:
                    candidate = payload[key]
                    if isinstance(candidate, (bytes, bytearray)):
                        raw_text = bytes(candidate).decode("utf-8", errors="ignore")
                    else:
                        raw_text = str(candidate)
        else:
            json_payload_keys = []
    elif content_type.startswith("application/pdf"):
        body_bytes = await request.body()
        if _is_pdf_payload(body_bytes):
            pdf_bytes = bytes(body_bytes)
        else:
            raw_text = (body_bytes or b"").decode("utf-8", errors="ignore")
            file_was_text = True
    elif "multipart/form-data" in content_type and file is None:
        try:
            form = await request.form()
        except Exception as exc:
            diag = {
                "route": "invalid",
                "route_reason": "form_parse_error",
                "engine": "text",
                "error": f"Form parsing failed ({exc})",
            }
            ROUTE_COUNTER.labels(route="invalid").inc()
            return _failure_response(diag)
        if "mode" in form:
            json_mode = form.get("mode")
        force_candidate = form.get("force_ocr")
        if force_candidate is not None and _truthy(force_candidate):
            force_ocr_flag = True
        for key, value in form.multi_items():
            _record_param(key, value, KNOWN_FORM_KEYS)
        for key in ("raw_text", "rawText", "raw", "text"):
            if raw_text is not None:
                break
            if key in form and form[key] is not None:
                raw_candidate = form.get(key)
                _record_param(key, raw_candidate, KNOWN_FORM_KEYS)
                if isinstance(raw_candidate, (UploadFile, StarletteUploadFile)):
                    raw_bytes = await raw_candidate.read()
                    raw_text = raw_bytes.decode("utf-8", errors="ignore")
                elif isinstance(raw_candidate, (bytes, bytearray)):
                    raw_text = bytes(raw_candidate).decode("utf-8", errors="ignore")
                else:
                    raw_text = str(raw_candidate)
        file_candidate = form.get("file")
        if isinstance(file_candidate, (UploadFile, StarletteUploadFile)):
            file_bytes = await file_candidate.read()
            filename = str(getattr(file_candidate, "filename", "") or "")
            filename_lower = filename.lower()
            uploaded_filename = filename
            LOGGER.debug(
                "[parse-cv] form file filename=%s size=%s",
                filename,
                len(file_bytes) if isinstance(file_bytes, (bytes, bytearray)) else 0,
            )
            if _is_pdf_payload(file_bytes) and not filename_lower.endswith((".json", ".txt", ".md", ".csv")):
                pdf_bytes = file_bytes
            else:
                decoded = (file_bytes or b"").decode("utf-8", errors="ignore")
                if raw_text:
                    raw_text = f"{raw_text}\n{decoded}" if decoded else raw_text
                else:
                    raw_text = decoded
                pdf_bytes = None
                file_was_text = True
        elif isinstance(file_candidate, (bytes, bytearray)):
            file_bytes = bytes(file_candidate)
            if _is_pdf_payload(file_bytes):
                pdf_bytes = file_bytes
            else:
                decoded = file_bytes.decode("utf-8", errors="ignore")
                if raw_text:
                    raw_text = f"{raw_text}\n{decoded}" if decoded else raw_text
                else:
                    raw_text = decoded
                pdf_bytes = None
                file_was_text = True
    elif file is None:
        body_bytes = await request.body()
        if body_bytes:
            if content_type in ("", "application/octet-stream"):
                if body_bytes[:4] == b"%PDF":
                    pdf_bytes = body_bytes
                else:
                    raw_text = body_bytes.decode("utf-8", errors="ignore")
            elif raw_text is None and pdf_bytes is None:
                raw_text = body_bytes.decode("utf-8", errors="ignore")

    query_mode = mode if mode is not None else request.query_params.get("mode")
    for key, value in request.query_params.multi_items():
        key_lower = key.lower()
        if key_lower == "mode":
            continue
        _record_param(key, value, KNOWN_QUERY_KEYS)
        if key_lower == "force_ocr" and not force_ocr_flag and _truthy(value):
            force_ocr_flag = True
    effective_mode = _resolve_effective_mode(json_mode, query_mode, raw_text, pdf_bytes)

    if effective_mode == "auto":
        effective_mode = "ocr" if pdf_bytes else "text"

    pdf_valid = _is_pdf_payload(pdf_bytes)
    if not pdf_valid:
        if pdf_bytes:
            decoded_payload = pdf_bytes.decode("utf-8", errors="ignore")
            LOGGER.debug("[parse-cv] decoded non-pdf bytes len=%s", len(decoded_payload))
            if raw_text:
                raw_text = f"{raw_text}\n{decoded_payload}" if decoded_payload else raw_text
            else:
                raw_text = decoded_payload
            file_was_text = True
        pdf_bytes = None
        effective_mode = "text"

    normalized_json_mode = _normalize_mode(json_mode) if json_mode is not None else None
    normalized_query_mode = _normalize_mode(query_mode) if query_mode is not None else None
    explicit_mode = None
    explicit_mode_source = None
    if normalized_json_mode:
        explicit_mode = normalized_json_mode
        explicit_mode_source = "json"
    elif normalized_query_mode:
        explicit_mode = normalized_query_mode
        explicit_mode_source = "query"

    original_pdf_supplied = bool(pdf_bytes)
    pdf_text_len = 0
    pdf_pages = 0
    text_density = 0.0
    pdf_analysis_error: Optional[str] = None
    pdf_analysis_text = ""
    if pdf_bytes:
        analysis = _analyze_pdf_bytes(pdf_bytes)
        pdf_text_len = int(analysis.get("text_len") or 0)
        pdf_pages = int(analysis.get("pages") or 0)
        text_density = float(analysis.get("density") or 0.0)
        pdf_analysis_error = analysis.get("error")
        pdf_analysis_text = analysis.get("text") or ""

    route_label = "unknown"
    route_reason = "unknown"
    if force_ocr_flag:
        route_label = "override"
        route_reason = "force_ocr"
        effective_mode = "ocr"
    elif explicit_mode:
        route_label = "override"
        route_reason = f"mode:{explicit_mode_source or 'explicit'}"
        if explicit_mode == "auto":
            effective_mode = "ocr" if pdf_bytes else "text"
        else:
            effective_mode = explicit_mode
    elif not pdf_bytes:
        route_label = "non_pdf_text"
        route_reason = "non_pdf"
        effective_mode = "text"
    else:
        if (pdf_text_len >= 500 or text_density >= 80) and pdf_analysis_text.strip():
            route_label = "pdf_has_text"
            route_reason = "pdf_has_text"
            raw_text = pdf_analysis_text
            pdf_bytes = None
            file_was_text = True
            effective_mode = "text"
        else:
            route_label = "pdf_image_only"
            route_reason = "analysis_error" if pdf_analysis_error else "pdf_image_only"
            effective_mode = "ocr"

    override_note: Optional[str] = None
    if effective_mode == "ocr" and not pdf_bytes:
        if raw_text:
            route_label = "non_pdf_text"
            route_reason = "mode_override_no_file"
            override_note = "mode=ocr but no file; routed to text"
            effective_mode = "text"
        else:
            route_label = "invalid"
            route_reason = "no_payload"

    file_upload_mode_value = (
        "text"
        if file_was_text or (effective_mode == "text" and not original_pdf_supplied)
        else "ocr"
    )
    if effective_mode == "text" and raw_text is None and pdf_analysis_text:
        raw_text = pdf_analysis_text

    ROUTE_COUNTER.labels(route=route_label).inc()

    debug_info = {
        "content_type": content_type,
        "json_keys": json_payload_keys,
        "raw_len": len(raw_text) if isinstance(raw_text, str) else 0,
        "pdf_len": len(pdf_bytes) if isinstance(pdf_bytes, (bytes, bytearray)) else 0,
        "effective_mode": effective_mode,
        "pdf_valid": pdf_valid,
        "pdf_text_len": pdf_text_len,
        "pdf_pages": pdf_pages,
        "text_density": round(text_density, 2),
        "route": route_label,
        "route_reason": route_reason,
        "file_upload_mode": file_upload_mode_value,
        "force_ocr": force_ocr_flag,
    }
    if override_note:
        debug_info["note"] = override_note
    if pdf_analysis_error:
        debug_info["pdf_text_error"] = pdf_analysis_error
    if uploaded_filename:
        debug_info["filename"] = uploaded_filename
    if text_param_overrides:
        debug_info["text_params"] = {
            key: str(text_param_overrides.get(key)) for key in sorted(text_param_overrides)
        }
    if ignored_param_names:
        debug_info["ignored_params"] = sorted(ignored_param_names)
    LOGGER.info("[parse-cv] request debug=%s", debug_info)

    base_diag = {
        "debug": debug_info,
        "pdf_valid": pdf_valid,
        "pdf_text_len": pdf_text_len,
        "pdf_pages": pdf_pages,
        "text_density": round(text_density, 2),
        "route": route_label,
        "route_reason": route_reason,
        "file_upload_mode": file_upload_mode_value,
        "ocr_retry_count": 0,
        "pdf_pages_rendered": 0,
        "pdf_text_error": pdf_analysis_error,
    }

    if effective_mode == "text":
        diag_payload = dict(base_diag)
        diag_payload["engine"] = "text"
        diag_payload["engine_final"] = "text"
        diag_payload.setdefault("ocr_retry_count", 0)
        if override_note:
            diag_payload.setdefault("note", override_note)
        if raw_text is None:
            diag_payload.update({
                "route": "invalid",
                "route_reason": "missing_text",
                "error": "text_payload_missing",
            })
            ROUTE_COUNTER.labels(route="invalid").inc()
            return _failure_response(diag_payload)
        raw_candidate = raw_text.strip()
        if not raw_candidate:
            diag_payload.update({
                "route": "invalid",
                "route_reason": "empty_text",
                "error": "text_payload_empty",
            })
            ROUTE_COUNTER.labels(route="invalid").inc()
            return _failure_response(diag_payload)
        LOGGER.info(
            "[parse-cv] TEXT debug=%s raw=%r",
            debug_info,
            (raw_text[:120] + "...") if len(raw_text) > 120 else raw_text,
        )
        try:
            canonical_payload = canonicalize_cv(raw_text, mode="text", diagnostics=diag_payload)
        except Exception as exc:
            diag_payload["error"] = str(exc)
            ROUTE_COUNTER.labels(route="invalid").inc()
            return _failure_response(diag_payload)
        enveloped = dict(canonical_payload)
        enveloped.update(
            {
                "ok": True,
                "normalized": canonical_payload.get("normalized"),
                "sections": canonical_payload.get("rawSections") or [],
                "diagnostics": canonical_payload.get("diagnostics") or diag_payload,
                "summary": canonical_payload.get("summary"),
                "summaryFirstSentence": canonical_payload.get("summaryFirstSentence"),
            }
        )
        enveloped["result"] = canonical_payload
        return enveloped

    if effective_mode == "ocr":
        if not pdf_bytes:
            diag_payload = dict(base_diag)
            diag_payload.update({
                "route": "invalid",
                "route_reason": "missing_pdf",
                "engine": "paddle",
                "engine_final": "paddle",
                "error": "pdf_payload_missing",
            })
            ROUTE_COUNTER.labels(route="invalid").inc()
            return _failure_response(diag_payload)
        if len(pdf_bytes) == 0:
            diag_payload = dict(base_diag)
            diag_payload.update({
                "route": "invalid",
                "route_reason": "empty_pdf",
                "engine": "paddle",
                "engine_final": "paddle",
                "error": "pdf_payload_empty",
            })
            ROUTE_COUNTER.labels(route="invalid").inc()
            return _failure_response(diag_payload)
        diag_payload = dict(base_diag)
        # Ensure engine selection is up-to-date
        _refresh_ocr_selection()
        requested_engine = OCR_STATE.get("requested") or OCR_ENGINE
        selected_engine = OCR_STATE.get("selected")
        available_map = OCR_STATE.get("available", {})
        selected_available = True
        try:
            machine_arch = platform.machine().lower()
        except Exception:
            machine_arch = ""

        if selected_engine not in {"doctr", "paddle", "paddle_subproc"}:
            if available_map.get("paddle"):
                selected_engine = "paddle_subproc" if machine_arch in {"arm64", "aarch64"} else "paddle"
            else:
                selected_engine = "pdfplumber"

        if selected_engine == "doctr":
            is_arm = machine_arch in {"arm64", "aarch64"}
            # Force docTR path when explicitly requested, even if probe failed
            selected_available = bool(available_map.get("doctr"))
        elif selected_engine in {"paddle", "paddle_subproc"}:
            selected_available = bool(available_map.get("paddle"))

        # If request explicitly asked for docTR, force docTR execution path
        if requested_engine == "doctr":
            selected_engine = "doctr"
            env_engine = "doctr"
        else:
            env_engine = "paddle_subproc" if selected_engine == "paddle_subproc" else selected_engine
        LOGGER.info("[ocr] engine='%s' mode='%s'", selected_engine, effective_mode)
        # Temporarily override env to force desired engine for this call
        prev_env = os.environ.get("CV_OCR_ENGINE")
        os.environ["CV_OCR_ENGINE"] = env_engine
        try:
            if selected_engine == "doctr" and not selected_available:
                # docTR unavailable: fall back to pdfplumber text extraction and return canonical text payload.
                fallback_text = ""
                temp_pdf_path: Optional[Path] = None
                try:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_pdf:
                        tmp_pdf.write(pdf_bytes)
                        temp_pdf_path = Path(tmp_pdf.name)
                    fallback_text = _extract_pdf_text(temp_pdf_path)
                finally:
                    if temp_pdf_path and temp_pdf_path.exists():
                        try:
                            temp_pdf_path.unlink()
                        except OSError:
                            pass
                if not fallback_text.strip():
                    fallback_text = "doctr unavailable; pdf text not detected"
                diag_payload.update({
                    "engine": "doctr",
                    "engine_final": "pdfplumber",
                    "failure_reason": "doctr_unavailable",
                    "pdf_pages_rendered": diag_payload.get("pdf_pages", 0),
                    "ocr_retry_count": int(diag_payload.get("ocr_retry_count") or 0),
                })
                diag_payload["pdf_text_len"] = len(fallback_text)
                canonical_payload = canonicalize_cv(fallback_text or "", mode="text", diagnostics=diag_payload)
            else:
                canonical_payload = _canonicalize_ocr(
                    pdf_bytes,
                    diag_payload,
                    text_param_overrides,
                )
        except Exception as exc:  # pragma: no cover - defensive
            diag_payload.update({
                "engine": requested_engine,
                "engine_final": selected_engine,
                "error": str(exc),
            })
            ROUTE_COUNTER.labels(route="invalid").inc()
            return _failure_response(diag_payload)
        finally:
            if prev_env is None:
                os.environ.pop("CV_OCR_ENGINE", None)
            else:
                os.environ["CV_OCR_ENGINE"] = prev_env
        enveloped = dict(canonical_payload)
        # Normalize diagnostics to reflect requested vs selected
        diag = enveloped.get("diagnostics") or {}
        if isinstance(diag, dict):
            diag.setdefault("engine", requested_engine)
            diag.setdefault("engine_final", "paddle" if selected_engine == "paddle_subproc" else selected_engine)
            engine_final_label = str(diag.get("engine_final") or "text").lower()
            if engine_final_label not in {"text", "doctr", "paddle", "pdfplumber"}:
                engine_final_label = "text"
            diag["engine_final"] = engine_final_label
            engine_label = str(diag.get("engine") or requested_engine).lower()
            if engine_label not in {"text", "doctr", "paddle", "pdfplumber"}:
                engine_label = "text"
            diag["engine"] = engine_label
            enveloped["diagnostics"] = diag
        enveloped.update(
            {
                "ok": True,
                "normalized": canonical_payload.get("normalized"),
                "sections": canonical_payload.get("rawSections") or [],
                "diagnostics": canonical_payload.get("diagnostics") or diag_payload,
                "summary": canonical_payload.get("summary"),
                "summaryFirstSentence": canonical_payload.get("summaryFirstSentence"),
            }
        )
        enveloped["result"] = canonical_payload
        return enveloped

    diag_payload = dict(base_diag)
    diag_payload.update({
        "route": "invalid",
        "route_reason": f"unsupported_mode:{effective_mode}",
        "engine": diag_payload.get("engine") or "text",
        "engine_final": diag_payload.get("engine_final") or diag_payload.get("engine") or "text",
        "error": f"unsupported_mode:{effective_mode}",
    })
    ROUTE_COUNTER.labels(route="invalid").inc()
    return _failure_response(diag_payload)


@app.post("/api/v1/document-export/resume/pdf")
async def export_resume_pdf(payload: Dict[str, Any] = Body(...)) -> Response:
    return create_document_export_response(
        payload,
        expected_kind="resume",
        expected_format="pdf",
        fallback_filename_base="Resume - ATS",
    )


@app.post("/api/v1/document-export/proposal/pdf")
async def export_proposal_pdf(payload: Dict[str, Any] = Body(...)) -> Response:
    return create_document_export_response(
        payload,
        expected_kind="proposal",
        expected_format="pdf",
        fallback_filename_base="Proposal - Styled",
    )


@app.post("/api/v1/document-export/proposal/docx")
async def export_proposal_docx(payload: Dict[str, Any] = Body(...)) -> Response:
    return create_document_export_response(
        payload,
        expected_kind="proposal",
        expected_format="docx",
        fallback_filename_base="Proposal - Editable",
    )


@app.get("/healthz")
async def healthz() -> Dict[str, bool]:
    """Simple readiness probe."""
    return {"ok": True}
