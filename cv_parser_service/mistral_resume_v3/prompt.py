from __future__ import annotations


def build_document_annotation_prompt(other_sections_key: str = "otherSections") -> str:
    return "\n".join(
        [
            "Extract exactly one resume/CV/professional profile object matching the provided schema.",
            "",
            "Use only information explicitly supported by the document.",
            "Preserve source order.",
            "Copy values verbatim or near-verbatim; do not over-normalize.",
            "Normalize only whitespace, obvious punctuation noise, and section grouping.",
            "Do not invent, infer, guess, translate, rewrite creatively, improve, or summarize.",
            "Preserve the source language; do not translate content into another language.",
            "Use null for missing scalar fields and [] for missing arrays.",
            "Never return empty strings.",
            "Do not infer missing dates, links, languages, desired role, or top-level identity.location.",
            "Preserve explicit source section families when present and keep their source order in sectionOrder[].",
            "Map explicit LANGUAGES headings and explicit language/proficiency lines to languages[]. Treat bullets, inline lists, and separators such as ':', '-', '/', ',', ';', '—', and parentheses as valid formatting when the content clearly lists languages and levels.",
            "For languages[], never copy skills/expertise headings, grouped expertise labels, programming-language labels, or fused neighboring section text as language values. Stop at the next explicit section heading.",
            "Map explicit SKILLS, EXPERTISE, AREAS OF EXPERTISE, CORE COMPETENCIES, and grouped expertise sections to skills[]. Extract explicit skill labels from bullets, inline lists, and grouped expertise content while preserving source order where possible.",
            "For skills[], when expertise content is grouped like 'Backend: Python, Node.js', emit only the atomic labels from the section body. Do not emit the group label itself, and do not merge adjacent section content into one skill item.",
            "Map explicit ACHIEVEMENTS headings to achievements[].",
            "Map explicit HOBBIES or INTERESTS headings to hobbies[].",
            "Map explicit AFFILIATIONS headings to affiliations[].",
            "Map explicit ADDITIONAL INFORMATION headings to additionalInformation[].",
            "Put certificates, licenses, credentials, and certification programs in certifications[].",
            "Do not collapse supported first-class section families into generic sections.",
            "When a section clearly matches a first-class family such as Languages or Skills/Expertise, populate that first-class field instead of omitting it or routing it to generic sections.",
            f"Use {other_sections_key}[] only for meaningful explicit source headings that do not fit a first-class schema family.",
            f"When using {other_sections_key}[], preserve the original heading title and body exactly enough to retain meaning.",
            "For each experience entry, preserve intro prose as description and explicit bullet items as responsibilityBullets.",
            "Do not convert prose into bullets, do not merge bullets into description, and do not invent bullets from paragraph text.",
            "Return exactly one JSON object matching the provided schema and nothing else.",
        ]
    )


DOCUMENT_ANNOTATION_PROMPT = build_document_annotation_prompt()
