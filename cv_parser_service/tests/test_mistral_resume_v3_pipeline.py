from __future__ import annotations

from cv_parser.canonicalize import canonicalize_cv
from cv_parser_service.mistral_resume_v3 import INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY
from cv_parser_service.mistral_resume_v3.annotation_parser import parse_document_annotation
from cv_parser_service.mistral_resume_v3.app_mapper import build_canonical_payload
from cv_parser_service.mistral_resume_v3.extraction_schema import build_document_annotation_format
from cv_parser_service.mistral_resume_v3.ocr_client import OCRAnnotationResult
from cv_parser_service.mistral_resume_v3.pipeline import run_resume_pipeline_from_bytes
from cv_parser_service.mistral_resume_v3.post_validation import normalize_extraction


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
    def fake_annotated_ocr_from_bytes(**_: object) -> OCRAnnotationResult:
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
    diagnostics = result["diagnostics"]
    assert diagnostics["mistral_parser_status"] == "success"
    assert diagnostics["model"] == "mistral-ocr-latest"
    assert result["canonical_payload"]["normalized"]["name"] == "Robert Cooper"


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


def test_normalize_extraction_reclassifies_robert_like_education_and_certifications_conservatively() -> None:
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
        raw_text="Robert Cooper",
        page_count=1,
        document_name="robertcooper.pdf",
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


def test_normalize_extraction_uses_short_explicit_headline_as_summary_fallback() -> None:
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

    assert normalized.summary.text == "Fashion writer turned designer"


def test_normalize_extraction_drops_invalid_desired_position_contact_noise() -> None:
    extraction = parse_document_annotation(
        {
            "identity": {
                "desiredPosition": "2259 Oak Street, Old Forge, New York, 13420",
            }
        }
    )

    normalized = normalize_extraction(
        extraction,
        raw_text="ROBERT SMITH\n2259 Oak Street, Old Forge, New York, 13420\n",
        page_count=1,
        document_name="robertsmith.jpg",
    )

    assert normalized.identity.desiredPosition is None
    assert normalized.summary.text is None
    assert "desired_position_dropped" in [warning.code for warning in normalized.warnings]
    

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
    assert normalized.summary.text == "Lead Customer Advocate"
    assert normalized.education == []
    assert normalized.textSections == []
    warning_codes = [warning.code for warning in normalized.warnings]
    assert "email_dropped" in warning_codes
    assert "link_dropped" in warning_codes
    assert "summary_dropped" in warning_codes
    assert "education_dropped" in warning_codes
    assert "text_section_dropped" in warning_codes


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
