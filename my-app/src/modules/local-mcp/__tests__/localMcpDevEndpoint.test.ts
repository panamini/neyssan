import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  buildLocalMcpDevEndpointConfig,
  handleLocalMcpDevEndpointRequest,
  handleLocalMcpDevEndpointRequestAsync,
  isLocalMcpDevEndpointHandledPath,
  type LocalMcpDevEndpointDependenciesV1,
  type LocalMcpDevEndpointConfigV1,
  type LocalMcpDevEndpointRequestV1,
  type LocalMcpDevEndpointResponseV1,
} from "../localMcpDevEndpoint";
import {
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthPolicyAccountLinkRecordV1,
  type McpAuthVerifiedAccessTokenClaimsV1,
} from "../mcpAuthPolicyBoundary";
import type { McpBearerTokenVerificationResultV1 } from "../mcpAuthRequestOrchestrator";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../localMcpDevEndpoint.ts");
const ENABLED_CONFIG = buildLocalMcpDevEndpointConfig({ enabled: true });
const FIXTURE_DEMO_CONFIG = buildLocalMcpDevEndpointConfig({ enabled: true, fixtureDemoEnabled: true });
const AUTH_RESOURCE_URL = "https://mcp.example/mcp";
const AUTH_METADATA_URL = "https://mcp.example/.well-known/oauth-protected-resource/mcp";
const AUTH_ISSUER_URL = "https://auth.example/oauth";
const AUTH_PROVIDER_ENVIRONMENT = "stytch_test_environment";
const AUTH_CLIENT_ID = "chatgpt-apps-sdk-client";
const AUTH_SUBJECT = "stytch_subject_example_123";
const AUTH_CLERK_OWNER = "clerk_owner_example_123";
const AUTH_NOW_SECONDS = 1_800_000_000;
const AUTH_TOKEN = "raw-token-12345";
const AUTH_ENDPOINT_CONFIG = buildLocalMcpDevEndpointConfig({
  enabled: true,
  fixtureDemoEnabled: true,
  authPolicyEnabled: true,
  auth: {
    resourceUrl: AUTH_RESOURCE_URL,
    authorizationServerIssuerUrl: AUTH_ISSUER_URL,
    providerEnvironment: AUTH_PROVIDER_ENVIRONMENT,
    allowedClientIds: [AUTH_CLIENT_ID],
  },
});
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
} as const;
const TASK_AUGMENTED_TOOLS_CALL_UNSUPPORTED_MESSAGE =
  "Task-augmented tools/call is not supported by this fixture endpoint.";
const FIXTURE_TOOL_CALLS = [
  {
    name: "twoweeks.application_package.summarize",
    arguments: { applicationPackageRef: { id: "fixture-application-package" } },
    localToolId: "local_mcp.application_package.summarize",
  },
  {
    name: "twoweeks.evidence_graph.summarize",
    arguments: { evidenceGraphRef: { id: "fixture-evidence-graph" } },
    localToolId: "local_mcp.evidence_graph.summarize",
  },
  {
    name: "twoweeks.resume_variant_plan.summarize",
    arguments: { resumeVariantPlanRef: { id: "fixture-resume-variant-plan" } },
    localToolId: "local_mcp.resume_variant_plan.summarize",
  },
  {
    name: "twoweeks.review_cockpit.summarize",
    arguments: { reviewCockpitRef: { id: "fixture-review-cockpit" } },
    localToolId: "local_mcp.review_cockpit.summarize",
  },
] as const;

function implementationSource(): string {
  return readFileSync(SOURCE_FILE, "utf8");
}

function jsonRpc(method: string, id: string | number | null = "request_1", params?: unknown): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    ...(params === undefined ? {} : { params }),
  });
}

function request(overrides: Partial<LocalMcpDevEndpointRequestV1> = {}): LocalMcpDevEndpointRequestV1 {
  return {
    method: "POST",
    path: "/mcp",
    headers: {
      host: "localhost:5173",
      "content-type": "application/json",
    },
    remoteAddress: "127.0.0.1",
    bodyText: jsonRpc("initialize"),
    ...overrides,
  };
}

async function callEndpoint(
  overrides: Partial<LocalMcpDevEndpointRequestV1> = {},
  config: LocalMcpDevEndpointConfigV1 = ENABLED_CONFIG,
  dependencies: LocalMcpDevEndpointDependenciesV1 = {},
): Promise<LocalMcpDevEndpointResponseV1> {
  return handleLocalMcpDevEndpointRequestAsync(request(overrides), config, dependencies);
}

function expectNoStoreJsonHeaders(response: LocalMcpDevEndpointResponseV1): void {
  expect(response.headers).toEqual(JSON_HEADERS);
}

function expectSafeJsonRpcError(response: LocalMcpDevEndpointResponseV1, code: number, id: string | number | null = null): void {
  expect(response.json).toMatchObject({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      safeForModel: true,
      fixtureOnly: true,
      localDevOnly: true,
    },
  });
}

