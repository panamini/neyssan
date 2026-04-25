# Application Message Format Contract Audit

Date: 2026-03-17

## Scope

- `application_message` only
- ChatGPT path first
- prompt/body-contract focus
- preserve the recent employer-priority snapshot
- no provider, parser, routing, or model redesign

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/lib/proposals/proposalRenderer.ts`
  - `my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
  - `my-app/convex/lib/proposals/__tests__/proposalRenderer.test.ts`
  - `my-app/convex/lib/proposals/__tests__/proposalProviderBusy.test.ts`
- Active but illustrative outputs
  - `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/raw/application-strong-support__gpt-4o-mini.json`
  - `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/raw/application-adjacent-admin__gpt-4o-mini.json`
  - `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/raw/application-no-context-support__gpt-4o-mini.json`

## Findings

1. The active ChatGPT `application_message` path was already correct on routing and already carried the recent employer-priority snapshot.
   - It builds the inline prompt and sends it through `GPT4Adapter.generate(...)`.
   - It now includes the compact `Application-message employer priority snapshot` based on `buildJobOfferPriorityPack(...)`.

2. The remaining weakness was the format contract itself.
   - The prompt still said `Write a complete job application message`.
   - It still allowed a `70 to 100 words` / `1 to 2 short paragraphs` artifact without explicitly framing it as a recruiter DM / LinkedIn note / teaser message.
   - It still allowed opener and closer shapes that read like mini application letters.

3. The reviewed output failures matched that weak contract.
   - Representative excerpts:
     - `I am excited to apply for the Customer Support Specialist position.`
     - `I believe my experience aligns well with your needs`
     - `Thank you for considering my application.`
   - Those are mini-letter formulas, not native recruiter-message formulas.

4. There was also one deterministic format-contract leak after generation.
   - `proposalRenderer.ts` appended `I would welcome the opportunity to discuss ...` to finalized `application_message` outputs.
   - That sentence directly conflicted with the new target artifact shape.

## Failure Classification

- Prompt/body-contract issue
  - primary issue
  - the artifact was still framed too much like a formal application note instead of a short recruiter-facing message
- Composition-brief issue
  - secondary
  - employer-priority structure existed, but the prompt still allowed résumé-summary behavior around it
- Routing/wiring issue
  - not the current issue
  - routing had already been corrected before this patch
- Parser/output-shape issue
  - not found
- Validation issue
  - one application-message fail-closed test had to be preserved after changing the deterministic follow-up line so a closing-only shell still cannot save

## Narrow Fix Implemented

- Added an explicit `Application-message format contract` block to the inline prompt.
- Reframed the artifact as:
  - short recruiter-facing note
  - LinkedIn message / quick email body / application note
  - 1 to 3 raw-body sentences because the app renders the light follow-up line locally
  - one or two strongest relevance signals only
- Added explicit anti-formula bans for:
  - `I am interested in the ... position`
  - `I am excited to apply`
  - `I believe my experience aligns well with your needs`
  - `Thank you for considering my application`
  - `I would welcome the opportunity to discuss my interest in the role`
- Replaced the deterministic `application_message` closing line with a lighter recruiter-style follow-up:
  - English: `Happy to share more if useful.`
  - French: `Je peux en dire plus si utile.`
- Preserved the fail-closed behavior by treating that new light follow-up as a closing line rather than substantive body content.

## Why This Stayed Narrow

- no provider changes
- no model changes
- no parser changes
- no routing changes
- no premium-cover-letter migration
- preserved the employer-priority snapshot
- changed only the format contract and the application-message-specific deterministic follow-up behavior

## Validation

- Updated prompt-contract tests to assert recruiter-message framing and anti-formula rules.
- Updated routing coverage to assert the active ChatGPT application-message prompt includes the new format block.
- Added renderer coverage for the lighter application-message follow-up line.
- Preserved fail-closed coverage so a stripped message cannot save with only the local follow-up line.

Targeted validation run:

- `npx vitest run convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalRenderer.test.ts convex/lib/proposals/__tests__/proposalProviderBusy.test.ts`

## Conclusion

- The main remaining issue was prompt/body contract, with one deterministic post-generation closer still enforcing letter-style rhetoric.
- The implemented fix is the smallest practical correction that makes `application_message` behave more like a recruiter-facing teaser note while keeping honesty, compactness, and the recent employer-priority gains.
