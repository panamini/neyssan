# PR40 - Dependency, Package, and Server Skeleton Approval Checkpoint

Date: 2026-06-12
Status: proposed checkpoint
Scope: docs-only decision before any dependency, package, or server skeleton work

## 1. Objective

PR40 decides whether future dependency, package, or server skeleton work can even be considered.

PR40 does not approve dependency installation.

PR40 does not approve package changes.

PR40 does not approve a server skeleton.

PR40 exists to keep runtime blocked while defining the gates that a later PR must pass before touching SDKs, package files, endpoints, or server code.

Question answered:

```txt
What must be true before Twoweeks may consider Apps SDK / MCP SDK / OpenAI SDK packages or an MCP server skeleton?
```

## 2. Current state

Current state after PR39:

- local-only
- fixture-only
- review-only
- non-runnable
- non-callable
- no package approval
- no Apps SDK dependency
- no MCP SDK dependency
- no OpenAI SDK dependency
- no server skeleton
- no `/mcp`
- no `tools/list`
- no `tools/call`
- no transport runtime
- no public tunnel
- no ChatGPT connector
- no Developer Mode setup
- no OAuth
- no UI or widget resource
- no Convex changes
- no real handlers
- no real user data
- no export/download/send/submit/apply
- no production behavior

Runtime remains blocked.

## 3. Sources reviewed

Repository sources:

- `AGENTS.md`
- `docs/plans/2026-06-12-chatgpt-apps-sdk-non-production-exploration-plan.md`
- `docs/decisions/2026-06-12-chatgpt-app-mcp-server-architecture-boundary.md`
- `docs/decisions/2026-06-12-real-data-privacy-consent-retention-audit-policy.md`
- `docs/decisions/2026-06-12-tool-contract-mapping-local-fixtures-to-mcp-descriptors.md`
- `docs/audits/2026-06-12-apps-sdk-runtime-threat-model.md`

Official and high-trust sources re-checked on 2026-06-12:

- OpenAI Apps SDK Quickstart: `https://developers.openai.com/apps-sdk/quickstart`
- OpenAI Apps SDK Build your MCP server: `https://developers.openai.com/apps-sdk/build/mcp-server`
- OpenAI Apps SDK Build your ChatGPT UI: `https://developers.openai.com/apps-sdk/build/chatgpt-ui`
- OpenAI Apps SDK Authenticate users: `https://developers.openai.com/apps-sdk/build/auth`
- OpenAI SDKs and CLI: `https://developers.openai.com/api/docs/libraries`
- MCP TypeScript SDK docs: `https://ts.sdk.modelcontextprotocol.io/`
- MCP Apps extension docs: `https://modelcontextprotocol.io/extensions/apps/build`
- npm provenance docs: `https://docs.npmjs.com/generating-provenance-statements/`
- npm trusted publishing docs: `https://docs.npmjs.com/trusted-publishers/`
- npm audit docs: `https://docs.npmjs.com/cli/v8/commands/npm-audit/`

Observed official package candidates, for future review only:

