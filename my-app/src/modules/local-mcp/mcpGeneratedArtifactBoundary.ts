import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";

export type McpGeneratedArtifactKindV1 =
  | "resume_variant"
  | "cover_letter"
  | "application_package"
  | "review_notes";

export type McpGeneratedArtifactStatusV1 =
  | "draft_created"
  | "preview_required"
  | "human_review_required"
  | "approved_for_preview"
  | "blocked"
  | "retention_pending"
  | "redacted";

export type McpGeneratedArtifactVisibilityCategoryV1 =
  | "restricted_full_content"
  | "safe_summary_only";

export type McpGeneratedArtifactRetentionCategoryV1 =
  | "retention_pending"
  | "redacted"
  | "restricted_full_content";

export type McpGeneratedArtifactActionLabelV1 =
  | "ready_for_review"
  | "review_blockers"
  | "review_pending_items";

export type McpGeneratedArtifactRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpGeneratedArtifactStatusV1;
  category: McpGeneratedArtifactKindV1;
  count: number;
  updatedAt?: string;
  version: 1;
}>;

export type McpGeneratedArtifactReviewFlagsV1 = Readonly<{
  humanReviewRequired: boolean;
  approvedForPreview: boolean;
  blockers: number;
  warnings: number;
  version: 1;
}>;

export type McpGeneratedArtifactRestrictedArtifactV1 = Readonly<{
  kind: "mcp_generated_artifact_restricted_artifact";
  artifactKind: McpGeneratedArtifactKindV1;
  artifactStatus: McpGeneratedArtifactStatusV1;
  artifactRef: McpGeneratedArtifactRefV1;
  visibilityCategory: "restricted_full_content";
  retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
  fullContent: string;
  review: McpGeneratedArtifactReviewFlagsV1;
  version: 1;
}>;

export type McpGeneratedArtifactSafeSummaryV1 = Readonly<{
  kind: "mcp_generated_artifact_boundary_summary";
  allowed: true;
  artifactKind: McpGeneratedArtifactKindV1;
  artifactStatus: McpGeneratedArtifactStatusV1;
  artifactRef: McpGeneratedArtifactRefV1;
  status: McpGeneratedArtifactStatusV1;
  category: McpGeneratedArtifactKindV1;
  visibilityCategory: "safe_summary_only";
  retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
  safeSummary: string;
  nextUserAction: McpGeneratedArtifactActionLabelV1;
  refIds: readonly string[];
  safeCounts: Readonly<{
    artifacts: number;
    artifactTextBlockers: number;
    blockers: number;
    warnings: number;
    version: 1;
  }>;
  safeCategories: Readonly<{
    artifactKind: McpGeneratedArtifactKindV1;
    artifactStatus: McpGeneratedArtifactStatusV1;
    visibilityCategory: "safe_summary_only";
    retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
    nextUserAction: McpGeneratedArtifactActionLabelV1;
    version: 1;
  }>;
  safeFlags: Readonly<{
    humanReviewRequired: boolean;
    approvedForPreview: boolean;
    fullContentRestricted: true;
    retentionPending: boolean;
    rawDataExposed: false;
    version: 1;
  }>;
  capabilities: McpGeneratedArtifactSummaryCapabilitiesV1;
  modelVisible: true;
  componentVisible: true;
  version: 1;
}>;

