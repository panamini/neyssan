import os
import pytest
from llm import refine_with_llm

pytestmark = pytest.mark.skipif("MISTRAL_API_KEY" not in os.environ, reason="MISTRAL_API_KEY not set; skipping live Mistral integration test")

def test_mistral_integration_smoke():
    """
    Smoke test for Mistral integration.

    This test only runs when MISTRAL_API_KEY is present in the environment.
    It checks that `refine_with_llm` can call the Mistral endpoint and returns a dict
    with basic expected fields and metadata indicating the provider.
    """
    # Use a small sample raw_text to keep calls inexpensive.
    raw = "Name: Jane Doe\nExperience: 3 years at Acme Corp\nSkills: Python, SQL\nSummary: Experienced backend engineer."
    os.environ["PDF_INGEST_LLM_PROVIDER"] = "mistral"

    # Call the real provider (not mock). Keep timeout modest.
    result = refine_with_llm(raw, mock=False, timeout=30)

    assert isinstance(result, dict), "Expected a dict result from refine_with_llm"
    assert "metadata" in result and isinstance(result["metadata"], dict), "metadata must be present and a dict"
    assert result["metadata"].get("llm") == "mistral", f"Expected metadata.llm == 'mistral', got {result['metadata'].get('llm')}"
    # Confidence should be present (provider dependent). Accept numeric or convertible.
    assert "confidence" in result or "confidence" in (result.keys()), "Expected confidence field in the result"
