# PR38 - Tool Contract Mapping from Local Fixtures to Future MCP Descriptors

Date: 2026-06-12
Status: docs-only / tests-only
Scope: map local fixtures to future MCP/App SDK descriptor contracts without creating runtime permission

## 1. Objective

PR38 defines a deterministic mapping from Twoweeks local-only scaffold fixtures to future MCP/App SDK tool descriptor contracts.

PR38 is docs-only.

It does not add runtime code, tests, endpoints, handlers, transports, UI, OAuth, package dependencies, Convex changes, or ChatGPT connector behavior.

The mapping exists so a future PR can review descriptor text, schema shape, annotations, and metadata before any implementation work starts.

Descriptor exposure is not execution permission.

`ready_for_internal_review` is not runtime approval.

## 2. Current state (PR18-PR37)

Current state is local-only, fixture-only, review-only, non-callable, non-runnable, and safe-summary-only.

| Input | Current contribution | PR38 interpretation |
| --- | --- | --- |
| PR18 schema projection | Projects `local_mcp.*` tools to `twoweeks.*` descriptor-like shapes with closed schemas and read-only/non-destructive/closed-world annotations. | Descriptor source input only; no `tools/list`. |
| PR19 call envelope | Defines MCP-like local call envelope and safe errors without JSON-RPC or execution. | Naming and argument-ref input only; no `tools/call`. |
| PR20 approval/audit boundary | Defines approval requests, decisions, audit shells, and safe argument summaries. | Future policy input only; no persistent audit or consent UI. |
| PR21 handler boundary | Defines design-only gates for future real handlers. | Handler readiness input only; no handler exists. |
| PR22 remote transport spike | Models disabled/non-production transport preflight. | Transport threat-model input only; no listener. |
| PR23 UX/privacy spec | Defines consent, refusal, privacy, rollback, and copy expectations. | Descriptor language and refusal policy input only. |
| PR24 privacy fixtures | Defines sentinel checks and forbidden output classes for Local MCP safe outputs. | Fixture-level privacy input only; not semantic privacy. |
| PR25 visibility policy | Defines hidden-by-default and review/listing states. | Visibility input only; no callable listing. |
| PR26 approval UX copy fixtures | Pins short safe copy. | Copy source only; no UI. |
| PR27 privacy review gate | Defines fail-closed gate states. | Review input only; no runtime permission. |
| PR27.1 gate hardening | Keeps `ready_for_internal_review` bounded and non-executable. | Required invariant for every descriptor mapping. |
| PR28 prototype plan | Keeps ChatGPT App work Plan-only and forbids Build/Deploy surfaces. | Scope guard. |
| PR29 manifest draft | Defines static local-only manifest planning rules and candidate tool metadata. | Metadata input only; no manifest artifact. |
| PR30 safety audit | Confirms no approved execution path across PR18-PR29. | Audit baseline. |
| PR31 prototype scaffold | Adds local-only scaffold cards for four tools. | Fixture inventory input only. |
| PR32 scaffold hardening | Asserts fixture output status/summary consistency. | Shape-drift input only. |
| PR33 golden fixtures | Freezes default, blocked, review-required, ready, and mixed scenarios. | Golden review input only. |
| PR34 readiness checkpoint | Confirms planning readiness only. | No runtime approval. |
| PR35 Apps SDK exploration plan | Reviews official Apps SDK/MCP path and recommends PR36-PR38 before implementation. | Planning input only. |
| PR36 MCP server boundary ADR | Defines future server adapter boundary and blocks runtime. | Server boundary input only. |
| PR37 real-data policy | Defines privacy, consent, retention, deletion, redaction, logging, audit, prompt-injection, auth, and write-action gates. | Real-data policy input only; real data still forbidden. |

Active fixture/scaffold files are review-only and non-executable:

- `my-app/src/modules/local-mcp/chatGptAppPrototypeScaffold.ts`
- `my-app/src/modules/local-mcp/chatGptAppPrototypeScaffoldGoldenFixtures.ts`
- `my-app/src/modules/local-mcp/__tests__/chatGptAppPrototypeScaffold.test.ts`
- `my-app/src/modules/local-mcp/__tests__/chatGptAppPrototypeScaffoldGoldenFixtures.test.ts`
- `my-app/src/modules/local-mcp/mcpSchemaProjection.ts`
- `my-app/src/modules/local-mcp/mcpCallEnvelope.ts`
- `my-app/src/modules/local-mcp/privacyRedactionFixtures.ts`
- `my-app/src/modules/local-mcp/mcpPrivacyReviewGate.ts`

