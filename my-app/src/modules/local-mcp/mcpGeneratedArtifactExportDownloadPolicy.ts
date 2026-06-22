import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";

export type McpGeneratedArtifactExportDownloadPolicyArtifactKindV1 =
  | "resume_variant"
  | "cover_letter"
  | "application_package";

export type McpGeneratedArtifactExportDownloadPolicyStatusV1 =
  | "export_download_policy_allowed"
  | "export_download_policy_blocked"
  | "confirmation_required"
  | "stale_artifact_blocked"
  | "retention_policy_blocked";

export type McpGeneratedArtifactExportDownloadPolicyActionLabelV1 =
  "ready_for_review";

export type McpGeneratedArtifactExportDownloadPolicyRefV1 = Readonly<{
  id: string;
  label: string;
  status: "approved_for_preview";
  category: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1;
  count: number;
  updatedAt: string;
  version: 1;
}>;

export type McpGeneratedArtifactExportDownloadPolicyAuditEventV1 = Readonly<{
  kind: "mcp_generated_artifact_export_download_policy_audit_event";
  eventKind: "export_download_policy_authorized";
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1;
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1;
  policyStatus: Extract<
    McpGeneratedArtifactExportDownloadPolicyStatusV1,
    "export_download_policy_allowed"
  >;
  safeCounts: McpGeneratedArtifactExportDownloadPolicyCountsV1;
  redactedFlags: Readonly<{
    rawDataExposed: false;
    fullContentRestricted: true;
    tokenOrIdentityExposed: false;
    persisted: false;
    version: 1;
  }>;
  occurredAt: string;
  persisted: false;
  version: 1;
}>;

export type McpGeneratedArtifactExportDownloadPolicySummaryV1 = Readonly<{
  kind: "mcp_generated_artifact_export_download_policy_summary";
  allowed: true;
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1;
  artifactStatus: "approved_for_preview";
  policyStatus: Extract<
    McpGeneratedArtifactExportDownloadPolicyStatusV1,
    "export_download_policy_allowed"
  >;
  confirmationStatus: "confirmation_confirmed";
  freshnessStatus: "fresh_artifact_confirmed";
  retentionPolicyStatus: "retention_policy_satisfied";
  deletePolicyStatus: "delete_policy_satisfied";
  rollbackStatus: "rollback_available";
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1;
  visibilityCategory: "safe_summary_only";
  suggestedFilename: string;
  safeSummary: string;
  nextUserAction: McpGeneratedArtifactExportDownloadPolicyActionLabelV1;
  refIds: readonly string[];
  safeCounts: McpGeneratedArtifactExportDownloadPolicyCountsV1;
  safeCategories: McpGeneratedArtifactExportDownloadPolicyCategoriesV1;
  safeFlags: Readonly<{
    humanReviewRequired: false;
    approvedForPreview: true;
    approvedForExport: true;
    approvedForDownload: true;
    approvedForSend: false;
    approvedForSubmit: false;
    approvedForApply: false;
    eligibleForLaterExport: true;
    eligibleForLaterDownload: true;
    fullContentRestricted: true;
    rawDataExposed: false;
    persisted: false;
    bytesCreated: false;
    filePayloadCreated: false;
    urlCreated: false;
    writeActionExecuted: false;
    version: 1;
  }>;
  auditEvent: McpGeneratedArtifactExportDownloadPolicyAuditEventV1;
  capabilities: McpGeneratedArtifactExportDownloadPolicySummaryCapabilitiesV1;
  modelVisible: true;
  componentVisible: true;
  version: 1;
}>;

export type McpGeneratedArtifactExportDownloadPolicySurfacePayloadsV1 =
  Readonly<{
    structuredContent: McpGeneratedArtifactExportDownloadPolicySummaryV1;
    content: readonly Readonly<{ type: "text"; text: string }>[];
    meta: Record<string, unknown>;
    props: Record<string, unknown>;
    bridgePayload: Record<string, unknown>;
    stateSnapshot: Record<string, unknown>;
    modelContextUpdate: Record<string, unknown>;
    actionLabel: McpGeneratedArtifactExportDownloadPolicyActionLabelV1;
  }>;

