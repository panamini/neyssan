# Parsing Pipeline — TypeScript Hand‑off Addendum

This addendum complements the main pipeline doc. It focuses on the TS stage hand‑offs, diagnostics points, and a compact multi‑fixture plan. It does not repeat content from the primary doc unless necessary.

## TS‑Stage Hand‑off (Sequence)

```mermaid
sequenceDiagram
  participant PY as canonicalize.ts (TS)
  participant MAP as cvmapper.ts
  participant NORM as normalize_cv.ts
  participant FIN as canonical.ts

  PY->>MAP: rawSections[], rawText, Python diagnostics (engine/page/noise/sections)
  Note right of PY: Adds defaults if needed (e.g., column_mode/section_order fallback).

  MAP->>MAP: Experience segmentation (date/header anchors)
  MAP->>MAP: Bullet classification (responsibility vs achievement)
  MAP->>MAP: Emit per-entry diagnostics
  Note right of MAP: Adds/updates per-entry\n    header_signals, date_range, counts, summarySource:null

  MAP->>NORM: entries with company/position/location/startDate/endDate + arrays (responsibilities[], achievements[])

  NORM->>NORM: Cap & dedupe lists; rebuild content for display
  NORM->>NORM: Synthesize per-entry summary if missing
  NORM->>NORM: Set summarySource="synthesized_from_responsibilities" when synthesized
  Note right of NORM: Updates per-entry diagnostics.counts and diagnostics.summarySource

  NORM->>FIN: fully-structured entries + top-level artifacts

  FIN->>FIN: Final de‑bleed filters (remove template/section tokens)
  FIN->>FIN: Soft validation (warnings & counts)
  Note right of FIN: Updates top-level\n    debleed_removed_count, validation.warnings, validation.counts, validation.needsReview
```

### Keys added/updated by hop
- canonicalize.ts (TS):
  - Ensures defaults: `column_mode` (if missing), `section_order` (if missing), `noise_lines_removed` default 0.
  - Attaches/propagates `engine_selection` fallback if upstream didn’t set it.
- cvmapper.ts:
  - Per‑entry: `diagnostics.header_signals`, `diagnostics.date_range`, `diagnostics.counts`, `diagnostics.summarySource=null` initially.
  - Arrays: `responsibilities[]`, `achievements[]`; scalar: `company`, `position`, `location`, `startDate`, `endDate`, `dateConfidence`.
- normalize_cv.ts:
  - Per‑entry: caps/dedupes arrays; synthesizes summary; sets `summarySource` on entry and `diagnostics.summarySource`.
  - Updates `diagnostics.counts` (responsibilities, achievements, droppedDuplicates), rebuilds `content` safely.
- canonical.ts:
  - Top‑level: `debleed_removed_count`, `validation.warnings`, `validation.counts`, `validation.needsReview`.

## Diagnostics Catalog (expanded)
Additional keys (not repeated from main table) with Consumer column and scope.

| Key | Scope | Set By | Consumer(s) | When | Example |
|---|---|---|---|---|---|
| `engine_attempted` | Top-level | Python OCR | Ops/QA dashboards | After OCR try | `"doctr"` |
| `engine_final` | Top-level | Python OCR | Ops/QA dashboards | After OCR/backoff | `"paddle"` |
| `experience_source` | Top-level | Python OCR/canonicalize | Analytics/telemetry | When fallback used or sections recovered | `"raw_sections"` |
| `ocr_retry_count` | Top-level | Python OCR | Ops/QA dashboards | On OCR retries | `1` |
| `pdf_pages_rendered` | Top-level | Python OCR | Ops/QA dashboards | On OCR passes | `2` |
| `validation.needsReview` | Top-level | canonical.ts | QA UI / moderation | On soft invariant violations | `{ entryHeader: true }` |
| `experience[i].diagnostics.summarySource` | Per-entry | normalize_cv.ts | Modal/UI rendering | After synthesis or preserve `original` | `"synthesized_from_responsibilities"` |

## Multi‑Fixture Test Matrix (planning)

| Fixture (path) | Profile | Engine | Acceptance Gates | Env Flags |
|---|---|---|---|---|
| fixtures/fixturetest/cv (13).pdf | Native 2‑column (to confirm) | native | experience.length ∈ [2,4]; arrays present; synthesized summary appears for any entry lacking summary; `engine_selection`, `column_mode`, `section_order`; `debleed_removed_count` small; warnings empty | `ENABLE_NOISE_FILTER=1` |
| fixtures/fixturetest/cv (14).pdf | Native single‑column (clean) | native | experience.length ∈ [1,3]; arrays present; synthesized summary not required; `noise_lines_removed≈0`; warnings empty | `ENABLE_NOISE_FILTER=1` |
| fixtures/fixturetest/cv (308).pdf | Template/noise‑heavy | native | higher `noise_lines_removed` & `debleed_removed_count`; arrays present; possible `experience_missing_header` warning | `ENABLE_NOISE_FILTER=1` |
| fixtures/fixturetest/cv_png.pdf | OCR docTR (to confirm) | ocr/docTR | arrays present but smaller; OCR diagnostics present (engine_attempted/final); `column_mode` may be `single`; low fallback | `ALLOW_OCR_FALLBACK=1` |
| fixtures/fixturetest/sample_scanned_resume.pdf | OCR Paddle/PP‑Structure | ocr/paddle | arrays present; layout counts; potential lower quality bullets; diagnostics show paddle path | `ALLOW_OCR_FALLBACK=1` |
| fixtures/fixturetest/fr.txt | Multilingual (FR headings/months) | native | ISO dates; sections recognized; arrays present; warnings empty | `ENABLE_SECTION_LOCKS=1` |
| fixtures/fixturetest/2.txt | Year‑only dates | native | dateConfidence `medium`; start/end fallback month `-01`; arrays present | – |
| fixtures/fixturetest/6.txt | Org‑only + ops verbs | native | fallback segmentation; arrays present; `header_signals.match` may be `org_only` | – |

Notes:
- Use `@fixtures` alias if configured in runner; replace with actual path in CI.
- Engine “to confirm” indicates verifying docTR vs Paddle outcomes on given environment.

## Ownership & “don’t misplace logic”
- Pre‑mapping hygiene (early noise, columns, locks): Python `cv_parser/canonicalize.py`.
- Segmentation/classification (boundaries, arrays, per‑entry diagnostics): `cvmapper.ts`.
- List cleanup + synthesized summaries (and counts): `normalize_cv.ts`.
- Late de‑bleed + invariants/soft warnings: `canonical.ts`.

# ready
curl -sS $ORIGIN/ready | jq '{ok,ocr}'

# mistral probe
curl -sS -F file=@fixtures/fixturetest/cv_png.pdf $ORIGIN/mistral-ocr/probe | jq '{ok,diag}'

# mistral parse → expected diag fields
curl -sS -F file=@fixtures/fixturetest/cv_png.pdf $ORIGIN/mistral-ocr/parse \
  | jq '.diagnostics | {engine,engine_final,ocr_engine,ocr_chars,pages}'
