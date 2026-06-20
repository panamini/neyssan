# PR82-to-PR83 Observability and Incident Response Preflight

Date: 2026-06-20

Base branch: `application-os-foundation`

Preflight branch: `codex/pr82-to-pr83-observability-incident-response-preflight`

Type: docs-only reliability/security/governance preflight.

Do not implement PR83 code in this PR.

## Repository Truth

- PR214 is merged.
- PR214 title: `PR82: Secrets, token storage, and revocation hardening`.
- PR214 head: `48134728b561381ab02c4139700eddd69d1724dd`.
- PR214 merge commit: `02c943c1c17e3c4421cf7067ca56f35c1a7d2d24`.
- PR214 merged at: `2026-06-20T03:40:57Z`.
- Local `application-os-foundation` is at `02c943c1c17e3c4421cf7067ca56f35c1a7d2d24`.
- Draft GitHub PR: `#215`.
- Remote preflight branch: `codex/pr82-to-pr83-observability-incident-response-preflight`.
- PR80-live remains blocked by provider authorization prerequisites.
- Approved answer copy remains blocked by `BLOCKED_NO_AUTHORITATIVE_SOURCE`.
- No live provider integration, OAuth callback, token exchange, token storage, provider revocation, browser automation, or production connector runtime is active.

The progress ledger was stale before this preflight and still listed PR82 as the current draft. That is not a blocking governance conflict because GitHub and local repository truth match PR214 exactly, and this docs-only PR is explicitly authorized to record PR214 and set the PR83 preflight as current.

## PR82 Merge Verification

PR214 changed these files:

- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `my-app/convex/__tests__/mcpAccountLinks.test.ts`
- `my-app/convex/auth.config.ts`
- `my-app/convex/mcpAccountLinks.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpProductionAccountLinkPersistenceBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpProductionStytchOAuthConfigBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpReadOnlyTwoweeksDataAdapter.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpRedactedAuditLog.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpSafeConvexSelectorProjectionBoundary.test.ts`
- `my-app/src/modules/local-mcp/mcpProductionAccountLinkPersistenceBoundary.ts`
- `my-app/src/modules/local-mcp/mcpReadOnlyTwoweeksDataAdapter.ts`
- `my-app/src/modules/local-mcp/mcpRedactedAuditLog.ts`
- `my-app/src/modules/local-mcp/mcpSafeConvexSelectorProjectionBoundary.ts`

Verified PR82 behavior:

- existing Stytch-shaped config validation stays server-only and fail-closed;
- account-link persistence keeps Stytch subject separate from Twoweeks owner id;
- account links support bounded `active`, `revoked`, and `stale` metadata only;
- account-link resolution rejects malformed, ambiguous, wrong-client, revoked, stale, expired, and insufficient-scope states;
- audit/refusal/model-visible payloads reject token, credential, authorization, cookie, session, raw-claim, owner id, provider subject, raw source, and generated artifact leakage;
- read-only adapter and safe selector projection redaction were tightened;
- no token storage, refresh-token storage, OAuth callback, token exchange, provider credential, provider API, live provider revocation, PR80-live, answer-copy, package, or lockfile change was added.

PR214 recorded non-blocking review state:

- CodeRabbit skipped review because the base branch was non-default.
- Qodo reviews were paused by user setting.
- `rtk git diff --check` passed.
- 106 Vitest tests passed for the PR82 scope.
- Fallow warnings were advisory and concentrated in duplicated guard/test patterns plus inherited unused dependency notes.
- Repo-wide lint/build debt remained inherited and out of PR82 scope.

## Current Observability Inventory

