# CV Parser OCR Pipeline

A comprehensive OCR-based CV parsing pipeline using **PaddleOCR (PP-Structure)** and **LayoutLMv3/LiLT** for document understanding and entity extraction.

## Overview

This module provides a complete pipeline for parsing CV documents:

1. **PDF → Images** – Convert PDF pages to high-resolution images  
2. **PP-Structure OCR** – Extract layout, text, and tables using PaddleOCR  
3. **Dataset Preparation** – Convert OCR results to HuggingFace datasets with normalized bounding boxes  
4. **Model Training** – Fine-tune LayoutLMv3 or LiLT models for CV entity recognition  
5. **Inference** – Extract structured information from CVs using trained models  

## Architecture

```

cv\_parser/ocr/
├── data/                   # Data directories
│   ├── raw\_pdfs/          # Input PDF files
│   ├── images/            # Converted page images
│   ├── ocr\_json/          # PP-Structure OCR outputs
│   └── hf\_dataset/        # HuggingFace datasets
├── src/                   # Pipeline modules
│   ├── pdf\_to\_images.py   # PDF to image conversion
│   ├── run\_ppstructure.py # Re-export of ppstructure\_wrapper for CLI/tasks
│   ├── ppstructure\_wrapper.py # PP-Structure OCR processing
│   ├── ocr\_to\_hf\_layoutlm.py # Dataset preparation
│   ├── train\_layoutlmv3.py   # Model training
│   ├── evaluate\_layoutlmv3.py # Model evaluation
│   └── cli.py             # Command-line interface (PDF → JSON)
├── configs/               # Configuration files
├── tests/                 # Unit tests
└── runs/                  # Training outputs and models

````

## Installation

### Prerequisites

- **Python 3.8+**
- **Poppler** (required by pdf2image)  
  - macOS: `brew install poppler`  
  - Ubuntu/Debian: `sudo apt-get install poppler-utils`  
  - Windows: [download Poppler](http://blog.alivate.com.au/poppler-windows/) and pass `--poppler-path` to `pdf_to_images`

- macOS or Linux (Windows is partially supported for PaddleOCR)

### Environment Setup

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

pip install -r requirements.txt
````

### Recommended `requirements.txt`

```txt
paddleocr==2.7.*
paddlepaddle>=2.5.0
transformers>=4.43,<5
datasets>=2.20,<3
pdf2image>=1.17
pillow>=10.0
timm>=0.9
seqeval>=1.2
accelerate>=0.30
```

For Linux GPU: install the appropriate `paddlepaddle-gpu` wheel for your CUDA version.

## Quick Start

### Using the CLI

```bash
# Parse a single CV PDF
python -m cv_parser.ocr.src.cli path/to/cv.pdf --json-output output.json

# With custom output directory
python -m cv_parser.ocr.src.cli path/to/cv.pdf --output-dir ./results --dpi 300
```

### Using VS Code Tasks

The project ships with `tasks.json` for one-click execution:

* `ocr-pdf-to-images` – Convert PDFs to images
* `ocr-pp-structure` – Run PP-Structure OCR
* `ocr-build-dataset` – Build HuggingFace dataset
* `ocr-train-layoutlmv3` – Train LayoutLMv3
* `ocr-evaluate-layoutlmv3` – Evaluate model
* `ocr-full-pipeline` – Runs all steps in sequence

### Manual Pipeline Execution

```bash
# Step 1: Convert PDF to images
python -m cv_parser.ocr.src.pdf_to_images data/raw_pdfs/cv.pdf data/images

# Step 2: Run PP-Structure OCR
python -m cv_parser.ocr.src.run_ppstructure data/images data/ocr_json

# Step 3: Build dataset
python -m cv_parser.ocr.src.ocr_to_hf_layoutlm \
  --ocr-json-dir data/ocr_json \
  --images-dir data/images \
  --output-dir data/hf_dataset

# Step 4: Train LayoutLMv3
python -m cv_parser.ocr.src.train_layoutlmv3 \
  --dataset-path data/hf_dataset \
  --output-dir runs/layoutlmv3_cv

# Step 5: Evaluate
python -m cv_parser.ocr.src.evaluate_layoutlmv3 \
  --model-path runs/layoutlmv3_cv \
  --dataset-path data/hf_dataset
```

---

## Entity Labels

Recognized entity classes (BIO format):

* `ROLE` – Job titles
* `COMPANY` – Employer names
* `START_DATE`, `END_DATE` – Employment dates
* `DEGREE` – Academic qualifications
* `INSTITUTION` – Schools/universities
* `SKILL` – Technical/professional skills
* `CERTIFICATE` – Certifications & licenses
* `ACHIEVEMENT` – Awards & accomplishments

Boxes are normalized to **0–1000** per LayoutLM convention, and one HF record is emitted **per page**.

---

## Integration Example

```python
from cv_parser.ocr.src.cli import CVParserOCR

ocr_parser = CVParserOCR(model_path="runs/layoutlmv3_cv")
cv_data = ocr_parser.process_pdf("cv.pdf", "./output")

print(cv_data["experience"])
```

---

## Performance Tips

### macOS

* CPU-only PaddleOCR is expected; keep DPI around 300
* Use small batch size (`--batch-size 2`)
* Disable `--fp16` on MPS

### Linux GPU

* Enable `--fp16` or `--bf16` for speed
* Increase `--num-workers` in training for faster data loading
* Consider `--gradient-checkpointing` to save memory on long docs

---

## Troubleshooting

| Issue                   | Fix                                                  |
| ----------------------- | ---------------------------------------------------- |
| **Poppler not found**   | Install Poppler (see prerequisites)                  |
| **No output images**    | Lower DPI or check PDF is not encrypted              |
| **Poor OCR quality**    | Preprocess images (binarize, deskew) or increase DPI |
| **OOM during training** | Lower batch size, use gradient accumulation          |

Enable debug logging for more detail:

```bash
python -m cv_parser.ocr.src.cli path/to/cv.pdf --output-dir ./debug --dpi 300
LOGLEVEL=DEBUG
```

---

## Contributing

1. Fork and clone the repository
2. Follow repo layout and naming conventions
3. Add tests in `tests/` before opening a PR

Run tests:

```bash
pytest cv_parser/ocr/tests/
```

---

## License

This module is part of the **cv\_parser** project. See the main project license.

```


```
