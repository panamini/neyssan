# Proposal Generation Deep Quality Audit

Date: 2026-03-13

Scope:
- Output-quality audit only
- Active app/backend proposal path
- No implementation in this document

Classification:
- Active code:
  - `convex/generateProposalMutation.ts`
  - `convex/lib/proposals/voicePresets.ts`
  - `src/lib/proposal-personalization.ts`
- Legacy but informative code:
  - none needed for this audit
- Obsolete/dead code:
  - `*.bak`
  - backup component trees

## Executive summary

The system is better than it was, but it is still not good enough.

Current state:
- The stale-profile identity leak is mostly fixed.
- `Signature` is still the best general preset.
- `Expert` is usable, though still somewhat templated.
- `Direct` is still not clearly direct enough.
- `Engaging` still often falls back to stock cover-letter language.
- `Storyteller` still reads more like a standard cover letter than a genuine trajectory-driven variant.

The two biggest unresolved quality problems are:

1. No-context generation still behaves like inferred candidate context.
2. Cross-domain generation still over-transfers operational facts into direct target-domain claims.

This means the system is now failing less through obvious hallucination and more through:
- pseudo-experience
- over-literal transfer
- credential/status upgrading
- generic cover-letter convergence

## Output audit

### 1. No-CV branch is improved, but still not safe enough

#### What improved

- The output no longer leaks stale candidate identity such as `f`.
- `no cv signature` is the strongest no-context sample in this set.
- Some no-context outputs now use role-understanding language instead of fabricated achievement bullets.

#### What is still wrong

The no-context branch still allows invented history or pseudo-history:

- `no cv expert`: `While I may not have direct security experience`
- `nocv direct`: `While I may not have direct security experience`
- `nocv engaging`: `While I’m new to formal security work`
- `nocv engaging`: `While I may not have direct security experience`

These are still failures, even though they are “honest sounding,” because they invent negative history.

The no-context branch also still drifts into pseudo-experience via capability phrasing:

- `I am prepared to take on the responsibilities`
- `my ability to remain calm under pressure`
- `my ability to remain vigilant`
- `my ability to respond effectively to incidents`

These are softer than explicit fabricated work history, but they still read like unsupported self-claims rather than strictly non-claiming professional intent.

#### Diagnosis

The prompt is still giving the model two competing instincts:
- be honest about lack of context
- produce a useful cover letter with fit language

Mistral Small is resolving that conflict by introducing “safe sounding” invented backstory:
- not prior achievements
- but still prior/non-prior status claims

This is a contradiction problem, not just a missing guardrail.

### 2. CV-backed security-role generation is mostly grounded, but still overclaims in subtle ways

#### What is working

- The system now preserves strong source-backed details well:
  - security guard roles
  - CCTV-related work
  - quantified theft reduction
  - certifications and languages when present
- `cv signature` and `cv expert` are materially stronger than older versions.

#### What is still weak

The system still upgrades or broadens some facts:

- `cv signature`: `I hold a valid security certification`
  - The CV contains security-related certifications, but this wording risks implying the exact job-required certification or state-valid licensing status.
- `cv expert`: `I hold the necessary security certification to meet New York state requirements`
  - This is too strong. The CV includes security training/certification, but not explicit proof of the exact NY requirement.
- `cv expert`: `guest safety and satisfaction`
  - Safety is supported. Satisfaction is not clearly source-backed.
- `cv engaging`: `incident response`
  - Not clearly supported by the supplied CV language.

#### Diagnosis

The model is reasonably good at preserving specific facts, but still tends to convert:
- related certification -> exact required certification
- related operational exposure -> direct target responsibility
- hospitality/security context -> customer-service competence wording

This is not raw hallucination anymore. It is support inflation.

### 3. Cross-domain generation is still the biggest quality gap

The Veterans Service Officer sample is the clearest remaining product weakness.

#### What improved

- The model no longer says `As a veteran`.
- It no longer directly hallucinates military service.

#### What is still wrong

It still over-transfers security achievements into VA-benefits casework:

- theft-reduction vigilance -> `apply regulations effectively`
- CCTV installation / monitoring -> `tracking and submitting VA benefit claims`

That is not a factual hallucination in the narrow sense, but it is a credibility failure.

The problem is not that the model is inventing a claim from nowhere.
The problem is that it is using the wrong level of abstraction for transfer.

For distant-domain role changes, the current system still maps:
- operational security proof
to
- target-domain procedural competence

when it should instead map:
- documentation discipline
- procedural compliance
- client-facing reliability
- confidentiality
- attention to detail

#### Diagnosis

The system lacks domain-distance awareness.

Today it behaves like:
- every concrete proof point should be connected directly to the target job

But for cross-domain moves, the correct behavior is:
- concrete proof points should often support a more abstract transferable capability, not a literal target-task analogy

### 4. Preset differentiation is still not strong enough

#### Signature

- Still the healthiest baseline.
- Most coherent and least distorted.

#### Expert

- Best after Signature.
- More structured and evidence-led.
- Still too likely to use standard application rhythm and credential-upgrading language.

#### Direct

- Still under-differentiated.
- It often reads like normal `Signature` with a slightly firmer first sentence.
- It still falls back to formal cover-letter phrasing too often.

#### Engaging

- Still the weakest preset improvement.
- It often converges to stock warmth:
  - `I’m pleased to apply`
  - `I am writing to express my interest`
  - `What excites me`
- It does not yet reliably feel like “future colleague warmth.”

#### Storyteller

- Still not narrative enough.
- It rarely creates a visible “past -> present -> next-step” motion.
- It mostly behaves like a normal cover letter with a slightly smoothed opening.

