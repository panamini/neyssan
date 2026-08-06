from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from cv_parser.canonicalize import canonicalize_cv
from cv_parser_service.mistral_resume_v3 import INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY
from cv_parser_service.mistral_resume_v3.annotation_parser import parse_document_annotation
from cv_parser_service.mistral_resume_v3.app_mapper import build_canonical_payload
from cv_parser_service.mistral_resume_v3.extraction_schema import build_document_annotation_format
from cv_parser_service.mistral_resume_v3.ocr_client import OCRAnnotationResult
from cv_parser_service.mistral_resume_v3.pipeline import (
    _extract_explicit_sections_from_pages,
    _run_resume_pipeline_from_ocr_result,
    run_resume_pipeline_from_bytes,
)
from cv_parser_service.mistral_resume_v3.post_validation import normalize_extraction


def _load_mistral_resume_v3_fixture(name: str) -> dict[str, Any]:
    fixture_path = Path(__file__).parent / "fixtures" / "mistral_resume_v3" / name
    return json.loads(fixture_path.read_text())


def _build_fixture_ocr_result(name: str, *, annotation_raw: Any | None = None) -> OCRAnnotationResult:
    fixture = _load_mistral_resume_v3_fixture(name)
    payload = fixture["annotation_raw"] if annotation_raw is None else annotation_raw
    return OCRAnnotationResult(
        pages=fixture["pages"],
        page_count=fixture["diagnostics"]["page_count"],
        diagnostics=fixture["diagnostics"],
        annotation_raw=payload,
        response_payload={"document_annotation": payload},
    )


def _build_retry_contradiction_result() -> OCRAnnotationResult:
    return OCRAnnotationResult(
        pages=[
            {
                "index": 0,
                "markdown": (
                    "Retry Candidate | Software Engineer\n"
                    "retry@example.com\n\n"
                    "Languages\n\n"
                    "Areas of expertise\n"
                    "Backend: Python, Node.js\n\n"
                    "Experience\n"
                    "Example Systems | Software Engineer | 2021 - Present\n"
                    "- Built backend APIs.\n"
                ),
            }
        ],
        page_count=1,
        diagnostics={
            "model": "mistral-ocr-latest",
            "page_count": 1,
            "pages": 1,
            "ocr_chars": 188,
            "document_name": "retry-contradiction.pdf",
        },
        annotation_raw={
            "identity": {"name": "Retry Candidate", "desiredPosition": "Software Engineer"},
            "contact": {"email": "retry@example.com"},
            "languages": [],
            "skills": [],
            "experience": [
                {
                    "company": "Example Systems",
                    "position": "Software Engineer",
                    "startDate": "2021",
                    "endDate": "Present",
                    "isCurrent": True,
                    "responsibilityBullets": ["Built backend APIs."],
                }
            ],
            "sectionOrder": [
                {"family": "languages", "ordinal": 0, "title": "Languages"},
                {"family": "skills", "ordinal": 0, "title": "Areas of expertise"},
                {"family": "experience", "ordinal": 0, "title": "Experience"},
            ],
        },
        response_payload={},
    )


def test_robert_cooper_decorated_sections_recover_from_semantically_incomplete_annotation() -> None:
    profile = (
        "Safety conscious individual with over five years of experience in protecting and "
        "safeguarding people and property."
    )
    ocr_result = OCRAnnotationResult(
        pages=[
            {
                "index": 0,
                "markdown": (
                    "![img-0.jpeg](img-0.jpeg)\n\n"
                    "# ROBERT COOPER\n"
                    "SECURITY GUARD ♦ LOS ANGELES, CA 90291, UNITED STATES ☎ 3868683442\n\n"
                    "# ◦ DETAILS ◦\n"
                    "1515 Pacific Ave\n"
                    "Los Angeles, CA 90291\n"
                    "United States\n"
                    "3868683442\n"
                    "email@email.com\n\n"
                    "# ◦ LINKS ◦\n"
                    "LinkedIn\n\n"
                    "# PROFILE\n"
                    f"{profile}\n\n"
                    "# EMPLOYMENT HISTORY\n"
                    "## Security Guard at ADT Security, Port Washington\n"
                    "January 2021 — April 2022\n"
                    "- Protected company belongings, visitors, employees, and clients.\n\n"
                    "# ◦ SKILLS ◦\n"
                    "Investigation skills\n"
                    "Safety compliance\n"
                    "Criminal justice knowledge\n"
                    "Restraining devices\n"
                    "Martial arts/Physical combat training\n\n"
                    "# HOBBIES\n"
                    "Running, Mtb, Enduro\n\n"
                    "# ◦ LANGUAGES ◦\n"
                    "English\n"
                    "Spanish\n"
                    "Italian\n\n"
                    "# EDUCATION\n"
                    "Certified Protection Guard Program (CPOP), International Foundation for Protection Guards, Alexandria\n"
                    "January 2021 — April 2022\n"
                    "Security Guard Certificate Program (SOCP), ASIS International, North Naples\n"
                    "April 2022 — April 2022\n"
                    "- Course Curriculum: security principles and emergency procedures.\n"
                    "S.A.F.E. Approach Level II Training, Hawaii Western College\n"
                    "January 2015 — November 2019\n\n"
                    "# ACHIEVEMENTS\n"
                    "- Completed S.A.F.E. Approach Level II Training.\n"
                ),
            }
        ],
        page_count=1,
        diagnostics={
            "model": "mistral-ocr-latest",
            "page_count": 1,
            "pages": 1,
            "ocr_chars": 1200,
            "document_name": "cv_png.pdf",
        },
        annotation_raw={
            "identity": {},
            "summary": {"text": ""},
            "experience": [],
            "education": [],
            "skills": [],
            "languages": [],
            "hobbies": [],
            "achievements": [],
            "sectionOrder": [],
        },
        response_payload={},
    )

    result = _run_resume_pipeline_from_ocr_result(ocr_result)

    assert result["status"] in {"success", "partial"}
    normalized = result["canonical_payload"]["normalized"]
    assert normalized["name"] == "Robert Cooper"
    assert normalized["profile"]["desiredPosition"] == "Security Guard"
    assert normalized["contact"]["addressBlock"] == "1515 Pacific Ave"
    assert normalized["contact"]["email"] == "email@email.com"
    assert normalized["contact"]["phone"] == "3868683442"
    assert normalized["contact"]["location"] == "Los Angeles, CA 90291, United States"
    assert normalized["summary"]["text"] == profile
    assert [item["name"] for item in normalized["skills"]] == [
        "Investigation skills",
        "Safety compliance",
        "Criminal justice knowledge",
        "Restraining devices",
        "Martial arts/Physical combat training",
    ]
    assert [item["name"] for item in normalized["languages"]] == ["English", "Spanish", "Italian"]
    assert [item["degree"] for item in normalized["education"]] == [
        "Certified Protection Guard Program (CPOP)",
        "Security Guard Certificate Program (SOCP)",
        "S.A.F.E. Approach Level II Training",
    ]
    assert [item["institution"] for item in normalized["education"]] == [
        "International Foundation for Protection Guards",
        "ASIS International",
        "Hawaii Western College",
    ]
    assert [item["text"] for item in normalized["hobbies"]] == ["Running", "Mtb", "Enduro"]
    assert [item["text"] for item in normalized["achievements"]] == [
        "Completed S.A.F.E. Approach Level II Training."
    ]


def test_jake_markdown_recovers_heading_entries_without_collapsing_sections() -> None:
    markdown = """# Jake Ryan

123-456-7890 | jake@su.edu | linkedin.com/in/jake | github.com/jake

## EDUCATION

### Southwestern University
*Bachelor of Arts in Computer Science, Minor in Business*
Georgetown, TX
*Aug. 2018 – May 2021*

### Blinn College
*Associate's in Liberal Arts*
Bryan, TX
*Aug. 2014 – May 2018*

## EXPERIENCE

### Undergraduate Research Assistant
*Texas A&M University*
June 2020 – Present
*College Station, TX*
- Developed a REST API using FastAPI and PostgreSQL.

### Information Technology Support Specialist
*Southwestern University*
Sep. 2018 – Present
*Georgetown, TX*
- Troubleshot campus computers.

### Artificial Intelligence Research Assistant
*Southwestern University*
May 2019 – July 2019
*Georgetown, TX*
- Developed a game in Java.

## PROJECTS

### Gitlytics | *Python, Flask, React*
June 2020 – Present
- Built a full-stack application.

### Simple Paintball | *Spigot API, Java*
May 2018 – May 2020
- Developed a Minecraft server plugin.

## TECHNICAL SKILLS

**Languages:** Java, Python, C/C++, SQL (Postgres), JavaScript
**Frameworks:** React, Node.js, Flask, FastAPI
"""
    ocr_result = OCRAnnotationResult(
        pages=[{"index": 0, "markdown": markdown}],
        page_count=1,
        diagnostics={"model": "mistral-ocr-latest", "page_count": 1, "document_name": "jake.pdf"},
        annotation_raw={},
        response_payload={},
    )

    result = _run_resume_pipeline_from_ocr_result(ocr_result)

    assert result["status"] in {"success", "partial"}
    normalized = result["canonical_payload"]["normalized"]
    assert normalized["name"] == "Jake Ryan"
    assert normalized["contact"]["email"] == "jake@su.edu"
    assert normalized["contact"]["phone"] == "123-456-7890"
    assert [item["position"] for item in normalized["experience"]] == [
        "Undergraduate Research Assistant",
        "Information Technology Support Specialist",
        "Artificial Intelligence Research Assistant",
    ]
    assert [item["company"] for item in normalized["experience"]] == [
        "Texas A&M University",
        "Southwestern University",
        "Southwestern University",
    ]
    assert [item["institution"] for item in normalized["education"]] == [
        "Southwestern University",
        "Blinn College",
    ]
    assert [item["title"] for item in normalized["projects"]] == ["Gitlytics", "Simple Paintball"]
    assert [item["name"] for item in normalized["skills"]] == [
        "Java",
        "Python",
        "C/C++",
        "SQL (Postgres)",
        "JavaScript",
        "React",
        "Node.js",
        "Flask",
        "FastAPI",
    ]


