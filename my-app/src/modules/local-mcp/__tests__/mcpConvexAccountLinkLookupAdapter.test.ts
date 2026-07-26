import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  buildMcpConvexAccountLinkLookupAdapter,
  MCP_CONVEX_ACCOUNT_LINK_LOOKUP_MALFORMED_RESULT,
} from "../mcpConvexAccountLinkLookupAdapter";
import {
  resolveMcpAuthPolicyAccountLink,
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthPolicyAccountLinkRecordV1,
  type McpAuthPolicyAuthorizedPrincipalV1,
} from "../mcpAuthPolicyBoundary";
import type { McpAccountLinkLookupPortV1 } from "../mcpAuthRequestOrchestrator";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpConvexAccountLinkLookupAdapter.ts");
const ISSUER_URL = "https://auth.example/oauth";
const SUBJECT = "stytch_subject_example_123";
const CLIENT_ID = "chatgpt-apps-sdk-example-client";
const ENVIRONMENT = "stytch_example_environment";
const CLERK_OWNER = "clerk_owner_example_123";
const NOW_SECONDS = 1_800_000_000;

function authorizedPrincipal(
  overrides: Partial<McpAuthPolicyAuthorizedPrincipalV1> = {},
): McpAuthPolicyAuthorizedPrincipalV1 {
  return {
    kind: "mcp_auth_policy_authorized_principal",
    issuer: ISSUER_URL,
    subject: SUBJECT,
    audience: "https://mcp.example/mcp",
    clientId: CLIENT_ID,
    grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    providerEnvironment: ENVIRONMENT,
    version: 1,
    ...overrides,
  };
}

function accountLink(
  overrides: Partial<McpAuthPolicyAccountLinkRecordV1> = {},
): McpAuthPolicyAccountLinkRecordV1 {
  return {
    kind: "mcp_auth_policy_account_link_record",
    issuer: ISSUER_URL,
    subject: SUBJECT,
    providerEnvironment: ENVIRONMENT,
    clientId: CLIENT_ID,
    twoweeksClerkId: CLERK_OWNER,
    grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    state: "active",
    createdAtEpochSeconds: NOW_SECONDS - 600,
    updatedAtEpochSeconds: NOW_SECONDS - 60,
    expiresAtEpochSeconds: NOW_SECONDS + 600,
    version: 1,
    ...overrides,
  };
}

describe("MCP Convex account-link lookup adapter", () => {
  it("conforms to the account-link lookup port and calls the injected internal query with only principal fields", async () => {
    const queryRef = Object.freeze({ name: "mcpAccountLinks.internalLookupMcpAuthPolicyAccountLinkCandidates" });
    const runQuery = vi.fn(async () => [accountLink()]);
    const adapter: McpAccountLinkLookupPortV1 = buildMcpConvexAccountLinkLookupAdapter({
      kind: "mcp_convex_account_link_lookup_adapter_config",
      queryRef,
      runQuery,
      serverOnly: true,
      version: 1,
    });

    const result = await adapter({
      issuer: ISSUER_URL,
      subject: SUBJECT,
      providerEnvironment: ENVIRONMENT,
      version: 1,
    });

    expect(runQuery).toHaveBeenCalledWith(queryRef, {
      issuer: ISSUER_URL,
      subject: SUBJECT,
      providerEnvironment: ENVIRONMENT,
      version: 1,
    });
    expect(Object.keys(runQuery.mock.calls[0]?.[1] ?? {}).sort()).toEqual([
      "issuer",
      "providerEnvironment",
      "subject",
      "version",
    ]);
    expect(result).toEqual([accountLink()]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("turns malformed Convex lookup output into a resolver-denied candidate set", async () => {
    const adapter = buildMcpConvexAccountLinkLookupAdapter({
      kind: "mcp_convex_account_link_lookup_adapter_config",
      queryRef: Object.freeze({ name: "query" }),
      runQuery: vi.fn(async () => ({ not: "an array" })),
      serverOnly: true,
      version: 1,
    });

    const candidates = await adapter({
      issuer: ISSUER_URL,
      subject: SUBJECT,
      providerEnvironment: ENVIRONMENT,
      version: 1,
    });

    expect(candidates).toEqual([MCP_CONVEX_ACCOUNT_LINK_LOOKUP_MALFORMED_RESULT]);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "malformed_account_link" });
  });

  it("turns Convex lookup exceptions into the same resolver-denied candidate set", async () => {
    const adapter = buildMcpConvexAccountLinkLookupAdapter({
      kind: "mcp_convex_account_link_lookup_adapter_config",
      queryRef: Object.freeze({ name: "query" }),
      runQuery: vi.fn(async () => {
        throw new Error("synthetic lookup failure with subject details");
      }),
      serverOnly: true,
      version: 1,
    });

    const candidates = await adapter({
      issuer: ISSUER_URL,
      subject: SUBJECT,
      providerEnvironment: ENVIRONMENT,
      version: 1,
    });

    expect(candidates).toEqual([MCP_CONVEX_ACCOUNT_LINK_LOOKUP_MALFORMED_RESULT]);
    expect(JSON.stringify(candidates)).not.toContain(SUBJECT);
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: candidates,
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "malformed_account_link" });
  });

  it("does not import endpoint, Vite, Stytch verifier, public query, mutation, HTTP action, or network runtime", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expect(source).not.toMatch(/localMcpDevEndpoint|vite\.config|mcpStytchBearerVerifierBoundary/u);
    expect(source).not.toMatch(/\b(?:query|mutation|publicQuery|internalMutation|httpAction)\s*\(/u);
    expect(source).not.toMatch(/\bfetch\s*\(|\bXMLHttpRequest\b|@stytch|oauth\/callback/u);
    expect(source).not.toMatch(/tools\/list|tools\/call|download|send|submit|apply/u);
  });
});
