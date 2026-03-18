# CV Parsing Pipeline

## Executive Summary

This pipeline ingests CVs from PDFs/PNGs/TXT, selects the most reliable text extraction engine, then progressively structures and sanitizes the content. The path is:

- Source extraction and engine decision (prefer native PDF text, fall back to OCR when necessary).
- Python canonicalization (two-column clustering, multilingual heading locks, early noise filtering, section ordering).
- TypeScript semantic mapping (experience segmentation/classification using headers+dates).
- Normalization & synthesis (limits/dedupe; synthesize short per-job responsibilities summary when missing).
- Final de‑bleed & validation (late noise removal, soft warnings/invariants).
- Diagnostics throughout (engine selection, column mode, noise removal counts, per‑entry segmentation diagnostics, validation summary).

The result is a normalized CV containing structured arrays (experience responsibilities/achievements) and a diagnostics object that gives detailed, stage‑by‑stage insight into what happened.

---

## High‑Level Dataflow

```mermaid
flowchart TD
  A[Source: PDF/PNG/TXT] --> B{Engine Selection}
  B -->|Native text OK| C[pdfplumber / text extractor]
  B -->|OCR needed| D{OCR Backend}
  D -->|docTR| E[docTR text + layout blocks]
  D -->|Paddle/PP-Structure| F[Paddle text + layout blocks]

  C --> G[cv_parser/canonicalize.py]
  E --> G
  F --> G

  G -->|column clustering + sections + noise counts| H[my-app/convex/lib/parsing/canonicalize.ts]
  H --> I[cvmapper.ts (semantic mapping)]
  I --> J[normalize_cv.ts (normalization + synthesis)]
  J --> K[canonical.ts (final de-bleed + validation)]
  K --> L[(Normalized CV + Diagnostics)]

  subgraph Python Stage
    G
  end

  subgraph TS Stage
    H --> I --> J --> K
  end

  subgraph Shared Dependencies
    M[languageNormalizer.ts]
    N[skillsCanonical.ts]
    O[contactExtractor.ts]
    P[shared/headings.json]
  end

  H --- M
  I --- M
  I --- N
  I --- O
  H --- P
```

### Environment Toggles

- `CV_NATIVE_MIN_CHARS`, `CV_NATIVE_MIN_DENSITY` — prefer native text when native extraction meets these thresholds (used in Python service; mirrored in TS as a fallback attachment to diagnostics).
- `USE_NATIVE_TEXT_WHEN_AVAILABLE` — if true, do not run OCR when native criteria are met.
- `ENABLE_SECTION_LOCKS` — enforce multilingual heading locks during Python canonicalization.
- `ENABLE_NOISE_FILTER` — enable known template/noise removal during Python canonicalization.
- `EXPERIENCE_STRICT_SPLIT` — stricter date/header boundary detection in experience segmentation.
- `SYNTH_SUMMARY_FROM_RESPONSIBILITIES` — enable per‑job summary synthesis from responsibilities.
- `ALLOW_OCR_FALLBACK` — allow OCR fallback when native text is empty/very low.

---

## Source Extraction & Engine Selection

- Decision:
  - Choose native text when total extracted characters ≥ `CV_NATIVE_MIN_CHARS` or average per‑page density ≥ `CV_NATIVE_MIN_DENSITY`.
  - Else OCR: prefer docTR; fall back to Paddle/PP‑Structure; optional Tesseract fallback when enabled.
- Emitted diagnostics:
  - `engine_selection`: `{ engine: "native"|"ocr", reasons: [...] }`.
  - Other: `pages`, `ocr_chars`, `ocr_blocks`, `dpi_used`, `fallback_used`, `engine_attempted`, `engine_final`.
- OCR subpaths:
  - docTR: high‑fidelity OCR, layout aware; heavier dependency.
  - Paddle/PP‑Structure: robust CPU path, returns layout blocks for downstream.
- Rationale:
  - Columnar PDFs and templated layouts can mislead OCR reading order; downstream column clustering and heading locks mitigate this.

---

## Layout & Columns (Python Stage)

```mermaid
sequenceDiagram
  participant Extract as extract/ocr_pdf.py
  participant Canon as canonicalize.py
  participant TS as TS Pipeline
  participant Diag as diagnostics

  Extract->>Diag: pages, ocr_chars, layout blocks (if OCR)
  Canon->>Canon: Two-column clustering via median x0; left rail then right rail
  Canon->>Diag: column_mode: "two-column"|"single"
  Canon->>Canon: Multilingual heading locks; early noise filtering
  Canon->>Diag: section_order, noise_lines_removed
  Canon->>TS: Forward canonical text + rawSections + diagnostics
```

