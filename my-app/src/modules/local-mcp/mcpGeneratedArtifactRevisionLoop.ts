import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";
import {
  buildMcpGeneratedArtifactBoundary,
  buildMcpGeneratedArtifactBoundarySafeRefusal,
  type McpGeneratedArtifactRefV1,
  type McpGeneratedArtifactRestrictedArtifactV1,
  type McpGeneratedArtifactRetentionCategoryV1,
  type McpGeneratedArtifactStatusV1,
  type McpGeneratedArtifactSummaryCapabilitiesV1,
} from "./mcpGeneratedArtifactBoundary";
import type {
  McpGeneratedArtifactHumanApprovalWorkflowEditIntentV1,
} from "./mcpGeneratedArtifactHumanApprovalWorkflow";

export type McpGeneratedArtifactRevisionLoopArtifactKindV1 =
  | "resume_variant"
  | "cover_letter"
  | "application_package";

export type McpGeneratedArtifactRevisionLoopIntentV1 =
  McpGeneratedArtifactHumanApprovalWorkflowEditIntentV1;

type McpGeneratedArtifactRevisionLoopStatusV1 =
  | "revision_created"
  | "blocked";

type McpGeneratedArtifactRevisionLoopCreatedStatusV1 = Extract<
  McpGeneratedArtifactRevisionLoopStatusV1,
  "revision_created"
>;

export type McpGeneratedArtifactRevisionLoopActionLabelV1 =
  | "ready_for_review"
  | "review_blockers"
  | "review_pending_items";