def test_prasanna_markdown_recovers_bold_table_sections_and_profile_values() -> None:
    markdown = """## **Curriculum Vitae**

**NAME** : PRASANNA VENGATESH.S
**ADDRESS** : 208, Second floor,
Berkeley Staff Accommodation,
Dubai,
United Arab Emirates.
**E-MAIL ID** : s.prasannavengatesh@gmail.com
**PHONE NO** : +971-0505572568
**OBJECTIVE** : To implement my knowledge and experience in our company.

### **EDUCATIONAL QUALIFICATIONS:**
| **Qualification** | **Institution** | **Percentage of marks** | **Year of passing** |
| --- | --- | --- | --- |
| Diploma in Instrumentation & Control Engineering | Seshasayee Institute of Technology, Trichy. | 78% | 2010 |
| S.S.L.C | St.Joseph's hr secondary school, Trichy. | 88% | 2007 |

### **COMPUTER SKILLS:**
- AutoCAD
- Web Designing & Development

# **PROJECT TITLE:**
Automatic Fuse change over system.

# **Summary of Experience:**
| **Name Of Organization** | **City, Country** | **Designation** | **From** | **To** | **Duration** | **Reason For Leaving** |
| --- | --- | --- | --- | --- | --- | --- |
| Applied Automation Systems | Coimbatore, India. | Plant Maintenance technician. | 02/05/2010 | 05/11/2010 | 6 Months | Layoff due to power cut. |
| Berkeley Services | Dubai, UAE. | Maintenance Planner | 26/08/2014 | Till Now | 1 year 9 Months | Currently Working. |

# **Nature Of Work :**
- Develops maintenance planning strategies.
- Creates work orders.

#### **PERSONAL PROFILE:**
| **Name** | : | PRASANNA VENGATESH.S |
| --- | --- | --- |
| **Languages known** | : | Tamil, English, Telugu, Hindi, Malayalam |
| **Hobbies** | : | Watching cricket, Talking to people. |
"""
    ocr_result = OCRAnnotationResult(
        pages=[{"index": 0, "markdown": markdown}],
        page_count=1,
        diagnostics={"model": "mistral-ocr-latest", "page_count": 1, "document_name": "prasanna.pdf"},
        annotation_raw={},
        response_payload={},
    )

    result = _run_resume_pipeline_from_ocr_result(ocr_result)

    assert result["status"] in {"success", "partial"}
    normalized = result["canonical_payload"]["normalized"]
    assert normalized["name"] == "Prasanna Vengatesh.S"
    assert normalized["contact"]["email"] == "s.prasannavengatesh@gmail.com"
    assert normalized["contact"]["phone"] == "+971-0505572568"
    assert normalized["summary"]["text"] == "To implement my knowledge and experience in our company."
    assert [item["company"] for item in normalized["experience"]] == [
        "Applied Automation Systems",
        "Berkeley Services",
    ]
    assert normalized["experience"][0]["startDate"] != "2010-01-01"
    assert normalized["experience"][1]["isCurrent"] is True
    assert [item["degree"] for item in normalized["education"]] == [
        "Diploma in Instrumentation & Control Engineering",
        "S.S.L.C",
    ]
    assert [item["name"] for item in normalized["languages"]] == [
        "Tamil",
        "English",
        "Telugu",
        "Hindi",
        "Malayalam",
    ]
    assert [item["text"] for item in normalized["hobbies"]] == ["Watching cricket", "Talking to people."]


@pytest.mark.parametrize(
    ("heading", "family"),
    [
        ("Tech stack", "skills"),
        ("Technical stack", "skills"),
        ("Technical background", "skills"),
        ("Capabilities", "skills"),
        ("Key capabilities", "skills"),
        ("Core skills", "skills"),
        ("Tools", "skills"),
        ("Technologies", "skills"),
        ("Language skills", "languages"),
        ("Languages spoken", "languages"),
        ("Linguistic skills", "languages"),
        ("Skills", "skills"),
        ("Areas of expertise", "skills"),
        ("Languages", "languages"),
        ("Work Experience", "experience"),
        ("Professional Experience", "experience"),
        ("Employment History", "experience"),
        ("Work History", "experience"),
        ("Career History", "experience"),
        ("Professional Background", "experience"),
        ("Relevant Experience", "experience"),
        ("Career Experience", "experience"),
        ("Industry Experience", "experience"),
        ("Experiencia", "experience"),
        ("Experiencia Laboral", "experience"),
        ("Experiencia Profesional", "experience"),
        ("Experiencia Profesional Relevante", "experience"),
        ("Historial Laboral", "experience"),
        ("Historial Profesional", "experience"),
        ("Trayectoria Profesional", "experience"),
        ("Experiência", "experience"),
        ("Experiência Profissional", "experience"),
        ("Histórico Profissional", "experience"),
        ("Histórico de Trabalho", "experience"),
        ("Trajetória Profissional", "experience"),
        ("Expérience", "experience"),
        ("Expérience Professionnelle", "experience"),
        ("Expérience de Travail", "experience"),
        ("Parcours Professionnel", "experience"),
        ("Historique Professionnel", "experience"),
        ("Berufserfahrung", "experience"),
        ("Berufliche Erfahrung", "experience"),
        ("Beruflicher Werdegang", "experience"),
        ("Arbeitserfahrung", "experience"),
        ("Werdegang", "experience"),
        ("Esperienza", "experience"),
        ("Esperienza Professionale", "experience"),
        ("Esperienza Lavorativa", "experience"),
        ("Percorso Professionale", "experience"),
        ("Experience / Work History", "experience"),
        ("Experiência / Histórico Profissional", "experience"),
        ("Expérience / Expérience Professionnelle", "experience"),
    ],
)
def test_extract_explicit_sections_maps_heading_aliases_to_expected_family(heading: str, family: str) -> None:
    sections = _extract_explicit_sections_from_pages(
        [
            {
                "index": 0,
                "markdown": f"## {heading}:\nPrimary item\n\nExperience\nExample Corp\n",
            }
        ]
    )

    assert family in sections
    assert sections[family][0].heading == heading
    assert sections[family][0].lines[0] == "Primary item"


def test_extract_explicit_sections_keeps_nested_markdown_headings_inside_experience_section() -> None:
    sections = _extract_explicit_sections_from_pages(
        [
            {
                "index": 0,
                "markdown": (
                    "# WORK HISTORY\n\n"
                    "## Spring Education Group - Middle School Language Arts Teacher\n\n"
                    "Issaquah, WA • 08/2010 - Current\n"
                    "- Taught all levels of English language arts.\n\n"
                    "# EDUCATION\n"
                    "Example University\n"
                ),
            }
        ]
    )

    assert "experience" in sections
    assert sections["experience"][0].heading == "WORK HISTORY"
    assert sections["experience"][0].lines == [
        "## Spring Education Group - Middle School Language Arts Teacher",
        "",
        "Issaquah, WA • 08/2010 - Current",
        "- Taught all levels of English language arts.",
        "",
    ]


def test_parse_document_annotation_accepts_json_string() -> None:
    extraction = parse_document_annotation(
        """
        {
          "identity": {"name": "Jane Example"},
          "summary": {"text": "Product designer with multilingual experience."},
          "skills": [{"name": "Figma"}]
        }
        """
    )

    assert extraction.identity is not None
    assert extraction.identity.name == "Jane Example"
    assert extraction.summary is not None
    assert extraction.summary.text == "Product designer with multilingual experience."


def test_build_document_annotation_format_handles_numeric_schema_constraints() -> None:
    response_format = build_document_annotation_format()

    assert response_format["type"] == "json_schema"
    schema = response_format["json_schema"]["schema"]
    ordinal_schema = schema["$defs"]["ExtractionSectionOrderItem"]["properties"]["ordinal"]
    assert ordinal_schema["minimum"] == 0
    assert schema["additionalProperties"] is False
    assert schema["$defs"]["ExtractionSectionOrderItem"]["additionalProperties"] is False


def test_run_resume_pipeline_from_bytes_returns_authoritative_payload_when_annotation_is_valid(monkeypatch) -> None:
    call_count = 0

    def fake_annotated_ocr_from_bytes(**_: object) -> OCRAnnotationResult:
        nonlocal call_count
        call_count += 1
        return OCRAnnotationResult(
            pages=[{"index": 0, "markdown": "# Summary\nTrusted Mistral OCR output"}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": 32,
                "document_name": "robertcooper.pdf",
            },
            annotation_raw={
                "identity": {"name": "Robert Cooper"},
                "summary": {"text": "Security guard with executive protection experience."},
                "experience": [
                    {
                        "company": "Executive Security Team",
                        "position": "Protection Guard",
                        "responsibilityBullets": ["Protected VIP principals"],
                    }
                ],
            },
            response_payload={"document_annotation": {"identity": {"name": "Robert Cooper"}}},
        )

    monkeypatch.setattr(
        "cv_parser_service.mistral_resume_v3.pipeline.run_annotated_ocr_from_bytes",
        fake_annotated_ocr_from_bytes,
    )

    result = run_resume_pipeline_from_bytes(
        file_name="robertcooper.pdf",
        content_type="application/pdf",
        data=b"fake-pdf",
        api_key="test-key",
        model_name="mistral-ocr-latest",
    )

    assert result["fallback_to_legacy"] is False
    assert result["status"] == "success"
    assert call_count == 1
    diagnostics = result["diagnostics"]
    assert diagnostics["mistral_parser_status"] == "success"
    assert diagnostics["model"] == "mistral-ocr-latest"
    assert diagnostics["sectionRecovery"]["languages"]["applied"] is False
    assert diagnostics["sectionRecovery"]["skills"]["applied"] is False
    assert diagnostics["annotationRetry"]["attempted"] is False
    assert diagnostics["annotationRetry"]["count"] == 0
    assert diagnostics["annotationRetry"]["reason"] is None
    assert diagnostics["parsingQuality"] == {
        "has_languages_section": False,
        "languages_extracted": False,
        "languages_success": False,
        "has_skills_section": False,
        "skills_extracted": False,
        "skills_success": False,
        "recovery_used": False,
        "retry_used": False,
        "error_type": None,
        "hard_failure": False,
    }
    assert result["canonical_payload"]["diagnostics"]["sectionRecovery"] == diagnostics["sectionRecovery"]
    assert result["canonical_payload"]["diagnostics"]["annotationRetry"] == diagnostics["annotationRetry"]
    assert result["canonical_payload"]["diagnostics"]["parsingQuality"] == diagnostics["parsingQuality"]
    assert result["canonical_payload"]["normalized"]["name"] == "Robert Cooper"


