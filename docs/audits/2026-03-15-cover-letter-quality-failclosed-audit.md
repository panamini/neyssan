# Cover Letter Quality And Fail-Closed Audit

Date: 2026-03-15

## Scope

- Audit the current `cover_letter` generation path only.
- Focus on weak persuasion, generic/thin cover letters, weak preset separation, no-CV weakness, and fail-closed behavior where generated text exists but cleanup removes too much.
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
  - `my-app/convex/lib/proposals/__tests__/voicePresets.test.ts`
  - `my-app/convex/lib/proposals/__tests__/effectiveTone.test.ts`
- Active benchmark evidence
  - `my-app/benchmarks/proposal-generation/results/2026-03-12T15-28-21-374Z/review.md`
  - Note: these benchmark outputs predate some later cleanup refinements, so they are informative for failure shape, not exact proof of current wording.
- Legacy but informative observed-output evidence
  - `my-app/docs/audits/2026-03-15-pr4b-post-nocv-live-output-audit.md`
  - `my-app/docs/audits/2026-03-15-pr4b-march15-output-audit.md`
  - `my-app/docs/audits/2026-03-14-pr4b-user-output-results-audit.md`
  - These reflect user-provided live outputs summarized in prior audits, not raw source-of-truth generation traces.
- Uncertainty
  - not every user-reported fail-closed case has preserved raw pre-finalization text in the workspace
  - benchmark outputs reflect March 12 prompt state, while live audit notes reflect March 14-15 runtime observations

## 1. Most Likely Root Causes Ranked

### 1. The cover-letter writer contract is over-regularized for safety and evidence discipline, but under-specified for persuasion

This is the main quality problem.

The active planner and writer path strongly instructs the model to:

- lead with supported evidence
- avoid generic fit, readiness, contribution, support, value, and qualification language
- allow only one cautious bridge after the evidence anchor
- keep the close brief and non-ceremonial

That is good for honesty, but it produces a narrow rhetorical shape:

- fact cluster
- one cautious relevance link
- one short close

In strong matches this becomes grounded but flat. In adjacent or distant matches it becomes honest but unconvincing.

### 2. No-CV cover-letter guidance creates a hard structural tension that often yields shells or fail-closed drafts

The no-context branch is strict in the right direction, but hard to execute well:

- use only JD-grounded work surfaces, workflow, employer context, and grounded curiosity
- stay fully non-claiming
- avoid mission padding, schedule padding, growth rhetoric, soft readiness, and operational-execution language
- still produce at least two substantive work-surface movements before the close when detail exists

That combination often pushes the model toward:

- role-summary shells
- clipped JD fragments
- low-value interest lines
- bridge-like phrasing that cleanup later removes

So no-CV weakness is not mainly “too little prompting.” It is a high-constraint prompt plus cleanup interaction problem.

### 3. Preset differentiation is intentionally flattened before it reaches the body structure

`signature`, `expert`, and `storyteller` are not free to produce meaningfully different cover-letter structures.

The current system allows presets to affect:

- rhythm
- sentence length
- narrative texture
- executive formality
- opening smoothness

But it explicitly forbids presets from changing:

- proof order
- paragraph progression
- opening pattern in a structural way
- closing shape
- claim strength

So preset difference mostly survives as surface tone. That is why `expert` often feels like slightly more formal `signature`, and `storyteller` often feels like slightly smoother `signature`.

### 4. Finalization is a real secondary cause for cover letters, especially in thin no-CV and bridge-heavy CV drafts

Unlike `application_message`, cover letters use cover-letter-specific saveability rules.

That means cleanup can fail closed even when some generated text exists, including cases where:

- both cleaned body candidates are judged unsaveable
- bridge neutralization leaves only one fact sentence
- final saved-output bridge cleanup removes the last grounded no-context sentence

This is not the main reason cover letters are generic, but it is a real contributor to instability and some false-negative hard failures.

### 5. Verifier/repair fallback tends to flatten already-weak drafts further instead of restoring persuasion

When the verifier flags risky sentences:

- no-context repair can collapse to generic safe lines
- CV-backed repair can downgrade a sentence to a bare supported fact

That helps claim safety, but it often strips the sentence that was carrying the letter’s only persuasive movement.

## 2. Evidence From Code Path And Observed Examples

### Code-path evidence

Active legacy path:

- Mistral cover letters still run through planner -> inline legacy writer -> verifier/repair -> finalization: `generateProposalMutation.ts:6494`, `generateProposalMutation.ts:6661`
- the planner prompt is cover-letter-centric, which is appropriate for this format, but it is heavily safety-dominant: `proposalPlanner.ts:815` through `proposalPlanner.ts:833`
- the inline writer prompt for `cover_letter` is dense with negative constraint language and tightly bounded persuasion: `generateProposalMutation.ts:6059` through `generateProposalMutation.ts:6105`

Prompt-contract evidence:

