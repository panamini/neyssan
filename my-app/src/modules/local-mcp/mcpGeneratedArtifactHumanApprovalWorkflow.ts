import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";

export type McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1 =
  | "resume_variant"
  | "cover_letter"
  | "application_package";

export type McpGeneratedArtifactHumanApprovalWorkflowStatusV1 =
  | "human_review_required"
  | "approved_for_preview"
  | "rejected"
  | "edit_requested"
  | "blocked";

export type McpGeneratedArtifactHumanApprovalWorkflowDecisionV1 =
  | "approve_preview"
  | "reject_preview"
  | "request_edit";

export type McpGeneratedArtifactHumanApprovalWorkflowEditIntentV1 =
  | "shorter"
  | "more_formal"
  | "focus_on_requirements"
  | "preserve_never_use";

export type McpGeneratedArtifactHumanApprovalWorkflowActionLabelV1 =
  | "ready_for_review"
  | "review_blockers"
  | "review_pending_items";

export type McpGeneratedArtifactHumanApprovalWorkflowRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpGeneratedArtifactHumanApprovalWorkflowStatusV1;
  category: McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1;
  count: number;
  updatedAt: string;
  version: 1;
}>;

type McpGeneratedArtifactHumanApprovalWorkflowCountsV1 = Readonly<{
  artifacts: number;
  blockers: number;
  warnings: number;
  changedSections: number;
  redactedChangedSections: number;
  version: 1;
}>;

type McpGeneratedArtifactHumanApprovalWorkflowCategoriesV1 = Readonly<{
  artifactKind: McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1;
  workflowStatus: McpGeneratedArtifactHumanApprovalWorkflowStatusV1;
  decisionStatus: McpGeneratedArtifactHumanApprovalWorkflowStatusV1;
  editIntent?: McpGeneratedArtifactHumanApprovalWorkflowEditIntentV1;
  visibilityCategory: "safe_summary_only";
  nextUserAction: McpGeneratedArtifactHumanApprovalWorkflowActionLabelV1;
  version: 1;
}>;

export type McpGeneratedArtifactHumanApprovalWorkflowDiffReviewV1 = Readonly<{
  kind: "mcp_generated_artifact_human_approval_diff_review";
  artifactKind: McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1;
  artifactRef: McpGeneratedArtifactHumanApprovalWorkflowRefV1;
  decisionStatus: McpGeneratedArtifactHumanApprovalWorkflowStatusV1;
  safeCounts: McpGeneratedArtifactHumanApprovalWorkflowCountsV1;
  safeCategories: McpGeneratedArtifactHumanApprovalWorkflowCategoriesV1;
  nextUserAction: McpGeneratedArtifactHumanApprovalWorkflowActionLabelV1;
  version: 1;
}>;

