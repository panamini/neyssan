import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  authenticateMcpBearerRequest,
  denyAllMcpBearerTokenVerifier,
  parseMcpBearerAuthorizationHeader,
  type McpAuthRequestOrchestratorInputV1,
  type McpAuthRequestOrchestratorResultV1,
  type McpBearerTokenVerificationResultV1,
} from "../mcpAuthRequestOrchestrator";
import {
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthPolicyAccountLinkRecordV1,
  type McpAuthVerifiedAccessTokenClaimsV1,
} from "../mcpAuthPolicyBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpAuthRequestOrchestrator.ts");

const RESOURCE_URL = "https://mcp.example/mcp";
const METADATA_URL = "https://mcp.example/.well-known/oauth-protected-resource";
const ISSUER_URL = "https://auth.example/oauth";
const NOW_SECONDS = 1_800_000_000;
const SUBJECT = "stytch_subject_example_123";
const CLIENT_ID = "chatgpt-apps-sdk-example-client";
const ENVIRONMENT = "stytch_example_environment";
const CLERK_OWNER = "clerk_owner_example_123";
const RAW_TOKEN = "raw-token-12345";

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

function buildAccountLink(
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

function buildVerificationSuccess(
  overrides: Partial<McpAuthVerifiedAccessTokenClaimsV1> = {},
): McpBearerTokenVerificationResultV1 {
  return {
    kind: "mcp_bearer_token_verification_result",
    verified: true,
    claims: buildClaims(overrides),
    version: 1,
  };
}

function buildVerificationFailure(
  reason: "invalid_request" | "invalid_token" | "insufficient_scope" = "invalid_token",
): McpBearerTokenVerificationResultV1 {
  return {
    kind: "mcp_bearer_token_verification_result",
    verified: false,
    reason,
    version: 1,
  };
}

function buildBaseInput(
  overrides: Partial<McpAuthRequestOrchestratorInputV1> = {},
  verifier: McpAuthRequestOrchestratorInputV1["tokenVerifier"],
  accountLinkLookup: McpAuthRequestOrchestratorInputV1["accountLinkLookup"],
): McpAuthRequestOrchestratorInputV1 {
  return {
    authorizationHeader: `Bearer ${RAW_TOKEN}`,
    tokenVerifier: verifier,
    accountLinkLookup,
    expectedIssuer: ISSUER_URL,
    expectedAudience: RESOURCE_URL,
    expectedProviderEnvironment: ENVIRONMENT,
    allowedClientIds: [CLIENT_ID],
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    nowEpochSeconds: NOW_SECONDS,
    clockSkewSeconds: 0,
    protectedResourceMetadataUrl: METADATA_URL,
    version: 1,
    ...overrides,
  };
}

function createPorts(options?: {
  verificationResult?: McpBearerTokenVerificationResultV1;
  verificationThrow?: Error;
  lookupResult?: readonly unknown[];
  lookupThrow?: Error;
}) {
  const verifier = vi.fn(async (input: Parameters<McpAuthRequestOrchestratorInputV1["tokenVerifier"]>[0]) => {
    if (options?.verificationThrow) throw options.verificationThrow;
    return options?.verificationResult ?? buildVerificationSuccess();
  });
  const lookup = vi.fn(async (input: Parameters<McpAuthRequestOrchestratorInputV1["accountLinkLookup"]>[0]) => {
    if (options?.lookupThrow) throw options.lookupThrow;
    return options?.lookupResult ?? [buildAccountLink()];
  });

  return { verifier, lookup };
}

async function runAuthRequest(
  overrides: Partial<McpAuthRequestOrchestratorInputV1> = {},
  options?: Parameters<typeof createPorts>[0],
): Promise<{
  result: McpAuthRequestOrchestratorResultV1;
  verifier: ReturnType<typeof vi.fn>;
  lookup: ReturnType<typeof vi.fn>;
}> {
  const { verifier, lookup } = createPorts(options);
  const result = await authenticateMcpBearerRequest(buildBaseInput(overrides, verifier, lookup));
  return { result, verifier, lookup };
}

describe("MCP auth request orchestrator Authorization header parser", () => {
  it("rejects missing and empty headers as missing_token", () => {
    expect(parseMcpBearerAuthorizationHeader(undefined)).toEqual({
      parsed: false,
      failureStage: "authorization_header",
      reason: "missing_token",
    });
    expect(parseMcpBearerAuthorizationHeader("")).toEqual({
      parsed: false,
      failureStage: "authorization_header",
      reason: "missing_token",
    });
    expect(parseMcpBearerAuthorizationHeader([""])).toEqual({
      parsed: false,
      failureStage: "authorization_header",
      reason: "missing_token",
    });
  });

  it("accepts valid Bearer headers and mixed-case schemes without changing the token", () => {
    expect(parseMcpBearerAuthorizationHeader(`Bearer ${RAW_TOKEN}`)).toEqual({
      parsed: true,
      bearerToken: RAW_TOKEN,
    });
    expect(parseMcpBearerAuthorizationHeader(`bEaReR ${RAW_TOKEN}`)).toEqual({
      parsed: true,
      bearerToken: RAW_TOKEN,
    });
    expect(parseMcpBearerAuthorizationHeader([`Bearer ${RAW_TOKEN}`] as const)).toEqual({
      parsed: true,
      bearerToken: RAW_TOKEN,
    });
  });

  it.each([
    ["unsupported scheme", "Basic abc", "unsupported_authorization_scheme"],
    ["two header values", [`Bearer ${RAW_TOKEN}`, "Basic abc"] as const, "multiple_header_values"],
    ["comma-combined credentials", `Bearer ${RAW_TOKEN}, Basic abc`, "comma_combined_credentials"],
    ["extra token segments", `Bearer ${RAW_TOKEN} extra`, "extra_credential_segments"],
    ["CRLF", `Bearer ${RAW_TOKEN}\r\nX-Injected: yes`, "control_characters"],
    ["NUL/control characters", `Bearer ${RAW_TOKEN}\u0000`, "control_characters"],
    ["oversized header", `Bearer ${"a".repeat(9000)}`, "excessive_length"],
  ] as const)("rejects %s", (_label, header, reason) => {
    expect(parseMcpBearerAuthorizationHeader(header)).toEqual({
      parsed: false,
      failureStage: "authorization_header",
      reason,
    });
  });
});

describe("MCP auth request orchestrator verifier boundary", () => {
  it("provides a runtime-default verifier that denies all tokens", async () => {
    await expect(
      denyAllMcpBearerTokenVerifier({
        rawBearerToken: RAW_TOKEN,
        expectedIssuer: ISSUER_URL,
        expectedAudience: RESOURCE_URL,
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        expectedProviderEnvironment: ENVIRONMENT,
        allowedClientIds: [CLIENT_ID],
        version: 1,
      }),
    ).resolves.toEqual({
      kind: "mcp_bearer_token_verification_result",
      verified: false,
      reason: "invalid_token",
      version: 1,
    });
  });

  it("passes the raw bearer token only to the verifier port and fails closed on invalid verifier rejection", async () => {
    const { result, verifier, lookup } = await runAuthRequest(
      undefined,
      { verificationResult: buildVerificationFailure("invalid_token") },
    );

    expect(verifier).toHaveBeenCalledTimes(1);
    expect(verifier.mock.calls[0]?.[0]).toEqual({
      rawBearerToken: RAW_TOKEN,
      expectedIssuer: ISSUER_URL,
      expectedAudience: RESOURCE_URL,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      expectedProviderEnvironment: ENVIRONMENT,
      allowedClientIds: [CLIENT_ID],
      version: 1,
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      authorized: false,
      failureStage: "token_verifier",
      reason: "invalid_token",
      challengeReason: "invalid_token",
      httpStatus: 401,
      safeForModel: true,
      tokenEchoed: false,
      identityEchoed: false,
      modelVisible: false,
      version: 1,
    });
    expect(JSON.stringify(result)).not.toContain(RAW_TOKEN);
  });

  it("preserves verifier insufficient_scope as a safe Bearer challenge", async () => {
    const { result, verifier, lookup } = await runAuthRequest(
      undefined,
      { verificationResult: buildVerificationFailure("insufficient_scope") },
    );

    expect(verifier).toHaveBeenCalledTimes(1);
    expect(lookup).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      authorized: false,
      failureStage: "token_verifier",
      reason: "insufficient_scope",
      challengeReason: "insufficient_scope",
      httpStatus: 401,
      safeForModel: true,
      tokenEchoed: false,
      identityEchoed: false,
    });
    expect(result.challenge.header).toContain('error="insufficient_scope"');
    expect(result.challenge.header).toContain(`scope="${TWOWEEKS_APPLICATIONS_READ_SCOPE}"`);
    expect(JSON.stringify(result)).not.toContain(RAW_TOKEN);
  });

  it("falls back safely for malformed verifier rejection reasons without echoing verifier text", async () => {
    const { result, lookup } = await runAuthRequest(undefined, {
      verificationResult: {
        kind: "mcp_bearer_token_verification_result",
        verified: false,
        reason: "provider says attacker@example.test raw-token-12345 is blocked",
        version: 1,
      } as unknown as McpBearerTokenVerificationResultV1,
    });

    expect(lookup).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      authorized: false,
      failureStage: "token_verifier",
      reason: "invalid_token",
      challengeReason: "invalid_token",
      httpStatus: 401,
      safeForModel: true,
      tokenEchoed: false,
      identityEchoed: false,
    });
    expect(JSON.stringify(result)).not.toContain("attacker@example.test");
    expect(JSON.stringify(result)).not.toContain(RAW_TOKEN);
  });

  it("fails closed on verifier throws and does not retry", async () => {
    const { result, verifier, lookup } = await runAuthRequest(undefined, {
      verificationThrow: new Error("verifier failure"),
    });

    expect(verifier).toHaveBeenCalledTimes(1);
    expect(lookup).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      authorized: false,
      failureStage: "token_verifier",
      reason: "verifier_exception",
      challengeReason: "invalid_token",
    });
    expect(JSON.stringify(result)).not.toContain("verifier failure");
  });
});

