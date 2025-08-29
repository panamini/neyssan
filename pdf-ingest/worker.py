"""
RQ worker skeleton for pdf-ingest.

This file provides helpers to run background LLM refinement tasks.
"""
import os
import logging
import json
import uuid
import re
import uuid as _uuid

from typing import Any, Dict


from redis import Redis
try:
    from rq import Queue, Connection, Worker, Job, get_current_job  # type: ignore
    RQHasJob = True
except Exception:
    from rq import Queue, Connection, Worker  # type: ignore
    Job = None  # type: ignore
    # get_current_job may be unavailable in fallback, define a no-op
    def get_current_job():  # type: ignore
        return None
    RQHasJob = False

from db import get_sync_session
from models import Profile, LLMHistory
from schemas import NormalizedProfile
from llm import refine_with_llm
import time
from convex_persist import call_convex_action, ConvexPersistError
from uuid import UUID
from typing import Optional
import asyncio
from errors import PipelineError, ERROR_MESSAGES

def parse_profile_uuid_safe(profile_id: Any) -> Optional[UUID]:
    """
    Defensive parser for profile_id that supports either plain UUID strings
    or "placeholder-<uuid>" tokens. Returns a UUID instance when parsing
    succeeds, or None when the value is not a valid UUID (including malformed
    placeholder tokens). Never raises.
    """
    try:
        if isinstance(profile_id, str) and profile_id.startswith("placeholder-"):
            uuid_part = profile_id[len("placeholder-"):]
            try:
                return UUID(uuid_part)
            except Exception:
                return None
        return UUID(str(profile_id))
    except Exception:
        return None

# Helpers to reliably mark LLMHistory rows after an external Convex call.
def mark_convex_write_success(placeholder_id: str, idempotency_key: str = None):
    try:
        if not placeholder_id:
            logger.error("mark_convex_write_success called without placeholder_id")
            return
        from db import get_sync_session
        from models import LLMHistory
        try:
            with get_sync_session() as s2:
                try:
                    uid = UUID(str(placeholder_id))
                except Exception:
                    # fallback: try to look up by job_id field if not a UUID
                    uid = None
                hist = s2.get(LLMHistory, uid) if uid is not None else None
                if hist is None:
                    # fallback lookup by job_id field
                    try:
                        q = s2.query(LLMHistory).filter(LLMHistory.job_id == str(placeholder_id)).order_by(LLMHistory.run_time.desc()).first()
                        hist = q
                    except Exception:
                        hist = None
                if hist:
                    hist.convex_write_status = "success"
                    hist.convex_error = None
                    hist.convex_written_at = int(time.time() * 1000)
                    # persist idempotency key if provided and not set
                    try:
                        if idempotency_key and not getattr(hist, "convex_idempotency_key", None):
                            hist.convex_idempotency_key = idempotency_key
                    except Exception:
                        logger.exception("Failed to persist idempotency_key on hist %s", getattr(hist, "id", None))
                    s2.add(hist)
                    s2.commit()
                else:
                    logger.error("LLMHistory not found for placeholder_id=%s", placeholder_id)
        except Exception:
            logger.exception("Failed to mark convex success for placeholder %s", placeholder_id)
    except Exception:
        logger.exception("Unexpected error in mark_convex_write_success")

def mark_convex_write_failure(placeholder_id: str, error: str, idempotency_key: str = None):
    try:
        if not placeholder_id:
            logger.error("mark_convex_write_failure called without placeholder_id")
            return
        from db import get_sync_session
        from models import LLMHistory
        try:
            with get_sync_session() as s2:
                try:
                    uid = UUID(str(placeholder_id))
                except Exception:
                    uid = None
                hist = s2.get(LLMHistory, uid) if uid is not None else None
                if hist is None:
                    try:
                        q = s2.query(LLMHistory).filter(LLMHistory.job_id == str(placeholder_id)).order_by(LLMHistory.run_time.desc()).first()
                        hist = q
                    except Exception:
                        hist = None
                if hist:
                    hist.convex_write_status = "failed"
                    hist.convex_error = str(error)
                    hist.convex_written_at = None
                    # persist idempotency key if provided and not set
                    try:
                        if idempotency_key and not getattr(hist, "convex_idempotency_key", None):
                            hist.convex_idempotency_key = idempotency_key
                    except Exception:
                        logger.exception("Failed to persist idempotency_key on hist %s", getattr(hist, "id", None))
                    s2.add(hist)
                    s2.commit()
                else:
                    logger.error("LLMHistory not found for placeholder_id=%s", placeholder_id)
        except Exception:
            logger.exception("Failed to mark convex failure for placeholder %s: %s", placeholder_id, error)
    except Exception:
        logger.exception("Unexpected error in mark_convex_write_failure")

logger = logging.getLogger("pdf-ingest.worker")
logger.setLevel(logging.INFO)

# Helper to perform commits safely: on failure attempt rollback and surface/log the error.
def safe_commit(session, context: str = "<unknown>"):
    """
    Attempt to commit the provided SQLAlchemy session. If commit() raises,
    attempt session.rollback(), log the error, and re-raise the original exception.
    This prevents sessions from remaining in an aborted state without an explicit rollback.
    """
    try:
        session.commit()
    except Exception as e:
        try:
            session.rollback()
        except Exception:
            logger.exception("Failed to rollback session after commit failure in %s", context)
        logger.exception("Commit failed in %s: %s", context, e)
        raise

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
redis_conn = Redis.from_url(REDIS_URL)
queue = Queue("default", connection=redis_conn)


def merge_profiles(original: Dict[str, Any], refined: Dict[str, Any]) -> Dict[str, Any]:
    """
    Defensively merges refined LLM data into the original profile.
    - New values overwrite old, but None/empty values do not.
    - For lists (like skills), it appends unique items.
    """
    merged = original.copy()
    for key, value in refined.items():
        if value is not None and value != "" and value != []:
            if isinstance(value, list) and key in original:
                # Additive merge for lists, ensuring uniqueness
                merged[key] = list(set(original.get(key, []) + value))
            else:
                merged[key] = value
    return merged

def validate_raw_text(raw_text: str) -> None:
    """
    Basic heuristic validator to avoid sending contact-only or too-short text to the LLM.
    Raises InsufficientDataError (ValueError subclass OK) on failure.
    """
    import re

    if not raw_text or len(raw_text.strip()) < 250:
        raise ValueError("Raw text too short for meaningful extraction")

    text_lower = raw_text.lower()
    resume_indicators = [
        "experience",
        "education",
        "skills",
        "projects",
        "work history",
        "employment",
        "certifications",
        "achievements",
        "professional",
        "summary",
    ]

    if any(ind in text_lower for ind in resume_indicators):
        return None

    # If no resume indicators, but looks like contact-only (phone/email/address), reject.
    contact_patterns = [
        r"\d{3}[\-\.]?\d{3}[\-\.]?\d{4}",  # phone-like
        r"@\w+\.\w+",  # email-like
        r"\d+\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln)\b",  # address-like
    ]
    for p in contact_patterns:
        if re.search(p, text_lower):
            raise ValueError("Text appears to be contact information only - lacks resume content")

    # Otherwise conservatively accept (some resumes don't contain the keywords above)
    return None


