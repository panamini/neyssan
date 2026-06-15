import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sign, type Algorithm } from "jsonwebtoken";
import type { JWK, JSONWebKeySet, JWTPayload } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildMcpProductionStytchOAuthSafeRefusal,
  verifyMcpProductionStytchOAuthConfigBoundary,
  type McpProductionStytchOAuthConfigV1,
  type McpProductionStytchOAuthDenialReasonV1,
} from "../mcpProductionStytchOAuthConfigBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const BOUNDARY_SOURCE = resolve(TEST_DIR, "../mcpProductionStytchOAuthConfigBoundary.ts");
const PACKAGE_MANIFEST = resolve(TEST_DIR, "../../../../package.json");
const FIXTURE_NOW = new Date("2026-06-15T05:40:00.000Z");
const FIXTURE_NOW_SECONDS = Math.floor(FIXTURE_NOW.getTime() / 1000);
const FIXTURE_ISSUER = "https://connected-apps.stytch.twoweeks.test/oauth";
const FIXTURE_AUDIENCE = "twoweeks-mcp-resource-production";
const FIXTURE_CLIENT_ID = "chatgpt-openai-apps-sdk-client";
const FIXTURE_SUBJECT = "stytch-member-prod-123";
const FIXTURE_KEY_ID = "stytch-prod-key-1";
const REQUIRED_READ_SCOPES = [
  "twoweeks.application_package.read",
  "twoweeks.evidence_graph.read",
  "twoweeks.mcp.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
] as const;

type FixtureKeys = ReturnType<typeof buildFixtureKeys>;

type SignFixtureTokenOptions = Readonly<{
  issuer?: string;
  audience?: string | string[];
  includeAudience?: boolean;
  includeIssuer?: boolean;
  includeSubject?: boolean;
  includeClientId?: boolean;
  scope?: unknown;
  clientId?: string;
  azp?: string;
  exp?: number;
  nbf?: number;
  algorithm?: Algorithm;
  kid?: string;
  privateKey?: string;
  extraClaims?: Record<string, unknown>;
}>;

let fixtureKeys: FixtureKeys;

beforeAll(() => {
  fixtureKeys = buildFixtureKeys();
});