describe("MCP auth request orchestrator claims policy composition", () => {
  it.each([
    ["wrong issuer", { issuer: "https://wrong-issuer.example/oauth" }, "wrong_issuer", "invalid_token"],
    ["wrong audience", { audience: "https://wrong-resource.example/mcp" }, "wrong_audience", "invalid_token"],
    ["expired", { expiresAtEpochSeconds: NOW_SECONDS - 1 }, "expired", "invalid_token"],
    ["not yet valid", { notBeforeEpochSeconds: NOW_SECONDS + 1 }, "not_yet_valid", "invalid_token"],
    ["wrong client", { clientId: "blocked-client" }, "unknown_client", "invalid_token"],
    ["wrong environment", { providerEnvironment: "other-env" }, "wrong_environment", "invalid_token"],
    ["missing subject", { subject: " " }, "missing_subject", "invalid_token"],
    ["missing scope", { grantedScopes: ["openid"] }, "missing_scope", "insufficient_scope"],
  ] as const)(
    "rejects %s without calling account-link lookup",
    async (_label, claimsOverrides, reason, challengeReason) => {
      const { result, lookup } = await runAuthRequest(undefined, {
        verificationResult: buildVerificationSuccess(claimsOverrides),
      });

      expect(lookup).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        authorized: false,
        failureStage: "claims_policy",
        reason,
        challengeReason,
        httpStatus: 401,
        safeForModel: true,
        tokenEchoed: false,
        identityEchoed: false,
      });
      expect(JSON.stringify(result)).not.toContain(RAW_TOKEN);
    },
  );

  it("applies clock-skew boundaries consistently", async () => {
    const acceptedStart = await runAuthRequest(
      { clockSkewSeconds: 30 },
      { verificationResult: buildVerificationSuccess({ expiresAtEpochSeconds: NOW_SECONDS - 10 }) },
    );
    const acceptedEnd = await runAuthRequest(
      { clockSkewSeconds: 30 },
      { verificationResult: buildVerificationSuccess({ notBeforeEpochSeconds: NOW_SECONDS + 10 }) },
    );
    const rejectedExpiry = await runAuthRequest(
      { clockSkewSeconds: 30 },
      { verificationResult: buildVerificationSuccess({ expiresAtEpochSeconds: NOW_SECONDS - 31 }) },
    );

    expect(acceptedStart.result).toMatchObject({ authorized: true });
    expect(acceptedEnd.result).toMatchObject({ authorized: true });
    expect(rejectedExpiry.result).toMatchObject({
      authorized: false,
      failureStage: "claims_policy",
      reason: "expired",
      challengeReason: "invalid_token",
    });
  });
});

