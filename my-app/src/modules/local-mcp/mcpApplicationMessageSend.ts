import {
  assertMcpOutboundEgressAllowed,
  McpOutboundEgressBlockedError,
  type McpOutboundEgressDataClassV1,
  type McpOutboundEgressDecisionV1,
  type McpOutboundEgressPolicyV1,
} from "./mcpOutboundEgressPolicy";
import {
  assertMcpWriteActionExecutionDisabled,
  createMcpWriteActionProposal,
  type McpWriteActionConfirmationResultV1,
  type McpWriteActionDataClassV1,
  type McpWriteActionProposalV1,
} from "./mcpWriteActionFramework";

export type McpApplicationMessageArtifactKindV1 =
  | "cover_letter"
  | "application_package";

export type McpApplicationMessageDeliveryStatusV1 =
  | "sent"
  | "duplicate_accepted"
  | "idempotency_conflict"
  | "rejected_by_provider"
  | "delivery_status_unknown";

export type McpApplicationMessageSendReasonV1 =
  | "sent"
  | "duplicate_accepted"
  | "invalid_input"
  | "confirmation_required"
  | "confirmation_rejected"
  | "confirmation_mismatch"
  | "final_preview_mismatch"
  | "channel_mismatch"
  | "egress_blocked"
  | "egress_guard_error"
  | "controlled_channel_error"
  | "idempotency_conflict"
  | "provider_rejected"
  | "unsafe_provider_receipt"
  | "delivery_status_unknown";

export type McpApplicationMessageSafeArtifactRefV1 = Readonly<{
  id: string;
  label: string;
  status: string;
  category: McpApplicationMessageArtifactKindV1;
  count: number;
  updatedAt: string;
  version: 1;
}>;

export type McpApplicationMessageEmailDestinationV1 = Readonly<{
  kind: "mcp_application_message_email_destination";
  email: string;
  version: 1;
}>;

type McpApplicationMessageRestrictedApprovedArtifactV1 = Readonly<{
  kind: "mcp_application_message_restricted_approved_artifact";
  artifactKind: McpApplicationMessageArtifactKindV1;
  artifactRef: McpApplicationMessageSafeArtifactRefV1;
  visibility: "restricted_full_content";
  plainTextBody: string;
  version: 1;
}>;

export type McpApplicationMessageFinalPreviewPayloadV1 = Readonly<{
  destination: McpApplicationMessageEmailDestinationV1;
  subject: string;
  body: string;
  artifactRef: McpApplicationMessageSafeArtifactRefV1;
  artifactKind: McpApplicationMessageArtifactKindV1;
  revisionLineage: readonly string[];
  idempotencyKey: string;
  channelId: "application_message_api";
  version: 1;
}>;

export type McpApplicationMessageFinalPreviewV1 = Readonly<{
  kind: "mcp_application_message_final_preview";
  visibility: "restricted_user_confirmation_only";
  modelVisible: false;
  componentVisible: false;
  artifactKind: McpApplicationMessageArtifactKindV1;
  artifactRef: McpApplicationMessageSafeArtifactRefV1;
  revisionLineage: readonly string[];
  destinationRef: string;
  channelId: "application_message_api";
  channelEndpointRef: string;
  finalPreviewDigest: string;
  payloadFingerprint: string;
  requiredConfirmationCopy: string;
  idempotencyKey: string;
  proposal: McpWriteActionProposalV1;
  payload: McpApplicationMessageFinalPreviewPayloadV1;
  createdAt: string;
  version: 1;
}>;

type McpApplicationMessageManualConfirmationV1 = Readonly<{
  kind: "mcp_application_message_manual_confirmation";
  actor: "human_user" | "assistant" | "model" | "system";
  state: "confirmed" | "rejected";
  proposalRef: string;
  idempotencyKey: string;
  finalPreviewDigest: string;
  confirmationCopy: string;
  confirmedAt: string;
  version: 1;
}>;

export type McpApplicationMessageProviderReceiptV1 = Readonly<{
  kind: "mcp_application_message_provider_receipt";
  status: McpApplicationMessageDeliveryStatusV1;
  providerReceiptRef: string;
  networkRequestExecuted: boolean;
  externalSideEffect: boolean;
  retrySafe: boolean;
  version: 1;
}>;

export type McpApplicationMessageChannelSendRequestV1 = Readonly<{
  kind: "mcp_application_message_channel_send_request";
  channelId: "application_message_api";
  endpointUrl: string;
  allowlistRuleId: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  redirectPolicy: Readonly<{
    mode: "disabled";
    maxRedirects: 0;
  }>;
  destination: McpApplicationMessageEmailDestinationV1;
  subject: string;
  body: string;
  artifactRef: McpApplicationMessageSafeArtifactRefV1;
  revisionLineage: readonly string[];
  finalPreviewDigest: string;
  payloadFingerprint: string;
  idempotencyKey: string;
  version: 1;
}>;

export type McpApplicationMessageControlledChannelConfigV1 = Readonly<{
  kind: "mcp_application_message_controlled_channel_config";
  channelId: "application_message_api";
  endpointUrl: string;
  credentialMode: "none";
  version: 1;
}>;

export type McpApplicationMessageControlledChannelV1 = Readonly<{
  kind: "mcp_application_message_controlled_channel";
  channelId: "application_message_api";
  endpointUrl: string;
  credentialMode: "none";
  version: 1;
  sendApprovedApplicationMessage: (
    request: McpApplicationMessageChannelSendRequestV1,
  ) => Promise<McpApplicationMessageProviderReceiptV1>;
}>;

export class McpApplicationMessageDeliveryDispatchError extends Error {
  constructor(
    message = "Controlled application message delivery status is unknown after dispatch.",
  ) {
    super(message);
    this.name = "McpApplicationMessageDeliveryDispatchError";
  }
}

export type McpApplicationMessageSendAuditEventV1 = Readonly<{
  kind: "mcp_application_message_send_audit_event";
  eventKind:
    | "application_message_send_blocked"
    | "application_message_send_authorized"
    | "application_message_send_provider_result";
  channelId?: "application_message_api";
  channelEndpointRef?: string;
  destinationRef?: string;
  finalPreviewDigest?: string;
  idempotencyRef?: string;
  allowlistRuleId?: string;
  providerReceiptRef?: string;
  deliveryStatus: McpApplicationMessageDeliveryStatusV1;
  reason: McpApplicationMessageSendReasonV1;
  writeActionExecuted: boolean;
  networkRequestExecuted: boolean;
  externalSideEffect: boolean;
  localPersistenceWrite: false;
  credentialStorage: "none";
  tokenStorage: "none";
  rawDataExposed: false;
  version: 1;
}>;

export type McpApplicationMessageSendResultV1 = Readonly<{
  kind: "mcp_application_message_send_result";
  allowed: boolean;
  reason: McpApplicationMessageSendReasonV1;
  deliveryStatus: McpApplicationMessageDeliveryStatusV1;
  retrySafe: boolean;
  auditEvent: McpApplicationMessageSendAuditEventV1;
  writeActionExecuted: boolean;
  realExecutionAllowed: boolean;
  externalSideEffect: boolean;
  networkRequestExecuted: boolean;
  localPersistenceWrite: false;
  credentialStorage: "none";
  tokenStorage: "none";
  safeRecoveryInstruction: string;
  version: 1;
}>;

export type McpApplicationMessageFinalPreviewResultV1 = Readonly<
  | {
      kind: "mcp_application_message_final_preview_result";
      allowed: true;
      finalPreview: McpApplicationMessageFinalPreviewV1;
      writeActionExecuted: false;
      networkRequestExecuted: false;
      externalSideEffect: false;
      localPersistenceWrite: false;
      credentialStorage: "none";
      tokenStorage: "none";
      version: 1;
    }
  | McpApplicationMessageSendResultV1
>;

type ParsedApprovedSummary = Readonly<{
  artifactKind: McpApplicationMessageArtifactKindV1;
  artifactRef: McpApplicationMessageSafeArtifactRefV1;
}>;

type ParsedFreshnessState = Readonly<{
  artifactRef: McpApplicationMessageSafeArtifactRefV1;
  approvedArtifactUpdatedAt: string;
  currentArtifactUpdatedAt: string;
  revisionLineage: readonly string[];
  latestApprovedRevisionRef: string;
  hasPendingRevision: false;
}>;

type ParsedPreviewRequest = Readonly<{
  artifactKind: McpApplicationMessageArtifactKindV1;
  approvalState: ParsedApprovedSummary;
  approvedArtifact: McpApplicationMessageRestrictedApprovedArtifactV1;
  freshnessState: ParsedFreshnessState;
  destination: McpApplicationMessageEmailDestinationV1;
  subject: string;
  channelId: "application_message_api";
  idempotencyKey: string;
  requestedAt: string;
}>;

type ParsedPreviewDeps = Readonly<{
  channelConfig: McpApplicationMessageControlledChannelConfigV1;
}>;

type ParsedSendAuthorization = Readonly<{
  finalPreview: McpApplicationMessageFinalPreviewV1;
  manualConfirmation: McpApplicationMessageManualConfirmationV1;
}>;

