# 2026-03-17 application_message structured artifact redesign audit

## Scope

- Active format only: `application_message`
- Active provider path reviewed first: ChatGPT inline prompt path
- Focus: generation-core artifact design
- Out of scope: `cover_letter`, `freelance_proposal`, broad routing redesign, provider redesign, parser redesign for other formats

## Reviewed evidence

### Active code

- `convex/generateProposalMutation.ts`
- `convex/lib/proposals/proposalRenderer.ts`
- `convex/lib/proposals/__tests__/proposalProviderBusy.test.ts`
- `convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
- `convex/lib/proposals/__tests__/proposalRenderer.test.ts`

### Reviewed output shapes

Representative bad shapes from the current `application_message` family remained:

- `I decreased theft of hotel items by 73% ... My experience as a security guard ... Happy to share more if useful.`
- `I am interested in the Security Guard position at Kith. With a strong background in security and loss prevention ... Happy to share more if useful.`

These failures were no longer mainly about routing ambiguity or requirement contamination. The deeper issue was that the system was still asking for and saving a generic short paragraph.

## Findings

1. The active ChatGPT `application_message` path was already the inline prompt path, not the old creative proposal path.
2. Employer-priority input and narrowed candidate-priority input were already present, but the artifact was still defined as freeform prose.
3. Finalization still treated `application_message` primarily as body text plus deterministic boundary rendering, which preserved paragraph-generator behavior.
4. The narrow next move was therefore a format-specific artifact redesign: make the model return structured short-message parts, then render those parts deterministically into one paragraph.

## Change made

### Active code

- Reframed `application_message` as a three-part artifact: `opener`, `proof_line`, `follow_up_line`.
- Required the active ChatGPT prompt to return exactly those three labeled lines and nothing else.
- Added narrow parsing and deterministic rendering for those three parts in `proposalRenderer.ts`.
- Updated `finalizeProposalForSave(...)` to prefer the structured render for `application_message`, with the prior freeform finalization path kept as fallback for stability.

## Why this is the smallest justified change

- It changes only the `application_message` format contract and final render shape.
- It preserves the current employer-priority gains.
- It preserves the narrowed candidate-priority snapshot.
- It does not redesign routing, providers, model choice, or other output formats.
- It relies on light parsing and deterministic rendering instead of adding a heavy rewrite or cleanup subsystem.

## Validation

Executed from `my-app/`:

```bash
npx vitest run convex/lib/proposals/__tests__/proposalProviderBusy.test.ts convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalRenderer.test.ts
```

Result at audit time: all targeted tests passed.

## Residual risk

- The model can still produce weak content inside the three-part structure.
- The fallback freeform finalization path still exists for resilience, so some non-structured outputs can still save if the structured block is absent.
- Live generation review is still needed on the failing `application_message` cases after this structural shift.