export type McpGeneratedArtifactRevisionLoopAuditEventV1 = Readonly<{
  kind: "mcp_generated_artifact_revision_audit_event";
  eventKind: "artifact_revision_created";
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1;
  previousArtifactRef: McpGeneratedArtifactRevisionLoopRefV1;
  newArtifactRevisionRef: McpGeneratedArtifactRefV1;
  revisionIntent: McpGeneratedArtifactRevisionLoopIntentV1;
  revisionStatus: McpGeneratedArtifactRevisionLoopCreatedStatusV1;
  safeCounts: McpGeneratedArtifactRevisionLoopCountsV1;
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

export type McpGeneratedArtifactRevisionLoopSummaryV1 = Readonly<{
  kind: "mcp_generated_artifact_revision_loop_summary";
  allowed: true;
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1;
  artifactStatus: McpGeneratedArtifactStatusV1;
  revisionStatus: McpGeneratedArtifactRevisionLoopCreatedStatusV1;
  revisionIntent: McpGeneratedArtifactRevisionLoopIntentV1;
  previousArtifactRef: McpGeneratedArtifactRevisionLoopRefV1;
  newArtifactRevisionRef: McpGeneratedArtifactRefV1;
  artifactRef: McpGeneratedArtifactRefV1;
  visibilityCategory: "safe_summary_only";
  retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
  safeSummary: string;
  nextUserAction: McpGeneratedArtifactRevisionLoopActionLabelV1;
  refIds: readonly string[];
  safeCounts: McpGeneratedArtifactRevisionLoopCountsV1;
  safeCategories: McpGeneratedArtifactRevisionLoopCategoriesV1;
  safeFlags: Readonly<{
    humanReviewRequired: true;
    approvedForPreview: false;
    approvedForExport: false;
    approvedForDownload: false;
    approvedForSend: false;
    approvedForSubmit: false;
    approvedForApply: false;
    fullContentRestricted: true;
    retentionPending: boolean;
    rawDataExposed: false;
    version: 1;
  }>;
  revisionAuditEvent: McpGeneratedArtifactRevisionLoopAuditEventV1;
  capabilities: McpGeneratedArtifactSummaryCapabilitiesV1;
  modelVisible: true;
  componentVisible: true;
  version: 1;
}>;

export type McpGeneratedArtifactRevisionLoopSurfacePayloadsV1 = Readonly<{
  structuredContent: McpGeneratedArtifactRevisionLoopSummaryV1;
  content: readonly Readonly<{ type: "text"; text: string }>[];
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
  bridgePayload: Record<string, unknown>;
  stateSnapshot: Record<string, unknown>;
  modelContextUpdate: Record<string, unknown>;
  actionLabel: McpGeneratedArtifactRevisionLoopActionLabelV1;
}>;

export type McpGeneratedArtifactRevisionLoopCapabilitiesV1 = Readonly<{
  generatedArtifactBoundary:
    | "pr68_generated_artifact_boundary_checked"
    | "blocked";
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

export type McpGeneratedArtifactRevisionLoopSafeRefusalV1 = Readonly<{
  kind: "local_mcp_component_data_policy_safe_error";
  code: "generated_artifact_revision_loop_blocked";
  msg: "Refused. Generated artifact revision loop blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpGeneratedArtifactRevisionLoopResultV1 = Readonly<
  | {
      kind: "mcp_generated_artifact_revision_loop_result";
      allowed: true;
      reason: "artifact_revision_created";
      summary: McpGeneratedArtifactRevisionLoopSummaryV1;
      component: McpGeneratedArtifactRevisionLoopSurfacePayloadsV1;
      policy: McpGeneratedArtifactRevisionLoopPolicyStatusV1;
      capabilities: McpGeneratedArtifactRevisionLoopCapabilitiesV1;
      modelVisible: true;
      componentVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_generated_artifact_revision_loop_result";
      allowed: false;
      reason: "invalid_input" | "artifact_boundary_blocked" | "policy_blocked";
      safeRefusal: McpGeneratedArtifactRevisionLoopSafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpGeneratedArtifactRevisionLoopCapabilitiesV1;
      modelVisible: true;
      componentVisible: false;
      version: 1;
    }
>;

type McpGeneratedArtifactRevisionLoopPolicySurfaceV1 = Extract<
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

type McpGeneratedArtifactRevisionLoopPolicyStatusV1 = Readonly<
  Record<McpGeneratedArtifactRevisionLoopPolicySurfaceV1, "allowed">
>;

type McpGeneratedArtifactRevisionLoopRefV1 = Readonly<{
  id: string;
  label: string;
  status: "edit_requested";
  category: McpGeneratedArtifactRevisionLoopArtifactKindV1;
  count: number;
  updatedAt: string;
  version: 1;
}>;

type McpGeneratedArtifactRevisionLoopCountsV1 = Readonly<{
  artifacts: number;
  artifactTextBlockers: number;
  blockers: number;
  warnings: number;
  changedSections: number;
  redactedChangedSections: number;
  revisionIndex: number;
  revisionCount: number;
  version: 1;
}>;

type McpGeneratedArtifactRevisionLoopCategoriesV1 = Readonly<{
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1;
  artifactStatus: McpGeneratedArtifactStatusV1;
  revisionStatus: "revision_created";
  revisionIntent: McpGeneratedArtifactRevisionLoopIntentV1;
  visibilityCategory: "safe_summary_only";
  retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
  nextUserAction: McpGeneratedArtifactRevisionLoopActionLabelV1;
  version: 1;
}>;

type ParsedRevisionRequest = Readonly<{
  revisionIntent: McpGeneratedArtifactRevisionLoopIntentV1;
  reviewedArtifactUpdatedAt: string;
  occurredAt: string;
}>;

type ParsedRevisionState = Readonly<{
  previousArtifactRef: McpGeneratedArtifactRevisionLoopRefV1;
  previousRevisionCount: number;
  expectedNextRevisionIndex: number;
  revisionLineage: readonly string[];
}>;

type ParsedEditRequestState = Readonly<{
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1;
  editIntent: McpGeneratedArtifactRevisionLoopIntentV1;
  artifactRef: McpGeneratedArtifactRevisionLoopRefV1;
  safeCounts: Readonly<{
    artifacts: number;
    blockers: number;
    warnings: number;
    changedSections: number;
    redactedChangedSections: number;
    version: 1;
  }>;
}>;

type ParsedInput = Readonly<{
  editRequestState: ParsedEditRequestState;
  revisionRequest: ParsedRevisionRequest;
  revisionState: ParsedRevisionState;
}>;

type SurfacePayload = Readonly<{
  surface: McpGeneratedArtifactRevisionLoopPolicySurfaceV1;
  payload: unknown;
}>;

const INPUT_KEYS = [
  "kind",
  "editRequestState",
  "revisionRequest",
  "revisionState",
  "version",
] as const;
const INPUT_REQUIRED_KEYS = INPUT_KEYS;

const REVISION_REQUEST_KEYS = [
  "kind",
  "mode",
  "revisionIntent",
  "revisionTarget",
  "reviewedArtifactUpdatedAt",
  "occurredAt",
  "version",
] as const;

const REVISION_STATE_KEYS = [
  "kind",
  "previousArtifactRef",
  "previousRevisionCount",
  "expectedNextRevisionIndex",
  "revisionLineage",
  "version",
] as const;

const EDIT_REQUEST_STATE_KEYS = [
  "kind",
  "allowed",
  "artifactKind",
  "artifactStatus",
  "workflowStatus",
  "decision",
  "decisionStatus",
  "editIntent",
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
  "editIntent",
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
  McpGeneratedArtifactRevisionLoopArtifactKindV1,
  string
> = {
  resume_variant: "mcp-safe-ref:resume-variant:",
  cover_letter: "mcp-safe-ref:cover-letter:",
  application_package: "mcp-safe-ref:application-package:",
};

const ARTIFACT_LABEL_BY_KIND: Record<
  McpGeneratedArtifactRevisionLoopArtifactKindV1,
  string
> = {
  resume_variant: "Resume variant artifact",
  cover_letter: "Cover letter artifact",
  application_package: "Application pkg artifact",
};

const MAX_SAFE_COUNT = 1000;
const MAX_REVISION_COUNT = 25;
const REVISED_ARTIFACT_BODY =
  "Artifact revision draft. Human review required before any use. Export, download, send, submit, and apply remain blocked.";
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
];

export function buildMcpGeneratedArtifactRevisionLoop(
  input: unknown,
): McpGeneratedArtifactRevisionLoopResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput) return deny("invalid_input");

  const restrictedArtifact = buildRestrictedRevisionArtifact(parsedInput);
  if (!restrictedArtifact) return deny("artifact_boundary_blocked");

  const artifactBoundary = buildMcpGeneratedArtifactBoundary({
    kind: "mcp_generated_artifact_boundary_input",
    artifact: restrictedArtifact,
    version: 1,
  });
  if (!artifactBoundary.allowed) {
    return deny("artifact_boundary_blocked");
  }

  const summary = buildRevisionSummary(parsedInput, artifactBoundary.summary);
  const component = buildComponentPayloads(summary);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_generated_artifact_revision_loop_result",
    allowed: true,
    reason: "artifact_revision_created",
    summary,
    component,
    policy: policy.surfaceStatus,
    capabilities: buildCapabilities(
      "pr68_generated_artifact_boundary_checked",
      "policy_checked",
      "view_model_only",
    ),
    modelVisible: true,
    componentVisible: true,
    version: 1,
  };
}

