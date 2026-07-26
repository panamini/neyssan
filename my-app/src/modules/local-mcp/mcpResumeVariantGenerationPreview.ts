import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";
import {
  buildMcpGeneratedArtifactBoundary,
  buildMcpGeneratedArtifactBoundarySafeRefusal,
  type McpGeneratedArtifactActionLabelV1,
  type McpGeneratedArtifactRefV1,
  type McpGeneratedArtifactRestrictedArtifactV1,
  type McpGeneratedArtifactRetentionCategoryV1,
  type McpGeneratedArtifactStatusV1,
  type McpGeneratedArtifactSummaryCapabilitiesV1,
} from "./mcpGeneratedArtifactBoundary";

export type McpResumeVariantGenerationPreviewStatusV1 =
  | "resume_variant_preview_created"
  | "resume_variant_preview_required"
  | "blocked";

type McpResumeVariantGenerationModeV1 =
  "deterministic_local_preview";

type McpResumeVariantGenerationIntentV1 =
  "resume_variant_preview";

type McpResumeVariantGenerationPreviewSourceRefsV1 = Readonly<{
  applicationPackageRef: string;
  evidenceGraphRef: string;
  resumeVariantPlanRef: string;
  reviewCockpitRef: string;
  version: 1;
}>;

type McpResumeVariantGenerationPreviewSafePlanV1 = Readonly<{
  kind: "mcp_resume_variant_generation_preview_safe_plan";
  planStatus: "ready_for_review" | "needs_review";
  targetDocumentKind: "resume";
  tailoringCompleteness: "complete" | "partial";
  allowedClaims: number;
  sourceFacts: number;
  evidenceMatches: number;
  blockers: 0;
  warnings: number;
  version: 1;
}>;

