import sys
import os
import importlib.util
import pytest

# Load app.py as a module by path so tests work inside Docker and locally
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_PATH = os.path.join(PROJECT_ROOT, "app.py")
spec = importlib.util.spec_from_file_location("app", APP_PATH)
app_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_mod)

extract_email = app_mod.extract_email
extract_name = app_mod.extract_name
extract_skills = app_mod.extract_skills
extract_summary = app_mod.extract_summary
extract_experiences = app_mod.extract_experiences

SAMPLE_TEXT = """
Jane Q. Developer
jane.q.developer@example.com

Summary
Seasoned software engineer with 8 years of experience building web applications in Python and TypeScript.

Skills
- Python, FastAPI, SQLAlchemy
- TypeScript, React, Node.js

Experience
Acme Corp
Senior Engineer
Jan 2020 - Present
Worked on backend services and APIs.
"""

def test_extract_email():
    assert extract_email(SAMPLE_TEXT) == "jane.q.developer@example.com"

def test_extract_name():
    assert "Jane" in extract_name(SAMPLE_TEXT, "jane.q.developer@example.com")

def test_extract_skills():
    skills = extract_skills(SAMPLE_TEXT)
    assert "Python" in skills or "TypeScript" in skills

def test_extract_summary():
    summary = extract_summary(SAMPLE_TEXT)
    assert summary is not None
    assert "Seasoned software engineer" in summary

def test_extract_experiences():
    exps = extract_experiences(SAMPLE_TEXT)
    assert isinstance(exps, list)
    assert len(exps) >= 1
    first = exps[0]
    assert first.get("company") is not None or first.get("title") is not None
