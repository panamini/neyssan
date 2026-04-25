# Application Message Job-Offer Priority Audit

Date: 2026-03-17

## Scope

- `application_message` only
- ChatGPT path first
- verify whether the active path benefits from the newer job-offer analysis / prioritization layer already introduced for premium `cover_letter`
- no `cover_letter` migration
- no routing, provider, parser, or model redesign

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/lib/proposals/premiumCoverLetter.ts`
  - `my-app/convex/lib/proposals/proposalPlanner.ts`
  - `my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
  - `my-app/convex/lib/proposals/__tests__/proposalProviderBusy.test.ts`
- Active but illustrative artifacts
  - `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/raw/application-strong-support__gpt-4o-mini.json`
  - `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/raw/application-adjacent-admin__gpt-4o-mini.json`
  - `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/raw/application-no-context-support__gpt-4o-mini.json`
- Legacy but informative
  - prior audit notes under `my-app/docs/audits/` about premium cover-letter offer prioritization and earlier application-message prompt work

## Findings

1. Before this change, the active ChatGPT `application_message` path did not use the newer employer/job-offer prioritization helper.
   - `handleGenerateProposal(...)` built the ChatGPT prompt through `buildInlineMistralPrompt(...)` and sent it straight to `GPT4Adapter.generate(...)`.
   - That prompt only carried flat `Job description: ...` text plus generic message constraints.
   - It did not call `buildJobOfferPriorityPack(...)`.
   - It did not pass `topResponsibilities`, `keyRequirements`, `preferredQualifications`, `lowValueChecklist`, `workContext`, or any equivalent ranked employer-side structure.

2. Premium `cover_letter` already had the richer employer-priority layer.
   - `premiumCoverLetter.ts` builds `buildJobOfferPriorityPack(jobDescription)`.
   - That helper separates:
     - `coreResponsibilities`
     - `keyRequirements`
     - `preferredQualifications`
     - `lowValueChecklist`
     - `companyFluff`
     - `priorityTokens`
   - The premium brief then carries employer-side structure such as `topResponsibilities`, `keyRequirements`, `lowValueChecklist`, and `workContext`.

3. The active ChatGPT `application_message` path therefore lagged behind premium `cover_letter` on employer-side input shape, not only on style.
   - This was a real wiring/input gap, not just a naming difference.
   - Generic raw job-text injection was not equivalent to the richer prioritization layer.

4. The visible output failures were consistent with that flatter input shape.
   - Reviewed ChatGPT artifacts included patterns like:
     - `I am excited to apply ...`
     - `I believe my experience aligns well with your needs ...`
     - `Thank you for considering my application.`
   - Those outputs read like mini cover letters or generic profile blurbs, with weak employer-side prioritization and weak demotion of checklist noise.

## Failure Classification

- Routing/wiring issue
  - `application_message` did not consume the newer job-offer prioritization helper at all.
- Prompt/body-contract issue
  - the prompt had message-format rules, but employer-side priorities were still flattened into raw job text.
- Not a parser/output-shape issue
  - no output-schema failure was involved.
- Not a provider redesign issue
  - the active ChatGPT route was already correct for scope; the missing piece was employer-priority input.

## Narrow Fix Implemented

- Reused the existing premium helper `buildJobOfferPriorityPack(...)`.
- Added a compact `Application-message employer priority snapshot` block to the shared inline writer prompt.
- The new block passes:
  - `strongest_work_surfaces`
  - `key_requirements`
  - `preferred_requirements_nonleading`
  - `lower_value_checklist_demoted`
  - `low_signal_employer_text_ignore`
- The block also adds compact usage rules:
  - treat strongest work surfaces as the employer-side priority order
  - use key requirements only to sharpen those work surfaces or a supported proof point
  - do not lead with preferred/checklist/fluff items when stronger work surfaces exist
  - mention one or two strongest work surfaces instead of flattening the posting into a checklist summary

## Why This Was The Smallest Justified Move

- no architecture migration
- no premium cover-letter brief adoption
- no model or provider changes
- no parser changes
- no routing/fallback changes
- direct reuse of already-shipped employer-priority logic
- the active ChatGPT path now receives meaningful structured employer-side priorities while staying a short recruiter-facing message path

## Validation

- Added prompt-contract coverage proving the application-message prompt now contains the structured employer-priority snapshot and checklist demotion guidance.
- Added ChatGPT routing coverage proving the active `application_message` path passes that new structured block into `GPT4Adapter.generate(...)`.
- Targeted test run:
  - `npx vitest run convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalProviderBusy.test.ts convex/lib/proposals/__tests__/premiumCoverLetter.test.ts`

## Conclusion

- `application_message` did not meaningfully benefit from the newer job-offer prioritization layer before this patch.
- Premium `cover_letter` did; `application_message` did not.
- The main issue was mixed, but led by missing job-offer-derived input on top of a still-flat prompt contract.
- The implemented change is the smallest high-leverage reuse that closes that input gap without turning `application_message` into premium `cover_letter`.
