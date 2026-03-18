"""Utility to verify that PaddleOCR models required for offline OCR are cached."""
from __future__ import annotations

import os
from pathlib import Path

from cv_parser.extract.ocr_pdf import (
    MODEL_ROOT,
    BASE_MODELS,
    BLOCK_MODELS,
    LAYOUT_MODELS,
    TRUE_VALUES,
)


def _tables_enabled() -> bool:
    return os.environ.get("PADDLE_RESUME_ENABLE_TABLES", "").lower() in TRUE_VALUES


def _required_models() -> list[str]:
    required = list(BASE_MODELS)
    if _tables_enabled():
        required.extend(BLOCK_MODELS)
        required.extend(LAYOUT_MODELS)
    return required


def _select_layout_model() -> str:
    for candidate in LAYOUT_MODELS:
        if (MODEL_ROOT / candidate).exists():
            return candidate
    return LAYOUT_MODELS[-1]


def main() -> int:
    root = MODEL_ROOT
    print(f"Checking PaddleOCR cache in {root}")
    missing = []
    for name in _required_models():
        path = root / name
        status = "OK" if path.exists() else "missing"
        print(f" - {name}: {status} ({path})")
        if not path.exists():
            missing.append(name)
    selected_layout = _select_layout_model()
    print(f"Selected DocLayout model: {selected_layout} ({root / selected_layout})")
    doc_link = "https://github.com/PaddlePaddle/PaddleOCR/blob/main/doc/doc_en/ppstructure_introduction_en.md"
    if missing:
        print(
            "Missing models detected. Set PADDLE_PDX_MODEL_SOURCE=local and pre-download "
            "the required models into ~/.paddlex/official_models/."
        )
        print(f"PP-Structure model guide: {doc_link}")
        return 1
    print("All required PaddleOCR models are present.")
    print(f"PP-Structure model guide: {doc_link}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
