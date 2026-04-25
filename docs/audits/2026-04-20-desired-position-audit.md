# Desired Position Audit

Scope: active `cv_parser_service/mistral_resume_v3` path only.

## Active Code

- `cv_parser_service/mistral_resume_v3/post_validation.py`
- `cv_parser_service/mistral_resume_v3/pipeline.py`
- `cv_parser_service/tests/test_desired_position_audit_harness.py`

## Confirmed Facts

- This is active code.
- `normalize_extraction(...)` only validates `extraction.identity.desiredPosition`; it does not derive a missing desired position from raw header text or from work-history rows.
- `_run_resume_pipeline_from_ocr_result(...)` can recover explicit `experience`, `summary`, `skills`, and `languages` sections, but it does not synthesize `desiredPosition` during section recovery.
- The requested real image fixtures `jessica.jpg`, `janice.jpg`, and `robert.jpg` are not present in the repo fixture paths I inspected. The new harness uses synthetic parser-service fixtures plus the existing `cv_surname_en_case.json` fixture.

## Current Behavior Captured By The Harness

- Explicit short headlines like `Security Guard`, `Software Engineer`, and `Fashion writer turned designer` are preserved.
- Address-like or contact-header-overlap values like `1515 Pacific Ave` and `Old Forge, New York` are dropped with `desired_position_dropped`.
- A suspicious value like `Janice Walton Phone` is currently preserved because the validator accepts short headline-shaped text and does not prove it appeared as a standalone headline.
- Recovered Jessica-style experience entries do not backfill `desiredPosition` inside this Python service when the original annotation omitted it.

## Inference

- If the regression is “desired position disappeared”, the likely boundary is upstream OCR annotation quality or downstream canonicalization, not Python section recovery.
- If the regression is “desired position became noisy”, the current validator still allows some header mashups that are not obvious address/contact noise.