type ParsedDeps = Readonly<{
  channel: McpApplicationMessageControlledChannelV1;
  egressPolicy: McpOutboundEgressPolicyV1;
}>;

type AllowedEgressDecision = Extract<McpOutboundEgressDecisionV1, { allowed: true }>;
type ControlledEgressDecision = Readonly<
  | {
      kind: "allowed";
      decision: AllowedEgressDecision;
    }
  | {
      kind: "blocked";
    }
  | {
      kind: "guard_error";
    }
>;

type PreviewRequestRecord = Record<string, unknown> & {
  artifactKind: McpApplicationMessageArtifactKindV1;
  subject: string;
  channelId: "application_message_api";
  idempotencyKey: string;
  requestedAt: string;
};

type ApprovedSummaryRecord = Record<string, unknown> & {
  artifactKind: McpApplicationMessageArtifactKindV1;
};

type RestrictedArtifactRecord = Record<string, unknown> & {
  artifactKind: McpApplicationMessageArtifactKindV1;
  plainTextBody: string;
};

type FreshnessRecord = Record<string, unknown> & {
  approvedArtifactUpdatedAt: string;
  currentArtifactUpdatedAt: string;
  latestApprovedRevisionRef: string;
  hasPendingRevision: false;
  revisionLineage: readonly unknown[];
};

type FinalPreviewRecord = Record<string, unknown> & {
  artifactKind: McpApplicationMessageArtifactKindV1;
  destinationRef: string;
  channelId: "application_message_api";
  channelEndpointRef: string;
  finalPreviewDigest: string;
  payloadFingerprint: string;
  requiredConfirmationCopy: string;
  idempotencyKey: string;
  createdAt: string;
};

type FinalPreviewPayloadRecord = Record<string, unknown> & {
  artifactKind: McpApplicationMessageArtifactKindV1;
  channelId: "application_message_api";
  subject: string;
  body: string;
  idempotencyKey: string;
};

type ManualConfirmationRecord = Record<string, unknown> & {
  actor: McpApplicationMessageManualConfirmationV1["actor"];
  state: McpApplicationMessageManualConfirmationV1["state"];
  proposalRef: string;
  idempotencyKey: string;
  finalPreviewDigest: string;
  confirmationCopy: string;
  confirmedAt: string;
};

type ProviderReceiptRecord = Record<string, unknown> & {
  status: McpApplicationMessageDeliveryStatusV1;
  providerReceiptRef: string;
  networkRequestExecuted: boolean;
  externalSideEffect: boolean;
  retrySafe: boolean;
};

type ArtifactRefRecord = Record<string, unknown> & {
  id: string;
  label: string;
  status: string;
  category: McpApplicationMessageArtifactKindV1;
  count: number;
  updatedAt: string;
};

const CONTROLLED_CHANNEL_ID = "application_message_api";
const DEFAULT_CONTROLLED_CHANNEL_ENDPOINT =
  "https://api.twoweeks-send.example/v1/application-messages";
