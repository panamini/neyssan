---
name: cover_letter_prompt_v1
description: Premium cover letter prompt engineering - V1 shipped with banned-stems guardrails
type: project
---

V1 prompt changes shipped to `convex/lib/proposals/premiumCoverLetter.ts` on 2026-03-19.

**Why:** Benchmark (6 cases, `gpt-5.4`, `gpt-5-mini` evaluator) showed ~4/5 average scores but mechanical style - meta-analytical `employerValueBlock` paragraphs and repetitive close stems were the main problems.

**Changes applied:**
1. Global framing line before `presetGuidance` - scoped to `cv_direct` + `cv_adjacent` only (`no_cv` left alone)
2. `cv_adjacent` rule - behavioral phrasing ("what this background helps with") replacing structural prohibition
3. `EmployerValueBlock` - "move directly to an employer-facing implication... natural continuation of the proof" replacing "explain why that evidence matters"
4. `CloseLine` - "role-specific and situational, vary the shape each time" replacing bare "without repeating"
5. `expert` preset - "embedded in natural letter prose, not a stand-alone analytical sentence" replacing "one measured analytical sentence about the role's workflow"
6. `signature` preset - "continue naturally from the evidence" replacing "follow with one grounded employer-facing relevance sentence"

**Result:** Scores held (4/5 average), `strong-adjacent` meta-paragraph eliminated, `weak-direct` and `strong-direct` `employerValueBlock` improved. `ops-admin` still scores 3 - thin evidence problem, not prompt.

**Banned stems status:** Explicit banned stems are already included in the shipped prompt update ("That combination", "Applied to", "Applied in", "Applied here", "That kind of", "That background", and restricted close stems).

**How to apply:** Before any future prompt tuning, run the full 6-case benchmark first as baseline. Command:

```bash
cd /Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app
npx tsx scripts/evals/benchmark-cover-letter-writers.ts \
  --cases=security-hyatt,ops-admin,adjacent-warehouse,weak-direct-checklist-risk,strong-adjacent-honest-transfer,strong-direct-ranking-conflict \
  --writers=gpt-5.4 --evaluator=gpt-5-mini
```
