from __future__ import annotations

import json
import os
import subprocess
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict

from fastapi import HTTPException
from fastapi.responses import Response

REPO_ROOT = Path(__file__).resolve().parents[1]
MY_APP_ROOT = REPO_ROOT / "my-app"
WORKER_SCRIPT = MY_APP_ROOT / "scripts" / "document-export-worker.ts"
TSX_LOADER_CANDIDATES = [
    MY_APP_ROOT / "node_modules" / "tsx" / "dist" / "esm" / "index.mjs",
    REPO_ROOT / "node_modules" / "tsx" / "dist" / "esm" / "index.mjs",
]

MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _resolve_node_binary() -> str:
    configured = (os.environ.get("DOCUMENT_EXPORT_NODE_BINARY") or "").strip()
    if configured:
        return configured

    node_binary = shutil.which("node")
    if node_binary:
        return node_binary

    raise HTTPException(
        status_code=500,
        detail="document_export_node_runtime_missing",
    )


def _resolve_tsx_loader() -> str:
    for candidate in TSX_LOADER_CANDIDATES:
        if candidate.exists():
            return str(candidate)
    raise HTTPException(
        status_code=500,
        detail="document_export_typescript_runtime_missing",
    )


def _sanitize_filename_base(value: Any, fallback: str) -> str:
    candidate = str(value or "").strip()
    if not candidate:
        return fallback
    cleaned = "".join(" " if char in '<>:"/\\|?*' else char for char in candidate)
    normalized = " ".join(cleaned.split()).strip()
    return normalized or fallback


def _build_filename(payload: Dict[str, Any], format_name: str, fallback: str) -> str:
    base = _sanitize_filename_base(payload.get("fileNameBase"), fallback)
    extension = "pdf" if format_name == "pdf" else "docx"
    return f"{base}.{extension}"


def _validate_export_payload(
    payload: Dict[str, Any],
    *,
    expected_kind: str,
    expected_format: str,
) -> None:
    if payload.get("kind") != expected_kind:
        raise HTTPException(status_code=400, detail="document_export_kind_mismatch")
    if payload.get("format") != expected_format:
        raise HTTPException(status_code=400, detail="document_export_format_mismatch")

    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="document_export_data_required")
    if data.get("kind") != expected_kind:
        raise HTTPException(status_code=400, detail="document_export_data_kind_mismatch")
    if expected_format == "pdf" and payload.get("mode") not in {"ats", "styled"}:
        raise HTTPException(status_code=400, detail="document_export_pdf_mode_required")


def create_document_export_response(
    payload: Dict[str, Any],
    *,
    expected_kind: str,
    expected_format: str,
    fallback_filename_base: str,
    frontend_origin: str | None = None,
) -> Response:
    _validate_export_payload(
        payload,
        expected_kind=expected_kind,
        expected_format=expected_format,
    )

    if not WORKER_SCRIPT.exists():
        raise HTTPException(status_code=500, detail="document_export_worker_missing")

    node_binary = _resolve_node_binary()
    tsx_loader = _resolve_tsx_loader()
    filename = _build_filename(payload, expected_format, fallback_filename_base)
    suffix = ".pdf" if expected_format == "pdf" else ".docx"

    with tempfile.TemporaryDirectory(prefix="document-export-") as temp_dir:
        temp_root = Path(temp_dir)
        input_path = temp_root / "payload.json"
        output_path = temp_root / f"document{suffix}"
        input_path.write_text(json.dumps(payload), encoding="utf-8")

        env = os.environ.copy()
        if frontend_origin:
            env["DOCUMENT_EXPORT_FRONTEND_URL"] = frontend_origin
        proc = subprocess.run(
            [
                node_binary,
                "--import",
                tsx_loader,
                str(WORKER_SCRIPT),
                str(input_path),
                str(output_path),
            ],
            cwd=str(MY_APP_ROOT),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
            check=False,
            text=True,
        )

        if proc.returncode != 0 or not output_path.exists():
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "document_export_failed",
                    "stdout": proc.stdout[-1200:],
                    "stderr": proc.stderr[-2000:],
                },
            )

        return Response(
            content=output_path.read_bytes(),
            media_type=MEDIA_TYPES[expected_format],
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