| Area | Classification | Finding | PR83 treatment |
| --- | --- | --- | --- |
| Manual handoff records and events | active code | `manualApplicationHandoffs`, `manualApplicationHandoffEvents`, and `manualApplicationHandoffRateLimits` persist redacted owner-scoped operational state and bounded quota rows. | Include. |
| Manual handoff safe config | active code | `readManualApplicationHandoffServerConfigStatus` exposes safe enabled/disabled status without config values. | Include. |
| PR80A live external-action safety | active code | `liveExternalActionSafety.ts` has safe disabled/config status plus internal reserve/dispatch/finalize transitions, but no provider adapter. | Include status and blocked-state observation only. |
| MCP/Stytch auth boundary | active code | Local JWT verification and account-link validation return bounded refusal reasons and redacted audit metadata. | Include taxonomy mapping. |
| Convex account links | active code | `mcpAccountLinks.ts` stores account-link metadata only and supports local revoked/stale state. | Include redacted operational counters/status only. |
| Read-only adapter and data refs | active code | Safe refs/counts/status only; no raw Convex data projection. | Include refusal/status categories only. |
| Redacted audit boundary | active code, local/fixture behavior | `mcpRedactedAuditLog.ts` validates safe audit shapes and classifiers but does not persist production audit rows itself. | Reuse classifiers and add source guards. |
| Retention/deletion boundary | active code, fixture behavior | Retention/deletion helpers are local boundary logic; no real deletion job is active. | Use as a constraint, not as an operational deletion runtime. |
| Egress and write-action guards | active code | Outbound egress is deny-by-default and write actions are execution-disabled unless explicitly authorized. | Include blocked-refusal categories only. |
| Generic `metrics`, `monitoring`, and `alerts` modules | active/informative but unsafe for PR83 as-is | Existing metrics/alerts accept arbitrary labels/metadata or message fields and are not constrained to MCP/manual-handoff redaction rules. | Do not reuse directly; wrap or bypass with a new bounded helper. |
| Parser, legacy ingest, and historical security audits | legacy but informative code/docs | Useful background, not current PR83 authority unless active call sites prove otherwise. | Out of scope. |

## Runtime Surface Matrix

| Surface | Current callable functions | Existing categories | Current audit/status coverage | Kill switch | PR83 decision |
| --- | --- | --- | --- | --- | --- |
| Manual handoff lifecycle | `getForJob`, `prepare`, `confirm`, `getDeliveryContentForHandoff`, `recordFileDownloadRequested`, `recordDestinationOpenRequested`, `reportOutcome`, `recordCopySucceeded` | feature disabled, rate limited, budget exhausted, stale confirmation, invalid destination, stale artifact, blocked answer copy, user-reported outcome | Durable redacted handoff events plus safe handoff state | `TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED` | Include. |
| Manual handoff rate/budget | `acquireManualApplicationHandoffRateLimit`, `deleteExpiredManualApplicationHandoffRateLimitRows`, `throwManualApplicationHandoffRateLimited` | `rate_limited`, `budget_exhausted` | Bounded quota rows; no raw quota keys in user-visible payloads | Same manual handoff flag plus bounded limits | Include. |
| MCP auth/config | `verifyMcpProductionStytchOAuthConfigBoundary` | malformed config, missing token, malformed token, wrong issuer/audience/client, missing scope, expired/future token, malformed claims | Bounded refusal result; model-visible output stays false | Server config boundary; no runtime connector flag | Include taxonomy mapping only. |
| MCP account link | `validateMcpProductionAccountLinkPersistenceBoundary`, `internalCreateMcpAccountLink`, `internalResolveActiveMcpAccountLink`, `internalMarkMcpAccountLinkState` | missing, malformed, provider/client mismatch, revoked, stale, expired, ambiguous, insufficient scope | Redacted audit event plus internal Convex metadata | Link state `revoked`/`stale` | Include. |
| Read-only data adapter | `projectMcpReadOnlyTwoweeksDataAdapter`, safe selector/data-ref helpers | auth/account/consent/retention/projection refusals | Safe refs/counts/status only | Consent, retention, and account-link gates | Include status/refusal categories only. |
| Controlled send/export modules | local export builders and `sendMcpApprovedApplicationMessage` | preview/export freshness, confirmation, egress, write disabled, duplicate/unknown provider status in injected channel tests | Local redacted audit metadata; no production runtime wiring | Write-action execution disabled; egress deny-by-default | Include only source guards/status mapping if already touched by shared helper tests; no runtime enablement. |
| Live external-action safety | `readLiveExternalActionServerConfigStatus`, `reserveExternalAction`, `markExternalActionDispatching`, `finalizeExternalAction` | feature disabled, provider authorization required, reserved, dispatching, terminal status unknown | Durable idempotency state if internal functions are used; no provider | `TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED`, still configured false without provider prerequisites | Include disabled/config/unknown-state observation only. |
| Outbound egress | `evaluateMcpOutboundEgressRequest`, `assertMcpOutboundEgressAllowed`, `redactMcpOutboundUrlForAudit` | local/private URL, unsafe scheme/path, redirects blocked, not allowlisted, data class disallowed | Redacted URL origin/host/path class only | Policy disabled/deny-by-default | Include blocked-refusal categories only. |

