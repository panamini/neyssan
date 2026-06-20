# PR84-to-PR85 Billing, Plan Limits, and Entitlements Preflight

## Repository Truth

Base branch: `application-os-foundation`

Preflight branch: `codex/pr84-to-pr85-billing-entitlements-preflight`

This is a docs-only product/governance/security preflight. It does not implement PR85 code.

Local repository state before this preflight:

```txt
application-os-foundation HEAD: a9cc0b12c54bde647cd49ed7fe719b905e3a670b
Working tree: clean
Open PRs on application-os-foundation: none
Existing PR85 branch/PR: none found
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

## Current Product And Business Mode

Confirmed:

```txt
- Current runtime model is single-user owner/profile.
- There is no workspace/team/tenant/role/admin/member runtime.
- There is no billing, subscription, payment, checkout, plan, entitlement, or price schema.
- No payment provider is selected.
- PR81 already protects operation rate/budget for manual handoff.
- PR80-live remains blocked.
- Approved answer copy remains blocked.
```

Probable:

```txt
- The product is in an internal/pre-private-beta implementation phase.
- Monetization is intentionally undecided in the active codebase.
- PR88 private beta and PR89 public business launch remain future roadmap phases.
```

To verify before any real billing work:

```txt
- Founder-approved product mode: free, private beta, paid single-user, business, or other.
- Plan names and tier boundaries.
- Payment provider, if any.
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

## Rate Limits Versus Entitlements

PR81 rate/budget protection answers:

```txt
How often may this already-allowed action run?
What operation budget is available?
How are retries and abuse bounded?
```

PR85 entitlement policy should answer:

```txt
May this capability be accessed at all?
Is the capability hard-blocked because a safety prerequisite is missing?
Is the capability outside the current product mode?
```

Billing would answer:

```txt
Does payment status grant or revoke entitlement?
```

Billing is not currently implementable because no payment provider, plan authority, pricing decision, or subscription source exists.

## Capability Matrix

| Capability | Current state | Feature flag/config | Owner/profile auth | PR81 rate/budget | Privacy level | Entitlement needed now | Must remain false/blocked | Plan/status output safe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Read-only MCP application package summary | Active read-only boundary | Account-link read scope | Server-only Stytch subject -> Twoweeks Clerk mapping | Not PR81 | Model-visible safe summary | Yes, for access classification | No | Only bounded capability/decision |
| Evidence graph summary | Active read-only boundary | Account-link read scope | Server-only owner resolution | Not PR81 | Model-visible safe summary | Yes | No | Only bounded capability/decision |
| Resume variant plan summary | Active read-only boundary | Account-link read scope | Server-only owner resolution | Not PR81 | Model-visible safe summary | Yes | No | Only bounded capability/decision |
| Review cockpit summary | Active read-only boundary | Account-link read scope | Server-only owner resolution | Not PR81 | Model-visible safe summary | Yes | No | Only bounded capability/decision |
| Generated artifact preview | Local boundary | None found | Input boundary, no persisted entitlement | Not PR81 | Safe summary, restricted content separation | Yes | No | Only bounded capability/decision |
| Artifact approval/revision | Local boundary | None found | Input boundary, no entitlement | Not PR81 | Safe summary and redacted audit metadata | Yes | No | Only bounded capability/decision |
| Resume export | Local controlled representation | None found | Requires approved/fresh policy input | Not PR81 | Controlled local markdown payload separation | Yes | No | Only bounded capability/decision |
| Cover-letter/application-package export | Local controlled representation | None found | Requires approved/fresh policy input | Not PR81 | Controlled local markdown payload separation | Yes | No | Only bounded capability/decision |
| Manual application handoff | Active Convex runtime, default-off | `TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED` | Authenticated owner profile and owner job/package checks | Yes | Redacted records/events, no provider verification | Yes | No | Only bounded capability/decision |
| Approved artifact delivery | Active manual-handoff delivery | Manual handoff flag and mutation path | Owner-scoped handoff/package checks | Yes for delivery-content load and audits | Approved exports only, no answers | Yes | No | Only bounded capability/decision |
| Controlled application-message send boundary | Local boundary, not provider integration | Egress allowlist input, write-action guard | Manual confirmation and exact preview | Not PR81 | Redacted result/audit | Yes | No live provider grant | Only bounded capability/decision |
| PR80-live external action | Blocked boundary only | `TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED`, configured false | Provider prerequisites absent | Not enough | No provider credentials or calls | Yes, as explicit denial | Yes | Denied category only |
| Approved answer copy | Blocked | None | No authoritative approved answer source | Blocked attempts rate-limited | Answer text must not be exposed | Yes, as explicit denial | Yes | Denied category only |
| Operational/admin status | Active safe helpers | Safe status helpers | No raw config authority | Not PR81 | Bounded operational categories | Yes, read-only classification | No admin runtime | Bounded status only |
| Future workspace/business features | Non-existent | None | No tenant/role model | None | Not applicable | No positive grant | Yes | Denied category only |

