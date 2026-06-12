import { validateLocalMcpCallEnvelope } from "./mcpCallEnvelope";
import type { LocalMcpCallErrorCodeV1 } from "./mcpCallEnvelope";
import { buildLocalMcpSafeTextFixtureOutput } from "./privacyRedactionFixtures";
import type { LocalMcpSafeTextFixtureOutputV1 } from "./privacyRedactionFixtures";
import type { LocalMcpApprovalV1, LocalMcpToolIdV1 } from "./schema";
import { buildLocalMcpToolRegistry } from "./toolRegistry";
import type { LocalMcpToolRegistryV1 } from "./schema";

type LocalMcpToolsCallFixtureRequestV1 = Readonly<{
  kind: "local_mcp_tools_call_fixture_request";
  method: "tools/call";
  toolName: string;
  arguments: Readonly<Record<string, unknown>>;
  user: Readonly<{
    userId: string;
    sessionId?: string;
  }>;
  approval?: LocalMcpApprovalV1;
  prompt?: string;
  requestId?: string;
  version: 1;
}>;

export type LocalMcpToolsCallFixtureErrorCodeV1 =
  | "malformed_input"
  | "unknown_tool"
  | "approval_required"
  | "negative_prompt_refusal"
  | "write_action_refusal";

export type LocalMcpToolsCallFixtureErrorV1 = Readonly<{
  code: LocalMcpToolsCallFixtureErrorCodeV1;
  message: string;
  safeForModel: true;
  version: 1;
}>;

export type LocalMcpToolsCallFixtureSuccessV1 = Readonly<{
  kind: "local_mcp_tools_call_fixture_response";
  method: "tools/call";
  success: true;
  fixtureOnly: true;
  toolName: string;
  localToolId: LocalMcpToolIdV1;
  result: LocalMcpSafeTextFixtureOutputV1;
  version: 1;
}>;

export type LocalMcpToolsCallFixtureFailureV1 = Readonly<{
  kind: "local_mcp_tools_call_fixture_response";
  method: "tools/call";
  success: false;
  fixtureOnly: true;
  toolName: string;
  localToolId?: LocalMcpToolIdV1;
  error: LocalMcpToolsCallFixtureErrorV1;
  version: 1;
}>;

export type LocalMcpToolsCallFixtureResponseV1 =
  | LocalMcpToolsCallFixtureSuccessV1
  | LocalMcpToolsCallFixtureFailureV1;

const REQUEST_KEYS = [
  "kind",
  "method",
  "toolName",
  "arguments",
  "user",
  "approval",
  "prompt",
  "requestId",
  "version",
] as const;

const NEGATIVE_PROMPT_PHRASES = [
  "ignore never_use",
  "reveal source quotes",
  "show my raw cv",
  "show my raw resume",
  "show my raw cover letter",
  "show my private facts",
  "call the implementation directly",
  "use the private facts anyway",
] as const;

const WRITE_ACTION_PHRASES = [
  "apply to this job now",
  "send this application",
  "export my resume",
  "download my resume",
  "submit this application",
  "auto-apply",
  "send to recruiter",
  "apply now",
] as const;

export function simulateLocalMcpToolsCallFixture(
  request: unknown,
  registry: LocalMcpToolRegistryV1 = buildLocalMcpToolRegistry(),
): LocalMcpToolsCallFixtureResponseV1 {
  const parsed = parseToolsCallFixtureRequest(request);
  if (!parsed) {
    return buildFailure("unknown", "The tools/call fixture request is malformed.", "malformed_input");
  }

  const promptRefusal = refusalFromPrompt(parsed.prompt);
  if (promptRefusal) {
    return buildFailure(parsed.toolName, promptRefusal.message, promptRefusal.code);
  }

  const validation = validateLocalMcpCallEnvelope(
    {
      kind: "local_mcp_call_envelope",
      toolName: parsed.toolName,
      arguments: parsed.arguments,
      user: parsed.user,
      ...(parsed.approval !== undefined ? { approval: parsed.approval } : {}),
      ...(parsed.requestId !== undefined ? { requestId: parsed.requestId } : {}),
      version: 1,
    },
    registry,
  );

  if (validation.valid !== true) {
    const failed = validation as Extract<typeof validation, { valid: false }>;
    return buildFailure(
      parsed.toolName,
      messageForValidationCode(failed.error.code),
      fixtureErrorCodeForValidationCode(failed.error.code),
    );
  }

  return {
    kind: "local_mcp_tools_call_fixture_response",
    method: "tools/call",
    success: true,
    fixtureOnly: true,
    toolName: validation.toolName,
    localToolId: validation.localToolId,
    result: buildLocalMcpSafeTextFixtureOutput({
      status: "safe_summary_only",
      summary: `Fixture-only tools/call accepted for ${validation.localToolId}. No product action executed.`,
      refIds: [`fixture:${validation.localToolId}`],
    }),
    version: 1,
  };
}

