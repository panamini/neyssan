"""OCR extraction path powered by PaddleOCR and docTR OCR components.

Includes an opt-in Tesseract fallback for environments where neural OCR
may be unavailable. The fallback engages only when explicitly enabled via
`CV_TESSERACT_FALLBACK=1` and safe OCR attempts fail.

Engine selection:
  - `CV_OCR_ENGINE=auto|paddle|doctr|tesseract`
    auto → picks `doctr` on macOS/ARM64, otherwise `paddle`, with fallbacks enabled.
    paddle → use PaddleOCR (worker process) with built-in fallbacks.
    doctr → run docTR (subprocess) without automatic Paddle fallback.
    tesseract → skip neural OCR and fall back directly to pdfplumber/tesseract.
"""
from __future__ import annotations

import faulthandler
import hashlib
import io
import json
import logging
import os
import platform
import queue
import shutil
import socket
import site
import subprocess
import sys
import tempfile
import threading
from abc import ABC, abstractmethod
from contextlib import contextmanager
from collections import defaultdict
from itertools import count
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Sequence, Tuple, Union
import textwrap

import numpy as np
import pdfplumber

from ..pipeline import hybrid_mapping
from ..schema.model import (
    ArrayItem,
    LayoutBlock,
    LayoutResult,
    NormalizedCv,
    PipelineResult,
    StrictContact,
    TextField,
)
from .bbox import normalize_bbox
from .sections import parse_sections, split_tokens

try:  # pragma: no cover - optional import
    import cv_parser_service.main as _cvps_main  # type: ignore
except Exception:  # pragma: no cover - service not present
    _cvps_main = None



log = logging.getLogger(__name__)

LATIN_HINT_TOKENS = (
    # French
    "expérience", "experiences", "formation", "langues", "profil", "résumé", "resume",
    # Spanish
    "experiencia", "educación", "formación", "idiomas", "perfil",
    # Italian
    "esperienza", "formazione", "lingue", "profilo",
    # German
    "erfahrung", "bildung", "sprachen", "profil",
)

def _should_prefer_latin_recognizer(pdf_path: Path) -> bool:
    """Heuristic: if the PDF text contains FR/ES/IT/DE headings/words, prefer Latin rec model.

    This is a lightweight signal and only applies when CV_OCR_REC_NAME is unset.
    """
    try:
        import pdfplumber  # type: ignore
    except Exception:
        return False
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:  # type: ignore[attr-defined]
            for page in pdf.pages[:2]:
                text = (page.extract_text() or "").lower()
                if not text:
                    continue
                for token in LATIN_HINT_TOKENS:
                    if token in text:
                        return True
    except Exception:
        return False
    return False


PdfLike = Union[str, os.PathLike[str], os.PathLike[bytes], Path, bytes, bytearray, memoryview]

MIN_OCR_BLOCKS = 4

IS_ARM64 = platform.machine().lower() in {"aarch64", "arm64"}

_DEFAULT_WORKER_LIB_DIR = "/usr/lib/aarch64-linux-gnu"


def _compute_default_ocr_engine() -> str:
    system = platform.system().lower()
    arch = platform.machine().lower()
    if arch in {"arm64", "aarch64"} or system == "darwin":
        return "doctr"
    return "paddle"


_DEFAULT_OCR_ENGINE = _compute_default_ocr_engine()


def _serial_openblas_candidates() -> Sequence[str]:
    arch = platform.machine().lower()
    if arch in {"arm64", "aarch64"}:
        return (
            "/usr/lib/aarch64-linux-gnu/blas/libopenblas.so.0",
            "/usr/lib/aarch64-linux-gnu/libopenblas.so.0",
            os.path.join(_DEFAULT_WORKER_LIB_DIR, "blas", "libopenblas.so.0"),
        )
    if arch in {"x86_64", "amd64"}:
        return (
            "/usr/lib/x86_64-linux-gnu/blas/libopenblas.so.0",
            "/usr/lib/x86_64-linux-gnu/libopenblas.so.0",
        )
    return ()


def _detect_default_serial_openblas() -> str:
    for candidate in _serial_openblas_candidates():
        if os.path.isfile(candidate):
            return candidate
    arch = platform.machine().lower()
    if arch in {"arm64", "aarch64"}:
        fallback = os.path.join(_DEFAULT_WORKER_LIB_DIR, "libopenblas_openmp.so.0")
        if os.path.isfile(fallback):
            return fallback
    return ""


_DEFAULT_WORKER_OPENBLAS = _detect_default_serial_openblas()
_WORKER_ENV_PATCH_LOGGED = False
_WORKER_DIAG_EMITTED = False
_ENGINE_CACHE: Dict[str, "OCREngine"] = {}
TRUE_VALUES = {"1", "true", "yes", "on"}
_DOCTR_SITE_PACKAGES = Path(os.environ.get("CV_DOCTR_SITE_PACKAGES", "/opt/doctr"))
_DOCTR_PATH_ADDED = False


def _ensure_doctr_site() -> None:
    global _DOCTR_PATH_ADDED
    if _DOCTR_PATH_ADDED:
        return
    path = _DOCTR_SITE_PACKAGES
    if not path or not path.is_dir():
        return
    try:
        site.addsitedir(str(path))
        _DOCTR_PATH_ADDED = True
    except Exception:  # pragma: no cover - defensive
        logging.getLogger(__name__).debug("Unable to register docTR site-packages: %s", path, exc_info=True)


_ensure_doctr_site()


def _python_candidate_order(explicit: Optional[str]) -> list[str]:
    """Produce interpreter candidates honoring explicit → env → sys order."""
    seen: set[str] = set()
    candidates: list[str] = []

    def _append(path: Optional[str]) -> None:
        if not path:
            return
        if path in seen:
            return
        seen.add(path)
        candidates.append(path)

    _append(explicit)
    _append(os.environ.get("DOCTR_PY"))
    _append(sys.executable)
    return candidates


