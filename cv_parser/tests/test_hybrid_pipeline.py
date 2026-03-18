from pathlib import Path
import importlib
import sys
import types

import pytest

try:
    import spacy  # type: ignore
    from spacy.pipeline import EntityRuler  # type: ignore
except ImportError:  # pragma: no cover - spaCy optional
    spacy = None  # type: ignore
    EntityRuler = None  # type: ignore

from cv_parser.hybrid_pipeline import HybridCVParser


@pytest.mark.skipif(spacy is None, reason="spaCy not available")
def build_dummy_model(tmp_path: Path) -> Path:
    nlp = spacy.blank("en")
    ruler = nlp.add_pipe("entity_ruler")
    ruler.add_patterns([
        {"label": "NAME", "pattern": "Jane Doe"},
        {"label": "ROLE", "pattern": "Senior Engineer"},
        {"label": "SKILL", "pattern": "Python"},
    ])
    model_path = tmp_path / "model"
    nlp.to_disk(model_path)
    return model_path


@pytest.mark.skipif(spacy is None, reason="spaCy not available")
def test_hybrid_pipeline_plain_text(tmp_path):
    model_path = build_dummy_model(tmp_path)
    parser = HybridCVParser(str(model_path), prefer_docling=False)

    text = (
        "Biodata\nJane Doe\nSenior Engineer\nEmail: Jane.Doe@Example.com\nPhone: (415) 555-0101\n\n"
        "Academic Credentials\nMIT\nPhD Computer Science\n\n"
        "Career Highlights\nImproved Python ETL throughput\n"
    )

    result = parser.parse_text(text)

    assert result["sections"][0]["label"] == "SUMMARY"
    # Email normalised lower-case
    emails = result["entities"].get("EMAIL", [])
    assert emails and emails[0]["value"] == "jane.doe@example.com"
    # Skill from EntityRuler preserved
    skills = result["entities"].get("SKILL", [])
    assert any(s["value"].lower() == "python" for s in skills)


def test_ocr_pipeline_without_spacy(monkeypatch, tmp_path):
    monkeypatch.setitem(sys.modules, "spacy", None)

    for module_name in [
        name
        for name in list(sys.modules)
        if name.startswith("cv_parser.hybrid_pipeline")
        or name.startswith("cv_parser.pipeline.hybrid_mapping")
    ]:
        monkeypatch.delitem(sys.modules, module_name, raising=False)

    import cv_parser.hybrid_pipeline as hybrid_module
    importlib.reload(hybrid_module)
    import cv_parser.pipeline.hybrid_mapping as mapping_module
    importlib.reload(mapping_module)

    class _DummyImage:
        width = 800
        height = 600

        def save(self, path):
            Path(path).write_text("image", encoding="utf-8")

    class _DummyRendered:
        def to_pil(self):
            return _DummyImage()

    class _DummyPage:
        def render(self, scale):
            return _DummyRendered()

    class _DummyPdf:
        def __init__(self, _path):
            self._pages = [_DummyPage()]

        def __len__(self):
            return len(self._pages)

        def __getitem__(self, index):
            return self._pages[index]

        def close(self):
            return None

    dummy_pdfium = types.SimpleNamespace(PdfDocument=_DummyPdf)
    monkeypatch.setitem(sys.modules, "pypdfium2", dummy_pdfium)

    class _DummyPaddleDevice:
        @staticmethod
        def is_compiled_with_cuda() -> bool:
            return False

    dummy_paddle = types.SimpleNamespace(device=_DummyPaddleDevice())
    monkeypatch.setitem(sys.modules, "paddle", dummy_paddle)

    class _DummyPaddleOCR:
        def __init__(self, **_kwargs):
            pass

        def ocr(self, _path):
            quad = [(0.0, 0.0), (0.0, 10.0), (10.0, 10.0), (10.0, 0.0)]
            return [(quad, ("Sample OCR text", 0.99))]

    dummy_paddleocr = types.SimpleNamespace(
        __version__="3.2.0",
        PaddleOCR=_DummyPaddleOCR,
    )
    dummy_paddleocr._common_args = types.SimpleNamespace()
    dummy_paddleocr._pipelines = types.SimpleNamespace(base=None)
    monkeypatch.setitem(sys.modules, "paddleocr", dummy_paddleocr)

    monkeypatch.delitem(sys.modules, "cv_parser.extract.ocr_pdf", raising=False)
    import cv_parser.extract.ocr_pdf as ocr_pdf
    importlib.reload(ocr_pdf)

    ocr_pdf.PaddleOCRCls = _DummyPaddleOCR
    ocr_pdf._ensure_local_models = lambda *args, **kwargs: None
    ocr_pdf._network_available = lambda: True

    pdf_path = tmp_path / "sample.pdf"
    pdf_path.write_text("dummy", encoding="utf-8")

    result = ocr_pdf.extract_ocr_pdf(pdf_path)

    assert result.diagnostics.get("hybrid_used") is False
    assert result.diagnostics.get("engine") == "ocr"
    assert result.diagnostics.get("crashed") is False
    assert "Sample OCR text" in (result.normalized.raw or "")
