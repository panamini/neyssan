# Application Message Generation Design Audit

Date: 2026-03-17

## Scope

- `application_message` only
- ChatGPT path first
- generation-first / artifact-contract audit
- no provider, routing, parser, or model redesign

## Active code reviewed

- `my-app/convex/generateProposalMutation.ts`
- `my-app/convex/lib/proposals/proposalPlanner.ts`
- `my-app/convex/lib/proposals/proposalRenderer.ts`
- `my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
- `my-app/convex/lib/proposals/__tests__/proposalProviderBusy.test.ts`

## Reviewed artifacts

- `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/raw/application-strong-support__gpt-4o-mini.json`
- `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/raw/application-adjacent-admin__gpt-4o-mini.json`
- `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/raw/application-no-context-support__gpt-4o-mini.json`

Representative reviewed output shapes:

- `I am excited to apply ...`
- `I believe my experience aligns well with your needs ...`
- `I am eager to bring my strengths ...`
- `Thank you for considering my application.`

## Findings

1. The active inline `application_message` artifact definition had improved, but the prompt was still being fed a broad résumé-style candidate block.
   - Active personalization shaping still exposed:
     - name
     - professional summary
     - target role / headline
     - core skills
     - recent experience
     - standout achievements
   - That is a good general personalization block, but it is too résumé-summary-friendly for a short recruiter note.

2. The active ChatGPT path does not use the planner to narrow candidate facts for `application_message`.
   - The planner exists and can produce `allowed_concrete_facts` plus evidence ordering, but the active ChatGPT `application_message` route still sends the inline prompt directly to `GPT4Adapter.generate(...)`.
   - That means the generation path needed its own narrow candidate-side shaping rather than another broad prompt rewrite.

3. Employer-side shaping was no longer the main gap.
   - The newer `Application-message employer priority snapshot` already gave the model ranked employer-side work surfaces and checklist demotion.
   - The bigger remaining issue was that candidate-side input still looked like a mini résumé pack.

4. The smallest generation-first move was to narrow candidate-side input to a message-native evidence snapshot.
   - One strongest proof point, at most two.
   - One supporting scope/background overlap.
   - Secondary profile signals demoted to non-leading status only.

## Fix implemented

1. Added `Application-message candidate priority snapshot`.
   - `strongest_candidate_proof`
   - `supported_scope_or_background`
   - `secondary_profile_signals_nonleading`

2. Added compact usage rules to the new block.
   - Treat strongest proof as the candidate-side priority order.
   - Build the note around one strongest proof when available.
   - Use scope/background only to sharpen that proof or add one cautious second angle.
   - Use secondary profile signals only if stronger proof is unavailable, never as a summary opener or skills list.

3. Preserved the employer-priority snapshot.
   - The new candidate snapshot is meant to work with the existing employer snapshot, not replace it.

4. Added one positive artifact cue.
   - The prompt now says a strong version should feel like a quick note that gives the recruiter a concrete reason to click, reply, or keep reading, not a condensed résumé paragraph.

## Why this was the smallest justified move

- No provider change
- No routing change
- No planner migration into ChatGPT application messages
- No parser change
- No new repair layer
- No heavier cleanup
- Preserves current runtime stability while making the generation input more message-native

## Validation

Ran from `my-app/` root:

```bash
npx vitest run convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalRenderer.test.ts convex/lib/proposals/__tests__/proposalProviderBusy.test.ts
```

Result:

- `137` tests passed

