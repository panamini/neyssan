#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PP-Structure OCR for CV parsing pipeline (MVP, version-safe)

Runs PaddleOCR's PP-Structure on images to extract layout, text, and tables.
Outputs structured JSON (raw PP-Structure-like schema) with heavy blobs removed.

Features
--------
- Lazy initialization of PP-Structure (class wrapper)
- Version safety: log paddleocr.__version__, retry init if kwargs mismatch
- Batch + threaded processing with optional per-worker engines
- CLI: file or directory input; overwrite control; visualization export
- Strips heavy fields ('img', 'img_path') before saving JSON
- Logging levels: INFO progress, DEBUG details, ERROR failures
- Exit codes: 0 on success, 1 on failure
"""

from __future__ import annotations

import sys
import json
import logging
import platform
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

import cv2  # PP-Structure examples typically use cv2 images
from paddleocr import PPStructure, save_structure_res  # API used per official examples

try:
    import paddleocr as _pocr
    _POCR_VERSION = getattr(_pocr, "__version__", "unknown")
except Exception:
    _POCR_VERSION = "unknown"

# ---------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("ppstructure")


def _strip_heavy_fields(result: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove heavy, non-JSON-serializable blobs from PP-Structure output.

    Parameters
    ----------
    result : list[dict]
        Raw PP-Structure blocks.

    Returns
    -------
    list[dict]
        Cleaned blocks with 'img', 'img_path' removed.
    """
    cleaned: List[Dict[str, Any]] = []
    for item in result or []:
        if not isinstance(item, dict):
            continue
        it = dict(item)  # shallow copy
        it.pop("img", None)       # crop ndarray
        it.pop("img_path", None)  # sometimes present
        cleaned.append(it)
    return cleaned


