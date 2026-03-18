"""CLI entrypoint for the new dual-path CV parsing pipeline."""
from __future__ import annotations

import argparse
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

from ..detect.pdf_type import detect_pdf_type
from ..extract.ocr_pdf import extract_ocr_pdf
from ..extract.text_pdf import extract_text_pdf
from ..pipeline.postprocess import enrich_contacts
from ..schema.model import PipelineResult

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


def _log_stage(stage: str, start: float) -> None:
    duration_ms = (time.perf_counter() - start) * 1000
    log.info("[timing] %s took %.1f ms", stage, duration_ms)


def _result_has_text(result: PipelineResult) -> bool:
    normalized = result.normalized
    raw = getattr(normalized, "raw", "") or ""
    raw_text = getattr(normalized, "rawText", "") or ""
    raw_sections = getattr(normalized, "rawSections", []) or []
    has_sections = bool(raw_sections) if isinstance(raw_sections, list) else False
    return bool(raw.strip() or raw_text.strip() or has_sections)


def run_pipeline(
    input_path: Path,
    mode: str = "auto",
    dpi: int = 300,
    engine: str = "pypdfium2",
) -> PipelineResult:
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(input_path)

    if mode not in {"auto", "text", "ocr"}:
        raise ValueError(f"Unsupported mode: {mode}")

    forced_engine = os.getenv("FORCE_ENGINE", "").strip().lower()
    if forced_engine in {"ocr", "text"}:
        log.warning("FORCE_ENGINE=%s active; overriding requested mode=%s", forced_engine, mode)
        effective_mode = forced_engine
        detector_result = None
    else:
        if forced_engine and forced_engine not in {"", "ocr", "text"}:
            log.warning("FORCE_ENGINE=%s unsupported; ignoring", forced_engine)
        detector_result = None
        effective_mode = mode
    if effective_mode == "auto":
        detect_start = time.perf_counter()
        detector_result = detect_pdf_type(input_path)
        _log_stage("detect_pdf_type", detect_start)
        effective_mode = detector_result.mode
        log.info("detected mode=%s confidence=%.2f", effective_mode, detector_result.confidence)

    fallback_to_text = False
    engine_used = "pypdfium2"
    if effective_mode == "ocr":
        ocr_start = time.perf_counter()
        crashed = False
        try:
            result = extract_ocr_pdf(input_path, dpi=dpi, engine=engine, permissive=False, pass_id=1)
            _log_stage("extract_ocr_pdf", ocr_start)
        except Exception as exc:  # Catch all OCR failures/crashes
            log.error("OCR pipeline crashed or failed (%s); forcing fallback to text extraction", exc, exc_info=True)
            crashed = True
            fallback_to_text = True
        if fallback_to_text:
            text_start = time.perf_counter()
            log.warning("[fallback] falling back to text extractor after OCR %s", "crash" if crashed else "failure")
            result = extract_text_pdf(input_path)
            result.diagnostics["ocr_failed"] = True
            result.diagnostics["crashed"] = crashed
            result.diagnostics["empty_reason"] = "ocr_failed"
            # Ensure baseline diagnostic keys are present for downstream consumers
            norm = result.normalized
            raw = (getattr(norm, "raw", "") or "")
            result.diagnostics.setdefault("chars", len(raw))
            result.diagnostics.setdefault("ocr_blocks", 0)
            result.diagnostics.setdefault("avg_conf", 0.0)
            result.diagnostics.setdefault("sections_found", {})
            if os.environ.get("CV_TESSERACT_FALLBACK", "0").strip().lower() not in {"1", "true", "yes", "on"}:
                result.diagnostics["fallback_skipped"] = "CV_TESSERACT_FALLBACK=0"
            # pkg versions for parity with OCR path
            try:
                from cv_parser.extract.ocr_pdf import _pkg_versions  # local import to avoid overhead

                result.diagnostics.setdefault("pkg_versions", _pkg_versions())
            except Exception:
                pass
            result.diagnostics.setdefault("fallback_used", True)
            result.diagnostics.setdefault("ocr_passes", 1)
            _log_stage("extract_text_pdf(fallback)", text_start)
            engine_used = "text"
            normalized_text = result.normalized
            raw_text = (getattr(normalized_text, "raw", "") or "").strip()
            raw_sections = getattr(normalized_text, "rawSections", []) or []
            if not raw_text and not raw_sections:
                placeholder = f"[cv_parser] OCR fallback placeholder for {input_path.name}."
                normalized_text.raw = placeholder
                normalized_text.rawSections = [{"label": "RAW", "content": placeholder}]
                result.diagnostics["fallback_placeholder"] = True
        else:
            engine_used = "ocr"
            if not _result_has_text(result):
                log.warning("OCR produced empty payload for %s; retrying with permissive thresholds", input_path)
                permissive_start = time.perf_counter()
                try:
                    permissive_result = extract_ocr_pdf(
                        input_path,
                        dpi=dpi,
                        engine=engine,
                        permissive=True,
                        pass_id=2,
                    )
                    _log_stage("extract_ocr_pdf(permissive)", permissive_start)
                    permissive_diag = permissive_result.diagnostics or {}
                    permissive_diag["permissive_retry"] = True
                    permissive_diag.setdefault("ocr_passes", 2)
                    permissive_result.diagnostics = permissive_diag
                    result = permissive_result
                    if not _result_has_text(result):
                        raise RuntimeError("Permissive OCR still empty")
                except Exception as exc:
                    log.error("Permissive OCR retry failed (%s); falling back to text", exc, exc_info=True)
                    crashed = True  # Treat retry failure as crash for consistency
                    text_start = time.perf_counter()
                    text_result = extract_text_pdf(input_path)
                    _log_stage("extract_text_pdf(permissive_fallback)", text_start)
                    text_diag = text_result.diagnostics or {}
                    prev_diag = result.diagnostics or {}
                    merged_errors = list(prev_diag.get("ocr_errors", []))
                    merged_errors.extend(text_diag.get("ocr_errors", []))
                    if merged_errors:
                        text_diag["ocr_errors"] = merged_errors
                    if "ocr_block_counts" in prev_diag:
                        text_diag.setdefault("ocr_block_counts", prev_diag["ocr_block_counts"])
                    if "ocr_blocks" in prev_diag:
                        text_diag.setdefault("ocr_blocks", prev_diag["ocr_blocks"])
                    text_diag.setdefault("ocr_passes", prev_diag.get("ocr_passes", 2))
                    text_diag["permissive_retry"] = True
                    text_diag["permissive_text_fallback"] = True
                    text_diag["fallback_used"] = True
                    text_diag["empty_reason"] = "ocr_failed"
                    text_diag["engine"] = "text"
                    text_diag["crashed"] = crashed
                    text_diag.setdefault("sections_found", prev_diag.get("sections_found", {}))
                    text_result.diagnostics = text_diag
                    result = text_result
                    engine_used = "text"
    else:
        text_start = time.perf_counter()
        result = extract_text_pdf(input_path)
        _log_stage("extract_text_pdf", text_start)
        engine_used = "text" if effective_mode == "text" else "pypdfium2"

    if detector_result:
        result.diagnostics.update({
            "detector_mode": detector_result.mode,
            "detector_confidence": detector_result.confidence,
            **detector_result.diagnostics,
        })

    strict = enrich_contacts(result.normalized, result.strict)
    result.strict = strict
    result._effective_mode = effective_mode  # type: ignore[attr-defined]
    result._ocr_fallback_triggered = fallback_to_text  # type: ignore[attr-defined]
    diagnostics = result.diagnostics or {}
    diagnostics["engine"] = engine_used
    diagnostics["crashed"] = diagnostics.get("crashed", False)
    diagnostics.setdefault("ocr_passes", diagnostics.get("ocr_passes", 0))
    result.diagnostics = diagnostics
    return result


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Dual-path CV parsing pipeline")
    parser.add_argument("input", help="Path to input PDF")
    parser.add_argument("--output", required=True, help="Output JSON file")
    parser.add_argument("--mode", choices=["auto", "text", "ocr"], default="auto")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for OCR rendering")
    parser.add_argument("--engine", choices=["pypdfium2"], default="pypdfium2")

    args = parser.parse_args(argv)
    total_start = time.perf_counter()
    result = run_pipeline(Path(args.input), mode=args.mode, dpi=args.dpi, engine=args.engine)
    _log_stage("run_pipeline(total)", total_start)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(result.to_dict(), fh, ensure_ascii=False, indent=2)
    log.info("wrote %s", output_path)
    diagnostics = result.diagnostics or {}
    effective_mode = getattr(result, "_effective_mode", args.mode)
    detector_mode = diagnostics.get("detector_mode")
    detector_conf = diagnostics.get("detector_confidence")
    if detector_mode is not None:
        detector_repr = f"{detector_mode} conf={detector_conf}"
    else:
        detector_repr = "None"
    status_parts = [
        f"mode={effective_mode}",
        f"detector={detector_repr}",
        f"hybrid_used={diagnostics.get('hybrid_used')}",
        f"fallback_used={diagnostics.get('fallback_used')}",
        f"sections={diagnostics.get('sections_found')}",
    ]
    if diagnostics.get("ocr_blocks") is not None:
        status_parts.append(f"ocr_blocks={diagnostics.get('ocr_blocks')}")
    if diagnostics.get("images_rendered") is not None:
        status_parts.append(f"images_rendered={diagnostics.get('images_rendered')}")
    if "pp_structure_counts" in diagnostics:
        status_parts.append(f"pp_structure_counts={diagnostics.get('pp_structure_counts')}")
    if diagnostics.get("pp_structure_used") is not None:
        status_parts.append(f"pp_structure_used={diagnostics.get('pp_structure_used')}")
    print(" ".join(status_parts))
    fallback_triggered = getattr(result, "_ocr_fallback_triggered", False)
    return 1 if fallback_triggered else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
