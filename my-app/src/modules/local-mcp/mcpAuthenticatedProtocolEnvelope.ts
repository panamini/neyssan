export type McpJsonRpcIdV1 = string | number | null;

export type McpJsonRpcProtocolRequestV1 = Readonly<{
  jsonrpc: "2.0";
  id: McpJsonRpcIdV1;
  method: string;
  params?: unknown;
}>;

export type McpJsonRpcInitializedNotificationV1 = Readonly<{
  jsonrpc: "2.0";
  method: "notifications/initialized";
  params?: unknown;
}>;

export type McpJsonRpcProtocolMessageV1 =
  | McpJsonRpcProtocolRequestV1
  | McpJsonRpcInitializedNotificationV1;

export type McpAuthenticatedProtocolEnvelopeV1 = Readonly<{
  kind: "mcp_authenticated_protocol_envelope";
  authenticated: true;
  verifiedClientId: string;
  verifiedResource: string;
  verifiedScopes: readonly string[];
  accessTokenExpiresAt: number;
  quotaCallerKey: string;
  canonicalRemoteAddress: string;
  jsonRpc: Readonly<{
    method: string;
    hasId: boolean;
    id?: McpJsonRpcIdV1;
    params?: unknown;
    version: 1;
  }>;
  createdAt: number;
  modelVisible: false;
  safeForLogging: false;
  version: 1;
}>;

export function buildMcpAuthenticatedProtocolEnvelope(input: Readonly<{
  verifiedClientId: string;
  verifiedResource: string;
  verifiedScopes: readonly string[];
  accessTokenExpiresAt: number;
  callerKey: string;
  jsonRpcMessage: McpJsonRpcProtocolMessageV1;
  createdAt: number;
}>): McpAuthenticatedProtocolEnvelopeV1 {
  const hasId = "id" in input.jsonRpcMessage;
  if ("params" in input.jsonRpcMessage) {
    assertJsonSerializablePlainValue(input.jsonRpcMessage.params);
  }
  const params = "params" in input.jsonRpcMessage
    ? { params: cloneAndFreezeJsonValue(input.jsonRpcMessage.params) }
    : {};

  const jsonRpc = Object.freeze({
    method: input.jsonRpcMessage.method,
    hasId,
    ...(hasId ? { id: input.jsonRpcMessage.id } : {}),
    ...params,
    version: 1 as const,
  }) satisfies McpAuthenticatedProtocolEnvelopeV1["jsonRpc"];

  return Object.freeze({
    kind: "mcp_authenticated_protocol_envelope",
    authenticated: true,
    verifiedClientId: input.verifiedClientId,
    verifiedResource: input.verifiedResource,
    verifiedScopes: Object.freeze([...input.verifiedScopes]),
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    quotaCallerKey: input.callerKey,
    canonicalRemoteAddress: input.callerKey,
    jsonRpc,
    createdAt: input.createdAt,
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

export function parseMcpJsonRpcProtocolMessage(bodyText: string): McpJsonRpcProtocolMessageV1 | undefined {
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (!isPlainRecord(parsed)) return undefined;
    if (parsed.jsonrpc !== "2.0" || typeof parsed.method !== "string") return undefined;
    if (parsed.method === "notifications/initialized") {
      if (!hasOnlyAllowedKeys(parsed, ["jsonrpc", "method", "params"])) return undefined;
      return Object.freeze({
        jsonrpc: "2.0",
        method: "notifications/initialized" as const,
        ...("params" in parsed ? { params: cloneAndFreezeJsonValue(parsed.params) } : {}),
      });
    }
    if (!hasOnlyAllowedKeys(parsed, ["jsonrpc", "id", "method", "params"])) return undefined;
    if (!isJsonRpcId(parsed.id)) return undefined;
    return Object.freeze({
      jsonrpc: "2.0",
      id: parsed.id,
      method: parsed.method,
      ...("params" in parsed ? { params: cloneAndFreezeJsonValue(parsed.params) } : {}),
    });
  } catch {
    return undefined;
  }
}

function cloneAndFreezeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(cloneAndFreezeJsonValue));
  }
  if (isPlainRecord(value)) {
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, cloneAndFreezeJsonValue(nestedValue)])),
    );
  }
  return value;
}

function assertJsonSerializablePlainValue(value: unknown): void {
  if (!isJsonSerializablePlainValue(value, new WeakSet<object>())) {
    throw new TypeError("MCP JSON-RPC params must be JSON-serializable plain values");
  }
}

function isJsonSerializablePlainValue(value: unknown, activePath: WeakSet<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (activePath.has(value)) return false;
  activePath.add(value);
  let isSerializable: boolean;
  if (Array.isArray(value)) {
    isSerializable = value.every((item) => isJsonSerializablePlainValue(item, activePath));
  } else if (isPlainRecord(value)) {
    isSerializable = Object.values(value).every((item) => isJsonSerializablePlainValue(item, activePath));
  } else {
    isSerializable = false;
  }
  activePath.delete(value);
  return isSerializable;
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isJsonRpcId(value: unknown): value is McpJsonRpcIdV1 {
  return value === null || typeof value === "string" || (typeof value === "number" && Number.isInteger(value));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
