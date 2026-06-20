import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const CONVEX_DIR = resolve(TEST_DIR, "..");
const SCHEMA_FILE = resolve(CONVEX_DIR, "schema.ts");
const PROFILES_FILE = resolve(CONVEX_DIR, "profiles.ts");

describe("PR84 owner/profile boundary scope guards", () => {
  it("does not add workspace, tenant, role, billing, entitlement, or invitation schema", () => {
    const schemaSource = readFileSync(SCHEMA_FILE, "utf8");

    expect(schemaSource).not.toMatch(
      /\b(?:workspaces|tenants|organizations|teams|memberships|roles|roleAssignments|billingPlans|subscriptions|entitlements|invitations)\s*:\s*defineTable/u,
    );
    expect(schemaSource).not.toMatch(
      /\b(?:workspaceId|tenantId|organizationId|teamId|membershipId|roleId|billingPlanId|subscriptionId|entitlementId|invitationId)\b/u,
    );
  });

  it("keeps profile boundary hardening disconnected from provider, token, PR80-live, and answer-copy runtime", () => {
    const profilesSource = readFileSync(PROFILES_FILE, "utf8");

    expect(profilesSource).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|playwright|puppeteer|selenium)\b/u,
    );
    expect(profilesSource).not.toMatch(
      /\b(?:OAuth|Authorization|Bearer|accessToken|refreshToken|idToken|clientSecret|providerCredentials)\b/u,
    );
    expect(profilesSource).not.toMatch(
      /\b(?:liveExternalActionExecutions|reserveExternalAction|markExternalActionDispatching|finalizeExternalAction)\b/u,
    );
    expect(profilesSource).not.toMatch(/answer copy|approvedAnswers|answerCopy/iu);
  });
});
