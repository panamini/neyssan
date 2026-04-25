# PR4B March 15 Output Audit

Date: 2026-03-15

## Scope

- Audit the user-provided proposal outputs and runtime errors from March 15, 2026.
- Classify the current failures and weak survivors against the active legacy finalization baseline.
- Identify the next narrow pass without reopening schema, read-path, rollout, or prompt work.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/lib/proposals/proposalEnforcement.ts`
  - `my-app/convex/lib/proposals/voicePresets.ts`
- User-provided runtime evidence
  - `signature`, `expert`, `direct`, `engaging`, `storyteller` no-CV security outputs
  - `storyteller` distant-job CV fail-closed
  - `signature` CV fail-closed
- Reproduced against active helpers
  - `inspectProposalFinalization(...)` on the pasted texts
- Uncertainty
  - the exact live generated text for the fail-closed `storyteller` and `signature` CV runs was not available beyond the runtime error, so shell-style repro text was used only to classify the current collapse behavior

## Findings

### 1. High: the remaining fail-closed cases now look like true shell outputs, not another false-negative cleanup regression

Observed user evidence:

- `storyteller no cv`
  - fail-closed
- `storyteller cv` for a distant job
  - fail-closed
- `signature cv`
  - fail-closed

Runtime error:

- `Proposal generation failed closed during finalization. Attempted path: legacy-only path. Final result: fail-closed final result. Reason: Cleanup removed all substantive body content for cover_letter.`

Active-code interpretation:

- the current legacy finalizer still fails at `cleaned_body_selection` when both aggressive and conservative candidates have no saveable body
- that is the expected behavior for greeting-plus-shell or interest-only drafts

Relevant code:

- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2680) defines cover-letter saveability
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2815) throws when neither cleaned candidate is saveable
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L3409) still routes through the same finalization path

Assessment:

- this is no longer the same class as the earlier persistence or false-negative schema issue
- these failures should not be fixed by loosening the finalization floor
- if those presets should save more often, that is now an upstream generation/repair problem, not a persistence problem

### 2. High: several no-CV outputs are saving, but they are still weak survivors that rely on permissive legacy-thin saveability

Observed user evidence:

- `signature no cv`
  - saved
  - contains:
    - `aligns with my understanding of the responsibilities involved...`
    - `The rotating schedule and PRN flexibility also align with my availability.`
- `direct no cv`
  - saved
  - starts with:
    - `The role at Ascension St. Vincent’s Riverside Hospital.`
- `engaging no cv`
  - saved
  - still includes:
    - `The day-to-day work itself is the part of the role that stands out to me most.`
    - `...opportunity to develop skills in threat monitoring...`

Active-code interpretation:

- these outputs pass because the current `legacy_thin` no-context floor only requires:
  - at least two saveable sentences
  - at least one work-surface sentence
- the local opener trimmer is intentionally narrow and only trims the first low-value lead sentence when the remainder is still saveable

Relevant code:

- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2244) current low-value no-context lead patterns
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2503) current low-value no-context lead classifier
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2707) `legacy_thin` no-context saveability rule
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2739) guarded low-value no-context lead trimming

Assessment:

- the current pass improved stability, but it did not yet clean all weak no-CV survivors
- this is now the main quality problem in the no-CV path
- the next pass should stay local and repair-first rather than reject-first

### 3. Medium: no-CV phrasing is still drifting into role-understanding and soft future-learning language that the no-context rules are trying to avoid

Observed user evidence:

- `signature no cv`
  - `aligns with my understanding of the responsibilities involved...`
- `engaging no cv`
  - `...opportunity to develop skills in threat monitoring...`
- `expert no cv`
  - `...reflect a commitment to maintaining secure and orderly environments.`

Why this matters:

- these are not as severe as fabricated candidate history
- but they are still a weak fit for the intended no-context policy: modest, motivation-based, non-claiming, and not operationally suggestive

Relevant code:

- [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L66) no-context candidate-claim rules
- [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L71) specifically warns against soft acquired-practice language in no-context mode

Assessment:

- the current outputs are mostly below the policy ceiling rather than above it
- a narrow sentence-level cleanup pass can improve them without materially increasing fail-closed behavior

### 4. Medium: the new opener trimmer is helping, but it is still too literal for some real weak-opener shapes

Observed user evidence:

- `direct no cv`
  - `The role at Ascension St. Vincent’s Riverside Hospital.`
- `signature no cv`
  - the weak schedule/flexibility sentence survives because it is not the first removable lead and trimming is intentionally guarded

Relevant code:

- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2244) does not currently include patterns like `The role at ...` or `The security role at ...`
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2739) trims only the first low-value lead sentence

Assessment:

- this is a narrow cleanup gap
- it should be fixed locally, not by changing acceptance floors

## Case Classification

- `signature no cv`
  - `saved`
  - quality: weak survivor
  - main issues:
    - soft role-understanding wording
    - schedule/flexibility sentence retained
- `expert no cv`
  - `saved`
  - quality: acceptable but generic
  - main issue:
    - JD-summary-heavy and low-specificity
- `direct no cv`
  - `saved`
  - quality: weak survivor
  - main issue:
    - role-title fragment still survives
- `engaging no cv`
  - `saved`
  - quality: acceptable but still padded
  - main issue:
    - generic day-to-day / future-learning phrasing
- `storyteller no cv`
  - `fail_closed`
  - stage:
    - `cleaned_body_selection`
- `storyteller cv` distant job
  - `fail_closed`
  - stage:
    - `cleaned_body_selection`
- `signature cv`
  - `fail_closed`
  - stage:
    - `cleaned_body_selection`

## Conclusion

The current state is better separated than before:

1. the remaining fail-closed cases are mostly true shell outputs
2. the main live quality issue is now weak no-CV survivors that still pass the permissive legacy-thin floor
3. the next pass should stay local, repair-first, and no-CV-focused

## Recommended Next Pass

Use a narrow no-CV cleanup pass, not a broader claim-enforcement or floor-loosening pass.

Target only:

- expand low-value opener trimming to catch:
  - `The role at ...`
  - `The security role at ...`
  - similar role-title-only lead fragments
- add one more local no-CV sentence cleanup for weak saved survivors:
  - soft role-understanding phrases such as `aligns with my understanding of ...`
  - schedule / flexibility padding when a stronger surviving body remains
  - low-value future-learning phrases such as `opportunity to develop skills in ...` when they are not carrying saveability
- keep current fail-closed behavior for true shell drafts

Explicitly do not do this next:

- no prompt rewrite
- no rollout change
- no schema or read-path work
- no acceptance-floor loosening
- no broad verifier-policy redesign
- no attempt to force `storyteller` / `signature` shell drafts to save by lowering the finalization bar