## Why the current prompt is plateauing

The active prompt is already long and detailed.
That is not automatically bad, but with Mistral Small it creates a known failure mode:
- many rules
- overlapping sections
- subtle contradictions
- too many competing objectives in one generation pass

This matches Mistral’s own prompting guidance:

- use a clear role and task definition
- organize instructions hierarchically into clear sections
- avoid contradictions in long prompts
- use compact examples when they materially improve behavior
- use structured outputs when consistent categories matter

Sources:
- [Mistral Prompting](https://docs.mistral.ai/capabilities/completion/prompting_capabilities)
- [Mistral Custom Structured Outputs](https://docs.mistral.ai/capabilities/structured_output/custom)
- [Mistral Guardrailing](https://docs.mistral.ai/capabilities/guardrailing)

Important nuance:
- Mistral’s `safe_prompt` is not the right fix for this problem.
- That feature is about generic safety moderation, not about product-specific factual boundaries inside job-application generation.

## System-level diagnosis

The product is now beyond the point where more prompt lines alone will keep scaling cleanly.

The core system problem is that the generator is doing too many things in one pass:

1. decide whether context is none / minimal / sparse / rich
2. decide what claims are allowed
3. decide how far transferability can go
4. decide whether a credential/identity/status is explicit or inferred
5. choose preset voice behavior
6. write the final prose

That is exactly the kind of multi-objective prompt that tends to blur under a smaller instruct model.

## Recommended improvement path

### Level 1: Final prompt-only cleanup

This is the last worthwhile prompt-only layer before changing the system shape.

1. Make no-context behavior stricter still:
- no positive invented history
- no negative invented history
- no pseudo-capability claims that imply prior experience
- no credential willingness phrasing if it reads like inferred background

2. Add credential-specific boundary rules:
- related certification is not equivalent to exact job-required certification
- in-progress education is not a completed degree
- adjacent sector exposure is not identity/status

3. Add transfer-granularity rules:
- for distant-domain jobs, prefer high-level transferable capabilities
- avoid literal task-to-task analogies unless strongly supported

4. Add one more compact opening contrast for `engaging` and `storyteller`
- `engaging`: people/team/shared-goal opening
- `storyteller`: one supported thread -> why this is the next step

### Level 2: Small structured planning step before prose generation

This is the most important next system improvement if prompt-only tuning is still not enough.

Use a first pass that returns structured JSON only, then generate the letter from that JSON.

Recommended planner output:

- `context_mode`: `none | minimal | sparse | rich`
- `domain_gap`: `direct | adjacent | distant`
- `identity_hard_stops`: list of disallowed inferred identities/statuses
- `allowed_concrete_facts`: exact source-backed facts allowed in prose
- `allowed_transfer_themes`: abstract transferable themes only
- `disallowed_claims`: exact claims the writer must not make
- `opening_strategy`: one of a small enumerated set
- `proof_strategy`: `none | abstract_only | concrete_supported`

Why this matches Mistral guidance:
- Mistral recommends clear structure and structured outputs for consistent categories.
- This moves the hardest decisions out of the prose-writing step.

Source:
- [Mistral Custom Structured Outputs](https://docs.mistral.ai/capabilities/structured_output/custom)

### Level 3: Make claimability explicit in personalization context

Today the personalization layer mainly ships:
- summary
- skills
- recent experience
- achievements

That is useful, but not enough for the generator to reason safely about:
- completed vs in-progress degree
- certification type vs job-required licensing
- veteran status / service status
- direct domain practice vs adjacent exposure

Recommended evolution:

Add claim-status fields to the personalization context or a separate backend “claim ledger”:
- `certifications_explicit`
- `licenses_explicit`
- `education_in_progress`
- `education_completed`
- `identity_status_explicit`
- `domain_exposure_only`
- `domain_practice_explicit`

This would let the writer use exact facts instead of guessing from summary text.

### Level 4: Add domain-gap-aware generation policy

The system should treat three job-move types differently:

1. Direct-domain move
- same domain
- concrete proof points can map more literally

2. Adjacent-domain move
- some overlap
- use concrete proof, but soften task equivalence

3. Distant-domain move
- very different target role
- avoid literal task mapping
- use higher-order capabilities only

This does not require a new user-facing feature.
It can be backend-owned policy.

### Level 5: Build an evaluation harness around failure families

Right now you are catching failures manually, which is useful but not scalable.

Build a small golden set grouped by failure family:

- no-context / blank candidate
- credential mismatch
- identity/status inference
- adjacent-domain move
- distant-domain move
- same-domain proof preservation
- preset differentiation

For each case, score:
- factual safety
- support fidelity
- transfer credibility
- preset distinctness
- stock-language rate

This is the fastest way to make prompt iteration reliable.

## What I would do next

If you want the next meaningful improvement, I would not keep stacking more prose-only rules first.

I would do this in order:

1. One last compact prompt cleanup for:
- credential mismatch
- negative-history blocking
- distant-domain transfer rules

2. Then immediately add a structured planner stage before final generation.

That is the smallest system change that is likely to produce a real quality jump with Mistral Small.

## Bottom line

The system is improved, but not yet production-grade for hard cases.

It is now good enough for:
- many same-domain CV-backed letters

It is not yet good enough for:
- true no-context letters
- credential-sensitive jobs
- adjacent-identity/status boundaries
- distant-domain role changes
- strong preset separation for `engaging` and `storyteller`

The next real gain will come from separating:
- claimability / transfer reasoning
from
- prose generation

instead of asking one prompt to do both at once.
