"""Section segmentation from layout blocks."""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Tuple

from .constants import SECTION_LABELS, MIN_COLUMN_GAP_RATIO
from .types import LayoutBlock, SectionSpan


SECTION_SYNONYMS: Dict[str, Tuple[re.Pattern, ...]] = {
    "SUMMARY": (
        re.compile(r"^(summary|professional summary|profile|biodata|career summary)$", re.I),
        re.compile(r"^(professional profile|executive summary)$", re.I),
    ),
    "EXPERIENCE": (
        re.compile(r"^(experience|work experience|employment history|professional experience)$", re.I),
        re.compile(r"^(work history|career history)$", re.I),
    ),
    "EDUCATION": (
        re.compile(r"^(education|educational background|academic background|academic credentials)$", re.I),
        re.compile(r"^(education & training|training|qualifications)$", re.I),
    ),
    "SKILLS": (
        re.compile(r"^(skills|key skills|technical skills|competencies|core competencies)$", re.I),
        re.compile(r"^(technical strengths|professional skills)$", re.I),
    ),
    "CERTIFICATIONS": (
        re.compile(r"^(certifications?|licenses?)$", re.I),
    ),
    "CONTACT": (
        re.compile(r"^(contact|contact details|contact information|profile)$", re.I),
    ),
    "LANGUAGES": (
        re.compile(r"^(languages?|language skills?)$", re.I),
    ),
    "PROJECTS": (
        re.compile(r"^(projects?|personal projects?|selected projects?)$", re.I),
    ),
    "ACHIEVEMENTS": (
        re.compile(r"^(achievements?|accomplishments?|career highlights)$", re.I),
    ),
    "AWARDS": (
        re.compile(r"^(awards?|honours?|honors?)$", re.I),
    ),
}


class SectionSegmenter:
    def __init__(self) -> None:
        self.section_order = {label: idx for idx, label in enumerate(SECTION_LABELS)}

    def segment(self, blocks: List[LayoutBlock]) -> List[SectionSpan]:
        ordered = sorted(
            blocks,
            key=lambda b: (b.page, b.column, self._safe_block_index(b.block_id)),
        )
        sections: List[SectionSpan] = []
        current: Optional[SectionSpan] = None

        for idx, block in enumerate(ordered):
            label = self._resolve_label(block)
            if label:
                current = SectionSpan(label=label, text=block.text, start_block=idx, end_block=idx, blocks=[block])
                sections.append(current)
                continue

            if current is None:
                # default to SUMMARY bucket until first heading found
                current = SectionSpan(label="SUMMARY", text=block.text, start_block=idx, end_block=idx, blocks=[block])
                sections.append(current)
                continue

            if self._should_split(current, block):
                # treat as continuation of current section but break on large vertical gaps/columns
                current = SectionSpan(label=current.label, text=block.text, start_block=idx, end_block=idx, blocks=[block])
                sections.append(current)
            else:
                current.text += "\n\n" + block.text
                current.blocks.append(block)
                current.end_block = idx

        return sections

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _safe_block_index(block_id: str) -> int:
        try:
            return int(re.sub(r"\D", "", block_id))
        except Exception:
            return 0

    def _resolve_label(self, block: LayoutBlock) -> Optional[str]:
        first_line = block.text.splitlines()[0].strip()
        if block.heading:
            candidate = self._lookup_section(first_line)
            if candidate:
                return candidate

        colon_trimmed = first_line[:-1] if first_line.endswith(":") else first_line
        candidate = self._lookup_section(first_line) or self._lookup_section(colon_trimmed)
        if candidate:
            return candidate

        # treat ALL CAPS as potential headings
        letters = ''.join(ch for ch in colon_trimmed if ch.isalpha())
        if letters and letters.isupper():
            upper_candidate = self._lookup_section(colon_trimmed.title())
            if upper_candidate:
                return upper_candidate
        return None

    def _lookup_section(self, heading: str) -> Optional[str]:
        for label, patterns in SECTION_SYNONYMS.items():
            for pattern in patterns:
                if pattern.match(heading):
                    return label
        return None

    @staticmethod
    def _should_split(current: SectionSpan, block: LayoutBlock) -> bool:
        # Different page -> new section chunk with same label to maintain ordering.
        if block.page != current.blocks[-1].page:
            return True
        # Column change with significant gap -> treat as separate chunk to avoid bleed
        prev = current.blocks[-1]
        if prev.column != block.column:
            return abs(prev.column - block.column) >= 1
        # Vertical spacing heuristics (if bbox available)
        try:
            prev_bottom = prev.bbox[3]
            curr_top = block.bbox[1]
            prev_height = prev.bbox[3] - prev.bbox[1]
            if prev_height > 0:
                gap_ratio = (curr_top - prev_bottom) / prev_height
                return gap_ratio > MIN_COLUMN_GAP_RATIO * 4
        except Exception:
            pass
        return False


def segment_layout(blocks: List[LayoutBlock]) -> List[SectionSpan]:
    return SectionSegmenter().segment(blocks)

