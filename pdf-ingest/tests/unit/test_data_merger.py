import pytest
from worker import merge_profiles

def test_merge_profiles_basic_overwrite():
    original = {"name": "John Doe", "email": "john@example.com", "skills": ["Python"]}
    refined = {"name": "Jane Doe", "summary": "A new summary"}
    merged = merge_profiles(original, refined)
    assert merged == {"name": "Jane Doe", "email": "john@example.com", "skills": ["Python"], "summary": "A new summary"}

def test_merge_profiles_none_values_do_not_overwrite():
    original = {"name": "John Doe", "email": "john@example.com"}
    refined = {"name": None, "email": ""}
    merged = merge_profiles(original, refined)
    assert merged == {"name": "John Doe", "email": "john@example.com"}

def test_merge_profiles_list_additive_unique():
    original = {"skills": ["Python", "Java"], "experience": [{"title": "Dev", "company": "A"}]}
    refined = {"skills": ["Java", "C++", "Python"], "experience": [{"title": "Sr Dev", "company": "B"}]}
    merged = merge_profiles(original, refined)
    assert "Python" in merged["skills"]
    assert "Java" in merged["skills"]
    assert "C++" in merged["skills"]
    assert len(merged["skills"]) == 3 # Ensure uniqueness
    assert merged["experience"] == [{"title": "Sr Dev", "company": "B"}] # Non-list overwrites

def test_merge_profiles_new_fields():
    original = {"name": "John"}
    refined = {"age": 30, "city": "New York"}
    merged = merge_profiles(original, refined)
    assert merged == {"name": "John", "age": 30, "city": "New York"}

def test_merge_profiles_empty_refined():
    original = {"name": "John", "age": 30}
    refined = {}
    merged = merge_profiles(original, refined)
    assert merged == {"name": "John", "age": 30}

def test_merge_profiles_empty_original():
    original = {}
    refined = {"name": "John", "age": 30}
    merged = merge_profiles(original, refined)
    assert merged == {"name": "John", "age": 30}
