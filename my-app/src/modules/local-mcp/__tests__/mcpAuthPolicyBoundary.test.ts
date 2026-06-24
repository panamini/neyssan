import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildBearerAuthChallenge,
  buildFutureTwoweeksApplicationsReadSecuritySchemes,
  buildMcpWwwAuthenticateMeta,
  buildProtectedResourceMetadata,
  evaluateMcpAuthVerifiedClaimsPolicy,
  resolveMcpAuthPolicyAccountLink,
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthPolicyAccountLinkRecordV1,
  type McpAuthPolicyAuthorizedPrincipalV1,
  type McpAuthVerifiedAccessTokenClaimsV1,
} from "../mcpAuthPolicyBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpAuthPolicyBoundary.ts");

const RESOURCE_URL = "https://mcp.example/mcp";
const METADATA_URL = "https://mcp.example/.well-known/oauth-protected-resource";
const ISSUER_URL = "https://auth.example/oauth";
const DOCUMENTATION_URL = "https://docs.example/mcp-auth";
const NOW_SECONDS = 1_800_000_000;
const SUBJECT = "stytch_subject_example_123";
const CLIENT_ID = "chatgpt-apps-sdk-example-client";
const ENVIRONMENT = "stytch_example_environment";
const CLERK_OWNER = "clerk_owner_example_123";

function buildClaims(
  overrides: Partial<McpAuthVerifiedAccessTokenClaimsV1> = {},
): McpAuthVerifiedAccessTokenClaimsV1 {
  return {
    kind: "mcp_auth_verified_access_token_claims",
    cryptographicVerification: "already_verified_by_provider_adapter",
    issuer: ISSUER_URL,
    audience: RESOURCE_URL,
    subject: SUBJECT,
    expiresAtEpochSeconds: NOW_SECONDS + 300,
    notBeforeEpochSeconds: NOW_SECONDS - 30,
    clientId: CLIENT_ID,
    grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    providerEnvironment: ENVIRONMENT,
    version: 1,
    ...overrides,
  };
}

function evaluateClaims(
  claims: McpAuthVerifiedAccessTokenClaimsV1,
  overrides: Partial<Parameters<typeof evaluateMcpAuthVerifiedClaimsPolicy>[0]["policy"]> = {},
) {
  return evaluateMcpAuthVerifiedClaimsPolicy({
    claims,
    policy: {
      expectedIssuer: ISSUER_URL,
      expectedAudience: RESOURCE_URL,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      allowedClientIds: [CLIENT_ID],
      expectedProviderEnvironment: ENVIRONMENT,
      nowEpochSeconds: NOW_SECONDS,
      clockSkewSeconds: 0,
      version: 1,
      ...overrides,
    },
  });
}

function authorizedPrincipal(
  overrides: Partial<McpAuthPolicyAuthorizedPrincipalV1> = {},
): McpAuthPolicyAuthorizedPrincipalV1 {
  const decision = evaluateClaims(buildClaims());
  if (!decision.authorized) throw new Error("fixture claims must authorize");
  return {
    ...decision.serverOnly.policyAuthorizedPrincipal,
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

describe("MCP auth protected-resource metadata", () => {
  it("builds deterministic readonly RFC 9728-style metadata for synthetic HTTPS inputs", () => {
    const metadata = buildProtectedResourceMetadata({
      resourceUrl: RESOURCE_URL,
      protectedResourceMetadataUrl: METADATA_URL,
      authorizationServerIssuerUrl: ISSUER_URL,
      supportedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      resourceDocumentationUrl: DOCUMENTATION_URL,
    });

    expect(metadata).toEqual({
      resource: RESOURCE_URL,
      authorization_servers: [ISSUER_URL],
      scopes_supported: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      resource_documentation: DOCUMENTATION_URL,
    });
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.authorization_servers)).toBe(true);
    expect(Object.isFrozen(metadata.scopes_supported)).toBe(true);
    expect(JSON.stringify(metadata)).not.toMatch(/client_secret|token_endpoint|access_token|refresh_token/iu);
  });

  it.each([
    ["HTTP resource", { resourceUrl: "http://mcp.example/mcp" }],
    ["relative resource", { resourceUrl: "/mcp" }],
    ["credentialed resource", { resourceUrl: "https://user:pass@mcp.example/mcp" }],
    ["fragmented resource", { resourceUrl: "https://mcp.example/mcp#frag" }],
    ["credentialed issuer", { authorizationServerIssuerUrl: "https://user:pass@auth.example/oauth" }],
    ["fragmented metadata URL", { protectedResourceMetadataUrl: `${METADATA_URL}#frag` }],
  ] as const)("rejects malformed protected-resource URL input: %s", (_label, overrides) => {
    expect(() =>
      buildProtectedResourceMetadata({
        resourceUrl: RESOURCE_URL,
        protectedResourceMetadataUrl: METADATA_URL,
        authorizationServerIssuerUrl: ISSUER_URL,
        supportedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
        ...overrides,
      }),
    ).toThrow(TypeError);
  });

  it.each([
    [],
    ["twoweeks.mcp.read"],
    [TWOWEEKS_APPLICATIONS_READ_SCOPE, "twoweeks:applications:write"],
  ] as const)("rejects wrong or missing supported scopes: %j", (supportedScopes) => {
    expect(() =>
      buildProtectedResourceMetadata({
        resourceUrl: RESOURCE_URL,
        protectedResourceMetadataUrl: METADATA_URL,
        authorizationServerIssuerUrl: ISSUER_URL,
        supportedScopes,
      }),
    ).toThrow(TypeError);
  });
});

