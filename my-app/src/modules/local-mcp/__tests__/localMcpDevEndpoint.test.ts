import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpDevEndpointConfig,
  handleLocalMcpDevEndpointRequest,
} from "../localMcpDevEndpoint";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../localMcpDevEndpoint.ts");
const ENABLED_CONFIG = buildLocalMcpDevEndpointConfig({ enabled: true });

function implementationSource(): string {
  return readFileSync(SOURCE_FILE, "utf8");
}

function request(overrides: Record<string, unknown> = {}) {
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

describe("local MCP dev endpoint", () => {
  it("is disabled by default and does not handle /mcp without the explicit flag", () => {
    const response = handleLocalMcpDevEndpointRequest(request());

    expect(response).toMatchObject({
      handled: false,
      status: 404,
      json: {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32004,
          safeForModel: true,
          fixtureOnly: true,
          localDevOnly: true,
        },
      },
    });
  });

  it("handles enabled loopback POST JSON initialize requests with fixture-only capabilities", () => {
    const response = handleLocalMcpDevEndpointRequest(request(), ENABLED_CONFIG);
    const ipv6Response = handleLocalMcpDevEndpointRequest(
      request({ headers: { host: "[::1]:5173", "content-type": "application/json" }, remoteAddress: "::1" }),
      ENABLED_CONFIG,
    );

    expect(ipv6Response).toMatchObject({ handled: true, status: 200, json: { id: "request_1" } });
    expect(response).toEqual({
      handled: true,
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
      json: {
        jsonrpc: "2.0",
        id: "request_1",
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

  it("returns fixture-only tools/list data without callable or runnable behavior", () => {
    const response = handleLocalMcpDevEndpointRequest(
      request({ bodyText: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) }),
      ENABLED_CONFIG,
    );

    expect(response).toMatchObject({ handled: true, status: 200 });
    expect(response.json).toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      result: {
        kind: "local_mcp_tools_list_fixture_response",
        success: true,
        fixtureOnly: true,
        callable: false,
        runnable: false,
        networkReachable: false,
        toolCount: 4,
      },
    });
  });

  it("refuses tools/call instead of running a handler", () => {
    const response = handleLocalMcpDevEndpointRequest(
      request({
        bodyText: JSON.stringify({
          jsonrpc: "2.0",
          id: "call_1",
          method: "tools/call",
          params: {
            name: "twoweeks.application_package.summarize",
            arguments: { applicationPackageRef: { id: "pkg_1" } },
          },
        }),
      }),
      ENABLED_CONFIG,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 200,
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

  it("blocks non-local hosts and non-loopback addresses", () => {
    const remoteHost = handleLocalMcpDevEndpointRequest(request({ headers: { host: "example.com", "content-type": "application/json" } }), ENABLED_CONFIG);
    const remoteAddress = handleLocalMcpDevEndpointRequest(request({ remoteAddress: "10.0.0.2" }), ENABLED_CONFIG);

    expect(remoteHost).toMatchObject({ handled: true, status: 403, json: { error: { code: -32003 } } });
    expect(remoteAddress).toMatchObject({ handled: true, status: 403, json: { error: { code: -32003 } } });
  });

  it("rejects non-POST, non-JSON, malformed, oversized, and unknown-method requests safely", () => {
    expect(handleLocalMcpDevEndpointRequest(request({ method: "GET" }), ENABLED_CONFIG)).toMatchObject({
      handled: true,
      status: 405,
      json: { error: { code: -32005 } },
    });
    expect(
      handleLocalMcpDevEndpointRequest(request({ headers: { host: "localhost", "content-type": "text/plain" } }), ENABLED_CONFIG),
    ).toMatchObject({ handled: true, status: 415, json: { error: { code: -32015 } } });
    expect(handleLocalMcpDevEndpointRequest(request({ bodyText: "{" }), ENABLED_CONFIG)).toMatchObject({
      handled: true,
      status: 400,
      json: { error: { code: -32700 } },
    });
    expect(
      handleLocalMcpDevEndpointRequest(
        request({ bodyText: JSON.stringify({ jsonrpc: "2.0", id: "big", method: "initialize", pad: "x".repeat(128) }) }),
        buildLocalMcpDevEndpointConfig({ enabled: true, maxRequestBytes: 64 }),
      ),
    ).toMatchObject({ handled: true, status: 413, json: { error: { code: -32013 } } });
    expect(
      handleLocalMcpDevEndpointRequest(
        request({ bodyText: JSON.stringify({ jsonrpc: "2.0", id: "missing", method: "prompts/list" }) }),
        ENABLED_CONFIG,
      ),
    ).toMatchObject({ handled: true, status: 200, json: { error: { code: -32601 } } });
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
    ] as const;

    for (const fragment of forbiddenFragments) {
      expect(source).not.toContain(fragment);
    }
  });
});
