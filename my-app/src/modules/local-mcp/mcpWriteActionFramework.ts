type str = string;
type num = number;

export type McpWriteActionIntentKindV1 =
  | "read_only_operation"
  | "write_action";

export type McpWriteActionOperationKindV1 =
  | "read_only_operation"
  | "proposed_write_action"
  | "blocked_write_action"
  | "confirmed_not_executable_placeholder"
  | "simulated_noop_result";

export type McpWriteActionCategoryV1 =
  | "read_only"
  | "send_message"
  | "submit_application"
  | "apply_to_job"
  | "save_artifact"
  | "export_to_destination";

export type McpWriteActionRiskLevelV1 =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type McpWriteActionDataClassV1 =
  | "safe_summary"
  | "generated_artifact"
  | "application_material"
  | "destination_metadata"
  | "safe_ref"
  | "user_confirmation"
  | "audit_metadata";

export type McpWriteActionExecutionStatusV1 =
  | "read_only_no_write"
  | "proposed_pending_confirmation"
  | "blocked"
  | "confirmed_execution_disabled"
  | "simulated_noop";

export type McpWriteActionBlockedReasonV1 =
  | "invalid_input"
  | "confirmation_required"
  | "confirmation_rejected"
  | "write_execution_disabled"
  | "unsupported_write_action"
  | "policy_forbidden";

export type McpWriteActionIntentV1 = Readonly<{
  kind: "mcp_write_action_intent";
  intentKind: McpWriteActionIntentKindV1;
  actionLabel: str;
  actionCategory: McpWriteActionCategoryV1;
  affectedSurface: str;
  userVisibleSummary: str;
  riskLevel: McpWriteActionRiskLevelV1;
  requiredConfirmationCopy?: str;
  idempotencyKey?: str;
  rollbackPlan: str;
  dataClasses: readonly McpWriteActionDataClassV1[];
  version: 1;
}>;