## Selected Error Taxonomy

PR83 should introduce one bounded operational category set and map existing detailed reasons into it. Detailed local reasons may remain in tests and internal code, but operational metrics, status views, and runbook incidents must use these categories only:

- `auth_required`
- `auth_invalid`
- `account_link_missing`
- `account_link_invalid`
- `consent_missing`
- `consent_stale`
- `privacy_blocked`
- `feature_disabled`
- `config_invalid`
- `rate_limited`
- `budget_exhausted`
- `stale_confirmation`
- `ownership_mismatch`
- `artifact_stale`
- `destination_invalid`
- `operation_conflict`
- `external_action_disabled`
- `unknown_external_result`
- `dependency_unavailable`
- `internal_validation_error`

Mapping rules:

- Missing bearer/authorization input maps to `auth_required`.
- Malformed/expired/wrong issuer, audience, client, or scope maps to `auth_invalid`.
- Missing account-link rows map to `account_link_missing`.
- Malformed, ambiguous, revoked, stale, expired, wrong-client, or insufficient-scope links map to `account_link_invalid`.
- Missing or denied consent maps to `consent_missing`.
- Expired or insufficiently fresh consent maps to `consent_stale`.
- Redaction, selector, egress, unsafe payload, and forbidden key/value guards map to `privacy_blocked`.
- Disabled feature flags and disabled local transports map to `feature_disabled`.
- Malformed server config, JWKS, or allowlist config maps to `config_invalid`.
- Manual handoff quotas map to `rate_limited` or `budget_exhausted`.
- Reused or invalidated manual confirmations map to `stale_confirmation`.
- Cross-owner, subject-owner equality, or owner mismatch checks map to `ownership_mismatch`.
- Stale export/artifact/package freshness checks map to `artifact_stale`.
- Invalid HTTPS destination, unsafe destination, or destination mismatch maps to `destination_invalid`.
- Duplicate idempotency and invalid state transitions map to `operation_conflict`.
- PR80-live unavailable states map to `external_action_disabled`.
- Provider/injected-channel unknown terminal states map to `unknown_external_result`.
- Missing bounded internal dependency or unavailable safe projector maps to `dependency_unavailable`.
- Impossible states, malformed internal records, and unexpected validation fallthroughs map to `internal_validation_error`.

Forbidden dimensions and values:

- no user id, Clerk id, Stytch subject, provider subject, account-link id, raw owner id, email, phone, IP address, session id, cookie, token, secret, authorization header, raw JWT, raw claims, JWKS body, full URL, URL query, URL fragment, raw source text, job description, generated artifact text, answer text, file bytes, external receipt text, or raw error stack;
- no provider-specific status text unless converted to a bounded category;
- no arbitrary labels or metadata objects;
- no high-cardinality ids, hashes, or digests in metrics; safe digests may remain in existing audit/event records only where already approved.

