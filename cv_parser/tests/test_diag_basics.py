from pathlib import Path

from cv_parser.extract.text_pdf import extract_text_pdf


def test_diag_baseline_keys_text_pdf(tmp_path: Path):
    # Use a small text-based sample to avoid Paddle dependency
    sample = Path('fixtures/sample_textpdf_resume.pdf')
    assert sample.exists(), "fixtures/sample_textpdf_resume.pdf missing"
    result = extract_text_pdf(sample)
    diag = result.diagnostics or {}
    # Always-present baseline fields
    for key in (
        'engine', 'strategy', 'pages', 'chars', 'fallback_used', 'hybrid_used', 'sections_found', 'empty_reason'
    ):
        assert key in diag, f"missing diagnostics key: {key}"
    assert isinstance(diag.get('pages'), int)
    assert isinstance(diag.get('chars'), int)

