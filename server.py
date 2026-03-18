# Minimal spaCy + FastAPI NER service compatible with my-app/convex/lib/parsing_shared/nerClient.ts
# Run:
#   python -m venv .venv && source .venv/bin/activate
#   pip install -U pip fastapi uvicorn spacy
#   python -m spacy download en_core_web_sm
#   uvicorn server:app --host 0.0.0.0 --port 8000
#
# Optional security:
#   export SERVICE_KEY="dev-local"
# The client will send Authorization: Bearer <SERVICE_KEY>

from typing import List, Optional, Dict, Any, Tuple
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import os

try:
    import spacy  # type: ignore
except Exception as e:  # pragma: no cover
    raise RuntimeError("spaCy is required. pip install spacy && python -m spacy download en_core_web_sm") from e

# ------------------------------------------------------------------------------
# App + Model Loading
# ------------------------------------------------------------------------------
app = FastAPI(title="spaCy NER Service", version="1.0.0")

# Preload default model. Prefer a custom trained model if provided via env MODEL_DIR,
# otherwise fallback to a portable small English model.
_MODEL_DIR = os.getenv("MODEL_DIR", "").strip()
_DEFAULT_MODEL_NAME = _MODEL_DIR or "en_core_web_sm"
try:
    _nlp_default = spacy.load(_DEFAULT_MODEL_NAME)
except Exception as e:  # pragma: no cover
    hint = (
        f"MODEL_DIR={_MODEL_DIR} invalid or not set; " if _MODEL_DIR else ""
    ) + "Run: python -m spacy download en_core_web_sm"
    raise RuntimeError(
        f"Could not load spaCy model '{_DEFAULT_MODEL_NAME}'. {hint}"
    ) from e

# Optional: map locale to specific models if installed. Keep conservative defaults.
_MODEL_BY_LOCALE = {
    "en": "en_core_web_sm",
    # Add other locales if you have them installed:
    # "fr": "fr_core_news_sm",
    # "es": "es_core_news_sm",
}

_cached_models: Dict[str, Any] = {"en_core_web_sm": _nlp_default}


def _env_flag(name: str, default: bool = False) -> bool:
    try:
        raw = os.getenv(name, "")
        if not raw:
            return default
        return str(raw).strip().lower() not in {"0", "false", "no", "off"}
    except Exception:
        return default


def _augment_nlp(nlp: Any) -> Any:
    # Optional: add an EntityRuler for DEGREE/ROLE tokens to improve span-first reliability
    try:
        if _env_flag("ENABLE_ENTITY_RULER", False):
            if "entity_ruler" not in nlp.pipe_names:
                ruler = nlp.add_pipe("entity_ruler", before="ner")
            else:
                ruler = nlp.get_pipe("entity_ruler")
            patterns = []
            # Degrees
            degrees = [
                "B.S.", "BS", "BSc", "Bachelor of Science",
                "M.S.", "MS", "MSc", "Master of Science",
                "MBA", "PhD", "B.Eng", "M.Eng", "Doctor of Philosophy",
            ]
            for d in degrees:
                patterns.append({"label": "DEGREE", "pattern": d})
            # Common roles
            roles = [
                "Software Engineer", "Senior Software Engineer", "Staff Engineer", "Principal Engineer",
                "Frontend Developer", "Backend Developer", "Full Stack Engineer",
                "Data Scientist", "Data Engineer", "Machine Learning Engineer",
                "Engineering Manager", "Product Manager", "Project Manager",
                "Director", "Architect", "Consultant",
            ]
            for r in roles:
                patterns.append({"label": "ROLE", "pattern": r})
            ruler.add_patterns(patterns)
    except Exception:
        # Non-fatal if spaCy components are missing
        pass
    return nlp


def _get_model_for_locale(locale: Optional[str]) -> Any:
    key = (locale or "").strip().lower()
    if not key:
        return _augment_nlp(_nlp_default)
    model_name = _MODEL_BY_LOCALE.get(key, _DEFAULT_MODEL_NAME)
    if model_name in _cached_models:
        return _augment_nlp(_cached_models[model_name])
    try:
        m = spacy.load(model_name)  # may fail if model not installed
        _cached_models[model_name] = _augment_nlp(m)
        return _cached_models[model_name]
    except Exception:
        return _augment_nlp(_nlp_default)


# ------------------------------------------------------------------------------
# Auth helper
# ------------------------------------------------------------------------------
_SERVICE_KEY = os.getenv("SERVICE_KEY", "").strip()


def _require_auth(auth_header: Optional[str]) -> None:
    if not _SERVICE_KEY:
        return  # unsecured mode
    if not auth_header or not auth_header.strip().lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth_header.strip()[7:]
    if token != _SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Invalid token")


