from __future__ import annotations

import json
import mimetypes
import os
from pathlib import Path

import pytest

from cv_parser.canonicalize import canonicalize_cv
from cv_parser_service.mistral_ocr import (
    derive_raw_sections_from_markdown_pages,
    join_markdown_pages,
    run_mistral_ocr_from_bytes,
)


FIXTURES = [
    Path("fixtures/cv (13).png"),
    Path("fixtures/cv (14).pdf"),
    Path("fixtures/cv (308).pdf"),
    Path("fixtures/sample_scanned_resume.pdf"),
]


@pytest.mark.integration
@pytest.mark.skipif(
    os.environ.get("RUN_MISTRAL_LAYOUT_DIAGNOSTICS") != "1",
    reason="Mistral layout diagnostics disabled (set RUN_MISTRAL_LAYOUT_DIAGNOSTICS=1)",
)
@pytest.mark.skipif(
    not os.environ.get("MISTRAL_API_KEY"),
    reason="MISTRAL_API_KEY missing",
)
def test_mistral_layout_diagnostics_on_target_fixtures(capsys: pytest.CaptureFixture[str]) -> None:
    model_name = os.environ.get("MISTRAL_OCR_MODEL") or "mistral-ocr-latest"

    reports = []
    for fixture in FIXTURES:
        if not fixture.exists():
            pytest.skip(f"fixture missing: {fixture}")
        mime_type = mimetypes.guess_type(fixture.name)[0] or "application/octet-stream"
        pages, diagnostics = run_mistral_ocr_from_bytes(
            file_name=fixture.name,
            content_type=mime_type,
            data=fixture.read_bytes(),
            api_key=os.environ["MISTRAL_API_KEY"],
            model_name=model_name,
        )
        raw_sections, structure_diag = derive_raw_sections_from_markdown_pages(pages)
        joined = join_markdown_pages(pages)
        canonical = canonicalize_cv(joined, mode="text", diagnostics={**diagnostics, **structure_diag}, raw_sections=raw_sections)
        reports.append(
            {
                "fixture": fixture.name,
                "pages": diagnostics.get("pages"),
                "mistral_model": diagnostics.get("model"),
                "markdown_preview": [page.get("markdown", "")[:300] for page in pages[:2]],
                "raw_section_labels": [section.get("label") for section in raw_sections],
                "table_rows": structure_diag.get("ocr_markdown_table_rows"),
                "normalized_counts": {
                    "experience": len(canonical.get("normalized", {}).get("experience", []) or []),
                    "education": len(canonical.get("normalized", {}).get("education", []) or []),
                    "languages": len(canonical.get("normalized", {}).get("languages", []) or []),
                },
            }
        )

    print(json.dumps(reports, indent=2))
    captured = capsys.readouterr()
    assert reports
    assert captured.out.strip()