export type McpGeneratedArtifactHumanApprovalWorkflowAuditEventV1 = Readonly<{
  kind: "mcp_generated_artifact_human_approval_audit_event";
  eventKind: "human_approval_decision_recorded";
  artifactKind: McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1;
  artifactRef: McpGeneratedArtifactHumanApprovalWorkflowRefV1;
  decision: McpGeneratedArtifactHumanApprovalWorkflowDecisionV1;
  safeCounts: McpGeneratedArtifactHumanApprovalWorkflowCountsV1;
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

export type McpGeneratedArtifactHumanApprovalWorkflowCapabilitiesV1 = Readonly<{
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

export type McpGeneratedArtifactHumanApprovalWorkflowSummaryCapabilitiesV1 =
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

export type McpGeneratedArtifactHumanApprovalWorkflowSummaryV1 = Readonly<{
  kind: "mcp_generated_artifact_human_approval_workflow_summary";
  allowed: true;
  artifactKind: McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1;
  artifactStatus: McpGeneratedArtifactHumanApprovalWorkflowStatusV1;
  workflowStatus: McpGeneratedArtifactHumanApprovalWorkflowStatusV1;
  decision: McpGeneratedArtifactHumanApprovalWorkflowDecisionV1;
  decisionStatus: McpGeneratedArtifactHumanApprovalWorkflowStatusV1;
  editIntent?: McpGeneratedArtifactHumanApprovalWorkflowEditIntentV1;
  artifactRef: McpGeneratedArtifactHumanApprovalWorkflowRefV1;
  visibilityCategory: "safe_summary_only";
  safeSummary: string;
  nextUserAction: McpGeneratedArtifactHumanApprovalWorkflowActionLabelV1;
  refIds: readonly string[];
  safeCounts: McpGeneratedArtifactHumanApprovalWorkflowCountsV1;
  safeCategories: McpGeneratedArtifactHumanApprovalWorkflowCategoriesV1;
  safeFlags: Readonly<{
    humanReviewRequired: boolean;
    approvedForPreview: boolean;
    approvedForExport: false;
    approvedForDownload: false;
    approvedForSend: false;
    approvedForSubmit: false;
    approvedForApply: false;
    fullContentRestricted: true;
    rawDataExposed: false;
    version: 1;
  }>;
  diffReview: McpGeneratedArtifactHumanApprovalWorkflowDiffReviewV1;
  auditEvent: McpGeneratedArtifactHumanApprovalWorkflowAuditEventV1;
  capabilities: McpGeneratedArtifactHumanApprovalWorkflowSummaryCapabilitiesV1;
  modelVisible: true;
  componentVisible: true;
  version: 1;
}>;

export type McpGeneratedArtifactHumanApprovalWorkflowSurfacePayloadsV1 =
  Readonly<{
    structuredContent: McpGeneratedArtifactHumanApprovalWorkflowSummaryV1;
    content: readonly Readonly<{ type: "text"; text: string }>[];
    meta: Record<string, unknown>;
    props: Record<string, unknown>;
    bridgePayload: Record<string, unknown>;
    stateSnapshot: Record<string, unknown>;
    modelContextUpdate: Record<string, unknown>;
    actionLabel: McpGeneratedArtifactHumanApprovalWorkflowActionLabelV1;
  }>;

export type McpGeneratedArtifactHumanApprovalWorkflowSafeRefusalV1 =
  Readonly<{
    kind: "local_mcp_component_data_policy_safe_error";
    code: "generated_artifact_human_approval_workflow_blocked";
    msg: "Refused. Generated artifact approval workflow blocked.";
    safeForModel: true;
    rawDataExposed: false;
    componentDataExposed: false;
    writeActionExecuted: false;
    version: 1;
  }>;

export type McpGeneratedArtifactHumanApprovalWorkflowResultV1 = Readonly<
  | {
      kind: "mcp_generated_artifact_human_approval_workflow_result";
      allowed: true;
      reason: "approval_workflow_projected";
      summary: McpGeneratedArtifactHumanApprovalWorkflowSummaryV1;
      component: McpGeneratedArtifactHumanApprovalWorkflowSurfacePayloadsV1;
      policy: McpGeneratedArtifactHumanApprovalWorkflowPolicyStatusV1;
      capabilities: McpGeneratedArtifactHumanApprovalWorkflowCapabilitiesV1;
      modelVisible: true;
      componentVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_generated_artifact_human_approval_workflow_result";
      allowed: false;
      reason: "invalid_input" | "policy_blocked";
      safeRefusal: McpGeneratedArtifactHumanApprovalWorkflowSafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpGeneratedArtifactHumanApprovalWorkflowCapabilitiesV1;
      modelVisible: true;
      componentVisible: false;
      version: 1;
    }
>;

type McpGeneratedArtifactHumanApprovalWorkflowPolicySurfaceV1 = Extract<
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

type McpGeneratedArtifactHumanApprovalWorkflowPolicyStatusV1 = Readonly<
  Record<McpGeneratedArtifactHumanApprovalWorkflowPolicySurfaceV1, "allowed">
>;

type PreviewStatusV1 =
  | "resume_variant_preview_created"
  | "cover_letter_preview_created"
  | "application_message_preview_created";

type ParsedArtifactContext = Readonly<{
  artifactKind: McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1;
  previewStatus: PreviewStatusV1;
  artifactRef: Readonly<{
    id: string;
    count: number;
    updatedAt: string;
  }>;
  safeCounts: Readonly<{
    artifacts: number;
    blockers: number;
    warnings: number;
    version: 1;
  }>;
}>;

type ParsedCurrentState = Readonly<{
  workflowStatus: "human_review_required";
}>;

type ParsedDecision = Readonly<{
  decision: McpGeneratedArtifactHumanApprovalWorkflowDecisionV1;
  editIntent?: McpGeneratedArtifactHumanApprovalWorkflowEditIntentV1;
  reviewedArtifactUpdatedAt: string;
}>;

type ParsedReviewSummary = Readonly<{
  changedSections: number;
  redactedChangedSections: number;
  blockers: number;
  warnings: number;
}>;

type ParsedInput = Readonly<{
  artifact: ParsedArtifactContext;
  currentState: ParsedCurrentState;
  decision: ParsedDecision;
  reviewSummary: ParsedReviewSummary;
  occurredAt: string;
}>;

type Transition = Readonly<{
  status: McpGeneratedArtifactHumanApprovalWorkflowStatusV1;
  nextUserAction: McpGeneratedArtifactHumanApprovalWorkflowActionLabelV1;
  safeSummary: string;
  humanReviewRequired: boolean;
  approvedForPreview: boolean;
}>;

type SurfacePayload = Readonly<{
  surface: McpGeneratedArtifactHumanApprovalWorkflowPolicySurfaceV1;
  payload: unknown;
}>;

const INPUT_KEYS = [
  "kind",
  "artifact",
  "currentState",
  "decision",
  "reviewSummary",
  "occurredAt",
  "version",
] as const;
const INPUT_REQUIRED_KEYS = INPUT_KEYS;

const ARTIFACT_KEYS = [
  "kind",
  "artifactKind",
  "artifactStatus",
  "previewStatus",
  "artifactRef",
  "safeCounts",
  "version",
] as const;
const ARTIFACT_REQUIRED_KEYS = ARTIFACT_KEYS;

const ARTIFACT_REF_KEYS = [
  "id",
  "label",
  "status",
  "category",
  "count",
  "updatedAt",
  "version",
] as const;

const CURRENT_STATE_KEYS = [
  "kind",
  "workflowStatus",
  "approvedForPreview",
  "approvedForExport",
  "approvedForDownload",
  "approvedForSend",
  "approvedForSubmit",
  "approvedForApply",
  "version",
] as const;

const DECISION_KEYS = [
  "kind",
  "actor",
  "decision",
  "approvalTarget",
  "reviewedArtifactUpdatedAt",
  "editIntent",
  "version",
] as const;
const DECISION_REQUIRED_KEYS = [
  "kind",
  "actor",
  "decision",
  "approvalTarget",
  "reviewedArtifactUpdatedAt",
  "version",
] as const;

const REVIEW_SUMMARY_KEYS = [
  "kind",
  "changedSections",
  "redactedChangedSections",
  "blockers",
  "warnings",
  "version",
] as const;

const SAFE_COUNTS_KEYS = [
  "artifacts",
  "blockers",
  "warnings",
  "version",
] as const;

const PREVIEW_STATUS_BY_ARTIFACT_KIND: Record<
  McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1,
  PreviewStatusV1
> = {
  resume_variant: "resume_variant_preview_created",
  cover_letter: "cover_letter_preview_created",
  application_package: "application_message_preview_created",
};

const ARTIFACT_REF_PREFIX_BY_KIND: Record<
  McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1,
  string
> = {
  resume_variant: "mcp-safe-ref:resume-variant:",
  cover_letter: "mcp-safe-ref:cover-letter:",
  application_package: "mcp-safe-ref:application-package:",
};

const ARTIFACT_LABEL_BY_KIND: Record<
  McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1,
  string
> = {
  resume_variant: "Resume variant artifact",
  cover_letter: "Cover letter artifact",
  application_package: "Application pkg artifact",
};

const MAX_SAFE_COUNT = 1000;
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

export function buildMcpGeneratedArtifactHumanApprovalWorkflow(
  input: unknown,
): McpGeneratedArtifactHumanApprovalWorkflowResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput) return deny("invalid_input");

  const summary = buildSummary(parsedInput);
  const component = buildComponentPayloads(summary);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_generated_artifact_human_approval_workflow_result",
    allowed: true,
    reason: "approval_workflow_projected",
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

export function buildMcpGeneratedArtifactHumanApprovalWorkflowSafeRefusal(): McpGeneratedArtifactHumanApprovalWorkflowSafeRefusalV1 {
  return {
    kind: "local_mcp_component_data_policy_safe_error",
    code: "generated_artifact_human_approval_workflow_blocked",
    msg: "Refused. Generated artifact approval workflow blocked.",
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
    record.kind !== "mcp_generated_artifact_human_approval_workflow_input" ||
    record.version !== 1
  ) {
    return undefined;
  }

  const artifact = parseArtifactContext(record.artifact);
  const currentState = parseCurrentState(record.currentState);
  const decision = parseDecision(record.decision);
  const reviewSummary = parseReviewSummary(record.reviewSummary);
  const occurredAt = readIsoTimestamp(record.occurredAt);

  if (!artifact || !currentState || !decision || !reviewSummary || !occurredAt) {
    return undefined;
  }
  if (decision.reviewedArtifactUpdatedAt !== artifact.artifactRef.updatedAt) {
    return undefined;
  }
  if (decision.decision === "approve_preview" && reviewSummary.blockers !== 0) {
    return undefined;
  }

  return { artifact, currentState, decision, reviewSummary, occurredAt };
}

function parseArtifactContext(value: unknown): ParsedArtifactContext | undefined {
  const record = readExactRecord(
    value,
    ARTIFACT_KEYS,
    ARTIFACT_REQUIRED_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_human_approval_artifact_context" ||
    record.artifactStatus !== "human_review_required" ||
    record.version !== 1
  ) {
    return undefined;
  }

  const artifactKind = readArtifactKind(record.artifactKind);
  if (!artifactKind) return undefined;
  const previewStatus = PREVIEW_STATUS_BY_ARTIFACT_KIND[artifactKind];
  if (record.previewStatus !== previewStatus) {
    return undefined;
  }

  const artifactRef = parseArtifactRef(record.artifactRef, artifactKind);
  const safeCounts = parseArtifactSafeCounts(record.safeCounts);
  if (!artifactRef || !safeCounts) return undefined;

  return {
    artifactKind,
    previewStatus,
    artifactRef,
    safeCounts,
  };
}

function parseArtifactRef(
  value: unknown,
  artifactKind: McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1,
): ParsedArtifactContext["artifactRef"] | undefined {
  const record = readExactRecord(
    value,
    ARTIFACT_REF_KEYS,
    ARTIFACT_REF_KEYS,
  );
  const updatedAt = record ? readIsoTimestamp(record.updatedAt) : undefined;
  if (
    !record ||
    !isSafeArtifactRefId(record.id, artifactKind) ||
    !isSafeText(record.label) ||
    record.status !== "human_review_required" ||
    record.category !== artifactKind ||
    !isSafeCount(record.count) ||
    !updatedAt ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    id: record.id,
    count: record.count,
    updatedAt,
  };
}

function parseArtifactSafeCounts(
  value: unknown,
): ParsedArtifactContext["safeCounts"] | undefined {
  const record = readExactRecord(value, SAFE_COUNTS_KEYS, SAFE_COUNTS_KEYS);
  if (
    !record ||
    !isSafeCount(record.artifacts) ||
    !isSafeCount(record.blockers) ||
    !isSafeCount(record.warnings) ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    artifacts: record.artifacts,
    blockers: record.blockers,
    warnings: record.warnings,
    version: 1,
  };
}

function parseCurrentState(value: unknown): ParsedCurrentState | undefined {
  const record = readExactRecord(
    value,
    CURRENT_STATE_KEYS,
    CURRENT_STATE_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_human_approval_state" ||
    record.workflowStatus !== "human_review_required" ||
    record.approvedForPreview !== false ||
    record.approvedForExport !== false ||
    record.approvedForDownload !== false ||
    record.approvedForSend !== false ||
    record.approvedForSubmit !== false ||
    record.approvedForApply !== false ||
    record.version !== 1
  ) {
    return undefined;
  }
  return { workflowStatus: "human_review_required" };
}

function parseDecision(value: unknown): ParsedDecision | undefined {
  const record = readExactRecord(value, DECISION_KEYS, DECISION_REQUIRED_KEYS);
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_human_approval_decision" ||
    record.actor !== "human_user" ||
    record.approvalTarget !== "preview_only" ||
    record.version !== 1
  ) {
    return undefined;
  }

  const decision = readDecision(record.decision);
  const reviewedArtifactUpdatedAt = readIsoTimestamp(
    record.reviewedArtifactUpdatedAt,
  );
  if (!decision || !reviewedArtifactUpdatedAt) return undefined;

  const editIntent = readOptionalEditIntent(record.editIntent);
  if (editIntent === false) return undefined;
  if (decision === "request_edit" && editIntent === undefined) return undefined;
  if (decision !== "request_edit" && editIntent !== undefined) return undefined;

  return {
    decision,
    ...(editIntent ? { editIntent } : {}),
    reviewedArtifactUpdatedAt,
  };
}