describe("MCP production Stytch OAuth config boundary", () => {
  it("accepts valid production-shaped config and token as server-only auth", async () => {
    const token = signFixtureToken();
    const result = await verifyMcpProductionStytchOAuthConfigBoundary(buildInput(token));

    expect(result).toMatchObject({
      kind: "mcp_production_stytch_oauth_config_boundary_result",
      allowed: true,
      reason: "authorized_server_only",
      serverOnly: {
        provider: "stytch",
        authState: "verified_access_token",
        clientCategory: "approved_ai_client",
        resourceCategory: "twoweeks_mcp_resource",
        grantedReadScopes: [...REQUIRED_READ_SCOPES],
        requiredReadScopes: [...REQUIRED_READ_SCOPES],
        subjectBinding: "verified_stytch_subject_server_only_not_returned",
        offlineAccessStoresRefreshTokens: false,
        version: 1,
      },
      capabilities: {
        authDecision: "server_only",
        tokenVerification: "local_jwt_only",
        signingAlgorithm: "RS256_only",
        jwks: "server_provided_only",
        remoteJwks: "blocked",
        tokenIntrospection: "blocked",
        tokenStorage: "none",
        refreshTokenStorage: "none",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
      },
      modelVisible: false,
      version: 1,
    });
  });

  it("rejects wrong issuer", async () => {
    await expectDenied(signFixtureToken({ issuer: "https://wrong-issuer.example.test" }), "wrong_issuer");
  });

  it("rejects missing issuer", async () => {
    await expectDenied(signFixtureToken({ includeIssuer: false }), "missing_issuer");
  });

  it("rejects wrong audience/resource", async () => {
    await expectDenied(signFixtureToken({ audience: "wrong-resource" }), "wrong_audience");
  });

  it("rejects missing audience", async () => {
    await expectDenied(signFixtureToken({ includeAudience: false }), "missing_audience");
  });

  it("rejects wrong client id", async () => {
    await expectDenied(signFixtureToken({ clientId: "unapproved-client" }), "unauthorized_client");
  });

  it("rejects missing client id", async () => {
    await expectDenied(signFixtureToken({ includeClientId: false }), "missing_client_id");
  });

  it("rejects generic OIDC-only scopes", async () => {
    await expectDenied(signFixtureToken({ scope: "openid profile email" }), "missing_required_scope");
  });

  it("rejects tokens missing twoweeks.mcp.read", async () => {
    await expectDenied(
      signFixtureToken({
        scope:
          "twoweeks.application_package.read twoweeks.evidence_graph.read twoweeks.resume_variant_plan.read twoweeks.review_cockpit.read",
      }),
      "missing_required_scope",
    );
  });

  it("rejects tokens missing a requested class-specific scope", async () => {
    await expectDenied(
      signFixtureToken({
        scope:
          "twoweeks.mcp.read twoweeks.application_package.read twoweeks.evidence_graph.read twoweeks.resume_variant_plan.read",
      }),
      "missing_required_scope",
    );
  });

  it("does not treat unknown extra scopes as access grants", async () => {
    await expectDenied(
      signFixtureToken({
        scope:
          "twoweeks.mcp.read twoweeks.application_package.read twoweeks.evidence_graph.read twoweeks.resume_variant_plan.read twoweeks.unknown.read",
      }),
      "missing_required_scope",
    );
  });

  it("does not treat offline_access as permission to store refresh tokens", async () => {
    const token = signFixtureToken({
      scope: `${REQUIRED_READ_SCOPES.join(" ")} offline_access`,
    });
    const result = await verifyMcpProductionStytchOAuthConfigBoundary(buildInput(token));

    expect(result.allowed).toBe(true);
    expect(result.capabilities.tokenStorage).toBe("none");
    expect(result.capabilities.refreshTokenStorage).toBe("none");
    if (result.allowed) {
      expect(result.serverOnly.offlineAccessStoresRefreshTokens).toBe(false);
    }
  });

  it("rejects expired token", async () => {
    await expectDenied(signFixtureToken({ exp: FIXTURE_NOW_SECONDS - 1 }), "expired_token");
  });

  it("rejects future nbf", async () => {
    await expectDenied(signFixtureToken({ nbf: FIXTURE_NOW_SECONDS + 60 }), "future_nbf");
  });

  it("rejects unsupported alg", async () => {
    await expectDenied(signFixtureToken({ algorithm: "RS512" }), "unsupported_algorithm");
  });

  it("rejects missing kid", async () => {
    await expectDenied(signFixtureToken({ kid: "" }), "missing_kid");
  });

  it("rejects unknown kid", async () => {
    await expectDenied(signFixtureToken({ kid: "unknown-key" }), "unknown_kid");
  });

  it("rejects malformed JWKS", async () => {
    await expectDenied(signFixtureToken(), "malformed_jwks", {
      ...buildConfig(),
      jwks: { keys: [{ kid: FIXTURE_KEY_ID, kty: "RSA" }] } as JSONWebKeySet,
    });
  });

  it("rejects empty JWKS", async () => {
    await expectDenied(signFixtureToken(), "malformed_jwks", {
      ...buildConfig(),
      jwks: { keys: [] },
    });
  });

  it("rejects invalid signature", async () => {
    await expectDenied(
      signFixtureToken({ privateKey: fixtureKeys.wrongPrivateKeyPem }),
      "invalid_signature",
    );
  });

  it("rejects malformed claims", async () => {
    await expectDenied(
      signFixtureToken({
        scope: ["twoweeks.mcp.read"],
      }),
      "malformed_claims",
    );
  });

  it("rejects missing sub", async () => {
    await expectDenied(signFixtureToken({ includeSubject: false }), "missing_subject");
  });

  it("never exposes token, raw claims, Stytch subject, user ids, or Convex ids in output", async () => {
    const token = signFixtureToken({
      extraClaims: {
        email: "real-user@example.test",
        clerkId: "clerk_real_123",
        userId: "user_real_123",
        sessionId: "session_real_123",
        convexId: "jd7convexrealid",
        rawClaims: { secret: "hidden" },
      },
    });
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];

    try {
      spies.forEach((spy) => spy.mockImplementation(() => undefined));
      const result = await verifyMcpProductionStytchOAuthConfigBoundary(buildInput(token));
      const serialized = JSON.stringify(result);

      expect(result.allowed).toBe(true);
      for (const forbidden of [
        token,
        FIXTURE_SUBJECT,
        FIXTURE_CLIENT_ID,
        FIXTURE_ISSUER,
        FIXTURE_AUDIENCE,
        "real-user@example.test",
        "clerk_real_123",
        "user_real_123",
        "session_real_123",
        "jd7convexrealid",
        "rawClaims",
        "hidden",
      ] as const) {
        expect(serialized).not.toContain(forbidden);
      }
      spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it("does not import or call forbidden runtime surfaces", () => {
    const source = readFileSync(BOUNDARY_SOURCE, "utf8");
    const importSpecifiers = [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map(
      (match) => match[1],
    );

    for (const specifier of importSpecifiers) {
      expect(specifier).not.toMatch(/(?:convex|node:http|node:https|@stytch|openai|langchain|tools\/list|tools\/call)/iu);
    }

    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\bXMLHttpRequest\b/u);
    expect(source).not.toMatch(/\bcreateServer\s*\(/u);
    expect(source).not.toMatch(/\bapp\.(?:get|post|use)\s*\(/u);
    expect(source).not.toMatch(/\brouter\.(?:get|post|use)\s*\(/u);
    expect(source).not.toMatch(/\bconsole\.(?:log|info|warn|error)\s*\(/u);
    expect(source).not.toMatch(/activeCvSnapshots|profilesPublic|jobsPublic|proposalsPublic/u);
    expect(source).not.toMatch(/tools\/list|tools\/call/u);
    expect(source).not.toMatch(/@stytch|stytchClient|tokenEndpoint|refreshToken\s*\(|revocationEndpoint/u);
  });

  it("does not require package or lockfile edits", () => {
    const manifest = readFileSync(PACKAGE_MANIFEST, "utf8");

    expect(manifest).toContain("\"jose\"");
    expect(manifest).toContain("\"jsonwebtoken\"");
  });
});

async function expectDenied(
  token: string,
  reason: McpProductionStytchOAuthDenialReasonV1,
  config: McpProductionStytchOAuthConfigV1 = buildConfig(),
): Promise<void> {
  const result = await verifyMcpProductionStytchOAuthConfigBoundary(buildInput(token, config));

  expect(result).toEqual({
    kind: "mcp_production_stytch_oauth_config_boundary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpProductionStytchOAuthSafeRefusal(),
    capabilities: {
      authDecision: "blocked",
      provider: "stytch",
      tokenVerification: "local_jwt_only",
      signingAlgorithm: "RS256_only",
      jwks: "server_provided_only",
      remoteJwks: "blocked",
      tokenIntrospection: "blocked",
      tokenStorage: "none",
      refreshTokenStorage: "none",
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      version: 1,
    },
    modelVisible: false,
    version: 1,
  });
}

function buildInput(
  token: string | undefined,
  config: McpProductionStytchOAuthConfigV1 = buildConfig(),
) {
  return {
    kind: "mcp_production_stytch_oauth_config_boundary_input",
    authorizationHeader: token === undefined ? undefined : `Bearer ${token}`,
    config,
    now: FIXTURE_NOW,
    version: 1,
  } as const;
}

function buildConfig(
  overrides: Partial<McpProductionStytchOAuthConfigV1> = {},
): McpProductionStytchOAuthConfigV1 {
  return {
    kind: "mcp_production_stytch_oauth_config",
    provider: "stytch",
    issuer: FIXTURE_ISSUER,
    audience: FIXTURE_AUDIENCE,
    approvedClientIds: [FIXTURE_CLIENT_ID],
    requiredReadScopes: [...REQUIRED_READ_SCOPES],
    jwks: fixtureKeys.jwks,
    jwksSource: "server_only_config",
    serverOnly: true,
    tokenStorage: "none",
    version: 1,
    ...overrides,
  };
}

function signFixtureToken(options: SignFixtureTokenOptions = {}): string {
  const header =
    options.kid === ""
      ? { typ: "JWT" }
      : { typ: "JWT", kid: options.kid ?? FIXTURE_KEY_ID };

  return sign(buildFixturePayload(options), options.privateKey ?? fixtureKeys.privateKeyPem, {
    algorithm: options.algorithm ?? "RS256",
    header,
    noTimestamp: true,
  });
}

function buildFixturePayload(options: SignFixtureTokenOptions): JWTPayload & Record<string, unknown> {
  return {
    ...issuerClaim(options),
    ...audienceClaim(options),
    ...subjectClaim(options),
    ...clientIdClaim(options),
    azp: options.azp ?? options.clientId ?? FIXTURE_CLIENT_ID,
    scope: options.scope ?? REQUIRED_READ_SCOPES.join(" "),
    iat: FIXTURE_NOW_SECONDS,
    exp: options.exp ?? FIXTURE_NOW_SECONDS + 300,
    ...notBeforeClaim(options),
    ...(options.extraClaims ?? {}),
  };
}

function issuerClaim(options: SignFixtureTokenOptions): Record<string, string> {
  return options.includeIssuer === false ? {} : { iss: options.issuer ?? FIXTURE_ISSUER };
}

function audienceClaim(options: SignFixtureTokenOptions): Record<string, string | string[]> {
  return options.includeAudience === false ? {} : { aud: options.audience ?? FIXTURE_AUDIENCE };
}

function subjectClaim(options: SignFixtureTokenOptions): Record<string, string> {
  return options.includeSubject === false ? {} : { sub: FIXTURE_SUBJECT };
}

function clientIdClaim(options: SignFixtureTokenOptions): Record<string, string> {
  return options.includeClientId === false ? {} : { client_id: options.clientId ?? FIXTURE_CLIENT_ID };
}

function notBeforeClaim(options: SignFixtureTokenOptions): Record<string, number> {
  return options.nbf === undefined ? {} : { nbf: options.nbf };
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
    kid: FIXTURE_KEY_ID,
    alg: "RS256",
    use: "sig",
  };

  return {
    privateKeyPem: fixtureKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    wrongPrivateKeyPem: wrongKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    jwks: { keys: [jwk] },
  };
}
