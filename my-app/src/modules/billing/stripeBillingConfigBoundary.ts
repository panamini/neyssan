export const STRIPE_SECRET_KEY_ENV = "STRIPE_SECRET_KEY" as const;
export const STRIPE_PUBLISHABLE_KEY_ENV = "STRIPE_PUBLISHABLE_KEY" as const;

const STRIPE_BILLING_CONFIG_STATUSES = [
  "internal_test_mode",
  "stripe_test_configured",
  "stripe_not_configured",
  "stripe_config_invalid",
  "stripe_live_mode_blocked",
] as const;

const STRIPE_BILLING_CAPABILITIES = [
  "app_test_access",
  "read_only_summaries",
  "artifact_export",
  "manual_handoff",
  "pr80_live_submit_apply",
  "approved_answer_copy",
  "workspace_team_admin",
  "billing_portal",
] as const;

const STRIPE_BILLING_CAPABILITY_DECISIONS = [
  "allowed_internal_test",
  "allowed_stripe_test_configured",
  "denied_blocked_safety_prerequisite",
  "denied_unknown_capability",
  "denied_invalid_billing_config",
] as const;

export type StripeBillingConfigStatusV1 =
  (typeof STRIPE_BILLING_CONFIG_STATUSES)[number];

export type StripeBillingCapabilityV1 =
  (typeof STRIPE_BILLING_CAPABILITIES)[number];

export type StripeBillingCapabilityDecisionStatusV1 =
  (typeof STRIPE_BILLING_CAPABILITY_DECISIONS)[number];

export type StripeBillingConfigStatusResultV1 = Readonly<{
  kind: "stripe_billing_config_status";
  status: StripeBillingConfigStatusV1;
  configured: boolean;
  configValid: boolean;
  internalTestModeAllowed: boolean;
  stripeTestModeConfigured: boolean;
  valuesExposed: false;
  secretKeyExposed: false;
  publishableKeyExposed: false;
  liveBillingEnabled: false;
  checkoutEnabled: false;
  webhookEnabled: false;
  subscriptionRuntimeEnabled: false;
  paidEntitlementStateEnabled: false;
  version: 1;
}>;

export type StripeBillingCapabilityDecisionV1 = Readonly<{
  kind: "stripe_billing_capability_decision";
  capability: StripeBillingCapabilityV1 | "unknown";
  allowed: boolean;
  decision: StripeBillingCapabilityDecisionStatusV1;
  billingConfigStatus: StripeBillingConfigStatusV1;
  valuesExposed: false;
  version: 1;
}>;

type EnvReader = Readonly<Record<string, string | undefined>>;

const SECRET_TEST_PREFIX = `${"sk"}_${"test"}_`;
const PUBLISHABLE_TEST_PREFIX = `${"pk"}_${"test"}_`;
const SECRET_LIVE_PREFIX = `${"sk"}_${"live"}_`;
const PUBLISHABLE_LIVE_PREFIX = `${"pk"}_${"live"}_`;
const MAX_KEY_LENGTH = 256;
const MIN_SUFFIX_LENGTH = 8;
const STRIPE_KEY_VALUE_PATTERN = /^[A-Za-z0-9_]+$/u;
const SAFE_FALSE_STATUS_FLAGS = [
  "valuesExposed",
  "secretKeyExposed",
  "publishableKeyExposed",
  "liveBillingEnabled",
  "checkoutEnabled",
  "webhookEnabled",
  "subscriptionRuntimeEnabled",
  "paidEntitlementStateEnabled",
] as const;
const SAFE_BOOLEAN_STATUS_FIELDS = [
  "configured",
  "configValid",
  "internalTestModeAllowed",
  "stripeTestModeConfigured",
] as const;

const ALLOWED_INTERNAL_TEST_CAPABILITIES = new Set<StripeBillingCapabilityV1>([
  "app_test_access",
  "read_only_summaries",
  "artifact_export",
  "manual_handoff",
]);

const BLOCKED_SAFETY_PREREQUISITE_CAPABILITIES = new Set<StripeBillingCapabilityV1>([
  "pr80_live_submit_apply",
  "approved_answer_copy",
  "workspace_team_admin",
  "billing_portal",
]);

export function readStripeBillingConfigStatus(
  env: EnvReader = process.env,
): StripeBillingConfigStatusResultV1 {
  return evaluateBillingTestMode(env);
}

export function evaluateBillingTestMode(
  env: EnvReader = process.env,
): StripeBillingConfigStatusResultV1 {
  const secretKey = readEnvString(env, STRIPE_SECRET_KEY_ENV);
  const publishableKey = readEnvString(env, STRIPE_PUBLISHABLE_KEY_ENV);

  if (secretKey === undefined && publishableKey === undefined) {
    return buildStatus("internal_test_mode");
  }

  if (containsLiveStripeKey(secretKey) || containsLiveStripeKey(publishableKey)) {
    return buildStatus("stripe_live_mode_blocked");
  }

  if (secretKey === undefined || publishableKey === undefined) {
    return buildStatus("stripe_not_configured");
  }

  if (
    isTestStripeKey(secretKey, SECRET_TEST_PREFIX) &&
    isTestStripeKey(publishableKey, PUBLISHABLE_TEST_PREFIX)
  ) {
    return buildStatus("stripe_test_configured");
  }

  return buildStatus("stripe_config_invalid");
}