class PPStructureOCR:
    """
    Wrapper for PaddleOCR PP-Structure with robust initialization and batch processing.

    Notes
    -----
    - PP-Structure call signature/flags changed in 3.x vs 2.x. We pass kwargs defensively
      and retry without extras on TypeError.  # see docs in answer
    - Inference is done with cv2.imread(img_path) → PPStructure(img), consistent with examples.
    """

    def __init__(
        self,
        lang: str = "en",
        show_log: bool = False,
        engine_per_worker: bool = False,
        **kwargs: Any,
    ) -> None:
        """
        Parameters
        ----------
        lang : str
            Language code passed to PPStructure (if supported).
        show_log : bool
            Enable verbose logs from PaddleOCR.
        engine_per_worker : bool
            If True, each thread spawns its own PPStructure engine.
        **kwargs : Any
            Forwarded to PPStructure (e.g., use_gpu, layout, table, ocr, recovery...).
        """
        self.lang = lang
        self.show_log = show_log
        self.engine_per_worker = engine_per_worker
        self.kwargs = dict(kwargs)
        self.engine: Optional[PPStructure] = None

    # --------------------- engine lifecycle ---------------------

    def initialize_engine(self) -> None:
        """Lazy-init PP-Structure engine with version-safe fallback."""
        if self.engine is not None:
            return
        try:
            log.info(
                "Initializing PP-Structure (paddleocr=%s, lang=%s, kwargs=%s)",
                _POCR_VERSION, self.lang, {k: v for k, v in self.kwargs.items()}
            )
            self.engine = PPStructure(lang=self.lang, show_log=self.show_log, **self.kwargs)
            log.info("PP-Structure engine initialized")
        except TypeError as e:
            # Some kwargs differ across versions; retry minimally.
            log.warning("PPStructure(**kwargs) failed (%s). Retrying with minimal args.", e)
            self.engine = PPStructure(lang=self.lang, show_log=self.show_log)
        except Exception as e:
            log.error("Failed to initialize PP-Structure: %s", e)
            raise

    # ----------------------- single image -----------------------

    def _infer_cv2(self, img_path: str) -> List[Dict[str, Any]]:
        """Load image via cv2 and run the PP-Structure engine."""
        self.initialize_engine()
        img = cv2.imread(img_path)
        if img is None:
            raise ValueError(f"cv2 failed to read image: {img_path}")
        result = self.engine(img)  # type: ignore[operator]
        if not isinstance(result, list):
            log.debug("PP-Structure returned non-list type: %s", type(result))
        return result  # raw

    def process_image(self, img_path: str) -> List[Dict[str, Any]]:
        """
        Run PP-Structure on one image and return a cleaned, JSON-friendly result.
        """
        ip = Path(img_path)
        if not ip.exists():
            raise FileNotFoundError(f"Image not found: {img_path}")

        log.debug("Processing image: %s", img_path)
        try:
            raw = self._infer_cv2(str(ip))
            cleaned = _strip_heavy_fields(raw)
            log.info("Extracted %d blocks from %s", len(cleaned), img_path)
            return cleaned
        except Exception as e:
            log.error("PP-Structure error on %s: %s", img_path, e)
            raise

    # ------------------------ batch mode ------------------------

    def _process_one(
        self,
        img_path: str,
        out_dir: Path,
        no_overwrite: bool,
        save_vis: bool,
        per_worker_engine: bool,
        engine_args: Optional[Tuple[str, bool, Dict[str, Any]]] = None,
    ) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
        """
        Process a single image path; optionally construct a per-worker engine.

        Returns
        -------
        (img_path, result-or-None)
        """
        try:
            stem = Path(img_path).stem
            out_file = out_dir / f"{stem}.json"

            if no_overwrite and out_file.exists():
                log.info("Skipping %s (already processed)", img_path)
                return img_path, None

            if per_worker_engine:
                # Build an isolated engine for this worker (safer under heavy threading).
                lang, show_log, kwargs = engine_args or (self.lang, self.show_log, self.kwargs)
                worker = PPStructureOCR(lang=lang, show_log=show_log, engine_per_worker=False, **kwargs)
                result = worker.process_image(img_path)
            else:
                result = self.process_image(img_path)

            # Save JSON (already stripped)
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            # Optional visualization (save_structure_res(result, save_dir, img_name))
            if save_vis:
                save_structure_res(result, str(out_dir), Path(img_path).stem)

            return img_path, result
        except Exception as e:
            log.error("Failed to process %s: %s", img_path, e)
            return img_path, None

    def process_batch(
        self,
        img_paths: List[str],
        out_dir: str,
        no_overwrite: bool = False,
        save_vis: bool = False,
        max_workers: int = 1,
        engine_per_worker: Optional[bool] = None,
    ) -> Dict[str, Optional[List[Dict[str, Any]]]]:
        """
        Process multiple images and write one JSON per input.

        Parameters
        ----------
        img_paths : list[str]
        out_dir : str
        no_overwrite : bool
        save_vis : bool
        max_workers : int
        engine_per_worker : Optional[bool]
            If True, each thread creates its own engine (safer). If None, use self.engine_per_worker.

        Returns
        -------
        dict[str, list[dict] | None]
        """
        out_dir_obj = Path(out_dir)
        out_dir_obj.mkdir(parents=True, exist_ok=True)

        results: Dict[str, Optional[List[Dict[str, Any]]]] = {}
        img_paths = [str(Path(p)) for p in img_paths]

        per_worker = self.engine_per_worker if engine_per_worker is None else engine_per_worker
        if max_workers > 1 and not per_worker:
            log.warning(
                "max_workers=%d with shared engine. If memory/GPU allocator issues occur, "
                "retry with --engine-per-worker.",
                max_workers,
            )

        if max_workers > 1:
            log.info("Processing %d images with %d threads (per_worker_engine=%s)", len(img_paths), max_workers, per_worker)
            engine_args = (self.lang, self.show_log, self.kwargs)
            with ThreadPoolExecutor(max_workers=max_workers) as ex:
                futures = {
                    ex.submit(
                        self._process_one,
                        p,
                        out_dir_obj,
                        no_overwrite,
                        save_vis,
                        per_worker,
                        engine_args,
                    ): p
                    for p in img_paths
                }
                for fut in as_completed(futures):
                    img_path, res = fut.result()
                    results[img_path] = res
        else:
            for p in img_paths:
                img_path, res = self._process_one(
                    p, out_dir_obj, no_overwrite, save_vis, per_worker, None
                )
                results[img_path] = res

        return results


# --------------------------- directory runner ---------------------------

def run_ppstructure_on_directory(
    img_dir: str,
    out_dir: str,
    lang: str = "en",
    img_extensions: Optional[List[str]] = None,
    **kwargs: Any,
) -> Dict[str, Optional[List[Dict[str, Any]]]]:
    """
    Run PP-Structure on all images in a directory (non-recursive).

    Returns
    -------
    dict[str, list[dict] | None]
    """
    if img_extensions is None:
        img_extensions = [".png", ".jpg", ".jpeg", ".tiff", ".bmp"]

    img_dir_obj = Path(img_dir)
    if not img_dir_obj.exists():
        raise FileNotFoundError(f"Image directory not found: {img_dir}")

    img_paths: List[Path] = []
    for ext in img_extensions:
        img_paths.extend(img_dir_obj.glob(f"*{ext}"))
        img_paths.extend(img_dir_obj.glob(f"*{ext.upper()}"))

    img_paths = sorted(set(img_paths), key=lambda p: (p.stem, p.suffix.lower()))
    if not img_paths:
        log.warning("No images found in %s with extensions %s", img_dir, img_extensions)
        return {}

    log.info("Found %d images to process (paddleocr=%s)", len(img_paths), _POCR_VERSION)
    ocr_engine = PPStructureOCR(lang=lang, **kwargs)
    return ocr_engine.process_batch([str(p) for p in img_paths], out_dir, **kwargs)


