import {
  buildMcpProductionToolsListResult,
  type McpProductionToolDescriptorV1,
} from "./mcpProductionToolsListProjection";
import { localMcpJsonSchemaMatches } from "./mcpLocalJsonSchemaMatcher";

export const MCP_PRODUCTION_TOOLS_CALL_READONLY_SYNTHETIC_RESULT_KIND =
  "mcp_production_tools_call_readonly_synthetic_result" as const;

export type McpProductionToolsCallBoundaryErrorCodeV1 =
  | "invalid_method"
  | "invalid_params"
  | "invalid_param_name"
  | "invalid_name"
  | "unknown_tool"
  | "invalid_arguments"
  | "invalid_meta"
  | "payload_too_large"
  | "payload_too_deep"
  | "payload_not_json";

export type McpProductionToolsCallBoundaryErrorV1 = Readonly<{
  code: McpProductionToolsCallBoundaryErrorCodeV1;
  message: string;
  safeForModel: true;
  version: 1;
}>;

export type McpProductionToolsCallBoundaryValidationV1 = Readonly<
  | {
      valid: true;
      method: "tools/call";
      tool: McpProductionToolDescriptorV1;
      params: Readonly<{
        name: string;
        arguments: Readonly<Record<string, unknown>>;
        argumentFields: readonly string[];
        progressTokenAccepted: boolean;
        rawArgumentsEchoed: false;
        metaEchoed: false;
        version: 1;
      }>;
      phase: "pr102_readonly_boundary_validation";
      version: 1;
    }
  | {
      valid: false;
      error: McpProductionToolsCallBoundaryErrorV1;
      phase: "pr102_readonly_boundary_validation";
      version: 1;
    }
>;

export type McpProductionToolsCallReadonlySyntheticResultV1 = Readonly<{
  content: readonly Readonly<{
    type: "text";
    text: string;
  }>[];
  structuredContent: Readonly<{
    kind: typeof MCP_PRODUCTION_TOOLS_CALL_READONLY_SYNTHETIC_RESULT_KIND;
    phase: "pr102_readonly_boundary_only";
    toolName: string;
    status: "validated_synthetic_summary_only";
    version: 1;
  }>;
}>;

const TOOLS_CALL_PARAM_KEYS = Object.freeze(["name", "arguments", "_meta"] as const);
const META_KEYS = Object.freeze(["progressToken"] as const);
const MAX_TOOLS_CALL_PARAMS_BYTES = 4_096;
const MAX_TOOLS_CALL_VALUE_DEPTH = 8;
const TEXT_ENCODER = new TextEncoder();

const ERROR_MESSAGES: Readonly<Record<McpProductionToolsCallBoundaryErrorCodeV1, string>> =
  Object.freeze({
    invalid_method: "Invalid tools/call method.",
    invalid_params: "Invalid tools/call params.",
    invalid_param_name: "Invalid tools/call params.",
    invalid_name: "Invalid tools/call tool name.",
    unknown_tool: "Unknown tools/call tool.",
    invalid_arguments: "Invalid tools/call arguments.",
    invalid_meta: "Invalid tools/call metadata.",
    payload_too_large: "tools/call params are too large.",
    payload_too_deep: "tools/call params are too deeply nested.",
    payload_not_json: "tools/call params must be JSON-serializable plain values.",
  });

export function validateMcpProductionToolsCallBoundary(input: Readonly<{
  method: string;
  params: unknown;
  toolsList?: Readonly<{ tools: readonly McpProductionToolDescriptorV1[] }>;
  version: 1;
}>): McpProductionToolsCallBoundaryValidationV1 {
  if (input.method !== "tools/call") return invalid("invalid_method");

  const jsonGuard = validateJsonPayload(input.params);
  if (jsonGuard !== "ok") return invalid(jsonGuard);
  const payloadBytes = serializedByteLength(input.params);
  if (payloadBytes === undefined) return invalid("payload_not_json");
  if (payloadBytes > MAX_TOOLS_CALL_PARAMS_BYTES) return invalid("payload_too_large");

  if (!isPlainRecord(input.params)) return invalid("invalid_params");
  if (!hasOnlyAllowedKeys(input.params, TOOLS_CALL_PARAM_KEYS)) return invalid("invalid_param_name");
  if (typeof input.params.name !== "string" || input.params.name.length === 0) {
    return invalid("invalid_name");
  }
  if (!isPlainRecord(input.params.arguments)) return invalid("invalid_arguments");
  if ("_meta" in input.params && !isSafeMeta(input.params._meta)) return invalid("invalid_meta");

  const tool = findProductionTool(input.params.name, input.toolsList);
  if (!tool) return invalid("unknown_tool");
  if (!localMcpJsonSchemaMatches(input.params.arguments, tool.inputSchema)) {
    return invalid("invalid_arguments");
  }

  return Object.freeze({
    valid: true,
    method: "tools/call",
    tool,
    params: Object.freeze({
      name: input.params.name,
      arguments: clonePlainRecord(input.params.arguments),
      argumentFields: Object.freeze(Object.keys(input.params.arguments).sort()),
      progressTokenAccepted: hasSafeProgressToken(input.params._meta),
      rawArgumentsEchoed: false,
      metaEchoed: false,
      version: 1,
    }),
    phase: "pr102_readonly_boundary_validation",
    version: 1,
  });
}

