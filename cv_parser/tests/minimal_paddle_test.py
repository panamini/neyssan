"""Minimal PaddleOCR test for Docker segfault investigation.

Run in container: docker exec -it cv-parser-service-dev python cv_parser/tests/minimal_paddle_test.py

Tests model load and ocr.ocr on a simple image (PDF page 1 converted to PNG if needed).
Prints versions, env, and results to isolate crash.
"""

import os
import sys
from pathlib import Path
import numpy as np
import platform

# Set threading envs early, before any Paddle import
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"

print("=== Minimal PaddleOCR Test in Docker ===")

print("\n1. Environment Check:")
print(f"Platform: {platform.system()}")
print(f"Machine: {platform.machine()}")
print(f"OMP_NUM_THREADS: {os.environ.get('OMP_NUM_THREADS', 'not set')}")
print(f"OPENBLAS_NUM_THREADS: {os.environ.get('OPENBLAS_NUM_THREADS', 'not set')}")
print(f"MKL_NUM_THREADS: {os.environ.get('MKL_NUM_THREADS', 'not set')}")

# Import Paddle after envs
try:
    import paddle
    print(f"Paddle version: {paddle.__version__}")
except Exception as e:
    print(f"Paddle import failed: {e}")
    sys.exit(1)

try:
    from paddleocr import PaddleOCR
    print("PaddleOCR import succeeded.")
except Exception as e:
    print(f"PaddleOCR import failed: {e}")
    sys.exit(1)

print("\n2. Create PaddleOCR Engine...")
try:
    ocr_engine = PaddleOCR(
        device="cpu",
        enable_mkldnn=False,
        cpu_threads=1,
        use_textline_orientation=True,
        lang="en",
        ocr_version="PP-OCRv5",
    )
    print("PaddleOCR engine created successfully.")
except Exception as e:
    print(f"PaddleOCR engine creation failed: {e}")
    sys.exit(1)

print("\n3. Test OCR on Simple Input...")
# Use a simple image or convert PDF page 1
FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
CVPNG_PDF = FIXTURES_DIR / "cvpng.pdf"

if not CVPNG_PDF.exists():
    print(f"Fixture not found: {CVPNG_PDF}. Copy cvpng.pdf to fixtures/")
    sys.exit(1)

# Convert first page to image for simple test (avoid full PDF rendering issues)
# Prefer pdf2image; fallback to pypdfium2 if unavailable
try:
    from pdf2image import convert_from_path
    pil_image = convert_from_path(str(CVPNG_PDF), dpi=150, first_page=1, last_page=1)[0]
except Exception:
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(str(CVPNG_PDF))
    page = doc[0]
    pil_image = page.render(scale=150/72.0).to_pil()
    try:
        doc.close()
    except Exception:
        pass
img_array = np.array(pil_image.convert('RGB'))

print("Input image shape: ", img_array.shape)

try:
    results = ocr_engine.ocr(img_array)
    print("OCR completed successfully.")
    success = True
    page0 = results[0] if results else None
    total_text = ""
    confidences = []
    lines_count = 0

    # PaddleOCR v3 may return dict-shaped results or legacy tuples.
    if isinstance(page0, dict):
        texts = page0.get("rec_texts") or page0.get("texts") or []
        scores = page0.get("rec_scores") or page0.get("scores") or []
        lines_count = len(texts)
        for i, t in enumerate(texts):
            total_text += (t or "") + " "
            try:
                s = float(scores[i]) if i < len(scores) else None
                if s is not None:
                    confidences.append(s)
            except Exception:
                continue
    else:
        # Legacy list-of-lines shape
        if page0 and isinstance(page0, (list, tuple)):
            lines = page0
            lines_count = len(lines)
            for item in lines:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    # item may be (box, (text, score))
                    points, text_part = item[0], item[1]
                    if isinstance(text_part, (list, tuple)) and len(text_part) >= 2:
                        text = text_part[0]
                        conf = text_part[1]
                    elif isinstance(text_part, str):
                        text = text_part
                        conf = None
                    else:
                        continue
                    total_text += (text or "") + " "
                    try:
                        if conf is not None:
                            confidences.append(float(conf))
                    except Exception:
                        continue
                elif isinstance(item, dict):
                    text = item.get("text") or item.get("rec_text") or ""
                    conf = item.get("score") or item.get("rec_score")
                    total_text += (text or "") + " "
                    try:
                        if conf is not None:
                            confidences.append(float(conf))
                    except Exception:
                        continue
        else:
            # Unexpected empty or unknown structure
            print("No text detected or unexpected result structure.")
    print(f"Detected lines: {lines_count}")
    print(f"Sample text: {total_text[:200]}")
    if confidences:
        avg_conf = sum(confidences) / len(confidences)
        print(f"Avg confidence: {avg_conf:.3f}")
    else:
        print("No confidence scores parsed.")
except Exception as e:
    print(f"OCR execution failed: {e}")
    print("Crash point: Inference")

print("\n=== Test Complete ===")
if "success" in locals():
    print("PASS: PaddleOCR works.")
else:
    print("FAIL: Check above for crash point.")
