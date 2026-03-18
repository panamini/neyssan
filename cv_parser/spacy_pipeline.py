# cv_parser/spacy_pipeline.py
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SpaCy-based CV parser (text-only pipeline)

- Loads a SpaCy model (package name like "en_core_web_sm" or a model dir)
- Parses plain text or extracts text from PDFs
- Returns a consistent schema with `entities` and lightweight `personal_info`

Usage (CLI):
  python -m cv_parser.spacy_pipeline path/to/file.pdf --model en_core_web_sm --out out.json
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import spacy
from spacy.language import Language

log = logging.getLogger(__name__)
if not log.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


# -----------------------------
# Helpers: PDF → text
# -----------------------------
def _extract_text_from_pdf(pdf_path: Path) -> str:
    """
    Extract text from a PDF using pdfminer.six (preferred) with a fallback to pypdf.
    """
    # Try pdfminer.six
    try:
        from pdfminer.high_level import extract_text  # type: ignore
        text = extract_text(str(pdf_path))
        if text and text.strip():
            return text.strip()
        log.warning("pdfminer.six returned empty text; falling back to pypdf…")
    except Exception as e:
        log.debug(f"pdfminer.six failed: {e}. Falling back to pypdf…")

    # Fallback: pypdf (formerly PyPDF2)
    try:
        from pypdf import PdfReader  # type: ignore
        reader = PdfReader(str(pdf_path))
        pages = []
        for p in reader.pages:
            try:
                pages.append(p.extract_text() or "")
            except Exception:
                pages.append("")
        return "\n".join(pages).strip()
    except Exception as e:
        raise RuntimeError(
            "Failed to extract text from PDF. Install pdfminer.six or pypdf."
        ) from e


# -----------------------------
# Heuristics: personal info
# -----------------------------
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}"
)

def _extract_personal_info(text: str) -> Dict[str, Any]:
    emails = list(dict.fromkeys(_EMAIL_RE.findall(text)))  # dedupe, keep order
    phones = list(dict.fromkeys(_PHONE_RE.findall(text)))
    return {"emails": emails, "phones": phones}


# -----------------------------
# Core parser
# -----------------------------
def load_spacy_model(model_or_path: Optional[str]) -> Language:
    """
    Load a SpaCy model by package name (e.g., 'en_core_web_sm') or local path.
    Defaults to 'en_core_web_sm' if None.
    """
    name = model_or_path or "en_core_web_sm"
    try:
        return spacy.load(name)
    except Exception as e:
        raise RuntimeError(
            f"Could not load SpaCy model '{name}'. Ensure it's installed or provide a valid path."
        ) from e


class SpacyCVParser:
    """
    Thin wrapper around a SpaCy pipeline that returns a consistent schema:

    {
      "entities": [
        {"text": "...", "label": "ORG", "start_char": 10, "end_char": 15},
        ...
      ],
      "personal_info": {"emails": [...], "phones": [...]}
    }
    """

    def __init__(self, model_path: Optional[str] = None, disable: Optional[List[str]] = None):
        """
        Args:
            model_path: spaCy package name (e.g. 'en_core_web_sm') or model directory.
            disable: optional list of pipeline components to disable for speed.
        """
        self.nlp = load_spacy_model(model_path)
        if disable:
            # Disable requested components on the loaded model (do not reload a blank model)
            try:
                self.nlp.disable_pipes(*disable)
            except Exception:
                # If disable_pipes fails for any reason, log and continue with loaded pipeline
                log.warning("Failed to disable requested spaCy pipeline components: %s", disable)

        # Quick sanity: ensure NER is present if you expect entities
        if "ner" not in self.nlp.pipe_names:
            log.warning("SpaCy pipeline has no 'ner' component; entity output may be empty.")

    # ---- public API ----
    def parse_text(self, text: str) -> Dict[str, Any]:
        """
        Run NER on plain text and return a lightweight schema.
        """
        doc = self.nlp(text)

        entities = [
            {
                "text": ent.text,
                "label": ent.label_,
                "start_char": int(ent.start_char),
                "end_char": int(ent.end_char),
            }
            for ent in doc.ents
        ]

        return {
            "entities": entities,
            "personal_info": _extract_personal_info(text),
        }

    def parse_path(self, path: Path) -> Dict[str, Any]:
        """
        Read a file and parse it. Supports PDF or plaintext files.
        """
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Input not found: {path}")

        suffix = path.suffix.lower()
        if suffix == ".pdf":
            text = _extract_text_from_pdf(path)
        else:
            # Treat everything else as text
            text = path.read_text(encoding="utf-8", errors="ignore")

        return self.parse_text(text)


# -----------------------------
# CLI
# -----------------------------
def _cli():
    import argparse

    ap = argparse.ArgumentParser(description="SpaCy-only CV parser (text / PDF)")
    ap.add_argument("input", help="Path to input file (.pdf or .txt)")
    ap.add_argument("--model", help="SpaCy model name or path (default: en_core_web_sm)")
    ap.add_argument("--out", help="Path to write JSON results (optional)")
    args = ap.parse_args()

    parser = SpacyCVParser(model_path=args.model)
    result = parser.parse_path(Path(args.input))

    if args.out:
        out_p = Path(args.out)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Saved results to {out_p}")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _cli()