const DEFAULT_CONTROLLED_CHANNEL_CONFIG: McpApplicationMessageControlledChannelConfigV1 = {
  kind: "mcp_application_message_controlled_channel_config",
  channelId: CONTROLLED_CHANNEL_ID,
  endpointUrl: DEFAULT_CONTROLLED_CHANNEL_ENDPOINT,
  credentialMode: "none",
  version: 1,
};
const CURRENT_VERSION = 1;
const MAX_SUBJECT_LENGTH = 180;
const MAX_BODY_LENGTH = 50_000;
const MAX_SAFE_REF_LENGTH = 120;
const MAX_REVISION_LINEAGE_LENGTH = 26;
const TEXT_ENCODER = new TextEncoder();
const EGRESS_DATA_CLASSES: readonly McpOutboundEgressDataClassV1[] = [
  "generated_artifact",
  "application_material",
  "destination_metadata",
  "safe_ref",
  "user_confirmation",
  "audit_metadata",
];
const WRITE_ACTION_DATA_CLASSES: readonly McpWriteActionDataClassV1[] = [
  "generated_artifact",
  "application_material",
  "destination_metadata",
  "safe_ref",
  "user_confirmation",
  "audit_metadata",
];
const SEND_REQUEST_KEYS = [
  "kind",
  "artifactKind",
  "approvalState",
  "approvedArtifact",
  "freshnessState",
  "destination",
  "subject",
  "channelId",
  "idempotencyKey",
  "requestedAt",
  "version",
] as const;
const RESTRICTED_ARTIFACT_KEYS = [
  "kind",
  "artifactKind",
  "artifactRef",
  "visibility",
  "plainTextBody",
  "version",
] as const;
const DESTINATION_KEYS = ["kind", "email", "version"] as const;
const FRESHNESS_KEYS = [
  "kind",
  "artifactRef",
  "approvedArtifactUpdatedAt",
  "currentArtifactUpdatedAt",
  "revisionLineage",
  "latestApprovedRevisionRef",
  "hasPendingRevision",
  "checkedAt",
  "version",
] as const;
const MANUAL_CONFIRMATION_KEYS = [
  "kind",
  "actor",
  "state",
  "proposalRef",
  "idempotencyKey",
  "finalPreviewDigest",
  "confirmationCopy",
  "confirmedAt",
  "version",
] as const;
const AUTHORIZATION_KEYS = [
  "kind",
  "finalPreview",
  "manualConfirmation",
  "version",
] as const;
const FINAL_PREVIEW_KEYS = [
  "kind",
  "visibility",
  "modelVisible",
  "componentVisible",
  "artifactKind",
  "artifactRef",
  "revisionLineage",
  "destinationRef",
  "channelId",
  "channelEndpointRef",
  "finalPreviewDigest",
  "payloadFingerprint",
  "requiredConfirmationCopy",
  "idempotencyKey",
  "proposal",
  "payload",
  "createdAt",
  "version",
] as const;
const FINAL_PREVIEW_PAYLOAD_KEYS = [
  "destination",
  "subject",
  "body",
  "artifactRef",
  "artifactKind",
  "revisionLineage",
  "idempotencyKey",
  "channelId",
  "version",
] as const;
const WRITE_ACTION_PROPOSAL_KEYS = [
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
const WRITE_ACTION_CONFIRMATION_KEYS = [
  "kind",
  "required",
  "state",
  "requiredCopy",
  "version",
] as const;
const WRITE_ACTION_CAPABILITIES_KEYS = [
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
const WRITE_ACTION_AUDIT_EVENT_KEYS = [
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
const WRITE_ACTION_REDACTED_FLAGS_KEYS = [
  "rawDataExposed",
  "tokenOrIdentityExposed",
  "persisted",
  "writeActionExecuted",
  "externalSideEffect",
  "version",
] as const;
const PROVIDER_RECEIPT_KEYS = [
  "kind",
  "status",
  "providerReceiptRef",
  "networkRequestExecuted",
  "externalSideEffect",
  "retrySafe",
  "version",
] as const;
const PROVIDER_RECEIPT_EXPECTED_EFFECTS = {
  sent: {
    networkRequestExecuted: true,
    externalSideEffect: true,
    retrySafe: false,
  },
  duplicate_accepted: {
    networkRequestExecuted: true,
    externalSideEffect: false,
    retrySafe: true,
  },
  idempotency_conflict: {
    networkRequestExecuted: true,
    externalSideEffect: false,
    retrySafe: false,
  },
  rejected_by_provider: {
    networkRequestExecuted: true,
    externalSideEffect: false,
    retrySafe: false,
  },
  delivery_status_unknown: {
    networkRequestExecuted: true,
    externalSideEffect: true,
    retrySafe: false,
  },
} as const satisfies Record<
  McpApplicationMessageDeliveryStatusV1,
  Pick<
    McpApplicationMessageProviderReceiptV1,
    "networkRequestExecuted" | "externalSideEffect" | "retrySafe"
  >
>;
const PREVIEW_DEPS_KEYS = ["channelConfig"] as const;
const CONTROLLED_CHANNEL_CONFIG_KEYS = [
  "kind",
  "channelId",
  "endpointUrl",
  "credentialMode",
  "version",
] as const;

const FORBIDDEN_BODY_PATTERNS = [
  /<\s*html\b/iu,
  /<\s*body\b/iu,
  /^\s*(?:to|cc|bcc|subject|from|reply-to)\s*:/imu,
  /RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE/u,
  /RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE/u,
  /RAW_SOURCE_DOCUMENT_SENTINEL_DO_NOT_EXPOSE/u,
  /PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE/u,
  /NEVER_USE_SENTINEL_DO_NOT_EXPOSE/u,
  /SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE/u,
  /\bBearer\s+[A-Za-z0-9._-]+/u,
  /\b(?:access|refresh)[_-]?token\b/iu,
] as const;

export function createMcpApplicationMessageFinalPreview(
  input: unknown,
  deps?: unknown,
): McpApplicationMessageFinalPreviewResultV1 {
  const parsedDeps = parsePreviewDeps(deps);
  if (!parsedDeps) return buildBlockedSendResult("invalid_input");

  const parsed = parsePreviewRequest(input);
  if (!parsed) return buildBlockedSendResult("invalid_input");

  const proposalResult = createMcpWriteActionProposal({
    kind: "mcp_write_action_intent",
    intentKind: "write_action",
    actionLabel: "send_application_message",
    actionCategory: "send_message",
    affectedSurface: "controlled_application_message_channel",
    userVisibleSummary:
      "Send one approved application message through the controlled channel.",
    riskLevel: "high",
    requiredConfirmationCopy: "SEND pending_digest",
    idempotencyKey: parsed.idempotencyKey,
    rollbackPlan:
      "A delivered application message cannot be unsent; use the same idempotency key for recovery checks.",
    dataClasses: WRITE_ACTION_DATA_CLASSES,
    version: 1,
  });
  if (!proposalResult.allowed) return buildBlockedSendResult("invalid_input");

  const destinationRef = buildSafeRef(
    "mcp-safe-ref:application-message-destination",
    parsed.destination.email,
  );
  const channelEndpointRef = buildSafeRef(
    "mcp-safe-ref:application-message-endpoint",
    parsedDeps.channelConfig.endpointUrl,
  );
  const payloadFingerprint = buildPayloadFingerprint({
    artifactKind: parsed.artifactKind,
    artifactRef: parsed.approvedArtifact.artifactRef,
    body: parsed.approvedArtifact.plainTextBody,
    channelId: parsed.channelId,
    channelEndpointRef,
    destinationEmail: parsed.destination.email,
    revisionLineage: parsed.freshnessState.revisionLineage,
    subject: parsed.subject,
  });
  const digest = buildFinalPreviewDigest({
    idempotencyKey: parsed.idempotencyKey,
    payloadFingerprint,
    requestedAt: parsed.requestedAt,
  });
  const requiredConfirmationCopy = `SEND ${digest}`;
  const proposal = {
    ...proposalResult.proposal,
    proposalRef: parsed.idempotencyKey,
    confirmation: {
      ...proposalResult.proposal.confirmation,
      requiredCopy: requiredConfirmationCopy,
    },
  };

  return {
    kind: "mcp_application_message_final_preview_result",
    allowed: true,
    finalPreview: {
      kind: "mcp_application_message_final_preview",
      visibility: "restricted_user_confirmation_only",
      modelVisible: false,
      componentVisible: false,
      artifactKind: parsed.artifactKind,
      artifactRef: parsed.approvedArtifact.artifactRef,
      revisionLineage: parsed.freshnessState.revisionLineage,
      destinationRef,
      channelId: parsed.channelId,
      channelEndpointRef,
      finalPreviewDigest: digest,
      payloadFingerprint,
      requiredConfirmationCopy,
      idempotencyKey: parsed.idempotencyKey,
      proposal,
      payload: {
        destination: parsed.destination,
        subject: parsed.subject,
        body: parsed.approvedArtifact.plainTextBody,
        artifactRef: parsed.approvedArtifact.artifactRef,
        artifactKind: parsed.artifactKind,
        revisionLineage: parsed.freshnessState.revisionLineage,
        idempotencyKey: parsed.idempotencyKey,
        channelId: parsed.channelId,
        version: 1,
      },
      createdAt: parsed.requestedAt,
      version: 1,
    },
    writeActionExecuted: false,
    networkRequestExecuted: false,
    externalSideEffect: false,
    localPersistenceWrite: false,
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

export async function sendMcpApprovedApplicationMessage(
  input: unknown,
  deps: unknown,
): Promise<McpApplicationMessageSendResultV1> {
  const parsedDeps = parseDeps(deps);
  if (!parsedDeps) return buildBlockedSendResult("invalid_input");

  const parsedAuthorization = parseSendAuthorization(input);
  if (!parsedAuthorization) return buildBlockedSendResult("confirmation_required");

  const preview = parsedAuthorization.finalPreview;
  const confirmation = parsedAuthorization.manualConfirmation;
  const blockedReason = getSendPreflightBlockedReason(
    preview,
    confirmation,
    parsedDeps.channel,
  );
  if (blockedReason) return buildBlockedSendResult(blockedReason, preview);

  const egressDecision = getControlledEgressDecision(
    parsedDeps.channel.endpointUrl,
    parsedDeps.egressPolicy,
  );
  if (egressDecision.kind === "blocked") {
    return buildBlockedSendResult("egress_blocked", preview);
  }
  if (egressDecision.kind === "guard_error") {
    return buildBlockedSendResult("egress_guard_error", preview);
  }

  return executeControlledApplicationMessageSend(
    preview,
    parsedDeps.channel,
    egressDecision.decision,
  );
}

function getSendPreflightBlockedReason(
  preview: McpApplicationMessageFinalPreviewV1,
  confirmation: McpApplicationMessageManualConfirmationV1,
  channel: McpApplicationMessageControlledChannelV1,
): Extract<
  McpApplicationMessageSendReasonV1,
  | "final_preview_mismatch"
  | "confirmation_required"
  | "confirmation_rejected"
  | "confirmation_mismatch"
  | "channel_mismatch"
> | undefined {
  if (!validateFinalPreview(preview).ok) return "final_preview_mismatch";

  const confirmationValidation = validateManualConfirmation(preview, confirmation);
  if (confirmationValidation !== "ok") return confirmationValidation;
  if (!channelMatchesPreview(channel, preview)) return "channel_mismatch";
  if (!writeGuardAcceptsConfirmedPreview(preview, confirmation)) {
    return "confirmation_mismatch";
  }
  return undefined;
}

function writeGuardAcceptsConfirmedPreview(
  preview: McpApplicationMessageFinalPreviewV1,
  confirmation: McpApplicationMessageManualConfirmationV1,
): boolean {
  const frameworkConfirmation: McpWriteActionConfirmationResultV1 = {
    kind: "mcp_write_action_confirmation_result",
    proposalRef: preview.proposal.proposalRef,
    state: "confirmed",
    actor: "human_user",
    confirmationCopy: confirmation.confirmationCopy,
    idempotencyKey: confirmation.idempotencyKey,
    version: 1,
  };
  const writeGuard = assertMcpWriteActionExecutionDisabled(
    preview.proposal,
    frameworkConfirmation,
  );
  return !writeGuard.allowed && writeGuard.reason === "write_execution_disabled";
}

function getControlledEgressDecision(
  endpointUrl: string,
  egressPolicy: McpOutboundEgressPolicyV1,
): ControlledEgressDecision {
  try {
    const decision = assertMcpOutboundEgressAllowed(
      {
        kind: "mcp_outbound_egress_request",
        destinationUrl: endpointUrl,
        method: "POST",
        actionCategory: "send_message",
        dataClasses: EGRESS_DATA_CLASSES,
        redirectPolicy: {
          mode: "disabled",
          maxRedirects: 0,
          version: 1,
        },
        version: 1,
      },
      egressPolicy,
    );
    return {
      kind: "allowed",
      decision,
    };
  } catch (error) {
    if (error instanceof McpOutboundEgressBlockedError) {
      return { kind: "blocked" };
    }
    return { kind: "guard_error" };
  }
}

async function executeControlledApplicationMessageSend(
  preview: McpApplicationMessageFinalPreviewV1,
  channel: McpApplicationMessageControlledChannelV1,
  egressDecision: AllowedEgressDecision,
): Promise<McpApplicationMessageSendResultV1> {
  try {
    const receipt = await channel.sendApprovedApplicationMessage(
      buildChannelSendRequest(preview, channel.endpointUrl, egressDecision),
    );
    return buildSendResultForProviderReceipt(
      preview,
      egressDecision.allowlistRuleId,
      receipt,
    );
  } catch (error) {
    if (!isDeliveryDispatchError(error)) {
      return buildBlockedSendResult("controlled_channel_error", preview);
    }
    return buildExecutedSendResult({
      allowed: false,
      reason: "delivery_status_unknown",
      deliveryStatus: "delivery_status_unknown",
      retrySafe: false,
      preview,
      allowlistRuleId: egressDecision.allowlistRuleId,
      providerReceiptRef: undefined,
      networkRequestExecuted: true,
      externalSideEffect: true,
    });
  }
}

function buildChannelSendRequest(
  preview: McpApplicationMessageFinalPreviewV1,
  endpointUrl: string,
  egressDecision: AllowedEgressDecision,
): McpApplicationMessageChannelSendRequestV1 {
  return {
    kind: "mcp_application_message_channel_send_request",
    channelId: preview.channelId,
    endpointUrl,
    allowlistRuleId: egressDecision.allowlistRuleId,
    ...(egressDecision.timeoutMs ? { timeoutMs: egressDecision.timeoutMs } : {}),
    ...(egressDecision.maxResponseBytes
      ? { maxResponseBytes: egressDecision.maxResponseBytes }
      : {}),
    redirectPolicy: {
      mode: "disabled",
      maxRedirects: 0,
    },
    destination: preview.payload.destination,
    subject: preview.payload.subject,
    body: preview.payload.body,
    artifactRef: preview.artifactRef,
    revisionLineage: preview.revisionLineage,
    finalPreviewDigest: preview.finalPreviewDigest,
    payloadFingerprint: preview.payloadFingerprint,
    idempotencyKey: preview.idempotencyKey,
    version: 1,
  };
}

function buildSendResultForProviderReceipt(
  preview: McpApplicationMessageFinalPreviewV1,
  allowlistRuleId: string,
  receipt: unknown,
): McpApplicationMessageSendResultV1 {
  const parsedReceipt = parseProviderReceipt(receipt);
  if (!parsedReceipt) {
    return buildExecutedSendResult({
      allowed: false,
      reason: "unsafe_provider_receipt",
      deliveryStatus: "delivery_status_unknown",
      retrySafe: false,
      preview,
      allowlistRuleId,
      providerReceiptRef: undefined,
      networkRequestExecuted: true,
      externalSideEffect: false,
    });
  }
  return buildSendResultForParsedReceipt(preview, allowlistRuleId, parsedReceipt);
}

function buildSendResultForParsedReceipt(
  preview: McpApplicationMessageFinalPreviewV1,
  allowlistRuleId: string,
  receipt: McpApplicationMessageProviderReceiptV1,
): McpApplicationMessageSendResultV1 {
  if (receipt.status === "sent") {
    return buildReceiptResult(preview, allowlistRuleId, receipt, true, "sent");
  }
  if (receipt.status === "duplicate_accepted") {
    return buildReceiptResult(
      preview,
      allowlistRuleId,
      receipt,
      true,
      "duplicate_accepted",
    );
  }
  if (receipt.status === "idempotency_conflict") {
    return buildReceiptResult(
      preview,
      allowlistRuleId,
      receipt,
      false,
      "idempotency_conflict",
    );
  }
  if (receipt.status === "rejected_by_provider") {
    return buildReceiptResult(
      preview,
      allowlistRuleId,
      receipt,
      false,
      "provider_rejected",
    );
  }
  return buildReceiptResult(
    preview,
    allowlistRuleId,
    receipt,
    false,
    "delivery_status_unknown",
  );
}

function buildReceiptResult(
  preview: McpApplicationMessageFinalPreviewV1,
  allowlistRuleId: string,
  receipt: McpApplicationMessageProviderReceiptV1,
  allowed: boolean,
  reason: McpApplicationMessageSendReasonV1,
): McpApplicationMessageSendResultV1 {
  return buildExecutedSendResult({
    allowed,
    reason,
    deliveryStatus: receipt.status,
    retrySafe: allowed ? receipt.retrySafe : false,
    preview,
    allowlistRuleId,
    providerReceiptRef: receipt.providerReceiptRef,
    networkRequestExecuted: receipt.networkRequestExecuted,
    externalSideEffect: allowed
      ? receipt.externalSideEffect
      : receipt.status === "delivery_status_unknown" && receipt.externalSideEffect,
  });
}

function parsePreviewRequest(input: unknown): ParsedPreviewRequest | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !isPreviewRequestRecord(record)) return undefined;

  const approvalState = parseApprovedSummary(record.approvalState);
  const approvedArtifact = parseRestrictedApprovedArtifact(record.approvedArtifact);
  const freshnessState = parseFreshnessState(record.freshnessState);
  const destination = parseDestination(record.destination);
  const subject = normalizeSubject(record.subject);
  if (!approvalState || !approvedArtifact || !freshnessState || !destination || !subject) {
    return undefined;
  }
  if (
    !previewRequestPartsAreConsistent(
      record.artifactKind,
      approvalState,
      approvedArtifact,
      freshnessState,
    )
  ) {
    return undefined;
  }

  return {
    artifactKind: record.artifactKind,
    approvalState,
    approvedArtifact,
    freshnessState,
    destination,
    subject,
    channelId: record.channelId,
    idempotencyKey: record.idempotencyKey,
    requestedAt: record.requestedAt,
  };
}

function parseApprovedSummary(input: unknown): ParsedApprovedSummary | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !isApprovedSummaryRecord(record)) return undefined;

  const artifactRef = parseArtifactRef(record.artifactRef);
  const safeFlags = readPlainObjectRecord(record.safeFlags);
  if (!artifactRef || artifactRef.category !== record.artifactKind) {
    return undefined;
  }
  if (!safeFlags || !approvedSummaryFlagsAreSafe(safeFlags)) return undefined;

  return {
    artifactKind: record.artifactKind,
    artifactRef,
  };
}

function parseRestrictedApprovedArtifact(
  input: unknown,
): McpApplicationMessageRestrictedApprovedArtifactV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !isRestrictedArtifactRecord(record)) return undefined;

  const artifactRef = parseArtifactRef(record.artifactRef);
  const body = normalizeBody(record.plainTextBody);
  if (!artifactRef || artifactRef.category !== record.artifactKind || !body) return undefined;

  return {
    kind: "mcp_application_message_restricted_approved_artifact",
    artifactKind: record.artifactKind,
    artifactRef,
    visibility: "restricted_full_content",
    plainTextBody: body,
    version: 1,
  };
}

