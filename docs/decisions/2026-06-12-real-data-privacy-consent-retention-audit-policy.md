# PR37 - Real-data Privacy, Consent, Retention, and Audit Policy

Date: 2026-06-12
Status: proposed
Scope: docs-only policy decision before any real-data Apps SDK/MCP runtime work.

## 1. Objective

PR37 defines policy only.

It does not approve real-data use.
It does not approve runtime, OAuth, handlers, UI, or server implementation.
It exists to block accidental real-data exposure before architecture and auth are ready.

PR37 answers:

```txt
What are the privacy, consent, retention, deletion, redaction, audit, and logging rules before any real-data Apps SDK work can begin?
```

## 2. Current state

This is the current state after confronting the PR37 plan with the active repo docs and `my-app/src/modules/local-mcp` code:

- Current prototype/scaffold is fixture-only.
- PR24 has sentinel privacy fixtures, not semantic privacy.
- PR27.1 is review-only, not runtime permission.
- PR36, once merged, defines a future server boundary only.
- No OAuth/auth exists.
- No real data may enter ChatGPT App surfaces.
- PR20 audit events are local shells only, not persistent audit.
- PR26 copy fixtures are future UX inputs only, not a consent UI.
- PR25 visibility states are review/listing policy only, not callable tool exposure.

Active code reviewed:

- `my-app/src/modules/local-mcp/privacyRedactionFixtures.ts`
- `my-app/src/modules/local-mcp/mcpApprovalAuditBoundary.ts`
- `my-app/src/modules/local-mcp/mcpPrivacyReviewGate.ts`
- `my-app/src/modules/local-mcp/mcpApprovalUxCopyFixtures.ts`

Official docs re-checked on 2026-06-12:

- OpenAI Apps SDK Security & Privacy: `https://developers.openai.com/apps-sdk/guides/security-privacy`
- OpenAI Apps SDK App submission guidelines: `https://developers.openai.com/apps-sdk/app-submission-guidelines`
- OpenAI Apps SDK Authenticate users: `https://developers.openai.com/apps-sdk/build/auth`
- OpenAI Apps SDK Manage state: `https://developers.openai.com/apps-sdk/build/state-management`
- MCP specification, latest version 2025-11-25: `https://modelcontextprotocol.io/specification/2025-11-25`
- MCP tools specification, latest version 2025-11-25: `https://modelcontextprotocol.io/specification/2025-11-25/server/tools`
- MCP authorization specification, latest version 2025-11-25: `https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization`

## 3. Data classes

| Data class | Examples | Allowed now? | Future gate |
| --- | --- | --- | --- |
| fixture data | fake refs, safe summaries | yes | PR24/PR33 checks |
| metadata refs | packageRef, evidenceGraphRef | yes, fixture/local only | descriptor review |
| raw source docs | CV, resume, job text, pasted docs | no | real-data policy + auth + privacy review |
| private facts | candidate private facts | no | semantic privacy policy |
| never_use facts | disallowed facts | no | must stay blocked |
| generated artifacts | full resume/cover letter | no generic output | dedicated artifact policy |
| secrets/tokens | OAuth tokens, session IDs | no | auth/security policy |
| audit summaries | bounded events | local shell only | persistence/audit policy |

## 4. Real-data prohibition until approved

No future Apps SDK/MCP PR may expose any of these until an explicit future PR approves all required gates:

- real CV/resume/job text
- real cover letter
- raw source docs
- real user IDs/session IDs
- customer-specific data
- tokens/secrets
- production logs

This prohibition applies to model-visible output, component-visible output, server logs, audit logs, errors, metadata, fixtures, screenshots, and review artifacts.

## 5. Consent model

Future consent must disclose:

- what tool is being used
- what data class is needed
- why it is needed
- what will be visible to the model
- what will be visible to any component
- what will be visible to the server
- what will be logged
- what action, if any, may happen
- expiration and revocation behavior
- denial path

Consent must be explicit, scoped, revocable, and separate from general account consent.

PR37 does not implement consent UI.

## 6. Data minimization rules

The required future minimization order is:

1. refs before raw text
2. safe summary before source text
3. category before raw value
4. bounded audit event before raw payload
5. explicit allowlist before open data

Forbidden minimization shortcuts:

- no sourceQuote dumps
- no stack traces
- no raw arguments in user-facing output
- no raw arguments in model-facing output
- no broad object serialization into logs
- no "component-only" raw dump as a substitute for privacy review

## 7. Model-visible data rules

Future model-visible data must be safe summary only by default.

The model must not receive:

- raw source docs
- raw CV/resume/job text
- private facts
- never_use facts
- tokens/secrets/session IDs
- hidden audit internals
- stack traces
- raw arguments
- full artifacts unless a dedicated artifact policy exists

## 8. Component-visible data rules

Even future UI/components must not receive these by default:

- raw source docs
- raw CV/resume/job text
- private facts
- never_use facts
- secrets/tokens
- stack traces
- hidden fields
- raw audit payloads

`_meta` and component-only data are not privacy substitutes.

If component data is needed later, a future component policy must define exact fields, lifetime, rendering scope, and redaction behavior.

## 9. Server-visible data rules

A future server may see only what it must validate.

The server must not become the owner of business logic or privacy semantics.
The future MCP server boundary must remain an adapter around reviewed Twoweeks contracts.

Server-side validation remains mandatory because official Apps SDK and MCP guidance assumes model-provided input can be wrong, malicious, or prompt-injected.

## 10. Logging and audit rules

Future logs must not contain:

- raw payloads
- raw source docs
- raw args
- secrets/tokens/session IDs
- stack traces exposed to model/user
- private facts
- never_use facts
- full generated artifacts

Allowed future log shape:

- bounded event type
- bounded reason code
- correlation ID
- safe ref ID
- policy version
- consent state
- approval state
- redaction state

Audit events must be tamper-evident only in a future persistence PR.
PR20 audit events remain local shell evidence only.

## 11. Retention and deletion rules

Future requirements before real-data persistence:

- retention periods must be explicit
- deletion path must exist before real-data persistence
- local fixture data can be ephemeral
- no indefinite real-data logs
- no production data retention until policy is implemented
- no retained raw prompt text unless a future privacy review explicitly approves it
- deletion must cover server data, audit data, logs, component state, and generated artifacts

## 12. Redaction rules

PR24 sentinel checks are not enough.

Future redaction must cover:

- semantic categories
- structured fields
- logs
- errors
- audit events
- model-visible content
- component-visible content
- server-visible validation summaries

Future redaction tests must include private facts, never_use facts, raw source docs, raw CV/resume/job text, source quote dumps, tokens, session IDs, raw arguments, stack traces, and full generated artifacts.

## 13. Prompt-injection assumptions

Assume:

- source docs may contain hostile instructions
- job posts may contain hostile instructions
- user-provided text may try to override policy
- model output may request blocked actions
- tool arguments may contain exfiltration attempts

Policy:

- source text cannot override gates
- tool calls require schema validation
- write actions require explicit consent and approval
- server validation must reject blocked data classes even if the model asks for them
- prompts and tool descriptions are not security boundaries

## 14. Write-action policy

Write actions remain forbidden:

- export
- download
- send
- submit
- apply
- auto-apply
- mutate candidate record
- mutate external system

A future write action requires:

- auth/OAuth
- consent
- approval
- audit
- idempotency
- rollback
- dry-run preview
- human confirmation
- least-privilege scope
- prompt-injection tests

## 15. Auth/OAuth dependency

Customer-specific data requires:

- separate auth/OAuth ADR
- token storage policy
- scope minimization
- revocation
- account linking review
- audience-bound token validation
- no tokens in logs/model/UI
- no token passthrough

OpenAI Apps SDK authentication guidance says customer-specific data or write actions should authenticate users.
The current MCP authorization spec defines OAuth 2.1 expectations for HTTP transports.

PR37 does not approve OAuth.

## 16. Incident and rollback model

Any future real-data incident model must include:

- disable all tools
- disable one tool
- hide tool listing
- revoke approval
- revoke OAuth/account link
- stop transport
- invalidate sessions
- quarantine logs
- identify exposed data classes
- notify users or operators when required
- delete accidental retained data
- preserve privacy-safe audit evidence

Rollback must be deletion-first for docs-only or fixture-only PRs.
Runtime rollback requires a future kill-switch policy.

## 17. Boundary with PR24 / PR27.1

PR24 = sentinel fixture regression only.

PR27.1 = local review gate only.

Neither approves real data.
Neither is semantic privacy proof.
Neither is runtime permission.
Neither is ChatGPT App readiness.
Neither approves OAuth, handlers, transport, UI, export, download, send, submit, apply, or production.

Both remain required inputs for future implementation.

## 18. Open questions

- What semantic privacy taxonomy owns private facts and never_use facts?
- What future artifact policy governs complete generated resumes and cover letters?
- What persistent audit store, if any, is acceptable for real-data actions?
- What retention periods apply to generated artifacts, logs, and audit events?
- Which OAuth provider and account-linking model would be acceptable?
- What legal/data review is required before customer-specific Apps SDK exposure?
- What prompts and fixtures prove prompt-injection resistance?

## 19. Stop conditions

Stop any future PR if it needs any of these without explicit approval:

- real user data
- OAuth
- token storage
- server logs
- persistent audit
- source documents
- generated full artifacts
- write actions
- package changes
- endpoint
- UI/component
- Apps SDK install
- MCP SDK install
- OpenAI SDK install
- `/mcp`
- `tools/list`
- `tools/call`

## 20. Acceptance criteria for PR37

PR37 passes only if:

- changed file count is exactly 1
- changed file is `docs/decisions/2026-06-12-real-data-privacy-consent-retention-audit-policy.md`
- no `my-app/**` files changed
- no package or lockfile changed
- no runtime config changed
- no Apps SDK, MCP SDK, or OpenAI SDK dependency added
- no MCP server, endpoint, transport, OAuth, UI, Convex, or handler added
- document states real data remains forbidden
- document defines consent, minimization, redaction, logging, retention, deletion, audit, prompt-injection, auth, and write-action policy gates
- document states PR24 and PR27.1 remain required but insufficient

## 21. Verification

Run:

```bash
rtk git diff --check
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected changed file:

```txt
docs/decisions/2026-06-12-real-data-privacy-consent-retention-audit-policy.md
```

No app tests are required because PR37 is docs-only and changes no runtime behavior.

Manual verification:

- Confirm official Apps SDK Security & Privacy, submission, auth, and state docs were re-checked.
- Confirm MCP latest spec, tools, and authorization docs were re-checked.
- Confirm PR37 does not modify app code.
- Confirm PR37 does not create runtime permission.

## 22. Verdict

PR37 defines the real-data policy boundary.

Ready for PR38: Tool contract mapping from local fixtures to future MCP descriptors, docs-only or tests-only.

Not ready for real-data runtime.
Not ready for OAuth.
Not ready for handlers.
Not ready for export/send/submit/apply.
Not ready for Apps SDK/MCP runtime.

## 23. Next PR recommendation

Recommended next PR:

```txt
PR38 - Tool contract mapping from local fixtures to future MCP descriptors.
```

PR38 should remain docs-only or tests-only.
It should not add runtime, endpoints, OAuth, handlers, UI, package dependencies, or real data.

Final rule:

```txt
No real data by accident.
```
