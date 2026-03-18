# Proposal Generation Output Audit And Improvement Plan

Date: 2026-03-13
Scope: Active backend proposal generation path only.

## Classification

- Active code:
  - [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts)
  - [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts)
  - [proposal-personalization.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/lib/proposal-personalization.ts)
- Legacy but informative:
  - Older LangChain prompt code is not the main cause of the outputs reviewed here, which are coming from the active Mistral path.
- Obsolete/dead code:
  - Not used for this audit.

## Verdict

The system is better than it was, but it is still not good enough.

Three things are now true at the same time:

1. The preset architecture is correct.
2. Source-backed specificity is often preserved better than before.
3. The generator still fails in two important ways:
   - the true no-context branch still leaks invented history or implied familiarity
   - adjacent-domain role changes still over-translate valid source facts into implausible target-role claims

The result is a product that is directionally strong on matched roles but still unreliable on blank-context and distant-transfer cases.

## What The Current Outputs Show

## 1. No-context behavior is still not safe enough

The strongest no-CV sample is the `signature` output. It is relatively modest and no longer leaks stale identity. But the no-context set still shows policy failures:

- `expert` still uses a forbidden invented negative-history disclaimer:
  - `While I may not have direct security experience`
- `direct` still uses the same pattern:
  - `While I may not have direct security experience`
- `engaging` still uses another forbidden negative-history pattern:
  - `While I'm new to formal security work`
- `direct` also claims willingness to obtain required certifications, which is acceptable only as forward-looking intent, but it sits beside other unsupported pseudo-history and makes the branch feel unstable.

More importantly, even when no explicit fake past job is stated, the no-context outputs still imply candidate capability in a way that reads like softened experience:

- `prepared to take on the responsibilities`
- `prepared to apply these qualities to patrol duties, access control, and incident response`
- `my background in security and customer service aligns well`

Those statements are still too close to JD-to-candidate rewriting when the candidate context is empty.

### Conclusion

The no-context branch is no longer catastrophically leaking stale profile data, but it is still not operating in a truly non-claiming mode. It needs a harder rhetorical boundary.

## 2. Matched-role CV-backed outputs are mostly credible, but still drift at the edges

The Cobra Shield security-role set is materially better than earlier versions:

- `signature` remains the healthiest baseline.
- `expert` is strong and evidence-led.
- `engaging` is warmer.
- `storyteller` is somewhat smoother.

However, there are still concrete product issues:

- `direct` is still too generic in its opening:
  - `I am writing to express my interest`
- `engaging` is still too template-like:
  - `What excites me about this opportunity`
- `storyteller` still does not create enough visible trajectory logic. It is still mostly "intro + proof + close" with a softer first sentence.

There is also a more important factual-quality issue:

- `signature` says `I hold a valid security certification`
- `expert` says `I hold the necessary security certification to meet New York state requirements`

The CV does show security-related certifications:

- Certified Protection Guard Program (CPOP)
- Security Guard Certificate Program (SOCP)
- S.A.F.E. Approach Level II Training

But it does not clearly prove the exact regulatory credential required for a New York security-guard role. The current outputs collapse `related security certifications` into `the required certification`. That is a credential-fit overclaim.

### Conclusion

On direct domain matches, the model is now good at preserving source-backed proof points, but it still needs stronger rules around exact credential matching and less generic preset openings.

## 3. Adjacent-domain transfer is still the biggest product weakness

The Veterans Service Officer example is better than the earlier, clearly fabricated `As a veteran` failure. The explicit veteran-status hallucination is gone in the sample reviewed here.

But the output is still not good enough because it performs an implausible transfer:

- it turns hotel theft reduction and CCTV installation into something that `would translate well to tracking and submitting VA benefit claims`

That is not a pure hallucination in the narrow sense. It is a bad transfer strategy.

The system is preserving real source facts, but it is mapping them to the target role at the wrong abstraction level.

For this kind of role change, the generator should abstract upward:

- documentation discipline
- procedural accuracy
- confidentiality
- case handling discipline
- client communication
- regulated-process reliability