- the writer prompt forces supported proof early and allows only one cautious bridge after it: `generateProposalMutation.ts:6096` through `generateProposalMutation.ts:6104`
- the writer-plan contract says transferable traits must stay secondary and the body must prioritize concrete evidence, scope, or background facts: `proposalPlanner.ts:987` through `proposalPlanner.ts:993`
- the closing guidance forbids mentioning contribution, support, value, fit, or readiness in the closing: `proposalPlanner.ts:631` through `proposalPlanner.ts:637`

Preset evidence:

- preset definitions are shallow overlays plus baseline `formalityLevel` and `creativity`: `voicePresets.ts:81` through `voicePresets.ts:141`
- `storyteller` and `signature` share the same neutral/medium baseline in tone resolution: `effectiveTone.ts:35` through `effectiveTone.ts:77`
- prompt construction explicitly says preset is tone-only, not structure guidance: `generateProposalMutation.ts:5907` through `generateProposalMutation.ts:5913`
- writer-plan contract repeats the same restriction: `proposalPlanner.ts:1012`
- tests explicitly lock that behavior in: `proposalWriterPrompt.test.ts:105` through `proposalWriterPrompt.test.ts:144`

Finalization evidence:

- cover letters use cover-letter-specific saveability rather than the generic body floor: `generateProposalMutation.ts:4634` through `generateProposalMutation.ts:4695`
- `legacy_thin` still requires two saveable sentences and at least one grounded operational/evidence sentence: `generateProposalMutation.ts:4670` through `generateProposalMutation.ts:4679`
- no-context lead cleanup removes or neutralizes early shell rhetoric only when saveability remains: `generateProposalMutation.ts:4716` through `generateProposalMutation.ts:4820`
- final saved-output bridge cleanup can remove grounded content and then trigger a hard failure if only weak residue remains: `generateProposalMutation.ts:4353` through `generateProposalMutation.ts:4431`, `generateProposalMutation.ts:5523` through `generateProposalMutation.ts:5593`
- body candidate selection still hard-fails at `cleaned_body_selection` when both candidates are unsaveable: `generateProposalMutation.ts:4941` through `generateProposalMutation.ts:5009`

Verifier/repair evidence:

- verifier flags no-context phrases, readiness drift, adjacent/distant readiness, and unsupported operational strengthening: `proposalEnforcement.ts:1524` through `proposalEnforcement.ts:1787`
- repair prompt itself emphasizes “short and factual” rewrites and forbids stronger persuasive language: `proposalEnforcement.ts:1795` through `proposalEnforcement.ts:1871`
- local repair for no-context uses generic safe fallback sentences, and CV-backed repair often downgrades to a bare fact: `proposalEnforcement.ts:1874` through `proposalEnforcement.ts:1985`

### Active test evidence

Fail-closed and cleanup-collapse tests:

- bridge-only shell cover letters hard-fail as expected: `proposalWriterPrompt.test.ts:563` through `proposalWriterPrompt.test.ts:600`
- one fact sentence plus bridge cleanup still fails closed: `proposalWriterPrompt.test.ts:714` through `proposalWriterPrompt.test.ts:729`
- generic one-sentence no-context prose still fails the cover-letter floor: `proposalWriterPrompt.test.ts:854` through `proposalWriterPrompt.test.ts:865`
- some thin no-context letters survive only because `legacy_thin` is permissive: `proposalWriterPrompt.test.ts:867` through `proposalWriterPrompt.test.ts:903`
- final bridge cleanup can remove the last grounded no-context sentences and still end in a hard failure: `proposalWriterPrompt.test.ts:2436` through `proposalWriterPrompt.test.ts:2471`

Evidence that finalization is not universally broken:

- wrapped saveable CV drafts are recovered instead of being destroyed: `proposalWriterPrompt.test.ts:1517` through `proposalWriterPrompt.test.ts:1553`
- malformed fragments such as `The role at WilsonAI.` and `Working directly with clients in Paris and Washington D. C.` are explicitly covered by current tests: `proposalWriterPrompt.test.ts:1914` through `proposalWriterPrompt.test.ts:1964`
- current tests also cover newer bridge variants like `could offer relevant perspective` and `align ... required for this role`: `proposalWriterPrompt.test.ts:1966` through `proposalWriterPrompt.test.ts:2022`

### Observed example evidence

Benchmark examples, informative for quality shape:

- strong same-domain frontend letters are grounded but still end in broad “bring this experience / platform forward” persuasion rather than a sharper interview case: `review.md:39` through `review.md:43`, `review.md:60` through `review.md:64`
- adjacent backend letters show the common weak pattern: honest limit + generic learning/value language + generic close: `review.md:423` through `review.md:427`, `review.md:443` through `review.md:447`
- weak/distant data-science letters become cautious but generic transfer summaries with low persuasive force: `review.md:810` through `review.md:815`, `review.md:831` through `review.md:835`
- no-context generalist letters drift into reliability/communication shells, schedule/value padding, and role-summary rhetoric: `review.md:1036` through `review.md:1040`, `review.md:1057` through `review.md:1061`

Recent live-output audit notes, informative for preset-specific observed failures:

- `signature no cv`, `direct no cv`, and `engaging no cv` still saved with weak-survivor shell phrasing: `2026-03-15-pr4b-march15-output-audit.md:64` through `2026-03-15-pr4b-march15-output-audit.md:97`
- `storyteller no cv`, `storyteller cv`, and `signature cv` were documented as fail-closed at `cleaned_body_selection`: `2026-03-15-pr4b-march15-output-audit.md:167` through `2026-03-15-pr4b-march15-output-audit.md:178`
- later March 15 live audit still found deterministic cleanup misses for no-CV shell phrasing and some CV bridge/fragment survivors: `2026-03-15-pr4b-post-nocv-live-output-audit.md:77` through `2026-03-15-pr4b-post-nocv-live-output-audit.md:107`

## 3. What Is Prompt vs Preset vs Finalization

### Prompt-generation weaknesses

Primary:

- cover-letter generation is dominated by prohibitions and narrow allowed persuasive movement
- adjacent and distant CV-backed cases are told to stay honest, but not shown a strong alternative rhetorical move beyond one cautious bridge
- no-CV cover letters must be JD-grounded and non-claiming at the same time, which often produces shells or clipped work-summary fragments
- verifier repair prefers safe factual downgrades over persuasive reconstruction

Symptoms this explains:

- grounded but weakly persuasive cover letters
- overly generic or formulaic body shape
- CV-backed letters that describe evidence without turning it into an interview case
- no-CV letters that drift into role-summary rhetoric before cleanup

### Preset-mapping weaknesses

Secondary, but real:

- `signature`, `expert`, and `storyteller` differ mainly in surface phrasing
- baseline tone resolution is shallow
- structural preset effects are intentionally suppressed in both planner and writer prompt

Symptoms this explains:

- `expert` feels mostly like a more formal `signature`
- `storyteller` does not reliably create a visible evidence thread
- preset differences disappear fastest in hard cases where safety constraints dominate

### Cleanup/finalization over-aggressiveness

Real, but narrower than the prompt problem:

- cover-letter-specific saveability can hard-fail thin drafts with some grounded content
- bridge neutralization can remove the only sentence carrying weak relevance
- no-context cleanup removes low-value leads only if saveability survives, so some weak shells still save while others fail closed

Symptoms this explains:

- fail-closed outcomes where raw generated text existed
- collapse after bridge cleanup or candidate-body selection
- instability between weak survivor and fail-closed depending on exact sentence mix

Bottom line:

- overall cover-letter quality is mainly an upstream prompt-generation problem
- preset differentiation is mainly a prompt/preset-expression problem
- fail-closed instability is the part most directly attributable to cleanup/finalization

## 4. Smallest Safe Next Implementation Pass

### Recommendation: a narrow combination of prompt-generation improvement plus one tiny cleanup/finalization adjustment

Prompt-only is not enough.
Cleanup-only is not enough.
Preset-mapping alone is definitely not enough.

The smallest safe pass is:

1. Cover-letter prompt-generation improvement
   - keep the claim-safety contract
   - strengthen the positive persuasion contract for CV-backed letters:
     - one concrete proof point
     - one specific reason that proof matters for this role now
     - one brief close
   - strengthen adjacent/distant guidance so the model has a better honest persuasion move than generic transfer rhetoric
   - tighten no-CV cover-letter guidance around “two grounded work-surface sentences plus one brief curiosity/role-interest sentence” and more explicitly ban JD-summary shells
2. One narrow cleanup/finalization adjustment
   - only target deterministic false-negative collapse cases
   - do not loosen the overall saveability floor
   - specifically preserve factual prefixes or grounded work-surface content when bridge cleanup would otherwise remove the last grounded sentence
   - keep rejecting true greeting-plus-shell drafts

Why this combination is necessary:

- prompt-generation is the main fix for generic and weak persuasion
- current cover-letter finalization still contributes to some real fail-closed cases when generated content is present but packaged in bridge-heavy or shell-adjacent form
- those are two different failure classes, and either one left alone will keep the product inconsistent

Why not preset-mapping first:

- preset flattening is real, but it is downstream of the bigger problem that the body contract suppresses rhetorical variation
- if the body contract stays this narrow, a preset-only pass will mostly just create slightly different wording on the same weak structure

## 5. Residual Risks

1. Adjacent, distant, and no-CV cover letters will still be intrinsically less persuasive than strong same-domain CV-backed letters because the claim policy is intentionally conservative.

2. A stronger persuasion contract can easily reintroduce banned readiness, contribution, or fit language if it is not kept tightly bounded.

3. A cleanup adjustment that is too permissive could let more weak survivors through instead of improving actual usefulness.

4. Preset differentiation will still look modest in very short or highly constrained letters even after a better prompt pass, because the system is intentionally not allowing presets to change claim strength.

5. Some live fail-closed cases still lack preserved raw pre-finalization drafts in the workspace, so a few stage-level conclusions remain best-effort rather than fully closed from direct traces.