## 3. Mapping principles

All mapped tools must preserve these invariants:

- `callable: false`
- `runnable: false`
- `reviewOnly: true`
- no real user data
- no raw source text
- no generated full artifacts
- no handlers
- no transport
- no OAuth
- no network
- no persistence
- no export/download/send/submit/apply

Mapping is deterministic:

- one local fixture tool maps to one future descriptor name;
- names derive from `local_mcp.*` by replacing the prefix with `twoweeks.*`;
- input fields derive from the existing one-ref input kind;
- output policy derives from fixture safe-summary output, not from real product output;
- annotations are identical across all four current tools;
- `_meta` is policy metadata only.

## 4. Candidate tool inventory

Only the current Local MCP allowlist is in scope:

| Local fixture tool | Future descriptor name | Input ref | Current fixture use |
| --- | --- | --- | --- |
| `local_mcp.application_package.summarize` | `twoweeks.application_package.summarize` | `applicationPackageRef` | Safe summary of a mock application package. |
| `local_mcp.evidence_graph.summarize` | `twoweeks.evidence_graph.summarize` | `evidenceGraphRef` | Safe summary of mock evidence graph health. |
| `local_mcp.resume_variant_plan.summarize` | `twoweeks.resume_variant_plan.summarize` | `resumeVariantPlanRef` | Safe summary of a mock resume variant plan. |
| `local_mcp.review_cockpit.summarize` | `twoweeks.review_cockpit.summarize` | `reviewCockpitRef` | Safe summary of mock review state and gates. |

No other internal tool contract is mapped by PR38.

## 5. Descriptor naming policy

Future descriptor names must:

- use lowercase ASCII names;
- use the `twoweeks.` prefix;
- preserve the existing domain and verb segments;
- use `.summarize` only for safe summary tools;
- avoid verbs that imply mutation, outbound action, connection, or execution.

Forbidden name terms include:

- `export`
- `download`
- `send`
- `submit`
- `apply`
- `update`
- `publish`
- `connect`
- `oauth`
- `network`
- `scrape`

## 6. Description policy

Descriptions must be explicit, narrow, and boring.

Every future descriptor description must state:

- when to use the tool;
- that it returns safe summaries or fixture refs only;
- that it does not return raw source text;
- that it does not return generated full artifacts;
- that it does not run a handler;
- that it cannot export, download, send, submit, apply, persist, or contact a network.

Descriptions must not use executable readiness language.

Forbidden description claims include:

- production ready
- ready to run
- connected to ChatGPT
- approved for remote
- handler approved
- runtime approved
- safe to execute

## 7. Input schema policy

Future input schemas are closed object schemas.

Common policy:

```txt
type: object
additionalProperties: false
required: [the exact ref field]
```

Each ref field is a closed object:

```txt
type: object
additionalProperties: false
required: ["id"]
properties.id.type: string
properties.id.minLength: 1
```

No input schema may accept:

- raw CV/resume text
- raw cover letter text
- raw job text
- raw source documents
- source quotes
- private facts
- `never_use` facts
- tokens, secrets, sessions, origins, hosts, or browser details
- write-action instructions
- free-form prompt payloads

## 8. Output schema policy

Future descriptor output policy must remain safe-summary-only until a later runtime PR approves a real output schema.

Allowed generic output fields:

- bounded `status`
- bounded `summary`
- one or more safe `refIds`
- reason categories
- approval/review/privacy state
- descriptor policy version

Forbidden generic output fields:

- raw resume/CV text
- raw cover letter text
- raw job description text
- raw source documents
- source quote dumps
- private facts
- `never_use` facts
- complete generated resumes
- complete generated cover letters
- raw arguments
- user/session IDs
- tokens/secrets
- origin/host payloads
- stack traces

PR18 dry-run output schema remains the current local projection reference:

```txt
kind: "local_mcp_dry_run"
internalToolId: exact internal tool id
input: closed ref object input
outputKind: exact internal output kind
version: 1
```

PR31-PR33 fixture output remains the current ChatGPT App scaffold reference:

```txt
kind: "local_mcp_safe_text_fixture_output"
status: hidden | blocked | review_required | ready_for_internal_review
summary: bounded safe summary
refIds: ["fixture:<local tool id>"]
version: 1
```

Neither reference is a runtime tool result.

## 9. Annotation policy

Every mapped future descriptor must use:

```txt
readOnlyHint: true
destructiveHint: false
openWorldHint: false
```