def test_run_resume_pipeline_from_bytes_keeps_fallback_behavior_when_annotation_parse_fails(monkeypatch) -> None:
    def fake_annotated_ocr_from_bytes(**_: object) -> OCRAnnotationResult:
        return OCRAnnotationResult(
            pages=[{"index": 0, "markdown": "# Profile\nBroken annotation"}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": 25,
                "document_name": "broken.pdf",
            },
            annotation_raw=None,
            response_payload={},
        )

    monkeypatch.setattr(
        "cv_parser_service.mistral_resume_v3.pipeline.run_annotated_ocr_from_bytes",
        fake_annotated_ocr_from_bytes,
    )

    result = run_resume_pipeline_from_bytes(
        file_name="broken.pdf",
        content_type="application/pdf",
        data=b"fake-pdf",
        api_key="test-key",
        model_name="mistral-ocr-latest",
    )

    assert result["fallback_to_legacy"] is True
    assert result["status"] == "failed"
    assert result["stage"] == "annotation_parse"
    assert result["errorType"] == "annotation_parse_failed"
    diagnostics = result["diagnostics"]
    assert "sectionRecovery" in diagnostics
    assert diagnostics["sectionRecovery"]["languages"]["applied"] is False
    assert diagnostics["sectionRecovery"]["skills"]["applied"] is False
    assert diagnostics["annotationRetry"]["attempted"] is False
    assert diagnostics["annotationRetry"]["count"] == 0
    assert diagnostics["annotationRetry"]["reason"] is None


def test_run_resume_pipeline_from_bytes_preserves_explicit_achievements_from_ocr_markdown_when_annotation_omits_field(
    monkeypatch,
) -> None:
    def fake_annotated_ocr_from_bytes(**_: object) -> OCRAnnotationResult:
        return OCRAnnotationResult(
            pages=[
                {
                    "index": 0,
                    "markdown": (
                        "# ROBERT COOPER\n\n"
                        "## EMPLOYMENT HISTORY\n\n"
                        "### Security Guard at ADT Security\n"
                        "- Protected VIP principals.\n"
                    ),
                },
                {
                    "index": 1,
                    "markdown": (
                        "# ACHIEVEMENTS\n\n"
                        "- Decreased theft by 73% through improved vigilance strategies.\n"
                        "- Reduced unauthorized entry by 26% using a visitor notification app.\n"
                    ),
                },
            ],
            page_count=2,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 2,
                "pages": 2,
                "ocr_chars": 220,
                "document_name": "sample_textpdf_resume.pdf",
            },
            annotation_raw="""
            {
              "identity": {"name": "Robert Cooper"},
              "experience": [
                {
                  "company": "ADT Security",
                  "position": "Security Guard",
                  "responsibilityBullets": ["Protected VIP principals."]
                }
              ],
              "sectionOrder": [
                {"family": "experience", "ordinal": 0, "title": "EMPLOYMENT HISTORY"},
                {"family": "achievements", "ordinal": 1, "title": "ACHIEVEMENTS"}
              ]
            }
            """,
            response_payload={},
        )

    monkeypatch.setattr(
        "cv_parser_service.mistral_resume_v3.pipeline.run_annotated_ocr_from_bytes",
        fake_annotated_ocr_from_bytes,
    )

    result = run_resume_pipeline_from_bytes(
        file_name="sample_textpdf_resume.pdf",
        content_type="application/pdf",
        data=b"fake-pdf",
        api_key="test-key",
        model_name="mistral-ocr-latest",
    )

    assert result["fallback_to_legacy"] is False
    assert result["canonical_payload"]["normalized"]["achievements"] == [
        {"text": "Decreased theft by 73% through improved vigilance strategies."},
        {"text": "Reduced unauthorized entry by 26% using a visitor notification app."},
    ]
    assert result["canonical_payload"]["normalized"]["sectionOrder"] == [
        {"family": "experience", "ordinal": 0, "title": "EMPLOYMENT HISTORY"},
        {"family": "achievements", "ordinal": 0, "title": "ACHIEVEMENTS"},
    ]


def test_run_resume_pipeline_from_ocr_result_recovers_explicit_work_history_entries_without_retry() -> None:
    markdown = (
        "JESSICA CLAIRE\n"
        "resumeexample@example.com(555) 432-1000\n"
        "Location: Montgomery Street, San Francisco, CA 94105\n\n"
        "# WORK HISTORY\n\n"
        "## Spring Education Group - Middle School Language Arts Teacher\n\n"
        "Issaquah, WA • 08/2010 - Current\n\n"
        "- Taught all levels of English language arts including intensive, regular, and advanced students\n"
        "- Taught seventh and eight grade students\n\n"
        "## Falcon School District 49 - Elementary School Teacher\n\n"
        "Peyton, CO • 08/2008 - 06/2010\n\n"
        "- Gained experience teaching in a Title I school with a diverse student population\n"
        "- Taught three subject areas\n\n"
        "# EDUCATION\n"
        "Cedarville University\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "jessica-claire.pdf",
            },
            annotation_raw={
                "identity": {
                    "name": "Jessica Claire",
                    "location": "Montgomery Street, San Francisco, CA 94105",
                },
                "contact": {"email": "resumeexample@example.com", "phone": "(555) 432-1000"},
                "experience": [],
                "education": [{"institution": "Cedarville University"}],
                "sectionOrder": [
                    {"family": "experience", "ordinal": 0, "title": "WORK HISTORY"},
                    {"family": "education", "ordinal": 0, "title": "EDUCATION"},
                ],
            },
            response_payload={},
        )
    )

    assert result["fallback_to_legacy"] is False
    normalized_payload = result["canonical_payload"]["normalized"]
    assert len(normalized_payload["experience"]) == 2
    first_experience = normalized_payload["experience"][0]
    second_experience = normalized_payload["experience"][1]
    assert first_experience["company"] == "Spring Education Group"
    assert first_experience["position"] == "Middle School Language Arts Teacher"
    assert first_experience["location"] == "Issaquah, WA"
    assert first_experience["startDate"] == "08/2010"
    assert first_experience["endDate"] is None
    assert first_experience["isCurrent"] is True
    assert first_experience["responsibilityBullets"] == [
        "Taught all levels of English language arts including intensive, regular, and advanced students",
        "Taught seventh and eight grade students",
    ]
    assert second_experience["company"] == "Falcon School District 49"
    assert second_experience["position"] == "Elementary School Teacher"
    assert second_experience["location"] == "Peyton, CO"
    assert second_experience["startDate"] == "08/2008"
    assert second_experience["endDate"] == "06/2010"
    assert result["diagnostics"]["sectionRecovery"]["experience"]["applied"] is True
    assert result["diagnostics"]["sectionRecovery"]["experience"]["heading"] == "WORK HISTORY"
    assert result["diagnostics"]["annotationRetry"]["attempted"] is False


def test_run_resume_pipeline_from_ocr_result_recovers_explicit_relevant_experience_entries_without_retry() -> None:
    markdown = (
        "JESSICA CLAIRE\n"
        "resumeexample@example.com(555) 432-1000\n\n"
        "# RELEVANT EXPERIENCE\n\n"
        "## Spring Education Group - Middle School Language Arts Teacher\n\n"
        "Issaquah, WA • 08/2010 - Current\n\n"
        "- Taught all levels of English language arts including intensive, regular, and advanced students\n"
        "- Taught seventh and eight grade students\n\n"
        "# EDUCATION\n"
        "Cedarville University\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "jessica-claire-relevant-experience.pdf",
            },
            annotation_raw={
                "identity": {
                    "name": "Jessica Claire",
                },
                "contact": {"email": "resumeexample@example.com", "phone": "(555) 432-1000"},
                "experience": [],
                "education": [{"institution": "Cedarville University"}],
                "sectionOrder": [
                    {"family": "experience", "ordinal": 0, "title": "RELEVANT EXPERIENCE"},
                    {"family": "education", "ordinal": 0, "title": "EDUCATION"},
                ],
            },
            response_payload={},
        )
    )

    assert result["fallback_to_legacy"] is False
    normalized_payload = result["canonical_payload"]["normalized"]
    assert len(normalized_payload["experience"]) == 1
    assert normalized_payload["experience"][0]["company"] == "Spring Education Group"
    assert normalized_payload["experience"][0]["position"] == "Middle School Language Arts Teacher"
    assert result["diagnostics"]["sectionRecovery"]["experience"]["applied"] is True
    assert result["diagnostics"]["sectionRecovery"]["experience"]["heading"] == "RELEVANT EXPERIENCE"
    assert result["diagnostics"]["annotationRetry"]["attempted"] is False


def test_run_resume_pipeline_from_ocr_result_recovers_explicit_portuguese_experience_heading_without_retry() -> None:
    markdown = (
        "JESSICA CLAIRE\n"
        "resumeexample@example.com(555) 432-1000\n\n"
        "# EXPERIÊNCIA PROFISSIONAL\n\n"
        "## Spring Education Group - Middle School Language Arts Teacher\n\n"
        "Issaquah, WA • 08/2010 - 06/2014\n\n"
        "- Taught all levels of English language arts including intensive, regular, and advanced students\n"
        "- Taught seventh and eight grade students\n\n"
        "# EDUCATION\n"
        "Cedarville University\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "jessica-claire-experiencia-profissional.pdf",
            },
            annotation_raw={
                "identity": {
                    "name": "Jessica Claire",
                },
                "contact": {"email": "resumeexample@example.com", "phone": "(555) 432-1000"},
                "experience": [],
                "education": [{"institution": "Cedarville University"}],
                "sectionOrder": [
                    {"family": "experience", "ordinal": 0, "title": "EXPERIÊNCIA PROFISSIONAL"},
                    {"family": "education", "ordinal": 0, "title": "EDUCATION"},
                ],
            },
            response_payload={},
        )
    )

    assert result["fallback_to_legacy"] is False
    normalized_payload = result["canonical_payload"]["normalized"]
    assert len(normalized_payload["experience"]) == 1
    assert normalized_payload["experience"][0]["company"] == "Spring Education Group"
    assert normalized_payload["experience"][0]["position"] == "Middle School Language Arts Teacher"
    assert normalized_payload["experience"][0]["startDate"] == "08/2010"
    assert normalized_payload["experience"][0]["endDate"] == "06/2014"
    assert result["diagnostics"]["sectionRecovery"]["experience"]["applied"] is True
    assert result["diagnostics"]["sectionRecovery"]["experience"]["heading"] == "EXPERIÊNCIA PROFISSIONAL"
    assert result["diagnostics"]["annotationRetry"]["attempted"] is False


