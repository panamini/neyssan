# PR30 - ChatGPT App End-to-end Safety Audit

Date: 2026-06-11
Status: review audit
Scope: docs-only safety audit across PR18-PR29 before any non-production prototype scaffold.

## 1. Objective

Audit the PR18-PR29 ChatGPT App / Local MCP safety chain before any PR31 scaffold work.

PR30 is a review document only.
It does not add code.
It does not add tests.
It does not add runtime.
It does not start the prototype.

Goal:

- confirm there is no approved execution path;
- confirm PR31 remains non-production only;
- identify gates that still block production, remote, OAuth, handler, UI, and outbound actions;
- preserve the PR27.1 rule that internal review is not runtime permission.

## 2. Verdict

Certain:

- PR18-PR29 define descriptors, envelopes, gates, copy, privacy fixtures, visibility rules, review plans, and a static manifest draft.
- PR18-PR29 do not approve a production ChatGPT App.
- PR18-PR29 do not approve a remote MCP server.
- PR18-PR29 do not approve real handlers.
- PR18-PR29 do not approve OAuth.
- PR18-PR29 do not approve UI/components/resources.
- PR18-PR29 do not approve export, download, send, submit, apply, or auto-apply.
- PR31 may start only after explicit approval and only as a non-production fixture-backed scaffold.

PR30 result:

```txt
Review passes for a constrained PR31 scaffold plan.
Production remains blocked.
Runtime remains blocked.
Remote exposure remains blocked.
Real user data remains blocked.
Outbound actions remain blocked.
```

## 3. Audit boundary

### Allowed in PR30

- audit documents and existing safety boundaries;
- list pass/fail evidence;
- define PR31 entry criteria;
- define remaining blockers;
- define rollback expectations;
- document verification commands.

### Forbidden in PR30

- no code;
- no `my-app/**` changes;
- no package or lockfile changes;
- no manifest JSON;
- no Apps SDK install;
- no MCP SDK install;
- no server;
- no route;
- no transport;
- no OAuth;
- no handler;
- no Convex function;
- no UI;
- no component;
- no resource;
- no export, download, send, submit, apply, or auto-apply.

## 4. Audit corpus

| Source | What it provides | Audit result | Blocks |
| --- | --- | --- | --- |
| PR18 schema projection | safe projected tool descriptors | pass as descriptor shape only | runtime `tools/list` |
| PR19 call envelope | non-executable local call shape and safe errors | pass as envelope only | JSON-RPC / tool execution |
| PR20 approval/audit | approval request and audit shells | pass as model only | persistent audit / real approval UI |
| PR21 handler boundary | future handler contract | pass as design-only | real handlers |
| PR22 remote transport spike | disabled non-production preflight model | pass as disabled/reference-only | remote transport runtime |
| PR23 UX/privacy spec | consent, privacy, refusal and rollback UX | pass as spec only | ChatGPT App submission |
| PR24 privacy fixtures | sentinel redaction assertions and forbidden classes | pass as fixture proof only | semantic privacy guarantee |
| PR25 visibility policy | hidden-by-default policy states | pass as policy gate | callable listing |
| PR26 approval UX copy | exact short copy fixtures | pass as copy source | improvised copy |
| PR27 privacy review gate | conservative gate statuses | pass as review gate | runtime permission |
| PR27.1 gate hardening | fail-closed and bounded review outputs | pass as mandatory gate | executable interpretation |
| PR28 prototype plan | Plan/Build/Deploy boundary and future PR gates | pass as plan only | prototype code |
| PR29 manifest draft | local-only static manifest policy | pass as draft only | real manifest artifact |

## 5. P0 safety findings

No P0 release blocker found inside the docs-only PR18-PR29 sequence.

Reason:

- no runtime ChatGPT App exists;
- no remote MCP server exists;
- no real handler exists;
- no OAuth config exists;
- no UI/component/resource exists;
- no export/send/submit/apply path exists;
- no raw user data surface is approved.

P0 remains blocked for any future runtime if one of these appears without a new review:

- private fact exposure;
- `never_use` fact exposure;
- raw resume/CV exposure;
- raw source document exposure;
- complete generated artifact exposure in a generic tool result;
- approval bypass;
- missing audit for executable action;
- remote transport enabled;
- handler executed;
- export/send/submit/apply exposed.

## 6. P1 safety findings

P1 risks remain for PR31 and later.

| Risk | Current state | Required before runtime |
| --- | --- | --- |
| `ready_for_internal_review` misread as runnable | blocked by PR27.1/PR28/PR29 wording | keep wording in scaffold tests/docs |
| fixture output grows into real output | blocked by PR24/PR27.1 | fixture-only scaffold, no real data |
| manifest draft becomes real config | blocked by PR29 | no manifest JSON in PR31 unless separately approved |
| component placeholder becomes UI | blocked by PR29 | no component/resource unless separate UI review |
| disabled transport becomes listener | blocked by PR22/PR28/PR29 | no network listener in PR31 |
| handler boundary becomes execution | blocked by PR21 | no handler registry or execution in PR31 |
| approval/audit shell mistaken for persistence | blocked by PR20 | persistent audit design required later |

