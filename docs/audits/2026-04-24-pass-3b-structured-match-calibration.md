# Pass 3B Structured Match Calibration

## Mission

Pass 3B evaluates the Pass 3A structured shadow scorer. It does not change scoring formulas, thresholds, outcome rules, production match-read behavior, UI payloads, or debug panels.

## Fixture Matrix

The evaluation matrix covers one deterministic local fixture for each critical family:

| Fixture | Family | Manual expected label | Purpose |
| --- | --- | --- | --- |
| `security_kith_robert` | security/licensed | good fit | Preserve the Kith/Robert regression: old score stays `0/weak`, structured score is greater than zero, metadata is excluded. |
| `retail_service_associate` | retail/service | good fit | Customer service, cash handling, retail constraints, and physical/schedule constraints stay separated. |
| `technical_frontend_engineer` | technical | good fit | Technical skills are matched through concrete skills, experience, and projects. |
| `admin_office_coordinator` | admin/office | partial fit | Office skills match while absent grant-writing evidence remains `unknown`. |
| `healthcare_medical_assistant` | healthcare/regulated | good fit | Certification and HIPAA/patient-intake evidence are visible without introducing production hard gates. |
| `short_noisy_cashier` | short noisy job | partial fit | Metadata-heavy sparse postings still produce no metadata requirements. |
| `long_duplicated_scrape_inventory` | long duplicated scraped job | good fit | Boilerplate, benefits, compensation, and duplicated EEO text are excluded from requirements. |
| `multilingual_fr_support` | multilingual | good fit | Source-language evidence can match without relying on translated English artifacts. |

No second fixture is forced where repo-backed data is not yet available. A later rollout pass should prefer two fixtures per family before production promotion.

## Comparison Row

Every fixture records the same comparison row:

- fixture id
- family
- old score/tier
- structured score/tier
- matched/partial/missing/unknown counts
- metadata leak count
- provenance completeness
- manual expected label

The tests use structured assertions over these fields rather than brittle full-object snapshots.

## Current Scoring Facts

Pass 3B records these Pass 3A formulas as current behavior only:

- required requirement weight: `1`
- preferred requirement weight: `0.5`
- supporting requirement weight: `0`
- matched credit: full weight
- partial credit: half weight
- unknown credit: `0.25`
- missing credit: `0`
- matched threshold: evidence score `>= 0.75`
- partial threshold: evidence score `>= 0.4`
- tier mapping: `strong >= 75`, `partial >= 40`, otherwise `weak`
- constraints do not affect score while `scoreDriving === false`

Pass 3B does not modify any of these.

## Calibration Questions Before Rollout

- Is `unknown = 0.25` too generous for sparse profiles or noisy jobs?
- Should regulated certifications/licenses become hard gates in a later production scorer?
- Should source confidence affect scoring, with experience/certification evidence stronger than summary/headline/raw text?
- Should role title and role alignment remain diagnostic-only, or should some titles carry low positive weight?
- Should physical ability, schedule, location, work authorization, and compensation remain non-scoring constraints or become separately gated?
- Are `75/40` tier thresholds stable across job families once each family has at least two credible fixtures?

## Acceptance Boundary

Pass 3B is accepted only if:

- old `computeMatchRead` remains the production source
- no production score, tier, matched, or missing behavior changes
- no UI payload or panel changes are introduced
- metadata leak count is zero for every fixture
- every matched or partial outcome has concrete profile evidence and provenance
- absent evidence produces `unknown`
- constraints remain separate from positive evidence
- Kith/Robert remains old `0/weak` and structured `>0`
