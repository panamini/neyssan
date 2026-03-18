"""Resolve overlaps between deterministic rule matches and transformer NER spans."""

from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from spacy.tokens import Doc, Span

# Label priority for overlaps (higher value wins)
LABEL_PRIORITY: Dict[str, int] = {
    "NAME": 100,
    "EMAIL": 95,
    "PHONE": 95,
    "ROLE": 80,
    "COMPANY": 78,
    "START_DATE": 75,
    "END_DATE": 74,
    "DEGREE": 70,
    "CERTIFICATE": 69,
    "INSTITUTION": 68,
    "SKILL": 60,
    "LANGUAGE": 60,
    "ACHIEVEMENT": 55,
    "PROJECT": 55,
    "AWARD": 55,
    "GPE": 50,
    "LOC": 49,
    "ADDRESS": 48,
}


def resolve(doc: Doc, seed_spans: Iterable[Span]) -> List[Span]:
    """Combine model spans with rule seeds using priority / confidence heuristics."""

    accepted: List[Span] = []
    for span in sorted(seed_spans, key=lambda s: LABEL_PRIORITY.get(s.label_, 0), reverse=True):
        if not _overlaps(span, accepted):
            accepted.append(span)

    for span in sorted(doc.ents, key=lambda s: LABEL_PRIORITY.get(s.label_, 0), reverse=True):
        if not _overlaps(span, accepted):
            accepted.append(span)
        else:
            winning = _winner(span, accepted)
            if winning is span:
                accepted.append(span)

    return sorted(accepted, key=lambda s: (s.start, s.end))


def _overlaps(span: Span, spans: Iterable[Span]) -> bool:
    for other in spans:
        if other.start < span.end and span.start < other.end:
            return True
    return False


def _winner(span: Span, spans: Iterable[Span]) -> Span:
    highest = span
    for other in spans:
        if other.start < span.end and span.start < other.end:
            current = LABEL_PRIORITY.get(highest.label_, 0)
            challenger = LABEL_PRIORITY.get(other.label_, 0)
            if challenger > current or (challenger == current and getattr(other, "_.confidence", 0) > getattr(highest, "_.confidence", 0)):
                highest = other
    return highest

