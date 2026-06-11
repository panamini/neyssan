# PR29 - Local-only ChatGPT App Manifest Draft

Date: 2026-06-11
Status: planned spec
Scope: docs-only local-only static manifest draft for a future non-production ChatGPT App.

## 1. Objective

Define a local-only, non-runnable manifest shape for a future Twoweeks ChatGPT App.

PR29 does not create an app manifest file consumed by runtime.
PR29 does not install an SDK.
PR29 does not connect to ChatGPT.
PR29 does not start prototype work.

The draft exists to make the future app boundary boring before anything can run.

## 2. Verdict

Certain:

- PR29 is docs-only.
- PR29 is Plan-only.
- PR29 produces one static planning document.
- PR29 does not add code.
- PR29 does not add a real manifest artifact.
- PR29 does not add a server, route, transport, OAuth, UI, handler, Convex function, package, or lockfile.
- PR29 keeps all candidate tools non-runnable and hidden by default.
- PR29 inherits PR28's rule: PR27.1 gate pass is review evidence only, not runtime permission.

Non-goal:

- No ChatGPT App submission.
- No Apps SDK integration.
- No MCP server.
- No endpoint.
- No authentication config.
- No component resource.
- No iframe.
- No persistence.
- No export, download, send, submit, apply, or auto-apply.

## 3. Planning boundary

OpenAI Apps SDK work is treated as Plan, Build, and Deploy.

PR29 stays in Plan only.

### Plan - allowed

- define a future manifest shape
- define candidate metadata rules
- define candidate tool list rules
- define local-only placeholders
- define forbidden runtime fields
- define review gates before any later build
- document how PR18-PR28 constrain the manifest draft

### Build - forbidden

- no server
- no route
- no SDK package
- no MCP runtime
- no `registerTool`
- no `registerResource`
- no `server.connect`
- no component bridge
- no iframe
- no OAuth
- no state management
- no handler
- no real tool callable from ChatGPT

### Deploy - forbidden

- no ChatGPT connection
- no connector setup
- no app submission
- no test integration
- no public endpoint
- no marketplace or distribution work
- no production review
- no real user access

## 4. Source boundaries

PR29 can reference only these existing boundaries:

| Source | PR29 use | Runtime permission |
| --- | --- | --- |
| PR18 schema projection | candidate descriptor names and safe schema shape | none |
| PR19 call envelope | non-executable call-shape reference | none |
| PR20 approval/audit | future approval and audit requirements | none |
| PR21 handler boundary | proof that handlers are design-only | none |
| PR22 remote transport spike | disabled preflight evidence only | none |
| PR23 UX/privacy spec | copy, consent, refusal and privacy expectations | none |
| PR24 privacy/redaction fixtures | forbidden output classes and safe summaries | none |
| PR25 visibility policy | hidden-by-default and listed states | none |
| PR26 approval UX copy | exact short copy fixtures | none |
| PR27 privacy review gate | gate status and reason categories | none |
| PR27.1 gate hardening | fail-closed, review-only, bounded output rules | none |
| PR28 prototype plan | Plan-only, Build/Deploy forbidden, PR29/PR30/PR31 sequencing | none |

## 5. Manifest draft status

The PR29 manifest is a planning shape, not a manifest file.

Allowed form:

```txt
docs/plans/2026-06-11-chatgpt-app-local-only-manifest-draft.md
```

Forbidden forms:

```txt
app.json
manifest.json
openai-app.json
.openai/**
my-app/**/manifest.*
my-app/**/apps-sdk.*
```

Do not add machine-consumed manifest files in PR29.

Reason:

- a real manifest can be mistaken for build work;
- build work is PR31+ only after PR30 safety audit;
- PR29 only defines what a later manifest must and must not contain.

## 6. Candidate manifest shape

Future manifest metadata may be drafted conceptually as:

| Field group | Candidate content | PR29 rule |
| --- | --- | --- |
| App name | `Twoweeks Local Review` or similar | placeholder only |
| App description | local-only review of safe tool summaries | no production claims |
| Tool descriptors | derived from PR18/PR25 | non-runnable |
| Tool descriptions | exact use and do-not-use cases | no hype |
| Security scheme | placeholder only | no real OAuth config |
| Component resource | placeholder only | no iframe or UI resource |
| Output templates | placeholder only | no `ui://` runtime resource |
| Invocation copy | derived from PR26 | short, boring, non-executable |
| Visibility state | derived from PR25 | hidden by default |
| Privacy gate | derived from PR27.1 | fail-closed |
| Data policy | derived from PR24/PR28 | safe summaries only |
| Transport | derived from PR22 | disabled / none |
| Handler | derived from PR21 | design-only / none |
| Actions | none | no export/send/submit/apply |

