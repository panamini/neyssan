import { simulateLocalMcpToolsListFixture } from "./localMcpToolsListFixture";

export type LocalMcpDevEndpointConfigV1 = Readonly<{
  kind: "local_mcp_dev_endpoint_config";
  enabled: boolean;
  localOnly: true;
  endpointPath: "/mcp";
  maxRequestBytes: number;
  version: 1;
}>;

export type LocalMcpDevEndpointRequestV1 = Readonly<{
  method: string;
  path: string;
  headers: Readonly<Record<string, string | undefined>>;
  remoteAddress?: string;
  bodyText?: string;
}>;

export type LocalMcpDevEndpointResponseV1 = Readonly<{
  handled: boolean;
  status: number;
  headers: Readonly<Record<string, string>>;
  json: unknown;
}>;

const DEFAULT_MAX_REQUEST_BYTES = 16 * 1024;
const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
});

export function buildLocalMcpDevEndpointConfig(
  input: Readonly<{ enabled?: boolean; maxRequestBytes?: number }> = {},
): LocalMcpDevEndpointConfigV1 {
  const config: LocalMcpDevEndpointConfigV1 = {
    kind: "local_mcp_dev_endpoint_config",
    enabled: input.enabled === true,
    localOnly: true,
    endpointPath: "/mcp",
    maxRequestBytes: input.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES,
    version: 1,
  };

  assertLocalMcpDevEndpointConfig(config);
  return Object.freeze({ ...config });
}

function assertLocalMcpDevEndpointConfig(config: LocalMcpDevEndpointConfigV1): void {
  const record = asPlainRecord(config, "Local MCP dev endpoint config must be an object");
  assertExactKeys(record, ["kind", "enabled", "localOnly", "endpointPath", "maxRequestBytes", "version"], "Local MCP dev endpoint config");
  if (record.kind !== "local_mcp_dev_endpoint_config") {
    throw new TypeError("Local MCP dev endpoint config kind is invalid");
  }
  if (typeof record.enabled !== "boolean") {
    throw new TypeError("Local MCP dev endpoint enabled flag must be boolean");
  }
  if (record.localOnly !== true || record.endpointPath !== "/mcp") {
    throw new TypeError("Local MCP dev endpoint must stay local-only on the fixed dev path");
  }
  if (typeof record.maxRequestBytes !== "number" || !Number.isInteger(record.maxRequestBytes) || record.maxRequestBytes <= 0) {
    throw new TypeError("Local MCP dev endpoint max request bytes must be a positive integer");
  }
  if (record.version !== 1) {
    throw new TypeError("Local MCP dev endpoint config version must be 1");
  }
}

export function handleLocalMcpDevEndpointRequest(
  request: LocalMcpDevEndpointRequestV1,
  config: LocalMcpDevEndpointConfigV1 = buildLocalMcpDevEndpointConfig(),
): LocalMcpDevEndpointResponseV1 {
  assertLocalMcpDevEndpointConfig(config);
  if (request.path !== config.endpointPath || !config.enabled) {
    return buildResponse(false, 404, safeError(null, -32004, "Local dev MCP endpoint is disabled."));
  }
  if (!isLocalRequest(request)) {
    return buildResponse(true, 403, safeError(requestIdFromBody(request.bodyText), -32003, "Local dev MCP endpoint only accepts loopback requests."));
  }
  if (request.method.toUpperCase() !== "POST") {
    return buildResponse(true, 405, safeError(requestIdFromBody(request.bodyText), -32005, "Local dev MCP endpoint only accepts POST."));
  }
  if (!isJsonContentType(request.headers["content-type"])) {
    return buildResponse(true, 415, safeError(null, -32015, "Local dev MCP endpoint only accepts JSON."));
  }
  if (byteLength(request.bodyText ?? "") > config.maxRequestBytes) {
    return buildResponse(true, 413, safeError(null, -32013, "Local dev MCP endpoint request is too large."));
  }

  const parsed = parseJsonRpcRequest(request.bodyText ?? "");
  if (!parsed) {
    return buildResponse(true, 400, safeError(null, -32700, "Invalid JSON-RPC request."));
  }

  return buildResponse(true, 200, handleJsonRpc(parsed));
}

function handleJsonRpc(request: JsonRpcRequest): unknown {
  switch (request.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: request.id,
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
      };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: simulateLocalMcpToolsListFixture(),
      };
    case "tools/call":
      return safeError(request.id, -32020, "Local dev MCP endpoint does not run tool handlers.");
    default:
      return safeError(request.id, -32601, "Method not found.");
  }
}

type JsonRpcRequest = Readonly<{
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}>;

function parseJsonRpcRequest(bodyText: string): JsonRpcRequest | undefined {
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (!isPlainRecord(parsed)) return undefined;
    if (parsed.jsonrpc !== "2.0" || !isJsonRpcId(parsed.id) || typeof parsed.method !== "string") return undefined;
    return {
      jsonrpc: "2.0",
      id: parsed.id,
      method: parsed.method,
      ...("params" in parsed ? { params: parsed.params } : {}),
    };
  } catch {
    return undefined;
  }
}

function requestIdFromBody(bodyText: string | undefined): string | number | null {
  if (!bodyText || byteLength(bodyText) > DEFAULT_MAX_REQUEST_BYTES) return null;
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    return isPlainRecord(parsed) && isJsonRpcId(parsed.id) ? parsed.id : null;
  } catch {
    return null;
  }
}

function safeError(id: string | number | null, code: number, message: string): unknown {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      safeForModel: true,
      fixtureOnly: true,
      localDevOnly: true,
    },
  };
}

function buildResponse(handled: boolean, status: number, json: unknown): LocalMcpDevEndpointResponseV1 {
  return Object.freeze({
    handled,
    status,
    headers: JSON_HEADERS,
    json,
  });
}

function isLocalRequest(request: LocalMcpDevEndpointRequestV1): boolean {
  const host = normalizeHost(request.headers.host);
  const remoteAddress = request.remoteAddress ?? "";
  return isLocalHost(host) && isLoopbackAddress(remoteAddress);
}

function normalizeHost(value: string | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.startsWith("[")) {
    return normalized.replace(/^\[/u, "").replace(/\](?::\d+)?$/u, "");
  }
  return normalized.replace(/:\d+$/u, "");
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isLoopbackAddress(value: string): boolean {
  return value === "::1" || value === "127.0.0.1" || value.startsWith("127.") || value.startsWith("::ffff:127.");
}

function isJsonContentType(value: string | undefined): boolean {
  return (value ?? "").toLowerCase().split(";")[0].trim() === "application/json";
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isJsonRpcId(value: unknown): value is string | number | null {
  return value === null || typeof value === "string" || (typeof value === "number" && Number.isInteger(value));
}

function assertExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[], label: string): void {
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== expectedKeys.length || !expectedKeys.every((key) => actualKeys.includes(key))) {
    throw new TypeError(`${label} must not contain extra or missing fields`);
  }
}

function asPlainRecord(value: unknown, message = "Expected object"): Record<string, unknown> {
  if (!isPlainRecord(value)) {
    throw new TypeError(message);
  }
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
