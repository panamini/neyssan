#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import os
from pathlib import Path

import pytest

REQUIRED = ("paddle", "paddleocr", "pypdfium2")
missing = [m for m in REQUIRED if importlib.util.find_spec(m) is None]
if missing:
    pytest.skip(f"missing core OCR deps: {', '.join(missing)}", allow_module_level=True)

from cv_parser.pipeline.runner import run_pipeline


@pytest.mark.fast
def test_auto_engine_tesseract_or_text_on_paddle_failure(monkeypatch):
    import cv_parser.extract.ocr_pdf as ocr_pdf_module

    def _crash(*args, **kwargs):
        raise RuntimeError("forced paddle failure for test")

    # Avoid real pytesseract dependency by stubbing the fallback to return one token
    def _fake_tesseract(images):  # noqa: ANN001
        return ([{"text": "fallback", "bbox": [0, 0, 32, 32], "page": 1, "type": "word"}], 0.8)

    monkeypatch.setenv("CV_OCR_ENGINE", "auto")
    monkeypatch.setenv("CV_TESSERACT_FALLBACK", "1")
    monkeypatch.setattr(ocr_pdf_module, "_safe_extract_ocr_pdf", _crash)
    monkeypatch.setattr(ocr_pdf_module, "_tesseract_fallback_on_images", _fake_tesseract)

    fixture = Path("fixtures") / "sample_textpdf_resume.pdf"
    if not fixture.exists():
        pytest.skip("sample_textpdf_resume.pdf missing")

    result = run_pipeline(fixture, mode="ocr", dpi=120, engine="pypdfium2")
    diag = result.diagnostics or {}
    # With our stub, engine should be tesseract and raw should be non-empty
    engine = diag.get("engine")
    raw = (getattr(result.normalized, "raw", "") or "").strip()
    assert engine == "tesseract" and bool(raw), diag


@pytest.mark.fast
def test_fallback_disabled_sets_empty_reason(monkeypatch):
    import cv_parser.extract.ocr_pdf as ocr_pdf_module

    def _crash(*args, **kwargs):
        raise RuntimeError("forced paddle failure for test")

    monkeypatch.setenv("CV_OCR_ENGINE", "auto")
    monkeypatch.delenv("CV_TESSERACT_FALLBACK", raising=False)
    monkeypatch.setattr(ocr_pdf_module, "_safe_extract_ocr_pdf", _crash)

    fixture = Path("fixtures") / "sample_textpdf_resume.pdf"
    if not fixture.exists():
        pytest.skip("sample_textpdf_resume.pdf missing")

    result = run_pipeline(fixture, mode="ocr", dpi=120, engine="pypdfium2")
    diag = result.diagnostics or {}
    assert diag.get("empty_reason") == "ocr_failed"
    assert diag.get("fallback_skipped") == "CV_TESSERACT_FALLBACK=0"
