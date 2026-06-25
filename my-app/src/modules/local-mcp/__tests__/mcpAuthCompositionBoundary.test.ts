import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sign, type Algorithm } from "jsonwebtoken";
import type { JWK, JSONWebKeySet, JWTPayload } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  buildLocalMcpDevAuthConfig,
  type LocalMcpDevAuthConfigInputV1,
  type LocalMcpDevAuthConfigV1,
} from "../localMcpDevAuthConfig";
import {
  buildLocalMcpDevEndpointConfig,
  handleLocalMcpDevEndpointRequest,
  handleLocalMcpDevEndpointRequestAsync,
  type LocalMcpDevEndpointRequestV1,
} from "../localMcpDevEndpoint";
import {
  buildMcpAuthCompositionDependencies,
  type McpAuthCompositionBoundaryConfigV1,
  type McpAuthCompositionFailureReasonV1,
} from "../mcpAuthCompositionBoundary";
import type { McpConvexAccountLinkLookupRunQueryV1 } from "../mcpConvexAccountLinkLookupAdapter";
import {
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthPolicyAccountLinkRecordV1,
} from "../mcpAuthPolicyBoundary";
import type { StytchMcpBearerVerifierConfigV1 } from "../mcpStytchBearerVerifierBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpAuthCompositionBoundary.ts");
const ISSUER = "https://connected-apps.stytch.example.test/oauth";
const AUDIENCE = "https://mcp.example.test/mcp";
const METADATA_URL = "https://mcp.example.test/.well-known/oauth-protected-resource/mcp";
const CLIENT_ID = "chatgpt-apps-sdk-client";
const OTHER_CLIENT_ID = "other-chatgpt-client";
const SUBJECT = "stytch_subject_example_123";
const ENVIRONMENT = "stytch-test-environment";
const CLERK_OWNER = "clerk_owner_example_123";
const KEY_ID = "composition-boundary-key-1";
const NOW_SECONDS = 1_800_000_000;
const FAR_FUTURE_EXP = 4_102_444_800;
const QUERY_REF = Object.freeze({ name: "mcpAccountLinks.internalLookupMcpAuthPolicyAccountLinkCandidates" });
const FIXTURE_TOOL_CALL = Object.freeze({
  name: "twoweeks.application_package.summarize",
  arguments: Object.freeze({ applicationPackageRef: Object.freeze({ id: "fixture-application-package" }) }),
  localToolId: "local_mcp.application_package.summarize",
});

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
  exp?: number;
  nbf?: number;
  algorithm?: Algorithm;
  kid?: string;
  privateKey?: string;
  includeProviderEnvironment?: boolean;
  providerEnvironment?: string;
}>;

let fixtureKeys: FixtureKeys;

beforeAll(() => {
  fixtureKeys = buildFixtureKeys();
});

describe("MCP auth composition config validation", () => {
  it("builds explicit local-only dependencies with stable metadata", () => {
    const result = buildMcpAuthCompositionDependencies(buildCompositionConfig());

    expect(result).toMatchObject({
      kind: "mcp_auth_composition_dependencies_result",
      configured: true,
      metadata: {
        kind: "mcp_auth_composition_metadata",
        localDevOnly: true,
        nonProductionOnly: true,
        network: "none",
        productionRuntime: "none",
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        version: 1,
      },
      version: 1,
    });
    expect(result.configured).toBe(true);
    if (result.configured) {
      expect(typeof result.tokenVerifier).toBe("function");
      expect(typeof result.accountLinkLookup).toBe("function");
      expect(Object.isFrozen(result.metadata)).toBe(true);
    }
    expect(JSON.stringify(result.metadata)).not.toContain(SUBJECT);
    expect(JSON.stringify(result.metadata)).not.toContain(CLERK_OWNER);
    expect(JSON.stringify(result.metadata)).not.toContain("keys");
  });

  it.each([
    ["extra top-level key", () => ({ extra: true }), "malformed_config"],
    ["HTTP issuer", () => ({ authorizationServerIssuerUrl: "http://connected-apps.stytch.example.test/oauth" }), "issuer_mismatch"],
    ["HTTP audience/resource", () => ({ canonicalResourceAudience: "http://mcp.example.test/mcp" }), "resource_mismatch"],
    ["remote JWKS URL", () => ({ stytchVerifierConfig: buildStytchConfig({ jwks: "https://stytch.example.test/jwks.json" as unknown as JSONWebKeySet }) }), "verifier_config_mismatch"],
    ["missing provider environment", () => ({ providerEnvironment: "" }), "environment_mismatch"],
    ["missing client IDs", () => ({ approvedClientIds: [] }), "allowed_client_mismatch"],
    ["old dotted scope", () => ({ requiredScope: "twoweeks.mcp.read" }), "scope_mismatch"],
    ["write scope", () => ({ requiredScope: "twoweeks:applications:write" }), "scope_mismatch"],
  ] as const)("fails closed for malformed config: %s", (_label, overrides, reason) => {
    const result = buildMcpAuthCompositionDependencies(
      buildCompositionConfig(overrides() as Partial<McpAuthCompositionBoundaryConfigV1>),
    );

    expectFailure(result, reason);
  });
});