- OpenAI Apps SDK Quickstart currently shows `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, and `zod` for a Node MCP app.
- MCP TypeScript SDK docs currently show `@modelcontextprotocol/sdk` with `zod`.
- OpenAI SDK docs currently show the official JavaScript/TypeScript OpenAI SDK package as `openai`.

These names are not approved dependencies.

Any future dependency PR must re-check official docs and package metadata on the day it is opened.

## 4. Decision summary

Future dependency and package changes may be considered only after all PR40 gates pass.

Future server skeleton work may be considered only after all PR40 gates pass and after a separate explicit maintainer approval says server skeleton work is allowed.

PR40 itself grants no implementation permission.

No missing gate may be treated as implied approval.

No docs-only approval may be converted into package, endpoint, transport, connector, UI, OAuth, handler, real-data, write-action, or production behavior.

## 5. Explicit non-permissions

PR40 does not allow:

- Apps SDK install
- MCP SDK install
- OpenAI SDK install
- `zod` install for Apps SDK/MCP purposes
- SDK import
- package.json change
- lockfile change
- package manager config change
- runtime config change
- MCP server
- server skeleton
- route or listener
- `/mcp` endpoint
- `tools/list`
- `tools/call`
- `call_tool`
- JSON-RPC runtime
- Streamable HTTP transport
- SSE transport
- public tunnel
- ChatGPT connector setup
- Developer Mode setup
- OAuth
- UI component
- widget resource
- iframe rendering
- Convex changes
- real handlers
- real user data
- logs containing real user data
- export/download/send/submit/apply
- production behavior

## 6. Dependency/package gates

A future dependency or package PR must stop unless every gate below is satisfied in writing.

Required approval gates:

- explicit maintainer approval naming each package to add;
- explicit maintainer approval to modify package files;
- explicit maintainer approval to modify lockfiles;
- explicit statement that the PR is dependency-only, server-skeleton-only, or both;
- explicit statement that runtime remains disabled after merge.

Required package identity gates:

- exact npm package name;
- exact registry URL;
- exact package scope and owner;
- exact version or version range rationale;
- official source URL;
- official package page URL;
- repository URL from package metadata;
- license and maintenance status review;
- direct dependency and transitive dependency summary;
- reason the package is needed now instead of deferred.

Required install-plan gates:

- package manager and command must be written before execution;
- install must be reviewed as a planned diff before merge;
- lockfile diff must be reviewed line-by-line for new package families;
- lifecycle scripts must be identified before install;
- no postinstall/preinstall/prepare script may run unless separately approved;
- no package manager config may be changed unless separately approved;
- no dependency may be added from a git URL, tarball URL, local path, or unreviewed private registry;
- no typo-adjacent or unofficial package may be substituted for the official package.

Required verification gates:

- `rtk git diff --check`;
- changed-file list proves the PR stayed in its approved scope;
- package audit output reviewed without `fix`;
- registry signature/provenance check reviewed where available;
- package metadata captured in the PR description;
- rollback instructions documented.

PR40 does not run these gates because PR40 installs nothing.

## 7. SDK-specific gates

Before an Apps SDK / MCP Apps helper dependency may be installed:

- official Apps SDK docs must be rechecked the same day;
- the exact package name must match official docs;
- the future PR must explain whether `@modelcontextprotocol/ext-apps` is needed without adding UI;
- any UI/resource helper package must remain unused until a UI/resource ADR approves it;
- no component, iframe, widget resource, or resource registration may be added by the dependency PR.

Before an MCP SDK dependency may be installed:

- official MCP SDK docs must be rechecked the same day;
- the future PR must explain why `@modelcontextprotocol/sdk` is needed before a server skeleton exists;
- `zod` or any peer dependency must be reviewed as its own dependency;
- Streamable HTTP, SSE, stdio, JSON-RPC, resources, prompts, and tools must remain unused unless separately approved.

Before the OpenAI SDK may be installed:

- official OpenAI SDK docs must be rechecked the same day;
- the future PR must explain why `openai` is needed for Apps SDK/MCP work;
- no API key, client initialization, model call, prompt call, Responses API call, or environment variable may be added;
- token and budget policy must be approved before any LLM call path exists.

## 8. Server skeleton gates

A future server skeleton PR must stop unless every gate below is satisfied before code exists.

Required approval gates:

- explicit maintainer approval naming server skeleton work;
- approved dependency/package PR or explicit no-new-dependency decision;
- approved transport/public endpoint ADR;
- approved auth/OAuth ADR or explicit no-auth/no-real-data/no-write skeleton constraint;
- approved local-only test strategy;
- accepted PR39 threat model plus this PR40 checkpoint.

Required architecture gates:

- server must be an adapter, not product core;
- disabled by default;
- no public route by default;
- no public tunnel;
- no ChatGPT connector;
- no Developer Mode setup;
- no real user data;
- no real handlers;
- no Convex reads or writes;
- no export/download/send/submit/apply;
- no production behavior.

Required runtime-control gates:

- no `/mcp` unless explicitly approved;
- no `tools/list` unless explicitly approved;
- no `tools/call` unless explicitly approved;
- no transport listener unless explicitly approved;
- no OAuth endpoints unless explicitly approved;
- no outbound HTTP requests unless explicitly approved;
- no LLM calls unless explicitly approved;
- fail closed when any gate is unknown, missing, stale, or failing.

Required review gates:

- endpoint inventory;
- method inventory;
- tool inventory;
- data class inventory;
- logging inventory;
- network egress inventory;
- rate-limit and request-size policy;
- malformed payload behavior;
- rollback and kill-switch behavior.

PR40 does not approve any server skeleton.

## 9. Supply-chain and dependency-confusion policy

Supply-chain risk remains blocked until a future dependency PR proves package identity and install safety.

Required controls for any future package PR:

- use only official package names from official docs or official organization repositories;
- compare package scope, maintainer, repository, and registry metadata against official docs;
- reject typo-adjacent, similarly named, abandoned, or unofficial packages;
- reject packages from unreviewed private registries;
- reject git/tarball/local path dependencies;
- pin or justify version ranges;
- inspect lifecycle scripts and require explicit approval before any install script runs;
- run audit and signature/provenance checks where supported;
- treat npm provenance as useful evidence, not proof of harmless code;
- review new transitive dependencies for unexpected network, native, install-script, or credential behavior;
- document rollback as dependency removal plus lockfile restoration.

Stop immediately if a package name, scope, registry, repository, provenance, maintainer, or install script cannot be reconciled with official sources.

## 10. SSRF and outbound request abuse policy

SSRF and outbound request abuse remain blocked by default.

No future dependency, server skeleton, handler, or tool PR may add outbound HTTP behavior unless a separate approved egress policy exists.

Required controls before any outbound request capability:

- deny-by-default egress allowlist;
- no user-controlled URL fetches;
- no model-controlled URL fetches;
- no private IP, loopback, link-local, metadata service, or internal hostname access;
- DNS rebinding protections;
- redirect policy;
- timeout policy;
- response-size limits;
- request body-size limits;
- method allowlist;
- header allowlist;
- credential isolation;
- redacted logging;
- tests for blocked internal and metadata targets.

Stop immediately if a proposed package, tool, server route, UI resource, or handler needs uncontrolled fetch, scraping, browsing, webhook, callback, redirect, or arbitrary URL behavior.

## 11. LLM token, budget, and DoS policy

LLM token/budget exhaustion and denial of service remain blocked.

No future PR may add an LLM call path until a budget policy exists.

Required controls before any LLM or expensive tool path:

- per-request input size limit;
- per-session request count limit;
- per-user daily budget;
- per-tool max tokens;
- model allowlist;
- timeout and cancellation behavior;
- concurrency limit;
- retry limit with no unbounded retry loop;
- cache policy if caching is used;
- prompt and output truncation policy;
- malformed payload rejection;
- rate limits for `/mcp` or any future endpoint;
- observability that does not log raw sensitive data;
- refusal behavior when budget is exhausted.

Stop immediately if a future PR adds OpenAI SDK calls, model calls, prompt expansion, summarization loops, unbounded structured output, streaming, recursive tool calls, or expensive parsing without explicit budget and rate-limit approval.

## 12. What remains blocked after PR40

Still blocked after PR40:

- dependency installation;
- package.json changes;
- lockfile changes;
- Apps SDK imports;
- MCP SDK imports;
- OpenAI SDK imports;
- server skeleton;
- `/mcp`;
- `tools/list`;
- `tools/call`;
- transport runtime;
- public tunnel;
- ChatGPT connector;
- Developer Mode setup;
- OAuth;
- UI/resource/widget work;
- Convex changes;
- real handlers;
- real user data;
- outbound HTTP;
- LLM calls;
- persistent audit/logging;
- export/download/send/submit/apply;
- production behavior.

PR40 only defines gates for future consideration.

## 13. Stop conditions for future PRs

Stop any future PR immediately if it attempts any item below without explicit prior approval in that PR:

- install Apps SDK-related packages;
- install MCP SDK-related packages;
- install OpenAI SDK;
- add or modify `package.json`;
- add or modify any lockfile;
- add package manager config;
- import SDKs;
- create a server skeleton;
- create `/mcp`;
- expose `tools/list`;
- expose `tools/call`;
- create `call_tool`;
- create JSON-RPC runtime;
- open a listener;
- add Streamable HTTP, SSE, WebSocket, or tunnel behavior;
- set up ChatGPT connector or Developer Mode;
- add OAuth, token storage, auth metadata, callback routes, or scopes;
- add UI, iframe, widget resource, resource template, or component bridge;
- touch Convex for this path;
- add real handlers or handler registries;
- read real user data;
- emit raw source docs, raw CV/resume/job text, private facts, `never_use` facts, tokens, session IDs, stack traces, or generated full artifacts;
- add outbound HTTP, scraping, browsing, webhook, callback, or arbitrary URL behavior;
- add OpenAI SDK calls, model calls, streaming, prompt loops, or token-consuming behavior;
- add export/download/send/submit/apply.

Stop also if the PR claims that PR40 approved runtime.

PR40 does not approve runtime.

## 14. Allowed next PR

The only allowed next PR is one of these:

- a docs-only follow-up that tightens the approval gates if reviewers find a gap;
- a dependency approval request PR that changes no package files and asks maintainers to approve exact future packages;
- a package-only PR that installs exact approved dependencies, but only after explicit maintainer approval outside PR40.

No server skeleton PR is allowed next unless maintainers explicitly approve it after dependency and transport gates pass.

No runtime PR is allowed next.

No ChatGPT connector PR is allowed next.

No OAuth, UI, handler, real-data, or write-action PR is allowed next.

## 15. Acceptance criteria

PR40 passes only if:

- changed file count is exactly 1;
- changed file is `docs/decisions/2026-06-12-dependency-package-server-skeleton-approval-checkpoint.md`;
- no `my-app/**` files changed;
- no package or lockfile changed;
- no runtime config changed;
- no Apps SDK, MCP SDK, OpenAI SDK, or peer dependency installed;
- no MCP server, endpoint, transport, OAuth, UI, Convex, handler, real-data, outbound request, LLM call, or write action added;
- document explicitly keeps runtime blocked;
- document explicitly says PR40 does not approve dependency install or server skeleton;
- document addresses supply-chain and dependency-confusion risk;
- document addresses SSRF and outbound request abuse;
- document addresses LLM token/budget exhaustion and DoS;
- document defines stop conditions for SDKs, `/mcp`, tools runtime, OAuth, UI, handlers, real data, and write actions.

## 16. Verification

Run:

```bash
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected changed file:

```txt
docs/decisions/2026-06-12-dependency-package-server-skeleton-approval-checkpoint.md
```

No app tests are required because PR40 is docs-only and changes no runtime behavior.

Manual verification:

- Confirm runtime remains blocked.
- Confirm dependency install remains blocked.
- Confirm server skeleton remains blocked.
- Confirm PR39 gaps are addressed.
- Confirm changed file count is exactly one.

## 17. Verdict

PR40 defines the dependency, package, and server skeleton approval checkpoint.

PR40 allows future consideration only.

PR40 does not approve dependency installation.

PR40 does not approve package changes.

PR40 does not approve server skeleton work.

PR40 does not approve `/mcp`.

PR40 does not approve `tools/list`.

PR40 does not approve `tools/call`.

PR40 does not approve ChatGPT connection.

PR40 does not approve OAuth.

PR40 does not approve UI.

PR40 does not approve real handlers.

PR40 does not approve real user data.

PR40 does not approve outbound requests.

PR40 does not approve LLM calls.

PR40 does not approve production.

## 18. Rollback

Rollback is deletion-only:

```txt
docs/decisions/2026-06-12-dependency-package-server-skeleton-approval-checkpoint.md
```

Then rerun:

```bash
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
```
