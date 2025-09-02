"""
Minimal FastAPI PDF ingest scaffold (MVP)

Features:
- POST /api/v1/parse-now : synchronous parsing endpoint (accepts small PDF) -> returns normalized JSON
- POST /api/v1/upload    : accepted upload -> returns jobId, background parse (in-memory job store)
- GET  /api/v1/jobs/{id} : check job status / result

Parsing:
- Uses pdfplumber for text extraction (text PDFs).
- If extracted text is very small (scanned PDF heuristic), will attempt OCR via pytesseract + pdf2image (optional, requires system poppler and tesseract).
- Simple deterministic heuristics extract name, email, summary, skills, experience.
- Optional: when confidence < threshold, you can call an LLM (not included here) to refine output.

Run:
- pip install -r requirements.txt
- uvicorn app:app --reload --port 8000

Notes:
- This is a single-file scaffold intended to be dropped into a new repo or folder.
- For production use: move parsing to worker (Celery/RQ), persist files to S3, persist results to Postgres, secure endpoints and add auth.
"""

from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

import uuid
import io
import re
import asyncio
import time
import base64
from pdfminer.high_level import extract_text as pdfminer_extract_text


# OCR not enabled in this scaffold. Use a cloud OCR or install pdf2image/pytesseract if needed.
OCR_AVAILABLE = False

from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db import get_session, init_db
from models import Profile, LLMHistory
from sqlalchemy.future import select
from uuid import UUID

def parse_profile_uuid_safe(profile_id: Any) -> Optional[UUID]:
    """
    Parse a profile_id value into a UUID when possible.

    Returns:
      - UUID instance when profile_id is a valid UUID or a placeholder-<uuid> with a valid UUID suffix
      - None when profile_id is a placeholder with an invalid UUID suffix or otherwise not a valid UUID

    This helper is defensive and never raises; callers should treat None as "do not perform DB writes that require a UUID".
    """
    try:
        if isinstance(profile_id, str) and profile_id.startswith("placeholder-"):
            uuid_part = profile_id[len("placeholder-") :]
            try:
                return UUID(uuid_part)
            except Exception:
                return None
        return UUID(str(profile_id))
    except Exception:
        return None
import logging
# Router for assembling full raw text
from routers.full_raw_text import router as full_raw_text_router
# Import the new router for the confirm-save endpoint
from routers.confirm_save import router as confirm_save_router
from sqlalchemy.exc import SQLAlchemyError
import os
import json
import worker
from convex_persist import call_convex_action, ConvexPersistError

# Configure module-level logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pdf-ingest")

# Optional debug file handler: set PDF_INGEST_DEBUG_LOG to a writable path in the runtime (e.g., /tmp/pdf_ingest_debug.log).
debug_log_path = os.getenv("PDF_INGEST_DEBUG_LOG")
if debug_log_path:
    try:
        # Ensure logger will emit debug records when debug file handler is enabled.
        try:
            logger.setLevel(logging.DEBUG)
        except Exception:
            pass

        fh = logging.FileHandler(debug_log_path)
        fh.setLevel(logging.DEBUG)
        formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        fh.setFormatter(formatter)
        # Avoid adding duplicate handlers for the same path
        if not any(isinstance(h, logging.FileHandler) and getattr(h, "baseFilename", None) == debug_log_path for h in logger.handlers):
            logger.addHandler(fh)
        logger.debug("Debug file handler attached to pdf-ingest logger: %s", debug_log_path)
    except Exception:
        logger.exception("Failed to attach debug FileHandler to pdf-ingest logger")

# Defensive route wrapper to ensure no exception escapes a request handler.
def safe_route(func):
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            # Log full traceback and return a stable error payload (HTTP 200 to avoid 5xx bubbling).
            logger.exception("Unhandled exception in route %s: %s", getattr(func, "__name__", "unknown"), e, exc_info=True)
            return JSONResponse(status_code=200, content={"status": "error", "error": "Internal server error"})
    return wrapper

app = FastAPI(title="PDF Ingest MVP", version="0.1")
# Include the full-raw-text router (read-only helper to assemble canonical raw text)
app.include_router(full_raw_text_router)

# This is where you should put it
app.include_router(confirm_save_router, prefix="/api/v1")

# Initialize DB on startup (dev-time create_all)
@app.on_event("startup")
async def on_startup():
    try:
        await init_db()
    except Exception:
        # If DB isn't available (e.g., running tests without DB), skip init.
        pass

# Development CORS: allow browser-based test page and local frontend to call the API.
# In production restrict origins appropriately.
app = FastAPI(title="PDF Ingest MVP", version="0.1")

# 1️⃣ Add CORS middleware FIRST
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

# 2️⃣ Logging middleware after CORS
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url} Origin: {request.headers.get('origin')}")
    response = await call_next(request)
    return response

# Global exception handler to avoid leaking internal 500s to clients and to
# ensure confirm-save (and other endpoints) do not return HTTP 500 on internal errors.
# This handler logs the full exception (including tracebacks) and returns a stable
# JSON payload with status "error". We keep the HTTP status 200 to match the
# client's expectation that confirm-save will not return 5xx for transient/internal errors.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log full traceback and contextual request info
    logger.exception("Unhandled exception during request %s %s: %s", request.method, request.url, exc, exc_info=True)

    # Best-effort: attempt to rollback a DB session if one was attached to request.state
    try:
        sess = None
        if hasattr(request, "state") and getattr(request.state, "db", None):
            sess = request.state.db
        # If we found an async session attempt rollback
        if sess is not None:
            try:
                await sess.rollback()
            except Exception:
                logger.exception("Failed to rollback session during global exception handling")
    except Exception:
        logger.exception("Error while attempting best-effort rollback in global exception handler")

    return JSONResponse(status_code=200, content={"status": "error", "error": "Internal server error"})

# 3️⃣ Custom CORS header middleware (Deepseek suggestion)
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception as e:
        # Ensure CORS headers even on exceptions
        response = JSONResponse(content={"error": str(e)}, status_code=500)
    
    origin = request.headers.get("origin")
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    if origin and origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response