def test_run_resume_pipeline_from_ocr_result_recovers_explicit_french_experience_heading_without_retry() -> None:
    markdown = (
        "JESSICA CLAIRE\n"
        "resumeexample@example.com(555) 432-1000\n\n"
        "# EXPÉRIENCE PROFESSIONNELLE\n\n"
        "## Spring Education Group - Middle School Language Arts Teacher\n\n"
        "Issaquah, WA • 08/2010 - 06/2014\n\n"
        "- Taught all levels of English language arts including intensive, regular, and advanced students\n"
        "- Taught seventh and eight grade students\n\n"
        "# EDUCATION\n"
        "Cedarville University\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "jessica-claire-experience-professionnelle.pdf",
            },
            annotation_raw={
                "identity": {
                    "name": "Jessica Claire",
                },
                "contact": {"email": "resumeexample@example.com", "phone": "(555) 432-1000"},
                "experience": [],
                "education": [{"institution": "Cedarville University"}],
                "sectionOrder": [
                    {"family": "experience", "ordinal": 0, "title": "EXPÉRIENCE PROFESSIONNELLE"},
                    {"family": "education", "ordinal": 0, "title": "EDUCATION"},
                ],
            },
            response_payload={},
        )
    )

    assert result["fallback_to_legacy"] is False
    normalized_payload = result["canonical_payload"]["normalized"]
    assert len(normalized_payload["experience"]) == 1
    assert normalized_payload["experience"][0]["company"] == "Spring Education Group"
    assert normalized_payload["experience"][0]["position"] == "Middle School Language Arts Teacher"
    assert normalized_payload["experience"][0]["startDate"] == "08/2010"
    assert normalized_payload["experience"][0]["endDate"] == "06/2014"
    assert result["diagnostics"]["sectionRecovery"]["experience"]["applied"] is True
    assert result["diagnostics"]["sectionRecovery"]["experience"]["heading"] == "EXPÉRIENCE PROFESSIONNELLE"
    assert result["diagnostics"]["annotationRetry"]["attempted"] is False


def test_run_resume_pipeline_from_ocr_result_recovers_explicit_summary_section_without_retry() -> None:
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[
                {
                    "index": 0,
                    "markdown": (
                        "# ROBERT SMITH\n\n"
                        "## Lead Customer Advocate\n\n"
                        "Phone: (0123)-456-789 | Email: info@qwikresume.com | Website: Qwikresume.com\n\n"
                        "## SUMMARY\n\n"
                        "Cash handling accuracy Excellent multi-tasker Organized Friendly Dependable "
                        "Reliable Strong communication skills Punctual Flexible schedule Knowledge of MS office and POS.\n\n"
                        "## CORE COMPETENCIES\n\n"
                        "Accounting, Data Entry, WindowsXP-8, Technology Management.\n\n"
                        "## PROFESSIONAL EXPERIENCE\n\n"
                        "### Lead Customer Advocate\n\n"
                        "CitySquare - 2015 – Present\n\n"
                        "#### Key Deliverables:\n\n"
                        "- Worked with men, women and children who were attempting to leave a violent relationship.\n"
                    ),
                }
            ],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": 760,
                "document_name": "robertsmith.jpg",
            },
            annotation_raw={
                "identity": {
                    "name": "ROBERT SMITH",
                    "desiredPosition": "Lead Customer Advocate",
                },
                "contact": {
                    "email": "info@qwikresume.com",
                    "website": "Qwikresume.com",
                    "phone": "(0123)-456-789",
                },
                "summary": {"text": None},
                "skills": [
                    {"name": "Accounting"},
                    {"name": "Data Entry"},
                    {"name": "WindowsXP-8"},
                    {"name": "Technology Management"},
                ],
                "experience": [
                    {
                        "company": "CitySquare",
                        "position": "Lead Customer Advocate",
                        "startDate": "2015",
                        "endDate": "Present",
                        "isCurrent": True,
                        "responsibilityBullets": [
                            "Worked with men, women and children who were attempting to leave a violent relationship."
                        ],
                    }
                ],
                "sectionOrder": [
                    {"family": "summary", "ordinal": 0, "title": "SUMMARY"},
                    {"family": "skills", "ordinal": 0, "title": "CORE COMPETENCIES"},
                    {"family": "experience", "ordinal": 0, "title": "PROFESSIONAL EXPERIENCE"},
                ],
            },
            response_payload={},
        )
    )

    assert result["fallback_to_legacy"] is False
    assert result["status"] == "partial"
    normalized_payload = result["canonical_payload"]["normalized"]
    assert normalized_payload["summary"]["text"] == (
        "Cash handling accuracy Excellent multi-tasker Organized Friendly Dependable "
        "Reliable Strong communication skills Punctual Flexible schedule Knowledge of MS office and POS."
    )
    assert result["diagnostics"]["sectionRecovery"]["summary"]["applied"] is True
    assert result["diagnostics"]["sectionRecovery"]["summary"]["heading"] == "SUMMARY"
    assert result["diagnostics"]["annotationRetry"]["attempted"] is False


def test_run_resume_pipeline_from_ocr_result_recovers_desired_position_from_helen_style_header_when_annotation_omits_it() -> None:
    markdown = (
        "HELEN D. KETTER\n"
        "Fashion writer turned designer\n"
        "instagram.com/_hellenk_\n"
        "www.enhancv.com\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "helenketter.jpg",
            },
            annotation_raw={
                "identity": {
                    "name": "HELEN D. KETTER",
                },
                "contact": {
                    "linkedin": "instagram.com/_hellenk_",
                    "website": "www.enhancv.com",
                },
            },
            response_payload={},
        )
    )

    normalized_payload = result["canonical_payload"]["normalized"]
    assert normalized_payload["identitySchema"]["desiredPosition"] == "Fashion writer turned designer"
    assert normalized_payload["profile"]["desiredPosition"] == "Fashion writer turned designer"


def test_run_resume_pipeline_from_ocr_result_recovers_desired_position_from_robert_header_when_annotation_omits_it() -> None:
    markdown = (
        "ROBERT COOPER\n"
        "SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 3868683442\n"
        "DETAILS PROFILE\n"
        "1515 Pacific Ave\n"
        "email@email.com\n\n"
        "# EMPLOYMENT HISTORY\n\n"
        "## Security Guard at ADT Security\n"
        "- Protected VIP principals.\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "sample_textpdf_resume.pdf",
            },
            annotation_raw={
                "identity": {
                    "name": "Robert Cooper",
                },
                "contact": {
                    "email": "email@email.com",
                    "phone": "3868683442",
                    "address": "1515 Pacific Ave",
                },
                "experience": [
                    {
                        "company": "ADT Security",
                        "position": "Security Guard",
                        "responsibilityBullets": ["Protected VIP principals."],
                    }
                ],
                "sectionOrder": [
                    {"family": "experience", "ordinal": 0, "title": "EMPLOYMENT HISTORY"},
                ],
            },
            response_payload={},
        )
    )

    normalized_payload = result["canonical_payload"]["normalized"]
    assert normalized_payload["identitySchema"]["desiredPosition"] == "Security Guard"
    assert normalized_payload["profile"]["desiredPosition"] == "Security Guard"


def test_run_resume_pipeline_from_ocr_result_does_not_backfill_desired_position_from_jessica_experience_header() -> None:
    markdown = (
        "JESSICA CLAIRE\n"
        "resumeexample@example.com(555) 432-1000\n"
        "Location: Montgomery Street, San Francisco, CA 94105\n\n"
        "# WORK HISTORY\n\n"
        "## Spring Education Group - Middle School Language Arts Teacher\n\n"
        "Issaquah, WA • 08/2010 - Current\n\n"
        "- Taught all levels of English language arts including intensive, regular, and advanced students\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "jessicaclaire.png",
            },
            annotation_raw={
                "identity": {
                    "name": "Jessica Claire",
                },
                "contact": {
                    "email": "resumeexample@example.com",
                    "phone": "(555) 432-1000",
                    "address": "Montgomery Street, San Francisco, CA 94105",
                },
                "experience": [
                    {
                        "company": "Spring Education Group",
                        "position": "Middle School Language Arts Teacher",
                        "startDate": "08/2010",
                        "endDate": "Current",
                        "isCurrent": True,
                        "responsibilityBullets": [
                            "Taught all levels of English language arts including intensive, regular, and advanced students"
                        ],
                    }
                ],
                "sectionOrder": [
                    {"family": "experience", "ordinal": 0, "title": "WORK HISTORY"},
                ],
            },
            response_payload={},
        )
    )

    normalized_payload = result["canonical_payload"]["normalized"]
    assert "desiredPosition" not in normalized_payload["identitySchema"]
    assert normalized_payload["profile"]["desiredPosition"] is None


def _run_desired_position_header_case(
    *,
    markdown: str,
    annotation_raw: dict[str, Any],
    document_name: str = "desired_position_header_case.pdf",
) -> dict[str, Any]:
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": document_name,
            },
            annotation_raw=annotation_raw,
            response_payload={},
        )
    )
    return result["canonical_payload"]["normalized"]


@pytest.mark.parametrize(
    ("markdown", "annotation_raw", "expected_desired_position"),
    [
        (
            "JANE DOE | Product Designer | jane@example.com | +1 555 000 1234\n",
            {
                "identity": {"name": "Jane Doe"},
                "contact": {"email": "jane@example.com", "phone": "+1 555 000 1234"},
            },
            "Product Designer",
        ),
        (
            "JANE DOE\nPARIS, FR\nProduct Designer\njane@example.com\n",
            {
                "identity": {"name": "Jane Doe"},
                "contact": {"email": "jane@example.com", "address": "Paris, FR"},
            },
            "Product Designer",
        ),
        (
            "JANE DOE\nPRODUCT DESIGNER BROOKLYN, NY 11201\n+1 555 000 1234\n",
            {
                "identity": {"name": "Jane Doe"},
                "contact": {"phone": "+1 555 000 1234", "address": "Brooklyn, NY 11201"},
            },
            "Product Designer",
        ),
        (
            "JANE DOE SENIOR PRODUCT DESIGNER jane@example.com +1 555 000 1234\n",
            {
                "identity": {"name": "Jane Doe"},
                "contact": {"email": "jane@example.com", "phone": "+1 555 000 1234"},
            },
            "Senior Product Designer",
        ),
        (
            "JANE DOE\nSENIOR PRODUCT DESIGNER\nLOS ANGELES, CA 90210\n",
            {
                "identity": {"name": "Jane Doe"},
                "contact": {"address": "Los Angeles, CA 90210"},
            },
            "Senior Product Designer",
        ),
        (
            "LINDA MARVEL\nNew Teacher\n+1-270-447-1323\nIrvine, CA\nlindamarvel@gmail.com\n",
            {
                "identity": {"name": "Linda Marvel"},
                "contact": {
                    "phone": "+1-270-447-1323",
                    "address": "Irvine, CA",
                    "email": "lindamarvel@gmail.com",
                },
            },
            "New Teacher",
        ),
    ],
    ids=[
        "name-title-contact",
        "name-location-title",
        "uppercase-title-with-zip-location",
        "title-embedded-in-noisy-line",
        "uppercase-header-variant",
        "linda-header-title-with-address",
    ],
)
def test_run_resume_pipeline_from_ocr_result_recovers_desired_position_from_structural_header_patterns(
    markdown: str,
    annotation_raw: dict[str, Any],
    expected_desired_position: str,
) -> None:
    normalized_payload = _run_desired_position_header_case(
        markdown=markdown,
        annotation_raw=annotation_raw,
    )

    assert normalized_payload["identitySchema"]["desiredPosition"] == expected_desired_position
    assert normalized_payload["profile"]["desiredPosition"] == expected_desired_position