export function assertNoLiveStripeMode(env: EnvReader = process.env): void {
  const status = evaluateBillingTestMode(env);
  if (status.status === "stripe_live_mode_blocked") {
    throw new Error("Stripe live mode is blocked for this test boundary");
  }
}

export function evaluateStripeBillingCapability(
  capability: unknown,
  configStatus: StripeBillingConfigStatusResultV1 = evaluateBillingTestMode(),
): StripeBillingCapabilityDecisionV1 {
  const parsedCapability = readStripeBillingCapability(capability);
  const billingConfigStatus = readStripeBillingConfigStatusValue(configStatus);

  if (!parsedCapability || !billingConfigStatus) {
    return buildCapabilityDecision(
      parsedCapability ?? "unknown",
      "denied_unknown_capability",
      billingConfigStatus ?? "stripe_config_invalid",
    );
  }

  if (BLOCKED_SAFETY_PREREQUISITE_CAPABILITIES.has(parsedCapability)) {
    return buildCapabilityDecision(
      parsedCapability,
      "denied_blocked_safety_prerequisite",
      billingConfigStatus,
    );
  }

  if (
    billingConfigStatus === "stripe_config_invalid" ||
    billingConfigStatus === "stripe_live_mode_blocked"
  ) {
    return buildCapabilityDecision(
      parsedCapability,
      "denied_invalid_billing_config",
      billingConfigStatus,
    );
  }

  if (!ALLOWED_INTERNAL_TEST_CAPABILITIES.has(parsedCapability)) {
    return buildCapabilityDecision(
      parsedCapability,
      "denied_unknown_capability",
      billingConfigStatus,
    );
  }

  return buildCapabilityDecision(
    parsedCapability,
    billingConfigStatus === "stripe_test_configured"
      ? "allowed_stripe_test_configured"
      : "allowed_internal_test",
    billingConfigStatus,
  );
}

function buildStatus(
  status: StripeBillingConfigStatusV1,
): StripeBillingConfigStatusResultV1 {
  const configured = status === "stripe_test_configured";
  const configValid =
    status === "internal_test_mode" ||
    status === "stripe_test_configured" ||
    status === "stripe_not_configured";

  return {
    kind: "stripe_billing_config_status",
    status,
    configured,
    configValid,
    internalTestModeAllowed: true,
    stripeTestModeConfigured: configured,
    valuesExposed: false,
    secretKeyExposed: false,
    publishableKeyExposed: false,
    liveBillingEnabled: false,
    checkoutEnabled: false,
    webhookEnabled: false,
    subscriptionRuntimeEnabled: false,
    paidEntitlementStateEnabled: false,
    version: 1,
  };
}

function buildCapabilityDecision(
  capability: StripeBillingCapabilityV1 | "unknown",
  decision: StripeBillingCapabilityDecisionStatusV1,
  billingConfigStatus: StripeBillingConfigStatusV1,
): StripeBillingCapabilityDecisionV1 {
  return {
    kind: "stripe_billing_capability_decision",
    capability,
    allowed:
      decision === "allowed_internal_test" ||
      decision === "allowed_stripe_test_configured",
    decision,
    billingConfigStatus,
    valuesExposed: false,
    version: 1,
  };
}

function readEnvString(env: EnvReader, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function containsLiveStripeKey(value: string | undefined): boolean {
  return (
    typeof value === "string" &&
    (value.includes(SECRET_LIVE_PREFIX) ||
      value.includes(PUBLISHABLE_LIVE_PREFIX))
  );
}

function isTestStripeKey(value: string, prefix: string): boolean {
  if (!value.startsWith(prefix)) {
    return false;
  }

  if (value.length > MAX_KEY_LENGTH) {
    return false;
  }

  if (!STRIPE_KEY_VALUE_PATTERN.test(value)) {
    return false;
  }

  return value.slice(prefix.length).length >= MIN_SUFFIX_LENGTH;
}

function readStripeBillingCapability(
  value: unknown,
): StripeBillingCapabilityV1 | undefined {
  return typeof value === "string" &&
    STRIPE_BILLING_CAPABILITIES.includes(value as StripeBillingCapabilityV1)
    ? (value as StripeBillingCapabilityV1)
    : undefined;
}

function readStripeBillingConfigStatusValue(
  value: unknown,
): StripeBillingConfigStatusV1 | undefined {
  return isSafeConfigStatusRecord(value) ? value.status : undefined;
}

function isSafeConfigStatusRecord(
  value: unknown,
): value is StripeBillingConfigStatusResultV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Partial<StripeBillingConfigStatusResultV1>;
  return (
    record.kind === "stripe_billing_config_status" &&
    record.version === 1 &&
    hasSafeFalseStatusFlags(record) &&
    hasSafeBooleanStatusFields(record) &&
    isStripeBillingConfigStatus(record.status)
  );
}

function hasSafeFalseStatusFlags(
  record: Partial<StripeBillingConfigStatusResultV1>,
): boolean {
  return SAFE_FALSE_STATUS_FLAGS.every((field) => record[field] === false);
}

function hasSafeBooleanStatusFields(
  record: Partial<StripeBillingConfigStatusResultV1>,
): boolean {
  return SAFE_BOOLEAN_STATUS_FIELDS.every(
    (field) => typeof record[field] === "boolean",
  );
}

function isStripeBillingConfigStatus(
  value: unknown,
): value is StripeBillingConfigStatusV1 {
  return STRIPE_BILLING_CONFIG_STATUSES.includes(
    value as StripeBillingConfigStatusV1,
  );
}
