# PR87.16 - Authoritative MCP Account-Link Lifecycle Brief

## Purpose

Add a server-only lifecycle for canonical MCP account links from already-verified OAuth evidence:

- create a canonical active link;
- idempotently refresh the exact active link;
- revoke the exact link without deleting it;
- keep lookup/resolver authorization behavior on the merged PR259/PR254 path.

No OAuth callback, authorization UI, consent UI, endpoint runtime wiring, Vite wiring, Stytch API call, Clerk lookup, public Convex function, production route, package change, or real application-data access is permitted.

## Base And Preflight

- Base branch: `origin/application-os-foundation`
- Actual base SHA: `97b8faa9c326868a298ed73d4357d03bdaf7ec47`
- Branch: `codex/pr87-16-mcp-account-link-lifecycle`
- Worktree: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan-pr87-16-mcp-account-link-lifecycle`
- PR263 URL: `https://github.com/panamini/neyssan/pull/263`
- Final PR263 head: `6faf7cd8f66134eb81a6d34bec8f21510a210773`
- PR263 merge SHA: `97b8faa9c326868a298ed73d4357d03bdaf7ec47`
- PR263 merged at: `2026-06-25T06:56:04Z`
- PR263 changed files: PR-local brief, local-MCP runtime composition module/tests, `my-app/tsconfig.node.json`, and `my-app/vite.config.ts`.
- PR263 status: GitHub PR state `MERGED`; CodeRabbit and Semgrep green before merge; GitHub CI/Playwright red with unavailable logs and admin squash merge.
- PR263 checkpoint: present at `wiki/sources/2026-06-25-pr87-15d-mcp-auth-local-runtime-wiring-checkpoint.md`.

## Gate87.16A1 Addendum

- Gate87.16A1 final classification: `MCP_INSPECTOR_AUTH_GATE_GREEN_WITH_DESCRIPTOR_NORMALIZATION_NOTE`
- MCP Inspector version: `0.22.0`
- Raw endpoint top-level `securitySchemes`: present
- Raw endpoint `_meta.securitySchemes`: present
- Inspector strips top-level `securitySchemes`
- Inspector preserves `_meta.securitySchemes`
- Metadata/auth behavior: passed
- Runtime/auth code change needed for PR87.16: no

PR87.16 must not create another Inspector/auth-descriptor gate PR and must not modify endpoint auth metadata, tools/list descriptors, verifier, lookup adapter, or runtime composition unless lifecycle tests prove a direct integration bug.

## Existing Storage Contract

Canonical table: `mcpAccountLinks`

Exact canonical storage fields already available:

- `kind: "local_mcp_account_link_record"`
- `version: 1`
- `provider: "stytch"`
- `providerSubject`
- `twoweeksClerkId`
- `clientId`
- `grantedReadScopes`
- `grantRef`
- `consentRef`
- `state`
- `createdAt`
- `updatedAt`
- `lastVerifiedAt`
- `revokedAt`
- `staleAt`
- `auditReasonCode`
- `issuer`
- `providerEnvironment`
- `canonicalGrantedScopes`
- `expiresAtEpochSeconds`
- `canonicalAccountLinkVersion: 1`

Exact canonical indexes already available:

- `by_provider_subject_client`: `provider`, `providerSubject`, `clientId`
- `by_provider_subject_client_state`: `provider`, `providerSubject`, `clientId`, `state`
- `by_provider_issuer_subject_environment`: `provider`, `issuer`, `providerSubject`, `providerEnvironment`
- `by_twoweeks_clerk_id`: `twoweeksClerkId`

No schema/index change is planned.

## Existing Lookup And Resolver Contracts

PR259 lookup port:

- source: `my-app/src/modules/local-mcp/mcpAuthRequestOrchestrator.ts`
- input: `{ issuer, subject, providerEnvironment, version: 1 }`
- adapter: `my-app/src/modules/local-mcp/mcpConvexAccountLinkLookupAdapter.ts`
- Convex query: `mcpAccountLinks.internalLookupMcpAuthPolicyAccountLinkCandidates`

Policy resolver:

- source: `my-app/src/modules/local-mcp/mcpAuthPolicyBoundary.ts`
- principal input: issuer, subject, audience, clientId, canonical granted scope, provider environment
- account-link candidate input: issuer, subject, provider environment, client ID, owner, canonical scope, state, created/updated/expiry timestamps
- fail-closed reasons already include missing, duplicate, revoked, stale, expired, malformed, wrong issuer/environment/client, missing scope, and identity override.

Current states:

- `active`
- `revoked`
- `stale`

Current legacy behavior:

- Legacy rows remain valid only for legacy callers.
- Incomplete legacy rows are not canonical MCP links.
- The canonical lookup does not synthesize issuer, environment, scopes, expiry, or version.
- Legacy dotted scopes stay only in the legacy `grantedReadScopes` field.

## Authoritative Evidence Contract

New server-only evidence type:

- `kind: "mcp_verified_account_link_evidence"`
- `provider: "stytch"`
- `issuer`
- `subject`
- `providerEnvironment`
- `clientId`
- `resource`
- `grantedScopes`
- `expiresAtEpochSeconds`
- `verifiedAtEpochSeconds`
- `cryptographicVerification: "already_verified_by_provider_adapter"`
- `version: 1`

