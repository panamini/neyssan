import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sign, type Algorithm } from "jsonwebtoken";
import type { JWK, JSONWebKeySet, JWTPayload } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  authenticateMcpBearerRequest,
  type McpBearerTokenVerifierInputV1,
  type McpBearerTokenVerifierRejectionReasonV1,
} from "../mcpAuthRequestOrchestrator";
import {
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthPolicyAccountLinkRecordV1,
} from "../mcpAuthPolicyBoundary";
import {
  buildStytchMcpBearerTokenVerifier,
  type StytchMcpBearerVerifierConfigV1,
} from "../mcpStytchBearerVerifierBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpStytchBearerVerifierBoundary.ts");
const ISSUER = "https://connected-apps.stytch.twoweeks.test/oauth";
const AUDIENCE = "https://mcp.twoweeks.test/mcp";
const METADATA_URL = "https://mcp.twoweeks.test/.well-known/oauth-protected-resource";
const CLIENT_ID = "chatgpt-openai-apps-sdk-client";
const OTHER_CLIENT_ID = "other-approved-client";
const SUBJECT = "stytch-member-prod-123";
const ENVIRONMENT = "stytch-test-environment";
const CLERK_OWNER = "clerk_owner_example_123";
const KEY_ID = "stytch-verifier-key-1";
const FAR_FUTURE_EXP = 4_102_444_800;
const FAR_FUTURE_NBF = 4_102_448_400;
const EXPIRED_EXP = 1;

type FixtureKeys = ReturnType<typeof buildFixtureKeys>;

type SignFixtureTokenOptions = Readonly<{
  issuer?: string;
  audience?: string | string[];
  includeAudience?: boolean;
  resource?: string | readonly string[];
  includeSubject?: boolean;
  includeClientId?: boolean;
  clientId?: string;
  azp?: string;
  scope?: unknown;
  scp?: unknown;
  scopes?: unknown;
  exp?: number;
  nbf?: number;
  algorithm?: Algorithm;
  kid?: string;
  privateKey?: string;
  includeProviderEnvironment?: boolean;
  providerEnvironment?: string;
  extraClaims?: Record<string, unknown>;
}>;

let fixtureKeys: FixtureKeys;

beforeAll(() => {
  fixtureKeys = buildFixtureKeys();
});

describe("Stytch MCP bearer verifier config boundary", () => {
  it("accepts a valid synthetic Stytch config and canonical-scope token", async () => {
    const token = signFixtureToken();
    const verifier = buildStytchMcpBearerTokenVerifier(buildConfig());

    const result = await verifier(buildVerifierInput(token));

    expect(result).toEqual({
      kind: "mcp_bearer_token_verification_result",
      verified: true,
      claims: {
        kind: "mcp_auth_verified_access_token_claims",
        cryptographicVerification: "already_verified_by_provider_adapter",
        issuer: ISSUER,
        audience: AUDIENCE,
        subject: SUBJECT,
        expiresAtEpochSeconds: FAR_FUTURE_EXP,
        clientId: CLIENT_ID,
        grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
        providerEnvironment: ENVIRONMENT,
        version: 1,
      },
      version: 1,
    });
  });

  it.each([
    ["provider is not Stytch", { provider: "other" }],
    ["issuer is not HTTPS", { issuer: "http://connected-apps.stytch.twoweeks.test/oauth" }],
    ["audience/resource is not HTTPS", { audience: "twoweeks-mcp-resource-production" }],
    ["JWKS is a remote URL", { jwks: "https://connected-apps.stytch.twoweeks.test/.well-known/jwks.json" }],
    ["server-only marker is absent", { serverOnly: false }],
    ["token storage is enabled", { tokenStorage: "local" }],
    ["required scope is an old dotted scope", { requiredScope: "twoweeks.mcp.read" }],
    ["allowed algorithm is not RS256", { allowedAlgorithm: "RS512" }],
    ["clock tolerance is negative", { clockToleranceSeconds: -1 }],
  ] as const)("rejects malformed config: %s", async (_label, overrides) => {
    const verifier = buildStytchMcpBearerTokenVerifier(
      buildConfig(overrides as Partial<StytchMcpBearerVerifierConfigV1>),
    );

    await expectVerifierDenied(verifier, signFixtureToken(), "invalid_request");
  });

  it("rejects config objects with extra remote-JWKS fields", async () => {
    const verifier = buildStytchMcpBearerTokenVerifier({
      ...buildConfig(),
      jwksUrl: "https://connected-apps.stytch.twoweeks.test/.well-known/jwks.json",
    } as StytchMcpBearerVerifierConfigV1);

    await expectVerifierDenied(verifier, signFixtureToken(), "invalid_request");
  });

  it("rejects verifier policy mismatch before token verification", async () => {
    const verifier = buildStytchMcpBearerTokenVerifier(buildConfig());

    await expectVerifierDenied(
      verifier,
      signFixtureToken(),
      "invalid_request",
      buildVerifierInput(signFixtureToken(), { expectedAudience: "https://other.example.test/mcp" }),
    );
  });
});