# 4️⃣ Debug CORS endpoint
@app.get("/api/v1/debug/cors")
async def debug_cors(request: Request):
    return {
        "headers": dict(request.headers),
        "origin": request.headers.get("origin"),
        "allowed_origins": [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    }

# In-memory job store; replace with persistent store in production.
JOBS: Dict[str, Dict[str, Any]] = {}

# -------------------------
# Pydantic models
# -------------------------
class ExperienceItem(BaseModel):
    company: Optional[str] = None
    title: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    description: Optional[str] = None

class EducationItem(BaseModel):
    school: Optional[str] = None
    degree: Optional[str] = None
    fieldOfStudy: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    description: Optional[str] = None

class NormalizedProfile(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    summary: Optional[str] = None
    skills: Optional[List[str]] = None
    experience: Optional[List[ExperienceItem]] = None
    education: Optional[List[EducationItem]] = None
    achievements: Optional[List[str]] = None
    rawText: Optional[str] = None
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    metadata: Optional[Dict[str, Any]] = None

# -------------------------
# Utility parsing functions
# -------------------------
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)

def extract_email(text: str) -> Optional[str]:
    m = EMAIL_RE.search(text)
    return m.group(0) if m else None

def extract_name(text: str, email: Optional[str] = None) -> Optional[str]:
    """
    Heuristic for extracting candidate name:
    - If email present, prefer a non-numeric line immediately above the email.
    - Otherwise prefer the first short line that contains letters and not mostly digits or address tokens.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    def looks_like_name(s: str) -> bool:
        if not s:
            return False
        # must contain letters
        if not re.search(r"[A-Za-z]", s):
            return False
        # reject lines that are mostly numbers or addresses with street keywords
        digits = sum(c.isdigit() for c in s)
        if digits / max(1, len(s)) > 0.4:
            return False
        if re.search(r"\b(ave|street|st\.|rd\.|road|lane|ln|dr\.|boulevard|blvd|apt|suite)\b", s, re.I):
            return False
        # very long lines are unlikely to be a name
        if len(s) > 80 or len(s.split()) > 6:
            return False
        return True

    if email:
        # find the line containing the email, then scan upwards for a plausible name
        for i, line in enumerate(lines):
            if email in line:
                for k in range(i-1, max(-1, i-6), -1):
                    cand = lines[k]
                    if looks_like_name(cand):
                        return cand
                break

    # fallback: scan top lines for a likely name
    for line in lines[:10]:
        if looks_like_name(line):
            return line

    # final fallback: return first line that has letters
    for line in lines[:10]:
        if re.search(r"[A-Za-z]", line):
            return line

    return None

def extract_skills(text: str) -> List[str]:
    """
    Improved skills extractor:
    - Prefer explicit 'Skills' section if present.
    - Stop the section on the next obvious section heading (e.g., EDUCATION, HOBBIES), or when encountering ALL-CAPS headings.
    - Fall back to token matching across the document.
    """
    if not text:
        return []

    header_re = re.compile(r"^(education|experience|hobbies|languages|achievements|certifications|projects|profile|summary)\b", re.I)
    all_caps_re = re.compile(r"^[A-Z0-9\s&/-]{2,}$")

    # 1) Look for a skills section block
    m = re.search(r"(skills|technical skills|skills & tools|technical competencies)[:\s]*\n([\s\S]{0,1600})", text, re.I)
    candidates: List[str] = []
    if m:
        raw_block = m.group(2)
        # Stop at next section heading if present (including lines that look like ALL CAPS headings)
        lines = raw_block.splitlines()
        collected_lines = []
        for ln in lines:
            if header_re.match(ln.strip()) or all_caps_re.match(ln.strip()):
                break
            collected_lines.append(ln)
        raw = "\n".join(collected_lines).strip()
        # Split on commas, bullets, newlines, semicolons
        parts = re.split(r"[,\n•\u2022;\-]+", raw)
        for p in parts:
            s = p.strip()
            # basic noise filtering
            if 2 <= len(s) <= 80 and not re.search(r"^(years|experience|month|month[s]?$)", s, re.I):
                candidates.append(s)
    else:
        # 2) Fallback: token matching (lightweight)
        possible = [
            "JavaScript", "TypeScript", "React", "Node", "Python", "Django", "Flask",
            "FastAPI", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "SQL", "Postgres",
            "MySQL", "NoSQL", "GraphQL", "Redis", "HTML", "CSS", "TensorFlow", "PyTorch"
        ]
        for token in possible:
            if re.search(rf"\b{re.escape(token)}\b", text, re.I):
                candidates.append(token)

    # normalize/canonicalize simple variants (e.g., Node.js -> Node)
    norm = []
    for s in candidates:
        s = s.replace("Node.js", "Node").replace("node.js", "Node").strip()
        if s and s not in norm:
            norm.append(s)

    # limit to reasonable number
    return norm[:60]

def extract_summary(text: str) -> Optional[str]:
    if not text:
        return None

    # Normalize whitespace
    clean = re.sub(r"\r\n", "\n", text)
    clean = re.sub(r"\n{2,}", "\n\n", clean)

    # 1) Look for explicit summary/profile headings
    m = re.search(r"(summary|professional summary|profile|about me|about)\s*[:\-]?\s*\n([\s\S]{20,800})", clean, re.I)
    if m:
        candidate = m.group(2).strip()
        # stop at next blank line
        candidate = candidate.split("\n\n")[0].strip()
        # limit length
        if 30 <= len(candidate) <= 2000:
            # return first 2 sentences if long
            parts = re.split(r'(?<=[.!?])\s+', candidate)
            return " ".join(parts[:2]) if len(parts) >= 2 else candidate[:2000]

    # 2) Fallback: take top-of-document text block (first paragraph-like block)
    paragraphs = [p.strip().replace("\n", " ") for p in clean.split("\n\n") if p.strip()]
    if paragraphs:
        top = paragraphs[0]
        if len(top) >= 40:
            parts = re.split(r'(?<=[.!?])\s+', top)
            return " ".join(parts[:2]) if len(parts) >= 2 else top[:2000]

    # 3) Last resort: find a block with keywords and return a concise snippet
    m2 = re.search(r"([A-Z][^\n]{40,300})", clean)
    if m2:
        candidate = m2.group(1).strip()
        parts = re.split(r'(?<=[.!?])\s+', candidate)
        return " ".join(parts[:2]) if len(parts) >= 2 else candidate[:2000]

    return None

def extract_experiences(text: str) -> List[Dict[str, Any]]:
    """
    Improved experience extractor:
    - Prefer parsing under an explicit Experience/Work section if present.
    - Stop collecting description when encountering another top-level section like EDUCATION or ACHIEVEMENTS.
    - Avoid capturing bullet-only achievement lists as experience descriptions.
    - Better title/company heuristics and filter out education-like blocks.
    """
    if not text:
        return []

    # Flexible date-like pattern
    date_re = re.compile(
        r"((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}|\d{4})\s*[-–—]\s*((Present|\d{4}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}))",
        re.I,
    )

    # Section delimiters that indicate we've left experience block
    section_heading_re = re.compile(
        r"^(education|formation|skills|achievements|certifications|hobbies|languages|projects|publications|references|profile|summary)\b[:\s\-\u2022•]*",
        re.I,
    )

    # Heuristics for institution/degree to detect education-like lines
    institution_re = re.compile(r"\b(University|College|Institute|School|Academy|École|Université|INSEAD|NEOMA|ESSEC|HEC)\b", re.I)
    degree_re = re.compile(r"\b(Bachelor|Master|B\.Sc|M\.Sc|PhD|Licence|Master|Diploma|Certificate|Certificat|Formation)\b", re.I)

    sec = re.search(r"(experience|work experience|employment|professional experience)[:\s]*\n([\s\S]{0,5000})", text, re.I)
    pool_text = sec.group(2) if sec else text

    pool_lines = [l.strip() for l in pool_text.splitlines() if l.strip()]
    exp: List[Dict[str, Any]] = []
    i = 0
    while i < len(pool_lines):
        line = pool_lines[i]
        # If we hit a new top-level section heading, stop parsing experience entries.
        if section_heading_re.match(line):
            break

        if date_re.search(line):
            # Title and company heuristics: previous lines may contain title/company in various orders.
            title_candidate = pool_lines[i - 1] if i - 1 >= 0 else ""
            company_candidate = pool_lines[i - 2] if i - 2 >= 0 else ""

            # Try common patterns on the same line (e.g., "Title — Company" or "Company / Title")
            same_line = line

            # If the same line contains a separator (dash, em-dash, slash) try to extract title/company
            if re.search(r"[—–\-\/]", same_line) and not date_re.search(same_line):
                parts = re.split(r"\s*[—–\-/]\s*", same_line)
                if len(parts) >= 2:
                    left, right = parts[0].strip(), parts[1].strip()
                    # Heuristic: if one side looks academic, prefer it as company/institution
                    if institution_re.search(left) or degree_re.search(left):
                        company_candidate = left
                        title_candidate = right
                    elif institution_re.search(right) or degree_re.search(right):
                        company_candidate = right
                        title_candidate = left
                    else:
                        # prefer shorter/compact segment as title
                        if len(left.split()) <= len(right.split()):
                            title_candidate = left
                            company_candidate = right
                        else:
                            title_candidate = right
                            company_candidate = left

            # If we still don't have a plausible title, scan nearby lines (up to 3 lines above)
            if not title_candidate:
                for k in range(1, 4):
                    idx = i - k
                    if idx >= 0:
                        cand = pool_lines[idx].strip()
                        if not cand:
                            continue
                        # skip date-like, education-like, and short bullet-only lines
                        if date_re.search(cand):
                            continue
                        if institution_re.search(cand) or degree_re.search(cand):
                            continue
                        if re.match(r"^[\u2022•\-\*\•]\s+$", cand):
                            continue
                        # accept this as a title candidate
                        title_candidate = cand
                        break

            # Backtrack if title looks like a degree/institution (then swap)
            if degree_re.search(title_candidate) or institution_re.search(title_candidate):
                # treat as education-like; skip this detected experience as it may be misclassified
                i += 1
                continue

            # Clean bullets
            if re.match(r"^[\u2022•\-•\*]\s+", title_candidate):
                title_candidate = ""
            if re.match(r"^[\u2022•\-•\*]\s+", company_candidate):
                company_candidate = ""

            # If title looks empty but company_candidate contains a comma or '-' maybe format reversed
            title = title_candidate or None
            company = company_candidate or None

            # Collect description lines until next date or section heading
            desc_parts: List[str] = []
            j = i + 1
            while j < len(pool_lines):
                nxt = pool_lines[j]
                if date_re.search(nxt) or section_heading_re.match(nxt):
                    break
                # Skip short bullets as achievements
                if re.match(r"^[\u2022•\-•\*]\s+", nxt) and len(nxt.split()) < 6:
                    j += 1
                    continue
                desc_parts.append(nxt)
                j += 1

            m = date_re.search(line)
            start = m.group(1) if m else None
            end = m.group(3) if m else None

            # Defensive: if company_candidate looks like an academic institution, treat this block as education and skip
            combined_prev = " ".join([company or "", title or ""])
            if institution_re.search(combined_prev) or degree_re.search(combined_prev):
                i = j
                continue

            exp.append(
                {
                    "title": title,
                    "company": company,
                    "startDate": start,
                    "endDate": end,
                    "description": " ".join(desc_parts) if desc_parts else None,
                }
            )
            i = j
        else:
            i += 1

    # Post-filter: remove any entries that look like education (safety)
    filtered = []
    for e in exp:
        combined = " ".join(filter(None, [str(e.get("title") or ""), str(e.get("company") or ""), str(e.get("description") or "")]))
        if institution_re.search(combined) and not date_re.search(combined):
            # move to education by skipping here (normalize_from_text will handle)
            continue
        filtered.append(e)

    return filtered[:20]

# -------------------------
# Text extraction helpers
# -------------------------
def extract_text_pdfplumber(pdf_bytes: bytes) -> str:
    # Use pdfminer.six to extract text from bytes
    try:
        text = pdfminer_extract_text(io.BytesIO(pdf_bytes))
        return text or ""
    except Exception:
        return ""


# -------------------------
# Normalization pipeline
# -------------------------
def extract_education(text: str) -> List[Dict[str, Any]]:
    """
    Improved education extractor:
    - Locate an Education/Training/Certifications section if present.
    - Otherwise scan the document for education-like blocks (year ranges, degree keywords, institution keywords).
    - Apply stricter validation to avoid classifying hobbies/languages as education.
    - Return a list of education dicts with school, degree, dates and description.
    """
    if not text:
        return []

    # Find a dedicated education section if available
    sec_match = re.search(
        r"(education|formation|formation académique|academic background|training|certifications|qualifications)[:\s]*(\n|$)([\s\S]{0,2500})",
        text,
        re.I,
    )
    pool = sec_match.group(3) if sec_match else None

    # If there is no explicit education section, try to collect candidate blocks around year ranges
    candidates_blocks: List[str] = []
    if pool:
        # Split by double newlines or by lines that look like headings
        raw_blocks = re.split(r"\n\s*\n", pool)
        candidates_blocks = [b.strip() for b in raw_blocks if b.strip()]
    else:
        # Find nearby regions that include year ranges or degree keywords
        # Collect surrounding +/- 3 lines for each year match
        year_re = re.compile(r"\b(19|20)\d{2}\b")
        lines = [l for l in text.splitlines()]
        for idx, ln in enumerate(lines):
            if year_re.search(ln):
                start = max(0, idx - 3)
                end = min(len(lines), idx + 4)
                blk = " ".join([l.strip() for l in lines[start:end] if l.strip()])
                candidates_blocks.append(blk)

    # Normalize and dedupe blocks
    seen_blocks = []
    blocks = []
    for b in candidates_blocks:
        s = re.sub(r"\s+", " ", b).strip()
        if s and s not in seen_blocks:
            seen_blocks.append(s)
            blocks.append(s)

    ed_list: List[Dict[str, Any]] = []
    year_range_re = re.compile(r"(\d{4})\s*[-–—]\s*(\d{4}|Present)", re.I)
    degree_keywords = re.compile(
        r"\b(Bachelor|Master|B\.Sc|M\.Sc|PhD|BA|BS|MA|MS|Certificate|Program|Diploma|Training|CPOP|SOCP|Certificate Program|Certificate of)\b",
        re.I,
    )
    institution_re = re.compile(
        r"\b(University|College|Institute|School|Foundation|Academy|NEOMA|ASIS|International|Center|Centre|Institute of|Institute)\b",
        re.I,
    )

    # Tokens indicating hobby/language lists which we should ignore
    noise_tokens = re.compile(r"\b(hobbies|hobby|languages|language|skills|linkedin|profile|resume|achievements)\b", re.I)

    for blk in blocks:
        # Skip blocks that are clearly noise
        if noise_tokens.search(blk) and not (degree_keywords.search(blk) or institution_re.search(blk) or year_range_re.search(blk)):
            continue

        # Extract years if present
        start = None
        end = None
        yr = year_range_re.search(blk)
        if yr:
            start = yr.group(1)
            end = yr.group(2)

        # Try to split block into candidate parts by common separators
        parts = [p.strip() for p in re.split(r"[;\|\n\-\u2014,]\s*", blk) if p.strip()]

        school = None
        degree = None
        field = None
        description_parts = []

        # Heuristic: prefer parts that match institution_re as school, degree_keywords as degree
        for p in parts:
            if not degree and degree_keywords.search(p):
                degree = p
                continue
            if not school and institution_re.search(p):
                school = p
                continue

        # If no school but first part looks reasonable (contains multiple capitalized words), use it
        if not school and parts:
            first = parts[0]
            # avoid short hobby lists
            if len(first.split()) >= 2 and not re.match(r"^[A-Z]{2,}$", first):
                school = first

        # Build description from the remaining parts (skip year tokens)
        for p in parts:
            if year_range_re.search(p):
                continue
            if p == school or p == degree:
                continue
            description_parts.append(p)

        description = " ".join(description_parts).strip() if description_parts else None

        # Validation: only accept if we have at least one strong signal (year, degree keyword, or institution)
        if not (yr or degree or institution_re.search(blk) or sec_match):
            # If this block is under an explicit education section but lacks strong signals, accept it if it's not a short list
            if sec_match and len(blk.split()) > 6:
                pass
            else:
                continue

        # Final cleanup: remove obvious hobby/language lines inside description
        if description and noise_tokens.search(description):
            # remove hobby/language tokens substrings
            description = re.sub(r"\b(HOBBIES|LANGUAGES|SKILLS)\b.*", "", description, flags=re.I).strip()

        ed_list.append(
            {
                "school": school or None,
                "degree": degree or None,
                "fieldOfStudy": field or None,
                "startDate": start,
                "endDate": end,
                "description": description or None,
            }
        )

    # dedupe similar entries (by school+degree)
    unique = []
    seen = set()
    for e in ed_list:
        key = (str(e.get("school")), str(e.get("degree")))
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)

    return unique[:10]


def extract_achievements_from_text(text: str) -> List[str]:
    """
    Simple rule-based achievements extractor:
    - Looks for ACHIEVEMENTS or similar section and pulls bullet lines.
    - Also scans for lines containing percentages or action verbs indicating impact.
    """
    if not text:
        return []
    ach = []
    sec = re.search(r"(achievements|accomplishments|highlights|notable achievements)[:\s]*\n([\s\S]{0,1200})", text, re.I)
    pool = sec.group(2) if sec else text
    lines = [l.strip() for l in pool.splitlines() if l.strip()]
    for ln in lines:
        # bullet lines or lines with % or keywords
        if re.match(r"^[\u2022•\-\*]\s+", ln) or re.search(r"\b(reduced|decreased|increased|improved|cut|boost|saved|implemented)\b", ln, re.I) or "%" in ln:
            cleaned = re.sub(r"^[\u2022•\-\*]\s*", "", ln).strip()
            if len(cleaned) > 10:
                ach.append(cleaned)
    # dedupe
    seen = []
    for a in ach:
        if a not in seen:
            seen.append(a)
    return seen[:30]


def normalize_from_text(text: str, filename: Optional[str] = None) -> NormalizedProfile:
    # Simple section splitter: maps likely headings to their following block.
    def extract_sections(txt: str) -> Dict[str, str]:
        sections: Dict[str, str] = {}
        # Split on common headings (lines that are all caps or lines followed by blank line)
        lines = txt.splitlines()
        current = None
        buffer: List[str] = []
        heading_re = re.compile(r"^[A-Z][A-Z0-9\s\-\u2014]{2,}$")  # ALL CAPS or similar
        known_headings = re.compile(r"^(summary|profile|profil|experience|employment|education|formation|skills|achievements|hobbies|languages|certifications|projects)\b[:\s]*$", re.I)
        for ln in lines:
            if known_headings.match(ln.strip()) or heading_re.match(ln.strip()) and len(ln.strip()) < 80:
                # flush previous
                if current and buffer:
                    sections[current.lower()] = "\n".join(buffer).strip()
                current = ln.strip().lower().rstrip(":")
                buffer = []
            else:
                if current:
                    buffer.append(ln)
        if current and buffer:
            sections[current.lower()] = "\n".join(buffer).strip()
        return sections

    sections = extract_sections(text)

    email = extract_email(text)
    name = extract_name(text, email)
    summary = extract_summary(text)
    # If no summary found, map PROFILE (or profil) section to summary
    if not summary:
        for key in ("profile", "profil"):
            if key in sections and sections[key].strip():
                summary = sections[key].strip()
                break

    skills = extract_skills(text)
    experience = extract_experiences(text)
    education = extract_education(text)
    achievements = extract_achievements_from_text(text)

    # Remove short achievement bullets from experience descriptions (post-process)
    cleaned_experience = []
    for e in experience:
        desc = []
        if isinstance(e.get("description"), str):
            for line in e.get("description", "").split("•"):
                line = line.strip()
                if not line:
                    continue
                # if line looks like an achievement, skip it from desc (we already captured achievements)
                if re.search(r"\b(reduced|decreased|increased|improved|cut|boost|saved|implemented|decreased|reduced)\b", line, re.I) or "%" in line:
                    continue
                desc.append(line)
        else:
            desc = []
        e["description"] = " ".join(desc) if desc else e.get("description")
        cleaned_experience.append(e)

    # confidence scoring heuristic (balanced across fields)
    confidence = 0.0
    confidence += 0.40 if email else 0.0
    confidence += 0.20 if name else 0.0
    confidence += 0.15 if skills else 0.0
    confidence += 0.15 if experience else 0.0
    confidence += 0.10 if education else 0.0
    if confidence > 1:
        confidence = 1.0
    profile = NormalizedProfile(
        name=name or None,
        email=email or None,
        summary=summary or None,
        skills=skills or None,
        experience=[ExperienceItem(**e) for e in cleaned_experience] if cleaned_experience else None,
        education=[EducationItem(**e) for e in education] if education else None,
        rawText=text or None,
        confidence=confidence,
        metadata={"filename": filename or None, "source": "server_parse", "parsedAt": int(time.time() * 1000), "achievements": achievements}
    )
    return profile

# -------------------------
# Background job runner (simple)
# -------------------------
async def run_parse_job(job_id: str, pdf_bytes: bytes, filename: Optional[str] = None):
    try:
        JOBS[job_id]["status"] = "parsing"
        # Step 1: try text extraction
        text = extract_text_pdfplumber(pdf_bytes)
        # Step 2: OCR disabled in this environment; proceed with extracted text
        text_len = len(text.strip())
        # Step 3: normalize
        JOBS[job_id]["status"] = "normalizing"
        profile = normalize_from_text(text, filename)
        # Here you could call an LLM (LangChain) if profile.confidence < threshold
        JOBS[job_id]["status"] = "done"
        JOBS[job_id]["result"] = profile.dict()
    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)

# -------------------------
# API endpoints
# -------------------------
@app.post("/api/v1/parse-now")
async def parse_now(file: UploadFile = File(...)):
    """
    Synchronous parsing endpoint for small files / quick testing.
    Returns the normalized JSON immediately.
    """
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 15 MB for sync parse).")
    # Try text extraction first
    try:
        text = extract_text_pdfplumber(content)
    except Exception as e:
        text = ""
    # If text is small and OCR available, attempt OCR
    if (not text or len(text.strip()) < 200) and OCR_AVAILABLE:
        try:
            text = ocr_pdf_bytes(content)
        except Exception:
            pass
    profile = normalize_from_text(text, filename=getattr(file, "filename", None))
    return JSONResponse(content=profile.dict())

@app.post("/api/v1/upload")
async def upload(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    """
    Accepts a PDF and enqueues a background parse job.
    Returns a jobId. Use GET /api/v1/jobs/{jobId} to poll the result.
    """
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB).")
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"status": "accepted", "createdAt": int(time.time() * 1000)}
    # Schedule background parse coroutine
    # We create an asyncio task so it runs without blocking; in production use a worker queue.
    asyncio.create_task(run_parse_job(job_id, content, getattr(file, "filename", None)))
    return {"jobId": job_id, "status": "accepted"}

@app.get("/api/v1/jobs/{job_id}")
async def get_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return JOBS[job_id]


# RQ job status endpoint (wrapper around RQ Job.fetch)
from rq.job import Job as RQJob


@app.get("/api/v1/rq-job/{job_id}")
async def get_rq_job(job_id: str):
    """
    Return a simple status + result for an RQ job id enqueued by this service.
    Useful for frontend polling.
    """
    try:
        job = RQJob.fetch(job_id, connection=worker.redis_conn)
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")

    status = job.get_status()
    result = None
    if status == "finished":
        result = job.result
    elif status == "failed":
        result = {"error": job.exc_info}

    return {"jobId": job_id, "status": status, "result": result}


@app.get("/api/v1/llm-history/{job_id}")
async def get_llm_history_by_job(job_id: str, session: AsyncSession = Depends(get_session)):
    """
    Return a single LLM history row by job id (or UUID id).
    Fallbacks:
      - If job_id matches LLMHistory.job_id, return the latest row.
      - If job_id is a UUID matching LLMHistory.id, return that row.
    """
    try:
        # Try to match by job_id field first
        try:
            q = await session.execute(
                select(LLMHistory).where(LLMHistory.job_id == str(job_id)).order_by(LLMHistory.run_time.desc())
            )
            row = q.scalars().first()
            if row:
                return {
                    "id": str(row.id),
                    "profile_id": str(row.profile_id),
                    "job_id": row.job_id,
                    "run_time": row.run_time.isoformat() if row.run_time else None,
                    "provider": row.provider,
                    "model": row.model,
                    "full_response": row.full_response,
                    "patch": row.full_response.get("patch") if row.full_response else None,
                    "merged": bool(row.merged),
                    "convex_write_status": getattr(row, "convex_write_status", None),
                    "convex_error": getattr(row, "convex_error", None),
                    "convex_written_at": getattr(row, "convex_written_at", None),
                }
        except Exception:
            # ignore and try UUID fallback
            pass

        # Try interpreting job_id as an LLMHistory.id UUID
        try:
            parsed = UUID(job_id)
            q2 = await session.execute(select(LLMHistory).where(LLMHistory.id == parsed))
            row2 = q2.scalars().first()
            if row2:
                return {
                    "id": str(row2.id),
                    "profile_id": str(row2.profile_id),
                    "job_id": row2.job_id,
                    "run_time": row2.run_time.isoformat() if row2.run_time else None,
                    "provider": row2.provider,
                    "model": row2.model,
                    "full_response": row2.full_response,
                    "patch": row2.full_response.get("patch") if row2.full_response else None,
                    "merged": bool(row2.merged),
                    "convex_write_status": getattr(row2, "convex_write_status", None),
                    "convex_error": getattr(row2, "convex_error", None),
                    "convex_written_at": getattr(row2, "convex_written_at", None),
                }
        except Exception:
            pass

        raise HTTPException(status_code=404, detail="LLM history entry not found")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error while fetching llm history %s", job_id)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/profiles/{profile_id}/llm-history")
async def get_profile_llm_history(profile_id: str, session: AsyncSession = Depends(get_session)):
    """
    Return LLM history rows for a given profile id.
    """
    try:
        # Handle placeholder UUIDs like "placeholder-3834EA9E-460E-41A0-94AC-AF480015CC0D"
        if isinstance(profile_id, str) and profile_id.startswith('placeholder-'):
            # Extract the UUID part after the prefix
            uuid_part = profile_id.replace('placeholder-', '')
            try:
                parsed_uuid = UUID(uuid_part)
            except ValueError:
                logger.warning("Invalid UUID format in placeholder: %s", profile_id)
                parsed_uuid = None
        else:
            parsed_uuid = UUID(str(profile_id))
    except Exception:
        logger.info("Invalid profile_id format: %s", profile_id)
        raise HTTPException(status_code=400, detail="Invalid profile_id (must be UUID)")
    
    try:
        q = await session.execute(select(LLMHistory).where(LLMHistory.profile_id == parsed_uuid).order_by(LLMHistory.run_time.desc()))
        rows = q.scalars().all()
    except Exception:
        logger.exception("Database error while fetching llm history for profile %s", profile_id)
        raise HTTPException(status_code=500, detail="Database error")
    
    result = []
    for r in rows:
        result.append({
            "id": str(r.id),
            "profile_id": str(r.profile_id),
            "job_id": r.job_id,
            "run_time": r.run_time.isoformat() if r.run_time else None,
            "provider": r.provider,
            "model": r.model,
            "full_response": r.full_response,
            "patch": r.full_response.get("patch") if r.full_response else None,
            "merged": bool(r.merged),
            "convex_write_status": getattr(r, "convex_write_status", None),
            "convex_error": getattr(r, "convex_error", None),
            "convex_written_at": getattr(r, "convex_written_at", None),
        })
    return result


@app.post("/api/v1/convex-persist-retry")
async def convex_persist_retry(payload: Dict[str, Any] = None, session: AsyncSession = Depends(get_session)):
    """
    Retry sending a saved candidate to Convex by placeholderId (LLMHistory.id).
    Body: { "placeholderId": "<uuid>" }
    Behavior:
      - Lookup LLMHistory by id; require it has a profile_id
      - Load canonical Profile from DB and rebuild the convex payload (server-authoritative)
      - Call convex action via call_convex_action (runs in thread to avoid blocking event loop)
      - Update LLMHistory.convex_write_status / convex_error / convex_written_at accordingly
    """
    if payload is None:
        raise HTTPException(status_code=400, detail="Missing JSON body")
    placeholder_id = payload.get("placeholderId") or payload.get("id") or payload.get("placeholderId")
    if not placeholder_id:
        raise HTTPException(status_code=400, detail="placeholderId is required")
    try:
        parsed = UUID(str(placeholder_id))
    except Exception:
        raise HTTPException(status_code=400, detail="placeholderId must be a valid UUID")

    try:
        # Find LLMHistory row
        q = await session.execute(select(LLMHistory).where(LLMHistory.id == parsed))
        row = q.scalars().first()
        if not row:
            raise HTTPException(status_code=404, detail="LLMHistory entry not found")

        if not row.profile_id:
            raise HTTPException(status_code=400, detail="LLMHistory entry missing profile_id")

        # Load canonical profile
        profile = await session.get(Profile, row.profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found for LLMHistory entry")

        # Build payload (same contract as worker). Reuse existing idempotency key if present; otherwise generate one and persist.
        import uuid as _uuid

        # ensure idempotency_key present and persisted on LLMHistory
        if getattr(row, "convex_idempotency_key", None):
            idempotency_key = row.convex_idempotency_key
        else:
            idempotency_key = str(_uuid.uuid4())
            try:
                row.convex_idempotency_key = idempotency_key
                row.convex_write_status = "pending"
                row.convex_attempts = (row.convex_attempts or 0) + 1
                row.convex_last_attempt_at = int(time.time() * 1000)
                session.add(row)
                await session.commit()
            except Exception:
                try:
                    await session.rollback()
                except Exception:
                    logger.exception("Failed to rollback after persisting idempotency_key")
                logger.exception("Failed to persist idempotency_key on LLMHistory %s", str(row.id))

        # Sanitize profile payload: omit email when null/empty to avoid Convex validation errors.
        profile_obj = {
            "name": profile.name,
            "summary": profile.summary if profile.summary is not None else "",
            "skills": profile.skills or [],
            "experience": profile.experience or [],
            "education": getattr(profile, "education", []) or [],
            "achievements": getattr(profile, "achievements", []) or [],
        }
        try:
            if profile.email is not None and str(profile.email).strip() != "":
                profile_obj["email"] = str(profile.email)
        except Exception:
            # defensive: skip including email if any unexpected error occurs
            pass

        convex_payload = {
            "profileId": str(profile.id),
            "idempotencyKey": idempotency_key,
            "source": "llm_refine_retry",
            "version": 1,
            "profile": profile_obj,
        }
        action_path = os.getenv("CONVEX_ACTION_PATH", "/api/actions/persistProfile")

        # Run the blocking HTTP call in a thread
        try:
            resp = await asyncio.to_thread(call_convex_action, action_path, convex_payload)
            # success -> persist status on LLMHistory
            try:
                row.convex_write_status = "success"
                row.convex_error = None
                row.convex_written_at = int(time.time() * 1000)
                row.convex_idempotency_key = idempotency_key
                session.add(row)
                await session.commit()
            except Exception:
                try:
                    await session.rollback()
                except Exception:
                    logger.exception("Failed to rollback after commit failure while updating convex status")
                logger.exception("Failed to persist convex success status to LLMHistory")
            return {"status": "ok", "resp": resp}
        except ConvexPersistError as cpe:
            try:
                row.convex_write_status = "failed"
                row.convex_error = str(cpe)
                row.convex_written_at = None
                row.convex_last_attempt_at = int(time.time() * 1000)
                session.add(row)
                await session.commit()
            except Exception:
                try:
                    await session.rollback()
                except Exception:
                    logger.exception("Failed to rollback after commit failure while updating convex failure status")
                logger.exception("Failed to persist convex failure status to LLMHistory")
            raise HTTPException(status_code=500, detail=f"Convex call failed: {cpe}")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in convex-persist-retry for %s", placeholder_id)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/v1/llm-refine")
async def api_llm_refine(payload: Dict[str, Any] = None, session: AsyncSession = Depends(get_session)):
    """
    Enqueue an LLM refinement job.
    Body can be:
      - { "profileId": "<uuid>" }
      - { "profile": { ...normalized profile... } }
      - Optionally include "rawText" or "reason" for context.

    If a full profile payload is provided (key "profile"), persist it (upsert by email when possible)
    and then enqueue a refine job for the resulting profile id. Returns {"jobId","profileId"}.
    """
    if payload is None:
        raise HTTPException(status_code=400, detail="Missing JSON body")

    profile_id = payload.get("profileId")
    raw_text = payload.get("rawText")
    profile_payload = payload.get("profile") or payload.get("profile_payload") or payload.get("profilePayload")

    # If caller provided a full profile object, persist/upsert it to obtain profile_id.
    if not profile_id and profile_payload:
        try:
            validated = NormalizedProfile(**profile_payload)
        except Exception as e:
            logger.exception("Invalid profile payload for llm-refine: %s", e)
            raise HTTPException(status_code=400, detail=f"Invalid profile payload: {e}")

        # Upsert by email when available, otherwise insert a new profile.
        try:
            if validated.email:
                from sqlalchemy import text

                row = await session.execute(
                    text("SELECT id FROM profiles WHERE email = :email LIMIT 1"),
                    {"email": validated.email},
                )
                first = row.first()
                if first:
                    existing = await session.get(Profile, first[0])
                    if existing:
                        existing.name = validated.name
                        existing.summary = validated.summary
                        existing.skills = validated.skills
                        existing.experience = [e.dict() for e in validated.experience] if validated.experience else None
                        existing.raw_text = validated.rawText
                        existing.confidence = float(validated.confidence)
                        existing.meta = validated.metadata or existing.meta
                        session.add(existing)
                        await session.commit()
                        await session.refresh(existing)
                        profile_id = str(existing.id)
                else:
                    new = Profile(
                        name=validated.name,
                        email=validated.email,
                        summary=validated.summary,
                        skills=validated.skills,
                        experience=[e.dict() for e in validated.experience] if validated.experience else None,
                        raw_text=validated.rawText,
                        confidence=float(validated.confidence),
                        meta=validated.metadata,
                    )
                    session.add(new)
                    await session.commit()
                    await session.refresh(new)
                    profile_id = str(new.id)
            else:
                # No email: insert new profile record
                new = Profile(
                    name=validated.name,
                    email=validated.email,
                    summary=validated.summary,
                    skills=validated.skills,
                    experience=[e.dict() for e in validated.experience] if validated.experience else None,
                    raw_text=validated.rawText,
                    confidence=float(validated.confidence),
                    meta=validated.metadata,
                )
                session.add(new)
                await session.commit()
                await session.refresh(new)
                profile_id = str(new.id)
        except Exception as e:
            logger.exception("Failed to persist profile payload for llm-refine: %s", e)
            raise HTTPException(status_code=500, detail="Failed to persist provided profile")

    # Final validation: we must have a profile id to enqueue a refine job
    if not profile_id:
        raise HTTPException(status_code=400, detail="profileId is required or provide a full profile payload under 'profile'")

    # If client provided rawText alongside profileId, persist it first so the worker refines the canonical text.
    raw_text_from_payload = raw_text
    if raw_text_from_payload and profile_id:
        try:
            # Use a defensive parser that never raises; if parsed_uuid is None we skip DB writes.
            parsed_uuid = parse_profile_uuid_safe(profile_id)
            # Only attempt to update if we have a valid UUID
            if parsed_uuid:
                existing_profile = await session.get(Profile, parsed_uuid)
                if existing_profile:
                    existing_profile.raw_text = raw_text_from_payload
                    session.add(existing_profile)
                    try:
                        await session.commit()
                        await session.refresh(existing_profile)
                    except Exception:
                        # Ensure we rollback on any commit failure and continue (non-fatal)
                        try:
                            await session.rollback()
                        except Exception:
                            logger.exception("Failed to rollback after commit failure while persisting rawText for profile %s", profile_id)
                        logger.exception("Failed to persist rawText before enqueue for profile %s", profile_id)
        except Exception:
            logger.exception("Failed to persist rawText before enqueue for profile %s", profile_id)
            # Non-fatal: continue to enqueue with whatever was in DB

    try:
        res = worker.enqueue_llm_cleanup(str(profile_id))
        if isinstance(res, dict):
            job = res.get("job")
            placeholder_id = res.get("placeholder_id")
        else:
            job = res
            placeholder_id = None
        job_id = job.get_id() if hasattr(job, "get_id") else str(getattr(job, "id", ""))
        return {"jobId": job_id, "profileId": str(profile_id), "placeholderId": placeholder_id}
    except Exception as e:
        logger.exception("Failed to enqueue llm_refine for %s: %s", profile_id, e)
        raise HTTPException(status_code=500, detail="Failed to enqueue job")


@safe_route
@app.post("/api/v1/confirm-save")
@app.options("/api/v1/confirm-save")  # Explicitly handle preflight
async def confirm_save(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    # Handle CORS preflight OPTIONS request
    if request.method == "OPTIONS":
        return JSONResponse(content={}, status_code=200)

    """
    Persist a normalized profile to Postgres. Upsert by email if provided; otherwise insert a new profile.
    Returns the profile id and timestamps. If saved profile confidence is below LLM_THRESHOLD
    an LLM refinement job will be enqueued and the job id returned in `llm_job_id`.
    """

    # Read and sanitize the raw request body before Pydantic validation to handle unescaped control characters.
    try:
        raw_bytes = await request.body()
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Profile data is required")
        try:
            raw_str = raw_bytes.decode("utf-8")
        except Exception:
            raw_str = raw_bytes.decode("utf-8", errors="replace")
        # Strip control characters that commonly break json.loads (keep common whitespace like \n and \t)
        sanitized = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]+", " ", raw_str)
        try:
            payload_obj = json.loads(sanitized)
        except Exception as e:
            logger.exception("Failed to parse JSON body for confirm-save: %s", e)
            raise HTTPException(status_code=400, detail=f"Invalid JSON body: {e}")
        try:
            profile = NormalizedProfile(**payload_obj)
        except Exception as e:
            logger.exception("Invalid profile payload after sanitization: %s", e)
            raise HTTPException(status_code=400, detail=f"Invalid profile payload: {e}")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error while reading request body for confirm-save")
        raise HTTPException(status_code=400, detail="Invalid request body")

    logger.info("confirm-save called email=%s", getattr(profile, "email", None))
    # Handle CORS preflight OPTIONS request
    if request.method == "OPTIONS":
        return JSONResponse(content={}, status_code=200)

    """
    Persist a normalized profile to Postgres. Upsert by email if provided; otherwise insert a new profile.
    Returns the profile id and timestamps. If saved profile confidence is below LLM_THRESHOLD
    an LLM refinement job will be enqueued and the job id returned in `llm_job_id`.
    """

    logger.info("confirm-save called email=%s", getattr(profile, "email", None))

    if not profile:
        raise HTTPException(status_code=400, detail="Profile data is required")

    # Use profile.dict(exclude_unset=True) to get only fields sent by client
    profile_payload = profile.dict(exclude_unset=True)
    logger.info("confirm-save profile_payload keys: %s", list(profile_payload.keys()))

    # Prepare meta object (non-destructive merge target)
    meta = profile_payload.pop("metadata", {}) or {}

    # Move education and achievements into meta (so schema doesn't need altering)
    if "education" in profile_payload and profile_payload.get("education"):
        meta["education"] = [(e.dict(exclude_unset=True) if hasattr(e, "dict") else e) for e in profile_payload.pop("education")]
    if "achievements" in profile_payload and profile_payload.get("achievements"):
        meta["achievements"] = profile_payload.pop("achievements")
    elif profile_payload.get("metadata") and "achievements" in profile_payload.get("metadata"):
        # If caller nested achievements in metadata use that
        meta["achievements"] = profile_payload.get("metadata").get("achievements")

    # Lightweight AI-driven suggestions (heuristic, pluggable for future LLM)
    raw_text = (profile_payload.get("rawText") or "") or ""
    ai_category = "Unknown"
    ai_flags: List[str] = []
    lower_text = raw_text.lower()
    if any(k in lower_text for k in ["engineer", "developer", "software"]):
        ai_category = "Engineering"
        ai_flags.append("Potential technical role")
    elif any(k in lower_text for k in ["manager", "director", "lead"]):
        ai_category = "Management"
        ai_flags.append("Potential leadership role")
    elif any(k in lower_text for k in ["analyst", "data"]):
        ai_category = "Analytics"
        ai_flags.append("Potential data-related role")

    if ai_category != "Unknown":
        meta["ai_category"] = ai_category
    meta["ai_flags"] = list(set(meta.get("ai_flags", []) + ai_flags))
    logger.info("AI suggestions added: category=%s, flags=%s", ai_category, ai_flags)

    # Server-side fallback inference for missing required fields (non-blocking)
    inferred: Dict[str, Dict[str, Any]] = meta.get("inferred_fields", {})
    # infer email if missing
    if not profile_payload.get("email"):
        try:
            inferred_email = extract_email(raw_text)
            if inferred_email:
                profile_payload["email"] = inferred_email
                inferred["email"] = {"value": inferred_email, "method": "regex"}
                logger.info("Inferred email=%s from rawText", inferred_email)
        except Exception:
            logger.exception("Failed to infer email from rawText")

    # infer name if missing (prefer context using email if available)
    if not profile_payload.get("name"):
        try:
            candidate_email = profile_payload.get("email")
            inferred_name = extract_name(raw_text, candidate_email)
            if inferred_name:
                profile_payload["name"] = inferred_name
                inferred["name"] = {"value": inferred_name, "method": "heuristic"}
                logger.info("Inferred name=%s from rawText", inferred_name)
        except Exception:
            logger.exception("Failed to infer name from rawText")

    if inferred:
        meta["inferred_fields"] = {**meta.get("inferred_fields", {}), **inferred}

        # Recompute AI suggestions using updated profile_payload (including inferred fields)
        try:
            ai_category = "Unknown"
            ai_flags: List[str] = []
            lower_text = (profile_payload.get("rawText") or "").lower()
            name_text = (profile_payload.get("name") or "").lower()
            email_text = (profile_payload.get("email") or "").lower()

            # Simple heuristic checks including inferred name/email
            if any(k in lower_text or k in name_text for k in ["engineer", "developer", "software"]):
                ai_category = "Engineering"
                ai_flags.append("Potential technical role")
            elif any(k in lower_text or k in name_text for k in ["manager", "director", "lead"]):
                ai_category = "Management"
                ai_flags.append("Potential leadership role")
            elif any(k in lower_text or k in name_text for k in ["analyst", "data"]):
                ai_category = "Analytics"
                ai_flags.append("Potential data-related role")

            if ai_category != "Unknown":
                meta["ai_category"] = ai_category
            meta["ai_flags"] = list(set(meta.get("ai_flags", []) + ai_flags))
            logger.info("AI suggestions updated after inference: category=%s, flags=%s", ai_category, ai_flags)
        except Exception:
            logger.exception("Failed to recompute AI suggestions after inference")

    # Track missing required fields but DO NOT block saving (recompute after inference)
    required_fields = ["email", "name"]
    missing = [f for f in required_fields if not profile_payload.get(f)]
    if missing:
        existing_missing = list(meta.get("missing_fields", []))
        meta["missing_fields"] = list(set(existing_missing + missing))
        logger.info("confirm-save payload missing required fields after inference=%s payload_keys=%s",
                    missing, list(profile_payload.keys()))

    # Attach merged meta back to the payload for persistence
    profile_payload["metadata"] = meta

    profile_id = None
    created_at = None
    updated_at = None
    profile_obj_db = None

    try:
        from sqlalchemy.exc import IntegrityError, DBAPIError, SQLAlchemyError, ProgrammingError

        # If required fields still missing after inference, insert safe placeholders (flagged in meta)
        placeholder_used = {}
        if meta.get("missing_fields"):
            if "email" in meta.get("missing_fields", []) and not profile_payload.get("email"):
                ph_email = f"<missing-{uuid.uuid4()}@example.invalid>"
                profile_payload["email"] = ph_email
                placeholder_used["email"] = ph_email
                inferred_map = meta.get("inferred_fields", {})
                inferred_map["email"] = {"value": ph_email, "method": "placeholder"}
                meta["inferred_fields"] = inferred_map
                meta["missing_fields"] = [f for f in meta.get("missing_fields", []) if f != "email"]
            if "name" in meta.get("missing_fields", []) and not profile_payload.get("name"):
                ph_name = "Unknown"
                profile_payload["name"] = ph_name
                placeholder_used["name"] = ph_name
                inferred_map = meta.get("inferred_fields", {})
                inferred_map["name"] = {"value": ph_name, "method": "placeholder"}
                meta["inferred_fields"] = inferred_map
                meta["missing_fields"] = [f for f in meta.get("missing_fields", []) if f != "name"]

        # Attach updated meta back
        profile_payload["metadata"] = meta

        # Helper to apply updates to an existing profile object from payload (only set present keys)
        def _apply_updates_to_existing(existing_obj):
            if "name" in profile_payload:
                existing_obj.name = profile_payload.get("name")
            if "summary" in profile_payload:
                existing_obj.summary = profile_payload.get("summary")
            if "skills" in profile_payload:
                existing_obj.skills = profile_payload.get("skills")
            if "experience" in profile_payload:
                existing_obj.experience = [(e.dict(exclude_unset=True) if hasattr(e, "dict") else e) for e in profile_payload.get("experience")] if profile_payload.get("experience") else None
            if "rawText" in profile_payload:
                existing_obj.raw_text = profile_payload.get("rawText")
            if "confidence" in profile_payload:
                existing_obj.confidence = float(profile_payload.get("confidence"))
            # Non-destructive meta merge
            existing_meta = existing_obj.meta or {}
            existing_meta.update(meta)
            existing_obj.meta = existing_meta

        # Perform upsert within a single transaction to avoid nested/autobegin issues.
        try:
            logger.debug("confirm-save entering transaction for email=%s payload_keys=%s", profile_payload.get("email"), list(profile_payload.keys()))
            async with session.begin():
                existing = None
                email_to_use = profile_payload.get("email") or profile.email
                if email_to_use:
                    try:
                        # Acquire a row-level lock if the row exists to avoid races.
                        logger.info("Attempting SELECT FOR UPDATE for email=%s", email_to_use)
                        result = await session.execute(
                            select(Profile).where(Profile.email == email_to_use).with_for_update()
                        )
                        existing = result.scalars().first()
                        logger.info("SELECT FOR UPDATE result for email=%s -> existing_id=%s", email_to_use, getattr(existing, "id", None))
                    except Exception as e:
                        # Any DB error during the select inside the transaction is fatal for this request.
                        logger.exception("DB error selecting profile by email inside transaction for email=%s; session.bind=%s; exc=%s", email_to_use, getattr(session, "bind", None), e, exc_info=True)
                        raise HTTPException(status_code=500, detail="Database error")

                # Apply updates or insert NEW while still holding the transaction/row lock.
                if existing:
                    # Update existing record - only update fields present in payload
                    logger.info("Updating existing profile id=%s", existing.id)
                    _apply_updates_to_existing(existing)
                    session.add(existing)
                    logger.info("Flushing updates for existing profile id=%s (email=%s)", getattr(existing, "id", None), email_to_use)
                    await session.flush()
                    logger.info("Flush complete for existing profile id=%s", getattr(existing, "id", None))
                    profile_obj_db = existing
                    profile_id = existing.id
                else:
                    # Insert new profile
                    logger.info("Creating new profile for email=%s", email_to_use)
                    new = Profile(
                        name=profile_payload.get("name"),
                        email=email_to_use,
                        summary=profile_payload.get("summary"),
                        skills=profile_payload.get("skills"),
                        experience=[(e.dict(exclude_unset=True) if hasattr(e, "dict") else e) for e in profile_payload.get("experience")] if profile_payload.get("experience") else None,
                        raw_text=profile_payload.get("rawText"),
                        confidence=float(profile_payload.get("confidence")) if "confidence" in profile_payload else None,
                        meta=meta,
                    )
                    session.add(new)
                    logger.info("Flushing new profile for email=%s", email_to_use)
                    await session.flush()
                    logger.info("Flush complete for new profile temporary id=%s", getattr(new, "id", None))
                    profile_id = new.id
                    profile_obj_db = new

        except Exception as e:
            logger.exception("Transaction failed during confirm-save for email=%s payload_keys=%s", profile_payload.get("email"), list(profile_payload.keys()))
            # Re-raise so outer exception handlers / safe_route can handle stable response and rollback
            raise
        # Transaction committed here. Refresh to get timestamps.
        try:
            logger.info("Refreshing profile object after commit id=%s (obj=%s)", profile_id, getattr(profile_obj_db, "__dict__", "<no-obj>"))
            await session.refresh(profile_obj_db)
            created_at = getattr(profile_obj_db, "created_at", None)
            updated_at = getattr(profile_obj_db, "updated_at", None)
            profile_id = getattr(profile_obj_db, "id", profile_id)
            logger.info("Refresh complete for profile id=%s created_at=%s updated_at=%s", profile_id, created_at, updated_at)
        except Exception:
            logger.exception("Failed to refresh profile after commit for id=%s", profile_id)

        logger.info("Profile saved successfully: id=%s created_at=%s updated_at=%s", profile_id, created_at, updated_at)
    except IntegrityError as e:
        # Attempt to resolve unique constraint races by retrying as an update.
        try:
            await session.rollback()
        except Exception:
            logger.exception("rollback failed after IntegrityError")
        logger.warning("IntegrityError while persisting profile email=%s: %s. Attempting to resolve by reloading and updating.", profile_payload.get("email"), e)
        # Retry once: if a row now exists with the email, update it.
        if profile_payload.get("email"):
            try:
                async with session.begin():
                    result = await session.execute(
                        select(Profile).where(Profile.email == profile_payload.get("email")).with_for_update()
                    )
                    existing = result.scalars().first()
                    if existing:
                        logger.info("Resolving IntegrityError by updating existing profile id=%s", existing.id)
                        _apply_updates_to_existing(existing)
                        session.add(existing)
                        await session.flush()
                        profile_obj_db = existing
                        profile_id = existing.id
                    else:
                        # No existing row found; cannot resolve -> return error payload
                        logger.exception("IntegrityError and no existing row found during retry for email=%s", profile_payload.get("email"))
                        return JSONResponse(status_code=200, content={"status": "error", "error": "Constraint violation while saving profile"})
                # Refresh after retry commit
                try:
                    await session.refresh(profile_obj_db)
                    created_at = getattr(profile_obj_db, "created_at", None)
                    updated_at = getattr(profile_obj_db, "updated_at", None)
                except Exception:
                    logger.exception("Failed to refresh profile after resolving IntegrityError for id=%s", profile_id)
            except Exception:
                logger.exception("Retry after IntegrityError failed for email=%s", profile_payload.get("email"))
                return JSONResponse(status_code=200, content={"status": "error", "error": "Constraint violation while saving profile"})
        else:
            return JSONResponse(status_code=200, content={"status": "error", "error": "Constraint violation while saving profile"})
    except DBAPIError as e:
        try:
            await session.rollback()
        except Exception:
            logger.exception("rollback failed after DBAPIError")
        logger.exception("DBAPIError while persisting profile email=%s: %s", profile_payload.get("email"), e, exc_info=True)
        return JSONResponse(status_code=200, content={"status": "error", "error": "Database error"})
    except SQLAlchemyError as e:
        try:
            await session.rollback()
        except Exception:
            logger.exception("rollback_failed after SQLAlchemyError")
        logger.exception("SQLAlchemyError while persisting profile email=%s: %s", profile_payload.get("email"), e, exc_info=True)
        return JSONResponse(status_code=200, content={"status": "error", "error": "Database error"})
    except Exception as e:
        # Catch-all for unexpected errors. Ensure session is clean.
        try:
            await session.rollback()
        except Exception:
            logger.exception("rollback failed after unexpected exception")
        logger.exception("Unexpected error in confirm-save for email=%s", profile_payload.get("email"), exc_info=True)
        return JSONResponse(status_code=200, content={"status": "error", "error": "Internal server error"})

    # Optionally enqueue LLM refinement if confidence is below threshold
    llm_job_id = None
    placeholder_id = None
    try:
        llm_threshold = float(os.getenv("LLM_THRESHOLD", "0.6"))
    except Exception:
        llm_threshold = 0.6

    # Compute effective confidence (prefer incoming if provided, else existing)
    try:
        if "confidence" in profile_payload:
            current_conf = float(profile.confidence)
        else:
            current_conf = float(profile_obj_db.confidence) if profile_obj_db and profile_obj_db.confidence else 1.0
    except Exception:
        current_conf = 1.0

    if current_conf < llm_threshold:
        try:
            logger.info("Confidence %s < threshold %s, enqueuing LLM refine for profile %s", 
                       current_conf, llm_threshold, profile_id)
            # Create a deterministic placeholder and enqueue the worker with its id.
            # enqueue_llm_cleanup returns {"job": job_obj, "placeholder_id": "<uuid>"} when successful.
            res = worker.enqueue_llm_cleanup(str(profile_id))
            if isinstance(res, dict):
                job = res.get("job")
                placeholder_id = res.get("placeholder_id")
            else:
                job = res
                placeholder_id = None
            llm_job_id = job.get_id() if hasattr(job, "get_id") else str(getattr(job, "id", ""))
            logger.info("Enqueued LLM refine: job_id=%s placeholder_id=%s profile=%s", llm_job_id, placeholder_id, profile_id)
        except Exception:
            # Non-fatal: log and continue
            logger.exception("Failed to enqueue LLM refine job for profile %s", profile_id)

    result = {
        "id": str(profile_id),
        "created_at": created_at.isoformat() if created_at else None,
        "updated_at": updated_at.isoformat() if updated_at else None,
        "status": "saved",
    }
    if llm_job_id:
        result["llm_job_id"] = llm_job_id
    # Return placeholder id when available so clients can poll by the deterministic LLMHistory id.
    if placeholder_id:
        result["placeholderId"] = placeholder_id

    logger.info("confirm-save returning: %s", result)
    return result


@app.get("/api/v1/profiles/{profile_id}")
async def get_profile_by_id(profile_id: str, session: AsyncSession = Depends(get_session)):
    """
    Retrieve a stored profile by UUID string.
    Returns:
      - 400 if the provided id is not a valid UUID
      - 404 if profile not found
      - 500 on DB/internal errors
    """
    try:
        # Validate UUID string
        try:
            parsed_uuid = UUID(profile_id)
        except Exception:
            logger.info("Invalid profile_id format: %s", profile_id)
            raise HTTPException(status_code=400, detail="Invalid profile_id (must be UUID)")

        # Query DB
        try:
            result = await session.execute(select(Profile).where(Profile.id == parsed_uuid))
            profile = result.scalars().first()
        except SQLAlchemyError as db_exc:
            logger.exception("Database error while fetching profile %s", profile_id)
            raise HTTPException(status_code=500, detail="Database error")

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        return {
            "id": str(profile.id),
            "name": profile.name,
            "email": profile.email,
            "summary": profile.summary,
            "skills": profile.skills,
            "experience": profile.experience,
            "raw_text": profile.raw_text,
            "confidence": profile.confidence,
            "metadata": getattr(profile, "meta", None),
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
            "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error while fetching profile %s", profile_id)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/v1/profiles/{profile_id}/merge")
async def merge_profile(profile_id: str, payload: Dict[str, Any] = None, session: AsyncSession = Depends(get_session)):
    """
    Merge an accepted patch into the profile using optimistic locking.
    Payload shape:
      {
        "patch": { "ops": [ { "path": "/summary", "op": "replace", "value": "..." }, ... ] },
        "client_version": 1,
        "job_id": "<optional job id to mark llm_history as merged>"
      }

    Returns:
      - 200 with merged profile and new version on success
      - 400 on bad request
      - 404 if profile not found
      - 409 on version conflict (returns latest profile and version)
    """
    if payload is None:
        raise HTTPException(status_code=400, detail="Missing JSON body")

    try:
        parsed_uuid = UUID(profile_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid profile_id (must be UUID)")

    client_version = payload.get("client_version")
    patch = payload.get("patch") or {}
    ops = patch.get("ops", []) if isinstance(patch, dict) else []

    try:
        # Start a transaction and acquire a row-level lock for the profile
        async with session.begin():
            try:
                # SELECT FOR UPDATE
                result = await session.execute(select(Profile).where(Profile.id == parsed_uuid).with_for_update())
                profile = result.scalars().first()
            except Exception:
                logger.exception("DB error selecting profile for update %s", profile_id)
                raise HTTPException(status_code=500, detail="Database error")

            if not profile:
                raise HTTPException(status_code=404, detail="Profile not found")

            db_version = int(getattr(profile, "version", 0) or 0)
            if client_version is not None:
                try:
                    client_v = int(client_version)
                except Exception:
                    raise HTTPException(status_code=400, detail="client_version must be an integer")
                if client_v != db_version:
                    # Conflict: return 409 with latest profile and version info
                    return JSONResponse(
                        status_code=409,
                        content={
                            "error": "version_mismatch",
                            "current_version": db_version,
                            "profile": {
                                "id": str(profile.id),
                                "name": profile.name,
                                "email": profile.email,
                                "summary": profile.summary,
                                "skills": profile.skills,
                                "experience": profile.experience,
                                "raw_text": profile.raw_text,
                                "confidence": profile.confidence,
                                "metadata": getattr(profile, "meta", None),
                                "version": db_version,
                            },
                        },
                    )

            # Apply patch ops conservatively: support only "replace" on top-level fields.
            for op in ops:
                try:
                    if not isinstance(op, dict):
                        continue
                    if op.get("op") != "replace":
                        # skip non-replace ops for now
                        continue
                    path = op.get("path", "")
                    if not path.startswith("/"):
                        continue
                    field = path.lstrip("/")
                    value = op.get("value")
                    # map JSON field names to model attributes where names differ
                    if field == "rawText":
                        profile.raw_text = value
                    elif hasattr(profile, field):
                        setattr(profile, field, value)
                    else:
                        # unknown field -> stash into meta._pending_patch_applied
                        meta = profile.meta or {}
                        pending = meta.get("_pending_patch_applied", {})
                        pending[field] = value
                        meta["_pending_patch_applied"] = pending
                        profile.meta = meta
                except Exception:
                    logger.exception("Failed to apply patch op: %s", op)
                    continue

            # Increment version for optimistic locking
            profile.version = (profile.version or 0) + 1

            # Optionally mark the matching llm_history entry as merged if job_id provided
            job_id = payload.get("job_id")
            if job_id:
                    try:
                        q = await session.execute(
                            select(LLMHistory).where(LLMHistory.job_id == str(job_id)).order_by(LLMHistory.run_time.desc())
                        )
                        hist = q.scalars().first()
                        if hist:
                            hist.merged = True
                            session.add(hist)
                    except Exception:
                        # Best-effort: log and continue
                        logger.exception("Failed to mark llm_history merged for job %s", job_id)

            session.add(profile)

        # session.begin() commits here
        # Refresh to return up-to-date timestamps/fields
        await session.refresh(profile)

        return {
            "id": str(profile.id),
            "version": profile.version,
            "name": profile.name,
            "email": profile.email,
            "summary": profile.summary,
            "skills": profile.skills,
            "experience": profile.experience,
            "raw_text": profile.raw_text,
            "confidence": profile.confidence,
            "metadata": getattr(profile, "meta", None),
            "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error during merge for profile %s", profile_id)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "ocr_available": OCR_AVAILABLE}

# -------------------------
# Development helper: allow running with `python app.py`
# -------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