export function buildMcpProductionToolsCallReadonlySyntheticResult(
  validation: Extract<McpProductionToolsCallBoundaryValidationV1, { valid: true }>,
): McpProductionToolsCallReadonlySyntheticResultV1 {
  return Object.freeze({
    content: Object.freeze([
      Object.freeze({
        type: "text" as const,
        text:
          "Validated read-only boundary call. PR102 returns a synthetic summary only; no external action ran.",
      }),
    ]),
    structuredContent: Object.freeze({
      kind: MCP_PRODUCTION_TOOLS_CALL_READONLY_SYNTHETIC_RESULT_KIND,
      phase: "pr102_readonly_boundary_only",
      toolName: validation.tool.name,
      status: "validated_synthetic_summary_only",
      version: 1,
    }),
  });
}

export function messageForMcpProductionToolsCallBoundaryError(
  error: McpProductionToolsCallBoundaryErrorV1,
): string {
  return error.message;
}

function invalid(code: McpProductionToolsCallBoundaryErrorCodeV1): McpProductionToolsCallBoundaryValidationV1 {
  return Object.freeze({
    valid: false,
    error: Object.freeze({
      code,
      message: ERROR_MESSAGES[code],
      safeForModel: true,
      version: 1,
    }),
    phase: "pr102_readonly_boundary_validation",
    version: 1,
  });
}

function findProductionTool(
  name: string,
  toolsList: Readonly<{ tools: readonly McpProductionToolDescriptorV1[] }> = buildMcpProductionToolsListResult(),
): McpProductionToolDescriptorV1 | undefined {
  return toolsList.tools.find((tool) => tool.name === name);
}

type JsonPayloadValidationResult = "ok" | "payload_too_deep" | "payload_not_json";

function validateJsonPayload(value: unknown): "ok" | "payload_too_deep" | "payload_not_json" {
  return validateJsonValue(value, new WeakSet<object>(), 0);
}

function validateJsonValue(
  value: unknown,
  activePath: WeakSet<object>,
  depth: number,
): JsonPayloadValidationResult {
  if (depth > MAX_TOOLS_CALL_VALUE_DEPTH) return "payload_too_deep";
  const primitiveResult = validateJsonPrimitive(value);
  if (primitiveResult !== "object") return primitiveResult;
  const objectValue = value as object;
  const nestedValues = jsonContainerValues(objectValue);
  if (!nestedValues || activePath.has(objectValue)) return "payload_not_json";
  activePath.add(objectValue);
  const result = validateJsonChildren(nestedValues, activePath, depth);
  activePath.delete(objectValue);
  return result;
}

function validateJsonPrimitive(value: unknown): JsonPayloadValidationResult | "object" {
  if (value === null || typeof value === "string" || typeof value === "boolean") return "ok";
  if (typeof value === "number") return Number.isFinite(value) ? "ok" : "payload_not_json";
  return typeof value === "object" ? "object" : "payload_not_json";
}

function jsonContainerValues(value: object): readonly unknown[] | undefined {
  if (Array.isArray(value)) return value;
  return isPlainRecord(value) ? Object.values(value) : undefined;
}

function validateJsonChildren(
  values: readonly unknown[],
  activePath: WeakSet<object>,
  depth: number,
): JsonPayloadValidationResult {
  for (const nested of values) {
    const result = validateJsonValue(nested, activePath, depth + 1);
    if (result !== "ok") return result;
  }
  return "ok";
}

function serializedByteLength(value: unknown): number | undefined {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string") return undefined;
    return TEXT_ENCODER.encode(serialized).byteLength;
  } catch {
    return undefined;
  }
}

function isSafeMeta(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  return hasOnlyAllowedKeys(value, META_KEYS) && ("progressToken" in value ? isProgressToken(value.progressToken) : true);
}

function hasSafeProgressToken(value: unknown): boolean {
  return isPlainRecord(value) && "progressToken" in value && isProgressToken(value.progressToken);
}

function isProgressToken(value: unknown): boolean {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function clonePlainRecord(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return Object.freeze(
    Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneJsonValue(nested)])),
  );
}

function cloneJsonValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map(cloneJsonValue));
  return clonePlainRecord(value as Record<string, unknown>);
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
