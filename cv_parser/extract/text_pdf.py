"""Extraction path for text-based PDFs using pdfplumber + light heuristics."""
from __future__ import annotations

import logging
import re
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

try:
    import phonenumbers  # type: ignore
    from phonenumbers import PhoneNumberFormat  # type: ignore
    from phonenumbers.phonenumberutil import NumberParseException  # type: ignore
except Exception:  # pragma: no cover - optional dependency may be absent
    phonenumbers = None  # type: ignore
    PhoneNumberFormat = None  # type: ignore
    NumberParseException = Exception  # type: ignore

from ..schema.model import (
    ArrayItem,
    LayoutBlock,
    LayoutResult,
    NormalizedCv,
    PipelineResult,
    StrictContact,
    TextField,
)
from .bbox import normalize_bbox
from .sections import parse_sections, split_tokens
from ..pipeline import hybrid_mapping

log = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\+?[0-9][0-9\s().-]{7,}")

PHONE_REGION_CANDIDATES: Tuple[str, ...] = ("ZZ", "FR", "DE", "ES", "GB", "US", "CA")


def _normalize_phone_candidate(raw: Optional[str], preferred_region: Optional[str] = None) -> Tuple[Optional[str], Optional[float]]:
    if phonenumbers is None or PhoneNumberFormat is None or not raw:
        return None, None
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 8:
        return None, None

    region_sequence: Tuple[str, ...]
    if preferred_region:
        if preferred_region in PHONE_REGION_CANDIDATES:
            region_sequence = (preferred_region,) + tuple(
                r for r in PHONE_REGION_CANDIDATES if r != preferred_region
            )
        else:
            region_sequence = (preferred_region,) + PHONE_REGION_CANDIDATES
    else:
        region_sequence = PHONE_REGION_CANDIDATES

    for region in region_sequence:
        try:
            parsed = phonenumbers.parse(raw, region)
        except NumberParseException:
            continue
        except Exception:  # pragma: no cover - defensive guard
            continue
        if not phonenumbers.is_valid_number(parsed):
            continue
        normalized = phonenumbers.format_number(parsed, PhoneNumberFormat.E164)
        if normalized:
            return normalized, 0.9
    return None, None


def _cluster_column_split(lines: List[Tuple[float, str]]) -> Optional[float]:
    x_values = sorted(x for x, text in lines if text)
    if len(x_values) < 3:
        return None
    gaps: List[Tuple[float, int]] = []
    for idx in range(len(x_values) - 1):
        gap = x_values[idx + 1] - x_values[idx]
        gaps.append((gap, idx))
    if not gaps:
        return None
    largest_gap, gap_idx = max(gaps, key=lambda item: item[0])
    if largest_gap < 40.0:
        return None
    return (x_values[gap_idx] + x_values[gap_idx + 1]) / 2.0


def _reconstruct_page_text(page) -> str:
    try:
        words = page.extract_words(
            use_text_flow=True,
            extra_attrs=["x0", "x1", "top", "bottom"],
        ) or []
    except Exception:
        words = []

    if not words:
        return page.extract_text() or ""

    lines_map: Dict[int, List[dict]] = defaultdict(list)
    for word in words:
        top = float(word.get("top", 0.0))
        line_key = int(round(top / 2.0))
        lines_map[line_key].append(word)

    line_entries: List[Tuple[int, str, float, float, float]] = []
    for key, items in lines_map.items():
        ordered = sorted(items, key=lambda w: w.get("x0", 0.0))
        text = " ".join(filter(None, (w.get("text", "").strip() for w in ordered)))
        if not text:
            continue
        xs = [float(w.get("x0", 0.0)) for w in ordered]
        xe = [float(w.get("x1", w.get("x0", 0.0))) for w in ordered]
        avg_x = sum(xs) / len(xs)
        min_x = min(xs)
        max_x = max(xe)
        line_entries.append((key, text, avg_x, min_x, max_x))

    if not line_entries:
        return page.extract_text() or ""

    line_entries.sort(key=lambda entry: entry[0])
    split = _cluster_column_split([(entry[2], entry[1]) for entry in line_entries])
    if split is None:
        return "\n".join(entry[1] for entry in line_entries)

    left: List[Tuple[int, str]] = []
    right: List[Tuple[int, str]] = []
    for key, text, avg_x, min_x, max_x in line_entries:
        if not text:
            continue
        spans_split = min_x < split and max_x > split * 0.95
        if spans_split:
            left.append((key, text))
            continue
        if avg_x <= split:
            left.append((key, text))
        else:
            right.append((key, text))

    left.sort(key=lambda item: item[0])
    right.sort(key=lambda item: item[0])

    left_text = "\n".join(text for _, text in left if text)
    right_text = "\n".join(text for _, text in right if text)

    if left_text and right_text:
        candidate = f"{left_text}\n\n{right_text}"
    else:
        candidate = left_text or right_text

    if candidate:
        tokens = candidate.split()
        if tokens:
            singles = sum(1 for token in tokens if len(token) == 1)
            if singles / len(tokens) > 0.6:
                fallback = page.extract_text() or ""
                return fallback or candidate
    return candidate


