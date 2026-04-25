# Application Message Quality And Fail-Closed Audit

Date: 2026-03-15

## Scope

- Audit the current `application_message` generation path only.
- Focus on quality failures, weak persuasion, weak preset separation, no-CV weakness, and fail-closed behavior.
- Do not recommend routing, fallback-policy, provider-selection, telemetry, UI, retry, or broad pipeline changes.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/lib/proposals/proposalPlanner.ts`
  - `my-app/convex/lib/proposals/proposalEnforcement.ts`
  - `my-app/convex/lib/proposals/voicePresets.ts`
  - `my-app/convex/lib/proposals/effectiveTone.ts`
- Active tests used as behavior evidence
  - `my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
- Observed in-repo application-message examples
  - `application-strong-support`
  - `application-adjacent-admin`
  - `application-no-context-support`
- User-provided anchor labels
  - `signature no-CV fail-closed`
  - `expert no-CV weak/generic plumbing letter`
  - `storyteller CV weak/short security letter`
  - `expert CV fail-closed / weak game-dev case`
  - `application_message expert CV weakly persuasive`
  - `application_message direct no-CV mostly restates the job`
- Uncertainty
  - the exact raw text for the user-provided anchor labels is not present in the workspace
  - benchmark outputs under `benchmarks/` are concrete examples of the same failure shapes, but they are illustrative evidence, not proof that every live labeled example used identical wording

## 1. Most Likely Root Causes Ranked

### 1. `application_message` is still planned with a cover-letter-centric strategy contract

This is the highest-signal root cause.

- `buildProposalPlannerPrompt(...)` does not take `outputFormat` at all and hardcodes cover-letter planning language, including:
  - `grounded, non-claiming cover-letter body`
  - `In no-context cover-letter mode ...`
  - `In CV-backed cover-letter mode ...`
- That means `application_message` generation is planned as if it were a short cover letter, then later compressed into a 70-100 word message.

Why this matters:

- it encourages cover-letter evidence ordering and closing behavior
- it weakens format-specific persuasion
- it makes no-CV application messages inherit the wrong planning assumptions

### 2. The legacy inline writer prompt over-constrains brevity and safety but under-specifies persuasion

The active writer prompt for `application_message` says:

- keep it `about 70 to 100 words`
- use `1 to 2 short paragraphs only`
- `bring 1 relevant supported proof point ... but do not force a resume-style opener`
- keep the relevance link `cautious and brief`
- do not make it a `mini cover letter or essay`

What it does not say clearly enough:

- make one concrete case for why this candidate is worth interviewing now
- convert background into a distinct value proposition
- make the close do more than generic willingness to discuss

The result is a safe but thin default: one fact cluster, one alignment sentence, one discussion close.

### 3. Preset differentiation is intentionally flattened before it reaches the message body

The preset system exists, but its effect is deliberately narrowed:

- preset definitions are short prose overlays plus a `formality` / `creativity` baseline
- `engaging` and `storyteller` share the same `neutral` + `medium` baseline
- the inline prompt says presets may affect only `tone, pacing, warmth, directness, and narrative smoothness`
- the inline prompt also explicitly forbids presets from changing `opening pattern`, `proof order`, `paragraph progression`, or `closing shape`
- the planner/writer contract repeats that presets must not change claim strength or structural behavior

This makes `signature`, `expert`, and `storyteller` sound like surface variants of the same safe message template rather than distinct rhetorical modes.

### 4. No-CV `application_message` guidance is weaker than the cover-letter no-CV guidance, and the verifier repair fallback is generic

The `application_message` no-context prompt is much lighter than the no-context cover-letter branch:

- it tells the model to use role context and work surfaces
- but it does not require two JD-grounded substantive movements
- it does not include the richer anti-template / anti-restatement scaffolding used for cover letters

Separately, if the verifier flags no-context sentences, `repairProposalSentenceLocally(...)` can replace them with generic fallback lines such as:

- `The day-to-day work itself is the part of the role that stands out to me most.`
- `The role appears to depend on steady follow-through, clear communication, and organized day-to-day coordination.`

Those repairs are safe, but they are generic and format-agnostic. They weaken persuasion and erase preset signal.

### 5. Finalization is a secondary amplifier, not the primary cause, but it can expose shell drafts and occasionally fail closed

For `application_message`, finalization is comparatively lenient:

- it uses the generic `hasSubstantiveBodyContent(...)` floor, not the stricter cover-letter saveability rules
- that means a message normally survives as long as at least one sentence is not generic or malformed

So when `application_message` fails at `cleaned_body_selection`, the upstream draft is usually already a wrapper-heavy, bridge-only, or generic shell after extraction and cleanup.

There is one real secondary cleanup effect:

- `applyFinalSavedOutputBridgeGuard(...)` can strip soft alignment / support sentences and leave almost nothing behind

That can worsen already-weak drafts, but the code does not support the idea that application-message finalization is the main reason healthy drafts are being lost.