describe("MCP auth Bearer challenges", () => {
  it("builds a missing-token Bearer challenge with resource metadata, scope, error, and description", () => {
    expect(
      buildBearerAuthChallenge({
        reason: "missing_token",
        protectedResourceMetadataUrl: METADATA_URL,
      }),
    ).toEqual({
      kind: "mcp_auth_bearer_challenge",
      reason: "missing_token",
      header:
        'Bearer resource_metadata="https://mcp.example/.well-known/oauth-protected-resource", error="invalid_token", error_description="Access token required.", scope="twoweeks:applications:read"',
      version: 1,
    });
  });

  it.each([
    ["invalid_token", "invalid_token"],
    ["insufficient_scope", "insufficient_scope"],
    ["account_link_required", "invalid_token"],
    ["reauthorization_required", "invalid_token"],
  ] as const)("builds deterministic %s challenges", (reason, expectedError) => {
    const challenge = buildBearerAuthChallenge({
      reason,
      protectedResourceMetadataUrl: METADATA_URL,
    });

    expect(challenge.header).toContain(`error="${expectedError}"`);
    expect(challenge.header).toContain(`scope="${TWOWEEKS_APPLICATIONS_READ_SCOPE}"`);
    expect(challenge.header).not.toMatch(/SECRET_TOKEN|stytch_subject|real-user@example|clerk_/u);
  });

  it.each([
    ["invalid_request", "Authorization request is invalid."],
    ["invalid_token", "Access token is invalid."],
    ["insufficient_scope", "Required read scope missing."],
  ] as const)("uses canned descriptions for allowed OAuth Bearer error %s", (error, description) => {
    const challenge = buildBearerAuthChallenge({
      reason: "invalid_token",
      protectedResourceMetadataUrl: METADATA_URL,
      error,
      errorDescription: "Caller supplied text must never appear.",
    });

    expect(challenge.header).toContain(`error="${error}"`);
    expect(challenge.header).toContain(`error_description="${description}"`);
    expect(challenge.header).not.toContain("Caller supplied text");
  });

  it("maps the same challenge into MCP mcp/www_authenticate metadata", () => {
    const challenge = buildBearerAuthChallenge({
      reason: "insufficient_scope",
      protectedResourceMetadataUrl: METADATA_URL,
      errorDescription: "Additional read scope required.",
    });

    expect(challenge.header).toContain('error_description="Required read scope missing."');
    expect(challenge.header).not.toContain("Additional read scope required.");
    expect(buildMcpWwwAuthenticateMeta(challenge)).toEqual({
      "mcp/www_authenticate": [challenge.header],
    });
  });

  it.each([
    { error: "invalid_token\r\nHeader: injected" },
    { error: "bad\"quote" },
    { error: "bearercredential123" },
    { errorDescription: "Bad\r\nHeader: injected" },
    { errorDescription: "Bearer authorization token abcdef123456" },
    { errorDescription: "real-user@example.test" },
    { errorDescription: SUBJECT },
  ] as const)("does not reflect arbitrary or sensitive challenge text: %j", (overrides) => {
    const challenge = buildBearerAuthChallenge({
      reason: "invalid_token",
      protectedResourceMetadataUrl: METADATA_URL,
      ...overrides,
    });

    expect(challenge.header).toContain('error="invalid_token"');
    expect(challenge.header).toContain('error_description="Access token is invalid."');
    expect(challenge.header).not.toContain("Header: injected");
    expect(challenge.header).not.toContain("bad");
    expect(challenge.header).not.toContain("bearercredential123");
    expect(challenge.header).not.toContain("Bearer authorization token");
    expect(challenge.header).not.toContain("real-user@example.test");
    expect(challenge.header).not.toContain(SUBJECT);
  });

  it("still rejects malformed protected-resource metadata URLs", () => {
    expect(() =>
      buildBearerAuthChallenge({
        reason: "invalid_token",
        protectedResourceMetadataUrl: "https://mcp.example/bad\"quote",
      }),
    ).toThrow(TypeError);
  });
});

