# PR59-prep-3 - Stytch Account-Linking Storage Decision

Date: 2026-06-14
Status: BLOCKED
Scope: docs-only decision before PR59 real read-only data implementation

## 1. Objective

This decision records the account-linking storage model required before PR59 can read real Twoweeks/Convex data through MCP.

This PR does not implement account-linking storage.
This PR does not implement OAuth runtime.
This PR does not add an OAuth callback.
This PR does not store access tokens or refresh tokens.
This PR does not read real Twoweeks data.
This PR does not touch Convex schema, selectors, handlers, package files, or runtime behavior.

## 2. Current State

PR175 is merged:

```txt
PR175 - OAuth account-linking verifier boundary
GitHub PR: https://github.com/panamini/neyssan/pull/175
Merge commit: df3231d4277fa6fe4c8c0a6e5740a0ab105c1011
```

PR175 verifies bearer tokens fail closed using Stytch-shaped fixture JWTs and injected JWKS keys.

PR175 does not map a verified Stytch OAuth subject to Twoweeks/Convex ownership. Its subject-mapping contract remains deferred:

```txt
verified OAuth subject -> Twoweeks user lookup deferred until real-data PR
```

Therefore PR59 real data remains blocked.

## 3. Decision

Stytch `sub` must not be treated as Convex `clerkId`.

A verified Stytch OAuth token proves only:

- the external OAuth subject;
- the approved client identity;
- the verified issuer;
- the verified audience/resource;
- the verified scopes;
- the token validity window.

It does not prove ownership of an existing Twoweeks/Convex account until that OAuth subject is explicitly linked server-side.

The preferred future mapping model is:

```txt
Stytch OAuth subject
-> server-only account-link record
-> existing Twoweeks user / Convex clerkId
```

The account-link record is the ownership bridge. It must be evaluated before any real Convex/Twoweeks read.

## 4. Rejected Models

Rejected:

- treating Stytch `sub` as `clerkId`;
- deriving `clerkId` from token claims without a server-owned link record;
- returning user IDs, Clerk IDs, emails, tokens, or raw claims in MCP outputs;
- model-visible account-link records;
- ChatGPT-visible account identifiers;
- token storage as an account-linking substitute;
- calling existing Convex selectors directly from MCP before safe selector projection exists.

Reason:

Existing Twoweeks app ownership is Clerk/Convex-based. Stytch OAuth is the AI-client authorization provider for MCP, not the existing app identity provider. The bridge between those identities must be explicit, revocable, auditable, and server-only.

## 5. Account-Linking Storage Requirements

A future account-linking storage boundary must define a server-only record that can map:

```txt
provider = "stytch"
providerSubject = verified Stytch sub
twoweeksClerkId = existing Convex/Twoweeks Clerk user id
clientIdentity = approved AI client id or azp
```

Required fields:

- provider;
- provider subject;
- Twoweeks/Convex `clerkId`;
- client identity;
- granted read-only scope metadata;
- grant or consent reference metadata;
- created timestamp;
- updated timestamp;
- revoked timestamp or revocation state;
- audit-safe reason/status code;
- version.

Required behavior:

- server-only;
- never model-visible;
- never returned in MCP outputs;
- no OAuth access token storage;
- no refresh token storage;
- revocable;
- auditable;
- scoped per AI client if needed;
- read-only for the first unlock;
- fail closed when missing;
- fail closed when revoked;
- fail closed when stale;
- fail closed when ambiguous;
- fail closed when client identity does not match;
- fail closed when scope metadata is insufficient.

## 6. Existing Selector Risk

Existing Convex selectors cannot be called directly by PR59.

Known risky fields and surfaces include:

- `activeCvSnapshots.ts`: ownership uses `clerkId`; title fallback can derive from email.
- `profilesPublic.ts`: exposes `clerkId`, `email`, `raw_text`, metadata, and optional `cvDocument`.
- `jobsPublic.ts`: exposes `rawDescription`, review item `sourceText`, debug `raw_text`, and `structuredShadow`-style raw mirrors.
- `proposalsPublic.ts`: exposes full proposal `content`, section content, and `sourceJobDescription`.

PR59 requires safe selector projection before any real data read can be approved.

The future PR59 adapter must not return:

- raw CV/resume text;
- raw job text;
- raw proposal/application content;
- source quotes;
- private facts;
- `never_use` facts;
- generated full artifacts;
- emails;
- `clerkId`;
- user/session IDs;
- tokens;
- raw claims;
- debug payloads;
- structured shadow payloads.

## 7. Future Code PR

Next recommended code PR:

```txt
PR59-prep-4 - Account-linking storage boundary
```

Allowed scope for PR59-prep-4:

- storage boundary only;
- fixture tests;
- server-only account-link record shape;
- fail-closed account-link lookup contract;
- no real data reads;
- no tool handlers;
- no production connector;
- no outbound HTTP;
- no LLM/model calls;
- no export/download/send/submit/apply;
- no package or lockfile changes unless separately approved.

PR59-prep-4 must still not unlock PR59 real data by itself. It only proves that a verified Stytch subject can be mapped, or refused, through a server-only account-linking boundary.

## 8. PR59 Blockers

PR59 remains blocked until all of these are true:

1. OAuth verifier boundary is merged.
2. Account-linking storage boundary is merged.
3. Safe Convex selectors are defined.
4. PR59 preflight is rerun.
5. PR59 preflight returns `READY_TO_IMPLEMENT_NARROW_PR59`.

Current status:

```txt
BLOCKED_NEEDS_ACCOUNT_LINKING_STORAGE
```

## 9. Explicit Non-Permissions

This decision does not allow:

- code changes;
- Convex schema changes;
- Convex reads;
- Convex writes;
- local MCP runtime changes;
- OAuth runtime;
- OAuth callback;
- token storage;
- handler implementation;
- real data access;
- production connector behavior;
- tool execution;
- outbound HTTP;
- LLM/model calls;
- export/download/send/submit/apply;
- package or lockfile changes.

## 10. Verification

Run:

```bash
rtk git diff --check application-os-foundation...HEAD
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected changed files:

```txt
docs/decisions/2026-06-12-stytch-account-linking-storage-decision.md
docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
```

Manual verification:

- Confirm this PR is docs-only.
- Confirm no `my-app/**` files changed.
- Confirm no package or lockfile changed.
- Confirm PR59 remains blocked.
- Confirm the next PR recommendation is PR59-prep-4.

## 11. Verdict

```txt
BLOCKED
```

PR59 real-data implementation remains blocked.

The next step is PR59-prep-4, a narrow account-linking storage boundary code PR, only after this decision is reviewed and merged.
