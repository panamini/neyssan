# PR85 Stripe Test Mode Boundary and Internal Test Access

## Scope

PR85 implements a server-only Stripe test-mode config boundary for local/internal testing.

It does not implement live billing.

Stripe is optional for local/internal testing. Missing Stripe env must not block app testing.

Test keys are supplied locally/server-side through env vars only:

```txt
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
```

Do not paste real keys into chat, Codex, GitHub, docs, code, tests, snapshots, logs, or GitHub Actions.

`STRIPE_SECRET_KEY` is server-only.

`STRIPE_PUBLISHABLE_KEY` is test-mode public config only, but PR85 still does not expose its raw value.

Live keys fail closed.

No live billing is implemented.

No real paid subscription state is implemented.

## Implemented Boundary

File:

```txt
my-app/src/modules/billing/stripeBillingConfigBoundary.ts
```

Exports:

```txt
readStripeBillingConfigStatus
evaluateBillingTestMode
assertNoLiveStripeMode
evaluateStripeBillingCapability
```

Safe config statuses:

```txt
internal_test_mode
stripe_test_configured
stripe_not_configured
stripe_config_invalid
stripe_live_mode_blocked
```

Internal/test capabilities:

```txt
app_test_access
read_only_summaries
artifact_export
manual_handoff
```

Always-blocked capabilities:

```txt
pr80_live_submit_apply
approved_answer_copy
workspace_team_admin
billing_portal
```

Safe decisions:

```txt
allowed_internal_test
allowed_stripe_test_configured
denied_blocked_safety_prerequisite
denied_unknown_capability
denied_invalid_billing_config
```

## Non-Goals

PR85 does not add:

```txt
Stripe SDK
checkout
webhooks
subscriptions
billing portal
pricing page
plan comparison UI
paid entitlements
customer records
subscription records
product IDs
price IDs
external HTTP
browser automation
workspace/team/admin runtime
PR80-live
answer-copy
package or lockfile changes
schema changes
UI changes
PR86 work
```

## Safety Notes

- Config status never returns raw env values.
- Config status never returns the secret key value.
- Config status never returns the publishable key value.
- Invalid config denies Stripe-backed behavior.
- Live-mode config denies Stripe-backed behavior.
- No-Stripe internal mode remains available for app testing.
- Entitlement decisions do not bypass auth, ownership, consent, freshness, approval, confirmation, idempotency, or PR81 rate limits.
- PR80-live remains blocked even when Stripe test mode is configured.
- Approved answer copy remains blocked even when Stripe test mode is configured.

## Verification

Required checks:

```txt
rtk npx vitest run my-app/src/modules/billing/__tests__/stripeBillingConfigBoundary.test.ts
rtk npx vitest run my-app/src/modules/billing/__tests__/stripeBillingConfigBoundaryScopeGuards.test.ts
rtk npx tsc --noEmit --pretty false
rtk git diff --check
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected inherited gate status:

```txt
Repo-wide typecheck/build may still fail for inherited TypeScript debt outside PR85 scope.
PR85 must not fix inherited repo-wide failures.
```

## Rollback

Revert the PR85 commit.

Because PR85 adds no schema, package dependency, checkout, webhook, subscription runtime, paid entitlement state, or persisted billing rows, rollback is code/docs only.

Removing local/server Stripe env returns the app to `internal_test_mode`.
