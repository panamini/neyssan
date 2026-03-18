#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF → images for OCR (PaddleOCR/LayoutLMv3 pipeline), state-of-the-art

- Memory-safe: renders directly to disk (paths_only=True).
- Fast/robust: defaults to pdftocairo backend and supports a timeout.
- Pipeline-friendly: names outputs as {stem}_page{N}.png (optional zero-pad).
- Extras: transparent background (PNG), grayscale, size, page-range.

Refs:
- pdf2image convert_from_path parameters (use_pdftocairo, timeout, paths_only, size, grayscale, transparent). 
- Poppler/pdftocairo options for PNG transparency and grayscale.
"""

import sys
import logging
import re
from pathlib import Path
from typing import List, Optional, Tuple, Union

from pdf2image import convert_from_path
from pdf2image.exceptions import (
    PDFInfoNotInstalledError,
    PDFPageCountError,
    PDFSyntaxError,
    PDFPopplerTimeoutError,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("pdf2images")


def _format_page_number(n: int, zero_pad: int) -> str:
    if zero_pad and zero_pad > 0:
        return f"{n:0{zero_pad}d}"
    return str(n)


def _parse_size_arg(size_str: Optional[str]) -> Optional[Union[int, Tuple[int, int]]]:
    """
    Accepts:
      - "W" (int)  → longest side scaled to W pixels (pdf2image behavior)
      - "WxH"      → explicit width/height
    """
    if not size_str:
        return None
    s = size_str.lower().strip()
    m = re.match(r"^\s*(\d+)\s*x\s*(\d+)\s*$", s)
    if m:
        return int(m.group(1)), int(m.group(2))
    if s.isdigit():
        return int(s)
    raise ValueError(f"Invalid --size value: {size_str!r}. Use INT or 'WxH'.")


def _rename_outputs_to_pipeline_friendly(
    paths: List[str],
    out_dir: Path,
    stem: str,
    start_page_number: int,
    zero_pad: int,
    overwrite: bool,
) -> List[str]:
    """
    Rename files returned by pdf2image to {stem}_page{N}.png in order.
    Uses the *actual* page numbers when --first-page/--last-page are given.
    """
    out_paths: List[str] = []
    page_num = start_page_number
    for src in paths:
        src_p = Path(src)
        dst = out_dir / f"{stem}_page{_format_page_number(page_num, zero_pad)}.png"
        page_num += 1

        if dst.exists():
            if overwrite:
                try:
                    dst.unlink()
                except Exception as e:
                    log.warning(f"Could not remove existing file {dst}: {e}")
            else:
                log.warning(f"File exists and was not overwritten: {dst}")
                out_paths.append(str(dst))
                continue

        try:
            src_p.replace(dst)
        except Exception:
            # Fallback to copy if atomic rename fails across devices
            import shutil
            shutil.copy2(src_p, dst)
            src_p.unlink(missing_ok=True)

        out_paths.append(str(dst))
    return out_paths


def pdf_to_images(
    pdf_path: str,
    out_dir: str,
    dpi: int = 300,
    first_page: Optional[int] = None,
    last_page: Optional[int] = None,
    thread_count: int = 2,
    poppler_path: Optional[str] = None,
    overwrite: bool = True,
    use_pdftocairo: bool = True,
    timeout: Optional[int] = None,
    transparent: bool = False,
    grayscale: bool = False,
    size: Optional[Union[int, Tuple[int, int]]] = None,
    zero_pad: int = 0,
    output_prefix: Optional[str] = None,
) -> List[str]:
    """
    Convert PDF pages to PNG images on disk.

    Args:
        pdf_path: Path to input PDF.
        out_dir: Directory for output images.
        dpi: Render DPI (typical OCR sweet spot: 300–400).
        first_page / last_page: Optional 1-based inclusive page range.
        thread_count: Threads for Poppler rendering.
        poppler_path: Path to Poppler bin/ (Windows).
        overwrite: Overwrite existing pipeline-named files if True.
        use_pdftocairo: Prefer pdftocairo backend (faster/more features).
        timeout: Seconds before raising PDFPopplerTimeoutError.
        transparent: PNG alpha background instead of white.
        grayscale: Render grayscale instead of RGB (PNG/JPEG/TIFF).
        size: int (scale longest side) or (width, height) in pixels.
        zero_pad: Zero padding for page index in output names (e.g., 3 → 001).
        output_prefix: Override base name (defaults to PDF stem).

    Returns:
        List of file paths to generated images, named as {stem}_page{N}.png
    """
    pdf_p = Path(pdf_path)
    out_p = Path(out_dir)
    if not pdf_p.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    if first_page and last_page and first_page > last_page:
        raise ValueError(f"Invalid page range: first_page={first_page} > last_page={last_page}")

    out_p.mkdir(parents=True, exist_ok=True)
    stem = (output_prefix or pdf_p.stem).lower()
    log.info(
        f"Converting {pdf_p} → {out_p} (dpi={dpi}, pages={first_page or 1}-{last_page or 'end'}, "
        f"pdftocairo={use_pdftocairo}, threads={thread_count})"
    )

    # Temporary prefix; we rename to pipeline-friendly names afterward.
    tmp_prefix = f"{stem}__tmp"

    try:
        # Render directly to disk for memory safety
        paths = convert_from_path(
            pdf_path=str(pdf_p),
            dpi=dpi,
            fmt="png",
            output_folder=str(out_p),
            output_file=tmp_prefix,
            first_page=first_page,
            last_page=last_page,
            thread_count=thread_count,
            paths_only=True,
            poppler_path=poppler_path,
            use_pdftocairo=use_pdftocairo,
            timeout=timeout,
            transparent=transparent,
            grayscale=grayscale,
            size=size,
        )

        # Guard: warn if pdf2image didn’t produce anything
        if not paths:
            log.warning("No images were produced by pdf2image.")
            return []

        # Rename to {stem}_page{N}.png, using true page numbering
        start_num = first_page if (first_page and first_page > 0) else 1
        out_paths = _rename_outputs_to_pipeline_friendly(
            paths=paths,
            out_dir=out_p,
            stem=stem,
            start_page_number=start_num,
            zero_pad=zero_pad,
            overwrite=overwrite,
        )

        # Cleanup leftover temp files
        for tmp_file in out_p.glob(f"{stem}__tmp*.png"):
            try:
                tmp_file.unlink(missing_ok=True)
            except Exception as e:
                log.debug(f"Could not remove temp file {tmp_file}: {e}")

        log.info(f"✅ Saved {len(out_paths)} page images")
        return out_paths

    except PDFInfoNotInstalledError:
        raise RuntimeError(
            "Poppler not found. Install Poppler or pass --poppler-path.\n"
            "macOS: brew install poppler | Windows: download Poppler and pass --poppler-path to its bin/."
        )
    except PDFPageCountError as e:
        raise RuntimeError(f"Could not determine page count: {e}")
    except PDFSyntaxError as e:
        raise RuntimeError(f"Malformed PDF: {e}")
    except PDFPopplerTimeoutError as e:
        raise RuntimeError(f"Rendering timed out after {timeout}s: {e}")


def main():
    import argparse
    import glob as _glob

    ap = argparse.ArgumentParser(description="Convert PDF(s) to PNGs for OCR.")
    ap.add_argument("input", help="PDF path, directory, or glob (e.g. data/*.pdf)")
    ap.add_argument("output_dir", help="Folder for output PNGs")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--first-page", type=int, default=None)
    ap.add_argument("--last-page", type=int, default=None)
    ap.add_argument("--thread-count", type=int, default=2)
    ap.add_argument("--poppler-path", type=str, default=None)
    ap.add_argument("--no-overwrite", action="store_true")
    # Keep both flags; default = True for pdftocairo to match docstring
    ap.add_argument("--use-pdftocairo", dest="use_pdftocairo", action="store_true")
    ap.add_argument("--no-use-pdftocairo", dest="use_pdftocairo", action="store_false")
    ap.set_defaults(use_pdftocairo=True)
    # Surface polish flags
    ap.add_argument("--zero-pad", type=int, default=0, help="Zero padding for page index (e.g., 3 → 001)")
    ap.add_argument("--transparent", action="store_true", help="Render with transparent background (PNG)")
    ap.add_argument("--timeout", type=int, default=600)
    args = ap.parse_args()

    # Resolve list of PDFs
    in_arg = Path(args.input)
    if in_arg.is_file() and in_arg.suffix.lower() == ".pdf":
        pdfs = [str(in_arg)]
    elif in_arg.is_dir():
        pdfs = [str(p) for p in sorted(in_arg.glob("*.pdf"))]
    else:
        pdfs = sorted(_glob.glob(args.input))

    if not pdfs:
        log.error(f"No PDF files found for input: {args.input}")
        sys.exit(1)

    ok, fail = 0, 0
    all_paths: List[str] = []

    for f in pdfs:
        try:
            out_paths = pdf_to_images(
                pdf_path=f,
                out_dir=args.output_dir,
                dpi=args.dpi,
                first_page=args.first_page,
                last_page=args.last_page,
                thread_count=args.thread_count,
                poppler_path=args.poppler_path,
                overwrite=not args.no_overwrite,
                use_pdftocairo=args.use_pdftocairo,
                timeout=args.timeout,
                transparent=args.transparent,
                zero_pad=args.zero_pad,
            )
            log.info(f"✅ {Path(f).name}: {len(out_paths)} pages")
            ok += 1
            all_paths.extend(out_paths)
        except Exception as e:
            if "PDFInfoNotInstalledError" in type(e).__name__:
                log.error("Poppler missing. Install it or pass --poppler-path.")
            log.error(f"Conversion failed for {f}: {e}")
            fail += 1

    # Optionally print list of generated files (useful in pipelines)
    if all_paths:
        log.debug("Generated files:")
        for p in all_paths:
            log.debug(f"  {p}")

    if fail:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