def llm_cleanup_task(profile_id: str) -> dict:
    return llm_refine_profile(profile_id)


def llm_refine_profile(profile_id: str, correlation_job_id: str = None, session: Any = None) -> dict:
    """
    profile_id: UUID string
    correlation_job_id: optional correlation id passed at enqueue time (guaranteed by enqueue_llm_cleanup)
    session: optional DB session injected for testing
    """
    logger.info("LLM_REFINE_CALLED %s session_injected %s correlation_job_id=%s", profile_id, session is not None, bool(correlation_job_id))

    diagnostics: Dict[str, Any] = {"profile_id": profile_id, "status": "started"}

    try:
        pid = uuid.UUID(profile_id)
    except Exception as e:
        diagnostics.update({"status": "failed", "error": f"invalid uuid: {e}"})
        return diagnostics

    def _run_with_session(sess) -> dict:
        profile = sess.get(Profile, pid)
        logger.info("WORKER_ENTER %s loaded_profile %s", profile_id, bool(profile))
        if not profile:
            diagnostics.update({"status": "failed", "error": "profile not found"})
            return diagnostics

        raw_text = profile.raw_text or ""
        # Validate raw_text to avoid sending contact-only or too-short content to LLM
        try:
            validate_raw_text(raw_text)
        except ValueError as e: # Catch specific ValueError from validate_raw_text
            error_code = PipelineError.SHORT_TEXT.value if "too short" in str(e) else PipelineError.PARSE_ERROR.value
            user_message = ERROR_MESSAGES.get(error_code, ERROR_MESSAGES[PipelineError.UNKNOWN.value])
            logger.warning("Raw text validation failed for profile %s: %s (code: %s)", profile_id, e, error_code)
            diagnostics.update({"status": "failed", "error": f"raw_text_validation_failed: {e}", "error_code": error_code, "user_message": user_message})
            meta = profile.meta or {}
            meta["llmError"] = f"raw_text_validation_failed: {e}"
            meta["llmErrorCode"] = error_code
            meta["llmUserMessage"] = user_message
            profile.meta = meta
            sess.add(profile)
            safe_commit(sess, "llm_refine_profile:raw_text_validation_failed")
            return diagnostics

        mock_env = os.getenv("LLM_MOCK", "true").lower()
        mock = mock_env in ("1", "true", "yes")
        provider = os.getenv("PDF_INGEST_LLM_PROVIDER", "unset")
        logger.info(
            "Invoking LLM refine: provider=%s mock=%s profile_id=%s", provider, mock, profile_id
        )

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
        # Determine which prompt to use based on low_confidence flag
        prompt = FULL_PROMPT_TEMPLATE.format(text=raw_text)
        if profile.meta and profile.meta.get("low_confidence"):
            prompt = WEAK_PROMPT_TEMPLATE.format(text=raw_text)

        try:
            llm_resp = refine_with_llm(raw_text, mock=mock, prompt=prompt) # Assuming refine_with_llm can take a prompt
            logger.info("LLM_RESP_SNIPPET %s", repr(str(llm_resp))[:1000])
        except Exception as e:
            logger.exception("LLM call failed for profile %s: %s", profile_id, e)
            diagnostics.update({"status": "failed", "error": f"llm call failed: {e}"})
            meta = profile.meta or {}
            meta["llmError"] = str(e)
            profile.meta = meta
            sess.add(profile)
            safe_commit(sess, "llm_refine_profile:llm_error_persist_profile")
            return diagnostics

        # Sanitize / normalize the raw LLM response into a candidate dict BEFORE pydantic validation.
        # This ensures we coerce common shape variations (lists for descriptions, alternate keys)
        # into the canonical shape expected by NormalizedProfile.
        try:
            raw_candidate = llm_resp if isinstance(llm_resp, dict) else {}
            # Prefer parsed block if present as a base for candidate
            parsed_src = raw_candidate.get("parsed") if isinstance(raw_candidate, dict) else None
            candidate = dict(parsed_src) if isinstance(parsed_src, dict) else dict(raw_candidate)

            # Map alternate top-level keys -> canonical keys.
            # Some parsers/LLMs use "PROFILE" or "Profile" as a summary field; prefer that as summary.
            try:
                if not candidate.get("summary"):
                    if "PROFILE" in candidate and candidate.get("PROFILE"):
                        candidate["summary"] = candidate.get("PROFILE")
                    elif "Profile" in candidate and candidate.get("Profile"):
                        candidate["summary"] = candidate.get("Profile")
            except Exception:
                # non-fatal normalization step
                pass

            # Coercion helpers
            def _stringify_if_list(v):
                if isinstance(v, list):
                    return " ".join([str(x).strip() for x in v if x is not None and str(x).strip() != ""])
                return v

            def _coerce_to_str(v):
                if v is None:
                    return None
                return str(v)

            # Normalize experience entries
            exp_src = candidate.get("experience") or candidate.get("employmentHistory") or candidate.get("employment_history")
            norm_exp = []
            if isinstance(exp_src, list):
                for e in exp_src:
                    if not isinstance(e, dict):
                        continue
                    title = e.get("title") or e.get("position") or e.get("role") or e.get("jobTitle")
                    company = e.get("company") or e.get("employer") or e.get("organization") or e.get("organisation")
                    start = e.get("startDate") or e.get("start") or e.get("start_date")
                    end = e.get("endDate") or e.get("end") or e.get("end_date")
                    desc = e.get("description") or e.get("responsibilities") or e.get("responsibility") or e.get("details")
                    # stringify lists
                    desc = _stringify_if_list(desc)
                    # ensure strings for title/company
                    title = _coerce_to_str(title) if title is not None else None
                    company = _coerce_to_str(company) if company is not None else None
                    if not (title or company or start or end or desc):
                        continue
                    norm_exp.append({"title": title or None, "company": company or None, "startDate": start or None, "endDate": end or None, "description": desc or None})
            if norm_exp:
                candidate["experience"] = norm_exp

            # Normalize education entries
            edu_src = candidate.get("education") or candidate.get("education_list")
            norm_edu = []
            if isinstance(edu_src, list):
                for e in edu_src:
                    if not isinstance(e, dict):
                        continue
                    degree = e.get("degree") or e.get("program") or e.get("qualification") or e.get("title")
                    school = e.get("school") or e.get("institution") or e.get("organisation") or e.get("organization") or e.get("provider")
                    start = e.get("startDate") or e.get("start") or e.get("start_date")
                    end = e.get("endDate") or e.get("end") or e.get("end_date")
                    desc = e.get("courseCurriculum") or e.get("course_curriculum") or e.get("courseCurricula") or e.get("description") or e.get("details")
                    desc = _stringify_if_list(desc)
                    field = e.get("fieldOfStudy") or e.get("field_of_study") or e.get("major")
                    norm_edu.append({"degree": _coerce_to_str(degree) if degree is not None else None, "school": _coerce_to_str(school) if school is not None else None, "startDate": start or None, "endDate": end or None, "description": desc or None, "fieldOfStudy": _coerce_to_str(field) if field is not None else None})
            if norm_edu:
                candidate["education"] = norm_edu

            # Normalize achievements string -> list
            achievements = candidate.get("achievements") or (candidate.get("metadata") and candidate.get("metadata").get("achievements"))
            if isinstance(achievements, str):
                ach_list = [a.strip() for a in re.split(r"[\\n\\u2022•]+", achievements) if a.strip()]
                candidate["achievements"] = ach_list if ach_list else None

            # Coerce simple fields
            if "name" in candidate and candidate.get("name") is not None:
                candidate["name"] = _coerce_to_str(candidate.get("name"))
            if "email" in candidate and candidate.get("email") is not None:
                candidate["email"] = _coerce_to_str(candidate.get("email"))
            if "rawText" in candidate and candidate.get("rawText") is not None:
                candidate["rawText"] = _coerce_to_str(candidate.get("rawText"))
            if "summary" in candidate and candidate.get("summary") is not None:
                candidate["summary"] = _coerce_to_str(candidate.get("summary"))

            # Attach normalized_for_verify later (after we compute normalized strings)
            # Attempt pydantic validation; if it fails attempt a coercive second pass and then fail gracefully.
            validated = None
            try:
                validated = NormalizedProfile(**candidate)
            except Exception as e_val:
                error_code = PipelineError.SCHEMA_MISMATCH.value
                user_message = ERROR_MESSAGES.get(error_code, ERROR_MESSAGES[PipelineError.UNKNOWN.value])
                logger.warning("Initial pydantic validation failed for profile %s, attempting coercive fixes: %s", profile_id, e_val)
                # Coercive fixes: ensure any list-valued description fields are stringified
                try:
                    if isinstance(candidate.get("experience"), list):
                        for e in candidate.get("experience"):
                            if isinstance(e.get("description"), list):
                                e["description"] = _stringify_if_list(e.get("description"))
                    if isinstance(candidate.get("education"), list):
                        for ed in candidate.get("education"):
                            if isinstance(ed.get("description"), list):
                                ed["description"] = _stringify_if_list(ed.get("description"))
                    # Try validation again
                    validated = NormalizedProfile(**candidate)
                except Exception as e_final:
                    logger.exception("Validation of sanitized LLM candidate failed for profile %s: %s", profile_id, e_final)
                    diagnostics.update({"status": "failed", "error": f"validation failed: {e_final}", "error_code": error_code, "user_message": user_message})
                    meta = profile.meta or {}
                    meta["llmError"] = str(e_final)
                    meta["llmErrorCode"] = error_code
                    meta["llmUserMessage"] = user_message
                    profile.meta = meta
                    sess.add(profile)
                    safe_commit(sess, "llm_refine_profile:validation_failed_persist_profile")
                    # Leave validated as None; we'll still attempt to persist LLMHistory with raw response for diagnostics
                    validated = None
        except Exception as e:
            error_code = PipelineError.UNKNOWN.value # Or a more specific code if applicable
            user_message = ERROR_MESSAGES.get(error_code, ERROR_MESSAGES[PipelineError.UNKNOWN.value])
            logger.exception("Unexpected error during LLM normalization/validation for profile %s: %s", profile_id, e)
            diagnostics.update({"status": "failed", "error": f"normalization failed: {e}", "error_code": error_code, "user_message": user_message})
            meta = profile.meta or {}
            meta["llmError"] = str(e)
            meta["llmErrorCode"] = error_code
            meta["llmUserMessage"] = user_message
            profile.meta = meta
            sess.add(profile)
            safe_commit(sess, "llm_refine_profile:normalization_failed_persist_profile")
            return diagnostics

        # Build original snapshot for patch computation
        original = {
            "name": profile.name,
            "email": profile.email,
            "summary": profile.summary,
            "skills": profile.skills,
            "experience": profile.experience,
            "education": getattr(profile, "education", None),
            "achievements": getattr(profile, "achievements", None),
            "rawText": profile.raw_text,
            "confidence": profile.confidence,
        } if profile else {}

        # Candidate from LLM (as NormalizedProfile)
        # If validation failed above (validated is None) fall back to the raw LLM response
        if validated is None:
            logger.warning(
                "LLM validation returned None for profile %s — falling back to raw candidate. raw_candidate keys: %s",
                profile_id,
                list(raw_candidate.keys()) if isinstance(raw_candidate, dict) else "<not-a-dict>",
            )
            candidate = raw_candidate if isinstance(raw_candidate, dict) else {}
            # Ensure we have a minimal Validated object so downstream code can safely access attributes
            try:
                validated = NormalizedProfile(confidence=float(candidate.get("confidence", 0.5)))
            except Exception:
                # As a last resort instantiate with a safe confidence value
                try:
                    validated = NormalizedProfile(confidence=0.5)
                except Exception:
                    # If even this fails, create a very small shim object with needed attributes
                    class _Shim:
                        confidence = 0.5
                    validated = _Shim()
        else:
            # Defensive .dict() to avoid AttributeError if `validated` is unexpectedly not a Pydantic model.
            # Preserve exclude_unset behavior for consistency.
            candidate = validated.dict(exclude_unset=True) if hasattr(validated, "dict") else validated

        # --- Normalization & mapping helpers ---
        def _pick(d: dict, *keys):
            for k in keys:
                if k in d and d[k] not in (None, "", []):
                    return d[k]
            return None

        def _normalize_education(entries):
            out = []
            if not entries:
                return out
            for e in entries:
                if not isinstance(e, dict):
                    continue
                degree = _pick(e, "degree", "program", "qualification", "title")
                school = _pick(e, "school", "institution", "organisation", "organization", "provider", "institution_name", "location")
                start = _pick(e, "startDate", "start_date", "start")
                end = _pick(e, "endDate", "end_date", "end")
                # prefer courseCurriculum/course_curriculum or a description field
                desc = _pick(e, "courseCurriculum", "course_curriculum", "courseCurricula", "description", "details")
                if isinstance(desc, list):
                    description = "; ".join([str(x).strip() for x in desc if x])
                else:
                    description = str(desc).strip() if desc else None
                field = _pick(e, "fieldOfStudy", "field_of_study", "major")
                out.append(
                    {
                        "degree": degree or None,
                        "school": school or None,
                        "startDate": start or None,
                        "endDate": end or None,
                        "description": description or None,
                        "fieldOfStudy": field or None,
                    }
                )
            return out

        def _looks_like_achievement(s: str) -> bool:
            if not s or not isinstance(s, str):
                return False
            return bool(re.search(r"\b(reduced|decreased|increased|improved|cut|boost|saved|implemented|achieved|award|%|\d+%|improvement)\b", s, re.I))

        def _normalize_experience(entries):
            """
            Normalize experience-like entries while avoiding accidentally consuming education rows.
            Heuristics:
             - Skip entries that clearly look like education (contain degree/school keys).
             - Accept common keys for title/company and coerce list descriptions into strings.
             - Keep achievement-looking sentences out of experience.description.
            """
            out = []
            if not entries:
                return out
            for e in entries:
                if not isinstance(e, dict):
                    continue

                # Skip entries that appear to be education rows (they belong in education)
                edu_like = _pick(e, "degree", "program", "qualification", "title", "school", "institution", "organisation", "organization")
                if edu_like and (("degree" in e) or ("school" in e) or ("institution" in e) or ("program" in e)):
                    # Likely an education entry that was mis-routed; ignore here.
                    continue

                # Accept common keys from various LLM payload shapes
                title = _pick(e, "title", "position", "role", "jobTitle")
                company = _pick(e, "company", "employer", "organization", "organisation", "company_name")
                start = _pick(e, "startDate", "start_date", "start")
                end = _pick(e, "endDate", "end_date", "end")
                # description/responsibilities/responsibility
                desc = _pick(e, "description", "responsibilities", "responsibility", "details")
                # If responsibilities is a list, join into string
                if isinstance(desc, list):
                    desc_lines = [str(x).strip() for x in desc if x]
                    desc = " ".join(desc_lines) if desc_lines else None
                # Filter out pure achievement-only descriptions
                if desc and _looks_like_achievement(desc):
                    # If a description looks like achievements, keep it out of experience description
                    desc = None
                # Final defensive: require at least company or title or dates or description
                if not (company or title or start or end or desc):
                    continue
                out.append(
                    {
                        "title": title or None,
                        "company": company or None,
                        "startDate": start or None,
                        "endDate": end or None,
                        "description": desc or None,
                    }
                )
            return out

        def _normalize_string_for_verify(s: str) -> str:
            if not s:
                return ""
            # NFD normalize and remove diacritics/combining marks
            try:
                s = s.normalize("NFD")
                s = re.sub(r"[\u0300-\u036f]", "", s)
            except Exception:
                pass
            # lower, remove punctuation, collapse whitespace
            s = s.lower()
            s = re.sub(r"[^\w\s]", " ", s)
            s = re.sub(r"\s+", " ", s).strip()
            return s

        # Extract parsed payload when LLM returned a richer "parsed" object
        parsed_block = llm_resp.get("parsed") if isinstance(llm_resp, dict) else None
        # Candidate may already contain experience/education; if not, try to populate from "parsed"
        raw_edu = candidate.get("education") or (parsed_block and parsed_block.get("education")) or parsed_block and parsed_block.get("education_list") or None
        raw_exp = candidate.get("experience") or (parsed_block and parsed_block.get("experience")) or (parsed_block and parsed_block.get("employmentHistory")) or (parsed_block and parsed_block.get("employment_history")) or None

        # Normalize education
        mapped_edu = _normalize_education(raw_edu) if raw_edu else []
        # Normalize experience
        mapped_exp = _normalize_experience(raw_exp) if raw_exp else []

        # Post-process experience entries to extract achievements and try to salvage title/company from free text
        extracted_achievements = []
        try:
            for exp in mapped_exp:
                # work defensively in case description is not a string
                desc = exp.get("description") if isinstance(exp, dict) else None
                if not desc or not isinstance(desc, str):
                    continue

                # Split description into candidate sentences/lines
                # Keep punctuation boundaries so we can spot achievement phrases containing % or numbers.
                sentences = re.split(r'(?<=[\.\!\?\n])\s+|\n+', desc)
                kept_sentences = []
                for s in sentences:
                    s_trim = s.strip()
                    if not s_trim:
                        continue
                    # If sentence looks like an achievement, move it to extracted_achievements
                    if _looks_like_achievement(s_trim):
                        extracted_achievements.append(s_trim)
                        continue
                    # Try to extract "Title at Company" patterns if title/company missing
                    if (not exp.get("title") or not exp.get("company")):
                        # Try multiple common patterns in order to salvage title/company from a single line.
                        patterns = [
                            r'^(?P<title>[^@,\n]+?)\s+(?:@|at)\s+(?P<company>.+)$',
                            r'^(?P<company>.+?)\s+[-–|]\s+(?P<title>.+)$',
                            r'^(?P<title>[^,]+?),\s*(?P<company>.+)$',
                            r'^(?P<company>[^,]+?),\s*(?P<title>.+)$',
                        ]
                        found = False
                        for pat in patterns:
                            try:
                                m = re.match(pat, s_trim, flags=re.I)
                            except Exception:
                                m = None
                            if m:
                                if not exp.get("title") and m.groupdict().get("title"):
                                    exp["title"] = m.group("title").strip()
                                if not exp.get("company") and m.groupdict().get("company"):
                                    exp["company"] = m.group("company").strip()
                                found = True
                                # do not keep this sentence as part of description if we pulled title/company from it
                                break
                        if found:
                            continue
                    kept_sentences.append(s_trim)
                # Reconstruct description from non-achievement sentences
                exp["description"] = " ".join(kept_sentences).strip() if kept_sentences else None
        except Exception:
            # Non-fatal — if something goes wrong we continue with original mapped_exp
            logger.exception("Failed to post-process experience entries for achievements/title extraction")

        # Ensure achievements extracted (from parsed or top-level) and merge with any extracted from experience
        # Defensive: candidate may be None in some failure paths; treat safely.
        if isinstance(candidate, dict):
            achievements = candidate.get("achievements") or (parsed_block and parsed_block.get("achievements")) or (candidate.get("metadata") or {}).get("achievements") or None
        else:
            achievements = (parsed_block and parsed_block.get("achievements")) or None

        def _split_achievements_string(s: str):
            # split on common bullets/newlines; keep actual sentence punctuation intact
            parts = [a.strip() for a in re.split(r"[\n\u2022•]+", s) if a.strip()]
            return parts

        # Normalize string -> list
        if isinstance(achievements, str):
            try:
                achievements = _split_achievements_string(achievements)
            except Exception:
                achievements = [achievements]

        # If LLM returned a fragmented list (short fragments), try to reassemble into sentences.
        if isinstance(achievements, list):
            cleaned = []
            buffer = ""
            for item in achievements:
                it = str(item).strip()
                if not it:
                    continue
                # If item ends with sentence punctuation or is long, treat as complete.
                if re.search(r"[.!?%]\s*$", it) or len(it) > 60:
                    if buffer:
                        buffer = (buffer + " " + it).strip()
                        cleaned.append(buffer)
                        buffer = ""
                    else:
                        cleaned.append(it)
                else:
                    # short fragment: accumulate into buffer
                    if buffer:
                        buffer = buffer + " " + it
                    else:
                        buffer = it
            if buffer:
                cleaned.append(buffer)
            achievements = cleaned if cleaned else None

        # Merge extracted_achievements into achievements (dedupe & preserve order)
        if extracted_achievements:
            if isinstance(achievements, list):
                merged = list(dict.fromkeys([*achievements, *extracted_achievements]))
            else:
                merged = list(dict.fromkeys(extracted_achievements))
            achievements = merged if merged else None

        # If summary missing, try parsed.profile or parsed.summary
        summary_candidate = candidate.get("summary") or (parsed_block and _pick(parsed_block, "profile", "summary"))

        # Attach normalized and mapped structures back to candidate for downstream storage + patch generation
        if mapped_edu:
            candidate["education"] = mapped_edu
        if mapped_exp:
            candidate["experience"] = mapped_exp
        if achievements:
            candidate["achievements"] = achievements
        if summary_candidate:
            candidate["summary"] = summary_candidate

        # Add normalized strings to candidate for client-side verification use
        norm = {
            "rawText": _normalize_string_for_verify(candidate.get("rawText") or profile.raw_text or ""),
            "summary": _normalize_string_for_verify(candidate.get("summary") or ""),
            "name": _normalize_string_for_verify(candidate.get("name") or ""),
            "email": _normalize_string_for_verify(candidate.get("email") or ""),
        }
        candidate["_normalized_for_verify"] = norm

        # Compute patch after normalization so diffs are meaningful
        patch = compute_minimal_patch(original, candidate)

        # Persist LLM history and try to attach the current RQ job id when available.
        # Robust flow:
        # 1) Try to discover the current RQ job id via get_current_job()
        # 2) If a placeholder LLMHistory row was created at enqueue time (job_id present),
        #    update that row in-place with the full response so consumers can look it up by job id.
        # 3) Otherwise fall back to inserting a new LLMHistory row (as before).
        try:
            try:
                job = get_current_job()
                job_id_val = job.get_id() if job and hasattr(job, "get_id") else None
            except Exception:
                job_id_val = None

            # Fallback to correlation id passed at enqueue time (positional arg)
            if not job_id_val and correlation_job_id:
                job_id_val = correlation_job_id

            updated = False
            existing = None

            # Prefer deterministic primary-key lookup using the correlation_job_id (placeholder.id).
            if correlation_job_id:
                try:
                    from uuid import UUID

                    try:
                        placeholder_uuid = UUID(str(correlation_job_id))
                        existing = sess.get(LLMHistory, placeholder_uuid)
                    except Exception:
                        existing = None
                except Exception:
                    # uuid import shouldn't fail, but guard anyway
                    existing = None

            # If no primary-key match, fall back to previous job_id-based lookup.
            if existing is None and job_id_val is not None:
                try:
                    existing = (
                        sess.query(LLMHistory)
                        .filter(LLMHistory.job_id == job_id_val, LLMHistory.profile_id == profile.id)
                        .order_by(LLMHistory.run_time.desc())
                        .first()
                    )
                except Exception:
                    logger.exception("Failed job_id lookup for LLMHistory job %s", job_id_val)
                    existing = None

            # If we found an existing placeholder (by id or job_id), update it in-place.
            if existing:
                try:
                    existing.full_response = {"parsed": llm_resp, "patch": patch}
                    existing.confidence = float(validated.confidence) if getattr(validated, "confidence", None) is not None else None
                    existing.provider = os.getenv("PDF_INGEST_LLM_PROVIDER", None)
                    existing.model = os.getenv("MISTRAL_MODEL", None) or os.getenv("OPENAI_MODEL", None)
                    existing.merged = False
                    # Ensure job_id is set for discoverability (use job_id_val if available, else set to string of the PK)
                    try:
                        if job_id_val:
                            existing.job_id = job_id_val
                        elif existing.job_id is None:
                            existing.job_id = str(existing.id)
                    except Exception:
                        # non-fatal; proceed to persist other fields
                        logger.exception("Failed to set job_id on existing LLMHistory %s", getattr(existing, "id", None))
                    sess.add(existing)
                    safe_commit(sess, "llm_refine_profile:update_existing_llm_history")
                    updated = True
                    logger.info("Updated existing LLMHistory (placeholder or job match) id=%s job_id=%s profile=%s", getattr(existing, "id", None), getattr(existing, "job_id", None), profile_id)
                except Exception:
                    logger.exception("Failed to update existing LLMHistory for profile %s (id/job=%s/%s)", profile_id, getattr(existing, "id", None), getattr(existing, "job_id", None))
                    try:
                        sess.rollback()
                    except Exception:
                        logger.exception("Rollback failed after existing update failure for %s", profile_id)

            # If no placeholder was updated, insert a fresh LLMHistory row.
            if not updated:
                llm_hist = LLMHistory(
                    profile_id=profile.id,
                    provider=os.getenv("PDF_INGEST_LLM_PROVIDER", None),
                    model=os.getenv("MISTRAL_MODEL", None) or os.getenv("OPENAI_MODEL", None),
                    job_id=job_id_val or (str(correlation_job_id) if correlation_job_id else None),
                    request_payload=None,
                    response_snippet=None,
                    full_response={"parsed": llm_resp, "patch": patch},
                    confidence=float(validated.confidence)
                    if getattr(validated, "confidence", None) is not None
                    else None,
                    merged=False,
                )
                sess.add(llm_hist)
                safe_commit(sess, "llm_refine_profile:insert_llm_history")
        except Exception:
            logger.exception("Failed to write llm_history for profile %s", profile_id)
            try:
                sess.rollback()
            except Exception:
                logger.exception(
                    "Failed to rollback after llm_history write failure for %s", profile_id
                )

        # Attempt to persist canonical profile to Convex (backend-authoritative write).
        # Choose the LLMHistory row that was updated/created above so the UI can poll its convex_* fields.
        llm_row = None
        try:
            if existing:
                llm_row = existing
            elif "llm_hist" in locals():
                llm_row = llm_hist
        except Exception:
            llm_row = None

        if llm_row is not None:
            # Build payload following the agreed contract

            # Generate or reuse idempotency key and persist 'pending' state before calling Convex
            idempotency_key = str(_uuid.uuid4())

            # Persist idempotency key and mark pending on the llm_history row so frontends can poll.
            try:
                # ensure llm_row is attached and persisted
                if getattr(llm_row, "convex_idempotency_key", None) is None:
                    llm_row.convex_idempotency_key = idempotency_key
                else:
                    # reuse existing key
                    idempotency_key = llm_row.convex_idempotency_key

                # mark pending and increment attempts
                llm_row.convex_write_status = "pending"
                llm_row.convex_attempts = (llm_row.convex_attempts or 0) + 1
                llm_row.convex_last_attempt_at = int(time.time() * 1000)
                sess.add(llm_row)
                safe_commit(sess, "llm_refine_profile:set_convex_pending_metadata")
            except Exception:
                # If we fail to persist metadata, log and continue (we still attempt Convex call)
                logger.exception("Failed to persist convex metadata (idempotency/attempts) for llm_row %s", getattr(llm_row, "id", None))

        # Prepare cleaned profile payload for Convex: only include fields upsertProfile expects.
        def _clean_for_convex(candidate_profile: dict) -> dict:
            cleaned = {}
            # strings
            for k in ("name", "email", "summary"):
                v = candidate_profile.get(k)
                if v is not None:
                    try:
                        s = str(v).strip()
                        if s:
                            cleaned[k] = s
                    except Exception:
                        pass
            # arrays of strings
            def _clean_string_list(arr):
                if not isinstance(arr, list):
                    return []
                out = []
                seen = set()
                for it in arr:
                    if it is None:
                        continue
                    try:
                        s = str(it).strip()
                    except Exception:
                        continue
                    if not s or s in seen:
                        continue
                    seen.add(s)
                    out.append(s)
                return out

            skills = candidate_profile.get("skills") or []
            achievements = candidate_profile.get("achievements") or []
            cleaned["skills"] = _clean_string_list(skills)
            cleaned["achievements"] = _clean_string_list(achievements)

            # experience/education coercion to expected Convex shape
            def _coerce_experience(exp):
                if not isinstance(exp, list):
                    return []
                out = []
                for e in exp:
                    if not isinstance(e, dict):
                        continue
                    out.append(
                        {
                            "title": e.get("title") or e.get("jobTitle") or None,
                            "company": e.get("company") or e.get("employer") or None,
                            "startDate": e.get("startDate") or e.get("start") or None,
                            "endDate": e.get("endDate") or e.get("end") or None,
                            "current": bool(e.get("current")) if e.get("current") is not None else False,
                            "description": e.get("description") or e.get("details") or None,
                        }
                    )
                return out

            def _coerce_education(edus):
                if not isinstance(edus, list):
                    return []
                out = []
                for e in edus:
                    if not isinstance(e, dict):
                        continue
                    out.append(
                        {
                            "degree": e.get("degree") or e.get("program") or None,
                            "school": e.get("school") or e.get("institution") or None,
                            "startDate": e.get("startDate") or e.get("start") or None,
                            "endDate": e.get("endDate") or e.get("end") or None,
                            "description": e.get("description") or e.get("details") or None,
                        }
                    )
                return out

            cleaned["experience"] = _coerce_experience(candidate_profile.get("experience") or [])
            cleaned["education"] = _coerce_education(candidate_profile.get("education") or [])
            return cleaned

        # Decide whether to persist to Convex based on confidence
        conf_val = None
        try:
            conf_val = float(candidate.get("confidence")) if isinstance(candidate, dict) and candidate.get("confidence") is not None else float(getattr(validated, "confidence", 0.5))
        except Exception:
            conf_val = 0.5

        CONF_THRESHOLD = float(os.getenv("CONVEX_CONFIDENCE_THRESHOLD", "0.6"))

        cleaned_profile_for_convex = _clean_for_convex(candidate if isinstance(candidate, dict) else {})

        action_path = os.getenv("CONVEX_ACTION_PATH", "/api/actions/persistProfile")

        # If confidence is too low, skip final Convex persist but mark llm_history accordingly.
        if conf_val < CONF_THRESHOLD:
            logger.info("Skipping Convex persist for profile %s due to low confidence %s (threshold %s)", profile_id, conf_val, CONF_THRESHOLD)
            try:
                if llm_row is not None:
                    llm_row.convex_write_status = "skipped_low_confidence"
                    llm_row.convex_error = f"low_confidence:{conf_val}"
                    sess.add(llm_row)
                    safe_commit(sess, "llm_refine_profile:mark_skipped_low_confidence")
                # Persist meta flag on profile so frontends can show verification required
                merged_meta = dict(profile.meta or {})
                merged_meta["llmRefined"] = True
                merged_meta["llmConfidence"] = conf_val
                merged_meta["llmPersisted"] = False
                profile.meta = merged_meta
                sess.add(profile)
                safe_commit(sess, "llm_refine_profile:mark_profile_skipped_low_confidence")
            except Exception:
                logger.exception("Failed to mark low-confidence skip for profile %s", profile_id)

            # Do not call Convex
            convex_payload = None
        else:
            # Build convex payload
            convex_payload = {
                "profileId": str(profile.id),
                "idempotencyKey": idempotency_key,
                "source": "llm_refine",
                "version": 1,
                "profile": cleaned_profile_for_convex,
            }

        try:
            if convex_payload is None:
                resp = None
            else:
                # worker runs synchronously under RQ; call_convex_action is async.
                # Use asyncio.run normally, but guard against RuntimeError in the
                # unlikely event an event loop is already running (defensive).
                try:
                    resp = asyncio.run(call_convex_action(action_path, convex_payload))
                except RuntimeError:
                    # Fallback: create a new event loop and run the coroutine to completion.
                    loop = asyncio.new_event_loop()
                    try:
                        resp = loop.run_until_complete(call_convex_action(action_path, convex_payload))
                    finally:
                        try:
                            loop.close()
                        except Exception:
                            pass

            # Compute placeholder id once (prefer correlation_job_id, fall back to llm_row.id)
            placeholder_id_to_update = (
                correlation_job_id
                or (str(getattr(llm_row, "id", None)) if llm_row is not None else None)
            )

            # Persist success metadata on the llm_history row if possible
            try:
                if placeholder_id_to_update:
                    mark_convex_write_success(placeholder_id_to_update)
                    # also persist idempotency key & written timestamp on the llm_row (best-effort)
                    try:
                        if getattr(llm_row, "convex_idempotency_key", None) is None:
                            llm_row.convex_idempotency_key = idempotency_key
                        llm_row.convex_write_status = "success"
                        llm_row.convex_error = None
                        llm_row.convex_written_at = int(time.time() * 1000)
                        sess.add(llm_row)
                        safe_commit(sess, "llm_refine_profile:convex_success_persist")
                    except Exception:
                        logger.exception("Failed to persist convex success metadata for llm_row %s", getattr(llm_row, "id", None))
                else:
                    logger.warning("No placeholder id available to mark convex success for profile %s", profile_id)
            except Exception as e:
                error_code = PipelineError.UNKNOWN.value
                user_message = ERROR_MESSAGES.get(error_code, ERROR_MESSAGES[PipelineError.UNKNOWN.value])
                logger.exception("Failed to mark convex success for profile %s placeholder %s", profile_id, placeholder_id_to_update)
                diagnostics.update({"status": "failed", "error": f"convex_success_mark_failed: {e}", "error_code": error_code, "user_message": user_message})
                # Do not return, allow the rest of the function to complete

            logger.info(
                "Convex persist succeeded for profile %s idempotency=%s resp=%s",
                profile_id,
                idempotency_key,
                repr(resp)[:200],
            )
        except ConvexPersistError as cpe:
            placeholder_id_to_update = (
                correlation_job_id
                or (str(getattr(llm_row, "id", None)) if llm_row is not None else None)
            )

            # Persist failure metadata and error
            error_code = PipelineError.CONVEX_TIMEOUT.value # Assuming ConvexPersistError implies timeout/connectivity
            user_message = ERROR_MESSAGES.get(error_code, ERROR_MESSAGES[PipelineError.UNKNOWN.value])
            try:
                if placeholder_id_to_update:
                    mark_convex_write_failure(placeholder_id_to_update, str(cpe))
                    try:
                        llm_row.convex_write_status = "failed"
                        llm_row.convex_error = str(cpe)
                        llm_row.convex_last_attempt_at = int(time.time() * 1000)
                        sess.add(llm_row)
                        safe_commit(sess, "llm_refine_profile:convex_failure_persist")
                    except Exception:
                        logger.exception("Failed to persist convex failure metadata for llm_row %s", getattr(llm_row, "id", None))
                else:
                    logger.warning("No placeholder id available to mark convex failure for profile %s", profile_id)
            except Exception as e:
                logger.exception("Failed to mark convex failure for profile %s placeholder %s", profile_id, placeholder_id_to_update)
                diagnostics.update({"status": "failed", "error": f"convex_failure_mark_failed: {e}", "error_code": error_code, "user_message": user_message})
                # Do not return, allow the rest of the function to complete

            logger.warning("Convex persist failed for profile %s: %s (code: %s)", profile_id, cpe, error_code)
            diagnostics.update({"status": "failed", "error": f"convex_persist_failed: {cpe}", "error_code": error_code, "user_message": user_message})
        except Exception as e:
            error_code = PipelineError.UNKNOWN.value
            user_message = ERROR_MESSAGES.get(error_code, ERROR_MESSAGES[PipelineError.UNKNOWN.value])
            logger.exception("Convex persist attempt failed unexpectedly for profile %s", profile_id)
            diagnostics.update({"status": "failed", "error": f"convex_persist_unexpected_error: {e}", "error_code": error_code, "user_message": user_message})

        # Apply normalized candidate fields to profile (prefer normalized candidate)
        # candidate is a plain dict after normalization/mapping above.
        profile.name = candidate.get("name") or validated.name
        profile.email = candidate.get("email") or validated.email
        profile.summary = candidate.get("summary") or validated.summary
        profile.skills = candidate.get("skills") or validated.skills
        # experience: candidate may contain normalized list of dicts; validated.experience are pydantic models
        if candidate.get("experience") is not None:
            profile.experience = candidate.get("experience")
        else:
            # Defensive .dict() for list items to handle both Pydantic models and plain dicts.
            profile.experience = [(item.dict(exclude_unset=True) if hasattr(item, "dict") else item) for item in validated.experience] if validated.experience else None
        # education: prefer candidate normalized mapping
        if candidate.get("education") is not None:
            profile.education = candidate.get("education")
        else:
            profile.education = getattr(profile, "education", None)
        # achievements
        if candidate.get("achievements") is not None:
            profile.achievements = candidate.get("achievements")
        else:
            profile.achievements = getattr(profile, "achievements", None)
        # rawText: do not nullify existing raw_text; only overwrite if candidate provides one
        if candidate.get("rawText"):
            profile.raw_text = candidate.get("rawText")
        # confidence: prefer candidate confidence if present
        try:
            conf_val = candidate.get("confidence") if candidate.get("confidence") is not None else validated.confidence
            profile.confidence = float(conf_val) if conf_val is not None else None
        except Exception:
            profile.confidence = float(validated.confidence)

        # Merge meta from candidate and ensure flags, then persist
        llm_candidate = candidate if isinstance(candidate, dict) else {}
        llm_meta = {}
        if isinstance(llm_candidate.get("meta"), dict):
            llm_meta = dict(llm_candidate.get("meta"))
        elif isinstance(llm_candidate.get("metadata"), dict):
            llm_meta = dict(llm_candidate.get("metadata"))

        merged_meta = dict(profile.meta or {})
        merged_meta.update(llm_meta)
        # Ensure flags
        merged_meta["llmRefined"] = True
        merged_meta["llmConfidence"] = (
            float(validated.confidence)
            if getattr(validated, "confidence", None) is not None
            else None
        )
        # Add error codes and user messages to meta for frontend consumption
        if "error_code" in diagnostics:
            merged_meta["llmErrorCode"] = diagnostics["error_code"]
            merged_meta["llmUserMessage"] = diagnostics["user_message"]
        profile.meta = merged_meta
        logger.info("WORKER_META_MERGED %s %s", str(profile.id), merged_meta)

        sess.add(profile)
        # Finalize persistence
        sess.flush()
        safe_commit(sess, "llm_refine_profile:final_profile_persist")

        # As a defensive raw-SQL fallback ensure JSONB is updated (some JSONB mutations can be tricky across sessions)
        try:
            from sqlalchemy import text as sa_text

            sess.execute(sa_text("UPDATE profiles SET meta = :meta WHERE id = :id"), {"meta": json.dumps(merged_meta), "id": str(profile.id)})
            try:
                sess.commit()
            except Exception:
                # ignore if second commit fails
                pass
        except Exception:
            logger.exception("Raw SQL update of meta failed for %s (non-fatal)", profile_id)

        # Verify with a fresh session
        try:
            with get_sync_session() as _verify_sess:
                fresh = _verify_sess.get(Profile, profile.id)
                try:
                    _verify_sess.refresh(fresh)
                except Exception:
                    _verify_sess.expire_all()
                    fresh = _verify_sess.get(Profile, profile.id)
                logger.info("DEBUG_META_AFTER_COMMIT_FRESH %s %s", profile_id, fresh.meta)
        except Exception:
            logger.exception("Fresh-session verification failed for %s", profile_id)

        diagnostics.update({"status": "ok", "confidence": float(validated.confidence)})
        return diagnostics

    # Support both direct session injection (for tests) and RQ enqueue where the positional
    # second argument is correlation_job_id. The signature places correlation_job_id as the
    # second parameter; if `session` is a str it was actually passed as the correlation id.
    if isinstance(session, str) and correlation_job_id is None:
        # caller passed correlation_job_id into the `session` slot; shift it.
        correlation_job_id = session
        session = None

    if session is not None:
        logger.debug("llm_refine_profile called with injected session for profile_id=%s correlation_job_id=%s", profile_id, correlation_job_id)
        return _run_with_session(session)
    else:
        logger.debug("llm_refine_profile will open a new sync session for profile_id=%s correlation_job_id=%s", profile_id, correlation_job_id)
        with get_sync_session() as s:
            return _run_with_session(s)