function parseReviewSummary(
  value: unknown,
): ParsedReviewSummary | undefined {
  const record = readExactRecord(
    value,
    REVIEW_SUMMARY_KEYS,
    REVIEW_SUMMARY_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_human_approval_review_summary_input" ||
    !isSafeCount(record.changedSections) ||
    !isSafeCount(record.redactedChangedSections) ||
    record.changedSections !== record.redactedChangedSections ||
    !isSafeCount(record.blockers) ||
    !isSafeCount(record.warnings) ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    changedSections: record.changedSections,
    redactedChangedSections: record.redactedChangedSections,
    blockers: record.blockers,
    warnings: record.warnings,
  };
}

function buildSummary(
  input: ParsedInput,
): McpGeneratedArtifactHumanApprovalWorkflowSummaryV1 {
  const transition = transitionForDecision(input.decision.decision);
  const artifactRef = buildArtifactRef(input.artifact, transition.status);
  const safeCounts = buildSafeCounts(input);
  const safeCategories = buildSafeCategories(input, transition);
  const diffReview = buildDiffReview(
    input.artifact.artifactKind,
    artifactRef,
    transition,
    safeCounts,
    safeCategories,
  );
  const auditEvent = buildAuditEvent(input, artifactRef, safeCounts);

  return {
    kind: "mcp_generated_artifact_human_approval_workflow_summary",
    allowed: true,
    artifactKind: input.artifact.artifactKind,
    artifactStatus: transition.status,
    workflowStatus: transition.status,
    decision: input.decision.decision,
    decisionStatus: transition.status,
    ...(input.decision.editIntent ? { editIntent: input.decision.editIntent } : {}),
    artifactRef,
    visibilityCategory: "safe_summary_only",
    safeSummary: transition.safeSummary,
    nextUserAction: transition.nextUserAction,
    refIds: [artifactRef.id],
    safeCounts,
    safeCategories,
    safeFlags: {
      humanReviewRequired: transition.humanReviewRequired,
      approvedForPreview: transition.approvedForPreview,
      approvedForExport: false,
      approvedForDownload: false,
      approvedForSend: false,
      approvedForSubmit: false,
      approvedForApply: false,
      fullContentRestricted: true,
      rawDataExposed: false,
      version: 1,
    },
    diffReview,
    auditEvent,
    capabilities: buildSummaryCapabilities(),
    modelVisible: true,
    componentVisible: true,
    version: 1,
  };
}

