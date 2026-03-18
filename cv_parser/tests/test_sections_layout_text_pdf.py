from pathlib import Path

from cv_parser.extract.text_pdf import extract_text_pdf


def test_layout_blocks_present_for_text_pdf() -> None:
    project_root = Path(__file__).resolve().parents[2]
    pdf_path = project_root / "fixtures" / "sample_text_resume.pdf"
    result = extract_text_pdf(pdf_path)

    assert result.layout is not None
    assert len(result.layout.blocks) > 0
    assert any(block.block_type == "word" for block in result.layout.blocks)
    assert "phone_parser" in result.diagnostics
