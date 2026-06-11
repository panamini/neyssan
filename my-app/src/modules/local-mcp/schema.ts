import type {
  InternalToolIdV1,
  InternalToolInputKindV1,
  InternalToolOutputKindV1,
  InternalToolRiskLevelV1,
} from "../internal-tool-contracts/schema";

export type LocalMcpToolIdV1 =
  | "local_mcp.application_package.summarize"
  | "local_mcp.evidence_graph.summarize"
  | "local_mcp.resume_variant_plan.summarize"
  | "local_mcp.review_cockpit.summarize";

export type LocalMcpToolDefinitionV1 = Readonly<{
  id: LocalMcpToolIdV1;
  internalToolId: InternalToolIdV1;
  desc: string;
  version: 1;
  riskLevel: InternalToolRiskLevelV1;
  requiresApproval: boolean;
  inputKinds: readonly InternalToolInputKindV1[];
  outputKind: InternalToolOutputKindV1;
}>;

export type LocalMcpToolRegistryV1 = Readonly<{
  tools: readonly LocalMcpToolDefinitionV1[];
  toolIds: readonly LocalMcpToolIdV1[];
  version: 1;
}>;

export type LocalMcpApprovalV1 = Readonly<{
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  reason?: string;
  version: 1;
}>;

export type LocalMcpRequestV1 = Readonly<{
  toolId: string;
  userId: string;
  arguments: Readonly<Record<string, unknown>>;
  approval?: LocalMcpApprovalV1;
  version: 1;
}>;

export type LocalMcpAuthorizationReasonV1 =
  | "unknown_tool"
  | "missing_user"
  | "tool_not_allowlisted"
  | "approval_required"
  | "invalid_request";

export type LocalMcpAuthorizationResultV1 = Readonly<{
  allowed: boolean;
  reason?: LocalMcpAuthorizationReasonV1;
  version: 1;
}>;

export type LocalMcpDryRunResultV1 = Readonly<{
  kind: "local_mcp_dry_run";
  internalToolId: InternalToolIdV1;
  input: Readonly<Record<string, unknown>>;
  outputKind: InternalToolOutputKindV1;
  version: 1;
}>;

export type LocalMcpErrorV1 = Readonly<{
  reason: LocalMcpAuthorizationReasonV1;
  version: 1;
}>;

export type LocalMcpResponseV1 = Readonly<{
  success: boolean;
  toolId: string;
  result?: LocalMcpDryRunResultV1;
  err?: LocalMcpErrorV1;
  authorized: boolean;
  version: 1;
}>;

export type ExecuteLocalMcpRequestOptionsV1 = Readonly<{
  registry?: LocalMcpToolRegistryV1;
  now?: () => string;
}>;

export const LOCAL_MCP_ALLOWED_INTERNAL_TOOL_IDS: readonly InternalToolIdV1[] = [
  "application_package.summarize",
  "evidence_graph.summarize",
  "resume_variant_plan.summarize",
  "review_cockpit.summarize",
] as const;

const SPLIT_EXTERNAL_AGENT_TERMS: readonly (readonly [string, string])[] = [
  ["open", "ai"],
  ["chat", "gpt"],
  ["clau", "de"],
] as const;

const FORBIDDEN_LOCAL_TOOL_TEXT_TERMS: readonly string[] = [
  "update",
  "submit",
  "publish",
  "export",
  "download",
  "network",
  "browser",
  "scrape",
  ...SPLIT_EXTERNAL_AGENT_TERMS.map(([first, second]) => `${first}${second}`),
] as const;

export function isLocalMcpToolId(value: unknown): value is LocalMcpToolIdV1 {
  return (
    value === "local_mcp.application_package.summarize" ||
    value === "local_mcp.evidence_graph.summarize" ||
    value === "local_mcp.resume_variant_plan.summarize" ||
    value === "local_mcp.review_cockpit.summarize"
  );
}

export function isLocalMcpAllowedInternalToolId(value: unknown): value is InternalToolIdV1 {
  return (
    typeof value === "string" &&
    (LOCAL_MCP_ALLOWED_INTERNAL_TOOL_IDS as readonly string[]).includes(value)
  );
}

export function validateLocalMcpToolDefinition(tool: LocalMcpToolDefinitionV1): void {
  if (!isPlainRecord(tool)) throw new TypeError("LocalMcpToolDefinition must be an object");
  if (!isLocalMcpToolId(tool.id)) throw new TypeError("LocalMcpToolDefinition requires known id");
  if (!isLocalMcpAllowedInternalToolId(tool.internalToolId)) {
    throw new TypeError("LocalMcpToolDefinition internal tool is not allowlisted");
  }
  if (!isNonEmptyString(tool.desc)) throw new TypeError("LocalMcpToolDefinition requires desc");
  if (tool.version !== 1) throw new TypeError("LocalMcpToolDefinition version must be 1");
  if (tool.riskLevel === "blocked") throw new TypeError("LocalMcpToolDefinition cannot be blocked");
  if (tool.riskLevel === "medium" && tool.requiresApproval !== true) {
    throw new TypeError("LocalMcpToolDefinition medium risk requires approval");
  }
  if (!Array.isArray(tool.inputKinds)) throw new TypeError("LocalMcpToolDefinition requires inputKinds");
  if (!isNonEmptyString(tool.outputKind)) throw new TypeError("LocalMcpToolDefinition requires outputKind");

  validateLocalMcpToolText(tool.id);
  validateLocalMcpToolText(tool.internalToolId);
  validateLocalMcpToolText(tool.desc);
}

export function cloneLocalMcpToolDefinition(
  tool: LocalMcpToolDefinitionV1,
): LocalMcpToolDefinitionV1 {
  return {
    ...tool,
    inputKinds: [...tool.inputKinds],
  };
}

export function cloneLocalMcpArguments(
  args: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return clonePlainRecord(args);
}

export function parseLocalMcpRequest(value: unknown): LocalMcpRequestV1 | undefined {
  if (!isPlainRecord(value)) return undefined;
  if (value.version !== 1) return undefined;
  if (!isNonEmptyString(value.toolId)) return undefined;
  if (typeof value.userId !== "string") return undefined;
  if (!isPlainRecord(value.arguments)) return undefined;
  if (value.approval !== undefined && !isLocalMcpApproval(value.approval)) return undefined;

  return {
    toolId: value.toolId,
    userId: value.userId,
    arguments: clonePlainRecord(value.arguments),
    approval: value.approval,
    version: 1,
  };
}

export function getRequestToolId(value: unknown): string {
  return isPlainRecord(value) && typeof value.toolId === "string" && value.toolId.length > 0
    ? value.toolId
    : "unknown";
}

function validateLocalMcpToolText(value: string): void {
  const normalized = value.normalize("NFKC").toLowerCase();
  for (const term of FORBIDDEN_LOCAL_TOOL_TEXT_TERMS) {
    if (normalized.includes(term)) {
      throw new TypeError("LocalMcpToolDefinition contains forbidden tool metadata");
    }
  }
}

function isLocalMcpApproval(value: unknown): value is LocalMcpApprovalV1 {
  if (!isPlainRecord(value)) return false;
  if (typeof value.approved !== "boolean") return false;
  if (value.version !== 1) return false;

  return [value.approvedBy, value.approvedAt, value.reason].every(
    (field) => field === undefined || isNonEmptyString(field),
  );
}

function clonePlainRecord(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneLocalMcpValue(item)]),
  );
}

function cloneLocalMcpValue(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(cloneLocalMcpValue);
  if (isPlainRecord(value)) return clonePlainRecord(value);
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
