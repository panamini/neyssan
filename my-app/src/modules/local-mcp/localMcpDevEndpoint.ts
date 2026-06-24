import { simulateLocalMcpToolsListFixture } from "./localMcpToolsListFixture";

export type LocalMcpDevEndpointConfigV1 = Readonly<{
  kind: "local_mcp_dev_endpoint_config";
  enabled: boolean;
  fixtureDemoEnabled: boolean;
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
const SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"] as const;
const FIXTURE_DEMO_TOOLS: readonly Readonly<{
  name: string;
  localToolId: string;
  arguments: Readonly<Record<string, Readonly<{ id: string }>>>;
}>[] = [
  {
    name: "twoweeks.application_package.summarize",
    localToolId: "local_mcp.application_package.summarize",
    arguments: { applicationPackageRef: { id: "fixture-application-package" } },
  },
  {
    name: "twoweeks.evidence_graph.summarize",
    localToolId: "local_mcp.evidence_graph.summarize",
    arguments: { evidenceGraphRef: { id: "fixture-evidence-graph" } },
  },
  {
    name: "twoweeks.resume_variant_plan.summarize",
    localToolId: "local_mcp.resume_variant_plan.summarize",
    arguments: { resumeVariantPlanRef: { id: "fixture-resume-variant-plan" } },
  },
  {
    name: "twoweeks.review_cockpit.summarize",
    localToolId: "local_mcp.review_cockpit.summarize",
    arguments: { reviewCockpitRef: { id: "fixture-review-cockpit" } },
  },
] as const;
const FIXTURE_ARGUMENTS_BY_TOOL: Readonly<Record<string, Readonly<Record<string, Readonly<{ id: string }>>>>> = Object.fromEntries(
  FIXTURE_DEMO_TOOLS.map((tool) => [tool.name, tool.arguments]),
);
const FIXTURE_LOCAL_TOOL_ID_BY_TOOL: Readonly<Record<string, string>> = Object.fromEntries(
  FIXTURE_DEMO_TOOLS.map((tool) => [tool.name, tool.localToolId]),
);
const WRITE_ACTION_TERMS = ["apply", "submit", "send", "export", "download", "auto-apply"] as const;
const RAW_PRIVATE_TEXT_TERMS = ["raw cv", "raw resume", "raw résumé", "raw job", "cover letter body", "private facts", "never_use"] as const;
const FORBIDDEN_ARGUMENT_KEYS: readonly string[] = [
  "accountId",
  "applicationId",
  "candidateId",
  "clerkUserId",
  ["con", "vexUserId"].join(""),
  "coverLetter",
  "cvText",
  "jobDescription",
  "messageBody",
  "oauthToken",
  "rawCoverLetter",
  "rawCv",
  "rawJob",
  "rawResume",
  "resumeText",
  "url",
  "userId",
] as const;

export function buildLocalMcpDevEndpointConfig(
  input: Readonly<{ enabled?: boolean; fixtureDemoEnabled?: boolean; maxRequestBytes?: number }> = {},
): LocalMcpDevEndpointConfigV1 {
  const config: LocalMcpDevEndpointConfigV1 = {
    kind: "local_mcp_dev_endpoint_config",
    enabled: input.enabled === true,
    fixtureDemoEnabled: input.enabled === true && input.fixtureDemoEnabled === true,
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
  assertExactKeys(
    record,
    ["kind", "enabled", "fixtureDemoEnabled", "localOnly", "endpointPath", "maxRequestBytes", "version"],
    "Local MCP dev endpoint config",
  );
  if (record.kind !== "local_mcp_dev_endpoint_config") {
    throw new TypeError("Local MCP dev endpoint config kind is invalid");
  }
  if (typeof record.enabled !== "boolean") {
    throw new TypeError("Local MCP dev endpoint enabled flag must be boolean");
  }
  if (typeof record.fixtureDemoEnabled !== "boolean" || (record.fixtureDemoEnabled === true && record.enabled !== true)) {
    throw new TypeError("Local MCP dev endpoint fixture demo flag must be boolean and require the endpoint flag");
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
  if (!hasJsonRpcRequestId(parsed)) {
    return buildResponse(true, 202, null);
  }

  return buildResponse(true, 200, handleJsonRpc(parsed, config));
}

function handleJsonRpc(request: JsonRpcRequestWithId, config: LocalMcpDevEndpointConfigV1): unknown {
  switch (request.method) {
    case "initialize":
      {
        const initializeError = validateInitializeParams(request.params);
        if (initializeError) return safeError(request.id, initializeError.code, initializeError.message);
      }
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
          fixtureDemoEnabled: config.fixtureDemoEnabled,
        },
      };
    case "notifications/initialized":
      return safeError(request.id, -32600, "Invalid JSON-RPC notification.");
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: simulateLocalMcpToolsListFixture(),
      };
    case "tools/call":
      return handleToolsCallJsonRpc(request, config);
    default:
      return safeError(request.id, -32601, "Method not found.");
  }
}

type JsonRpcRequest = JsonRpcRequestWithId | JsonRpcNotification;

type JsonRpcRequestWithId = Readonly<{
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}>;

type JsonRpcNotification = Readonly<{
  jsonrpc: "2.0";
  method: "notifications/initialized";
  params?: unknown;
}>;

