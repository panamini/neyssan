import pytest
from worker import validate_raw_text, InsufficientDataError

def test_validate_raw_text_pass():
    long_text = "a" * 1500
    verdict, reason = validate_raw_text(long_text)
    assert verdict == "pass"

def test_validate_raw_text_weak():
    medium_text = "a" * 500
    verdict, reason = validate_raw_text(medium_text)
    assert verdict == "weak"
    assert reason == "short_text"

def test_validate_raw_text_fail():
    short_text = "a" * 100
    with pytest.raises(InsufficientDataError, match="Raw text too short"):
        validate_raw_text(short_text)