## 7. Execution path audit

| Execution surface | Current approved state | PR30 decision |
| --- | --- | --- |
| ChatGPT App connection | none | blocked |
| Apps SDK server | none | blocked |
| MCP server | none | blocked |
| JSON-RPC runtime | none | blocked |
| HTTP/SSE/WebSocket/Streamable HTTP | none | blocked |
| OAuth/auth | future required only | blocked |
| tool handler | design-only boundary | blocked |
| handler registry | none | blocked |
| Convex persistence | none | blocked |
| UI route/page/component | none | blocked |
| component resource / iframe | none | blocked |
| export/download/send/submit/apply | none | blocked |

Conclusion:

```txt
No approved execution path exists.
```

## 8. Data exposure audit

| Data class | Outside Twoweeks in PR31 scaffold | Decision |
| --- | --- | --- |
| tool status | fixture-only safe summary | allowed after PR27.1 review state |
| visibility state | fixture-only safe summary | allowed |
| approval status | fixture-only safe summary | allowed |
| audit status | fixture-only safe summary | allowed |
| risk flag | fixture-only safe summary | allowed |
| safe summary | fixture-only bounded string | allowed |
| artifact ID | fake placeholder only | allowed |
| raw source document | never | blocked |
| raw resume/CV text | never | blocked |
| raw cover letter text | never | blocked |
| raw job description | never | blocked |
| private fact | never | blocked |
| `never_use` fact | never | blocked |
| source quote dump | never | blocked |
| complete generated resume | never in generic tool result | blocked |
| complete generated cover letter | never in generic tool result | blocked |
| raw arguments | never | blocked |
| user/session ID | never | blocked |
| origin/host payload | never | blocked |
| token/secret | never | blocked |
| stack trace | never | blocked |

Conclusion:

```txt
PR31 must be fixture-backed and safe-summary-only.
```

## 9. Tool-level audit

Candidate planning tools remain the PR18 descriptor names only:

```txt
twoweeks.application_package.summarize
twoweeks.evidence_graph.summarize
twoweeks.resume_variant_plan.summarize
twoweeks.review_cockpit.summarize
```

All four share the same PR30 decision:

- hidden by default;
- non-runnable;
- no handler;
- no transport;
- no real data;
- no raw output;
- no generated full text;
- no export/download/send/submit/apply;
- PR27.1 review state required before any exposed scaffold state.

## 10. PR27.1 gate audit

PR27.1 remains the most important gate for PR31.

Allowed gate statuses in planning:

```txt
blocked
review_required
ready_for_internal_review
```

Required interpretation:

```txt
ready_for_internal_review = Review first. Nothing runs.
```

Forbidden interpretations:

```txt
ready_for_production
ready_to_execute
ready_for_chatgpt
approved_for_remote
safe_to_run
```

PR31 must not use a PR27.1 pass as:

- runtime permission;
- handler permission;
- transport permission;
- ChatGPT App permission;
- production readiness;
- user-data permission;
- outbound-action permission.

## 11. Copy and UX audit

Approved future copy source:

- PR23 UX/privacy spec;
- PR26 approval UX copy fixtures;
- PR27.1 safe summaries;
- PR28/PR29 review-only wording.

Required tone:

- short;
- direct;
- no hype;
- no filler;
- no executable readiness language.

Allowed example copy:

```txt
Blocked. Review privacy.
Approval required.
Denied. Nothing ran.
Audit unavailable. Tool blocked.
No handler yet.
Remote tools disabled.
Ready for internal review. No handler executed.
Dry run only.
Safe summary only.
```

Forbidden copy:

```txt
Ready to run.
Production ready.
Connected to ChatGPT.
Automatically approved.
Seamless workflow.
Apply now.
Send now.
Export complete.
```

## 12. PR31 entry criteria

PR31 may start only if all of these remain true:

1. PR30 is merged.
2. PR31 is explicitly approved.
3. PR31 is non-production only.
4. PR31 uses fixture-backed data only.
5. PR31 adds no real handler.
6. PR31 adds no real user data path.
7. PR31 adds no production transport.
8. PR31 adds no OAuth.
9. PR31 adds no export/download/send/submit/apply.
10. PR31 keeps tools hidden or disabled by default.
11. PR31 treats PR27.1 as review evidence only.
12. PR31 includes rollback/kill-switch instructions.
13. PR31 verification proves no forbidden runtime surface appears.

## 13. PR31 allowed shape