export type McpResumeVariantGenerationPreviewSummaryV1 = Readonly<{
  kind: "mcp_resume_variant_generation_preview_summary";
  allowed: true;
  artifactKind: "resume_variant";
  artifactStatus: McpGeneratedArtifactStatusV1;
  previewStatus: McpResumeVariantGenerationPreviewStatusV1;
  artifactRef: McpGeneratedArtifactRefV1;
  status: McpGeneratedArtifactStatusV1;
  category: "resume_variant";
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
    artifactKind: "resume_variant";
    artifactStatus: McpGeneratedArtifactStatusV1;
    previewStatus: McpResumeVariantGenerationPreviewStatusV1;
    visibilityCategory: "safe_summary_only";
    retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
    nextUserAction: McpGeneratedArtifactActionLabelV1;
    version: 1;
  }>;
  safeFlags: Readonly<{
    humanReviewRequired: true;
    approvedForPreview: false;
    approvedForExport: false;
    approvedForSend: false;
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

export type McpResumeVariantGenerationPreviewSurfacePayloadsV1 = Readonly<{
  structuredContent: McpResumeVariantGenerationPreviewSummaryV1;
  content: readonly Readonly<{ type: "text"; text: string }>[];
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
  bridgePayload: Record<string, unknown>;
  stateSnapshot: Record<string, unknown>;
  modelContextUpdate: Record<string, unknown>;
  actionLabel: McpGeneratedArtifactActionLabelV1;
}>;

export type McpResumeVariantGenerationPreviewCapabilitiesV1 = Readonly<{
  generatedArtifactBoundary: "pr68_generated_artifact_boundary_checked" | "blocked";
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

export type McpResumeVariantGenerationPreviewSafeRefusalV1 = Readonly<{
  kind: "local_mcp_component_data_policy_safe_error";
  code: "resume_variant_generation_preview_blocked";
  msg: "Refused. Resume variant generation preview blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpResumeVariantGenerationPreviewResultV1 = Readonly<
  | {
      kind: "mcp_resume_variant_generation_preview_result";
      allowed: true;
      reason: "resume_variant_preview_created";
      summary: McpResumeVariantGenerationPreviewSummaryV1;
      component: McpResumeVariantGenerationPreviewSurfacePayloadsV1;
      policy: McpResumeVariantGenerationPreviewPolicyStatusV1;
      capabilities: McpResumeVariantGenerationPreviewCapabilitiesV1;
      modelVisible: true;
      componentVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_resume_variant_generation_preview_result";
      allowed: false;
      reason:
        | "invalid_input"
        | "generation_blocked"
        | "artifact_boundary_blocked"
        | "policy_blocked";
      safeRefusal: McpResumeVariantGenerationPreviewSafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpResumeVariantGenerationPreviewCapabilitiesV1;
      modelVisible: true;
      componentVisible: false;
      version: 1;
    }
>;

type McpResumeVariantGenerationPreviewPolicySurfaceV1 = Extract<
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

type McpResumeVariantGenerationPreviewPolicyStatusV1 = Readonly<
  Record<McpResumeVariantGenerationPreviewPolicySurfaceV1, "allowed">
>;

type ParsedInput = Readonly<{
  generationRequest: Readonly<{
    mode: McpResumeVariantGenerationModeV1;
    intent: McpResumeVariantGenerationIntentV1;
  }>;
  sourceRefs: McpResumeVariantGenerationPreviewSourceRefsV1;
  safePlan: McpResumeVariantGenerationPreviewSafePlanV1;
}>;

type SurfacePayload = Readonly<{
  surface: McpResumeVariantGenerationPreviewPolicySurfaceV1;
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
  "resumeVariantPlanRef",
  "reviewCockpitRef",
  "version",
] as const;

const SAFE_PLAN_KEYS = [
  "kind",
  "planStatus",
  "targetDocumentKind",
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
const PREVIEW_STATUS: McpResumeVariantGenerationPreviewStatusV1 =
  "resume_variant_preview_created";
const PREVIEW_ARTIFACT_REF_ID = "mcp-safe-ref:resume-variant:preview";
const PREVIEW_ARTIFACT_UPDATED_AT = "2026-06-16T22:13:16.000Z";
const GENERATED_DRAFT_BODY =
  "Resume variant preview draft. Human review required before any use. Export, send, submit, and apply remain blocked.";

const SAFE_REF_PATTERNS: Record<
  keyof Omit<McpResumeVariantGenerationPreviewSourceRefsV1, "version">,
  RegExp
> = {
  applicationPackageRef:
    /^mcp-safe-ref:application-package:[a-z0-9][a-z0-9._:-]{0,64}$/u,
  evidenceGraphRef:
    /^mcp-safe-ref:evidence-graph:[a-z0-9][a-z0-9._:-]{0,64}$/u,
  resumeVariantPlanRef:
    /^mcp-safe-ref:resume-variant-plan:[a-z0-9][a-z0-9._:-]{0,64}$/u,
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
  /\b(?:raw|source[_ -]?quote|private[_ -]?fact|never[_ -]?use|debug|token|session|clerk|stytch|provider|subject|documentid|convex)\b/iu,
  /\bj97convexdocumentid\b/iu,
];

export function buildMcpResumeVariantGenerationPreview(
  input: unknown,
): McpResumeVariantGenerationPreviewResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput) return deny("invalid_input");
  if (!isGenerationReady(parsedInput.safePlan)) {
    return deny("generation_blocked");
  }

  const artifactBoundary = buildMcpGeneratedArtifactBoundary({
    kind: "mcp_generated_artifact_boundary_input",
    artifact: buildRestrictedResumeVariantArtifact(),
    version: 1,
  });
  if (!artifactBoundary.allowed) {
    return deny("artifact_boundary_blocked");
  }

  const summary = buildPreviewSummary(parsedInput, artifactBoundary.summary);
  const component = buildComponentPayloads(summary);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_resume_variant_generation_preview_result",
    allowed: true,
    reason: "resume_variant_preview_created",
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

export function buildMcpResumeVariantGenerationPreviewSafeRefusal(): McpResumeVariantGenerationPreviewSafeRefusalV1 {
  return {
    kind: "local_mcp_component_data_policy_safe_error",
    code: "resume_variant_generation_preview_blocked",
    msg: "Refused. Resume variant generation preview blocked.",
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
    record.kind !== "mcp_resume_variant_generation_preview_input" ||
    record.version !== 1
  ) {
    return undefined;
  }

  const generationRequest = parseGenerationRequest(record.generationRequest);
  const sourceRefs = parseSourceRefs(record.sourceRefs);
  const safePlan = parseSafePlan(record.safePlan);
  if (!generationRequest || !sourceRefs || !safePlan) return undefined;

  return { generationRequest, sourceRefs, safePlan };
}

function parseGenerationRequest(
  value: unknown,
): ParsedInput["generationRequest"] | undefined {
  const record = readExactRecord(
    value,
    GENERATION_REQUEST_KEYS,
    GENERATION_REQUEST_KEYS,
  );
  if (
    !record ||
    record.kind !== "mcp_resume_variant_generation_preview_request" ||
    record.mode !== "deterministic_local_preview" ||
    record.intent !== "resume_variant_preview" ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    mode: "deterministic_local_preview",
    intent: "resume_variant_preview",
  };
}

function parseSourceRefs(
  value: unknown,
): McpResumeVariantGenerationPreviewSourceRefsV1 | undefined {
  const record = readExactRecord(value, SOURCE_REF_KEYS, SOURCE_REF_KEYS);
  if (!record || record.version !== 1) return undefined;

  const refs = {
    applicationPackageRef: record.applicationPackageRef,
    evidenceGraphRef: record.evidenceGraphRef,
    resumeVariantPlanRef: record.resumeVariantPlanRef,
    reviewCockpitRef: record.reviewCockpitRef,
  };

  if (
    !Object.entries(refs).every(
      ([key, value]) =>
        typeof value === "string" &&
        SAFE_REF_PATTERNS[
          key as keyof Omit<
            McpResumeVariantGenerationPreviewSourceRefsV1,
            "version"
          >
        ].test(value) &&
        isSafeText(value),
    )
  ) {
    return undefined;
  }

  return {
    applicationPackageRef: refs.applicationPackageRef as string,
    evidenceGraphRef: refs.evidenceGraphRef as string,
    resumeVariantPlanRef: refs.resumeVariantPlanRef as string,
    reviewCockpitRef: refs.reviewCockpitRef as string,
    version: 1,
  };
}

function parseSafePlan(
  value: unknown,
): McpResumeVariantGenerationPreviewSafePlanV1 | undefined {
  const record = readExactRecord(value, SAFE_PLAN_KEYS, SAFE_PLAN_KEYS);
  if (
    !record ||
    record.kind !== "mcp_resume_variant_generation_preview_safe_plan" ||
    !hasValidSafePlanFields(record)
  ) {
    return undefined;
  }

  return {
    kind: "mcp_resume_variant_generation_preview_safe_plan",
    planStatus: record.planStatus,
    targetDocumentKind: "resume",
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
  planStatus: McpResumeVariantGenerationPreviewSafePlanV1["planStatus"];
  targetDocumentKind: "resume";
  tailoringCompleteness: McpResumeVariantGenerationPreviewSafePlanV1["tailoringCompleteness"];
  allowedClaims: number;
  sourceFacts: number;
  evidenceMatches: number;
  blockers: 0;
  warnings: number;
  version: 1;
} {
  return (
    isPlanStatus(record.planStatus) &&
    record.targetDocumentKind === "resume" &&
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
  safePlan: McpResumeVariantGenerationPreviewSafePlanV1,
): boolean {
  return (
    safePlan.planStatus === "ready_for_review" &&
    safePlan.blockers === 0 &&
    safePlan.allowedClaims > 0 &&
    safePlan.evidenceMatches > 0
  );
}

function buildRestrictedResumeVariantArtifact(): McpGeneratedArtifactRestrictedArtifactV1 {
  return {
    kind: "mcp_generated_artifact_restricted_artifact",
    artifactKind: "resume_variant",
    artifactStatus: PREVIEW_ARTIFACT_STATUS,
    artifactRef: {
      id: PREVIEW_ARTIFACT_REF_ID,
      label: "Resume variant artifact",
      status: PREVIEW_ARTIFACT_STATUS,
      category: "resume_variant",
      count: 1,
      updatedAt: PREVIEW_ARTIFACT_UPDATED_AT,
      version: 1,
    },
    visibilityCategory: "restricted_full_content",
    retentionCategory: "retention_pending",
    fullContent: GENERATED_DRAFT_BODY,
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
  artifactSummary: Readonly<{
    artifactRef: McpGeneratedArtifactRefV1;
    artifactStatus: McpGeneratedArtifactStatusV1;
    retentionCategory: McpGeneratedArtifactRetentionCategoryV1;
    capabilities: McpGeneratedArtifactSummaryCapabilitiesV1;
  }>,
): McpResumeVariantGenerationPreviewSummaryV1 {
  return {
    kind: "mcp_resume_variant_generation_preview_summary",
    allowed: true,
    artifactKind: "resume_variant",
    artifactStatus: artifactSummary.artifactStatus,
    previewStatus: PREVIEW_STATUS,
    artifactRef: artifactSummary.artifactRef,
    status: artifactSummary.artifactStatus,
    category: "resume_variant",
    visibilityCategory: "safe_summary_only",
    retentionCategory: artifactSummary.retentionCategory,
    safeSummary:
      "Resume variant preview created. Full content is restricted.",
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
      artifactKind: "resume_variant",
      artifactStatus: artifactSummary.artifactStatus,
      previewStatus: PREVIEW_STATUS,
      visibilityCategory: "safe_summary_only",
      retentionCategory: artifactSummary.retentionCategory,
      nextUserAction: "review_pending_items",
      version: 1,
    },
    safeFlags: {
      humanReviewRequired: true,
      approvedForPreview: false,
      approvedForExport: false,
      approvedForSend: false,
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
  summary: McpResumeVariantGenerationPreviewSummaryV1,
): McpResumeVariantGenerationPreviewSurfacePayloadsV1 {
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
      { type: "text", text: "Resume variant preview summary is safe." },
      { type: "text", text: "Next action: review pending items." },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...shared,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: "Resume variant preview",
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
  component: McpResumeVariantGenerationPreviewSurfacePayloadsV1,
):
  | Readonly<{
      ok: true;
      surfaceStatus: McpResumeVariantGenerationPreviewPolicyStatusV1;
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
    McpResumeVariantGenerationPreviewPolicySurfaceV1,
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
    McpResumeVariantGenerationPreviewResultV1,
    { allowed: false }
  >["reason"],
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpResumeVariantGenerationPreviewResultV1 {
  return {
    kind: "mcp_resume_variant_generation_preview_result",
    allowed: false,
    reason,
    safeRefusal:
      reason === "artifact_boundary_blocked"
        ? buildMcpResumeVariantGenerationPreviewSafeRefusalFromArtifactBoundary()
        : buildMcpResumeVariantGenerationPreviewSafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildCapabilities("blocked", "blocked", "blocked"),
    modelVisible: true,
    componentVisible: false,
    version: 1,
  };
}

function buildMcpResumeVariantGenerationPreviewSafeRefusalFromArtifactBoundary(): McpResumeVariantGenerationPreviewSafeRefusalV1 {
  const refusal = buildMcpGeneratedArtifactBoundarySafeRefusal();
  return {
    kind: refusal.kind,
    code: "resume_variant_generation_preview_blocked",
    msg: "Refused. Resume variant generation preview blocked.",
    safeForModel: refusal.safeForModel,
    rawDataExposed: refusal.rawDataExposed,
    componentDataExposed: refusal.componentDataExposed,
    writeActionExecuted: refusal.writeActionExecuted,
    version: 1,
  };
}

function buildCapabilities(
  generatedArtifactBoundary: McpResumeVariantGenerationPreviewCapabilitiesV1["generatedArtifactBoundary"],
  componentData: McpResumeVariantGenerationPreviewCapabilitiesV1["componentData"],
  componentRendering: McpResumeVariantGenerationPreviewCapabilitiesV1["componentRendering"],
): McpResumeVariantGenerationPreviewCapabilitiesV1 {
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

function isPlanStatus(
  value: unknown,
): value is McpResumeVariantGenerationPreviewSafePlanV1["planStatus"] {
  return value === "ready_for_review" || value === "needs_review";
}

function isTailoringCompleteness(
  value: unknown,
): value is McpResumeVariantGenerationPreviewSafePlanV1["tailoringCompleteness"] {
  return value === "complete" || value === "partial";
}

function isSafeCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_SAFE_COUNT
  );
}

function isSafeText(value: string): boolean {
  const normalized = value.normalize("NFKC");
  return !UNSAFE_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}
