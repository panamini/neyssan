from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pdfplumber

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from cv_parser.extract.text_pdf import _reconstruct_page_text, extract_text_pdf


def _page_payload(pdf_path: Path) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = (_reconstruct_page_text(page) or "").replace("\r\n", "\n").replace("\r", "\n").strip()
            pages.append(
                {
                    "pageNumber": page_number,
                    "width": float(page.width or 0.0),
                    "height": float(page.height or 0.0),
                    "text": text,
                }
            )
    return pages


def _fixture_payload(pdf_path: Path) -> dict[str, Any]:
    result = extract_text_pdf(pdf_path)
    pages = _page_payload(pdf_path)
    joined_text = "\n\n".join(page["text"] for page in pages if page["text"]).strip()
    pipeline_raw_text = (getattr(result.normalized, "raw", "") or "").strip()
    return {
        "fixture": pdf_path.name,
        "fixturePath": str(pdf_path),
        "pageCount": len(pages),
        "pages": pages,
        "joinedText": joined_text,
        "pipelineRawText": pipeline_raw_text,
        "flattening": {
            "runtimeRawTextType": type(getattr(result.normalized, "raw", "")).__name__,
            "runtimeRawTextIsFlattenedSingleString": isinstance(getattr(result.normalized, "raw", ""), str),
            "runtimeRawTextMatchesJoinedText": pipeline_raw_text == joined_text,
            "layoutPageCount": len(getattr(result.layout, "pages", []) or []),
            "diagnosticsPageCount": (result.diagnostics or {}).get("pages", 0),
        },
        "diagnostics": result.diagnostics or {},
    }


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        raise SystemExit("usage: raw_pdf_diagnostic_helper.py <pdf> [<pdf> ...]")

    payload = [_fixture_payload(Path(arg).resolve()) for arg in argv[1:]]
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