## Metrics And Incident Event Decision

PR83 should not use the existing generic `metrics`, `monitoring`, or `alerts` modules directly.

PR83 should add a new bounded operational event layer with:

- one shared category enum from this preflight;
- one safe event builder that rejects forbidden keys and high-cardinality values;
- one aggregate dimension set: `capability`, `action`, `category`, `outcome`, `featureState`, `severity`, `version`;
- one time bucket field, not per-request timestamps in public/readable aggregate output;
- bounded count increments rather than one incident row per attacker-controlled request;
- source guards proving no generic metric labels, raw errors, raw URLs, token markers, identity markers, or artifact/source text enter operational payloads.

PR83 may add a dedicated internal Convex aggregate table only if it is stricter than the existing generic metrics table:

- table name: `operationalObservabilityBuckets` or similarly explicit;
- internal mutation/query only;
- aggregate rows only, keyed by bounded time bucket plus bounded dimensions;
- no public query, HTTP endpoint, UI dashboard, vendor exporter, scheduler, package, or lockfile changes;
- explicit retention horizon and bounded cleanup path;
- tests proving rejected dimensions do not write rows.

If the dedicated aggregate table is too large for the PR83 implementation budget, PR83 may stay purely local/helper/test plus runbook, but it must not fall back to unsafe generic metrics.

## Incident Model

Ordinary refusals are expected control-flow outcomes and should count as operational events, not incidents:

- feature disabled;
- consent missing or expired;
- normal rate limiting;
- stale confirmation;
- answer-copy blocked by missing source model;
- PR80-live unavailable by provider prerequisite;
- user-reported not submitted or abandoned;
- egress denied by configured policy.

Incidents require operator attention and should be deduplicated by `category`, `capability`, and time bucket:

- privacy guard or source guard failure;
- token, secret, authorization, cookie, session, identity, raw source, or artifact leakage attempt that reaches an operational payload;
- cross-owner or subject-owner mismatch;
- quota bypass or impossible rate/budget state;
- impossible manual handoff transition;
- unexpected use of PR80A dispatch/finalize from manual handoff;
- live external action status becomes unknown after an attempted dispatch;
- kill switch reports enabled when provider prerequisites are absent;
- outbound egress policy allows a private/local/unsafe URL;
- generic metrics/alerts code receives MCP/manual-handoff sensitive payloads.

## Kill-Switch Inventory

| Capability | Existing switch/gate | Owner | Default | Runtime effect | PR83 treatment |
| --- | --- | --- | --- | --- | --- |
| Manual application handoff | `TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED` through `readManualApplicationHandoffServerConfigStatus` | server ops/env | disabled unless explicitly enabled | fail-closed manual handoff state with safe status | Include safe status and runbook rollback. |
| PR80A live external actions | `TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED` through `readLiveExternalActionServerConfigStatus` | server ops/env plus provider authorization prerequisites | disabled/configured false | no provider adapter; status remains feature disabled or provider authorization required | Include disabled/config status only. |
| MCP remote/dev transport | local transport and visibility policies | local/dev policy owner | disabled/listed disabled | no production connector runtime | Include only as blocked state if surfaced by shared helper tests. |
| Write actions | PR76 write-action framework and controlled send guards | code policy | execution disabled | no real send/submit/apply unless explicit future unlock | Include disabled-write category only. |
| Outbound egress | PR77 allowlist/SSRF policy | code policy | deny-by-default | no private/local/unsafe outbound path | Include blocked egress category only. |
| Account link | account-link state `active`/`revoked`/`stale` plus expiry | server-only metadata | fail closed when missing/invalid | revocation/stale state blocks reads | Include safe counts/status only. |
| Consent/retention | local consent and retention boundaries | policy/code | fail closed for real data | blocks unsafe read/write behavior | Include refusal categories only. |

