import asyncio
import json
import sys
import types
from io import BytesIO

from fastapi import UploadFile

if "mistralai" not in sys.modules:
    mistralai_module = types.ModuleType("mistralai")
    mistralai_module.models = types.SimpleNamespace(
        File=object,
        FileChunk=object,
        DocumentURLChunk=object,
        OCRResponse=object,
    )
    sys.modules["mistralai"] = mistralai_module
    sdk_module = types.ModuleType("mistralai.sdk")
    sdk_module.Mistral = object
    sys.modules["mistralai.sdk"] = sdk_module

from cv_parser_service.main import mistral_ocr_parse


def test_mistral_ocr_parse_surfaces_runtime_evidence(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")
    monkeypatch.setenv("MISTRAL_OCR_MODEL", "mistral-ocr-latest")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return ([{"index": 0, "markdown": "# Header\nBody"}], {"model": "mistral-ocr-latest", "pages": 1, "ocr_chars": 12})

    def fake_canonicalize_text(raw_text, diagnostics=None):
        return {
            "normalized": {"rawText": raw_text, "summary": {"text": "Body", "confidence": 0.5}},
            "rawSections": [{"label": "SUMMARY", "content": "Body"}],
            "summary": {"text": "Body", "confidence": 0.5},
            "summaryFirstSentence": "Body",
            "diagnostics": dict(diagnostics or {}),
        }

    monkeypatch.setattr("cv_parser_service.main._call_mistral_ocr", fake_call_mistral_ocr)
    monkeypatch.setattr("cv_parser_service.main._canonicalize_text", fake_canonicalize_text)

    upload = UploadFile(filename="scan.pdf", file=BytesIO(b"%PDF-1.4\nmock"))
    response = asyncio.run(mistral_ocr_parse(file=upload, url=None))

    payload = json.loads(response.body)
    diagnostics = payload["diagnostics"]
    assert diagnostics["ocr_request_path"] == "/mistral-ocr/parse"
    assert diagnostics["ocr_provider"] == "mistral_route"
    assert diagnostics["ocr_engine"] == "mistral"
    assert diagnostics["mistral_model"] == "mistral-ocr-latest"
    assert diagnostics["mistral_fallback"] is False
    assert diagnostics["mistral_runtime"] == "mistral"


def test_mistral_ocr_parse_marks_local_fallback_runtime(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return ([{"index": 0, "markdown": "fallback text"}], {"model": "mistral-fallback-dev", "fallback": True, "pages": 1, "ocr_chars": 13})

    def fake_canonicalize_text(raw_text, diagnostics=None):
        return {
            "normalized": {"rawText": raw_text},
            "rawSections": [{"label": "BODY", "content": raw_text}],
            "summary": None,
            "summaryFirstSentence": None,
            "diagnostics": dict(diagnostics or {}),
        }

    monkeypatch.setattr("cv_parser_service.main._call_mistral_ocr", fake_call_mistral_ocr)
    monkeypatch.setattr("cv_parser_service.main._canonicalize_text", fake_canonicalize_text)

    upload = UploadFile(filename="scan.pdf", file=BytesIO(b"%PDF-1.4\nmock"))
    response = asyncio.run(mistral_ocr_parse(file=upload, url=None))

    payload = json.loads(response.body)
    diagnostics = payload["diagnostics"]
    assert diagnostics["mistral_model"] == "mistral-fallback-dev"
    assert diagnostics["mistral_fallback"] is True
    assert diagnostics["mistral_runtime"] == "local_fallback"