describe("MCP future tool security scheme", () => {
  it("returns an OAuth-only future security scheme for the canonical read scope", () => {
    const schemes = buildFutureTwoweeksApplicationsReadSecuritySchemes();

    expect(schemes).toEqual([{ type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] }]);
    expect(JSON.stringify(schemes)).not.toContain("noauth");
    expect(JSON.stringify(schemes)).not.toContain("write");
    expect(Object.isFrozen(schemes)).toBe(true);
    expect(Object.isFrozen(schemes[0].scopes)).toBe(true);
  });
});

describe("MCP verified-claims auth policy", () => {
  it("accepts already cryptographically verified claims as a server-only authorized principal", () => {
    expect(evaluateClaims(buildClaims())).toMatchObject({
      kind: "mcp_auth_verified_claims_policy_decision",
      authorized: true,
      reason: "authorized",
      serverOnly: {
        policyAuthorizedPrincipal: {
          issuer: ISSUER_URL,
          subject: SUBJECT,
          audience: RESOURCE_URL,
          clientId: CLIENT_ID,
          grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
          providerEnvironment: ENVIRONMENT,
        },
      },
      modelVisible: false,
      version: 1,
    });
  });

  it("rejects raw bearer text or decoded-but-unverified claims without the verification proof", () => {
    for (const claims of [
      "Bearer raw-token-value",
      { sub: SUBJECT, scope: TWOWEEKS_APPLICATIONS_READ_SCOPE },
      buildClaims({ cryptographicVerification: "missing" as "already_verified_by_provider_adapter" }),
    ] as const) {
      const decision = evaluateClaims(claims as unknown as McpAuthVerifiedAccessTokenClaimsV1);

      expect(decision).toMatchObject({
        authorized: false,
        reason: "cryptographic_verification_prerequisite_missing",
        safeFailure: {
          code: "auth_policy_denied",
          safeForModel: true,
          rawClaimsExposed: false,
        },
      });
      expect(JSON.stringify(decision)).not.toContain(SUBJECT);
    }
  });

  it.each([
    ["wrong issuer", buildClaims({ issuer: "https://wrong-issuer.example/oauth" }), "wrong_issuer"],
    ["wrong audience", buildClaims({ audience: "https://wrong-resource.example/mcp" }), "wrong_audience"],
    ["expired", buildClaims({ expiresAtEpochSeconds: NOW_SECONDS - 1 }), "expired"],
    ["not yet valid", buildClaims({ notBeforeEpochSeconds: NOW_SECONDS + 1 }), "not_yet_valid"],
    ["missing scope", buildClaims({ grantedScopes: ["openid"] }), "missing_scope"],
    ["wrong client ID", buildClaims({ clientId: "blocked-client" }), "unknown_client"],
    ["wrong environment", buildClaims({ providerEnvironment: "other-env" }), "wrong_environment"],
    ["missing subject", buildClaims({ subject: " " }), "missing_subject"],
  ] as const)("rejects %s without exposing raw claim values", (_label, claims, reason) => {
    const decision = evaluateClaims(claims);

    expect(decision).toMatchObject({ authorized: false, reason });
    expect(JSON.stringify(decision)).not.toContain(SUBJECT);
    expect(JSON.stringify(decision)).not.toContain("wrong-issuer");
    expect(JSON.stringify(decision)).not.toContain("wrong-resource");
    expect(JSON.stringify(decision)).not.toContain("blocked-client");
  });

  it("applies explicit clock skew at expiry and not-before boundaries", () => {
    expect(
      evaluateClaims(buildClaims({ expiresAtEpochSeconds: NOW_SECONDS - 10 }), { clockSkewSeconds: 30 }),
    ).toMatchObject({ authorized: true });
    expect(
      evaluateClaims(buildClaims({ notBeforeEpochSeconds: NOW_SECONDS + 10 }), { clockSkewSeconds: 30 }),
    ).toMatchObject({ authorized: true });
    expect(
      evaluateClaims(buildClaims({ expiresAtEpochSeconds: NOW_SECONDS - 31 }), { clockSkewSeconds: 30 }),
    ).toMatchObject({ authorized: false, reason: "expired" });
  });
});

