"""Utilities for working with ESCO skill exports."""

from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path
from typing import Iterable, Iterator, List, Optional, Sequence, Set

_SPLIT_PATTERN = re.compile(r"[\n\r,;|]+")
_DEFAULT_DELIMS = [";", ",", "\t", "|"]


def detect_delimiter(sample: str) -> str:
    """Return the likely delimiter used in a CSV sample."""

    best_delim = ","
    best_score = -1
    for delim in _DEFAULT_DELIMS:
        count = sample.count(delim)
        if count > best_score:
            best_score = count
            best_delim = delim
    return best_delim


def normalize_esco_label(text: str) -> str:
    """Lowercase, strip, and de-accent skill labels for matching."""

    text = unicodedata.normalize("NFKC", text or "")
    text = text.strip().strip("\uFEFF")
    text = re.sub(r"\s+", " ", text)
    text = text.lower()
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.strip().strip("-_.")
    return text


def split_alt_labels(text: str) -> Iterator[str]:
    for part in _SPLIT_PATTERN.split(text or ""):
        part = part.strip().strip('"')
        if part:
            yield part


def iter_rows(path: Path, delimiter: Optional[str] = None) -> Iterator[Sequence[str]]:
    with path.open("r", encoding="utf-8", newline="") as fh:
        sample = fh.read(8192)
        fh.seek(0)
        current_delim = delimiter or detect_delimiter(sample)
        reader = csv.reader(fh, delimiter=current_delim)
        for row in reader:
            if row:
                yield row


def extract_labels(rows: Iterable[Sequence[str]]) -> List[str]:
    iterator = iter(rows)
    try:
        header = next(iterator)
    except StopIteration:
        return []

    header_lower = [col.lower().strip() for col in header]
    index_map = {name: idx for idx, name in enumerate(header_lower)}

    pref_idx = index_map.get("preferredlabel")
    if pref_idx is None:
        pref_idx = index_map.get("preferred label")
    if pref_idx is None and len(header_lower) > 1:
        pref_idx = 1

    alt_idx = index_map.get("altlabels")
    if alt_idx is None:
        alt_idx = index_map.get("alt labels")
    if alt_idx is None and len(header_lower) > 2:
        alt_idx = 2

    labels: List[str] = []
    for row in iterator:
        if pref_idx is not None and pref_idx < len(row):
            preferred = row[pref_idx]
            if preferred:
                labels.append(preferred)
        if alt_idx is not None and alt_idx < len(row):
            labels.extend(split_alt_labels(row[alt_idx]))
    return labels


def load_labels_from_csv(path: Path, delimiter: Optional[str] = None) -> Set[str]:
    rows = list(iter_rows(path, delimiter))
    raw_labels = extract_labels(rows)
    labels: Set[str] = set()
    for label in raw_labels:
        normalized = normalize_esco_label(label)
        if not normalized:
            continue
        if normalized.startswith("http://") or normalized.startswith("https://"):
            continue
        labels.add(normalized)
    return labels


def load_labels(path: Path) -> Set[str]:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".list"}:
        labels: Set[str] = set()
        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                normalized = normalize_esco_label(line)
                if normalized and not normalized.startswith("http"):
                    labels.add(normalized)
        return labels
    return load_labels_from_csv(path)
