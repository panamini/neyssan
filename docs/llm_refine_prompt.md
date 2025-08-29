LLM refine prompt & schema (developer reference)
===============================================

Purpose
-------
This document contains the canonical prompt template, a few-shot example set, and the JSON schema that the LLM must return when asked to refine a parsed resume/profile. The system instruction enforces JSON-only output. Use this file as the canonical source when switching from the mock LLM to a real provider (OpenAI, Mistral, etc).

System instruction (top-level)
-----------------------------
You are a JSON-only extractor. Given a raw resume text, return EXACTLY one JSON object matching the NormalizedProfile schema described below. Do NOT produce any extra commentary, markdown, or explanatory text. If a field is unknown, set it to null for single-values or an empty array for lists. Favor consistent date formats (ISO yyyy-mm-dd, MMM YYYY, or YYYY). Do not invent values not present in the input unless you mark them as low-confidence in metadata. Validate the JSON before returning: it must parse and conform to the schema.

Prompt template (user message)
-----------------------------
Raw resume text:
<<RAW_TEXT>>

Instruction:
Return only JSON that matches the NormalizedProfile schema. Include a `confidence` float between 0.0 and 1.0, and include `metadata` with `llm: "your-provider"` and `llmConfidence` if you can estimate your own confidence. If you cannot extract a structured field, return `null` for that field. Use arrays for `skills`, `experience`, `education`, and `achievements`. Example output format is below.

Few-shot examples
-----------------
Example 1
Input rawText:
"Acme Corp\nSenior Software Engineer\nJan 2020 - Present\nWorked on backend systems, reduced latency by 30%.\nEmail: alice@acme.com\nSkills: Python, FastAPI, PostgreSQL\nEducation: B.Sc Computer Science, State University, 2016 - 2020"

Output JSON:
{
  "name": "Alice Example",
  "email": "alice@acme.com",
  "summary": "Senior Software Engineer with experience building backend systems and improving performance.",
  "skills": ["Python", "FastAPI", "PostgreSQL"],
  "experience": [
    {
      "company": "Acme Corp",
      "title": "Senior Software Engineer",
      "startDate": "Jan 2020",
      "endDate": "Present",
      "description": "Worked on backend systems, reduced latency by 30%."
    }
  ],
  "education": [
    {
      "school": "State University",
      "degree": "B.Sc Computer Science",
      "fieldOfStudy": null,
      "startDate": "2016",
      "endDate": "2020",
      "description": null
    }
  ],
  "achievements": ["Reduced latency by 30%"],
  "rawText": "<<RAW_TEXT>>",
  "confidence": 0.92,
  "metadata": {"llm": "mock", "llmConfidence": 0.92}
}

Example 2 (minimal contact-only)
Input rawText:
"John Doe\njohn.doe@example.com\nExperienced product manager."

Output JSON:
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "summary": "Experienced product manager.",
  "skills": [],
  "experience": [],
  "education": [],
  "achievements": [],
  "rawText": "<<RAW_TEXT>>",
  "confidence": 0.6,
  "metadata": {"llm": "mock", "llmConfidence": 0.6}
}

JSON schema (NormalizedProfile)
--------------------------------
NormalizedProfile fields (canonical Pydantic model used by the server):
- name: string | null
- email: string | null
- summary: string | null
- skills: array[string] | empty array
- experience: array of ExperienceItem | empty array
  - ExperienceItem:
    - company: string | null
    - title: string | null
    - startDate: string | null
    - endDate: string | null
    - description: string | null
- education: array of EducationItem | empty array
  - EducationItem:
    - school: string | null
    - degree: string | null
    - fieldOfStudy: string | null
    - startDate: string | null
    - endDate: string | null
    - description: string | null
- achievements: array[string] | empty array
- rawText: string | null
- confidence: float (0.0-1.0)
- metadata: object | null
  - Recommended keys:
    - llm: string (e.g. "openai", "mistral", "mock")
    - llmConfidence: float (optional)
    - llmRefinedAt: ISO timestamp (optional)
    - notes: string (optional free-form diagnostics)

Validation & tips
-----------------
- Always return a top-level JSON object. Do not wrap it in markdown code fences.
- If unsure about the candidate's name/email, put null and set `confidence` lower.
- Prefer ISO dates when precise (YYYY-MM-DD) or use "MMM YYYY" or "YYYY" when only month/year or year is present.
- For long resumes, prioritize recent experience and return at most 10 experience entries.
- Put rawText into the `rawText` field (can be truncated to a reasonable length if needed).
- Set `confidence` to reflect your overall extraction confidence (0.0 - 1.0).
- For local testing use the mock mode: set LLM_MOCK=true and the server will use the canned sample JSON.

Switching to a real provider
----------------------------
- Replace calls to refine_with_llm(..., mock=True) with mock=False.
- Ensure you provide API keys via environment variables:
  - For OpenAI: OPENAI_API_KEY, OPENAI_MODEL (optional)
  - For Mistral / other provider: configure PDF_INGEST_LLM_PROVIDER and provider-specific env vars (e.g., MISTRAL_API_KEY)
- Keep prompt content and few-shot examples in this doc for reproducible prompt engineering.