describe("MCP auth composition cross-component consistency", () => {
  it.each([
    ["issuer mismatch", () => ({ stytchVerifierConfig: buildStytchConfig({ issuer: "https://other-issuer.example.test/oauth" }) }), "issuer_mismatch"],
    ["audience mismatch", () => ({ stytchVerifierConfig: buildStytchConfig({ audience: "https://other-mcp.example.test/mcp" }) }), "audience_mismatch"],
    ["resource mismatch", () => ({ localDevAuthConfig: buildLocalAuthConfig({ resourceUrl: "https://other-mcp.example.test/mcp" }) }), "resource_mismatch"],
    ["environment mismatch", () => ({ stytchVerifierConfig: buildStytchConfig({ providerEnvironment: "other-env" }) }), "environment_mismatch"],
    ["allowed-client mismatch", () => ({ stytchVerifierConfig: buildStytchConfig({ approvedClientIds: [OTHER_CLIENT_ID] }) }), "allowed_client_mismatch"],
    ["scope mismatch", () => ({ stytchVerifierConfig: buildStytchConfig({ requiredScope: "twoweeks.mcp.read" as typeof TWOWEEKS_APPLICATIONS_READ_SCOPE }) }), "scope_mismatch"],
    ["verifier config mismatch", () => ({ stytchVerifierConfig: { ...buildStytchConfig(), tokenStorage: "local" } as StytchMcpBearerVerifierConfigV1 }), "verifier_config_mismatch"],
    ["endpoint auth config mismatch", () => ({ localDevAuthConfig: { ...buildLocalAuthConfig(), fixtureOnly: false } as LocalMcpDevAuthConfigV1 }), "endpoint_auth_config_mismatch"],
  ] as const)("rejects %s without fallback", (_label, overrides, reason) => {
    const result = buildMcpAuthCompositionDependencies(
      buildCompositionConfig(overrides() as Partial<McpAuthCompositionBoundaryConfigV1>),
    );

    expectFailure(result, reason);
  });
});