def test_run_resume_pipeline_from_ocr_result_keeps_linda_contact_address_while_recovering_header_title() -> None:
    normalized_payload = _run_desired_position_header_case(
        markdown=(
            "LINDA MARVEL\n"
            "New Teacher\n"
            "+1-270-447-1323\n"
            "Irvine, CA\n"
            "lindamarvel@gmail.com\n"
        ),
        annotation_raw={
            "identity": {"name": "Linda Marvel"},
            "contact": {
                "phone": "+1-270-447-1323",
                "address": "Irvine, CA",
                "email": "lindamarvel@gmail.com",
            },
        },
        document_name="lindamarvel.png",
    )

    assert normalized_payload["identitySchema"]["desiredPosition"] == "New Teacher"
    assert normalized_payload["contact"]["addressBlock"] == "Irvine, CA"
    assert normalized_payload["contact"]["addressNormalized"] == "Irvine, CA"
    assert normalized_payload["contact"]["location"] == "Irvine, CA"
    assert normalized_payload["profile"]["location"] == "Irvine, CA"


@pytest.mark.parametrize(
    ("markdown", "annotation_raw"),
    [
        (
            "JANE DOE\njane@example.com\n+1 555 000 1234\nBROOKLYN, NY 11201\n",
            {
                "identity": {"name": "Jane Doe"},
                "contact": {
                    "email": "jane@example.com",
                    "phone": "+1 555 000 1234",
                    "address": "Brooklyn, NY 11201",
                },
            },
        ),
        (
            "JANE DOE\nDETAILS PROFILE\njane@example.com\n",
            {
                "identity": {"name": "Jane Doe"},
                "contact": {"email": "jane@example.com"},
            },
        ),
        (
            "ACME CORP\nSAN FRANCISCO, CA\njane@example.com\n",
            {
                "identity": {"name": "Jane Doe"},
                "contact": {"email": "jane@example.com", "address": "San Francisco, CA"},
            },
        ),
        (
            "JANICE WALTON PHONE | janice@example.com\n",
            {
                "identity": {"name": "Janice Walton"},
                "contact": {"email": "janice@example.com"},
            },
        ),
        (
            "JANE DOE\nAvailable Immediately\njane@example.com\n",
            {
                "identity": {"name": "Jane Doe"},
                "contact": {"email": "jane@example.com"},
            },
        ),
    ],
    ids=[
        "no-title-in-header",
        "section-heading-must-not-become-title",
        "company-first-header-must-not-produce-junk",
        "name-prefixed-noisy-header-must-not-produce-name-title",
        "header-without-title-signal-returns-null",
    ],
)
def test_run_resume_pipeline_from_ocr_result_does_not_recover_desired_position_from_invalid_header_patterns(
    markdown: str,
    annotation_raw: dict[str, Any],
) -> None:
    normalized_payload = _run_desired_position_header_case(
        markdown=markdown,
        annotation_raw=annotation_raw,
    )

    assert "desiredPosition" not in normalized_payload["identitySchema"]
    assert normalized_payload["profile"]["desiredPosition"] is None


def test_run_resume_pipeline_from_bytes_recovers_explicit_languages_and_skills_without_retry(monkeypatch) -> None:
    call_count = 0

    def fake_annotated_ocr_from_bytes(**_: object) -> OCRAnnotationResult:
        nonlocal call_count
        call_count += 1
        return _build_fixture_ocr_result("cv_surname_en_case.json")

    monkeypatch.setattr(
        "cv_parser_service.mistral_resume_v3.pipeline.run_annotated_ocr_from_bytes",
        fake_annotated_ocr_from_bytes,
    )

    result = run_resume_pipeline_from_bytes(
        file_name="cv_surname-en.pdf",
        content_type="application/pdf",
        data=b"fake-pdf",
        api_key="test-key",
        model_name="mistral-ocr-latest",
    )

    assert call_count == 1
    assert result["fallback_to_legacy"] is False
    assert result["status"] == "success"
    normalized_payload = result["canonical_payload"]["normalized"]
    assert normalized_payload["name"] == "Name Surname"
    assert normalized_payload["summary"]["text"] == ""
    assert [item["name"] for item in normalized_payload["languages"]] == ["English", "Portuguese"]
    assert normalized_payload["languagesRaw"] == [
        "English — Good command",
        "Portuguese — Native speaker",
    ]
    assert [item["name"] for item in normalized_payload["skills"]] == [
        "Python",
        "Node.js",
        "REST APIs",
        "React",
        "TypeScript",
        "AWS",
        "Docker",
    ]

    diagnostics = result["diagnostics"]
    assert diagnostics["sectionRecovery"]["languages"]["applied"] is True
    assert diagnostics["sectionRecovery"]["languages"]["heading"] == "Languages"
    assert diagnostics["sectionRecovery"]["languages"]["source"] == "ocr_markdown"
    assert diagnostics["sectionRecovery"]["languages"]["reason"] is not None
    assert diagnostics["sectionRecovery"]["skills"]["applied"] is True
    assert diagnostics["sectionRecovery"]["skills"]["heading"] == "Areas of expertise"
    assert diagnostics["sectionRecovery"]["skills"]["source"] == "ocr_markdown"
    assert diagnostics["sectionRecovery"]["skills"]["reason"] is not None
    assert diagnostics["annotationRetry"]["attempted"] is False
    assert diagnostics["annotationRetry"]["count"] == 0
    assert diagnostics["annotationRetry"]["reason"] is None
    assert diagnostics["parsingQuality"] == {
        "has_languages_section": True,
        "languages_extracted": True,
        "languages_success": True,
        "has_skills_section": True,
        "skills_extracted": True,
        "skills_success": True,
        "recovery_used": True,
        "retry_used": False,
        "error_type": None,
        "hard_failure": False,
    }
    assert result["canonical_payload"]["diagnostics"]["sectionRecovery"] == diagnostics["sectionRecovery"]
    assert result["canonical_payload"]["diagnostics"]["annotationRetry"] == diagnostics["annotationRetry"]
    assert result["canonical_payload"]["diagnostics"]["parsingQuality"] == diagnostics["parsingQuality"]


def test_run_resume_pipeline_from_ocr_result_recovers_polluted_languages_without_overwriting_sane_skills() -> None:
    fixture = _load_mistral_resume_v3_fixture("cv_surname_en_case.json")
    annotation_raw = json.loads(json.dumps(fixture["annotation_raw"]))
    annotation_raw["languages"] = [
        {
            "name": (
                "English: Good command Portuguese: Native speaker "
                "Areas of expertise Programming Languages: C# Javascript Frameworks: .Net Process: Agile"
            )
        }
    ]
    annotation_raw["skills"] = [
        {"name": "Python"},
        {"name": "Node.js"},
        {"name": "REST APIs"},
        {"name": "React"},
        {"name": "TypeScript"},
        {"name": "AWS"},
        {"name": "Docker"},
    ]

    result = _run_resume_pipeline_from_ocr_result(
        _build_fixture_ocr_result("cv_surname_en_case.json", annotation_raw=annotation_raw)
    )

    assert result["fallback_to_legacy"] is False
    assert result["status"] == "success"
    normalized_payload = result["canonical_payload"]["normalized"]
    assert normalized_payload["languagesRaw"] == [
        "English — Good command",
        "Portuguese — Native speaker",
    ]
    assert [item["name"] for item in normalized_payload["skills"]] == [
        "Python",
        "Node.js",
        "REST APIs",
        "React",
        "TypeScript",
        "AWS",
        "Docker",
    ]

    diagnostics = result["diagnostics"]["sectionRecovery"]
    assert diagnostics["languages"]["applied"] is True
    assert diagnostics["languages"]["reason"] is not None
    assert diagnostics["skills"]["applied"] is False
    assert diagnostics["skills"]["reason"] is not None


def test_run_resume_pipeline_from_ocr_result_recovers_46_atomic_skills_from_grouped_expertise_markdown() -> None:
    expected_skills = [
        "C#",
        "Javascript",
        "Typescript",
        "C++",
        "C",
        "Java",
        "Python",
        "HTML",
        "CSS",
        ".Net",
        "ASP.NET Core",
        "Entity Framework",
        "Node.js",
        "React",
        "Angular",
        "Vue.js",
        "Express",
        "FastAPI",
        "Django",
        "AWS",
        "Docker",
        "Kubernetes",
        "Terraform",
        "Azure DevOps",
        "GitHub Actions",
        "Jenkins",
        "Linux",
        "Nginx",
        "PostgreSQL",
        "MySQL",
        "SQL Server",
        "MongoDB",
        "Redis",
        "xUnit",
        "NUnit",
        "Jest",
        "Playwright",
        "Cypress",
        "Agile",
        "Scrum",
        "Kanban",
        "TDD",
        "CI/CD",
        "Microservices",
        "REST APIs",
        "System Design",
    ]
    markdown = (
        "Name Surname | Software Engineer\n"
        "City - Country\n"
        "name.surname@example.com\n\n"
        "Languages\n"
        "English: Good command\n"
        "Portuguese: Native speaker\n\n"
        "Areas of expertise\n"
        "Programming Languages: C#, Javascript, Typescript, C++, C, Java, Python, HTML, CSS\n"
        "Frameworks: .Net, ASP.NET Core, Entity Framework, Node.js, React, Angular, Vue.js, Express, FastAPI, Django\n"
        "Cloud & DevOps: AWS, Docker, Kubernetes, Terraform, Azure DevOps, GitHub Actions, Jenkins, Linux, Nginx\n"
        "Databases: PostgreSQL, MySQL, SQL Server, MongoDB, Redis\n"
        "Testing: xUnit, NUnit, Jest, Playwright, Cypress\n"
        "Process: Agile, Scrum, Kanban, TDD, CI/CD, Microservices, REST APIs, System Design\n\n"
        "Experience\n"
        "Example Systems | Software Engineer | 2021 - Present\n"
        "- Built backend APIs.\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "expertise-recovery.pdf",
            },
            annotation_raw={
                "identity": {
                    "name": "Name Surname",
                    "location": "City - Country",
                    "desiredPosition": "Software Engineer",
                },
                "contact": {"email": "name.surname@example.com"},
                "summary": {"text": None},
                "languages": [],
                "skills": [],
                "experience": [
                    {
                        "company": "Example Systems",
                        "position": "Software Engineer",
                        "startDate": "2021",
                        "endDate": "Present",
                        "isCurrent": True,
                        "responsibilityBullets": ["Built backend APIs."],
                    }
                ],
                "sectionOrder": [
                    {"family": "languages", "ordinal": 0, "title": "Languages"},
                    {"family": "skills", "ordinal": 0, "title": "Areas of expertise"},
                    {"family": "experience", "ordinal": 0, "title": "Experience"},
                ],
            },
            response_payload={},
        )
    )

    assert result["fallback_to_legacy"] is False
    assert result["status"] == "success"
    normalized_payload = result["canonical_payload"]["normalized"]
    assert [item["name"] for item in normalized_payload["skills"]] == expected_skills
    assert len(normalized_payload["skills"]) == 46
    assert [item["name"] for item in normalized_payload["languages"]] == ["English", "Portuguese"]
    assert result["diagnostics"]["sectionRecovery"]["skills"]["applied"] is True
    assert result["diagnostics"]["sectionRecovery"]["skills"]["heading"] == "Areas of expertise"


