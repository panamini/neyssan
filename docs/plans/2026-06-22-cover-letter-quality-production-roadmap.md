---
title: "Cover Letter Quality Production Roadmap"
status: active
created: 2026-06-22
updated: 2026-06-23
source_wiki: "/Volumes/video/git/twoweeks-wiki/wiki/tasks/2026-06-22-cover-letter-quality-production-roadmap.md"
---

# Cover Letter Quality Production Roadmap

## Purpose

Track the code-adjacent execution plan for cover-letter generation quality after PR230-PR245, the post-merge flags-OFF smoke tests, and the first Mistral V2 internal canary.

This plan is only for cover-letter quality. It must stay separate from the Twoweeks MCP / ChatGPT App SDK roadmap and PR80B manual handoff work.

## Workstream Boundary

This document owns:

- premium cover-letter provenance and finalization;
- legacy `cover_letter` prompt routing;
- Mistral premium prompt V2 factuality;
- bounded `qualityShadow` repair, still default-OFF;
- provider-specific cover-letter behavior and tests.

This document does not own:

- MCP / ChatGPT App SDK tools, manifests, handlers, or endpoint exposure;
- OAuth, provider tokens, billing, production App SDK release, or launch gates;
- manual application handoff or PR80B outcome labeling;
- parser / CV ingest, UI, DB schema, deployment, or broad lint cleanup.

Shared branch/base references such as `application-os-foundation` and PR245 are coordination anchors only. They do not mean cover-letter quality and MCP/App SDK work should be implemented in the same PR.

## Current State - 2026-06-23

Current branch line:

```text
application-os-foundation
```

Known current head after PR245:

```text
2ceb98d071b51e87a368dc3d01f33d7ce147f724
```

Overall decision:

```text
Merged baseline with flags OFF: OK
PR246 implementation: draft PR open / ready for real review, not merged
Mistral V2 canary expansion: conditional internal GO after clean review, merge, and post-merge rerun
Quality repair: OFF / NO-GO
Full production GO: NO-GO
Next step: review PR246 diff, merge only if clean, rerun Mistral V2 canary post-merge
```

## Completed PRs / Gates

| Item | Status | Notes |
| --- | --- | --- |
| PR230 | Done | Premium cover-letter final provenance merged. |
| PR231 | Done | Legacy `cover_letter` path no longer uses the generic creative proposal prompt. |
| PR232 | Done, flag OFF | Mistral premium prompt V2 merged behind flags. |
| PR233 | Done, flag OFF | Bounded `qualityShadow` repair merged behind `ENABLE_COVER_LETTER_QUALITY_REPAIR_V1`. |
| PR242 | Done | Lint config boundary fixed; not a full lint cleanup. |
| PR243 | Done | `proposalBodyComposer` evidence-chain contract merged. |
| PR244 | Done | Playwright workflow reached real browser install/test execution. |
| PR245 | Done | GPT premium finalization hardening merged and flags-OFF smoke became clean. |
| First Mistral V2 canary | Done, failed gate | Mistral-large direct V2 produced unsupported detail expansion. |
| PR246 implementation draft | Draft open, not merged | Branch `codex/pr246-mistral-v2-factuality-tightening`; tests and internal/no-DB canary reported clean; review required before merge. |

## What Works With Flags OFF

- GPT premium cover letter: PASS.
- Mistral medium premium with V2 OFF: PASS.
- Mistral large premium with V2 OFF: PASS.
- No-CV Mistral: PASS with safe no-CV provenance.
- Qwen with premium flags OFF: legacy-only path, PASS.
- Quality repair remains disabled.

## Current Blocker

Internal/no-DB canary with Mistral V2 ON and quality repair OFF found that Mistral-large direct V2 generated:

```text
standardizing component usage and versioning
```

The supported CV facts only covered design-system migration across four squads and improved release consistency across shared interface work.

Decision:

```text
Treat this as unsupported candidate-detail expansion.
PR246 tightened Mistral V2 factuality guidance and reran the canary.
Do not merge blindly: review the real diff first.
```

## Current Flags Policy

Keep these OFF/unset outside a controlled internal PR246 validation:

```text
ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2=off
COVER_LETTER_PREMIUM_PROMPT_V2=off
cover_letter_premium_prompt_v2=off
ENABLE_COVER_LETTER_QUALITY_REPAIR_V1=off
```

Allowed only for PR246 internal validation and post-merge internal canary:

- Mistral V2 flags ON in internal/no-DB canary only.
- Quality repair OFF always.
- Qwen premium flags OFF.

## Checklist - Done In PR246 Draft

