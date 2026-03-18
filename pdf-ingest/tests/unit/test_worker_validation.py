import pytest
from worker import validate_raw_text

def test_validate_raw_text_pass():
    long_text = "a" * 1500
    # validate_raw_text returns None on success (no exception)
    assert validate_raw_text(long_text) is None

def test_validate_raw_text_medium_accepts():
    medium_text = "a" * 500
    # Medium-length text without explicit resume indicators is conservatively accepted
    assert validate_raw_text(medium_text) is None