export type McpWriteActionCapabilitiesV1 = Readonly<{
  dataReads: "blocked";
  dataWrites: "blocked";
  writeActions: "blocked";
  handlerExecution: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  persistenceWrites: "blocked";
  externalSideEffects: "blocked";
  rawDataProjection: "blocked";
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

export type McpWriteActionConfirmationRequirementV1 = Readonly<{
  kind: "mcp_write_action_confirmation_requirement";
  required: boolean;
  state: "not_required" | "required_unconfirmed" | "blocked";
  requiredCopy?: str;
  version: 1;
}>;

export type McpWriteActionAuditEventV1 = Readonly<{
  kind: "mcp_write_action_audit_event";
  eventKind:
    | "read_only_operation_recorded"
    | "write_action_proposed"
    | "write_action_blocked"
    | "write_action_noop_simulated";
  actionLabel: str;
  actionCategory: McpWriteActionCategoryV1;
  affectedSurface: str;
  riskLevel: McpWriteActionRiskLevelV1;
  idempotencyKey?: str;
  dataClasses: readonly McpWriteActionDataClassV1[];
  redactedFlags: Readonly<{
    rawDataExposed: false;
    tokenOrIdentityExposed: false;
    persisted: false;
    writeActionExecuted: false;
    externalSideEffect: false;
    version: 1;
  }>;
  persisted: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpWriteActionProposalV1 = Readonly<{
  kind: "mcp_write_action_proposal";
  proposalRef: str;
  operationKind: Extract<
    McpWriteActionOperationKindV1,
    "read_only_operation" | "proposed_write_action"
  >;
  actionLabel: str;
  actionCategory: McpWriteActionCategoryV1;
  affectedSurface: str;
  userVisibleSummary: str;
  riskLevel: McpWriteActionRiskLevelV1;
  idempotencyKey?: str;
  rollbackPlan: str;
  dataClasses: readonly McpWriteActionDataClassV1[];
  confirmation: McpWriteActionConfirmationRequirementV1;
  executionStatus: Extract<
    McpWriteActionExecutionStatusV1,
    "read_only_no_write" | "proposed_pending_confirmation"
  >;
  capabilities: McpWriteActionCapabilitiesV1;
  auditEvent: McpWriteActionAuditEventV1;
  writeActionExecuted: false;
  realExecutionAllowed: false;
  externalSideEffect: false;
  persisted: false;
  networkAccess: false;
  version: 1;
}>;

export type McpWriteActionSafeRefusalV1 = Readonly<{
  kind: "mcp_write_action_safe_refusal";
  code: "mcp_write_action_framework_blocked";
  msg: "Refused. Write action execution is disabled.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpWriteActionProposalResultV1 = Readonly<
  | {
      kind: "mcp_write_action_proposal_result";
      allowed: true;
      proposal: McpWriteActionProposalV1;
      version: 1;
    }
  | {
      kind: "mcp_write_action_proposal_result";
      allowed: false;
      reason: "invalid_input";
      safeRefusal: McpWriteActionSafeRefusalV1;
      capabilities: McpWriteActionCapabilitiesV1;
      writeActionExecuted: false;
      realExecutionAllowed: false;
      version: 1;
    }
>;

export type McpWriteActionConfirmationRequestV1 = Readonly<{
  kind: "mcp_write_action_confirmation_request";
  required: boolean;
  state: "confirmation_required" | "not_required";
  proposalRef: str;
  actionLabel: str;
  actionCategory: McpWriteActionCategoryV1;
  affectedSurface: str;
  riskLevel: McpWriteActionRiskLevelV1;
  requiredCopy?: str;
  userVisibleSummary: str;
  version: 1;
}>;

export type McpWriteActionConfirmationResultV1 = Readonly<{
  kind: "mcp_write_action_confirmation_result";
  proposalRef: str;
  state: "confirmed" | "rejected";
  actor: "human_user";
  confirmationCopy: str;
  idempotencyKey: str;
  version: 1;
}>;

export type McpWriteActionGuardResultV1 = Readonly<
  | {
      kind: "mcp_write_action_guard_result";
      allowed: true;
      reason: "read_only_operation";
      operationKind: "read_only_operation";
      executionStatus: "read_only_no_write";
      proposal: McpWriteActionProposalV1;
      capabilities: McpWriteActionCapabilitiesV1;
      writeActionExecuted: false;
      realExecutionAllowed: false;
      externalSideEffect: false;
      persisted: false;
      networkAccess: false;
      version: 1;
    }
  | {
      kind: "mcp_write_action_guard_result";
      allowed: false;
      reason: Exclude<McpWriteActionBlockedReasonV1, "invalid_input">;
      operationKind: Extract<
        McpWriteActionOperationKindV1,
        "blocked_write_action" | "confirmed_not_executable_placeholder"
      >;
      executionStatus: Extract<
        McpWriteActionExecutionStatusV1,
        "blocked" | "confirmed_execution_disabled"
      >;
      proposal?: McpWriteActionProposalV1;
      safeRefusal: McpWriteActionSafeRefusalV1;
      userVisibleReason: str;
      capabilities: McpWriteActionCapabilitiesV1;
      auditEvent?: McpWriteActionAuditEventV1;
      writeActionExecuted: false;
      realExecutionAllowed: false;
      externalSideEffect: false;
      persisted: false;
      networkAccess: false;
      version: 1;
    }
>;

export type McpWriteActionNoopResultV1 = Readonly<{
  kind: "mcp_write_action_noop_result";
  allowed: true;
  reason: "simulated_noop";
  operationKind: "simulated_noop_result";
  executionStatus: "simulated_noop";
  proposal: McpWriteActionProposalV1;
  safeSummary: "Write action simulated as a no-op. No external side effect executed.";
  capabilities: McpWriteActionCapabilitiesV1;
  auditEvent: McpWriteActionAuditEventV1;
  writeActionExecuted: false;
  realExecutionAllowed: false;
  externalSideEffect: false;
  persisted: false;
  networkAccess: false;
  version: 1;
}>;

const INTENT_ALLOWED_KEYS = [
  "kind",
  "intentKind",
  "actionLabel",
  "actionCategory",
  "affectedSurface",
  "userVisibleSummary",
  "riskLevel",
  "requiredConfirmationCopy",
  "idempotencyKey",
  "rollbackPlan",
  "dataClasses",
  "version",
] as const;

const INTENT_REQUIRED_KEYS = [
  "kind",
  "intentKind",
  "actionLabel",
  "actionCategory",
  "affectedSurface",
  "userVisibleSummary",
  "riskLevel",
  "rollbackPlan",
  "dataClasses",
  "version",
] as const;

const CONFIRMATION_RESULT_KEYS = [
  "kind",
  "proposalRef",
  "state",
  "actor",
  "confirmationCopy",
  "idempotencyKey",
  "version",
] as const;

const CONFIRMATION_REQUIREMENT_ALLOWED_KEYS = [
  "kind",
  "required",
  "state",
  "requiredCopy",
  "version",
] as const;

const CONFIRMATION_REQUIREMENT_REQUIRED_KEYS = [
  "kind",
  "required",
  "state",
  "version",
] as const;

const PROPOSAL_ALLOWED_KEYS = [
  "kind",
  "proposalRef",
  "operationKind",
  "actionLabel",
  "actionCategory",
  "affectedSurface",
  "userVisibleSummary",
  "riskLevel",
  "idempotencyKey",
  "rollbackPlan",
  "dataClasses",
  "confirmation",
  "executionStatus",
  "capabilities",
  "auditEvent",
  "writeActionExecuted",
  "realExecutionAllowed",
  "externalSideEffect",
  "persisted",
  "networkAccess",
  "version",
] as const;

const PROPOSAL_REQUIRED_KEYS = [
  "kind",
  "proposalRef",
  "operationKind",
  "actionLabel",
  "actionCategory",
  "affectedSurface",
  "userVisibleSummary",
  "riskLevel",
  "rollbackPlan",
  "dataClasses",
  "confirmation",
  "executionStatus",
  "capabilities",
  "auditEvent",
  "writeActionExecuted",
  "realExecutionAllowed",
  "externalSideEffect",
  "persisted",
  "networkAccess",
  "version",
] as const;

const CAPABILITIES_KEYS = [
  "dataReads",
  "dataWrites",
  "writeActions",
  "handlerExecution",
  "productionConnector",
  "networkAccess",
  "modelCalls",
  "persistenceWrites",
  "externalSideEffects",
  "rawDataProjection",
  "credentialStorage",
  "tokenStorage",
  "version",
] as const;

const AUDIT_EVENT_ALLOWED_KEYS = [
  "kind",
  "eventKind",
  "actionLabel",
  "actionCategory",
  "affectedSurface",
  "riskLevel",
  "idempotencyKey",
  "dataClasses",
  "redactedFlags",
  "persisted",
  "writeActionExecuted",
  "version",
] as const;

const AUDIT_EVENT_REQUIRED_KEYS = [
  "kind",
  "eventKind",
  "actionLabel",
  "actionCategory",
  "affectedSurface",
  "riskLevel",
  "dataClasses",
  "redactedFlags",
  "persisted",
  "writeActionExecuted",
  "version",
] as const;

const REDACTED_FLAGS_KEYS = [
  "rawDataExposed",
  "tokenOrIdentityExposed",
  "persisted",
  "writeActionExecuted",
  "externalSideEffect",
  "version",
] as const;

const WRITE_ACTION_CATEGORIES = new Set<McpWriteActionCategoryV1>([
  "send_message",
  "submit_application",
  "apply_to_job",
  "save_artifact",
  "export_to_destination",
]);

const DATA_CLASSES = new Set<McpWriteActionDataClassV1>([
  "safe_summary",
  "generated_artifact",
  "application_material",
  "destination_metadata",
  "safe_ref",
  "user_confirmation",
  "audit_metadata",
]);

const RISK_LEVELS = new Set<McpWriteActionRiskLevelV1>([
  "none",
  "low",
  "medium",
  "high",
  "critical",
]);

const MAX_SAFE_TEXT_LENGTH = 500;
const MAX_SAFE_LABEL_LENGTH = 120;
const MAX_DATA_CLASSES = 10;

const UNSAFE_TEXT_PATTERNS: readonly RegExp[] = [
  /RAW_(?:(?:CV|RESUME|JOB|PROPOSAL|APP|COVER_LETTER)(?:_TEXT)?|SOURCE_DOCUMENT|ARGUMENTS)_SENTINEL_DO_NOT_EXPOSE/u,
  /SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE/u,
  /PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE/u,
  /NEVER_USE_SENTINEL_DO_NOT_EXPOSE/u,
  /GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE/u,
  /SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE/u,
  /SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE/u,
  /STACK_TRACE_SENTINEL_DO_NOT_EXPOSE/u,
  /DO_NOT_EXPOSE/u,
  /\bBearer\s+[A-Za-z0-9._-]+/u,
  /\b(?:access|refresh)[_-]?token\b/iu,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /\b(?:https?:\/\/|data:|blob:|base64)\b/iu,
  /\braw[_ -]?(?:cv|resume|job|proposal|app|text)\b/iu,
  /\b(?:private[_ -]?fact|never[_ -]?use|source[_ -]?quote|debug[_ -]?payload)\b/iu,
  /\b(?:clerk|session|stytch|provider|userid|documentid)[_-][a-z0-9._:-]+/iu,
];

export function createMcpWriteActionProposal(
  input: unknown,
): McpWriteActionProposalResultV1 {
  const intent = parseIntent(input);
  if (!intent) return denyProposal();
  return {
    kind: "mcp_write_action_proposal_result",
    allowed: true,
    proposal: buildProposal(intent),
    version: 1,
  };
}

export function createMcpWriteActionConfirmationRequest(
  proposal: McpWriteActionProposalV1,
): McpWriteActionConfirmationRequestV1 {
  return {
    kind: "mcp_write_action_confirmation_request",
    required: proposal.confirmation.required,
    state: proposal.confirmation.required
      ? "confirmation_required"
      : "not_required",
    proposalRef: proposal.proposalRef,
    actionLabel: proposal.actionLabel,
    actionCategory: proposal.actionCategory,
    affectedSurface: proposal.affectedSurface,
    riskLevel: proposal.riskLevel,
    ...(proposal.confirmation.requiredCopy
      ? { requiredCopy: proposal.confirmation.requiredCopy }
      : {}),
    userVisibleSummary: proposal.userVisibleSummary,
    version: 1,
  };
}

export function assertMcpWriteActionExecutionDisabled(
  proposal: unknown,
  confirmation?: unknown,
): McpWriteActionGuardResultV1 {
  const parsedProposal = parseProposal(proposal);
  if (!parsedProposal) {
    return buildBlockedResult(
      undefined,
      "confirmation_required",
      "blocked_write_action",
      "blocked",
      "Confirmation is required before this write action.",
    );
  }
  if (parsedProposal.operationKind === "read_only_operation") {
    return {
      kind: "mcp_write_action_guard_result",
      allowed: true,
      reason: "read_only_operation",
      operationKind: "read_only_operation",
      executionStatus: "read_only_no_write",
      proposal: parsedProposal,
      capabilities: buildCapabilities(),
      writeActionExecuted: false,
      realExecutionAllowed: false,
      externalSideEffect: false,
      persisted: false,
      networkAccess: false,
      version: 1,
    };
  }
  const confirmed = parseConfirmationResult(confirmation);
  if (
    confirmed?.state === "rejected" &&
    confirmationMatchesProposal(parsedProposal, confirmed)
  ) {
    return buildBlockedResult(
      parsedProposal,
      "confirmation_rejected",
      "blocked_write_action",
      "blocked",
      "Confirmation was rejected for this write action.",
    );
  }
  if (!confirmed || !confirmationMatchesProposal(parsedProposal, confirmed)) {
    return buildBlockedResult(
      parsedProposal,
      "confirmation_required",
      "blocked_write_action",
      "blocked",
      "Confirmation is required before this write action.",
    );
  }
  return buildBlockedResult(
    parsedProposal,
    "write_execution_disabled",
    "confirmed_not_executable_placeholder",
    "confirmed_execution_disabled",
    "Write action is confirmed but real execution is disabled in this framework.",
  );
}

export function blockMcpWriteAction(
  proposal: McpWriteActionProposalV1,
  reason: Exclude<
    McpWriteActionBlockedReasonV1,
    | "invalid_input"
    | "confirmation_required"
    | "confirmation_rejected"
    | "write_execution_disabled"
  >,
  userVisibleReason: str,
): McpWriteActionGuardResultV1 {
  return buildBlockedResult(
    proposal,
    reason,
    "blocked_write_action",
    "blocked",
    isSafeText(userVisibleReason, MAX_SAFE_TEXT_LENGTH)
      ? userVisibleReason
      : "Write action is blocked.",
  );
}

export function createMcpNoopWriteActionResult(
  proposal: McpWriteActionProposalV1,
  confirmation: McpWriteActionConfirmationResultV1,
): McpWriteActionNoopResultV1 | McpWriteActionGuardResultV1 {
  const guard = assertMcpWriteActionExecutionDisabled(proposal, confirmation);
  if (guard.allowed) {
    return buildBlockedResult(
      undefined,
      "unsupported_write_action",
      "blocked_write_action",
      "blocked",
      "No-op simulation requires a confirmed write action proposal.",
    );
  }
  if (guard.reason !== "write_execution_disabled") {
    return guard;
  }
  return {
    kind: "mcp_write_action_noop_result",
    allowed: true,
    reason: "simulated_noop",
    operationKind: "simulated_noop_result",
    executionStatus: "simulated_noop",
    proposal,
    safeSummary:
      "Write action simulated as a no-op. No external side effect executed.",
    capabilities: buildCapabilities(),
    auditEvent: buildAuditEvent(proposal, "write_action_noop_simulated"),
    writeActionExecuted: false,
    realExecutionAllowed: false,
    externalSideEffect: false,
    persisted: false,
    networkAccess: false,
    version: 1,
  };
}

function parseIntent(input: unknown): McpWriteActionIntentV1 | undefined {
  const parsed = parseIntentBase(input);
  if (!parsed) return undefined;
  return parsed.record.intentKind === "read_only_operation"
    ? parseReadOnlyIntent(parsed.record, parsed.dataClasses)
    : parseWriteIntent(parsed.record, parsed.dataClasses);
}

function parseIntentBase(
  input: unknown,
):
  | Readonly<{
      record: Record<str, unknown>;
      dataClasses: readonly McpWriteActionDataClassV1[];
    }>
  | undefined {
  const record = readExactRecord(input, INTENT_ALLOWED_KEYS, INTENT_REQUIRED_KEYS);
  if (!record || !hasValidIntentMetadata(record)) return undefined;
  const dataClasses = parseDataClasses(record.dataClasses);
  if (!dataClasses) return undefined;
  return { record, dataClasses };
}

function parseReadOnlyIntent(
  record: Record<str, unknown>,
  dataClasses: readonly McpWriteActionDataClassV1[],
): McpWriteActionIntentV1 | undefined {
  if (record.actionCategory !== "read_only" || record.riskLevel !== "none") {
    return undefined;
  }
  return {
    kind: "mcp_write_action_intent",
    intentKind: "read_only_operation",
    actionLabel: record.actionLabel as str,
    actionCategory: "read_only",
    affectedSurface: record.affectedSurface as str,
    userVisibleSummary: record.userVisibleSummary as str,
    riskLevel: "none",
    rollbackPlan: record.rollbackPlan as str,
    dataClasses,
    version: 1,
  };
}

function parseWriteIntent(
  record: Record<str, unknown>,
  dataClasses: readonly McpWriteActionDataClassV1[],
): McpWriteActionIntentV1 | undefined {
  if (!hasValidWriteIntentMetadata(record)) return undefined;
  return {
    kind: "mcp_write_action_intent",
    intentKind: "write_action",
    actionLabel: record.actionLabel as str,
    actionCategory: record.actionCategory as Exclude<
      McpWriteActionCategoryV1,
      "read_only"
    >,
    affectedSurface: record.affectedSurface as str,
    userVisibleSummary: record.userVisibleSummary as str,
    riskLevel: record.riskLevel as Exclude<McpWriteActionRiskLevelV1, "none">,
    requiredConfirmationCopy: record.requiredConfirmationCopy as str,
    idempotencyKey: record.idempotencyKey as str,
    rollbackPlan: record.rollbackPlan as str,
    dataClasses,
    version: 1,
  };
}

function hasValidIntentMetadata(record: Record<str, unknown>): boolean {
  return allTrue([
    record.kind === "mcp_write_action_intent",
    record.version === 1,
    isIntentKind(record.intentKind),
    isCategory(record.actionCategory),
    isRiskLevel(record.riskLevel),
    isSafeLabel(record.actionLabel),
    isSafeLabel(record.affectedSurface),
    isSafeText(record.userVisibleSummary, MAX_SAFE_TEXT_LENGTH),
    isSafeText(record.rollbackPlan, MAX_SAFE_TEXT_LENGTH),
  ]);
}

function hasValidWriteIntentMetadata(record: Record<str, unknown>): boolean {
  return allTrue([
    isCategory(record.actionCategory),
    record.actionCategory !== "read_only",
    WRITE_ACTION_CATEGORIES.has(record.actionCategory as McpWriteActionCategoryV1),
    isRiskLevel(record.riskLevel),
    record.riskLevel !== "none",
    isSafeText(record.requiredConfirmationCopy, MAX_SAFE_TEXT_LENGTH),
    isSafeIdempotencyKey(record.idempotencyKey),
  ]);
}

function buildProposal(intent: McpWriteActionIntentV1): McpWriteActionProposalV1 {
  const isReadOnly = intent.intentKind === "read_only_operation";
  const confirmation = buildConfirmationRequirement(intent);
  const proposal: McpWriteActionProposalV1 = {
    kind: "mcp_write_action_proposal",
    proposalRef: intent.idempotencyKey ?? `mcp-write-action:read-only:${intent.actionLabel}`,
    operationKind: isReadOnly
      ? "read_only_operation"
      : "proposed_write_action",
    actionLabel: intent.actionLabel,
    actionCategory: intent.actionCategory,
    affectedSurface: intent.affectedSurface,
    userVisibleSummary: intent.userVisibleSummary,
    riskLevel: intent.riskLevel,
    ...(intent.idempotencyKey ? { idempotencyKey: intent.idempotencyKey } : {}),
    rollbackPlan: intent.rollbackPlan,
    dataClasses: [...intent.dataClasses],
    confirmation,
    executionStatus: isReadOnly
      ? "read_only_no_write"
      : "proposed_pending_confirmation",
    capabilities: buildCapabilities(),
    auditEvent: buildAuditEventFromIntent(
      intent,
      isReadOnly ? "read_only_operation_recorded" : "write_action_proposed",
    ),
    writeActionExecuted: false,
    realExecutionAllowed: false,
    externalSideEffect: false,
    persisted: false,
    networkAccess: false,
    version: 1,
  };
  return proposal;
}

function buildConfirmationRequirement(
  intent: McpWriteActionIntentV1,
): McpWriteActionConfirmationRequirementV1 {
  if (intent.intentKind === "read_only_operation") {
    return {
      kind: "mcp_write_action_confirmation_requirement",
      required: false,
      state: "not_required",
      version: 1,
    };
  }
  return {
    kind: "mcp_write_action_confirmation_requirement",
    required: true,
    state: "required_unconfirmed",
    requiredCopy: intent.requiredConfirmationCopy,
    version: 1,
  };
}

function parseProposal(input: unknown): McpWriteActionProposalV1 | undefined {
  const record = readExactRecord(
    input,
    PROPOSAL_ALLOWED_KEYS,
    PROPOSAL_REQUIRED_KEYS,
  );
  if (!record || !hasValidProposalMetadata(record)) {
    return undefined;
  }
  const dataClasses = parseDataClasses(record.dataClasses);
  const confirmation = parseConfirmationRequirement(record.confirmation);
  const capabilities = parseCapabilities(record.capabilities);
  const auditEvent = parseProposalAuditEvent(record.auditEvent);
  if (
    !dataClasses ||
    !confirmation ||
    !capabilities ||
    !auditEvent ||
    !hasConsistentProposalMetadata(
      record,
      dataClasses,
      confirmation,
      auditEvent,
    )
  ) {
    return undefined;
  }
  return {
    kind: "mcp_write_action_proposal",
    proposalRef: record.proposalRef as str,
    operationKind: record.operationKind as Extract<
      McpWriteActionOperationKindV1,
      "read_only_operation" | "proposed_write_action"
    >,
    actionLabel: record.actionLabel as str,
    actionCategory: record.actionCategory as McpWriteActionCategoryV1,
    affectedSurface: record.affectedSurface as str,
    userVisibleSummary: record.userVisibleSummary as str,
    riskLevel: record.riskLevel as McpWriteActionRiskLevelV1,
    ...(isSafeIdempotencyKey(record.idempotencyKey)
      ? { idempotencyKey: record.idempotencyKey }
      : {}),
    rollbackPlan: record.rollbackPlan as str,
    dataClasses,
    confirmation,
    executionStatus: record.executionStatus as Extract<
      McpWriteActionExecutionStatusV1,
      "read_only_no_write" | "proposed_pending_confirmation"
    >,
    capabilities,
    auditEvent,
    writeActionExecuted: false,
    realExecutionAllowed: false,
    externalSideEffect: false,
    persisted: false,
    networkAccess: false,
    version: 1,
  };
}

function hasValidProposalMetadata(record: Record<str, unknown>): boolean {
  return allTrue([
    record.kind === "mcp_write_action_proposal",
    record.version === 1,
    isProposalOperationKind(record.operationKind),
    isSafeProposalRef(record.proposalRef),
    isCategory(record.actionCategory),
    isSafeLabel(record.actionLabel),
    isSafeLabel(record.affectedSurface),
    isSafeText(record.userVisibleSummary, MAX_SAFE_TEXT_LENGTH),
    isRiskLevel(record.riskLevel),
    isSafeText(record.rollbackPlan, MAX_SAFE_TEXT_LENGTH),
    isOptionalSafeIdempotencyKey(record, "idempotencyKey"),
    hasDisabledRuntimeFlags(record),
  ]);
}

function hasDisabledRuntimeFlags(record: Record<str, unknown>): boolean {
  return allTrue([
    record.writeActionExecuted === false,
    record.realExecutionAllowed === false,
    record.externalSideEffect === false,
    record.persisted === false,
    record.networkAccess === false,
  ]);
}

function parseConfirmationRequirement(
  input: unknown,
): McpWriteActionConfirmationRequirementV1 | undefined {
  const record = readExactRecord(
    input,
    CONFIRMATION_REQUIREMENT_ALLOWED_KEYS,
    CONFIRMATION_REQUIREMENT_REQUIRED_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_write_action_confirmation_requirement" ||
    record.version !== 1
  ) {
    return undefined;
  }
  if (
    record.required === false &&
    record.state === "not_required" &&
    !hasOwn(record, "requiredCopy")
  ) {
    return {
      kind: "mcp_write_action_confirmation_requirement",
      required: false,
      state: "not_required",
      version: 1,
    };
  }
  if (
    record.required === true &&
    record.state === "required_unconfirmed" &&
    isSafeText(record.requiredCopy, MAX_SAFE_TEXT_LENGTH)
  ) {
    return {
      kind: "mcp_write_action_confirmation_requirement",
      required: true,
      state: "required_unconfirmed",
      requiredCopy: record.requiredCopy as str,
      version: 1,
    };
  }
  return undefined;
}

function parseCapabilities(
  input: unknown,
): McpWriteActionCapabilitiesV1 | undefined {
  const record = readExactRecord(input, CAPABILITIES_KEYS, CAPABILITIES_KEYS);
  if (
    !record ||
    !allTrue([
      record.dataReads === "blocked",
      record.dataWrites === "blocked",
      record.writeActions === "blocked",
      record.handlerExecution === "blocked",
      record.productionConnector === "blocked",
      record.networkAccess === "blocked",
      record.modelCalls === "blocked",
      record.persistenceWrites === "blocked",
      record.externalSideEffects === "blocked",
      record.rawDataProjection === "blocked",
      record.credentialStorage === "none",
      record.tokenStorage === "none",
      record.version === 1,
    ])
  ) {
    return undefined;
  }
  return buildCapabilities();
}

function parseProposalAuditEvent(
  input: unknown,
): McpWriteActionAuditEventV1 | undefined {
  const record = readExactRecord(
    input,
    AUDIT_EVENT_ALLOWED_KEYS,
    AUDIT_EVENT_REQUIRED_KEYS,
  );
  const dataClasses = record ? parseDataClasses(record.dataClasses) : undefined;
  const redactedFlags = record
    ? parseRedactedFlags(record.redactedFlags)
    : undefined;
  if (
    !record ||
    !dataClasses ||
    !redactedFlags ||
    record.kind !== "mcp_write_action_audit_event" ||
    !isProposalAuditEventKind(record.eventKind) ||
    !isSafeLabel(record.actionLabel) ||
    !isCategory(record.actionCategory) ||
    !isSafeLabel(record.affectedSurface) ||
    !isRiskLevel(record.riskLevel) ||
    !isOptionalSafeIdempotencyKey(record, "idempotencyKey") ||
    record.persisted !== false ||
    record.writeActionExecuted !== false ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    kind: "mcp_write_action_audit_event",
    eventKind: record.eventKind,
    actionLabel: record.actionLabel as str,
    actionCategory: record.actionCategory as McpWriteActionCategoryV1,
    affectedSurface: record.affectedSurface as str,
    riskLevel: record.riskLevel as McpWriteActionRiskLevelV1,
    ...(isSafeIdempotencyKey(record.idempotencyKey)
      ? { idempotencyKey: record.idempotencyKey }
      : {}),
    dataClasses,
    redactedFlags,
    persisted: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseRedactedFlags(
  input: unknown,
): McpWriteActionAuditEventV1["redactedFlags"] | undefined {
  const record = readExactRecord(input, REDACTED_FLAGS_KEYS, REDACTED_FLAGS_KEYS);
  if (
    !record ||
    !allTrue([
      record.rawDataExposed === false,
      record.tokenOrIdentityExposed === false,
      record.persisted === false,
      record.writeActionExecuted === false,
      record.externalSideEffect === false,
      record.version === 1,
    ])
  ) {
    return undefined;
  }
  return {
    rawDataExposed: false,
    tokenOrIdentityExposed: false,
    persisted: false,
    writeActionExecuted: false,
    externalSideEffect: false,
    version: 1,
  };
}

function hasConsistentProposalMetadata(
  record: Record<str, unknown>,
  dataClasses: readonly McpWriteActionDataClassV1[],
  confirmation: McpWriteActionConfirmationRequirementV1,
  auditEvent: McpWriteActionAuditEventV1,
): boolean {
  if (!auditEventMatchesProposal(record, dataClasses, auditEvent)) {
    return false;
  }
  return record.operationKind === "read_only_operation"
    ? hasConsistentReadOnlyProposal(record, confirmation, auditEvent)
    : hasConsistentWriteProposal(record, confirmation, auditEvent);
}

function hasConsistentReadOnlyProposal(
  record: Record<str, unknown>,
  confirmation: McpWriteActionConfirmationRequirementV1,
  auditEvent: McpWriteActionAuditEventV1,
): boolean {
  return allTrue([
    record.actionCategory === "read_only",
    record.riskLevel === "none",
    record.executionStatus === "read_only_no_write",
    !hasOwn(record, "idempotencyKey"),
    confirmation.required === false,
    confirmation.state === "not_required",
    auditEvent.eventKind === "read_only_operation_recorded",
    !hasOwn(auditEvent, "idempotencyKey"),
  ]);
}

function hasConsistentWriteProposal(
  record: Record<str, unknown>,
  confirmation: McpWriteActionConfirmationRequirementV1,
  auditEvent: McpWriteActionAuditEventV1,
): boolean {
  return allTrue([
    record.operationKind === "proposed_write_action",
    WRITE_ACTION_CATEGORIES.has(record.actionCategory as McpWriteActionCategoryV1),
    record.riskLevel !== "none",
    record.executionStatus === "proposed_pending_confirmation",
    isSafeIdempotencyKey(record.idempotencyKey),
    confirmation.required === true,
    confirmation.state === "required_unconfirmed",
    isSafeText(confirmation.requiredCopy, MAX_SAFE_TEXT_LENGTH),
    auditEvent.eventKind === "write_action_proposed",
    auditEvent.idempotencyKey === record.idempotencyKey,
  ]);
}

function auditEventMatchesProposal(
  record: Record<str, unknown>,
  dataClasses: readonly McpWriteActionDataClassV1[],
  auditEvent: McpWriteActionAuditEventV1,
): boolean {
  return allTrue([
    auditEvent.actionLabel === record.actionLabel,
    auditEvent.actionCategory === record.actionCategory,
    auditEvent.affectedSurface === record.affectedSurface,
    auditEvent.riskLevel === record.riskLevel,
    arrayEquals(auditEvent.dataClasses, dataClasses),
  ]);
}

function parseConfirmationResult(
  input: unknown,
): McpWriteActionConfirmationResultV1 | undefined {
  const record = readExactRecord(
    input,
    CONFIRMATION_RESULT_KEYS,
    CONFIRMATION_RESULT_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_write_action_confirmation_result" ||
    record.version !== 1 ||
    (record.state !== "confirmed" && record.state !== "rejected") ||
    record.actor !== "human_user" ||
    !isSafeText(record.confirmationCopy, MAX_SAFE_TEXT_LENGTH) ||
    !isSafeIdempotencyKey(record.idempotencyKey) ||
    !isSafeIdempotencyKey(record.proposalRef)
  ) {
    return undefined;
  }
  return {
    kind: "mcp_write_action_confirmation_result",
    proposalRef: record.proposalRef,
    state: record.state,
    actor: "human_user",
    confirmationCopy: record.confirmationCopy,
    idempotencyKey: record.idempotencyKey,
    version: 1,
  };
}

function confirmationMatchesProposal(
  proposal: McpWriteActionProposalV1,
  confirmation: McpWriteActionConfirmationResultV1,
): boolean {
  return Boolean(
    proposal.idempotencyKey &&
      proposal.confirmation.requiredCopy &&
      confirmation.proposalRef === proposal.proposalRef &&
      confirmation.idempotencyKey === proposal.idempotencyKey &&
      confirmation.confirmationCopy === proposal.confirmation.requiredCopy,
  );
}

function buildBlockedResult(
  proposal: McpWriteActionProposalV1 | undefined,
  reason: Exclude<McpWriteActionBlockedReasonV1, "invalid_input">,
  operationKind: Extract<
    McpWriteActionOperationKindV1,
    "blocked_write_action" | "confirmed_not_executable_placeholder"
  >,
  executionStatus: Extract<
    McpWriteActionExecutionStatusV1,
    "blocked" | "confirmed_execution_disabled"
  >,
  userVisibleReason: str,
): McpWriteActionGuardResultV1 {
  return {
    kind: "mcp_write_action_guard_result",
    allowed: false,
    reason,
    operationKind,
    executionStatus,
    ...(proposal ? { proposal, auditEvent: buildAuditEvent(proposal, "write_action_blocked") } : {}),
    safeRefusal: buildMcpWriteActionSafeRefusal(),
    userVisibleReason,
    capabilities: buildCapabilities(),
    writeActionExecuted: false,
    realExecutionAllowed: false,
    externalSideEffect: false,
    persisted: false,
    networkAccess: false,
    version: 1,
  };
}

function denyProposal(): McpWriteActionProposalResultV1 {
  return {
    kind: "mcp_write_action_proposal_result",
    allowed: false,
    reason: "invalid_input",
    safeRefusal: buildMcpWriteActionSafeRefusal(),
    capabilities: buildCapabilities(),
    writeActionExecuted: false,
    realExecutionAllowed: false,
    version: 1,
  };
}

function buildMcpWriteActionSafeRefusal(): McpWriteActionSafeRefusalV1 {
  return {
    kind: "mcp_write_action_safe_refusal",
    code: "mcp_write_action_framework_blocked",
    msg: "Refused. Write action execution is disabled.",
    safeForModel: true,
    rawDataExposed: false,
    componentDataExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function buildCapabilities(): McpWriteActionCapabilitiesV1 {
  return {
    dataReads: "blocked",
    dataWrites: "blocked",
    writeActions: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    persistenceWrites: "blocked",
    externalSideEffects: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

function buildAuditEvent(
  proposal: McpWriteActionProposalV1,
  eventKind: McpWriteActionAuditEventV1["eventKind"],
): McpWriteActionAuditEventV1 {
  return {
    kind: "mcp_write_action_audit_event",
    eventKind,
    actionLabel: proposal.actionLabel,
    actionCategory: proposal.actionCategory,
    affectedSurface: proposal.affectedSurface,
    riskLevel: proposal.riskLevel,
    ...(proposal.idempotencyKey
      ? { idempotencyKey: proposal.idempotencyKey }
      : {}),
    dataClasses: [...proposal.dataClasses],
    redactedFlags: {
      rawDataExposed: false,
      tokenOrIdentityExposed: false,
      persisted: false,
      writeActionExecuted: false,
      externalSideEffect: false,
      version: 1,
    },
    persisted: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function buildAuditEventFromIntent(
  intent: McpWriteActionIntentV1,
  eventKind: McpWriteActionAuditEventV1["eventKind"],
): McpWriteActionAuditEventV1 {
  return {
    kind: "mcp_write_action_audit_event",
    eventKind,
    actionLabel: intent.actionLabel,
    actionCategory: intent.actionCategory,
    affectedSurface: intent.affectedSurface,
    riskLevel: intent.riskLevel,
    ...(intent.idempotencyKey ? { idempotencyKey: intent.idempotencyKey } : {}),
    dataClasses: [...intent.dataClasses],
    redactedFlags: {
      rawDataExposed: false,
      tokenOrIdentityExposed: false,
      persisted: false,
      writeActionExecuted: false,
      externalSideEffect: false,
      version: 1,
    },
    persisted: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseDataClasses(
  input: unknown,
): readonly McpWriteActionDataClassV1[] | undefined {
  if (
    !Array.isArray(input) ||
    input.length === 0 ||
    input.length > MAX_DATA_CLASSES
  ) {
    return undefined;
  }
  const dataClasses: McpWriteActionDataClassV1[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !DATA_CLASSES.has(item)) return undefined;
    if (!dataClasses.includes(item)) dataClasses.push(item);
  }
  return dataClasses;
}

function isIntentKind(input: unknown): input is McpWriteActionIntentKindV1 {
  return input === "read_only_operation" || input === "write_action";
}

function isProposalOperationKind(
  input: unknown,
): input is Extract<
  McpWriteActionOperationKindV1,
  "read_only_operation" | "proposed_write_action"
> {
  return input === "read_only_operation" || input === "proposed_write_action";
}

function isProposalAuditEventKind(
  input: unknown,
): input is Extract<
  McpWriteActionAuditEventV1["eventKind"],
  "read_only_operation_recorded" | "write_action_proposed"
> {
  return (
    input === "read_only_operation_recorded" ||
    input === "write_action_proposed"
  );
}

function isCategory(input: unknown): input is McpWriteActionCategoryV1 {
  return (
    input === "read_only" ||
    input === "send_message" ||
    input === "submit_application" ||
    input === "apply_to_job" ||
    input === "save_artifact" ||
    input === "export_to_destination"
  );
}

function isRiskLevel(input: unknown): input is McpWriteActionRiskLevelV1 {
  return typeof input === "string" && RISK_LEVELS.has(input);
}

function isSafeLabel(input: unknown): input is str {
  return (
    typeof input === "string" &&
    /^[a-z][a-z0-9_:-]{2,119}$/u.test(input) &&
    input.length <= MAX_SAFE_LABEL_LENGTH &&
    !containsUnsafeText(input)
  );
}

function isSafeProposalRef(input: unknown): input is str {
  return (
    typeof input === "string" &&
    /^mcp-write-action:[a-z0-9][a-z0-9._:-]{1,160}$/u.test(input) &&
    !containsUnsafeText(input)
  );
}

function isSafeIdempotencyKey(input: unknown): input is str {
  return (
    typeof input === "string" &&
    /^mcp-write-action:[a-z0-9][a-z0-9._:-]{1,96}$/u.test(input) &&
    !containsUnsafeText(input)
  );
}

function isOptionalSafeIdempotencyKey(
  record: Record<str, unknown>,
  key: str,
): boolean {
  return !hasOwn(record, key) || isSafeIdempotencyKey(record[key]);
}

function isSafeText(input: unknown, maxLength: num): input is str {
  return (
    typeof input === "string" &&
    /\S/u.test(input) &&
    input.length <= maxLength &&
    !containsUnsafeText(input)
  );
}

function containsUnsafeText(input: str): boolean {
  const normalized = input.normalize("NFKC");
  return UNSAFE_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function allTrue(checks: readonly boolean[]): boolean {
  return checks.every(Boolean);
}

function arrayEquals(left: readonly unknown[], right: readonly unknown[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function hasOwn(record: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readExactRecord(
  input: unknown,
  allowedKeys: readonly str[],
  requiredKeys: readonly str[],
): Record<str, unknown> | undefined {
  const record = readPlainObjectRecord(input);
  if (!record) return undefined;
  if (!Object.keys(record).every((key) => allowedKeys.includes(key))) {
    return undefined;
  }
  if (
    !requiredKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(record, key),
    )
  ) {
    return undefined;
  }
  return record;
}

function readPlainObjectRecord(input: unknown): Record<str, unknown> | undefined {
  const descriptors = readPlainObjectDescriptors(input);
  if (!descriptors) return undefined;
  try {
    const record: Record<str, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return undefined;
      const descriptor = descriptors[key];
      if (!isEnumerableDataDescriptor(descriptor)) return undefined;
      const directValue = (input as Record<str, unknown>)[key];
      if (directValue !== descriptor.value) return undefined;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return undefined;
  }
}

function readPlainObjectDescriptors(
  input: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return undefined;
    }
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    return Object.getOwnPropertyDescriptors(input);
  } catch {
    return undefined;
  }
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === true &&
    "value" in descriptor
  );
}
