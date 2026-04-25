# Proposal Generation Results Audit Round 4

Date: 2026-03-13

## Scope

- Audit only
- Active focus:
  - backend planner -> writer proposal generation path
  - active language resolver behavior
- Explicitly out of scope for this audit:
  - Proposal Forge UI/state bugs
  - extension behavior
  - auth/scraping/CV-flow redesign
  - model/provider changes

## Code Classification

- Active code
  - [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts)
  - [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts)
  - [proposalOutput.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalOutput.ts)
  - [voicePresets.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/voicePresets.ts)
- Legacy but informative
  - older LangChain prompt paths under `convex/langchain/`
- Obsolete/dead by default for this issue
  - `pdf-ingest/`
  - `*.bak`
  - archive/backup trees

## Verdict

The system is improved, but it is still not clean enough yet.

The remaining failures are now concentrated and understandable:

1. no-context obedience is still not reliable
2. same-domain fact fidelity is still too loose
3. adjacent/distant transfer still overstates readiness
4. multilingual support is only partial by design
5. final-format obedience still has small gaps

## Findings

### 1. No-context mode is still failing

Observed outputs:

- `signature nocv`
  - "While I may not have prior security experience..."
- `storyteller nocv`
  - "While I may not have direct security experience..."
  - "I am confident in my ability to adapt quickly..."
- `engaging nocv`
  - "Customer service and attention to detail are strengths I’d bring to patrolling..."
  - "I’m adaptable ... and I’m eager to learn any required protocols or technologies..."

Problem:

- The system still allows:
  - invented negative-history disclaimers
  - soft readiness claims
  - pseudo-capability language
- This is still a trust failure, even when it avoids hard fabrication.

Active-code evidence:

- No-context bans exist in [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L199) and [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L688).
- The fact that these phrases still appear means the writer is not reliably obeying the contract.

Conclusion:

- Prompting alone has plateaued here.
- The clean next solution is a tiny backend verifier/repair pass for `context_mode = none`.
- If banned phrases appear, either:
  - reject and regenerate once with a no-context repair instruction
  - or rewrite through a tiny repair prompt that removes all retrospective/capability phrasing

### 2. Same-domain outputs still sharpen facts beyond support

Observed outputs:

- `cv signature`
  - "At Robert Cooper Security Guard..."
- `cv expert`
  - "My experience as a security guard at Robert Cooper Security Guard in Los Angeles..."
- `cv engaging`
  - same invented employer-style name

Problem:

- The CV does not clearly support the employer name `Robert Cooper Security Guard`.
- The model is still synthesizing employer-style names by combining candidate identity with role context.
- Same-domain letters also still import JD-adjacent operational language too easily:
  - `incident response`
  - `access control`
  - stronger monitoring/system ownership wording

Active-code evidence:

- The planner tries to block employer-name synthesis in [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L246).
- The writer guidance also blocks it in [generateProposalMutation.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/generateProposalMutation.ts#L619).
- The fact bank still aggregates coarse snippets in [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L313), which leaves too much paraphrase freedom.

Conclusion:

- The remaining issue is exact claim fidelity.
- The clean next solution is not "less detail." It is tighter fact typing and post-write validation:
  - employer names must come only from exact fact-bank entries
  - JD-adjacent task wording must not appear unless source-backed
  - if the output introduces a named employer or operational detail not present in `allowed_concrete_facts`, repair or retry

### 3. Adjacent and distant transfer are still too literal

Observed outputs:

- `cv signature (job offer veteran)`
  - "supporting veterans and their families"
  - "assist veterans in navigating complex benefits processes"
- `cv engaging veteran`
  - "role that directly serves those who have served our country"
  - "handle complex cases with empathy and precision"
  - still leans toward direct role readiness
- `french job offer in another domain`
  - security/CCTV experience gets translated into video post-production-adjacent fit
- `spanish job offer`
  - security proof is translated into emergency-plan design, data-driven consulting, and consulting-style readiness

Problem:

- The system is still over-translating valid background into target-role competence.
- This is most visible when the target role is:
  - public-service / benefits-related
  - consulting/security-planning
  - creative/media

Active-code evidence:

- Adjacent/distant rules exist in [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L228), [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L396), and [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L518).
- The writer still oversteps them in practice.

Conclusion:

- The next clean fix is a transfer-verifier layer:
  - if `domain_gap = adjacent`, candidate-specific verbs must stay abstract unless directly source-backed
  - if `domain_gap = distant`, block role-domain verbs entirely unless present in `allowed_concrete_facts`
- This should be done as a backend post-check, not by expanding prompt prose again

### 4. Credential and qualification wording are still not fully controlled

Observed risk in current outputs:

- Same-domain security letters trend toward requirement-fit language even when the exact required license/certification is not explicitly proven
- Adjacent-role outputs still risk over-reading criminal-justice education into stronger qualification language

Problem:

- The planner contract has the right enum, but the writer still behaves as if "related" can imply "close enough."

Active-code evidence:

- Credential boundaries exist in [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L209) and [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L521).

Conclusion:

- The clean next solution is phrase-level validation after generation:
  - reject or repair outputs containing:
    - `licensed`
    - `meets the requirement`
    - `holds the required certification`
    - completed-degree language
  - unless the exact claim exists in `allowed_concrete_facts`

### 5. Multilingual support is still only partial by design

Observed outputs:

- French JD -> French output: working
- English JD with isolated French token -> improved
- Spanish JD -> English output

Important finding:

- Spanish output is not failing because of random model drift.
- It is currently impossible by design on the active backend path.

Active-code evidence:

- [proposalOutput.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalOutput.ts#L6) defines only:
  - `English | French`
- [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts#L57) defines only:
  - `en | fr`

Conclusion:

- Current multilingual support is actually bilingual support.
- English/French is partially implemented.
- Spanish is not implemented yet.
- This should be stated clearly at product level instead of being treated as a prompt-quality bug.

### 6. English/French resolver is better but still limited

Observed:

- The previous one-token `résumé` flip is fixed by the new heuristic in [proposalOutput.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalOutput.ts#L112).

Remaining issue:

- The resolver still uses marker heuristics only.
- It is deterministic, but not yet language-general and not yet robust to messy copied job-board text across more than two languages.

Conclusion:

- Good enough for English/French hardening.
- Not a full multilingual solution.

### 7. Small format-fidelity issue still exists

Observed output:

- `cv storyteller` ends with:
  - `Sincerely,`
  - missing final name line

Problem:

- This means final cover-letter formatting is still not fully guaranteed, even though the writer is instructed to include the candidate name line.

Active-code evidence:

- Closing instruction is explicit in [proposalOutput.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalOutput.ts#L163).
- This is another sign that the final prose step can still drift at the last mile.

Conclusion:

- A tiny post-write formatter for cover-letter salutation/closing consistency would clean this up cheaply.

## Root Cause Summary

The current planner architecture is good enough.

The remaining issue is that the final writer still has too much practical freedom, even when the rules are written clearly.

There are now three distinct backend quality gaps:

1. no-context and transfer rules need enforcement, not more wording
2. exact fact fidelity needs post-write validation
3. multilingual beyond English/French is not implemented yet

## Clean Solution Plan

### Track A — Enforce the plan after generation

Add one tiny backend verifier/repair stage after draft generation and before the proposal is accepted.

The verifier should inspect the generated text against the current plan and enforce:

- `context_mode = none`
  - ban negative-history disclaimers
  - ban pseudo-background
  - ban soft acquired-practice phrasing
  - ban tool/process familiarity claims
- `domain_gap = adjacent`
  - allow concrete proof only as evidence of abstract transferable themes
- `domain_gap = distant`
  - ban direct target-domain verbs and operational analogy
- `credential_status`
  - ban exact-required qualification language unless explicitly allowed

This is the cleanest next step because the prompt already says the right things and still is not enough.

### Track B — Tighten exact fact fidelity

Add a narrow fact-fidelity validator:

- every named employer/organization must match an `allowed_concrete_facts` entry
- if the output introduces a named employer, certification, tool, system, or operational responsibility not present in `allowed_concrete_facts`, repair or retry
- block JD-matching operational phrasing unless explicitly source-backed

This directly addresses:

- `Robert Cooper Security Guard`
- visitor-documentation-style inflation
- broadened emergency/system ownership wording

### Track C — Add a tiny cover-letter formatter pass

Before saving the final output:

- ensure salutation matches selected language
- ensure closing matches selected language
- ensure the final name line is present when candidate name is available

This is a cheap cleanup with high user-facing value.

### Track D — Separate bilingual hardening from real multilingual support

1. Short-term
   - keep English/French support deterministic and tested
   - do not imply that multilingual support is solved

2. Next real multilingual step
   - extend output-language support to include at least Spanish
   - update:
     - [proposalOutput.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalOutput.ts)
     - [proposalPlanner.ts](/Volumes/video/kay/app/pouraurelien/save/neyssan/my-app/convex/lib/proposals/proposalPlanner.ts)
   - add Spanish salutation/closing rules
   - add regression tests for Spanish JDs

This should be treated as a product capability addition, not folded into the trust-hardening fix.

## Recommended Execution Order

1. backend verifier/repair for no-context + transfer + credential obedience
2. exact fact-fidelity validator
3. tiny cover-letter formatter cleanup
4. separate Spanish/multilingual expansion thread

## Why this order

- Track A and B fix the current trust issues.
- Track C fixes a visible polish gap cheaply.
- Track D is a real capability expansion and should not be mixed into the trust-hardening work.