Allowed after explicit approval:

- fixture-only scaffold;
- static mock data;
- local-only review surface;
- no network listener;
- no ChatGPT connection;
- no real manifest submission;
- no real handler;
- no raw user data;
- no persistent audit;
- no outbound actions.

PR31 should be easy to delete.

## 14. PR31 forbidden shape

PR31 must not add:

- Apps SDK dependency;
- MCP SDK dependency;
- production manifest;
- public endpoint;
- remote transport listener;
- OAuth credentials;
- real session auth;
- handler registry;
- Convex writes;
- generated resume/cover letter output;
- export/download/send/submit/apply path;
- scraping;
- UI route/component/resource unless separately approved.

## 15. Production blockers after PR30

Production remains blocked by design.

Before any production or ChatGPT submission, separate reviews are still required:

- security review;
- privacy review;
- legal/data review if needed;
- OAuth/auth review;
- remote transport review;
- persistent audit review;
- handler/idempotency review;
- rollback/incident review;
- rate-limit and quota review;
- prompt-injection review;
- private fact exposure tests;
- `never_use` exposure tests;
- raw source exposure tests;
- approval-denial tests;
- disable/kill-switch tests;
- user consent review;
- component/resource review;
- app submission review.

One missing review blocks production.

## 16. Acceptance criteria for PR30

PR30 passes only if:

- changed file count is exactly 1;
- changed file is `docs/audits/2026-06-11-chatgpt-app-end-to-end-safety-audit.md`;
- no files under `my-app/` changed;
- no package files changed;
- no lockfiles changed;
- no runtime manifest file added;
- no Apps SDK or MCP SDK dependency added;
- no server, route, transport, OAuth, handler, UI, component, resource, Convex, export, download, send, submit, apply, or auto-apply added;
- audit says production remains blocked;
- audit says runtime remains blocked;
- audit says PR31 requires explicit approval;
- audit says PR27.1 review state is not runtime permission.

## 17. Verification

Documentation/manual inspection only. No runtime execution.

Run:

```bash
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected changed file list:

```txt
docs/audits/2026-06-11-chatgpt-app-end-to-end-safety-audit.md
```

Do not run app tests unless repository policy requires it.

Manual checks:

- confirm no `my-app/**` files changed;
- confirm no package or lockfile changed;
- confirm no manifest JSON added;
- confirm no runtime, SDK, server, route, transport, OAuth, handler, UI, component, resource, Convex, export, download, send, submit, apply, or auto-apply surface is added;
- confirm PR27.1 remains review-only;
- confirm PR31 is still gated by explicit approval.

## 18. PR body draft

Summary:

- Adds a docs-only PR30 end-to-end safety audit for PR18-PR29.
- Confirms no approved execution path exists yet.
- Keeps production, runtime, remote exposure, real handlers, OAuth, real data, UI/components, and outbound actions blocked.
- Defines strict PR31 entry criteria for a future non-production fixture-backed scaffold.

Verification:

```txt
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected changed files:

```txt
docs/audits/2026-06-11-chatgpt-app-end-to-end-safety-audit.md
```

## 19. References

- PR18: `docs/decisions/2026-06-11-mcp-schema-projection.md`
- PR19: `docs/decisions/2026-06-11-mcp-call-envelope-error-contract.md`
- PR20: `docs/decisions/2026-06-11-mcp-approval-audit-boundary.md`
- PR21: `docs/decisions/2026-06-11-mcp-real-handler-boundary-design.md`
- PR22: `docs/decisions/2026-06-11-mcp-remote-transport-spike.md`
- PR23: `docs/plans/2026-06-11-chatgpt-app-ux-privacy-spec.md`
- PR24: `docs/decisions/2026-06-11-mcp-privacy-redaction-fixtures.md`
- PR25: `docs/decisions/2026-06-11-mcp-tool-visibility-policy.md`
- PR26: `docs/decisions/2026-06-11-mcp-approval-ux-copy-fixtures.md`
- PR27: `docs/decisions/2026-06-11-mcp-privacy-review-gate.md`
- PR27.1: `my-app/src/modules/local-mcp/mcpPrivacyReviewGate.ts`
- PR28: `docs/plans/2026-06-11-chatgpt-app-non-production-prototype-plan.md`
- PR29: `docs/plans/2026-06-11-chatgpt-app-local-only-manifest-draft.md`
- Twoweeks brand voice: `twoweeks-wiki/wiki/design/brand-voice.md`

## 20. Next steps

After PR30 approval:

1. PR31 - Non-production Prototype Scaffold, only after explicit approval.
2. Keep PR31 fixture-only and non-production.
3. Do not add production transport, OAuth, real handlers, real data, export/send/submit/apply, or ChatGPT App submission.

Do not skip explicit PR31 approval.