def extract_text_pdf(pdf_path: Path) -> PipelineResult:
    """Extract a NormalizedCv from a text PDF.

    The implementation intentionally keeps the heuristics lightweight—the primary
    goal is to emit a well-structured payload that the frontend can consume
    without additional mapping logic.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(pdf_path)

    raw_text: str = ""
    layout = LayoutResult()

    # Allow plaintext inputs for testing / CLI usage with --mode text.
    if pdf_path.suffix.lower() not in {".pdf"}:
        raw_text = pdf_path.read_text(encoding="utf-8", errors="ignore")

    if not raw_text:
        try:
            import pdfplumber  # type: ignore
        except Exception as exc:  # pragma: no cover - pdfplumber optional in some envs
            log.warning("pdfplumber not available: attempting pypdfium2 fallback (%s)", exc)
            try:
                import pypdfium2 as pdfium  # type: ignore

                doc = pdfium.PdfDocument(str(pdf_path))
                try:
                    for page_index in range(len(doc)):
                        page = doc[page_index]
                        try:
                            width, height = page.get_size()
                            layout.pages.append(
                                {
                                    "page": page_index + 1,
                                    "width": float(width or 0.0),
                                    "height": float(height or 0.0),
                                }
                            )
                            textpage = page.get_textpage()
                            try:
                                char_count = textpage.count_chars() or 0
                                text = textpage.get_text_range(0, char_count) if char_count else ""
                            finally:
                                textpage.close()
                            raw_text += text + "\n"
                        finally:
                            page.close()
                finally:
                    doc.close()
            except Exception as pdfium_exc:  # pragma: no cover - defensive
                log.warning(
                    "pypdfium2 fallback failed; reading file bytes directly (%s)",
                    pdfium_exc,
                )
                raw_text = pdf_path.read_text(encoding="utf-8", errors="ignore")
        else:
            with pdfplumber.open(str(pdf_path)) as pdf:
                for page_index, page in enumerate(pdf.pages, start=1):
                    text = _reconstruct_page_text(page)
                    if text:
                        raw_text += text + "\n"
                    layout.pages.append(
                        {
                            "page": page_index,
                            "width": float(page.width or 0.0),
                            "height": float(page.height or 0.0),
                        }
                    )
                    try:
                        words = page.extract_words(use_text_flow=True) or []
                    except Exception:
                        words = []
                    for word in words:
                        bbox = normalize_bbox(
                            (word.get("x0", 0.0), word.get("top", 0.0), word.get("x1", 0.0), word.get("bottom", 0.0)),
                            page.width or 0.0,
                            page.height or 0.0,
                        )
                        layout.blocks.append(
                            LayoutBlock(
                                page=page_index,
                                text=word.get("text", ""),
                                bbox=bbox,
                                block_type="word",
                                metadata={"direction": word.get("direction", "ltr")},
                            )
                        )

    raw_text = raw_text.strip()
    
    if not raw_text:
        log.warning("Text extraction yielded 0 chars for %s; PDF may be scanned/empty", pdf_path)
        # Add minimal placeholder
        raw_text = f"[Empty PDF detected: {pdf_path.name}]"

    summary_text = raw_text[:600].strip()

    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    phone_raw: Optional[str] = None
    phone_e164: Optional[str] = None
    phone_confidence: Optional[float] = None
    if summary_text:
        email_match = EMAIL_RE.search(raw_text)
        if email_match:
            contact_email = email_match.group(0)
        phone_match = PHONE_RE.search(raw_text)
        if phone_match:
            contact_phone = phone_match.group(0)
            phone_raw = contact_phone

    matched_region: Optional[str] = None
    if phonenumbers is not None and PhoneNumberFormat is not None:
        try:
            matcher = phonenumbers.PhoneNumberMatcher(raw_text, "ZZ")
        except Exception:
            matcher = None
        if matcher is not None:
            for match in matcher:
                try:
                    number = match.number
                except AttributeError:  # pragma: no cover - defensive
                    continue
                if not phonenumbers.is_possible_number(number):
                    continue
                if not phonenumbers.is_valid_number(number):
                    continue
                candidate_e164 = phonenumbers.format_number(number, PhoneNumberFormat.E164)
                if candidate_e164:
                    phone_e164 = candidate_e164
                    phone_confidence = 0.9
                    phone_raw = getattr(match, "raw_string", None) or contact_phone or candidate_e164
                    if not contact_phone:
                        contact_phone = getattr(match, "raw_string", None) or candidate_e164
                    matched_region = phonenumbers.region_code_for_number(number)
                    break
        if phone_e164 is None:
            for region in PHONE_REGION_CANDIDATES:
                if region == "ZZ":
                    continue
                try:
                    region_matcher = phonenumbers.PhoneNumberMatcher(raw_text, region)
                except Exception:
                    continue
                found = False
                for match in region_matcher:
                    try:
                        number = match.number
                    except AttributeError:  # pragma: no cover - defensive
                        continue
                    if not phonenumbers.is_possible_number(number):
                        continue
                    if not phonenumbers.is_valid_number(number):
                        continue
                    candidate_e164 = phonenumbers.format_number(number, PhoneNumberFormat.E164)
                    if not candidate_e164:
                        continue
                    phone_e164 = candidate_e164
                    phone_confidence = 0.9
                    phone_raw = getattr(match, "raw_string", None) or contact_phone or candidate_e164
                    if not contact_phone:
                        contact_phone = getattr(match, "raw_string", None) or candidate_e164
                    matched_region = phonenumbers.region_code_for_number(number)
                    found = True
                    break
                if found:
                    break
        if phone_e164 is None:
            phone_e164, phone_confidence = _normalize_phone_candidate(phone_raw or contact_phone, matched_region)

    from ..schema.model import ContactInfo  # local import to avoid circular

    normalized = NormalizedCv(
        name=None,
        contact=ContactInfo(
            email=contact_email,
            phone=contact_phone,
            phoneRaw=phone_raw or contact_phone,
            phoneE164=phone_e164,
            raw=summary_text if summary_text else raw_text[:2000],
        ),
        summary=TextField(text=summary_text or "", confidence=0.5) if summary_text else None,
        raw=raw_text,
        rawSections=[],
    )

    strict = StrictContact(
        email=contact_email,
        phone=contact_phone,
        name=None,
        location=None,
    )

    diagnostics = {
        "strategy": "text_pdf",
        "chars": len(raw_text),
        "pages": len(layout.pages),
        "hybrid_used": False,
        "fallback_used": False,
        "sections_found": {},
        "engine": "text",
        "empty_reason": None,
    }

    if phone_e164:
        diagnostics["phone_e164"] = phone_e164
    if phone_confidence is not None:
        diagnostics["phone_confidence"] = phone_confidence
    diagnostics["phone_parser"] = "phonenumbers" if phonenumbers is not None and PhoneNumberFormat is not None else "regex"

    parser = hybrid_mapping.get_hybrid_parser()
    section_counts: Dict[str, int] = {}
    hybrid_used = False
    if parser:
        packed = None
        try:
            if pdf_path.suffix.lower() == ".pdf":
                packed = parser.parse_path(pdf_path)
            elif raw_text:
                packed = parser.parse_text(raw_text)
        except Exception as exc:  # pragma: no cover - hybrid path optional
            log.debug("Hybrid parser failed on %s: %s", pdf_path, exc)
        if not packed and raw_text:
            try:
                packed = parser.parse_text(raw_text)
            except Exception:
                packed = None
        if packed:
            strict_candidate, hybrid_used, section_counts = hybrid_mapping.apply_hybrid_mapping(normalized, packed)
            if strict_candidate:
                strict = strict_candidate
    diagnostics["hybrid_used"] = hybrid_used

    fallback_used = False
    # Determine which sections still need heuristic support.
    needs_fallback = any(
        (
            not normalized.experience,
            not normalized.education,
            not normalized.skills,
            not normalized.languages,
            not normalized.achievements,
        )
    )

    raw_sections_payload = []
    if needs_fallback:
        section_map = parse_sections(raw_text)

        if not normalized.experience:
            experience_items = [
                ArrayItem(content=entry, confidence=0.45)
                for entry in section_map["experience"]
            ]
            if experience_items:
                normalized.experience = experience_items
                raw_sections_payload.extend(
                    {"label": "EXPERIENCE", "content": entry} for entry in section_map["experience"]
                )
                section_counts["EXPERIENCE"] = len(section_map["experience"])
                fallback_used = True

        if not normalized.education:
            education_items = [
                ArrayItem(content=entry, confidence=0.45)
                for entry in section_map["education"]
            ]
            if education_items:
                normalized.education = education_items
                raw_sections_payload.extend(
                    {"label": "EDUCATION", "content": entry} for entry in section_map["education"]
                )
                section_counts["EDUCATION"] = len(section_map["education"])
                fallback_used = True

        if not normalized.skills:
            skills_tokens = split_tokens(section_map["skills"])
            if skills_tokens:
                normalized.skills = TextField(
                    text=", ".join(skills_tokens),
                    confidence=0.4,
                )
                raw_sections_payload.extend(
                    {"label": "SKILLS", "content": token} for token in skills_tokens
                )
                section_counts["SKILLS"] = len(skills_tokens)
                fallback_used = True

        if not normalized.languages:
            language_tokens = split_tokens(section_map["languages"])
            if language_tokens:
                normalized.languages = TextField(
                    text=", ".join(language_tokens),
                    confidence=0.4,
                )
                normalized.languagesRaw = language_tokens
                raw_sections_payload.extend(
                    {"label": "LANGUAGES", "content": token} for token in language_tokens
                )
                section_counts["LANGUAGES"] = len(language_tokens)
                fallback_used = True

        if not normalized.achievements:
            achievement_items = [
                entry for entry in section_map["achievements"] if entry.strip()
            ]
            if achievement_items:
                normalized.achievements = TextField(
                    text="\n".join(achievement_items),
                    confidence=0.35,
                )
                raw_sections_payload.extend(
                    {"label": "ACHIEVEMENTS", "content": entry} for entry in achievement_items
                )
                section_counts["ACHIEVEMENTS"] = len(achievement_items)
                fallback_used = True

    if raw_sections_payload and not normalized.rawSections:
        normalized.rawSections = raw_sections_payload

    for key in ("EXPERIENCE", "EDUCATION", "SKILLS", "LANGUAGES", "ACHIEVEMENTS"):
        section_counts.setdefault(key, 0)

    diagnostics["fallback_used"] = fallback_used
    diagnostics["sections_found"] = section_counts

    return PipelineResult(normalized=normalized, strict=strict, layout=layout, diagnostics=diagnostics)
