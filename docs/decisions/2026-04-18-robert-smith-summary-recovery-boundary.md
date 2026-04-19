# Robert Smith Summary Recovery Boundary

Date: 2026-04-18

## Status

Implemented on `main` in the Mistral resume v3 parser path.

Relevant files:

- [cv_parser_service/mistral_resume_v3/pipeline.py](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/mistral_resume_v3/pipeline.py)
- [cv_parser_service/mistral_resume_v3/post_validation.py](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/mistral_resume_v3/post_validation.py)
- [cv_parser_service/tests/test_mistral_resume_v3_pipeline.py](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/tests/test_mistral_resume_v3_pipeline.py)

## Problem

`robertsmith.jpg` contained an explicit summary block in OCR markdown, but the final app document still had no usable `summary` section.

This looked at first like an app-side propagation bug, but the real failure started earlier:

1. Mistral OCR markdown included an explicit summary heading and body.
2. The parser still returned empty `normalized.summary.text`.
3. App canonicalization then fell back to profile/contact sludge.
4. Typed section mapping produced no real summary section.

So the bug was not primarily:

- preview rendering
- import diagnostics
- section mapping
- `structuredUpload` handoff

Those layers could expose the symptom, but they were not the first boundary making the wrong result inevitable.

## Winning Boundary

The winning boundary was parser-side section recovery in `cv_parser_service/mistral_resume_v3`.

The correct fix was:

- detect explicit summary-family OCR markdown headings
- recover summary from that explicit section only
- keep the recovery narrow and deterministic

This follows the same principle used for experience recovery:

- OCR structure is the authority
- recovery is allowed only when OCR provides explicit section evidence
- no broad semantic guessing from arbitrary paragraphs

## What Was Implemented

Parser-side summary recovery now:

- looks for explicit summary-family headings in OCR markdown
- recovers summary text only from the matching OCR section body
- preserves the conservative validation contract

Post-validation was also tightened so template filler heuristics do not discard a valid summary when that text clearly belongs to an explicit markdown summary section.

## Why Earlier Patches Were Not The Root Fix

Before the parser fix, several app-side patches were explored:

- summary-family support in app canonicalization
- import-review signals for missing summaries
- plain-text editor conversion fallback
- authoritative envelope handoff checks

Some of that work remains useful as fallback hardening, but none of it fixed Robert Smith at the first failing boundary.

If this bug appears again, check the parser output first:

1. Does OCR markdown contain an explicit summary heading?
2. Does parser `normalized.summary.text` remain empty?
3. Does app canonicalization invent a fallback summary from profile/header text?

If the answer pattern is yes/yes/yes, the fix belongs in parser-side summary recovery, not in downstream UI plumbing.

## Verification Pattern

For a real fixture like `robertsmith.jpg`, verify in this order:

1. OCR markdown contains an explicit summary heading.
2. Parser output contains non-empty `normalized.summary.text`.
3. Raw sections include `Summary`.
4. App typed sections include a real `summary` section.

Regression command:

```bash
python3 -m pytest cv_parser_service/tests/test_mistral_resume_v3_pipeline.py
```

## Non-Goals

This fix did not introduce:

- broad summary synthesis from arbitrary prose
- fuzzy heading inference
- extra parser retries
- downstream UI hacks to mask empty parser output
