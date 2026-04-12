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
            "Put certificates, licenses, credentials, and certification programs in certifications[].",
            f"Use {other_sections_key}[] only for meaningful content that clearly does not fit the first-class schema families.",
            "Return exactly one JSON object matching the provided schema and nothing else.",
        ]
    )


DOCUMENT_ANNOTATION_PROMPT = build_document_annotation_prompt()