def test_run_resume_pipeline_from_ocr_result_rejects_fused_recovered_languages_after_second_validation() -> None:
    markdown = (
        "Name Surname | Software Engineer\n"
        "City - Country\n"
        "name.surname@example.com\n\n"
        "Languages\n"
        "English: Good command Portuguese: Native speaker\n\n"
        "Areas of expertise\n"
        "Backend: Python, Node.js\n\n"
        "Experience\n"
        "Example Systems | Software Engineer | 2021 - Present\n"
        "- Built backend APIs.\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "fused-languages.pdf",
            },
            annotation_raw={
                "identity": {
                    "name": "Name Surname",
                    "location": "City - Country",
                    "desiredPosition": "Software Engineer",
                },
                "contact": {"email": "name.surname@example.com"},
                "summary": {"text": None},
                "languages": [],
                "skills": [],
                "experience": [
                    {
                        "company": "Example Systems",
                        "position": "Software Engineer",
                        "startDate": "2021",
                        "endDate": "Present",
                        "isCurrent": True,
                        "responsibilityBullets": ["Built backend APIs."],
                    }
                ],
                "sectionOrder": [
                    {"family": "languages", "ordinal": 0, "title": "Languages"},
                    {"family": "skills", "ordinal": 0, "title": "Areas of expertise"},
                    {"family": "experience", "ordinal": 0, "title": "Experience"},
                ],
            },
            response_payload={},
        )
    )

    assert result["fallback_to_legacy"] is True
    assert result["status"] == "failed"
    assert result["stage"] == "section_recovery"
    assert result["errorType"] == "section_evidence_contradiction"
    diagnostics = result["diagnostics"]
    assert diagnostics["sectionRecovery"]["languages"]["applied"] is True
    assert diagnostics["sectionRecovery"]["languages"]["reason"] is not None
    assert diagnostics["annotationRetry"]["eligible"] is True
    assert diagnostics["annotationRetry"]["attempted"] is False


def test_run_resume_pipeline_from_ocr_result_does_not_recover_skills_from_core_competencies_heading() -> None:
    markdown = (
        "Name Surname | Software Engineer\n"
        "City - Country\n"
        "name.surname@example.com\n\n"
        "Core competencies\n"
        "Backend: Python, Node.js\n"
        "Frontend: React, TypeScript\n\n"
        "Experience\n"
        "Example Systems | Software Engineer | 2021 - Present\n"
        "- Built backend APIs.\n"
    )
    result = _run_resume_pipeline_from_ocr_result(
        OCRAnnotationResult(
            pages=[{"index": 0, "markdown": markdown}],
            page_count=1,
            diagnostics={
                "model": "mistral-ocr-latest",
                "page_count": 1,
                "pages": 1,
                "ocr_chars": len(markdown),
                "document_name": "core-competencies.pdf",
            },
            annotation_raw={
                "identity": {
                    "name": "Name Surname",
                    "location": "City - Country",
                    "desiredPosition": "Software Engineer",
                },
                "contact": {"email": "name.surname@example.com"},
                "summary": {"text": None},
                "skills": [],
                "experience": [
                    {
                        "company": "Example Systems",
                        "position": "Software Engineer",
                        "startDate": "2021",
                        "endDate": "Present",
                        "isCurrent": True,
                        "responsibilityBullets": ["Built backend APIs."],
                    }
                ],
                "sectionOrder": [
                    {"family": "skills", "ordinal": 0, "title": "Core competencies"},
                    {"family": "experience", "ordinal": 0, "title": "Experience"},
                ],
            },
            response_payload={},
        )
    )

    assert result["fallback_to_legacy"] is True
    assert result["status"] == "failed"
    assert result["stage"] == "section_recovery"
    assert result["errorType"] == "section_evidence_contradiction"
    diagnostics = result["diagnostics"]
    assert diagnostics["sectionRecovery"]["skills"]["applied"] is False
    assert diagnostics["sectionRecovery"]["skills"]["heading"] == "Core competencies"
    assert diagnostics["annotationRetry"]["eligible"] is True
    assert diagnostics["annotationRetry"]["attempted"] is False


def test_run_resume_pipeline_from_bytes_retries_once_after_section_recovery_contradiction(monkeypatch) -> None:
    call_count = 0

    def fake_annotated_ocr_from_bytes(**_: object) -> OCRAnnotationResult:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _build_retry_contradiction_result()
        return _build_fixture_ocr_result("cv_surname_en_case.json")

    monkeypatch.setattr(
        "cv_parser_service.mistral_resume_v3.pipeline.run_annotated_ocr_from_bytes",
        fake_annotated_ocr_from_bytes,
    )

    result = run_resume_pipeline_from_bytes(
        file_name="retry-contradiction.pdf",
        content_type="application/pdf",
        data=b"fake-pdf",
        api_key="test-key",
        model_name="mistral-ocr-latest",
    )

    assert call_count == 2
    assert result["fallback_to_legacy"] is False
    assert [item["name"] for item in result["canonical_payload"]["normalized"]["languages"]] == ["English", "Portuguese"]
    retry_diagnostics = result["diagnostics"]["annotationRetry"]
    assert retry_diagnostics["attempted"] is True
    assert retry_diagnostics["count"] == 1
    assert retry_diagnostics["reason"] == "section_evidence_contradiction"
    assert result["canonical_payload"]["diagnostics"]["annotationRetry"] == retry_diagnostics
    assert result["diagnostics"]["parsingQuality"] == {
        "has_languages_section": True,
        "languages_extracted": True,
        "languages_success": True,
        "has_skills_section": True,
        "skills_extracted": True,
        "skills_success": True,
        "recovery_used": True,
        "retry_used": True,
        "error_type": None,
        "hard_failure": False,
    }
    assert result["canonical_payload"]["diagnostics"]["parsingQuality"] == result["diagnostics"]["parsingQuality"]


def test_run_resume_pipeline_from_bytes_retries_once_after_second_validation_rejects_invalid_recovered_languages(
    monkeypatch,
) -> None:
    call_count = 0
    first_result = OCRAnnotationResult(
        pages=[
            {
                "index": 0,
                "markdown": (
                    "Name Surname | Software Engineer\n"
                    "City - Country\n"
                    "name.surname@example.com\n\n"
                    "Languages\n"
                    "English: Good command Portuguese: Native speaker\n\n"
                    "Areas of expertise\n"
                    "Backend: Python, Node.js\n\n"
                    "Experience\n"
                    "Example Systems | Software Engineer | 2021 - Present\n"
                    "- Built backend APIs.\n"
                ),
            }
        ],
        page_count=1,
        diagnostics={
            "model": "mistral-ocr-latest",
            "page_count": 1,
            "pages": 1,
            "ocr_chars": 257,
            "document_name": "invalid-recovered-languages.pdf",
        },
        annotation_raw={
            "identity": {
                "name": "Name Surname",
                "location": "City - Country",
                "desiredPosition": "Software Engineer",
            },
            "contact": {"email": "name.surname@example.com"},
            "summary": {"text": None},
            "languages": [],
            "skills": [],
            "experience": [
                {
                    "company": "Example Systems",
                    "position": "Software Engineer",
                    "startDate": "2021",
                    "endDate": "Present",
                    "isCurrent": True,
                    "responsibilityBullets": ["Built backend APIs."],
                }
            ],
            "sectionOrder": [
                {"family": "languages", "ordinal": 0, "title": "Languages"},
                {"family": "skills", "ordinal": 0, "title": "Areas of expertise"},
                {"family": "experience", "ordinal": 0, "title": "Experience"},
            ],
        },
        response_payload={},
    )

    def fake_annotated_ocr_from_bytes(**_: object) -> OCRAnnotationResult:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return first_result
        return _build_fixture_ocr_result("cv_surname_en_case.json")

    monkeypatch.setattr(
        "cv_parser_service.mistral_resume_v3.pipeline.run_annotated_ocr_from_bytes",
        fake_annotated_ocr_from_bytes,
    )

    result = run_resume_pipeline_from_bytes(
        file_name="invalid-recovered-languages.pdf",
        content_type="application/pdf",
        data=b"fake-pdf",
        api_key="test-key",
        model_name="mistral-ocr-latest",
    )

    assert call_count == 2
    assert result["fallback_to_legacy"] is False
    assert [item["name"] for item in result["canonical_payload"]["normalized"]["languages"]] == ["English", "Portuguese"]
    retry_diagnostics = result["diagnostics"]["annotationRetry"]
    assert retry_diagnostics["attempted"] is True
    assert retry_diagnostics["count"] == 1
    assert retry_diagnostics["reason"] == "section_evidence_contradiction"


def test_run_resume_pipeline_from_bytes_returns_fallback_after_retry_exhausts_section_contradiction(monkeypatch) -> None:
    call_count = 0

    def fake_annotated_ocr_from_bytes(**_: object) -> OCRAnnotationResult:
        nonlocal call_count
        call_count += 1
        return _build_retry_contradiction_result()

    monkeypatch.setattr(
        "cv_parser_service.mistral_resume_v3.pipeline.run_annotated_ocr_from_bytes",
        fake_annotated_ocr_from_bytes,
    )

    result = run_resume_pipeline_from_bytes(
        file_name="retry-contradiction.pdf",
        content_type="application/pdf",
        data=b"fake-pdf",
        api_key="test-key",
        model_name="mistral-ocr-latest",
    )

    assert call_count == 2
    assert result["fallback_to_legacy"] is True
    assert result["status"] == "failed"
    assert result["stage"] == "section_recovery"
    assert result["errorType"] == "section_evidence_contradiction"
    assert "canonical_payload" not in result
    diagnostics = result["diagnostics"]
    assert diagnostics["sectionRecovery"]["languages"]["heading"] == "Languages"
    assert diagnostics["sectionRecovery"]["skills"]["heading"] == "Areas of expertise"
    assert diagnostics["annotationRetry"]["attempted"] is True
    assert diagnostics["annotationRetry"]["count"] == 1
    assert diagnostics["annotationRetry"]["reason"] == "section_evidence_contradiction"
    assert diagnostics["parsingQuality"] == {
        "has_languages_section": True,
        "languages_extracted": False,
        "languages_success": False,
        "has_skills_section": True,
        "skills_extracted": False,
        "skills_success": False,
        "recovery_used": True,
        "retry_used": True,
        "error_type": "section_evidence_contradiction",
        "hard_failure": True,
    }