No existing general admin/ops authorization boundary is proven strong enough for a public dashboard. PR83 must not add a user-facing dashboard, public status page, public metrics route, or client-accessible incident list. An admin dashboard can be a later PR only after an explicit admin/ops authorization decision.

## Incident Runbook Requirements

The PR83 runbook should include the same response shape for every scenario:

- detection signal;
- immediate containment;
- kill switch or state transition;
- evidence to preserve;
- data that must not be copied into logs/tickets;
- user impact statement;
- recovery steps;
- verification command or test;
- follow-up owner.

Required scenarios:

| Scenario | Immediate response |
| --- | --- |
| Suspected token or credential leakage | Disable affected capability, preserve redacted event category/time bucket, do not copy token-like material, add a source guard regression test before re-enable. |
| Cross-owner/account-link mismatch | Mark affected account link `stale` or `revoked`, disable reads for that link, preserve category and bounded client/scope context only. |
| Raw source or generated artifact leakage | Stop the emitting path, preserve safe category/capability, add redaction regression coverage, and avoid copying source/artifact text into tickets. |
| Manual handoff quota bypass | Disable manual handoff if active abuse continues, inspect bounded quota rows, run quota cleanup only through the bounded path. |
| Reused stale confirmation | Treat as ordinary refusal unless repeated at scale, invalidate handoff state, preserve stale-confirmation count, and keep destination/full URL out of logs. |
| PR80-live unexpectedly enabled | Set `TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED` false or unset, verify status returns provider authorization required/feature disabled, and confirm manual handoff did not reserve/dispatch/finalize PR80A records. |
| Outbound egress/SSRF allow failure | Disable write/send capability, block policy config, preserve category and redacted URL class only, add regression for private/local/unsafe URL. |
| Unknown external action result | Stop retries unless idempotency state proves safe, preserve safe receipt/failure refs only, never infer provider-submitted from user-reported state. |
| Persistent dependency/config failure | Keep feature disabled, preserve `config_invalid`/`dependency_unavailable` counts, and expose only safe config status. |
| Generic metrics/logging sensitive payload | Stop routing MCP/manual-handoff events to generic metrics, delete or quarantine unsafe rows if policy allows, and add source guards proving bounded helper use. |

## Retention And Deletion

PR83 must not create raw per-request incident logs.

If PR83 adds durable aggregate rows:

- rows must expire by explicit time bucket horizon;
- cleanup must be bounded;
- owner deletion must not require searching raw identifiers because metrics must not store owner identifiers;
- retention status must be visible only through internal/tested status helpers;
- existing manual handoff events and rate-limit rows keep their current approved retention semantics.

If PR83 stays helper/test/runbook-only:

- no schema migration is needed;
- rollback is a normal code revert;
- existing manual handoff events remain the only durable operational record for that surface.

## Exact PR83 Scope

Allowed PR83 behavior:

- introduce the bounded category taxonomy in this preflight;
- add a safe operational event builder with forbidden-key/value guards;
- map existing manual handoff, MCP auth/account-link/read-only, live-safety disabled config, egress, and write-action refusal states into the bounded taxonomy;
- add internal-only aggregate storage only if it is a dedicated bounded table and not the generic metrics table;
- add safe status helpers for kill-switch/config state;
- add an incident runbook;
- add tests proving operational payloads contain no secrets, identity markers, raw URLs, raw errors, raw source text, generated artifact text, answer text, or high-cardinality ids;
- add source guards proving PR83 did not add provider integration, token storage, OAuth/token flows, live submit/apply, browser automation, public dashboards, external observability vendors, package changes, or lockfile changes.

Forbidden PR83 behavior:

- no provider API calls, live submit/apply, upload, browser automation, or ATS integration;
- no OAuth callback, authorization-code exchange, token endpoint integration, access-token storage, refresh-token storage, or provider revocation network call;
- no approved answer-copy implementation;
- no user-facing dashboard, public metrics endpoint, public incident endpoint, or client-readable admin surface;
- no use of arbitrary generic `metrics`/`alerts` labels for MCP/manual-handoff sensitive events;
- no external observability vendor, OpenTelemetry/Sentry/Datadog integration, package changes, or lockfile changes;
- no broad parser, legacy ingest, or unrelated logging refactor;
- no changes to PR84+ roles, billing, or provider selection.

## Exact Files For Possible PR83

Allowed files:

- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/plans/2026-06-20-pr82-to-pr83-observability-incident-response-preflight.md`
- `docs/decisions/2026-06-20-pr83-observability-incident-response-runbook.md`, or a similarly dated runbook/decision doc if PR83 needs a separate runbook document
- `my-app/src/modules/local-mcp/mcpOperationalErrorTaxonomy.ts`
- `my-app/src/modules/local-mcp/mcpOperationalEvents.ts`
- `my-app/src/modules/local-mcp/mcpOperationalStatus.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOperationalErrorTaxonomy.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOperationalEvents.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOperationalStatus.test.ts`
- `my-app/convex/lib/operationalObservability.ts`, only for bounded internal aggregate helpers
- `my-app/convex/operationalObservability.ts`, only for internal mutations/queries
- `my-app/convex/schema.ts`, only for a dedicated bounded aggregate table if PR83 chooses durable aggregates
- `my-app/convex/manualApplicationHandoff.ts`, only for bounded category/status mapping without behavior enablement
- `my-app/convex/lib/manualApplicationHandoff.ts`, only for shared bounded category/status constants or source guards
- `my-app/convex/liveExternalActionSafety.ts`, only for disabled/config/unknown-status mapping without provider enablement
- `my-app/convex/mcpAccountLinks.ts`, only for redacted account-link category/status mapping without exposing identifiers
- existing local MCP boundary modules touched by PR83 only when required to call the shared taxonomy/event helper or add tests.

Avoid touching:

- package manifests and lockfiles;
- UI/dashboard files;
- browser automation tests;
- parser, spaCy, training, ingest, archive, or backup code;
- generic `metrics.ts`, `monitoring.ts`, or `alerts.ts` unless the change is a narrow source guard proving they are not used for PR83-sensitive payloads.

## Exact Tests For PR83

Required new tests:

- taxonomy maps detailed reasons to bounded categories;
- event builder rejects forbidden keys and forbidden token/secret/identity/source/artifact values;
- event builder rejects high-cardinality dimensions and arbitrary metadata;
- kill-switch/status helper returns safe status without config values;
- incident aggregation deduplicates by bounded category/capability/time bucket;
- source guards prove no token storage, refresh-token storage, OAuth callback, token exchange, provider revocation, provider credentials, PR80-live provider adapter, browser automation, external observability vendor, package, or lockfile changes were added.

Narrow existing tests to rerun when touched:

- `my-app/convex/__tests__/manualApplicationHandoff.test.ts`
- `my-app/convex/__tests__/liveExternalActionSafety.test.ts`
- `my-app/convex/__tests__/mcpAccountLinks.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpProductionStytchOAuthConfigBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpProductionAccountLinkPersistenceBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpReadOnlyTwoweeksDataAdapter.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpRedactedAuditLog.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOutboundEgressPolicy.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpWriteActionFramework.test.ts`

Expected preflight PR verification:

- `rtk git diff --check`
- `rtk git diff --name-only application-os-foundation...HEAD`
- `rtk npx fallow audit --changed-since application-os-foundation --format compact`

## Rollback

Rollback for this docs-only preflight is a normal revert of:

- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/plans/2026-06-20-pr82-to-pr83-observability-incident-response-preflight.md`

Rollback for the future PR83 implementation must be a normal revert if it stays within this preflight's scope. If PR83 adds durable aggregate rows, rollback must leave rows inert, redacted, and expiring through the documented retention horizon.

## Final Decision

READY_TO_IMPLEMENT_NARROW_PR83
