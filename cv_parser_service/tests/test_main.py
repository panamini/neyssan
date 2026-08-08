import asyncio
import json
import sys
import types
from io import BytesIO

from fastapi.responses import Response
from fastapi.testclient import TestClient
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

from cv_parser_service.main import (
    _resolve_cors_allowed_origin_regex,
    app,
    mistral_ocr_parse,
)
from cv_parser_service.mistral_ocr import _pages_and_diagnostics_from_pipeline_result
from cv_parser_service.mistral_resume_v3 import INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY


def test_document_export_preflight_allows_dynamic_local_vite_origin():
    client = TestClient(app)
    origin = "http://127.0.0.1:5197"

    response = client.options(
        "/api/v1/document-export/proposal/pdf",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "Content-Type" in response.headers["access-control-allow-headers"]


def test_dynamic_local_cors_origin_regex_is_disabled_in_production(monkeypatch):
    monkeypatch.setenv("CV_PARSER_ENV", "production")
    monkeypatch.delenv("CV_PARSER_CORS_ALLOW_ORIGINS", raising=False)
    monkeypatch.delenv("CLIENT_ORIGIN_WHITELIST", raising=False)
    monkeypatch.delenv("CLIENT_ORIGIN", raising=False)

    assert _resolve_cors_allowed_origin_regex() is None


def test_mistral_ocr_parse_surfaces_runtime_evidence(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")
    monkeypatch.setenv("MISTRAL_OCR_MODEL", "mistral-ocr-latest")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return ([{"index": 0, "markdown": "# Header\nBody"}], {"model": "mistral-ocr-latest", "pages": 1, "ocr_chars": 12})

    def fake_canonicalize_text(raw_text, diagnostics=None, raw_sections=None):
        return {
            "normalized": {"rawText": raw_text, "summary": {"text": "Body", "confidence": 0.5}},
            "rawSections": list(raw_sections or [{"label": "SUMMARY", "content": "Body"}]),
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
    assert diagnostics["ocr_markdown_sections"] == 1
    assert diagnostics["ocr_markdown_canonical_headings"] == 0
    assert diagnostics["ocr_markdown_body_only"] is True
    assert diagnostics["ocr_markdown_use_raw_sections"] is False
    assert payload["sections"][0]["label"] == "SUMMARY"


def test_resume_docx_export_route_uses_active_document_export_pipeline(monkeypatch):
    captured = {}

    def fake_create_document_export_response(
        payload,
        *,
        expected_kind,
        expected_format,
        fallback_filename_base,
        frontend_origin=None,
    ):
        captured["payload"] = payload
        captured["expected_kind"] = expected_kind
        captured["expected_format"] = expected_format
        captured["fallback_filename_base"] = fallback_filename_base
        captured["frontend_origin"] = frontend_origin
        return Response(
            content=b"docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    monkeypatch.setattr(
        "cv_parser_service.main.create_document_export_response",
        fake_create_document_export_response,
    )

    client = TestClient(app)
    response = client.post(
        "/api/v1/document-export/resume/docx",
        headers={"Origin": "http://127.0.0.1:5197"},
        json={
            "kind": "resume",
            "format": "docx",
            "fileNameBase": "Resume - Editable",
            "stylePreset": {
                "layout": "swiss",
                "typography": "quiet-editorial",
                "palette": "pierre",
            },
            "data": {
                "schemaVersion": 1,
                "kind": "resume",
                "locale": "en",
                "title": "Resume",
                "exportSource": "standard",
                "profile": {
                    "name": "Jane Doe",
                    "title": "Product Manager",
                    "summary": "",
                },
                "contact": [],
                "metadata": [],
                "skills": [],
                "languages": [],
                "experience": [],
                "projects": [],
                "education": [],
                "achievements": [],
                "hobbies": [],
            },
        },
    )

    assert response.status_code == 200
    assert response.content == b"docx"
    assert captured["expected_kind"] == "resume"
    assert captured["expected_format"] == "docx"
    assert captured["fallback_filename_base"] == "Resume - Editable"
    assert captured["frontend_origin"] == "http://127.0.0.1:5197"
    assert captured["payload"]["stylePreset"]["typography"] == "quiet-editorial"


def test_mistral_ocr_parse_preserves_precomputed_v3_payload(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")
    monkeypatch.setenv("MISTRAL_OCR_MODEL", "mistral-ocr-latest")

    precomputed_payload = {
        "rawText": "Anne Lounsberry",
        "normalized": {
            "name": "Anne Lounsberry",
            "profile": {
                "name": "Anne Lounsberry",
                "desiredPosition": "Data Scientist",
                "email": "anne.c.lounsberry@gmail.com",
                "phone": "523-299-0012",
                "linkedin": "linkedin.com/in/annelounsberry12",
                "website": None,
                "location": None,
            },
            "contact": {
                "name": "Anne Lounsberry",
                "email": "anne.c.lounsberry@gmail.com",
                "phone": "523-299-0012",
                "linkedinUrl": "linkedin.com/in/annelounsberry12",
                "addressBlock": None,
                "addressNormalized": None,
            },
            "summary": {
                "text": "Microsoft Certified Data Scientist with 10+ years of experience in Python, R, Java, and Scala.",
                "confidence": 0.95,
            },
            "experience": [
                {
                    "id": "exp-1",
                    "company": "ACB Inc.",
                    "position": "Senior Data Scientist",
                    "startDate": "2013-01-01",
                    "endDate": "2019-01-01",
                    "isCurrent": None,
                    "location": "Los Angeles, CA",
                    "summary": None,
                    "responsibilities": "Developed end-to-end machine learning prototypes.",
                    "responsibilityBullets": [
                        "Developed end-to-end machine learning prototypes."
                    ],
                    "achievements": [
                        "Applied data mining to analyze procurement processes resulting in savings of $420,000 a year."
                    ],
                }
            ],
            "education": [
                {
                    "id": "edu-1",
                    "institution": "UCLA",
                    "degree": "MSc in Statistics",
                    "fieldOfStudy": None,
                    "startDate": "2005-01-01",
                    "endDate": None,
                    "isCurrent": None,
                    "location": "Los Angeles, CA",
                    "summary": None,
                }
            ],
            "skills": [
                {"id": "skill-1", "name": "Machine Learning"},
                {"id": "skill-2", "name": "Python"},
            ],
            "languages": [],
            "languagesRaw": [],
            "achievements": [],
            "projects": [],
            "research": [],
            "volunteer": [],
            "references": [],
            "other": [],
            "summaryFirstSentence": "Microsoft Certified Data Scientist with 10+ years of experience in Python, R, Java, and Scala.",
            "raw": "Anne Lounsberry",
            "rawText": "Anne Lounsberry",
            "rawSections": [
                {"label": "SUMMARY", "content": "Microsoft Certified Data Scientist with 10+ years of experience in Python, R, Java, and Scala."}
            ],
        },
        "summary": {
            "text": "Microsoft Certified Data Scientist with 10+ years of experience in Python, R, Java, and Scala.",
            "confidence": 0.95,
        },
        "summaryFirstSentence": "Microsoft Certified Data Scientist with 10+ years of experience in Python, R, Java, and Scala.",
        "rawSections": [
            {"label": "SUMMARY", "content": "Microsoft Certified Data Scientist with 10+ years of experience in Python, R, Java, and Scala."}
        ],
        "diagnostics": {"mistral_parser_status": "success"},
    }

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return (
            [{"index": 0, "markdown": "# Anne Lounsberry\n\n## Data Scientist, Microsoft Certified"}],
            {
                "model": "mistral-ocr-latest",
                "pages": 1,
                "ocr_chars": 64,
                INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY: precomputed_payload,
            },
        )

    monkeypatch.setattr("cv_parser_service.main._call_mistral_ocr", fake_call_mistral_ocr)

    upload = UploadFile(filename="anne.png", file=BytesIO(b"mock-image"))
    response = asyncio.run(mistral_ocr_parse(file=upload, url=None))

    payload = json.loads(response.body)
    normalized = payload["normalized"]
    assert normalized["profile"]["desiredPosition"] == "Data Scientist"
    assert normalized["summary"]["text"].startswith("Microsoft Certified Data Scientist")
    assert [item["name"] for item in normalized["skills"]] == ["Machine Learning", "Python"]
    assert len(normalized["education"]) == 1
    assert normalized["experience"][0]["achievements"] == [
        "Applied data mining to analyze procurement processes resulting in savings of $420,000 a year."
    ]


def test_mistral_ocr_parse_marks_local_fallback_runtime(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return ([{"index": 0, "markdown": "fallback text"}], {"model": "mistral-fallback-dev", "fallback": True, "pages": 1, "ocr_chars": 13})

    def fake_canonicalize_text(raw_text, diagnostics=None, raw_sections=None):
        return {
            "normalized": {"rawText": raw_text},
            "rawSections": list(raw_sections or [{"label": "BODY", "content": raw_text}]),
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


def test_mistral_ocr_parse_marks_pipeline_legacy_fallback_runtime(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return (
            [{"index": 0, "markdown": "pipeline fallback text"}],
            {
                "model": "mistral-ocr-latest",
                "fallback_to_legacy": True,
                "pages": 1,
                "ocr_chars": 22,
            },
        )

    monkeypatch.setattr("cv_parser_service.main._call_mistral_ocr", fake_call_mistral_ocr)

    upload = UploadFile(filename="scan.pdf", file=BytesIO(b"%PDF-1.4\nmock"))
    response = asyncio.run(mistral_ocr_parse(file=upload, url=None))

    diagnostics = json.loads(response.body)["diagnostics"]
    assert diagnostics["mistral_fallback"] is True
    assert diagnostics["mistral_runtime"] == "local_fallback"


def test_pipeline_legacy_fallback_is_preserved_in_mistral_diagnostics():
    _, diagnostics = _pages_and_diagnostics_from_pipeline_result(
        {
            "pages": [{"index": 0, "markdown": "pipeline fallback text"}],
            "fallback_to_legacy": True,
            "diagnostics": {"model": "mistral-ocr-latest"},
        }
    )

    assert diagnostics["fallback_to_legacy"] is True


def test_mistral_ocr_parse_uses_canonical_ocr_raw_sections_when_present(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return ([{"index": 0, "markdown": "# Experience\n| Role | Company |\n| --- | --- |\n| Guard | ADT |"}], {"model": "mistral-ocr-latest", "pages": 1, "ocr_chars": 40})

    captured = {}

    def fake_canonicalize_text(raw_text, diagnostics=None, raw_sections=None):
        captured["raw_sections"] = raw_sections
        return {
            "normalized": {"rawText": raw_text},
            "rawSections": list(raw_sections or []),
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
    assert diagnostics["ocr_markdown_body_only"] is False
    assert diagnostics["ocr_markdown_use_raw_sections"] is True
    assert captured["raw_sections"][0]["label"] == "EXPERIENCE"


def test_mistral_ocr_parse_carries_through_education_section_when_global_activation_is_disabled(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return (
            [
                {
                    "index": 0,
                    "markdown": "# Personal Details\nName: Test User\n\n# Educational Qualifications\n| Qualification | Institution | Year of passing |\n| --- | --- | --- |\n| B.Tech | Jaipur National University | 2014 |",
                }
            ],
            {"model": "mistral-ocr-latest", "pages": 1, "ocr_chars": 120},
        )

    captured = {}

    def fake_canonicalize_text(raw_text, diagnostics=None, raw_sections=None):
        captured["raw_sections"] = raw_sections
        return {
            "normalized": {"rawText": raw_text},
            "rawSections": list(raw_sections or []),
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
    assert diagnostics["ocr_markdown_use_raw_sections"] is False
    assert diagnostics["ocr_markdown_family_carry_through"] == ["EDUCATION"]
    assert captured["raw_sections"] == [
        {
            "label": "EDUCATION",
            "content": "| Qualification | Institution | Year of passing |\n| --- | --- | --- |\n| B.Tech | Jaipur National University | 2014 |",
        }
    ]


def test_mistral_ocr_parse_trims_carried_education_block_to_table_region(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return (
            [
                {
                    "index": 0,
                    "markdown": "# Personal Details\nName: Test User\n\nACADEMIC QUALIFICATION:\n\n| Qualification | Institution | Percentage of marks | Year of passing |\n| --- | --- | --- | --- |\n| B.Tech | Jaipur National University | 67.4 | 2014 |\n\nSKILLS:\n- Microsoft Office\n\n| LANGUAGE KNOWN | Read | Write | Speak |\n| --- | --- | --- | --- |\n| Hindi | ☑ | ☑ | ☑ |",
                }
            ],
            {"model": "mistral-ocr-latest", "pages": 1, "ocr_chars": 220},
        )

    captured = {}

    def fake_canonicalize_text(raw_text, diagnostics=None, raw_sections=None):
        captured["raw_sections"] = raw_sections
        return {
            "normalized": {"rawText": raw_text},
            "rawSections": list(raw_sections or []),
            "summary": None,
            "summaryFirstSentence": None,
            "diagnostics": dict(diagnostics or {}),
        }

    monkeypatch.setattr("cv_parser_service.main._call_mistral_ocr", fake_call_mistral_ocr)
    monkeypatch.setattr("cv_parser_service.main._canonicalize_text", fake_canonicalize_text)

    upload = UploadFile(filename="scan.pdf", file=BytesIO(b"%PDF-1.4\nmock"))
    asyncio.run(mistral_ocr_parse(file=upload, url=None))

    carried = captured["raw_sections"][0]["content"]
    assert "Qualification | Institution | Percentage of marks | Year of passing" in carried
    assert "SKILLS:" not in carried
    assert "LANGUAGE KNOWN" not in carried


def test_mistral_ocr_parse_carries_through_language_table_region_when_global_activation_is_disabled(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return (
            [
                {
                    "index": 0,
                    "markdown": "# Personal Details\nName: Test User\n\nLANGUAGE KNOWN\n\n| LANGUAGE KNOWN | Read | Write | Speak |\n| --- | --- | --- | --- |\n| Hindi | ☑ | ☑ | ☑ |\n| English | ☑ | ☑ | ☑ |\n\nACHIEVEMENTS:\n- Something else",
                }
            ],
            {"model": "mistral-ocr-latest", "pages": 1, "ocr_chars": 180},
        )

    captured = {}

    def fake_canonicalize_text(raw_text, diagnostics=None, raw_sections=None):
        captured["raw_sections"] = raw_sections
        return {
            "normalized": {"rawText": raw_text},
            "rawSections": list(raw_sections or []),
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
    assert diagnostics["ocr_markdown_family_carry_through"] == ["LANGUAGES"]
    carried = captured["raw_sections"][0]["content"]
    assert "LANGUAGE KNOWN" in carried
    assert "ACHIEVEMENTS:" not in carried


def test_mistral_ocr_parse_extracts_languages_from_mixed_education_section_when_global_activation_is_disabled(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return (
            [
                {
                    "index": 0,
                    "markdown": "Curriculum Vitae\nTest User\n\n# Personal Details\nAddress: Example City\n\nACADEMIC QUALIFICATION:\n\n| Qualification | Institution | Percentage of marks | Year of passing |\n| --- | --- | --- | --- |\n| B.Tech | Jaipur National University | 67.4 | 2014 |\n\nSKILLS:\n- Microsoft Office\n\n| LANGUAGE KNOWN | Read | Write | Speak |\n| --- | --- | --- | --- |\n| Hindi | ☑ | ☑ | ☑ |\n| English | ☑ | ☑ | ☑ |",
                }
            ],
            {"model": "mistral-ocr-latest", "pages": 1, "ocr_chars": 260},
        )

    captured = {}

    def fake_canonicalize_text(raw_text, diagnostics=None, raw_sections=None):
        captured["raw_sections"] = raw_sections
        return {
            "normalized": {"rawText": raw_text},
            "rawSections": list(raw_sections or []),
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
    assert diagnostics["ocr_markdown_family_carry_through"] == ["EDUCATION", "LANGUAGES"]
    assert captured["raw_sections"][1]["label"] == "LANGUAGES"
    assert "LANGUAGE KNOWN" in captured["raw_sections"][1]["content"]
    assert "SKILLS:" not in captured["raw_sections"][1]["content"]


def test_mistral_ocr_parse_recovers_language_table_region_from_non_languages_section(monkeypatch):
    monkeypatch.setenv("API_ENABLE_MISTRAL_OCR", "1")
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-test")

    async def fake_call_mistral_ocr(payload, api_key, model_name):
        return (
            [
                {
                    "index": 0,
                    "markdown": "# Personal Details\nName: Test User\n\n# Achievements\nPlayed one time National in Handball.\nParticipated in paper presentation.\n\n| LANGUAGE KNOWN | Read | Write | Speak |\n| --- | --- | --- | --- |\n| Hindi | ☑ | ☑ | ☑ |\n| English | ☑ | ☑ | ☑ |\n| German | ☑ | ☐ | ☐ |\n\nSKILLS:\n- Microsoft Office",
                }
            ],
            {"model": "mistral-ocr-latest", "pages": 1, "ocr_chars": 220},
        )

    captured = {}

    def fake_canonicalize_text(raw_text, diagnostics=None, raw_sections=None):
        captured["raw_sections"] = raw_sections
        return {
            "normalized": {"rawText": raw_text},
            "rawSections": list(raw_sections or []),
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
    assert diagnostics["ocr_markdown_use_raw_sections"] is False
    assert diagnostics["ocr_markdown_family_carry_through"] == ["LANGUAGES"]
    assert captured["raw_sections"] == [
        {
            "label": "LANGUAGES",
            "content": "| LANGUAGE KNOWN | Read | Write | Speak |\n| --- | --- | --- | --- |\n| Hindi | ☑ | ☑ | ☑ |\n| English | ☑ | ☑ | ☑ |\n| German | ☑ | ☐ | ☐ |",
        }
    ]
    carried = captured["raw_sections"][0]["content"]
    assert "Played one time National in Handball" not in carried
    assert "Participated in paper presentation" not in carried
    assert "SKILLS:" not in carried
