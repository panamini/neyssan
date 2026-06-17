import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";
import {
  buildMcpGeneratedArtifactBoundary,
  buildMcpGeneratedArtifactBoundarySafeRefusal,
  type McpGeneratedArtifactActionLabelV1,
  type McpGeneratedArtifactKindV1,
  type McpGeneratedArtifactRefV1,
  type McpGeneratedArtifactRestrictedArtifactV1,
  type McpGeneratedArtifactRetentionCategoryV1,
  type McpGeneratedArtifactStatusV1,
  type McpGeneratedArtifactSummaryCapabilitiesV1,
} from "./mcpGeneratedArtifactBoundary";

export type McpCoverLetterApplicationMessagePreviewStatusV1 =
  | "cover_letter_preview_created"
  | "application_message_preview_created"
  | "blocked";

type McpCoverLetterApplicationMessagePreviewModeV1 =
  "deterministic_local_preview";

type McpCoverLetterApplicationMessagePreviewIntentV1 =
  | "cover_letter_preview"
  | "application_message_preview";

type McpCoverLetterApplicationMessagePreviewArtifactKindV1 = Extract<
  McpGeneratedArtifactKindV1,
  "cover_letter" | "application_package"
>;

type McpCoverLetterApplicationMessagePreviewSourceRefsV1 = Readonly<{
  applicationPackageRef: string;
  evidenceGraphRef: string;
  reviewCockpitRef: string;
  version: 1;
}>;

type McpCoverLetterApplicationMessagePreviewSafePlanV1 = Readonly<{
  kind: "mcp_cover_letter_application_message_preview_safe_plan";
  planStatus: "ready_for_review" | "needs_review";
  targetArtifactKind: McpCoverLetterApplicationMessagePreviewArtifactKindV1;
  tailoringCompleteness: "complete" | "partial";
  allowedClaims: number;
  sourceFacts: number;
  evidenceMatches: number;
  blockers: 0;
  warnings: number;
  version: 1;
}>;

export type McpCoverLetterApplicationMessagePreviewSummaryV1 = Readonly<{
  kind: "mcp_cover_letter_application_message_preview_summary";
  allowed: true;
  artifactKind: McpCoverLetterApplicationMessagePreviewArtifactKindV1;
  artifactStatus: McpGeneratedArtifactStatusV1;
  previewStatus: McpCoverLetterApplicationMessagePreviewStatusV1;
  artifactRef: McpGeneratedArtifactRefV1;
  status: McpGeneratedArtifactStatusV1;
  category: McpCoverLetterApplicationMessagePreviewArtifactKindV1;
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
    allowedClaims: number;
    sourceFacts: number;
    evidenceMatches: number;
    version: 1;
  }>;
  safeCategories: Readonly<{
    artifactKind: McpCoverLetterApplicationMessagePreviewArtifactKindV1;
    artifactStatus: McpGeneratedArtifactStatusV1;
    previewStatus: McpCoverLetterApplicationMessagePreviewStatusV1;
    visibilityCategory: "safe_summary_only";
    retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
    nextUserAction: McpGeneratedArtifactActionLabelV1;
    version: 1;
  }>;
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
  capabilities: McpGeneratedArtifactSummaryCapabilitiesV1;
  modelVisible: true;
  componentVisible: true;
  version: 1;
}>;

export type McpCoverLetterApplicationMessagePreviewSurfacePayloadsV1 =
  Readonly<{
    structuredContent: McpCoverLetterApplicationMessagePreviewSummaryV1;
    content: readonly Readonly<{ type: "text"; text: string }>[];
    meta: Record<string, unknown>;
    props: Record<string, unknown>;
    bridgePayload: Record<string, unknown>;
    stateSnapshot: Record<string, unknown>;
    modelContextUpdate: Record<string, unknown>;
    actionLabel: McpGeneratedArtifactActionLabelV1;
  }>;

