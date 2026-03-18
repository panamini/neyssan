from __future__ import annotations

from pathlib import Path

from cv_parser.extract.text_pdf import extract_text_pdf
from cv_parser.pipeline import hybrid_mapping
from cv_parser.schema.model import ArrayItem, StrictContact


class DummyParser:
    def __init__(self, packed):
        self._packed = packed

    def parse_path(self, _path: Path):
        return self._packed

    def parse_text(self, _text: str):
        return self._packed


def test_text_extractor_fallback_on_empty_hybrid(monkeypatch, tmp_path):
    resume = tmp_path / "resume.txt"
    resume.write_text(
        """SUMMARY
        Senior engineer

        EXPERIENCE
        ACME Corp - Engineer

        EDUCATION
        BSc Computer Science

        SKILLS
        Python, Go

        LANGUAGES
        English
        """
    )

    monkeypatch.setattr(hybrid_mapping, "get_hybrid_parser", lambda: DummyParser({"sections": [], "entities": {}}))

    def fake_apply(normalized, packed, pp_blocks=None):
        return None, False, {}

    monkeypatch.setattr(hybrid_mapping, "apply_hybrid_mapping", fake_apply)

    result = extract_text_pdf(resume)

    assert result.diagnostics["hybrid_used"] is False
    assert result.diagnostics["fallback_used"] is True
    counts = result.diagnostics["sections_found"]
    assert counts["EXPERIENCE"] >= 1
    assert counts["EDUCATION"] >= 1
    assert counts["SKILLS"] >= 1
    assert counts["LANGUAGES"] >= 1
    assert result.normalized.experience
    assert result.normalized.education
    assert result.normalized.skills
    assert result.normalized.languages


def test_text_extractor_hybrid_partial(monkeypatch, tmp_path):
    resume = tmp_path / "resume.txt"
    resume.write_text(
        """SUMMARY
        Experienced engineer

        EXPERIENCE
        ACME Corp - Engineer

        EDUCATION
        BSc Computer Science

        SKILLS
        Python

        LANGUAGES
        English
        """
    )

    packed = {"sections": [{"label": "EXPERIENCE", "text": "ACME Corp"}], "entities": {}}
    monkeypatch.setattr(hybrid_mapping, "get_hybrid_parser", lambda: DummyParser(packed))

    def partial_apply(normalized, _packed, pp_blocks=None):
        normalized.experience = [ArrayItem(content="Hybrid Experience", confidence=0.9)]
        strict = StrictContact(email="hybrid@example.com", phone="123", name="Hybrid", location=None)
        return strict, True, {"EXPERIENCE": 1}

    monkeypatch.setattr(hybrid_mapping, "apply_hybrid_mapping", partial_apply)

    result = extract_text_pdf(resume)

    assert result.diagnostics["hybrid_used"] is True
    assert result.diagnostics["fallback_used"] is True  # other sections filled by heuristics
    counts = result.diagnostics["sections_found"]
    assert counts["EXPERIENCE"] == 1
    assert counts["EDUCATION"] >= 1
    assert counts["SKILLS"] >= 1
    assert counts["LANGUAGES"] >= 1
    assert result.normalized.experience and result.normalized.experience[0].content == "Hybrid Experience"
    assert result.strict.email == "hybrid@example.com"
