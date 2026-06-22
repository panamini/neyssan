import { validateLocalMcpCallEnvelope } from "./mcpCallEnvelope";
import type { LocalMcpCallErrorCodeV1 } from "./mcpCallEnvelope";
import { validateLocalMcpConsentGate } from "./mcpConsentGate";
import type { LocalMcpConsentSurfaceV1 } from "./mcpConsentGate";
import { buildLocalMcpSafeTextFixtureOutput } from "./privacyRedactionFixtures";
import type { LocalMcpSafeTextFixtureOutputV1 } from "./privacyRedactionFixtures";
import type { LocalMcpApprovalV1, LocalMcpToolIdV1, LocalMcpToolRegistryV1 } from "./schema";
import { buildLocalMcpToolRegistry } from "./toolRegistry";

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
  consent?: unknown;
  requestedSurface?: LocalMcpConsentSurfaceV1;
  prompt?: string;
  requestId?: string;
  version: 1;
}>;

export type LocalMcpToolsCallFixtureErrorCodeV1 =
  | "malformed_input"
  | "unknown_tool"
  | "approval_required"
  | "consent_required"
  | "negative_prompt_refusal"
  | "write_action_refusal"
  | "auth_required_surface_refusal";

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
  "consent",
  "requestedSurface",
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

const AUTH_REQUIRED_SURFACE_PHRASES = [
  "oauth token",
  "link my account",
  "connect my account",
  "production connector",
  "real user data",
  "real cv",
  "clerk user",
  "convex user",
] as const;

const APPROVAL_KEYS = ["approved", "approvedBy", "approvedAt", "reason", "version"] as const;

export function simulateLocalMcpToolsCallFixture(
  request: unknown,
  registry: LocalMcpToolRegistryV1 = buildLocalMcpToolRegistry(),
  now: Date = new Date(),
): LocalMcpToolsCallFixtureResponseV1 {
  const parsed = parseToolsCallFixtureRequest(request);
  if (!parsed) {
    return buildFailure("unknown", "The tools/call fixture request is malformed.", "malformed_input");
  }

  const requestedSurface = parsed.requestedSurface ?? "fixture_only";
  const consentGate = validateLocalMcpConsentGate(
    {
      kind: "local_mcp_consent_gate_input",
      requestedSurface,
      ...(parsed.consent !== undefined ? { consent: parsed.consent } : {}),
      version: 1,
    },
    now,
  );
  if (!consentGate.allowed) {
    return buildFailure(parsed.toolName, consentGate.safeRefusal.message, consentGate.safeRefusal.code);
  }
  if (requestedSurface === "future_write_action") {
    return buildFailure(parsed.toolName, "Refused. Write action blocked.", "write_action_refusal");
  }
  if (requestedSurface === "future_real_data_read") {
    return buildFailure(parsed.toolName, "Refused. Auth/OAuth surface blocked.", "auth_required_surface_refusal");
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
    return buildFailure(
      parsed.toolName,
      messageForValidationCode(validation.error.code),
      fixtureErrorCodeForValidationCode(validation.error.code),
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
  const approval = parseOptionalApproval(value.approval);
  if (!user || approval === false) return undefined;

  return buildParsedToolsCallFixtureRequest(value, user, approval);
}

function buildParsedToolsCallFixtureRequest(
  value: Record<string, unknown> & {
    toolName: string;
    arguments: Readonly<Record<string, unknown>>;
  },
  user: LocalMcpToolsCallFixtureRequestV1["user"],
  approval: LocalMcpApprovalV1 | undefined,
): LocalMcpToolsCallFixtureRequestV1 {
  return {
    kind: "local_mcp_tools_call_fixture_request",
    method: "tools/call",
    toolName: value.toolName,
    arguments: { ...value.arguments },
    user,
    ...parseOptionalRequestFields(value, approval),
    version: 1,
  };
}

function parseOptionalRequestFields(
  value: Record<string, unknown>,
  approval: LocalMcpApprovalV1 | undefined,
): Partial<Pick<LocalMcpToolsCallFixtureRequestV1, "approval" | "consent" | "requestedSurface" | "prompt" | "requestId">> {
  const fields: {
    approval?: LocalMcpApprovalV1;
    consent?: unknown;
    requestedSurface?: LocalMcpConsentSurfaceV1;
    prompt?: string;
    requestId?: string;
  } = {};
  if (approval) fields.approval = approval;
  if (value.consent !== undefined) fields.consent = value.consent;
  if (value.requestedSurface !== undefined && optionalRequestedSurfaceIsValid(value.requestedSurface)) {
    fields.requestedSurface = value.requestedSurface;
  }
  if (typeof value.prompt === "string") fields.prompt = value.prompt;
  if (typeof value.requestId === "string") fields.requestId = value.requestId;
  return fields;
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
    optionalRequestedSurfaceIsValid(record.requestedSurface) &&
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

function optionalRequestedSurfaceIsValid(value: unknown): value is LocalMcpConsentSurfaceV1 | undefined {
  return (
    value === undefined ||
    value === "fixture_only" ||
    value === "future_real_data_read" ||
    value === "future_write_action"
  );
}

function parseOptionalApproval(value: unknown): LocalMcpApprovalV1 | false | undefined {
  if (value === undefined) return undefined;
  if (!isApproval(value)) return false;
  return {
    approved: value.approved,
    ...(value.approvedBy !== undefined ? { approvedBy: value.approvedBy } : {}),
    ...(value.approvedAt !== undefined ? { approvedAt: value.approvedAt } : {}),
    ...(value.reason !== undefined ? { reason: value.reason } : {}),
    version: 1,
  };
}

function refusalFromPrompt(
  prompt: string | undefined,
): Readonly<{
  code: "negative_prompt_refusal" | "write_action_refusal" | "auth_required_surface_refusal";
  message: string;
}> | undefined {
  if (!prompt) return undefined;
  const normalized = prompt.normalize("NFKC").toLowerCase();
  if (WRITE_ACTION_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return { code: "write_action_refusal", message: "Refused. Write action blocked." };
  }
  if (AUTH_REQUIRED_SURFACE_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return { code: "auth_required_surface_refusal", message: "Refused. Auth/OAuth surface blocked." };
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
  if (!isPlainRecord(value) || !hasOnlyAllowedKeys(value, APPROVAL_KEYS)) return false;
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