function parseFreshnessState(input: unknown): ParsedFreshnessState | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !isFreshnessRecord(record)) return undefined;

  const artifactRef = parseArtifactRef(record.artifactRef);
  const revisionLineage = parseRevisionLineage(record.revisionLineage);
  if (!artifactRef || !revisionLineage) return undefined;
  return {
    artifactRef,
    approvedArtifactUpdatedAt: record.approvedArtifactUpdatedAt,
    currentArtifactUpdatedAt: record.currentArtifactUpdatedAt,
    revisionLineage,
    latestApprovedRevisionRef: record.latestApprovedRevisionRef,
    hasPendingRevision: false,
  };
}

function parseDestination(
  input: unknown,
): McpApplicationMessageEmailDestinationV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (
    !record ||
    !hasOnlyKeys(record, DESTINATION_KEYS) ||
    record.kind !== "mcp_application_message_email_destination" ||
    record.version !== CURRENT_VERSION ||
    typeof record.email !== "string"
  ) {
    return undefined;
  }
  const email = normalizeSingleEmail(record.email);
  if (!email) return undefined;
  return {
    kind: "mcp_application_message_email_destination",
    email,
    version: 1,
  };
}

function parseSendAuthorization(
  input: unknown,
): ParsedSendAuthorization | undefined {
  const record = readPlainObjectRecord(input);
  if (
    !record ||
    !hasOnlyKeys(record, AUTHORIZATION_KEYS) ||
    record.kind !== "mcp_application_message_send_authorization" ||
    record.version !== CURRENT_VERSION
  ) {
    return undefined;
  }
  const finalPreview = parseFinalPreview(record.finalPreview);
  const manualConfirmation = parseManualConfirmation(record.manualConfirmation);
  if (!finalPreview || !manualConfirmation) return undefined;
  return {
    finalPreview,
    manualConfirmation,
  };
}

function parseFinalPreview(
  input: unknown,
): McpApplicationMessageFinalPreviewV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !isFinalPreviewRecord(record)) return undefined;

  const artifactRef = parseArtifactRef(record.artifactRef);
  const revisionLineage = parseRevisionLineage(record.revisionLineage);
  const payload = parseFinalPreviewPayload(record.payload);
  const proposal = parseApplicationMessageWriteProposal(
    record.proposal,
    record.requiredConfirmationCopy,
    record.idempotencyKey,
  );
  if (!artifactRef || !revisionLineage || !payload || !proposal) return undefined;
  if (
    !finalPreviewPartsAreConsistent(
      record,
      artifactRef,
      revisionLineage,
      payload,
      proposal,
    )
  ) {
    return undefined;
  }
  return {
    kind: "mcp_application_message_final_preview",
    visibility: "restricted_user_confirmation_only",
    modelVisible: false,
    componentVisible: false,
    artifactKind: record.artifactKind,
    artifactRef,
    revisionLineage,
    destinationRef: record.destinationRef,
    channelId: CONTROLLED_CHANNEL_ID,
    channelEndpointRef: record.channelEndpointRef,
    finalPreviewDigest: record.finalPreviewDigest,
    payloadFingerprint: record.payloadFingerprint,
    requiredConfirmationCopy: record.requiredConfirmationCopy,
    idempotencyKey: record.idempotencyKey,
    proposal,
    payload,
    createdAt: record.createdAt,
    version: 1,
  };
}

function parseFinalPreviewPayload(
  input: unknown,
): McpApplicationMessageFinalPreviewPayloadV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !isFinalPreviewPayloadRecord(record)) return undefined;

  const destination = parseDestination(record.destination);
  const artifactRef = parseArtifactRef(record.artifactRef);
  const revisionLineage = parseRevisionLineage(record.revisionLineage);
  const subject = normalizeSubject(record.subject);
  const body = normalizeBody(record.body);
  if (!destination || !artifactRef || !revisionLineage || !subject || !body) {
    return undefined;
  }
  return {
    destination,
    subject,
    body,
    artifactRef,
    artifactKind: record.artifactKind,
    revisionLineage,
    idempotencyKey: record.idempotencyKey,
    channelId: CONTROLLED_CHANNEL_ID,
    version: 1,
  };
}

