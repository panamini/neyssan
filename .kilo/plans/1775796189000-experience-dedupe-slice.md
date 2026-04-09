# Experience Fake-Entry / Dedupe Slice

## Current task
- Implement exactly one narrow slice:
  - experience fake-entry guard
  - near-exact responsibility dedupe
- Do not widen scope beyond this family.

## Current deployed baseline
- No newer family patch was shipped after the later exploration.
- The next unresolved dominant family is still fake/duplicate experience materialization from header/body residue.
- Summary fallback contamination and education raw-table duplication remain secondary and out of scope for this slice.

## Approved boundary
- `cv_parser/canonicalize.py`
- `parse_experience_block(...)`
- `build_experience_entries(...)`
- direct helpers on this path only if strictly necessary

## Scope guard
- Do not change summary.
- Do not change education.
- Do not change skills/languages.
- Do not change recovery.
- Do not change app rendering.
- Do not redesign date parsing.
- Do not do a broad parser rewrite.

## Exact implementation goal
1. Suppress synthesized experience entries that are clearly header/body residue.
2. Suppress near-exact duplicated responsibility text within an experience entry or across adjacent emitted entries.
3. Keep ambiguous fallback behavior unchanged unless the entry is clearly fake.

## Primary targets
- Robert Cooper
- Divyank Singh
- Prasanna Vengatesh

## Secondary targets
- Marion Bonnet
- Jessica Claire
- Roger Walters
- Jake Ryan

## No-regression controls
- `fixtures/cv (13).png`
- `fixtures/cv (14).pdf`
- `fixtures/sample_scanned_resume.pdf`
- `fixtures/cv (308).pdf`

## Smallest safe patch plan

### A. Fake-entry guard
- Add a narrow guard after experience candidate assembly but before entry emission.
- Reject entries only when they clearly look like header/body residue, for example:
  - document title/header lines
  - generic company labels like `Experience`
  - repeated candidate-name/header text posing as role/company
  - repeated role/company pairs with no real distinguishing content

### B. Near-exact responsibility dedupe
- Normalize responsibility text lightly for comparison.
- Remove repeated paragraphs/bullets when they are exact or near-exact duplicates.
- Keep non-identical bullets intact.

### C. Preserve ambiguity fallback
- If an entry is merely weak or sparse, keep current fallback behavior.
- Only suppress when the entry is clearly fake.

## Intended changed files
- `cv_parser/canonicalize.py`
- `cv_parser/tests/test_canonicalize_heading_coverage.py`

## Verification plan
- Run focused parser tests plus no-regression checks.
- Measure before/after `normalized.experience` on the primary targets.
- Confirm no regression on the control fixtures.

## Expected report shape
1. changed files
2. exact functions changed
3. tests run
4. before/after `normalized.experience` on target cases
5. no-regression result on controls
6. local vs deployed status
7. stop

## Stop condition
- If the primary targets are not materially improved, report the earliest confirmed remaining loss boundary and stop without widening scope.

## Status
- Plan recorded.
- No new code changes applied for this slice yet.
