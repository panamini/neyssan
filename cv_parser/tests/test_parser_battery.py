"""Golden OCR parser battery exercising Paddle + Tesseract safety nets."""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
from typing import Dict, List

import numpy as np
import pdfplumber
import pytest

REQUIRED_MODULES = ("paddle", "paddleocr", "pypdfium2")
missing_core = [name for name in REQUIRED_MODULES if importlib.util.find_spec(name) is None]
if missing_core:  # pragma: no cover - fail fast with guidance
    pretty = ", ".join(sorted(missing_core))
    pytest.fail(
        f"Required OCR dependency missing: {pretty}. "
        "Install service requirements before running the parser battery.",
        pytrace=False,
    )

HAVE_TESSERACT = importlib.util.find_spec("pytesseract") is not None

IS_CI = bool(os.environ.get("CI"))
RUN_GOLDEN_ALL = os.environ.get("RUN_GOLDEN", "1" if IS_CI else "0") == "1"
GOLDEN_MAX = int(os.environ.get("GOLDEN_MAX", "0" if RUN_GOLDEN_ALL else "1"))
GOLDEN_DPI = int(os.environ.get("GOLDEN_DPI", "150" if RUN_GOLDEN_ALL else "120"))
GOLDEN_FILTER = os.environ.get("GOLDEN_FILTER", "").strip().lower()
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
os.environ.setdefault("PADDLE_CPU_THREADS", "1")

from cv_parser.pipeline.runner import run_pipeline

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
GOLDEN_DIR = FIXTURES_DIR / "golden"
MANIFEST_PATH = FIXTURES_DIR / "fixtures_manifest.json"
MATCH_THRESHOLD = 0.8


@pytest.fixture(scope="module")
def golden_manifest() -> List[Dict[str, object]]:
    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if GOLDEN_FILTER:
        payload = [p for p in payload if GOLDEN_FILTER in str(p.get("file", "")).lower()]
    return payload


@pytest.fixture(scope="module")
def sample_pdf(golden_manifest) -> Path:
    first_entry = golden_manifest[0]
    pdf_path = GOLDEN_DIR / first_entry["file"]
    if not pdf_path.exists():  # pragma: no cover - defensive
        raise FileNotFoundError(pdf_path)
    return pdf_path


def _extract_section_labels(result) -> List[str]:
    normalized = result.normalized
    raw_sections = getattr(normalized, "rawSections", []) or []
    labels: List[str] = []

    for section in raw_sections:
        if not isinstance(section, dict):
            continue
        label = section.get("label") or section.get("title") or section.get("section")
        if not label:
            continue
        label_norm = str(label).strip().lower()
        if label_norm and label_norm not in labels:
            labels.append(label_norm)

    diag_sections = (result.diagnostics or {}).get("sections_found")
    if isinstance(diag_sections, dict):
        for label, count in diag_sections.items():
            if not count:
                continue
            label_norm = str(label).strip().lower()
            if label_norm and label_norm not in labels:
                labels.append(label_norm)
    elif isinstance(diag_sections, list):
        for label in diag_sections:
            label_norm = str(label).strip().lower()
            if label_norm and label_norm not in labels:
                labels.append(label_norm)

    return labels


def _count_pages(pdf_path: Path) -> int:
    with pdfplumber.open(pdf_path) as pdf:
        return len(pdf.pages)


def _estimate_tokens(result) -> int:
    normalized = result.normalized
    raw = getattr(normalized, "raw", None) or ""
    if raw:
        return len(raw.split())
    raw_sections = getattr(normalized, "rawSections", []) or []
    tokens = 0
    for entry in raw_sections:
        if isinstance(entry, dict):
            text = entry.get("text") or entry.get("content") or ""
        else:
            text = str(entry)
        tokens += len(str(text).split())
    return tokens


