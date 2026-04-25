# PR4B User Output Results Audit

Date: 2026-03-14

## Scope

- Audit the user-provided proposal outputs and runtime errors from March 14, 2026.
- Classify failures against the active legacy finalization and enforcement logic.
- Do not change prompts, rollout, or validators in this audit.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/lib/proposals/proposalEnforcement.ts`
  - `my-app/convex/lib/proposals/voicePresets.ts`
- User-provided runtime evidence
  - Sadath Basha electrical-design outputs across `expert`, `direct`, `engaging`, `storyteller`, `signature`
  - no-CV outputs across `expert`, `direct`, `engaging`, `signature`
  - Robert Cooper security outputs across `engaging`, `signature`, `expert`, `direct`, `application_message`
- Uncertainty
  - the exact source-backed fact set for Sadath and Robert was not provided in this thread
  - any finding about unsupported concrete claims is therefore conditional unless the claim is visibly malformed on its own

## Findings

### 1. High: legacy finalization is still producing false-negative hard failures across presets

Observed user evidence:

- `engaging cv` failed closed
- `signature cv` failed closed in at least one run
- `expert nocv` failed closed in one run
- `direct nocv` failed closed
- `engaging nocv` failed closed

Runtime error:

- `Proposal generation failed closed during finalization. Attempted path: legacy-only path. Final result: fail-closed final result. Reason: Cleanup removed all substantive body content for cover_letter.`

Why this matters:

- this is not a schema problem anymore
- this is an active false-negative generation defect
- the failure happens before persistence, inside the legacy cleanup/body-selection path

Relevant code:

- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2669) selects a cleaned body candidate and throws when both aggressive and conservative candidates collapse
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2714) emits the exact `Cleanup removed all substantive body content` failure
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L3187) uses that selection logic in `finalizeProposalForSave(...)`

Assessment:

- this remains the primary active blocker
- preset stability is inconsistent, not uniformly degraded

### 2. High: at least one output is an empty-shell or near-empty cover letter, which should fail closed instead of surfacing as a result

Observed user evidence:

- `storyteller cv` surfaced as only:
  - `Dear Hiring Manager,`
- one `Signature` no-context result ended with:
  - `Sincerely,`
  - with no candidate-name line and almost no substantive body value beyond generic motivation

Why this matters:

- a greeting-only or greeting-plus-empty-shell result is explicitly the class of output the finalizer is supposed to reject
- if this text was actually surfaced as a completed output, then the enforcement behavior is inconsistent

Relevant code and test coverage:

- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2719) asserts final saved output still has substantive body content
- [proposalWriterPrompt.test.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts#L708) already expects empty-shell cover letters to throw fail-closed

Assessment:

- if the pasted `storyteller cv` is the full returned artifact, this is a real regression against the intended fail-closed behavior
- if it is only a truncated UI preview, then it is a presentation bug rather than a generator bug

### 3. Medium: malformed sentence fragments are leaking through saved CV outputs

Observed user evidence:

- Robert Cooper `signature cv` contains:
  - `Introduced inventive loss prevention techniques by installing an X-ray scanning system at every entrance and….`

Why this matters:

- this is not just weak prose
- it is a broken clause with truncation residue that degrades both credibility and downstream cleanup

Relevant code:

- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L330) already tracks malformed fragment warnings in the structured source-fact warning set

Assessment:

- this output should not be considered acceptable even if the underlying facts are source-backed
- the failure mode looks like truncation or partial cleanup rather than a simple tone issue

### 4. Medium: soft transfer-bridge language is still appearing in outputs that the final saved-output guard is designed to neutralize

Observed user evidence:

- Sadath `direct cv`:
  - `Experience with preventive actions and internal audits aligns with the need for precise documentation and stakeholder coordination...`
- Sadath `signature cv`:
  - `...may offer relevant experience for electrical design roles.`
- Sadath no-CV `expert`:
  - `...presents a structured environment where attention to detail and adherence to project requirements are critical.`

Why this matters:

- the active cleanup path is supposed to strip or neutralize soft bridge language such as:
  - `aligns with`
  - `may offer relevant perspective`
  - other support/contribution/readiness bridges

Relevant code:

- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L2958) marks soft-bridge sentences for final saved-output cleanup
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L3016) specifically neutralizes `may offer relevant perspective`
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L3081) applies the final saved-output bridge guard

Assessment:

- if the pasted text is the final persisted output, the bridge guard is not consistently neutralizing these sentences
- the `may offer relevant experience/perspective` pattern is especially notable because the cleanup path explicitly knows about it

### 5. Medium: some concrete claims may be source-backing violations, but that cannot be closed from the pasted text alone

Observed user evidence:

- Robert Cooper `engaging cv`:
  - `access control also led to a 26% reduction in unauthorized entry`
- Robert Cooper `signature cv`:
  - `X-ray scanning system at every entrance`
- Robert Cooper `expert cv`:
  - `criminal justice knowledge and troubleshooting`

Why this matters:

- the active rules require exact concrete details to be source-backed
- the system must not upgrade nearby detail into stronger expertise or operational claims unless supported

Relevant code:

- [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L48) requires source-backed specificity
- [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L56) forbids treating JD-only facts as candidate history
- [proposalEnforcement.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalEnforcement.ts#L1555) flags unsupported achievement impact
- [proposalEnforcement.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalEnforcement.ts#L1571) flags unsupported readiness bridges

Assessment:

- these are conditional findings
- if those facts are present verbatim in the candidate background, they are acceptable
- if not, they are active enforcement misses

## Per-Output Triage

### Sadath CV-backed electrical-design outputs

- `expert cv`
  - structurally acceptable
  - likely the cleanest of the Sadath outputs shown
  - still somewhat generic for `expert`
- `direct cv`
  - usable, but bridge-heavy
  - better factual density than `expert`
- `engaging cv`
  - failed closed
  - active blocker
- `storyteller cv`
  - appears broken or truncated
  - unacceptable if this is the full returned output
- `signature cv`
  - unstable across runs
  - one variant failed closed
  - another variant leaked soft transfer language

### No-CV electrical-design outputs

- `expert nocv`
  - generic but broadly aligned with no-context restrictions when it saves
  - unstable because the same preset also failed closed in another run
- `direct nocv`
  - failed closed
- `engaging nocv`
  - failed closed
- `signature` no-context variant
  - weak but syntactically complete in one run
  - still close to empty-shell territory

### Robert Cooper CV-backed security outputs

- `engaging cv`
  - strongest readable output among the security examples
  - needs source-backing confirmation for the `26% unauthorized entry` claim
- `signature cv`
  - unacceptable as shown because of the malformed `and….` fragment
- `expert cv`
  - concise and structurally sound
  - source-backing check still needed for the exact proof claims
- `direct cv`
  - compact and likely the best controlled security output shown
- `application_message`
  - good format match
  - concise and fit for purpose

## Conclusion

The outputs show three separate classes of problem:

1. false negatives
   - valid-enough drafts are still being destroyed by legacy cleanup and failing closed
2. false positives
   - some saved outputs still contain soft transfer bridges or possibly unsupported exact claims
3. malformed survivors
   - at least one saved security output contains a visibly broken sentence fragment

The current highest-signal next pass is not prompt tuning. It is legacy finalization/content-cleanup stabilization, with special focus on:

- preset-specific body collapse in CV and no-CV cover letters
- why bridge-neutralization is inconsistent across saved outputs
- why malformed fragments can still survive in a supposedly finalized artifact