export type McpGeneratedArtifactSummaryCapabilitiesV1 = Readonly<{
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

export type McpGeneratedArtifactSurfacePayloadsV1 = Readonly<{
  structuredContent: McpGeneratedArtifactSafeSummaryV1;
  content: readonly Readonly<{ type: "text"; text: string }>[];
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
  bridgePayload: Record<string, unknown>;
  stateSnapshot: Record<string, unknown>;
  modelContextUpdate: Record<string, unknown>;
  actionLabel: McpGeneratedArtifactActionLabelV1;
}>;

export type McpGeneratedArtifactBoundaryCapabilitiesV1 = Readonly<{
  componentData: "policy_checked" | "blocked";
  componentRendering: "view_model_only" | "blocked";
  componentRuntime: "blocked";
  uiBridgeRuntime: "blocked";
  toolCalls: "blocked";
  modelContextRuntime: "blocked";
  dataReads: "blocked";
  dataWrites: "blocked";
  exportActions: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  rawDataProjection: "blocked";
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

export type McpGeneratedArtifactBoundarySafeRefusalV1 = Readonly<{
  kind: "local_mcp_component_data_policy_safe_error";
  code: "generated_artifact_boundary_blocked";
  msg: "Refused. Generated artifact boundary blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpGeneratedArtifactBoundaryResultV1 = Readonly<
  | {
      kind: "mcp_generated_artifact_boundary_result";
      allowed: true;
      reason: "safe_generated_artifact_summary_projected";
      summary: McpGeneratedArtifactSafeSummaryV1;
      component: McpGeneratedArtifactSurfacePayloadsV1;
      policy: McpGeneratedArtifactPolicyStatusV1;
      capabilities: McpGeneratedArtifactBoundaryCapabilitiesV1;
      modelVisible: true;
      componentVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_generated_artifact_boundary_result";
      allowed: false;
      reason: "invalid_input" | "policy_blocked";
      safeRefusal: McpGeneratedArtifactBoundarySafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpGeneratedArtifactBoundaryCapabilitiesV1;
      modelVisible: true;
      componentVisible: false;
      version: 1;
    }
>;

type McpGeneratedArtifactPolicySurfaceV1 = Extract<
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

type McpGeneratedArtifactPolicyStatusV1 = Readonly<
  Record<McpGeneratedArtifactPolicySurfaceV1, "allowed">
>;

type SurfacePayload = Readonly<{
  surface: McpGeneratedArtifactPolicySurfaceV1;
  payload: unknown;
}>;

type RestrictedArtifactParts = Readonly<{
  artifactKind: McpGeneratedArtifactKindV1;
  artifactStatus: McpGeneratedArtifactStatusV1;
  artifactRef: McpGeneratedArtifactRefV1;
  retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
  fullContent: string;
  review: McpGeneratedArtifactReviewFlagsV1;
}>;

type ArtifactRefFields = Readonly<{
  id: string;
  label: string;
  count: number;
  updatedAt?: string;
}>;

const INPUT_KEYS = ["kind", "artifact", "version"] as const;
const INPUT_REQUIRED_KEYS = ["kind", "artifact", "version"] as const;

const ARTIFACT_KEYS = [
  "kind",
  "artifactKind",
  "artifactStatus",
  "artifactRef",
  "visibilityCategory",
  "retentionCategory",
  "fullContent",
  "review",
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

const ARTIFACT_REF_REQUIRED_KEYS = [
  "id",
  "label",
  "status",
  "category",
  "count",
  "version",
] as const;

const REVIEW_KEYS = [
  "humanReviewRequired",
  "approvedForPreview",
  "blockers",
  "warnings",
  "version",
] as const;

const ARTIFACT_KINDS: readonly McpGeneratedArtifactKindV1[] = [
  "resume_variant",
  "cover_letter",
  "application_package",
  "review_notes",
];

const ARTIFACT_STATUSES: readonly McpGeneratedArtifactStatusV1[] = [
  "draft_created",
  "preview_required",
  "human_review_required",
  "approved_for_preview",
  "blocked",
  "retention_pending",
  "redacted",
];

const RETENTION_CATEGORIES: readonly McpGeneratedArtifactRetentionCategoryV1[] =
  ["retention_pending", "redacted", "restricted_full_content"];

const ARTIFACT_REF_PREFIX_BY_KIND: Record<McpGeneratedArtifactKindV1, string> =
  {
    resume_variant: "mcp-safe-ref:resume-variant:",
    cover_letter: "mcp-safe-ref:cover-letter:",
    application_package: "mcp-safe-ref:application-package:",
    review_notes: "mcp-safe-ref:review-notes:",
  };

const MAX_SAFE_LABEL_LENGTH = 80;
const MAX_FULL_CONTENT_LENGTH = 50_000;
const MAX_SAFE_COUNT = 1000;

const UNSAFE_RESTRICTED_CONTENT_PATTERNS: readonly RegExp[] = [
  /RAW_(?:(?:CV|RESUME|JOB|PROPOSAL|APPLICATION|COVER_LETTER)(?:_TEXT)?|SOURCE_DOCUMENT)_SENTINEL_DO_NOT_EXPOSE/u,
  /SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE/u,
  /PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE/u,
  /NEVER_USE_SENTINEL_DO_NOT_EXPOSE/u,
  /GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE/u,
  /SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE/u,
  /SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE/u,
  /\bBearer\s+[A-Za-z0-9._-]+/u,
  /\b(?:accessToken|refreshToken|rawClaims)\b/u,
  /\b(?:raw[_ -]?(?:cv|resume|job|proposal|application|cover[_ -]?letter|text)|source[_ -]?quote|source[_ -]?text|private[_ -]?fact|never[_ -]?use)\b/iu,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /\b(?:clerk|stytch|provider|session|user)[_-][a-z0-9._:-]+/iu,
  /\bj97convexdocumentid\b/iu,
];

export function buildMcpGeneratedArtifactBoundary(
  input: unknown,
): McpGeneratedArtifactBoundaryResultV1 {
  const artifact = parseInput(input);
  if (!artifact) return deny("invalid_input");

  const summary = buildSafeSummary(artifact);
  const component = buildComponentPayloads(summary);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_generated_artifact_boundary_result",
    allowed: true,
    reason: "safe_generated_artifact_summary_projected",
    summary,
    component,
    policy: policy.surfaceStatus,
    capabilities: buildBoundaryCapabilities(
      "policy_checked",
      "view_model_only",
    ),
    modelVisible: true,
    componentVisible: true,
    version: 1,
  };
}

export function buildMcpGeneratedArtifactBoundarySafeRefusal(): McpGeneratedArtifactBoundarySafeRefusalV1 {
  return {
    kind: "local_mcp_component_data_policy_safe_error",
    code: "generated_artifact_boundary_blocked",
    msg: "Refused. Generated artifact boundary blocked.",
    safeForModel: true,
    rawDataExposed: false,
    componentDataExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseInput(
  input: unknown,
): McpGeneratedArtifactRestrictedArtifactV1 | undefined {
  const record = readExactRecord(input, INPUT_KEYS, INPUT_REQUIRED_KEYS);
  if (
    !record ||
    record.kind !== "mcp_generated_artifact_boundary_input" ||
    record.version !== 1
  ) {
    return undefined;
  }
  return parseRestrictedArtifact(record.artifact);
}

function parseRestrictedArtifact(
  value: unknown,
): McpGeneratedArtifactRestrictedArtifactV1 | undefined {
  const record = readExactRecord(value, ARTIFACT_KEYS, ARTIFACT_REQUIRED_KEYS);
  if (!isRestrictedArtifactEnvelope(record)) return undefined;
  const parts = readRestrictedArtifactParts(record);
  if (!parts) return undefined;

  return {
    kind: "mcp_generated_artifact_restricted_artifact",
    artifactKind: parts.artifactKind,
    artifactStatus: parts.artifactStatus,
    artifactRef: parts.artifactRef,
    visibilityCategory: "restricted_full_content",
    retentionCategory: parts.retentionCategory,
    fullContent: parts.fullContent,
    review: parts.review,
    version: 1,
  };
}

function isRestrictedArtifactEnvelope(
  record: Record<string, unknown> | undefined,
): record is Record<string, unknown> {
  return Boolean(
    record &&
      record.kind === "mcp_generated_artifact_restricted_artifact" &&
      record.visibilityCategory === "restricted_full_content" &&
      record.version === 1,
  );
}

function readRestrictedArtifactParts(
  record: Record<string, unknown>,
): RestrictedArtifactParts | undefined {
  const artifactKind = readArtifactKind(record.artifactKind);
  const artifactStatus = readArtifactStatus(record.artifactStatus);
  if (!artifactKind || !artifactStatus) return undefined;

  const artifactRef = parseArtifactRef(
    record.artifactRef,
    artifactKind,
    artifactStatus,
  );
  const retentionCategory = readRetentionCategory(record.retentionCategory);
  const review = parseReviewFlags(record.review);
  if (!artifactRef || !retentionCategory || !review) return undefined;
  if (!isRestrictedFullContent(record.fullContent)) return undefined;
  if (!isReviewStateConsistent(artifactStatus, review)) return undefined;

  return {
    artifactKind,
    artifactStatus,
    artifactRef,
    retentionCategory,
    fullContent: record.fullContent,
    review,
  };
}

function parseArtifactRef(
  value: unknown,
  artifactKind: McpGeneratedArtifactKindV1,
  artifactStatus: McpGeneratedArtifactStatusV1,
): McpGeneratedArtifactRefV1 | undefined {
  const record = readExactRecord(
    value,
    ARTIFACT_REF_KEYS,
    ARTIFACT_REF_REQUIRED_KEYS,
  );
  if (!record) return undefined;
  const fields = readArtifactRefFields(record, artifactKind, artifactStatus);
  if (!fields) return undefined;
  return {
    id: fields.id,
    label: artifactLabelForKind(artifactKind),
    status: artifactStatus,
    category: artifactKind,
    count: fields.count,
    ...(fields.updatedAt ? { updatedAt: fields.updatedAt } : {}),
    version: 1,
  };
}

function readArtifactRefFields(
  record: Record<string, unknown>,
  artifactKind: McpGeneratedArtifactKindV1,
  artifactStatus: McpGeneratedArtifactStatusV1,
): ArtifactRefFields | undefined {
  const updatedAt = readOptionalIsoUtcTimestamp(record.updatedAt);
  if (updatedAt === false) return undefined;
  if (!hasValidArtifactRefFields(record, artifactKind, artifactStatus)) {
    return undefined;
  }
  return {
    id: record.id as string,
    label: artifactLabelForKind(artifactKind),
    count: record.count as number,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function hasValidArtifactRefFields(
  record: Record<string, unknown>,
  artifactKind: McpGeneratedArtifactKindV1,
  artifactStatus: McpGeneratedArtifactStatusV1,
): boolean {
  return [
    isSafeArtifactRefId(record.id, artifactKind),
    isSafeLabel(record.label),
    record.status === artifactStatus,
    record.category === artifactKind,
    isSafeCount(record.count),
    record.version === 1,
  ].every(Boolean);
}

function artifactLabelForKind(kind: McpGeneratedArtifactKindV1): string {
  switch (kind) {
    case "resume_variant":
      return "Resume variant artifact";
    case "cover_letter":
      return "Cover letter artifact";
    case "application_package":
      return "Application package artifact";
    case "review_notes":
      return "Review notes artifact";
  }
}

function parseReviewFlags(
  value: unknown,
): McpGeneratedArtifactReviewFlagsV1 | undefined {
  const record = readExactRecord(value, REVIEW_KEYS, REVIEW_KEYS);
  if (
    !record ||
    typeof record.humanReviewRequired !== "boolean" ||
    typeof record.approvedForPreview !== "boolean" ||
    !isSafeCount(record.blockers) ||
    !isSafeCount(record.warnings) ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    humanReviewRequired: record.humanReviewRequired,
    approvedForPreview: record.approvedForPreview,
    blockers: record.blockers,
    warnings: record.warnings,
    version: 1,
  };
}

function buildSafeSummary(
  artifact: McpGeneratedArtifactRestrictedArtifactV1,
): McpGeneratedArtifactSafeSummaryV1 {
  const nextUserAction = actionForStatus(artifact.artifactStatus);
  return {
    kind: "mcp_generated_artifact_boundary_summary",
    allowed: true,
    artifactKind: artifact.artifactKind,
    artifactStatus: artifact.artifactStatus,
    artifactRef: artifact.artifactRef,
    status: artifact.artifactStatus,
    category: artifact.artifactKind,
    visibilityCategory: "safe_summary_only",
    retentionCategory: artifact.retentionCategory,
    safeSummary:
      "Generated artifact boundary accepted. Full content is restricted.",
    nextUserAction,
    refIds: [artifact.artifactRef.id],
    safeCounts: {
      artifacts: 1,
      artifactTextBlockers: artifact.review.blockers,
      blockers: artifact.review.blockers,
      warnings: artifact.review.warnings,
      version: 1,
    },
    safeCategories: {
      artifactKind: artifact.artifactKind,
      artifactStatus: artifact.artifactStatus,
      visibilityCategory: "safe_summary_only",
      retentionCategory: artifact.retentionCategory,
      nextUserAction,
      version: 1,
    },
    safeFlags: {
      humanReviewRequired: artifact.review.humanReviewRequired,
      approvedForPreview: artifact.review.approvedForPreview,
      fullContentRestricted: true,
      retentionPending: artifact.retentionCategory === "retention_pending",
      rawDataExposed: false,
      version: 1,
    },
    capabilities: buildSummaryCapabilities(),
    modelVisible: true,
    componentVisible: true,
    version: 1,
  };
}

function buildComponentPayloads(
  summary: McpGeneratedArtifactSafeSummaryV1,
): McpGeneratedArtifactSurfacePayloadsV1 {
  const shared = {
    artifactKind: summary.artifactKind,
    artifactStatus: summary.artifactStatus,
    artifactRef: summary.artifactRef,
    status: summary.status,
    category: summary.category,
    visibilityCategory: summary.visibilityCategory,
    retentionCategory: summary.retentionCategory,
    nextUserAction: summary.nextUserAction,
    refIds: summary.refIds,
    safeCounts: summary.safeCounts,
    safeCategories: summary.safeCategories,
    safeFlags: summary.safeFlags,
    capabilities: summary.capabilities,
    modelVisible: true,
    componentVisible: true,
    version: 1,
  } as const;
  return {
    structuredContent: summary,
    content: [
      { type: "text", text: "Generated artifact summary is safe." },
      { type: "text", text: actionText(summary.nextUserAction) },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...shared,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: "Generated artifact",
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
  component: McpGeneratedArtifactSurfacePayloadsV1,
):
  | Readonly<{
      ok: true;
      surfaceStatus: McpGeneratedArtifactPolicyStatusV1;
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
    McpGeneratedArtifactPolicySurfaceV1,
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

function buildSummaryCapabilities(): McpGeneratedArtifactSummaryCapabilitiesV1 {
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

function buildBoundaryCapabilities(
  componentData: McpGeneratedArtifactBoundaryCapabilitiesV1["componentData"],
  componentRendering: McpGeneratedArtifactBoundaryCapabilitiesV1["componentRendering"],
): McpGeneratedArtifactBoundaryCapabilitiesV1 {
  return {
    componentData,
    componentRendering,
    componentRuntime: "blocked",
    uiBridgeRuntime: "blocked",
    toolCalls: "blocked",
    modelContextRuntime: "blocked",
    dataReads: "blocked",
    dataWrites: "blocked",
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

function actionForStatus(
  status: McpGeneratedArtifactStatusV1,
): McpGeneratedArtifactActionLabelV1 {
  if (status === "approved_for_preview" || status === "redacted") {
    return "ready_for_review";
  }
  if (status === "blocked") return "review_blockers";
  return "review_pending_items";
}

function actionText(actionLabel: McpGeneratedArtifactActionLabelV1): string {
  switch (actionLabel) {
    case "ready_for_review":
      return "Next action: review ready state.";
    case "review_blockers":
      return "Next action: review blockers.";
    case "review_pending_items":
      return "Next action: review pending items.";
  }
}

function deny(
  reason: "invalid_input" | "policy_blocked",
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpGeneratedArtifactBoundaryResultV1 {
  return {
    kind: "mcp_generated_artifact_boundary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpGeneratedArtifactBoundarySafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildBoundaryCapabilities("blocked", "blocked"),
    modelVisible: true,
    componentVisible: false,
    version: 1,
  };
}

function readArtifactKind(
  value: unknown,
): McpGeneratedArtifactKindV1 | undefined {
  return typeof value === "string" &&
    (ARTIFACT_KINDS as readonly string[]).includes(value)
    ? (value as McpGeneratedArtifactKindV1)
    : undefined;
}

function readArtifactStatus(
  value: unknown,
): McpGeneratedArtifactStatusV1 | undefined {
  return typeof value === "string" &&
    (ARTIFACT_STATUSES as readonly string[]).includes(value)
    ? (value as McpGeneratedArtifactStatusV1)
    : undefined;
}

function readRetentionCategory(
  value: unknown,
): McpGeneratedArtifactRetentionCategoryV1 | undefined {
  return typeof value === "string" &&
    (RETENTION_CATEGORIES as readonly string[]).includes(value)
    ? (value as McpGeneratedArtifactRetentionCategoryV1)
    : undefined;
}

function isReviewStateConsistent(
  status: McpGeneratedArtifactStatusV1,
  review: McpGeneratedArtifactReviewFlagsV1,
): boolean {
  if (status === "approved_for_preview") {
    return review.approvedForPreview && !review.humanReviewRequired;
  }
  if (status === "redacted") {
    return !review.approvedForPreview;
  }
  if (status === "draft_created" || status === "preview_required") {
    return review.humanReviewRequired && !review.approvedForPreview;
  }
  return !review.approvedForPreview;
}

function isRestrictedFullContent(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_FULL_CONTENT_LENGTH &&
    !UNSAFE_RESTRICTED_CONTENT_PATTERNS.some((pattern) => pattern.test(value))
  );
}

function isSafeArtifactRefId(
  value: unknown,
  artifactKind: McpGeneratedArtifactKindV1,
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
  return !/(?:raw|text|content|source|quote|private|never|token|secret|session|clerk|stytch|provider|userid|email|subject|document|convex)/u.test(
    normalized,
  );
}

function isSafeLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /\S/u.test(value) &&
    value.length <= MAX_SAFE_LABEL_LENGTH &&
    !UNSAFE_RESTRICTED_CONTENT_PATTERNS.some((pattern) => pattern.test(value))
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

function readOptionalIsoUtcTimestamp(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return isStrictIsoUtcTimestamp(value) ? value : false;
}

function isStrictIsoUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
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