## 2. Evidence From Code Path And Observed Examples

### Code-path evidence

Planner and writer path:

- `generateProposalMutation.ts` builds `plannerPrompt` without any format argument and then builds the inline writer prompt with `outputFormat` only afterward: [`generateProposalMutation.ts:6242`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L6242), [`generateProposalMutation.ts:6251`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L6251)
- Mistral `application_message` still runs through planner -> legacy generation -> verifier/repair -> finalization: [`generateProposalMutation.ts:6494`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L6494), [`generateProposalMutation.ts:6661`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L6661)

Planner mismatch:

- `buildProposalPlannerPrompt(...)` is format-agnostic and hardcodes cover-letter language: [`proposalPlanner.ts:777`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L777)
- explicit cover-letter-only guidance appears at [`proposalPlanner.ts:816`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L816) through [`proposalPlanner.ts:825`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L825)

Weak preset separation:

- preset definitions are short and shallow: [`voicePresets.ts:77`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L77) through [`voicePresets.ts:141`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts#L141)
- tone baseline collapses to `formality` + `creativity`: [`effectiveTone.ts:23`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/effectiveTone.ts#L23) through [`effectiveTone.ts:108`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/effectiveTone.ts#L108)
- opening-strategy mapping is preset-specific, but only one enum hop deep: [`proposalPlanner.ts:720`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L720)
- the inline prompt explicitly suppresses structural preset effects: [`generateProposalMutation.ts:5907`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L5907) through [`generateProposalMutation.ts:5913`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L5913)
- the writer-plan contract repeats the same suppression: [`proposalPlanner.ts:1012`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L1012)

No-CV weakness:

- `buildNoContextPromptBlock("application_message")` is materially thinner than the cover-letter branch: [`generateProposalMutation.ts:1393`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L1393) through [`generateProposalMutation.ts:1420`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L1420)
- the planner writer contract for `application_message` no-context is also lighter than cover-letter no-context: [`proposalPlanner.ts:573`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L573) through [`proposalPlanner.ts:603`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L603)
- no-context repair fallbacks are generic and format-agnostic: [`proposalEnforcement.ts:507`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalEnforcement.ts#L507) through [`proposalEnforcement.ts:565`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalEnforcement.ts#L565), [`proposalEnforcement.ts:1874`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalEnforcement.ts#L1874) through [`proposalEnforcement.ts:1891`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalEnforcement.ts#L1891)

Finalization evidence:

- `application_message` uses `strict` substantive-body acceptance but only via the generic body check, not cover-letter saveability: [`generateProposalMutation.ts:5627`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L5627), [`generateProposalMutation.ts:5682`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L5682), [`generateProposalMutation.ts:4188`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L4188)
- `cleaned_body_selection` failure happens only when both cleaned candidates are unsaveable: [`generateProposalMutation.ts:4950`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L4950) through [`generateProposalMutation.ts:5009`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L5009)
- final bridge guard can erase alignment / support language from application messages: [`generateProposalMutation.ts:5523`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L5523) through [`generateProposalMutation.ts:5585`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L5585)
- existing test evidence shows an application message can collapse to a single generic discussion line after bridge cleanup: [`proposalWriterPrompt.test.ts:602`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts#L602)
- existing test evidence also shows a bridge-only `application_message` can still fail closed after persistence cleanup: [`proposalWriterPrompt.test.ts:841`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts#L841)

### Observed example evidence

`application-strong-support`:

- the stronger sample is still basically fact cluster + alignment sentence + discussion close: [`review.md:358`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/review.md#L358)
- the weaker Mistral sample is even more obviously `apply + facts + aligns + welcome opportunity`: [`review.md:370`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/review.md#L370)

Why it matters:

- grounded, but not strongly persuasive
- background is described, not converted into a sharper interview case

`application-adjacent-admin`:

- Mistral small turns into a mini-cover-letter style message with `I’m confident I can support your team’s administrative needs effectively` and `would allow me to contribute immediately`: [`review.md:741`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/review.md#L741)
- Mistral large is shorter, but still mostly role-fit summary plus generic close: [`review.md:755`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/review.md#L755)

Why it matters:

- this is exactly the “grounded but weakly persuasive” pattern
- it also shows how easy it is for application messages to drift into cover-letter rhetoric

`application-no-context-support`:

- no-context Mistral small still claims `as I’ve done in past roles`: [`review.md:1131`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/review.md#L1131)
- Mistral large claims prior experience and support value: [`review.md:1145`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/review.md#L1145)
- GPT-5-nano mostly restates the job and future support value with little real candidate grounding: [`review.md:1173`](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/review.md#L1173)

Why it matters:

- this is the closest in-repo analogue to the user’s `application_message direct no-CV mostly restates the job`
- it also shows that no-CV weakness is not primarily a finalizer problem; the draft is already generic before persistence

### Mapping to the user-provided anchor labels

The exact raw text for the user’s named anchors is not in the repo, but their reported failure shapes line up with the code and examples above:

- `signature no-CV fail-closed`
  - consistent with upstream no-context shell generation reaching `cleaned_body_selection`, not with an over-strict application-message floor
- `expert no-CV weak/generic plumbing letter`
  - consistent with the no-context application-message tendency to restate workflow and role context without a real persuasive move
- `storyteller CV weak/short security letter`
  - consistent with preset flattening, where `storyteller` gets only smoother tone, not a stronger message-specific through-line
- `expert CV fail-closed / weak game-dev case`
  - consistent with adjacent/distant-domain planning that suppresses strong claims but does not replace them with a sharper cautious relevance strategy
- `application_message expert CV weakly persuasive`
  - directly consistent with the `application-adjacent-admin` class
- `application_message direct no-CV mostly restates the job`
  - directly consistent with the `application-no-context-support` class

## 3. What Is Prompt vs Preset vs Finalization

### Prompt-generation weaknesses

Primary:

- format-agnostic planner prompt still describing `application_message` as if it were a cover-letter planning problem
- writer prompt optimized for shortness and safety, but not for a concrete persuasive move
- no-context application-message guidance is underdeveloped relative to cover letters
- verifier/repair fallbacks replace flagged no-context lines with generic safe sentences that flatten quality and erase preset signal

Symptoms this explains:

- overly short or generic outputs
- weak persuasion
- no-CV outputs that mostly restate the job
- CV-backed outputs that mention background but do not convert it into a sharper case

### Preset-mapping weaknesses

Secondary, but real:

- preset definitions are too shallow
- `engaging` and `storyteller` share the same backend baseline
- preset-to-opening-strategy mapping exists, but the downstream prompt contract prevents that mapping from materially changing message structure

Symptoms this explains:

- `signature`, `expert`, and `storyteller` do not feel clearly separated
- `storyteller` does not create a visible through-line in short application-message form
- `expert` often feels like `signature` plus more formal wording, not a distinct rhetorical mode

### Cleanup/finalization over-aggressiveness

Tertiary for `application_message`:

- body selection can fail closed if extraction plus generic-shell filtering leaves nothing substantive
- bridge cleanup can strip already-weak alignment / support sentences and expose a hollow message

What it does not explain well:

- the general prevalence of weak persuasion
- the repeated restatement / alignment / discussion-close shape
- weak preset differentiation

Bottom line:

- for `application_message`, the main defect is upstream generation planning and writing contract
- preset mapping is a secondary multiplier
- finalization is mostly revealing shell drafts rather than destroying healthy ones

## 4. Smallest Safe Next Implementation Pass

### Recommendation: prompt-only improvement

Do not start with cleanup/finalization changes.
Do not start with a separate preset-map redesign.

The smallest safe pass is:

1. Make the planner prompt format-aware for `application_message`.
2. Add an `application_message`-specific writer-plan contract that explicitly asks for:
   - one concrete reason to interview this candidate now
   - one supported proof point or one cautious relevance move
   - a close that remains brief but is not the only persuasive sentence
3. Make no-context `application_message` guidance stronger and more specific:
   - prefer one JD-grounded work/context sentence
   - prefer one candidate-safe motivation / curiosity / work-style sentence
   - explicitly forbid restating the whole job in message form
4. Let the existing `opening_strategy` matter more for `application_message` openings, without changing the preset IDs or UI controls.

What this means in practice:

- update `buildProposalPlannerPrompt(...)` so `application_message` stops inheriting cover-letter planning language
- update `buildProposalWriterPlanBlock(...)` with message-specific paragraph / sentence-purpose rules
- update `buildInlineMistralPrompt(...)` so the application-message branch specifies a stronger persuasion contract, not just shorter length and safety

Why not cleanup/finalization first:

- the `application_message` saveability floor is already lenient
- loosening finalization would mostly save shells and bridge-heavy drafts
- that would increase low-quality survivors rather than improving persuasion

Why not preset-mapping first:

- the current preset map is not the main bottleneck
- the bigger problem is that the prompt stack suppresses structural preset effects
- once the format-aware prompt contract exists, preset differentiation can improve without changing the preset IDs or control surface

## 5. Residual Risks

1. A prompt-only pass will improve average quality, but it will not eliminate all weak adjacent / distant-domain cases. Some of those will still be intrinsically hard when evidence is thin.

2. If the verifier still rewrites flagged sentences with generic no-context fallback lines, some outputs may remain flatter than intended even after prompt improvements.

3. Because `application_message` is intentionally short, stronger persuasion instructions can easily overshoot into mini-cover-letter behavior if not tightly bounded.

4. If user-provided fail-closed anchors are actually dominated by wrapper/meta-output artifacts rather than weak prose, a later tiny extraction/finalization adjustment may still be needed. The current code review does not make that the most likely primary cause.

5. Preset differentiation may still look shallow after a prompt-only pass if the team expects large rhetorical differences from the same 70-100 word message format. The short format itself limits visible separation.
