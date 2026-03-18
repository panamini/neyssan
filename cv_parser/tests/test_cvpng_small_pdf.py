from pathlib import Path

import pytest

pytest.importorskip("paddleocr")
pytest.importorskip("pypdfium2")

from cv_parser.pipeline.runner import run_pipeline

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "cvpng-small.pdf"


@pytest.mark.parametrize("mode", ["auto", "ocr"])
def test_cvpng_small_produces_text(mode: str) -> None:
    result = run_pipeline(FIXTURE, mode=mode)
    normalized = result.normalized
    raw = (getattr(normalized, "raw", "") or "").strip()
    raw_sections = getattr(normalized, "rawSections", []) or []
    diagnostics = result.diagnostics or {}
    has_text = bool(raw or raw_sections)
    has_fallback = diagnostics.get("ocr_failed") and diagnostics.get("fallback_used")
    assert has_text or has_fallback, (
        f"expected text or fallback for {FIXTURE} in mode={mode}, diagnostics={diagnostics}"
    )
    assert diagnostics.get("ocr_passes", 0) >= 1, diagnostics
