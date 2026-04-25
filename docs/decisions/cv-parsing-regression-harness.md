# CV Parsing Regression Harness

## Purpose

Provide a one-command local regression check for CV parsing across the real local product path so engineers can compare where experience data is lost between OCR/raw extraction, Python normalization, and app-side canonicalization.

## Run

```bash
cd my-app && npx tsx scripts/run-cv-parsing-regression-harness.ts
```

## Fixtures Covered

- `fixtures/cv_png.pdf`
- `fixtures/sample_textpdf_resume.pdf`
- `fixtures/cv (13).pdf`
- `fixtures/cv (13).png`
- `fixtures/sample_text_resume.pdf`
- `fixtures/sample_scanned_resume.pdf`
- `fixtures/1dbd975457f48780.docx`
- `fixtures/1dbd975457f48780.png`
- `fixtures/cv (14).pdf`
- `fixtures/cv (308).pdf`

## Layers Compared

- OCR/raw
- Python normalized
- app canonicalized

## Slice Workflow

1. patch
2. targeted tests
3. harness
4. acceptance/deploy

## Limitations

- PNG coverage depends on the local OCR route/runtime being available.
- DOCX coverage depends on the local product path supporting that file type.
