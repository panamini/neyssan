# PR83 Observability and Incident Response Runbook

## Scope

PR83 adds bounded, redacted operational event and status helpers for existing MCP, manual handoff, account-link, egress, write-action, and live-safety boundaries only.

This runbook does not authorize provider integration, OAuth/token flows, token storage, provider revocation, PR80-live, answer-copy implementation, browser automation, public dashboards, external monitoring vendors, schema changes, package changes, or lockfile changes.

## Data Rules

Operational events and incident triage notes may include only bounded categories, capability/action names, feature state, severity, time bucket, and safe incident signal names.

Do not log or paste raw tokens, cookies, session ids, Authorization headers, JWT claims, subject ids, user ids, account-link ids, full URLs, URL query strings, artifact content, answer text, raw CV/resume/job/source text, generated content, provider credentials, provider receipts, stack traces containing payloads, or arbitrary metadata.

## Triage

| Scenario | Detection signal | Containment | Evidence to preserve | Recovery check |
| --- | --- | --- | --- | --- |
| Auth verifier rejects request | `auth_required` or `auth_invalid` | Keep request failed closed; do not expose token details | Time bucket, bounded auth category, verifier config status | Valid fixture token path still passes tests; rejected path has no raw token output |
| Account link missing or invalid | `account_link_missing` or `account_link_invalid` | Keep MCP read/write boundary blocked | Bounded account-link category, provider/client mismatch class if applicable | Active non-revoked/non-stale fixture link resolves; terminal metadata still fails closed |
| Consent missing or stale | `consent_missing` or `consent_stale` | Keep read/write operation blocked | Consent category and capability only | Consent fixture with current consent remains allowed; stale fixture remains blocked |
| Manual handoff rate or budget limit | `rate_limited` or `budget_exhausted` | Keep action disabled for the current quota window | Quota category, capability/action, time bucket | Quota rows remain redacted and bounded; expiry cleanup remains bounded |
| Delivery content mutation bypass attempt | `privacy_blocked` or `internal_validation_error` | Do not serve content through query-only or bypass path | Capability/action and refusal category only | Delivery-content load remains mutation-protected |
| Answer-copy attempt while blocked | `feature_disabled`, `budget_exhausted`, or `rate_limited` | Keep answer-copy unavailable; enforce tight quota | Blocked answer-copy category only | No answer text source is exposed; approved answer copy remains blocked |
| Egress destination blocked | `privacy_blocked` or `destination_invalid` | Do not fetch, redirect, submit, or open from server | Redacted destination class only; never full URL | SSRF/local/private/query-bearing URL tests still fail closed |
| Write/live external action disabled | `feature_disabled` or `external_action_disabled` | Keep write proposal non-executable; do not dispatch provider action | Capability/action and disabled category only | Write guard and live-safety tests show no provider call or dispatch |
| Unknown live external result | `unknown_external_result` plus `unknown_external_result_after_dispatch` | Treat as operator-review incident; do not infer provider success | Execution state category and time bucket only | Result remains terminal/failed-closed until explicit safe reconciliation exists |
| Sensitive payload reaches observability helper | `sensitive_payload_rejected` or `generic_metrics_sensitive_payload` | Stop event creation and review call site | Helper name, capability/action, rejected category only | Source guard and tests reject token/cookie/session/URL/artifact/answer material |

## Kill-Switch Inventory

Manual handoff status is summarized from the existing `TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED` safe config status. Disabled means no manual handoff operation should proceed.

Live external action status is summarized from the existing `TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED` safe config status. Provider authorization required remains blocked and does not unlock PR80-live.

Write actions remain non-executable unless a future explicit PR authorizes a concrete write path. PR83 status helpers may classify this as disabled or externally blocked, but they must not execute it.

## Incident Response

Incidents require an explicit bounded incident signal. Ordinary refusals are not incidents by default.

Use operator review for privacy guard failure, sensitive payload rejection, cross-owner mismatch, quota bypass, impossible state, unexpected live dispatch, unknown external result after dispatch, kill switch enabled without prerequisites, unsafe egress allowed, or generic metrics sensitive payload.

During review, preserve only bounded categories, capability/action names, feature state, severity, time bucket, and test names. If raw material appears in any model-visible output, treat the response itself as unsafe and replace it with a redacted summary before sharing.

## Verification

Run focused Vitest coverage for the operational taxonomy, events, and status helpers.

Run source guards against the new PR83 files for monitoring vendors, outbound HTTP, OAuth/token flow, provider API/adapter, browser automation, public dashboard, and external observability surfaces.

Run `rtk git diff --check` and changed-file guards before publishing the draft PR.
