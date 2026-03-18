#!/usr/bin/env python3
"""Lightweight PDF-to-text extractor used by the A/B/C runner.

Uses pdfplumber to read page text. On any failure, raises a clear error so the
caller can fall back to OCR without attempting brittle raw-byte decoding."""

from __future__ import annotations

import argparse
import logging
import sys
import traceback
from pathlib import Path
from typing import Optional

LOG = logging.getLogger("pdf_text")


class PdfExtractionError(RuntimeError):
    """Raised when text cannot be recovered from a PDF."""


def extract_pdf_text(path: Path, max_pages: Optional[int] = None) -> str:
    """Return plain text extracted from a PDF file via pdfplumber."""
    path = Path(path)
    if not path.exists():
        raise PdfExtractionError(f"File not found: {path}")

    try:
        import pdfplumber  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dependency
        LOG.error("pdfplumber import failed: %s\n%s", exc, traceback.format_exc())
        raise PdfExtractionError(f"pdfplumber import failed: {exc}") from exc

    try:
        limit = None
        if isinstance(max_pages, int) and max_pages > 0:
            limit = max_pages
        texts: list[str] = []
        with pdfplumber.open(str(path)) as pdf:  # type: ignore[attr-defined]
            pages = pdf.pages if limit is None else pdf.pages[:limit]
            for page in pages:
                page_text = page.extract_text() or ""
                cleaned = page_text.strip()
                if cleaned:
                    texts.append(cleaned)
        combined = "\n\n".join(texts).strip()
    except Exception as exc:  # pragma: no cover - defensive guard
        LOG.error("pdfplumber extraction failed for %s: %s\n%s", path, exc, traceback.format_exc())
        raise PdfExtractionError(f"pdfplumber failed: {exc}") from exc

    if not combined:
        raise PdfExtractionError("pdfplumber returned empty text")
    return combined


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Extract text from a PDF.")
    parser.add_argument("path", help="PDF path to extract")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Optional page limit when extracting text",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        text = extract_pdf_text(Path(args.path), max_pages=args.max_pages)
    except PdfExtractionError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
