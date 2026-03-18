#!/usr/bin/env python3
"""
Run a single OCR extraction with safe defaults and debug snapshots enabled.

Usage:
  python scripts/run_ocr_single.py <input.pdf> [--dpi 300] [--rec-batch 4] [--permissive]

Notes:
  - Sets CV_OCR_DEBUG=1 by default so you'll get PNGs + summary.json under /tmp/cv_ocr_dbg_<hash>/pass*/
  - Caps threads to avoid oversubscription on laptops/containers.
  - Uses spawn-safe entry (avoid stdin) to prevent macOS fork/Accelerate issues.
"""
from __future__ import annotations

import argparse
import faulthandler
import os
import sys
import traceback
from pathlib import Path


def _set_safe_env():
    os.environ.setdefault("CV_OCR_DEBUG", "1")
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")
    os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
    os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
    os.environ.setdefault("PADDLE_CPU_THREADS", "1")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Single OCR runner with debug snapshots")
    p.add_argument("input", type=str, help="Path to PDF input")
    p.add_argument("--dpi", type=int, default=300)
    p.add_argument("--rec-batch", dest="rec_batch", type=int, default=None)
    p.add_argument("--engine", choices=["pypdfium2"], default="pypdfium2")
    args = p.parse_args(argv)

    _set_safe_env()
    faulthandler.enable(all_threads=True)

    from cv_parser.extract.ocr_pdf import extract_ocr_pdf

    pdf_path = Path(args.input)
    if not pdf_path.exists():
        print(f"[ocr-single] file not found: {pdf_path}", file=sys.stderr)
        return 2

    print(
        f"[ocr-single] start engine={args.engine} dpi={args.dpi} file={pdf_path}")
    try:
        res = extract_ocr_pdf(
            pdf_path,
            dpi=args.dpi,
            engine=args.engine,
            rec_batch_num=args.rec_batch,
            pass_id=1,
        )
    except Exception:
        print("[ocr-single] Unhandled exception during OCR:", file=sys.stderr)
        traceback.print_exc()
        return 1

    diag = res.diagnostics or {}
    pages = diag.get("pages")
    blocks = diag.get("ocr_blocks")
    debug_dir = diag.get("ocr_debug_dir")
    raw = (res.normalized.raw or "") if getattr(res, "normalized", None) else ""
    print(
        f"[ocr-single] OK pages={pages} blocks={blocks} chars={len(raw)} debug_dir={debug_dir}")
    if raw:
        preview = raw.strip().splitlines()[:5]
        print("[ocr-single] preview:")
        for line in preview:
            print("  ", line[:200])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