describe("MCP auth composition end-to-end local fixture chain", () => {
  it("verifies a synthetic token, runs the lookup adapter, resolves the account link, and invokes the fixture once", async () => {
    const token = signFixtureToken();
    const runQuery = vi.fn(async () => [accountLink()]);
    const result = buildMcpAuthCompositionDependencies(buildCompositionConfig({ runQuery }));
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected configured composition");

    const onFixtureHandlerInvoke = vi.fn();
    const response = await handleLocalMcpDevEndpointRequestAsync(
      request({
        headers: authHeaders(`Bearer ${token}`),
        bodyText: toolsCallBody("authorized"),
      }),
      endpointConfig(),
      {
        tokenVerifier: result.tokenVerifier,
        accountLinkLookup: result.accountLinkLookup,
        nowEpochSeconds: () => NOW_SECONDS,
        onFixtureHandlerInvoke,
      },
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        jsonrpc: "2.0",
        id: "authorized",
        result: {
          content: [
            {
              type: "text",
              text: `Fixture-only tools/call accepted for ${FIXTURE_TOOL_CALL.localToolId}. No product action executed.`,
            },
          ],
          structuredContent: {
            kind: "local_mcp_dry_run",
            input: FIXTURE_TOOL_CALL.arguments,
            version: 1,
          },
        },
      },
    });
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith(QUERY_REF, {
      issuer: ISSUER,
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
    expect(onFixtureHandlerInvoke).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain(token);
    expect(JSON.stringify(response)).not.toContain(SUBJECT);
    expect(JSON.stringify(response)).not.toContain(CLERK_OWNER);
  });

  it("challenges missing tokens without calling verifier, lookup, or fixture handler", async () => {
    const runQuery = vi.fn(async () => [accountLink()]);
    const result = buildMcpAuthCompositionDependencies(buildCompositionConfig({ runQuery }));
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected configured composition");
    const onFixtureHandlerInvoke = vi.fn();

    const response = await handleLocalMcpDevEndpointRequestAsync(
      request({ headers: unauthenticatedHeaders(), bodyText: toolsCallBody("missing") }),
      endpointConfig(),
      {
        tokenVerifier: result.tokenVerifier,
        accountLinkLookup: result.accountLinkLookup,
        nowEpochSeconds: () => NOW_SECONDS,
        onFixtureHandlerInvoke,
      },
    );

    expectAuthError(response, "missing");
    expect(JSON.stringify(response)).toContain(METADATA_URL);
    expect(JSON.stringify(response)).toContain(TWOWEEKS_APPLICATIONS_READ_SCOPE);
    expect(runQuery).not.toHaveBeenCalled();
    expect(onFixtureHandlerInvoke).not.toHaveBeenCalled();
  });

  it("rejects invalid signatures before lookup and without echoing raw tokens", async () => {
    const rawToken = signFixtureToken({ privateKey: fixtureKeys.wrongPrivateKeyPem });
    const runQuery = vi.fn(async () => [accountLink()]);
    const result = configuredComposition({ runQuery });
    const onFixtureHandlerInvoke = vi.fn();

    const response = await handleLocalMcpDevEndpointRequestAsync(
      request({ headers: authHeaders(`Bearer ${rawToken}`), bodyText: toolsCallBody("invalid") }),
      endpointConfig(),
      {
        tokenVerifier: result.tokenVerifier,
        accountLinkLookup: result.accountLinkLookup,
        nowEpochSeconds: () => NOW_SECONDS,
        onFixtureHandlerInvoke,
      },
    );

    expectAuthError(response, "invalid");
    expect(runQuery).not.toHaveBeenCalled();
    expect(onFixtureHandlerInvoke).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(rawToken);
  });

  it("rejects missing canonical scope before lookup and advertises the canonical scope", async () => {
    const runQuery = vi.fn(async () => [accountLink()]);
    const result = configuredComposition({ runQuery });
    const onFixtureHandlerInvoke = vi.fn();

    const response = await handleLocalMcpDevEndpointRequestAsync(
      request({
        headers: authHeaders(`Bearer ${signFixtureToken({ scope: "openid profile" })}`),
        bodyText: toolsCallBody("scope"),
      }),
      endpointConfig(),
      {
        tokenVerifier: result.tokenVerifier,
        accountLinkLookup: result.accountLinkLookup,
        nowEpochSeconds: () => NOW_SECONDS,
        onFixtureHandlerInvoke,
      },
    );

    expectAuthError(response, "scope");
    expect(JSON.stringify(response)).toContain("insufficient_scope");
    expect(JSON.stringify(response)).toContain(TWOWEEKS_APPLICATIONS_READ_SCOPE);
    expect(JSON.stringify(response)).not.toContain("twoweeks.mcp.read");
    expect(runQuery).not.toHaveBeenCalled();
    expect(onFixtureHandlerInvoke).not.toHaveBeenCalled();
  });
});

describe("MCP auth composition account-link outcomes", () => {
  it.each([
    ["zero candidates", [], "missing_account_link"],
    ["duplicate candidates", [accountLink(), accountLink({ twoweeksClerkId: "clerk_owner_other" })], "duplicate_account_link"],
    ["different client IDs", [accountLink({ clientId: OTHER_CLIENT_ID })], "disallowed_client"],
    ["revoked candidate", [accountLink({ state: "revoked" })], "revoked_account_link"],
    ["stale candidate", [accountLink({ state: "stale" })], "stale_account_link"],
    ["expired candidate", [accountLink({ expiresAtEpochSeconds: NOW_SECONDS })], "expired_account_link"],
    ["wrong client", [accountLink({ clientId: "blocked-client" })], "disallowed_client"],
    ["missing canonical scope", [accountLink({ grantedScopes: [] })], "missing_required_scope"],
    ["malformed lookup result", [{ kind: "not_an_account_link", subject: SUBJECT }], "malformed_account_link"],
    ["candidate-limit exceeded marker", [{ kind: "mcp_auth_policy_account_link_lookup_malformed_candidate", reason: "candidate_overflow", version: 1 }], "malformed_account_link"],
  ] as const)("denies %s without invoking the fixture handler", async (_label, queryResult, expectedReason) => {
    const response = await callComposedEndpoint({
      token: signFixtureToken(),
      runQuery: vi.fn(async () => queryResult),
      id: expectedReason,
    });

    expectAuthError(response, expectedReason);
    expect(JSON.stringify(response)).not.toContain(SUBJECT);
    expect(JSON.stringify(response)).not.toContain(CLERK_OWNER);
    expect(JSON.stringify(response)).not.toContain("mcp_auth_policy_account_link_record");
  });

  it("maps query executor exceptions to deterministic safe denials", async () => {
    const runQuery = vi.fn(async () => {
      throw new Error(`synthetic query failure for ${SUBJECT}`);
    });

    const response = await callComposedEndpoint({
      token: signFixtureToken(),
      runQuery,
      id: "query_throws",
    });

    expectAuthError(response, "query_throws");
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain(SUBJECT);
    expect(JSON.stringify(response)).not.toContain("synthetic query failure");
  });
});

