import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";
import type {
  McpGeneratedArtifactExportDownloadPolicyRefV1,
  McpGeneratedArtifactExportDownloadPolicyResultV1,
  McpGeneratedArtifactExportDownloadPolicySummaryV1,
} from "./mcpGeneratedArtifactExportDownloadPolicy";

export type McpCoverLetterApplicationPackageExportArtifactKindV1 =
  | "cover_letter"
  | "application_package";

type McpCoverLetterApplicationPackageExportStatusV1 =
  | "cover_letter_export_created"
  | "application_package_export_created"
  | "cover_letter_application_package_export_blocked"
  | "confirmation_required"
  | "policy_blocked"
  | "stale_artifact_blocked"
  | "artifact_mismatch"
  | "unsafe_export_content";

type McpCoverLetterApplicationPackageExportCreatedStatusV1 = Extract<
  McpCoverLetterApplicationPackageExportStatusV1,
  "cover_letter_export_created" | "application_package_export_created"
>;

type McpCoverLetterApplicationPackageExportFileNameV1 =
  | "cover-letter-export.md"
  | "application-package-export.md";

export type McpCoverLetterApplicationPackageExportActionLabelV1 =
  "ready_for_review";

export type McpCoverLetterApplicationPackageExportRefV1 = Readonly<{
  id: string;
  label: "Cover letter export file" | "Application pkg export file";
  status: McpCoverLetterApplicationPackageExportCreatedStatusV1;
  category: McpCoverLetterApplicationPackageExportArtifactKindV1;
  count: 1;
  updatedAt: string;
  version: 1;
}>;

