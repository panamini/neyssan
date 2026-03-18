import pytest

from cv_parser.extract.text_pdf import _normalize_phone_candidate

phonenumbers = pytest.importorskip("phonenumbers")  # noqa: F841


@pytest.mark.parametrize(
    "raw, region, expected",
    [
        ("06 12 34 56 78", "FR", "+33612345678"),
        ("612 34 56 78", "ES", "+34612345678"),
    ],
)
def test_normalize_phone_candidate_handles_fr_and_es(raw: str, region: str, expected: str) -> None:
    normalized, confidence = _normalize_phone_candidate(raw, preferred_region=region)
    assert normalized == expected
    assert confidence is not None
    assert confidence >= 0.89
