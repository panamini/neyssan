// @vitest-environment node
import { generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";
import { sign, type Algorithm } from "jsonwebtoken";
import type { JWK, JSONWebKeySet, JWTPayload } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import {
  createLocalMcpDevEndpointPlugin,
  type LocalMcpDevEndpointPluginOptions,
} from "../../../../vite.config";
import { buildMcpAuthCompositionDependencies } from "../mcpAuthCompositionBoundary";
import type { McpConvexAccountLinkLookupRunQueryV1 } from "../mcpConvexAccountLinkLookupAdapter";
import {
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthPolicyAccountLinkRecordV1,
} from "../mcpAuthPolicyBoundary";

const RESOURCE = "https://mcp.example.test/mcp";
const ISSUER = "https://connected-apps.stytch.example.test/oauth";
const METADATA_URL = "https://mcp.example.test/.well-known/oauth-protected-resource/mcp";
const PROVIDER_ENVIRONMENT = "stytch-test-environment";
const CLIENT_ID = "chatgpt-apps-sdk-client";
const SUBJECT = "stytch_subject_example_123";
const CLERK_OWNER = "clerk_owner_example_123";
const KEY_ID = "vite-runtime-key";
const NOW_SECONDS = 1_800_000_000;
const FAR_FUTURE_EXP = 4_102_444_800;
const QUERY_REF = Object.freeze({ name: "mcpAccountLinks.internalLookupMcpAuthPolicyAccountLinkCandidates" });
const FIXTURE_TOOL = Object.freeze({
  name: "twoweeks.application_package.summarize",
  arguments: Object.freeze({ applicationPackageRef: Object.freeze({ id: "fixture-application-package" }) }),
  localToolId: "local_mcp.application_package.summarize",
});

type FixtureKeys = ReturnType<typeof buildFixtureKeys>;

let fixtureKeys: FixtureKeys;
let servers: ViteDevServer[] = [];

beforeAll(() => {
  fixtureKeys = buildFixtureKeys();
});

afterEach(async () => {
  await Promise.all(servers.map((server) => server.close()));
  servers = [];
});

describe("Vite local MCP composed auth runtime", () => {
  it("serves metadata and OAuth security schemes without exposing token material", async () => {
    const baseUrl = await startServer();

    const metadata = await getJson(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    expect(metadata).toEqual({
      resource: RESOURCE,
      authorization_servers: [ISSUER],
      scopes_supported: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    });

    const toolsList = await postJson(baseUrl, jsonRpc("tools/list", "tools"));
    expect(toolsList.status).toBe(200);
    expect(toolsList.json).toMatchObject({
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({
            name: FIXTURE_TOOL.name,
            securitySchemes: [{ type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] }],
            _meta: {
              securitySchemes: [{ type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] }],
            },
          }),
        ]),
      },
    });
    expect(JSON.stringify(toolsList.json)).not.toContain(SUBJECT);
    expect(JSON.stringify(toolsList.json)).not.toContain(KEY_ID);
  });

  it.each([
    ["missing token", undefined, "Access token required."],
    ["malformed token", "Bearer not-a-jwt", "invalid_token"],
    ["wrong signature", () => `Bearer ${signFixtureToken({ privateKey: fixtureKeys.wrongPrivateKeyPem })}`, "invalid_token"],
    ["unknown kid", () => `Bearer ${signFixtureToken({ kid: "unknown-kid" })}`, "invalid_token"],
    ["missing scope", () => `Bearer ${signFixtureToken({ scope: "openid" })}`, "insufficient_scope"],
    ["wrong issuer", () => `Bearer ${signFixtureToken({ issuer: "https://other.example.test/oauth" })}`, "invalid_token"],
    ["wrong resource", () => `Bearer ${signFixtureToken({ audience: "https://other.example.test/mcp" })}`, "invalid_token"],
    ["wrong client", () => `Bearer ${signFixtureToken({ clientId: "other-client" })}`, "invalid_token"],
    ["wrong environment", () => `Bearer ${signFixtureToken({ providerEnvironment: "other-env" })}`, "invalid_token"],
    ["expired", () => `Bearer ${signFixtureToken({ exp: NOW_SECONDS - 60 })}`, "invalid_token"],
    ["future nbf", () => `Bearer ${signFixtureToken({ nbf: FAR_FUTURE_EXP })}`, "invalid_token"],
    ["legacy dotted scope", () => `Bearer ${signFixtureToken({ scope: "twoweeks.mcp.read" })}`, "insufficient_scope"],
    ["mixed canonical legacy scope", () => `Bearer ${signFixtureToken({ scope: `${TWOWEEKS_APPLICATIONS_READ_SCOPE} twoweeks.mcp.read` })}`, "insufficient_scope"],
  ] as const)("denies %s over real Vite HTTP", async (_label, authorization, expectedReason) => {
    const baseUrl = await startServer();
    const headerValue = typeof authorization === "function" ? authorization() : authorization;
    const response = await postJson(baseUrl, toolsCallBody("denied"), headerValue);

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      id: "denied",
      result: {
        isError: true,
      },
    });
    expect(JSON.stringify(response.json)).toContain(expectedReason);
    expect(JSON.stringify(response.json)).not.toContain(SUBJECT);
    expect(JSON.stringify(response.json)).not.toContain(CLERK_OWNER);
    if (headerValue) expect(JSON.stringify(response.json)).not.toContain(headerValue.replace(/^Bearer /u, ""));
  });

  it("valid signed token reaches account-link-required with runtime no-link lookup", async () => {
    const baseUrl = await startServer();
    const token = signFixtureToken();
    const response = await postJson(baseUrl, toolsCallBody("no_link"), `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      id: "no_link",
      result: {
        content: [{ type: "text", text: "Authentication required." }],
        isError: true,
        _meta: {
          "mcp/www_authenticate": [expect.stringContaining("Account link required.")],
        },
      },
    });
    expect(JSON.stringify(response.json)).toContain(METADATA_URL);
    expect(JSON.stringify(response.json)).not.toContain(token);
    expect(JSON.stringify(response.json)).not.toContain(SUBJECT);
    expect(JSON.stringify(response.json)).not.toContain(CLERK_OWNER);
  });

  it("allows full success only through direct plugin-factory dependency injection", async () => {
    const runQuery = vi.fn(async () => [accountLink()]);
    const composition = buildMcpAuthCompositionDependencies(buildCompositionConfig({ runQuery }));
    expect(composition.configured).toBe(true);
    if (!composition.configured) throw new Error("expected configured composition");

    const onFixtureHandlerInvoke = vi.fn();
    const baseUrl = await startServer({
      endpointDependencies: {
        tokenVerifier: composition.tokenVerifier,
        accountLinkLookup: composition.accountLinkLookup,
        nowEpochSeconds: () => NOW_SECONDS,
        onFixtureHandlerInvoke,
      },
    });
    const token = signFixtureToken();
    const response = await postJson(baseUrl, toolsCallBody("authorized"), `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      id: "authorized",
      result: {
        content: [
          {
            type: "text",
            text: `Fixture-only tools/call accepted for ${FIXTURE_TOOL.localToolId}. No product action executed.`,
          },
        ],
        structuredContent: {
          kind: "local_mcp_dry_run",
          input: FIXTURE_TOOL.arguments,
          version: 1,
        },
      },
    });
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(onFixtureHandlerInvoke).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response.json)).not.toContain(token);
    expect(JSON.stringify(response.json)).not.toContain(SUBJECT);
    expect(JSON.stringify(response.json)).not.toContain(CLERK_OWNER);
  });
});