export type McpCoverLetterApplicationMessagePreviewCapabilitiesV1 =
  Readonly<{
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

export type McpCoverLetterApplicationMessagePreviewSafeRefusalV1 =
  Readonly<{
    kind: "local_mcp_component_data_policy_safe_error";
    code: "cover_letter_application_message_preview_blocked";
    msg: "Refused. Cover letter/application message preview blocked.";
    safeForModel: true;
    rawDataExposed: false;
    componentDataExposed: false;
    writeActionExecuted: false;
    version: 1;
  }>;

export type McpCoverLetterApplicationMessagePreviewResultV1 = Readonly<
  | {
      kind: "mcp_cover_letter_application_message_preview_result";
      allowed: true;
      reason:
        | "cover_letter_preview_created"
        | "application_message_preview_created";
      summary: McpCoverLetterApplicationMessagePreviewSummaryV1;
      component: McpCoverLetterApplicationMessagePreviewSurfacePayloadsV1;
      policy: McpCoverLetterApplicationMessagePreviewPolicyStatusV1;
      capabilities: McpCoverLetterApplicationMessagePreviewCapabilitiesV1;
      modelVisible: true;
      componentVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_cover_letter_application_message_preview_result";
      allowed: false;
      reason:
        | "invalid_input"
        | "generation_blocked"
        | "artifact_boundary_blocked"
        | "policy_blocked";
      safeRefusal: McpCoverLetterApplicationMessagePreviewSafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpCoverLetterApplicationMessagePreviewCapabilitiesV1;
      modelVisible: true;
      componentVisible: false;
      version: 1;
    }
>;

type McpCoverLetterApplicationMessagePreviewPolicySurfaceV1 = Extract<
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

type McpCoverLetterApplicationMessagePreviewPolicyStatusV1 = Readonly<
  Record<McpCoverLetterApplicationMessagePreviewPolicySurfaceV1, "allowed">
>;

type ParsedInput = Readonly<{
  generationRequest: Readonly<{
    mode: McpCoverLetterApplicationMessagePreviewModeV1;
    intent: McpCoverLetterApplicationMessagePreviewIntentV1;
  }>;
  sourceRefs: McpCoverLetterApplicationMessagePreviewSourceRefsV1;
  safePlan: McpCoverLetterApplicationMessagePreviewSafePlanV1;
}>;

type PreviewConfig = Readonly<{
  intent: McpCoverLetterApplicationMessagePreviewIntentV1;
  artifactKind: McpCoverLetterApplicationMessagePreviewArtifactKindV1;
  previewStatus: Exclude<
    McpCoverLetterApplicationMessagePreviewStatusV1,
    "blocked"
  >;
  artifactRefId: string;
  artifactTitle: string;
  safeSummary: string;
  contentSummary: string;
  generatedDraftBody: string;
}>;

type SurfacePayload = Readonly<{
  surface: McpCoverLetterApplicationMessagePreviewPolicySurfaceV1;
  payload: unknown;
}>;

const INPUT_KEYS = [
  "kind",
  "generationRequest",
  "sourceRefs",
  "safePlan",
  "version",
] as const;

const INPUT_REQUIRED_KEYS = INPUT_KEYS;

const GENERATION_REQUEST_KEYS = [
  "kind",
  "mode",
  "intent",
  "version",
] as const;

const SOURCE_REF_KEYS = [
  "applicationPackageRef",
  "evidenceGraphRef",
  "reviewCockpitRef",
  "version",
] as const;

const SAFE_PLAN_KEYS = [
  "kind",
  "planStatus",
  "targetArtifactKind",
  "tailoringCompleteness",
  "allowedClaims",
  "sourceFacts",
  "evidenceMatches",
  "blockers",
  "warnings",
  "version",
] as const;

const MAX_SAFE_COUNT = 1000;
const PREVIEW_ARTIFACT_STATUS: McpGeneratedArtifactStatusV1 =
  "human_review_required";
const PREVIEW_ARTIFACT_UPDATED_AT = "2026-06-17T00:00:00.000Z";

const PREVIEW_CONFIG_BY_INTENT: Record<
  McpCoverLetterApplicationMessagePreviewIntentV1,
  PreviewConfig
> = {
  cover_letter_preview: {
    intent: "cover_letter_preview",
    artifactKind: "cover_letter",
    previewStatus: "cover_letter_preview_created",
    artifactRefId: "mcp-safe-ref:cover-letter:preview",
    artifactTitle: "Cover letter preview",
    safeSummary: "Cover letter preview created. Full content is restricted.",
    contentSummary: "Cover letter preview summary is safe.",
    generatedDraftBody:
      "Cover letter preview draft. Human review required before any use. Export, download, send, submit, and apply remain blocked.",
  },
  application_message_preview: {
    intent: "application_message_preview",
    artifactKind: "application_package",
    previewStatus: "application_message_preview_created",
    artifactRefId: "mcp-safe-ref:application-package:message-preview",
    artifactTitle: "Application message preview",
    safeSummary:
      "Application message preview created. Full content is restricted.",
    contentSummary: "Application message preview summary is safe.",
    generatedDraftBody:
      "Application message preview draft. Human review required before any use. Export, download, send, submit, and apply remain blocked.",
  },
};

const SAFE_REF_PATTERNS: Record<
  keyof Omit<McpCoverLetterApplicationMessagePreviewSourceRefsV1, "version">,
  RegExp
> = {
  applicationPackageRef:
    /^mcp-safe-ref:application-package:[a-z0-9][a-z0-9._:-]{0,64}$/u,
  evidenceGraphRef:
    /^mcp-safe-ref:evidence-graph:[a-z0-9][a-z0-9._:-]{0,64}$/u,
  reviewCockpitRef:
    /^mcp-safe-ref:review-cockpit:[a-z0-9][a-z0-9._:-]{0,64}$/u,
};

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

export function buildMcpCoverLetterApplicationMessagePreview(
  input: unknown,
): McpCoverLetterApplicationMessagePreviewResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput) return deny("invalid_input");
  if (!isGenerationReady(parsedInput.safePlan)) {
    return deny("generation_blocked");
  }

  const config = PREVIEW_CONFIG_BY_INTENT[parsedInput.generationRequest.intent];
  const artifactBoundary = buildMcpGeneratedArtifactBoundary({
    kind: "mcp_generated_artifact_boundary_input",
    artifact: buildRestrictedPreviewArtifact(config),
    version: 1,
  });
  if (!artifactBoundary.allowed) {
    return deny("artifact_boundary_blocked");
  }

  const summary = buildPreviewSummary(
    parsedInput,
    config,
    artifactBoundary.summary,
  );
  const component = buildComponentPayloads(summary, config);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_cover_letter_application_message_preview_result",
    allowed: true,
    reason: config.previewStatus,
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

