# Voice Preset Output Audit

Date: 2026-03-13

Scope:
- Audit generated proposal samples only
- No code changes
- Focus on preset differentiation and factual safety

Classification:
- Active product behavior: yes
- Legacy but informative code: not required for this audit
- Obsolete/dead code: not assessed here

## Inputs reviewed

- `signature`
- `expert`
- `direct`
- `engaging`
- `storyteller`
- `no CV` variants for the same five presets

## Findings

### 1. `Signature` is the healthiest baseline

`Signature` is still the most balanced output in the set.

What is working:
- It preserves useful source-backed specifics such as the `73%` theft reduction and the `15 360-degree CCTV cameras`.
- It stays readable and professional.
- It does not over-index on gimmicky tone behavior.

Residual issue:
- It still contains stock phrasing such as `I’m excited to apply` and `resonates with my approach`.

### 2. `Expert` is acceptable but still somewhat template-like

`Expert` is more structured and competence-led than the others, which is good.

What is working:
- It foregrounds evidence and operational relevance more clearly than `engaging` or `storyteller`.
- It keeps concrete details in the body.

Residual issue:
- It opens with `I am writing to express my interest`, which is exactly the kind of generic cover-letter phrasing the product is trying to reduce.
- It still borrows some role-fit language straight from the job description, which weakens the perceptible distinction from `signature`.

### 3. `Direct` is still not direct enough

`Direct` remains too close to `signature`.

Symptoms:
- It still opens with `I’m excited to apply`.
- It still spends too much time on introductory framing before moving into fit and contribution.
- The paragraph rhythm is still conventional cover-letter rhythm rather than noticeably tighter communication.

What is working:
- It keeps concrete source-backed evidence.

What is still missing:
- Faster entry into the strongest supported proof point.
- Less throat-clearing and less ceremonial politeness.
- Shorter sentence rhythm that is visibly different from `signature`.

### 4. `Engaging` is warmer, but still too template-like

`Engaging` is somewhat more perceptible than before, but it still reads like a standard application letter with warmer phrasing.

Symptoms:
- It still opens with `I’m excited to apply`.
- `What draws me to this opportunity...` is more human than some alternatives, but still close to stock cover-letter language.
- The body still leans on generic application patterns instead of a more naturally interpersonal voice.

What is working:
- It does show more collaboration and team-environment cues than `signature`.

What is still missing:
- More natural interpersonal warmth.
- Less templated enthusiasm.
- A clearer sense of “future colleague” rather than “applicant following a script”.

### 5. `Storyteller` is still under-differentiated

`Storyteller` is still too close to a normal cover letter.

Symptoms:
- It does not create a clearly stronger past -> present -> target-role trajectory than `signature`.
- The second paragraph is still just an accomplishment paragraph rather than a visible continuity paragraph.
- The output reads more like a standard evidence-led letter than a more coherent narrative letter.

What is working:
- It does not become theatrical or flowery.

What is still missing:
- Stronger transition logic.
- More explicit continuity between previous experience, present motivation, and next-step fit.
- Better narrative linkage without changing format.

### 6. Source-backed specificity is generally preserved in the CV-backed outputs

The good part of the current tuning pass is visible here: the CV-backed set does preserve useful concrete details.

Good examples:
- `73%` theft reduction
- `15 360-degree CCTV cameras`
- hotel / surveillance context

Residual issue:
- Some lines still slightly upgrade or broaden a concrete detail into a more general operational claim, such as moving from a source-backed surveillance result toward broader statements about access control, emergency response, or operational alignment when those do not appear to be directly supported.

### 7. The `no CV` results are not valid evidence for preset quality yet

The `no CV` outputs indicate a separate blocker: the system appears to be loading an old default profile named `f` instead of a truly blank candidate context.

Why this matters:
- These outputs are not actually testing blank-CV behavior.
- They introduce fabricated specifics that cannot be trusted as a preset-quality signal.

Examples from the `no CV` set that appear unsupported:
- `reducing unauthorized entry incidents by 20%`
- `implemented a visitor management system`
- `trained staff on emergency response protocols`
- `improved incident response times by 20%`
- `fluency in English`
- `computer literacy`

This is a data-loading / fallback-context issue, not just a tone issue.

## Conclusion

The preset architecture remains sound, and the current backend tuning has improved factual safety and preserved more useful source-backed detail.

However:
- `direct` is still not direct enough
- `engaging` is still too template-like
- `storyteller` is still under-differentiated

The next safe tuning pass should stay narrow and focus on:
- reducing generic openings and stock enthusiasm formulas
- pushing `direct` to move into fit and proof faster
- making `engaging` feel more naturally interpersonal
- making `storyteller` express continuity more explicitly
- preserving exact source-backed detail while continuing to block unsupported expansion

Separately, the `no CV` path should be verified because the current samples strongly suggest that blank-context generation is being contaminated by a default profile.
