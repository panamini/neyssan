"""Data augmentation utilities for resume robustness."""

from __future__ import annotations

import random
import re
from typing import Iterable


BULLET_MAP = {
    "•": "*",
    "◦": "-",
    "▪": "-",
}

HEADER_SYNONYMS = {
    "Résumé": "Summary",
    "Curriculum Vitae": "Summary",
    "Profile": "Summary",
}


def bullet_normalisation(text: str) -> str:
    def repl(match: re.Match) -> str:
        bullet = match.group(0)
        return BULLET_MAP.get(bullet, bullet)

    return re.sub(r"[•◦▪]", repl, text)


def line_wrap_jitter(text: str, max_cols: int = 60) -> str:
    lines = []
    for paragraph in text.split("\n\n"):
        buf = []
        for token in paragraph.split():
            if sum(len(t) + 1 for t in buf) + len(token) > random.randint(max_cols // 2, max_cols):
                lines.append(" ".join(buf))
                buf = [token]
            else:
                buf.append(token)
        if buf:
            lines.append(" ".join(buf))
        lines.append("")
    return "\n".join(lines)


def columnise(text: str) -> str:
    paragraphs = text.split("\n\n")
    left = paragraphs[::2]
    right = paragraphs[1::2]
    merged = []
    for l, r in zip(_pad(left), _pad(right)):
        merged.append(f"{l:<40} {r}")
    return "\n".join(merged)


def header_synonyms(text: str) -> str:
    for src, tgt in HEADER_SYNONYMS.items():
        text = text.replace(src, tgt)
    return text


def _pad(seq: Iterable[str]) -> Iterable[str]:
    return list(seq) + [""] * (len(seq) % 2)