describe("MCP auth request orchestrator account-link lookup", () => {
  it("looks up account links with issuer, subject, and provider environment only", async () => {
    const lookup = vi.fn(async (input: Parameters<McpAuthRequestOrchestratorInputV1["accountLinkLookup"]>[0]) => {
      expect(input).toEqual({
        issuer: ISSUER_URL,
        subject: SUBJECT,
        providerEnvironment: ENVIRONMENT,
        version: 1,
      });
      expect(Object.keys(input).sort()).toEqual(["issuer", "providerEnvironment", "subject", "version"]);
      return [buildAccountLink()];
    });
    const verifier = vi.fn(async () => buildVerificationSuccess());

    const result = await authenticateMcpBearerRequest(buildBaseInput({}, verifier, lookup));

    expect(verifier).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      kind: "mcp_auth_request_orchestrator_result",
      authorized: true,
      reason: "authorized",
      serverOnly: {
        twoweeksClerkId: CLERK_OWNER,
        grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
        version: 1,
      },
      modelVisible: false,
      version: 1,
    });
  });

  it.each([
    ["zero links", [] as const, "missing_account_link", "account_link_required"],
    ["duplicate links", [buildAccountLink(), buildAccountLink({ updatedAtEpochSeconds: NOW_SECONDS - 30 })] as const, "duplicate_account_link", "reauthorization_required"],
    ["revoked link", [buildAccountLink({ state: "revoked" })] as const, "revoked_account_link", "reauthorization_required"],
    ["stale link", [buildAccountLink({ state: "stale" })] as const, "stale_account_link", "reauthorization_required"],
    ["expired link", [buildAccountLink({ expiresAtEpochSeconds: NOW_SECONDS - 1 })] as const, "expired_account_link", "reauthorization_required"],
    ["issuer mismatch", [buildAccountLink({ issuer: "https://other-issuer.example/oauth" })] as const, "issuer_mismatch", "reauthorization_required"],
    ["subject mismatch", [buildAccountLink({ subject: "other_subject" })] as const, "subject_mismatch", "reauthorization_required"],
    ["client mismatch", [buildAccountLink({ clientId: "blocked-client" })] as const, "disallowed_client", "reauthorization_required"],
    ["missing required scope", [buildAccountLink({ grantedScopes: [] })] as const, "missing_required_scope", "insufficient_scope"],
  ] as const)(
    "rejects %s after successful verification",
    async (_label, lookupResult, reason, challengeReason) => {
      const { result, lookup } = await runAuthRequest(
        undefined,
        { lookupResult, verificationResult: buildVerificationSuccess() },
      );

      expect(lookup).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        authorized: false,
        failureStage: "account_link_resolution",
        reason,
        challengeReason,
        httpStatus: 401,
        safeForModel: true,
      });
    },
  );

  it("fails closed when lookup throws and does not expose internals", async () => {
    const { result, lookup } = await runAuthRequest(undefined, {
      verificationResult: buildVerificationSuccess(),
      lookupThrow: new Error("lookup failure"),
    });

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      authorized: false,
      failureStage: "account_link_lookup",
      reason: "lookup_exception",
      challengeReason: "reauthorization_required",
      httpStatus: 401,
      safeForModel: true,
      tokenEchoed: false,
      identityEchoed: false,
    });
    expect(JSON.stringify(result)).not.toContain("lookup failure");
  });
});

