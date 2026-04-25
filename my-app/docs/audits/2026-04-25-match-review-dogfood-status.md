# Match Review V1 - Dogfood Status

Status: dogfood-ready.

Validation completed:
- deterministic benchmark passed
- 10 live exported records spot-checked
- no raw evidence or PII leaks observed
- no credential hallucination observed
- no critical verdict/reason contradiction observed

Main live-data risk:
Sparse same-family jobs can still look too harsh, especially when the title family is plausible but extracted evidence is thin. Track these during dogfood before making another calibration change.

Dogfood tracking convention:
- use `human_label: "too_harsh"` or `failure_types: ["too_harsh"]`
- add `sparse_same_family` to `reviewer_notes`
- summarize with `rtk ./node_modules/.bin/tsx scripts/evals/summarize-live-match-review-records.ts /tmp/match-review-live-labeled.json`

## How to run

1. Export records:
   `rtk ./node_modules/.bin/tsx scripts/evals/run-live-match-review-dogfood.ts --limit 50`
2. Label records:
   edit `/tmp/match-review-live-labeled.json` with `human_label`, `failure_types`, and `reviewer_notes`
3. Summarize:
   `rtk ./node_modules/.bin/tsx scripts/evals/run-live-match-review-dogfood.ts --summary-only --labeled /tmp/match-review-live-labeled.json`
4. Track sparse same-family too harsh:
   add `sparse_same_family` to `reviewer_notes` and keep `failure_types` on `too_harsh`
