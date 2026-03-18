from pathlib import Path

import pytest


def _fixture_path(name: str) -> Path:
    here = Path(__file__).resolve().parents[2]
    return here / "fixtures" / name


def test_extract_text_from_pdf_paddle_retry_then_pdfplumber(monkeypatch: pytest.MonkeyPatch):
    from cv_parser.extract import ocr_pdf as module

    monkeypatch.setenv("CV_OCR_ENGINE", "paddle")
    calls: dict[str, list[int]] = {"render": []}

    def fake_render(source, dpi: int = 0):
        calls["render"].append(dpi)
        return ([f"page@{dpi}"], {"pages": 1, "dpi": dpi})

    def fake_paddle(images, lang: str = "en"):
        return "", {"engine": "paddle", "ocr_blocks": 0, "ocr_chars": 0, "lang_hint": lang}

    def fake_pdfplumber(source):
        text = "digital text"
        return text, {"engine": "pdfplumber", "ocr_blocks": 3, "ocr_chars": len(text), "pages": 1, "lang_hint": "en"}

    monkeypatch.setattr(module, "render_pdf_pages", fake_render)
    monkeypatch.setattr(module, "ocr_paddle", fake_paddle)
    monkeypatch.setattr(module, "ocr_pdfplumber", fake_pdfplumber)

    text, diag = module.extract_text_from_pdf(b"%PDF-1.4 dummy")

    assert text == "digital text"
    assert diag["engine"] == "pdfplumber"
    assert diag["fallback_reason"] == "paddle_empty"
    assert diag["paddle_retry_used"] is True
    assert diag["ocr_chars"] == len(text)
    assert calls["render"] == [320, 360]


def test_extract_text_from_pdf_scanned_sample(monkeypatch: pytest.MonkeyPatch):
    from cv_parser.extract import ocr_pdf as module

    monkeypatch.setenv("CV_OCR_ENGINE", "paddle")
    pdf_path = _fixture_path("cvpng.pdf")
    fake_text = "mock paddle output"

    def fake_render(source, dpi: int = 0):
        return ([f"page@{dpi}"], {"pages": 1, "dpi": dpi})

    def fake_paddle(images, lang: str = "en"):
        return fake_text, {"engine": "paddle", "ocr_blocks": 5, "ocr_chars": len(fake_text), "lang_hint": lang}

    monkeypatch.setattr(module, "render_pdf_pages", fake_render)
    monkeypatch.setattr(module, "ocr_paddle", fake_paddle)

    text, diag = module.extract_text_from_pdf(pdf_path)

    assert text == fake_text
    assert diag["engine"] in {"paddle", "tesseract"}
    assert diag["ocr_chars"] > 0
    assert diag.get("pages") == 1
