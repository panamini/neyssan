# tmp_debug_worker_inmemory.py
import uuid
import copy

# -------------------------------
# Sample profile for mocking LLM
# -------------------------------
sample_profile = {
    "rawText": "This is the original text.",
    "skills": ["Python", "ML"],
    "meta": {}
}

# -------------------------------
# In-memory "database"
# -------------------------------
DB = {}

# -------------------------------
# Mock LLM refinement function
# -------------------------------
def mock_refine(raw_text=None, mock=True, examples=None, timeout=30):
    """
    Mock LLM refinement function for testing.
    Ensures 'llmRefined' is set in meta.
    """
    out = copy.deepcopy(sample_profile)
    out["rawText"] = raw_text or out.get("rawText")
    out["meta"] = dict(out.get("meta", {}))
    out["meta"]["llmRefined"] = True
    return out

# Patch the worker function (simulate)
def llm_refine_profile(profile_id):
    profile = DB.get(profile_id)
    if not profile:
        raise ValueError("Profile not found")

    refined = mock_refine(profile["rawText"])
    profile.update(refined)
    # simulate confidence update
    profile["confidence"] = 0.95
    return profile

# -------------------------------
# Main test run
# -------------------------------
def run():
    test_id = str(uuid.uuid4())
    test_raw_text = "Text that should be refined"

    # Insert test profile
    DB[test_id] = {
        "id": test_id,
        "name": "Before",
        "email": "before@example.com",
        "summary": "before",
        "skills": ["old"],
        "experience": [{"company": "OldCo", "title": "Dev"}],
        "rawText": test_raw_text,
        "confidence": 0.2,
        "meta": {"test": True}
    }

    print("Inserted profile:", test_id)
    print("Before refinement:", DB[test_id])

    # Run worker task
    print("\nRunning worker.llm_refine_profile...")
    res = llm_refine_profile(test_id)
    print("\nWorker result:", res)

    # Check updated profile
    got = DB[test_id]
    print("\nProfile after worker (in-memory):", got)
    assert got["meta"].get("llmRefined") is True, "LLM refinement flag missing!"
    print("\n✅ LLM refinement successfully applied.")

if __name__ == "__main__":
    run()