def _run_doctr_ocr_subproc(
    images: Sequence["Image.Image"],
    *,
    python_path: Optional[str],
    timeout_sec: float,
    det_arch: str,
    reco_arch: str,
    assume_straight: bool,
    detect_orientation: Optional[bool],
    straighten_pages: Optional[bool],
    lang: str,
    framework: Optional[str],
) -> tuple[str, Dict[str, Any]]:
    """Execute docTR OCR in a subprocess and return flat diagnostics."""

    diagnostics: Dict[str, Any] = {
        "engine": "doctr",
        "engine_final": "doctr",
        "lang_hint": lang,
        "ocr_blocks": 0,
        "ocr_chars": 0,
        "ocr_tokens": 0,
        "pages": len(images),
        "pdf_pages_rendered": len(images),
    }
    if framework:
        diagnostics["doctr_framework"] = framework

    if not images:
        diagnostics["failure_reason"] = "doctr_empty"
        DOCTR_EMPTY_COUNTER.inc()
        return "", diagnostics

    try:
        from PIL import Image  # noqa: F401  # pragma: no cover - imported for type checking
    except Exception:
        pass

    with tempfile.TemporaryDirectory(prefix="doctr_") as tmpdir:
        tmp_path = Path(tmpdir)
        image_paths: list[str] = []
        for idx, image in enumerate(images, start=1):
            img_path = tmp_path / f"page_{idx:04d}.png"
            try:
                image.save(img_path, format="PNG")
            except Exception as exc:  # pragma: no cover - defensive
                diagnostics["failure_reason"] = "doctr_image_save_error"
                diagnostics["error"] = f"save_failed:{exc}"
                return "", diagnostics
            image_paths.append(str(img_path))

        payload = {
            "images": image_paths,
            "det_arch": det_arch,
            "reco_arch": reco_arch,
            "assume_straight": bool(assume_straight),
            "detect_orientation": detect_orientation,
            "straighten_pages": straighten_pages,
            "framework": framework,
        }
        payload_path = tmp_path / "payload.json"
        payload_path.write_text(json.dumps(payload))

        script = textwrap.dedent(
            """
import json
import sys
from pathlib import Path
from doctr.io import DocumentFile
from doctr.models import ocr_predictor

def _clean(word):
    value = getattr(word, "value", None) or getattr(word, "text", "") or ""
    return value.strip()

def main():
    path = sys.argv[1]
    cfg = json.loads(Path(path).read_text())
    images = cfg.get("images") or []
    doc = DocumentFile.from_images(images)
    kwargs = {
        "det_arch": cfg.get("det_arch"),
        "reco_arch": cfg.get("reco_arch"),
        "pretrained": True,
        "assume_straight_pages": bool(cfg.get("assume_straight", True)),
    }
    if cfg.get("detect_orientation") is not None:
        kwargs["detect_orientation"] = bool(cfg.get("detect_orientation"))
    if cfg.get("straighten_pages") is not None:
        kwargs["straighten_pages"] = bool(cfg.get("straighten_pages"))
    framework = cfg.get("framework")
    if framework in {"tf", "pt"}:
        kwargs["framework"] = framework
    try:
        predictor = ocr_predictor(**kwargs)
    except TypeError:
        kwargs.pop("framework", None)
        predictor = ocr_predictor(**kwargs)
        framework = framework if framework in {"tf", "pt"} else None
    result = predictor(doc)
    pages = getattr(result, "pages", []) or []
    tokens = 0
    blocks = 0
    lines = []
    for page in pages:
        for block in getattr(page, "blocks", []) or []:
            for line in getattr(block, "lines", []) or []:
                words = []
                for word in getattr(line, "words", []) or []:
                    cleaned = _clean(word)
                    if cleaned:
                        words.append(cleaned)
                        tokens += 1
                if words:
                    lines.append(" ".join(words))
                    blocks += 1
    text = "\\n".join(lines).strip()
    used_framework = getattr(getattr(predictor, "cfg", {}), "framework", None)
    if used_framework is None:
        used_framework = framework if framework in {"tf", "pt"} else None
    out = {
        "text": text,
        "blocks": blocks,
        "tokens": tokens,
        "chars": len(text),
        "pages": len(pages) or len(doc),
        "framework": used_framework,
    }
    print(json.dumps(out))

if __name__ == "__main__":
    main()
"""
        )

        env = os.environ.copy()
        doc_site = env.get("CV_DOCTR_SITE_PACKAGES")
        if doc_site:
            existing = env.get("PYTHONPATH")
            env["PYTHONPATH"] = f"{doc_site}:{existing}" if existing else doc_site
        # Ensure the subprocess receives an explicit backend hint when provided
        # so docTR consistently selects the intended framework (tf|pt).
        if framework in {"tf", "pt"}:
            env["DOCTR_BACKEND"] = "tensorflow" if framework == "tf" else "pt"

        last_error = ""
        last_python: Optional[str] = None
        for candidate in _python_candidate_order(python_path):
            if not candidate:
                continue
            if not os.path.exists(candidate):
                log.info("[ocr:doctr] try=%s rc=missing err=not_found", candidate)
                last_error = "interpreter_missing"
                last_python = candidate
                continue
            try:
                proc = subprocess.run(
                    [candidate, "-c", script, str(payload_path)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=timeout_sec,
                    env=env,
                    check=False,
                )
            except FileNotFoundError:
                log.info("[ocr:doctr] try=%s rc=missing err=not_found", candidate)
                last_error = "interpreter_missing"
                last_python = candidate
                continue
            except subprocess.TimeoutExpired:
                log.warning("[ocr:doctr] try=%s rc=timeout err=timeout", candidate)
                last_error = "timeout"
                last_python = candidate
                continue

            stdout = proc.stdout or ""
            stderr = proc.stderr or ""
            if stderr.strip():
                err_line = stderr.strip().splitlines()[0]
            elif stdout.strip():
                err_line = stdout.strip().splitlines()[0]
            else:
                err_line = ""
            log.info("[ocr:doctr] try=%s rc=%s err=%s", candidate, proc.returncode, err_line or "none")

            if proc.returncode == 0:
                payload_text = stdout.strip().splitlines()
                json_blob = payload_text[-1] if payload_text else ""
                try:
                    data = json.loads(json_blob or "{}")
                except json.JSONDecodeError as exc:
                    last_error = f"json_error:{exc}"
                    last_python = candidate
                    continue
                text = (data.get("text") or "").strip()
                blocks = int(data.get("blocks") or 0)
                tokens = int(data.get("tokens") or 0)
                chars = int(data.get("chars") or len(text))
                pages = int(data.get("pages") or len(images))
                diagnostics.update(
                    {
                        "ocr_blocks": blocks,
                        "ocr_chars": chars,
                        "ocr_tokens": tokens,
                        "pages": pages,
                        "pdf_text_len": chars,
                        "pdf_pages_rendered": pages,
                        "doctr_python": candidate,
                    }
                )
                if data.get("framework"):
                    diagnostics["doctr_framework"] = data.get("framework")
                if not text:
                    diagnostics["failure_reason"] = "doctr_empty"
                    DOCTR_EMPTY_COUNTER.inc()
                elif blocks < MIN_OCR_BLOCKS:
                    diagnostics["failure_reason"] = "doctr_low_blocks"
                else:
                    diagnostics.pop("failure_reason", None)
                log.info("[ocr:doctr] using %s", candidate)
                return text, diagnostics

            last_error = (stderr or stdout).strip()[:400]
            last_python = candidate

    if last_error:
        diagnostics["error"] = last_error
    if last_python:
        diagnostics["doctr_python"] = last_python
    diagnostics["failure_reason"] = diagnostics.get("failure_reason") or "doctr_subprocess_error"
    return "", diagnostics


class OCREngine(ABC):
    """Adapter interface for OCR backends."""

    name: str

    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    def recognize_pdf(
        self,
        source: PdfLike,
        dpi_primary: int,
        dpi_retry: int,
        lang: str,
    ) -> tuple[str, Dict[str, Any]]:
        """Run OCR for the input PDF-like source and return (text, diagnostics)."""

    def prewarm(self, lang: str = "en") -> None:  # pragma: no cover - optional
        """Optional hook to load heavyweight models ahead of first inference."""
        return None


class PaddleOCREngine(OCREngine):
    """Existing Paddle worker-based OCR adapter."""

    def __init__(self) -> None:
        super().__init__("paddle")

    def recognize_pdf(
        self,
        source: PdfLike,
        dpi_primary: int,
        dpi_retry: int,
        lang: str,
    ) -> tuple[str, Dict[str, Any]]:
        return _paddle_attempt_pdf(source, dpi_primary, dpi_retry, lang)

    def prewarm(self, lang: str = "en") -> None:
        prewarm_paddle(lang)


class DoctrOCREngine(OCREngine):
    """docTR OCR adapter (detector + recognizer in one call)."""

    def __init__(self) -> None:
        super().__init__("doctr")
        self._det_arch = os.environ.get("CV_DOCTR_DET_ARCH", "db_mobilenet_v3_large")
        self._reco_arch = os.environ.get("CV_DOCTR_REC_ARCH", "crnn_mobilenet_v3_small")
        self._assume_straight = os.environ.get("CV_DOCTR_ASSUME_STRAIGHT", "1").strip().lower() in TRUE_VALUES
        self._python_hint = os.environ.get("CV_DOCTR_PYTHON")
        if not self._python_hint:
            fallback_py = os.environ.get("DOCTR_PY")
            if fallback_py:
                self._python_hint = fallback_py
            else:
                default_py = Path("/opt/doctr-venv/bin/python")
                if default_py.exists():
                    self._python_hint = str(default_py)
        try:
            self._timeout = float(os.environ.get("CV_OCR_DOCTR_TIMEOUT", "60"))
        except (TypeError, ValueError):
            self._timeout = 60.0
        backend = (os.environ.get("DOCTR_BACKEND") or "").strip().lower()
        if backend in {"tf", "tensorflow"}:
            self._framework = "tf"
        elif backend in {"pt", "pytorch", "torch"}:
            self._framework = "pt"
        else:
            self._framework = None

    def _subprocess_infer(
        self,
        images: Sequence["Image.Image"],
        lang: str,
        *,
        assume_straight: bool,
        detect_orientation: Optional[bool] = None,
        straighten_pages: Optional[bool] = None,
    ) -> tuple[str, Dict[str, Any]]:
        return _run_doctr_ocr_subproc(
            images,
            python_path=self._python_hint,
            timeout_sec=self._timeout,
            det_arch=self._det_arch,
            reco_arch=self._reco_arch,
            assume_straight=assume_straight,
            detect_orientation=detect_orientation,
            straighten_pages=straighten_pages,
            lang=lang,
            framework=self._framework,
        )

    def recognize_pdf(
        self,
        source: PdfLike,
        dpi_primary: int,
        dpi_retry: int,
        lang: str,
    ) -> tuple[str, Dict[str, Any]]:
        text, diagnostics = _doctr_attempt_pdf(
            self,
            source,
            dpi_primary=dpi_primary,
            dpi_retry=dpi_retry,
            lang=lang,
        )
        return text, diagnostics

    def prewarm(self, lang: str = "en") -> None:  # pragma: no cover - optional
        try:
            from PIL import Image  # type: ignore
        except Exception:
            log.debug("docTR prewarm skipped; Pillow unavailable")
            return

        blank = Image.new("RGB", (32, 32), "white")
        try:
            self._subprocess_infer(
                [blank],
                lang,
                assume_straight=self._assume_straight,
                detect_orientation=False,
                straighten_pages=False,
            )
            log.debug("docTR prewarm completed (framework=%s)", self._framework or "auto")
        except Exception as exc:
            log.debug("docTR prewarm failed: %s", exc)


SUPPORTED_OCR_ENGINES: Dict[str, type[OCREngine]] = {
    "paddle": PaddleOCREngine,
    "doctr": DoctrOCREngine,
}


def load_engine(kind: Optional[str] = None) -> OCREngine:
    """Factory for OCR adapters with simple caching."""

    resolved = (kind or "").strip().lower()
    if not resolved:
        resolved = _DEFAULT_OCR_ENGINE
    if resolved not in SUPPORTED_OCR_ENGINES:
        raise ValueError(f"Unsupported OCR engine '{kind}'")
    engine = _ENGINE_CACHE.get(resolved)
    if engine is None:
        engine_cls = SUPPORTED_OCR_ENGINES[resolved]
        engine = engine_cls()
        _ENGINE_CACHE[resolved] = engine
    return engine


def resolve_effective_ocr_engine() -> str:
    """Return the runtime OCR engine honoring defaults and env overrides."""

    requested = os.environ.get("CV_OCR_ENGINE", "").strip().lower()
    if requested in {"", "auto"}:
        return _DEFAULT_OCR_ENGINE
    return requested


def _env_truthy(value: Optional[str]) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _prepend_env(value: str, existing: Optional[str], separator: str) -> str:
    if not value:
        return existing or ""
    if not existing:
        return value
    if separator == ":":
        parts = [part for part in existing.split(":") if part]
        if value in parts:
            parts = [value] + [p for p in parts if p != value]
        else:
            parts = [value] + parts
        return ":".join(parts)
    parts = [part for part in existing.split() if part]
    if value in parts:
        parts = [value] + [p for p in parts if p != value]
    else:
        parts = [value] + parts
    return " ".join(parts)


def _compute_worker_loader_env() -> Dict[str, str]:
    if _env_truthy(os.environ.get("CV_PADDLE_WORKER_SKIP_LD_PATCH")):
        return {}

    arch = platform.machine().lower()
    lib_dir_env = os.environ.get("CV_PADDLE_WORKER_LD_LIBRARY_PATH")
    preload_env = os.environ.get("CV_PADDLE_WORKER_LD_PRELOAD")
    if arch not in {"arm64", "aarch64"} and lib_dir_env is None and preload_env is None:
        return {}

    overrides: Dict[str, str] = {}

    default_lib_dir = _DEFAULT_WORKER_LIB_DIR if arch in {"arm64", "aarch64"} else ""
    lib_dir = (lib_dir_env if lib_dir_env is not None else default_lib_dir).strip()
    if lib_dir:
        if os.path.isdir(lib_dir):
            overrides["LD_LIBRARY_PATH"] = _prepend_env(
                lib_dir,
                os.environ.get("LD_LIBRARY_PATH"),
                ":",
            )
        else:
            log.debug("Skipping LD_LIBRARY_PATH override; directory missing: %s", lib_dir)

    default_preload = _DEFAULT_WORKER_OPENBLAS if arch in {"arm64", "aarch64"} else ""
    preload = (preload_env if preload_env is not None else default_preload).strip()
    if preload:
        if os.path.isfile(preload):
            overrides["LD_PRELOAD"] = _prepend_env(
                preload,
                os.environ.get("LD_PRELOAD"),
                " ",
            )
        else:
            log.debug("Skipping LD_PRELOAD override; library missing: %s", preload)

    return overrides


@contextmanager
def _paddle_worker_env() -> Iterator[bool]:
    overrides = _compute_worker_loader_env()
    if not overrides:
        yield False
        return

    original: Dict[str, Optional[str]] = {}
    for key in overrides:
        original[key] = os.environ.get(key)

    try:
        for key, value in overrides.items():
            os.environ[key] = value
        global _WORKER_ENV_PATCH_LOGGED
        if not _WORKER_ENV_PATCH_LOGGED:
            log.info("Applying Paddle worker loader overrides: %s", overrides)
            _WORKER_ENV_PATCH_LOGGED = True
        yield True
    finally:
        for key, prior in original.items():
            if prior is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = prior


def _log_worker_diag_once() -> None:
    global _WORKER_DIAG_EMITTED
    if _WORKER_DIAG_EMITTED:
        return
    if not _env_truthy(os.environ.get("CV_PADDLE_DIAG")):
        return
    _WORKER_DIAG_EMITTED = True
    try:
        faulthandler.enable(all_threads=True)
    except Exception:
        pass
    diag_payload = {
        "pid": os.getpid(),
        "platform": platform.platform(),
        "python": sys.version.split()[0],
        "ld_library_path": os.environ.get("LD_LIBRARY_PATH", ""),
        "ld_preload": os.environ.get("LD_PRELOAD", ""),
        "openblas_coretype": os.environ.get("OPENBLAS_CORETYPE", ""),
    }
    log.info("CV_PADDLE_DIAG env dump: %s", diag_payload)

_PADDLE_ENGINES: Dict[str, Any] = {}

_PADDLE_WORKER: Optional["_SubprocessWorker"] = None
_PADDLE_WORKER_LOCK = threading.Lock()
_PADDLE_WORKER_CALL_LOCK = threading.Lock()
_PADDLE_JOB_COUNTER = count(1)
_PADDLE_TIMEOUT_SEC = float(os.environ.get("CV_OCR_PADDLE_TIMEOUT", "20"))

try:  # pragma: no cover - optional dependency
    from prometheus_client import Counter, Gauge
except Exception:  # pragma: no cover - metrics optional
    Counter = Gauge = None


class _NoopMetric:
    __slots__ = ()

    def labels(self, *args: Any, **kwargs: Any) -> "_NoopMetric":
        return self

    def inc(self, *args: Any, **kwargs: Any) -> None:
        return None

    def set(self, *args: Any, **kwargs: Any) -> None:
        return None


def _metric(factory: Optional[Any], *args: Any, **kwargs: Any) -> Any:
    if factory is None:
        return _NoopMetric()
    return factory(*args, **kwargs)


WORKER_RESPAWN_COUNTER = _metric(
    Counter,
    "cv_parser_paddle_worker_respawns_total",
    "Count of Paddle worker restarts",
)
WORKER_ALIVE_GAUGE = _metric(
    Gauge,
    "cv_parser_paddle_worker_alive",
    "1 when the Paddle worker process is alive",
)
WORKER_ALIVE_GAUGE.set(0)

DOCTR_EMPTY_COUNTER = _metric(
    Counter,
    "cv_parser_doctr_empty_total",
    "Count of docTR inference passes that returned no text",
)
DOCTR_RETRY_COUNTER = _metric(
    Counter,
    "cv_parser_doctr_retries_total",
    "Count of docTR retry attempts by reason",
    ["reason"],
)
DOCTR_RETRY_SUCCESS_COUNTER = _metric(
    Counter,
    "cv_parser_doctr_retry_success_total",
    "Count of docTR retry attempts that succeeded",
    ["reason"],
)

for reason in ("high_dpi", "adaptive_predictor", "rotate90", "rotate270"):
    DOCTR_RETRY_COUNTER.labels(reason=reason).inc(0)
    DOCTR_RETRY_SUCCESS_COUNTER.labels(reason=reason).inc(0)


class PaddleWorkerFailure(RuntimeError):
    """Raised when the guarded Paddle subprocess fails or times out."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _normalize_pdf_source(source: PdfLike) -> tuple[Optional[Path], Optional[bytes]]:
    """Split incoming source into a filesystem path or in-memory bytes."""

    if isinstance(source, Path):
        return source, None
    if isinstance(source, (bytes, bytearray, memoryview)):
        return None, bytes(source)
    if isinstance(source, str):
        return Path(source), None
    if isinstance(source, os.PathLike):
        return Path(source), None
    # Simple file-like support (io.BytesIO, etc.)
    if hasattr(source, "read") and callable(source.read):
        data = source.read()
        if isinstance(data, str):
            data = data.encode("utf-8")
        return None, bytes(data)
    raise TypeError(f"Unsupported PDF source type: {type(source)!r}")


def _reset_paddle_worker() -> None:
    """Terminate the guarded Paddle worker process."""
    with _PADDLE_WORKER_LOCK:
        global _PADDLE_WORKER
        if _PADDLE_WORKER is not None:
            _PADDLE_WORKER.stop()
        _PADDLE_WORKER = None


class _SubprocessWorker:
    def __init__(self) -> None:
        self.proc: Optional[subprocess.Popen[str]] = None
        self.responses: "queue.Queue[Optional[Dict[str, Any]]]" = queue.Queue()
        self.reader: Optional[threading.Thread] = None

    def start(self) -> None:
        self.stop()
        env = os.environ.copy()
        overrides = _compute_worker_loader_env()
        for key, value in overrides.items():
            env[key] = value
        paddle_python = env.get("CV_PADDLE_WORKER_PYTHON", "/opt/paddle-venv/bin/python")
        env["PYTHONNOUSERSITE"] = "1"
        env["PYTHONPATH"] = ""
        env.pop("PYTHONHOME", None)
        env.setdefault("OPENBLAS_NUM_THREADS", "1")
        env.setdefault("OMP_NUM_THREADS", "1")
        env.setdefault("MKL_NUM_THREADS", "1")
        env.setdefault("NUMEXPR_NUM_THREADS", "1")
        env.setdefault("PADDLE_CPU_MATH_LIBRARY_NUM_THREADS", "1")
        if platform.machine().lower() in {"arm64", "aarch64"}:
            env.setdefault("OPENBLAS_CORETYPE", "ARMV8")
        env.setdefault("FLAGS_use_mkldnn", "false")
        env.setdefault("FLAGS_allocator_strategy", "naive_best_fit")
        env.setdefault("FLAGS_call_stack_level", "2")
        env.setdefault("FLAGS_use_cuda", "false")
        cmd = [paddle_python, "-m", "cv_parser.extract._paddle_worker"]
        try:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=sys.stderr,
                env=env,
                bufsize=1,
                text=True,
                encoding="utf-8",
            )
        except Exception as exc:
            raise PaddleWorkerFailure(f"spawn_failed:{exc}") from exc

        self.proc = proc
        self.reader = threading.Thread(
            target=self._reader_loop,
            name="paddle-worker-reader",
            daemon=True,
        )
        self.reader.start()
        WORKER_RESPAWN_COUNTER.inc()
        WORKER_ALIVE_GAUGE.set(1)

    def _reader_loop(self) -> None:
        assert self.proc is not None
        stdout = self.proc.stdout
        if stdout is None:
            return
        try:
            for line in iter(stdout.readline, ""):
                line = line.strip()
                if not line:
                    continue
                try:
                    message = json.loads(line)
                except Exception:
                    log.warning("Invalid worker output: %r", line)
                    continue
                self.responses.put(message)
        finally:
            self.responses.put(None)

    def is_alive(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def stop(self) -> None:
        if self.proc is None:
            return
        try:
            if self.proc.stdin:
                try:
                    self.proc.stdin.write(b"__quit__\n")
                    self.proc.stdin.flush()
                except Exception:
                    pass
            self.proc.terminate()
        except Exception:
            pass
        try:
            self.proc.wait(timeout=5)
        except Exception:
            pass
        self.proc = None
        self.responses = queue.Queue()
        WORKER_ALIVE_GAUGE.set(0)

    def request(self, envelope: Dict[str, Any], timeout: float) -> Dict[str, Any]:
        if self.proc is None or self.proc.stdin is None:
            raise PaddleWorkerFailure("worker_not_initialized")
        line = json.dumps(envelope, separators=(",", ":")) + "\n"
        try:
            self.proc.stdin.write(line)
            self.proc.stdin.flush()
        except Exception:
            self.stop()
            raise PaddleWorkerFailure("paddle_subprocess_exit")

        try:
            response = self.responses.get(timeout=timeout)
        except queue.Empty:
            self.stop()
            raise PaddleWorkerFailure("paddle_timeout")

        if response is None:
            self.stop()
            raise PaddleWorkerFailure("paddle_subprocess_exit")
        return response


def _ensure_paddle_worker() -> _SubprocessWorker:
    global _PADDLE_WORKER
    with _PADDLE_WORKER_LOCK:
        worker = _PADDLE_WORKER
        if worker is None or not worker.is_alive():
            if worker is None:
                worker = _SubprocessWorker()
            else:
                worker.stop()
            worker.start()
            _PADDLE_WORKER = worker

    if _PADDLE_WORKER is None:
        raise PaddleWorkerFailure("worker_not_initialized")
    return _PADDLE_WORKER


def _build_worker_payload(source: PdfLike) -> Dict[str, Any]:
    source_path, source_bytes = _normalize_pdf_source(source)
    if source_bytes is not None:
        return {"kind": "bytes", "value": bytes(source_bytes)}
    if source_path is not None:
        return {"kind": "path", "value": str(source_path)}
    raise PaddleWorkerFailure("unsupported_source_type")


def _send_worker_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    worker = _ensure_paddle_worker()
    job_id = next(_PADDLE_JOB_COUNTER)
    envelope = {"job_id": job_id, "payload": payload}

    with _PADDLE_WORKER_CALL_LOCK:
        response = worker.request(envelope, timeout=_PADDLE_TIMEOUT_SEC)

    if not isinstance(response, dict) or response.get("job_id") != job_id:
        _reset_paddle_worker()
        raise PaddleWorkerFailure("invalid_worker_response")
    return response


def _run_paddle_in_worker(
    source: PdfLike,
    dpi_primary: int,
    dpi_retry: int,
    lang: str,
) -> tuple[str, Dict[str, Any]]:
    """Execute Paddle OCR in the guarded worker process with a hard timeout."""

    payload = _build_worker_payload(source)
    payload.update(
        {
            "dpi_primary": dpi_primary,
            "dpi_retry": dpi_retry,
            "lang": lang,
        }
    )

    response = _send_worker_job(payload)

    if not response.get("ok"):
        error_msg = str(response.get("error") or "paddle_error")
        raise PaddleWorkerFailure(error_msg)

    text = str(response.get("text") or "")
    diagnostics = dict(response.get("diagnostics") or {})
    diagnostics["engine"] = "paddle"
    diagnostics.setdefault("dpi_used", dpi_primary)
    diagnostics.setdefault("lang_hint", lang)
    diagnostics.setdefault("paddle_retry_used", False)
    diagnostics.setdefault("ocr_blocks", 0)
    diagnostics.setdefault("ocr_chars", len(text))
    return text, diagnostics


def _prewarm_paddle_worker(lang: str = "en") -> None:
    try:
        response = _send_worker_job({"kind": "prewarm", "lang": lang})
    except PaddleWorkerFailure:
        return
    if not response.get("ok"):
        raise PaddleWorkerFailure(str(response.get("error") or "paddle_prewarm_failed"))


def _get_paddle_engine(lang: str = "en"):
    """Return a cached PaddleOCR instance for the requested language."""

    key = lang or "en"
    engine = _PADDLE_ENGINES.get(key)
    if engine is None:
        from paddleocr import PaddleOCR  # type: ignore

        engine = PaddleOCR(use_angle_cls=True, lang=key)
        _PADDLE_ENGINES[key] = engine
    return engine


def prewarm_paddle(lang: str = "en") -> None:
    """Instantiate the Paddle engine early to avoid cold-start latency."""

    try:
        _get_paddle_engine(lang)
        try:
            _prewarm_paddle_worker(lang)
        except PaddleWorkerFailure as worker_err:
            log.warning("Paddle worker prewarm failed: %s", worker_err.reason)
    except Exception as exc:  # pragma: no cover - best effort
        log.warning("Paddle prewarm failed for lang=%s: %s", lang, exc)


def prewarm_doctr(lang: str = "en") -> None:
    """Instantiate the docTR engine early to avoid first-request stalls."""

    try:
        engine = load_engine("doctr")
    except Exception as exc:  # pragma: no cover - defensive
        log.debug("docTR prewarm skipped (engine load failed): %s", exc)
        return

    try:
        engine.prewarm(lang)
    except Exception as exc:  # pragma: no cover - best effort
        log.debug("docTR prewarm encountered an error: %s", exc)


## Worker loop removed: now provided by cv_parser.extract._paddle_worker.paddle_worker_loop


def _paddle_attempt_pdf(
    pdf_path: Path,
    dpi_primary: int,
    dpi_retry: int,
    lang: str,
) -> tuple[str, Dict[str, Any]]:
    """Run Paddle OCR (with retry) for a PDF path inside the worker process."""

    diagnostics: Dict[str, Any] = {
        "engine": "paddle",
        "dpi_used": dpi_primary,
        "paddle_retry_used": False,
        "fallback_reason": None,
        "lang_hint": lang,
        "ocr_blocks": 0,
        "ocr_chars": 0,
        "pages": 0,
    }

    images, render_diag = render_pdf_pages(pdf_path, dpi=dpi_primary)
    diagnostics["pages"] = render_diag.get("pages", 0)
    diagnostics["dpi_used"] = render_diag.get("dpi", dpi_primary)

    paddle_text, paddle_diag = ocr_paddle(images, lang=lang)
    if isinstance(paddle_diag, dict):
        for key, value in paddle_diag.items():
            if key == "engine":
                continue
            diagnostics[key] = value
    diagnostics["ocr_chars"] = len(paddle_text or "")

    if paddle_text and paddle_diag.get("ocr_blocks", 0) >= MIN_OCR_BLOCKS:
        diagnostics["fallback_reason"] = None
        diagnostics["paddle_retry_used"] = False
        diagnostics["ocr_chars"] = len(paddle_text)
        return paddle_text, diagnostics

    failure_reason = "paddle_empty"
    if paddle_diag.get("ocr_blocks", 0) > 0:
        failure_reason = "paddle_low_blocks"
    diagnostics["failure_reason"] = failure_reason

    images_retry, render_retry_diag = render_pdf_pages(pdf_path, dpi=dpi_retry)
    if images_retry:
        diagnostics["paddle_retry_used"] = True
        diagnostics["dpi_used"] = render_retry_diag.get("dpi", dpi_retry)
        diagnostics["pages"] = render_retry_diag.get("pages", diagnostics.get("pages", 0))
        paddle_text_retry, paddle_diag_retry = ocr_paddle(images_retry, lang=lang)
        if isinstance(paddle_diag_retry, dict):
            for key, value in paddle_diag_retry.items():
                if key == "engine":
                    continue
                diagnostics[key] = value
        diagnostics["ocr_chars"] = len(paddle_text_retry or "")
        if paddle_text_retry and paddle_diag_retry.get("ocr_blocks", 0) >= MIN_OCR_BLOCKS:
            diagnostics["failure_reason"] = None
            return paddle_text_retry, diagnostics
        diagnostics["failure_reason"] = (
            "paddle_low_blocks" if paddle_diag_retry.get("ocr_blocks", 0) > 0 else "paddle_empty"
        )

    return "", diagnostics


def _doctr_extract_from_images(
    predictor: Any,
    images: Sequence["Image.Image"],
    lang: str,
) -> tuple[str, Dict[str, Any]]:
    """Run docTR predictor on a sequence of PIL images."""

    if not images:
        return "", {"engine": "doctr", "ocr_blocks": 0, "ocr_chars": 0, "lang_hint": lang}

    try:
        arrays = [np.array(img.convert("RGB")) for img in images]
        result = predictor(arrays)
    except Exception as exc:
        raise RuntimeError(f"docTR inference failed: {exc}") from exc

    text_blocks: list[str] = []
    total_blocks = 0

    try:
        for page in getattr(result, "pages", []) or []:
            for block in getattr(page, "blocks", []) or []:
                for line in getattr(block, "lines", []) or []:
                    words = []
                    for word in getattr(line, "words", []) or []:
                        value = getattr(word, "value", None) or getattr(word, "text", "")
                        value = (value or "").strip()
                        if value:
                            words.append(value)
                    if words:
                        line_text = " ".join(words).strip()
                        if line_text:
                            text_blocks.append(line_text)
                            total_blocks += 1
    except Exception as exc:  # pragma: no cover - defensive
        raise RuntimeError(f"docTR result parsing failed: {exc}") from exc

    combined = "\n".join(text_blocks).strip()
    diagnostics: Dict[str, Any] = {
        "engine": "doctr",
        "ocr_blocks": total_blocks,
        "ocr_chars": len(combined),
        "lang_hint": lang,
        "pages": len(images),
    }
    if not combined:
        diagnostics["failure_reason"] = "doctr_empty"
    elif total_blocks < MIN_OCR_BLOCKS:
        diagnostics["failure_reason"] = "doctr_low_blocks"
    return combined, diagnostics


def _doctr_attempt_pdf(
    engine: DoctrOCREngine,
    source: PdfLike,
    dpi_primary: int,
    dpi_retry: int,
    lang: str,
) -> tuple[str, Dict[str, Any]]:
    """Run docTR OCR with adaptive retries before falling back."""

    images, render_diag = render_pdf_pages(source, dpi=dpi_primary)
    text, diagnostics = engine._subprocess_infer(
        images,
        lang,
        assume_straight=engine._assume_straight,
    )
    diagnostics["dpi_used"] = render_diag.get("dpi", dpi_primary)
    diagnostics["doctr_retry_used"] = False
    diagnostics["doctr_retry_reason"] = None
    diagnostics["doctr_retry_outcome"] = None
    diagnostics["pages"] = render_diag.get("pages", diagnostics.get("pages", len(images)))
    diagnostics["pdf_pages_rendered"] = diagnostics.get("pages", render_diag.get("pages", len(images)))
    diagnostics["ocr_chars"] = len(text or "")

    def _mark_retry(reason: str, outcome: str, counter_success: bool = False) -> None:
        diagnostics["doctr_retry_used"] = True
        diagnostics["doctr_retry_reason"] = reason
        diagnostics["doctr_retry_outcome"] = outcome
        DOCTR_RETRY_COUNTER.labels(reason=reason).inc()
        if counter_success:
            DOCTR_RETRY_SUCCESS_COUNTER.labels(reason=reason).inc()

    def _is_success(text_value: str, diag: Dict[str, Any]) -> bool:
        blocks = int(diag.get("ocr_blocks") or 0)
        failure_token = str(diag.get("failure_reason") or "")
        return bool(text_value and blocks >= MIN_OCR_BLOCKS and failure_token not in {"doctr_subprocess_error", "doctr_image_save_error"})

    def _update_diagnostics(from_diag: Dict[str, Any], text_value: str) -> None:
        diagnostics.update(from_diag)
        diagnostics["ocr_chars"] = len(text_value or "")
        diagnostics["pages"] = from_diag.get("pages", diagnostics.get("pages", len(images)))
        diagnostics["pdf_pages_rendered"] = diagnostics.get("pages", diagnostics.get("pdf_pages_rendered", 0))

    failure_reason = diagnostics.get("failure_reason")
    if failure_reason == "doctr_subprocess_error":
        return text, diagnostics
    if failure_reason == "doctr_empty":
        DOCTR_EMPTY_COUNTER.inc()
    if _is_success(text, diagnostics):
        diagnostics.pop("failure_reason", None)
        log.info("[ocr:doctr] pages=%d tokens=%d", diagnostics.get("pages", len(images)), diagnostics.get("ocr_tokens", 0))
        return text, diagnostics

    # First retry: higher DPI with the same predictor.
    images_retry, render_diag_retry = render_pdf_pages(source, dpi=max(dpi_retry, dpi_primary))
    if images_retry:
        try:
            text_retry, retry_diag = engine._subprocess_infer(
                images_retry,
                lang,
                assume_straight=engine._assume_straight,
            )
        except Exception as exc:  # pragma: no cover - defensive
            diagnostics["error"] = str(exc)
            return text, diagnostics
        retry_diag["dpi_used"] = render_diag_retry.get("dpi", dpi_retry)
        retry_diag["pages"] = render_diag_retry.get("pages", retry_diag.get("pages", len(images_retry)))
        retry_diag["pdf_pages_rendered"] = retry_diag.get("pages", diagnostics.get("pages", len(images_retry)))
        outcome = "success" if _is_success(text_retry, retry_diag) else retry_diag.get("failure_reason") or "empty"
        _mark_retry("high_dpi", outcome, counter_success=outcome == "success")
        if outcome != "success" and retry_diag.get("failure_reason") == "doctr_empty":
            DOCTR_EMPTY_COUNTER.inc()
        if outcome == "success":
            retry_diag.pop("failure_reason", None)
            retry_diag["doctr_retry_used"] = True
            retry_diag["doctr_retry_reason"] = "high_dpi"
            retry_diag["doctr_retry_outcome"] = "success"
            log.info("[ocr:doctr] pages=%d tokens=%d", retry_diag.get("pages", len(images_retry)), retry_diag.get("ocr_tokens", 0))
            return text_retry, retry_diag
        retry_diag["doctr_retry_used"] = True
        retry_diag["doctr_retry_reason"] = "high_dpi"
        retry_diag["doctr_retry_outcome"] = outcome
        _update_diagnostics(retry_diag, text_retry)

    # Second chance: tilt-aware predictor with more aggressive rendering.
    high_dpi = max(int(dpi_retry * 1.5), 480)
    images_adaptive, render_diag_adaptive = render_pdf_pages(source, dpi=high_dpi)
    if images_adaptive:
        text_adaptive, adaptive_diag = engine._subprocess_infer(
            images_adaptive,
            lang,
            assume_straight=False,
            detect_orientation=True,
            straighten_pages=True,
        )
        adaptive_diag["dpi_used"] = render_diag_adaptive.get("dpi", high_dpi)
        adaptive_diag["pages"] = render_diag_adaptive.get("pages", adaptive_diag.get("pages", len(images_adaptive)))
        adaptive_diag["pdf_pages_rendered"] = adaptive_diag.get("pages", diagnostics.get("pages", len(images_adaptive)))
        outcome = "success" if _is_success(text_adaptive, adaptive_diag) else adaptive_diag.get("failure_reason") or "empty"
        _mark_retry("adaptive_predictor", outcome, counter_success=outcome == "success")
        adaptive_diag["doctr_retry_used"] = True
        adaptive_diag["doctr_retry_reason"] = "adaptive_predictor"
        adaptive_diag["doctr_retry_outcome"] = outcome
        if outcome != "success" and adaptive_diag.get("failure_reason") == "doctr_empty":
            DOCTR_EMPTY_COUNTER.inc()
        if outcome == "success":
            adaptive_diag.pop("failure_reason", None)
            log.info("[ocr:doctr] pages=%d tokens=%d", adaptive_diag.get("pages", len(images_adaptive)), adaptive_diag.get("ocr_tokens", 0))
            return text_adaptive, adaptive_diag
        _update_diagnostics(adaptive_diag, text_adaptive)

        # Orientation retries (90° / 270°) if still empty/low.
        if adaptive_diag.get("failure_reason") in {"doctr_empty", "doctr_low_blocks"}:
            for angle in (90, 270):
                rotated_images = [img.rotate(angle, expand=True) for img in images_adaptive]
                if not rotated_images:
                    continue
                text_rot, rot_diag = engine._subprocess_infer(
                    rotated_images,
                    lang,
                    assume_straight=False,
                    detect_orientation=True,
                    straighten_pages=True,
                )
                rot_diag["dpi_used"] = render_diag_adaptive.get("dpi", high_dpi)
                rot_diag["pages"] = render_diag_adaptive.get("pages", rot_diag.get("pages", len(rotated_images)))
                rot_diag["pdf_pages_rendered"] = rot_diag.get("pages", diagnostics.get("pages", len(rotated_images)))
                reason = f"rotate{angle}"
                outcome = "success" if _is_success(text_rot, rot_diag) else rot_diag.get("failure_reason") or "empty"
                _mark_retry(reason, outcome, counter_success=outcome == "success")
                rot_diag["doctr_retry_used"] = True
                rot_diag["doctr_retry_reason"] = reason
                rot_diag["doctr_retry_outcome"] = outcome
                if outcome != "success" and rot_diag.get("failure_reason") == "doctr_empty":
                    DOCTR_EMPTY_COUNTER.inc()
                if outcome == "success":
                    rot_diag.pop("failure_reason", None)
                    log.info("[ocr:doctr] pages=%d tokens=%d", rot_diag.get("pages", len(rotated_images)), rot_diag.get("ocr_tokens", 0))
                    return text_rot, rot_diag
                _update_diagnostics(rot_diag, text_rot)

    diagnostics.setdefault(
        "failure_reason",
        "doctr_low_blocks" if diagnostics.get("ocr_blocks", 0) > 0 else "doctr_empty",
    )
    return text, diagnostics


def render_pdf_pages(source: PdfLike, dpi: int = 320) -> tuple[list["Image.Image"], Dict[str, Any]]:
    """Render PDF bytes/path into RGB PIL images at the requested DPI."""

    source_path, source_bytes = _normalize_pdf_source(source)
    images: list["Image.Image"] = []
    pages = 0

    try:
        import pypdfium2 as pdfium  # type: ignore
        from PIL import Image

        pdf_doc = pdfium.PdfDocument(source_bytes if source_bytes is not None else str(source_path))
        scale = dpi / 72.0
        try:
            for page_index in range(len(pdf_doc)):
                page = pdf_doc[page_index]
                bitmap = page.render(scale=scale)
                pil_image = bitmap.to_pil()
                if pil_image.mode != "RGB":
                    pil_image = pil_image.convert("RGB")
                images.append(pil_image)
        finally:
            pdf_doc.close()
        pages = len(images)
    except Exception as exc:
        log.warning("render_pdf_pages failed at dpi=%s: %s", dpi, exc)
        images = []

    return images, {"pages": pages, "dpi": dpi}


def ocr_paddle(images: Sequence["Image.Image"], lang: str = "en") -> tuple[str, Dict[str, Any]]:
    """Run PaddleOCR on a list of PIL images and collect flat diagnostics."""

    text_blocks: list[str] = []
    total_blocks = 0

    if not images:
        return "", {"engine": "paddle", "ocr_blocks": 0, "ocr_chars": 0, "lang_hint": lang}

    try:
        engine = _get_paddle_engine(lang)
    except Exception as exc:
        log.warning("Paddle OCR initialization failed: %s", exc)
        return "", {"engine": "paddle", "ocr_blocks": 0, "ocr_chars": 0, "lang_hint": lang, "error": str(exc)}

    for img in images:
        try:
            np_img = np.array(img)
            raw = engine.ocr(np_img)
        except Exception as exc:  # pragma: no cover - defensive path
            log.warning("Paddle OCR inference error: %s", exc)
            continue
        if not raw or not raw[0]:
            continue
        if isinstance(raw[0], dict):
            texts = raw[0].get("rec_texts", []) or []
        else:
            texts = [entry[1][0] for entry in raw[0] if entry and isinstance(entry, (list, tuple))]
        cleaned = [t.strip() for t in texts if isinstance(t, str) and t.strip()]
        if cleaned:
            text_blocks.extend(cleaned)
            total_blocks += len(cleaned)

    combined = "\n".join(text_blocks).strip()
    diagnostics = {
        "engine": "paddle",
        "ocr_blocks": total_blocks,
        "ocr_chars": len(combined),
        "lang_hint": lang,
    }
    return combined, diagnostics


def ocr_pdfplumber(source: PdfLike) -> tuple[str, Dict[str, Any]]:
    """Extract text using pdfplumber for text-based PDFs."""

    source_path, source_bytes = _normalize_pdf_source(source)
    text_parts: list[str] = []
    page_count = 0
    try:
        if source_bytes is not None:
            handle = io.BytesIO(source_bytes)
        else:
            handle = str(source_path)
        with pdfplumber.open(handle) as pdf:  # type: ignore[attr-defined]
            page_count = len(pdf.pages)
            for page in pdf.pages:
                snippet = (page.extract_text() or "").strip()
                if snippet:
                    text_parts.append(snippet)
    except Exception as exc:
        log.warning("pdfplumber extraction failed: %s", exc)
        return "", {"engine": "pdfplumber", "ocr_blocks": 0, "ocr_chars": 0, "lang_hint": "unknown", "pages": page_count, "error": str(exc)}

    text = "\n".join(text_parts).strip()
    diagnostics = {
        "engine": "pdfplumber",
        "ocr_blocks": len(text_parts),
        "ocr_chars": len(text),
        "lang_hint": "unknown",
        "pages": page_count,
    }
    return text, diagnostics


def ocr_tesseract(images: Sequence["Image.Image"], lang: str = "eng") -> tuple[str, Dict[str, Any]]:
    """Run pytesseract on rendered images as a final fallback."""

    if not images:
        return "", {"engine": "tesseract", "ocr_blocks": 0, "ocr_chars": 0, "lang_hint": lang}

    try:
        import pytesseract
    except Exception as exc:  # pragma: no cover - optional dependency
        log.warning("pytesseract unavailable: %s", exc)
        return "", {"engine": "tesseract", "ocr_blocks": 0, "ocr_chars": 0, "lang_hint": lang, "error": str(exc)}

    config = os.environ.get("CV_TESSERACT_CONFIG", "--oem 1 --psm 6")
    text_segments: list[str] = []
    for image in images:
        try:
            segment = pytesseract.image_to_string(image, lang=lang, config=config) or ""
        except Exception as exc:  # pragma: no cover - defensive path
            log.warning("pytesseract inference error: %s", exc)
            continue
        cleaned = segment.strip()
        if cleaned:
            text_segments.append(cleaned)

    text = "\n".join(text_segments).strip()
    diagnostics = {
        "engine": "tesseract",
        "ocr_blocks": len(text_segments),
        "ocr_chars": len(text),
        "lang_hint": lang,
    }
    return text, diagnostics


def extract_text_from_pdf(
    source: PdfLike,
    *,
    prefer_ocr: bool = True,
    dpi_primary: int = 320,
    dpi_retry: int = 360,
    lang: str = "en",
) -> tuple[str, Dict[str, Any]]:
    """OCR pipeline with docTR/Paddle engines plus pdfplumber and Tesseract fallbacks."""

    diagnostics: Dict[str, Any] = {
        "engine": None,
        "dpi_used": dpi_primary,
        "fallback_reason": None,
        "lang_hint": lang,
        "ocr_blocks": 0,
        "ocr_chars": 0,
        "pages": 0,
    }

    selected_engine = resolve_effective_ocr_engine()
    ocr_failure_reason: Optional[str] = None
    ocr_error: Optional[str] = None
    disable_paddle_fb = _env_truthy(os.environ.get("CV_OCR_DISABLE_PADDLE_FALLBACK"))

    use_neural_engine = prefer_ocr and selected_engine not in {"tesseract", "none", "disabled"}

    if use_neural_engine and selected_engine in SUPPORTED_OCR_ENGINES:
        engine = load_engine(selected_engine)
        try:
            engine_text, engine_diag = engine.recognize_pdf(
                source,
                dpi_primary=dpi_primary,
                dpi_retry=dpi_retry,
                lang=lang,
            )
            diagnostics.update({k: v for k, v in engine_diag.items() if k != "engine"})
            diagnostics["engine"] = engine_diag.get("engine", engine.name)
            diagnostics["ocr_chars"] = len(engine_text or "")
            failure_reason = engine_diag.get("failure_reason")
            if engine_text and not failure_reason:
                diagnostics["fallback_reason"] = None
                return engine_text, diagnostics
            ocr_failure_reason = failure_reason or f"{engine.name}_empty"
            diagnostics.setdefault("fallback_reason", ocr_failure_reason)
            if selected_engine == "doctr" and disable_paddle_fb:
                return engine_text, diagnostics
        except PaddleWorkerFailure as err:
            diagnostics["engine"] = engine.name
            ocr_failure_reason = err.reason or f"{engine.name}_failure"
            diagnostics["error"] = err.reason
            diagnostics.setdefault("fallback_reason", ocr_failure_reason)
            log.warning("%s OCR failed: %s", engine.name, err.reason)
        except Exception as exc:  # pragma: no cover - defensive
            diagnostics["engine"] = engine.name
            ocr_error = str(exc)
            diagnostics["error"] = ocr_error
            ocr_failure_reason = f"{engine.name}_exception"
            diagnostics.setdefault("fallback_reason", ocr_failure_reason)
            log.exception("%s OCR failed with unexpected error", engine.name)
    elif selected_engine == "tesseract":
        diagnostics["engine"] = "tesseract"
        diagnostics["fallback_reason"] = "tesseract_only"
        use_neural_engine = False
    else:
        diagnostics["engine"] = selected_engine or diagnostics.get("engine")

    use_paddle_subproc = selected_engine == "paddle_subproc"

    # Try text extraction for text-based PDFs first
    pdfplumber_text, pdfplumber_diag = ocr_pdfplumber(source)
    if pdfplumber_text:
        diagnostics.update(pdfplumber_diag)
        diagnostics["engine"] = "pdfplumber"
        diagnostics.setdefault("fallback_reason", ocr_failure_reason)
        diagnostics["ocr_chars"] = len(pdfplumber_text)
        return pdfplumber_text, diagnostics

    # Render pages and attempt a neural fallback (prefer Paddle). Do NOT fall back to tesseract unless explicitly requested.
    fallback_images, render_diag = render_pdf_pages(source, dpi=dpi_retry)
    diagnostics["dpi_used"] = render_diag.get("dpi", dpi_retry)
    diagnostics["pages"] = render_diag.get("pages", diagnostics.get("pages", 0))

    # If the initially selected engine was not Paddle, try Paddle as neural fallback
    # Never flip from docTR → Paddle implicitly; honor selected_engine strictly.
    if (
        selected_engine not in {"paddle", "paddle_subproc", "doctr"}
        and not disable_paddle_fb
    ):
        paddle_text2, paddle_diag2 = ocr_paddle(fallback_images, lang=lang)
        if paddle_text2 and (paddle_diag2.get("ocr_blocks", 0) or 0) >= MIN_OCR_BLOCKS:
            diagnostics.update({k: v for k, v in paddle_diag2.items() if k != "engine"})
            diagnostics["engine"] = "paddle"
            diagnostics.setdefault("fallback_reason", ocr_failure_reason or "pdfplumber_empty")
            diagnostics["ocr_chars"] = len(paddle_text2 or "")
            diagnostics["pdf_pages_rendered"] = diagnostics.get("pages", 0)
            return paddle_text2, diagnostics

    if use_paddle_subproc:
        if _cvps_main is not None and hasattr(_cvps_main, "_paddle_subprocess_ocr"):
            text_sub, diag_sub = _cvps_main._paddle_subprocess_ocr(source, dpi_retry, lang)  # type: ignore[attr-defined]
        else:
            text_sub, diag_sub = _run_paddle_in_worker(source, dpi_primary=dpi_primary, dpi_retry=dpi_retry, lang=lang)
        diagnostics.update({k: v for k, v in diag_sub.items() if k != "engine"})
        diagnostics["engine"] = "paddle"
        diagnostics.setdefault("fallback_reason", ocr_failure_reason or "subprocess")
        diagnostics["ocr_chars"] = len(text_sub or "")
        diagnostics["pdf_pages_rendered"] = diagnostics.get("pages", diag_sub.get("pdf_pages_rendered", 0))
        if text_sub and diag_sub.get("ocr_blocks", 0) >= MIN_OCR_BLOCKS:
            return text_sub, diagnostics

    # Optional Tesseract fallback if enabled via env
    if _env_truthy(os.environ.get("CV_TESSERACT_FALLBACK")):
        # Reuse rendered images; if missing, render at dpi_retry
        if not fallback_images:
            fallback_images, render_diag = render_pdf_pages(source, dpi=dpi_retry)
            diagnostics["dpi_used"] = render_diag.get("dpi", dpi_retry)
            diagnostics["pages"] = render_diag.get("pages", diagnostics.get("pages", 0))
        tess_text, tess_diag = ocr_tesseract(fallback_images, lang="eng")
        diagnostics.update({k: v for k, v in tess_diag.items() if k != "engine"})
        diagnostics["engine"] = "tesseract"
        diagnostics.setdefault("fallback_reason", ocr_failure_reason or "neural_unavailable")
        diagnostics["ocr_chars"] = len(tess_text or "")
        diagnostics["pdf_pages_rendered"] = diagnostics.get("pages", 0)
        diagnostics["fallback_used"] = True
        return tess_text or "", diagnostics

    # As a last resort return empty text with pdfplumber label
    diagnostics.setdefault("fallback_reason", ocr_failure_reason or "neural_unavailable")
    diagnostics.setdefault("engine", "pdfplumber")
    diagnostics.setdefault("ocr_chars", 0)
    return "", diagnostics


def render_pdf_to_np_arrays(pdf_path: Path, dpi: int = 300) -> List[np.ndarray]:
    """Render PDF pages to in-memory RGB numpy arrays.

    Behavior:
      - In Docker (or when IN_DOCKER=1) use pdf2image.convert_from_path (Poppler-backed).
      - Locally use pypdfium2 for faster rendering.
      - When running in Docker, downscale rendered images to a max width to avoid OOM/SIGKILL.
    """
    import numpy as np
    from PIL import Image

    is_docker = os.path.exists('/.dockerenv') or os.environ.get('IN_DOCKER', '').lower() == 'true'
    max_width = 1200 if is_docker else None

    if is_docker:
        from pdf2image import convert_from_path

        pil_images = convert_from_path(str(pdf_path), dpi=dpi)
        images: List[np.ndarray] = []
        for pil_image in pil_images:
            # Ensure RGB
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            # Downscale large images to avoid OOM in container
            if max_width and getattr(pil_image, "width", 0) > max_width:
                new_h = int(pil_image.height * (max_width / pil_image.width))
                pil_image = pil_image.resize((max_width, new_h), Image.LANCZOS)
            images.append(np.array(pil_image))
        return images
    else:
        import pypdfium2 as pdfium

        pdf_context = pdfium.PdfDocument(str(pdf_path))
        images: List[np.ndarray] = []
        try:
            for page_index in range(len(pdf_context)):
                page = pdf_context[page_index]
                # Render to bitmap at DPI (scale = dpi / 72)
                scale = dpi / 72.0
                bitmap = page.render(scale=scale)
                pil_image = bitmap.to_pil()
                # Ensure RGB and optional downscale
                if pil_image.mode != 'RGB':
                    pil_image = pil_image.convert('RGB')
                if max_width and getattr(pil_image, "width", 0) > max_width:
                    new_h = int(pil_image.height * (max_width / pil_image.width))
                    pil_image = pil_image.resize((max_width, new_h), Image.LANCZOS)
                images.append(np.array(pil_image))
        finally:
            pdf_context.close()
        return images


def run_paddle_on_images(ocr_engine, images: List[np.ndarray], engine_kind: str) -> Tuple[List[Dict[str, Any]], float]:
    """Run PaddleOCR on list of np arrays, flatten to blocks, compute avg_conf."""
    all_blocks = []
    all_scores = []
    for page_no, img_array in enumerate(images, 1):
        page_blocks = []
        if engine_kind == "ppstructure":
            # Temp save for PP-Structure if it requires path
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                from PIL import Image
                Image.fromarray(img_array).save(tmp.name)
                tmp_path = Path(tmp.name)
                try:
                    log.info("[ocr-debug] page %d: running PP-Structure pipeline", page_no)
                    page_blocks = _run_ocr(ocr_engine, tmp_path, engine_kind)
                finally:
                    tmp_path.unlink()
        else:
            # Direct np.array for PaddleOCR
            try:
                log.info(
                    "[ocr-debug] page %d: starting PaddleOCR detection+recognition", page_no
                )
                raw_result = ocr_engine.ocr(img_array)
                entry_count = len(raw_result[0]) if raw_result and raw_result[0] else 0
                log.info(
                    "[ocr-debug] page %d: PaddleOCR finished with %d entries", page_no, entry_count
                )
            except Exception as exc:
                log.error("PaddleOCR.ocr failed on page %d: %s", page_no, exc)
                continue
            if not raw_result or not raw_result[0]:
                continue
            # Flatten results
            if isinstance(raw_result[0], dict):
                texts = raw_result[0].get("rec_texts", [])
                scores = raw_result[0].get("rec_scores", [])
                if hasattr(scores, "tolist"):
                    scores = scores.tolist()
                boxes = raw_result[0].get("rec_boxes", raw_result[0].get("rec_polys", []))
                if hasattr(boxes, "tolist"):
                    boxes = boxes.tolist()
                for idx, text in enumerate(texts):
                    if not text:
                        continue
                    score = scores[idx] if idx < len(scores) else None
                    bbox = boxes[idx] if idx < len(boxes) else None
                    if bbox is None or len(bbox) != 4:
                        continue
                    x0, y0, x1, y1 = bbox
                    if score is not None:
                        all_scores.append(float(score))
                    page_blocks.append({
                        "text": text,
                        "bbox": [float(x0), float(y0), float(x1), float(y1)],
                        "type": "line",
                        "score": float(score) if score is not None else None,
                        "page": page_no,
                    })
            else:
                # Legacy
                for line in raw_result[0]:
                    if len(line) < 2 or not line[1][0]:
                        continue
                    points, (text, score) = line
                    x0, y0, x1, y1 = _quad_to_box(points)
                    all_scores.append(score)
                    page_blocks.append({
                        "text": text,
                        "bbox": [float(x0), float(y0), float(x1), float(y1)],
                        "type": "line",
                        "score": score,
                        "page": page_no,
                    })
        all_blocks.extend(page_blocks)
    avg_conf = np.mean(all_scores) if all_scores else 0.0
    return all_blocks, avg_conf


# Allow longer warmup by default; override via CV_PARSER_SAFE_OCR_TIMEOUT
SAFE_OCR_TIMEOUT = int(os.getenv("CV_PARSER_SAFE_OCR_TIMEOUT", "300"))

MODEL_ROOT = Path(os.path.expanduser("~/.paddlex/official_models"))
BASE_MODELS = (
    "PP-OCRv5_mobile_det",
    "en_PP-OCRv5_mobile_rec",
)
LAYOUT_MODELS = (
    "PP-DocLayout_plus-M",
    "PP-DocLayout_plus-L",
)
BLOCK_MODELS = ("PP-DocBlockLayout",)
REQUIRED_MODELS = BASE_MODELS + LAYOUT_MODELS + BLOCK_MODELS

PaddleOCRCls = None
PPStructureV3Cls = None
PPStructureLegacyCls = None


def _resolve_ocr_device() -> str:
    device = os.environ.get("CV_OCR_DEVICE", "cpu").strip().lower()
    if device in {"gpu", "cuda"}:
        return "gpu"
    return "cpu"


def _resolve_det_model_name(device: str) -> Optional[str]:
    override = os.environ.get("CV_OCR_DET_NAME")
    if override:
        return override
    if device == "cpu":
        return "PP-OCRv5_mobile_det"
    return None


def _resolve_rec_model_name(device: str) -> Optional[str]:
    override = os.environ.get("CV_OCR_REC_NAME")
    if override:
        return override
    if device == "cpu":
        return "en_PP-OCRv5_mobile_rec"
    return None


def _paddleocr_version() -> str:
    try:
        import paddleocr  # type: ignore

        return getattr(paddleocr, "__version__", "0")
    except Exception:  # pragma: no cover - paddleocr missing
        return "0"


def _paddleocr_major_version() -> int:
    version = _paddleocr_version()
    try:
        return int(version.split(".")[0])
    except Exception:  # pragma: no cover - defensive
        return 0


def _pkg_versions() -> Dict[str, str]:
    versions: Dict[str, str] = {}
    for name in ("paddle", "paddleocr", "pypdfium2", "pytesseract"):
        try:
            mod = __import__(name)
            versions[name] = getattr(mod, "__version__", "<unknown>")
        except Exception:
            versions[name] = "<missing>"
    return versions


def _patch_paddle_predictor_option() -> None:
    if os.environ.get("CV_PARSER_ENABLE_PADDLE_PATCH", "").lower() not in TRUE_VALUES:
        return
    """Patch PaddleOCR v3.x to work with older PaddlePredictorOption API."""

    if _paddleocr_major_version() < 3:
        return

    try:
        from paddleocr import _common_args as common_args_mod  # type: ignore
        from paddlex.inference import PaddlePredictorOption
    except Exception:  # pragma: no cover - optional dependency missing
        return

    prepare_fn = getattr(common_args_mod, "prepare_common_init_args", None)
    if prepare_fn is None:
        return

    # If the bundled prepare_common_init_args already handles the new signature,
    # avoid re-wrapping.
    if getattr(prepare_fn, "__name__", "").startswith("_compat_cvparser"):
        return

    from paddlex.utils.device import get_default_device, parse_device

    def _compat_prepare_common_init_args(model_name, common_args):
        device = common_args["device"]
        if device is None:
            device = get_default_device()
        device_type, device_ids = parse_device(device)
        if device_ids is not None:
            device_id = device_ids[0]
        else:
            device_id = None

        init_kwargs = {}
        init_kwargs["use_hpip"] = common_args["enable_hpi"]
        init_kwargs["hpi_config"] = {
            "device_type": device_type,
            "device_id": device_id,
        }

        try:
            predictor_option = PaddlePredictorOption(
                model_name, device_type=device_type, device_id=device_id
            )
        except TypeError:
            predictor_option = PaddlePredictorOption()
            setdefault = getattr(predictor_option, "setdefault_by_model_name", None)
            if callable(setdefault) and model_name:
                try:
                    setdefault(model_name)
                except Exception:  # pragma: no cover - best effort only
                    log.debug(
                        "setdefault_by_model_name failed for model %s", model_name, exc_info=True
                    )
            set_device = getattr(predictor_option, "set_device", None)
            if callable(set_device):
                try:
                    set_device(device_type, device_id)
                except Exception:  # pragma: no cover - best effort only
                    log.debug(
                        "set_device failed for %s/%s", device_type, device_id, exc_info=True
                    )
            else:  # pragma: no cover - fallback attributes
                predictor_option.device_type = device_type
                predictor_option.device_id = device_id

        if device_type == "gpu":
            if common_args["use_pptrt"]:
                if common_args["pptrt_precision"] == "fp32":
                    predictor_option.run_mode = "trt_fp32"
                else:
                    predictor_option.run_mode = "trt_fp16"
            else:
                predictor_option.run_mode = "paddle"
        elif device_type == "cpu":
            enable_mkldnn = common_args["enable_mkldnn"]
            run_mode = "mkldnn" if enable_mkldnn else "paddle"
            try:
                supported_modes = set()
                try:
                    supported_modes = set(predictor_option.get_support_run_mode())  # type: ignore[attr-defined]
                except Exception:  # pragma: no cover - optional API
                    pass
                if run_mode == "mkldnn" and supported_modes and "mkldnn" not in supported_modes:
                    run_mode = "paddle"
                predictor_option.run_mode = run_mode
            except ValueError:
                predictor_option.run_mode = "paddle"
            if run_mode == "mkldnn" and hasattr(predictor_option, "mkldnn_cache_capacity"):
                predictor_option.mkldnn_cache_capacity = common_args["mkldnn_cache_capacity"]
            if hasattr(predictor_option, "cpu_threads"):
                predictor_option.cpu_threads = common_args["cpu_threads"]
        else:
            predictor_option.run_mode = "paddle"

        init_kwargs["pp_option"] = predictor_option
        return init_kwargs

    _compat_prepare_common_init_args.__name__ = "_compat_cvparser_prepare_common_init_args"
    common_args_mod.prepare_common_init_args = _compat_prepare_common_init_args

    try:
        from paddleocr._pipelines import base as pipelines_base  # type: ignore
    except Exception:  # pragma: no cover - optional module layout changes
        pipelines_base = None

    if pipelines_base is not None and hasattr(pipelines_base, "prepare_common_init_args"):
        pipelines_base.prepare_common_init_args = _compat_prepare_common_init_args


_patch_paddle_predictor_option()


def _ocr_debug_enabled() -> bool:
    return os.environ.get("CV_OCR_DEBUG", "0").lower() in TRUE_VALUES


def _debug_pass_dir(pdf_path: Path, pass_id: int) -> Path:
    digest = hashlib.sha1(str(pdf_path).encode("utf-8")).hexdigest()[:8]
    base_dir = Path(tempfile.gettempdir()) / f"cv_ocr_dbg_{digest}"
    return base_dir / f"pass{pass_id}"


def _log_ocr_summary(
    *,
    engine: str,
    dpi: int,
    permissive: bool,
    pass_id: int,
    summary: Dict[str, Any],
) -> None:
    pages = summary.get("pages")
    blocks = summary.get("block_count")
    chars = summary.get("raw_text_len")
    log.info(
        "[ocr] engine=%s dpi=%s permissive=%s pass=%s pages=%s blocks=%s chars=%s",
        engine,
        dpi,
        permissive,
        pass_id,
        pages,
        blocks,
        chars,
    )


def _summarize_pipeline_output(result: Any) -> Dict[str, Any]:
    diagnostics = getattr(result, "diagnostics", None)
    diag: Dict[str, Any] = diagnostics if isinstance(diagnostics, dict) else {}

    layout = getattr(result, "layout", None)
    layout_pages: List[Dict[str, Any]] = []
    layout_blocks: List[Any] = []
    if layout is not None:
        layout_pages = list(getattr(layout, "pages", []) or [])
        layout_blocks = list(getattr(layout, "blocks", []) or [])

    pages = len(layout_pages)
    blocks = len(layout_blocks)

    text_samples: List[str] = []
    if layout_blocks:
        for block in layout_blocks:
            text = getattr(block, "text", "")
            if not isinstance(text, str):
                text = str(text or "")
            text = text.strip()
            if text:
                text_samples.append(text)
            if len(text_samples) >= 10:
                break

    normalized = getattr(result, "normalized", None)
    raw_text = ""
    raw_text_len = 0
    raw_sections: List[Any] = []
    if normalized is not None:
        raw_text = getattr(normalized, "raw", "") or ""
        if isinstance(raw_text, str):
            raw_text = raw_text.strip()
            raw_text_len = len(raw_text)
        raw_sections = list(getattr(normalized, "rawSections", []) or [])
    else:
        raw_text_attr = getattr(result, "raw_text", None)
        if isinstance(raw_text_attr, str):
            raw_text = raw_text_attr.strip()
            raw_text_len = len(raw_text)

    raw_sections_count = len(raw_sections)

    if not text_samples and raw_sections:
        for entry in raw_sections:
            if isinstance(entry, dict):
                value = entry.get("content") or entry.get("text") or ""
            else:
                value = entry
            if not isinstance(value, str):
                value = str(value or "")
            value = value.strip()
            if value:
                text_samples.append(value)
            if len(text_samples) >= 10:
                break

    if not text_samples and raw_text:
        for line in raw_text.splitlines():
            stripped = line.strip()
            if stripped:
                text_samples.append(stripped)
            if len(text_samples) >= 10:
                break

    if not text_samples:
        for attr in ("texts", "rec_texts"):
            candidate = getattr(result, attr, None)
            if isinstance(candidate, Sequence) and not isinstance(candidate, (str, bytes, bytearray)):
                filtered = [str(item or "").strip() for item in candidate if str(item or "").strip()]
                if filtered:
                    text_samples.extend(filtered[:10])
                    if blocks <= 0:
                        blocks = len(filtered)
                    break

    if not pages:
        page_count_attr = getattr(result, "page_count", None)
        if isinstance(page_count_attr, int) and page_count_attr >= 0:
            pages = page_count_attr
        elif isinstance(diag.get("pages"), int):
            pages = diag["pages"]

    if blocks <= 0 and isinstance(diag.get("ocr_blocks"), int):
        blocks = int(diag["ocr_blocks"])

    summary: Dict[str, Any] = {
        "pages": pages,
        "block_count": blocks,
        "raw_text_len": raw_text_len,
        "raw_sections_count": raw_sections_count,
        "sample_texts": text_samples[:10],
        "diagnostics": diag,
    }

    if raw_text:
        summary["raw_text_preview"] = raw_text[:200]

    summary["has_text"] = bool(text_samples) or raw_text_len > 0 or raw_sections_count > 0
    return summary


def _pipeline_result_is_empty(summary: Dict[str, Any]) -> bool:
    if summary.get("block_count", 0) > 0:
        return False
    if summary.get("raw_text_len", 0) > 0:
        return False
    if summary.get("raw_sections_count", 0) > 0:
        return False
    if summary.get("sample_texts"):
        return False

    diag = summary.get("diagnostics")
    if isinstance(diag, dict):
        ocr_blocks = diag.get("ocr_blocks")
        if isinstance(ocr_blocks, int) and ocr_blocks > 0:
            return False
    return True


def _format_empty_error(
    *,
    engine: str,
    dpi: int,
    permissive: bool,
    pass_id: int,
    summary: Dict[str, Any],
) -> str:
    pages = summary.get("pages")
    blocks = summary.get("block_count")
    return (
        f"empty OCR output (engine={engine}, dpi={dpi}, permissive={permissive}, "
        f"pass={pass_id}, pages={pages}, blocks={blocks})"
    )


def _derive_empty_reason(exc: Exception | str) -> str:
    message = str(exc).strip()
    lowered = message.lower()
    if "empty ocr output" in lowered:
        return "paddle_empty_output"
    if "timeout" in lowered or "elapsed" in lowered:
        return "ocr_timeout"
    if "required paddleocr models" in lowered:
        return "paddle_models_missing"
    if "pypdfium2 is required" in lowered:
        return "pdf_render_failed"
    if "tesseract_fallback_unavailable" in lowered:
        return "tesseract_unavailable"
    if "ocr" in lowered and "failed" in lowered:
        return "ocr_failed"
    head = message.splitlines()[0].strip()
    return head[:160] if head else "ocr_failed"


def _write_debug_summary(
    *,
    pdf_path: Path,
    pass_id: int,
    engine: str,
    dpi: int,
    permissive: bool,
    summary: Dict[str, Any],
) -> Optional[Path]:
    try:
        debug_dir = _debug_pass_dir(pdf_path, pass_id)
        debug_dir.mkdir(parents=True, exist_ok=True)
        snapshot_path = debug_dir / "summary.json"
        diag_path = debug_dir / "diagnostics.json"
        diagnostics = summary.get("diagnostics") if isinstance(summary.get("diagnostics"), dict) else {}
        diag_whitelist = (
            "ocr_blocks",
            "ocr_block_counts",
            "ocr_errors",
            "ocr_passes",
            "permissive_mode",
            "ocr_page_block_counts",
            "engine",
            "avg_conf",
            "chars",
            "pages",
            "images_rendered",
            "fallback_used",
            "sections_found",
            "summary_len",
            "profile_name_extracted",
        )
        diag_snapshot = {key: diagnostics.get(key) for key in diag_whitelist if key in diagnostics} if diagnostics else {}
        payload = {
            "engine": engine,
            "dpi": dpi,
            "permissive": permissive,
            "pass": pass_id,
            "pages": summary.get("pages"),
            "blocks": summary.get("block_count"),
            "raw_text_len": summary.get("raw_text_len"),
            "raw_sections": summary.get("raw_sections_count"),
            "sample_texts": summary.get("sample_texts"),
        }
        if diag_snapshot:
            payload["diagnostics"] = diag_snapshot
        snapshot_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        # Persist the full diagnostics map for deep dives
        try:
            if diagnostics:
                diag_path.write_text(json.dumps(diagnostics, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as _exc:  # pragma: no cover - best effort
            log.debug("[ocr] failed writing diagnostics.json: %s", _exc)
        log.warning("[ocr] debug snapshot written to %s", debug_dir)
        return debug_dir
    except Exception as exc:  # pragma: no cover - diagnostics best effort
        log.warning("[ocr] failed to write debug snapshot: %s", exc)
        return None


def _attach_debug_dir(result: Any, debug_dir: Optional[Path]) -> None:
    if debug_dir is None:
        return
    diagnostics = getattr(result, "diagnostics", None)
    path_str = str(debug_dir)
    if isinstance(diagnostics, dict):
        diagnostics.setdefault("ocr_debug_dir", path_str)
    else:
        try:
            setattr(result, "ocr_debug_dir", path_str)
        except Exception:  # pragma: no cover - best effort only
            pass


def _finalize_ocr_result(
    result: Any,
    *,
    pdf_path: Path,
    engine: str,
    dpi: int,
    permissive: bool,
    pass_id: int,
    force_log: bool,
) -> Any:
    summary = getattr(result, "_cvparser_result_summary", None)
    already_checked = getattr(result, "_cvparser_empty_checked", False)
    if summary is None or not isinstance(summary, dict):
        summary = _summarize_pipeline_output(result)

    should_log = force_log or not already_checked
    if should_log:
        _log_ocr_summary(
            engine=engine,
            dpi=dpi,
            permissive=permissive,
            pass_id=pass_id,
            summary=summary,
        )

    debug_dir: Optional[Path] = None
    if should_log and _ocr_debug_enabled():
        debug_dir = _write_debug_summary(
            pdf_path=pdf_path,
            pass_id=pass_id,
            engine=engine,
            dpi=dpi,
            permissive=permissive,
            summary=summary,
        )
        _attach_debug_dir(result, debug_dir)

    if _pipeline_result_is_empty(summary):
        raise RuntimeError(
            _format_empty_error(
                engine=engine,
                dpi=dpi,
                permissive=permissive,
                pass_id=pass_id,
                summary=summary,
            )
        )

    try:
        setattr(result, "_cvparser_result_summary", summary)
        setattr(result, "_cvparser_empty_checked", True)
    except Exception:  # pragma: no cover - defensive
        pass
    diagnostics = getattr(result, "diagnostics", None)
    if isinstance(diagnostics, dict):
        diagnostics.setdefault("empty_reason", None)
    return result


def _tables_enabled() -> bool:
    return os.environ.get("PADDLE_RESUME_ENABLE_TABLES", "").lower() in TRUE_VALUES


def _charts_enabled() -> bool:
    return os.environ.get("PADDLE_RESUME_ENABLE_CHARTS", "").lower() in TRUE_VALUES


def _formulas_enabled() -> bool:
    return os.environ.get("PADDLE_RESUME_ENABLE_FORMULAS", "").lower() in TRUE_VALUES


def _pp_structure_models_available() -> bool:
    return all(_model_dir(name).exists() for name in BLOCK_MODELS + LAYOUT_MODELS)


def _pp_structure_disabled() -> bool:
    return os.environ.get("PADDLE_RESUME_DISABLE_PPSTRUCTURE", "").lower() in TRUE_VALUES


def _should_use_pp_structure() -> bool:
    if _pp_structure_disabled():
        return False
    if _tables_enabled():
        return True
    return _pp_structure_models_available()


def _resolve_rec_batch_num(override: Optional[int]) -> Optional[int]:
    if override is not None:
        try:
            return max(1, int(override))
        except (TypeError, ValueError):  # pragma: no cover - defensive
            log.warning("Invalid rec_batch_num override %s; ignoring", override)
    env_value = os.environ.get("PADDLE_REC_BATCH_NUM")
    if env_value:
        try:
            return max(1, int(env_value))
        except ValueError:
            log.warning("Invalid PADDLE_REC_BATCH_NUM=%s; defaulting", env_value)
    if sys.platform == "darwin":
        return 4
    return None


def _model_dir(name: str) -> Path:
    return MODEL_ROOT / name


def _validate_model_directory(path: Path) -> bool:
    if not path.exists() or not path.is_dir():
        return False
    required_files = {"inference.pdmodel", "inference.pdiparams"}
    existing = {child.name for child in path.iterdir() if child.is_file()}
    return required_files.issubset(existing)


def _select_layout_model() -> str:
    for candidate in LAYOUT_MODELS:
        if _model_dir(candidate).exists():
            return candidate
    return LAYOUT_MODELS[-1]


def _required_models_for_current_mode(require_pp: bool = False) -> Sequence[str]:
    required: List[str] = list(BASE_MODELS)
    if require_pp or _tables_enabled():
        required.extend(BLOCK_MODELS)
        required.extend(LAYOUT_MODELS)
    return required


def _network_available(timeout: float = 2.0) -> bool:
    hosts = (
        ("huggingface.co", 443),
        ("paddle-model-ecology.bj.bcebos.com", 443),
    )
    for host, port in hosts:
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            continue
    return False


def _ensure_local_models(require_pp: bool = False) -> None:
    required = _required_models_for_current_mode(require_pp)
    missing = [name for name in required if not _validate_model_directory(_model_dir(name))]
    if missing:
        missing_str = ", ".join(missing)
        raise RuntimeError(
            "Required PaddleOCR models not found locally: "
            f"{missing_str}. Set PADDLE_PDX_MODEL_SOURCE=local and pre-download "
            "the required models into ~/.paddlex/official_models/ before running OCR."
        )


def _quad_to_box(points: Iterable[Iterable[float]]) -> Tuple[float, float, float, float]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def _tesseract_fallback_on_images(images: List[np.ndarray]) -> Tuple[List[Dict[str, Any]], float]:
    """Run Tesseract OCR on a list of images and return blocks + avg conf.

    Uses pytesseract image_to_data to extract word boxes; returns simple
    per-word blocks. Average confidence is computed over non-negative
    conf values.
    """
    try:
        import pytesseract
        from pytesseract import Output as _PytOutput
    except Exception as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(f"tesseract_fallback_unavailable:{exc}")

    # Read tuning knobs
    oem = os.environ.get("CV_TESSERACT_OEM", "1").strip()
    psm = os.environ.get("CV_TESSERACT_PSM", "6").strip()
    lang = os.environ.get("CV_TESSERACT_LANG", "eng").strip()
    cfg = f"--oem {oem} --psm {psm}"

    all_blocks: List[Dict[str, Any]] = []
    confidences: List[float] = []
    for page_no, img in enumerate(images, 1):
        # Quick preproc: grayscale + light binarize + mild sharpen
        try:
            from PIL import Image, ImageFilter, ImageOps
            pil = Image.fromarray(img)
            pil = ImageOps.grayscale(pil)
            pil = pil.filter(ImageFilter.UnsharpMask(radius=1, percent=100, threshold=3))
            # Light binarization
            pil = pil.point(lambda x: 0 if x < 180 else 255, mode='1').convert('L')
            img_u8 = np.array(pil).astype(np.uint8)
        except Exception:
            img_u8 = img.clip(0, 255).astype(np.uint8) if img.dtype != np.uint8 else img

        data = pytesseract.image_to_data(img_u8, lang=lang, config=cfg, output_type=_PytOutput.DICT)
        n = len(data.get("level", []))
        for i in range(n):
            text = (data.get("text", [""])[i] or "").strip()
            if not text:
                continue
            try:
                conf = float(data.get("conf", ["-1"])[i])
            except Exception:
                conf = -1.0
            x = int(data.get("left", [0])[i] or 0)
            y = int(data.get("top", [0])[i] or 0)
            w = int(data.get("width", [0])[i] or 0)
            h = int(data.get("height", [0])[i] or 0)
            x0, y0, x1, y1 = float(x), float(y), float(x + w), float(y + h)
            if conf >= 0:
                confidences.append(conf / 100.0 if conf > 1.0 else conf)
            all_blocks.append(
                {
                    "text": text,
                    "bbox": [x0, y0, x1, y1],
                    "type": "word",
                    "score": float(conf) if conf >= 0 else None,
                    "page": page_no,
                }
            )
    avg_conf = float(np.mean(confidences)) if confidences else 0.0
    return all_blocks, avg_conf


def _run_ocr(ocr_engine, img_path: Path, engine_kind: str) -> List[Dict[str, Any]]:
    """Invoke OCR engine and return block dictionaries with raw bbox coordinates."""

    path_str = str(img_path)
    blocks: List[Dict[str, Any]] = []

    if engine_kind == "ppstructure":
        candidates: List[Any] = []
        try:
            prediction = ocr_engine.predict([path_str])  # type: ignore[attr-defined]
            if prediction is not None:
                candidates.append(prediction)
        except Exception:  # pragma: no cover
            log.debug("PPStructureV3.predict failed on %s", img_path, exc_info=True)

        if not candidates:
            try:
                predict_iter = getattr(ocr_engine, "predict_iter", None)
                if callable(predict_iter):
                    iter_result = list(predict_iter([path_str]))
                    candidates.append(iter_result)
            except Exception:  # pragma: no cover - optional API
                log.debug("PPStructureV3.predict_iter failed on %s", img_path, exc_info=True)

        if not candidates:
            try:
                legacy_result = ocr_engine(path_str)  # type: ignore[call-arg]
                candidates.append(legacy_result)
            except Exception:  # pragma: no cover - legacy call path
                log.debug("PPStructureV3 legacy call failed on %s", img_path, exc_info=True)

        def _flatten(candidate: Any) -> None:
            if candidate is None:
                return
            if isinstance(candidate, dict):
                layout_res = candidate.get("layout_res") or candidate.get("layout")
                if layout_res:
                    _flatten(layout_res)
                elif "text" in candidate:
                    blocks.append(candidate)
                return
            if isinstance(candidate, (list, tuple)):
                for item in candidate:
                    _flatten(item)

        for candidate in candidates:
            _flatten(candidate)

    else:
        try:
            if hasattr(ocr_engine, "predict"):
                predict_fn = getattr(ocr_engine, "predict")
                try:
                    raw_result = predict_fn(path_str)  # type: ignore[misc]
                except TypeError:
                    raw_result = predict_fn([path_str])  # type: ignore[misc]
            else:
                raw_result = ocr_engine.ocr(path_str)  # type: ignore[attr-defined]
        except Exception as exc:  # pragma: no cover
            log.error("PaddleOCR.ocr failed on %s: %s", img_path, exc)
            return []
        if not raw_result:
            return []

        # The new PaddleOCR pipeline returns a list of dictionaries with vectorized
        # detection/recognition results. Older versions returned a list of
        # (points, (text, score)) tuples. Support both shapes for compatibility.
        if isinstance(raw_result[0], dict):
            for entry in raw_result:
                texts = entry.get("rec_texts") or []
                scores = entry.get("rec_scores") or []
                if hasattr(scores, "tolist"):
                    scores = scores.tolist()
                boxes_raw = entry.get("rec_boxes")
                if boxes_raw is None:
                    boxes_raw = entry.get("rec_polys")
                boxes = boxes_raw if boxes_raw is not None else []

                # Normalize numpy arrays to standard Python lists to avoid
                # downstream serialization surprises.
                if hasattr(boxes, "tolist"):
                    boxes = boxes.tolist()

                for idx, text in enumerate(texts):
                    if not text:
                        continue
                    score = scores[idx] if idx < len(scores) else None
                    bbox = boxes[idx] if idx < len(boxes) else None
                    if bbox is None:
                        continue
                    if isinstance(bbox, dict):
                        # Unexpected structure, skip gracefully.
                        continue
                    if len(bbox) == 4:
                        x0, y0, x1, y1 = bbox
                    else:
                        try:
                            x0, y0, x1, y1 = _quad_to_box(bbox)
                        except Exception:
                            continue
                    blocks.append(
                        {
                            "text": text,
                            "bbox": [float(x0), float(y0), float(x1), float(y1)],
                            "type": "line",
                            "score": float(score) if score is not None else None,
                        }
                    )
        else:
            from collections import deque

            def _is_line(candidate: Any) -> bool:
                if not isinstance(candidate, (list, tuple)) or len(candidate) < 2:
                    return False
                text_part = candidate[1]
                if not isinstance(text_part, (list, tuple)) or len(text_part) == 0:
                    return False
                return isinstance(text_part[0], str)

            queue: deque[Any] = deque([raw_result])
            line_items: List[Any] = []
            while queue:
                node = queue.popleft()
                if _is_line(node):
                    line_items.append(node)
                    continue
                if isinstance(node, (list, tuple)):
                    queue.extend(node)

            for line in line_items:
                try:
                    points, (text, score) = line
                except (ValueError, TypeError):
                    continue
                if not text:
                    continue
                try:
                    x0, y0, x1, y1 = _quad_to_box(points)
                except Exception:
                    continue
                blocks.append(
                    {
                        "text": text,
                        "bbox": [float(x0), float(y0), float(x1), float(y1)],
                        "type": "line",
                        "score": score,
                    }
                )

    return blocks


def _extract_ocr_pdf_internal(
    pdf_path: Path,
    dpi: int = 300,
    engine: str = "pypdfium2",
    rec_batch_num: Optional[int] = None,
    permissive: bool = False,
    pass_id: int = 1,
) -> PipelineResult:
    """Extract a NormalizedCv using OCR."""

    # Enforce single-thread mode to prevent segfaults in Docker/PaddleOCR
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["OPENBLAS_NUM_THREADS"] = "1"
    os.environ["MKL_NUM_THREADS"] = "1"
    os.environ["NUMEXPR_NUM_THREADS"] = "1"
    os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")

    try:
        import pypdfium2  # type: ignore  # noqa: F401
    except Exception:
        # We only support pypdfium2. Do not fall back to pymupdf in commercial builds.
        raise RuntimeError(
            "pypdfium2 is required for OCR rendering. Install pypdfium2 to enable OCR mode."
        )

    major_version = _paddleocr_major_version()

    global PaddleOCRCls
    if PaddleOCRCls is None:
        try:
            from paddleocr import PaddleOCR as _PaddleOCR  # type: ignore

            PaddleOCRCls = _PaddleOCR
        except Exception as exc:  # pragma: no cover - dependency optional
            raise RuntimeError(
                "PaddleOCR is not installed. Install paddleocr>=3.0.0 to enable OCR mode."
            ) from exc

    global PPStructureV3Cls, PPStructureLegacyCls
    use_pp_structure = _should_use_pp_structure()
    if use_pp_structure:
        if major_version >= 3 and PPStructureV3Cls is None:
            try:
                from paddleocr import PPStructureV3 as _PPStructureV3  # type: ignore

                PPStructureV3Cls = _PPStructureV3
            except Exception as exc:  # pragma: no cover - optional dependency issues
                log.warning("PPStructureV3 unavailable (%s); falling back to PaddleOCR only.", exc)
                PPStructureV3Cls = None
                use_pp_structure = False
        elif major_version >= 2 and PPStructureLegacyCls is None:
            try:
                from paddleocr import PPStructure as _PPStructure  # type: ignore

                PPStructureLegacyCls = _PPStructure
            except Exception as exc:  # pragma: no cover - optional dependency issues
                log.warning("PPStructure unavailable (%s); falling back to PaddleOCR only.", exc)
                PPStructureLegacyCls = None
                use_pp_structure = False

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(pdf_path)

    force_local = os.environ.get("PADDLE_PDX_MODEL_SOURCE", "").lower() == "local"
    network_ok = _network_available()
    # Prefer local models if present, but do not forcibly set LOCAL when network is unavailable
    # unless the user explicitly requested it via PADDLE_PDX_MODEL_SOURCE=local.
    required_names = _required_models_for_current_mode(require_pp=use_pp_structure or _tables_enabled())
    have_local = all(_validate_model_directory(_model_dir(n)) for n in required_names)
    if force_local:
        os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "local")
        _ensure_local_models(require_pp=use_pp_structure or _tables_enabled())
    elif have_local:
        # Cache is already present; prefer LOCAL to avoid re-download churn.
        os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "local")
    else:
        # No local cache present. Do not force LOCAL just because network check failed.
        # Allow PaddleOCR to attempt remote resolution; failure will be handled by safe wrappers.
        if not network_ok:
            log.warning(
                "[ocr] No local models found and network appears unavailable; proceeding without forcing LOCAL."
            )

    # Render pages to images using pypdfium2 for memory efficiency.
    from tempfile import TemporaryDirectory

    layout = LayoutResult()
    normalized = NormalizedCv(rawSections=[], raw=None)

    engine_kind = "paddleocr"
    ocr_engine = None
    batch_num = _resolve_rec_batch_num(rec_batch_num)
    tables_enabled = _tables_enabled()
    charts_enabled = _charts_enabled()
    formulas_enabled = _formulas_enabled()
    device = _resolve_ocr_device()

    if use_pp_structure:
        if major_version >= 3 and PPStructureV3Cls is not None:
            layout_model = _select_layout_model()
            ocr_kwargs = dict(
                lang="en",
                layout_detection_model_name=layout_model,
                use_chart_recognition=charts_enabled,
                use_table_recognition=tables_enabled,
                use_region_detection=True,
                use_formula_recognition=formulas_enabled,
            )
            if batch_num is not None:
                ocr_kwargs["text_recognition_batch_size"] = batch_num
            try:
                ocr_engine = PPStructureV3Cls(**ocr_kwargs)
                engine_kind = "ppstructure"
            except Exception as exc:  # pragma: no cover - fall back to PaddleOCR
                log.warning("PPStructureV3 failed to initialize (%s); falling back to PaddleOCR.", exc)
                ocr_engine = None
                use_pp_structure = False
        elif major_version >= 2 and PPStructureLegacyCls is not None:
            struct_kwargs: Dict[str, Any] = {
                "layout": tables_enabled or charts_enabled or formulas_enabled,
                "image_orientation": False,
                "table": tables_enabled,
                "ocr": True,
            }
            try:
                ocr_engine = PPStructureLegacyCls(**struct_kwargs)  # type: ignore[call-arg]
                engine_kind = "ppstructure"
            except Exception as exc:  # pragma: no cover - fall back to PaddleOCR
                log.warning("PPStructure failed to initialize (%s); falling back to PaddleOCR.", exc)
                ocr_engine = None
                use_pp_structure = False

    if ocr_engine is None:
        # PaddleOCR defaults to CPU execution when no explicit device is provided.
        # Disable heavy orientation/unwarping modules to keep the CPU footprint small.
        if major_version >= 3:
            text_kwargs: Dict[str, Any] = {
                "device": device,
                "enable_mkldnn": False,
                "cpu_threads": 1,
                "enable_hpi": False,
                "use_doc_orientation_classify": False,
                "use_doc_unwarping": False,
                "use_textline_orientation": False,
                "ocr_version": "PP-OCRv5",
                "lang": "en",
            }
            det_limit_env = os.environ.get("CV_OCR_DET_LIMIT_SIDE_LEN")
            if det_limit_env:
                try:
                    text_kwargs["text_det_limit_side_len"] = int(det_limit_env)
                except ValueError:
                    log.warning("Invalid CV_OCR_DET_LIMIT_SIDE_LEN=%s; ignoring", det_limit_env)
            det_model_name = _resolve_det_model_name(device)
            rec_model_name = _resolve_rec_model_name(device)
            if det_model_name:
                text_kwargs["text_detection_model_name"] = det_model_name
            # Prefer Latin multilingual recognizer for FR/ES/IT/DE documents when unset via env
            chosen_rec = rec_model_name
            if not os.environ.get("CV_OCR_REC_NAME"):
                try:
                    if _should_prefer_latin_recognizer(pdf_path):
                        chosen_rec = "latin_PP-OCRv5_mobile_rec"
                except Exception:
                    pass
            if chosen_rec:
                text_kwargs["text_recognition_model_name"] = chosen_rec
            if batch_num is not None:
                text_kwargs["text_recognition_batch_size"] = batch_num
            ocr_engine = PaddleOCRCls(**text_kwargs)
        else:
            text_kwargs_legacy: Dict[str, Any] = {
                "use_angle_cls": False,
                "lang": "en",
            }
            if batch_num is not None:
                text_kwargs_legacy["rec_batch_num"] = batch_num
            ocr_engine = PaddleOCRCls(**text_kwargs_legacy)
        engine_kind = "paddleocr"

    grouped_texts: Dict[str, List[str]] = defaultdict(list)

    ocr_errors: List[str] = []
    page_block_counts: Dict[int, int] = {}

    debug_mode = _ocr_debug_enabled()
    debug_pass_dir: Optional[Path] = None

    # Render to in-memory np arrays
    np_images = render_pdf_to_np_arrays(pdf_path, dpi=dpi)
    total_pages = len(np_images)
    log.info(
        "[ocr] loaded %s pages=%d dpi=%d engine=%s permissive=%s",
        pdf_path,
        total_pages,
        dpi,
        engine,
        permissive,
    )

    # Run OCR on arrays
    log.info(
        "[ocr-debug] starting Paddle OCR run engine=%s pages=%d", engine_kind, total_pages
    )
    ocr_result, avg_conf = run_paddle_on_images(ocr_engine, np_images, engine_kind)
    page_block_counts = {
        idx + 1: len([b for b in ocr_result if b.get("page", idx + 1) == idx + 1])
        for idx in range(total_pages)
    }
    log.info(
        "[ocr] processed %d images for %s (dpi=%d, permissive=%s) avg_conf=%.3f",
        total_pages,
        pdf_path,
        dpi,
        permissive,
        avg_conf,
    )

    full_text_parts = []
    ocr_blocks_total = len(ocr_result)
    page_width, page_height = 0, 0  # Default; update from first image if needed
    if np_images:
        h, w, _ = np_images[0].shape
        page_width, page_height = w, h

    for block in ocr_result:
        text = block.get("text", "") or ""
        if not text:
            continue
        full_text_parts.append(text)
        bbox = block.get("bbox", [0, 0, 0, 0])
        block_type_raw = block.get("type", "text")
        block_type = str(block_type_raw or "text").lower()
        grouped_texts[block_type].append(text)
        if len(bbox) == 4:
            normalised = normalize_bbox(bbox, page_width, page_height)
        else:
            normalised = [0, 0, 0, 0]
        layout.blocks.append(
            LayoutBlock(
                page=block.get("page", 1),
                text=text,
                bbox=normalised,
                block_type=block_type_raw or "text",
                metadata={k: v for k, v in block.items() if k not in {"text", "bbox", "type"}},
            )
        )

    if debug_mode and np_images:
        try:
            debug_pass_dir = _debug_pass_dir(pdf_path, pass_id)
            debug_pass_dir.mkdir(parents=True, exist_ok=True)
            for existing in debug_pass_dir.glob("page*.png"):
                try:
                    existing.unlink()
                except Exception:
                    log.debug(
                        "[ocr] failed to remove old debug artifact %s", existing, exc_info=True
                    )
            from PIL import Image

            for idx, arr in enumerate(np_images, 1):
                target = debug_pass_dir / f"page{idx:03d}.png"
                try:
                    Image.fromarray(arr).save(target)
                except Exception as exc:
                    log.debug("[ocr] failed to persist page %s debug image: %s", idx, exc)
        except Exception as exc:
            log.warning("[ocr] failed to persist debug images: %s", exc)

    merged_text = "\n".join(full_text_parts)
    log.info(
        "[ocr] finished %s permissive=%s blocks=%d chars=%d avg_conf=%.3f",
        pdf_path,
        permissive,
        ocr_blocks_total,
        len(merged_text),
        avg_conf,
    )
    normalized.summary = TextField(text=merged_text[:600], confidence=avg_conf) if merged_text else None
    normalized.raw = merged_text

    block_counts = {k: len(v) for k, v in grouped_texts.items()}

    diagnostics: Dict[str, Any] = {
        "strategy": "ocr_pdf",
        "pages": total_pages,
        "images_rendered": total_pages,
        "total_lines": ocr_blocks_total,
        "ocr_blocks": ocr_blocks_total,
        "ocr_block_counts": block_counts,
        "ocr_line_count": block_counts.get("line", 0),
        "avg_conf": float(avg_conf),
        "chars": len(merged_text),
        "ocr_engine": engine_kind,
        "engine": "ocr",
        "ocr_failed": False,
        "hybrid_used": False,
        "fallback_used": False,
        "sections_found": {},
        "crashed": False,
        "permissive_mode": permissive,
        "ocr_page_block_counts": page_block_counts,
        "ocr_errors": ocr_errors,
        "ocr_passes": pass_id,
        "empty_reason": None,
    }

    # Model info and package versions for traceability
    try:
        diagnostics["model_det"] = diagnostics.get("model_det") or locals().get("text_kwargs", {}).get("text_detection_model_name")  # type: ignore[name-defined]
        diagnostics["model_rec"] = diagnostics.get("model_rec") or locals().get("text_kwargs", {}).get("text_recognition_model_name")  # type: ignore[name-defined]
    except Exception:
        # If local capture failed, try environment fallbacks
        diagnostics.setdefault("model_det", os.environ.get("CV_OCR_DET_NAME") or "PP-OCRv5_mobile_det")
        diagnostics.setdefault("model_rec", os.environ.get("CV_OCR_REC_NAME") or "en_PP-OCRv5_mobile_rec")
    diagnostics["pkg_versions"] = _pkg_versions()

    # Add post-normalization convenience fields for downstream diagnostics
    try:
        diagnostics["summary_len"] = int(len(getattr(normalized.summary, "text", "") or ""))
    except Exception:
        diagnostics["summary_len"] = 0
    try:
        diagnostics["profile_name_extracted"] = getattr(normalized, "name", None)
    except Exception:
        diagnostics["profile_name_extracted"] = None

    diagnostics["ocr_debug_dir"] = str(debug_pass_dir) if debug_pass_dir is not None else None

    diagnostics["pp_structure_counts"] = {"blocks": block_counts, "sections": {}}

    if ocr_blocks_total == 0:
        diagnostics["empty_reason"] = diagnostics.get("empty_reason") or "paddle_no_text_detected"
    if ocr_blocks_total == 0 and len(layout.pages) > 0:
        diagnostics["ocr_failed"] = True
        log.warning("OCR produced no text for %s despite rendering %s pages", pdf_path, len(layout.pages))
        if engine_kind == "ppstructure":
            log.warning("PP-Structure returned zero blocks for %s", pdf_path)
        if not permissive:
            diagnostics["ocr_empty"] = True

    parser = hybrid_mapping.get_hybrid_parser()
    strict = StrictContact(name=None, email=None, phone=None, location=None)
    section_counts: Dict[str, int] = {}
    hybrid_used = False
    preferred_types = ("title", "paragraph", "text", "line")
    structured_hybrid_parts: List[str] = []
    for block_type in preferred_types:
        structured_hybrid_parts.extend(grouped_texts.get(block_type, []))
    hybrid_input_text = "\n".join(structured_hybrid_parts) if structured_hybrid_parts else merged_text
    if parser and hybrid_input_text:
        packed = None
        try:
            packed = parser.parse_text(hybrid_input_text)
        except Exception as exc:  # pragma: no cover
            log.debug("Hybrid parser failed on OCR text: %s", exc)
        if packed:
            strict_candidate, hybrid_used, section_counts = hybrid_mapping.apply_hybrid_mapping(
                normalized, packed, tuple(layout.blocks)
            )
            if strict_candidate:
                strict = strict_candidate
    elif not parser and layout.blocks:
        _, _, section_counts = hybrid_mapping.apply_hybrid_mapping(
            normalized, {}, tuple(layout.blocks)
        )

    if not section_counts and layout.blocks and not getattr(normalized, "_pp_structure_used", False):
        _, _, section_counts = hybrid_mapping.apply_hybrid_mapping(
            normalized, {}, tuple(layout.blocks)
        )
    diagnostics["hybrid_used"] = hybrid_used

    diagnostics["pp_structure_used"] = bool(getattr(normalized, "_pp_structure_used", False))
    diagnostics["pp_structure_counts"]["sections"] = getattr(normalized, "_pp_section_counts", {})

    fallback_used = False
    needs_fallback = any(
        (
            not normalized.experience,
            not normalized.education,
            not normalized.skills,
            not normalized.languages,
            not normalized.achievements,
        )
    )

    raw_sections_payload = []
    if needs_fallback:
        section_map = parse_sections(merged_text)

        if not normalized.experience:
            experience_items = [ArrayItem(content=entry, confidence=0.35) for entry in section_map["experience"]]
            if experience_items:
                normalized.experience = experience_items
                raw_sections_payload.extend(
                    {"label": "EXPERIENCE", "content": entry} for entry in section_map["experience"]
                )
                section_counts["EXPERIENCE"] = len(section_map["experience"])
                fallback_used = True

        if not normalized.education:
            education_items = [ArrayItem(content=entry, confidence=0.35) for entry in section_map["education"]]
            if education_items:
                normalized.education = education_items
                raw_sections_payload.extend(
                    {"label": "EDUCATION", "content": entry} for entry in section_map["education"]
                )
                section_counts["EDUCATION"] = len(section_map["education"])
                fallback_used = True

        if not normalized.skills:
            skills_tokens = split_tokens(section_map["skills"])
            if skills_tokens:
                normalized.skills = TextField(text=", ".join(skills_tokens), confidence=0.3)
                raw_sections_payload.extend({"label": "SKILLS", "content": token} for token in skills_tokens)
                section_counts["SKILLS"] = len(skills_tokens)
                fallback_used = True

        if not normalized.languages:
            language_tokens = split_tokens(section_map["languages"])
            if language_tokens:
                normalized.languages = TextField(text=", ".join(language_tokens), confidence=0.3)
                normalized.languagesRaw = language_tokens
                raw_sections_payload.extend({"label": "LANGUAGES", "content": token} for token in language_tokens)
                section_counts["LANGUAGES"] = len(language_tokens)
                fallback_used = True

        if not normalized.achievements:
            achievement_items = [entry for entry in section_map["achievements"] if entry.strip()]
            if achievement_items:
                normalized.achievements = TextField(text="\n".join(achievement_items), confidence=0.25)
                raw_sections_payload.extend({"label": "ACHIEVEMENTS", "content": entry} for entry in achievement_items)
                section_counts["ACHIEVEMENTS"] = len(achievement_items)
                fallback_used = True

    if raw_sections_payload and not normalized.rawSections:
        normalized.rawSections = raw_sections_payload

    for key in ("EXPERIENCE", "EDUCATION", "SKILLS", "LANGUAGES", "ACHIEVEMENTS"):
        section_counts.setdefault(key, 0)

    diagnostics["fallback_used"] = fallback_used
    diagnostics["sections_found"] = section_counts

    if permissive and (ocr_blocks_total == 0 or not (merged_text or "").strip()):
        log.warning(
            "[ocr] permissive mode still produced no text for %s; falling back to pdfplumber text extraction",
            pdf_path,
        )
        # pdfplumber fallback
        with pdfplumber.open(pdf_path) as pdf:
            text_parts = []
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text_parts.append(page_text.strip())
        fallback_text = "\n".join(text_parts).strip()
        if fallback_text:
            normalized.raw = fallback_text
            normalized.summary = TextField(text=fallback_text[:600], confidence=0.5)
            diagnostics["fallback_used"] = True
            diagnostics["pdfplumber_used"] = True
            diagnostics["engine"] = "pdfplumber"
            diagnostics["total_lines"] = len(fallback_text.splitlines())
            diagnostics["avg_conf"] = 0.5  # Approximate for text extraction
            diagnostics["empty_reason"] = diagnostics.get("empty_reason") or "paddle_empty_pdfplumber"
            log.info("[ocr] pdfplumber fallback extracted %d chars", len(fallback_text))
            ocr_blocks_total = len(fallback_text.splitlines())
            block_counts["line"] = ocr_blocks_total
        else:
            placeholder = f"[cv_parser] OCR and pdfplumber failed for {pdf_path.name}."
            normalized.raw = placeholder
            normalized.rawSections = [{"label": "RAW", "content": placeholder}]
            diagnostics["fallback_placeholder"] = True
            diagnostics["ocr_failed"] = True
            diagnostics["empty_reason"] = "paddle_empty_placeholder"

    # Convenience: ensure summary_len and profile_name_extracted present
    try:
        diagnostics["summary_len"] = int(len(getattr(normalized.summary, "text", "") or ""))
    except Exception:
        diagnostics["summary_len"] = 0
    try:
        diagnostics["profile_name_extracted"] = getattr(normalized, "name", None)
    except Exception:
        diagnostics["profile_name_extracted"] = None

    return PipelineResult(normalized=normalized, strict=strict, layout=layout, diagnostics=diagnostics)


def _ocr_worker(queue, pdf_path_str: str, dpi: int, engine: str, rec_batch_num: Optional[int], permissive: bool, pass_id: int) -> None:
    try:
        result = _extract_ocr_pdf_internal(
            Path(pdf_path_str),
            dpi=dpi,
            engine=engine,
            rec_batch_num=rec_batch_num,
            permissive=permissive,
            pass_id=pass_id,
        )
        queue.put(("ok", result))
    except Exception as exc:  # pragma: no cover - defensive guard for subprocess
        queue.put(("err", repr(exc)))


def _safe_extract_ocr_pdf(
    pdf_path: Path,
    *,
    dpi: int,
    engine: str,
    rec_batch_num: Optional[int],
    permissive: bool,
    pass_id: int,
) -> PipelineResult:
    import sys as _sys
    # Prefer fork on POSIX/Linux to avoid spawn import bootstrapping issues.
    # Use spawn on Windows or when explicitly forced via env var.
    # Use 'spawn' on Windows and macOS to avoid fork-related crashes with
    # threaded/Accelerate-backed libraries. Allow override via env.
    if _sys.platform in ("win32", "darwin") or os.environ.get("CV_PARSER_FORCE_SPAWN", "").lower() in TRUE_VALUES:
        ctx = get_context("spawn")
    else:
        try:
            ctx = get_context("fork")
        except Exception:
            ctx = get_context("spawn")
    queue_ctx = ctx.Queue(maxsize=1)
    process = ctx.Process(
        target=_ocr_worker,
        args=(queue_ctx, str(pdf_path), dpi, engine, rec_batch_num, permissive, pass_id),
        daemon=False,
    )
    process.start()
    status = None
    payload = None
    try:
        status, payload = queue_ctx.get(timeout=SAFE_OCR_TIMEOUT)
    except queue.Empty:
        status = "err"
        payload = "timeout"
    finally:
        try:
            queue_ctx.cancel_join_thread()
        except Exception:  # pragma: no cover - cleanup best effort
            pass
        process.join(timeout=5)
        if process.is_alive():
            process.terminate()
            process.join(timeout=2)
        if process.is_alive():
            try:
                process.kill()
                process.join(timeout=2)
            except AttributeError:
                pass
        try:
            queue_ctx.close()
        except Exception:  # pragma: no cover - cleanup best effort
            pass
    if status == "ok" and process.exitcode == 0:
        result = payload  # type: ignore[assignment]
        finalized = _finalize_ocr_result(
            result,
            pdf_path=pdf_path,
            engine=engine,
            dpi=dpi,
            permissive=permissive,
            pass_id=pass_id,
            force_log=True,
        )
        return finalized  # type: ignore[return-value]
    if process.exitcode not in (0, None):
        log.error("[ocr] subprocess exitcode=%s for %s", process.exitcode, pdf_path)
    if status == "err":
        log.warning("[ocr] safe subprocess error: %s", payload)
    raise RuntimeError(f"safe_ocr_failed:{payload}")


def extract_ocr_pdf(
    pdf_path: Path,
    dpi: int = 300,
    engine: str = "pypdfium2",
    rec_batch_num: Optional[int] = None,
    permissive: bool = False,
    pass_id: int = 1,
) -> PipelineResult:
    pdf_path = Path(pdf_path)
    engine_sel = os.environ.get("CV_OCR_ENGINE", "auto").strip().lower()
    if engine_sel not in {"auto", "paddle", "doctr", "tesseract"}:
        engine_sel = "auto"
    if engine_sel == "doctr":
        # docTR does not yet expose the layout artifacts this path expects; fallback to Paddle
        engine_sel = "paddle"
    empty_reason_hint: Optional[str] = None

    # Direct Tesseract route
    if engine_sel == "tesseract":
        images = render_pdf_to_np_arrays(pdf_path, dpi=dpi)
        blocks, avg_conf = _tesseract_fallback_on_images(images)
        layout = LayoutResult()
        page_width, page_height = 0, 0
        if images:
            h, w, _ = images[0].shape
            page_width, page_height = w, h
        for blk in blocks:
            text = blk.get("text", "") or ""
            if not text:
                continue
            bbox = blk.get("bbox", [0, 0, 0, 0])
            if len(bbox) == 4:
                norm = normalize_bbox(bbox, page_width, page_height)
            else:
                norm = [0, 0, 0, 0]
            layout.blocks.append(
                LayoutBlock(
                    page=blk.get("page", 1),
                    text=text,
                    bbox=norm,
                    block_type=blk.get("type", "word"),
                    metadata={k: v for k, v in blk.items() if k not in {"text", "bbox", "type"}},
                )
            )
        normalized = NormalizedCv(rawSections=[], raw=None)
        merged_text = " ".join([b.get("text", "") for b in blocks if b.get("text")]).strip()
        if merged_text:
            normalized.raw = merged_text
            normalized.summary = TextField(text=merged_text[:600], confidence=float(avg_conf))
        diagnostics: Dict[str, Any] = {
            "strategy": "ocr_pdf_tesseract",
            "pages": len(images),
            "images_rendered": len(images),
            "ocr_blocks": len(blocks),
            "avg_conf": float(avg_conf),
            "engine": "tesseract",
            "fallback_used": False,
        }
        diagnostics["chars"] = len(merged_text)
        diagnostics["sections_found"] = []
        diagnostics["pkg_versions"] = _pkg_versions()
        diagnostics.setdefault("ocr_debug_dir", None)
        diagnostics.setdefault("summary_len", int(len(getattr(normalized.summary, "text", "") or "")) if getattr(normalized, "summary", None) else 0)
        diagnostics.setdefault("profile_name_extracted", getattr(normalized, "name", None))
        diagnostics.setdefault("empty_reason", None)
        strict_empty = StrictContact(name=None, email=None, phone=None, location=None)
        result_obj = PipelineResult(normalized=normalized, strict=strict_empty, layout=layout, diagnostics=diagnostics)
        finalized = _finalize_ocr_result(
            result_obj,
            pdf_path=pdf_path,
            engine="tesseract",
            dpi=dpi,
            permissive=permissive,
            pass_id=pass_id,
            force_log=True,
        )
        return finalized
    disable_safe = os.environ.get("CV_PARSER_DISABLE_SAFE_OCR", "0").lower() in TRUE_VALUES
    if disable_safe:
        result = _extract_ocr_pdf_internal(
            pdf_path,
            dpi=dpi,
            engine=engine,
            rec_batch_num=rec_batch_num,
            permissive=permissive,
            pass_id=pass_id,
        )
        finalized = _finalize_ocr_result(
            result,
            pdf_path=pdf_path,
            engine=engine,
            dpi=dpi,
            permissive=permissive,
            pass_id=pass_id,
            force_log=True,
        )
        return finalized  # type: ignore[return-value]

    # First pass at requested DPI/engine
    try:
        result = _safe_extract_ocr_pdf(
            pdf_path,
            dpi=dpi,
            engine=engine,
            rec_batch_num=rec_batch_num,
            permissive=permissive,
            pass_id=pass_id,
        )
        finalized = _finalize_ocr_result(
            result,
            pdf_path=pdf_path,
            engine=engine,
            dpi=dpi,
            permissive=permissive,
            pass_id=pass_id,
            force_log=False,
        )
        return finalized
    except RuntimeError as exc:
        log.warning(
            "[ocr] safe OCR pass=%s failed (%s); evaluating fallback strategy",
            pass_id,
            exc,
        )
        empty_reason_hint = _derive_empty_reason(exc)
        msg = str(exc).lower()
        resource_error = any(token in msg for token in ("timeout", "killed", "oom", "out of memory"))
        low_dpi = int(os.environ.get("CV_PARSER_LOW_MEMORY_DPI", "96"))
        low_dpi = max(72, min(low_dpi, dpi))
        if resource_error and low_dpi < dpi:
            log.warning(
                "[ocr] detected resource exhaustion; retrying with permissive low DPI=%s",
                low_dpi,
            )
            try:
                low_dpi_result = _safe_extract_ocr_pdf(
                    pdf_path,
                    dpi=low_dpi,
                    engine=engine,
                    rec_batch_num=rec_batch_num,
                    permissive=True,
                    pass_id=pass_id + 1,
                )
                summary = _summarize_pipeline_output(low_dpi_result)
                if not _pipeline_result_is_empty(summary):
                    low_dpi_result.diagnostics["ocr_passes"] = pass_id + 1
                    low_dpi_result.diagnostics["low_memory_dpi"] = low_dpi
                    finalized = _finalize_ocr_result(
                        low_dpi_result,
                        pdf_path=pdf_path,
                        engine=engine,
                        dpi=low_dpi,
                        permissive=True,
                        pass_id=pass_id + 1,
                        force_log=False,
                    )
                    return finalized
            except RuntimeError as low_exc:
                log.warning(
                    "[ocr] low DPI retry (dpi=%s) failed (%s); attempting permissive high DPI",
                    low_dpi,
                    low_exc,
                )
                empty_reason_hint = empty_reason_hint or _derive_empty_reason(low_exc)

    # Permissive retry at higher DPI, same engine (as final Paddle attempt)
    fallback_dpi = max(dpi, 432)
    try:
        result = _safe_extract_ocr_pdf(
            pdf_path,
            dpi=fallback_dpi,
            engine=engine,
            rec_batch_num=rec_batch_num,
            permissive=True,
            pass_id=pass_id + 2,
        )
        finalized = _finalize_ocr_result(
            result,
            pdf_path=pdf_path,
            engine=engine,
            dpi=fallback_dpi,
            permissive=True,
            pass_id=pass_id + 2,
            force_log=False,
        )
        return finalized
    except RuntimeError as permissive_exc:
        log.error(
            "[ocr] permissive retry pass=%s failed (%s); attempting Tesseract fallback",
            pass_id + 2,
            permissive_exc,
        )
        empty_reason_hint = empty_reason_hint or _derive_empty_reason(permissive_exc)
        if engine_sel == "paddle" or not _env_truthy(os.environ.get("CV_TESSERACT_FALLBACK")):
            raise permissive_exc
        # Run a Tesseract-based fallback to avoid native crashes in Paddle on ARM.
        fallback_images = render_pdf_to_np_arrays(pdf_path, dpi=dpi)
        blocks, avg_conf = _tesseract_fallback_on_images(fallback_images)
        layout = LayoutResult()
        page_width, page_height = 0, 0
        if fallback_images:
            h, w, _ = fallback_images[0].shape
            page_width, page_height = w, h
        full_text_parts: List[str] = []
        for blk in blocks:
            text = blk.get("text", "") or ""
            if not text:
                continue
            full_text_parts.append(text)
            bbox = blk.get("bbox", [0, 0, 0, 0])
            if len(bbox) == 4:
                norm = normalize_bbox(bbox, page_width, page_height)
            else:
                norm = [0, 0, 0, 0]
            layout.blocks.append(
                LayoutBlock(
                    page=blk.get("page", 1),
                    text=text,
                    bbox=norm,
                    block_type=blk.get("type", "word"),
                    metadata={k: v for k, v in blk.items() if k not in {"text", "bbox", "type"}},
                )
            )
        normalized = NormalizedCv(rawSections=[], raw=None)
        merged_text = " ".join(full_text_parts).strip()
        if merged_text:
            normalized.raw = merged_text
            normalized.summary = TextField(text=merged_text[:600], confidence=float(avg_conf))
        diagnostics: Dict[str, Any] = {
            "strategy": "ocr_pdf_tesseract",
            "pages": len(fallback_images),
            "images_rendered": len(fallback_images),
            "ocr_blocks": len(blocks),
            "avg_conf": float(avg_conf),
            "engine": "tesseract",
            "fallback_used": True,
        }
        diagnostics["chars"] = len(merged_text)
        diagnostics["sections_found"] = []
        diagnostics["pkg_versions"] = _pkg_versions()
        diagnostics.setdefault("ocr_debug_dir", None)
        diagnostics.setdefault("summary_len", int(len(getattr(normalized, "summary", None).text) if getattr(normalized, "summary", None) else 0))
        diagnostics.setdefault("profile_name_extracted", getattr(normalized, "name", None))
        diagnostics["empty_reason"] = empty_reason_hint or "paddle_safe_ocr_failed"
        strict_empty = StrictContact(name=None, email=None, phone=None, location=None)
        result_obj = PipelineResult(normalized=normalized, strict=strict_empty, layout=layout, diagnostics=diagnostics)
        finalized = _finalize_ocr_result(
            result_obj,
            pdf_path=pdf_path,
            engine="tesseract",
            dpi=dpi,
            permissive=True,
            pass_id=pass_id + 2,
            force_log=True,
        )
        return finalized
