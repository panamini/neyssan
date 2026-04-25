# Application Message Cleanup And Finalization Audit

Date: 2026-03-17

## Scope

- Active code only.
- `application_message` only.
- ChatGPT path first.
- Prompt/body-contract tightening plus narrow cleanup/finalization protection.

## Reviewed code

- `my-app/convex/generateProposalMutation.ts`
- `my-app/convex/lib/proposals/proposalRenderer.ts`
- `my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
- `my-app/convex/lib/proposals/__tests__/proposalRenderer.test.ts`
- `my-app/convex/lib/proposals/__tests__/proposalProviderBusy.test.ts`

## Findings

1. The active inline `application_message` prompt still allowed a short letter/profile hybrid.
   - It still allowed `1 to 3` raw sentences, which became `2 to 4` saved sentences after the local follow-up line.
   - It discouraged formal formulas, but it did not explicitly ban self-summary openings like `I have extensive experience...` or self-labeling like `I am a talented...`.

2. The deterministic renderer was still making the saved artifact look more email-like than DM-like.
   - `proposalRenderer.ts` appended the local follow-up line as a separate paragraph for `application_message`.
   - That conflicted with the intended one-paragraph short-note format.

3. Generic boundary cleanup was not enough for `application_message`.
   - `stripStandaloneBoundaryLines(...)` only removed canonical salutations/sign-offs such as `Sincerely,` or `Best regards,`.
   - It did not remove standalone `Hi there`, bare `Best`, or similar short-message leakage.

4. Sentence cleanup was not yet format-aware enough for application-message boilerplate.
   - The body cleaner did not explicitly strip `Thank you for considering my application.` or the reviewed self-hype/profile-blurb sentence shapes.

## Narrow fix

1. Tighten the prompt/body contract.
   - Raw body: exactly `1 to 2` substantive sentences.
   - Saved artifact target: `2 to 3` total sentences.
   - One paragraph only.
   - Explicit bans for greetings/sign-offs, self-labeling, and generic self-summary openers.

2. Add `application_message`-specific cleanup only where needed.
   - Strip standalone `Hi there`, `Hello`, `Best`, `Regards`, `Sincerely`, and similar boundary leakage.
   - Strip ceremonial thank-you lines and the reviewed self-hype/profile-blurb sentence patterns.

3. Keep the local follow-up line, but render it inline.
   - This preserves the lighter recruiter follow-up behavior without creating a stacked pseudo-email shape.

## Validation

Ran:

```bash
npx vitest run convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalRenderer.test.ts convex/lib/proposals/__tests__/proposalProviderBusy.test.ts
```

From `my-app/` root:

- `137` tests passed.