export function buildMcpCoverLetterApplicationMessagePreviewSafeRefusal(): McpCoverLetterApplicationMessagePreviewSafeRefusalV1 {
  return {
    kind: "local_mcp_component_data_policy_safe_error",
    code: "cover_letter_application_message_preview_blocked",
    msg: "Refused. Cover letter/application message preview blocked.",
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
    record.kind !== "mcp_cover_letter_application_message_preview_input" ||
    record.version !== 1
  ) {
    return undefined;
  }

  const generationRequest = parseGenerationRequest(record.generationRequest);
  const sourceRefs = parseSourceRefs(record.sourceRefs);
  const safePlan = parseSafePlan(record.safePlan);
  if (!generationRequest || !sourceRefs || !safePlan) return undefined;
  if (
    safePlan.targetArtifactKind !==
    PREVIEW_CONFIG_BY_INTENT[generationRequest.intent].artifactKind
  ) {
    return undefined;
  }

  return { generationRequest, sourceRefs, safePlan };
}

function parseGenerationRequest(
  val: unknown,
): ParsedInput["generationRequest"] | undefined {
  const record = readExactRecord(
    val,
    GENERATION_REQUEST_KEYS,
    GENERATION_REQUEST_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_cover_letter_application_message_preview_request" ||
    record.mode !== "deterministic_local_preview" ||
    !isPreviewIntent(record.intent) ||
    record.version !== 1
  ) {
    return undefined;
  }

  return {
    mode: "deterministic_local_preview",
    intent: record.intent,
  };
}

function parseSourceRefs(
  val: unknown,
): McpCoverLetterApplicationMessagePreviewSourceRefsV1 | undefined {
  const record = readExactRecord(val, SOURCE_REF_KEYS, SOURCE_REF_KEYS);
  if (!record || record.version !== 1) return undefined;

  const refs = {
    applicationPackageRef: record.applicationPackageRef,
    evidenceGraphRef: record.evidenceGraphRef,
    reviewCockpitRef: record.reviewCockpitRef,
  };
  if (
    !Object.entries(refs).every(
      ([key, val]) =>
        typeof val === "string" &&
        SAFE_REF_PATTERNS[
          key as keyof Omit<
            McpCoverLetterApplicationMessagePreviewSourceRefsV1,
            "version"
          >
        ].test(val) &&
        isSafeText(val),
    )
  ) {
    return undefined;
  }

  return {
    applicationPackageRef: refs.applicationPackageRef as string,
    evidenceGraphRef: refs.evidenceGraphRef as string,
    reviewCockpitRef: refs.reviewCockpitRef as string,
    version: 1,
  };
}

function parseSafePlan(
  val: unknown,
): McpCoverLetterApplicationMessagePreviewSafePlanV1 | undefined {
  const record = readExactRecord(val, SAFE_PLAN_KEYS, SAFE_PLAN_KEYS);
  if (
    !record ||
    record.kind !== "mcp_cover_letter_application_message_preview_safe_plan" ||
    !hasValidSafePlanFields(record)
  ) {
    return undefined;
  }

  return {
    kind: "mcp_cover_letter_application_message_preview_safe_plan",
    planStatus: record.planStatus,
    targetArtifactKind: record.targetArtifactKind,
    tailoringCompleteness: record.tailoringCompleteness,
    allowedClaims: record.allowedClaims,
    sourceFacts: record.sourceFacts,
    evidenceMatches: record.evidenceMatches,
    blockers: 0,
    warnings: record.warnings,
    version: 1,
  };
}

