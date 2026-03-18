#!/usr/bin/env python3
"""
CVParserOCR – unified OCR pipeline for CV parsing
PDF → Images → PaddleOCR (PP-Structure) → Structured JSON

Improvements:
- Fallback: compute bbox from polygon points if bbox is missing.
- Include per-page image size and path in results.
- Keep pointer to saved OCR JSON for debugging.
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, List, Any

from PIL import Image

from .pdf_to_images import pdf_to_images
from .ppstructure_wrapper import PPStructureOCR

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger(__name__)


class CVParserOCR:
    """Main class for OCR-based CV parsing."""

    def __init__(self, model_path: Path = None):
        self.model_path = model_path
        self.ocr_engine = None
        # TODO: hook in LayoutLMv3 model if model_path provided

    def process_pdf(self, pdf_path: Path, output_dir: Path, dpi: int = 300) -> Dict[str, Any]:
        """Run full OCR pipeline on a PDF and return structured results."""
        images_dir = output_dir / "images"
        ocr_json_dir = output_dir / "ocr_json"
        results_dir = output_dir / "results"

        for d in [images_dir, ocr_json_dir, results_dir]:
            d.mkdir(parents=True, exist_ok=True)

        log.info(f"Processing PDF: {pdf_path}")

        try:
            # Step 1: Convert PDF to images
            log.info("Step 1: Converting PDF to images...")
            image_paths = pdf_to_images(str(pdf_path), str(images_dir), dpi=dpi)
            log.info(f"Generated {len(image_paths)} images")

            # Step 2: Run PP-Structure OCR
            log.info("Step 2: Running PP-Structure OCR...")
            if self.ocr_engine is None:
                self.ocr_engine = PPStructureOCR(lang="en")

            pages = []
            for page_idx, img_path in enumerate(image_paths, start=1):
                result = self.ocr_engine.process_image(str(img_path))

                # Save individual JSON for debugging
                stem = Path(img_path).stem
                json_out = ocr_json_dir / f"{stem}.json"
                with open(json_out, "w", encoding="utf-8") as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)

                # Build normalized regions
                regions = []
                for block in result:
                    bbox = block.get("bbox")
                    if not bbox and "points" in block and block["points"]:
                        xs = [float(x) for x, _ in block["points"]]
                        ys = [float(y) for _, y in block["points"]]
                        bbox = [min(xs), min(ys), max(xs), max(ys)]

                    regions.append({
                        "type": block.get("type", "text"),
                        "text": (block.get("text") or "").strip(),
                        "bbox": bbox,
                        "confidence": block.get("score"),
                    })

                # Capture page image size
                with Image.open(img_path) as im:
                    w, h = im.size

                pages.append({
                    "page_num": page_idx,
                    "image_path": str(img_path),
                    "width": w,
                    "height": h,
                    "ocr_json_path": str(json_out),
                    "regions": regions,
                })

            # Final schema
            cv_data = {
                "pages": pages,
                "entities": [],  # remains empty until LayoutLMv3 or postprocessing
                "layout": {"page_count": len(pages)},
            }

            output_file = results_dir / f"{pdf_path.stem}_parsed.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(cv_data, f, ensure_ascii=False, indent=2)

            log.info(f"✅ Processing complete. Results saved to: {output_file}")
            return cv_data

        except Exception as e:
            log.error(f"Pipeline failed: {e}")
            raise


def main():
    parser = argparse.ArgumentParser(description="Parse CV PDFs using OCR pipeline")
    parser.add_argument("input_pdf", help="Path to input PDF file")
    parser.add_argument("--output-dir", default="cv_parser_output")
    parser.add_argument("--dpi", type=int, default=300)
    args = parser.parse_args()

    pdf_path = Path(args.input_pdf)
    if not pdf_path.exists():
        log.error(f"PDF file not found: {pdf_path}")
        sys.exit(1)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    parser_ocr = CVParserOCR()
    result = parser_ocr.process_pdf(pdf_path, output_dir, dpi=args.dpi)

    # Print simple summary
    print("\n=== CV OCR SUMMARY ===")
    print(f"Pages processed: {len(result['pages'])}")
    total_regions = sum(len(p["regions"]) for p in result["pages"])
    print(f"Total text regions: {total_regions}")


if __name__ == "__main__":
    main()
