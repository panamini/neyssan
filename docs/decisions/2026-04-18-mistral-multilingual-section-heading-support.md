# Mistral Multilingual Section Heading Support

Date: 2026-04-18

## Status

Implemented on `main` for the Mistral resume v3 parser path.

Relevant files:

- [cv_parser_service/mistral_resume_v3/section_headings.py](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/mistral_resume_v3/section_headings.py)
- [cv_parser_service/mistral_resume_v3/pipeline.py](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/mistral_resume_v3/pipeline.py)
- [cv_parser_service/tests/test_mistral_resume_v3_pipeline.py](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/tests/test_mistral_resume_v3_pipeline.py)

## Decision

We use deterministic OCR-structure-aware section detection as a safety net when the Mistral annotation drops explicit sections.

For multilingual support:

- keep alias matching exact after normalization
- keep normalization aggressive:
  - lowercase
  - accent-insensitive
  - whitespace-normalized
- do not use broad fuzzy or substring heuristics
- allow only narrow compound-heading support

This keeps OCR recovery stable while widening section coverage.

## Implemented Support

### Experience-family heading aliases

English:

- `experience`
- `work experience`
- `professional experience`
- `employment history`
- `work history`
- `career history`
- `professional background`
- `relevant experience`
- `career experience`
- `industry experience`

Spanish:

- `experiencia`
- `experiencia laboral`
- `experiencia profesional`
- `experiencia profesional relevante`
- `historial laboral`
- `historial profesional`
- `trayectoria profesional`

Portuguese:

- `experiência`
- `experiência profissional`
- `histórico profissional`
- `histórico de trabalho`
- `trajetória profissional`

French:

- `expérience`
- `expérience professionnelle`
- `expérience de travail`
- `parcours professionnel`
- `historique professionnel`

German:

- `berufserfahrung`
- `berufliche erfahrung`
- `beruflicher werdegang`
- `arbeitserfahrung`
- `werdegang`

Italian:

- `esperienza`
- `esperienza professionale`
- `esperienza lavorativa`
- `percorso professionale`

### Compound heading support

Compound headings are split only on safe delimiters:

- `&`
- `/`
- `|`
- `,`
- ` y `
- ` et `
- ` und `
- ` e `

Compound detection only succeeds when all recognized segments map to the same family.

Accepted examples:

- `Experience / Work History`
- `Experiência / Histórico Profissional`
- `Expérience / Expérience Professionnelle`

Rejected by design:

- `Experience & Skills`
- `Expérience & Compétences`
- `Experiencia Profesional y Logros`

## Experience Recovery Behavior

When OCR markdown contains an explicit experience-family heading and normalized `experience` is empty:

- recover from the explicit OCR section body only
- preserve nested markdown headings inside the section
- build deterministic role entries from:
  - role header lines
  - date/location lines
  - bullets
  - inline prose
- re-parse
- re-normalize
- re-validate

No change is made to:

- OCR call layer
- annotation request layer
- retry count beyond the existing single retry

## Validation

Validation currently covers:

- multilingual alias classification
- same-family compound-heading detection
- nested heading preservation inside experience sections
- deterministic experience recovery for:
  - `WORK HISTORY`
  - `RELEVANT EXPERIENCE`
  - `EXPERIÊNCIA PROFISSIONAL`
  - `EXPÉRIENCE PROFESSIONNELLE`

Regression command:

```bash
python3 -m pytest cv_parser_service/tests/test_mistral_resume_v3_pipeline.py
```

Expected result at implementation time:

- `88 passed`

## Similar Wording Coverage

Supported:

- close multilingual wording that is explicitly registered
- same-family compounds built from registered aliases

Not supported by design:

- arbitrary fuzzy approximations
- substring-only section classification
- mixed-family compound headings treated as one family

## What Is Still Needed For Stronger Multilingual Support

The current implementation is intentionally conservative, not “perfect multilingual.”

Still open if we want broader coverage:

1. Expand multilingual aliases for non-experience families:
   - education
   - summary/profile
   - certifications
   - projects
   - affiliations

2. Add deterministic recovery for additional structured sections:
   - education is the safest next candidate
   - certifications/projects may also be tractable

3. Keep summary recovery separate and conservative:
   - summary is more hallucination-prone
   - do not add summary recovery casually

4. Add localized real-fixture regression cases:
   - Spanish
   - Portuguese
   - French
   - German
   - Italian

5. Add explicit collision tests for multilingual mixed-family headings:
   - ensure partial compounds do not misroute recovery

## Non-Goals

We explicitly did not implement:

- broad fuzzy regex section matching
- semantic guessing from paragraph content
- multi-pass retry expansion
- summary reconstruction from arbitrary OCR text
