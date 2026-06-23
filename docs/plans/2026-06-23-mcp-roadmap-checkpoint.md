# Twoweeks MCP/App SDK Roadmap Checkpoint

Date: 2026-06-23
Branch: `codex/mcp-roadmap-checkpoint`
Base branch: `application-os-foundation`
Base checkpoint after PR245: `2ceb98d071b51e87a368dc3d01f33d7ce147f724`
Status: `CORRECTED_CHECKPOINT`

## Correction

The previous draft of this checkpoint was wrong.

It treated MCP as if it were only an early placeholder client. That is not the actual project state.

The actual project is the Twoweeks ChatGPT/App SDK / MCP product: a full tool surface intended to be accessible from ChatGPT/Codex-style agents to review Twoweeks application data, generate professional job-application artifacts, support human approval, export/download/send/apply flows, and eventually run with auth, consent, audit, privacy, rate limits, rollback, and production monitoring.

Canonical sources to use from now on:

```txt
docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md
docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
```

Do not use `my-app/src/services/mcp-client.ts` as the roadmap source of truth. That old client placeholder is not the actual progress ledger.

## Roadmap definition

The canonical roadmap spans PR41 through PR89.

High-level roadmap milestones:

```txt
PR41-PR52  -> first working non-production ChatGPT/MCP demo
PR53-PR64  -> useful real read-only ChatGPT integration
PR65-PR67  -> ChatGPT UI/component experience
PR68-PR75  -> artifact generation and export boundaries
PR76-PR80  -> send/submit/apply write-action foundations
PR81-PR89  -> production readiness, beta, and business launch
```

The long-term finished product is not a placeholder MCP client. It is a Twoweeks ChatGPT/App SDK integration that can safely:

```txt
1. expose Twoweeks tools to ChatGPT/Codex-style agents;
2. summarize and review real Twoweeks application data;
3. generate professional resume, cover-letter, application-message, and package artifacts;
4. require human approval before risky or outward actions;
5. export/download/send/apply only with explicit confirmation;
6. run with audit, privacy, auth, rate limits, rollback, and production monitoring.
```

## Current actual position

As of this checkpoint, `application-os-foundation` is after PR245:

```txt
PR245: Harden GPT premium cover-letter finalization
Merge SHA: 2ceb98d071b51e87a368dc3d01f33d7ce147f724
```

PR245 was a release-trouble fix, not a roadmap reset.

The MCP/App SDK roadmap is already far past the early PR41-PR64 phases.

## What is already merged from the MCP/App SDK roadmap

### Foundation and local demo

```txt
PR41-PR52: merged
```

Includes:

- canonical roadmap/agent contract;
- package and dependency boundaries;
- local disabled MCP skeleton;
- descriptor registry;
- fixture-only `tools/list` and `tools/call` simulations;
- golden safety tests;
- local dev transport and `/mcp` endpoint behind flag;
- fake ChatGPT end-to-end demo.

### Auth, consent, audit, privacy, and real read-only data

```txt
PR53-PR64: merged
```

Important merged milestones:

- PR59 read-only Twoweeks data adapter merged via GitHub #185.
- PR60 real application package summary merged via GitHub #186.
- PR61 real evidence graph summary merged via GitHub #187.
- PR62 real resume variant plan summary merged via GitHub #188.
- PR63 real review cockpit summary merged via GitHub #189.
- PR64 real read-only E2E ChatGPT-style harness merged via GitHub #190.

This means the roadmap has already crossed the first genuinely useful real-data read-only integration milestone.

### ChatGPT component / UI policy

```txt
PR65-PR67: merged
```

Includes:

- component data policy;
- read-only review component contract;
- error/loading/refusal UX states;
- `_meta` explicitly not treated as a privacy boundary.

### Artifact generation, approval, revision, and export boundaries

```txt
PR68-PR75: merged
```

Includes:

- generated artifact boundary;
- resume variant preview;
- cover-letter/application-message preview;
- human approval workflow;
- artifact revision loop;
- export/download policy;
- resume export representation;
- cover-letter/application-package export representation.