describe("MCP auth request orchestrator identity override rejection", () => {
  it.each([
    [{ userId: "attacker-user" }],
    [{ nested: { workspaceId: "attacker-workspace" } }],
    [{ nested: [{ ownerId: "attacker-owner" }] }],
    [{ contact: { email: "attacker@example.test" } }],
  ] as const)("fails closed for %j", async (requestArguments) => {
    const { result, lookup } = await runAuthRequest(
      { requestArguments },
      { verificationResult: buildVerificationSuccess(), lookupResult: [buildAccountLink()] },
    );

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      authorized: false,
      failureStage: "account_link_resolution",
      reason: "identity_override_forbidden",
      challengeReason: "invalid_token",
      httpStatus: 401,
      safeForModel: true,
      tokenEchoed: false,
      identityEchoed: false,
    });
    expect(JSON.stringify(result)).not.toContain("attacker-user");
    expect(JSON.stringify(result)).not.toContain("attacker-workspace");
    expect(JSON.stringify(result)).not.toContain("attacker-owner");
    expect(JSON.stringify(result)).not.toContain("attacker@example.test");
  });
});

describe("MCP auth request orchestrator authorized context", () => {
  it("returns only server-only ownership context and canonical read scope", async () => {
    const { result, verifier, lookup } = await runAuthRequest(undefined, {
      verificationResult: buildVerificationSuccess(),
      lookupResult: [buildAccountLink()],
    });

    expect(verifier).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      kind: "mcp_auth_request_orchestrator_result",
      authorized: true,
      reason: "authorized",
      serverOnly: {
        twoweeksClerkId: CLERK_OWNER,
        grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
        version: 1,
      },
      modelVisible: false,
      version: 1,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.serverOnly)).toBe(true);
    expect(Object.isFrozen(result.serverOnly.grantedScopes)).toBe(true);
    expect(result.serverOnly.grantedScopes).toHaveLength(1);
    const grantedScopes: readonly [typeof TWOWEEKS_APPLICATIONS_READ_SCOPE] =
      result.serverOnly.grantedScopes;
    expect(grantedScopes).toEqual([TWOWEEKS_APPLICATIONS_READ_SCOPE]);
    expect(JSON.stringify(result)).not.toContain(RAW_TOKEN);
    expect(JSON.stringify(result)).not.toContain(SUBJECT);
    expect(JSON.stringify(result)).not.toContain(CLIENT_ID);
    expect(JSON.stringify(result)).not.toContain("access_token");
    expect(JSON.stringify(result)).not.toContain("refresh_token");
  });
});

