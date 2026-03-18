#!/usr/bin/env python3
"""
Capture a full OCR environment snapshot for diagnostics.

Writes a human-readable report to /tmp/ocr_env_<timestamp>.txt and echoes to stdout.
Run this inside the dev container and on the host when reproducing issues.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import platform
import shutil
import sys
from pathlib import Path


def _env_subset() -> dict:
    keys = [
        # OCR engine selection
        "CV_OCR_ENGINE",
        "CV_TESSERACT_FALLBACK",
        "CV_PARSER_DISABLE_SAFE_OCR",
        "CV_PARSER_SAFE_OCR_TIMEOUT",
        "PADDLE_REC_BATCH_NUM",
        # Threads / BLAS
        "OMP_NUM_THREADS",
        "VECLIB_MAXIMUM_THREADS",
        "PADDLE_CPU_THREADS",
        "OPENBLAS_NUM_THREADS",
        "OPENBLAS_CORETYPE",
        "MKL_NUM_THREADS",
        "NUMEXPR_NUM_THREADS",
        # Debug
        "CV_OCR_DEBUG",
    ]
    out = {}
    for k in keys:
        v = os.environ.get(k)
        if v is not None:
            out[k] = v
    return out


def _pkg_versions() -> dict:
    def _safe_import(name: str):  # noqa: ANN001
        try:
            mod = __import__(name)
            ver = getattr(mod, "__version__", "<unknown>")
            return {"ok": True, "version": ver}
        except Exception as exc:  # pragma: no cover - best effort
            return {"ok": False, "error": type(exc).__name__, "detail": str(exc)}

    pkgs = {}
    for name in ("paddle", "paddleocr", "pypdfium2", "pytesseract"):
        pkgs[name] = _safe_import(name)
    return pkgs


def _shm_info() -> dict:
    p = Path("/dev/shm")
    info = {"exists": p.exists()}
    try:
        if p.exists():
            st = os.statvfs(p)
            info["size_mb"] = round((st.f_frsize * st.f_blocks) / 1_048_576)
            info["free_mb"] = round((st.f_frsize * st.f_bfree) / 1_048_576)
    except Exception:  # pragma: no cover
        pass
    return info


def _tesseract_info() -> dict:
    info = {}
    path = shutil.which("tesseract")
    info["which"] = path
    if path:
        try:
            import subprocess

            ver = subprocess.check_output([path, "--version"], text=True).strip().splitlines()[0]
            info["version_line"] = ver
        except Exception as exc:  # pragma: no cover
            info["error"] = str(exc)
    return info


def _model_cache() -> dict:
    root = Path.home() / ".paddlex" / "official_models"
    out = {"path": str(root), "exists": root.exists()}
    try:
        if root.exists():
            children = sorted([p.name for p in root.iterdir() if p.is_dir()])
            out["dirs"] = children
    except Exception:  # pragma: no cover
        pass
    return out


def main() -> int:
    report = {
        "timestamp": _dt.datetime.utcnow().isoformat() + "Z",
        "python": sys.version,
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
        },
        "env": _env_subset(),
        "packages": _pkg_versions(),
        "shm": _shm_info(),
        "tesseract": _tesseract_info(),
        "model_cache": _model_cache(),
    }

    text = json.dumps(report, indent=2)
    print(text)
    out_path = Path("/tmp") / f"ocr_env_{_dt.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}.txt"
    try:
        out_path.write_text(text, encoding="utf-8")
        print(f"Saved report to {out_path}")
    except Exception as exc:  # pragma: no cover
        print(f"Failed to save report: {exc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