function parseApplicationMessageWriteProposal(
  input: unknown,
  requiredConfirmationCopy: string,
  idempotencyKey: string,
): McpWriteActionProposalV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !hasOnlyKeys(record, WRITE_ACTION_PROPOSAL_KEYS)) return undefined;

  const dataClasses = parseExpectedWriteActionDataClasses(record.dataClasses);
  if (!dataClasses) return undefined;

  const confirmation = parseApplicationMessageProposalConfirmation(
    record.confirmation,
    requiredConfirmationCopy,
  );
  const capabilities = parseApplicationMessageProposalCapabilities(record.capabilities);
  const auditEvent = parseApplicationMessageProposalAuditEvent(
    record.auditEvent,
    idempotencyKey,
    dataClasses,
  );
  if (!confirmation || !capabilities || !auditEvent) return undefined;

  if (!applicationMessageProposalRecordIsConsistent(record, auditEvent, idempotencyKey)) {
    return undefined;
  }

  return buildApplicationMessageWriteProposal(
    record,
    idempotencyKey,
    dataClasses,
    confirmation,
    capabilities,
    auditEvent,
  );
}

function applicationMessageProposalRecordIsConsistent(
  record: Record<string, unknown>,
  auditEvent: McpWriteActionProposalV1["auditEvent"],
  idempotencyKey: string,
): boolean {
  return allChecks([
    record.kind === "mcp_write_action_proposal",
    record.proposalRef === idempotencyKey,
    record.operationKind === "proposed_write_action",
    record.actionLabel === "send_application_message",
    record.actionCategory === "send_message",
    record.affectedSurface === "controlled_application_message_channel",
    typeof record.userVisibleSummary === "string",
    typeof record.userVisibleSummary === "string" &&
      record.userVisibleSummary.length > 0,
    record.riskLevel === "high" || record.riskLevel === "critical",
    record.idempotencyKey === idempotencyKey,
    typeof record.rollbackPlan === "string",
    typeof record.rollbackPlan === "string" && record.rollbackPlan.length > 0,
    record.executionStatus === "proposed_pending_confirmation",
    auditEvent.riskLevel === record.riskLevel,
    record.writeActionExecuted === false,
    record.realExecutionAllowed === false,
    record.externalSideEffect === false,
    record.persisted === false,
    record.networkAccess === false,
    record.version === CURRENT_VERSION,
  ]);
}

