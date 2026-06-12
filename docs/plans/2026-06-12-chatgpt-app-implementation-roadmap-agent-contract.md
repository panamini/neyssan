# PR41 - Agent Implementation Unlock and Verify-Debug-Control Contract

Date: 2026-06-12
Status: proposed implementation contract
Scope: docs-only roadmap/control contract for PR41+ agents after PR40

## 1. Objective

PR41 turns the post-PR40 roadmap into an agent-executable contract.

The purpose is to help agents move Twoweeks forward, not to freeze the project.

Agents must build the smallest safe Twoweeks App SDK/MCP path in order, while preserving the safety boundaries from PR18-PR40.

PR41 adds one mandatory rule to the roadmap:

```txt
After every PR, stop and verify. Debug before moving forward. Never build the next PR on top of a broken, uncertain, or scope-drifting PR.
```

This document is not runtime code.

It does not approve dependency installation.
It does not approve package or lockfile changes.
It does not approve a server skeleton.
It does not approve `/mcp`.
It does not approve `tools/list` or `tools/call` runtime.
It does not approve OAuth, UI, real handlers, real user data, outbound HTTP, LLM calls, export, download, send, submit, apply, or production behavior.

## 2. Product goal

Every roadmap step must serve this Twoweeks product purpose:

```txt
Safe, reviewable, user-approved job application workflows.
```

Agents must not turn this into generic MCP/App SDK experimentation.

The target path is:

1. local fixture-backed App SDK/MCP skeleton;
2. descriptor correctness from PR38;
3. simulated fixture-only tool behavior;
4. verification and negative tests;
5. only later, with explicit approval, real read-only data, UI, auth, and write actions.

## 3. Controlling sources

Agents must treat these prior PRs as controlling constraints:

- PR18-PR33: local MCP fixtures, schema, gates, scaffold, and golden fixtures;
- PR34-PR35: non-production Apps SDK exploration/readiness planning;
- PR36: MCP server architecture boundary;
- PR37: real-data privacy, consent, retention, and audit policy;
- PR38: tool contract mapping from local fixtures to future MCP descriptors;
- PR39: Apps SDK runtime threat model;
- PR40: dependency/package/server skeleton approval checkpoint.

Required repo references before implementing any PR:

```txt
AGENTS.md
docs/plans/2026-06-12-chatgpt-apps-sdk-non-production-exploration-plan.md
docs/decisions/2026-06-12-chatgpt-app-mcp-server-architecture-boundary.md
docs/decisions/2026-06-12-real-data-privacy-consent-retention-audit-policy.md
docs/decisions/2026-06-12-tool-contract-mapping-local-fixtures-to-mcp-descriptors.md
docs/audits/2026-06-12-apps-sdk-runtime-threat-model.md
docs/decisions/2026-06-12-dependency-package-server-skeleton-approval-checkpoint.md
my-app/src/modules/local-mcp/
```

## 4. Current strict limit after PR40

PR40 remains the strict limit before runtime, dependency, or skeleton work.

Until a later PR explicitly satisfies its prerequisites, the following remain blocked:

- dependency installation;
- package.json changes;
- lockfile changes;
- package manager config changes;
- SDK imports;
- server skeleton;
- `/mcp` endpoint;
- `tools/list` runtime;
- `tools/call` runtime;
- transport runtime;
- public tunnel;
- ChatGPT connector setup;
- Developer Mode setup;
- OAuth;
- UI/components/widgets/resources;
- Convex changes for this path;
- real handlers;
- real user data;
- outbound HTTP;
- LLM calls;
- export/download/send/submit/apply;
- production behavior.

Agents must not reinterpret PR40 as permission to implement any blocked surface.

## 5. Allowed roadmap scope

Agents must not invent extra PRs outside this roadmap segment.

The currently authorized PR segment is:

| PR | Title | Type | May touch packages? | May touch runtime? | Main output |
| --- | --- | --- | --- | --- | --- |
| PR41 | Agent implementation unlock and verify-debug-control contract | docs-only | no | no | This contract |
| PR42 | Approved package-only install | package-only | yes, only after PR41 approval and exact package approval | no | Minimal approved dependencies installed and audited |
| PR43 | Disabled local-only server skeleton | code/tests | no new packages unless already approved | no exposed runtime | Disabled-by-default skeleton with no endpoint/listener |
| PR44 | Descriptor adapter tests from PR38 mapping | code/tests | no | no exposed runtime | Static descriptor mapping tests |
| PR45 | Simulated `tools/list` and `tools/call`, fixture-only | code/tests | no | local simulated only | Fixture-only list/call harness, no real handlers |

After PR45, agents must stop and produce a roadmap extension/fix-forward prompt. They must not invent PR46+ unless a later approved roadmap document defines it.

## 6. Per-PR dependency rule

Agents may only start a roadmap PR if all prior required PRs are merged or explicitly approved to build on.

Required order:

```txt
PR41 -> PR42 -> PR43 -> PR44 -> PR45
```

Additional conditions:

- PR42 cannot start unless PR41 is merged or explicitly approved and exact package names are approved by maintainers.
- PR43 cannot start unless PR42 is merged or explicitly approved, package checks are green, and skeleton work is explicitly approved.
- PR44 cannot start unless PR43 is merged or explicitly approved and skeleton constraints are verified.
- PR45 cannot start unless PR44 is merged or explicitly approved and descriptor adapter tests are green.

If any prior PR is red, uncertain, unreviewed, or scope-drifting, the next output must be a fix-forward prompt, not the next roadmap PR.

## 7. Agent execution protocol

For each PR, the agent must:

1. identify the lowest-numbered unmerged roadmap PR;
2. read the controlling PR18-PR40 docs and local MCP fixture files relevant to that PR;
3. decompose the PR into atomic sub-tasks;
4. execute independent checks in parallel where possible;
5. implement only the selected PR;
6. run the verify-debug-control loop;
7. produce the mandatory final PR verification report;
8. stop before starting the next PR unless the continuation rule passes.

Agents must not ask the user what to do next unless:

- credentials are missing;
- repo access is missing;
- exact package approval is missing;
- a business decision is required;
- continuing would violate PR18-PR40.

## 8. Atomic sub-task model

Every PR must be split into atomic sub-tasks.

Common sub-task categories:

- scope inspection;
- changed-file planning;
- code skeleton creation, only for PRs that authorize code;
- descriptor mapping verification against PR38;
- negative prompt enforcement;
- SSRF/outbound request checks;
- LLM token/budget/DoS checks;
- fixture-only/local-only verification;
- regression test execution;
- final report synthesis.

Sub-tasks are independent only when they touch separate concerns and can be checked without hiding risk.

The main agent remains responsible for final synthesis.

## 9. Mandatory verify-debug-control loop

After every PR, the agent must stop and produce a PR verification report before starting the next PR.

The agent is not allowed to continue to the next roadmap PR if any of these are true:

- tests fail;
- typecheck fails;
- lint fails in a relevant way;
- audit/fallow fails in a relevant way;
- CI is red;
- CI is unknown;
- changed files exceed the PR scope;
- runtime behavior changed unexpectedly;
- forbidden PR40 surfaces were touched;
- implementation drifts from PR18-PR40 constraints;
- broad abstractions, framework creep, or speculative code were introduced;
- debugging is still incomplete;
- final report cannot explain exactly what was verified.

If any condition above is true, the agent must debug or stop with a fix-forward prompt.

## 10. Diff review requirements

Each PR verification report must list every changed file.

For each changed file, the agent must explain:

- why the file was allowed;
- which roadmap PR authorized it;
- which PR18-PR40 constraint it maps to;
- why no forbidden surface was touched;
- why the change is not opportunistic cleanup;
- why the change is not an unrelated refactor.

The agent must confirm:

- no forbidden files or surfaces were touched;
- no hidden runtime path was introduced;
- no package or lockfile changed unless the PR explicitly allows it;
- implementation matches only the current PR goal.

## 11. Test execution requirements

