import type {
  InternalToolInputKindV1,
  InternalToolRiskLevelV1,
} from "../internal-tool-contracts/schema";
import type {
  LocalMcpApprovalV1,
  LocalMcpToolIdV1,
  LocalMcpToolRegistryV1,
} from "./schema";
import { buildLocalMcpToolRegistry } from "./toolRegistry";

export type LocalMcpProjectedToolNameV1 =
  | "twoweeks.application_package.summarize"
  | "twoweeks.evidence_graph.summarize"
  | "twoweeks.resume_variant_plan.summarize"
  | "twoweeks.review_cockpit.summarize";

export type LocalMcpCallEnvelopeV1 = Readonly<{
  kind: "local_mcp_call_envelope";
  toolName: string;
  arguments: Readonly<Record<string, unknown>>;
  user: Readonly<{
    userId: string;
    sessionId?: string;
  }>;
  approval?: LocalMcpApprovalV1;
  requestId?: string;
  version: 1;
}>;

export type LocalMcpCallErrorCodeV1 =
  | "invalid_request"
  | "unknown_tool"
  | "invalid_tool_name"
  | "invalid_arguments"
  | "missing_user"
  | "approval_required"
  | "tool_not_allowlisted"
  | "output_too_large"
  | "privacy_filter_required"
  | "handler_unavailable"
  | "timeout"
  | "rate_limited"
  | "internal_error";

export type LocalMcpCallErrorV1 = Readonly<{
  code: LocalMcpCallErrorCodeV1;
  message: string;
  retryable: boolean;
  safeForModel: boolean;
  version: 1;
}>;

export type LocalMcpCallErrorResultV1 = Readonly<{
  kind: "local_mcp_call_error_result";
  content: readonly Readonly<{
    type: "text";
    text: string;
  }>[];
  structuredContent: Readonly<{
    error: Readonly<{
      code: LocalMcpCallErrorCodeV1;
      retryable: boolean;
      version: 1;
    }>;
    version: 1;
  }>;
  isError: true;
  version: 1;
}>;

export type LocalMcpCallToolResultV1 = LocalMcpCallErrorResultV1;

export type LocalMcpCallResponseEnvelopeV1 = Readonly<{
  success: boolean;
  toolName: string;
  localToolId?: LocalMcpToolIdV1;
  result?: LocalMcpCallToolResultV1;
  error?: LocalMcpCallErrorV1;
  version: 1;
}>;

export type LocalMcpCallValidationResultV1 = Readonly<
  | {
      valid: true;
      toolName: LocalMcpProjectedToolNameV1;
      localToolId: LocalMcpToolIdV1;
      version: 1;
    }
  | {
      valid: false;
      error: LocalMcpCallErrorV1;
      version: 1;
    }
>;

const PROJECTED_TO_LOCAL_TOOL_ID: Readonly<Record<LocalMcpProjectedToolNameV1, LocalMcpToolIdV1>> = {
  "twoweeks.application_package.summarize": "local_mcp.application_package.summarize",
  "twoweeks.evidence_graph.summarize": "local_mcp.evidence_graph.summarize",
  "twoweeks.resume_variant_plan.summarize": "local_mcp.resume_variant_plan.summarize",
  "twoweeks.review_cockpit.summarize": "local_mcp.review_cockpit.summarize",
} as const;

const LOCAL_TOOL_ID_TO_PROJECTED = Object.fromEntries(
  Object.entries(PROJECTED_TO_LOCAL_TOOL_ID).map(([toolName, localToolId]) => [localToolId, toolName]),
) as Readonly<Record<LocalMcpToolIdV1, LocalMcpProjectedToolNameV1>>;

const INPUT_KIND_TO_FIELD: Readonly<Partial<Record<InternalToolInputKindV1, string>>> = {
  application_package_ref: "applicationPackageRef",
  evidence_graph_ref: "evidenceGraphRef",
  resume_variant_plan_ref: "resumeVariantPlanRef",
  review_cockpit_ref: "reviewCockpitRef",
};

const ERROR_MESSAGES: Readonly<Record<LocalMcpCallErrorCodeV1, string>> = {
  invalid_request: "The tool call envelope is malformed.",
  unknown_tool: "The requested tool is not available.",
  invalid_tool_name: "The requested tool name is invalid.",
  invalid_arguments: "The tool arguments do not match the declared schema.",
  missing_user: "A user identity is required for this tool call.",
  approval_required: "User approval is required before this tool can be called.",
  tool_not_allowlisted: "The requested tool is not allowlisted.",
  output_too_large: "The tool output is too large to return safely.",
  privacy_filter_required: "A privacy filter is required before returning this result.",
  handler_unavailable: "No real handler is available for this local dry-run tool.",
  timeout: "The tool call timed out.",
  rate_limited: "The tool call is rate limited.",
  internal_error: "The tool call failed safely.",
} as const;

export function projectedToolNameToLocalToolId(name: string): LocalMcpToolIdV1 | undefined {
  return isProjectedToolName(name) ? PROJECTED_TO_LOCAL_TOOL_ID[name] : undefined;
}

export function localToolIdToProjectedToolName(
  toolId: LocalMcpToolIdV1,
): LocalMcpProjectedToolNameV1 {
  return LOCAL_TOOL_ID_TO_PROJECTED[toolId];
}