PR29 must not convert this table into runtime config.

## 7. Candidate tool list

PR29 may name future candidate tools only as planning references.

Candidate names come from PR18 public descriptors:

```txt
twoweeks.application_package.summarize
twoweeks.evidence_graph.summarize
twoweeks.resume_variant_plan.summarize
twoweeks.review_cockpit.summarize
```

Rules:

- names are planning names only;
- tools remain hidden by default;
- no tool is callable;
- no tool has a handler;
- no tool has transport;
- no tool can read raw user documents;
- no tool can return complete generated artifacts;
- no tool can export, download, send, submit, apply, or auto-apply.

## 8. Candidate tool metadata policy

Every future tool descriptor must explain:

- when to use the tool;
- when not to use the tool;
- what it can read;
- what it cannot read;
- whether it is read-only;
- whether it is destructive;
- whether it can contact external systems;
- whether approval is required;
- whether audit is required;
- whether privacy review is required;
- what safe output shape it returns.

Default metadata decisions:

| Metadata concern | PR29 default |
| --- | --- |
| read-only | yes |
| destructive | no |
| open-world | no |
| idempotent | yes for planning only |
| external network | no |
| user data access | safe summaries only |
| raw source access | no |
| generated full text | no |
| approval | required before any future real action |
| audit | required before any future real action |
| visibility | hidden |
| handler | none |
| transport | none |

## 9. Candidate descriptor drafts

These are planning-only sketches.

They are not JSON.
They are not schema files.
They are not Apps SDK descriptors.

### `twoweeks.application_package.summarize`

Use when:

- showing a safe summary of a mock application package;
- explaining package readiness without exposing full resume or cover letter content;
- demonstrating approval/privacy states with fixture data.

Do not use when:

- the caller asks for raw resume text;
- the caller asks for a complete cover letter;
- the caller asks to export, download, send, submit, or apply;
- the caller expects a real handler result.

Allowed output:

- package ID placeholder;
- bounded safe summary;
- risk flags;
- approval status;
- privacy status;
- audit status.

Forbidden output:

- raw resume text;
- raw CV text;
- raw cover letter text;
- raw job description;
- private facts;
- `never_use` facts;
- source quote dumps;
- complete generated artifacts;
- tokens, secrets, sessions, stack traces.

### `twoweeks.evidence_graph.summarize`

Use when:

- showing a safe summary of mock evidence graph health;
- explaining whether evidence is sufficient at a high level;
- demonstrating privacy-blocked or safe-summary-only states.

Do not use when:

- the caller asks for raw source documents;
- the caller asks for quote dumps;
- the caller asks for private facts;
- the caller asks for `never_use` facts;
- the caller expects a real graph traversal handler.

Allowed output:

- evidence graph ID placeholder;
- evidence count summary;
- high-level provenance count;
- risk flags;
- privacy status.

Forbidden output:

- source document text;
- raw quotes;
- private facts;
- `never_use` facts;
- raw extracted fields;
- employer/user/contact details.

### `twoweeks.resume_variant_plan.summarize`

Use when:

- showing a safe summary of a mock resume variant plan;
- explaining sections to review without exposing generated text;
- demonstrating approval-required and review-only states.

Do not use when:

- the caller asks to generate a real resume;
- the caller asks for complete generated resume text;
- the caller asks to export or download a resume;
- the caller expects a real generator.

Allowed output:

- resume variant plan ID placeholder;
- section readiness summary;
- risk flags;
- safe review notes;
- approval status.

Forbidden output:

- complete resume;
- raw CV;
- generated bullet text;
- private facts;
- `never_use` facts;
- source quote dumps.

### `twoweeks.review_cockpit.summarize`

Use when:

- showing a safe summary of mock review cockpit state;
- explaining which gates block review;
- demonstrating PR27.1 fail-closed output.

Do not use when:

- the caller asks to run a handler;
- the caller asks to approve automatically;
- the caller asks to submit/apply/send;
- the caller expects a real endpoint.

Allowed output:

- review state placeholder;
- blocked/review-required/internal-review status;
- short PR26 copy;
- reason categories only;
- safe summary.