## Entitlement Source-Of-Truth Decision

Do not add a schema migration in PR85.

Initial authority should be:

```txt
server_static_policy_v1
```

Assignment source:

```txt
- Server-owned static policy code or server config only.
- Client input may request a capability but cannot assert product mode or grant state.
- Model output cannot assert product mode or grant state.
- Clerk ID, email, provider subject, profile metadata, and arbitrary client metadata are not plan authority.
```

Revocation source:

```txt
- Code/config rollback or policy update.
- No persisted entitlement rows exist to revoke in PR85.
```

Default behavior:

```txt
- Unknown capability fails closed.
- Unknown product mode fails closed.
- Missing server authority fails closed.
- Blocked safety prerequisites fail closed.
```

Deletion, retention, and audit:

```txt
- No new entitlement table.
- No entitlement assignment rows.
- No long-lived billing state.
- Bounded redacted operational event may record capability, decision, denial category, policy version, and safe product mode.
- Repeated denied attempts must not create unbounded audit rows.
```

## Privacy And Security Model

Allowed entitlement output fields:

```txt
- bounded capability
- allowed or denied
- bounded denial category
- product-policy version
- optional safe product mode
```

Forbidden output fields:

```txt
- billing account IDs
- payment IDs
- emails
- Clerk IDs
- provider subjects
- profile IDs
- usage history
- private quota counters
- payment status details
- raw config values
- raw errors
- tokens
- credentials
- arbitrary metadata
```

Entitlement must never bypass authentication, ownership, consent, privacy, approval, freshness, confirmation, idempotency, PR81 rate/budget controls, provider authorization, or source-model prerequisites.

## Business Decisions Required Later

Not required for a narrow PR85 policy boundary:

```txt
- Paid/free pricing.
- Plan names.
- Payment provider.
- Checkout.
- Subscription webhooks.
- Billing persistence.
```

Required before real billing or paid plans:

```txt
- Founder-approved product mode.
- Plan names and capability tiers.
- Payment provider and account owner.
- Whether billing provider status becomes entitlement authority.
- Persistence requirements and retention policy.
- Refund/tax/invoice/customer support handling.
```

## Narrow PR85 Recommendation

Recommended future code PR:

```txt
PR85 - Plan Limits and Entitlement Boundary
Proposed branch: codex/pr85-plan-limits-entitlement-boundary
```

PR85 should implement only a server-side product capability policy boundary. It should not implement billing.

Exact capability enum:

```txt
read_application_package_summary
read_evidence_graph_summary
read_resume_variant_plan_summary
read_review_cockpit_summary
generated_artifact_preview
generated_artifact_human_approval
generated_artifact_revision
generated_artifact_export_download_policy
resume_export
cover_letter_application_package_export
manual_application_handoff
approved_artifact_delivery
controlled_application_message_send
operational_status_read
pr80_live_external_action
approved_answer_copy
workspace_business_runtime
```

Exact policy states:

```txt
Product modes:
- single_user_default
- product_mode_unknown

Decision outcomes:
- allowed
- denied

Denial categories:
- unknown_capability
- unknown_product_mode
- missing_server_authority
- disabled_by_server_policy
- blocked_by_product_policy
- blocked_safety_prerequisite_missing
- business_model_not_defined
```

Initial policy expectations:

```txt
- single_user_default may allow current read-only summaries, generated artifact boundaries, approved export/download representations, manual handoff, approved artifact delivery, controlled application-message boundary checks, and operational status reads.
- pr80_live_external_action must deny with blocked_safety_prerequisite_missing.
- approved_answer_copy must deny with blocked_safety_prerequisite_missing.
- workspace_business_runtime must deny with business_model_not_defined.
- product_mode_unknown must deny every capability.
```

Exact helper contract:

```ts
type TwoweeksProductCapabilityV1 = /* bounded enum above */;
type TwoweeksProductModeV1 = "single_user_default" | "product_mode_unknown";
type TwoweeksEntitlementDecisionV1 = Readonly<{
  kind: "twoweeks_entitlement_decision";
  capability: TwoweeksProductCapabilityV1;
  allowed: boolean;
  denialCategory?: TwoweeksEntitlementDenialCategoryV1;
  productMode: TwoweeksProductModeV1;
  policyVersion: 1;
}>;

function evaluateTwoweeksCapabilityEntitlement(input: {
  capability: unknown;
  productMode: unknown;
  authority: "server_static_policy_v1";
}): TwoweeksEntitlementDecisionV1;
```

Ordering:

```txt
1. Server derives identity and owner context where the surface requires identity.
2. Existing auth, ownership, consent, redaction, freshness, approval, and confirmation checks still apply.
3. Entitlement is checked before expensive or write-capable work.
4. PR81 rate/budget checks run independently after entitlement succeeds for the already-allowed operation.
5. Provider/OAuth/PR80-live prerequisites cannot be bypassed by an entitlement allow result.
```

Exact PR85 files allowed:

```txt
docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
my-app/src/modules/application-harness/capabilityEntitlementPolicy.ts
my-app/src/modules/application-harness/__tests__/capabilityEntitlementPolicy.test.ts
my-app/src/modules/application-harness/__tests__/capabilityEntitlementPolicyScopeGuards.test.ts
my-app/convex/manualApplicationHandoff.ts
my-app/convex/__tests__/manualApplicationHandoff.entitlementBoundary.test.ts
my-app/src/modules/local-mcp/mcpApplicationMessageSend.ts
my-app/src/modules/local-mcp/__tests__/mcpApplicationMessageSend.test.ts
```

Files forbidden in PR85 unless a new explicit preflight changes scope:

```txt
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
my-app/convex/schema.ts
UI/routes/components
payment provider/client files
OAuth callback/token exchange/token storage files
browser automation files
workspace/tenant/role/admin/member runtime files
PR80-live provider integration files
answer-copy implementation files
PR86 audit files
```

Exact PR85 tests:

```txt
rtk npx vitest run my-app/src/modules/application-harness/__tests__/capabilityEntitlementPolicy.test.ts
rtk npx vitest run my-app/src/modules/application-harness/__tests__/capabilityEntitlementPolicyScopeGuards.test.ts
rtk npx vitest run my-app/convex/__tests__/manualApplicationHandoff.entitlementBoundary.test.ts
rtk npx vitest run my-app/src/modules/local-mcp/__tests__/mcpApplicationMessageSend.test.ts
rtk npx tsc --noEmit --pretty false
rtk git diff --check
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Exact source guards:

```txt
- No package or lockfile changes.
- No schema changes.
- No UI changes.
- No payment provider, checkout, webhook, customer, invoice, productId, priceId, or subscriptionId.
- No workspace, tenant, role, admin, member, invitation, or entitlement persistence table.
- No OAuth callback, token exchange, access-token storage, refresh-token storage, provider credentials, provider API calls, or provider revocation.
- No browser automation, external HTTP, PR80-live provider behavior, or answer-copy implementation.
- Public/model-visible entitlement output contains only bounded capability, allow/deny, denial category, policy version, and optional safe product mode.
```

Merge conditions for PR85:

```txt
- CI green on the PR85 head.
- Focused policy tests pass.
- Manual handoff and controlled-send behavior remain fail-closed for denied entitlement.
- PR80-live remains blocked.
- Approved answer copy remains blocked.
- Docs and ledger match GitHub state.
- No forbidden files changed.
```

Rollback:

```txt
- Revert the PR85 commit.
- Because no schema or persisted entitlement rows are added, rollback is code/docs only.
- If a server config product mode is added later, default it to product_mode_unknown or remove it to fail closed.
```

## PR85 Non-Goals

PR85 must not:

```txt
- select Stripe, Paddle, Lemon Squeezy, Chargebee, Shopify, app-store billing, or invoices;
- create checkout, webhook, portal, pricing, upgrade, admin plan editor, or plan comparison UI;
- create fake subscriptions or fake paid-plan records;
- add schema migrations or persisted entitlement rows;
- introduce workspace, tenant, role, admin/member, invitation, billing, or enterprise runtime;
- enable PR80-live;
- enable answer copy;
- add external HTTP;
- add package or lockfile changes;
- start PR86.
```

## Final Decision

READY_TO_IMPLEMENT_NARROW_PR85_POLICY_BOUNDARY