export function buildMcpGeneratedArtifactRevisionLoopSafeRefusal(): McpGeneratedArtifactRevisionLoopSafeRefusalV1 {
  return {
    kind: "local_mcp_component_data_policy_safe_error",
    code: "generated_artifact_revision_loop_blocked",
    msg: "Refused. Generated artifact revision loop blocked.",
    safeForModel: true,
    rawDataExposed: false,
    componentDataExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseInput(input: unknown): ParsedInput | undefined {
  const record = readExactRecord(input, INPUT_KEYS, INPUT_REQUIRED_KEYS);
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_revision_loop_input" ||
    record.version !== 1
  ) {
    return undefined;
  }

  const editRequestState = parseEditRequestState(record.editRequestState);
  const revisionRequest = parseRevisionRequest(record.revisionRequest);
  const revisionState = editRequestState
    ? parseRevisionState(record.revisionState, editRequestState)
    : undefined;
  if (!editRequestState || !revisionRequest || !revisionState) return undefined;

  if (revisionRequest.revisionIntent !== editRequestState.editIntent) {
    return undefined;
  }
  if (
    revisionRequest.reviewedArtifactUpdatedAt !==
    editRequestState.artifactRef.updatedAt
  ) {
    return undefined;
  }
  if (
    revisionState.previousArtifactRef.id !== editRequestState.artifactRef.id ||
    revisionState.previousArtifactRef.updatedAt !==
      editRequestState.artifactRef.updatedAt
  ) {
    return undefined;
  }
  if (
    Date.parse(revisionRequest.occurredAt) <
    Date.parse(revisionRequest.reviewedArtifactUpdatedAt)
  ) {
    return undefined;
  }

  return { editRequestState, revisionRequest, revisionState };
}

function parseEditRequestState(
  value: unknown,
): ParsedEditRequestState | undefined {
  const record = readExactRecord(
    value,
    EDIT_REQUEST_STATE_KEYS,
    EDIT_REQUEST_STATE_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_human_approval_workflow_summary" ||
    record.allowed !== true ||
    record.artifactStatus !== "edit_requested" ||
    record.workflowStatus !== "edit_requested" ||
    record.decision !== "request_edit" ||
    record.decisionStatus !== "edit_requested" ||
    record.visibilityCategory !== "safe_summary_only" ||
    record.nextUserAction !== "review_pending_items" ||
    record.modelVisible !== true ||
    record.componentVisible !== true ||
    record.version !== 1 ||
    !isSafeText(record.safeSummary)
  ) {
    return undefined;
  }

  const artifactKind = readArtifactKind(record.artifactKind);
  const editIntent = readRevisionIntent(record.editIntent);
  if (!artifactKind || !editIntent) return undefined;

  const artifactRef = parseEditRequestedRef(record.artifactRef, artifactKind);
  const safeCounts = parseEditRequestSafeCounts(record.safeCounts);
  if (!artifactRef || !safeCounts) return undefined;

  if (
    !parseEditRequestSafeCategories(
      record.safeCategories,
      artifactKind,
      editIntent,
    ) ||
    !parseEditRequestSafeFlags(record.safeFlags) ||
    !parseEditRequestDiffReview(record.diffReview, artifactKind, artifactRef) ||
    !parseEditRequestAuditEvent(
      record.auditEvent,
      artifactKind,
      artifactRef,
      safeCounts,
    ) ||
    !parseSummaryCapabilities(record.capabilities) ||
    !hasExactRefIds(record.refIds, [artifactRef.id])
  ) {
    return undefined;
  }

  return {
    artifactKind,
    editIntent,
    artifactRef,
    safeCounts,
  };
}

function parseRevisionRequest(
  value: unknown,
): ParsedRevisionRequest | undefined {
  const record = readExactRecord(
    value,
    REVISION_REQUEST_KEYS,
    REVISION_REQUEST_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_revision_request" ||
    record.mode !== "deterministic_local_revision" ||
    record.revisionTarget !== "preview_only" ||
    record.version !== 1
  ) {
    return undefined;
  }

  const revisionIntent = readRevisionIntent(record.revisionIntent);
  const reviewedArtifactUpdatedAt = readIsoTimestamp(
    record.reviewedArtifactUpdatedAt,
  );
  const occurredAt = readIsoTimestamp(record.occurredAt);
  if (!revisionIntent || !reviewedArtifactUpdatedAt || !occurredAt) {
    return undefined;
  }

  return { revisionIntent, reviewedArtifactUpdatedAt, occurredAt };
}

function parseRevisionState(
  value: unknown,
  editRequestState: ParsedEditRequestState,
): ParsedRevisionState | undefined {
  const record = readExactRecord(
    value,
    REVISION_STATE_KEYS,
    REVISION_STATE_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_revision_state" ||
    record.version !== 1 ||
    !isRevisionCount(record.previousRevisionCount) ||
    !isRevisionCount(record.expectedNextRevisionIndex)
  ) {
    return undefined;
  }

  const previousArtifactRef = parseEditRequestedRef(
    record.previousArtifactRef,
    editRequestState.artifactKind,
  );
  const revisionLineage = parseRevisionLineage(record.revisionLineage);
  if (!previousArtifactRef || !revisionLineage) return undefined;

  const previousRevisionCount = record.previousRevisionCount;
  const expectedNextRevisionIndex = record.expectedNextRevisionIndex;
  if (
    expectedNextRevisionIndex !== previousRevisionCount + 1 ||
    revisionLineage.length !== previousRevisionCount + 1 ||
    revisionLineage[revisionLineage.length - 1] !== previousArtifactRef.id ||
    previousArtifactRef.id !== editRequestState.artifactRef.id ||
    !revisionLineage.every((refId) =>
      isSafeArtifactRefId(refId, editRequestState.artifactKind),
    )
  ) {
    return undefined;
  }

  return {
    previousArtifactRef,
    previousRevisionCount,
    expectedNextRevisionIndex,
    revisionLineage,
  };
}

function parseEditRequestedRef(
  value: unknown,
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1,
): McpGeneratedArtifactRevisionLoopRefV1 | undefined {
  const record = readExactRecord(value, ARTIFACT_REF_KEYS, ARTIFACT_REF_KEYS);
  if (
    !record ||
    !isSafeArtifactRefId(record.id, artifactKind) ||
    record.label !== ARTIFACT_LABEL_BY_KIND[artifactKind] ||
    record.status !== "edit_requested" ||
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
    status: "edit_requested",
    category: artifactKind,
    count: record.count,
    updatedAt: record.updatedAt,
    version: 1,
  };
}

function parseEditRequestSafeCounts(
  value: unknown,
): ParsedEditRequestState["safeCounts"] | undefined {
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

function parseEditRequestSafeCategories(
  value: unknown,
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1,
  editIntent: McpGeneratedArtifactRevisionLoopIntentV1,
): boolean {
  const record = readExactRecord(
    value,
    SAFE_CATEGORIES_KEYS,
    SAFE_CATEGORIES_KEYS,
  );
  return Boolean(
    record &&
      record.artifactKind === artifactKind &&
      record.workflowStatus === "edit_requested" &&
      record.decisionStatus === "edit_requested" &&
      record.editIntent === editIntent &&
      record.visibilityCategory === "safe_summary_only" &&
      record.nextUserAction === "review_pending_items" &&
      record.version === 1,
  );
}

function parseEditRequestSafeFlags(value: unknown): boolean {
  const record = readExactRecord(value, SAFE_FLAGS_KEYS, SAFE_FLAGS_KEYS);
  return Boolean(
    record &&
      record.humanReviewRequired === true &&
      record.approvedForPreview === false &&
      record.approvedForExport === false &&
      record.approvedForDownload === false &&
      record.approvedForSend === false &&
      record.approvedForSubmit === false &&
      record.approvedForApply === false &&
      record.fullContentRestricted === true &&
      record.rawDataExposed === false &&
      record.version === 1,
  );
}

function parseEditRequestDiffReview(
  value: unknown,
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1,
  artifactRef: McpGeneratedArtifactRevisionLoopRefV1,
): boolean {
  const record = readExactRecord(value, DIFF_REVIEW_KEYS, DIFF_REVIEW_KEYS);
  return Boolean(
    record &&
      record.kind === "mcp_generated_artifact_human_approval_diff_review" &&
      record.artifactKind === artifactKind &&
      isSameEditRequestedRef(record.artifactRef, artifactRef) &&
      record.decisionStatus === "edit_requested" &&
      record.nextUserAction === "review_pending_items" &&
      record.version === 1,
  );
}

function parseEditRequestAuditEvent(
  value: unknown,
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1,
  artifactRef: McpGeneratedArtifactRevisionLoopRefV1,
  safeCounts: ParsedEditRequestState["safeCounts"],
): boolean {
  const record = readExactRecord(value, AUDIT_EVENT_KEYS, AUDIT_EVENT_KEYS);
  return Boolean(
    record &&
      record.kind === "mcp_generated_artifact_human_approval_audit_event" &&
      record.eventKind === "human_approval_decision_recorded" &&
      record.artifactKind === artifactKind &&
      record.decision === "request_edit" &&
      isSameEditRequestedRef(record.artifactRef, artifactRef) &&
      parseRedactedFlags(record.redactedFlags) &&
      readIsoTimestamp(record.occurredAt) &&
      record.persisted === false &&
      record.version === 1 &&
      isSameSafeCounts(record.safeCounts, safeCounts),
  );
}

function parseRedactedFlags(value: unknown): boolean {
  const record = readExactRecord(value, REDACTED_FLAGS_KEYS, REDACTED_FLAGS_KEYS);
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
  return Boolean(
    record &&
      record.dataReads === "blocked" &&
      record.dataWrites === "blocked" &&
      record.handlerExecution === "blocked" &&
      record.productionConnector === "blocked" &&
      record.networkAccess === "blocked" &&
      record.modelCalls === "blocked" &&
      record.writeActions === "blocked" &&
      record.exportActions === "blocked" &&
      record.rawDataProjection === "blocked" &&
      record.credentialStorage === "none" &&
      record.tokenStorage === "none" &&
      record.version === 1,
  );
}

function parseRevisionLineage(value: unknown): readonly string[] | undefined {
  if (!isArrayValue(value) || value.length === 0 || value.length > MAX_REVISION_COUNT + 1) {
    return undefined;
  }
  if (!value.every((item): item is string => typeof item === "string")) {
    return undefined;
  }
  return [...value];
}

function buildRestrictedRevisionArtifact(
  input: ParsedInput,
): McpGeneratedArtifactRestrictedArtifactV1 | undefined {
  const revisionCount = input.revisionState.expectedNextRevisionIndex;
  const revisionRefId = buildRevisionRefId(
    input.editRequestState.artifactKind,
    input.revisionState.previousArtifactRef.id,
    revisionCount,
  );
  if (
    !revisionRefId ||
    !isSafeArtifactRefId(revisionRefId, input.editRequestState.artifactKind)
  ) {
    return undefined;
  }

  return {
    kind: "mcp_generated_artifact_restricted_artifact",
    artifactKind: input.editRequestState.artifactKind,
    artifactStatus: "human_review_required",
    artifactRef: {
      id: revisionRefId,
      label: ARTIFACT_LABEL_BY_KIND[input.editRequestState.artifactKind],
      status: "human_review_required",
      category: input.editRequestState.artifactKind,
      count: revisionCount,
      updatedAt: input.revisionRequest.occurredAt,
      version: 1,
    },
    visibilityCategory: "restricted_full_content",
    retentionCategory: "retention_pending",
    fullContent: REVISED_ARTIFACT_BODY,
    review: {
      humanReviewRequired: true,
      approvedForPreview: false,
      blockers: 0,
      warnings: input.editRequestState.safeCounts.warnings,
      version: 1,
    },
    version: 1,
  };
}

function buildRevisionSummary(
  input: ParsedInput,
  artifactSummary: Readonly<{
    artifactRef: McpGeneratedArtifactRefV1;
    artifactStatus: McpGeneratedArtifactStatusV1;
    retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
    capabilities: McpGeneratedArtifactSummaryCapabilitiesV1;
  }>,
): McpGeneratedArtifactRevisionLoopSummaryV1 {
  const safeCounts = buildSafeCounts(input);
  const safeCategories = buildSafeCategories(input, artifactSummary);
  const revisionAuditEvent = buildRevisionAuditEvent(
    input,
    artifactSummary.artifactRef,
    safeCounts,
  );
  const refIds = [
    ...input.revisionState.revisionLineage,
    artifactSummary.artifactRef.id,
  ];

  return {
    kind: "mcp_generated_artifact_revision_loop_summary",
    allowed: true,
    artifactKind: input.editRequestState.artifactKind,
    artifactStatus: artifactSummary.artifactStatus,
    revisionStatus: "revision_created",
    revisionIntent: input.revisionRequest.revisionIntent,
    previousArtifactRef: input.revisionState.previousArtifactRef,
    newArtifactRevisionRef: artifactSummary.artifactRef,
    artifactRef: artifactSummary.artifactRef,
    visibilityCategory: "safe_summary_only",
    retentionCategory: artifactSummary.retentionCategory,
    safeSummary: "Artifact revision created. Full content is restricted.",
    nextUserAction: "review_pending_items",
    refIds,
    safeCounts,
    safeCategories,
    safeFlags: {
      humanReviewRequired: true,
      approvedForPreview: false,
      approvedForExport: false,
      approvedForDownload: false,
      approvedForSend: false,
      approvedForSubmit: false,
      approvedForApply: false,
      fullContentRestricted: true,
      retentionPending: artifactSummary.retentionCategory === "retention_pending",
      rawDataExposed: false,
      version: 1,
    },
    revisionAuditEvent,
    capabilities: artifactSummary.capabilities,
    modelVisible: true,
    componentVisible: true,
    version: 1,
  };
}

function buildSafeCounts(
  input: ParsedInput,
): McpGeneratedArtifactRevisionLoopCountsV1 {
  return {
    artifacts: 1,
    artifactTextBlockers: 0,
    blockers: input.editRequestState.safeCounts.blockers,
    warnings: input.editRequestState.safeCounts.warnings,
    changedSections: input.editRequestState.safeCounts.changedSections,
    redactedChangedSections: input.editRequestState.safeCounts.redactedChangedSections,
    revisionIndex: input.revisionState.expectedNextRevisionIndex,
    revisionCount: input.revisionState.previousRevisionCount + 1,
    version: 1,
  };
}

function buildSafeCategories(
  input: ParsedInput,
  artifactSummary: Readonly<{
    artifactStatus: McpGeneratedArtifactStatusV1;
    retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
  }>,
): McpGeneratedArtifactRevisionLoopCategoriesV1 {
  return {
    artifactKind: input.editRequestState.artifactKind,
    artifactStatus: artifactSummary.artifactStatus,
    revisionStatus: "revision_created",
    revisionIntent: input.revisionRequest.revisionIntent,
    visibilityCategory: "safe_summary_only",
    retentionCategory: artifactSummary.retentionCategory,
    nextUserAction: "review_pending_items",
    version: 1,
  };
}

function buildRevisionAuditEvent(
  input: ParsedInput,
  newArtifactRevisionRef: McpGeneratedArtifactRefV1,
  safeCounts: McpGeneratedArtifactRevisionLoopCountsV1,
): McpGeneratedArtifactRevisionLoopAuditEventV1 {
  return {
    kind: "mcp_generated_artifact_revision_audit_event",
    eventKind: "artifact_revision_created",
    artifactKind: input.editRequestState.artifactKind,
    previousArtifactRef: input.revisionState.previousArtifactRef,
    newArtifactRevisionRef,
    revisionIntent: input.revisionRequest.revisionIntent,
    revisionStatus: "revision_created",
    safeCounts,
    redactedFlags: {
      rawDataExposed: false,
      fullContentRestricted: true,
      tokenOrIdentityExposed: false,
      persisted: false,
      version: 1,
    },
    occurredAt: input.revisionRequest.occurredAt,
    persisted: false,
    version: 1,
  };
}

function buildComponentPayloads(
  summary: McpGeneratedArtifactRevisionLoopSummaryV1,
): McpGeneratedArtifactRevisionLoopSurfacePayloadsV1 {
  const shared = {
    artifactKind: summary.artifactKind,
    artifactStatus: summary.artifactStatus,
    revisionStatus: summary.revisionStatus,
    revisionIntent: summary.revisionIntent,
    previousArtifactRef: summary.previousArtifactRef,
    newArtifactRevisionRef: summary.newArtifactRevisionRef,
    artifactRef: summary.artifactRef,
    visibilityCategory: summary.visibilityCategory,
    retentionCategory: summary.retentionCategory,
    nextUserAction: summary.nextUserAction,
    refIds: summary.refIds,
    safeCounts: summary.safeCounts,
    safeCategories: summary.safeCategories,
    safeFlags: summary.safeFlags,
    revisionAuditEvent: summary.revisionAuditEvent,
    capabilities: summary.capabilities,
    modelVisible: true,
    componentVisible: true,
    version: 1,
  } as const;

  return {
    structuredContent: summary,
    content: [
      { type: "text", text: "Artifact revision summary is safe." },
      { type: "text", text: "Next action: review pending items." },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...shared,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: "Artifact revision",
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
  component: McpGeneratedArtifactRevisionLoopSurfacePayloadsV1,
):
  | Readonly<{
      ok: true;
      surfaceStatus: McpGeneratedArtifactRevisionLoopPolicyStatusV1;
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
    McpGeneratedArtifactRevisionLoopPolicySurfaceV1,
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
    McpGeneratedArtifactRevisionLoopResultV1,
    { allowed: false }
  >["reason"],
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpGeneratedArtifactRevisionLoopResultV1 {
  return {
    kind: "mcp_generated_artifact_revision_loop_result",
    allowed: false,
    reason,
    safeRefusal:
      reason === "artifact_boundary_blocked"
        ? buildMcpGeneratedArtifactRevisionLoopSafeRefusalFromArtifactBoundary()
        : buildMcpGeneratedArtifactRevisionLoopSafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildCapabilities("blocked", "blocked", "blocked"),
    modelVisible: true,
    componentVisible: false,
    version: 1,
  };
}

function buildMcpGeneratedArtifactRevisionLoopSafeRefusalFromArtifactBoundary(): McpGeneratedArtifactRevisionLoopSafeRefusalV1 {
  const refusal = buildMcpGeneratedArtifactBoundarySafeRefusal();
  return {
    kind: refusal.kind,
    code: "generated_artifact_revision_loop_blocked",
    msg: "Refused. Generated artifact revision loop blocked.",
    safeForModel: refusal.safeForModel,
    rawDataExposed: refusal.rawDataExposed,
    componentDataExposed: refusal.componentDataExposed,
    writeActionExecuted: refusal.writeActionExecuted,
    version: 1,
  };
}

function buildCapabilities(
  generatedArtifactBoundary: McpGeneratedArtifactRevisionLoopCapabilitiesV1["generatedArtifactBoundary"],
  componentData: McpGeneratedArtifactRevisionLoopCapabilitiesV1["componentData"],
  componentRendering: McpGeneratedArtifactRevisionLoopCapabilitiesV1["componentRendering"],
): McpGeneratedArtifactRevisionLoopCapabilitiesV1 {
  return {
    generatedArtifactBoundary,
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

function buildRevisionRefId(
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1,
  previousRefId: string,
  revisionCount: number,
): string | undefined {
  const prefix = ARTIFACT_REF_PREFIX_BY_KIND[artifactKind];
  if (!previousRefId.startsWith(prefix)) return undefined;
  const tail = previousRefId.slice(prefix.length);
  const nextTail = `${tail}:revision-${revisionCount}`;
  return nextTail.length <= 64 ? `${prefix}${nextTail}` : undefined;
}

function readArtifactKind(
  value: unknown,
): McpGeneratedArtifactRevisionLoopArtifactKindV1 | undefined {
  return value === "resume_variant" ||
    value === "cover_letter" ||
    value === "application_package"
    ? value
    : undefined;
}

function readRevisionIntent(
  value: unknown,
): McpGeneratedArtifactRevisionLoopIntentV1 | undefined {
  return value === "shorter" ||
    value === "more_formal" ||
    value === "focus_on_requirements" ||
    value === "preserve_never_use"
    ? value
    : undefined;
}

function isSafeArtifactRefId(
  value: unknown,
  artifactKind: McpGeneratedArtifactRevisionLoopArtifactKindV1,
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
  return !/(?:raw|text|content|src|quote|private|never|token|secret|session|clerk|stytch|provider|userid|email|subject|doc|convex)/u.test(
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
  return Number.isInteger(value) && value >= 0 && value <= MAX_SAFE_COUNT;
}

function isRevisionCount(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0 && value <= MAX_REVISION_COUNT;
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

function isSameEditRequestedRef(
  value: unknown,
  expected: McpGeneratedArtifactRevisionLoopRefV1,
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

function isSameSafeCounts(
  value: unknown,
  expected: ParsedEditRequestState["safeCounts"],
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