function buildApplicationMessageWriteProposal(
  record: Record<string, unknown>,
  idempotencyKey: string,
  dataClasses: readonly McpWriteActionDataClassV1[],
  confirmation: McpWriteActionProposalV1["confirmation"],
  capabilities: McpWriteActionProposalV1["capabilities"],
  auditEvent: McpWriteActionProposalV1["auditEvent"],
): McpWriteActionProposalV1 {
  return {
    kind: "mcp_write_action_proposal",
    proposalRef: idempotencyKey,
    operationKind: "proposed_write_action",
    actionLabel: "send_application_message",
    actionCategory: "send_message",
    affectedSurface: "controlled_application_message_channel",
    userVisibleSummary: record.userVisibleSummary as string,
    riskLevel: record.riskLevel as McpWriteActionProposalV1["riskLevel"],
    idempotencyKey,
    rollbackPlan: record.rollbackPlan as string,
    dataClasses,
    confirmation,
    executionStatus: "proposed_pending_confirmation",
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

function parseApplicationMessageProposalConfirmation(
  input: unknown,
  requiredConfirmationCopy: string,
): McpWriteActionProposalV1["confirmation"] | undefined {
  const record = readPlainObjectRecord(input);
  if (
    !record ||
    !hasOnlyKeys(record, WRITE_ACTION_CONFIRMATION_KEYS) ||
    record.kind !== "mcp_write_action_confirmation_requirement" ||
    record.required !== true ||
    record.state !== "required_unconfirmed" ||
    record.requiredCopy !== requiredConfirmationCopy ||
    record.version !== CURRENT_VERSION
  ) {
    return undefined;
  }
  return {
    kind: "mcp_write_action_confirmation_requirement",
    required: true,
    state: "required_unconfirmed",
    requiredCopy: requiredConfirmationCopy,
    version: 1,
  };
}

function parseApplicationMessageProposalCapabilities(
  input: unknown,
): McpWriteActionProposalV1["capabilities"] | undefined {
  const record = readPlainObjectRecord(input);
  if (
    !record ||
    !hasOnlyKeys(record, WRITE_ACTION_CAPABILITIES_KEYS) ||
    !allChecks([
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
      record.version === CURRENT_VERSION,
    ])
  ) {
    return undefined;
  }
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

function parseApplicationMessageProposalAuditEvent(
  input: unknown,
  idempotencyKey: string,
  proposalDataClasses: readonly McpWriteActionDataClassV1[],
): McpWriteActionProposalV1["auditEvent"] | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !hasOnlyKeys(record, WRITE_ACTION_AUDIT_EVENT_KEYS)) {
    return undefined;
  }

  const dataClasses = parseExpectedWriteActionDataClasses(record.dataClasses);
  const redactedFlags = parseApplicationMessageProposalRedactedFlags(
    record.redactedFlags,
  );
  if (!dataClasses || !redactedFlags) return undefined;

  if (
    !allChecks([
      arraysEqual(dataClasses, proposalDataClasses),
      record.kind === "mcp_write_action_audit_event",
      record.eventKind === "write_action_proposed",
      record.actionLabel === "send_application_message",
      record.actionCategory === "send_message",
      record.affectedSurface === "controlled_application_message_channel",
      record.riskLevel === "high" || record.riskLevel === "critical",
      record.idempotencyKey === idempotencyKey,
      record.persisted === false,
      record.writeActionExecuted === false,
      record.version === CURRENT_VERSION,
    ])
  ) {
    return undefined;
  }

  return {
    kind: "mcp_write_action_audit_event",
    eventKind: "write_action_proposed",
    actionLabel: "send_application_message",
    actionCategory: "send_message",
    affectedSurface: "controlled_application_message_channel",
    riskLevel: record.riskLevel as McpWriteActionProposalV1["riskLevel"],
    idempotencyKey,
    dataClasses,
    redactedFlags,
    persisted: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseApplicationMessageProposalRedactedFlags(
  input: unknown,
): McpWriteActionProposalV1["auditEvent"]["redactedFlags"] | undefined {
  const record = readPlainObjectRecord(input);
  if (
    !record ||
    !hasOnlyKeys(record, WRITE_ACTION_REDACTED_FLAGS_KEYS) ||
    !allChecks([
      record.rawDataExposed === false,
      record.tokenOrIdentityExposed === false,
      record.persisted === false,
      record.writeActionExecuted === false,
      record.externalSideEffect === false,
      record.version === CURRENT_VERSION,
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

function parseExpectedWriteActionDataClasses(
  input: unknown,
): readonly McpWriteActionDataClassV1[] | undefined {
  if (!Array.isArray(input) || input.length !== WRITE_ACTION_DATA_CLASSES.length) {
    return undefined;
  }
  const dataClasses: McpWriteActionDataClassV1[] = [];
  for (const value of input) {
    if (!isExpectedWriteActionDataClass(value)) return undefined;
    dataClasses.push(value);
  }
  if (!arraysEqual(dataClasses, WRITE_ACTION_DATA_CLASSES)) return undefined;
  return dataClasses;
}

function parseManualConfirmation(
  input: unknown,
): McpApplicationMessageManualConfirmationV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !isManualConfirmationRecord(record)) return undefined;

  return {
    kind: "mcp_application_message_manual_confirmation",
    actor: record.actor,
    state: record.state,
    proposalRef: record.proposalRef,
    idempotencyKey: record.idempotencyKey,
    finalPreviewDigest: record.finalPreviewDigest,
    confirmationCopy: record.confirmationCopy,
    confirmedAt: record.confirmedAt,
    version: 1,
  };
}

function parseDeps(input: unknown): ParsedDeps | undefined {
  const record = readPlainObjectRecord(input);
  if (!record) return undefined;
  const channel = parseControlledChannel(record.channel);
  const egressPolicy = record.egressPolicy;
  if (!channel || !isEgressPolicy(egressPolicy)) return undefined;
  return {
    channel,
    egressPolicy,
  };
}

function parsePreviewDeps(input: unknown): ParsedPreviewDeps | undefined {
  if (input === undefined) {
    return { channelConfig: DEFAULT_CONTROLLED_CHANNEL_CONFIG };
  }
  const record = readPlainObjectRecord(input);
  if (!record || !hasOnlyKeys(record, PREVIEW_DEPS_KEYS)) return undefined;

  const channelConfig = parseControlledChannelConfig(record.channelConfig);
  if (!channelConfig) return undefined;
  return { channelConfig };
}

function parseControlledChannelConfig(
  input: unknown,
): McpApplicationMessageControlledChannelConfigV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (
    !record ||
    !hasOnlyKeys(record, CONTROLLED_CHANNEL_CONFIG_KEYS) ||
    record.kind !== "mcp_application_message_controlled_channel_config" ||
    record.channelId !== CONTROLLED_CHANNEL_ID ||
    record.credentialMode !== "none" ||
    record.version !== CURRENT_VERSION ||
    typeof record.endpointUrl !== "string" ||
    !isTrustedChannelEndpointUrl(record.endpointUrl)
  ) {
    return undefined;
  }
  return {
    kind: "mcp_application_message_controlled_channel_config",
    channelId: CONTROLLED_CHANNEL_ID,
    endpointUrl: record.endpointUrl,
    credentialMode: "none",
    version: 1,
  };
}

function parseControlledChannel(
  input: unknown,
): McpApplicationMessageControlledChannelV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (
    !record ||
    record.kind !== "mcp_application_message_controlled_channel" ||
    record.channelId !== CONTROLLED_CHANNEL_ID ||
    record.credentialMode !== "none" ||
    record.version !== CURRENT_VERSION ||
    typeof record.endpointUrl !== "string" ||
    !isTrustedChannelEndpointUrl(record.endpointUrl) ||
    typeof record.sendApprovedApplicationMessage !== "function"
  ) {
    return undefined;
  }
  return record as McpApplicationMessageControlledChannelV1;
}

function parseProviderReceipt(
  input: unknown,
): McpApplicationMessageProviderReceiptV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !isProviderReceiptRecord(record)) return undefined;
  if (!providerReceiptStatusMatchesEffects(record)) return undefined;

  return {
    kind: "mcp_application_message_provider_receipt",
    status: record.status,
    providerReceiptRef: record.providerReceiptRef,
    networkRequestExecuted: record.networkRequestExecuted,
    externalSideEffect: record.externalSideEffect,
    retrySafe: record.retrySafe,
    version: 1,
  };
}

function isPreviewRequestRecord(
  record: Record<string, unknown>,
): record is PreviewRequestRecord {
  return allChecks([
    hasOnlyKeys(record, SEND_REQUEST_KEYS),
    record.kind === "mcp_application_message_send_request",
    record.version === CURRENT_VERSION,
    record.channelId === CONTROLLED_CHANNEL_ID,
    isArtifactKind(record.artifactKind),
    typeof record.subject === "string",
    typeof record.idempotencyKey === "string",
    typeof record.requestedAt === "string",
    typeof record.requestedAt === "string" && isIsoTimestamp(record.requestedAt),
    typeof record.idempotencyKey === "string" &&
      isIdempotencyKey(record.idempotencyKey),
  ]);
}

function previewRequestPartsAreConsistent(
  artifactKind: McpApplicationMessageArtifactKindV1,
  approvalState: ParsedApprovedSummary,
  approvedArtifact: McpApplicationMessageRestrictedApprovedArtifactV1,
  freshnessState: ParsedFreshnessState,
): boolean {
  const latestLineageRef =
    freshnessState.revisionLineage[freshnessState.revisionLineage.length - 1];
  return allChecks([
    artifactKind === approvalState.artifactKind,
    artifactKind === approvedArtifact.artifactKind,
    sameArtifactRef(approvalState.artifactRef, approvedArtifact.artifactRef),
    sameArtifactRef(approvalState.artifactRef, freshnessState.artifactRef),
    freshnessState.approvedArtifactUpdatedAt ===
      approvalState.artifactRef.updatedAt,
    freshnessState.currentArtifactUpdatedAt === approvalState.artifactRef.updatedAt,
    freshnessState.hasPendingRevision === false,
    freshnessState.latestApprovedRevisionRef === approvalState.artifactRef.id,
    freshnessState.revisionLineage.length > 0,
    latestLineageRef === approvalState.artifactRef.id,
  ]);
}

function isApprovedSummaryRecord(
  record: Record<string, unknown>,
): record is ApprovedSummaryRecord {
  return allChecks([
    record.kind === "mcp_generated_artifact_human_approval_workflow_summary",
    record.allowed === true,
    record.version === CURRENT_VERSION,
    isArtifactKind(record.artifactKind),
    record.artifactStatus === "approved_for_preview",
    record.workflowStatus === "approved_for_preview",
    record.decision === "approve_preview",
    record.decisionStatus === "approved_for_preview",
    record.visibilityCategory === "safe_summary_only",
    record.modelVisible === true,
    record.componentVisible === true,
  ]);
}

function approvedSummaryFlagsAreSafe(flags: Record<string, unknown>): boolean {
  return allChecks([
    flags.humanReviewRequired === false,
    flags.approvedForPreview === true,
    flags.approvedForExport === false,
    flags.approvedForDownload === false,
    flags.approvedForSend === false,
    flags.approvedForSubmit === false,
    flags.approvedForApply === false,
    flags.fullContentRestricted === true,
    flags.rawDataExposed === false,
    flags.version === CURRENT_VERSION,
  ]);
}

function isRestrictedArtifactRecord(
  record: Record<string, unknown>,
): record is RestrictedArtifactRecord {
  return allChecks([
    hasOnlyKeys(record, RESTRICTED_ARTIFACT_KEYS),
    record.kind === "mcp_application_message_restricted_approved_artifact",
    record.visibility === "restricted_full_content",
    record.version === CURRENT_VERSION,
    isArtifactKind(record.artifactKind),
    typeof record.plainTextBody === "string",
  ]);
}

function isFreshnessRecord(
  record: Record<string, unknown>,
): record is FreshnessRecord {
  return allChecks([
    hasOnlyKeys(record, FRESHNESS_KEYS),
    record.kind === "mcp_application_message_send_freshness_state",
    record.version === CURRENT_VERSION,
    typeof record.approvedArtifactUpdatedAt === "string",
    typeof record.currentArtifactUpdatedAt === "string",
    typeof record.latestApprovedRevisionRef === "string",
    record.hasPendingRevision === false,
    typeof record.approvedArtifactUpdatedAt === "string" &&
      isIsoTimestamp(record.approvedArtifactUpdatedAt),
    typeof record.currentArtifactUpdatedAt === "string" &&
      isIsoTimestamp(record.currentArtifactUpdatedAt),
    Array.isArray(record.revisionLineage),
  ]);
}

function isFinalPreviewRecord(
  record: Record<string, unknown>,
): record is FinalPreviewRecord {
  return allChecks([
    hasOnlyKeys(record, FINAL_PREVIEW_KEYS),
    record.kind === "mcp_application_message_final_preview",
    record.visibility === "restricted_user_confirmation_only",
    record.modelVisible === false,
    record.componentVisible === false,
    record.version === CURRENT_VERSION,
    isArtifactKind(record.artifactKind),
    record.channelId === CONTROLLED_CHANNEL_ID,
    typeof record.destinationRef === "string",
    typeof record.channelEndpointRef === "string",
    typeof record.finalPreviewDigest === "string",
    typeof record.payloadFingerprint === "string",
    typeof record.requiredConfirmationCopy === "string",
    typeof record.idempotencyKey === "string",
    typeof record.createdAt === "string",
    typeof record.createdAt === "string" && isIsoTimestamp(record.createdAt),
  ]);
}

function finalPreviewPartsAreConsistent(
  record: FinalPreviewRecord,
  artifactRef: McpApplicationMessageSafeArtifactRefV1,
  revisionLineage: readonly string[],
  payload: McpApplicationMessageFinalPreviewPayloadV1,
  proposal: McpWriteActionProposalV1,
): boolean {
  return allChecks([
    artifactRef.category === record.artifactKind,
    sameArtifactRef(artifactRef, payload.artifactRef),
    payload.artifactKind === record.artifactKind,
    payload.idempotencyKey === record.idempotencyKey,
    payload.channelId === record.channelId,
    arraysEqual(payload.revisionLineage, revisionLineage),
    isIdempotencyKey(record.idempotencyKey),
    isDigest(record.finalPreviewDigest),
    isDigest(record.payloadFingerprint),
    record.finalPreviewDigest !== record.payloadFingerprint,
    record.requiredConfirmationCopy === `SEND ${record.finalPreviewDigest}`,
    isSafeRef(record.channelEndpointRef),
    record.destinationRef ===
      buildSafeRef(
        "mcp-safe-ref:application-message-destination",
        payload.destination.email,
      ),
    proposal.proposalRef === record.idempotencyKey,
    proposal.idempotencyKey === record.idempotencyKey,
    proposal.confirmation.requiredCopy === record.requiredConfirmationCopy,
  ]);
}

function isFinalPreviewPayloadRecord(
  record: Record<string, unknown>,
): record is FinalPreviewPayloadRecord {
  return allChecks([
    hasOnlyKeys(record, FINAL_PREVIEW_PAYLOAD_KEYS),
    record.version === CURRENT_VERSION,
    isArtifactKind(record.artifactKind),
    record.channelId === CONTROLLED_CHANNEL_ID,
    typeof record.subject === "string",
    typeof record.body === "string",
    typeof record.idempotencyKey === "string",
    typeof record.idempotencyKey === "string" &&
      isIdempotencyKey(record.idempotencyKey),
  ]);
}

function isManualConfirmationRecord(
  record: Record<string, unknown>,
): record is ManualConfirmationRecord {
  return allChecks([
    hasOnlyKeys(record, MANUAL_CONFIRMATION_KEYS),
    record.kind === "mcp_application_message_manual_confirmation",
    record.version === CURRENT_VERSION,
    isManualConfirmationActor(record.actor),
    isManualConfirmationState(record.state),
    typeof record.proposalRef === "string",
    typeof record.idempotencyKey === "string",
    typeof record.finalPreviewDigest === "string",
    typeof record.confirmationCopy === "string",
    typeof record.confirmedAt === "string",
    typeof record.confirmedAt === "string" && isIsoTimestamp(record.confirmedAt),
  ]);
}

function isProviderReceiptRecord(
  record: Record<string, unknown>,
): record is ProviderReceiptRecord {
  return allChecks([
    hasOnlyKeys(record, PROVIDER_RECEIPT_KEYS),
    record.kind === "mcp_application_message_provider_receipt",
    record.version === CURRENT_VERSION,
    isDeliveryStatus(record.status),
    typeof record.providerReceiptRef === "string",
    typeof record.networkRequestExecuted === "boolean",
    typeof record.externalSideEffect === "boolean",
    typeof record.retrySafe === "boolean",
    typeof record.providerReceiptRef === "string" &&
      isSafeProviderReceiptRef(record.providerReceiptRef),
  ]);
}

function providerReceiptStatusMatchesEffects(
  receipt: ProviderReceiptRecord,
): boolean {
  const expected = PROVIDER_RECEIPT_EXPECTED_EFFECTS[receipt.status];
  return (
    receipt.networkRequestExecuted === expected.networkRequestExecuted &&
    receipt.externalSideEffect === expected.externalSideEffect &&
    receipt.retrySafe === expected.retrySafe
  );
}

function isArtifactRefRecord(
  record: Record<string, unknown>,
): record is ArtifactRefRecord {
  return allChecks([
    typeof record.id === "string",
    typeof record.label === "string",
    typeof record.status === "string",
    isArtifactKind(record.category),
    typeof record.count === "number",
    typeof record.updatedAt === "string",
    record.version === CURRENT_VERSION,
    typeof record.id === "string" && isSafeRef(record.id),
    typeof record.updatedAt === "string" && isIsoTimestamp(record.updatedAt),
    typeof record.count === "number" && Number.isInteger(record.count),
    typeof record.count === "number" && record.count >= 1,
  ]);
}

function validateFinalPreview(
  preview: McpApplicationMessageFinalPreviewV1,
): Readonly<{ ok: boolean }> {
  const expectedPayloadFingerprint = buildPayloadFingerprint({
    artifactKind: preview.artifactKind,
    artifactRef: preview.artifactRef,
    body: preview.payload.body,
    channelId: preview.channelId,
    channelEndpointRef: preview.channelEndpointRef,
    destinationEmail: preview.payload.destination.email,
    revisionLineage: preview.revisionLineage,
    subject: preview.payload.subject,
  });
  const expectedDigest = buildFinalPreviewDigest({
    idempotencyKey: preview.idempotencyKey,
    payloadFingerprint: expectedPayloadFingerprint,
    requestedAt: preview.createdAt,
  });
  const proposal = parseApplicationMessageWriteProposal(
    preview.proposal,
    preview.requiredConfirmationCopy,
    preview.idempotencyKey,
  );
  return {
    ok:
      !!proposal &&
      expectedDigest === preview.finalPreviewDigest &&
      expectedPayloadFingerprint === preview.payloadFingerprint &&
      preview.requiredConfirmationCopy === `SEND ${expectedDigest}` &&
      preview.proposal.proposalRef === preview.idempotencyKey &&
      preview.proposal.idempotencyKey === preview.idempotencyKey &&
      preview.proposal.confirmation.requiredCopy ===
        preview.requiredConfirmationCopy,
  };
}

function validateManualConfirmation(
  preview: McpApplicationMessageFinalPreviewV1,
  confirmation: McpApplicationMessageManualConfirmationV1,
): "ok" | Extract<
  McpApplicationMessageSendReasonV1,
  | "confirmation_required"
  | "confirmation_rejected"
  | "confirmation_mismatch"
> {
  if (confirmation.actor !== "human_user") return "confirmation_required";
  if (confirmation.state === "rejected") return "confirmation_rejected";
  if (
    confirmation.proposalRef !== preview.proposal.proposalRef ||
    confirmation.idempotencyKey !== preview.idempotencyKey ||
    confirmation.finalPreviewDigest !== preview.finalPreviewDigest ||
    confirmation.confirmationCopy !== preview.requiredConfirmationCopy ||
    Date.parse(confirmation.confirmedAt) <= Date.parse(preview.createdAt)
  ) {
    return "confirmation_mismatch";
  }
  return "ok";
}

function channelMatchesPreview(
  channel: McpApplicationMessageControlledChannelV1,
  preview: McpApplicationMessageFinalPreviewV1,
): boolean {
  return (
    channel.channelId === preview.channelId &&
    buildSafeRef(
      "mcp-safe-ref:application-message-endpoint",
      channel.endpointUrl,
    ) === preview.channelEndpointRef &&
    channel.credentialMode === "none"
  );
}

function isDeliveryDispatchError(
  error: unknown,
): error is McpApplicationMessageDeliveryDispatchError {
  return (
    error instanceof McpApplicationMessageDeliveryDispatchError ||
    (error instanceof Error &&
      error.name === "McpApplicationMessageDeliveryDispatchError")
  );
}

function buildBlockedSendResult(
  reason: McpApplicationMessageSendReasonV1,
  preview?: McpApplicationMessageFinalPreviewV1,
): McpApplicationMessageSendResultV1 {
  const deliveryStatus: McpApplicationMessageDeliveryStatusV1 =
    reason === "idempotency_conflict"
      ? "idempotency_conflict"
      : reason === "provider_rejected"
        ? "rejected_by_provider"
        : "delivery_status_unknown";
  return {
    kind: "mcp_application_message_send_result",
    allowed: false,
    reason,
    deliveryStatus,
    retrySafe: false,
    auditEvent: buildAuditEvent({
      eventKind: "application_message_send_blocked",
      reason,
      deliveryStatus,
      preview,
      writeActionExecuted: false,
      networkRequestExecuted: false,
      externalSideEffect: false,
    }),
    writeActionExecuted: false,
    realExecutionAllowed: false,
    externalSideEffect: false,
    networkRequestExecuted: false,
    localPersistenceWrite: false,
    credentialStorage: "none",
    tokenStorage: "none",
    safeRecoveryInstruction: safeRecoveryInstructionFor(reason),
    version: 1,
  };
}

function buildExecutedSendResult(input: Readonly<{
  allowed: boolean;
  reason: McpApplicationMessageSendReasonV1;
  deliveryStatus: McpApplicationMessageDeliveryStatusV1;
  retrySafe: boolean;
  preview: McpApplicationMessageFinalPreviewV1;
  allowlistRuleId: string;
  providerReceiptRef?: string;
  networkRequestExecuted: boolean;
  externalSideEffect: boolean;
}>): McpApplicationMessageSendResultV1 {
  return {
    kind: "mcp_application_message_send_result",
    allowed: input.allowed,
    reason: input.reason,
    deliveryStatus: input.deliveryStatus,
    retrySafe: input.retrySafe,
    auditEvent: buildAuditEvent({
      eventKind: input.allowed
        ? "application_message_send_authorized"
        : "application_message_send_provider_result",
      reason: input.reason,
      deliveryStatus: input.deliveryStatus,
      preview: input.preview,
      allowlistRuleId: input.allowlistRuleId,
      providerReceiptRef: input.providerReceiptRef,
      writeActionExecuted: true,
      networkRequestExecuted: input.networkRequestExecuted,
      externalSideEffect: input.externalSideEffect,
    }),
    writeActionExecuted: true,
    realExecutionAllowed: true,
    externalSideEffect: input.externalSideEffect,
    networkRequestExecuted: input.networkRequestExecuted,
    localPersistenceWrite: false,
    credentialStorage: "none",
    tokenStorage: "none",
    safeRecoveryInstruction: safeRecoveryInstructionFor(input.reason),
    version: 1,
  };
}

function buildAuditEvent(input: Readonly<{
  eventKind: McpApplicationMessageSendAuditEventV1["eventKind"];
  reason: McpApplicationMessageSendReasonV1;
  deliveryStatus: McpApplicationMessageDeliveryStatusV1;
  preview?: McpApplicationMessageFinalPreviewV1;
  allowlistRuleId?: string;
  providerReceiptRef?: string;
  writeActionExecuted: boolean;
  networkRequestExecuted: boolean;
  externalSideEffect: boolean;
}>): McpApplicationMessageSendAuditEventV1 {
  return {
    kind: "mcp_application_message_send_audit_event",
    eventKind: input.eventKind,
    ...(input.preview
      ? {
          channelId: input.preview.channelId,
          channelEndpointRef: input.preview.channelEndpointRef,
          destinationRef: input.preview.destinationRef,
          finalPreviewDigest: input.preview.finalPreviewDigest,
          idempotencyRef: buildSafeRef(
            "mcp-safe-ref:application-message-idempotency",
            input.preview.idempotencyKey,
          ),
        }
      : {}),
    ...(input.allowlistRuleId ? { allowlistRuleId: input.allowlistRuleId } : {}),
    ...(input.providerReceiptRef
      ? { providerReceiptRef: input.providerReceiptRef }
      : {}),
    deliveryStatus: input.deliveryStatus,
    reason: input.reason,
    writeActionExecuted: input.writeActionExecuted,
    networkRequestExecuted: input.networkRequestExecuted,
    externalSideEffect: input.externalSideEffect,
    localPersistenceWrite: false,
    credentialStorage: "none",
    tokenStorage: "none",
    rawDataExposed: false,
    version: 1,
  };
}

function safeRecoveryInstructionFor(
  reason: McpApplicationMessageSendReasonV1,
): string {
  if (reason === "sent" || reason === "duplicate_accepted") {
    return "No retry is required for this idempotency key.";
  }
  if (reason === "delivery_status_unknown") {
    return "Do not repeat delivery automatically; verify status with the same idempotency key.";
  }
  if (reason === "idempotency_conflict") {
    return "Do not reuse this idempotency key for different send material.";
  }
  return "No external retry was performed.";
}

function parseArtifactRef(
  input: unknown,
): McpApplicationMessageSafeArtifactRefV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (!record || !isArtifactRefRecord(record)) return undefined;

  return {
    id: record.id,
    label: record.label,
    status: record.status,
    category: record.category,
    count: record.count,
    updatedAt: record.updatedAt,
    version: 1,
  };
}

