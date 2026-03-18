from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("paddleocr", reason="PaddleOCR not installed")
pytest.importorskip("pypdfium2", reason="pypdfium2 not installed")

from cv_parser.extract.ocr_pdf import extract_ocr_pdf


class _DummyPaddleOCR:
    def __init__(self, *args, **kwargs):  # pragma: no cover - runtime only
        pass

    def ocr(self, _img_path, cls=True):  # pragma: no cover - runtime only
        return [
            [
                [[0, 0], [100, 0], [100, 100], [0, 100]],
                ("Experienced engineer", 0.9),
            ]
        ]


class _DummyPPStructure:
    def __init__(self, *args, **kwargs):  # pragma: no cover - runtime only
        pass

    def predict(self, _inputs):  # pragma: no cover - runtime only
        return [
            {
                "layout_res": [
                    {"text": "Experience", "bbox": [0, 0, 120, 40], "type": "title"},
                    {"text": "Company A - Engineer", "bbox": [0, 50, 320, 120], "type": "paragraph"},
                    {"text": "Education", "bbox": [0, 140, 220, 170], "type": "title"},
                    {"text": "University B", "bbox": [0, 180, 320, 220], "type": "paragraph"},
                ]
            }
        ]


class _DummyParser:
    def parse_text(self, text: str):  # pragma: no cover - runtime only
        return {"sections": [{"label": "EXPERIENCE", "text": text[:50]}], "entities": {}}


class _DummyImage:
    width = 600
    height = 800

    def save(self, path):  # pragma: no cover - runtime only
        Path(path).write_bytes(b"fake")


class _DummyRenderer:
    def to_pil(self):  # pragma: no cover - runtime only
        return _DummyImage()


class _DummyPage:
    def render(self, scale):  # pragma: no cover - runtime only
        return _DummyRenderer()


class _DummyPdfDocument:
    def __init__(self, _path):  # pragma: no cover - runtime only
        self._pages = [_DummyPage()]

    def __len__(self):  # pragma: no cover - runtime only
        return len(self._pages)

    def __getitem__(self, index):  # pragma: no cover - runtime only
        return self._pages[index]


def test_extract_ocr_smoke(monkeypatch):
    fixture_path = Path("fixtures/sample_scanned_resume.pdf")
    if not fixture_path.exists():
        pytest.skip("sample OCR fixture missing")

    monkeypatch.setattr("cv_parser.extract.ocr_pdf._network_available", lambda timeout=2.0: False, raising=False)
    monkeypatch.setattr("cv_parser.extract.ocr_pdf._ensure_local_models", lambda: None, raising=False)
    monkeypatch.setattr("cv_parser.extract.ocr_pdf.PaddleOCRCls", _DummyPaddleOCR, raising=False)
    monkeypatch.setattr("pypdfium2.PdfDocument", lambda *args, **kwargs: _DummyPdfDocument(args[0] if args else None), raising=False)
    monkeypatch.setattr("cv_parser.pipeline.hybrid_mapping.get_hybrid_parser", lambda: _DummyParser(), raising=False)

    result = extract_ocr_pdf(fixture_path)

    diagnostics = result.diagnostics
    assert diagnostics["hybrid_used"] is True
    assert diagnostics["pages"] > 0
    assert diagnostics["ocr_blocks"] >= 0
    assert "pp_structure_counts" in diagnostics
    assert diagnostics["pp_structure_counts"]["blocks"].get("line") == 1
    assert diagnostics.get("pp_structure_used") is False


def test_extract_ocr_ppstructure_counts(monkeypatch):
    fixture_path = Path("fixtures/sample_scanned_resume.pdf")
    if not fixture_path.exists():
        pytest.skip("sample OCR fixture missing")

    monkeypatch.setattr("cv_parser.extract.ocr_pdf._network_available", lambda timeout=2.0: False, raising=False)
    monkeypatch.setattr("cv_parser.extract.ocr_pdf._ensure_local_models", lambda: None, raising=False)
    monkeypatch.setattr("cv_parser.extract.ocr_pdf._tables_enabled", lambda: True, raising=False)
    monkeypatch.setattr("cv_parser.extract.ocr_pdf.PPStructureV3Cls", _DummyPPStructure, raising=False)
    monkeypatch.setattr("cv_parser.extract.ocr_pdf.PaddleOCRCls", _DummyPaddleOCR, raising=False)
    monkeypatch.setattr("pypdfium2.PdfDocument", lambda *args, **kwargs: _DummyPdfDocument(args[0] if args else None), raising=False)
    monkeypatch.setattr("cv_parser.pipeline.hybrid_mapping.get_hybrid_parser", lambda: _DummyParser(), raising=False)

    result = extract_ocr_pdf(fixture_path)

    diagnostics = result.diagnostics
    assert diagnostics["pp_structure_counts"]["blocks"].get("title") == 2
    assert diagnostics["pp_structure_counts"]["blocks"].get("paragraph") == 2
    assert diagnostics["pp_structure_counts"]["sections"].get("EXPERIENCE") == 1
    assert diagnostics["pp_structure_counts"]["sections"].get("EDUCATION") == 1
    assert diagnostics.get("pp_structure_used") is True
