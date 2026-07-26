import { describe, expect, it } from "vitest";

import {
  STRIPE_PUBLISHABLE_KEY_ENV,
  STRIPE_SECRET_KEY_ENV,
  assertNoLiveStripeMode,
  evaluateBillingTestMode,
  evaluateStripeBillingCapability,
  readStripeBillingConfigStatus,
  type StripeBillingConfigStatusResultV1,
} from "../stripeBillingConfigBoundary";

const SECRET_TEST_PREFIX = `${"sk"}_${"test"}_`;
const PUBLISHABLE_TEST_PREFIX = `${"pk"}_${"test"}_`;
const SECRET_LIVE_PREFIX = `${"sk"}_${"live"}_`;
const PUBLISHABLE_LIVE_PREFIX = `${"pk"}_${"live"}_`;

const TEST_SECRET_KEY = `${SECRET_TEST_PREFIX}${"A".repeat(24)}`;
const TEST_PUBLISHABLE_KEY = `${PUBLISHABLE_TEST_PREFIX}${"B".repeat(24)}`;
const LIVE_SECRET_KEY = `${SECRET_LIVE_PREFIX}${"C".repeat(24)}`;
const LIVE_PUBLISHABLE_KEY = `${PUBLISHABLE_LIVE_PREFIX}${"D".repeat(24)}`;

function testEnv(
  secretKey: string | undefined,
  publishableKey: string | undefined,
): Readonly<Record<string, string | undefined>> {
  return {
    [STRIPE_SECRET_KEY_ENV]: secretKey,
    [STRIPE_PUBLISHABLE_KEY_ENV]: publishableKey,
  };
}

function expectNoRawKeys(
  status: StripeBillingConfigStatusResultV1,
  keys: readonly string[],
): void {
  const serialized = JSON.stringify(status);
  for (const key of keys) {
    expect(serialized.includes(key)).toBe(false);
  }
}

describe("stripeBillingConfigBoundary", () => {
  it("allows local app testing when Stripe env vars are absent", () => {
    expect(readStripeBillingConfigStatus({})).toEqual({
      kind: "stripe_billing_config_status",
      status: "internal_test_mode",
      configured: false,
      configValid: true,
      internalTestModeAllowed: true,
      stripeTestModeConfigured: false,
      valuesExposed: false,
      secretKeyExposed: false,
      publishableKeyExposed: false,
      liveBillingEnabled: false,
      checkoutEnabled: false,
      webhookEnabled: false,
      subscriptionRuntimeEnabled: false,
      paidEntitlementStateEnabled: false,
      version: 1,
    });
  });

  it("detects server-side Stripe test config without exposing key values", () => {
    const status = evaluateBillingTestMode(
      testEnv(TEST_SECRET_KEY, TEST_PUBLISHABLE_KEY),
    );

    expect(status).toMatchObject({
      status: "stripe_test_configured",
      configured: true,
      configValid: true,
      internalTestModeAllowed: true,
      stripeTestModeConfigured: true,
      valuesExposed: false,
      secretKeyExposed: false,
      publishableKeyExposed: false,
      liveBillingEnabled: false,
    });
    expectNoRawKeys(status, [TEST_SECRET_KEY, TEST_PUBLISHABLE_KEY]);
  });

  it("fails closed for live-mode keys", () => {
    expect(evaluateBillingTestMode(testEnv(LIVE_SECRET_KEY, undefined))).toMatchObject({
      status: "stripe_live_mode_blocked",
      configured: false,
      configValid: false,
      liveBillingEnabled: false,
    });

    expect(
      evaluateBillingTestMode(testEnv(TEST_SECRET_KEY, LIVE_PUBLISHABLE_KEY)),
    ).toMatchObject({
      status: "stripe_live_mode_blocked",
      configured: false,
      configValid: false,
      liveBillingEnabled: false,
    });

    expect(() =>
      assertNoLiveStripeMode(testEnv(LIVE_SECRET_KEY, TEST_PUBLISHABLE_KEY)),
    ).toThrow("Stripe live mode is blocked for this test boundary");
  });

  it("fails closed for malformed or partial test config without exposing values", () => {
    const malformedStatus = evaluateBillingTestMode(
      testEnv("not_a_stripe_key", TEST_PUBLISHABLE_KEY),
    );
    expect(malformedStatus).toMatchObject({
      status: "stripe_config_invalid",
      configured: false,
      configValid: false,
    });
    expectNoRawKeys(malformedStatus, ["not_a_stripe_key", TEST_PUBLISHABLE_KEY]);

    expect(evaluateBillingTestMode(testEnv(TEST_SECRET_KEY, undefined))).toMatchObject({
      status: "stripe_not_configured",
      configured: false,
      configValid: true,
      internalTestModeAllowed: true,
    });
  });

  it("allows only internal/test capabilities and keeps safety-blocked capabilities denied", () => {
    const internalStatus = evaluateBillingTestMode({});
    const stripeStatus = evaluateBillingTestMode(
      testEnv(TEST_SECRET_KEY, TEST_PUBLISHABLE_KEY),
    );

    expect(
      evaluateStripeBillingCapability("app_test_access", internalStatus),
    ).toEqual({
      kind: "stripe_billing_capability_decision",
      capability: "app_test_access",
      allowed: true,
      decision: "allowed_internal_test",
      billingConfigStatus: "internal_test_mode",
      valuesExposed: false,
      version: 1,
    });

    expect(
      evaluateStripeBillingCapability("manual_handoff", stripeStatus),
    ).toMatchObject({
      capability: "manual_handoff",
      allowed: true,
      decision: "allowed_stripe_test_configured",
      billingConfigStatus: "stripe_test_configured",
      valuesExposed: false,
    });

    expect(
      evaluateStripeBillingCapability("pr80_live_submit_apply", stripeStatus),
    ).toMatchObject({
      capability: "pr80_live_submit_apply",
      allowed: false,
      decision: "denied_blocked_safety_prerequisite",
    });

    expect(
      evaluateStripeBillingCapability("approved_answer_copy", stripeStatus),
    ).toMatchObject({
      capability: "approved_answer_copy",
      allowed: false,
      decision: "denied_blocked_safety_prerequisite",
    });

    expect(evaluateStripeBillingCapability("billing_portal", stripeStatus)).toMatchObject({
      capability: "billing_portal",
      allowed: false,
      decision: "denied_blocked_safety_prerequisite",
    });

    expect(evaluateStripeBillingCapability("surprise_capability", stripeStatus)).toEqual({
      kind: "stripe_billing_capability_decision",
      capability: "unknown",
      allowed: false,
      decision: "denied_unknown_capability",
      billingConfigStatus: "stripe_test_configured",
      valuesExposed: false,
      version: 1,
    });
  });

  it("denies allowed capabilities when billing config is invalid or live-blocked", () => {
    expect(
      evaluateStripeBillingCapability(
        "app_test_access",
        evaluateBillingTestMode(testEnv("not_a_stripe_key", TEST_PUBLISHABLE_KEY)),
      ),
    ).toMatchObject({
      capability: "app_test_access",
      allowed: false,
      decision: "denied_invalid_billing_config",
      billingConfigStatus: "stripe_config_invalid",
    });

    expect(
      evaluateStripeBillingCapability(
        "artifact_export",
        evaluateBillingTestMode(testEnv(LIVE_SECRET_KEY, TEST_PUBLISHABLE_KEY)),
      ),
    ).toMatchObject({
      capability: "artifact_export",
      allowed: false,
      decision: "denied_invalid_billing_config",
      billingConfigStatus: "stripe_live_mode_blocked",
    });
  });
});
