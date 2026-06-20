# PR84-to-PR85 Billing, Plan Limits, and Entitlements Preflight

## Repository Truth

Base branch: `application-os-foundation`

Preflight branch: `codex/pr84-to-pr85-billing-entitlements-preflight`

This is a docs-only product/governance/security preflight. It does not implement PR85 code.

Local repository state before this preflight update:

```txt
application-os-foundation HEAD: a9cc0b12c54bde647cd49ed7fe719b905e3a670b
PR219 branch head before update: 2109df493a606053e92357c2b68c4f62526906f6
Working tree: clean before docs update
Open PR: #219 draft
```

## PR84 Merge Verification

PR84 is merged.

```txt
GitHub PR: #218
Title: PR84: Owner/Profile Boundary Hardening
Head commit: afa17af45df710b96ef89cb8d905bb792ef98159
Merge commit: a9cc0b12c54bde647cd49ed7fe719b905e3a670b
Merged at: 2026-06-20T21:01:39Z
Review history: no reviews returned by GitHub
```

Actual PR84 changed files:

```txt
docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
my-app/convex/__tests__/jobsPublic.linkedProfileMutations.test.ts
my-app/convex/__tests__/ownerProfileBoundaryScopeGuards.test.ts
my-app/convex/__tests__/profiles.patch.test.ts
my-app/convex/profiles.ts
```

Actual PR84 scope:

```txt
- profiles.saveProfile requires authenticated Clerk identity.
- Unauthenticated create/patch attempts fail closed.
- Foreign-owned profileId writes fail closed.
- New rows and legacy unclaimed rows are stamped with the authenticated Clerk subject.
- Linked-profile job mutation tests reject cross-owner access.
- Source guards prove no tenant/workspace/role/billing/provider/OAuth/token/PR80-live/answer-copy scope was added.
```

PR84 did not add schema, UI, workspace, tenant, role, admin/member, billing, entitlement, provider/OAuth/token, PR80-live, answer-copy, package, lockfile, or PR85 work.

## Updated Founder Decision

Stripe test mode is selected for local/testing only.

Test keys are supplied locally/server-side through env vars only.

Live keys fail closed.

No live billing is implemented.

No real paid subscription state is implemented.

This does not authorize Stripe SDK installation in PR219.

This does not authorize checkout, webhooks, subscriptions, billing portal, pricing, paid entitlements, product IDs, price IDs, customer IDs, subscription IDs, or raw Stripe payload handling.

Only these environment variable names may be documented:

```txt
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
```

Real values must be supplied only through local/server environment variables outside the repo. They must not be pasted into chat, Codex, GitHub, docs, code, tests, snapshots, logs, or GitHub Actions.

## Current Product And Business Mode

Confirmed:

```txt
- Current runtime model is single-user owner/profile.
- There is no workspace/team/tenant/role/admin/member runtime.
- There is no billing, subscription, payment, checkout, plan, entitlement, or price schema.
- Stripe test mode is selected only as a future local/testing config boundary.
- Stripe is optional for local/internal testing.
- Missing Stripe env must not block app testing.
- PR81 already protects operation rate/budget for manual handoff.
- PR80-live remains blocked.
- Approved answer copy remains blocked.
```

Probable:

```txt
- The product is in an internal/pre-private-beta implementation phase.
- Production monetization remains undecided in the active codebase.
- PR88 private beta and PR89 public business launch remain future roadmap phases.
```

To verify before any production billing work:

```txt
- Founder-approved product mode beyond local/testing.
- Plan names and tier boundaries.
- Whether Stripe remains the production provider.
- Whether payments must exist before PR86, PR87, or PR88.
```

## Billing, Plan, And Entitlement Inventory

No active billing model was found in the authoritative runtime paths.

Search findings:

```txt
- my-app/convex/schema.ts has no billing, subscription, payment, checkout, entitlement, plan, productId, priceId, or subscriptionId table.
- userProfiles has preferences and document/proposal settings, but no plan or entitlement authority.
- mcpAccountLinks stores Stytch account-link read scopes, not commercial entitlements.
- manualApplicationHandoffRateLimits stores PR81 abuse/rate-budget rows, not plan access.
- "premium" matches in proposal metadata are quality/style path fields, not paid product state.
- Broad repo matches for Stripe/payment/billing are docs/assets/benchmarks/tests, not active billing runtime.
```

There is no safe existing persisted source of truth for paid plan status.

## Rate Limits Versus Billing Test Mode

PR81 rate/budget protection answers:

```txt
How often may this already-allowed action run?
What operation budget is available?
How are retries and abuse bounded?
```

PR85 Stripe test-mode config should answer:

```txt
Can the app run without Stripe for local/internal testing?
Can local/server Stripe test configuration be detected safely?
Are live-mode keys rejected fail-closed?
Is the secret key kept server-only and never exposed?
```

Optional PR85 entitlement helper should answer:

```txt
May this current test/internal capability be accessed at all?
Is the capability hard-blocked because a safety prerequisite is missing?
Is billing config invalid in a way that should deny a capability?
```

Production billing would answer:

