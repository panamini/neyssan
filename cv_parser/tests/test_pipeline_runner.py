from __future__ import annotations

from cv_parser.pipeline.runner import run_pipeline


def test_run_pipeline_text_mode(tmp_path):
    txt = tmp_path / "resume.txt"
    txt.write_text(
        """John Doe\njohn@example.com\n\nEXPERIENCE\nCompany A - Role\n\nEDUCATION\nUniversity\n\nSKILLS\nPython, SQL\n\nLANGUAGES\nEnglish"""
    )

    result = run_pipeline(txt, mode="text")

    assert result.normalized.contact.email == "john@example.com"
    assert result.strict.email == "john@example.com"
    assert result.normalized.experience
    assert result.normalized.education
    assert result.normalized.skills
    assert result.normalized.languages
    diagnostics = result.diagnostics
    assert "hybrid_used" in diagnostics
    assert "fallback_used" in diagnostics
    assert "sections_found" in diagnostics
    assert isinstance(diagnostics["sections_found"], dict)