Rationale:

- the current tools summarize refs only;
- they must not mutate Twoweeks state;
- they must not contact external systems;
- they must not create outbound side effects;
- they must not browse, scrape, export, send, submit, or apply.

If a future tool needs write behavior or external access, it must be split into a separate future PR and cannot inherit this PR38 mapping.

## 10. `_meta` policy

`_meta` is policy metadata only.

It is not:

- execution permission;
- a privacy bypass;
- model-visible raw data;
- component-visible raw data;
- a place to store raw user data;
- a place to store OAuth tokens, session IDs, raw arguments, source text, generated artifacts, or audit payloads.

Allowed future `_meta` content:

- policy version;
- review-only marker;
- visibility marker;
- safe copy keys from PR26;
- safe ref IDs;
- non-sensitive descriptor lineage such as `localToolId`;
- non-sensitive constraints such as `callable: false`, `runnable: false`, `reviewOnly: true`.

Forbidden future `_meta` content:

- `securitySchemes` with real OAuth config before auth approval;
- output template URI before UI/resource approval;
- component bridge data before component approval;
- raw private state;
- raw user documents;
- raw generated artifacts;
- hidden execution flags.

## 11. Negative prompt expectations

Future evaluation prompts must include negative cases for:

- prompt injection asking the tool to ignore privacy policy;
- source text instructing the model to reveal private facts;
- over-broad tool selection when no safe ref exists;
- fake approval claims such as "I approve this for the user";
- write-action requests to export, download, send, submit, apply, or auto-apply;
- raw data requests for CV, resume, cover letter, job text, source docs, or quote dumps;
- hidden tool invocation requests;
- attempts to treat `ready_for_internal_review` as execution approval;
- attempts to force network, OAuth, browser, scraping, or connector behavior;
- attempts to request complete generated artifacts through a generic summary tool.

Expected behavior:

- refuse or stay hidden;
- return safe summary only;
- cite the relevant blocked state;
- never expose raw data;
- never imply a handler ran.

## 12. Tool-by-tool mapping table

| Local fixture tool | Future descriptor | Description policy | Input schema | Output schema | Annotations | `_meta` policy |
| --- | --- | --- | --- | --- | --- | --- |
| `local_mcp.application_package.summarize` | `twoweeks.application_package.summarize` | Use only for a safe review summary of an existing application package ref. Do not use for raw resume, cover letter, job text, export, download, send, submit, apply, or handler output. | Closed object with required `applicationPackageRef.id`. | Safe status, summary, and `fixture:local_mcp.application_package.summarize` ref only; no full resume or cover letter. | `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`. | Policy metadata only: local tool id, review-only markers, safe copy key, version. |
| `local_mcp.evidence_graph.summarize` | `twoweeks.evidence_graph.summarize` | Use only for a safe summary of evidence graph readiness and provenance shape. Do not use for raw source docs, quote dumps, private facts, `never_use` facts, or graph traversal output. | Closed object with required `evidenceGraphRef.id`. | Safe status, summary, and `fixture:local_mcp.evidence_graph.summarize` ref only; reason categories only. | `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`. | Policy metadata only: local tool id, review-only markers, safe copy key, version. |
| `local_mcp.resume_variant_plan.summarize` | `twoweeks.resume_variant_plan.summarize` | Use only for a safe summary of an existing resume variant plan ref. Do not use to generate a resume, expose bullets, export, download, or return complete generated text. | Closed object with required `resumeVariantPlanRef.id`. | Safe status, summary, and `fixture:local_mcp.resume_variant_plan.summarize` ref only; no generated full artifact. | `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`. | Policy metadata only: local tool id, review-only markers, safe copy key, version. |
| `local_mcp.review_cockpit.summarize` | `twoweeks.review_cockpit.summarize` | Use only for safe review-state summary and gate status. Do not use to approve automatically, run handlers, expose raw gate payloads, or perform outbound actions. | Closed object with required `reviewCockpitRef.id`. | Safe status, summary, and `fixture:local_mcp.review_cockpit.summarize` ref only; bounded gate status and copy only. | `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`. | Policy metadata only: local tool id, review-only markers, safe copy key, version. |

## 13. Forbidden mappings

PR38 forbids mappings from local fixtures to:

- runtime `tools/list`;
- runtime `tools/call`;
- runtime `call_tool`;
- JSON-RPC methods;
- server routes;
- `/mcp`;
- Streamable HTTP, SSE, WebSocket, tunnels, or public endpoints;
- Apps SDK `registerTool` calls;
- Apps SDK `registerResource` calls;
- OAuth or security-scheme configuration;
- real handlers or handler registries;
- Convex functions, writes, or schema changes;
- UI routes, React components, iframe resources, or widget templates;
- export, download, send, submit, apply, or auto-apply behavior;
- real user data, raw documents, or generated full artifacts.

## 14. Boundary with PR24-PR37

PR24 sentinel fixtures remain necessary but insufficient.

PR25 visibility policy remains hidden-by-default and does not create callable listing.

PR26 copy fixtures remain the only approved copy input and do not create UI.

PR27/PR27.1 privacy review gate remains fail-closed and review-only.

PR28 and PR29 keep ChatGPT App work in planning and static draft surfaces.

PR30 confirms no execution path exists.

PR31-PR33 scaffold and golden fixtures are review artifacts only.

PR34 confirms planning readiness only.

PR35 allows continued planning only.

PR36 defines future server architecture boundary only.

PR37 defines real-data policy gates only.

None of PR24-PR37 approve runtime integration, real data, OAuth, UI, transport, handlers, packages, endpoints, or outbound actions.

## 15. Open questions

- What exact output schema should a future MCP descriptor use once runtime remains explicitly approved?
- Should future results use `structuredContent` only, or also bounded text content?
- What descriptor review owner approves final descriptions before any connector testing?
- What semantic privacy taxonomy owns private facts and `never_use` facts beyond PR24 sentinel checks?
- What auth/OAuth model is acceptable if customer-specific data is ever introduced?
- Will future ChatGPT App work use no UI, a read-only component, or a separate review component after a UI/resource ADR?

## 16. Stop conditions

Stop any PR38 follow-up if it requires:

- Apps SDK install/import;
- MCP SDK install/import;
- OpenAI SDK install/import;
- package or lockfile changes;
- `/mcp`;
- `tools/list`;
- `tools/call`;
- `call_tool`;
- server, route, listener, tunnel, or transport;
- OAuth;
- UI/component/widget resource;
- Convex changes;
- real handlers;
- real user data;
- raw source text;
- generated full artifacts;
- export/download/send/submit/apply behavior.

## 17. Acceptance criteria

PR38 passes only if:

- changed file list is limited to `docs/decisions/2026-06-12-tool-contract-mapping-local-fixtures-to-mcp-descriptors.md`;
- optional tests are omitted unless a reviewer explicitly asks for static contract tests;
- no `my-app/**` runtime file changes;
- no package or lockfile changes;
- no Apps SDK, MCP SDK, or OpenAI SDK imports;
- no endpoint, server, transport, OAuth, UI, Convex, handler, or outbound action appears;
- all four local fixture tools are mapped deterministically;
- all mapped tools preserve `callable: false`, `runnable: false`, and `reviewOnly: true`;
- descriptor exposure is explicitly not execution permission;
- `ready_for_internal_review` is explicitly not runtime approval;
- `_meta` is documented as policy metadata only;
- negative prompt expectations are documented.

## 18. Verification

Run:

```bash
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected changed file:

```txt
docs/decisions/2026-06-12-tool-contract-mapping-local-fixtures-to-mcp-descriptors.md
```

No Vitest run is required for this docs-only PR38 slice because no runtime or test file is added.

Manual verification:

- Confirm the mapping covers all four current Local MCP fixture tools.
- Confirm no optional test file or runtime file was added.
- Confirm no forbidden runtime surface is introduced.
- Confirm the document preserves PR18-PR37 boundaries.

## 19. Verdict

PR38 defines the tool contract mapping from local fixtures to future MCP/App SDK descriptors.

PR38 allows continued review and planning only.

PR38 does not approve implementation.

PR38 does not approve `tools/list`.

PR38 does not approve `tools/call`.

PR38 does not approve `/mcp`.

PR38 does not approve Apps SDK, MCP SDK, OpenAI SDK, OAuth, UI, Convex, real handlers, real user data, persistence, network, export, download, send, submit, apply, or production behavior.

## 20. Next PR recommendation

Recommended PR39:

```txt
Runtime threat model / Apps SDK integration plan, docs-only or tests-only, non-production.
```

PR39 should test the proposed runtime boundary on paper before any dependency, server, connector, OAuth, UI, or handler work starts.

## 21. Rollback

Rollback is deletion-only:

```txt
docs/decisions/2026-06-12-tool-contract-mapping-local-fixtures-to-mcp-descriptors.md
```

Then rerun:

```bash
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
```