def test_v3_payload_preserves_supported_and_generic_sections() -> None:
    extraction = parse_document_annotation(
        {
            "identity": {"name": "Jane Example", "location": "Paris, France"},
            "contact": {"email": "jane@example.com"},
            "summary": {"text": "Product designer with multilingual experience."},
            "skills": [{"name": "Figma"}],
            "languages": [{"name": "French", "levelRaw": "Native"}],
            "hobbies": ["Climbing", "Chess"],
            "publications": [
                {
                    "title": "Designing collaborative interfaces",
                    "venue": "UX Journal",
                    "date": "2024",
                    "details": ["Lead author"],
                }
            ],
            "otherSections": [
                {
                    "title": "Community",
                    "content": "Mentor, Women in Product",
                }
            ],
            "sectionOrder": [
                {"family": "publications", "ordinal": 0, "title": "Publications"},
                {"family": "hobbies", "ordinal": 0, "title": "Interests"},
                {"family": "other", "ordinal": 0, "title": "Community"},
            ],
        }
    )
    normalized = normalize_extraction(
        extraction,
        raw_text="Jane Example\nParis, France\njane@example.com",
        page_count=1,
        document_name="jane_example.pdf",
    )
    payload = build_canonical_payload(normalized)

    app_sections = payload["appDocument"]["sections"]
    section_titles = [section["title"] for section in app_sections]
    assert "Publications" in section_titles
    assert "Interests" in section_titles
    assert "Community" in section_titles

    assert payload["normalized"]["publications"][0]["title"] == "Designing collaborative interfaces"
    assert payload["normalized"]["hobbies"] == [{"text": "Climbing"}, {"text": "Chess"}]
    assert payload["normalized"]["sectionOrder"] == [
        {"family": "publications", "ordinal": 0, "title": "Publications"},
        {"family": "hobbies", "ordinal": 0, "title": "Interests"},
        {"family": "other", "ordinal": 0, "title": "Community"},
    ]


def test_canonicalize_cv_passthroughs_precomputed_v3_payload() -> None:
    precomputed_payload = {
        "rawText": "Jane Example",
        "normalized": {
            "rawText": "Jane Example",
            "raw": "Jane Example",
            "summary": {"text": "Jane Example", "confidence": 0.9},
            "sections": [
                {
                    "id": "sec-publications",
                    "title": "Publications",
                    "type": "text",
                    "blocks": [],
                    "structuredContent": None,
                }
            ],
        },
        "rawSections": [{"label": "Publications", "content": "Paper A"}],
        "summary": {"text": "Jane Example", "confidence": 0.9},
        "summaryFirstSentence": "Jane Example",
        "diagnostics": {"mistral_parser_status": "success"},
    }

    result = canonicalize_cv(
        "ignored",
        mode="text",
        diagnostics={
            INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY: precomputed_payload,
            "ocr_engine": "mistral",
        },
        raw_sections=[{"label": "BODY", "content": "ignored"}],
    )

    assert result["normalized"]["sections"][0]["title"] == "Publications"
    assert result["diagnostics"]["ocr_engine"] == "mistral"
    assert INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY not in result["diagnostics"]