- [x] Start fresh from `application-os-foundation` at or after `2ceb98d071b51e87a368dc3d01f33d7ce147f724`.
- [x] Create branch `codex/pr246-mistral-v2-factuality-tightening`.
- [x] Confirm the working branch contains only cover-letter quality changes before editing.
- [x] Inspect Mistral V2 prompt guidance in `my-app/convex/lib/proposals/premiumCoverLetter.ts`.
- [x] Add a regression around the unsupported phrase `standardizing component usage and versioning`.
- [x] Prefer prompt-side tightening first.
- [x] Do not add broad post-generation rewrites.
- [x] Do not weaken provenance/finalization guards.
- [x] Do not change GPT/Qwen behavior.
- [x] Do not enable V2 by default.
- [x] Do not enable quality repair.
- [x] Do not include MCP/App SDK roadmap, tools, OAuth, manual handoff, or launch-gate changes.
- [x] Run targeted proposal tests.
- [x] Rerun internal/no-DB Mistral V2 canary matrix.
- [x] Return reported GO for internal canary expansion, subject to review/merge and post-merge rerun.

## Checklist - Next

### PR246 - Review and merge gate

- [ ] Run a real review of the PR246 diff before merge.
- [ ] Confirm the diff touches cover-letter quality only.
- [ ] Confirm the regression test covers the unsupported `standardizing component usage and versioning` expansion.
- [ ] Confirm prompt-side tightening does not add broad post-generation rewriting.
- [ ] Confirm provenance/finalization guards were not weakened.
- [ ] Confirm GPT/Qwen behavior was not changed.
- [ ] Confirm V2 and quality repair remain default-OFF in production.
- [ ] Confirm MCP/App SDK, manual handoff, OAuth, launch gates, parser, UI, DB, and deployment were not touched.
- [ ] If review is clean, merge PR246.
- [ ] After merge, rerun the same targeted tests and internal/no-DB Mistral V2 canary matrix.
- [ ] If post-merge canary is clean, proceed to limited internal Mistral V2 expansion.

Acceptance criteria:

- [x] Mistral-large direct V2 no longer expands `design-system migration` into unsupported component/versioning details in the reported PR246 canary.
- [x] Direct-match cases stay narrow and CV-backed in the reported PR246 canary.
- [x] Adjacent/distant cases still preserve factual-overlap framing in the reported PR246 canary.
- [x] No-CV still does not invent candidate evidence in the reported PR246 canary.
- [x] GPT does not receive V2.
- [x] Qwen remains unaffected / legacy with flags OFF.
- [x] Quality repair remains disabled.
- [x] Targeted tests reported pass.
- [x] PR246 canary rerun table reported clean.
- [ ] Independent review confirms the diff.
- [ ] Post-merge rerun confirms the same result.

### Internal Mistral V2 expansion after PR246 merge

- [ ] Keep Mistral V2 internal/staging only.
- [ ] Run 3-5 additional internal generations for `mistral-medium-latest`.
- [ ] Run 3-5 additional internal generations for `mistral-large-latest`.
- [ ] Compare against V1 baseline for specificity, unsupported claims, finalization, provenance, latency/cost.
- [ ] Decide whether to expand internal canary or keep on hold.
- [ ] Do not enable production without a separate release decision.

### Quality Repair Later - Not Now

- [ ] Keep `ENABLE_COVER_LETTER_QUALITY_REPAIR_V1=off`.
- [ ] Create a separate canary plan only after Mistral V2 is stable or explicitly deferred.
- [ ] Verify extra model-call cost and latency.
- [ ] Verify cancellation path.
- [ ] Verify repair never changes provenance into unsupported candidate claims.
- [ ] Verify no-CV and legacy-wrapped outputs do not repair.

### Qwen Premium Later - Not Now

- [ ] Keep Qwen premium flags OFF.
- [ ] If Qwen premium is desired later, create a separate PR for schema/body-parts compatibility.
- [ ] Do not mix Qwen premium work with Mistral V2 or quality repair.

### Production Release Later

- [ ] Define production rollout separately.
- [ ] Verify staging deploy.
- [ ] Verify smoke in deployed environment.
- [ ] Keep rollback flags documented.
- [ ] Monitor finalization failures, unsupported-claim reports, provider schema failures, latency/cost, and regeneration rates.

## Suggested Commands for PR246

Run from `my-app` unless repo instructions say otherwise:

```bash
git diff --check
npx vitest run convex/lib/proposals/__tests__/premiumCoverLetter.test.ts convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts
npx vitest run convex/lib/proposals/__tests__
```

Use the repo's required command wrapper when executing locally.

## Current Next Smallest Step

```text
Review the PR246 diff, merge only if clean, then rerun targeted tests and the same internal/no-DB Mistral V2 canary post-merge.
```