# --------------------------------- CLI ---------------------------------

def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(description="Run PaddleOCR PP-Structure on images.")
    ap.add_argument("input", help="Input image file or directory")
    ap.add_argument("output_dir", help="Directory for JSON outputs")
    ap.add_argument("--lang", default="en", help="Language code (default: en)")
    ap.add_argument("--extensions", nargs="+", default=[".png", ".jpg", ".jpeg"])
    ap.add_argument("--show-log", action="store_true", help="Show PaddleOCR logs")
    ap.add_argument("--save-vis", action="store_true", help="Save visualization outputs")
    ap.add_argument("--no-overwrite", action="store_true", help="Skip existing JSON outputs")
    ap.add_argument("--max-workers", type=int, default=1, help="Number of parallel workers")
    ap.add_argument("--engine-per-worker", action="store_true", help="Create a PPStructure engine per worker thread")
    # Common PP-Structure flags (version-dependent; safe to pass)
    ap.add_argument("--use-gpu", action="store_true", help="Use GPU if available")
    ap.add_argument("--layout", dest="layout", action="store_true", help="Enable layout analysis (if supported)")
    ap.add_argument("--no-layout", dest="layout", action="store_false")
    ap.set_defaults(layout=None)  # None = let PaddleOCR decide
    ap.add_argument("--table", action="store_true", help="Enable table extraction (if supported)")
    ap.add_argument("--ocr", action="store_true", help="Enable text OCR in pipeline (if supported)")
    ap.add_argument("--recovery", action="store_true", help="Enable document recovery (HTML/Markdown) (if supported)")
    args = ap.parse_args()

    if platform.system().lower().startswith("win"):
        log.info("Windows detected. Ensure Paddle + dependencies (Visual C++ runtime, etc.) are installed.")

    # Log once at startup
    log.info("paddleocr version: %s", _POCR_VERSION)

    input_path = Path(args.input)
    out_dir_obj = Path(args.output_dir)
    out_dir_obj.mkdir(parents=True, exist_ok=True)

    try:
        ocr_kwargs: Dict[str, Any] = {
            "show_log": args.show_log,
            "use_gpu": args.use_gpu,
            "table": args.table,
            "ocr": args.ocr,
            "recovery": args.recovery,
            "engine_per_worker": args.engine_per_worker,
            "max_workers": args.max_workers,
            "no_overwrite": args.no_overwrite,
            "save_vis": args.save_vis,
        }
        if args.layout is not None:
            ocr_kwargs["layout"] = args.layout

        if input_path.is_file():
            # Single-file mode
            ocr_engine = PPStructureOCR(
                lang=args.lang,
                show_log=args.show_log,
                engine_per_worker=args.engine_per_worker,
                **{k: v for k in ocr_kwargs.items() if k in ("use_gpu", "layout", "table", "ocr", "recovery")}
            )
            result = ocr_engine.process_image(str(input_path))
            out_file = out_dir_obj / f"{input_path.stem}.json"

            if args.no_overwrite and out_file.exists():
                log.info("Skipping %s (already processed)", input_path)
            else:
                with open(out_file, "w", encoding="utf-8") as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                if args.save_vis:
                    # save_structure_res(result, save_dir, img_name)
                    save_structure_res(result, str(out_dir_obj), input_path.stem)
                print(f"✅ Processed {input_path} -> {out_file}")
                print(f"Extracted {len(result)} blocks")
            sys.exit(0)

        # Directory mode
        results = run_ppstructure_on_directory(
            img_dir=str(input_path),
            out_dir=str(out_dir_obj),
            lang=args.lang,
            img_extensions=args.extensions,
            **{k: v for k in ocr_kwargs.items() if k not in ("layout", "use_gpu", "table", "ocr", "recovery")}
            # run_ppstructure_on_directory forwards lang + img_extensions and passes the rest to process_batch
        )
        successful = sum(1 for v in results.values() if v is not None)
        print(f"✅ Processed {successful}/{len(results)} images successfully")
        sys.exit(0)

    except Exception as e:
        log.error("PP-Structure processing failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