function hasValidSafePlanFields(
  record: Record<string, unknown>,
): record is Record<string, unknown> & {
  planStatus: McpCoverLetterApplicationMessagePreviewSafePlanV1["planStatus"];
  targetArtifactKind: McpCoverLetterApplicationMessagePreviewArtifactKindV1;
  tailoringCompleteness: McpCoverLetterApplicationMessagePreviewSafePlanV1["tailoringCompleteness"];
  allowedClaims: number;
  sourceFacts: number;
  evidenceMatches: number;
  blockers: 0;
  warnings: number;
  version: 1;
} {
  return (
    isPlanStatus(record.planStatus) &&
    isTargetArtifactKind(record.targetArtifactKind) &&
    isTailoringCompleteness(record.tailoringCompleteness) &&
    isSafeCount(record.allowedClaims) &&
    isSafeCount(record.sourceFacts) &&
    isSafeCount(record.evidenceMatches) &&
    record.blockers === 0 &&
    isSafeCount(record.warnings) &&
    record.version === 1
  );
}

function isGenerationReady(
  safePlan: McpCoverLetterApplicationMessagePreviewSafePlanV1,
): boolean {
  return (
    safePlan.planStatus === "ready_for_review" &&
    safePlan.blockers === 0 &&
    safePlan.allowedClaims > 0 &&
    safePlan.evidenceMatches > 0
  );
}

function buildRestrictedPreviewArtifact(
  config: PreviewConfig,
): McpGeneratedArtifactRestrictedArtifactV1 {
  return {
    kind: "mcp_generated_artifact_restricted_artifact",
    artifactKind: config.artifactKind,
    artifactStatus: PREVIEW_ARTIFACT_STATUS,
    artifactRef: {
      id: config.artifactRefId,
      label: artifactLabelForKind(config.artifactKind),
      status: PREVIEW_ARTIFACT_STATUS,
      category: config.artifactKind,
      count: 1,
      updatedAt: PREVIEW_ARTIFACT_UPDATED_AT,
      version: 1,
    },
    visibilityCategory: "restricted_full_content",
    retentionCategory: "retention_pending",
    fullContent: config.generatedDraftBody,
    review: {
      humanReviewRequired: true,
      approvedForPreview: false,
      blockers: 0,
      warnings: 1,
      version: 1,
    },
    version: 1,
  };
}

function buildPreviewSummary(
  input: ParsedInput,
  config: PreviewConfig,
  artifactSummary: Readonly<{
    artifactRef: McpGeneratedArtifactRefV1;
    artifactStatus: McpGeneratedArtifactStatusV1;
    retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
    capabilities: McpGeneratedArtifactSummaryCapabilitiesV1;
  }>,
): McpCoverLetterApplicationMessagePreviewSummaryV1 {
  return {
    kind: "mcp_cover_letter_application_message_preview_summary",
    allowed: true,
    artifactKind: config.artifactKind,
    artifactStatus: artifactSummary.artifactStatus,
    previewStatus: config.previewStatus,
    artifactRef: artifactSummary.artifactRef,
    status: artifactSummary.artifactStatus,
    category: config.artifactKind,
    visibilityCategory: "safe_summary_only",
    retentionCategory: artifactSummary.retentionCategory,
    safeSummary: config.safeSummary,
    nextUserAction: "review_pending_items",
    refIds: [artifactSummary.artifactRef.id],
    safeCounts: {
      artifacts: 1,
      artifactTextBlockers: 0,
      blockers: input.safePlan.blockers,
      warnings: input.safePlan.warnings,
      allowedClaims: input.safePlan.allowedClaims,
      sourceFacts: input.safePlan.sourceFacts,
      evidenceMatches: input.safePlan.evidenceMatches,
      version: 1,
    },
    safeCategories: {
      artifactKind: config.artifactKind,
      artifactStatus: artifactSummary.artifactStatus,
      previewStatus: config.previewStatus,
      visibilityCategory: "safe_summary_only",
      retentionCategory: artifactSummary.retentionCategory,
      nextUserAction: "review_pending_items",
      version: 1,
    },
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
    capabilities: artifactSummary.capabilities,
    modelVisible: true,
    componentVisible: true,
    version: 1,
  };
}