async function startServer(options: Pick<LocalMcpDevEndpointPluginOptions, "endpointDependencies"> = {}): Promise<string> {
  const plugin = createLocalMcpDevEndpointPlugin({
    env: runtimeEnv(),
    ...options,
  });
  expect(plugin).toBeTruthy();
  const server = await createServer({
    configFile: false,
    plugins: [plugin].filter((candidate): candidate is NonNullable<typeof plugin> => candidate !== undefined),
    server: {
      host: "127.0.0.1",
      port: 0,
    },
  });
  servers.push(server);
  await server.listen();
  const address = server.httpServer?.address() as AddressInfo | null;
  if (!address || typeof address === "string") throw new Error("expected Vite HTTP server address");
  return `http://127.0.0.1:${address.port}`;
}

function runtimeEnv(): Record<string, string> {
  return {
    LOCAL_MCP_DEV_ENDPOINT: "1",
    LOCAL_MCP_DEV_FIXTURE_DEMO: "1",
    LOCAL_MCP_DEV_AUTH_POLICY: "1",
    LOCAL_MCP_DEV_STYTCH_COMPOSITION: "1",
    LOCAL_MCP_DEV_STYTCH_JWKS_JSON: JSON.stringify(fixtureKeys.jwks),
    LOCAL_MCP_DEV_AUTH_RESOURCE: RESOURCE,
    LOCAL_MCP_DEV_AUTH_ISSUER: ISSUER,
    LOCAL_MCP_DEV_AUTH_PROVIDER_ENVIRONMENT: PROVIDER_ENVIRONMENT,
    LOCAL_MCP_DEV_AUTH_CLIENT_ID: CLIENT_ID,
  };
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { method: "GET" });
  expect(response.status).toBe(200);
  return response.json();
}

