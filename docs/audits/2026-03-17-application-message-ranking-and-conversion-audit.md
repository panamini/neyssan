# 2026-03-17 application_message ranking and conversion audit

## Scope

- Format: `application_message`
- Provider path reviewed first: ChatGPT inline prompt path
- Focus: next correction after structured artifact and single-signal narrowing

## Reviewed code state

### Active code

- `convex/generateProposalMutation.ts`
- `convex/lib/proposals/proposalRenderer.ts`
- `convex/lib/proposals/__tests__/proposalProviderBusy.test.ts`
- `convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
- `convex/lib/proposals/__tests__/proposalRenderer.test.ts`

### Main finding

The structured artifact and single-signal direction were already active.

The remaining gap was:

1. candidate proof selection for CV-backed cases was still mostly order-based
2. no-CV conversion still left room for abstract opener/proof phrasing such as broad domain labels or “draws my attention”

## Change made

- added narrow job-aware scoring for `application_message` candidate snippets
- ranked candidate proof and supported background by overlap with job-title and employer-priority tokens before taking the single surviving item
- kept the one-signal constraint intact
- added one small no-CV conversion wording change so opener/proof guidance points to one concrete work surface rather than abstract interest language

## Why this is still narrow

- no routing redesign
- no provider redesign
- no broader parser redesign
- no heavy cleanup or rewrite layer
- no changes outside `application_message`

## Validation

Executed from `my-app/`:

```bash
npx vitest run convex/lib/proposals/__tests__/proposalProviderBusy.test.ts convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalRenderer.test.ts
```

Result at audit time: all targeted tests passed.

## Residual risk

- the ranking is still heuristic-based, not semantic retrieval
- live outputs still need review to confirm the selected proof converts into a stronger recruiter note consistently
