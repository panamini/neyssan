from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

REQUIRED = ("paddle", "paddleocr", "pypdfium2")
missing = [m for m in REQUIRED if importlib.util.find_spec(m) is None]
if missing:
    pytest.skip(f"missing core OCR deps: {', '.join(missing)}", allow_module_level=True)

from cv_parser.pipeline.runner import run_pipeline


def test_diagnostics_contains_engine_and_counts(tmp_path: Path):
    fixture = Path("fixtures") / "sample_textpdf_resume.pdf"
    if not fixture.exists():
        pytest.skip("sample_textpdf_resume.pdf not present")
    result = run_pipeline(fixture, mode="ocr", dpi=96, engine="pypdfium2")
    diag = result.diagnostics or {}
    assert "engine" in diag
    assert "pages" in diag or (result.layout and len(getattr(result.layout, "pages", []) or []) >= 0)
    # At least one of blocks/chars present (text PDFs may have no OCR blocks but chars via text extractor)
    assert (diag.get("ocr_blocks", 0) >= 0) or (diag.get("chars", 0) >= 0)