function normalizeSingleEmail(value: string): string | undefined {
  const email = value.trim().toLowerCase();
  if (
    email.length < 6 ||
    email.length > 254 ||
    /[\s,;\r\n]/u.test(email) ||
    !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/iu.test(email)
  ) {
    return undefined;
  }
  return email;
}

function normalizeSubject(value: string): string | undefined {
  const subject = value.trim().replace(/\s+/gu, " ");
  if (
    subject.length === 0 ||
    subject.length > MAX_SUBJECT_LENGTH ||
    /[\r\n]/u.test(value)
  ) {
    return undefined;
  }
  return subject;
}

function normalizeBody(value: string): string | undefined {
  const body = value.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n").trim();
  if (
    body.length === 0 ||
    body.length > MAX_BODY_LENGTH ||
    FORBIDDEN_BODY_PATTERNS.some((pattern) => pattern.test(body))
  ) {
    return undefined;
  }
  return body;
}

function parseRevisionLineage(input: unknown): readonly string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  if (input.length === 0 || input.length > MAX_REVISION_LINEAGE_LENGTH) {
    return undefined;
  }
  const lineage: string[] = [];
  for (const entry of input) {
    if (typeof entry !== "string" || !isSafeRef(entry)) return undefined;
    lineage.push(entry);
  }
  return lineage;
}

