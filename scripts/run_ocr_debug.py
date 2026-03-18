#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path

from cv_parser.pipeline.runner import run_pipeline


def main() -> int:
    ap = argparse.ArgumentParser(description="Run OCR pipeline with diagnostics for a single PDF")
    ap.add_argument("pdf", type=Path, help="Path to input PDF")
    ap.add_argument("--dpi", type=int, default=150)
    ap.add_argument("--rec-batch", type=int, default=None, dest="rec_batch")
    args = ap.parse_args()

    os.environ.setdefault("CV_OCR_DEBUG", "1")

    result = run_pipeline(args.pdf, mode="ocr", dpi=args.dpi, engine="pypdfium2")
    diag = result.diagnostics or {}
    engine = diag.get("engine") or "?"
    pages = diag.get("pages") or getattr(result.layout, "pages", [])
    try:
        pages = len(pages) if not isinstance(pages, int) else int(pages)
    except Exception:
        pages = 0
    blocks = diag.get("ocr_blocks") or 0
    chars = diag.get("chars") or 0
    sections = diag.get("sections_found") or {}
    debug_dir = diag.get("ocr_debug_dir") or ""

    print(
        f"OK engine={engine} pages={pages} blocks={blocks} chars={chars} sections={list(sections.keys())} debug_dir={debug_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

