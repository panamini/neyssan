#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path

from cv_parser.pipeline.runner import run_pipeline

PDFS = [
    Path("fixtures/sample_textpdf_resume.pdf"),  # native text
    Path("cv_parser/ocr/data/raw_pdfs/cvpng.pdf"),  # scanned/simple
    Path("fixtures/cv_png.pdf"),  # noisy/edge
]


def bench_one(pdf: Path, dpi: int = 120) -> dict:
    res = run_pipeline(pdf, mode="ocr", dpi=dpi, engine="pypdfium2")
    diag = res.diagnostics or {}
    return {
        "engine": diag.get("engine"),
        "pages": diag.get("pages"),
        "ocr_blocks": diag.get("ocr_blocks"),
        "chars": diag.get("chars"),
        "sections_found": diag.get("sections_found"),
        "fallback_used": diag.get("fallback_used"),
        "empty_reason": diag.get("empty_reason"),
    }


def main() -> int:
    outputs = {}
    dpi = int(os.environ.get("OCR_BENCH_DPI", "120"))

    for pdf in PDFS:
        if not pdf.exists():
            continue
        outputs[str(pdf)] = bench_one(pdf, dpi=dpi)

    out_path = Path(os.environ.get("OCR_BENCH_OUT", "/tmp/ocr_bench.json"))
    out_path.write_text(json.dumps(outputs, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

