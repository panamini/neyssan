"""Docker-specific test for OCR pipeline using pdf2image rendering.

Run in container: docker exec -it cv-parser-service-dev python cv_parser/tests/test_ocr_docker.py

Adapts the working test_paddle_ocr.py to test full extract_ocr_pdf with fixtures/cvpn g.pdf.
Verifies no crash, total_lines >50, avg_conf >0.8, rawText len >500.
"""

import sys
from pathlib import Path

# Add parent dir to path for imports in container
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from cv_parser.extract.ocr_pdf import extract_ocr_pdf
from cv_parser.pipeline.runner import run_pipeline
from cv_parser.schema.model import PipelineResult

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
CVPNG_PDF = FIXTURES_DIR / "cvpng.pdf"

if not CVPNG_PDF.exists():
    print(f"Fixture not found: {CVPNG_PDF}. Copy cvpng.pdf to fixtures/")
    sys.exit(1)

print("=== Testing OCR Pipeline in Docker ===")

# Test 1: Full pipeline run (mode=ocr)
print("\n1. Running full pipeline (mode=ocr)...")
result = run_pipeline(CVPNG_PDF, mode="ocr", dpi=300, engine="pypdfium2")  # engine ignored, uses pdf2image now

diags = result.diagnostics or {}
raw_text = getattr(result.normalized, "raw", "") or ""
total_lines = diags.get("total_lines", 0)
avg_conf = diags.get("avg_conf", 0)
ocr_passes = diags.get("ocr_passes", 0)
fallback_used = diags.get("fallback_used", False)
crashed = diags.get("crashed", False)

print(f"Raw text length: {len(raw_text)}")
print(f"Total lines: {total_lines}")
print(f"Avg confidence: {avg_conf:.3f}")
print(f"OCR passes: {ocr_passes}")
print(f"Fallback used: {fallback_used}")
print(f"Crashed: {crashed}")

if crashed:
    print("CRASH DETECTED - Fallback should have triggered text extraction")
elif fallback_used:
    print("FALLBACK USED - Text extraction succeeded")
else:
    print("OCR SUCCEEDED - Full results available")

if len(raw_text) > 500 and total_lines > 50 and avg_conf > 0.8:
    print("PASS: Pipeline works as expected")
else:
    print("FAIL: Check logs for issues")

# Test 2: Direct extract_ocr_pdf
print("\n2. Running direct extract_ocr_pdf...")
try:
    ocr_result = extract_ocr_pdf(CVPNG_PDF, dpi=300, permissive=False, pass_id=1)
    ocr_diags = ocr_result.diagnostics or {}
    ocr_raw = getattr(ocr_result.normalized, "raw", "") or ""
    print(f"Direct OCR raw length: {len(ocr_raw)}")
    print(f"Direct total lines: {ocr_diags.get('total_lines', 0)}")
    print(f"Direct avg conf: {ocr_diags.get('avg_conf', 0):.3f}")
    if len(ocr_raw) > 500:
        print("Direct OCR PASS")
    else:
        print("Direct OCR FAIL - Empty or short text")
except Exception as e:
    print(f"Direct OCR CRASH: {e}")
    print("Fallback logic should handle this in production")

print("\n=== Test Complete ===")