def enqueue_llm_cleanup(profile_id: str) -> Any:
    """
    Create (or reuse) a deterministic placeholder LLMHistory row first, then enqueue the worker
    passing the placeholder.id as the correlation identifier. The worker will update the placeholder
    (lookup by LLMHistory.id) when processing completes. This avoids relying on RQ-generated job ids
    and reduces races where the frontend cannot find the LLMHistory row.

    NOTE: Be defensive about non-UUID profile_id values (e.g., diagnostic placeholders like
    "placeholder-..."). If profile_id is not a valid UUID we skip creating a DB-backed placeholder
    to avoid inserting an invalid UUID into the llm_history.profile_id UUID column. In that case
    we still enqueue the RQ job but return no placeholder id.
    """
    placeholder_id = None
    logger.debug("enqueue_llm_cleanup start: profile_id=%s REDIS_URL=%s", profile_id, REDIS_URL)
    try:
        # Try to interpret the incoming profile_id as a UUID. If it's not a UUID we will
        # avoid creating a llm_history placeholder row (which requires a valid UUID for profile_id).
        # Use a defensive UUID parser that handles placeholder-<uuid> tokens and never raises.
        pid_uuid = parse_profile_uuid_safe(profile_id)
        if pid_uuid is None and isinstance(profile_id, str) and profile_id.startswith('placeholder-'):
            logger.info("enqueue_llm_cleanup: profile_id is a placeholder with invalid UUID format (%s). Skipping DB placeholder creation.", profile_id)
        elif pid_uuid is None:
            logger.info("enqueue_llm_cleanup: profile_id is not a valid UUID (%s). Skipping DB placeholder creation.", profile_id)

        if pid_uuid is None:
            logger.info("enqueue_llm_cleanup: profile_id is not a valid UUID (%s). Skipping DB placeholder creation.", profile_id)
        else:
            # Only attempt DB placeholder creation when we have a valid profile UUID and the profile exists in the database.
            with get_sync_session() as s:
                logger.debug("enqueue_llm_cleanup: acquired sync session for profile_id=%s", profile_id)

                # First check if the profile actually exists in the database
                # Retry briefly to mitigate races where the web process hasn't yet committed.
                import time as _time
                profile_exists = False
                max_wait_secs = float(os.getenv("ENQUEUE_PROFILE_WAIT_SECS", "2.0"))
                poll_interval_ms = int(os.getenv("ENQUEUE_PROFILE_POLL_INTERVAL_MS", "200"))
                attempts = max(1, int((max_wait_secs * 1000) // poll_interval_ms))
                for _ in range(attempts):
                    try:
                        if s.get(Profile, pid_uuid) is not None:
                            profile_exists = True
                            break
                    except Exception:
                        profile_exists = False
                    _time.sleep(poll_interval_ms / 1000.0)

                if not profile_exists:
                    logger.warning(
                        "Profile %s does not exist in database after waiting %.2fs, skipping placeholder creation",
                        profile_id,
                        max_wait_secs,
                    )
                    placeholder_id = None
                else:
                    # Idempotency: try to find an existing in-progress placeholder for this profile.
                    # Criteria: same profile_id, not merged, and no full_response yet.
                    existing = None
                    try:
                        existing = (
                            s.query(LLMHistory)
                            .filter(
                                LLMHistory.profile_id == pid_uuid,
                                LLMHistory.merged == False,
                                LLMHistory.full_response == None,
                            )
                            .order_by(LLMHistory.run_time.desc())
                            .first()
                        )
                    except Exception:
                        existing = None

                    if existing:
                        placeholder_id = str(existing.id)
                        # Ensure job_id is set to the placeholder id for discoverability
                        try:
                            if not existing.job_id:
                                existing.job_id = placeholder_id
                                s.add(existing)
                                s.commit()
                        except Exception:
                            logger.exception("Failed to persist job_id on existing placeholder %s", placeholder_id)
                        logger.info("Reusing existing placeholder LLMHistory id=%s for profile %s", placeholder_id, profile_id)
                    else:
                        # Create a new placeholder row
                        placeholder = LLMHistory(
                            profile_id=pid_uuid,
                            provider=os.getenv("PDF_INGEST_LLM_PROVIDER", None),
                            model=os.getenv("MISTRAL_MODEL", None) or os.getenv("OPENAI_MODEL", None),
                            job_id=None,
                            request_payload=None,
                            response_snippet=None,
                            full_response=None,
                            confidence=None,
                            merged=False,
                        )
                        s.add(placeholder)
                        s.commit()
                        s.refresh(placeholder)
                        placeholder_id = str(placeholder.id)
                        # Persist the placeholder.id into the job_id column so the worker can reliably
                        # look up this row by job_id == correlation id.
                        try:
                            placeholder.job_id = placeholder_id
                            s.add(placeholder)
                            s.commit()
                        except Exception:
                            # best-effort: log and continue (placeholder exists even if job_id write failed)
                            logger.exception("Failed to set placeholder.job_id for placeholder %s", placeholder_id)
                        logger.info("Created placeholder LLMHistory (pre-enqueue) id=%s for profile %s", placeholder_id, profile_id)
    except Exception:
        logger.exception("Failed to create or reuse placeholder LLMHistory before enqueue for profile %s", profile_id)
        placeholder_id = None

    # Enqueue the job and pass placeholder_id as a keyword arg (kwargs) to avoid
    # positional-argument mismatch across different deployed worker versions.
    try:
        if placeholder_id is not None:
            # Use kwargs so older worker code that expects (profile_id, session=None, correlation_job_id=None)
            # won't accidentally receive the placeholder_id in the `session` positional slot.
            job = queue.enqueue(
                llm_refine_profile,
                args=(profile_id,),
                kwargs={"correlation_job_id": placeholder_id},
            )
        else:
            job = queue.enqueue(llm_refine_profile, args=(profile_id,), kwargs={})
        try:
            job_id_logged = job.get_id() if hasattr(job, "get_id") else str(getattr(job, "id", ""))
        except Exception:
            job_id_logged = None
        logger.info(
            "Enqueued llm_refine_profile: job_id=%s profile_id=%s placeholder_id=%s",
            job_id_logged,
            profile_id,
            placeholder_id,
        )
    except Exception:
        # If enqueue fails, log and re-raise to let callers handle it.
        logger.exception(
            "Failed to enqueue llm_refine_profile for profile %s placeholder %s",
            profile_id,
            placeholder_id,
        )
        raise

    return {"job": job, "placeholder_id": placeholder_id}


if __name__ == "__main__":
    import sys
    pid = sys.argv[1] if len(sys.argv) > 1 else "test-profile-id"
    job = enqueue_llm_cleanup(pid)
    print("Enqueued job:", job.get_id())