Instead, it is making near-operational analogies between physical security activity and veterans-benefits administration. That produces letters that are technically grounded in source facts but still feel false to a reader.

### Conclusion

The product now has a second-order failure mode:

- not fabricated facts
- but fabricated transfer logic

That is a credibility problem even when strict hallucination guardrails hold.

## Root Causes In Active Code

## 1. The no-context rules are present, but the base cover-letter prompt still encourages self-positioning

Active code:

- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L433)
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L598)

The no-context block already says:

- no prior experience
- no tool familiarity
- no JD inference

But the cover-letter base prompt still asks the model to:

- open naturally and specifically
- show interest in role and organization
- sound credible and human

That is reasonable in general, but in no-context mode it still nudges the model toward self-positioning rhetoric. Mistral then fills that space with:

- pseudo-honest disclaimers
- soft ability claims
- JD-flavored role familiarity

This is a contradiction problem more than a missing-instruction problem.

## 2. The prompt has strong factual guardrails, but weak transfer-distance rules

Active code:

- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L523)
- [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L48)
- [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L56)
- [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L61)

The active prompt now does a good job separating:

- source-backed specificity
- unsupported claims
- JD-only facts
- identity/background inference

But it still does not explicitly classify role transfer distance.

That means the model has no explicit instruction for when to:

- keep direct role-to-role evidence concrete
- abstract to transferable process traits
- stop making operational analogies altogether

Without that, the same proof-point behavior is used for:

- direct role matches
- adjacent role matches
- distant role changes

That is why the Veterans Service Officer example still feels wrong even though the raw facts are source-backed.

## 3. Candidate facts are still represented as plain text, not support-typed facts

Active code:

- [proposal-personalization.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/lib/proposal-personalization.ts#L388)
- [proposal-personalization.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/lib/proposal-personalization.ts#L391)
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L391)

The active personalization payload is mostly:

- summary
- topSkills
- recentExperience
- standoutAchievements

That is workable, but it does not encode support semantics such as:

- identity/status facts
- credential exactness
- education status: in progress vs completed
- domain exposure vs direct domain practice
- related certification vs exact required license

So the model sees:

- `military and defense sectors`
- `Presently finishing a bachelor's in criminal justice`
- security certificates

and can still over-normalize them into:

- veteran status
- military service
- completed degree
- exact license match
- public-service fit

The prompt is trying to suppress that after the fact, but the underlying context shape still encourages ambiguity.

## 4. Preset differentiation is now mainly an opening-and-transition problem

Active code:

- [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L115)
- [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L127)
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L481)
- [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L517)

The overlay structure is fine.

The remaining issue is that:

- `engaging` still falls back to stock warmth language
- `storyteller` still does not consistently enforce trajectory logic paragraph-to-paragraph
- `direct` still slides back toward standard cover-letter pacing after the opening

This is no longer a catalog problem. It is a local rhetoric-control problem.

## Why The System Is Not Good Enough Yet

It is not enough for the generator to avoid obvious hallucinations.

The product promise here is stronger:

- preserve real CV-backed detail
- adapt it intelligently to the target job
- stay human and convincing
- avoid unsupported inference

Right now, the system is good at the first and partially good at the fourth.
It is still weak at the second.

The current quality bar is not met because:

1. Blank-context outputs still imply too much candidate background.
2. Credential exactness is still not handled carefully enough.
3. Adjacent-domain transfer logic is still too literal and too eager.
4. `engaging` and `storyteller` still converge toward generic cover-letter rhetoric.

## Best Next Improvements

## Tier 1: Smallest safe prompt improvements

This stays fully inside the current architecture.

### 1. Harden no-context rhetoric further

Do not only ban fake history. Also ban soft implied competence statements in no-context mode unless they are framed as intent or role understanding.

Examples to block in no-context mode:

- `I have developed strong observational skills`
- `my background aligns well`
- `I am prepared to take on access control and incident response`
- `my ability to remain calm under pressure would allow me to`

Preferred no-context mode:

- grounded motivation
- understanding of the role
- professionalism
- willingness to learn
- schedule flexibility only if explicitly provided

### 2. Add an exact credential-fit rule

New shared rule:

- if the candidate has related certifications or training but not the exact required license/credential, do not claim they already hold the requirement
- instead say they have related training/certification or are prepared to meet role requirements if that is appropriate

This is the cleanest fix for the `valid security certification` drift.

### 3. Add a transfer-distance rule

New shared rule:

- for direct role matches, use concrete operational proof points
- for adjacent matches, abstract one level up to transferable process skills
- for distant matches, avoid operational analogy and emphasize documentation discipline, communication, reliability, learning ability, and relevant supported overlap only

This single rule would likely fix more product pain than another generic anti-hallucination paragraph.

### 4. Tighten `engaging` and `storyteller` at the opening

Keep the architecture. Only sharpen:

- `engaging`: people/team/shared-goal opening, not ceremonial enthusiasm
- `storyteller`: explicit supported-thread opening that links background to next step

## Tier 2: Small backend-owned planner before generation

This is the first improvement I would recommend if Tier 1 is still not enough.

Add a tiny structured planning step before letter generation. Do not change the product surface.

Planner output should classify:

- `context_mode`: none | sparse | rich
- `transfer_distance`: direct | adjacent | distant
- `opening_mode`: signature | warm | throughline | concise
- `allowed_claims`
- `forbidden_inferences`
- `credential_status`
- `usable_transfer_themes`

Then feed only that compact plan into the current generator.

Why this is a good fit for Mistral:

- Mistral recommends reducing contradictions and using clearer decision structures in prompts.
- Mistral also recommends structured outputs when reliability matters in a multi-step pipeline.

Official references:

- Mistral Prompting: [Prompting](https://docs.mistral.ai/capabilities/completion/prompting_capabilities)
- Mistral Structured Outputs overview: [Structured Outputs](https://docs.mistral.ai/capabilities/structured_output)
- Mistral Custom Structured Outputs: [Custom Structured Outputs](https://docs.mistral.ai/capabilities/structured_output/custom)

Relevant guidance from those docs:

- avoid contradictions in long prompts
- prefer clearer decision structures
- use structured outputs when a step in a pipeline needs reliable typed output

That is exactly the current problem: generation is trying to do planning and writing in one pass.

## Tier 3: Improve fact representation, not just prompt wording

If the product keeps expanding across role changes, the current personalization shape will become the limiting factor.

The next durable step would be to enrich candidate context with typed support fields such as:

- identity/background facts:
  - veteranStatus: explicit_true | absent
  - militaryService: explicit_true | absent
  - publicServiceBackground: explicit_true | absent
- credentials:
  - exactLicenses[]
  - relatedCertifications[]
- education:
  - completedDegrees[]
  - inProgressEducation[]
- domain support:
  - directPracticeDomains[]
  - adjacentExposureDomains[]

This would let the generator reason on facts instead of trying to infer status from prose.

## Suggested Product Evaluation Loop

The current evaluation should split into four distinct buckets:

1. No-context
2. Direct-match role
3. Adjacent-match role
4. Distant-transfer role

Score each output separately for:

- invented positive history
- invented negative history
- JD-to-candidate rewriting
- identity/status inference
- credential exactness
- transfer-logic plausibility
- preset differentiation
- output-shape stability

Without separating transfer-distance cases, the system can look strong overall while still failing badly on adjacent-domain applications.

## Recommended Priority Order

1. Fix no-context rhetoric completely.
2. Add exact credential-fit rule.
3. Add transfer-distance rule.
4. Re-test `engaging` and `storyteller`.
5. If adjacent-domain failures remain, add a small structured planning step before generation.

## Bottom Line

The current system is good enough to keep the architecture.
It is not good enough to stop tuning.

The next gains will not come from more preset complexity.
They will come from better control over:

- no-context rhetoric
- credential exactness
- transfer-distance reasoning
- opening/transition behavior for the warmer presets

That is the narrowest path to a noticeably stronger product without reopening the architecture.