function buildArtifactRef(
  artifact: ParsedArtifactContext,
  status: McpGeneratedArtifactHumanApprovalWorkflowStatusV1,
): McpGeneratedArtifactHumanApprovalWorkflowRefV1 {
  return {
    id: artifact.artifactRef.id,
    label: ARTIFACT_LABEL_BY_KIND[artifact.artifactKind],
    status,
    category: artifact.artifactKind,
    count: artifact.artifactRef.count,
    updatedAt: artifact.artifactRef.updatedAt,
    version: 1,
  };
}

function buildSafeCounts(
  input: ParsedInput,
): McpGeneratedArtifactHumanApprovalWorkflowCountsV1 {
  return {
    artifacts: input.artifact.safeCounts.artifacts,
    blockers: input.reviewSummary.blockers,
    warnings: input.reviewSummary.warnings,
    changedSections: input.reviewSummary.changedSections,
    redactedChangedSections: input.reviewSummary.redactedChangedSections,
    version: 1,
  };
}

function buildSafeCategories(
  input: ParsedInput,
  transition: Transition,
): McpGeneratedArtifactHumanApprovalWorkflowCategoriesV1 {
  return {
    artifactKind: input.artifact.artifactKind,
    workflowStatus: transition.status,
    decisionStatus: transition.status,
    ...(input.decision.editIntent ? { editIntent: input.decision.editIntent } : {}),
    visibilityCategory: "safe_summary_only",
    nextUserAction: transition.nextUserAction,
    version: 1,
  };
}