### Write-action foundations and manual handoff path

```txt
PR76-PR80B-follow-up: merged
```

Includes:

- write-action framework;
- outbound egress/SSRF protection policy;
- controlled application-message send boundary;
- job-platform submit/apply dry-run;
- durable live external-action safety foundation;
- safe manual application handoff while ATS authorization is pending;
- approved manual-handoff artifact delivery.

Important blockers that remain from this area:

```txt
PR80-live submit/apply: BLOCKED
Approved answer copy: BLOCKED
```

### Production-readiness hardening already done

```txt
PR81-PR85: merged
```

Includes:

- manual handoff rate/budget/abuse protection;
- MCP/Stytch config/account-link hardening;
- observability and incident-response helpers/runbook;
- owner/profile boundary hardening;
- Stripe test-mode boundary and internal test access.

### PR86 / PR87 state

PR86 founder smoke/pre-launch audit merged but recorded blockers.

PR87 production deployment gate exists and returned `BLOCKED_PRODUCTION_GATE`.

Known production blockers from PR87 history:

```txt
- production build was red at the first PR87 gate;
- lint had boundary/debt blockers;
- runtime dependency audit was red;
- preview/staging target was not fully proven;
- MCP production runtime was not deployable;
- signed-in smoke was missing;
- runtime observability and rollback were not fully proven;
- PR88 private beta and PR89 public launch remain blocked.
```

Follow-up PRs improved parts of this:

```txt
PR87.5: production TypeScript build follow-up
PR87.6: TS6307 project-membership build fix
PR87.7/PR242-PR245 release trouble fixes around lint boundary, Playwright, proposal body contract, cover-letter stack, and GPT finalization
```

Current release-trouble status after PR245:

```txt
GPT premium cover letter flags OFF: PASS
Mistral medium premium V2 OFF: PASS
Mistral large premium V2 OFF: PASS
No-CV Mistral: PASS
Qwen flags OFF legacy path: PASS
Mistral V2 canary: small internal only
Quality repair: OFF / NO-GO
Full production GO: not yet
```

## Correct current roadmap status

```txt
Roadmap stage: PR87 / production deployment gate and release stabilization
Not at: early MCP skeleton
Not at: PR59 preflight
Not at: PR64 read-only E2E
```

The system is already a broad local-MCP/App SDK implementation with real read-only summaries, local component contracts, artifact preview/export boundaries, manual handoff foundations, rate limits, security/owner-boundary hardening, and release-gate work.

The next work is not “start MCP.”

The next work is to finish stabilization and production gate readiness without losing the roadmap state.

## Immediate do-not-touch list while current troubles settle

Do not start these until explicitly approved:

```txt
- broad lint cleanup;
- quality repair enablement;
- full production launch;
- PR88 private beta;
- PR89 public launch;
- PR80-live provider submit/apply;
- approved answer-copy implementation;
- production billing beyond existing Stripe test-mode boundary;
- broad OAuth/token/provider runtime expansion;
- browser automation or live ATS submission;
- package/lockfile changes outside a specific approved PR.
```

## Remaining tasks checklist after current troubles are quiet

### A. Close the current release trouble loop

- [ ] Keep quality repair OFF.
- [ ] Run only a small internal Mistral V2 canary.
- [ ] Record Mistral V2 canary results with exact telemetry/outcomes.
- [ ] If Mistral V2 canary fails, revert/disable without touching quality repair.
- [ ] If Mistral V2 canary passes, decide whether it remains internal-only or expands gradually.
- [ ] Do not treat GPT/Mistral/Qwen flags-off smoke as production launch approval.

### B. Reconcile PR87 production gate status

