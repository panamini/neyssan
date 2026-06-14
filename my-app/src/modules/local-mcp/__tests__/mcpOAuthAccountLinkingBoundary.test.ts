import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sign } from "jsonwebtoken";
import type { JWK, JWTPayload } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  verifyMcpOAuthAccountLinkingBoundary,
  type McpOAuthAccountLinkingBoundaryConfigV1,
  type McpOAuthAccountLinkingBoundaryDenialReasonV1,
} from "../mcpOAuthAccountLinkingBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATHS = [
  resolve(TEST_DIR, "../mcpOAuthAccountLinkingBoundary.ts"),
  resolve(TEST_DIR, "mcpOAuthAccountLinkingBoundary.test.ts"),
] as const;

const FIXTURE_NOW = new Date("2026-06-14T00:00:00.000Z");
const FIXTURE_NOW_SECONDS = Math.floor(FIXTURE_NOW.getTime() / 1000);
const FIXTURE_ISSUER = "https://twoweeks-test.stytch.com/v1/public/oauth";
const FIXTURE_AUDIENCE = "https://mcp.twoweeks.test";
const FIXTURE_CLIENT_ID = "chatgpt-fixture-client";
const FIXTURE_SUBJECT = "stytch-user-test-123";
const FIXTURE_KEY_ID = "stytch-fixture-key";

type FixtureKeys = Awaited<ReturnType<typeof buildFixtureKeys>>;
type SignFixtureTokenOptions = Readonly<{
  issuer?: string;
  audience?: string | string[];
  includeSubject?: boolean;
  scope?: string;
  clientId?: string;
  azp?: string;
  exp?: number;
  nbf?: number;
  privateKey?: FixtureKeys["privateKeyPem"];
}>;

let fixtureKeys: FixtureKeys;

beforeAll(async () => {
  fixtureKeys = await buildFixtureKeys();
});