describe("MCP account-link resolver policy", () => {
  it("accepts exactly one active link and returns the Clerk owner only as server-only state", () => {
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: [accountLink()],
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({
      kind: "mcp_auth_account_link_resolution",
      resolved: true,
      reason: "resolved",
      serverOnly: {
        twoweeksClerkId: CLERK_OWNER,
        grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      },
      modelVisible: false,
      version: 1,
    });
  });

  it.each([
    ["missing principal", undefined, "malformed_account_link"],
    ["null principal", null, "malformed_account_link"],
    ["array principal", [], "malformed_account_link"],
    ["empty issuer", { ...authorizedPrincipal(), issuer: " " }, "malformed_account_link"],
    ["empty subject", { ...authorizedPrincipal(), subject: " " }, "malformed_account_link"],
    ["wrong field type", { ...authorizedPrincipal(), clientId: 123 }, "malformed_account_link"],
    ["missing canonical scope", { ...authorizedPrincipal(), grantedScopes: [] }, "missing_required_scope"],
    [
      "extra identity override field",
      { ...authorizedPrincipal(), twoweeksClerkId: "attacker_clerk" },
      "identity_override_forbidden",
    ],
  ] as const)("rejects malformed authorized principal: %s", (_label, principal, reason) => {
    const result = resolveMcpAuthPolicyAccountLink({
      principal: principal as unknown as McpAuthPolicyAuthorizedPrincipalV1,
      accountLinks: [accountLink()],
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      nowEpochSeconds: NOW_SECONDS,
      version: 1,
    });

    expect(result).toMatchObject({
      resolved: false,
      reason,
      safeFailure: { code: "account_link_denied", safeForModel: true },
      modelVisible: false,
    });
    expect(JSON.stringify(result)).not.toContain("attacker_clerk");
  });

  it.each([
    ["zero links", [], "missing_account_link"],
    ["duplicate links", [accountLink(), accountLink({ updatedAtEpochSeconds: NOW_SECONDS - 30 })], "duplicate_account_link"],
    ["revoked link", [accountLink({ state: "revoked" })], "revoked_account_link"],
    ["stale link", [accountLink({ state: "stale" })], "stale_account_link"],
    ["expired link", [accountLink({ expiresAtEpochSeconds: NOW_SECONDS - 1 })], "expired_account_link"],
    ["issuer mismatch", [accountLink({ issuer: "https://other-issuer.example/oauth" })], "issuer_mismatch"],
    ["subject mismatch", [accountLink({ subject: "other_subject", displayEmail: "same-user@example.test" })], "subject_mismatch"],
    [
      "same external principal linked through another client",
      [
        accountLink(),
        accountLink({ clientId: "other-chatgpt-client", twoweeksClerkId: "other_clerk_owner" }),
      ],
      "duplicate_account_link",
    ],
    ["client mismatch", [accountLink({ clientId: "blocked-client" })], "disallowed_client"],
    ["missing required scope", [accountLink({ grantedScopes: [] })], "missing_required_scope"],
  ] as const)("rejects %s", (_label, accountLinks, reason) => {
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks,
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({
      resolved: false,
      reason,
      safeFailure: { code: "account_link_denied", safeForModel: true },
      modelVisible: false,
    });
  });

  it("does not let request or tool arguments override the resolved owner", () => {
    const result = resolveMcpAuthPolicyAccountLink({
      principal: authorizedPrincipal(),
      accountLinks: [accountLink()],
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      nowEpochSeconds: NOW_SECONDS,
      requestArguments: {
        userId: "attacker_user",
        workspaceId: "attacker_workspace",
        twoweeksClerkId: "attacker_clerk",
      },
      version: 1,
    });

    expect(result).toMatchObject({
      resolved: false,
      reason: "identity_override_forbidden",
    });
    expect(JSON.stringify(result)).not.toContain("attacker_clerk");
  });

  it("accepts valid safe integer account-link timestamps", () => {
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: [
          accountLink({
            createdAtEpochSeconds: 0,
            updatedAtEpochSeconds: NOW_SECONDS - 1,
            expiresAtEpochSeconds: NOW_SECONDS + 1,
          }),
        ],
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: true, reason: "resolved" });
  });

  it.each([
    ["createdAtEpochSeconds", Number.NaN],
    ["createdAtEpochSeconds", Number.POSITIVE_INFINITY],
    ["createdAtEpochSeconds", "123"],
    ["createdAtEpochSeconds", null],
    ["createdAtEpochSeconds", []],
    ["createdAtEpochSeconds", {}],
    ["createdAtEpochSeconds", -1],
    ["createdAtEpochSeconds", 1.5],
    ["createdAtEpochSeconds", Number.MAX_SAFE_INTEGER + 1],
    ["updatedAtEpochSeconds", Number.NaN],
    ["updatedAtEpochSeconds", Number.POSITIVE_INFINITY],
    ["updatedAtEpochSeconds", "123"],
    ["updatedAtEpochSeconds", null],
    ["updatedAtEpochSeconds", []],
    ["updatedAtEpochSeconds", {}],
    ["updatedAtEpochSeconds", -1],
    ["updatedAtEpochSeconds", 1.5],
    ["updatedAtEpochSeconds", Number.MAX_SAFE_INTEGER + 1],
    ["expiresAtEpochSeconds", Number.NaN],
    ["expiresAtEpochSeconds", Number.POSITIVE_INFINITY],
    ["expiresAtEpochSeconds", "123"],
    ["expiresAtEpochSeconds", null],
    ["expiresAtEpochSeconds", []],
    ["expiresAtEpochSeconds", {}],
    ["expiresAtEpochSeconds", -1],
    ["expiresAtEpochSeconds", 1.5],
    ["expiresAtEpochSeconds", Number.MAX_SAFE_INTEGER + 1],
  ] as const)("rejects malformed account-link timestamp %s=%j", (field, value) => {
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: [accountLink({ [field]: value } as Partial<McpAuthPolicyAccountLinkRecordV1>)],
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "malformed_account_link" });
  });

  it("rejects account-link timestamps when updated time predates created time", () => {
    expect(
      resolveMcpAuthPolicyAccountLink({
        principal: authorizedPrincipal(),
        accountLinks: [
          accountLink({
            createdAtEpochSeconds: NOW_SECONDS,
            updatedAtEpochSeconds: NOW_SECONDS - 1,
          }),
        ],
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        nowEpochSeconds: NOW_SECONDS,
        version: 1,
      }),
    ).toMatchObject({ resolved: false, reason: "malformed_account_link" });
  });
});

describe("MCP auth policy boundary static safety", () => {
  it("keeps the boundary pure and disconnected from runtime auth, network, Convex, and production hosts", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\baxios\b/u);
    expect(source).not.toMatch(/\bdecodeJwt\b|\bjwtVerify\b|\bjsonwebtoken\b|\bjose\b/u);
    expect(source).not.toMatch(/\baccess_token\b|\brefresh_token\b|\braw[_-]?jwt\b|\braw[_-]?token\b/iu);
    expect(source).not.toMatch(/\btokenStorage\b|\bpersist(?:ed|ence)?[A-Za-z0-9_ -]*token\b/iu);
    expect(source).not.toMatch(/\bclient[_-]?secret\b|\bprovider[_-]?secret\b/iu);
    expect(source).not.toMatch(/\binternalQuery\b|\binternalMutation\b|\bconvex\//u);
    expect(source).not.toMatch(/\bapp\.(?:get|post|use|all|route)\b|\brouter\.(?:get|post|use|all)\b/u);
    expect(source).not.toMatch(/https:\/\/(?:www\.)?twoweeks(?:\.ai|\.com)|https:\/\/mcp\.twoweeks/iu);
  });
});