function expectNotEchoed(value: unknown, forbidden: readonly string[]): void {
  const serialized = JSON.stringify(value);
  for (const term of forbidden) {
    expect(serialized).not.toContain(term);
  }
}

async function toolsListDescriptors(): Promise<Array<Record<string, unknown>>> {
  const response = await callEndpoint({ bodyText: jsonRpc("tools/list", "schema_list") });
  expect(response).toMatchObject({ handled: true, status: 200 });
  return ((response.json as { result: { tools: Array<Record<string, unknown>> } }).result.tools);
}

function expectPlainRecord(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
}

function expectStructuredContentMatchesOutputSchema(value: unknown, schema: unknown): void {
  const record = expectPlainRecord(value);
  const schemaRecord = expectPlainRecord(schema);
  const properties = expectPlainRecord(schemaRecord.properties);
  const required = schemaRecord.required;
  expect(schemaRecord.type).toBe("object");
  expect(Array.isArray(required)).toBe(true);
  for (const field of required as string[]) {
    expect(record).toHaveProperty(field);
  }
  if (schemaRecord.additionalProperties === false) {
    expect(Object.keys(record).sort()).toEqual(Object.keys(properties).sort());
  }
  for (const [field, propertySchema] of Object.entries(properties)) {
    if (field in record) expectValueMatchesJsonSchema(record[field], propertySchema);
  }
}

function fixtureToolsCallBody(toolCall = FIXTURE_TOOL_CALLS[0], id = "auth_call_1"): string {
  return jsonRpc("tools/call", id, {
    name: toolCall.name,
    arguments: toolCall.arguments,
  });
}

function authHeaders(
  authorization: string | readonly string[] = `Bearer ${AUTH_TOKEN}`,
): LocalMcpDevEndpointRequestV1["headers"] {
  return {
    host: "localhost:5173",
    "content-type": "application/json",
    authorization,
  };
}

function unauthenticatedHeaders(): LocalMcpDevEndpointRequestV1["headers"] {
  return {
    host: "localhost:5173",
    "content-type": "application/json",
  };
}

function buildAuthClaims(
  overrides: Partial<McpAuthVerifiedAccessTokenClaimsV1> = {},
): McpAuthVerifiedAccessTokenClaimsV1 {
  return {
    kind: "mcp_auth_verified_access_token_claims",
    cryptographicVerification: "already_verified_by_provider_adapter",
    issuer: AUTH_ISSUER_URL,
    audience: AUTH_RESOURCE_URL,
    subject: AUTH_SUBJECT,
    expiresAtEpochSeconds: AUTH_NOW_SECONDS + 300,
    notBeforeEpochSeconds: AUTH_NOW_SECONDS - 30,
    clientId: AUTH_CLIENT_ID,
    grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    providerEnvironment: AUTH_PROVIDER_ENVIRONMENT,
    version: 1,
    ...overrides,
  };
}