- [ ] Update `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md` after PR242-PR245.
- [ ] State the exact current `application-os-foundation` SHA.
- [ ] State which PR87 blockers are now fixed.
- [ ] State which PR87 blockers remain.
- [ ] Confirm whether build is green on current `application-os-foundation`.
- [ ] Confirm whether lint is still red and whether it is blocking PR88/PR89.
- [ ] Confirm whether npm audit/runtime dependency audit is still red.
- [ ] Confirm signed-in smoke status.
- [ ] Confirm preview/staging target status.
- [ ] Confirm rollback/kill-switch status.

Recommended next roadmap PR after canary is quiet:

```txt
PR87.8 - Production Gate Reconciliation After PR245
Type: docs/test/status PR first, code only if one narrow blocker is proven
```

### C. Keep the MCP/App SDK product state accurate

- [ ] Treat the canonical roadmap and progress ledger as source of truth.
- [ ] Do not infer MCP state from old `my-app/src/services/mcp-client.ts` alone.
- [ ] Verify actual local-MCP modules and tests before any new MCP work.
- [ ] For each future PR, generate a PR-local implementation brief from the canonical roadmap, ledger, repo state, and GitHub PR state.
- [ ] Do not invent new PR numbers or reorder the roadmap.

### D. Blocked product areas that need decisions or prerequisites

#### PR80-live submit/apply

- [ ] Provider authorization exists.
- [ ] Credentials exist in safe env only.
- [ ] Test tenant exists.
- [ ] Test posting exists.
- [ ] No browser automation unless separately approved.
- [ ] No live submit/apply before final preview, confirmation, idempotency, audit, rollback, and provider-specific safety review.

#### Approved answer copy

- [ ] Authoritative owner-scoped approved answer source exists.
- [ ] Answer is tied to exact provider question/prompt.
- [ ] Human approval state is fresh.
- [ ] Source model has retention/delete policy.
- [ ] Copy card/export logic uses only that authoritative source.

#### Production billing / entitlements

- [ ] Founder-approved production pricing/product mode.
- [ ] Plan names and tiers.
- [ ] Production payment provider decision.
- [ ] Checkout/webhook/subscription source-of-truth design.
- [ ] Entitlement source and revocation model.
- [ ] Retention and privacy model for billing records.

#### PR88 / PR89 launch

- [ ] Production gate closed.
- [ ] CI/build/lint/audit gates acceptable or explicitly waived with evidence.
- [ ] Staging/preview and signed-in smoke pass.
- [ ] Runtime monitoring and incident response ready.
- [ ] Kill switches verified.
- [ ] Rollback plan verified.
- [ ] Feature flags set intentionally.
- [ ] Quality repair remains OFF unless separately approved.

## Standing per-PR agent rule

Before implementing any roadmap PR, create a PR-local implementation brief derived from:

```txt
AGENTS.md
canonical roadmap
roadmap progress ledger
current repo files
current GitHub PR state
merged decisions
```

The PR-local brief must include:

```txt
- current PR number and title;
- base branch and proposed branch name;
- exact roadmap section controlling the PR;
- merged decisions that narrow or constrain the PR;
- files to read before coding;
- files proposed to touch;
- files forbidden to touch;
- exact allowed scope;
- exact forbidden scope;
- expected tests;
- expected grep/source guards;
- acceptance criteria;
- rollback plan;
- READY_TO_IMPLEMENT or BLOCKED.
```

For high-risk PRs, stop after the PR-local brief and wait for maintainer approval.

High-risk includes:

```txt
- real data selectors;
- OAuth/auth/token changes;
- Convex reads/writes;
- handlers;
- production connector/runtime;
- export/download/send/submit/apply;
- live provider actions;
- package/lockfile changes;
- security/privacy gates;
- production deployment gates.
```

## Correct next action

Do not merge this document as “new roadmap.”

Merge only as a corrected checkpoint if it accurately records current reality.

Then, after current cover-letter/canary trouble is quiet, run:

```txt
PR87.8 - Production Gate Reconciliation After PR245
```

That PR should update the ledger and answer:

```txt
What is still blocking PR88/private beta and PR89/public business launch now that PR245 and flags-off smoke are green?
```
