import {
  buildMcpProductionToolsListResult,
  type McpProductionToolDescriptorV1,
} from "./mcpProductionToolsListProjection";
import type { LocalMcpJsonSchemaV1 } from "./mcpSchemaProjection";

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
    validation: Readonly<{
      schemaMatched: true;
      rawArgumentsEchoed: false;
      progressTokenEchoed: false;
      version: 1;
    }>;
    effects: Readonly<{
      externalServiceCalled: false;
      writeActionPerformed: false;
      outboundNetworkCalled: false;
      modelCalled: false;
      accountLinkLifecycleTouched: false;
      refreshTokenTouched: false;
      realProductDataRead: false;
      exportSendSubmitApplyDownloadPerformed: false;
      version: 1;
    }>;
    publicOutput: Readonly<{
      rawUserDocumentTextIncluded: false;
      privateOrNeverUseTextIncluded: false;
      sourceTextIncluded: false;
      diagnosticTraceIncluded: false;
      implementationNameIncluded: false;
      internalIdsIncluded: false;
      version: 1;
    }>;
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
  if (!matchesJsonSchema(input.params.arguments, tool.inputSchema)) {
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
          "Validated read-only boundary call. PR102 returns a synthetic summary only; no external service, write, real data, export, send, submit, apply, download, network, model, account-link, or refresh-token behavior ran.",
      }),
    ]),
    structuredContent: Object.freeze({
      kind: MCP_PRODUCTION_TOOLS_CALL_READONLY_SYNTHETIC_RESULT_KIND,
      phase: "pr102_readonly_boundary_only",
      toolName: validation.tool.name,
      status: "validated_synthetic_summary_only",
      validation: Object.freeze({
        schemaMatched: true,
        rawArgumentsEchoed: false,
        progressTokenEchoed: false,
        version: 1,
      }),
      effects: Object.freeze({
        externalServiceCalled: false,
        writeActionPerformed: false,
        outboundNetworkCalled: false,
        modelCalled: false,
        accountLinkLifecycleTouched: false,
        refreshTokenTouched: false,
        realProductDataRead: false,
        exportSendSubmitApplyDownloadPerformed: false,
        version: 1,
      }),
      publicOutput: Object.freeze({
        rawUserDocumentTextIncluded: false,
        privateOrNeverUseTextIncluded: false,
        sourceTextIncluded: false,
        diagnosticTraceIncluded: false,
        implementationNameIncluded: false,
        internalIdsIncluded: false,
        version: 1,
      }),
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

function matchesJsonSchema(value: unknown, schema: LocalMcpJsonSchemaV1): boolean {
  if (!matchesSchemaLiteralGuards(value, schema)) return false;
  const matcher = schema.type ? JSON_SCHEMA_TYPE_MATCHERS[schema.type] : undefined;
  return matcher ? matcher(value, schema) : false;
}

function matchesObjectSchema(value: unknown, schema: LocalMcpJsonSchemaV1): boolean {
  if (!isPlainRecord(value)) return false;
  const properties = schema.properties;
  const required = schema.required;
  if (!properties || !required) return false;
  return (
    hasRequiredKeys(value, required) &&
    hasNoExtraObjectKeys(value, properties, schema.additionalProperties) &&
    matchesDeclaredProperties(value, properties)
  );
}

type JsonSchemaTypeMatcher = (value: unknown, schema: LocalMcpJsonSchemaV1) => boolean;

const JSON_SCHEMA_TYPE_MATCHERS: Readonly<Record<NonNullable<LocalMcpJsonSchemaV1["type"]>, JsonSchemaTypeMatcher>> =
  Object.freeze({
    object: matchesObjectSchema,
    string: matchesStringSchema,
    number: matchesFiniteNumberSchema,
    integer: matchesSafeIntegerSchema,
    boolean: matchesBooleanSchema,
  });

function matchesSchemaLiteralGuards(value: unknown, schema: LocalMcpJsonSchemaV1): boolean {
  const constMatches = !("const" in schema) || value === schema.const;
  const enumMatches = !schema.enum || (typeof value === "string" && schema.enum.includes(value));
  return constMatches && enumMatches;
}

function matchesStringSchema(value: unknown, schema: LocalMcpJsonSchemaV1): boolean {
  return typeof value === "string" && (schema.minLength === undefined || value.length >= schema.minLength);
}

function matchesFiniteNumberSchema(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function matchesSafeIntegerSchema(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function matchesBooleanSchema(value: unknown): boolean {
  return typeof value === "boolean";
}

function hasRequiredKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  return required.every((key) => key in value);
}

function hasNoExtraObjectKeys(
  value: Record<string, unknown>,
  properties: NonNullable<LocalMcpJsonSchemaV1["properties"]>,
  additionalProperties: LocalMcpJsonSchemaV1["additionalProperties"],
): boolean {
  return additionalProperties !== false || hasOnlyAllowedKeys(value, Object.keys(properties));
}

function matchesDeclaredProperties(
  value: Record<string, unknown>,
  properties: NonNullable<LocalMcpJsonSchemaV1["properties"]>,
): boolean {
  return Object.entries(properties).every(([key, nestedSchema]) => !(key in value) || matchesJsonSchema(value[key], nestedSchema));
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