def test_normalize_extraction_reclassifies_certification_like_education_entries_conservatively() -> None:
    extraction = parse_document_annotation(
        {
            "education": [
                {
                    "institution": "Security Training School",
                    "degree": "Certified Protection Officer",
                    "details": ["Executive protection program"],
                }
            ],
            "certifications": [
                {
                    "name": "Certified Protection Officer",
                    "issuer": "Security Training School",
                    "date": "2020",
                },
                {
                    "name": "Bachelor of Criminal Justice",
                    "issuer": "State University",
                    "date": "2018",
                },
                {
                    "name": "Certified Security Professional",
                    "issuer": "Defence School",
                    "date": "2021",
                },
            ],
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="Security Training School",
        page_count=1,
        document_name="security_training_mix.pdf",
    )

    assert len(normalized.education) == 1
    assert normalized.education[0].degree == "Bachelor of Criminal Justice"
    assert normalized.education[0].institution == "State University"

    certification_names = [item.name for item in normalized.certifications]
    assert certification_names == [
        "Certified Protection Officer",
        "Certified Security Professional",
    ]


def test_normalize_extraction_moves_narrative_achievement_into_experience_description() -> None:
    extraction = parse_document_annotation(
        {
            "experience": [
                {
                    "company": "Executive Security Team",
                    "position": "Security Guard",
                    "responsibilityBullets": [
                        "Observed surroundings and immediate settings for possible threats."
                    ],
                    "achievements": [
                        "Safety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors.",
                        "Awarded Employee of the Month",
                    ],
                }
            ]
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="Robert Cooper",
        page_count=1,
        document_name="robertcooper.pdf",
    )

    experience = normalized.experience[0]
    assert experience.description == (
        "Safety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP "
        "individuals in the military and defense sectors."
    )
    assert experience.achievements == ["Awarded Employee of the Month"]
    assert experience.responsibilityBullets == [
        "Observed surroundings and immediate settings for possible threats."
    ]


def test_normalize_extraction_preserves_experience_description_and_bullets_structure() -> None:
    extraction = parse_document_annotation(
        {
            "experience": [
                {
                    "company": "Northline",
                    "position": "Analyst",
                    "description": "Opened with narrative prose only.",
                },
                {
                    "company": "Northline",
                    "position": "Operator",
                    "responsibilityBullets": ["Built reporting tooling", "Reduced review latency"],
                },
                {
                    "company": "Northline",
                    "position": "Lead",
                    "description": "Introduced the role with narrative prose.",
                    "responsibilityBullets": ["Launched the operating cadence", "Mentored new hires"],
                },
            ]
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="Northline",
        page_count=1,
        document_name="northline.pdf",
    )

    assert normalized.experience[0].description == "Opened with narrative prose only."
    assert normalized.experience[0].responsibilityBullets == []
    assert normalized.experience[1].description is None
    assert normalized.experience[1].responsibilityBullets == [
        "Built reporting tooling",
        "Reduced review latency",
    ]
    assert normalized.experience[2].description == "Introduced the role with narrative prose."
    assert normalized.experience[2].responsibilityBullets == [
        "Launched the operating cadence",
        "Mentored new hires",
    ]


def test_normalize_extraction_keeps_helen_noisy_but_explicit_email() -> None:
    extraction = parse_document_annotation(
        {
            "contact": {
                "email": "f hellenketter@gmail.com",
            }
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="HELEN D. KETTER\nf hellenketter@gmail.com",
        page_count=1,
        document_name="helenketter.jpg",
    )

    assert normalized.contact.email == "hellenketter@gmail.com"


def test_normalize_extraction_maps_helen_social_links_conservatively() -> None:
    extraction = parse_document_annotation(
        {
            "contact": {
                "linkedin": "instagram.com/_hellenk_",
                "website": "www.enhancv.com",
            }
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="HELEN D. KETTER\ninstagram.com/_hellenk_\nwww.enhancv.com",
        page_count=1,
        document_name="helenketter.jpg",
    )

    assert normalized.contact.linkedin is None
    assert normalized.contact.website is None
    assert normalized.contact.portfolio == "https://instagram.com/_hellenk_"


def test_normalize_extraction_keeps_desired_position_without_backfilling_summary() -> None:
    extraction = parse_document_annotation(
        {
            "identity": {
                "desiredPosition": "Fashion writer turned designer",
            }
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="HELEN D. KETTER\nFashion writer turned designer",
        page_count=1,
        document_name="helenketter.jpg",
    )
    payload = build_canonical_payload(normalized)

    assert normalized.summary.text is None
    assert normalized.identity.desiredPosition == "Fashion writer turned designer"
    assert payload["normalized"]["identitySchema"]["desiredPosition"] == "Fashion writer turned designer"
    assert payload["normalized"]["profile"]["desiredPosition"] == "Fashion writer turned designer"
    profile_section = next(section for section in payload["appDocument"]["sections"] if section["type"] == "profile")
    assert profile_section["structuredContent"][0]["desiredPosition"] == "Fashion writer turned designer"


@pytest.mark.parametrize(
    "desired_position",
    [
        "1515 Pacific Ave",
        "Pacific Ave",
        "Old Forge, New York",
        "United States",
    ],
)
def test_normalize_extraction_drops_invalid_desired_position_contact_noise(desired_position: str) -> None:
    extraction = parse_document_annotation(
        {
            "identity": {
                "desiredPosition": desired_position,
            },
            "contact": {
                "address": "1515 Pacific Ave, Old Forge, New York, 13420, United States",
            },
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="Jordan Example\n1515 Pacific Ave, Old Forge, New York, 13420\nUnited States\njordan@example.com\n",
        page_count=1,
        document_name="jordan_example.pdf",
    )
    payload = build_canonical_payload(normalized)

    assert normalized.identity.desiredPosition is None
    assert normalized.summary.text is None
    assert "desiredPosition" not in payload["normalized"]["identitySchema"]
    assert payload["normalized"]["profile"]["desiredPosition"] is None
    assert "desired_position_dropped" in [warning.code for warning in normalized.warnings]


def test_build_canonical_payload_preserves_explicit_achievements_with_non_exhaustive_section_order() -> None:
    extraction = parse_document_annotation(
        {
            "summary": {"text": "Security specialist with incident response experience."},
            "skills": [{"name": "Threat assessment"}],
            "achievements": [
                "Protected 50+ high-profile events without incident.",
                "Reduced unauthorized entry by 70% through access-control updates.",
            ],
            "sectionOrder": [
                {"family": "achievements", "ordinal": 0, "title": "ACHIEVEMENTS"},
            ],
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text=(
            "ACHIEVEMENTS\n"
            "Protected 50+ high-profile events without incident.\n"
            "Reduced unauthorized entry by 70% through access-control updates.\n"
        ),
        page_count=1,
        document_name="security_profile.pdf",
    )
    payload = build_canonical_payload(normalized)

    assert payload["normalized"]["sectionOrder"] == [
        {"family": "achievements", "ordinal": 0, "title": "ACHIEVEMENTS"}
    ]
    assert payload["normalized"]["achievements"] == [
        {"text": "Protected 50+ high-profile events without incident."},
        {"text": "Reduced unauthorized entry by 70% through access-control updates."},
    ]
    assert payload["rawSections"][0]["fieldKey"] == "achievements"
    assert payload["rawSections"][0]["content"] == (
        "Protected 50+ high-profile events without incident.\n"
        "Reduced unauthorized entry by 70% through access-control updates."
    )
    achievement_section = next(
        section for section in payload["appDocument"]["sections"] if section["type"] == "achievements"
    )
    assert [item["text"] for item in achievement_section["structuredContent"]] == [
        "Protected 50+ high-profile events without incident.",
        "Reduced unauthorized entry by 70% through access-control updates.",
    ]
    assert any(section["type"] == "summary" for section in payload["appDocument"]["sections"])
    assert any(section["type"] == "skills" for section in payload["appDocument"]["sections"])


def test_normalize_extraction_recovers_global_section_positions_into_family_ordinals() -> None:
    extraction = parse_document_annotation(
        {
            "identity": {"name": "Robert Cooper"},
            "summary": {"text": "Security guard with executive protection experience."},
            "skills": [{"name": "Investigation skills"}],
            "languages": [{"name": "English"}],
            "experience": [
                {
                    "company": "ADT Security",
                    "position": "Security Guard",
                    "responsibilityBullets": ["Protected VIP principals"],
                }
            ],
            "education": [
                {
                    "institution": "International Foundation for Protection Guards",
                    "fieldOfStudy": "Certified Protection Guard Program (CPOP)",
                }
            ],
            "hobbies": ["Running, Mtb, Enduro"],
            "otherSections": [
                {"title": "DETAILS", "content": "1515 Pacific Ave"},
                {"title": "LINKS", "content": "LinkedIn\nPinterest"},
            ],
            "sectionOrder": [
                {"family": "profile", "ordinal": 0, "title": None},
                {"family": "skills", "ordinal": 1, "title": "SKILLS"},
                {"family": "languages", "ordinal": 2, "title": "LANGUAGES"},
                {"family": "summary", "ordinal": 3, "title": "PROFILE"},
                {"family": "experience", "ordinal": 4, "title": "EMPLOYMENT HISTORY"},
                {"family": "education", "ordinal": 5, "title": "EDUCATION"},
                {"family": "hobbies", "ordinal": 6, "title": "HOBBIES"},
                {"family": "other", "ordinal": 7, "title": "DETAILS"},
                {"family": "other", "ordinal": 8, "title": "LINKS"},
            ],
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="ROBERT COOPER\n1515 Pacific Ave\nLinkedIn\nPinterest",
        page_count=1,
        document_name="robertcooper.pdf",
    )
    payload = build_canonical_payload(normalized)

    assert payload["normalized"]["sectionOrder"] == [
        {"family": "profile", "ordinal": 0},
        {"family": "skills", "ordinal": 0, "title": "SKILLS"},
        {"family": "languages", "ordinal": 0, "title": "LANGUAGES"},
        {"family": "summary", "ordinal": 0, "title": "PROFILE"},
        {"family": "experience", "ordinal": 0, "title": "EMPLOYMENT HISTORY"},
        {"family": "education", "ordinal": 0, "title": "EDUCATION"},
        {"family": "hobbies", "ordinal": 0, "title": "HOBBIES"},
        {"family": "other", "ordinal": 0, "title": "DETAILS"},
        {"family": "other", "ordinal": 1, "title": "LINKS"},
    ]
    assert [section["title"] for section in payload["appDocument"]["sections"][:9]] == [
        "Profile",
        "Skills",
        "Languages",
        "Summary",
        "Experience",
        "Education",
        "HOBBIES",
        "DETAILS",
        "LINKS",
    ]


def test_normalize_extraction_preserves_supported_sections_and_source_order() -> None:
    extraction = parse_document_annotation(
        {
            "awards": [
                {"title": "Operator of the Year", "issuer": "Northline", "date": "2024"}
            ],
            "achievements": ["Delivered a 32% reduction in review time."],
            "hobbies": ["Chess", "Trail running"],
            "publications": [
                {"title": "Designing collaborative interfaces", "venue": "UX Journal", "date": "2024"}
            ],
            "volunteering": [
                {
                    "organization": "Women in Product",
                    "role": "Mentor",
                    "summary": "Mentored early-career product managers.",
                    "bullets": ["Ran monthly office hours"],
                }
            ],
            "affiliations": ["Product Leadership Council"],
            "additionalInformation": ["EU work authorization"],
            "otherSections": [{"title": "Patents", "content": "Collaborative editor patent pending"}],
            "sectionOrder": [
                {"family": "achievements", "ordinal": 0, "title": "Achievements"},
                {"family": "hobbies", "ordinal": 0, "title": "Interests"},
                {"family": "publications", "ordinal": 0, "title": "Publications"},
                {"family": "other", "ordinal": 0, "title": "Patents"},
                {"family": "affiliations", "ordinal": 0, "title": "Affiliations"},
                {"family": "additionalInformation", "ordinal": 0, "title": "Additional Information"},
            ],
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="Jane Example",
        page_count=1,
        document_name="jane_example.pdf",
    )
    payload = build_canonical_payload(normalized)

    assert normalized.achievements == ["Delivered a 32% reduction in review time."]
    assert normalized.hobbies == ["Chess", "Trail running"]
    assert normalized.awards[0].title == "Operator of the Year"
    assert normalized.publications[0].title == "Designing collaborative interfaces"
    assert normalized.volunteering[0].description == "Mentored early-career product managers."
    assert normalized.affiliations == ["Product Leadership Council"]
    assert normalized.additionalInformation == ["EU work authorization"]
    assert normalized.textSections[0].title == "Patents"
    assert [item.family for item in normalized.sectionOrder] == [
        "achievements",
        "hobbies",
        "publications",
        "other",
        "affiliations",
        "additionalInformation",
    ]
    assert [section["label"] for section in payload["rawSections"][:6]] == [
        "Achievements",
        "Interests",
        "Publications",
        "Patents",
        "Affiliations",
        "Additional Information",
    ]


def test_normalize_extraction_swaps_school_and_city_for_helen_style_education() -> None:
    extraction = parse_document_annotation(
        {
            "education": [
                {
                    "institution": "New York",
                    "degree": "Art & Design High School",
                    "details": ["GPA 3.9 / 4.0"],
                }
            ]
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="Helen Ketter",
        page_count=1,
        document_name="helenketter.jpg",
    )

    assert len(normalized.education) == 1
    assert normalized.education[0].institution == "Art & Design High School"
    assert normalized.education[0].location == "New York"
    assert normalized.education[0].degree is None


def test_normalize_extraction_drops_template_branding_and_address_noise_for_robertsmith() -> None:
    extraction = parse_document_annotation(
        {
            "identity": {
                "name": "ROBERT SMITH",
                "desiredPosition": "Lead Customer Advocate",
            },
            "contact": {
                "email": "info@qwikresume.com",
                "website": "Qwikresume.com",
                "phone": "(0123)-456-789",
            },
            "summary": {
                "text": (
                    "Cash handling accuracy Excellent multi-tasker Organized Friendly Dependable "
                    "Reliable Strong communication skills Punctual Flexible schedule Knowledge of MS office and POS."
                )
            },
            "education": [
                {
                    "institution": "2259 Oak Street, Old Forge, New York, 13420",
                }
            ],
            "otherSections": [
                {
                    "title": "© This Free Resume Template is the copyright of Qwikresume.com. Usage Guidelines",
                    "content": "© This Free Resume Template is the copyright of Qwikresume.com. Usage Guidelines",
                }
            ],
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text=(
            "ROBERT SMITH\n"
            "Lead Customer Advocate\n"
            "info@qwikresume.com\n"
            "2259 Oak Street, Old Forge, New York, 13420 This Free Resume Template is the copyright of "
            "Qwikresume.com. Usage Guidelines\n"
        ),
        page_count=1,
        document_name="robertsmith.jpg",
    )

    assert normalized.contact.email is None
    assert normalized.contact.website is None
    assert normalized.summary.text is None
    assert normalized.education == []
    assert normalized.textSections == []
    warning_codes = [warning.code for warning in normalized.warnings]
    assert "email_dropped" in warning_codes
    assert "link_dropped" in warning_codes
    assert "summary_dropped" in warning_codes
    assert "education_dropped" in warning_codes
    assert "text_section_dropped" in warning_codes


def test_normalize_extraction_keeps_explicit_summary_heading_content_for_robertsmith() -> None:
    extraction = parse_document_annotation(
        {
            "identity": {
                "name": "ROBERT SMITH",
                "desiredPosition": "Lead Customer Advocate",
            },
            "contact": {
                "email": "info@qwikresume.com",
                "website": "Qwikresume.com",
                "phone": "(0123)-456-789",
            },
            "summary": {
                "text": (
                    "Cash handling accuracy Excellent multi-tasker Organized Friendly Dependable "
                    "Reliable Strong communication skills Punctual Flexible schedule Knowledge of MS office and POS."
                )
            },
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text=(
            "# ROBERT SMITH\n\n"
            "## Lead Customer Advocate\n\n"
            "Phone: (0123)-456-789 | Email: info@qwikresume.com | Website: Qwikresume.com\n\n"
            "## SUMMARY\n\n"
            "Cash handling accuracy Excellent multi-tasker Organized Friendly Dependable "
            "Reliable Strong communication skills Punctual Flexible schedule Knowledge of MS office and POS.\n\n"
            "© This Free Resume Template is the copyright of Qwikresume.com. Usage Guidelines\n"
        ),
        page_count=1,
        document_name="robertsmith.jpg",
    )

    assert normalized.summary.text == (
        "Cash handling accuracy Excellent multi-tasker Organized Friendly Dependable "
        "Reliable Strong communication skills Punctual Flexible schedule Knowledge of MS office and POS."
    )
    warning_codes = [warning.code for warning in normalized.warnings]
    assert "summary_dropped" not in warning_codes


def test_normalize_extraction_keeps_explicit_anne_professional_links() -> None:
    extraction = parse_document_annotation(
        {
            "contact": {
                "linkedin": "linkedin.com/in/annelounsberry12",
                "github": "github.com/annecarollounsberry",
            }
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="Anne Lounsberry\nlinkedin.com/in/annelounsberry12\ngithub.com/annecarollounsberry",
        page_count=1,
        document_name="anne.png",
    )

    assert normalized.contact.linkedin == "https://linkedin.com/in/annelounsberry12"
    assert normalized.contact.github == "https://github.com/annecarollounsberry"
    assert normalized.contact.portfolio is None