describe("MCP OAuth account-linking verifier boundary", () => {
  it("accepts a Stytch-shaped fixture JWT as a server-only subject mapping contract", async () => {
    const token = await signFixtureToken();

    const result = await verifyMcpOAuthAccountLinkingBoundary({
      authorizationHeader: `Bearer ${token}`,
      config: buildFixtureConfig(),
      now: FIXTURE_NOW,
    });

    expect(result).toMatchObject({
      kind: "mcp_oauth_account_linking_boundary_result",
      allowed: true,
      provider: "stytch_connected_apps",
      serverOnly: {
        subject: FIXTURE_SUBJECT,
        clientId: FIXTURE_CLIENT_ID,
        issuer: FIXTURE_ISSUER,
        audience: FIXTURE_AUDIENCE,
        grantedScopes: ["twoweeks.application_package.read", "twoweeks.mcp.read"],
        subjectMapping: {
          kind: "verified_oauth_subject_to_twoweeks_user_ref_contract",
          provider: "stytch_connected_apps",
          providerSubject: FIXTURE_SUBJECT,
          twoweeksUserLookup: "deferred_until_real_data_pr",
        },
      },
      capabilities: {
        accountLinking: "verified_subject_contract_only",
        dataAccess: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        tokenStorage: "none",
        outboundIntrospection: "blocked",
        writeActions: "blocked",
      },
      modelVisible: false,
      version: 1,
    });
  });

  it("denies missing bearer token", async () => {
    await expectDenied(undefined, "missing_bearer_token");
  });

  it("denies malformed token", async () => {
    await expectDenied("Bearer not.a.jwt", "invalid_token");
  });

  it("denies malformed authorization header", async () => {
    await expectDenied("Bearer a.b.c=", "malformed_authorization_header");
  });

  it("denies Basic token", async () => {
    await expectDenied("Basic username-password", "unsupported_authorization_scheme");
  });

  it("denies bad signature", async () => {
    const token = await signFixtureToken({ privateKey: fixtureKeys.wrongPrivateKeyPem });
    await expectDenied(`Bearer ${token}`, "invalid_token");
  });

  it("denies expired token", async () => {
    const token = await signFixtureToken({ exp: FIXTURE_NOW_SECONDS - 60 });
    await expectDenied(`Bearer ${token}`, "invalid_token");
  });

  it("accepts a just-expired token within configured clock tolerance", async () => {
    const token = await signFixtureToken({ exp: FIXTURE_NOW_SECONDS - 10 });

    const result = await verifyMcpOAuthAccountLinkingBoundary({
      authorizationHeader: `Bearer ${token}`,
      config: buildFixtureConfig({ clockToleranceSeconds: 30 }),
      now: FIXTURE_NOW,
    });

    expect(result.allowed).toBe(true);
  });

  it("denies nbf token", async () => {
    const token = await signFixtureToken({ nbf: FIXTURE_NOW_SECONDS + 60 });
    await expectDenied(`Bearer ${token}`, "invalid_token");
  });

  it("denies wrong issuer", async () => {
    const token = await signFixtureToken({ issuer: "https://wrong-issuer.example.test" });
    await expectDenied(`Bearer ${token}`, "invalid_token");
  });

  it("denies wrong audience/resource", async () => {
    const token = await signFixtureToken({ audience: "https://wrong-resource.example.test" });
    await expectDenied(`Bearer ${token}`, "invalid_token");
  });

  it("denies missing subject", async () => {
    const token = await signFixtureToken({ includeSubject: false });
    await expectDenied(`Bearer ${token}`, "missing_subject");
  });

  it("denies missing scope", async () => {
    const token = await signFixtureToken({ scope: "openid profile" });
    await expectDenied(`Bearer ${token}`, "missing_required_scope");
  });

  it("denies scope substring attacks", async () => {
    const token = await signFixtureToken({ scope: "openid twoweeks.mcp.readonly twoweeks.mcp.read_extra" });
    await expectDenied(`Bearer ${token}`, "missing_required_scope");
  });

  it("filters unsafe granted scope strings from accepted server-only output", async () => {
    const token = await signFixtureToken({
      scope: "twoweeks.mcp.read convex.internal.admin javascript:alert(1)",
    });

    const result = await verifyMcpOAuthAccountLinkingBoundary({
      authorizationHeader: `Bearer ${token}`,
      config: buildFixtureConfig(),
      now: FIXTURE_NOW,
    });

    expect(result).toMatchObject({
      allowed: true,
      serverOnly: {
        grantedScopes: ["twoweeks.mcp.read"],
      },
    });
  });

  it("denies wrong client_id/azp", async () => {
    const token = await signFixtureToken({ clientId: "claude-fixture-client", azp: "claude-fixture-client" });
    await expectDenied(`Bearer ${token}`, "unauthorized_client");
  });

  it("denies tokens when only azp matches the allowed client", async () => {
    const token = await signFixtureToken({ clientId: "blocked-client", azp: FIXTURE_CLIENT_ID });
    await expectDenied(`Bearer ${token}`, "unauthorized_client");
  });

  it("denies empty algorithm allowlist as invalid configuration", async () => {
    const token = await signFixtureToken();
    await expectDenied(`Bearer ${token}`, "invalid_configuration", buildFixtureConfig({ allowedAlgorithms: [] }));
  });

  it("denies empty JWKS as invalid configuration", async () => {
    const token = await signFixtureToken();
    await expectDenied(`Bearer ${token}`, "invalid_configuration", buildFixtureConfig({ jwks: { keys: [] } }));
  });

  it("never echoes token material in output or console logs", async () => {
    const token = await signFixtureToken({ scope: "openid profile" });
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];

    try {
      spies.forEach((spy) => spy.mockImplementation(() => undefined));

      const result = await verifyMcpOAuthAccountLinkingBoundary({
        authorizationHeader: `Bearer ${token}`,
        config: buildFixtureConfig(),
        now: FIXTURE_NOW,
      });

      expect(result.allowed).toBe(false);
      expect(JSON.stringify(result)).not.toContain(token);
      spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it("never echoes token claims or user identifiers in denial output", async () => {
    const token = await signFixtureToken({
      scope: "openid profile email",
      clientId: "blocked-client-id",
      azp: "blocked-client-id",
    });

    const result = await verifyMcpOAuthAccountLinkingBoundary({
      authorizationHeader: `Bearer ${token}`,
      config: buildFixtureConfig(),
      now: FIXTURE_NOW,
    });
    const serialized = JSON.stringify(result);

    expect(result.allowed).toBe(false);
    for (const forbidden of [
      token,
      FIXTURE_SUBJECT,
      "blocked-client-id",
      FIXTURE_ISSUER,
      FIXTURE_AUDIENCE,
      "openid",
      "profile",
      "email",
    ] as const) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("does not import Convex, data, http, handler, or runtime surfaces", () => {
    const forbiddenImportPattern = /(?:convex|database|(?:^|[/_-])db(?:[/_-]|$)|node:https?|fetch|handler|runtime)/iu;

    for (const path of SOURCE_PATHS) {
      const source = readFileSync(path, "utf8");
      const importSpecifiers = [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map(
        (match) => match[1],
      );

      for (const specifier of importSpecifiers) {
        expect(specifier, `${path} imports ${specifier}`).not.toMatch(forbiddenImportPattern);
      }

      expect(source, `${path} must not call fetch`).not.toMatch(/\bfetch\s*\(/u);
    }

    const boundarySource = readFileSync(SOURCE_PATHS[0], "utf8");
    expect(boundarySource, "boundary must not log token material").not.toMatch(/\bconsole\.(?:log|info|warn|error)\s*\(/u);
  });
});

async function expectDenied(
  authorizationHeader: string | undefined,
  reason: McpOAuthAccountLinkingBoundaryDenialReasonV1,
  config: McpOAuthAccountLinkingBoundaryConfigV1 = buildFixtureConfig(),
): Promise<void> {
  const result = await verifyMcpOAuthAccountLinkingBoundary({
    authorizationHeader,
    config,
    now: FIXTURE_NOW,
  });

  expect(result).toEqual({
    kind: "mcp_oauth_account_linking_boundary_result",
    allowed: false,
    reason,
    safeRefusal: {
      code: "auth_required",
      message: "Authorization required.",
      safeForModel: true,
      tokenEchoed: false,
      version: 1,
    },
    capabilities: {
      accountLinking: "blocked",
      dataAccess: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      tokenStorage: "none",
      outboundIntrospection: "blocked",
      writeActions: "blocked",
      version: 1,
    },
    version: 1,
  });
}

function buildFixtureConfig(
  overrides: Partial<McpOAuthAccountLinkingBoundaryConfigV1> = {},
): McpOAuthAccountLinkingBoundaryConfigV1 {
  return {
    provider: "stytch_connected_apps",
    issuer: FIXTURE_ISSUER,
    audience: FIXTURE_AUDIENCE,
    requiredScopes: ["twoweeks.mcp.read"],
    allowedClientIds: [FIXTURE_CLIENT_ID],
    jwks: fixtureKeys.jwks,
    allowedAlgorithms: ["RS256"],
    clockToleranceSeconds: 0,
    ...overrides,
  };
}

async function signFixtureToken(options: SignFixtureTokenOptions = {}): Promise<string> {
  return sign(buildFixturePayload(options), options.privateKey ?? fixtureKeys.privateKeyPem, {
    algorithm: "RS256",
    keyid: FIXTURE_KEY_ID,
    header: { typ: "JWT" },
    noTimestamp: true,
  });
}

function buildFixturePayload(options: SignFixtureTokenOptions): JWTPayload & Record<string, unknown> {
  return {
    iss: options.issuer ?? FIXTURE_ISSUER,
    aud: options.audience ?? FIXTURE_AUDIENCE,
    iat: FIXTURE_NOW_SECONDS,
    exp: options.exp ?? FIXTURE_NOW_SECONDS + 300,
    scope: options.scope ?? "twoweeks.mcp.read twoweeks.application_package.read",
    client_id: options.clientId ?? FIXTURE_CLIENT_ID,
    azp: options.azp ?? FIXTURE_CLIENT_ID,
    ...subjectClaim(options),
    ...notBeforeClaim(options),
  };
}

function subjectClaim(options: SignFixtureTokenOptions): Record<string, string> {
  return options.includeSubject === false ? {} : { sub: FIXTURE_SUBJECT };
}

function notBeforeClaim(options: SignFixtureTokenOptions): Record<string, number> {
  return options.nbf === undefined ? {} : { nbf: options.nbf };
}

function buildFixtureKeys() {
  const fixtureKeyPair = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
  const wrongKeyPair = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
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