# ------------------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------------------
class NEROptions(BaseModel):
    layout: Optional[bool] = False


class NERRequest(BaseModel):
    text: str
    locale: Optional[str] = None
    options: Optional[NEROptions] = None


class Entity(BaseModel):
    label: str
    text: str
    start: int
    end: int
    score: Optional[float] = None


class LayoutBlock(BaseModel):
    text: str
    start: int
    end: int
    order: int


class NERResponse(BaseModel):
    entities: List[Entity]
    layout: Optional[Dict[str, List[LayoutBlock]]] = None


class SkillsRequest(BaseModel):
    text: str
    topK: Optional[int] = 50
    locale: Optional[str] = None


class SkillTag(BaseModel):
    name: str
    text: Optional[str] = None
    start: Optional[int] = None
    end: Optional[int] = None
    score: Optional[float] = None


class SkillsResponse(BaseModel):
    skills: List[SkillTag]


# ------------------------------------------------------------------------------
# Utilities
# ------------------------------------------------------------------------------
_LABEL_MAP = {
    "PERSON": "PER",
    "ORG": "ORG",
    "GPE": "GPE",
    "LOC": "LOC",
    "DATE": "DATE",
}


def _map_label(label: str) -> str:
    return _LABEL_MAP.get(label.upper(), label.upper())


def _regex_contacts(text: str) -> List[Tuple[str, int, int]]:
    import re
    out: List[Tuple[str, int, int]] = []
    # Basic email
    for m in re.finditer(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text):
        out.append(("EMAIL", m.start(), m.end()))
    # Basic phone (liberal)
    for m in re.finditer(r"\+?\d[\d\s()\-]{7,}\d", text):
        out.append(("PHONE", m.start(), m.end()))
    return out


def _simple_layout_blocks(text: str) -> List[LayoutBlock]:
    # Minimal layout: split on blank lines into blocks and compute start/end offsets
    blocks: List[LayoutBlock] = []
    if not text:
        return blocks
    # Normalize line endings
    s = text.replace("\r\n", "\n").replace("\r", "\n")
    segments = s.split("\n\n")
    cursor = 0
    order = 0
    for seg in segments:
        seg_str = seg.strip("\n")
        if not seg_str:
            cursor += len(seg) + 2  # account for the "\n\n" we split on
            continue
        # Find the segment in the original string starting from cursor
        start_idx = s.find(seg_str, cursor)
        if start_idx == -1:
            # fallback linear offset
            start_idx = cursor
        end_idx = start_idx + len(seg_str)
        blocks.append(LayoutBlock(text=seg_str, start=start_idx, end=end_idx, order=order))
        order += 1
        # advance cursor past this segment and the assumed separator
        cursor = end_idx + 2
    return blocks


# ------------------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------------------
@app.get("/")
def root() -> Dict[str, str]:
    return {"status": "ok", "service": "spacy-ner", "model": _DEFAULT_MODEL_NAME}


@app.post("/ner", response_model=NERResponse)
def ner_endpoint(req: NERRequest, authorization: Optional[str] = Header(None)) -> NERResponse:
    _require_auth(authorization)
    text = (req.text or "").strip()
    if not text:
        return NERResponse(entities=[])

    nlp = _get_model_for_locale(req.locale)
    doc = nlp(text)

    ents: List[Entity] = []
    for ent in doc.ents:
        label = _map_label(ent.label_)
        ents.append(Entity(label=label, text=ent.text, start=ent.start_char, end=ent.end_char, score=None))

    # Optional regex contact augmentation (add non-overlapping EMAIL/PHONE spans)
    if _env_flag("ENABLE_REGEX_CONTACT", True):
        existing = [(e.start, e.end) for e in ents]
        def overlaps(a: Tuple[int,int], b: Tuple[int,int]) -> bool:
            return not (a[1] <= b[0] or b[1] <= a[0])
        for lab, s, e in _regex_contacts(text):
            if any(overlaps((s,e), span) for span in existing):
                continue
            ents.append(Entity(label=lab, text=text[s:e], start=s, end=e, score=None))

    payload: Dict[str, Any] = {"entities": ents}
    if req.options and req.options.layout:
        payload["layout"] = {"blocks": _simple_layout_blocks(text)}

    # Pydantic will coerce into NERResponse
    return payload  # type: ignore[return-value]


@app.post("/skills", response_model=SkillsResponse)
def skills_endpoint(req: SkillsRequest, authorization: Optional[str] = Header(None)) -> SkillsResponse:
    # Placeholder endpoint for future phases.
    _require_auth(authorization)
    return SkillsResponse(skills=[])