describe("MCP auth composition preserves existing endpoint modes", () => {
  it("keeps endpoint defaults disabled and fixture-only non-auth mode unchanged", async () => {
    const disabled = handleLocalMcpDevEndpointRequest(request());
    const fixtureOnly = await handleLocalMcpDevEndpointRequestAsync(
      request({ bodyText: toolsCallBody("fixture_only") }),
      buildLocalMcpDevEndpointConfig({ enabled: true, fixtureDemoEnabled: true }),
    );

    expect(disabled).toMatchObject({ handled: false, status: 404 });
    expect(fixtureOnly).toMatchObject({
      handled: true,
      status: 200,
      json: {
        id: "fixture_only",
        result: {
          content: [
            {
              type: "text",
              text: `Fixture-only tools/call accepted for ${FIXTURE_TOOL_CALL.localToolId}. No product action executed.`,
            },
          ],
        },
      },
    });
  });
});

describe("MCP auth composition static safety", () => {
  it("does not import or call forbidden runtime surfaces", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const importSpecifiers = [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map(
      (match) => match[1],
    );

    for (const specifier of importSpecifiers) {
      expect(specifier).not.toMatch(/(?:convex\/_generated|vite|react|@stytch|node:http|node:https|openai|langchain)/iu);
    }
    expect(source).not.toMatch(/\bfetch\s*\(|\baxios\b|\bXMLHttpRequest\b/u);
    expect(source).not.toMatch(/\bprocess\.env\b|\breadFileSync\b|\bwriteFileSync\b/u);
    expect(source).not.toMatch(/\bconsole\.(?:log|info|warn|error)\s*\(/u);
    expect(source).not.toMatch(/\bcreateServer\s*\(|\bapp\.(?:get|post|use)\s*\(|\brouter\.(?:get|post|use)\s*\(/u);
    expect(source).not.toMatch(/\bjwks_uri\b|\bjwksUrl\b|\btokenEndpoint\b|\bintrospect/u);
    expect(source).not.toMatch(/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/u);
    expect(source).not.toMatch(/tools\/list|tools\/call|download|send|submit|apply/u);
    expect(source).not.toMatch(/https:\/\/(?:www\.)?twoweeks(?:\.ai|\.com)|https:\/\/mcp\.twoweeks/iu);
  });
});

function expectFailure(
  result: ReturnType<typeof buildMcpAuthCompositionDependencies>,
  reason: McpAuthCompositionFailureReasonV1,
): void {
  expect(result).toMatchObject({
    kind: "mcp_auth_composition_dependencies_result",
    configured: false,
    reason,
    metadata: {
      localDevOnly: true,
      nonProductionOnly: true,
      network: "none",
      productionRuntime: "none",
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      version: 1,
    },
    version: 1,
  });
  expect(result).not.toHaveProperty("tokenVerifier");
  expect(result).not.toHaveProperty("accountLinkLookup");
}

function configuredComposition(
  overrides: Partial<McpAuthCompositionBoundaryConfigV1> & { runQuery?: McpConvexAccountLinkLookupRunQueryV1 } = {},
): Extract<ReturnType<typeof buildMcpAuthCompositionDependencies>, { configured: true }> {
  const result = buildMcpAuthCompositionDependencies(buildCompositionConfig(overrides));
  expect(result.configured).toBe(true);
  if (!result.configured) throw new Error(`expected configured composition, got ${result.reason}`);
  return result;
}

async function callComposedEndpoint(options: Readonly<{
  token: string;
  runQuery: McpConvexAccountLinkLookupRunQueryV1;
  id: string;
}>) {
  const result = configuredComposition({ runQuery: options.runQuery });
  const onFixtureHandlerInvoke = vi.fn();
  const response = await handleLocalMcpDevEndpointRequestAsync(
    request({
      headers: authHeaders(`Bearer ${options.token}`),
      bodyText: toolsCallBody(options.id),
    }),
    endpointConfig(),
    {
      tokenVerifier: result.tokenVerifier,
      accountLinkLookup: result.accountLinkLookup,
      nowEpochSeconds: () => NOW_SECONDS,
      onFixtureHandlerInvoke,
    },
  );

  expect(onFixtureHandlerInvoke).not.toHaveBeenCalled();
  return response;
}

function expectAuthError(response: unknown, id: string): void {
  expect(response).toMatchObject({
    handled: true,
    status: 200,
    json: {
      jsonrpc: "2.0",
      id,
      result: {
        isError: true,
        content: expect.any(Array),
      },
    },
  });
}

function buildCompositionConfig(
  overrides: Partial<McpAuthCompositionBoundaryConfigV1> & { runQuery?: McpConvexAccountLinkLookupRunQueryV1 } = {},
): McpAuthCompositionBoundaryConfigV1 {
  const { runQuery, ...configOverrides } = overrides;
  return {
    kind: "mcp_auth_composition_boundary_config",
    localDevAuthConfig: buildLocalAuthConfig(),
    stytchVerifierConfig: buildStytchConfig(),
    canonicalResourceAudience: AUDIENCE,
    authorizationServerIssuerUrl: ISSUER,
    providerEnvironment: ENVIRONMENT,
    approvedClientIds: [CLIENT_ID],
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    accountLinkLookupAdapterConfig: {
      kind: "mcp_convex_account_link_lookup_adapter_config",
      queryRef: QUERY_REF,
      runQuery: runQuery ?? vi.fn(async () => [accountLink()]),
      serverOnly: true,
      version: 1,
    },
    localDevOnly: true,
    nonProductionOnly: true,
    version: 1,
    ...configOverrides,
  } as McpAuthCompositionBoundaryConfigV1;
}

function buildLocalAuthConfig(
  overrides: LocalMcpDevAuthConfigInputV1 = {},
): LocalMcpDevAuthConfigV1 {
  const config = buildLocalMcpDevAuthConfig({
    enabled: true,
    resourceUrl: AUDIENCE,
    authorizationServerIssuerUrl: ISSUER,
    providerEnvironment: ENVIRONMENT,
    allowedClientIds: [CLIENT_ID],
    ...overrides,
  });
  if (!config) throw new Error("expected valid local MCP dev auth config");
  return config;
}

function buildStytchConfig(
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

function endpointConfig() {
  return buildLocalMcpDevEndpointConfig({
    enabled: true,
    fixtureDemoEnabled: true,
    authPolicyEnabled: true,
    auth: {
      resourceUrl: AUDIENCE,
      authorizationServerIssuerUrl: ISSUER,
      providerEnvironment: ENVIRONMENT,
      allowedClientIds: [CLIENT_ID],
    },
  });
}

function request(overrides: Partial<LocalMcpDevEndpointRequestV1> = {}) {
  return {
    method: "POST",
    path: "/mcp",
    headers: {
      host: "localhost:5173",
      "content-type": "application/json",
    },
    remoteAddress: "127.0.0.1",
    bodyText: JSON.stringify({ jsonrpc: "2.0", id: "request_1", method: "initialize" }),
    ...overrides,
  };
}

function toolsCallBody(id: string): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name: FIXTURE_TOOL_CALL.name,
      arguments: FIXTURE_TOOL_CALL.arguments,
    },
  });
}

function authHeaders(authorization: string | readonly string[]) {
  return {
    host: "localhost:5173",
    "content-type": "application/json",
    authorization,
  };
}

function unauthenticatedHeaders() {
  return {
    host: "localhost:5173",
    "content-type": "application/json",
  };
}

function accountLink(
  overrides: Partial<McpAuthPolicyAccountLinkRecordV1> = {},
): McpAuthPolicyAccountLinkRecordV1 {
  return {
    kind: "mcp_auth_policy_account_link_record",
    issuer: ISSUER,
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
    iss: options.issuer ?? ISSUER,
    ...(options.includeAudience === false ? {} : { aud: options.audience ?? AUDIENCE }),
    ...(options.resource === undefined ? {} : { resource: options.resource }),
    ...(options.includeSubject === false ? {} : { sub: SUBJECT }),
    ...(options.includeClientId === false ? {} : { client_id: options.clientId ?? CLIENT_ID }),
    azp: options.azp ?? options.clientId ?? CLIENT_ID,
    scope: options.scope ?? TWOWEEKS_APPLICATIONS_READ_SCOPE,
    ...(options.includeProviderEnvironment === false ? {} : { provider_environment: options.providerEnvironment ?? ENVIRONMENT }),
    iat: NOW_SECONDS,
    exp: options.exp ?? FAR_FUTURE_EXP,
    ...(options.nbf === undefined ? {} : { nbf: options.nbf }),
  };
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