export type McpGeneratedArtifactExportDownloadPolicyCapabilitiesV1 = Readonly<{
  componentData: "policy_checked" | "blocked";
  componentRendering: "view_model_only" | "blocked";
  componentRuntime: "blocked";
  uiBridgeRuntime: "blocked";
  toolCalls: "blocked";
  modelContextRuntime: "blocked";
  dataReads: "blocked";
  dataWrites: "blocked";
  writeActions: "blocked";
  exportActions: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  rawDataProjection: "blocked";
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

export type McpGeneratedArtifactExportDownloadPolicySummaryCapabilitiesV1 =
  Readonly<{
    dataReads: "blocked";
    dataWrites: "blocked";
    handlerExecution: "blocked";
    productionConnector: "blocked";
    networkAccess: "blocked";
    modelCalls: "blocked";
    writeActions: "blocked";
    exportActions: "blocked";
    rawDataProjection: "blocked";
    credentialStorage: "none";
    tokenStorage: "none";
    version: 1;
  }>;

export type McpGeneratedArtifactExportDownloadPolicySafeRefusalV1 = Readonly<{
  kind: "local_mcp_component_data_policy_safe_error";
  code: "generated_artifact_export_download_policy_blocked";
  msg: "Refused. Generated artifact export/download policy blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpGeneratedArtifactExportDownloadPolicyResultV1 = Readonly<
  | {
      kind: "mcp_generated_artifact_export_download_policy_result";
      allowed: true;
      reason: "export_download_policy_authorized";
      summary: McpGeneratedArtifactExportDownloadPolicySummaryV1;
      component: McpGeneratedArtifactExportDownloadPolicySurfacePayloadsV1;
      policy: McpGeneratedArtifactExportDownloadPolicyPolicyStatusV1;
      capabilities: McpGeneratedArtifactExportDownloadPolicyCapabilitiesV1;
      modelVisible: true;
      componentVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_generated_artifact_export_download_policy_result";
      allowed: false;
      reason:
        | "invalid_input"
        | "confirmation_required"
        | "stale_artifact_blocked"
        | "retention_policy_blocked"
        | "policy_blocked";
      safeRefusal: McpGeneratedArtifactExportDownloadPolicySafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpGeneratedArtifactExportDownloadPolicyCapabilitiesV1;
      modelVisible: true;
      componentVisible: false;
      version: 1;
    }
>;

type McpGeneratedArtifactExportDownloadPolicySurfaceV1 = Extract<
  LocalMcpComponentDataSurfaceV1,
  | "model_visible_structured_content"
  | "model_visible_content"
  | "component_visible_structured_content"
  | "component_visible_content"
  | "component_visible_meta"
  | "component_visible_props"
  | "component_visible_bridge_payload"
  | "component_visible_state_snapshot"
  | "component_visible_model_context_update"
  | "component_visible_action_label"
>;

type McpGeneratedArtifactExportDownloadPolicyPolicyStatusV1 = Readonly<
  Record<McpGeneratedArtifactExportDownloadPolicySurfaceV1, "allowed">
>;

type McpGeneratedArtifactExportDownloadPolicyCountsV1 = Readonly<{
  artifacts: number;
  blockers: number;
  warnings: number;
  revisionCount: number;
  version: 1;
}>;

type McpGeneratedArtifactExportDownloadPolicyCategoriesV1 = Readonly<{
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1;
  artifactStatus: "approved_for_preview";
  policyStatus: "export_download_policy_allowed";
  confirmationStatus: "confirmation_confirmed";
  freshnessStatus: "fresh_artifact_confirmed";
  retentionPolicyStatus: "retention_policy_satisfied";
  deletePolicyStatus: "delete_policy_satisfied";
  rollbackStatus: "rollback_available";
  visibilityCategory: "safe_summary_only";
  nextUserAction: McpGeneratedArtifactExportDownloadPolicyActionLabelV1;
  version: 1;
}>;

type ParsedApprovalState = Readonly<{
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1;
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1;
  warnings: number;
}>;

type ParsedExportDownloadRequest = Readonly<{
  requestedAt: string;
}>;

type ParsedFreshnessState = Readonly<{
  revisionLineage: readonly string[];
}>;

type ParsedInput = Readonly<{
  approvalState: ParsedApprovalState;
  exportDownloadRequest: ParsedExportDownloadRequest;
  freshnessState: ParsedFreshnessState;
}>;

type ParseFailure = Extract<
  McpGeneratedArtifactExportDownloadPolicyResultV1,
  { allowed: false }
>["reason"];

type ParseResult =
  | Readonly<{ ok: true; input: ParsedInput }>
  | Readonly<{ ok: false; reason: ParseFailure }>;

type SurfacePayload = Readonly<{
  surface: McpGeneratedArtifactExportDownloadPolicySurfaceV1;
  payload: unknown;
}>;

const INPUT_KEYS = [
  "kind",
  "approvalState",
  "exportDownloadRequest",
  "freshnessState",
  "retentionDeleteRollbackState",
  "version",
] as const;

const APPROVAL_STATE_KEYS = [
  "kind",
  "allowed",
  "artifactKind",
  "artifactStatus",
  "workflowStatus",
  "decision",
  "decisionStatus",
  "artifactRef",
  "visibilityCategory",
  "safeSummary",
  "nextUserAction",
  "refIds",
  "safeCounts",
  "safeCategories",
  "safeFlags",
  "diffReview",
  "auditEvent",
  "capabilities",
  "modelVisible",
  "componentVisible",
  "version",
] as const;

const ARTIFACT_REF_KEYS = [
  "id",
  "label",
  "status",
  "category",
  "count",
  "updatedAt",
  "version",
] as const;

const REQUEST_KEYS = [
  "kind",
  "mode",
  "actor",
  "confirmation",
  "requestedAt",
  "version",
] as const;

const FRESHNESS_STATE_KEYS = [
  "kind",
  "artifactRef",
  "approvedArtifactUpdatedAt",
  "currentArtifactUpdatedAt",
  "revisionLineage",
  "version",
] as const;

const RETENTION_DELETE_ROLLBACK_KEYS = [
  "kind",
  "retentionPolicyStatus",
  "deletePolicyStatus",
  "rollbackStatus",
  "version",
] as const;

const SAFE_COUNTS_KEYS = [
  "artifacts",
  "blockers",
  "warnings",
  "changedSections",
  "redactedChangedSections",
  "version",
] as const;

const SAFE_CATEGORIES_KEYS = [
  "artifactKind",
  "workflowStatus",
  "decisionStatus",
  "visibilityCategory",
  "nextUserAction",
  "version",
] as const;

const SAFE_FLAGS_KEYS = [
  "humanReviewRequired",
  "approvedForPreview",
  "approvedForExport",
  "approvedForDownload",
  "approvedForSend",
  "approvedForSubmit",
  "approvedForApply",
  "fullContentRestricted",
  "rawDataExposed",
  "version",
] as const;

const DIFF_REVIEW_KEYS = [
  "kind",
  "artifactKind",
  "artifactRef",
  "decisionStatus",
  "safeCounts",
  "safeCategories",
  "nextUserAction",
  "version",
] as const;

const AUDIT_EVENT_KEYS = [
  "kind",
  "eventKind",
  "artifactKind",
  "artifactRef",
  "decision",
  "safeCounts",
  "redactedFlags",
  "occurredAt",
  "persisted",
  "version",
] as const;

const REDACTED_FLAGS_KEYS = [
  "rawDataExposed",
  "fullContentRestricted",
  "tokenOrIdentityExposed",
  "persisted",
  "version",
] as const;

const CAPABILITIES_KEYS = [
  "dataReads",
  "dataWrites",
  "handlerExecution",
  "productionConnector",
  "networkAccess",
  "modelCalls",
  "writeActions",
  "exportActions",
  "rawDataProjection",
  "credentialStorage",
  "tokenStorage",
  "version",
] as const;

const ARTIFACT_REF_PREFIX_BY_KIND: Record<
  McpGeneratedArtifactExportDownloadPolicyArtifactKindV1,
  string
> = {
  resume_variant: "mcp-safe-ref:resume-variant:",
  cover_letter: "mcp-safe-ref:cover-letter:",
  application_package: "mcp-safe-ref:application-package:",
};

const ARTIFACT_LABEL_BY_KIND: Record<
  McpGeneratedArtifactExportDownloadPolicyArtifactKindV1,
  string
> = {
  resume_variant: "Resume variant artifact",
  cover_letter: "Cover letter artifact",
  application_package: "Application pkg artifact",
};

const SUGGESTED_FILENAME_BY_KIND: Record<
  McpGeneratedArtifactExportDownloadPolicyArtifactKindV1,
  string
> = {
  resume_variant: "resume-variant-export-policy",
  cover_letter: "cover-letter-export-policy",
  application_package: "application-package-export-policy",
};

const MAX_SAFE_COUNT = 1000;
const MAX_REVISION_COUNT = 25;

const UNSAFE_TEXT_PATTERNS: readonly RegExp[] = [
  /RAW_(?:(?:CV|RESUME|JOB|PROPOSAL|APPLICATION|COVER_LETTER)(?:_TEXT)?|SOURCE_DOCUMENT)_SENTINEL_DO_NOT_EXPOSE/u,
  /SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE/u,
  /PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE/u,
  /NEVER_USE_SENTINEL_DO_NOT_EXPOSE/u,
  /GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE/u,
  /SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE/u,
  /SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE/u,
  /\bBearer\s+[A-Za-z0-9._-]+/u,
  /\b(?:accessToken|refreshToken|rawClaims)\b/u,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /\b(?:raw|src[_ -]?quote|private[_ -]?fact|never[_ -]?use|debug|token|session|clerk|stytch|provider|subject|documentid|convex)\b/iu,
  /\bj97convexdocumentid\b/iu,
  /\b(?:https?:\/\/|data:|blob:|mime|base64)\b/iu,
];

export function buildMcpGeneratedArtifactExportDownloadPolicy(
  input: unknown,
): McpGeneratedArtifactExportDownloadPolicyResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput.ok) return deny(parsedInput.reason);

  const summary = buildSummary(parsedInput.input);
  const component = buildComponentPayloads(summary);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_generated_artifact_export_download_policy_result",
    allowed: true,
    reason: "export_download_policy_authorized",
    summary,
    component,
    policy: policy.surfaceStatus,
    capabilities: buildCapabilities("policy_checked", "view_model_only"),
    modelVisible: true,
    componentVisible: true,
    version: 1,
  };
}

