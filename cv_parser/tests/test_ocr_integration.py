from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from cv_parser.extract.ocr_pdf import MODEL_ROOT, REQUIRED_MODELS, extract_ocr_pdf
from cv_parser.pipeline import runner


@pytest.mark.integration
@pytest.mark.skipif(
    os.environ.get("RUN_PADDLE_OCR_TESTS") != "1",
    reason="OCR integration test disabled (set RUN_PADDLE_OCR_TESTS=1 to enable)",
)
@pytest.mark.skipif(
    not all((MODEL_ROOT / name).exists() for name in REQUIRED_MODELS),
    reason="PaddleOCR cached models missing",
)
@pytest.mark.skipif(not Path("fixtures/sample_scanned_resume.pdf").exists(), reason="sample fixture missing")
def test_ocr_pipeline_with_cached_models(monkeypatch):
    pytest.importorskip("paddleocr", reason="PaddleOCR not installed")
    pytest.importorskip("pypdfium2", reason="pypdfium2 not installed")
    monkeypatch.setenv("PADDLE_PDX_MODEL_SOURCE", "local")
    result = extract_ocr_pdf(Path("fixtures/sample_scanned_resume.pdf"))
    diagnostics = result.diagnostics
    assert diagnostics["pages"] >= 1
    assert diagnostics["images_rendered"] >= diagnostics["pages"] > 0
    assert diagnostics["ocr_blocks"] > 0
    assert diagnostics["ocr_engine"] in {"paddleocr", "ppstructure"}


def test_runner_ocr_failure_falls_back(tmp_path, monkeypatch):
    pdf_path = Path("fixtures/sample_scanned_resume.pdf")
    if not pdf_path.exists():
        pytest.skip("sample fixture missing")

    def _raise_runtime(*_args, **_kwargs):
        raise RuntimeError("forced failure")

    monkeypatch.setattr("cv_parser.pipeline.runner.extract_ocr_pdf", _raise_runtime)

    output_path = tmp_path / "out.json"

    exit_code = runner.main([str(pdf_path), "--mode", "ocr", "--output", str(output_path)])
    assert exit_code == 1
    payload = json.loads(output_path.read_text("utf-8"))
    diagnostics = payload["diagnostics"]
    assert diagnostics.get("ocr_failed") is True
    assert diagnostics.get("strategy") == "text_pdf"