function buildDiffReview(
  artifactKind: McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1,
  artifactRef: McpGeneratedArtifactHumanApprovalWorkflowRefV1,
  transition: Transition,
  safeCounts: McpGeneratedArtifactHumanApprovalWorkflowCountsV1,
  safeCategories: McpGeneratedArtifactHumanApprovalWorkflowCategoriesV1,
): McpGeneratedArtifactHumanApprovalWorkflowDiffReviewV1 {
  return {
    kind: "mcp_generated_artifact_human_approval_diff_review",
    artifactKind,
    artifactRef,
    decisionStatus: transition.status,
    safeCounts,
    safeCategories,
    nextUserAction: transition.nextUserAction,
    version: 1,
  };
}

function buildAuditEvent(
  input: ParsedInput,
  artifactRef: McpGeneratedArtifactHumanApprovalWorkflowRefV1,
  safeCounts: McpGeneratedArtifactHumanApprovalWorkflowCountsV1,
): McpGeneratedArtifactHumanApprovalWorkflowAuditEventV1 {
  return {
    kind: "mcp_generated_artifact_human_approval_audit_event",
    eventKind: "human_approval_decision_recorded",
    artifactKind: input.artifact.artifactKind,
    artifactRef,
    decision: input.decision.decision,
    safeCounts,
    redactedFlags: {
      rawDataExposed: false,
      fullContentRestricted: true,
      tokenOrIdentityExposed: false,
      persisted: false,
      version: 1,
    },
    occurredAt: input.occurredAt,
    persisted: false,
    version: 1,
  };
}

