"""Layout ingestion utilities.

This module encapsulates access to layout extractors (spaCy-layout / Docling style)
and provides a consistent representation (`LayoutBlock`). It gracefully degrades to
plain-text parsing when PDF/DOCX dependencies are unavailable, which keeps tests
lightweight while still exercising the segmentation heuristics.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable, List, Optional

from .types import LayoutBlock

LOGGER = logging.getLogger(__name__)


class LayoutIngestor:
    """Facade for loading layout blocks from supported resume formats."""

    def __init__(self, prefer_docling: bool = True) -> None:
        self.prefer_docling = prefer_docling

    def load(self, path: Path) -> List[LayoutBlock]:
        suffix = path.suffix.lower()
        if suffix in {".txt", ".md"}:
            return list(self._from_plain_text(path))

        if suffix in {".pdf", ".docx"} and self.prefer_docling:
            blocks = self._from_docling(path)
            if blocks:
                return blocks

        # Fallback: treat as plain text
        LOGGER.warning("Falling back to plaintext ingestion for %s", path.name)
        return list(self._from_plain_text(path))

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------
    def _from_docling(self, path: Path) -> List[LayoutBlock]:
        """Attempt parsing with Docling or spaCy-layout style APIs."""

        try:
            from docling.document import Document as DoclingDocument  # type: ignore
        except Exception:  # pragma: no cover - optional dependency
            return []

        try:
            doc = DoclingDocument.from_file(str(path))
        except Exception as exc:  # pragma: no cover - IO errors
            LOGGER.error("Docling failed to parse %s: %s", path, exc)
            return []

        blocks: List[LayoutBlock] = []
        for page in doc.pages:
            for block in page.blocks:
                text = block.text.strip()
                if not text:
                    continue
                blocks.append(
                    LayoutBlock(
                        page=page.page_number,
                        block_id=str(block.id),
                        text=text,
                        bbox=(block.bbox.x0, block.bbox.y0, block.bbox.x1, block.bbox.y1),
                        column=getattr(block, "column", 0) or 0,
                        heading=bool(getattr(block, "is_heading", False)),
                        font_family=getattr(block, "font_family", None),
                        font_size=getattr(block, "font_size", None),
                        bold=bool(getattr(block, "bold", False)),
                        italic=bool(getattr(block, "italic", False)),
                        metadata={"block_type": getattr(block, "type", "text")},
                    )
                )
        return blocks

    def _from_plain_text(self, path: Path) -> Iterable[LayoutBlock]:
        text = path.read_text(encoding="utf-8")
        page = 1
        column = 0
        for idx, chunk in enumerate(text.split("\n\n")):
            chunk = chunk.strip()
            if not chunk:
                continue
            heading = self._looks_like_heading(chunk.splitlines()[0])
            yield LayoutBlock(
                page=page,
                block_id=f"plain-{idx}",
                text=chunk,
                bbox=(0.0, float(idx), 1.0, float(idx) + 1.0),
                column=column,
                heading=heading,
            )

    @staticmethod
    def _looks_like_heading(text: str) -> bool:
        stripped = text.strip()
        if not stripped:
            return False
        if stripped.endswith(":"):
            stripped = stripped[:-1]
        alpha = ''.join(ch for ch in stripped if ch.isalpha())
        if not alpha:
            return False
        return alpha.isupper() and len(alpha) >= 3


def ingest_document(path: Path, prefer_docling: bool = True) -> List[LayoutBlock]:
    """Convenience function for one-off usage."""

    return LayoutIngestor(prefer_docling=prefer_docling).load(path)

