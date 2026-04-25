# 2026-03-17 application_message single-signal audit

## Scope

- Format: `application_message`
- Provider path reviewed first: ChatGPT inline prompt path
- Focus: one-strong-signal pressure inside the active structured artifact

## Reviewed code state

### Active code

- `convex/generateProposalMutation.ts`
- `convex/lib/proposals/proposalRenderer.ts`
- `convex/lib/proposals/__tests__/proposalProviderBusy.test.ts`
- `convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
- `convex/lib/proposals/__tests__/proposalRenderer.test.ts`

### Main finding

The structured artifact was already active, but the candidate-side priority block was still too broad for a format that should ride on one strong idea.

Before this pass, the app-message candidate block could still expose:

- up to 3 `strongest_candidate_proof` items
- up to 3 `supported_scope_or_background` items
- up to 4 `secondary_profile_signals_nonleading` items

That was still résumé-summary-friendly, even with a tighter prompt.

## Change made

- reduced `strongest_candidate_proof` to one item
- reduced `supported_scope_or_background` to one item
- stopped carrying summary snippets into `supported_scope_or_background` when a stronger proof already exists
- made `secondary_profile_signals_nonleading` a true last-resort fallback instead of parallel material
- filtered generic soft-skill spillover such as `Effective Communication` and `Teamwork` out of those secondary signals

## Why this was the smallest justified fix

- it preserves the active structured artifact
- it preserves employer-priority shaping
- it preserves requirement-contamination filtering
- it improves generation pressure at the evidence-selection layer instead of adding more cleanup

## Validation

Executed from `my-app/`:

```bash
npx vitest run convex/lib/proposals/__tests__/proposalProviderBusy.test.ts convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalRenderer.test.ts
```

Result at audit time: all targeted tests passed.

## Residual risk

- ranking is still order-based, not semantic-scored
- live generations still need review to confirm that reduced candidate-pack breadth translates into more sendable notes