After each PR, the agent must run the narrowest relevant checks first.

Required where feasible:

```bash
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Also required when relevant:

- narrow unit tests for changed modules;
- related local-mcp regression tests;
- descriptor/golden fixture tests;
- typecheck;
- lint;
- package audit for package-only PRs;
- CI status inspection and failure log inspection.

Skipped, unavailable, or missing tests must not be reported as success.

They must be reported as uncertainty.

If CI status cannot be inspected, CI is unknown and continuation is blocked unless a maintainer explicitly overrides the CI requirement for that PR.

## 12. Runtime and behavior control requirements

The agent must confirm after every PR:

- no active product behavior changed unless explicitly intended;
- no real data path was introduced;
- no OAuth was introduced;
- no UI/component/widget/resource was introduced;
- no handler was introduced;
- no outbound HTTP was introduced;
- no LLM call was introduced;
- no export/download/send/submit/apply behavior was introduced;
- no production behavior was introduced;
- fixture-only/local-only/disabled-by-default constraints remain true where required.

If the PR intentionally changes behavior, the final report must state exactly which behavior changed and why that PR allowed it.

## 13. Debugging rule

If any test, typecheck, lint, CI, audit, scope, runtime, or gate check fails, the agent must debug before moving on.

The agent must:

- identify root cause;
- avoid symptom-only patches;
- keep fixes inside the same PR scope if possible;
- rerun the failed checks;
- update the final report with failures and fixes.

If fixing requires broader scope, the agent must stop and produce a fix-forward PR prompt instead of continuing the roadmap.

Never start the next feature PR on top of a broken or uncertain PR.

## 14. Regression guard

Before marking a PR done, compare the result against:

- PR18-PR40 constraints;
- PR38 descriptor mapping;
- PR39 runtime threat model;
- PR40 dependency/package/server skeleton checkpoint;
- existing local-mcp fixture tests;
- existing local-mcp golden fixture tests.

The final report must explicitly answer:

```txt
Does this PR still serve safe, reviewable, user-approved job application workflows?
```

If the answer is not clearly yes, the PR is not done.

## 15. Anti-monster rule

Agents must avoid creating a large hidden framework.

Each PR must be:

- small;
- inspectable;
- reversible;
- tested;
- tied to one roadmap goal;
- boring by default.

Agents must not create:

- large platform layers;
- generic frameworks;
- future-proof abstractions;
- agent runtimes;
- speculative registries;
- broad config systems;
- multi-purpose integration layers;
- unrelated cleanup or refactors.

The goal is not to build a monster.

The goal is the smallest safe Twoweeks App SDK/MCP path aligned with the product.

## 16. PR41 scope and acceptance criteria

PR41 is docs-only.

Allowed changed file:

```txt
docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md
```

PR41 passes only if:

- changed file count is exactly 1;
- no `my-app/**` files changed;
- no package or lockfile changed;
- no runtime config changed;
- no dependency installed;
- no server skeleton added;
- no `/mcp` added;
- no `tools/list` or `tools/call` added;
- no OAuth/UI/handler/real-data/outbound/LLM/write behavior added;
- the document includes the mandatory verify-debug-control loop;
- the document includes the final report template;
- the document keeps PR42-PR45 in scope and does not invent PR46+.

## 17. PR42 scope summary

PR42 is package-only and may start only after PR41 approval plus exact maintainer package approval.

Allowed changed files are limited to package and lockfile files approved by maintainers.

PR42 must not add:

- app code;
- SDK imports in application modules;
- server skeleton;
- endpoints;
- transport;
- OAuth;
- UI;
- handlers;
- real data;
- outbound HTTP;
- LLM calls;
- write actions.

PR42 must verify package identity, registry, provenance where available, lifecycle scripts, transitive dependencies, audit output, rollback, and PR40 supply-chain gates.

## 18. PR43 scope summary

PR43 is a disabled local-only server skeleton PR.

It may start only after PR42 is merged or explicitly approved to build on.

Allowed behavior:

- local-only skeleton module;
- disabled by default;
- no listener;
- no route;
- no `/mcp`;
- no `tools/list` exposure;
- no `tools/call` exposure;
- no real handlers;
- no real data.

PR43 must include tests or source guards proving disabled-by-default behavior.

## 19. PR44 scope summary

PR44 adds descriptor adapter tests from PR38 mapping.

Allowed behavior:

- static descriptor mapping checks;
- schema/annotation/metadata assertions;
- comparison against local MCP fixture IDs;
- no network or runtime exposure.

PR44 must prove descriptors remain safe-summary-only, review-only, non-runnable, and non-callable unless a later PR explicitly approves otherwise.

## 20. PR45 scope summary

PR45 adds simulated `tools/list` and `tools/call`, fixture-only.

Allowed behavior:

- local simulated list/call harness;
- fixture-only outputs;
- no real handlers;
- no real data;
- no Convex;
- no outbound HTTP;
- no LLM calls;
- no export/download/send/submit/apply;
- negative prompt refusals;
- unknown tool rejection;
- malformed input rejection.

PR45 must not create production runtime or public endpoint behavior.

## 21. Mandatory final report template

Every PR final report must use this shape:

```md
# PR Verification Report

## PR
- PR number:
- Title:
- Base branch:
- Head branch:
- Commit SHA:

## Files changed
| File | In scope? | Why allowed | Controlling PR/gate |
| --- | --- | --- | --- |

## Scope review
- Changed files match PR goal:
- No opportunistic cleanup:
- No unrelated refactor:
- No broad framework creep:
- No speculative code:

## Tests run
| Command | Result | Notes |
| --- | --- | --- |

## Typecheck
- Command:
- Result:
- Notes:

## Lint/audit/fallow
- Command:
- Result:
- Notes:

## CI
- Status:
- Source checked:
- Failure logs reviewed:
- Unknowns:

## Failures found
- Failure:
- Root cause:
- Fix:
- Re-run result:

## Debugging performed
- What was debugged:
- Root cause confirmed:
- Symptom-only patch avoided:

## PR18-PR40 gates verified
- PR38 descriptor mapping:
- PR39 threat model:
- PR40 dependency/package/server skeleton checkpoint:
- Local MCP fixtures/golden tests:

## Forbidden surfaces confirmed untouched
- package install:
- package.json/lockfile:
- server skeleton:
- `/mcp`:
- `tools/list` runtime:
- `tools/call` runtime:
- OAuth:
- UI/component/widget/resource:
- real handlers:
- real user data:
- outbound HTTP:
- LLM calls:
- export/download/send/submit/apply:
- production behavior:

## Product-purpose alignment
Does this PR still serve safe, reviewable, user-approved job application workflows?

Answer:

## Unresolved uncertainties
- Uncertainty:
- Impact:
- Blocking? yes/no:

## Rollback plan
- Files to delete/revert:
- Commands or steps:

## Continuation decision
- Can the next roadmap PR start? yes/no:
- Reason:
- Exact next PR recommendation:
```

## 22. Continuation rule

The roadmap agent may only continue to the next PR if the previous PR is:

- merged or explicitly approved to build on;
- green in relevant checks;
- verified against scope;
- free of unresolved P0/P1 issues;
- not drifting from the product goal;
- not hiding broad abstractions or framework creep;
- not touching forbidden PR40 surfaces;
- supported by a final report that explains exactly what was verified.

If not, the next output must be a fix-forward prompt, not the next roadmap PR.

## 23. Fix-forward prompt template

When continuation is blocked, the agent must produce this instead of starting the next feature PR:

```txt
Fix-forward required before continuing the Twoweeks App SDK/MCP roadmap.

Blocked PR:
Blocking reason:
Failed/unknown checks:
Scope or gate violated:
Root cause:
Smallest safe fix:
Files likely in scope:
Files forbidden:
Commands to run:
Rollback if fix fails:
Next PR may resume only after:
```

## 24. Final rule

```txt
Build forward, but verify after every step.
Debug before moving on.
Keep every PR small, boring, reversible, and tied to Twoweeks' real product purpose.
```
