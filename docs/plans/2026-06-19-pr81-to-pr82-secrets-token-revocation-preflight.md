# PR81-to-PR82 Secrets, Token Storage, and Revocation Hardening Preflight

Date: 2026-06-19

Base branch: `application-os-foundation`

Preflight branch: `codex/pr81-to-pr82-secrets-token-revocation-preflight`

Type: docs-only security/governance preflight.

## Repository Truth

- PR208 is merged.
- PR209 is merged.
- PR210 is merged.
- PR211 is merged.
- PR212 is merged.
- PR212 title: `PR81: Manual handoff rate budgets`.
- PR212 head: `cd3bf82836dcb7fa3819efd961f633ddc0bfea91`.
- PR212 merge commit: `01e8046cc9e6d8d23968fcea113b9d84273b36b8`.
- PR212 merged at: `2026-06-19T21:39:51Z`.
- Local `application-os-foundation` is at `01e8046cc9e6d8d23968fcea113b9d84273b36b8`.
- No open GitHub PRs exist at preflight time.
- No PR82 branch or PR exists.
- No PR80-live provider PR exists.
- Answer-copy implementation remains blocked by `BLOCKED_NO_AUTHORITATIVE_SOURCE`.
- PR80-live remains blocked by provider authorization prerequisites.

The progress ledger was stale before this preflight and still listed PR80-to-PR81 as current. That is not a blocking governance conflict because GitHub and local repository truth match PR212 exactly, and this docs-only PR is explicitly authorized to record PR212 and set the PR82 preflight as current.

## PR81 Merge Verification

PR212 changed exactly the PR81 manual handoff rate-budget files:

- `my-app/convex/__tests__/manualApplicationHandoff.test.ts`
- `my-app/convex/lib/manualApplicationHandoff.ts`
- `my-app/convex/manualApplicationHandoff.ts`
- `my-app/convex/schema.ts`
- `my-app/src/components/jobs/JobsWorkspace.tsx`
- `my-app/src/components/jobs/ManualApplicationHandoffPanel.tsx`
- `my-app/src/components/jobs/__tests__/ManualApplicationHandoffPanel.test.tsx`

Verified PR81 behavior:

- manual handoff prepare is rate/budget protected;
- confirm is rate/budget protected;
- delivery-content load is mutation-protected, not bypassable query-only;
- file-download audit is rate/budget protected;
- destination-open audit is rate/budget protected;
- outcome report is rate/budget protected;
- blocked answer-copy attempts are tightly quota-protected and still do not enable answer copy;
- quota rows are redacted and bounded;
- expired quota cleanup uses a bounded batch;
- structured safe UI refusal copy is used;
- pending actions are disabled;
- no raw quota keys, counters, user ids, full URLs, artifact content, or answer text are shown in the UI.

Inherited repo-wide gates remain out of PR81 and PR82-preflight scope:

- `rtk npm run lint` is inherited-red on base and branch because `.eslintrc.cjs` requires missing `./scraping-server/tsconfig.json`.
- `rtk npm run build` is inherited-red on base and branch due existing repo-wide TypeScript debt, first at `convex/activeCvSnapshots.ts:153`.

## Current Auth, Token, And Secret Inventory

Active MCP/Stytch auth surfaces:

- `my-app/src/modules/local-mcp/mcpProductionStytchOAuthConfigBoundary.ts`
  - local JWT verification only;
  - RS256 only;
  - server-provided JWKS only;
  - remote JWKS blocked;
  - token introspection blocked;
  - token storage is `none`;
  - refresh-token storage is `none`;
  - data reads, writes, handler execution, production connector, model calls, and write actions blocked.
- `my-app/src/modules/local-mcp/mcpProductionAccountLinkPersistenceBoundary.ts`
  - server-only Stytch subject to Twoweeks owner mapping;
  - rejects Stytch subject equal to Twoweeks owner id;
  - validates client, scopes, active/revoked/stale/expired state, grant ref, consent ref, and audit reason code;
  - network access blocked;
  - credential storage and token storage are `none`.
- `my-app/convex/mcpAccountLinks.ts`
  - internal-only Convex account-link create, active resolution, and local `revoked`/`stale` state marking;
  - stores provider subject, Twoweeks owner id, client id, read scopes, refs, state, timestamps, and audit reason code;
  - does not store OAuth access tokens, refresh tokens, raw JWTs, raw claims, sessions, emails, or generated application content.
- `my-app/convex/schema.ts`
  - `mcpAccountLinks` table exists with account-link metadata only.
- `my-app/src/modules/local-mcp/mcpReadOnlyTwoweeksDataAdapter.ts`
  - requires auth boundary success, account-link boundary success, account-link resolution, consent, retention, and safe refs;
  - returns safe refs only;
  - token storage and credential storage are `none`.
- `my-app/convex/mcpReadOnlyTwoweeksDataRefs.ts`
  - internal read-only owner-scoped safe ref counts/status only;
  - raw data projection, writes, network access, model calls, production connector, and write actions blocked.