async function postJson(baseUrl: string, body: string, authorization?: string): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization === undefined ? {} : { authorization }),
    },
    body,
  });
  return { status: response.status, json: await response.json() };
}

function jsonRpc(method: string, id: string | number | null = "request_1", params?: unknown): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    ...(params === undefined ? {} : { params }),
  });
}

function toolsCallBody(id: string): string {
  return jsonRpc("tools/call", id, {
    name: FIXTURE_TOOL.name,
    arguments: FIXTURE_TOOL.arguments,
  });
}

function buildCompositionConfig({ runQuery }: { runQuery: McpConvexAccountLinkLookupRunQueryV1 }) {
  return {
    kind: "mcp_auth_composition_boundary_config",
    localDevAuthConfig: {
      kind: "local_mcp_dev_auth_config",
      enabled: true,
      resourceUrl: RESOURCE,
      authorizationServerIssuerUrl: ISSUER,
      protectedResourceMetadataUrl: METADATA_URL,
      providerEnvironment: PROVIDER_ENVIRONMENT,
      allowedClientIds: [CLIENT_ID],
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      localDevOnly: true,
      fixtureOnly: true,
      version: 1,
    },
    stytchVerifierConfig: {
      kind: "stytch_mcp_bearer_verifier_config",
      provider: "stytch",
      issuer: ISSUER,
      audience: RESOURCE,
      approvedClientIds: [CLIENT_ID],
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      jwks: fixtureKeys.jwks,
      jwksSource: "server_only_config",
      serverOnly: true,
      providerEnvironment: PROVIDER_ENVIRONMENT,
      allowedAlgorithm: "RS256",
      clockToleranceSeconds: 0,
      tokenStorage: "none",
      version: 1,
    },
    canonicalResourceAudience: RESOURCE,
    authorizationServerIssuerUrl: ISSUER,
    providerEnvironment: PROVIDER_ENVIRONMENT,
    approvedClientIds: [CLIENT_ID],
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    accountLinkLookupAdapterConfig: {
      kind: "mcp_convex_account_link_lookup_adapter_config",
      queryRef: QUERY_REF,
      runQuery,
      serverOnly: true,
      version: 1,
    },
    localDevOnly: true,
    nonProductionOnly: true,
    version: 1,
  };
}

function accountLink(overrides: Partial<McpAuthPolicyAccountLinkRecordV1> = {}): McpAuthPolicyAccountLinkRecordV1 {
  return {
    kind: "mcp_auth_policy_account_link_record",
    issuer: ISSUER,
    subject: SUBJECT,
    providerEnvironment: PROVIDER_ENVIRONMENT,
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

function signFixtureToken(options: Partial<{
  issuer: string;
  audience: string;
  clientId: string;
  providerEnvironment: string;
  scope: string;
  exp: number;
  nbf: number;
  kid: string;
  privateKey: string;
  algorithm: Algorithm;
}> = {}): string {
  const payload: JWTPayload & Record<string, unknown> = {
    iss: options.issuer ?? ISSUER,
    aud: options.audience ?? RESOURCE,
    sub: SUBJECT,
    client_id: options.clientId ?? CLIENT_ID,
    azp: options.clientId ?? CLIENT_ID,
    provider_environment: options.providerEnvironment ?? PROVIDER_ENVIRONMENT,
    scope: options.scope ?? TWOWEEKS_APPLICATIONS_READ_SCOPE,
    iat: NOW_SECONDS,
    exp: options.exp ?? FAR_FUTURE_EXP,
    ...(options.nbf === undefined ? {} : { nbf: options.nbf }),
  };
  return sign(payload, options.privateKey ?? fixtureKeys.privateKeyPem, {
    algorithm: options.algorithm ?? "RS256",
    header: { typ: "JWT", kid: options.kid ?? KEY_ID },
    noTimestamp: true,
  });
}

function buildFixtureKeys() {
  const keyPair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const wrongKeyPair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const publicJwk = keyPair.publicKey.export({ format: "jwk" }) as JWK;
  const jwk: JWK = {
    ...publicJwk,
    kid: KEY_ID,
    alg: "RS256",
    use: "sig",
  };
  return {
    privateKeyPem: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    wrongPrivateKeyPem: wrongKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    jwks: { keys: [jwk] } satisfies JSONWebKeySet,
  };
}
