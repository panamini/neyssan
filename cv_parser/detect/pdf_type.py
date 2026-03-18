"""PDF type detector deciding between text and scanned (OCR) paths."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict


@dataclass
class DetectionResult:
    mode: str  # "text" or "ocr"
    confidence: float
    diagnostics: Dict[str, float]


def detect_pdf_type(pdf_path: Path, text_threshold: float = 0.55) -> DetectionResult:
    """Heuristic detector using pdfplumber when available.

    The heuristic computes the ratio of extractable characters to page area. If the
    ratio falls below the threshold we assume the PDF is a scanned document.
    """
    try:
        import pdfplumber  # type: ignore
    except Exception:
        # Default to text mode when pdfplumber is unavailable.
        return DetectionResult(mode="text", confidence=0.2, diagnostics={"detector": 0.0})

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(pdf_path)

    total_chars = 0
    total_pages = 0
    text_like_pages = 0
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            total_pages += 1
            page_text = page.extract_text() or ""
            char_count = len(page_text.strip())
            total_chars += char_count
            width = page.width or 0
            height = page.height or 0
            area = max(width * height, 1)
            density = char_count / area
            if density >= text_threshold / 10000:  # compensate for page area scale
                text_like_pages += 1

    if total_pages == 0:
        return DetectionResult(mode="text", confidence=0.1, diagnostics={"detector": 0.0})

    ratio = text_like_pages / total_pages
    mode = "text" if ratio >= text_threshold else "ocr"
    confidence = min(max(ratio if mode == "text" else 1 - ratio, 0.0), 1.0)
    diagnostics = {
        "pages": float(total_pages),
        "text_like_pages": float(text_like_pages),
        "ratio": ratio,
        "total_chars": float(total_chars),
    }
    return DetectionResult(mode=mode, confidence=confidence, diagnostics=diagnostics)
