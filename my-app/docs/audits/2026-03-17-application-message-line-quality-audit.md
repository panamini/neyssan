# 2026-03-17 application_message line-quality audit

## Scope

- Format: `application_message`
- Provider path checked first: ChatGPT
- Focus: structured short-message artifact quality
- Out of scope: `cover_letter`, `freelance_proposal`, routing redesign, provider redesign, cleanup-heavy rewriting

## Reviewed code state

### Active code

- `convex/generateProposalMutation.ts`
- `convex/lib/proposals/proposalRenderer.ts`
- `convex/lib/proposals/__tests__/proposalProviderBusy.test.ts`
- `convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
- `convex/lib/proposals/__tests__/proposalRenderer.test.ts`

### Conclusion from code inspection

The structured `application_message` artifact is active in current code:

- the prompt requires exactly three labeled lines: `opener`, `proof_line`, `follow_up_line`
- ChatGPT `application_message` still uses the inline prompt path
- finalization prefers structured parsing/rendering before the freeform fallback path

So the next issue was not path mismatch. It was line-level quality inside the active structured artifact.

## Reviewed failure shapes

Representative bad shapes remained:

- `The store’s emphasis on maintaining entrance control and crowd flow...`
- `Background in investigation skills and safety compliance relevant to the role's focus...`
- `Happy to share more if useful.`

These point to:

1. opener drift into employer/posting commentary
2. proof-line drift into clipped résumé-note phrasing
3. follow-up drift into stock filler
4. sentence-to-sentence continuity still feeling scaffolded

## Change made

### Prompt/body-contract

- strengthened the three-part contract so `opener`, `proof_line`, and `follow_up_line` are guided as natural recruiter-note lines, not just short sentences
- added a dedicated line-quality guidance block with compact good-shape examples
- changed no-context guidance so opener stays candidate-led instead of role-observation-led
- changed proof-line guidance to require full natural prose with a clear verb
- changed follow-up guidance to lightly build on the earlier proof instead of sounding detached

### Narrow render-policy adjustment

- changed the deterministic fallback `application_message` close from `Happy to share more if useful.` to `If useful, I can share a bit more detail.`

### Stability guard

- kept the structured path primary
- added a narrow saveability guard so fallback-only follow-up lines do not count as substantive `application_message` content by themselves

## Why this is still narrow

- no routing redesign
- no provider redesign
- no parser redesign outside the existing format-specific artifact
- no heavier cleanup or rewrite layer
- employer-priority and candidate-evidence filtering stayed intact

## Validation

Executed from `my-app/`:

```bash
npx vitest run convex/lib/proposals/__tests__/proposalProviderBusy.test.ts convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalRenderer.test.ts
```

Result at audit time: all targeted tests passed.

## Residual risk

- line quality is still prompt-led, so live generations need review
- the fallback paragraph path still exists for resilience if the model ignores the structured contract
- no fresh live Kith/security generation set was rerun during this pass