Forbidden output:

- raw gate payload;
- user/session IDs;
- origin/host payloads;
- raw arguments;
- stack traces;
- runtime permission wording.

## 10. `_meta` planning policy

Future Apps SDK descriptors may use `_meta` fields.

PR29 does not create them.

PR29 only sets the rules for later use:

| `_meta` concern | PR29 rule |
| --- | --- |
| security schemes | placeholder only; no OAuth credentials |
| output template | placeholder only; no component resource |
| widget accessible | false unless later reviewed |
| invocation starting | PR26 copy only |
| invocation invoked | PR26 copy only |
| visibility | hidden by default |
| status detail | safe summaries only |
| result `_meta` | never exposed to model as raw data |

Forbidden in PR29:

- real `_meta` config;
- real `securitySchemes`;
- real output template URI;
- real component bridge data;
- raw private state in result `_meta`;
- anything that makes a tool callable.

## 11. Component policy

PR29 may mention future component intent only.

Allowed:

- placeholder component names;
- high-level review surface descriptions;
- copy rules;
- privacy constraints.

Forbidden:

- no component file;
- no iframe;
- no resource registration;
- no `ui://` template;
- no HTML;
- no CSS;
- no client JS;
- no bridge;
- no `window.openai` use;
- no screenshots;
- no UI route;
- no React component.

Default future component status:

```txt
No component yet.
Review first.
Nothing runs.
```

## 12. Security and privacy policy

Any future manifest must preserve these rules:

- no raw source documents;
- no raw resume or CV text;
- no raw cover letter text;
- no raw job description text;
- no complete generated resume;
- no complete generated cover letter;
- no private facts;
- no `never_use` facts;
- no source quote dumps;
- no secrets;
- no tokens;
- no session details;
- no stack traces;
- no raw arguments;
- no real contact details;
- no employer/user/job source payloads;
- no origin or host payloads.

Safe output default:

```txt
Safe summary only.
```

If unsure:

```txt
Blocked. Review privacy.
```

## 13. Visibility policy

All candidate tools default to:

```txt
hidden
```

The only planning states PR29 may discuss:

```txt
hidden
listed_disabled
listed_dry_run
listed_requires_approval
listed_ready_for_review
blocked_by_privacy
disabled_by_admin
```

Rules:

- `listed_ready_for_review` is not executable;
- `ready_for_internal_review` is not executable;
- hidden stays default;
- privacy block wins over all listing states;
- approval-required is not approval;
- dry-run is not handler execution;
- disabled is not callable.

## 14. PR27.1 gate policy

PR27.1 remains mandatory.

The future manifest must not list or describe any tool as externally ready unless PR27.1 can return a bounded review result.

Even then:

```txt
ready_for_internal_review
```

means only:

```txt
Review first.
Nothing runs.
```

It does not mean:

```txt
ready_for_production
ready_to_execute
ready_for_chatgpt
approved_for_remote
safe_to_run
```

Future manifest language must avoid executable wording.

Allowed gate output classes:

- status;
- reason categories;
- PR26 copy;
- bounded safe summary.

Forbidden gate output classes:

- raw arguments;
- source documents;
- private facts;
- `never_use` facts;
- source quote dumps;
- stack traces;
- user IDs;
- session IDs;
- secrets;
- tokens;
- origin/host payloads.

## 15. Forbidden scenarios

PR29 must not enable or imply support for:

- real ChatGPT App;
- real manifest;
- Apps SDK install;
- MCP SDK install;
- MCP server;
- route handler;
- network listener;
- remote transport;
- OAuth;
- ChatGPT connector;
- component iframe;
- resource registration;
- handler registry;
- real user auth;
- real persistence;
- real resume generation;
- real cover letter generation;
- export;
- download;
- send;
- submit;
- apply;
- auto-apply;
- scraping LinkedIn, Upwork, Indeed, ATS, job boards, or browser pages;
- passing raw CV, resume, cover letter, job text, or source docs into ChatGPT;
- showing complete generated artifacts inside ChatGPT.

## 16. Future PR gates

### PR30 - End-to-end Safety Audit

Must happen before any scaffold.

Required checks:

- PR18-PR29 consistency;
- no execution path exists;
- no runtime manifest exists;
- no Apps SDK dependency exists;
- no server/route/transport exists;
- no OAuth exists;
- no handler exists;
- no component exists;
- PR27.1 is treated as review-only;
- all forbidden scenarios remain blocked.

