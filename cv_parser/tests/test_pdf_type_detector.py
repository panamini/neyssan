from __future__ import annotations

import types

import pytest

from cv_parser.detect.pdf_type import detect_pdf_type


class _DummyPage:
    def __init__(self, text: str, width: float = 600, height: float = 800) -> None:
        self._text = text
        self.width = width
        self.height = height

    def extract_text(self) -> str:
        return self._text


class _DummyPdf:
    def __init__(self, pages):
        self.pages = pages

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_detect_pdf_type_text(monkeypatch, tmp_path):
    pdf_file = tmp_path / "sample.pdf"
    pdf_file.write_bytes(b"dummy")

    def open_stub(path):
        return _DummyPdf([_DummyPage("hello" * 200)])

    fake_pdfplumber = types.SimpleNamespace(open=open_stub)
    monkeypatch.setitem(__import__("sys").modules, "pdfplumber", fake_pdfplumber)

    result = detect_pdf_type(pdf_file, text_threshold=0.1)
    assert result.mode == "text"
    assert result.diagnostics["pages"] == 1.0


def test_detect_pdf_type_fallback_when_missing(monkeypatch, tmp_path):
    pdf_file = tmp_path / "sample.pdf"
    pdf_file.write_bytes(b"dummy")

    try:
        import pdfplumber  # type: ignore  # noqa: F401
    except Exception:
        pass
    else:
        pytest.skip("pdfplumber installed; fallback scenario only executes when dependency is absent")

    sys_modules = __import__("sys").modules
    monkeypatch.delitem(sys_modules, "pdfplumber", raising=False)

    result = detect_pdf_type(pdf_file)
    assert result.mode == "text"
    assert result.confidence == 0.2