describe("MCP auth request orchestrator challenge decision", () => {
  it("returns a safe 401 challenge decision with built Bearer and mcp/www_authenticate metadata", async () => {
    const { result } = await runAuthRequest(undefined, {
      verificationResult: buildVerificationSuccess(),
      lookupResult: [],
    });

    expect(result).toMatchObject({
      authorized: false,
      failureStage: "account_link_resolution",
      reason: "missing_account_link",
      challengeReason: "account_link_required",
      message: "Authentication required.",
      httpStatus: 401,
      safeForModel: true,
      tokenEchoed: false,
      identityEchoed: false,
      modelVisible: false,
      version: 1,
    });
    expect(result.challenge).toMatchObject({
      kind: "mcp_auth_bearer_challenge",
      reason: "account_link_required",
      version: 1,
    });
    expect(result.challenge.header).toContain('error="invalid_token"');
    expect(result.challenge.header).toContain('error_description="Account link required."');
    expect(result.challenge.header).toContain(`scope="${TWOWEEKS_APPLICATIONS_READ_SCOPE}"`);
    expect(result.mcpWwwAuthenticateMeta).toEqual({
      "mcp/www_authenticate": [result.challenge.header],
    });
    expect(JSON.stringify(result)).not.toContain(RAW_TOKEN);
  });
});

describe("MCP auth request orchestrator static safety", () => {
  it("keeps the orchestrator pure and disconnected from runtime auth, network, Convex, and production hosts", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\baxios\b/u);
    expect(source).not.toMatch(/\bdecodeJwt\b|\bjwtVerify\b|\bjsonwebtoken\b|\bjose\b/u);
    expect(source).not.toMatch(/\baccess_token\b|\brefresh_token\b|\braw[_-]?jwt\b/iu);
    expect(source).not.toMatch(/\btokenStorage\b|\bpersist(?:ed|ence)?[A-Za-z0-9_ -]*token\b/iu);
    expect(source).not.toMatch(/\bclient[_-]?secret\b|\bprovider[_-]?secret\b/iu);
    expect(source).not.toMatch(/\binternalQuery\b|\binternalMutation\b|\bconvex\//u);
    expect(source).not.toMatch(/\bapp\.(?:get|post|use|all|route)\b|\brouter\.(?:get|post|use|all)\b/u);
    expect(source).not.toMatch(/https:\/\/(?:www\.)?twoweeks(?:\.ai|\.com)|https:\/\/mcp\.twoweeks/iu);
  });
});