function buildPayloadFingerprint(input: Readonly<{
  artifactKind: McpApplicationMessageArtifactKindV1;
  artifactRef: McpApplicationMessageSafeArtifactRefV1;
  body: string;
  channelId: "application_message_api";
  channelEndpointRef: string;
  destinationEmail: string;
  revisionLineage: readonly string[];
  subject: string;
}>): string {
  return buildSha256Digest({
    digestKind: "application_message_payload_fingerprint",
    artifactKind: input.artifactKind,
    artifactRef: input.artifactRef,
    body: input.body,
    channelEndpointRef: input.channelEndpointRef,
    channelId: input.channelId,
    destinationEmail: input.destinationEmail,
    revisionLineage: input.revisionLineage,
    subject: input.subject,
    version: 1,
  });
}

function buildFinalPreviewDigest(input: Readonly<{
  idempotencyKey: string;
  payloadFingerprint: string;
  requestedAt: string;
}>): string {
  return buildSha256Digest({
    digestKind: "application_message_final_preview",
    idempotencyKey: input.idempotencyKey,
    payloadFingerprint: input.payloadFingerprint,
    requestedAt: input.requestedAt,
    version: 1,
  });
}

function buildSha256Digest(value: unknown): string {
  return `sha256:${sha256Hex(canonicalJson(value))}`;
}

function buildSafeRef(prefix: string, value: string): string {
  return `${prefix}:${sha256Hex(value)}`;
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
  0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
  0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
  0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

type Sha256State = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const SHA256_INITIAL_STATE: Sha256State = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f,
  0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

// Keep hashing synchronous and runtime-neutral for this boundary.
function sha256Hex(value: string): string {
  const padded = padSha256Bytes(TEXT_ENCODER.encode(value));
  return sha256StateToHex(compressSha256Bytes(padded));
}

function padSha256Bytes(bytes: Uint8Array): Uint8Array {
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  return padded;
}

function compressSha256Bytes(padded: Uint8Array): Sha256State {
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  const words = new Uint32Array(64);
  let state = SHA256_INITIAL_STATE;

  for (let offset = 0; offset < padded.length; offset += 64) {
    loadSha256Words(view, offset, words);
    expandSha256Words(words);
    state = compressSha256Words(words, state);
  }
  return state;
}

function loadSha256Words(
  view: DataView,
  offset: number,
  words: Uint32Array,
): void {
  for (let index = 0; index < 16; index += 1) {
    words[index] = view.getUint32(offset + index * 4);
  }
}

function expandSha256Words(words: Uint32Array): void {
  for (let index = 16; index < 64; index += 1) {
    const previous15 = words[index - 15] ?? 0;
    const previous2 = words[index - 2] ?? 0;
    const s0 =
      rotateRight(previous15, 7) ^
      rotateRight(previous15, 18) ^
      (previous15 >>> 3);
    const s1 =
      rotateRight(previous2, 17) ^
      rotateRight(previous2, 19) ^
      (previous2 >>> 10);
    words[index] =
      ((words[index - 16] ?? 0) + s0 + (words[index - 7] ?? 0) + s1) >>>
      0;
  }
}

function compressSha256Words(
  words: Uint32Array,
  state: Sha256State,
): Sha256State {
  let [a, b, c, d, e, f, g, h] = state;
  for (let index = 0; index < 64; index += 1) {
    const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
    const ch = (e & f) ^ (~e & g);
    const temp1 =
      (h + s1 + ch + (SHA256_K[index] ?? 0) + (words[index] ?? 0)) >>> 0;
    const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (s0 + maj) >>> 0;
    h = g;
    g = f;
    f = e;
    e = (d + temp1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) >>> 0;
  }
  return [
    (state[0] + a) >>> 0,
    (state[1] + b) >>> 0,
    (state[2] + c) >>> 0,
    (state[3] + d) >>> 0,
    (state[4] + e) >>> 0,
    (state[5] + f) >>> 0,
    (state[6] + g) >>> 0,
    (state[7] + h) >>> 0,
  ];
}

function sha256StateToHex(state: Sha256State): string {
  return state
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}

function rotateRight(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function isArtifactKind(
  value: unknown,
): value is McpApplicationMessageArtifactKindV1 {
  return value === "cover_letter" || value === "application_package";
}

function isExpectedWriteActionDataClass(
  value: unknown,
): value is McpWriteActionDataClassV1 {
  return (
    typeof value === "string" &&
    WRITE_ACTION_DATA_CLASSES.includes(value as McpWriteActionDataClassV1)
  );
}

function isDeliveryStatus(
  value: unknown,
): value is McpApplicationMessageDeliveryStatusV1 {
  return (
    value === "sent" ||
    value === "duplicate_accepted" ||
    value === "idempotency_conflict" ||
    value === "rejected_by_provider" ||
    value === "delivery_status_unknown"
  );
}

function isManualConfirmationActor(
  value: unknown,
): value is McpApplicationMessageManualConfirmationV1["actor"] {
  return (
    value === "human_user" ||
    value === "assistant" ||
    value === "model" ||
    value === "system"
  );
}

function isManualConfirmationState(
  value: unknown,
): value is McpApplicationMessageManualConfirmationV1["state"] {
  return value === "confirmed" || value === "rejected";
}

function isIdempotencyKey(value: string): boolean {
  return /^mcp-write-action:[a-z0-9][a-z0-9._:-]{1,96}$/u.test(value);
}

function isDigest(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function isSafeRef(value: string): boolean {
  return /^mcp-safe-ref:[a-z0-9][a-z0-9._:-]{1,160}$/u.test(value);
}

function isTrustedChannelEndpointUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const usesDefaultHttpsPort = parsed.port === "" || parsed.port === "443";
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      usesDefaultHttpsPort &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function isSafeProviderReceiptRef(value: string): boolean {
  return (
    value.length <= MAX_SAFE_REF_LENGTH &&
    /^mcp-provider-receipt:[a-z0-9][a-z0-9._:-]{1,96}$/u.test(value)
  );
}

function isIsoTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isEgressPolicy(value: unknown): value is McpOutboundEgressPolicyV1 {
  const record = readPlainObjectRecord(value);
  return (
    !!record &&
    record.kind === "mcp_outbound_egress_policy" &&
    record.defaultAllowed === false &&
    Array.isArray(record.allowlist) &&
    record.version === CURRENT_VERSION
  );
}

function sameArtifactRef(
  left: McpApplicationMessageSafeArtifactRefV1,
  right: McpApplicationMessageSafeArtifactRefV1,
): boolean {
  return (
    left.id === right.id &&
    left.updatedAt === right.updatedAt &&
    left.category === right.category &&
    left.version === right.version
  );
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readPlainObjectRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  return value as Record<string, unknown>;
}

function hasOnlyKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function allChecks(checks: readonly boolean[]): boolean {
  return checks.every(Boolean);
}