function buildComponentPayloads(
  summary: McpGeneratedArtifactHumanApprovalWorkflowSummaryV1,
): McpGeneratedArtifactHumanApprovalWorkflowSurfacePayloadsV1 {
  const shared = {
    artifactKind: summary.artifactKind,
    artifactStatus: summary.artifactStatus,
    workflowStatus: summary.workflowStatus,
    decision: summary.decision,
    decisionStatus: summary.decisionStatus,
    ...(summary.editIntent ? { editIntent: summary.editIntent } : {}),
    artifactRef: summary.artifactRef,
    visibilityCategory: summary.visibilityCategory,
    nextUserAction: summary.nextUserAction,
    refIds: summary.refIds,
    safeCounts: summary.safeCounts,
    safeCategories: summary.safeCategories,
    safeFlags: summary.safeFlags,
    diffReview: summary.diffReview,
    auditEvent: summary.auditEvent,
    capabilities: summary.capabilities,
    modelVisible: true,
    componentVisible: true,
    version: 1,
  } as const;

  return {
    structuredContent: summary,
    content: [
      {
        type: "text",
        text: "Generated artifact approval summary is safe.",
      },
      { type: "text", text: actionText(summary.nextUserAction) },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...shared,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: "Generated artifact approval",
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
  component: McpGeneratedArtifactHumanApprovalWorkflowSurfacePayloadsV1,
):
  | Readonly<{
      ok: true;
      surfaceStatus: McpGeneratedArtifactHumanApprovalWorkflowPolicyStatusV1;
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
    McpGeneratedArtifactHumanApprovalWorkflowPolicySurfaceV1,
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

function transitionForDecision(
  decision: McpGeneratedArtifactHumanApprovalWorkflowDecisionV1,
): Transition {
  switch (decision) {
    case "approve_preview":
      return {
        status: "approved_for_preview",
        nextUserAction: "ready_for_review",
        safeSummary: "Preview approval recorded. Full content remains restricted.",
        humanReviewRequired: false,
        approvedForPreview: true,
      };
    case "reject_preview":
      return {
        status: "rejected",
        nextUserAction: "review_blockers",
        safeSummary: "Preview rejected. No product action executed.",
        humanReviewRequired: false,
        approvedForPreview: false,
      };
    case "request_edit":
      return {
        status: "edit_requested",
        nextUserAction: "review_pending_items",
        safeSummary: "Edit request recorded as safe category only.",
        humanReviewRequired: true,
        approvedForPreview: false,
      };
  }
}

function actionText(
  actionLabel: McpGeneratedArtifactHumanApprovalWorkflowActionLabelV1,
): string {
  switch (actionLabel) {
    case "ready_for_review":
      return "Next action: review ready state.";
    case "review_blockers":
      return "Next action: review blockers.";
    case "review_pending_items":
      return "Next action: review pending items.";
  }
}

function buildCapabilities(
  generatedArtifactBoundary: McpGeneratedArtifactHumanApprovalWorkflowCapabilitiesV1["generatedArtifactBoundary"],
  componentData: McpGeneratedArtifactHumanApprovalWorkflowCapabilitiesV1["componentData"],
  componentRendering: McpGeneratedArtifactHumanApprovalWorkflowCapabilitiesV1["componentRendering"],
): McpGeneratedArtifactHumanApprovalWorkflowCapabilitiesV1 {
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

function buildSummaryCapabilities(): McpGeneratedArtifactHumanApprovalWorkflowSummaryCapabilitiesV1 {
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

function deny(
  reason: "invalid_input" | "policy_blocked",
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpGeneratedArtifactHumanApprovalWorkflowResultV1 {
  return {
    kind: "mcp_generated_artifact_human_approval_workflow_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpGeneratedArtifactHumanApprovalWorkflowSafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildCapabilities("blocked", "blocked", "blocked"),
    modelVisible: true,
    componentVisible: false,
    version: 1,
  };
}

function readArtifactKind(
  value: unknown,
): McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1 | undefined {
  return value === "resume_variant" ||
    value === "cover_letter" ||
    value === "application_package"
    ? value
    : undefined;
}

function readDecision(
  value: unknown,
): McpGeneratedArtifactHumanApprovalWorkflowDecisionV1 | undefined {
  return value === "approve_preview" ||
    value === "reject_preview" ||
    value === "request_edit"
    ? value
    : undefined;
}

function readOptionalEditIntent(
  value: unknown,
): McpGeneratedArtifactHumanApprovalWorkflowEditIntentV1 | undefined | false {
  if (value === undefined) return undefined;
  return value === "shorter" ||
    value === "more_formal" ||
    value === "focus_on_requirements" ||
    value === "preserve_never_use"
    ? value
    : false;
}

function isSafeArtifactRefId(
  value: unknown,
  artifactKind: McpGeneratedArtifactHumanApprovalWorkflowArtifactKindV1,
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
    value.length <= 120 &&
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
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    return Object.getOwnPropertyDescriptors(value);
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
