# Proposal Generation Results Audit Round 3

Date: 2026-03-13

## Scope

- Audit only.
- Active focus:
  - backend planner -> writer proposal generation path
  - Proposal Forge active CV state
  - Proposal Forge compose draft persistence
- Out of scope for this audit:
  - auth redesign
  - scraping redesign
  - CV ingestion/parser redesign
  - extension behavior redesign
  - model/provider changes

## Code Classification

- Active code
  - [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts)
  - [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts)
  - [proposalOutput.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalOutput.ts)
  - [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts)
  - [proposal-personalization.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/lib/proposal-personalization.ts)
  - [ProposalInputForm.tsx](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/components/ProposalInputForm.tsx)
  - [ProposalForge.tsx](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/pages/ProposalForge.tsx)
  - [CvLibraryContext.tsx](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/contexts/CvLibraryContext.tsx)
- Legacy but informative code
  - older LangChain prompt paths under `convex/langchain/`
- Obsolete/dead by default for this issue
  - `pdf-ingest/`
  - `*.bak`
  - archive/backup component trees

## Verdict

The system is better than before, but it is still not good enough.

The remaining issues fall into two separate buckets:

1. backend generation quality still has a few hard failures
2. Proposal Forge state management has real UX/state bugs that are independent from the generation stack

These should be fixed separately. Mixing them together will make debugging slower.

## Findings

### 1. No-context generation is still not safe enough

Observed behavior:

- no-context outputs still produce forbidden negative-history disclaimers such as:
  - "While I may not have direct experience..."
- no-context outputs still produce pseudo-capability language such as:
  - "I understand the importance of..."
  - "my ability to ... would allow me to ..."
  - tool/process familiarity language that reads like soft experience

Impact:

- This is still a factual-safety failure.
- It is lower-severity than the earlier stale-profile leak, but it still breaks product trust because the prose implies background that is not actually present.

Likely active-code cause:

- The writer contract is stronger than before, but it still leaves enough prose freedom for "honest-sounding" unsupported capability language.
- The no-context rules are present in [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L442) and the planner contract is present in [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L461), but the final writer prompt still relies on instruction obedience alone.

Conclusion:

- The next fix should not be more architecture.
- It should be a tighter writer obedience layer for `context_mode = none`, ideally with explicit forbidden phrasing and a narrow retry/repair path if the generated draft violates the no-context contract.

### 2. English/French language control is not reliable enough

Observed behavior:

- An English FTS security job produced French output.

This is not just a vague model drift issue. There is an active deterministic bug in the language resolver:

- [proposalOutput.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalOutput.ts#L117) immediately returns French if any French diacritic exists anywhere in the job description.
- The pasted English FTS job description contains the word `résumé`, which is enough to trigger French.

Impact:

- Any mostly-English job post containing one accented French token can flip the entire output language to French.
- This is especially risky for copied LinkedIn/job-board text where duplicated blocks or localized apply lines may include isolated foreign-language tokens.

Conclusion:

- This is an active-code bug, not just an LLM consistency problem.
- The language resolver should use a stronger document-level heuristic instead of a single-diacritic hard switch.

### 3. Same-domain outputs still inflate nearby unsupported details

Observed behavior:

- The same-domain security letters are stronger overall, but they still add or sharpen details that are not clearly source-backed:
  - `visitor documentation`
  - precise system/task phrasing imported from the JD
  - employer-like naming such as `Robert Cooper Security Guard` when the CV source does not clearly support that exact employer name

Likely active-code cause:

- The planner fact bank in [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L295) is still built from fairly coarse summary/highlight strings.
- The writer then uses those facts plus the JD and can still sharpen them into slightly more specific operational claims.

Conclusion:

- The remaining issue is not "too much specificity."
- It is fidelity at the exact claim level.
- The next improvement should tighten fact typing and claim fidelity, not remove real detail.

### 4. Adjacent-domain transfer is still too literal

Observed behavior:

- For Veterans Service Officer, the output no longer hallucinates veteran status, which is a real improvement.
- But it still over-translates security/compliance evidence into public-service / veterans-benefits-role readiness too literally.

Impact:

- This creates credibility problems even when the output avoids outright fabrication.
- The letter sounds like it is forcing task equivalence instead of honestly presenting transferable capability.

Likely active-code cause:

- The planner already distinguishes `direct | adjacent | distant` and `literal | abstract_only | no_operational_analogy` in [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L74) and normalizes adjacent/distant behavior in [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L416).
- The remaining failure is writer obedience: the writer still turns abstract transfer into role-specific readiness language too easily.

Conclusion:

- The next fix should tighten adjacent/distant writer language:
  - abstract transferable capability is allowed
  - direct task-to-task analogy is not

### 5. Credential-fit and qualification language are still too loose

Observed behavior:

- Security outputs still drift toward "fit for the requirement" even when the exact required credential is not clearly present.
- Adjacent-domain outputs still risk turning related background or in-progress education into stronger qualification language than the source supports.

Likely active-code cause:

- The planner has the correct enum:
  - `exact_required`
  - `related_not_equivalent`
  - `in_progress_only`
  - `unsupported`
- But the writer still treats these more like guidance than a hard lexical boundary.

Conclusion:

- The next pass should add exact phrase-level blocking for credential inflation and completed-vs-in-progress drift.

### 6. Proposal Forge CV title state is stale after rename

Observed behavior:

- Renaming a CV does not immediately update the title shown in Proposal Forge.

Likely active-code cause:

- [proposal-personalization.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/lib/proposal-personalization.ts#L549) prefers `getStoredDocumentById(id)` over the fresher library doc.
- [CvLibraryContext.tsx](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/contexts/CvLibraryContext.tsx#L2230) updates in-memory `cvs` and `currentCv` title on rename, but does not immediately reconcile the per-document local-storage copy that Proposal Forge later reads.

Impact:

- Proposal Forge can display stale CV titles even after the user has renamed the document successfully.

Conclusion:

- This is a small active-state bug.
- The smallest fix is either:
  - prefer the fresher library/current title over the cached stored-document title for picker display
  - or update the cached stored-document title at rename time

### 7. Proposal Forge has no explicit "clear current CV" control

Observed behavior:

- There is no visible button to clear the currently loaded CV and return to no-CV mode.

Active-code context:

- There is already a helper for clearing the active local CV id in [proposal-personalization.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/lib/proposal-personalization.ts#L598).
- Proposal Forge already clears shared active CV snapshot state when no title is resolved in [ProposalInputForm.tsx](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/components/ProposalInputForm.tsx#L102).
- The missing piece is just a small user-facing control.

Conclusion:

- This is a compact Proposal Forge UX/state fix, not a generation architecture issue.

### 8. Proposal Forge compose draft is not persisted across navigation

Observed behavior:

- Switching between Proposal Forge and CV Forge loses:
  - job title
  - job description

Likely active-code cause:

- [ProposalForge.tsx](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/pages/ProposalForge.tsx#L27) only keeps generated proposal content and active view in page-level React state.
- [ProposalInputForm.tsx](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/components/ProposalInputForm.tsx#L126) uses form default values but does not persist the draft to storage or restore it on mount.

Impact:

- This is a genuine workflow regression for extension -> Proposal Forge usage because the job offer must be reloaded if the user visits CV Forge mid-flow.

Conclusion:

- This should be fixed separately from prompt tuning.
- The smallest fix is local compose-draft persistence keyed to Proposal Forge.

## Root Cause Summary

The remaining product issues are not one thing.

- Backend generation quality has plateaued because the writer still has too much freedom after planning, especially in:
  - no-context mode
  - adjacent/distant transfer
  - credential-sensitive wording
  - language obedience
- Proposal Forge also has two distinct state bugs:
  - stale CV title source-of-truth after rename
  - no compose-draft persistence across navigation

## Smallest Safe Resolution Plan

### Track A — Backend generation hardening

1. Tighten writer obedience for `context_mode = none`
   - treat forbidden no-context phrasing as hard-invalid output, not soft guidance
   - explicitly ban:
     - "while I may not have direct experience"
     - "while I am new to the field"
     - "my ability to ... would allow me to ..."
     - soft familiarity language around tools/systems when no context exists
   - if needed, do one narrow backend-only repair/retry when the generated draft violates these banned patterns

2. Tighten adjacent/distant transfer behavior
   - for `adjacent`, concrete facts may support only abstract transferable themes
   - for `distant`, prohibit literal task analogies entirely
   - especially block:
     - security monitoring -> VA claims handling readiness
     - compliance/documentation -> direct public-service practice

3. Tighten exact claim fidelity
   - stop the writer from inventing sharpened operational details that are not in `allowed_concrete_facts`
   - add phrase-level blocking for:
     - exact required credential inflation
     - completed degree inflation
     - employer name synthesis that is not explicitly source-backed

4. Fix output-language resolution
   - replace the current single-diacritic hard switch with a document-level decision rule
   - recommended smallest rule:
     - only force French from diacritics if French marker density also crosses a threshold
     - otherwise fall back to marker balance / planner-selected language
   - add regression cases for:
     - English JD with one French token like `résumé`
     - French JD
     - mixed-language JD

### Track B — Proposal Forge state fixes

1. Fix CV picker title source-of-truth
   - Proposal Forge should not prefer stale `cv:${id}` cache title over fresher library/current state
   - smallest safe fix:
     - prefer library/current title when available
     - or update cached stored-doc title during rename

2. Add a "Clear loaded CV" control in Proposal Forge
   - use existing local/shared clear helpers
   - return to true no-CV mode explicitly

3. Persist Proposal Forge compose draft locally
   - persist:
     - jobTitle
     - jobDescription
     - proposalType
   - restore on mount
   - clear only on explicit reset or when a new imported handoff intentionally replaces the draft

## Recommended Execution Order

1. backend language resolver + no-context obedience
2. backend adjacent/distant transfer + credential-fidelity tightening
3. Proposal Forge stale CV title + clear-current-CV control
4. Proposal Forge draft persistence

## Why This Order

- The English -> French failure and no-context pseudo-history are current trust breakers.
- The Proposal Forge state bugs are real but operationally separate and safer to fix after the backend output contract is stable.

