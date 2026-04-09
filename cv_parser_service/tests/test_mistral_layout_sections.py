from cv_parser_service.mistral_ocr import (
    derive_raw_sections_from_markdown_pages,
    should_use_ocr_raw_sections,
)


def test_derive_raw_sections_from_markdown_pages_preserves_heading_scoped_table_blocks() -> None:
    pages = [
        {
            "index": 0,
            "markdown": """
# Professional Summary
Security guard with strong observation skills.

## Experience
| Role | Company | Dates |
| --- | --- | --- |
| Security Guard | ADT Security | 2021-2022 |
| Patrol Officer | Safe Corp | 2019-2021 |

## Education
| Degree | Institution |
| --- | --- |
| CPOP | ASIS International |
""",
        }
    ]

    raw_sections, diagnostics = derive_raw_sections_from_markdown_pages(pages)

    assert [section["label"] for section in raw_sections] == ["SUMMARY", "EXPERIENCE", "EDUCATION"]
    assert "| Security Guard | ADT Security | 2021-2022 |" in raw_sections[1]["content"]
    assert "| CPOP | ASIS International |" in raw_sections[2]["content"]
    assert diagnostics["ocr_markdown_pages"] == 1
    assert diagnostics["ocr_markdown_headings"] == 3
    assert diagnostics["ocr_markdown_canonical_headings"] == 3
    assert diagnostics["ocr_markdown_table_rows"] == 3
    assert diagnostics["ocr_markdown_body_only"] is False


def test_derive_raw_sections_keeps_body_blocks_when_no_heading_exists() -> None:
    pages = [
        {
            "index": 0,
            "markdown": """
ROBERT COOPER
Security Guard
Los Angeles, CA 90291

| Skill | Level |
| --- | --- |
| Investigation | Advanced |
""",
        }
    ]

    raw_sections, diagnostics = derive_raw_sections_from_markdown_pages(pages)

    assert raw_sections[0]["label"] == "BODY"
    assert "ROBERT COOPER" in raw_sections[0]["content"]
    assert "| Skill | Level |" in raw_sections[0]["content"]
    assert diagnostics["ocr_markdown_table_rows"] == 1
    assert diagnostics["ocr_markdown_body_only"] is True


def test_derive_raw_sections_suppresses_nested_noncanonical_headings_as_boundaries() -> None:
    pages = [
        {
            "index": 0,
            "markdown": """
# Experience
## Cartier
Talent Acquisition Lead

## Chloé
Retail Talent Acquisition Manager

# Education
Master's degree
""",
        }
    ]

    raw_sections, diagnostics = derive_raw_sections_from_markdown_pages(pages)

    assert [section["label"] for section in raw_sections] == ["EXPERIENCE", "EDUCATION"]
    assert "Cartier" in raw_sections[0]["content"]
    assert "Chloé" in raw_sections[0]["content"]
    assert diagnostics["ocr_markdown_headings"] == 4
    assert diagnostics["ocr_markdown_canonical_headings"] == 2


def test_derive_raw_sections_recovers_plain_education_heading_when_followed_by_table() -> None:
    pages = [
        {
            "index": 0,
            "markdown": """
ACADEMIC QUALIFICATION:

| EXAM/DEGREE | YEAR | NAME OF INSTITUTION | UNIVERSITY/BOARD | PERCENTAGE % |
| --- | --- | --- | --- | --- |
| B.TECH | 2014 | Engineering and Technology | Jaipur National University | 67.4 |
| 12TH BOARD | 2011 | Kendriya Vidyalaya Mau | C.B.S.E Board | 71.4 |
""",
        }
    ]

    raw_sections, diagnostics = derive_raw_sections_from_markdown_pages(pages)

    assert [section["label"] for section in raw_sections] == ["EDUCATION"]
    assert "| EXAM/DEGREE | YEAR | NAME OF INSTITUTION | UNIVERSITY/BOARD | PERCENTAGE % |" in raw_sections[0]["content"]
    assert diagnostics["ocr_markdown_canonical_headings"] == 1


def test_should_use_ocr_raw_sections_skips_when_body_and_details_dominate() -> None:
    raw_sections = [
        {"label": "BODY", "content": "Header"},
        {"label": "BODY", "content": "More body"},
        {"label": "DETAILS", "content": "Address"},
        {"label": "EXPERIENCE", "content": "Experience rows"},
        {"label": "EDUCATION", "content": "Education rows"},
    ]
    decision, diagnostics = should_use_ocr_raw_sections(raw_sections, {"ocr_markdown_table_rows": 0})

    assert decision is False
    assert diagnostics["ocr_markdown_structural_section_count"] == 2
    assert diagnostics["ocr_markdown_noisy_section_count"] == 3
    assert diagnostics["ocr_markdown_use_raw_sections"] is False


def test_should_use_ocr_raw_sections_requires_structural_signal_and_allows_table_backed_sections() -> None:
    raw_sections = [
        {"label": "EXPERIENCE", "content": "| Role | Company |\n| Guard | ADT |"},
        {"label": "EDUCATION", "content": "| Degree | School |\n| CPOP | ASIS |"},
    ]
    decision, diagnostics = should_use_ocr_raw_sections(raw_sections, {"ocr_markdown_table_rows": 3})

    assert decision is True
    assert diagnostics["ocr_markdown_structural_distinct"] == ["EDUCATION", "EXPERIENCE"]
    assert diagnostics["ocr_markdown_noisy_share"] == 0.0