function buildComponentPayloads(
  summary: McpCoverLetterApplicationMessagePreviewSummaryV1,
  config: PreviewConfig,
): McpCoverLetterApplicationMessagePreviewSurfacePayloadsV1 {
  const shared = {
    artifactKind: summary.artifactKind,
    artifactStatus: summary.artifactStatus,
    previewStatus: summary.previewStatus,
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
      { type: "text", text: config.contentSummary },
      { type: "text", text: "Next action: review pending items." },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...shared,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: config.artifactTitle,
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
  component: McpCoverLetterApplicationMessagePreviewSurfacePayloadsV1,
):
  | Readonly<{
      ok: true;
      surfaceStatus: McpCoverLetterApplicationMessagePreviewPolicyStatusV1;
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
    McpCoverLetterApplicationMessagePreviewPolicySurfaceV1,
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
    McpCoverLetterApplicationMessagePreviewResultV1,
    { allowed: false }
  >["reason"],
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpCoverLetterApplicationMessagePreviewResultV1 {
  return {
    kind: "mcp_cover_letter_application_message_preview_result",
    allowed: false,
    reason,
    safeRefusal:
      reason === "artifact_boundary_blocked"
        ? buildMcpCoverLetterApplicationMessagePreviewSafeRefusalFromArtifactBoundary()
        : buildMcpCoverLetterApplicationMessagePreviewSafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildCapabilities("blocked", "blocked", "blocked"),
    modelVisible: true,
    componentVisible: false,
    version: 1,
  };
}

function buildMcpCoverLetterApplicationMessagePreviewSafeRefusalFromArtifactBoundary(): McpCoverLetterApplicationMessagePreviewSafeRefusalV1 {
  const refusal = buildMcpGeneratedArtifactBoundarySafeRefusal();
  return {
    kind: refusal.kind,
    code: "cover_letter_application_message_preview_blocked",
    msg: "Refused. Cover letter/application message preview blocked.",
    safeForModel: refusal.safeForModel,
    rawDataExposed: refusal.rawDataExposed,
    componentDataExposed: refusal.componentDataExposed,
    writeActionExecuted: refusal.writeActionExecuted,
    version: 1,
  };
}

function buildCapabilities(
  generatedArtifactBoundary: McpCoverLetterApplicationMessagePreviewCapabilitiesV1["generatedArtifactBoundary"],
  componentData: McpCoverLetterApplicationMessagePreviewCapabilitiesV1["componentData"],
  componentRendering: McpCoverLetterApplicationMessagePreviewCapabilitiesV1["componentRendering"],
): McpCoverLetterApplicationMessagePreviewCapabilitiesV1 {
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

function artifactLabelForKind(
  artifactKind: McpCoverLetterApplicationMessagePreviewArtifactKindV1,
): string {
  return artifactKind === "cover_letter"
    ? "Cover letter artifact"
    : "Application package artifact";
}

function isPreviewIntent(
  val: unknown,
): val is McpCoverLetterApplicationMessagePreviewIntentV1 {
  return val === "cover_letter_preview" || val === "application_message_preview";
}

function isPlanStatus(
  val: unknown,
): val is McpCoverLetterApplicationMessagePreviewSafePlanV1["planStatus"] {
  return val === "ready_for_review" || val === "needs_review";
}

function isTargetArtifactKind(
  val: unknown,
): val is McpCoverLetterApplicationMessagePreviewArtifactKindV1 {
  return val === "cover_letter" || val === "application_package";
}

function isTailoringCompleteness(
  val: unknown,
): val is McpCoverLetterApplicationMessagePreviewSafePlanV1["tailoringCompleteness"] {
  return val === "complete" || val === "partial";
}

function isSafeCount(val: unknown): val is number {
  return Number.isInteger(val) && val >= 0 && val <= MAX_SAFE_COUNT;
}

function isSafeText(val: string): boolean {
  const normalized = val.normalize("NFKC");
  return !UNSAFE_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function readExactRecord(
  val: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(val);
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
  val: unknown,
): Record<string, unknown> | undefined {
  const descriptors = readPlainObjectDescriptors(val);
  if (!descriptors) return undefined;
  try {
    const record: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return undefined;
      const descriptor = descriptors[key];
      if (!isEnumerableDataDescriptor(descriptor)) return undefined;
      const directValue = (val as Record<string, unknown>)[key];
      if (directValue !== descriptor.value) return undefined;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return undefined;
  }
}

function readPlainObjectDescriptors(
  val: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  try {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return undefined;
    }
    const prototype = Object.getPrototypeOf(val);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    return Object.getOwnPropertyDescriptors(val);
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