- Two-column clustering: split by median x0; sort within rails by y; reading order: left rail then right rail; fallback to single column when distribution is unimodal.
- Section locks: latest heading owns following lines until the next heading; prevents migration across sections.
- Noise filtering: removes template artifacts early; records `noise_lines_removed` in diagnostics.

---

## Section Segmentation & Noise Filtering

- Heading dictionary includes: PROFILE/SUMMARY/EXPERIENCE/EDUCATION/SKILLS/LANGUAGES/LINKS/HOBBIES/DETAILS (with multilingual variants).
- Template artifacts removed:
  - “Resume Templates”, “Build this template”, emblem tokens like “o SKILLS o”, “o HOBBIES o”, and standalone “LinkedIn”/“Pinterest”.
- Early noise filtering happens in Python; final pass happens in TS `canonical.ts` before output.

---

## Semantic Mapping (TypeScript)

- Owner: `my-app/convex/lib/parsing/cvmapper.ts`.
- Experience splitting rules (priority order):
  1) Date ranges (e.g., `January 2021 — April 2022`, `2020-01 - 2022-04`).
  2) Title at Org header lines: `<Title> at <Org>[, <Location>]`.
  3) Org — Title patterns: `<Org> — <Title>` or `<Org> - <Title>`.
  4) Org-only header followed by ops verbs on next line.
  - Boundary rule: start a new entry on each new anchored date/header; never merge entries with different date ranges or organizations.
- Extracted fields per entry:
  - `company`, `position`, `location`, `startDate` (YYYY-MM), `endDate` (YYYY-MM|null), `dateConfidence` (high|medium|low).
- Bullet classification:
  - Achievements if: contains % or quantities and improvement/installation verbs (reduced/decreased/cut/improved/increased/boosted/installed/implemented/introduced/deployed/rolled out/launched/upgraded/expanded).
  - Responsibilities if: starts with ops verbs (maintain/monitor/log/ensure/inspect/interview/patrol/guard/apprehend/detain/report/operate/coordinate/respond...). If both, achievement wins when %/quantity exists.
- Per-entry diagnostics:
  - `header_signals`: `{ match: 'date'|'title_at_org'|'org_only'|'none', titleFound, orgFound, locFound, dateFound }`.
  - `date_range`: `{ start, end, confidence }`.
  - `counts`: `{ responsibilities, achievements, droppedDuplicates }`.
  - `summarySource`: `"original"|"synthesized_from_responsibilities"|null`.
- Helpers in `mapping_utils.ts`:
  - `extractDateRange`, `parseExperienceHeader`, `classifyExperienceBullet`, `isTemplateNoiseLine`, `SECTION_TOKEN_RE`.

---

## Normalization & Synthesis

- Owner: `normalize_cv.ts`.
- Bullet normalization: punctuation clean, collapse whitespace, dedupe case‑insensitively; cap lengths (e.g., responsibilities ≤ 10, achievements ≤ 8).
- Synthesized per‑job summary when missing: 1–2 sentences (~200–260 chars) from responsibilities only; mark `summarySource="synthesized_from_responsibilities"` on both the entry and its diagnostics.
- Rebuilds `content` for display, but downstream should always use arrays (responsibilities[], achievements[]).

---

## Final De‑bleed & Validation

- Owner: `canonical.ts`.
- De‑bleed rules:
  - Remove lines that contain section tokens (SKILLS/HOBBIES/LINKS/LANGUAGES/DETAILS/CONTACT) or known template artifacts.
  - Drop ALL‑CAPS lines that exactly match known headings within non‑heading sections.
- Diagnostics:
  - `debleed_removed_count` per section (e.g., `{ experience: 3, summary: 1 }`).
  - `validation` with soft warnings:
    - `summary_below_threshold`, `experience_missing_header`, `invalid_profile_location`, `experience_date_overlap`.
- Invariants handled:
  - Location must match city/state/zip/country format; otherwise unset and warn.
  - Overlapping date ranges for same org add overlap warnings; do not merge entries.

---

## Diagnostics Catalog

| Key | Set By | When | Example |
|---|---|---|---|
| `engine_selection` | Engine selection (Python, fallback in TS) | Always | `{ engine: "native", reasons: ["chars>=300"] }` |
| `column_mode` | Python canonicalize.py | After column clustering | `"two-column"` |
| `section_order` | Python canonicalize.py | After segmentation | `["SUMMARY","EXPERIENCE",...]` |
| `noise_lines_removed` | Python canonicalize.py | Early noise filter | `4` |
| `debleed_removed_count` | canonical.ts | Final de‑bleed | `{ experience: 3, summary: 1 }` |
| `validation.warnings` | canonical.ts | Soft invariants | `["invalid_profile_location"]` |
| `validation.counts` | canonical.ts | Aggregates | `{ overlapWarnings: 1, achievementsDeduped: 2 }` |
| `experience[i].diagnostics.header_signals` | cvmapper.ts | Per entry | `{ match: "title_at_org", titleFound: true, ... }` |
| `experience[i].diagnostics.date_range` | cvmapper.ts | Per entry | `{ start: "2021-01", end: "2022-04", confidence: "high" }` |
| `experience[i].diagnostics.counts` | cvmapper.ts/normalize_cv.ts | Per entry | `{ responsibilities: 5, achievements: 2, droppedDuplicates: 1 }` |
| `experience[i].diagnostics.summarySource` | normalize_cv.ts | Per entry | `"synthesized_from_responsibilities"` |

