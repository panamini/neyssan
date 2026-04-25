# Proposal Generation Results Audit Round 2

Date: 2026-03-13
Scope: Active backend proposal generation path and directly related app state.

## Classification

- Active code:
  - [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts)
  - [proposalOutput.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalOutput.ts)
  - [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts)
  - [proposal-personalization.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/lib/proposal-personalization.ts)
  - [ProposalInputForm.tsx](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/components/ProposalInputForm.tsx)
  - [activeCvSnapshots.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/activeCvSnapshots.ts)
- Legacy but informative:
  - older LangChain prompt code is not the primary cause of the outputs reviewed here
- Obsolete/dead code:
  - not relevant for this audit

## Verdict

The system is better than before, but it is still not at the target quality bar.

The planner step was the right architectural move. It reduced ambiguity. But the latest outputs show four remaining problems:

1. no-context outputs still contain soft pseudo-history and forbidden negative-history disclaimers
2. matched-role outputs still inflate some operational details and credential fit
3. adjacent-domain outputs still over-translate security facts into target-role readiness
4. app-side state still has at least one stale-display bug around CV title/name selection

## What Improved

- The stale identity leak is no longer the dominant failure.
- The system is preserving more real CV-backed specifics than before.
- `signature` remains the healthiest baseline.
- `expert` is serviceable.
- the planner is helping separate:
  - context strength
  - transfer mode
  - opening strategy
  - disallowed claims

That said, the product is still not done.

## Output Audit

## 1. No-context outputs are still not clean enough

### What is still wrong

The no-context branch is still making claims that should be blocked.

Examples:

- `While I may not have direct experience in this specific setting`
- `While I may not have direct experience in security`
- `I understand the importance of monitoring CCTV and access systems`
- `My ability to communicate effectively and work collaboratively would support the enforcement of security procedures`
- `I’m particularly interested in the chance to learn and adapt to new security systems`

Some of these are softer than earlier failures, but they are still problematic in no-context mode.

The main issue is not only explicit fake history anymore. It is implied practice.

The no-context policy should be:

- no prior-role claims
- no prior-tool familiarity
- no prior-systems familiarity
- no prior incidents
- no pseudo-background
- no negative-history disclaimers
- no soft acquired-practice language

The current outputs still violate that policy.

### What is specifically wrong by preset

- `signature`: still includes a forbidden disclaimer:
  - `While I may not have direct experience in this specific setting`
- `expert`: cleaner than some others, but still overstates readiness:
  - `The opportunity to oversee physical security, including monitoring CCTV and access control systems, aligns with my approach to vigilance and precision.`
  - this still reads too close to prior practice rather than role understanding
- `direct`: still implies operational readiness too strongly:
  - `I understand the importance of monitoring CCTV and access systems`
  - `My ability to communicate effectively and work collaboratively would support the enforcement of security procedures`
- `engaging`: still feels like a polished generic application letter, and still implies tool familiarity too easily
- `storyteller`: still contains the forbidden negative-history form:
  - `While I may not have direct experience in security`
  - and it goes further into pseudo-practice:
  - `I am comfortable working with technology, including monitoring systems and visitor management tools`

### Conclusion

The no-context branch is still failing. It is no longer inventing hard facts as often, but it still invents capability posture.

That is still a product failure.

## 2. Same-domain CV-backed outputs are stronger, but still inflate support

The second `cv signature` result is much healthier than the earlier stale-name result. It preserves real direction:

- security / investigation framing
- theft reduction
- CCTV work
- access control / troubleshooting

However, there are still problems:

- `refining inspection protocols` is not obviously the same thing as the CV’s actual theft-reduction wording
- `visitor documentation` is not clearly source-backed from the provided CV
- `worked with surveillance systems and visitor documentation` likely over-extends the source
- `360-degree CCTV cameras` drops the exact count `15`, losing a supported detail, while still sharpening other wording

This is the current pattern:

- good supported facts are present
- some exact source detail is flattened
- some nearby unsupported operational detail is added

So the system is still not preserving the right details at the right fidelity.

## 3. Credential-fit inflation still exists

The provided CV clearly supports:

- CPOP
- SOCP
- SAFE training
- in-progress bachelor’s in criminal justice

But the outputs still risk inflating:

- related certifications into exact credential fit
- criminal justice study into stronger direct-role readiness
- operational security background into broader target-role capability

In this batch, the strongest exact credential inflation is reduced compared with earlier rounds, which is good.
But the system still has no robust way to say:

- related certification
- not necessarily exact required state credential
- in-progress education
- not a completed degree

That remains a backend fact-shaping gap.

## 4. Adjacent-domain transfer is still not good enough

The Veterans Service Officer output is the clearest remaining hard-case failure.

Good news:

- it does not claim veteran status
- it does not claim military service
- it does not claim public-service background directly

Bad news:

- it still over-translates security facts into benefits-role readiness
- it still uses a too-literal analogy:
  - troubleshooting and surveillance procedures are framed as if they meaningfully support VA claims interpretation and tracking
- it adds public-service affinity language that is not clearly source-backed:
  - `a mission that resonates with my commitment to public service`

This is no longer a pure hallucination problem.
It is a transfer-granularity problem.

The system should abstract one level up for this role change:

- documentation discipline
- confidentiality
- procedural care
- client communication
- accuracy
- calm handling of structured processes

It should not make the role sound like a direct continuation of physical security operations.

## 5. Preset differentiation is still uneven

Current status:

- `signature`: still best
- `expert`: acceptable
- `direct`: still not direct enough
- `engaging`: still warmer than Signature, but often too stock
- `storyteller`: still the weakest perceptually in hard cases

The remaining issue is now mostly in opening and paragraph progression:

- `engaging` still falls back into polished cover-letter warmth
- `storyteller` still does not reliably create a visible supported past -> present -> next-step thread
- `direct` still keeps too much standard cover-letter pacing in no-context mode

This is no longer a catalog problem. It is a writer-obedience problem.

## 6. Multilingual behavior needs caution

One of the no-context outputs came back in French despite the user expectation of an English job offer.

### What the active code does

The current resolver in [proposalOutput.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalOutput.ts#L112) chooses:

- `French` if it sees French diacritics
- or enough French markers
- otherwise `English`

The writer then gets an explicit language instruction block.

### What this means

A French result from an English job offer suggests one of two things:

1. the actual prompt input still contained enough French markers to trigger the resolver
2. the model ignored the language instruction on that run

Given the user note that another job offer was chosen after that generation, there is some uncertainty here. This may have been:

- a mixed-language or stale-input run
- or a genuine instruction-following miss

### Conclusion

This is not yet proven to be a backend logic bug, but it is absolutely a product reliability risk.

It needs dedicated regression coverage.

## 7. CV picker / rename state still looks stale

The user reported:

- renaming the CV
- not seeing the updated name in the picker
- then generating with missing or stale display naming

The active app code in [ProposalInputForm.tsx](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/src/components/ProposalInputForm.tsx#L69) reads local CV state once, refreshes via local storage helpers, and separately syncs a shared active snapshot via [activeCvSnapshots.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/activeCvSnapshots.ts#L56).

That is enough moving pieces to produce stale display state if:

- the local library entry was renamed
- but the active local ID still points to an older serialized document copy
- or the picker list and active snapshot are reading different local records

I cannot confirm the exact bug from outputs alone, but this looks like a real app-state synchronization issue, not a generation-quality issue.

## Root Causes

## 1. Planner is present, but writer still has too much freedom

The planner now improves the path, but the final writer is still a prose LLM call with a large instruction bundle.

The remaining failures suggest:

- the planner constraints are not yet sharp enough for no-context mode
- the writer still paraphrases allowed themes into pseudo-capability language
- the writer still overreaches when fit is weak

So the limiting factor is no longer architecture. It is planner-to-writer enforcement strength.

## 2. No-context mode still lacks a hard rhetorical boundary

The current no-context rules block a lot, but the writer still produces:

- willingness-to-learn plus implied aptitude
- role-understanding plus operational posture
- disclaimers that still imply a candidate history frame

In other words:

- the system blocks hard fabrication
- but not soft competence theater

## 3. The fact bank is still not support-typed enough

The current context shape still mixes:

- exact source facts
- broad summary language
- skills/tags
- achievements

without explicitly marking:

- exact credential vs related credential
- in-progress vs completed education
- adjacent exposure vs direct practice
- identity/status facts vs domain keywords

That is why support inflation remains easy.

## 4. Transfer-distance reasoning is still underpowered

The planner classifies `domain_gap`, but the outputs suggest the writer still needs stronger behavioral consequences for:

- `direct`
- `adjacent`
- `distant`

Right now it still writes adjacent/distant cases with too much concrete role-readiness language.

## Product Assessment

### Good enough now

- architecture direction
- backend-owned preset logic
- source-backed specificity preservation in better cases
- same-domain `signature`

### Not good enough yet

- no-context honesty
- adjacent-domain credibility
- exact credential handling
- multilingual reliability
- CV picker/name sync reliability

## Best Next Steps

## 1. Tighten writer obedience to the plan

Smallest backend-only improvement:

- in no-context mode, forbid not only fake history but also soft acquired-practice language
- force first-person motivation and role-understanding language only
- explicitly forbid:
  - `while I may not have direct experience`
  - `I am comfortable working with`
  - `my ability to ... would allow me to`
  - `I understand the importance of [tool]` when it reads like pseudo-familiarity

This is the highest-leverage immediate fix.

## 2. Make transfer-mode consequences stronger

For `adjacent` and `distant`:

- downgrade proof strategy aggressively
- keep concrete operational facts, but do not map them literally to target-role operations
- require abstraction one level up

Example:

- acceptable: documentation discipline, vigilance, procedural care, communication
- not acceptable: CCTV work implies claims-processing readiness

## 3. Add exact credential / education status typing

Smallest safe fact-shaping improvement:

- enrich the planner input or fact bank with:
  - `related certifications`
  - `exact required credential unknown`
  - `education in progress`

This does not require a full redesign of the personalization layer, but it would materially reduce support inflation.

## 4. Add language-regression tests

Minimum needed:

- English JD -> English output
- French JD -> French output
- mixed-language JD -> deterministic expected behavior

Right now multilingual support is under-tested relative to product risk.

## 5. Audit local CV title/source-of-truth flow separately

This should be a separate app-state audit from generation quality.

Specifically verify:

- rename in local library
- picker list refresh
- active local CV ID
- shared active snapshot title
- generated name/title source after rename

## Bottom Line

The system is closer, but not finished.

The planner was the right change. The remaining work is now mostly about making the writer obey the planner more strictly in:

- no-context mode
- adjacent/distant transfer
- credential exactness
- multilingual output mode

The separate CV picker/name bug should be treated as a UI/state-sync issue, not as a generation failure.