### PR31 - Non-production Prototype Scaffold

Allowed only after PR30 and explicit approval.

Minimum constraints:

- no real handler;
- no real user data;
- no production transport;
- no OAuth;
- no export/send/submit/apply;
- fixture-backed surfaces only;
- hidden by default;
- PR27.1 gate result required before any exposed state.

## 17. Manual review checklist

Before any later implementation:

1. Manifest draft remains docs-only.
2. No real manifest file exists.
3. No app/server/SDK/route was added.
4. No package or lockfile changed.
5. No `my-app/**` file changed.
6. Candidate tools come only from PR18 descriptors.
7. Visibility rules come from PR25.
8. Copy comes from PR26.
9. Privacy output rules come from PR24.
10. Gate behavior comes from PR27.1.
11. Handler remains PR21 design-only.
12. Transport remains PR22 disabled/reference-only.
13. `ready_for_internal_review` remains review-only.
14. No raw or private data is described as exposable.
15. No export/send/submit/apply action is allowed.
16. PR30 is still required before PR31.

## 18. Rollback

Rollback for PR29 is deletion-only:

```txt
docs/plans/2026-06-11-chatgpt-app-local-only-manifest-draft.md
```

Then run:

```bash
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
```

## 19. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Static draft mistaken for real manifest | build starts too early | PR29 forbids machine-consumed manifest files |
| Metadata wording implies runnable tools | accidental exposure | PR29 requires review-only language |
| PR27.1 gate pass becomes permission | handler/transport may run too early | PR29 repeats review-only meaning |
| Component placeholder becomes UI work | scope creep | PR29 forbids UI/resource/iframe files |
| Security scheme placeholder becomes OAuth | auth config appears too early | PR29 forbids real security schemes |
| Candidate tools expose raw data | privacy leak | PR24 and PR27.1 constraints required |
| PR31 starts before PR30 | audit skipped | PR29 makes PR30 mandatory |

## 20. Acceptance criteria for PR29

PR29 passes only if:

- changed file count is exactly 1;
- changed file is `docs/plans/2026-06-11-chatgpt-app-local-only-manifest-draft.md`;
- no files under `my-app/` changed;
- no package files changed;
- no lockfiles changed;
- no manifest JSON file added;
- no SDK dependency added;
- no server, route, transport, OAuth, UI, handler, Convex, component, or resource is added;
- document says Plan-only;
- document clearly forbids Build and Deploy;
- document cites PR27.1 as mandatory and review-only;
- document defines candidate tool metadata without executable config;
- document keeps all candidate tools hidden/non-runnable;
- document requires PR30 before PR31.

## 21. Verification

Documentation/manual inspection only. No runtime execution.

Run:

```bash
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected changed file list:

```txt
docs/plans/2026-06-11-chatgpt-app-local-only-manifest-draft.md
```

Do not run app tests unless repository policy requires it.

Manual checks:

- Confirm no `my-app/**` files changed.
- Confirm no `package.json`, package lockfile, or config changed.
- Confirm no real manifest artifact was added.
- Confirm no Apps SDK, MCP SDK, server, route, OAuth, transport, handler, UI, component, or resource was added.
- Confirm PR27.1 remains review-only.
- Confirm no export, download, send, submit, apply, or auto-apply surface exists.

## 22. PR body draft

Summary:

- Adds a docs-only PR29 local-only ChatGPT App manifest draft.
- Defines candidate future manifest metadata and tool descriptor rules without creating a runnable manifest.
- Keeps Apps SDK build/deploy, server, transport, OAuth, handler, component, UI, and outbound actions out of scope.
- Requires PR30 safety audit before any PR31 scaffold.

Verification:

```txt
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected changed files:

```txt
docs/plans/2026-06-11-chatgpt-app-local-only-manifest-draft.md
```

## 23. References

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
- OpenAI Apps SDK docs, checked 2026-06-11: Plan / Build / Deploy, Optimize Metadata, Reference.
- Twoweeks brand voice: `twoweeks-wiki/wiki/design/brand-voice.md`

## 24. Next steps

After PR29 approval:

1. PR30 - End-to-end Safety Audit, pure review, no runtime.
2. PR31 - Non-production Prototype Scaffold, only after PR30 and explicit approval.

Do not skip PR30.
Do not start prototype code from PR29.