function parseToolsCallFixtureRequest(value: unknown): LocalMcpToolsCallFixtureRequestV1 | undefined {
  if (!isPlainRecord(value) || !hasValidRequestShape(value)) return undefined;

  const user = parseUser(value.user);
  if (!user) return undefined;
  const approval = parseOptionalApproval(value.approval);
  if (approval === false) return undefined;

  return {
    kind: "local_mcp_tools_call_fixture_request",
    method: "tools/call",
    toolName: value.toolName,
    arguments: { ...value.arguments },
    user,
    ...(approval ? { approval } : {}),
    ...(typeof value.prompt === "string" ? { prompt: value.prompt } : {}),
    ...(typeof value.requestId === "string" ? { requestId: value.requestId } : {}),
    version: 1,
  };
}

function hasValidRequestShape(record: Record<string, unknown>): record is Record<string, unknown> & {
  toolName: string;
  arguments: Readonly<Record<string, unknown>>;
} {
  return (
    hasOnlyAllowedKeys(record, REQUEST_KEYS) &&
    record.kind === "local_mcp_tools_call_fixture_request" &&
    record.method === "tools/call" &&
    record.version === 1 &&
    isNonEmptyString(record.toolName) &&
    isPlainRecord(record.arguments) &&
    optionalStringFieldIsValid(record.prompt) &&
    optionalStringFieldIsValid(record.requestId)
  );
}

function parseUser(value: unknown): LocalMcpToolsCallFixtureRequestV1["user"] | undefined {
  if (!isPlainRecord(value) || !isNonEmptyString(value.userId)) return undefined;
  if (!optionalStringFieldIsValid(value.sessionId)) return undefined;
  return {
    userId: value.userId,
    ...(typeof value.sessionId === "string" ? { sessionId: value.sessionId } : {}),
  };
}

function parseOptionalApproval(value: unknown): LocalMcpApprovalV1 | false | undefined {
  if (value === undefined) return undefined;
  return isApproval(value) ? { ...value } : false;
}

function refusalFromPrompt(
  prompt: string | undefined,
): Readonly<{ code: "negative_prompt_refusal" | "write_action_refusal"; message: string }> | undefined {
  if (!prompt) return undefined;
  const normalized = prompt.normalize("NFKC").toLowerCase();
  if (WRITE_ACTION_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return { code: "write_action_refusal", message: "Refused. Write action blocked." };
  }
  if (NEGATIVE_PROMPT_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return { code: "negative_prompt_refusal", message: "Refused. Negative prompt blocked." };
  }
  return undefined;
}

function buildFailure(
  toolName: string,
  message: string,
  code: LocalMcpToolsCallFixtureErrorCodeV1,
): LocalMcpToolsCallFixtureFailureV1 {
  return {
    kind: "local_mcp_tools_call_fixture_response",
    method: "tools/call",
    success: false,
    fixtureOnly: true,
    toolName,
    error: {
      code,
      message,
      safeForModel: true,
      version: 1,
    },
    version: 1,
  };
}

function messageForValidationCode(code: LocalMcpCallErrorCodeV1): string {
  switch (code) {
    case "unknown_tool":
      return "The requested tool is not available.";
    case "approval_required":
      return "Approval is required before this fixture call can proceed.";
    default:
      return "The tools/call fixture request is malformed.";
  }
}

function fixtureErrorCodeForValidationCode(
  code: LocalMcpCallErrorCodeV1,
): LocalMcpToolsCallFixtureErrorCodeV1 {
  switch (code) {
    case "unknown_tool":
      return "unknown_tool";
    case "approval_required":
      return "approval_required";
    default:
      return "malformed_input";
  }
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isApproval(value: unknown): value is LocalMcpApprovalV1 {
  if (!isPlainRecord(value)) return false;
  const optionalFields = [value.approvedBy, value.approvedAt, value.reason];
  return (
    typeof value.approved === "boolean" &&
    value.version === 1 &&
    optionalFields.every(optionalStringFieldIsValid)
  );
}

function optionalStringFieldIsValid(value: unknown): boolean {
  return value === undefined || isNonEmptyString(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
