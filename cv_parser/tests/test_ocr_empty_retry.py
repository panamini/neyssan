from pathlib import Path

import pytest

from cv_parser.extract.ocr_pdf import extract_ocr_pdf


class FakeResult:
    def __init__(self, texts, pages=1):
        self.texts = texts
        self.page_count = pages


def test_retry_succeeds_after_two_failures(monkeypatch, tmp_path):
    pdf = tmp_path / "x.pdf"
    pdf.write_bytes(b"%PDF-1.4\n%fake\n")

    calls = {"n": 0}

    def fake_safe(pdf_path, dpi, engine, rec_batch_num, permissive, pass_id):
        calls["n"] += 1
        if calls["n"] == 1:
            return FakeResult(texts=[])
        return FakeResult(texts=["hello"], pages=1)

    import cv_parser.extract.ocr_pdf as mod

    monkeypatch.setattr(mod, "_safe_extract_ocr_pdf", fake_safe)

    out = extract_ocr_pdf(Path(pdf), dpi=300, engine="pypdfium2", pass_id=1)
    assert getattr(out, "texts", []) == ["hello"]
    assert calls["n"] == 2


def test_retry_exhausts_and_raises(monkeypatch, tmp_path):
    pdf = tmp_path / "y.pdf"
    pdf.write_bytes(b"%PDF-1.4\n%fake\n")

    def fake_safe(pdf_path, dpi, engine, rec_batch_num, permissive, pass_id):
        return FakeResult(texts=[])

    import cv_parser.extract.ocr_pdf as mod

    monkeypatch.setattr(mod, "_safe_extract_ocr_pdf", fake_safe)

    with pytest.raises(RuntimeError) as err_info:
        extract_ocr_pdf(Path(pdf), dpi=300, engine="pypdfium2", pass_id=1)

    msg = str(err_info.value)
    assert "empty OCR output" in msg or "failed" in msg
