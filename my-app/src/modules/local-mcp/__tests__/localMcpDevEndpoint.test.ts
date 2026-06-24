import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpDevEndpointConfig,
  handleLocalMcpDevEndpointRequest,
  type LocalMcpDevEndpointConfigV1,
  type LocalMcpDevEndpointRequestV1,
  type LocalMcpDevEndpointResponseV1,
} from "../localMcpDevEndpoint";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../localMcpDevEndpoint.ts");
const ENABLED_CONFIG = buildLocalMcpDevEndpointConfig({ enabled: true });
const FIXTURE_DEMO_CONFIG = buildLocalMcpDevEndpointConfig({ enabled: true, fixtureDemoEnabled: true });
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
} as const;
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

function callEndpoint(
  overrides: Partial<LocalMcpDevEndpointRequestV1> = {},
  config: LocalMcpDevEndpointConfigV1 = ENABLED_CONFIG,
): LocalMcpDevEndpointResponseV1 {
  return handleLocalMcpDevEndpointRequest(request(overrides), config);
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

describe("local MCP dev endpoint", () => {
  it("is disabled by default and wrong paths are not handled", () => {
    const defaultResponse = handleLocalMcpDevEndpointRequest(request());
    const explicitlyDisabledResponse = callEndpoint({}, buildLocalMcpDevEndpointConfig({ enabled: false }));
    const wrongPathResponse = callEndpoint({ path: "/api/mcp" });

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

  it("allows only loopback host and remote address when enabled", () => {
    const localIpv4 = callEndpoint({ headers: { host: "127.0.0.1:5173", "content-type": "application/json" }, remoteAddress: "127.10.0.4" });
    const localIpv6 = callEndpoint({ headers: { host: "[::1]:5173", "content-type": "application/json" }, remoteAddress: "::1" });
    const localMappedIpv4 = callEndpoint({ remoteAddress: "::ffff:127.0.0.1" });
    const remoteHost = callEndpoint({ headers: { host: "example.com", "content-type": "application/json" } });
    const remoteAddress = callEndpoint({ remoteAddress: "10.0.0.2" });

    expect(localIpv4).toMatchObject({ handled: true, status: 200, json: { id: "request_1" } });
    expect(localIpv6).toMatchObject({ handled: true, status: 200, json: { id: "request_1" } });
    expect(localMappedIpv4).toMatchObject({ handled: true, status: 200, json: { id: "request_1" } });
    expect(remoteHost).toMatchObject({ handled: true, status: 403 });
    expect(remoteAddress).toMatchObject({ handled: true, status: 403 });
    expectSafeJsonRpcError(remoteHost, -32003, "request_1");
    expectSafeJsonRpcError(remoteAddress, -32003, "request_1");
  });

  it("rejects non-POST requests before JSON-RPC handling", () => {
    const response = callEndpoint({ method: "GET", bodyText: jsonRpc("initialize", "get_1") });

    expect(response).toMatchObject({ handled: true, status: 405 });
    expectSafeJsonRpcError(response, -32005, "get_1");
    expectNoStoreJsonHeaders(response);
  });

  it("rejects non-JSON content types", () => {
    const response = callEndpoint({ headers: { host: "localhost", "content-type": "text/plain" } });

    expect(response).toMatchObject({ handled: true, status: 415 });
    expectSafeJsonRpcError(response, -32015);
    expectNoStoreJsonHeaders(response);
  });

  it("rejects oversized requests without parsing the request id", () => {
    const response = callEndpoint(
      { bodyText: JSON.stringify({ jsonrpc: "2.0", id: "oversized_id", method: "initialize", pad: "x".repeat(128) }) },
      buildLocalMcpDevEndpointConfig({ enabled: true, maxRequestBytes: 64 }),
    );

    expect(response).toMatchObject({ handled: true, status: 413 });
    expectSafeJsonRpcError(response, -32013);
    expect(JSON.stringify(response)).not.toContain("oversized_id");
    expectNoStoreJsonHeaders(response);
  });

  it("rejects malformed or invalid JSON-RPC requests with current safe error codes", () => {
    const invalidRequests = [
      { name: "malformed JSON", bodyText: "{" },
      { name: "wrong jsonrpc", bodyText: JSON.stringify({ jsonrpc: "1.0", id: "bad_version", method: "initialize" }) },
      { name: "missing id", bodyText: JSON.stringify({ jsonrpc: "2.0", method: "initialize" }) },
      { name: "invalid id", bodyText: JSON.stringify({ jsonrpc: "2.0", id: { unsafe: true }, method: "initialize" }) },
      { name: "missing method", bodyText: JSON.stringify({ jsonrpc: "2.0", id: "missing_method" }) },
    ] as const;

    for (const invalidRequest of invalidRequests) {
      const response = callEndpoint({ bodyText: invalidRequest.bodyText });

      expect(response, invalidRequest.name).toMatchObject({ handled: true, status: 400 });
      expectSafeJsonRpcError(response, -32700);
      expectNoStoreJsonHeaders(response);
    }
  });

  it("returns fixture-only local-dev metadata for initialize", () => {
    const response = callEndpoint({ bodyText: jsonRpc("initialize", "init_1") });

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
  });

  it("validates initialize params and handles initialized notifications without exposing a body", () => {
    const validInitialize = callEndpoint({
      bodyText: jsonRpc("initialize", "init_with_params", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "fixture-client", version: "1.0.0" },
      }),
    });
    const malformedInitialize = callEndpoint({ bodyText: jsonRpc("initialize", "bad_init", []) });
    const unsupportedInitialize = callEndpoint({
      bodyText: jsonRpc("initialize", "unsupported_init", { protocolVersion: "1900-01-01" }),
    });
    const initializedNotification = callEndpoint({
      bodyText: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    const malformedNotification = callEndpoint({
      bodyText: JSON.stringify({ jsonrpc: "2.0", id: "not_a_notification", method: "notifications/initialized" }),
    });

    expect(validInitialize).toMatchObject({
      handled: true,
      status: 200,
      json: { id: "init_with_params", result: { fixtureOnly: true, localDevOnly: true } },
    });
    expectSafeJsonRpcError(malformedInitialize, -32602, "bad_init");
    expectSafeJsonRpcError(unsupportedInitialize, -32002, "unsupported_init");
    expect(initializedNotification).toEqual({
      handled: true,
      status: 202,
      headers: JSON_HEADERS,
      json: null,
    });
    expect(malformedNotification).toMatchObject({ handled: true, status: 400 });
    expectSafeJsonRpcError(malformedNotification, -32700);
  });

  it("returns only inert fixture data for tools/list", () => {
    const response = callEndpoint({ bodyText: jsonRpc("tools/list", 2) });

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

  it("keeps tools/call blocked in reachability-only mode and never echoes handler arguments", () => {
    const response = callEndpoint({
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

  it("runs deterministic fixture-only tools/call responses only with the explicit demo flag", () => {
    for (const toolCall of FIXTURE_TOOL_CALLS) {
      const first = callEndpoint(
        { bodyText: jsonRpc("tools/call", `${toolCall.name}:first`, { name: toolCall.name, arguments: toolCall.arguments }) },
        FIXTURE_DEMO_CONFIG,
      );
      const second = callEndpoint(
        { bodyText: jsonRpc("tools/call", `${toolCall.name}:first`, { name: toolCall.name, arguments: toolCall.arguments }) },
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
              kind: "twoweeks_local_mcp_fixture_tool_result",
              fixtureOnly: true,
              localDevOnly: true,
              noRealUserData: true,
              toolName: toolCall.name,
              localToolId: toolCall.localToolId,
              result: {
                kind: "local_mcp_safe_text_fixture_output",
                status: "safe_summary_only",
                refIds: [`fixture:${toolCall.localToolId}`],
                version: 1,
              },
              version: 1,
            },
          },
        },
      });
      expect(JSON.stringify(first)).not.toMatch(/rawCv|rawResume|rawJob|coverLetter|privateFacts|never_use|oauth|clerk|convex|https?:\/\//iu);
    }
  });

  it("refuses unsafe, malformed, unknown, and write-like fixture demo calls without echoing input", () => {
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
    ] as const;

    for (const testCase of cases) {
      const response = callEndpoint(
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

  it("returns method-not-found for unknown JSON-RPC methods", () => {
    const response = callEndpoint({ bodyText: jsonRpc("prompts/list", "unknown_1") });

    expect(response).toMatchObject({ handled: true, status: 200 });
    expectSafeJsonRpcError(response, -32601, "unknown_1");
    expectNoStoreJsonHeaders(response);
  });

  it("uses no-store JSON headers for all handled response categories", () => {
    const responses = [
      callEndpoint({ remoteAddress: "203.0.113.5" }),
      callEndpoint({ method: "PUT" }),
      callEndpoint({ headers: { host: "localhost", "content-type": "application/x-www-form-urlencoded" } }),
      callEndpoint({ bodyText: "{" }),
      callEndpoint({ bodyText: jsonRpc("initialize") }),
      callEndpoint({ bodyText: jsonRpc("tools/list") }),
      callEndpoint({ bodyText: jsonRpc("tools/call") }),
      callEndpoint({ bodyText: jsonRpc("unknown/method") }),
    ];

    for (const response of responses) {
      expect(response.handled).toBe(true);
      expectNoStoreJsonHeaders(response);
    }
  });

  it("validates default and malformed config objects", () => {
    expect(buildLocalMcpDevEndpointConfig()).toEqual({
      kind: "local_mcp_dev_endpoint_config",
      enabled: false,
      fixtureDemoEnabled: false,
      localOnly: true,
      endpointPath: "/mcp",
      maxRequestBytes: 16 * 1024,
      version: 1,
    });
    expect(buildLocalMcpDevEndpointConfig({ enabled: true, maxRequestBytes: 512 })).toMatchObject({
      enabled: true,
      fixtureDemoEnabled: false,
      localOnly: true,
      endpointPath: "/mcp",
      maxRequestBytes: 512,
      version: 1,
    });
    expect(FIXTURE_DEMO_CONFIG).toMatchObject({
      enabled: true,
      fixtureDemoEnabled: true,
      localOnly: true,
      endpointPath: "/mcp",
      version: 1,
    });
    expect(buildLocalMcpDevEndpointConfig({ enabled: false, fixtureDemoEnabled: true })).toMatchObject({
      enabled: false,
      fixtureDemoEnabled: false,
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
