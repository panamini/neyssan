# PR23 — ChatGPT App UX / Privacy Spec

Date: 2026-06-11
Status: planned spec
Scope: docs-only UX, consent, privacy, review, rollback.

## 1. Verdict

Certain:
- Twoweeks is not ready to submit a ChatGPT App.
- PR23 is a UX/privacy spec only.
- No tool should be exposed to ChatGPT until approval, audit, privacy, transport, auth and handler boundaries are reviewed together.
- PR23 ships no code.

Probable:
- The safe next work after PR23 is privacy/redaction fixtures, not production exposure.

À vérifier:
- Legal/data review before any remote app submission.

## 2. Non-goals

Certain:
- no ChatGPT App code
- no Apps SDK
- no MCP server
- no OAuth
- no deployment
- no transport runtime
- no real handlers
- no export
- no send
- no submit
- no apply
- no auto-apply
- no raw source document exposure
- no private facts in outputs
- no `never_use` facts in outputs

Rule:
- Spec first. Runtime later.

## 3. Current foundation

Certain:
- PR18 defines projected descriptors. Tools can be described. They do not run.
- PR19 defines a local call envelope and safe error contract. It is MCP-like, not protocol runtime.
- PR20 defines approval and audit shells. Nothing is persisted.
- PR21 defines a future handler boundary. No real handler exists.
- PR22 defines a remote transport spike. It is disabled by default and non-production only.

What this means:
- We have shape.
- We do not have permission to expose.

## 4. User consent model

Before any future tool is visible outside Twoweeks, the user must see:
- tool name
- what it can read
- what it cannot do
- data classes involved
- approval requirement
- audit statement
- privacy statement
- disable option

User-facing pattern:

```txt
Tool: Review package
Reads safe summaries only.
No raw resume. No source docs.
Nothing sent.
Approval required.
```

Consent must be:
- explicit
- revocable
- scoped to one tool or one session
- separate from general account consent

No buried consent.
No silent enable.
No magic.

## 5. Tool visibility model

Tool visibility states:

```txt
hidden
listed_disabled
listed_dry_run
listed_requires_approval
listed_ready_for_review
blocked_by_privacy
disabled_by_admin
```

Default:
- `hidden`

Rules:
- Never expose blocked tools.
- Never expose handlers without privacy review.
- Never list send, submit, apply or export tools.
- Local dry-run tools can be listed only as disabled or dry-run.
- Remote tools stay hidden until auth, transport, approval, audit, privacy and rollback are reviewed.

Copy:
- `Tool disabled.`
- `Dry run only.`
- `Approval required.`
- `Blocked. Review privacy.`

## 6. Approval UX

Approval is required before:
- any real handler
- any data leaves Twoweeks boundary
- any sensitive summary
- any action with side effects

Approval screen must show:
- tool name
- safe argument summary
- data classes involved
- result shape
- audit note
- deny button
- approve button

Approved means:
- this action only
- this scope only
- this session only unless stated otherwise

Denied means:
- nothing ran
- nothing sent
- no retry without user action

Copy:

```txt
Review first.
Approve this tool?
Denied. Nothing ran.
Approval expired. Try again.
```

Never say:
- `AI decided`
- `Automatically approved`
- `Seamless approval`

Approval is a gate. Not a vibe.

## 7. Privacy rules

Certain:
- Private facts never leave Twoweeks.
- `never_use` facts never leave Twoweeks.
- Raw source docs are never sent wholesale.
- Generated full text is not exposed unless explicitly approved.
- Safe summaries are the default output.
- Provenance can be summarized, not dumped.
- User can disable tools.

Data classes:

| Data class | Default outside Twoweeks | Rule |
|---|---|---|
| tool status | allowed | safe |
| artifact id | allowed | no content dump |
| safe summary | allowed after review | bounded |
| risk flag | allowed | no raw source |
| approval status | allowed | no reviewer private note |
| audit status | allowed | no raw payload |
| source document | forbidden | summarize only |
| raw resume text | forbidden | never default |
| private fact | forbidden | never |
| `never_use` fact | forbidden | never |
| complete generated resume | forbidden by default | explicit approval only |
| complete cover letter | forbidden by default | explicit approval only |

## 8. Output redaction rules

Allowed outputs:
- tool status
- safe summary
- artifact IDs
- risk flags
- approval status
- audit status
- high-level provenance count
- refusal reason
- bounded error text

Forbidden outputs:
- raw resume text
- raw CV text
- raw source docs
- private facts
- `never_use` facts
- sourceQuote dumps
- complete cover letters
- complete resumes
- stack traces
- secrets
- OAuth tokens
- raw arguments
- browser/session details

Redaction copy:

```txt
Output redacted.
Safe summary only.
Private data stayed private.
```

If unsure:
- redact
- explain briefly
- ask for review

## 9. Failure and refusal UX

Error copy must be short.
Fact. Action.
No stack traces.
No apology unless Twoweeks caused harm.

| Code | Copy |
|---|---|
| `approval_required` | `Approval required.` |
| `privacy_filter_required` | `Blocked. Review privacy.` |
| `unknown_tool` | `Tool unavailable.` |
| `invalid_arguments` | `Bad input. Try again.` |
| `transport_disabled` | `Remote tools disabled.` |
| `origin_not_allowed` | `Origin blocked.` |
| `handler_unavailable` | `No handler yet.` |
| `missing_user` | `Sign in required.` |
| `missing_session` | `Session expired.` |
| `request_too_large` | `Input too large.` |
| `response_too_large` | `Output too large.` |
| `rate_limited` | `Too many calls.` |
| `timeout` | `Timed out. Try again.` |