Validation:

- plain object only;
- exact allowed keys only;
- canonical scope `twoweeks:applications:read` required;
- legacy dotted scopes rejected;
- mixed canonical and legacy scopes rejected;
- issuer/resource/client/environment must match operation config;
- finite safe-integer timestamps;
- expiry must be after verification time;
- expired evidence rejected;
- future verification beyond clock tolerance rejected;
- output is immutable;
- decoded-but-unverified JWT claims are not accepted.

Forbidden evidence fields:

- raw access token;
- refresh token;
- authorization code;
- ID token;
- email;
- display name;
- raw provider payload;
- private key;
- arbitrary request metadata;
- owner override.

## Owner Contract

The Twoweeks owner identity is separate trusted server-side context:

- `twoweeksClerkId`
- supplied outside evidence and outside MCP tool arguments
- validated as a safe account-link identifier

Reject:

- missing owner;
- malformed owner;
- owner in evidence;
- owner override fields;
- email/display-name owner lookup;
- arbitrary user ID from MCP input.

No Clerk network lookup is permitted.

## Lifecycle Semantics

Create:

- validate trusted owner and authoritative evidence;
- query all same-principal canonical candidates through `by_provider_issuer_subject_environment`;
- do not hide other clients, owners, revoked/stale/expired rows, malformed rows, or overflow;
- fail closed on cross-owner, duplicate, malformed, overflow, legacy ambiguity, or conflicting revoked rows;
- create one active canonical row only when there is no existing canonical row for the same external principal;
- store only canonical fields, not raw evidence or tokens.

Refresh:

- require exactly one active same-owner, same-client, same-subject canonical row;
- identical evidence is idempotent and unchanged;
- newer evidence updates verification/expiry timestamps;
- older/replayed evidence fails closed;
- expiry cannot move backward silently;
- no new row is created.

Revoke:

- require trusted owner context;
- query exact canonical identity;
- active -> revoked with `revokedAt`;
- repeated revoke returns unchanged success;
- another owner cannot revoke;
- unknown link returns safe not-found;
- row is preserved and later lookup/resolver denies.

Relink:

- no safe relink/reactivation policy exists in current ADRs/source.
- revoked links remain revoked.
- a create attempt for a revoked canonical same-principal row returns stable `relink_required`.
- OAuth callback/relink handling belongs to a later slice.

## Idempotency, Conflict, And Transaction Strategy

- All lifecycle decisions run inside internal Convex mutation handlers.
- Reads use canonical indexes; no table scan.
- Candidate overflow fails closed.
- Create is idempotent for an exact active same-owner same-client row with identical evidence.
- Refresh and revoke are idempotent.
- Cross-owner and duplicate active records fail closed.
- Malformed canonical candidates fail closed.
- Same-principal different-client rows remain visible and conflict before client filtering.

## Proposed Files

Expected touched files:

- `docs/plans/2026-06-25-pr87-16-mcp-account-link-lifecycle-brief.md`
- `my-app/convex/mcpAccountLinks.ts`
- `my-app/convex/__tests__/mcpAccountLinks.test.ts`

Forbidden files:

- endpoint/runtime auth metadata and descriptor files;
- `localMcpDevEndpoint.ts`;
- `vite.config.ts`;
- Stytch verifier implementation;
- account-link lookup adapter semantics;
- package manifests and lockfiles;
- Convex staging flags;
- production/deploy config;
- cover-letter files;
- roadmap mirror.

## Test Plan

- evidence validation negative matrix and one immutable valid evidence object;
- create with zero rows, retry/idempotency, raw-token absence, cross-owner conflict, different-client visibility, malformed candidate, overflow;
- refresh newer, identical, older/replayed, owner/subject/client/resource drift, expiry regression;
- revoke active, repeated revoke, another owner, unknown link, row preservation, resolver deny;
- relink unsupported path for revoked rows;
- integration create -> lookup -> resolver authorize and revoke -> deny;
- static assertions for no public Convex surface, no endpoint/Vite wiring, no provider/Clerk network, no token storage.

## Validation Plan

- focused lifecycle/account-link tests;
- existing Convex account-link tests;
- PR259 lookup adapter tests;
- PR254 policy tests;
- PR255 orchestrator tests;
- PR257 verifier tests;
- PR261 composition tests;
- PR263 runtime tests;
- full local-MCP suite;
- relevant Convex suite;
- `rtk npx tsc --build --pretty false`;
- targeted ESLint on changed files;
- `rtk npm run build`;
- `git diff --check origin/application-os-foundation...HEAD`;
- `git diff --name-only origin/application-os-foundation...HEAD`;
- forbidden-surface grep;
- Fallow read-only audit.

Temporary validation symlinks may be used only after manifest compatibility is verified and must be removed before final status.

## Codegen Plan

No schema/index change is planned, so Convex codegen should not be required. If generated files are required but unavailable, return `DRAFT_VALIDATION_BLOCKED`.

## Rollback

Revert this PR. The PR263 local/dev auth runtime, PR261 composition, PR259 lookup adapter, PR258 canonical storage/index contract, and earlier auth boundaries remain in place. No provider, token, production, or migration rollback is required.

READY_TO_IMPLEMENT