# Golden OCR battery is heavy and disabled by default.
# Enable with: RUN_GOLDEN=1 pytest -v cv_parser/tests/test_parser_battery.py
@pytest.mark.skipif(
    not os.environ.get("RUN_GOLDEN"),
    reason="Golden OCR battery disabled by default; set RUN_GOLDEN=1 to enable",
)
@pytest.mark.slow
def test_parser_battery_golden_fixtures(golden_manifest):
    assert GOLDEN_DIR.exists(), "Golden fixture directory missing"

    metrics: Dict[str, Dict[str, object]] = {}
    passed = 0
    total_all = len(golden_manifest)
    if total_all == 0:
        pytest.skip("No golden fixtures found")

    total = total_all if GOLDEN_MAX <= 0 else min(GOLDEN_MAX, total_all)
    selected = golden_manifest if total == total_all else golden_manifest[:total]

    for idx, fixture in enumerate(selected, 1):
        pdf_name = fixture["file"]
        expected_sections = [str(label).strip().lower() for label in fixture.get("expectedSections", [])]
        pdf_path = GOLDEN_DIR / pdf_name
        assert pdf_path.exists(), f"Missing golden PDF: {pdf_name}"

        print(f"[golden] [{idx}/{total_all}] processing {pdf_name} (dpi={GOLDEN_DPI})...", flush=True)
        result = run_pipeline(pdf_path, mode="ocr", dpi=GOLDEN_DPI, engine="pypdfium2")
        found_sections = _extract_section_labels(result)
        matches = [label for label in expected_sections if label in found_sections]
        match_rate = len(matches) / len(expected_sections) if expected_sections else 1.0

        diagnostics = result.diagnostics or {}
        metrics[pdf_name] = {
            "pages": _count_pages(pdf_path),
            "tokens": _estimate_tokens(result),
            "sections_found": found_sections,
            "expected_sections": expected_sections,
            "match_rate": round(match_rate, 3),
            "engine": diagnostics.get("engine"),
            "fallback_used": diagnostics.get("fallback_used", False),
        }

        print(f"{pdf_name}: found={found_sections} expected={expected_sections} match_rate={match_rate:.2f}")
        if match_rate >= MATCH_THRESHOLD:
            passed += 1

    metrics_path = Path(os.environ.get("PARSER_METRICS_PATH", "/tmp/parser_metrics.json"))
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(f"{passed}/{total_all} fixtures passed (>=80% match rate)")
    if RUN_GOLDEN_ALL:
        assert passed >= max(1, int(MATCH_THRESHOLD * total_all)), "Match coverage below target"
    else:
        print("[golden] local mode: coverage threshold not enforced; set RUN_GOLDEN=1 for CI-grade run")


@pytest.mark.skipif(not HAVE_TESSERACT, reason="pytesseract not installed")
def test_engine_selector_respects_explicit_modes(monkeypatch, sample_pdf):
    monkeypatch.delenv("CV_TESSERACT_FALLBACK", raising=False)

    monkeypatch.setenv("CV_OCR_ENGINE", "auto")
    result_auto = run_pipeline(sample_pdf, mode="ocr", dpi=150, engine="pypdfium2")
    assert result_auto.diagnostics.get("engine") != "tesseract"

    monkeypatch.setenv("CV_OCR_ENGINE", "paddle")
    result_paddle = run_pipeline(sample_pdf, mode="ocr", dpi=150, engine="pypdfium2")
    assert result_paddle.diagnostics.get("engine") == "ocr"

    monkeypatch.setenv("CV_OCR_ENGINE", "tesseract")
    result_tess = run_pipeline(sample_pdf, mode="ocr", dpi=150, engine="pypdfium2")
    assert result_tess.diagnostics.get("engine") == "tesseract"
    assert result_tess.diagnostics.get("strategy") == "ocr_pdf_tesseract"
    raw_text = getattr(result_tess.normalized, "raw", "") or ""
    assert raw_text, "Tesseract fallback should produce raw text"


def test_engine_selector_requires_opt_in(monkeypatch, sample_pdf):
    import cv_parser.extract.ocr_pdf as ocr_pdf_module

    def _crash(*args, **kwargs):  # noqa: ANN001, D401 - helper for monkeypatch
        raise RuntimeError("forced paddle failure")

    monkeypatch.setenv("CV_OCR_ENGINE", "auto")
    monkeypatch.delenv("CV_TESSERACT_FALLBACK", raising=False)
    monkeypatch.setattr(ocr_pdf_module, "_safe_extract_ocr_pdf", _crash)

    with pytest.raises(RuntimeError):
        run_pipeline(sample_pdf, mode="ocr", dpi=150, engine="pypdfium2")


@pytest.mark.skipif(not HAVE_TESSERACT, reason="pytesseract not installed")
def test_engine_selector_auto_triggers_tesseract(monkeypatch, sample_pdf):
    import cv_parser.extract.ocr_pdf as ocr_pdf_module

    def _crash(*args, **kwargs):  # noqa: ANN001
        raise RuntimeError("forced paddle failure")

    dummy_image = np.zeros((32, 32, 3), dtype=np.uint8)

    def _fake_render(pdf_path, dpi):  # noqa: ANN001
        return [dummy_image]

    def _fake_tesseract(images):  # noqa: ANN001
        block = {"text": "fallback text", "bbox": [0, 0, 32, 32], "page": 1, "type": "word"}
        return [block], 0.85

    monkeypatch.setenv("CV_OCR_ENGINE", "auto")
    monkeypatch.setenv("CV_TESSERACT_FALLBACK", "1")
    monkeypatch.setattr(ocr_pdf_module, "_safe_extract_ocr_pdf", _crash)
    monkeypatch.setattr(ocr_pdf_module, "render_pdf_to_np_arrays", _fake_render)
    monkeypatch.setattr(ocr_pdf_module, "_tesseract_fallback_on_images", _fake_tesseract)

    result = run_pipeline(sample_pdf, mode="ocr", dpi=150, engine="pypdfium2")
    diagnostics = result.diagnostics or {}
    assert diagnostics.get("engine") == "tesseract"
    assert diagnostics.get("fallback_used") is True
    assert getattr(result.normalized, "raw", ""), "Fallback should populate raw text"
