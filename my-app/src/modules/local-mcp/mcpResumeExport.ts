import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";
import type {
  McpGeneratedArtifactExportDownloadPolicyRefV1,
  McpGeneratedArtifactExportDownloadPolicySummaryV1,
} from "./mcpGeneratedArtifactExportDownloadPolicy";

export type McpResumeExportArtifactKindV1 = "resume_variant";

export type McpResumeExportStatusV1 =
  | "resume_export_created"
  | "resume_export_blocked"
  | "confirmation_required"
  | "policy_blocked"
  | "stale_artifact_blocked"
  | "artifact_mismatch"
  | "unsafe_resume_content";

export type McpResumeExportActionLabelV1 = "ready_for_review";

export type McpResumeExportRefV1 = Readonly<{
  id: string;
  label: "Resume export file";
  status: "resume_export_created";
  category: "resume_variant";
  count: 1;
  updatedAt: string;
  version: 1;
}>;

export type McpResumeExportAuditEventV1 = Readonly<{
  kind: "mcp_resume_export_audit_event";
  eventKind: "resume_export_authorized";
  artifactKind: "resume_variant";
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1;
  exportRef: McpResumeExportRefV1;
  exportStatus: Extract<McpResumeExportStatusV1, "resume_export_created">;
  policyStatus: "export_download_policy_allowed";
  safeCounts: McpResumeExportCountsV1;
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

export type McpResumeExportSummaryV1 = Readonly<{
  kind: "mcp_resume_export_summary";
  allowed: true;
  artifactKind: "resume_variant";
  artifactStatus: "approved_for_preview";
  exportStatus: Extract<McpResumeExportStatusV1, "resume_export_created">;
  policyStatus: "export_download_policy_allowed";
  confirmationStatus: "confirmation_confirmed";
  freshnessStatus: "fresh_artifact_confirmed";
  retentionPolicyStatus: "retention_policy_satisfied";
  deletePolicyStatus: "delete_policy_satisfied";
  rollbackStatus: "rollback_available";
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1;
  exportRef: McpResumeExportRefV1;
  visibilityCategory: "safe_summary_only";
  fileName: "resume-export.md";
  fileExtension: ".md";
  mimeType: "text/markdown";
  characterCount: number;
  byteCount: number;
  checksum: string;
  safeSummary: string;
  nextUserAction: McpResumeExportActionLabelV1;
  refIds: readonly string[];
  safeCounts: McpResumeExportCountsV1;
  safeCategories: McpResumeExportCategoriesV1;
  safeFlags: Readonly<{
    humanReviewRequired: false;
    approvedForPreview: true;
    approvedForExport: true;
    approvedForDownload: true;
    approvedForSend: false;
    approvedForSubmit: false;
    approvedForApply: false;
    fullContentRestricted: true;
    rawDataExposed: false;
    persisted: false;
    urlCreated: false;
    writeActionExecuted: false;
    version: 1;
  }>;
  auditEvent: McpResumeExportAuditEventV1;
  capabilities: McpResumeExportSummaryCapabilitiesV1;
  modelVisible: true;
  componentVisible: true;
  version: 1;
}>;

export type McpResumeExportPayloadV1 = Readonly<{
  kind: "mcp_resume_export_payload";
  artifactKind: "resume_variant";
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1;
  exportRef: McpResumeExportRefV1;
  fileName: "resume-export.md";
  fileExtension: ".md";
  mimeType: "text/markdown";
  content: string;
  characterCount: number;
  byteCount: number;
  checksum: string;
  visibilityCategory: "restricted_full_content";
  persisted: false;
  urlCreated: false;
  writeActionExecuted: false;
  modelVisible: false;
  componentVisible: false;
  version: 1;
}>;

export type McpResumeExportSurfacePayloadsV1 = Readonly<{
  structuredContent: McpResumeExportSummaryV1;
  content: readonly Readonly<{ type: "text"; text: string }>[];
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
  bridgePayload: Record<string, unknown>;
  stateSnapshot: Record<string, unknown>;
  modelContextUpdate: Record<string, unknown>;
  actionLabel: McpResumeExportActionLabelV1;
}>;

export type McpResumeExportCapabilitiesV1 = Readonly<{
  componentData: "policy_checked" | "blocked";
  componentRendering: "view_model_only" | "blocked";
  controlledLocalFileRepresentation: "created" | "blocked";
  componentRuntime: "blocked";
  uiBridgeRuntime: "blocked";
  toolCalls: "blocked";
  modelContextRuntime: "blocked";
  dataReads: "blocked";
  dataWrites: "blocked";
  writeActions: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  rawDataProjection: "blocked";
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

export type McpResumeExportSummaryCapabilitiesV1 = Readonly<{
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

export type McpResumeExportSafeRefusalV1 = Readonly<{
  kind: "local_mcp_component_data_policy_safe_error";
  code: "resume_export_blocked";
  msg: "Refused. Resume export blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpResumeExportResultV1 = Readonly<
  | {
      kind: "mcp_resume_export_result";
      allowed: true;
      reason: "resume_export_authorized";
      summary: McpResumeExportSummaryV1;
      exportPayload: McpResumeExportPayloadV1;
      component: McpResumeExportSurfacePayloadsV1;
      policy: McpResumeExportPolicyStatusV1;
      capabilities: McpResumeExportCapabilitiesV1;
      modelVisible: false;
      componentVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_resume_export_result";
      allowed: false;
      reason:
        | "invalid_input"
        | "confirmation_required"
        | "policy_blocked"
        | "stale_artifact_blocked"
        | "artifact_mismatch"
        | "unsafe_resume_content";
      safeRefusal: McpResumeExportSafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpResumeExportCapabilitiesV1;
      modelVisible: true;
      componentVisible: false;
      version: 1;
    }
>;

type McpResumeExportSurfaceV1 = Extract<
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

type McpResumeExportPolicyStatusV1 = Readonly<
  Record<McpResumeExportSurfaceV1, "allowed">
>;

type McpResumeExportCountsV1 = Readonly<{
  artifacts: 1;
  files: 1;
  blockers: 0;
  warnings: number;
  revisionCount: 0;
  characterCount: number;
  byteCount: number;
  version: 1;
}>;

type McpResumeExportCategoriesV1 = Readonly<{
  artifactKind: "resume_variant";
  artifactStatus: "approved_for_preview";
  exportStatus: "resume_export_created";
  policyStatus: "export_download_policy_allowed";
  confirmationStatus: "confirmation_confirmed";
  freshnessStatus: "fresh_artifact_confirmed";
  retentionPolicyStatus: "retention_policy_satisfied";
  deletePolicyStatus: "delete_policy_satisfied";
  rollbackStatus: "rollback_available";
  visibilityCategory: "safe_summary_only";
  fileName: "resume-export.md";
  fileExtension: ".md";
  mimeType: "text/markdown";
  nextUserAction: McpResumeExportActionLabelV1;
  version: 1;
}>;

type ParsedPolicyResult = Readonly<{
  summary: McpGeneratedArtifactExportDownloadPolicySummaryV1;
  warnings: number;
}>;

type ParsedApprovedResumeArtifact = Readonly<{
  content: string;
}>;

type ParsedResumeExportRequest = Readonly<{
  requestedAt: string;
}>;

type ParsedInput = Readonly<{
  policyResult: ParsedPolicyResult;
  approvedResumeArtifact: ParsedApprovedResumeArtifact;
  resumeExportRequest: ParsedResumeExportRequest;
}>;

type ParseFailure = Extract<McpResumeExportResultV1, { allowed: false }>["reason"];

type ParseResult =
  | Readonly<{ ok: true; input: ParsedInput }>
  | Readonly<{ ok: false; reason: ParseFailure }>;

type ParserResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: ParseFailure }>;

type SurfacePayload = Readonly<{
  surface: McpResumeExportSurfaceV1;
  payload: unknown;
}>;

const INPUT_KEYS = [
  "kind",
  "policyResult",
  "approvedResumeArtifact",
  "resumeExportRequest",
  "freshnessState",
  "version",
] as const;

const POLICY_RESULT_KEYS = [
  "kind",
  "allowed",
  "reason",
  "summary",
  "component",
  "policy",
  "capabilities",
  "modelVisible",
  "componentVisible",
  "version",
] as const;

const POLICY_SUMMARY_KEYS = [
  "kind",
  "allowed",
  "artifactKind",
  "artifactStatus",
  "policyStatus",
  "confirmationStatus",
  "freshnessStatus",
  "retentionPolicyStatus",
  "deletePolicyStatus",
  "rollbackStatus",
  "artifactRef",
  "visibilityCategory",
  "suggestedFilename",
  "safeSummary",
  "nextUserAction",
  "refIds",
  "safeCounts",
  "safeCategories",
  "safeFlags",
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

const POLICY_SAFE_COUNTS_KEYS = [
  "artifacts",
  "blockers",
  "warnings",
  "revisionCount",
  "version",
] as const;

const POLICY_SAFE_CATEGORIES_KEYS = [
  "artifactKind",
  "artifactStatus",
  "policyStatus",
  "confirmationStatus",
  "freshnessStatus",
  "retentionPolicyStatus",
  "deletePolicyStatus",
  "rollbackStatus",
  "visibilityCategory",
  "nextUserAction",
  "version",
] as const;

const POLICY_SAFE_FLAGS_KEYS = [
  "humanReviewRequired",
  "approvedForPreview",
  "approvedForExport",
  "approvedForDownload",
  "approvedForSend",
  "approvedForSubmit",
  "approvedForApply",
  "eligibleForLaterExport",
  "eligibleForLaterDownload",
  "fullContentRestricted",
  "rawDataExposed",
  "persisted",
  "bytesCreated",
  "filePayloadCreated",
  "urlCreated",
  "writeActionExecuted",
  "version",
] as const;

const POLICY_AUDIT_EVENT_KEYS = [
  "kind",
  "eventKind",
  "artifactKind",
  "artifactRef",
  "policyStatus",
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

const SUMMARY_CAPABILITIES_KEYS = [
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

const APPROVED_RESUME_ARTIFACT_KEYS = [
  "kind",
  "artifactKind",
  "artifactStatus",
  "artifactRef",
  "visibilityCategory",
  "retentionCategory",
  "fullContent",
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
  "policyAuthorizedAt",
  "approvedArtifactUpdatedAt",
  "currentArtifactUpdatedAt",
  "revisionLineage",
  "version",
] as const;

const SAFE_ARTIFACT_REF_PREFIX = "mcp-safe-ref:resume-variant:";
const EXPORT_REF_ID = "mcp-safe-ref:resume-variant:export-file";
const FILE_NAME = "resume-export.md";
const FILE_EXTENSION = ".md";
const MIME_TYPE = "text/markdown";
const MAX_EXPORT_CONTENT_BYTES = 50_000;
const MAX_REVISION_COUNT = 25;
const MAX_SAFE_COUNT = 50_000;

const UNSAFE_RESUME_EXPORT_CONTENT_PATTERNS: readonly RegExp[] = [
  /RAW_(?:(?:CV|RESUME|JOB|PROPOSAL|APPLICATION|COVER_LETTER)(?:_TEXT)?|SOURCE_DOCUMENT)_SENTINEL_DO_NOT_EXPOSE/u,
  /SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE/u,
  /PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE/u,
  /NEVER_USE_SENTINEL_DO_NOT_EXPOSE/u,
  /GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE/u,
  /SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE/u,
  /SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE/u,
  /DO_NOT_EXPOSE/u,
  /\bBearer\s+[A-Za-z0-9._-]+/u,
  /\b(?:accessToken|refreshToken|rawClaims)\b/u,
  /\b(?:data:|blob:|base64)\b/iu,
  /\bj97convexdocumentid\b/iu,
];

export function buildMcpResumeExport(input: unknown): McpResumeExportResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput.ok) return deny(parsedInput.reason);

  const exportPayload = buildExportPayload(parsedInput.input);
  const summary = buildSummary(parsedInput.input, exportPayload);
  const component = buildComponentPayloads(summary);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_resume_export_result",
    allowed: true,
    reason: "resume_export_authorized",
    summary,
    exportPayload,
    component,
    policy: policy.surfaceStatus,
    capabilities: buildCapabilities(
      "policy_checked",
      "view_model_only",
      "created",
    ),
    modelVisible: false,
    componentVisible: false,
    version: 1,
  };
}

export function buildMcpResumeExportSafeRefusal(): McpResumeExportSafeRefusalV1 {
  return {
    kind: "local_mcp_component_data_policy_safe_error",
    code: "resume_export_blocked",
    msg: "Refused. Resume export blocked.",
    safeForModel: true,
    rawDataExposed: false,
    componentDataExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseInput(input: unknown): ParseResult {
  const record = readExactRecord(input, INPUT_KEYS, INPUT_KEYS);
  if (!record || record.kind !== "mcp_resume_export_input" || record.version !== 1) {
    return { ok: false, reason: "invalid_input" };
  }

  const policyResult = parsePolicyResult(record.policyResult);
  if (!policyResult.ok) return { ok: false, reason: policyResult.reason };

  const resumeArtifact = parseApprovedResumeArtifact(
    record.approvedResumeArtifact,
    policyResult.value.summary,
  );
  if (!resumeArtifact.ok) return { ok: false, reason: resumeArtifact.reason };

  const request = parseResumeExportRequest(record.resumeExportRequest);
  if (!request.ok) return { ok: false, reason: request.reason };

  const freshnessState = parseFreshnessState(
    record.freshnessState,
    policyResult.value.summary,
  );
  if (!freshnessState.ok) return { ok: false, reason: freshnessState.reason };

  if (
    Date.parse(request.value.requestedAt) <
    Date.parse(policyResult.value.summary.auditEvent.occurredAt)
  ) {
    return { ok: false, reason: "stale_artifact_blocked" };
  }

  return {
    ok: true,
    input: {
      policyResult: policyResult.value,
      approvedResumeArtifact: resumeArtifact.value,
      resumeExportRequest: request.value,
    },
  };
}

function parsePolicyResult(
  value: unknown,
): ParserResult<ParsedPolicyResult> {
  const policyResultRecord = readPlainObjectRecord(value);
  if (
    !policyResultRecord ||
    policyResultRecord.kind !==
      "mcp_generated_artifact_export_download_policy_result" ||
    policyResultRecord.version !== 1
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  if (policyResultRecord.allowed !== true) {
    return { ok: false, reason: "policy_blocked" };
  }

  const record = readExactRecord(value, POLICY_RESULT_KEYS, POLICY_RESULT_KEYS);
  if (!record) return { ok: false, reason: "invalid_input" };

  if (
    record.reason !== "export_download_policy_authorized" ||
    record.modelVisible !== true ||
    record.componentVisible !== true ||
    !readPlainObjectRecord(record.component) ||
    !readPlainObjectRecord(record.policy) ||
    !readPlainObjectRecord(record.capabilities)
  ) {
    return { ok: false, reason: "policy_blocked" };
  }

  const summary = parsePolicySummary(record.summary);
  if (!summary.ok) return { ok: false, reason: summary.reason };

  return {
    ok: true,
    value: {
      summary: summary.value,
      warnings: summary.value.safeCounts.warnings,
    },
  };
}

function parsePolicySummary(
  value: unknown,
): ParserResult<McpGeneratedArtifactExportDownloadPolicySummaryV1> {
  const record = readExactRecord(
    value,
    POLICY_SUMMARY_KEYS,
    POLICY_SUMMARY_KEYS,
  );
  if (!record) return { ok: false, reason: "policy_blocked" };

  const artifactRef = parseArtifactRef(record.artifactRef);
  const safeCounts = parsePolicySafeCounts(record.safeCounts);
  if (!artifactRef || !safeCounts) {
    return { ok: false, reason: "policy_blocked" };
  }

  if (
    !allTrue([
      record.kind === "mcp_generated_artifact_export_download_policy_summary",
      record.allowed === true,
      record.artifactKind === "resume_variant",
      record.artifactStatus === "approved_for_preview",
      record.policyStatus === "export_download_policy_allowed",
      record.confirmationStatus === "confirmation_confirmed",
      record.freshnessStatus === "fresh_artifact_confirmed",
      record.retentionPolicyStatus === "retention_policy_satisfied",
      record.deletePolicyStatus === "delete_policy_satisfied",
      record.rollbackStatus === "rollback_available",
      record.visibilityCategory === "safe_summary_only",
      record.suggestedFilename === "resume-variant-export-policy",
      record.nextUserAction === "ready_for_review",
      record.modelVisible === true,
      record.componentVisible === true,
      record.version === 1,
      isSafeSummaryText(record.safeSummary),
      hasExactRefIds(record.refIds, [artifactRef.id]),
      parsePolicySafeCategories(record.safeCategories),
      parsePolicySafeFlags(record.safeFlags),
      parsePolicyAuditEvent(record.auditEvent, artifactRef, safeCounts),
      parseSummaryCapabilities(record.capabilities),
    ])
  ) {
    return { ok: false, reason: "policy_blocked" };
  }

  return {
    ok: true,
    value: record as unknown as McpGeneratedArtifactExportDownloadPolicySummaryV1,
  };
}

function parseApprovedResumeArtifact(
  value: unknown,
  policySummary: McpGeneratedArtifactExportDownloadPolicySummaryV1,
): ParserResult<ParsedApprovedResumeArtifact> {
  const record = readExactRecord(
    value,
    APPROVED_RESUME_ARTIFACT_KEYS,
    APPROVED_RESUME_ARTIFACT_KEYS,
  );
  if (
    !record ||
    !hasExactValues(record, {
      kind: "mcp_resume_export_approved_resume_artifact",
      artifactKind: "resume_variant",
      artifactStatus: "approved_for_preview",
      visibilityCategory: "restricted_full_content",
      retentionCategory: "restricted_full_content",
      version: 1,
    })
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const artifactRef = parseArtifactRef(record.artifactRef);
  if (!artifactRef || !isSameArtifactRef(artifactRef, policySummary.artifactRef)) {
    return { ok: false, reason: "artifact_mismatch" };
  }

  if (typeof record.fullContent !== "string") {
    return { ok: false, reason: "unsafe_resume_content" };
  }

  const content = normalizeResumeExportContent(record.fullContent);
  return isAllowedResumeExportContent(content)
    ? { ok: true, value: { content } }
    : { ok: false, reason: "unsafe_resume_content" };
}

function parseResumeExportRequest(
  value: unknown,
): ParserResult<ParsedResumeExportRequest> {
  const record = readExactRecord(value, REQUEST_KEYS, REQUEST_KEYS);
  if (
    !record ||
    record.kind !== "mcp_resume_export_request" ||
    record.mode !== "controlled_local_file_export" ||
    record.actor !== "human" ||
    record.confirmation !== "confirm_resume_export" ||
    record.version !== 1
  ) {
    return { ok: false, reason: "confirmation_required" };
  }

  const requestedAt = readIsoTimestamp(record.requestedAt);
  if (!requestedAt) return { ok: false, reason: "invalid_input" };

  return { ok: true, value: { requestedAt } };
}

function parseFreshnessState(
  value: unknown,
  policySummary: McpGeneratedArtifactExportDownloadPolicySummaryV1,
): ParserResult<readonly string[]> {
  const record = readExactRecord(
    value,
    FRESHNESS_STATE_KEYS,
    FRESHNESS_STATE_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_resume_export_freshness_state" ||
    record.version !== 1
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const artifactRef = parseArtifactRef(record.artifactRef);
  const policyAuthorizedAt = readIsoTimestamp(record.policyAuthorizedAt);
  const approvedArtifactUpdatedAt = readIsoTimestamp(
    record.approvedArtifactUpdatedAt,
  );
  const currentArtifactUpdatedAt = readIsoTimestamp(
    record.currentArtifactUpdatedAt,
  );
  const revisionLineage = parseRevisionLineage(record.revisionLineage);

  if (
    !artifactRef ||
    !policyAuthorizedAt ||
    !approvedArtifactUpdatedAt ||
    !currentArtifactUpdatedAt ||
    !revisionLineage
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  if (
    !allTrue([
      isSameArtifactRef(artifactRef, policySummary.artifactRef),
      policyAuthorizedAt === policySummary.auditEvent.occurredAt,
      approvedArtifactUpdatedAt === policySummary.artifactRef.updatedAt,
      currentArtifactUpdatedAt === policySummary.artifactRef.updatedAt,
      revisionLineage.length === 1,
      revisionLineage[0] === policySummary.artifactRef.id,
    ])
  ) {
    return { ok: false, reason: "stale_artifact_blocked" };
  }

  return { ok: true, value: revisionLineage };
}

function buildExportPayload(input: ParsedInput): McpResumeExportPayloadV1 {
  const content = input.approvedResumeArtifact.content;
  const characterCount = countCharacters(content);
  const byteCount = utf8ByteLength(content);
  const checksum = buildDeterministicChecksum(content);
  const exportRef = buildExportRef(input);

  return {
    kind: "mcp_resume_export_payload",
    artifactKind: "resume_variant",
    artifactRef: input.policyResult.summary.artifactRef,
    exportRef,
    fileName: FILE_NAME,
    fileExtension: FILE_EXTENSION,
    mimeType: MIME_TYPE,
    content,
    characterCount,
    byteCount,
    checksum,
    visibilityCategory: "restricted_full_content",
    persisted: false,
    urlCreated: false,
    writeActionExecuted: false,
    modelVisible: false,
    componentVisible: false,
    version: 1,
  };
}

function buildSummary(
  input: ParsedInput,
  exportPayload: McpResumeExportPayloadV1,
): McpResumeExportSummaryV1 {
  const safeCounts = buildSafeCounts(input, exportPayload);
  const safeCategories = buildSafeCategories();
  const auditEvent = buildAuditEvent(input, exportPayload, safeCounts);

  return {
    kind: "mcp_resume_export_summary",
    allowed: true,
    artifactKind: "resume_variant",
    artifactStatus: "approved_for_preview",
    exportStatus: "resume_export_created",
    policyStatus: "export_download_policy_allowed",
    confirmationStatus: "confirmation_confirmed",
    freshnessStatus: "fresh_artifact_confirmed",
    retentionPolicyStatus: "retention_policy_satisfied",
    deletePolicyStatus: "delete_policy_satisfied",
    rollbackStatus: "rollback_available",
    artifactRef: input.policyResult.summary.artifactRef,
    exportRef: exportPayload.exportRef,
    visibilityCategory: "safe_summary_only",
    fileName: exportPayload.fileName,
    fileExtension: exportPayload.fileExtension,
    mimeType: exportPayload.mimeType,
    characterCount: exportPayload.characterCount,
    byteCount: exportPayload.byteCount,
    checksum: exportPayload.checksum,
    safeSummary: "Resume export representation created. File body is restricted.",
    nextUserAction: "ready_for_review",
    refIds: [input.policyResult.summary.artifactRef.id, exportPayload.exportRef.id],
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
      fullContentRestricted: true,
      rawDataExposed: false,
      persisted: false,
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
  exportPayload: McpResumeExportPayloadV1,
): McpResumeExportCountsV1 {
  return {
    artifacts: 1,
    files: 1,
    blockers: 0,
    warnings: input.policyResult.warnings,
    revisionCount: 0,
    characterCount: exportPayload.characterCount,
    byteCount: exportPayload.byteCount,
    version: 1,
  };
}

function buildSafeCategories(): McpResumeExportCategoriesV1 {
  return {
    artifactKind: "resume_variant",
    artifactStatus: "approved_for_preview",
    exportStatus: "resume_export_created",
    policyStatus: "export_download_policy_allowed",
    confirmationStatus: "confirmation_confirmed",
    freshnessStatus: "fresh_artifact_confirmed",
    retentionPolicyStatus: "retention_policy_satisfied",
    deletePolicyStatus: "delete_policy_satisfied",
    rollbackStatus: "rollback_available",
    visibilityCategory: "safe_summary_only",
    fileName: FILE_NAME,
    fileExtension: FILE_EXTENSION,
    mimeType: MIME_TYPE,
    nextUserAction: "ready_for_review",
    version: 1,
  };
}

function buildAuditEvent(
  input: ParsedInput,
  exportPayload: McpResumeExportPayloadV1,
  safeCounts: McpResumeExportCountsV1,
): McpResumeExportAuditEventV1 {
  return {
    kind: "mcp_resume_export_audit_event",
    eventKind: "resume_export_authorized",
    artifactKind: "resume_variant",
    artifactRef: input.policyResult.summary.artifactRef,
    exportRef: exportPayload.exportRef,
    exportStatus: "resume_export_created",
    policyStatus: "export_download_policy_allowed",
    safeCounts,
    redactedFlags: {
      rawDataExposed: false,
      fullContentRestricted: true,
      tokenOrIdentityExposed: false,
      persisted: false,
      version: 1,
    },
    occurredAt: input.resumeExportRequest.requestedAt,
    persisted: false,
    version: 1,
  };
}

function buildExportRef(input: ParsedInput): McpResumeExportRefV1 {
  return {
    id: EXPORT_REF_ID,
    label: "Resume export file",
    status: "resume_export_created",
    category: "resume_variant",
    count: 1,
    updatedAt: input.resumeExportRequest.requestedAt,
    version: 1,
  };
}

function buildComponentPayloads(
  summary: McpResumeExportSummaryV1,
): McpResumeExportSurfacePayloadsV1 {
  const shared = {
    artifactKind: summary.artifactKind,
    artifactStatus: summary.artifactStatus,
    exportStatus: summary.exportStatus,
    policyStatus: summary.policyStatus,
    confirmationStatus: summary.confirmationStatus,
    freshnessStatus: summary.freshnessStatus,
    retentionPolicyStatus: summary.retentionPolicyStatus,
    deletePolicyStatus: summary.deletePolicyStatus,
    rollbackStatus: summary.rollbackStatus,
    artifactRef: summary.artifactRef,
    exportRef: summary.exportRef,
    visibilityCategory: summary.visibilityCategory,
    fileName: summary.fileName,
    fileExtension: summary.fileExtension,
    mimeType: summary.mimeType,
    characterCount: summary.characterCount,
    byteCount: summary.byteCount,
    checksum: summary.checksum,
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
      { type: "text", text: "Resume export metadata is safe." },
      { type: "text", text: "File body remains restricted." },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...shared,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: "Resume export",
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
  component: McpResumeExportSurfacePayloadsV1,
):
  | Readonly<{ ok: true; surfaceStatus: McpResumeExportPolicyStatusV1 }>
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

  const surfaceStatus = {} as Record<McpResumeExportSurfaceV1, "allowed">;
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
  reason: Extract<McpResumeExportResultV1, { allowed: false }>["reason"],
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpResumeExportResultV1 {
  return {
    kind: "mcp_resume_export_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpResumeExportSafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildCapabilities("blocked", "blocked", "blocked"),
    modelVisible: true,
    componentVisible: false,
    version: 1,
  };
}

function buildCapabilities(
  componentData: McpResumeExportCapabilitiesV1["componentData"],
  componentRendering: McpResumeExportCapabilitiesV1["componentRendering"],
  controlledLocalFileRepresentation: McpResumeExportCapabilitiesV1["controlledLocalFileRepresentation"],
): McpResumeExportCapabilitiesV1 {
  return {
    componentData,
    componentRendering,
    controlledLocalFileRepresentation,
    componentRuntime: "blocked",
    uiBridgeRuntime: "blocked",
    toolCalls: "blocked",
    modelContextRuntime: "blocked",
    dataReads: "blocked",
    dataWrites: "blocked",
    writeActions: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

function buildSummaryCapabilities(): McpResumeExportSummaryCapabilitiesV1 {
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

function parseArtifactRef(
  value: unknown,
): McpGeneratedArtifactExportDownloadPolicyRefV1 | undefined {
  const record = readExactRecord(value, ARTIFACT_REF_KEYS, ARTIFACT_REF_KEYS);
  const updatedAt = record ? readIsoTimestamp(record.updatedAt) : undefined;
  if (
    !record ||
    !isSafeArtifactRefId(record.id) ||
    record.label !== "Resume variant artifact" ||
    record.status !== "approved_for_preview" ||
    record.category !== "resume_variant" ||
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
    category: "resume_variant",
    count: record.count,
    updatedAt,
    version: 1,
  };
}

function parsePolicySafeCounts(
  value: unknown,
):
  | Readonly<{
      artifacts: number;
      blockers: number;
      warnings: number;
      revisionCount: number;
      version: 1;
    }>
  | undefined {
  const record = readExactRecord(
    value,
    POLICY_SAFE_COUNTS_KEYS,
    POLICY_SAFE_COUNTS_KEYS,
  );
  if (
    !record ||
    record.artifacts !== 1 ||
    record.blockers !== 0 ||
    !isSafeCount(record.warnings) ||
    record.revisionCount !== 0 ||
    record.version !== 1
  ) {
    return undefined;
  }

  return {
    artifacts: 1,
    blockers: 0,
    warnings: record.warnings,
    revisionCount: 0,
    version: 1,
  };
}

function parsePolicySafeCategories(value: unknown): boolean {
  const record = readExactRecord(
    value,
    POLICY_SAFE_CATEGORIES_KEYS,
    POLICY_SAFE_CATEGORIES_KEYS,
  );
  return Boolean(
    record &&
      hasExactValues(record, {
        artifactKind: "resume_variant",
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
      }),
  );
}

function parsePolicySafeFlags(value: unknown): boolean {
  const record = readExactRecord(
    value,
    POLICY_SAFE_FLAGS_KEYS,
    POLICY_SAFE_FLAGS_KEYS,
  );
  return Boolean(
    record &&
      hasExactValues(record, {
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
      }),
  );
}

function parsePolicyAuditEvent(
  value: unknown,
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1,
  safeCounts: NonNullable<ReturnType<typeof parsePolicySafeCounts>>,
): boolean {
  const record = readExactRecord(
    value,
    POLICY_AUDIT_EVENT_KEYS,
    POLICY_AUDIT_EVENT_KEYS,
  );
  return Boolean(
    record &&
      hasExactValues(record, {
        kind: "mcp_generated_artifact_export_download_policy_audit_event",
        eventKind: "export_download_policy_authorized",
        artifactKind: "resume_variant",
        policyStatus: "export_download_policy_allowed",
        persisted: false,
        version: 1,
      }) &&
      isSameArtifactRef(record.artifactRef, artifactRef) &&
      isSamePolicySafeCounts(record.safeCounts, safeCounts) &&
      parseRedactedFlags(record.redactedFlags) &&
      Boolean(readIsoTimestamp(record.occurredAt)),
  );
}

function parseRedactedFlags(value: unknown): boolean {
  const record = readExactRecord(
    value,
    REDACTED_FLAGS_KEYS,
    REDACTED_FLAGS_KEYS,
  );
  return Boolean(
    record &&
      hasExactValues(record, {
        rawDataExposed: false,
        fullContentRestricted: true,
        tokenOrIdentityExposed: false,
        persisted: false,
        version: 1,
      }),
  );
}

function parseSummaryCapabilities(value: unknown): boolean {
  const record = readExactRecord(
    value,
    SUMMARY_CAPABILITIES_KEYS,
    SUMMARY_CAPABILITIES_KEYS,
  );
  return Boolean(
    record &&
      hasExactValues(record, {
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
      }),
  );
}

function parseRevisionLineage(value: unknown): readonly string[] | undefined {
  if (
    !isArrayValue(value) ||
    value.length === 0 ||
    value.length > MAX_REVISION_COUNT + 1
  ) {
    return undefined;
  }
  if (
    !value.every((item): item is string => isSafeArtifactRefId(item))
  ) {
    return undefined;
  }
  return [...value];
}

function normalizeResumeExportContent(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  return normalized.length > 0 ? `${normalized}\n` : "";
}

function isAllowedResumeExportContent(value: string): boolean {
  const byteCount = utf8ByteLength(value);
  return (
    /\S/u.test(value) &&
    byteCount > 0 &&
    byteCount <= MAX_EXPORT_CONTENT_BYTES &&
    !UNSAFE_RESUME_EXPORT_CONTENT_PATTERNS.some((pattern) =>
      pattern.test(value),
    )
  );
}

function buildDeterministicChecksum(value: string): string {
  let hash = 0x811c9dc5;
  forEachUtf8Byte(value, (byte) => {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  });
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

function utf8ByteLength(value: string): number {
  let byteCount = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    byteCount += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return byteCount;
}

function forEachUtf8Byte(
  value: string,
  visitor: (byte: number) => void,
): void {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint <= 0x7f) {
      visitor(codePoint);
    } else if (codePoint <= 0x7ff) {
      visitor(0xc0 | (codePoint >> 6));
      visitor(0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      visitor(0xe0 | (codePoint >> 12));
      visitor(0x80 | ((codePoint >> 6) & 0x3f));
      visitor(0x80 | (codePoint & 0x3f));
    } else {
      visitor(0xf0 | (codePoint >> 18));
      visitor(0x80 | ((codePoint >> 12) & 0x3f));
      visitor(0x80 | ((codePoint >> 6) & 0x3f));
      visitor(0x80 | (codePoint & 0x3f));
    }
  }
}

function countCharacters(value: string): number {
  return [...value].length;
}

function isSafeArtifactRefId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!value.startsWith(SAFE_ARTIFACT_REF_PREFIX)) return false;
  const tail = value.slice(SAFE_ARTIFACT_REF_PREFIX.length);
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

function isSafeSummaryText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /\S/u.test(value) &&
    value.length <= 500 &&
    !UNSAFE_RESUME_EXPORT_CONTENT_PATTERNS.some((pattern) =>
      pattern.test(value.normalize("NFKC")),
    )
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

function isSamePolicySafeCounts(
  value: unknown,
  expected: NonNullable<ReturnType<typeof parsePolicySafeCounts>>,
): boolean {
  const record = readExactRecord(
    value,
    POLICY_SAFE_COUNTS_KEYS,
    POLICY_SAFE_COUNTS_KEYS,
  );
  return Boolean(
    record &&
      record.artifacts === expected.artifacts &&
      record.blockers === expected.blockers &&
      record.warnings === expected.warnings &&
      record.revisionCount === expected.revisionCount &&
      record.version === 1,
  );
}

function allTrue(checks: readonly boolean[]): boolean {
  return checks.every(Boolean);
}

function hasExactValues(
  record: Record<string, unknown>,
  expected: Readonly<Record<string, unknown>>,
): boolean {
  return Object.entries(expected).every(([key, value]) => record[key] === value);
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