---

## Failure Modes & Mitigations

- Column bleed/misaligned order → Mitigate via two‑column clustering + heading locks.
- Hyphenation/glyph loss → Bullet normalizer + punctuation cleanups.
- Broken headers (Org — Title vs Title at Org) → Robust header parsing and fallback org‑only + ops‑verb lookahead.
- Orphaned dates → Bind within ± lines to nearest entry boundary.
- Duplicate rails/dense noise → Early filter + final de‑bleed; diagnostics count removals.

---

## Multi‑Fixture Test Plan (no code)

Fixtures under `fixtures/` (or @fixtures):

- Native single‑column PDF (clean text). Expect `engine_selection=native`; 1–2 experience entries; arrays present; minimal `debleed_removed_count`; no warnings.
- Native two‑column PDF. Expect `column_mode=two-column`; `section_order` reflects source; segmentation correct.
- Template/noise‑heavy PDF. Expect higher `noise_lines_removed` and `debleed_removed_count`; possible `experience_missing_header`.
- Image‑only (low quality) → docTR. Expect OCR diagnostics; lower line counts; arrays still present.
- Image‑only (complex layout) → Paddle/PP‑Structure. Expect OCR fallback; arrays present but smaller; layout counts recorded.
- Multilingual (ES/IT). Expect localized month/heading detection; ISO dates.
- Year‑only dates. Expect `dateConfidence="medium"` with `-01` month fallback.
- Org‑only headers + ops verbs. Expect fallback creation of entries with responsibilities.

For each fixture, assert:
- Engine branch, number of experience entries.
- Arrays present for responsibilities/achievements; content deduped and capped.
- Synthesized summaries present where needed.
- `validation.warnings` and `debleed_removed_count` within reasonable ranges.

### Test Execution Plan
- Run Vitest against `my-app/convex/lib/parsing/__tests__/*`.
- Set env flags according to scenario (e.g., `ALLOW_OCR_FALLBACK=1`, `ENABLE_NOISE_FILTER=1`).
- Record per fixture a summary table of diagnostics and counts; tolerate OCR path swaps by asserting presence of `engine_selection` rather than exact engine name unless pinned.

---

## Ownership Map

- `cv_parser/extract/ocr_pdf.py`: OCR and layout extraction; diagnostics seeding.
- `cv_parser/canonicalize.py`: engine artifact; column clustering; heading locks; early noise filtering; emits `section_order` and `noise_lines_removed`.
- `my-app/convex/lib/parsing/canonicalize.ts`: orchestrates TS canonicalization; attaches engine selection fallback; calls final de‑bleed; sets defaults.
- `my-app/convex/lib/parsing/cvmapper.ts`: experience segmentation + classification; per‑entry diagnostics.
- `my-app/convex/lib/parsing/mapping_utils.ts`: date/header/bullet/noise helpers.
- `my-app/convex/lib/parsing/normalize_cv.ts`: normalization, dedupe, synthesized summaries, content rebuild.
- `my-app/convex/lib/parsing/canonical.ts`: final de‑bleed, soft warnings, and validation counts.
- `languageNormalizer.ts`, `skillsCanonical.ts`, `contactExtractor.ts`, `shared/headings.json`: languages, skills, contact extraction, and headings.

---

## Triage Runbook

1) Engine
- Inspect `diagnostics.engine_selection.engine`, `pages`, `ocr_chars`. If OCR chosen incorrectly, verify native thresholds and toggles.

2) Columns & Headings
- If mixed rails, check `diagnostics.column_mode` and `section_order`. Ensure layout blocks reached Python stage.

3) Noise
- If template terms leak, confirm early noise enabled and see `noise_lines_removed`. Final `debleed_removed_count` should remove stragglers.

4) Experience
- Check per‑entry `header_signals`, `date_range`, and arrays. If entries merged or strings appear, ensure mapping is used and no re‑bucketing occurs.

5) Summaries
- Missing per‑job summaries should be synthesized from responsibilities; check `summarySource` and lengths.

6) Validation
- Review `validation.warnings` and counts; non‑blocking issues should be visible without throwing.