export function buildMcpGeneratedArtifactExportDownloadPolicySafeRefusal(): McpGeneratedArtifactExportDownloadPolicySafeRefusalV1 {
  return {
    kind: "local_mcp_component_data_policy_safe_error",
    code: "generated_artifact_export_download_policy_blocked",
    msg: "Refused. Generated artifact export/download policy blocked.",
    safeForModel: true,
    rawDataExposed: false,
    componentDataExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseInput(input: unknown): ParseResult {
  const record = readExactRecord(input, INPUT_KEYS, INPUT_KEYS);
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_export_download_policy_input" ||
    record.version !== 1
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const approvalState = parseApprovalState(record.approvalState);
  if (!approvalState) return { ok: false, reason: "invalid_input" };

  const exportDownloadRequest = parseExportDownloadRequest(
    record.exportDownloadRequest,
  );
  if (!exportDownloadRequest) {
    return { ok: false, reason: "confirmation_required" };
  }

  const freshnessState = parseFreshnessState(
    record.freshnessState,
    approvalState,
  );
  if (!freshnessState.ok) return { ok: false, reason: freshnessState.reason };

  if (
    !parseRetentionDeleteRollbackState(record.retentionDeleteRollbackState)
  ) {
    return { ok: false, reason: "retention_policy_blocked" };
  }

  if (
    Date.parse(exportDownloadRequest.requestedAt) <
    Date.parse(approvalState.artifactRef.updatedAt)
  ) {
    return { ok: false, reason: "stale_artifact_blocked" };
  }

  return {
    ok: true,
    input: {
      approvalState,
      exportDownloadRequest,
      freshnessState: freshnessState.value,
    },
  };
}

function parseApprovalState(value: unknown): ParsedApprovalState | undefined {
  const record = readExactRecord(
    value,
    APPROVAL_STATE_KEYS,
    APPROVAL_STATE_KEYS,
  );
  if (!record || !isApprovedPreviewApprovalRecord(record)) {
    return undefined;
  }

  const artifactKind = readArtifactKind(record.artifactKind);
  if (!artifactKind) return undefined;

  const artifactRef = parseArtifactRef(record.artifactRef, artifactKind);
  const safeCounts = parseApprovalSafeCounts(record.safeCounts);
  if (!artifactRef || !safeCounts) return undefined;

  if (
    !allTrue([
      parseApprovalSafeCategories(record.safeCategories, artifactKind),
      parseApprovalSafeFlags(record.safeFlags),
      parseApprovalDiffReview(record.diffReview, artifactKind, artifactRef),
      parseApprovalAuditEvent(
        record.auditEvent,
        artifactKind,
        artifactRef,
        safeCounts,
      ),
      parseSummaryCapabilities(record.capabilities),
      hasExactRefIds(record.refIds, [artifactRef.id]),
    ])
  ) {
    return undefined;
  }

  return {
    artifactKind,
    artifactRef,
    warnings: safeCounts.warnings,
  };
}

function isApprovedPreviewApprovalRecord(
  record: Record<string, unknown>,
): boolean {
  return allTrue([
    record.kind === "mcp_generated_artifact_human_approval_workflow_summary",
    record.allowed === true,
    record.artifactStatus === "approved_for_preview",
    record.workflowStatus === "approved_for_preview",
    record.decision === "approve_preview",
    record.decisionStatus === "approved_for_preview",
    record.visibilityCategory === "safe_summary_only",
    record.nextUserAction === "ready_for_review",
    record.modelVisible === true,
    record.componentVisible === true,
    record.version === 1,
    isSafeText(record.safeSummary),
  ]);
}

function parseExportDownloadRequest(
  value: unknown,
): ParsedExportDownloadRequest | undefined {
  const record = readExactRecord(value, REQUEST_KEYS, REQUEST_KEYS);
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_export_download_policy_request" ||
    record.mode !== "policy_metadata_only" ||
    record.actor !== "human" ||
    record.confirmation !== "confirm_export_download_policy" ||
    record.version !== 1
  ) {
    return undefined;
  }

  const requestedAt = readIsoTimestamp(record.requestedAt);
  if (!requestedAt) return undefined;

  return { requestedAt };
}

function parseFreshnessState(
  value: unknown,
  approvalState: ParsedApprovalState,
):
  | Readonly<{ ok: true; value: ParsedFreshnessState }>
  | Readonly<{ ok: false; reason: "invalid_input" | "stale_artifact_blocked" }> {
  const record = readExactRecord(
    value,
    FRESHNESS_STATE_KEYS,
    FRESHNESS_STATE_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_export_download_freshness_state" ||
    record.version !== 1
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const artifactRef = parseArtifactRef(
    record.artifactRef,
    approvalState.artifactKind,
  );
  const approvedArtifactUpdatedAt = readIsoTimestamp(
    record.approvedArtifactUpdatedAt,
  );
  const currentArtifactUpdatedAt = readIsoTimestamp(
    record.currentArtifactUpdatedAt,
  );
  const revisionLineage = parseRevisionLineage(
    record.revisionLineage,
    approvalState.artifactKind,
  );

  if (
    !artifactRef ||
    !approvedArtifactUpdatedAt ||
    !currentArtifactUpdatedAt ||
    !revisionLineage
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  if (
    !allTrue([
      isSameArtifactRef(artifactRef, approvalState.artifactRef),
      approvedArtifactUpdatedAt === approvalState.artifactRef.updatedAt,
      currentArtifactUpdatedAt === approvalState.artifactRef.updatedAt,
      revisionLineage.length === 1,
      revisionLineage[0] === approvalState.artifactRef.id,
    ])
  ) {
    return { ok: false, reason: "stale_artifact_blocked" };
  }

  return { ok: true, value: { revisionLineage } };
}

function parseRetentionDeleteRollbackState(value: unknown): boolean {
  const record = readExactRecord(
    value,
    RETENTION_DELETE_ROLLBACK_KEYS,
    RETENTION_DELETE_ROLLBACK_KEYS,
  );
  return Boolean(
    record &&
      record.kind ===
        "mcp_generated_artifact_export_download_retention_delete_rollback_state" &&
      record.retentionPolicyStatus === "retention_policy_satisfied" &&
      record.deletePolicyStatus === "delete_policy_satisfied" &&
      record.rollbackStatus === "rollback_available" &&
      record.version === 1,
  );
}

function parseArtifactRef(
  value: unknown,
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1,
): McpGeneratedArtifactExportDownloadPolicyRefV1 | undefined {
  const record = readExactRecord(value, ARTIFACT_REF_KEYS, ARTIFACT_REF_KEYS);
  const updatedAt = record ? readIsoTimestamp(record.updatedAt) : undefined;
  if (
    !record ||
    !isSafeArtifactRefId(record.id, artifactKind) ||
    record.label !== ARTIFACT_LABEL_BY_KIND[artifactKind] ||
    record.status !== "approved_for_preview" ||
    record.category !== artifactKind ||
    !isSafeCount(record.count) ||
    !updatedAt ||
    record.version !== 1
  ) {
    return undefined;
  }

  return {
    id: record.id,
    label: record.label,
    status: "approved_for_preview",
    category: artifactKind,
    count: record.count,
    updatedAt,
    version: 1,
  };
}

function parseApprovalSafeCounts(
  value: unknown,
):
  | Readonly<{
      artifacts: number;
      blockers: number;
      warnings: number;
      changedSections: number;
      redactedChangedSections: number;
      version: 1;
    }>
  | undefined {
  const record = readExactRecord(value, SAFE_COUNTS_KEYS, SAFE_COUNTS_KEYS);
  if (
    !record ||
    !isSafeCount(record.artifacts) ||
    !isSafeCount(record.blockers) ||
    !isSafeCount(record.warnings) ||
    !isSafeCount(record.changedSections) ||
    !isSafeCount(record.redactedChangedSections) ||
    record.changedSections !== record.redactedChangedSections ||
    record.version !== 1
  ) {
    return undefined;
  }

  return {
    artifacts: record.artifacts,
    blockers: record.blockers,
    warnings: record.warnings,
    changedSections: record.changedSections,
    redactedChangedSections: record.redactedChangedSections,
    version: 1,
  };
}

function parseApprovalSafeCategories(
  value: unknown,
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1,
): boolean {
  const record = readExactRecord(
    value,
    SAFE_CATEGORIES_KEYS,
    SAFE_CATEGORIES_KEYS,
  );
  return Boolean(
    record &&
      record.artifactKind === artifactKind &&
      record.workflowStatus === "approved_for_preview" &&
      record.decisionStatus === "approved_for_preview" &&
      record.visibilityCategory === "safe_summary_only" &&
      record.nextUserAction === "ready_for_review" &&
      record.version === 1,
  );
}

function parseApprovalSafeFlags(value: unknown): boolean {
  const record = readExactRecord(value, SAFE_FLAGS_KEYS, SAFE_FLAGS_KEYS);
  if (!record) return false;
  return allTrue([
    record.humanReviewRequired === false,
    record.approvedForPreview === true,
    record.approvedForExport === false,
    record.approvedForDownload === false,
    record.approvedForSend === false,
    record.approvedForSubmit === false,
    record.approvedForApply === false,
    record.fullContentRestricted === true,
    record.rawDataExposed === false,
    record.version === 1,
  ]);
}

function parseApprovalDiffReview(
  value: unknown,
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1,
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1,
): boolean {
  const record = readExactRecord(value, DIFF_REVIEW_KEYS, DIFF_REVIEW_KEYS);
  return Boolean(
    record &&
      record.kind === "mcp_generated_artifact_human_approval_diff_review" &&
      record.artifactKind === artifactKind &&
      isSameArtifactRef(record.artifactRef, artifactRef) &&
      record.decisionStatus === "approved_for_preview" &&
      record.nextUserAction === "ready_for_review" &&
      record.version === 1,
  );
}

function parseApprovalAuditEvent(
  value: unknown,
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1,
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1,
  safeCounts: NonNullable<ReturnType<typeof parseApprovalSafeCounts>>,
): boolean {
  const record = readExactRecord(value, AUDIT_EVENT_KEYS, AUDIT_EVENT_KEYS);
  if (!record) return false;
  return allTrue([
    record.kind === "mcp_generated_artifact_human_approval_audit_event",
    record.eventKind === "human_approval_decision_recorded",
    record.artifactKind === artifactKind,
    record.decision === "approve_preview",
    isSameArtifactRef(record.artifactRef, artifactRef),
    parseRedactedFlags(record.redactedFlags),
    Boolean(readIsoTimestamp(record.occurredAt)),
    record.persisted === false,
    record.version === 1,
    isSameApprovalSafeCounts(record.safeCounts, safeCounts),
  ]);
}

function parseRedactedFlags(value: unknown): boolean {
  const record = readExactRecord(
    value,
    REDACTED_FLAGS_KEYS,
    REDACTED_FLAGS_KEYS,
  );
  return Boolean(
    record &&
      record.rawDataExposed === false &&
      record.fullContentRestricted === true &&
      record.tokenOrIdentityExposed === false &&
      record.persisted === false &&
      record.version === 1,
  );
}

function parseSummaryCapabilities(value: unknown): boolean {
  const record = readExactRecord(value, CAPABILITIES_KEYS, CAPABILITIES_KEYS);
  if (!record) return false;
  return allTrue([
    record.dataReads === "blocked",
    record.dataWrites === "blocked",
    record.handlerExecution === "blocked",
    record.productionConnector === "blocked",
    record.networkAccess === "blocked",
    record.modelCalls === "blocked",
    record.writeActions === "blocked",
    record.exportActions === "blocked",
    record.rawDataProjection === "blocked",
    record.credentialStorage === "none",
    record.tokenStorage === "none",
    record.version === 1,
  ]);
}

function parseRevisionLineage(
  value: unknown,
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1,
): readonly string[] | undefined {
  if (
    !isArrayValue(value) ||
    value.length === 0 ||
    value.length > MAX_REVISION_COUNT + 1
  ) {
    return undefined;
  }
  if (
    !value.every((item): item is string =>
      isSafeArtifactRefId(item, artifactKind),
    )
  ) {
    return undefined;
  }
  return [...value];
}

function buildSummary(
  input: ParsedInput,
): McpGeneratedArtifactExportDownloadPolicySummaryV1 {
  const safeCounts = buildSafeCounts(input);
  const safeCategories = buildSafeCategories(input);
  const auditEvent = buildAuditEvent(input, safeCounts);

  return {
    kind: "mcp_generated_artifact_export_download_policy_summary",
    allowed: true,
    artifactKind: input.approvalState.artifactKind,
    artifactStatus: "approved_for_preview",
    policyStatus: "export_download_policy_allowed",
    confirmationStatus: "confirmation_confirmed",
    freshnessStatus: "fresh_artifact_confirmed",
    retentionPolicyStatus: "retention_policy_satisfied",
    deletePolicyStatus: "delete_policy_satisfied",
    rollbackStatus: "rollback_available",
    artifactRef: input.approvalState.artifactRef,
    visibilityCategory: "safe_summary_only",
    suggestedFilename:
      SUGGESTED_FILENAME_BY_KIND[input.approvalState.artifactKind],
    safeSummary:
      "Export/download policy eligibility confirmed. No product action executed.",
    nextUserAction: "ready_for_review",
    refIds: [input.approvalState.artifactRef.id],
    safeCounts,
    safeCategories,
    safeFlags: {
      humanReviewRequired: false,
      approvedForPreview: true,
      approvedForExport: true,
      approvedForDownload: true,
      approvedForSend: false,
      approvedForSubmit: false,
      approvedForApply: false,
      eligibleForLaterExport: true,
      eligibleForLaterDownload: true,
      fullContentRestricted: true,
      rawDataExposed: false,
      persisted: false,
      bytesCreated: false,
      filePayloadCreated: false,
      urlCreated: false,
      writeActionExecuted: false,
      version: 1,
    },
    auditEvent,
    capabilities: buildSummaryCapabilities(),
    modelVisible: true,
    componentVisible: true,
    version: 1,
  };
}

function buildSafeCounts(
  input: ParsedInput,
): McpGeneratedArtifactExportDownloadPolicyCountsV1 {
  return {
    artifacts: 1,
    blockers: 0,
    warnings: input.approvalState.warnings,
    revisionCount: input.freshnessState.revisionLineage.length - 1,
    version: 1,
  };
}

function buildSafeCategories(
  input: ParsedInput,
): McpGeneratedArtifactExportDownloadPolicyCategoriesV1 {
  return {
    artifactKind: input.approvalState.artifactKind,
    artifactStatus: "approved_for_preview",
    policyStatus: "export_download_policy_allowed",
    confirmationStatus: "confirmation_confirmed",
    freshnessStatus: "fresh_artifact_confirmed",
    retentionPolicyStatus: "retention_policy_satisfied",
    deletePolicyStatus: "delete_policy_satisfied",
    rollbackStatus: "rollback_available",
    visibilityCategory: "safe_summary_only",
    nextUserAction: "ready_for_review",
    version: 1,
  };
}

function buildAuditEvent(
  input: ParsedInput,
  safeCounts: McpGeneratedArtifactExportDownloadPolicyCountsV1,
): McpGeneratedArtifactExportDownloadPolicyAuditEventV1 {
  return {
    kind: "mcp_generated_artifact_export_download_policy_audit_event",
    eventKind: "export_download_policy_authorized",
    artifactKind: input.approvalState.artifactKind,
    artifactRef: input.approvalState.artifactRef,
    policyStatus: "export_download_policy_allowed",
    safeCounts,
    redactedFlags: {
      rawDataExposed: false,
      fullContentRestricted: true,
      tokenOrIdentityExposed: false,
      persisted: false,
      version: 1,
    },
    occurredAt: input.exportDownloadRequest.requestedAt,
    persisted: false,
    version: 1,
  };
}

function buildComponentPayloads(
  summary: McpGeneratedArtifactExportDownloadPolicySummaryV1,
): McpGeneratedArtifactExportDownloadPolicySurfacePayloadsV1 {
  const shared = {
    artifactKind: summary.artifactKind,
    artifactStatus: summary.artifactStatus,
    policyStatus: summary.policyStatus,
    confirmationStatus: summary.confirmationStatus,
    freshnessStatus: summary.freshnessStatus,
    retentionPolicyStatus: summary.retentionPolicyStatus,
    deletePolicyStatus: summary.deletePolicyStatus,
    rollbackStatus: summary.rollbackStatus,
    artifactRef: summary.artifactRef,
    visibilityCategory: summary.visibilityCategory,
    suggestedFilename: summary.suggestedFilename,
    nextUserAction: summary.nextUserAction,
    refIds: summary.refIds,
    safeCounts: summary.safeCounts,
    safeCategories: summary.safeCategories,
    safeFlags: summary.safeFlags,
    auditEvent: summary.auditEvent,
    capabilities: summary.capabilities,
    modelVisible: true,
    componentVisible: true,
    version: 1,
  } as const;

  return {
    structuredContent: summary,
    content: [
      { type: "text", text: "Export/download policy summary is safe." },
      { type: "text", text: "No product action executed." },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...shared,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: "Export policy",
      safeSummary: summary.safeSummary,
      ...shared,
    },
    bridgePayload: {
      kind: "local_mcp_component_data_policy_safe_bridge_payload",
      ...shared,
    },
    stateSnapshot: {
      kind: "local_mcp_component_data_policy_safe_state_snapshot",
      safeSummary: summary.safeSummary,
      safeRefs: summary.refIds,
      ...shared,
    },
    modelContextUpdate: {
      kind: "local_mcp_component_data_policy_safe_model_context_update",
      safeSummary: summary.safeSummary,
      ...shared,
    },
    actionLabel: summary.nextUserAction,
  };
}

function validateComponentPayloads(
  component: McpGeneratedArtifactExportDownloadPolicySurfacePayloadsV1,
):
  | Readonly<{
      ok: true;
      surfaceStatus: McpGeneratedArtifactExportDownloadPolicyPolicyStatusV1;
    }>
  | Readonly<{ ok: false; result: LocalMcpComponentDataPolicyResultV1 }> {
  const surfacePayloads: readonly SurfacePayload[] = [
    {
      surface: "model_visible_structured_content",
      payload: component.structuredContent,
    },
    { surface: "model_visible_content", payload: component.content },
    {
      surface: "component_visible_structured_content",
      payload: component.structuredContent,
    },
    { surface: "component_visible_content", payload: component.content },
    { surface: "component_visible_meta", payload: component.meta },
    { surface: "component_visible_props", payload: component.props },
    {
      surface: "component_visible_bridge_payload",
      payload: component.bridgePayload,
    },
    {
      surface: "component_visible_state_snapshot",
      payload: component.stateSnapshot,
    },
    {
      surface: "component_visible_model_context_update",
      payload: component.modelContextUpdate,
    },
    {
      surface: "component_visible_action_label",
      payload: component.actionLabel,
    },
  ];

  const surfaceStatus = {} as Record<
    McpGeneratedArtifactExportDownloadPolicySurfaceV1,
    "allowed"
  >;
  for (const item of surfacePayloads) {
    const result = validateSurface(item.surface, item.payload);
    if (!result.allowed) return { ok: false, result };
    surfaceStatus[item.surface] = "allowed";
  }

  return { ok: true, surfaceStatus };
}

function validateSurface(
  surface: LocalMcpComponentDataSurfaceV1,
  payload: unknown,
): LocalMcpComponentDataPolicyResultV1 {
  return validateLocalMcpComponentDataPolicy({
    kind: "local_mcp_component_data_policy_input",
    surface,
    payload,
    version: 1,
  });
}

function deny(
  reason: Extract<
    McpGeneratedArtifactExportDownloadPolicyResultV1,
    { allowed: false }
  >["reason"],
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpGeneratedArtifactExportDownloadPolicyResultV1 {
  return {
    kind: "mcp_generated_artifact_export_download_policy_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpGeneratedArtifactExportDownloadPolicySafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildCapabilities("blocked", "blocked"),
    modelVisible: true,
    componentVisible: false,
    version: 1,
  };
}

function buildCapabilities(
  componentData: McpGeneratedArtifactExportDownloadPolicyCapabilitiesV1["componentData"],
  componentRendering: McpGeneratedArtifactExportDownloadPolicyCapabilitiesV1["componentRendering"],
): McpGeneratedArtifactExportDownloadPolicyCapabilitiesV1 {
  return {
    componentData,
    componentRendering,
    componentRuntime: "blocked",
    uiBridgeRuntime: "blocked",
    toolCalls: "blocked",
    modelContextRuntime: "blocked",
    dataReads: "blocked",
    dataWrites: "blocked",
    writeActions: "blocked",
    exportActions: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

function buildSummaryCapabilities(): McpGeneratedArtifactExportDownloadPolicySummaryCapabilitiesV1 {
  return {
    dataReads: "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    exportActions: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

function allTrue(checks: readonly boolean[]): boolean {
  return checks.every(Boolean);
}

function readArtifactKind(
  value: unknown,
): McpGeneratedArtifactExportDownloadPolicyArtifactKindV1 | undefined {
  return value === "resume_variant" ||
    value === "cover_letter" ||
    value === "application_package"
    ? value
    : undefined;
}

function isSafeArtifactRefId(
  value: unknown,
  artifactKind: McpGeneratedArtifactExportDownloadPolicyArtifactKindV1,
): value is string {
  if (typeof value !== "string") return false;
  const prefix = ARTIFACT_REF_PREFIX_BY_KIND[artifactKind];
  if (!value.startsWith(prefix)) return false;
  const tail = value.slice(prefix.length);
  return /^[a-z0-9][a-z0-9._:-]{0,64}$/u.test(tail) && isSafeRefTail(tail);
}

function isSafeRefTail(value: string): boolean {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\s_/-]/gu, "")
    .toLowerCase();
  return !/(?:raw|text|content|source|quote|private|never|token|secret|session|clerk|stytch|provider|userid|email|subject|document|convex|downloadurl|signedurl|base64|blob|mime)/u.test(
    normalized,
  );
}

function isSafeText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /\S/u.test(value) &&
    value.length <= 500 &&
    !UNSAFE_TEXT_PATTERNS.some((pattern) => pattern.test(value.normalize("NFKC")))
  );
}

function isSafeCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_SAFE_COUNT
  );
}

function readIsoTimestamp(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
    ? value
    : undefined;
}

function hasExactRefIds(value: unknown, expected: readonly string[]): boolean {
  return (
    isArrayValue(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function isSameArtifactRef(
  value: unknown,
  expected: McpGeneratedArtifactExportDownloadPolicyRefV1,
): boolean {
  const record = readExactRecord(value, ARTIFACT_REF_KEYS, ARTIFACT_REF_KEYS);
  return Boolean(
    record &&
      record.id === expected.id &&
      record.label === expected.label &&
      record.status === expected.status &&
      record.category === expected.category &&
      record.count === expected.count &&
      record.updatedAt === expected.updatedAt &&
      record.version === 1,
  );
}

function isSameApprovalSafeCounts(
  value: unknown,
  expected: NonNullable<ReturnType<typeof parseApprovalSafeCounts>>,
): boolean {
  const record = readExactRecord(value, SAFE_COUNTS_KEYS, SAFE_COUNTS_KEYS);
  return Boolean(
    record &&
      record.artifacts === expected.artifacts &&
      record.blockers === expected.blockers &&
      record.warnings === expected.warnings &&
      record.changedSections === expected.changedSections &&
      record.redactedChangedSections === expected.redactedChangedSections &&
      record.version === 1,
  );
}

function readExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(value);
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

function readPlainObjectRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  const descriptors = readPlainObjectDescriptors(value);
  if (!descriptors) return undefined;

  try {
    const record: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return undefined;
      const descriptor = descriptors[key];
      if (!isEnumerableDataDescriptor(descriptor)) return undefined;
      const directValue = (value as Record<string, unknown>)[key];
      if (directValue !== descriptor.value) return undefined;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return undefined;
  }
}

function readPlainObjectDescriptors(
  value: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  try {
    if (value === null || typeof value !== "object" || isArrayValue(value)) {
      return undefined;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    return Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
}

function isArrayValue(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
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
