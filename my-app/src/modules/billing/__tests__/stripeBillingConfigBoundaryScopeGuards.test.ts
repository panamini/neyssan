import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const MY_APP_ROOT = resolve(TEST_DIR, "../../../..");
const REPO_ROOT = resolve(MY_APP_ROOT, "..");
const BILLING_DIR = resolve(TEST_DIR, "..");
const BILLING_MODULE = resolve(BILLING_DIR, "stripeBillingConfigBoundary.ts");
const BILLING_TEST = resolve(TEST_DIR, "stripeBillingConfigBoundary.test.ts");
const THIS_TEST = resolve(TEST_DIR, "stripeBillingConfigBoundaryScopeGuards.test.ts");
const PR85_DOC = resolve(
  REPO_ROOT,
  "docs/plans/2026-06-20-pr85-stripe-test-mode-boundary.md",
);
const LEDGER_DOC = resolve(
  REPO_ROOT,
  "docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md",
);
const PACKAGE_JSON = resolve(MY_APP_ROOT, "package.json");
const SCHEMA_FILE = resolve(MY_APP_ROOT, "convex/schema.ts");

const SOURCE_FILES = [
  BILLING_MODULE,
  BILLING_TEST,
  THIS_TEST,
  PR85_DOC,
  LEDGER_DOC,
] as const;

const FORBIDDEN_KEY_PREFIXES = [
  `${"sk"}_${"test"}_`,
  `${"sk"}_${"live"}_`,
  `${"pk"}_${"test"}_`,
  `${"pk"}_${"live"}_`,
] as const;
const FORBIDDEN_BILLING_RUNTIME_PATTERNS = [
  /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|axios|node-fetch|undici|https?\.request)\b/u,
  /\b(?:createCheckoutSession|CheckoutSession|checkout\.sessions|stripe\.checkout|billingPortal|portal\.sessions)\b/u,
  /\b(?:constructEvent|stripe\.webhooks|webhookSecret|rawStripePayload)\b/u,
  /\b(?:subscriptions?\.create|customers?\.create|priceId|productId|subscriptionId|customerId)\b/u,
] as const;
const FORBIDDEN_BILLING_SCHEMA_PATTERNS = [
  /\b(?:stripeCustomers|stripeSubscriptions|billingCustomers|billingSubscriptions|billingPlans|entitlements|customerSubscriptions)\s*:\s*defineTable/u,
  /\b(?:stripeCustomerId|stripeSubscriptionId|billingPlanId|subscriptionId|entitlementId|priceId|productId)\b/u,
] as const;
const FORBIDDEN_BLOCKED_FEATURE_PATTERNS = [
  /\b(?:reserveExternalAction|markExternalActionDispatching|finalizeExternalAction|liveExternalActionExecutions)\b/u,
  /\b(?:recordCopySucceeded|approvedAnswers|answerCopySucceeded|answerText)\b/u,
] as const;

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

function expectNoMatches(source: string, patterns: readonly RegExp[]): void {
  for (const pattern of patterns) {
    expect(source).not.toMatch(pattern);
  }
}

describe("PR85 Stripe test-mode boundary scope guards", () => {
  it("does not commit raw Stripe key prefixes or env assignments", () => {
    for (const path of SOURCE_FILES) {
      const source = readSource(path);
      for (const prefix of FORBIDDEN_KEY_PREFIXES) {
        expect(source.includes(prefix)).toBe(false);
      }
      expect(source).not.toMatch(/STRIPE_[A-Z0-9_]*=/u);
    }
  });

  it("does not add Stripe SDK dependency or package-scope runtime billing", () => {
    const packageJson = JSON.parse(readSource(PACKAGE_JSON)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.stripe).toBeUndefined();
    expect(packageJson.devDependencies?.stripe).toBeUndefined();
  });

  it("does not add checkout, webhook, subscription, customer, or Stripe network runtime", () => {
    const source = readSource(BILLING_MODULE);

    expectNoMatches(source, FORBIDDEN_BILLING_RUNTIME_PATTERNS);
  });

  it("does not add billing, subscription, customer, entitlement, or workspace schema", () => {
    const schema = readSource(SCHEMA_FILE);

    expectNoMatches(schema, FORBIDDEN_BILLING_SCHEMA_PATTERNS);
  });

  it("does not connect billing config to PR80-live or answer-copy runtime", () => {
    const source = readSource(BILLING_MODULE);

    expectNoMatches(source, FORBIDDEN_BLOCKED_FEATURE_PATTERNS);
  });
});