describe("Stytch MCP bearer verifier token verification", () => {
  it("accepts the configured resource claim when aud is absent", async () => {
    const token = signFixtureToken({ includeAudience: false, resource: AUDIENCE });
    const result = await buildStytchMcpBearerTokenVerifier(buildConfig())(buildVerifierInput(token));

    expect(result).toMatchObject({
      verified: true,
      claims: {
        audience: AUDIENCE,
        grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      },
    });
  });

  it("accepts azp as the approved client claim when client_id is absent", async () => {
    const token = signFixtureToken({ includeClientId: false, azp: CLIENT_ID });
    const result = await buildStytchMcpBearerTokenVerifier(buildConfig())(buildVerifierInput(token));

    expect(result).toMatchObject({
      verified: true,
      claims: {
        clientId: CLIENT_ID,
      },
    });
  });

  it.each([
    ["malformed token", "not-a-jwt", "invalid_token"],
    ["unsupported algorithm", () => signFixtureToken({ algorithm: "RS512" }), "invalid_token"],
    ["missing kid", () => signFixtureToken({ kid: "" }), "invalid_token"],
    ["unknown kid", () => signFixtureToken({ kid: "unknown-key" }), "invalid_token"],
    ["invalid signature", () => signFixtureToken({ privateKey: fixtureKeys.wrongPrivateKeyPem }), "invalid_token"],
    [
      "invalid signature with missing canonical scope",
      () => signFixtureToken({ privateKey: fixtureKeys.wrongPrivateKeyPem, scope: "openid profile" }),
      "invalid_token",
    ],
    ["legacy dotted scope", () => signFixtureToken({ scope: "twoweeks.mcp.read" }), "insufficient_scope"],
    [
      "mixed canonical and legacy dotted scopes",
      () => signFixtureToken({ scope: `${TWOWEEKS_APPLICATIONS_READ_SCOPE} twoweeks.mcp.read` }),
      "insufficient_scope",
    ],
    ["wrong issuer", () => signFixtureToken({ issuer: "https://wrong-issuer.example.test/oauth" }), "invalid_token"],
    ["wrong audience/resource", () => signFixtureToken({ audience: "https://wrong-resource.example.test/mcp" }), "invalid_token"],
    ["missing subject", () => signFixtureToken({ includeSubject: false }), "invalid_token"],
    ["unauthorized client", () => signFixtureToken({ clientId: "blocked-client" }), "invalid_token"],
    ["conflicting authorized party", () => signFixtureToken({ azp: OTHER_CLIENT_ID }), "invalid_token"],
    ["missing canonical scope", () => signFixtureToken({ scope: "openid profile" }), "insufficient_scope"],
    ["expired token", () => signFixtureToken({ exp: EXPIRED_EXP }), "invalid_token"],
    ["future nbf", () => signFixtureToken({ nbf: FAR_FUTURE_NBF }), "invalid_token"],
    ["malformed scope claim", () => signFixtureToken({ scope: ["not-a-string-scope"] }), "invalid_token"],
    ["missing provider environment", () => signFixtureToken({ includeProviderEnvironment: false }), "invalid_token"],
    ["wrong provider environment", () => signFixtureToken({ providerEnvironment: "other-environment" }), "invalid_token"],
  ] as const)("rejects %s", async (_label, tokenFactory, reason) => {
    const token = typeof tokenFactory === "string" ? tokenFactory : tokenFactory();

    await expectVerifierDenied(
      buildStytchMcpBearerTokenVerifier(buildConfig()),
      token,
      reason,
    );
  });

  it("does not expose raw tokens, subjects, client IDs, or claim payloads in failure outputs", async () => {
    const token = signFixtureToken({
      clientId: "blocked-client",
      extraClaims: {
        email: "real-user@example.test",
        clerkId: "clerk_real_123",
        rawClaims: { secret: "hidden" },
      },
    });

    const result = await buildStytchMcpBearerTokenVerifier(buildConfig())(buildVerifierInput(token));
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      kind: "mcp_bearer_token_verification_result",
      verified: false,
      reason: "invalid_token",
      version: 1,
    });
    for (const forbidden of [
      token,
      SUBJECT,
      CLIENT_ID,
      "blocked-client",
      "real-user@example.test",
      "clerk_real_123",
      "rawClaims",
      "hidden",
    ] as const) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("Stytch MCP bearer verifier orchestrator compatibility", () => {
  it("authorizes through authenticateMcpBearerRequest when token and account link are valid", async () => {
    const verifier = buildStytchMcpBearerTokenVerifier(buildConfig());
    const lookup = async () => [buildAccountLink()];

    const result = await authenticateMcpBearerRequest({
      authorizationHeader: `Bearer ${signFixtureToken()}`,
      tokenVerifier: verifier,
      accountLinkLookup: lookup,
      expectedIssuer: ISSUER,
      expectedAudience: AUDIENCE,
      expectedProviderEnvironment: ENVIRONMENT,
      allowedClientIds: [CLIENT_ID],
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      nowEpochSeconds: Math.floor(Date.now() / 1000),
      clockSkewSeconds: 0,
      protectedResourceMetadataUrl: METADATA_URL,
      version: 1,
    });

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

  it("maps missing canonical scope to an insufficient-scope challenge without account lookup", async () => {
    let lookupCalls = 0;
    const result = await authenticateMcpBearerRequest({
      authorizationHeader: `Bearer ${signFixtureToken({ scope: "openid profile" })}`,
      tokenVerifier: buildStytchMcpBearerTokenVerifier(buildConfig()),
      accountLinkLookup: async () => {
        lookupCalls += 1;
        return [buildAccountLink()];
      },
      expectedIssuer: ISSUER,
      expectedAudience: AUDIENCE,
      expectedProviderEnvironment: ENVIRONMENT,
      allowedClientIds: [CLIENT_ID],
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      nowEpochSeconds: Math.floor(Date.now() / 1000),
      clockSkewSeconds: 0,
      protectedResourceMetadataUrl: METADATA_URL,
      version: 1,
    });

    expect(lookupCalls).toBe(0);
    expect(result).toMatchObject({
      authorized: false,
      failureStage: "token_verifier",
      reason: "insufficient_scope",
      challengeReason: "insufficient_scope",
      safeForModel: true,
      tokenEchoed: false,
      identityEchoed: false,
    });
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.challenge.header).toContain(`scope="${TWOWEEKS_APPLICATIONS_READ_SCOPE}"`);
    }
  });

  it("maps invalid tokens to an invalid-token challenge without echoing the raw token", async () => {
    const rawToken = signFixtureToken({ privateKey: fixtureKeys.wrongPrivateKeyPem });
    const result = await authenticateMcpBearerRequest({
      authorizationHeader: `Bearer ${rawToken}`,
      tokenVerifier: buildStytchMcpBearerTokenVerifier(buildConfig()),
      accountLinkLookup: async () => [buildAccountLink()],
      expectedIssuer: ISSUER,
      expectedAudience: AUDIENCE,
      expectedProviderEnvironment: ENVIRONMENT,
      allowedClientIds: [CLIENT_ID],
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      nowEpochSeconds: Math.floor(Date.now() / 1000),
      clockSkewSeconds: 0,
      protectedResourceMetadataUrl: METADATA_URL,
      version: 1,
    });

    expect(result).toMatchObject({
      authorized: false,
      failureStage: "token_verifier",
      reason: "invalid_token",
      challengeReason: "invalid_token",
      safeForModel: true,
      tokenEchoed: false,
      identityEchoed: false,
    });
    expect(JSON.stringify(result)).not.toContain(rawToken);
  });
});

describe("Stytch MCP bearer verifier static safety", () => {
  it("does not import or call forbidden runtime surfaces", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const importSpecifiers = [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map(
      (match) => match[1],
    );

    for (const specifier of importSpecifiers) {
      expect(specifier).not.toMatch(/(?:convex|node:http|node:https|@stytch|openai|langchain|vite|localMcpDevEndpoint)/iu);
    }

    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\baxios\b/u);
    expect(source).not.toMatch(/\bXMLHttpRequest\b/u);
    expect(source).not.toMatch(/\bprocess\.env\b/u);
    expect(source).not.toMatch(/\bconsole\.(?:log|info|warn|error)\s*\(/u);
    expect(source).not.toMatch(/\bcreateServer\s*\(/u);
    expect(source).not.toMatch(/\bapp\.(?:get|post|use)\s*\(/u);
    expect(source).not.toMatch(/\brouter\.(?:get|post|use)\s*\(/u);
    expect(source).not.toMatch(/\bjwks_uri\b|\bjwksUrl\b|\btokenEndpoint\b|\bintrospect/u);
    expect(source).not.toMatch(/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/u);
    expect(source).not.toMatch(/tools\/list|tools\/call/u);
    expect(source).not.toMatch(/https:\/\/(?:www\.)?twoweeks(?:\.ai|\.com)|https:\/\/mcp\.twoweeks/iu);
  });
});

async function expectVerifierDenied(
  verifier: ReturnType<typeof buildStytchMcpBearerTokenVerifier>,
  token: string,
  reason: McpBearerTokenVerifierRejectionReasonV1,
  input: McpBearerTokenVerifierInputV1 = buildVerifierInput(token),
): Promise<void> {
  const result = await verifier(input);

  expect(result).toEqual({
    kind: "mcp_bearer_token_verification_result",
    verified: false,
    reason,
    version: 1,
  });
}

function buildVerifierInput(
  rawBearerToken: string,
  overrides: Partial<McpBearerTokenVerifierInputV1> = {},
): McpBearerTokenVerifierInputV1 {
  return {
    rawBearerToken,
    expectedIssuer: ISSUER,
    expectedAudience: AUDIENCE,
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    expectedProviderEnvironment: ENVIRONMENT,
    allowedClientIds: [CLIENT_ID],
    version: 1,
    ...overrides,
  };
}

function buildConfig(
  overrides: Partial<StytchMcpBearerVerifierConfigV1> = {},
): StytchMcpBearerVerifierConfigV1 {
  return {
    kind: "stytch_mcp_bearer_verifier_config",
    provider: "stytch",
    issuer: ISSUER,
    audience: AUDIENCE,
    approvedClientIds: [CLIENT_ID],
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    jwks: fixtureKeys.jwks,
    jwksSource: "server_only_config",
    serverOnly: true,
    providerEnvironment: ENVIRONMENT,
    allowedAlgorithm: "RS256",
    clockToleranceSeconds: 0,
    tokenStorage: "none",
    version: 1,
    ...overrides,
  };
}

function buildAccountLink(
  overrides: Partial<McpAuthPolicyAccountLinkRecordV1> = {},
): McpAuthPolicyAccountLinkRecordV1 {
  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  return {
    kind: "mcp_auth_policy_account_link_record",
    issuer: ISSUER,
    subject: SUBJECT,
    providerEnvironment: ENVIRONMENT,
    clientId: CLIENT_ID,
    twoweeksClerkId: CLERK_OWNER,
    grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    state: "active",
    createdAtEpochSeconds: nowEpochSeconds - 600,
    updatedAtEpochSeconds: nowEpochSeconds - 60,
    expiresAtEpochSeconds: nowEpochSeconds + 600,
    version: 1,
    ...overrides,
  };
}

function signFixtureToken(options: SignFixtureTokenOptions = {}): string {
  const header =
    options.kid === ""
      ? { typ: "JWT" }
      : { typ: "JWT", kid: options.kid ?? KEY_ID };

  return sign(buildFixturePayload(options), options.privateKey ?? fixtureKeys.privateKeyPem, {
    algorithm: options.algorithm ?? "RS256",
    header,
    noTimestamp: true,
  });
}

function buildFixturePayload(options: SignFixtureTokenOptions): JWTPayload & Record<string, unknown> {
  return {
    ...baseFixturePayload(options),
    ...scopeArrayClaims(options),
    ...(options.extraClaims ?? {}),
  };
}

function baseFixturePayload(options: SignFixtureTokenOptions): JWTPayload & Record<string, unknown> {
  return {
    iss: options.issuer ?? ISSUER,
    ...audienceClaim(options),
    ...resourceClaim(options),
    ...subjectClaim(options),
    ...clientIdClaim(options),
    azp: options.azp ?? options.clientId ?? CLIENT_ID,
    scope: options.scope ?? TWOWEEKS_APPLICATIONS_READ_SCOPE,
    ...providerEnvironmentClaim(options),
    iat: 1_800_000_000,
    exp: options.exp ?? FAR_FUTURE_EXP,
    ...notBeforeClaim(options),
  };
}

function scopeArrayClaims(options: SignFixtureTokenOptions): Record<string, unknown> {
  return {
    ...(options.scp !== undefined ? { scp: options.scp } : {}),
    ...(options.scopes !== undefined ? { scopes: options.scopes } : {}),
  };
}

function audienceClaim(options: SignFixtureTokenOptions): Record<string, string | string[]> {
  return options.includeAudience === false ? {} : { aud: options.audience ?? AUDIENCE };
}

function resourceClaim(options: SignFixtureTokenOptions): Record<string, string | readonly string[]> {
  return options.resource === undefined ? {} : { resource: options.resource };
}

function subjectClaim(options: SignFixtureTokenOptions): Record<string, string> {
  return options.includeSubject === false ? {} : { sub: SUBJECT };
}

function clientIdClaim(options: SignFixtureTokenOptions): Record<string, string> {
  return options.includeClientId === false ? {} : { client_id: options.clientId ?? CLIENT_ID };
}

function notBeforeClaim(options: SignFixtureTokenOptions): Record<string, number> {
  return options.nbf === undefined ? {} : { nbf: options.nbf };
}

function providerEnvironmentClaim(options: SignFixtureTokenOptions): Record<string, string> {
  return options.includeProviderEnvironment === false
    ? {}
    : { provider_environment: options.providerEnvironment ?? ENVIRONMENT };
}

function buildFixtureKeys() {
  const fixtureKeyPair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const wrongKeyPair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const publicJwk = fixtureKeyPair.publicKey.export({ format: "jwk" }) as JWK;
  const jwk: JWK = {
    ...publicJwk,
    kid: KEY_ID,
    alg: "RS256",
    use: "sig",
  };

  return {
    privateKeyPem: fixtureKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    wrongPrivateKeyPem: wrongKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    jwks: { keys: [jwk] } satisfies JSONWebKeySet,
  };
}