```txt
Does payment status grant or revoke entitlement?
```

Production billing is not currently implementable because no production pricing decision, subscription source, checkout flow, webhook handling, or paid entitlement state is authorized.

## Capability Matrix

| Capability | Current state | Feature flag/config | Owner/profile auth | PR81 rate/budget | Privacy level | PR85 test-mode policy needed now | Must remain false/blocked | Plan/status output safe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| App test access | Local/internal target | Missing Stripe env must allow internal test mode | Existing auth still applies where needed | Not PR81 | No key exposure | Yes | No | Safe status only |
| Read-only MCP summaries | Active read-only boundaries | Account-link read scopes | Server-only Stytch subject -> Twoweeks Clerk mapping | Not PR81 | Model-visible safe summaries | Optional helper can allow | No | Bounded decision only |
| Artifact export | Local controlled representations | None found | Requires approved/fresh policy input | Not PR81 | Controlled local payload separation | Optional helper can allow | No | Bounded decision only |
| Manual application handoff | Active Convex runtime, default-off | `TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED` | Authenticated owner profile and owner job/package checks | Yes | Redacted records/events, no provider verification | Optional helper can allow | No | Bounded decision only |
| PR80-live submit/apply | Blocked boundary only | Live external action config remains not configured | Provider prerequisites absent | Not enough | No provider credentials or calls | Deny explicitly | Yes | Denied category only |
| Approved answer copy | Blocked | None | No authoritative approved answer source | Blocked attempts rate-limited | Answer text must not be exposed | Deny explicitly | Yes | Denied category only |
| Workspace/team/admin | Non-existent | None | No tenant/role model | None | Not applicable | Deny explicitly | Yes | Denied category only |
| Billing portal | Non-existent | None | No customer/subscription model | None | Not applicable | Deny explicitly | Yes | Denied category only |

## Stripe Test-Mode Source-Of-Truth Decision

Do not add a schema migration in PR85.

Initial authority should be:

```txt
server_env_test_mode_config_v1
```

Assignment source:

```txt
- Server-owned environment only.
- Client input cannot assert Stripe mode.
- Model output cannot assert Stripe mode.
- Clerk ID, email, provider subject, profile metadata, and arbitrary client metadata are not billing authority.
- Stripe test mode configuration is not a paid subscription.
```

Revocation source:

```txt
- Remove or change local/server environment variables.
- Code/config rollback.
- No persisted billing or entitlement rows exist to revoke in PR85.
```

Default behavior:

```txt
- Missing Stripe env returns internal test mode and does not block app testing.
- Valid test-mode config returns configured test status.
- Invalid config fails closed for Stripe-backed behavior but does not break no-Stripe internal testing.
- Live-mode keys fail closed.
- Unknown capability fails closed.
```

Deletion, retention, and audit:

```txt
- No new billing table.
- No entitlement assignment table.
- No customer, subscription, product, price, invoice, or checkout records.
- Safe status may expose only bounded mode/status/category fields.
- Repeated denied attempts must not create unbounded audit rows.
```

## Privacy And Security Model

Allowed billing config status output fields:

```txt
- bounded mode/status
- configured true/false
- allowed or denied
- bounded denial category
- policy/config version
```

Forbidden output fields:

```txt
- secret key value
- publishable key value
- raw env values
- raw Stripe errors
- billing account IDs
- payment IDs
- customer IDs
- subscription IDs
- product IDs
- price IDs
- emails
- Clerk IDs
- provider subjects
- profile IDs
- usage history
- private quota counters
- payment status details
- tokens
- credentials
- arbitrary metadata
```

Entitlement or billing status must never bypass authentication, ownership, consent, privacy, approval, freshness, confirmation, idempotency, PR81 rate/budget controls, provider authorization, or source-model prerequisites.

## Business Decisions Required Later

Not required for a narrow PR85 Stripe test-mode boundary:

```txt
- Paid/free pricing.
- Plan names.
- Checkout.
- Subscription webhooks.
- Billing persistence.
- Production paid entitlements.
```

Required before real billing or paid plans:

```txt
- Founder-approved production product mode.
- Plan names and capability tiers.
- Production payment provider confirmation.
- Whether billing provider status becomes entitlement authority.
- Persistence requirements and retention policy.
- Refund/tax/invoice/customer support handling.
```

## Narrow PR85 Recommendation

Recommended future code PR:

```txt
PR85 - Stripe Test Mode Boundary and Internal Test Access
Proposed branch: codex/pr85-stripe-test-mode-boundary
```

PR85 should implement only a server-only Stripe test-mode config boundary and no-Stripe internal fallback. It should not implement live billing.

Exact billing config statuses:

```txt
internal_test_mode
stripe_test_configured
stripe_not_configured
stripe_config_invalid
stripe_live_mode_blocked
```

Exact optional capability enum:

```txt
app_test_access
read_only_summaries
artifact_export
manual_handoff
pr80_live_submit_apply
approved_answer_copy
workspace_team_admin
billing_portal
unknown
```

Exact optional capability decisions:

```txt
allowed_internal_test
allowed_stripe_test_configured
denied_blocked_safety_prerequisite
denied_unknown_capability
denied_invalid_billing_config
```

Initial policy expectations:

```txt
- No Stripe env allows app_test_access through internal_test_mode.
- Test-mode Stripe env allows app_test_access through stripe_test_configured.
- read_only_summaries, artifact_export, and manual_handoff may be allowed by the optional helper but still require their existing auth/ownership/safety checks.
- pr80_live_submit_apply must deny with denied_blocked_safety_prerequisite.
- approved_answer_copy must deny with denied_blocked_safety_prerequisite.
- workspace_team_admin must deny with denied_blocked_safety_prerequisite.
- billing_portal must deny with denied_blocked_safety_prerequisite.
- unknown capability must deny with denied_unknown_capability.
- invalid billing config must deny Stripe-backed behavior with denied_invalid_billing_config.
```

Exact helper contract:

```ts
type StripeBillingConfigStatusV1 = Readonly<{
  kind: "stripe_billing_config_status";
  status:
    | "internal_test_mode"
    | "stripe_test_configured"
    | "stripe_not_configured"
    | "stripe_config_invalid"
    | "stripe_live_mode_blocked";
  configured: boolean;
  valuesExposed: false;
  secretKeyExposed: false;
  publishableKeyExposed: false;
  liveBillingEnabled: false;
  version: 1;
}>;

function readStripeBillingConfigStatus(env: Readonly<Record<string, string | undefined>>): StripeBillingConfigStatusV1;
function evaluateBillingTestMode(env: Readonly<Record<string, string | undefined>>): StripeBillingConfigStatusV1;
function assertNoLiveStripeMode(env: Readonly<Record<string, string | undefined>>): void;
```

Ordering:

```txt
1. Server reads local/server environment.
2. Billing config status is reduced to safe bounded status.
3. Existing auth, ownership, consent, redaction, freshness, approval, confirmation, and PR81 rate/budget checks still apply.
4. Optional capability helper can run before expensive or write-capable work.
5. PR80-live and approved answer copy cannot be enabled by Stripe test-mode config.
```

Exact PR85 files allowed:

```txt
docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
docs/plans/2026-06-20-pr85-stripe-test-mode-boundary.md
my-app/src/modules/billing/stripeBillingConfigBoundary.ts
my-app/src/modules/billing/__tests__/stripeBillingConfigBoundary.test.ts
my-app/src/modules/billing/__tests__/stripeBillingConfigBoundaryScopeGuards.test.ts
```

Files forbidden in PR85 unless a new explicit preflight changes scope:

```txt
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
my-app/convex/schema.ts
UI/routes/components
checkout files
webhook files
subscription files
billing portal files
payment provider client execution files
OAuth callback/token exchange/token storage files
browser automation files
workspace/tenant/role/admin/member runtime files
PR80-live provider integration files
answer-copy implementation files
PR86 audit files
```

Exact PR85 tests:

```txt
rtk npx vitest run my-app/src/modules/billing/__tests__/stripeBillingConfigBoundary.test.ts
rtk npx vitest run my-app/src/modules/billing/__tests__/stripeBillingConfigBoundaryScopeGuards.test.ts
rtk npx tsc --noEmit --pretty false
rtk git diff --check
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Exact source guards:

```txt
- No real Stripe keys in committed files.
- No package or lockfile changes unless explicitly approved.
- No schema changes.
- No UI changes.
- No checkout session creation.
- No webhook handler.
- No subscription table.
- No customer table.
- No Stripe price/product hardcoding.
- No billing portal.
- No live billing.
- No PR80-live behavior.
- No answer-copy implementation.
- Public/model-visible output contains only bounded mode/status/category/version booleans and never raw env values.
```

Merge conditions for PR85:

```txt
- CI green on the PR85 head.
- Focused Stripe test-mode config tests pass.
- Source guards pass.
- Missing Stripe env does not block app testing.
- Live-mode keys fail closed.
- Secret key is never exposed.
- Publishable key value is not exposed unless a future UI PR explicitly approves it.
- PR80-live remains blocked.
- Approved answer copy remains blocked.
- Docs and ledger match GitHub state.
- No forbidden files changed.
```

Rollback:

```txt
- Revert the PR85 commit.
- Because no schema, SDK dependency, checkout, webhook, subscription, or persisted entitlement rows are added, rollback is code/docs only.
- Removing local/server Stripe env returns the app to internal_test_mode.
```

## PR85 Non-Goals

PR85 must not:

```txt
- add Stripe SDK without explicit package approval;
- create checkout, webhook, portal, pricing, upgrade, admin plan editor, or plan comparison UI;
- create subscriptions or fake paid-plan records;
- add schema migrations or persisted entitlement rows;
- introduce workspace, tenant, role, admin/member, invitation, billing, or enterprise runtime;
- enable PR80-live;
- enable answer copy;
- add external HTTP;
- add package or lockfile changes unless explicitly approved;
- start PR86.
```

## Final Decision

READY_TO_IMPLEMENT_NARROW_PR85_STRIPE_TEST_MODE_BOUNDARY
