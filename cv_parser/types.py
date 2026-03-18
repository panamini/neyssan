"""Dataclasses used across the hybrid CV parser pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class LayoutBlock:
    """Represents a chunk of text emitted by the layout extractor."""

    page: int
    block_id: str
    text: str
    bbox: Tuple[float, float, float, float]
    column: int
    heading: bool = False
    font_family: Optional[str] = None
    font_size: Optional[float] = None
    bold: bool = False
    italic: bool = False
    metadata: Dict[str, str] = field(default_factory=dict)


@dataclass
class SectionSpan:
    """Represents a segmented section span prior to pattern / NER passes."""

    label: str
    text: str
    start_block: int
    end_block: int
    blocks: List[LayoutBlock] = field(default_factory=list)
    char_start: int = 0
    char_end: int = 0


@dataclass
class RuleMatch:
    label: str
    start: int
    end: int
    text: str
    confidence: float = 0.6


@dataclass
class PackedEntity:
    label: str
    value: str
    start: int
    end: int
    score: float
    section: Optional[str] = None
    page: Optional[int] = None
    metadata: Dict[str, str] = field(default_factory=dict)