- `my-app/src/modules/local-mcp/mcpConsentGate.ts`
  - consent boundary only; does not authorize auth, handler execution, or write actions.
- `my-app/src/modules/local-mcp/mcpRedactedAuditLog.ts`
  - fixture audit redaction boundary with credential, token, authorization, session, identity, raw source, and artifact classifiers.
- `my-app/src/modules/local-mcp/mcpRetentionDeletionBoundary.ts`
  - fixture retention/deletion boundary; persistence deletion and Convex writes blocked.
- `my-app/src/modules/local-mcp/mcpSafeConvexSelectorProjectionBoundary.ts`
  - safe selector projection; rejects token, bearer, refresh token, raw claims, user identity, provider subject, raw text, and full artifact fields.

Other active repo secrets:

- Existing non-MCP LLM/parser code uses server-side API keys from environment variables.
- Those API-key paths are not PR82's ChatGPT/MCP token-storage surface and must not be swept into a broad secrets rewrite here.
- `my-app/convex/auth.config.ts` currently logs the Clerk issuer domain and reads `CLERK_JWT_ISSUER_DOMAIN`. The value is not a token, but PR82 may remove or harden this log as part of safe config-status cleanup.

## Existing Boundaries Found

- Fail-closed local JWT verifier/config boundary for Stytch-shaped access tokens.
- Server-only account-link persistence boundary.
- Internal Convex account-link table and local state transitions to `revoked` or `stale`.
- Redacted audit classifiers for token/secret/authorization/session/identity/raw-data markers.
- Consent, retention/deletion, and safe selector projection boundaries.
- Read-only adapter and data-ref query that expose safe refs/counts/status only.

## Missing Boundaries

- No OAuth callback runtime.
- No authorization-code exchange.
- No token endpoint integration.
- No refresh-token flow.
- No refresh-token storage.
- No access-token storage table.
- No encrypted token-at-rest boundary.
- No provider credential setup for PR80-live.
- No provider revocation endpoint integration.
- No live provider disconnect network call.
- No production connector runtime unlocked by this preflight.
- No authoritative approved application-answer source for answer copy.

## Risk Table

| Risk | Severity | Impact | PR82 treatment |
| --- | --- | --- | --- |
| Inventing token storage just because PR82 mentions tokens | High | Adds new secret persistence without an authorized runtime need | Forbidden |
| Adding live provider revocation without authorization | High | Creates unauthorized provider integration and network behavior | Forbidden |
| Treating Stytch `sub` as Convex/Clerk owner id | High | Cross-user data exposure risk | Harden account-link tests and source guards |
| Returning raw token, subject, owner id, or claims in errors/audit/model output | High | Credential or identity leakage | Harden redaction tests/source guards |
| Broadly refactoring unrelated LLM/parser API-key paths | Medium | Architecture drift and regression risk | Out of scope |
| Leaving local account-link disconnect semantics under-tested | Medium | Revoked/stale links could be mishandled | Include local-only state hardening |
| Logging config values as raw status | Low | Could normalize unsafe logging patterns | Include safe config-status cleanup if narrow |

## Scope Evaluation

A. Secret/config validation hardening: included.

- Harden fail-closed server-only config parsing and safe config status for the existing Stytch verifier/config boundary.
- Prevent raw secret, JWKS, token, authorization header, subject, owner id, or claims from being returned to UI/model/audit outputs.
- Keep all config server-only.

B. Token storage hardening: excluded.

- No real OAuth access-token, refresh-token, token exchange, or token storage runtime exists.
- PR82 must not create encrypted token storage.
- PR82 may only add source guards proving token storage remains absent.

C. Token revocation/disconnect: included only as local account-link disconnect metadata.

- Existing account-link records have `active`, `revoked`, and `stale` states.
- Existing Convex internal mutation can mark records `revoked` or `stale`.
- PR82 may harden local disconnect/stale/revoked semantics and tests.
- PR82 must not add a live provider revocation network call.

D. Account-link hardening: included.

- Preserve server-only Stytch subject to Twoweeks owner mapping.
- Prove Stytch subject is not treated as Clerk id.
- Harden malformed, ambiguous, revoked, stale, expired, wrong-client, and insufficient-scope cases.
- Keep audit output redacted.

E. Logging/audit hardening: included.

- Add or tighten tests for secret/token/key classifiers.
- Prove forbidden keys and values are not emitted in errors, model-visible outputs, component props, or audit entries.
- Keep raw quota keys, user ids, subjects, full URLs, artifact content, and answer text out of UI and model-visible payloads.

F. PR80-live/provider token scope: excluded.

- Provider credentials, provider APIs, test tenant/sandbox, official endpoints, and authorization are still absent.
- PR80-live remains blocked.

## Future PR82 Recommendation

Final decision: `READY_TO_IMPLEMENT_NARROW_PR82`.

Next code PR:

```txt
PR82 - Secrets, Token Storage, and Revocation Hardening
Branch: codex/pr82-secrets-account-link-redaction-hardening
```

Allowed future PR82 behavior:

- harden existing Stytch config parsing and safe config-status output;
- remove or gate raw config logging in Convex auth config if it remains narrowly scoped;
- harden existing server-only account-link parsing, resolution, and local state transitions;
- harden local disconnect/stale/revoked metadata semantics;
- harden audit/refusal/model-visible redaction tests;
- add source guards proving token storage, token exchange, refresh-token handling, provider revocation, provider credentials, PR80-live, browser automation, and package changes remain absent.

## Exact Files For Possible Code PR

Allowed files:

- `my-app/src/modules/local-mcp/mcpProductionStytchOAuthConfigBoundary.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpProductionStytchOAuthConfigBoundary.test.ts`
- `my-app/src/modules/local-mcp/mcpProductionAccountLinkPersistenceBoundary.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpProductionAccountLinkPersistenceBoundary.test.ts`
- `my-app/convex/mcpAccountLinks.ts`
- `my-app/src/modules/local-mcp/mcpRedactedAuditLog.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpRedactedAuditLog.test.ts`
- `my-app/src/modules/local-mcp/mcpReadOnlyTwoweeksDataAdapter.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpReadOnlyTwoweeksDataAdapter.test.ts`
- `my-app/src/modules/local-mcp/mcpSafeConvexSelectorProjectionBoundary.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpSafeConvexSelectorProjectionBoundary.test.ts`
- `my-app/convex/auth.config.ts`, only for narrow raw-config-log removal or safe status hardening.
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`

## Exact Forbidden Files And Surfaces

Forbidden in PR82 unless a later explicit governance decision changes this:

- package files and lockfiles;
- OAuth callback routes;
- token exchange or refresh-token code;
- encrypted access-token or refresh-token storage;
- provider credentials;
- provider API clients;
- live provider revocation calls;
- PR80-live submit/apply files;
- browser automation;
- external HTTP execution paths;
- production connector runtime wiring;
- tools/list or tools/call runtime behavior;
- answer-copy implementation;
- unrelated LLM/parser provider key refactors;
- schema changes or broad migrations.

## Validators, Helpers, And Source Guards For PR82

PR82 should add or tighten validators for:

- Stytch config envelope and server-only config status;
- authorization-header parsing with no token echo;
- account-link owner mapping with provider subject distinct from Twoweeks owner id;
- local revoked/stale state transition idempotency;
- malformed, ambiguous, expired, revoked, stale, wrong-client, and insufficient-scope account-link cases;
- audit reason code format and bounded safe output;
- forbidden token/secret/session/identity/raw-data keys and values.

Required source guards:

- no `access_token` or `refresh_token` storage;
- no token endpoint or revocation endpoint implementation;
- no `client_secret` exposure;
- no raw `Authorization` header returned from boundary results;
- no provider API network call;
- no PR80-live submit/apply/browser automation imports;
- no package or lockfile changes.

## Tests Required For PR82

Run the narrow tests first, then broaden only if the changed files require it:

- `rtk npx vitest run my-app/src/modules/local-mcp/__tests__/mcpProductionStytchOAuthConfigBoundary.test.ts`
- `rtk npx vitest run my-app/src/modules/local-mcp/__tests__/mcpProductionAccountLinkPersistenceBoundary.test.ts`
- `rtk npx vitest run my-app/src/modules/local-mcp/__tests__/mcpRedactedAuditLog.test.ts`
- `rtk npx vitest run my-app/src/modules/local-mcp/__tests__/mcpReadOnlyTwoweeksDataAdapter.test.ts`
- `rtk npx vitest run my-app/src/modules/local-mcp/__tests__/mcpSafeConvexSelectorProjectionBoundary.test.ts`
- narrow Convex account-link tests if added;
- source-guard tests covering forbidden token/provider/runtime/package surfaces.

Merge conditions for PR82:

- narrow tests pass;
- PR-local source guards pass;
- `rtk git diff --check` passes;
- changed files match the allowed list;
- no package or lockfile changes;
- no OAuth callback/token exchange/refresh/revocation/provider runtime;
- no PR80-live or answer-copy implementation;
- inherited repo-wide lint/build failures, if still present, are documented as base failures and not introduced by PR82.

## Rollback

Rollback for this docs-only preflight is a normal revert of:

- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/plans/2026-06-19-pr81-to-pr82-secrets-token-revocation-preflight.md`

Rollback for future PR82 should be a normal revert of that narrow code/test/doc PR. Because schema changes remain forbidden in the approved narrow PR82 scope, rollback should have no migration or data cleanup requirement.

## Final Decision

`READY_TO_IMPLEMENT_NARROW_PR82`

No answer-copy implementation is allowed. Manual handoff and artifact delivery remain available. PR80-live remains blocked. PR82 may start only after this docs-only preflight merges, and only within the narrow hardening scope above.