Bad copy:
- `Oops`
- `Something magical happened`
- `AI could not complete your powerful workflow`

Good copy:
- `Blocked.`
- `Review privacy.`
- `Nothing sent.`

## 10. Review gates before ChatGPT App submission

Required before any submission:

- [ ] security review
- [ ] privacy review
- [ ] product review
- [ ] UX copy review
- [ ] legal/data review if needed
- [ ] transport review
- [ ] OAuth/auth review
- [ ] rate-limit review
- [ ] audit/rollback review
- [ ] red-team prompt injection review
- [ ] private fact exposure tests
- [ ] `never_use` fact exposure tests
- [ ] raw source exposure tests
- [ ] approval denial tests
- [ ] disable/kill-switch tests
- [ ] incident response owner assigned
- [ ] user-visible consent copy approved

Gate rule:
- One unchecked box blocks submission.

## 11. Rollback and kill switch UX

Rollback actions:
- disable all tools
- disable one tool
- hide tool from list
- revoke approval
- stop remote transport
- invalidate session
- block origin
- block user/session if needed

User-facing copy:

```txt
Tools disabled.
Access revoked.
Session ended.
Nothing sent.
```

Operator-facing copy:

```txt
Tool killed.
Origin blocked.
Remote transport stopped.
```

Rollback must be fast.
Design for panic.

## 12. User-facing copy inventory

| Situation | Copy | Notes |
|---|---|---|
| tool listed disabled | `Tool disabled.` | default safe state |
| tool listed dry-run | `Dry run only.` | no real action |
| approval required | `Approval required.` | before action |
| approval prompt | `Approve this tool?` | confirmation question allowed |
| approval denied | `Denied. Nothing ran.` | clear end state |
| approval expired | `Approval expired. Try again.` | no auto retry |
| privacy blocked | `Blocked. Review privacy.` | no raw data |
| transport disabled | `Remote tools disabled.` | PR22 default |
| handler unavailable | `No handler yet.` | PR21 boundary only |
| audit unavailable | `Audit unavailable. Tool blocked.` | no audit, no run |
| output redacted | `Output redacted.` | safe summary only |
| tool disabled by admin | `Tool disabled.` | no extra detail |
| session expired | `Session expired.` | sign in again |
| origin blocked | `Origin blocked.` | no URL dump |
| rate limited | `Too many calls.` | no blame |
| timeout | `Timed out. Try again.` | short |

Buttons:
- `Approve`
- `Deny`
- `Disable tool`
- `Review data`
- `Try again`

No button longer than 3 words.

## 13. Edge cases

- User revokes approval during call.
  - Stop. Mark approval invalid. Show `Access revoked.`
- Tool listed but handler disabled.
  - Show `No handler yet.`
- Transport allowed but privacy review missing.
  - Block. Show `Blocked. Review privacy.`
- ChatGPT asks for raw resume.
  - Refuse. Safe summary only.
- ChatGPT asks to send/apply.
  - Refuse. Out of scope.
- Source doc contains private info.
  - Redact. Do not summarize private facts.
- Generated artifact includes unsupported claim.
  - Block claim. Show risk.
- Approval exists but audit missing.
  - Block. Show `Audit unavailable. Tool blocked.`
- Origin allowed but session missing.
  - Block. Show `Session expired.`
- User changes visibility to private after approval.
  - Invalidate approval. Re-run privacy check.
- User asks why a tool is blocked.
  - Explain one reason. No raw payload.

## 14. Risks

### P0

- Private fact exposed.
- `never_use` fact exposed.
- Auto-submit/apply exposed.
- Raw resume sent without approval.
- Raw source doc sent wholesale.

Required response:
- kill tool
- revoke approval
- block transport
- audit event
- user notice if applicable

### P1

- Approval bypass.
- Audit missing.
- Handler executes without idempotency.
- Transport origin bypass.
- Real handler exposed before privacy review.

Required response:
- block release
- add tests
- review boundary

### P2

- Confusing copy.
- Tool visible too early.
- Refusal message too vague.
- Safe summary too broad.

Required response:
- tighten copy
- reduce visibility
- add fixture

### P3

- Copy polish.
- Docs naming.
- Table formatting.

Fix when convenient.
Do not block safety work.

## 15. Verification checklist

Docs-only commands:

```bash
rtk git status --short --branch
rtk git diff --name-only application-os-foundation...HEAD
rtk git diff --check
```

Expected changed files:

```txt
docs/plans/2026-06-11-chatgpt-app-ux-privacy-spec.md
```

No Vitest required.
Docs-only PR.

If CI runs anyway:
- it should pass without code changes.

## 16. Future PRs

Recommended sequence:

- PR24: privacy/redaction test fixtures, pure TypeScript only.
- PR25: tool visibility policy module, pure TypeScript only.
- PR26: approval UX copy fixtures, docs/tests only.
- PR27: non-production ChatGPT App prototype, only after explicit approval.

Not promised:
- production remote MCP
- public ChatGPT App
- real handlers
- send/apply/submit/export

## 17. Rollback

Delete:

```txt
docs/plans/2026-06-11-chatgpt-app-ux-privacy-spec.md
```

Then run:

```bash
rtk git diff --check
rtk git status --short --branch
```

Rollback is deletion-only.

The work is not done until privacy is boring.
