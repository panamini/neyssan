"""Pack parsed spaCy documents into canonical JSON output."""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Optional

from spacy.tokens import Doc, Span

from .constants import ENTITY_LABELS, SECTION_LABELS
from .postprocessing import normalise_value
from .types import PackedEntity, SectionSpan


def pack_document(
    doc: Doc,
    sections: List[SectionSpan],
    spans: Iterable[Span],
    extras: Optional[Dict[str, str]] = None,
) -> Dict:
    """Return JSON with sections + entities normalised."""

    entities: List[PackedEntity] = []
    for span in spans:
        section = getattr(span._, "section", None)
        page = getattr(span._, "page", None)
        confidence = getattr(span._, "confidence", None)
        value = normalise_value(span.label_, span.text.strip())
        entities.append(
            PackedEntity(
                label=span.label_,
                value=value,
                start=span.start_char,
                end=span.end_char,
                score=float(confidence) if confidence is not None else 0.0,
                section=section,
                page=page,
            )
        )

    by_section: Dict[str, Dict[str, List[Dict]]] = {
        label: {ent: [] for ent in ENTITY_LABELS} for label in SECTION_LABELS
    }

    for entity in entities:
        section = entity.section or "SUMMARY"
        if section not in by_section:
            by_section[section] = {ent: [] for ent in ENTITY_LABELS}
        by_section[section][entity.label].append(
            {
                "value": entity.value,
                "start": entity.start,
                "end": entity.end,
                "score": entity.score,
                **({"page": entity.page} if entity.page is not None else {}),
            }
        )

    packed_sections = []
    for section in sections:
        packed_sections.append(
            {
                "label": section.label,
                "text": section.text,
                "entities": {
                    label: values
                    for label, values in by_section.get(section.label, {}).items()
                    if values
                },
            }
        )

    # Entities not assigned to a section still appear under top-level mapping
    all_entities = defaultdict(list)
    for entity in entities:
        all_entities[entity.label].append(
            {
                "value": entity.value,
                "start": entity.start,
                "end": entity.end,
                "section": entity.section,
                "score": entity.score,
            }
        )

    return {
        "text": doc.text,
        "sections": packed_sections,
        "entities": dict(all_entities),
        "extras": extras or {},
    }