export function parseLocalMcpCallEnvelope(value: unknown): LocalMcpCallEnvelopeV1 | undefined {
  if (!isPlainRecord(value)) return undefined;
  if (value.kind !== "local_mcp_call_envelope") return undefined;
  if (value.version !== 1) return undefined;
  if (!isNonEmptyString(value.toolName)) return undefined;
  if (!isPlainRecord(value.arguments) || !isCloneableLocalValue(value.arguments)) return undefined;
  if (!isPlainRecord(value.user) || !isNonEmptyString(value.user.userId)) return undefined;
  if (value.user.sessionId !== undefined && !isNonEmptyString(value.user.sessionId)) return undefined;
  if (value.approval !== undefined && !isLocalMcpApproval(value.approval)) return undefined;
  if (value.requestId !== undefined && !isNonEmptyString(value.requestId)) return undefined;

  return {
    kind: "local_mcp_call_envelope",
    toolName: value.toolName,
    arguments: clonePlainRecord(value.arguments),
    user: {
      userId: value.user.userId,
      ...(value.user.sessionId !== undefined ? { sessionId: value.user.sessionId } : {}),
    },
    ...(value.approval !== undefined ? { approval: { ...value.approval } } : {}),
    ...(value.requestId !== undefined ? { requestId: value.requestId } : {}),
    version: 1,
  };
}

export function validateLocalMcpCallEnvelope(
  envelope: LocalMcpCallEnvelopeV1,
  registry: LocalMcpToolRegistryV1 = buildLocalMcpToolRegistry(),
): LocalMcpCallValidationResultV1 {
  if (!isSafeProjectedToolName(envelope.toolName)) return invalid("invalid_tool_name");
  const localToolId = projectedToolNameToLocalToolId(envelope.toolName);
  if (!localToolId) return invalid("unknown_tool");
  if (!isNonEmptyString(envelope.user.userId)) return invalid("missing_user");

  const tool = registry.tools.find((candidate) => candidate.id === localToolId);
  if (!tool || !registry.toolIds.includes(localToolId) || !isAllowlistedRisk(tool.riskLevel)) {
    return invalid("tool_not_allowlisted");
  }
  if (tool.requiresApproval && envelope.approval?.approved !== true) {
    return invalid("approval_required");
  }
  if (!matchesToolArguments(envelope.arguments, tool.inputKinds)) {
    return invalid("invalid_arguments");
  }

  return {
    valid: true,
    toolName: envelope.toolName as LocalMcpProjectedToolNameV1,
    localToolId,
    version: 1,
  };
}

export function buildLocalMcpCallError(
  code: LocalMcpCallErrorCodeV1,
  overrides: Partial<Pick<LocalMcpCallErrorV1, "message" | "retryable">> = {},
): LocalMcpCallErrorV1 {
  return {
    code,
    message: overrides.message ?? ERROR_MESSAGES[code],
    retryable: overrides.retryable ?? (code === "timeout" || code === "rate_limited"),
    safeForModel: true,
    version: 1,
  };
}

export function buildLocalMcpErrorToolResult(
  error: LocalMcpCallErrorV1,
): LocalMcpCallToolResultV1 {
  return {
    kind: "local_mcp_call_error_result",
    content: [
      {
        type: "text",
        text: error.message,
      },
    ],
    structuredContent: {
      error: {
        code: error.code,
        retryable: error.retryable,
        version: 1,
      },
      version: 1,
    },
    isError: true,
    version: 1,
  };
}

export function buildLocalMcpCallRefusalEnvelope(
  toolName: string,
  error: LocalMcpCallErrorV1,
): LocalMcpCallResponseEnvelopeV1 {
  const localToolId = projectedToolNameToLocalToolId(toolName);

  return {
    success: false,
    toolName,
    ...(localToolId ? { localToolId } : {}),
    result: buildLocalMcpErrorToolResult(error),
    error,
    version: 1,
  };
}

function invalid(code: LocalMcpCallErrorCodeV1): LocalMcpCallValidationResultV1 {
  return {
    valid: false,
    error: buildLocalMcpCallError(code),
    version: 1,
  };
}

function matchesToolArguments(
  args: Readonly<Record<string, unknown>>,
  inputKinds: readonly InternalToolInputKindV1[],
): boolean {
  const expectedFields: string[] = [];
  for (const kind of inputKinds) {
    const field = INPUT_KIND_TO_FIELD[kind];
    if (field === undefined) return false;
    expectedFields.push(field);
  }
  if (!sameStringSet(Object.keys(args), expectedFields)) return false;

  return expectedFields.every((field) => isValidRefArgument(args[field]));
}

function isValidRefArgument(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  if (!sameStringSet(Object.keys(value), ["id"])) return false;
  return isNonEmptyString(value.id);
}

function isProjectedToolName(value: string): value is LocalMcpProjectedToolNameV1 {
  return Object.hasOwn(PROJECTED_TO_LOCAL_TOOL_ID, value);
}

function isSafeProjectedToolName(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_.]*$/u.test(value);
}

function isAllowlistedRisk(value: InternalToolRiskLevelV1): boolean {
  return value === "low" || value === "medium";
}

function isLocalMcpApproval(value: unknown): value is LocalMcpApprovalV1 {
  if (!isPlainRecord(value)) return false;
  if (typeof value.approved !== "boolean") return false;
  if (value.version !== 1) return false;

  return [value.approvedBy, value.approvedAt, value.reason].every(
    (field) => field === undefined || isNonEmptyString(field),
  );
}

function isCloneableLocalValue(value: unknown): boolean {
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!isPlainRecord(value)) return false;
  if (typeof (value as { then?: unknown }).then === "function") return false;
  return Object.values(value).every(isCloneableLocalValue);
}

function clonePlainRecord(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneLocalValue(item)]),
  );
}

function cloneLocalValue(value: unknown): unknown {
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  return clonePlainRecord(value as Record<string, unknown>);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sameStringSet(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((field) => actual.includes(field));
}