function parseJsonRpcRequest(bodyText: string): JsonRpcRequest | undefined {
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (!isPlainRecord(parsed)) return undefined;
    if (parsed.jsonrpc !== "2.0" || typeof parsed.method !== "string") return undefined;
    const allowedKeys = parsed.method === "notifications/initialized" ? ["jsonrpc", "method", "params"] : ["jsonrpc", "id", "method", "params"];
    if (!hasOnlyAllowedKeys(parsed, allowedKeys)) return undefined;
    if (parsed.method === "notifications/initialized") {
      return {
        jsonrpc: "2.0",
        method: parsed.method,
        ...("params" in parsed ? { params: parsed.params } : {}),
      };
    }
    if (!isJsonRpcId(parsed.id)) return undefined;
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

function hasJsonRpcRequestId(request: JsonRpcRequest): request is JsonRpcRequestWithId {
  return "id" in request;
}

function validateInitializeParams(params: unknown): Readonly<{ code: number; message: string }> | undefined {
  if (params === undefined) return undefined;
  if (!isPlainRecord(params) || !hasOnlyAllowedKeys(params, ["protocolVersion", "capabilities", "clientInfo"])) {
    return { code: -32602, message: "Invalid initialize request." };
  }
  if (params.protocolVersion !== undefined) {
    if (typeof params.protocolVersion !== "string") return { code: -32602, message: "Invalid initialize request." };
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(params.protocolVersion as (typeof SUPPORTED_PROTOCOL_VERSIONS)[number])) {
      return { code: -32002, message: "Unsupported MCP protocol version." };
    }
  }
  if (params.capabilities !== undefined && !isPlainRecord(params.capabilities)) {
    return { code: -32602, message: "Invalid initialize request." };
  }
  if (params.clientInfo !== undefined) {
    if (!isPlainRecord(params.clientInfo)) return { code: -32602, message: "Invalid initialize request." };
    if (params.clientInfo.name !== undefined && typeof params.clientInfo.name !== "string") {
      return { code: -32602, message: "Invalid initialize request." };
    }
    if (params.clientInfo.version !== undefined && typeof params.clientInfo.version !== "string") {
      return { code: -32602, message: "Invalid initialize request." };
    }
  }
  return undefined;
}

function handleToolsCallJsonRpc(request: JsonRpcRequestWithId, config: LocalMcpDevEndpointConfigV1): unknown {
  if (!config.fixtureDemoEnabled) {
    return safeError(request.id, -32020, "Local dev MCP endpoint does not run tool handlers.");
  }

  const validation = validateFixtureDemoToolsCallParams(request.params);
  if (!validation.valid) {
    return safeError(request.id, -32602, validation.message);
  }

  return {
    jsonrpc: "2.0",
    id: request.id,
    result: buildFixtureDemoToolResult(validation.name),
  };
}

type FixtureDemoToolsCallValidation =
  | Readonly<{ valid: true; name: string; arguments: Readonly<Record<string, unknown>> }>
  | Readonly<{ valid: false; message: string }>;

function validateFixtureDemoToolsCallParams(params: unknown): FixtureDemoToolsCallValidation {
  if (!isPlainRecord(params) || !hasOnlyAllowedKeys(params, ["name", "arguments"]) || typeof params.name !== "string") {
    return { valid: false, message: "Invalid tools/call request." };
  }
  if (!hasOwn(FIXTURE_ARGUMENTS_BY_TOOL, params.name)) {
    return { valid: false, message: "Unknown fixture tool." };
  }
  if (!isPlainRecord(params.arguments)) {
    return { valid: false, message: "Invalid fixture arguments." };
  }

  const unsafeMessage = unsafeFixtureArgumentMessage(params.arguments);
  if (unsafeMessage) return { valid: false, message: unsafeMessage };

  const expectedArguments = FIXTURE_ARGUMENTS_BY_TOOL[params.name];
  if (!sameJson(params.arguments, expectedArguments)) {
    return { valid: false, message: "Invalid fixture arguments." };
  }

  return {
    valid: true,
    name: params.name,
    arguments: clonePlainRecord(params.arguments),
  };
}

function buildFixtureDemoToolResult(toolName: string): unknown {
  const localToolId = FIXTURE_LOCAL_TOOL_ID_BY_TOOL[toolName];
  const summary = `Fixture-only tools/call accepted for ${localToolId}. No product action executed.`;
  const structuredContent = {
    kind: "twoweeks_local_mcp_fixture_tool_result",
    fixtureOnly: true,
    localDevOnly: true,
    noRealUserData: true,
    toolName,
    localToolId,
    result: {
      kind: "local_mcp_safe_text_fixture_output",
      status: "safe_summary_only",
      summary,
      refIds: [`fixture:${localToolId}`],
      version: 1,
    },
    version: 1,
  };

  return {
    content: [{ type: "text", text: summary }],
    structuredContent,
  };
}

function unsafeFixtureArgumentMessage(value: unknown, key = ""): string | undefined {
  if (FORBIDDEN_ARGUMENT_KEYS.includes(key)) {
    return "Refused. Private identifier or raw document input blocked.";
  }
  if (typeof value === "string") {
    const normalized = value.normalize("NFKC").toLowerCase();
    if (/https?:\/\//u.test(normalized)) return "Refused. External URL input blocked.";
    if (WRITE_ACTION_TERMS.some((term) => normalized.includes(term))) return "Refused. Write action blocked.";
    if (RAW_PRIVATE_TEXT_TERMS.some((term) => normalized.includes(term))) return "Refused. Raw private document input blocked.";
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const itemMessage = unsafeFixtureArgumentMessage(item);
      if (itemMessage) return itemMessage;
    }
    return undefined;
  }
  if (isPlainRecord(value)) {
    for (const [childKey, childValue] of Object.entries(value)) {
      const childMessage = unsafeFixtureArgumentMessage(childValue, childKey);
      if (childMessage) return childMessage;
    }
  }
  return undefined;
}

function clonePlainRecord(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)]));
}

function cloneJsonValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (isPlainRecord(value)) return clonePlainRecord(value);
  return null;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
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