export type McpCoverLetterApplicationPackageExportAuditEventV1 = Readonly<{
  kind: "mcp_cover_letter_application_package_export_audit_event";
  eventKind: "cover_letter_application_package_export_authorized";
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1;
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1;
  exportRef: McpCoverLetterApplicationPackageExportRefV1;
  exportStatus: McpCoverLetterApplicationPackageExportCreatedStatusV1;
  policyStatus: "export_download_policy_allowed";
  safeCounts: McpCoverLetterApplicationPackageExportCountsV1;
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

export type McpCoverLetterApplicationPackageExportSummaryV1 = Readonly<{
  kind: "mcp_cover_letter_application_package_export_summary";
  allowed: true;
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1;
  artifactStatus: "approved_for_preview";
  exportStatus: McpCoverLetterApplicationPackageExportCreatedStatusV1;
  policyStatus: "export_download_policy_allowed";
  confirmationStatus: "confirmation_confirmed";
  freshnessStatus: "fresh_artifact_confirmed";
  retentionPolicyStatus: "retention_policy_satisfied";
  deletePolicyStatus: "delete_policy_satisfied";
  rollbackStatus: "rollback_available";
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1;
  exportRef: McpCoverLetterApplicationPackageExportRefV1;
  visibilityCategory: "safe_summary_only";
  fileName: McpCoverLetterApplicationPackageExportFileNameV1;
  fileExtension: ".md";
  mimeType: "text/markdown";
  characterCount: number;
  byteCount: number;
  checksum: string;
  safeSummary: string;
  nextUserAction: McpCoverLetterApplicationPackageExportActionLabelV1;
  refIds: readonly string[];
  safeCounts: McpCoverLetterApplicationPackageExportCountsV1;
  safeCategories: McpCoverLetterApplicationPackageExportCategoriesV1;
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
  auditEvent: McpCoverLetterApplicationPackageExportAuditEventV1;
  capabilities: McpCoverLetterApplicationPackageExportSummaryCapabilitiesV1;
  modelVisible: true;
  componentVisible: true;
  version: 1;
}>;

export type McpCoverLetterApplicationPackageExportPayloadV1 = Readonly<{
  kind: "mcp_cover_letter_application_package_export_payload";
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1;
  artifactRef: McpGeneratedArtifactExportDownloadPolicyRefV1;
  exportRef: McpCoverLetterApplicationPackageExportRefV1;
  fileName: McpCoverLetterApplicationPackageExportFileNameV1;
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

export type McpCoverLetterApplicationPackageExportSurfacePayloadsV1 =
  Readonly<{
    structuredContent: McpCoverLetterApplicationPackageExportSummaryV1;
    content: readonly Readonly<{ type: "text"; text: string }>[];
    meta: Record<string, unknown>;
    props: Record<string, unknown>;
    bridgePayload: Record<string, unknown>;
    stateSnapshot: Record<string, unknown>;
    modelContextUpdate: Record<string, unknown>;
    actionLabel: McpCoverLetterApplicationPackageExportActionLabelV1;
  }>;

export type McpCoverLetterApplicationPackageExportCapabilitiesV1 = Readonly<{
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

export type McpCoverLetterApplicationPackageExportSummaryCapabilitiesV1 =
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

export type McpCoverLetterApplicationPackageExportSafeRefusalV1 = Readonly<{
  kind: "local_mcp_component_data_policy_safe_error";
  code: "cover_letter_application_package_export_blocked";
  msg: "Refused. Cover letter/app pkg export blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpCoverLetterApplicationPackageExportResultV1 = Readonly<
  | {
      kind: "mcp_cover_letter_application_package_export_result";
      allowed: true;
      reason: "cover_letter_application_package_export_authorized";
      summary: McpCoverLetterApplicationPackageExportSummaryV1;
      exportPayload: McpCoverLetterApplicationPackageExportPayloadV1;
      component: McpCoverLetterApplicationPackageExportSurfacePayloadsV1;
      policy: McpCoverLetterApplicationPackageExportPolicyStatusV1;
      capabilities: McpCoverLetterApplicationPackageExportCapabilitiesV1;
      modelVisible: false;
      componentVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_cover_letter_application_package_export_result";
      allowed: false;
      reason:
        | "invalid_input"
        | "confirmation_required"
        | "policy_blocked"
        | "stale_artifact_blocked"
        | "artifact_mismatch"
        | "unsafe_export_content";
      safeRefusal: McpCoverLetterApplicationPackageExportSafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpCoverLetterApplicationPackageExportCapabilitiesV1;
      modelVisible: true;
      componentVisible: false;
      version: 1;
    }
>;

type McpCoverLetterApplicationPackageExportSurfaceV1 = Extract<
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

type McpCoverLetterApplicationPackageExportPolicyStatusV1 = Readonly<
  Record<McpCoverLetterApplicationPackageExportSurfaceV1, "allowed">
>;

type McpCoverLetterApplicationPackageExportCountsV1 = Readonly<{
  artifacts: 1;
  files: 1;
  blockers: 0;
  warnings: number;
  revisionCount: 0;
  characterCount: number;
  byteCount: number;
  version: 1;
}>;

type McpCoverLetterApplicationPackageExportCategoriesV1 = Readonly<{
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1;
  artifactStatus: "approved_for_preview";
  exportStatus: McpCoverLetterApplicationPackageExportCreatedStatusV1;
  policyStatus: "export_download_policy_allowed";
  confirmationStatus: "confirmation_confirmed";
  freshnessStatus: "fresh_artifact_confirmed";
  retentionPolicyStatus: "retention_policy_satisfied";
  deletePolicyStatus: "delete_policy_satisfied";
  rollbackStatus: "rollback_available";
  visibilityCategory: "safe_summary_only";
  fileName: McpCoverLetterApplicationPackageExportFileNameV1;
  fileExtension: ".md";
  mimeType: "text/markdown";
  nextUserAction: McpCoverLetterApplicationPackageExportActionLabelV1;
  version: 1;
}>;

type ParsedPolicyResult = Readonly<{
  summary: McpGeneratedArtifactExportDownloadPolicySummaryV1;
  warnings: number;
}>;

type ParsedApprovedExportArtifact = Readonly<{
  content: string;
}>;

type ParsedExportRequest = Readonly<{
  requestedAt: string;
}>;

type ParsedInput = Readonly<{
  policyResult: ParsedPolicyResult;
  approvedExportArtifact: ParsedApprovedExportArtifact;
  exportRequest: ParsedExportRequest;
}>;

type ParseFailure = Extract<
  McpCoverLetterApplicationPackageExportResultV1,
  { allowed: false }
>["reason"];

type ParseResult =
  | Readonly<{ ok: true; input: ParsedInput }>
  | Readonly<{ ok: false; reason: ParseFailure }>;

type ParserResult<T> =
  | Readonly<{ ok: true; val: T }>
  | Readonly<{ ok: false; reason: ParseFailure }>;

type SurfacePayload = Readonly<{
  surface: McpCoverLetterApplicationPackageExportSurfaceV1;
  payload: unknown;
}>;

type ExportConfig = Readonly<{
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1;
  exportStatus: McpCoverLetterApplicationPackageExportCreatedStatusV1;
  exportRefId: string;
  exportRefLabel: "Cover letter export file" | "Application pkg export file";
  fileName: McpCoverLetterApplicationPackageExportFileNameV1;
  policySuggestedFilename:
    | "cover-letter-export-policy"
    | "application-package-export-policy";
  safeSummary: string;
  contentSummary: string;
  title: string;
  confirmation: "confirm_cover_letter_export" | "confirm_application_package_export";
}>;

const INPUT_KEYS = [
  "kind",
  "policyResult",
  "approvedExportArtifact",
  "exportRequest",
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

const APPROVED_EXPORT_ARTIFACT_KEYS = [
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

const ARTIFACT_REF_PREFIX_BY_KIND: Record<
  McpCoverLetterApplicationPackageExportArtifactKindV1,
  string
> = {
  cover_letter: "mcp-safe-ref:cover-letter:",
  application_package: "mcp-safe-ref:application-package:",
};

const ARTIFACT_LABEL_BY_KIND: Record<
  McpCoverLetterApplicationPackageExportArtifactKindV1,
  "Cover letter artifact" | "Application pkg artifact"
> = {
  cover_letter: "Cover letter artifact",
  application_package: "Application pkg artifact",
};

const EXPORT_CONFIG_BY_KIND: Record<
  McpCoverLetterApplicationPackageExportArtifactKindV1,
  ExportConfig
> = {
  cover_letter: {
    artifactKind: "cover_letter",
    exportStatus: "cover_letter_export_created",
    exportRefId: "mcp-safe-ref:cover-letter:export-file",
    exportRefLabel: "Cover letter export file",
    fileName: "cover-letter-export.md",
    policySuggestedFilename: "cover-letter-export-policy",
    safeSummary:
      "Cover letter export representation created. File body is restricted.",
    contentSummary: "Cover letter export metadata is safe.",
    title: "Cover letter export",
    confirmation: "confirm_cover_letter_export",
  },
  application_package: {
    artifactKind: "application_package",
    exportStatus: "application_package_export_created",
    exportRefId: "mcp-safe-ref:application-package:export-file",
    exportRefLabel: "Application pkg export file",
    fileName: "application-package-export.md",
    policySuggestedFilename: "application-package-export-policy",
    safeSummary:
      "Application package export representation created. File body is restricted.",
    contentSummary: "Application package export metadata is safe.",
    title: "Application package export",
    confirmation: "confirm_application_package_export",
  },
};

const FILE_EXTENSION = ".md";
const MIME_TYPE = "text/markdown";
const MAX_EXPORT_CONTENT_BYTES = 50_000;
const MAX_REVISION_COUNT = 25;
const MAX_SAFE_COUNT = 50_000;

const DELIVERABLE_METADATA_PATTERN = new RegExp(
  [
    ["rec", "ipient"].join(""),
    ["delivery", "Channel"].join(""),
    ["provider", "Message", "Id"].join(""),
    ["thread", "Id"].join(""),
    ["send", "Target"].join(""),
    ["submit", "Target"].join(""),
    ["apply", "Target"].join(""),
    ["email", "Subject"].join(""),
    ["email", "Body"].join(""),
  ].join("|"),
  "iu",
);

const UNSAFE_EXPORT_CONTENT_PATTERNS: readonly RegExp[] = [
  /RAW_(?:(?:CV|RESUME|JOB|PROPOSAL|app|COVER_LETTER)(?:_TEXT)?|SOURCE_DOCUMENT)_SENTINEL_DO_NOT_EXPOSE/u,
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
  DELIVERABLE_METADATA_PATTERN,
];

export function buildMcpCoverLetterApplicationPackageExport(
  input: unknown,
): McpCoverLetterApplicationPackageExportResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput.ok) return deny(parsedInput.reason);

  const exportPayload = buildExportPayload(parsedInput.input);
  const summary = buildSummary(parsedInput.input, exportPayload);
  const component = buildComponentPayloads(summary);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_cover_letter_application_package_export_result",
    allowed: true,
    reason: "cover_letter_application_package_export_authorized",
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

export function buildMcpCoverLetterApplicationPackageExportSafeRefusal(): McpCoverLetterApplicationPackageExportSafeRefusalV1 {
  return {
    kind: "local_mcp_component_data_policy_safe_error",
    code: "cover_letter_application_package_export_blocked",
    msg: "Refused. Cover letter/app pkg export blocked.",
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
    record.kind !== "mcp_cover_letter_application_package_export_input" ||
    record.version !== 1
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const policyResult = parsePolicyResult(record.policyResult);
  if (!policyResult.ok) return { ok: false, reason: policyResult.reason };

  const exportArtifact = parseApprovedExportArtifact(
    record.approvedExportArtifact,
    policyResult.val.summary,
  );
  if (!exportArtifact.ok) return { ok: false, reason: exportArtifact.reason };

  const req = parseExportRequest(
    record.exportRequest,
    policyResult.val.summary.artifactKind,
  );
  if (!req.ok) return { ok: false, reason: req.reason };

  const freshnessState = parseFreshnessState(
    record.freshnessState,
    policyResult.val.summary,
  );
  if (!freshnessState.ok) return { ok: false, reason: freshnessState.reason };

  if (
    Date.parse(req.val.requestedAt) <
    Date.parse(policyResult.val.summary.auditEvent.occurredAt)
  ) {
    return { ok: false, reason: "stale_artifact_blocked" };
  }

  return {
    ok: true,
    input: {
      policyResult: policyResult.val,
      approvedExportArtifact: exportArtifact.val,
      exportRequest: req.val,
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
    val: {
      summary: summary.val,
      warnings: summary.val.safeCounts.warnings,
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

  const artifactKind = readArtifactKind(record.artifactKind);
  if (!artifactKind) return { ok: false, reason: "policy_blocked" };

  const config = EXPORT_CONFIG_BY_KIND[artifactKind];
  const artifactRef = parseArtifactRef(record.artifactRef, artifactKind);
  const safeCounts = parsePolicySafeCounts(record.safeCounts);
  if (!artifactRef || !safeCounts) {
    return { ok: false, reason: "policy_blocked" };
  }

  if (
    !allTrue([
      record.kind === "mcp_generated_artifact_export_download_policy_summary",
      record.allowed === true,
      record.artifactStatus === "approved_for_preview",
      record.policyStatus === "export_download_policy_allowed",
      record.confirmationStatus === "confirmation_confirmed",
      record.freshnessStatus === "fresh_artifact_confirmed",
      record.retentionPolicyStatus === "retention_policy_satisfied",
      record.deletePolicyStatus === "delete_policy_satisfied",
      record.rollbackStatus === "rollback_available",
      record.visibilityCategory === "safe_summary_only",
      record.suggestedFilename === config.policySuggestedFilename,
      record.nextUserAction === "ready_for_review",
      record.modelVisible === true,
      record.componentVisible === true,
      record.version === 1,
      isSafeSummaryText(record.safeSummary),
      hasExactRefIds(record.refIds, [artifactRef.id]),
      parsePolicySafeCategories(record.safeCategories, artifactKind),
      parsePolicySafeFlags(record.safeFlags),
      parsePolicyAuditEvent(record.auditEvent, artifactKind, artifactRef, safeCounts),
      parseSummaryCapabilities(record.capabilities),
    ])
  ) {
    return { ok: false, reason: "policy_blocked" };
  }

  return {
    ok: true,
    val: record as unknown as McpGeneratedArtifactExportDownloadPolicySummaryV1,
  };
}

function parseApprovedExportArtifact(
  value: unknown,
  policySummary: McpGeneratedArtifactExportDownloadPolicySummaryV1,
): ParserResult<ParsedApprovedExportArtifact> {
  const record = readExactRecord(
    value,
    APPROVED_EXPORT_ARTIFACT_KEYS,
    APPROVED_EXPORT_ARTIFACT_KEYS,
  );
  if (
    !record ||
    !hasExactValues(record, {
      kind: "mcp_cover_letter_application_package_export_approved_artifact",
      artifactKind: policySummary.artifactKind,
      artifactStatus: "approved_for_preview",
      visibilityCategory: "restricted_full_content",
      retentionCategory: "restricted_full_content",
      version: 1,
    })
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const artifactKind = readArtifactKind(record.artifactKind);
  if (!artifactKind) return { ok: false, reason: "invalid_input" };

  const artifactRef = parseArtifactRef(record.artifactRef, artifactKind);
  if (!artifactRef || !isSameArtifactRef(artifactRef, policySummary.artifactRef)) {
    return { ok: false, reason: "artifact_mismatch" };
  }

  if (typeof record.fullContent !== "string") {
    return { ok: false, reason: "unsafe_export_content" };
  }

  const content = normalizeExportContent(record.fullContent);
  return isAllowedExportContent(content)
    ? { ok: true, val: { content } }
    : { ok: false, reason: "unsafe_export_content" };
}

function parseExportRequest(
  value: unknown,
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1,
): ParserResult<ParsedExportRequest> {
  const record = readExactRecord(value, REQUEST_KEYS, REQUEST_KEYS);
  const config = EXPORT_CONFIG_BY_KIND[artifactKind];
  if (
    !record ||
    record.kind !== "mcp_cover_letter_application_package_export_request" ||
    record.mode !== "controlled_local_file_export" ||
    record.actor !== "human" ||
    record.confirmation !== config.confirmation ||
    record.version !== 1
  ) {
    return { ok: false, reason: "confirmation_required" };
  }

  const requestedAt = readIsoTimestamp(record.requestedAt);
  if (!requestedAt) return { ok: false, reason: "invalid_input" };
  return { ok: true, val: { requestedAt } };
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
    record.kind !== "mcp_cover_letter_application_package_export_freshness_state" ||
    record.version !== 1
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const artifactKind = readArtifactKind(policySummary.artifactKind);
  if (!artifactKind) return { ok: false, reason: "invalid_input" };

  const artifactRef = parseArtifactRef(record.artifactRef, artifactKind);
  const policyAuthorizedAt = readIsoTimestamp(record.policyAuthorizedAt);
  const approvedArtifactUpdatedAt = readIsoTimestamp(
    record.approvedArtifactUpdatedAt,
  );
  const currentArtifactUpdatedAt = readIsoTimestamp(
    record.currentArtifactUpdatedAt,
  );
  const revisionLineage = parseRevisionLineage(
    record.revisionLineage,
    artifactKind,
  );

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

  return { ok: true, val: revisionLineage };
}

function buildExportPayload(
  input: ParsedInput,
): McpCoverLetterApplicationPackageExportPayloadV1 {
  const artifactKind = input.policyResult.summary.artifactKind;
  const config = EXPORT_CONFIG_BY_KIND[artifactKind];
  const content = input.approvedExportArtifact.content;
  const characterCount = countCharacters(content);
  const byteCount = utf8ByteLength(content);
  const checksum = buildDeterministicChecksum(content);
  const exportRef = buildExportRef(input);

  return {
    kind: "mcp_cover_letter_application_package_export_payload",
    artifactKind,
    artifactRef: input.policyResult.summary.artifactRef,
    exportRef,
    fileName: config.fileName,
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
  exportPayload: McpCoverLetterApplicationPackageExportPayloadV1,
): McpCoverLetterApplicationPackageExportSummaryV1 {
  const config = EXPORT_CONFIG_BY_KIND[input.policyResult.summary.artifactKind];
  const safeCounts = buildSafeCounts(input, exportPayload);
  const safeCategories = buildSafeCategories(config);
  const auditEvent = buildAuditEvent(input, exportPayload, safeCounts);

  return {
    kind: "mcp_cover_letter_application_package_export_summary",
    allowed: true,
    artifactKind: input.policyResult.summary.artifactKind,
    artifactStatus: "approved_for_preview",
    exportStatus: config.exportStatus,
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
    safeSummary: config.safeSummary,
    nextUserAction: "ready_for_review",
    refIds: [
      input.policyResult.summary.artifactRef.id,
      exportPayload.exportRef.id,
    ],
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
  exportPayload: McpCoverLetterApplicationPackageExportPayloadV1,
): McpCoverLetterApplicationPackageExportCountsV1 {
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

function buildSafeCategories(
  config: ExportConfig,
): McpCoverLetterApplicationPackageExportCategoriesV1 {
  return {
    artifactKind: config.artifactKind,
    artifactStatus: "approved_for_preview",
    exportStatus: config.exportStatus,
    policyStatus: "export_download_policy_allowed",
    confirmationStatus: "confirmation_confirmed",
    freshnessStatus: "fresh_artifact_confirmed",
    retentionPolicyStatus: "retention_policy_satisfied",
    deletePolicyStatus: "delete_policy_satisfied",
    rollbackStatus: "rollback_available",
    visibilityCategory: "safe_summary_only",
    fileName: config.fileName,
    fileExtension: FILE_EXTENSION,
    mimeType: MIME_TYPE,
    nextUserAction: "ready_for_review",
    version: 1,
  };
}

function buildAuditEvent(
  input: ParsedInput,
  exportPayload: McpCoverLetterApplicationPackageExportPayloadV1,
  safeCounts: McpCoverLetterApplicationPackageExportCountsV1,
): McpCoverLetterApplicationPackageExportAuditEventV1 {
  return {
    kind: "mcp_cover_letter_application_package_export_audit_event",
    eventKind: "cover_letter_application_package_export_authorized",
    artifactKind: input.policyResult.summary.artifactKind,
    artifactRef: input.policyResult.summary.artifactRef,
    exportRef: exportPayload.exportRef,
    exportStatus: exportPayload.exportRef.status,
    policyStatus: "export_download_policy_allowed",
    safeCounts,
    redactedFlags: {
      rawDataExposed: false,
      fullContentRestricted: true,
      tokenOrIdentityExposed: false,
      persisted: false,
      version: 1,
    },
    occurredAt: input.exportRequest.requestedAt,
    persisted: false,
    version: 1,
  };
}

function buildExportRef(
  input: ParsedInput,
): McpCoverLetterApplicationPackageExportRefV1 {
  const config = EXPORT_CONFIG_BY_KIND[input.policyResult.summary.artifactKind];
  return {
    id: config.exportRefId,
    label: config.exportRefLabel,
    status: config.exportStatus,
    category: config.artifactKind,
    count: 1,
    updatedAt: input.exportRequest.requestedAt,
    version: 1,
  };
}

function buildComponentPayloads(
  summary: McpCoverLetterApplicationPackageExportSummaryV1,
): McpCoverLetterApplicationPackageExportSurfacePayloadsV1 {
  const config = EXPORT_CONFIG_BY_KIND[summary.artifactKind];
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
      { type: "text", text: config.contentSummary },
      { type: "text", text: "File body remains restricted." },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...shared,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: config.title,
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
  component: McpCoverLetterApplicationPackageExportSurfacePayloadsV1,
):
  | Readonly<{
      ok: true;
      surfaceStatus: McpCoverLetterApplicationPackageExportPolicyStatusV1;
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
    McpCoverLetterApplicationPackageExportSurfaceV1,
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
    McpCoverLetterApplicationPackageExportResultV1,
    { allowed: false }
  >["reason"],
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpCoverLetterApplicationPackageExportResultV1 {
  return {
    kind: "mcp_cover_letter_application_package_export_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpCoverLetterApplicationPackageExportSafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildCapabilities("blocked", "blocked", "blocked"),
    modelVisible: true,
    componentVisible: false,
    version: 1,
  };
}

function buildCapabilities(
  componentData: McpCoverLetterApplicationPackageExportCapabilitiesV1["componentData"],
  componentRendering: McpCoverLetterApplicationPackageExportCapabilitiesV1["componentRendering"],
  controlledLocalFileRepresentation: McpCoverLetterApplicationPackageExportCapabilitiesV1["controlledLocalFileRepresentation"],
): McpCoverLetterApplicationPackageExportCapabilitiesV1 {
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

function buildSummaryCapabilities(): McpCoverLetterApplicationPackageExportSummaryCapabilitiesV1 {
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
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1,
): McpGeneratedArtifactExportDownloadPolicyRefV1 | undefined {
  const record = readExactRecord(value, ARTIFACT_REF_KEYS, ARTIFACT_REF_KEYS);
  if (
    !record ||
    !isSafeArtifactRefId(record.id, artifactKind) ||
    record.label !== ARTIFACT_LABEL_BY_KIND[artifactKind] ||
    record.status !== "approved_for_preview" ||
    record.category !== artifactKind ||
    !isSafeCount(record.count) ||
    !readIsoTimestamp(record.updatedAt) ||
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
    updatedAt: record.updatedAt,
    version: 1,
  } as McpGeneratedArtifactExportDownloadPolicyRefV1;
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

function parsePolicySafeCategories(
  value: unknown,
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1,
): boolean {
  const record = readExactRecord(
    value,
    POLICY_SAFE_CATEGORIES_KEYS,
    POLICY_SAFE_CATEGORIES_KEYS,
  );
  return Boolean(
    record &&
      hasExactValues(record, {
        artifactKind,
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
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1,
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
        artifactKind,
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

function parseRevisionLineage(
  value: unknown,
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1,
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

function normalizeExportContent(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  return normalized.length > 0 ? `${normalized}\n` : "";
}

function isAllowedExportContent(value: string): boolean {
  const byteCount = utf8ByteLength(value);
  return (
    /\S/u.test(value) &&
    byteCount > 0 &&
    byteCount <= MAX_EXPORT_CONTENT_BYTES &&
    !UNSAFE_EXPORT_CONTENT_PATTERNS.some((pattern) => pattern.test(value))
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
    byteCount +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
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

function readArtifactKind(
  value: unknown,
): McpCoverLetterApplicationPackageExportArtifactKindV1 | undefined {
  return value === "cover_letter" || value === "application_package"
    ? value
    : undefined;
}

function isSafeArtifactRefId(
  value: unknown,
  artifactKind: McpCoverLetterApplicationPackageExportArtifactKindV1,
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
  return !/(?:raw|text|content|src|quote|private|never|token|secret|session|clerk|stytch|provider|userid|email|subject|doc|convex|downloadurl|signedurl|base64|blob|mime)/u.test(
    normalized,
  );
}

function isSafeSummaryText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /\S/u.test(value) &&
    value.length <= 500 &&
    !UNSAFE_EXPORT_CONTENT_PATTERNS.some((pattern) =>
      pattern.test(value.normalize("NFKC")),
    )
  );
}

function isSafeCount(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SAFE_COUNT;
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
  const artifactKind = readArtifactKind(expected.category);
  if (!artifactKind) return false;
  const record = readExactRecord(value, ARTIFACT_REF_KEYS, ARTIFACT_REF_KEYS);
  return Boolean(
    record &&
      record.id === expected.id &&
      record.label === expected.label &&
      record.status === expected.status &&
      record.category === artifactKind &&
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
