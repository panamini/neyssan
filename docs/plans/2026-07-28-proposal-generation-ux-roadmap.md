# Proposal Generation UX Roadmap

Status: current implementation roadmap as of 2026-07-28. This document distinguishes local verified artifacts from merged or shipped behavior.

## UX invariants

- Weak or missing optional context is a soft warning. The user can choose **Generate anyway**.
- Hard blocks are limited to authentication failure, no meaningful job intent, exhausted provider unavailability, cancellation, or output that is unsafe or cannot be saved.
- Raw Convex, provider, or runtime details are never the primary user-facing copy. On failure, preserve the draft and offer a clear recovery action.

## Current implementation truth

### Brief

The internal premium brief is active and feeds prompt construction and validation. The visible `ProposalBriefCard` currently presents request and job data; it is not an additional pre-generation context source.

Future Brief propagation is deferred until a concrete, editable pre-generation source exists. Do not invent a payload before that source and its ownership are defined.

### Language

Settings and the server mostly share the multilingual generation path, while English and French have deeper qualification. This does not establish parity for every language.

Irish is not a current product priority. This leaf neither promises language parity nor adds or hides languages.

## Program status

- `CC-20260728-GEN-ERROR-UX`: local verified artifact; not merged or shipped.
- `CC-20260728-NO-CV-PREFLIGHT`: local verified artifact; not merged or shipped.

## Dependency-ordered next steps

1. Publish the two verified UX leaves after review.
2. Qualify non-English/French behavior with narrow offline wiring checks.
3. Separately assess the default-off PR #366 writer before any activation decision.
