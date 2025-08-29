
---

# 🏗 Ultimate Hybrid Plan: The Canonical Profile Pipeline Overhaul

Synthesizing the best from all four plans, this ultimate plan merges DeepSeek's log-rooted diagnostics and configuration checks as the foundation, Grok's phased structure and systemic resilience (e.g., retries, monitoring), GPT's file-specific granularity and observability (e.g., schemas, tests, UX), and Gemini's concise focus on core fixes with fallbacks. The result is a robust, end-to-end strategy that's actionable, resilient, and user-centric—ensuring no silent failures, consistent DB-Convex sync, and high-quality data from parse to load. It prioritizes quick wins (async fixes) while building long-term reliability, with visualizations, code, metrics, and a rollout roadmap to make it shine for engineering teams.

---

## 📜 Pipeline Flow Recap and Integrated Risks

**Flow:** PDF upload → Parse (/parse-now) → DB persist (profile + LLM history) → Enqueue refine (/llm-refine) → Validate raw text → LLM refine (worker.py) → Merge results → Convex persist (/convex-persist-retry) → Load canonical profile.

**Key Risks (Prioritized from all analyses):**

* Unawaited coroutines causing Convex 500s and desync (DeepSeek/Gemini primary; Grok/GPT's async emphasis).
* Insufficient raw text failing validation but marking "Job OK" silently (all; GPT's graded approach).
* Race conditions: Enqueue before DB commit, drafts skipping (Grok/DeepSeek; GPT/Gemini checks).
* Malformed data (e.g., placeholders like "United States" name) from parsing (DeepSeek/Grok; GPT sanitization).
* Inefficient polling, poor error propagation, and config issues (Grok/Gemini; DeepSeek env vars).

**Visualization Suggestion:** Use a sequence diagram (e.g., in PlantUML) to map the flow, highlighting await points, retries, and failure branches.

---

## ⚡ Phase 1: Immediate Stabilization (24-48 Hours)

**Focus:** Blockers like async failures and silent skips (DeepSeek/Gemini priority + Grok/GPT escalation).

### Async/Await and Convex Fixes (File: convex\_persist.py + callers like app.py)

```python
# convex_persist.py (merged from Grok/GPT/DeepSeek)
import asyncio
import httpx
from pydantic import BaseModel, ValidationError

class CanonicalProfile(BaseModel):  # GPT schema for sanitization
    id: str
    name: str | None = None
    email: str | None = None
    summary: str | None = None
    skills: list[str] = []
    # ... (add other fields)

async def persist_to_convex(profile: dict, site_url: str, token: str | None, max_retries: int = 3) -> dict:
    try:
        clean = CanonicalProfile(**profile).model_dump(exclude_none=True)  # Sanitize nulls/empties (GPT/Gemini)
    except ValidationError as ve:
        return {"ok": False, "error": "schema_validation", "details": str(ve)}
    attempt = 0
    while attempt < max_retries:
        try:
            resp = await call_convex_action(f"{site_url}/api/ingest/profile", clean, token)  # Await fix (all)
            if 200 <= resp.status_code < 300:
                return {"ok": True, "status_code": resp.status_code}
            return {"ok": False, "error": "non_2xx", "body": resp.text}
        except Exception as e:
            attempt += 1
            await asyncio.sleep(2 ** attempt)  # Backoff (Grok/GPT)
    return {"ok": False, "error": "max_retries_exceeded"}
```

* In callers (e.g., /convex-persist-retry): Make async, update DB/LLM history only on success (GPT/Grok).

---

### Validation Escalation (File: worker.py)

```python
# worker.py (merged from all)
class InsufficientDataError(Exception): pass

def validate_raw_text(raw: str) -> tuple[str, str]:
    length = len(raw.strip())
    if length < 150:
        raise InsufficientDataError("Raw text too short")
    elif length < 1200:
        return ("weak", "short_text")
    return ("pass", "sufficient")

def run_refine(job):
    try:
        verdict, reason = validate_raw_text(job.raw_text)
        if verdict == "weak":
            job.flags["low_confidence"] = True  # Proceed with fallback (Gemini)
    except InsufficientDataError as e:
        update_llm_history(job.history_id, status="failed", reason=str(e))  # Escalate (all)
        raise  # RQ fails job
    # Proceed to LLM...
```

---

### Race Condition Guards (File: app.py for /llm-refine)

```python
# app.py (merged)
async def wait_for_profile(profile_id: str, timeout_s=5):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if db.profile_exists(profile_id):
            return True
        await asyncio.sleep(0.25)
    raise ProfileNotFoundError("Profile not persisted")

@router.post("/api/v1/llm-refine")
async def llm_refine(req: RefineRequest):
    await wait_for_profile(req.profile_id)  # Guard (all)
    if req.is_draft:
        raise HTTPException(400, "Drafts not supported for refinement")
    enqueue_refine(req.profile_id, req.history_id)
```

---

### 🔄 Backfill & Reconciliation (Phase 1.5)

```python
# backfill.py
from db import get_profiles, update_status
from pipeline import run_pipeline

def reprocess_bad_profiles():
    bad = get_profiles(filters={"raw_quality": "contact_only"}) \
        + get_profiles(filters={"convex_status": "error"})
    for p in bad:
        try:
            run_pipeline(p)  # full parse->refine->persist
        except Exception as e:
            update_status(p.id, status="failed_backfill", reason=str(e))
```

---

## 🛡 Phase 2: Pipeline Reinforcement (1 Week)

**Focus:** Data quality and error handling (Grok/Gemini upstream + GPT/DeepSeek patterns).

### Enhance PDF Parsing (File: parser.py)

```python
# parser.py
import re
CONTACT_RE = r"(?:\+?\d[\d\-\s]{7,}|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)"
SECTION_HINTS = ["experience", "education", "skills"]

def parse_pdf(text: str) -> dict:
    contacts = re.findall(CONTACT_RE, text)
    resume_content = re.sub(CONTACT_RE, '', text).strip()
    has_sections = any(hint in resume_content.lower() for hint in SECTION_HINTS)
    quality = "contact_only" if not has_sections and len(resume_content) < 250 else "normal"
    if quality == "contact_only":
        raise ParseError("Insufficient resume content")  # Early fail (Gemini)
    return {"raw_text": resume_content, "contacts": contacts, "raw_quality": quality}
```

---

### LLM Prompt Policy for Weak Resumes

```python
# worker.py refine step (extension)
if job.flags.get("low_confidence"):
    prompt = WEAK_PROMPT_TEMPLATE.format(text=job.raw_text)
else:
    prompt = FULL_PROMPT_TEMPLATE.format(text=job.raw_text)
```

---

### Standardized Error Taxonomy

```python
# errors.py
from enum import Enum

class PipelineError(Enum):
    SHORT_TEXT = "short_text"
    PARSE_ERROR = "parse_error"
    CONVEX_TIMEOUT = "convex_timeout"
    VALIDATION_FAIL = "validation_fail"
    UNKNOWN = "unknown"
```

```python
# usage
update_llm_history(job.history_id, status="failed",
                   error_code=PipelineError.SHORT_TEXT.value)
```

---

### Merge and Sanitization Improvements

* Additive merges; sanitize before Convex (Grok/GPT/DeepSeek).

### Smart Retries

* Cross-cutting; apply to enqueue/persist/validation (Grok/GPT).

---

## 📊 Phase 3: Observability and Integration (1-2 Weeks)

* Robust integration (Convex schema pre-validation; logging).
* Error bubbling to APIs + frontend states (retry UX).
* Monitoring (metrics: validation\_skips, convex\_fails, desync\_gauge).

```python
# monitoring.py
def monitor_pipeline():
    metrics = {
        "validation_skips": count_skips(),
        "convex_fails": count_500s(),
        "desyncs": count_db_convex_mismatches()  # Query DB vs Convex (GPT)
    }
    if metrics["convex_fails"] > 5:
        alert("High failure rate")
```

---

## 🚀 Phase 4: Advanced and Ongoing (Beyond 2 Weeks)

* Lenient modes/manual overrides.
* Full async refactor; parser libs.
* Dashboard + reconciliation reports.

---

## 📅 Rollout Roadmap

| Week    | Tasks                                                                                      |
| ------- | ------------------------------------------------------------------------------------------ |
| 1       | Async fixes, validation escalation, race guards (Phase 1 + Backfill 1.5)                   |
| 2       | Parsing enhancements, merges/sanitization, retries, weak LLM policy, error enums (Phase 2) |
| 3       | Logging/UX, monitoring, schema checks (Phase 3)                                            |
| Ongoing | Leniency, dashboard, reconciliations (Phase 4)                                             |

---

✅ Now your plan:

* Fixes **forward pipeline failures**.
* Cleans **backward bad data**.
* Prevents **LLM hallucinations on weak resumes**.
* Adds **structured error observability**.

---
Perfect 👌 — I’ll **layer these enhancements on top of the final Ultimate Hybrid Plan** exactly as it stands, without altering the structure or replacing any of the suggested better code.

Instead, I’ll slot your refinements in as **optional enhancements** within the same sections, so engineers see them as polish they can adopt right away.

--- 

# 🔧 Optional Enhancements to the Ultimate Hybrid Plan (do not replace original code)


These refinements build directly on the **existing code** from the plan. They don’t replace it — they simply extend it for scale, clarity, and UX polish.

---

### **1. Backfill Enhancements (Phase 1.5)**

Add batching and logging to safely handle large datasets during reconciliation.

```python
# backfill.py (enhanced)
from db import get_profiles, update_status
from pipeline import run_pipeline
import logging

def reprocess_bad_profiles(batch_size=100):
    bad = get_profiles(filters={"raw_quality": "contact_only"}) + get_profiles(filters={"convex_status": "error"})
    for i in range(0, len(bad), batch_size):
        batch = bad[i:i+batch_size]
        for p in batch:
            try:
                run_pipeline(p)
                logging.info(f"Reprocessed {p.id} successfully")
            except Exception as e:
                update_status(p.id, status="failed_backfill", reason=str(e))
                logging.error(f"Failed {p.id}: {str(e)}")
```

✅ This prevents **memory blowups** and provides **progress feedback** for ops teams.

---

### **2. LLM Prompt Policy Enhancements (Phase 2)**

Provide **clear templates** to guide consistency between weak and full resumes.

```python
# worker.py refine step (extension with templates)
WEAK_PROMPT_TEMPLATE = """
Extract basic info from this short resume text. Focus on name, contacts, and any obvious skills/experience. Ignore missing sections:
{text}
Output as JSON: {{ "name": "...", "email": "...", "skills": [...] }}
"""

FULL_PROMPT_TEMPLATE = """
Fully refine this resume: Summarize experience, education, skills. Generate a professional summary.
Text: {text}
Output as JSON: {{ "summary": "...", "skills": [...], "experience": [...] }}
"""

if job.flags.get("low_confidence"):
    prompt = WEAK_PROMPT_TEMPLATE.format(text=job.raw_text)
else:
    prompt = FULL_PROMPT_TEMPLATE.format(text=job.raw_text)
# Then call LLM with prompt...
```

✅ Prevents **vague instructions**, ensuring weak resumes never hallucinate, while strong ones get rich summaries.

---

### **3. Error Taxonomy Enhancements (Phase 2–3)**

Expand error codes + provide **human-friendly messages** for frontend UX.

```python
# errors.py (enhanced)
from enum import Enum

class PipelineError(Enum):
    SHORT_TEXT = "short_text"
    PARSE_ERROR = "parse_error"
    CONVEX_TIMEOUT = "convex_timeout"
    VALIDATION_FAIL = "validation_fail"
    RACE_CONDITION = "race_condition"  # For wait/commit issues
    SCHEMA_MISMATCH = "schema_mismatch"  # For Pydantic fails
    UNKNOWN = "unknown"

ERROR_MESSAGES = {
    PipelineError.SHORT_TEXT.value: "The uploaded file lacks enough content for refinement. Try a full resume.",
    PipelineError.PARSE_ERROR.value: "We couldn’t parse this document. Please upload a standard resume format.",
    PipelineError.CONVEX_TIMEOUT.value: "Data sync timed out. Please retry.",
    PipelineError.SCHEMA_MISMATCH.value: "The parsed data didn’t match our profile structure.",
    PipelineError.RACE_CONDITION.value: "Profile data wasn’t ready yet. Try again in a moment.",
    PipelineError.UNKNOWN.value: "An unexpected error occurred. Please contact support.",
}

# Usage
update_llm_history(
    job.history_id,
    status="failed",
    error_code=PipelineError.SHORT_TEXT.value,
    user_message=ERROR_MESSAGES.get(PipelineError.SHORT_TEXT.value, "Unknown error")
)
```

✅ Makes **metrics cleaner** for engineers, while giving **clear messages** to end-users.

---

📌 These are all **non-invasive add-ons**. Your original plan stays untouched — these just make it more production-ready out of the box.

---

 @startuml
title Canonical Profile Pipeline Flow

participant User
participant Frontend
participant API as "API Endpoints"
participant DB
participant Worker
participant Convex

User -> Frontend: Upload PDF
Frontend -> API: /parse-now
API -> Parser: Extract text
Parser --> API: Raw text, contacts, quality
alt quality == "contact_only"
  API --> Frontend: ParseError (Early fail)
else
  API -> DB: Persist profile + LLM history
  DB --> API: Profile ID
  API -> Worker: Enqueue /llm-refine
end

API -> Frontend: Queued

loop Polling (with backoff, cap at 30s)
  Frontend -> API: /llm-history
  API --> Frontend: Status (with reason/error_code)
end

Worker -> DB: Load profile (wait/retry up to 5s)
alt Profile not found (race)
  Worker --> API: ProfileNotFoundError
  Worker -> DB: Update history: failed, RACE_CONDITION
else
  Worker -> Validator: validate_raw_text
  alt Fail (<150 chars)
    Validator --> Worker: InsufficientDataError
    Worker -> DB: Update history: failed, SHORT_TEXT
    Worker --> RQ: Raise (job fails)
  else Weak (150-1200 chars)
    Validator --> Worker: weak, short_text
    Worker -> LLM: Refine with WEAK_PROMPT (low_confidence)
  else Pass
    Validator --> Worker: pass
    Worker -> LLM: Refine with FULL_PROMPT
  end

  Worker -> Merger: Merge results (additive)
  Merger --> Worker: Updated profile

  Worker -> Convex: persist_to_convex (await, retries with backoff)
  alt Success (200-299)
    Convex --> Worker: OK
    Worker -> DB: Update history: success
  else Failure (non-2xx, timeout, or exception)
    Convex --> Worker: Error
    Worker -> DB: Update history: failed, e.g., CONVEX_TIMEOUT or SCHEMA_MISMATCH
    Worker --> RQ: Raise
  end
end

note over Worker, Convex: Sanitize payload via CanonicalProfile before send

Frontend --> User: Final status (success/failed with user_message)
@enduml