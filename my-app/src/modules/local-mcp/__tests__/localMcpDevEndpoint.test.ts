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
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
} as const;

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
        },
      },
    });
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

  it("blocks tools/call and never echoes handler arguments", () => {
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
      localOnly: true,
      endpointPath: "/mcp",
      maxRequestBytes: 16 * 1024,
      version: 1,
    });
    expect(buildLocalMcpDevEndpointConfig({ enabled: true, maxRequestBytes: 512 })).toMatchObject({
      enabled: true,
      localOnly: true,
      endpointPath: "/mcp",
      maxRequestBytes: 512,
      version: 1,
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