function buildAuthAccountLink(
  overrides: Partial<McpAuthPolicyAccountLinkRecordV1> = {},
): McpAuthPolicyAccountLinkRecordV1 {
  return {
    kind: "mcp_auth_policy_account_link_record",
    issuer: AUTH_ISSUER_URL,
    subject: AUTH_SUBJECT,
    providerEnvironment: AUTH_PROVIDER_ENVIRONMENT,
    clientId: AUTH_CLIENT_ID,
    twoweeksClerkId: AUTH_CLERK_OWNER,
    grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    state: "active",
    createdAtEpochSeconds: AUTH_NOW_SECONDS - 600,
    updatedAtEpochSeconds: AUTH_NOW_SECONDS - 60,
    expiresAtEpochSeconds: AUTH_NOW_SECONDS + 600,
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
    claims: buildAuthClaims(overrides),
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

function createAuthDependencies(options?: {
  verificationResult?: McpBearerTokenVerificationResultV1;
  lookupResult?: readonly unknown[];
}): Required<Pick<LocalMcpDevEndpointDependenciesV1, "tokenVerifier" | "accountLinkLookup" | "nowEpochSeconds" | "onFixtureHandlerInvoke">> {
  return {
    tokenVerifier: vi.fn(async () => options?.verificationResult ?? buildVerificationSuccess()),
    accountLinkLookup: vi.fn(async () => options?.lookupResult ?? [buildAuthAccountLink()]),
    nowEpochSeconds: vi.fn(() => AUTH_NOW_SECONDS),
    onFixtureHandlerInvoke: vi.fn(),
  };
}

function expectValueMatchesJsonSchema(value: unknown, schema: unknown): void {
  const schemaRecord = expectPlainRecord(schema);
  if ("const" in schemaRecord) {
    expect(value).toEqual(schemaRecord.const);
  }
  switch (schemaRecord.type) {
    case "object":
      expectStructuredContentMatchesOutputSchema(value, schemaRecord);
      break;
    case "string":
      expect(typeof value).toBe("string");
      break;
    case "number":
      expect(typeof value).toBe("number");
      break;
    default:
      break;
  }
}

describe("local MCP dev endpoint", () => {
  it("is disabled by default and wrong paths are not handled", async () => {
    const defaultResponse = await handleLocalMcpDevEndpointRequest(request());
    const explicitlyDisabledResponse = await callEndpoint({}, buildLocalMcpDevEndpointConfig({ enabled: false }));
    const wrongPathResponse = await callEndpoint({ path: "/api/mcp" });

    expect(defaultResponse).toMatchObject({ handled: false, status: 404 });
    expect(explicitlyDisabledResponse).toMatchObject({ handled: false, status: 404 });
    expect(wrongPathResponse).toMatchObject({ handled: false, status: 404 });
    expectSafeJsonRpcError(defaultResponse, -32004);
    expectSafeJsonRpcError(explicitlyDisabledResponse, -32004);
    expectSafeJsonRpcError(wrongPathResponse, -32004);
    expectNoStoreJsonHeaders(defaultResponse);
    expectNoStoreJsonHeaders(explicitlyDisabledResponse);
    expectNoStoreJsonHeaders(wrongPathResponse);
  });

  it("allows only loopback host and remote address when enabled", async () => {
    const localIpv4 = await callEndpoint({ headers: { host: "127.0.0.1:5173", "content-type": "application/json" }, remoteAddress: "127.10.0.4" });
    const localIpv6 = await callEndpoint({ headers: { host: "[::1]:5173", "content-type": "application/json" }, remoteAddress: "::1" });
    const localMappedIpv4 = await callEndpoint({ remoteAddress: "::ffff:127.0.0.1" });
    const remoteHost = await callEndpoint({ headers: { host: "example.com", "content-type": "application/json" } });
    const remoteAddress = await callEndpoint({ remoteAddress: "10.0.0.2" });

    expect(localIpv4).toMatchObject({ handled: true, status: 200, json: { id: "request_1" } });
    expect(localIpv6).toMatchObject({ handled: true, status: 200, json: { id: "request_1" } });
    expect(localMappedIpv4).toMatchObject({ handled: true, status: 200, json: { id: "request_1" } });
    expect(remoteHost).toMatchObject({ handled: true, status: 403 });
    expect(remoteAddress).toMatchObject({ handled: true, status: 403 });
    expectSafeJsonRpcError(remoteHost, -32003, "request_1");
    expectSafeJsonRpcError(remoteAddress, -32003, "request_1");
  });

  it("rejects non-POST requests before JSON-RPC handling", async () => {
    const response = await callEndpoint({ method: "GET", bodyText: jsonRpc("initialize", "get_1") });

    expect(response).toMatchObject({ handled: true, status: 405 });
    expectSafeJsonRpcError(response, -32005, "get_1");
    expectNoStoreJsonHeaders(response);
  });

  it("rejects non-JSON content types", async () => {
    const response = await callEndpoint({ headers: { host: "localhost", "content-type": "text/plain" } });

    expect(response).toMatchObject({ handled: true, status: 415 });
    expectSafeJsonRpcError(response, -32015);
    expectNoStoreJsonHeaders(response);
  });

  it("rejects oversized requests without parsing the request id", async () => {
    const response = await callEndpoint(
      { bodyText: JSON.stringify({ jsonrpc: "2.0", id: "oversized_id", method: "initialize", pad: "x".repeat(128) }) },
      buildLocalMcpDevEndpointConfig({ enabled: true, maxRequestBytes: 64 }),
    );

    expect(response).toMatchObject({ handled: true, status: 413 });
    expectSafeJsonRpcError(response, -32013);
    expect(JSON.stringify(response)).not.toContain("oversized_id");
    expectNoStoreJsonHeaders(response);
  });

  it("rejects malformed or invalid JSON-RPC requests with current safe error codes", async () => {
    const invalidRequests = [
      { name: "malformed JSON", bodyText: "{" },
      { name: "wrong jsonrpc", bodyText: JSON.stringify({ jsonrpc: "1.0", id: "bad_version", method: "initialize" }) },
      { name: "missing id", bodyText: JSON.stringify({ jsonrpc: "2.0", method: "initialize" }) },
      { name: "invalid id", bodyText: JSON.stringify({ jsonrpc: "2.0", id: { unsafe: true }, method: "initialize" }) },
      { name: "missing method", bodyText: JSON.stringify({ jsonrpc: "2.0", id: "missing_method" }) },
    ] as const;

    for (const invalidRequest of invalidRequests) {
      const response = await callEndpoint({ bodyText: invalidRequest.bodyText });

      expect(response, invalidRequest.name).toMatchObject({ handled: true, status: 400 });
      expectSafeJsonRpcError(response, -32700);
      expectNoStoreJsonHeaders(response);
    }
  });

  it("returns fixture-only local-dev metadata for initialize", async () => {
    const response = handleLocalMcpDevEndpointRequest(request({ bodyText: jsonRpc("initialize", "init_1") }), ENABLED_CONFIG);

    expect(response).toEqual({
      handled: true,
      status: 200,
      headers: JSON_HEADERS,
      json: {
        jsonrpc: "2.0",
        id: "init_1",
        result: {
          protocolVersion: "2025-11-25",
          serverInfo: {
            name: "twoweeks-local-dev-fixture",
            version: "1.0.0",
          },
          capabilities: {
            tools: { listChanged: false },
          },
          fixtureOnly: true,
          localDevOnly: true,
          fixtureDemoEnabled: false,
        },
      },
    });
    expect(response).not.toHaveProperty("then");
  });

  it("validates initialize params and handles initialized notifications without exposing a body", async () => {
    const validInitialize = await callEndpoint({
      bodyText: jsonRpc("initialize", "init_with_params", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "fixture-client", version: "1.0.0" },
      }),
    });
    const initializeWithMeta = await callEndpoint({
      bodyText: jsonRpc("initialize", "initMetadata", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "fixture-client", version: "1.0.0" },
        _meta: { progressToken: "secret-progress-token", extraFixtureKey: "allowed-extra-meta" },
      }),
    });
    const malformedInitialize = await callEndpoint({ bodyText: jsonRpc("initialize", "bad_init", []) });
    const malformedInitializeMeta = await callEndpoint({
      bodyText: jsonRpc("initialize", "bad_init_meta", { _meta: "secret-progress-token" }),
    });
    const futureInitialize = await callEndpoint({
      bodyText: jsonRpc("initialize", "future_init", { protocolVersion: "2099-01-01" }),
    });
    const initializedNotification = await callEndpoint({
      bodyText: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    const malformedNotification = await callEndpoint({
      bodyText: JSON.stringify({ jsonrpc: "2.0", id: "not_a_notification", method: "notifications/initialized" }),
    });

    expect(validInitialize).toMatchObject({
      handled: true,
      status: 200,
      json: { id: "init_with_params", result: { fixtureOnly: true, localDevOnly: true } },
    });
    expect(initializeWithMeta).toMatchObject({
      handled: true,
      status: 200,
      json: { id: "initMetadata", result: { protocolVersion: "2025-11-25" } },
    });
    expectNotEchoed(initializeWithMeta, ["_meta", "secret-progress-token", "allowed-extra-meta"]);
    expectSafeJsonRpcError(malformedInitialize, -32602, "bad_init");
    expectSafeJsonRpcError(malformedInitializeMeta, -32602, "bad_init_meta");
    expectNotEchoed(malformedInitializeMeta, ["secret-progress-token"]);
    expect(futureInitialize).toMatchObject({
      handled: true,
      status: 200,
      json: { id: "future_init", result: { protocolVersion: "2025-11-25" } },
    });
    expect(initializedNotification).toEqual({
      handled: true,
      status: 202,
      headers: JSON_HEADERS,
      json: null,
    });
    expect(malformedNotification).toMatchObject({ handled: true, status: 400 });
    expectSafeJsonRpcError(malformedNotification, -32700);
  });

  it("returns only inert fixture data for tools/list", async () => {
    const response = await callEndpoint({ bodyText: jsonRpc("tools/list", 2) });

    expect(response).toMatchObject({ handled: true, status: 200, headers: JSON_HEADERS });
    expect(response.json).toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      result: {
        kind: "local_mcp_tools_list_fixture_response",
        method: "tools/list",
        success: true,
        fixtureOnly: true,
        callable: false,
        runnable: false,
        networkReachable: false,
        toolCount: 4,
        version: 1,
      },
    });

    const result = (response.json as { result: { tools: Array<Record<string, unknown>> } }).result;
    expect(result.tools.map((tool) => tool.name)).toEqual([
      "twoweeks.application_package.summarize",
      "twoweeks.evidence_graph.summarize",
      "twoweeks.resume_variant_plan.summarize",
      "twoweeks.review_cockpit.summarize",
    ]);
    for (const tool of result.tools) {
      expect(Object.keys(tool).sort()).toEqual([
        "annotations",
        "description",
        "inputSchema",
        "internalToolId",
        "localToolId",
        "name",
        "outputSchema",
        "title",
        "version",
      ]);
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
      expect(tool).not.toHaveProperty("handler");
      expect(tool).not.toHaveProperty("execute");
      expect(tool).not.toHaveProperty("call");
      expect(tool).not.toHaveProperty("_meta");
    }
    expect(JSON.stringify(response.json)).not.toMatch(/provider_verified_submitted|billing|oauth|https?:\/\/|modelCall|openai|submitApplication|applyToJob/u);
  });

  it("serves protected-resource metadata only in explicit local auth mode", async () => {
    expect(isLocalMcpDevEndpointHandledPath("/.well-known/oauth-protected-resource")).toBe(true);
    expect(isLocalMcpDevEndpointHandledPath("/.well-known/oauth-protected-resource/mcp")).toBe(true);
    expect(isLocalMcpDevEndpointHandledPath("/api/mcp")).toBe(false);

    const rootMetadata = await callEndpoint(
      { method: "GET", path: "/.well-known/oauth-protected-resource", headers: { host: "localhost:5173" }, bodyText: "" },
      AUTH_ENDPOINT_CONFIG,
    );
    const pathMetadata = await callEndpoint(
      { method: "GET", path: "/.well-known/oauth-protected-resource/mcp", headers: { host: "localhost:5173" }, bodyText: "" },
      AUTH_ENDPOINT_CONFIG,
    );
    const remoteMetadata = await callEndpoint(
      { method: "GET", path: "/.well-known/oauth-protected-resource/mcp", headers: { host: "example.com" }, bodyText: "" },
      AUTH_ENDPOINT_CONFIG,
    );
    const postMetadata = await callEndpoint(
      { method: "POST", path: "/.well-known/oauth-protected-resource/mcp", headers: { host: "localhost:5173" }, bodyText: "" },
      AUTH_ENDPOINT_CONFIG,
    );
    const invalidAuthConfig = buildLocalMcpDevEndpointConfig({
      enabled: true,
      fixtureDemoEnabled: true,
      authPolicyEnabled: true,
      auth: {
        resourceUrl: "http://mcp.example/mcp",
        authorizationServerIssuerUrl: AUTH_ISSUER_URL,
        providerEnvironment: AUTH_PROVIDER_ENVIRONMENT,
        allowedClientIds: [AUTH_CLIENT_ID],
      },
    });
    const disabledMetadata = await callEndpoint(
      { method: "GET", path: "/.well-known/oauth-protected-resource/mcp", headers: { host: "localhost:5173" }, bodyText: "" },
      invalidAuthConfig,
    );
    const invalidAuthConfigCall = await callEndpoint(
      { bodyText: fixtureToolsCallBody(FIXTURE_TOOL_CALLS[0], "invalid_auth_config") },
      invalidAuthConfig,
    );

    expect(rootMetadata).toEqual(pathMetadata);
    expect(rootMetadata).toEqual({
      handled: true,
      status: 200,
      headers: JSON_HEADERS,
      json: {
        resource: AUTH_RESOURCE_URL,
        authorization_servers: [AUTH_ISSUER_URL],
        scopes_supported: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      },
    });
    expect(remoteMetadata).toMatchObject({ handled: true, status: 403 });
    expectSafeJsonRpcError(remoteMetadata, -32003);
    expect(postMetadata).toMatchObject({ handled: true, status: 405 });
    expectSafeJsonRpcError(postMetadata, -32005);
    expect(invalidAuthConfig).toMatchObject({ fixtureDemoEnabled: false, authPolicyEnabled: false, authConfig: undefined });
    expect(disabledMetadata).toMatchObject({ handled: false, status: 404 });
    expect(invalidAuthConfigCall).toMatchObject({ handled: true, status: 200 });
    expectSafeJsonRpcError(invalidAuthConfigCall, -32020, "invalid_auth_config");
  });

  it("adds OAuth security schemes to tools/list only in auth mode", async () => {
    const response = await callEndpoint({ bodyText: jsonRpc("tools/list", "auth_schema") }, AUTH_ENDPOINT_CONFIG);

    expect(response).toMatchObject({ handled: true, status: 200, headers: JSON_HEADERS });
    const result = (response.json as { result: { tools: Array<Record<string, unknown>> } }).result;
    for (const tool of result.tools) {
      expect(tool.securitySchemes).toEqual([{ type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] }]);
      expect(tool._meta).toEqual({
        securitySchemes: [{ type: "oauth2", scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE] }],
      });
      expect(tool).not.toHaveProperty("handler");
      expect(tool).not.toHaveProperty("execute");
      expect(tool).not.toHaveProperty("call");
    }
  });

  it("challenges tools/call in auth mode without invoking fixture handlers when credentials are absent or malformed", async () => {
    const missingAuthDependencies = createAuthDependencies();
    const missingAuth = await callEndpoint(
      { headers: unauthenticatedHeaders(), bodyText: fixtureToolsCallBody() },
      AUTH_ENDPOINT_CONFIG,
      missingAuthDependencies,
    );
    const duplicateAuthDependencies = createAuthDependencies();
    const duplicateAuth = await callEndpoint(
      { headers: authHeaders([`Bearer ${AUTH_TOKEN}`, "Bearer second-token"]), bodyText: fixtureToolsCallBody(FIXTURE_TOOL_CALLS[0], "duplicate_auth") },
      AUTH_ENDPOINT_CONFIG,
      duplicateAuthDependencies,
    );

    for (const response of [missingAuth, duplicateAuth]) {
      expect(response).toMatchObject({
        handled: true,
        status: 200,
        json: {
          result: {
            isError: true,
            content: [{ type: "text", text: "Authentication required." }],
            _meta: { "mcp/www_authenticate": expect.any(Array) },
          },
        },
      });
      expect(JSON.stringify(response)).toContain(AUTH_METADATA_URL);
      expect(JSON.stringify(response)).toContain(TWOWEEKS_APPLICATIONS_READ_SCOPE);
      expect(JSON.stringify(response)).not.toContain(AUTH_TOKEN);
    }
    expect(missingAuthDependencies.tokenVerifier).not.toHaveBeenCalled();
    expect(missingAuthDependencies.onFixtureHandlerInvoke).not.toHaveBeenCalled();
    expect(duplicateAuthDependencies.tokenVerifier).not.toHaveBeenCalled();
    expect(duplicateAuthDependencies.onFixtureHandlerInvoke).not.toHaveBeenCalled();
  });

  it("keeps auth-mode tools/call fail-closed for verifier and account-link denials", async () => {
    const insufficientScopeDependencies = createAuthDependencies({
      verificationResult: buildVerificationFailure("insufficient_scope"),
    });
    const insufficientScope = await callEndpoint(
      { headers: authHeaders(), bodyText: fixtureToolsCallBody(FIXTURE_TOOL_CALLS[0], "insufficient_scope") },
      AUTH_ENDPOINT_CONFIG,
      insufficientScopeDependencies,
    );
    const unlinkedDependencies = createAuthDependencies({ lookupResult: [] });
    const unlinked = await callEndpoint(
      { headers: authHeaders(), bodyText: fixtureToolsCallBody(FIXTURE_TOOL_CALLS[0], "unlinked") },
      AUTH_ENDPOINT_CONFIG,
      unlinkedDependencies,
    );

    expect(insufficientScope).toMatchObject({
      handled: true,
      status: 200,
      json: {
        result: {
          isError: true,
          content: [{ type: "text", text: "Authentication required." }],
          _meta: { "mcp/www_authenticate": expect.any(Array) },
        },
      },
    });
    expect(unlinked).toMatchObject({
      handled: true,
      status: 200,
      json: {
        result: {
          isError: true,
          content: [{ type: "text", text: "Authentication required." }],
          _meta: { "mcp/www_authenticate": expect.any(Array) },
        },
      },
    });
    expect(JSON.stringify(unlinked)).toContain(AUTH_METADATA_URL);
    expect(JSON.stringify(unlinked)).toContain(TWOWEEKS_APPLICATIONS_READ_SCOPE);
    expectNotEchoed(unlinked, [
      AUTH_TOKEN,
      AUTH_SUBJECT,
      AUTH_CLIENT_ID,
      AUTH_CLERK_OWNER,
      AUTH_PROVIDER_ENVIRONMENT,
      "kind\":\"mcp_auth_verified_access_token_claims",
      "kind\":\"mcp_auth_policy_account_link_record",
    ]);
    expect(insufficientScopeDependencies.accountLinkLookup).not.toHaveBeenCalled();
    expect(insufficientScopeDependencies.onFixtureHandlerInvoke).not.toHaveBeenCalled();
    expect(unlinkedDependencies.accountLinkLookup).toHaveBeenCalledTimes(1);
    expect(unlinkedDependencies.onFixtureHandlerInvoke).not.toHaveBeenCalled();
  });

  it("runs fixture tools/call in auth mode only after injected verifier and account link approval", async () => {
    const dependencies = createAuthDependencies();
    const response = await callEndpoint(
      { headers: authHeaders(), bodyText: fixtureToolsCallBody(FIXTURE_TOOL_CALLS[0], "authorized") },
      AUTH_ENDPOINT_CONFIG,
      dependencies,
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
              text: `Fixture-only tools/call accepted for ${FIXTURE_TOOL_CALLS[0].localToolId}. No product action executed.`,
            },
          ],
          structuredContent: {
            kind: "local_mcp_dry_run",
            input: FIXTURE_TOOL_CALLS[0].arguments,
            version: 1,
          },
        },
      },
    });
    expect(dependencies.tokenVerifier).toHaveBeenCalledWith({
      rawBearerToken: AUTH_TOKEN,
      expectedIssuer: AUTH_ISSUER_URL,
      expectedAudience: AUTH_RESOURCE_URL,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      expectedProviderEnvironment: AUTH_PROVIDER_ENVIRONMENT,
      allowedClientIds: [AUTH_CLIENT_ID],
      version: 1,
    });
    expect(dependencies.accountLinkLookup).toHaveBeenCalledWith({
      issuer: AUTH_ISSUER_URL,
      subject: AUTH_SUBJECT,
      providerEnvironment: AUTH_PROVIDER_ENVIRONMENT,
      version: 1,
    });
    expect(dependencies.onFixtureHandlerInvoke).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain(AUTH_TOKEN);
    expect(JSON.stringify(response)).not.toContain(AUTH_SUBJECT);
    expect(JSON.stringify(response)).not.toContain(AUTH_CLERK_OWNER);
  });

  it("keeps tools/call blocked in reachability-only mode and never echoes handler arguments", async () => {
    const response = await callEndpoint({
      bodyText: jsonRpc("tools/call", "call_1", {
        name: "twoweeks.application_package.summarize",
        arguments: { applicationPackageRef: { id: "pkg_1" } },
      }),
    });

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      headers: JSON_HEADERS,
      json: {
        jsonrpc: "2.0",
        id: "call_1",
        error: {
          code: -32020,
          message: "Local dev MCP endpoint does not run tool handlers.",
          safeForModel: true,
          fixtureOnly: true,
          localDevOnly: true,
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain("pkg_1");
  });

  it("runs deterministic fixture-only tools/call responses only with the explicit demo flag", async () => {
    for (const toolCall of FIXTURE_TOOL_CALLS) {
      const first = await callEndpoint(
        { bodyText: jsonRpc("tools/call", `${toolCall.name}:first`, { name: toolCall.name, arguments: toolCall.arguments }) },
        FIXTURE_DEMO_CONFIG,
      );
      const second = await callEndpoint(
        { bodyText: jsonRpc("tools/call", `${toolCall.name}:first`, { name: toolCall.name, arguments: toolCall.arguments }) },
        FIXTURE_DEMO_CONFIG,
      );
      const withMeta = await callEndpoint(
        {
          bodyText: jsonRpc("tools/call", `${toolCall.name}:meta`, {
            name: toolCall.name,
            arguments: toolCall.arguments,
            _meta: { progressToken: "fixture-progress-token", extraFixtureKey: "ignored-meta" },
          }),
        },
        FIXTURE_DEMO_CONFIG,
      );

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        handled: true,
        status: 200,
        headers: JSON_HEADERS,
        json: {
          jsonrpc: "2.0",
          id: `${toolCall.name}:first`,
          result: {
            content: [
              {
                type: "text",
                text: `Fixture-only tools/call accepted for ${toolCall.localToolId}. No product action executed.`,
              },
            ],
            structuredContent: {
              kind: "local_mcp_dry_run",
              input: toolCall.arguments,
              version: 1,
            },
          },
        },
      });
      expect(withMeta).toMatchObject({
        handled: true,
        status: 200,
        json: {
          jsonrpc: "2.0",
          id: `${toolCall.name}:meta`,
          result: {
            structuredContent: {
              kind: "local_mcp_dry_run",
              input: toolCall.arguments,
              version: 1,
            },
          },
        },
      });
      expectNotEchoed(withMeta, ["_meta", "fixture-progress-token", "ignored-meta"]);
      expect(JSON.stringify(first)).not.toMatch(/rawCv|rawResume|rawJob|coverLetter|privateFacts|never_use|oauth|clerk|convex|https?:\/\//iu);
    }
  });

  it("keeps fixture tools/call structuredContent aligned with advertised outputSchema", async () => {
    const descriptors = await toolsListDescriptors();
    for (const toolCall of FIXTURE_TOOL_CALLS) {
      const descriptor = descriptors.find((candidate) => candidate.name === toolCall.name);
      expect(descriptor, toolCall.name).toBeTruthy();
      const outputSchema = (descriptor as { outputSchema: unknown }).outputSchema;
      const response = await callEndpoint(
        { bodyText: jsonRpc("tools/call", `${toolCall.name}:schema`, { name: toolCall.name, arguments: toolCall.arguments }) },
        FIXTURE_DEMO_CONFIG,
      );

      expect(response).toMatchObject({ handled: true, status: 200 });
      const structuredContent = (response.json as { result: { structuredContent: Record<string, unknown> } }).result.structuredContent;
      const schemaProperties = ((outputSchema as { properties: Record<string, { const?: unknown }> }).properties);
      expect(structuredContent.kind).toBe(schemaProperties.kind.const);
      expectStructuredContentMatchesOutputSchema(structuredContent, outputSchema);
    }
  });

  it("refuses unsafe, malformed, unknown, and write-like fixture demo calls without echoing input", async () => {
    const cases = [
      {
        name: "unknown tool",
        params: { name: "twoweeks.unknown.summarize", arguments: {} },
        message: "Unknown fixture tool.",
        forbiddenEcho: "twoweeks.unknown.summarize",
      },
      {
        name: "malformed args",
        params: { name: "twoweeks.application_package.summarize", arguments: { applicationPackageRef: { id: "app_123_realish" } } },
        message: "Invalid fixture arguments.",
        forbiddenEcho: "app_123_realish",
      },
      {
        name: "write-like args",
        params: {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "fixture-application-package" }, instruction: "apply now" },
        },
        message: "Refused. Write action blocked.",
        forbiddenEcho: "apply now",
      },
      {
        name: "external URL args",
        params: {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "fixture-application-package" }, url: "https://example.com/private" },
        },
        message: "Refused. Private identifier or raw document input blocked.",
        forbiddenEcho: "https://example.com/private",
      },
      {
        name: "raw resume args",
        params: {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "fixture-application-package" }, rawResume: "raw resume body" },
        },
        message: "Refused. Private identifier or raw document input blocked.",
        forbiddenEcho: "raw resume body",
      },
      {
        name: "malformed params",
        params: { name: "twoweeks.application_package.summarize", arguments: [], userId: "fixture-user" },
        message: "Invalid tools/call request.",
        forbiddenEcho: "fixture-user",
      },
      {
        name: "malformed meta",
        params: {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "fixture-application-package" } },
          _meta: "secret-progress-token",
        },
        message: "Invalid tools/call metadata.",
        forbiddenEcho: "secret-progress-token",
      },
      {
        name: "task augmented call",
        params: {
          name: "twoweeks.application_package.summarize",
          arguments: { applicationPackageRef: { id: "fixture-application-package" } },
          task: { id: "secret-task-id" },
        },
        message: TASK_AUGMENTED_TOOLS_CALL_UNSUPPORTED_MESSAGE,
        forbiddenEcho: "secret-task-id",
      },
    ] as const;

    for (const testCase of cases) {
      const response = await callEndpoint(
        { bodyText: jsonRpc("tools/call", testCase.name, testCase.params) },
        FIXTURE_DEMO_CONFIG,
      );

      expect(response, testCase.name).toMatchObject({ handled: true, status: 200 });
      expect(response.json).toMatchObject({
        jsonrpc: "2.0",
        id: testCase.name,
        error: {
          code: -32602,
          message: testCase.message,
          safeForModel: true,
          fixtureOnly: true,
          localDevOnly: true,
        },
      });
      expect(JSON.stringify(response), testCase.name).not.toContain(testCase.forbiddenEcho);
    }
  });

  it("returns method-not-found for unknown JSON-RPC methods", async () => {
    const response = await callEndpoint({ bodyText: jsonRpc("prompts/list", "unknown_1") });

    expect(response).toMatchObject({ handled: true, status: 200 });
    expectSafeJsonRpcError(response, -32601, "unknown_1");
    expectNoStoreJsonHeaders(response);
  });

  it("uses no-store JSON headers for all handled response categories", async () => {
    const responses = await Promise.all([
      callEndpoint({ remoteAddress: "203.0.113.5" }),
      callEndpoint({ method: "PUT" }),
      callEndpoint({ headers: { host: "localhost", "content-type": "application/x-www-form-urlencoded" } }),
      callEndpoint({ bodyText: "{" }),
      callEndpoint({ bodyText: jsonRpc("initialize") }),
      callEndpoint({ bodyText: jsonRpc("tools/list") }),
      callEndpoint({ bodyText: jsonRpc("tools/call") }),
      callEndpoint({ bodyText: jsonRpc("unknown/method") }),
    ]);

    for (const response of responses) {
      expect(response.handled).toBe(true);
      expectNoStoreJsonHeaders(response);
    }
  });

  it("validates default and malformed config objects", async () => {
    expect(buildLocalMcpDevEndpointConfig()).toEqual({
      kind: "local_mcp_dev_endpoint_config",
      enabled: false,
      fixtureDemoEnabled: false,
      authPolicyEnabled: false,
      authConfig: undefined,
      localOnly: true,
      endpointPath: "/mcp",
      maxRequestBytes: 16 * 1024,
      version: 1,
    });
    expect(buildLocalMcpDevEndpointConfig({ enabled: true, maxRequestBytes: 512 })).toMatchObject({
      enabled: true,
      fixtureDemoEnabled: false,
      authPolicyEnabled: false,
      authConfig: undefined,
      localOnly: true,
      endpointPath: "/mcp",
      maxRequestBytes: 512,
      version: 1,
    });
    expect(FIXTURE_DEMO_CONFIG).toMatchObject({
      enabled: true,
      fixtureDemoEnabled: true,
      authPolicyEnabled: false,
      authConfig: undefined,
      localOnly: true,
      endpointPath: "/mcp",
      version: 1,
    });
    expect(buildLocalMcpDevEndpointConfig({ enabled: false, fixtureDemoEnabled: true })).toMatchObject({
      enabled: false,
      fixtureDemoEnabled: false,
      authPolicyEnabled: false,
      authConfig: undefined,
    });
    expect(() => buildLocalMcpDevEndpointConfig({ enabled: true, maxRequestBytes: 0 })).toThrow(
      "max request bytes must be a positive integer",
    );
    expect(() =>
      handleLocalMcpDevEndpointRequest(request(), {
        ...ENABLED_CONFIG,
        localOnly: false,
      } as unknown as LocalMcpDevEndpointConfigV1),
    ).toThrow("must stay local-only on the fixed dev path");
  });

  it("keeps implementation source free of SDK imports, outbound calls, OAuth, and product actions", () => {
    const source = implementationSource();
    const forbiddenFragments = [
      "@modelcontextprotocol",
      "@openai",
      "next/server",
      "convex",
      "node:http",
      "node:https",
      "createServer(",
      ".listen(",
      "server.connect",
      "fetch(",
      "axios",
      "undici",
      "XMLHttpRequest",
      "WebSocket(",
      "EventSource(",
      "OAuthProvider",
      "ChatGPTConnector",
      "executeLocalMcpRequest(",
      "exportFile(",
      "downloadFile(",
      "sendEmail(",
      "submitApplication(",
      "applyToJob(",
      "provider_verified_submitted",
    ] as const;

    for (const fragment of forbiddenFragments) {
      expect(source).not.toContain(fragment);
    }
  });
});
