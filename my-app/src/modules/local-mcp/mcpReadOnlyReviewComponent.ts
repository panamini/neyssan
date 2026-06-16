import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";
import type {
  McpRealReviewCockpitSummaryAvailabilityV1,
  McpRealReviewCockpitSummaryCapabilitiesV1,
  McpRealReviewCockpitSummaryCategoriesV1,
  McpRealReviewCockpitSummaryCountsV1,
  McpRealReviewCockpitSummaryFlagsV1,
  McpRealReviewCockpitSummaryMissingDataReasonV1,
  McpRealReviewCockpitSummaryRefV1,
  McpRealReviewCockpitSummaryResultV1,
  McpRealReviewCockpitSummaryStatusV1,
} from "./mcpRealReviewCockpitSummary";

export type McpReadOnlyReviewComponentUnavailableReasonV1 =
  | "missing_auth"
  | "missing_account_link"
  | "missing_consent"
  | "no_review_data";

export type McpReadOnlyReviewComponentBlockedReasonV1 =
  | "invalid_input"
  | "policy_blocked";

export type McpReadOnlyReviewComponentActionLabelV1 =
  | "add_application_context"
  | "approve_review_gate"
  | "ready_for_review"
  | "refresh_inputs"
  | "refresh_stale_inputs"
  | "review_blockers"
  | "review_missing_inputs"
  | "review_pending_items";

export type McpReadOnlyReviewComponentContentBlockV1 = Readonly<{
  type: "text";
  text: string;
}>;

export type McpReadOnlyReviewComponentSurfacePayloadsV1 = Readonly<{
  structuredContent: unknown;
  content: readonly McpReadOnlyReviewComponentContentBlockV1[];
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
  stateSnapshot: Record<string, unknown>;
  actionLabel: McpReadOnlyReviewComponentActionLabelV1;
}>;

export type McpReadOnlyReviewComponentCapabilitiesV1 = Readonly<{
  componentData: "policy_checked" | "blocked";
  componentRendering: "view_model_only" | "blocked";
  componentRuntime: "blocked";
  uiBridgeRuntime: "blocked";
  toolCalls: "blocked";
  modelContextRuntime: "blocked";
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

export type McpReadOnlyReviewComponentSafeRefusalV1 = Readonly<{
  code: "read_only_review_component_blocked";
  message: "Refused. Read-only review component blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

type McpReadOnlyReviewComponentInputV1 = Readonly<{
  kind: "mcp_read_only_review_component_input";
  reviewSummary?: unknown;
  unavailableReason?: McpReadOnlyReviewComponentUnavailableReasonV1;
  version: 1;
}>;

export type McpReadOnlyReviewComponentResultV1 = Readonly<
  | {
      kind: "mcp_read_only_review_component_result";
      allowed: true;
      reason: "safe_review_component_projected";
      component: McpReadOnlyReviewComponentSurfacePayloadsV1;
      policy: McpReadOnlyReviewComponentPolicyStatusV1;
      capabilities: McpReadOnlyReviewComponentCapabilitiesV1;
      componentVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_read_only_review_component_result";
      allowed: false;
      reason: McpReadOnlyReviewComponentBlockedReasonV1;
      safeRefusal: McpReadOnlyReviewComponentSafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpReadOnlyReviewComponentCapabilitiesV1;
      componentVisible: false;
      version: 1;
    }
>;

type SafeReviewSummary = Extract<
  McpRealReviewCockpitSummaryResultV1,
  { allowed: true }
>;

type McpReadOnlyReviewComponentPolicySurfaceV1 = Extract<
  LocalMcpComponentDataSurfaceV1,
  | "model_visible_structured_content"
  | "component_visible_structured_content"
  | "component_visible_content"
  | "component_visible_meta"
  | "component_visible_props"
  | "component_visible_state_snapshot"
  | "component_visible_action_label"
>;

type McpReadOnlyReviewComponentPolicyStatusV1 = Readonly<
  Record<McpReadOnlyReviewComponentPolicySurfaceV1, "allowed">
>;

type SurfacePayload = Readonly<{
  surface: McpReadOnlyReviewComponentPolicySurfaceV1;
  payload: unknown;
}>;

const SAFE_REVIEW_ACTION_LABELS =
  new Set<McpReadOnlyReviewComponentActionLabelV1>([
    "add_application_context",
    "approve_review_gate",
    "ready_for_review",
    "refresh_inputs",
    "refresh_stale_inputs",
    "review_blockers",
    "review_missing_inputs",
    "review_pending_items",
  ]);

const UNAVAILABLE_REASON_CONFIG: Record<
  McpReadOnlyReviewComponentUnavailableReasonV1,
  Readonly<{
    status: McpRealReviewCockpitSummaryStatusV1;
    message: string;
    actionLabel: McpReadOnlyReviewComponentActionLabelV1;
  }>
> = {
  missing_auth: {
    status: "onboarding_required",
    message: "Authorization required before review data can be shown.",
    actionLabel: "add_application_context",
  },
  missing_account_link: {
    status: "onboarding_required",
    message: "Account link required before review data can be shown.",
    actionLabel: "add_application_context",
  },
  missing_consent: {
    status: "onboarding_required",
    message: "Consent required before review data can be shown.",
    actionLabel: "add_application_context",
  },
  no_review_data: {
    status: "no_data_available",
    message: "No review data is available yet.",
    actionLabel: "add_application_context",
  },
};

const EMPTY_REVIEW_COUNTS = {
  reviewContexts: 0,
  reviewRuns: 0,
  reviewArtifacts: 0,
  applicationPackages: 0,
  pendingReviews: 0,
  approvedReviews: 0,
  blockedReviews: 0,
  failedRuns: 0,
  blockedRuns: 0,
  blockedArtifacts: 0,
  blockedPackages: 0,
  missingReviewItems: 0,
  approvalNeeded: 0,
  staleInputs: 0,
  overLimitCollections: 0,
  version: 1,
} as const;

export function buildMcpReadOnlyReviewComponent(
  input: unknown,
): McpReadOnlyReviewComponentResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput) return deny("invalid_input");

  const reviewSummary =
    parsedInput.reviewSummary !== undefined
      ? readSafeReviewSummary(parsedInput.reviewSummary)
      : buildUnavailableSummary(parsedInput.unavailableReason);
  if (!reviewSummary) return deny("invalid_input");

  const actionLabel = readReviewActionLabel(reviewSummary);
  const component = buildComponentPayloads(reviewSummary, actionLabel);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_read_only_review_component_result",
    allowed: true,
    reason: "safe_review_component_projected",
    component,
    policy: policy.surfaceStatus,
    capabilities: buildCapabilities("policy_checked", "view_model_only"),
    componentVisible: true,
    version: 1,
  };
}

export function buildMcpReadOnlyReviewComponentSafeRefusal(): McpReadOnlyReviewComponentSafeRefusalV1 {
  return {
    code: "read_only_review_component_blocked",
    message: "Refused. Read-only review component blocked.",
    safeForModel: true,
    rawDataExposed: false,
    componentDataExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseInput(
  input: unknown,
): McpReadOnlyReviewComponentInputV1 | undefined {
  const record = readPlainObjectRecord(input);
  if (!record) return undefined;
  if (!hasAllowedInputKeys(record)) return undefined;
  if (!isInputEnvelope(record)) return undefined;
  if (!hasValidUnavailableReason(record)) return undefined;
  if (!hasInputPayload(record)) return undefined;
  return {
    kind: "mcp_read_only_review_component_input",
    ...(record.reviewSummary !== undefined
      ? { reviewSummary: record.reviewSummary }
      : {}),
    ...(record.unavailableReason !== undefined
      ? { unavailableReason: record.unavailableReason }
      : {}),
    version: 1,
  };
}

const INPUT_KEYS = new Set([
  "kind",
  "reviewSummary",
  "unavailableReason",
  "version",
]);

const SAFE_REVIEW_READINESS_VALUES = new Set<
  NonNullable<McpRealReviewCockpitSummaryCategoriesV1["reviewReadiness"]>
>(["ready_for_review", "needs_user_review", "blocked", "unknown"]);

const SAFE_REVIEW_GATE_STATUS_VALUES = new Set<
  NonNullable<McpRealReviewCockpitSummaryCategoriesV1["reviewGateStatus"]>
>(["ready", "needs_review", "blocked", "unknown"]);

const SAFE_BLOCKER_CATEGORY_VALUES = new Set<
  NonNullable<McpRealReviewCockpitSummaryCategoriesV1["blockerCategory"]>
>(["blocked_package", "blocked_artifact", "blocked_run", "failed_run", "none"]);

const SAFE_MISSING_REVIEW_CATEGORY_VALUES = new Set<
  NonNullable<McpRealReviewCockpitSummaryCategoriesV1["missingReviewCategory"]>
>([
  "missing_review_context",
  "missing_review_artifact",
  "missing_application_package",
  "pending_review_items",
  "none",
]);

const SAFE_NEXT_REVIEW_HINT_VALUES = new Set<
  NonNullable<McpRealReviewCockpitSummaryCategoriesV1["nextReviewHint"]>
>([
  "review_blockers",
  "review_pending_items",
  "review_missing_inputs",
  "refresh_stale_inputs",
  "ready_for_review",
  "add_application_context",
]);

const SAFE_NEXT_USER_ACTION_VALUES = new Set<
  NonNullable<McpRealReviewCockpitSummaryCategoriesV1["nextUserAction"]>
>([
  "review_blockers",
  "review_pending_items",
  "review_missing_inputs",
  "refresh_inputs",
  "approve_review_gate",
  "none",
]);

const SAFE_MISSING_DATA_REASON_VALUES =
  new Set<McpRealReviewCockpitSummaryMissingDataReasonV1>([
    "review_cockpit_ref_missing",
    "review_cockpit_not_available",
    "owner_onboarding_required",
    "summary_unavailable",
  ]);

const SAFE_REVIEW_COUNT_KEYS = [
  "reviewContexts",
  "reviewRuns",
  "reviewArtifacts",
  "applicationPackages",
  "pendingReviews",
  "approvedReviews",
  "blockedReviews",
  "failedRuns",
  "blockedRuns",
  "blockedArtifacts",
  "blockedPackages",
  "missingReviewItems",
  "approvalNeeded",
  "staleInputs",
  "overLimitCollections",
] as const;

const SAFE_REVIEW_FIXED_CAPABILITIES = {
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
} as const;

const SAFE_REVIEW_CATEGORY_SPECS = [
  ["reviewReadiness", SAFE_REVIEW_READINESS_VALUES],
  ["reviewGateStatus", SAFE_REVIEW_GATE_STATUS_VALUES],
  ["blockerCategory", SAFE_BLOCKER_CATEGORY_VALUES],
  ["missingReviewCategory", SAFE_MISSING_REVIEW_CATEGORY_VALUES],
  ["nextReviewHint", SAFE_NEXT_REVIEW_HINT_VALUES],
  ["nextUserAction", SAFE_NEXT_USER_ACTION_VALUES],
] as const;

function readSafeReviewSummary(value: unknown): SafeReviewSummary | undefined {
  const envelope = readSafeReviewSummaryEnvelope(value);
  if (!envelope) return undefined;
  const summaryParts = readSafeReviewSummaryParts(
    envelope.record,
    envelope.status,
  );
  return summaryParts
    ? buildSafeReviewSummary(envelope.record, envelope.status, summaryParts)
    : undefined;
}

function buildUnavailableSummary(
  reason: McpReadOnlyReviewComponentUnavailableReasonV1 | undefined,
): SafeReviewSummary | undefined {
  if (!reason) return undefined;
  const config = UNAVAILABLE_REASON_CONFIG[reason];
  return {
    kind: "mcp_real_review_cockpit_summary_result",
    allowed: true,
    status: config.status,
    reviewCockpitRef: {
      id: "mcp-safe-ref:review-cockpit:latest",
      label: "Review cockpit availability",
      status: config.status,
      category: "review_cockpit",
      count: 0,
      version: 1,
    },
    availability: {
      source: "pr59_read_only_adapter",
      ownerState:
        config.status === "onboarding_required"
          ? "onboarding_required"
          : "resolved",
      version: 1,
    },
    safeCounts: EMPTY_REVIEW_COUNTS,
    safeCategories: {
      reviewReadiness: "unknown",
      reviewGateStatus: "unknown",
      blockerCategory: "none",
      missingReviewCategory:
        reason === "no_review_data" ? "missing_review_context" : "none",
      nextReviewHint: config.actionLabel,
      nextUserAction: config.actionLabel,
      version: 1,
    },
    safeFlags: {
      approvalNeeded: false,
      staleData: false,
      overLimit: false,
      version: 1,
    },
    missingDataReason:
      config.status === "onboarding_required"
        ? "owner_onboarding_required"
        : "review_cockpit_not_available",
    capabilities: {
      adapter: "pr59_read_only_adapter_verified",
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
    },
    modelVisible: true,
    version: 1,
  };
}

function buildComponentPayloads(
  reviewSummary: SafeReviewSummary,
  actionLabel: McpReadOnlyReviewComponentActionLabelV1,
): McpReadOnlyReviewComponentSurfacePayloadsV1 {
  const statusText = statusMessage(reviewSummary);
  const nextActionText = actionText(actionLabel);
  const base = {
    status: reviewSummary.status,
    reviewCockpitRef: reviewSummary.reviewCockpitRef,
    safeCounts: reviewSummary.safeCounts,
    safeCategories: reviewSummary.safeCategories,
    safeFlags: reviewSummary.safeFlags,
    capabilities: reviewSummary.capabilities,
    ...(reviewSummary.updatedAt ? { updatedAt: reviewSummary.updatedAt } : {}),
    ...(reviewSummary.missingDataReason
      ? { missingDataReason: reviewSummary.missingDataReason }
      : {}),
    version: 1,
  };

  return {
    structuredContent: reviewSummary,
    content: [
      { type: "text", text: statusText },
      { type: "text", text: nextActionText },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...base,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: "Review cockpit",
      safeSummary: statusText,
      nextUserAction: actionLabel,
      refIds: [reviewSummary.reviewCockpitRef.id],
      ...base,
    },
    stateSnapshot: {
      kind: "local_mcp_component_data_policy_safe_state_snapshot",
      title: "Review cockpit",
      safeSummary: nextActionText,
      nextUserAction: actionLabel,
      safeRefs: [reviewSummary.reviewCockpitRef.id],
      ...base,
    },
    actionLabel,
  };
}

function validateComponentPayloads(
  component: McpReadOnlyReviewComponentSurfacePayloadsV1,
):
  | Readonly<{
      ok: true;
      surfaceStatus: McpReadOnlyReviewComponentPolicyStatusV1;
    }>
  | Readonly<{ ok: false; result: LocalMcpComponentDataPolicyResultV1 }> {
  const surfacePayloads: readonly SurfacePayload[] = [
    {
      surface: "model_visible_structured_content",
      payload: component.structuredContent,
    },
    {
      surface: "component_visible_structured_content",
      payload: component.structuredContent,
    },
    { surface: "component_visible_content", payload: component.content },
    { surface: "component_visible_meta", payload: component.meta },
    { surface: "component_visible_props", payload: component.props },
    {
      surface: "component_visible_state_snapshot",
      payload: component.stateSnapshot,
    },
    {
      surface: "component_visible_action_label",
      payload: component.actionLabel,
    },
  ];
  const surfaceStatus = {} as Record<
    McpReadOnlyReviewComponentPolicySurfaceV1,
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

function readReviewActionLabel(
  reviewSummary: SafeReviewSummary,
): McpReadOnlyReviewComponentActionLabelV1 {
  const nextUserAction = reviewSummary.safeCategories.nextUserAction;
  if (isReviewActionLabel(nextUserAction)) return nextUserAction;
  const nextReviewHint = reviewSummary.safeCategories.nextReviewHint;
  if (isReviewActionLabel(nextReviewHint)) return nextReviewHint;
  return "ready_for_review";
}

function isReviewActionLabel(
  value: unknown,
): value is McpReadOnlyReviewComponentActionLabelV1 {
  return typeof value === "string" && SAFE_REVIEW_ACTION_LABELS.has(value);
}

function statusMessage(reviewSummary: SafeReviewSummary): string {
  const gate = reviewSummary.safeCategories.reviewGateStatus ?? "unknown";
  if (reviewSummary.status === "onboarding_required") {
    return "Review data is waiting for account readiness.";
  }
  if (reviewSummary.status === "no_data_available") {
    return "No review data is available yet.";
  }
  if (gate === "ready") return "Review gate is ready.";
  if (gate === "blocked") return "Review gate is blocked.";
  if (gate === "needs_review") return "Review gate needs review.";
  return "Review gate status is unknown.";
}

function actionText(
  actionLabel: McpReadOnlyReviewComponentActionLabelV1,
): string {
  switch (actionLabel) {
    case "add_application_context":
      return "Next action: add application context.";
    case "approve_review_gate":
      return "Next action: approve review gate.";
    case "refresh_inputs":
      return "Next action: refresh inputs.";
    case "refresh_stale_inputs":
      return "Next action: refresh stale inputs.";
    case "review_blockers":
      return "Next action: review blockers.";
    case "review_missing_inputs":
      return "Next action: review missing inputs.";
    case "review_pending_items":
      return "Next action: review pending items.";
    case "ready_for_review":
      return "Next action: review ready state.";
  }
}

function isUnavailableReason(
  value: unknown,
): value is McpReadOnlyReviewComponentUnavailableReasonV1 {
  return (
    value === "missing_auth" ||
    value === "missing_account_link" ||
    value === "missing_consent" ||
    value === "no_review_data"
  );
}

function deny(
  reason: McpReadOnlyReviewComponentBlockedReasonV1,
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpReadOnlyReviewComponentResultV1 {
  return {
    kind: "mcp_read_only_review_component_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpReadOnlyReviewComponentSafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildCapabilities("blocked", "blocked"),
    componentVisible: false,
    version: 1,
  };
}

function buildCapabilities(
  componentData: McpReadOnlyReviewComponentCapabilitiesV1["componentData"],
  componentRendering: McpReadOnlyReviewComponentCapabilitiesV1["componentRendering"],
): McpReadOnlyReviewComponentCapabilitiesV1 {
  return {
    componentData,
    componentRendering,
    componentRuntime: "blocked",
    uiBridgeRuntime: "blocked",
    toolCalls: "blocked",
    modelContextRuntime: "blocked",
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

function readPlainObjectRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!isPlainObjectCandidate(value)) return undefined;
  if (!hasPlainObjectPrototype(value)) return undefined;
  if (!hasOnlyEnumerableDataProperties(value)) return undefined;
  if (hasSymbolKeys(value)) return undefined;
  return value as Record<string, unknown>;
}

function hasAllowedInputKeys(record: Record<string, unknown>): boolean {
  return Object.keys(record).every((key) => INPUT_KEYS.has(key));
}

function isInputEnvelope(record: Record<string, unknown>): boolean {
  return (
    record.kind === "mcp_read_only_review_component_input" &&
    record.version === 1
  );
}

function hasValidUnavailableReason(record: Record<string, unknown>): boolean {
  return (
    record.unavailableReason === undefined ||
    isUnavailableReason(record.unavailableReason)
  );
}

function hasInputPayload(record: Record<string, unknown>): boolean {
  return (
    record.reviewSummary !== undefined || record.unavailableReason !== undefined
  );
}

function isSafeReviewSummaryEnvelope(record: Record<string, unknown>): boolean {
  return (
    record.kind === "mcp_real_review_cockpit_summary_result" &&
    record.allowed === true &&
    record.modelVisible === true &&
    record.version === 1
  );
}

function readSafeReviewSummaryStatus(
  value: unknown,
): McpRealReviewCockpitSummaryStatusV1 | undefined {
  return value === "available" ||
    value === "no_data_available" ||
    value === "onboarding_required"
    ? value
    : undefined;
}

function readSafeReviewCockpitRef(
  value: unknown,
  status: McpRealReviewCockpitSummaryStatusV1,
): McpRealReviewCockpitSummaryRefV1 | undefined {
  const record = readVersionedRecord(value);
  const refFields = record && readSafeReviewCockpitRefFields(record, status);
  if (!record || !refFields) return undefined;
  return {
    id: refFields.id,
    label: refFields.label,
    status,
    category: "review_cockpit",
    count: refFields.count,
    ...(refFields.updatedAt ? { updatedAt: refFields.updatedAt } : {}),
    version: 1,
  };
}

function readSafeReviewAvailability(
  value: unknown,
): McpRealReviewCockpitSummaryAvailabilityV1 | undefined {
  const record = readVersionedRecord(value);
  const source =
    record &&
    readRequiredEnum(
      record.source,
      new Set(["pr59_read_only_adapter", "convex_review_cockpit_summary"]),
    );
  const ownerState =
    record &&
    readRequiredEnum(
      record.ownerState,
      new Set(["resolved", "onboarding_required"]),
    );
  if (!record || !source || !ownerState) {
    return undefined;
  }
  return {
    source,
    ownerState,
    version: 1,
  };
}

function readSafeReviewCounts(
  value: unknown,
): McpRealReviewCockpitSummaryCountsV1 | undefined {
  const record = readVersionedRecord(value);
  const counts = record && readCountFields(record, SAFE_REVIEW_COUNT_KEYS);
  return record && counts ? { ...counts, version: 1 } : undefined;
}

function readSafeReviewCategories(
  value: unknown,
): McpRealReviewCockpitSummaryCategoriesV1 | undefined {
  const record = readVersionedRecord(value);
  const fields =
    record && readOptionalEnumFields(record, SAFE_REVIEW_CATEGORY_SPECS);
  return record && fields ? { ...fields, version: 1 } : undefined;
}

function readSafeReviewFlags(
  value: unknown,
): McpRealReviewCockpitSummaryFlagsV1 | undefined {
  const record = readPlainObjectRecord(value);
  if (
    !record ||
    typeof record.approvalNeeded !== "boolean" ||
    typeof record.staleData !== "boolean" ||
    typeof record.overLimit !== "boolean" ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    approvalNeeded: record.approvalNeeded,
    staleData: record.staleData,
    overLimit: record.overLimit,
    version: 1,
  };
}

function readSafeReviewCapabilities(
  value: unknown,
): McpRealReviewCockpitSummaryCapabilitiesV1 | undefined {
  const record = readVersionedRecord(value);
  const adapter =
    record &&
    readRequiredEnum(
      record.adapter,
      new Set(["blocked", "pr59_read_only_adapter_verified"]),
    );
  const dataReads =
    record &&
    readRequiredEnum(
      record.dataReads,
      new Set(["blocked", "convex_review_cockpit_summary"]),
    );
  if (
    !record ||
    !adapter ||
    !dataReads ||
    !hasExactFieldValues(record, SAFE_REVIEW_FIXED_CAPABILITIES)
  ) {
    return undefined;
  }
  return {
    adapter,
    dataReads,
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

function readSafeReviewSummaryParts(
  record: Record<string, unknown>,
  status: McpRealReviewCockpitSummaryStatusV1,
):
  | Readonly<{
      reviewCockpitRef: McpRealReviewCockpitSummaryRefV1;
      availability: McpRealReviewCockpitSummaryAvailabilityV1;
      safeCounts: McpRealReviewCockpitSummaryCountsV1;
      safeCategories: McpRealReviewCockpitSummaryCategoriesV1;
      safeFlags: McpRealReviewCockpitSummaryFlagsV1;
      capabilities: McpRealReviewCockpitSummaryCapabilitiesV1;
    }>
  | undefined {
  const reviewCockpitRef = readSafeReviewCockpitRef(
    record.reviewCockpitRef,
    status,
  );
  const availability = readSafeReviewAvailability(record.availability);
  const safeCounts = readSafeReviewCounts(record.safeCounts);
  const safeCategories = readSafeReviewCategories(record.safeCategories);
  const safeFlags = readSafeReviewFlags(record.safeFlags);
  const capabilities = readSafeReviewCapabilities(record.capabilities);
  return reviewCockpitRef &&
    availability &&
    safeCounts &&
    safeCategories &&
    safeFlags &&
    capabilities
    ? {
        reviewCockpitRef,
        availability,
        safeCounts,
        safeCategories,
        safeFlags,
        capabilities,
      }
    : undefined;
}

function readSafeReviewSummaryEnvelope(value: unknown):
  | Readonly<{
      record: Record<string, unknown>;
      status: McpRealReviewCockpitSummaryStatusV1;
    }>
  | undefined {
  if (!validateSurface("component_visible_structured_content", value).allowed) {
    return undefined;
  }
  const record = readPlainObjectRecord(value);
  if (!record || !isSafeReviewSummaryEnvelope(record)) return undefined;
  const status = readSafeReviewSummaryStatus(record.status);
  return status ? { record, status } : undefined;
}

function buildSafeReviewSummary(
  record: Record<string, unknown>,
  status: McpRealReviewCockpitSummaryStatusV1,
  summaryParts: Readonly<{
    reviewCockpitRef: McpRealReviewCockpitSummaryRefV1;
    availability: McpRealReviewCockpitSummaryAvailabilityV1;
    safeCounts: McpRealReviewCockpitSummaryCountsV1;
    safeCategories: McpRealReviewCockpitSummaryCategoriesV1;
    safeFlags: McpRealReviewCockpitSummaryFlagsV1;
    capabilities: McpRealReviewCockpitSummaryCapabilitiesV1;
  }>,
): SafeReviewSummary | undefined {
  const updatedAt = readOptionalIsoUtcTimestamp(record.updatedAt);
  const missingDataReason = readOptionalMissingDataReason(
    record.missingDataReason,
  );
  if (updatedAt === false || missingDataReason === false) return undefined;
  return {
    kind: "mcp_real_review_cockpit_summary_result",
    allowed: true,
    status,
    reviewCockpitRef: summaryParts.reviewCockpitRef,
    availability: summaryParts.availability,
    safeCounts: summaryParts.safeCounts,
    safeCategories: summaryParts.safeCategories,
    safeFlags: summaryParts.safeFlags,
    ...(updatedAt ? { updatedAt } : {}),
    ...(missingDataReason ? { missingDataReason } : {}),
    capabilities: summaryParts.capabilities,
    modelVisible: true,
    version: 1,
  };
}

function readOptionalIsoUtcTimestamp(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return isStrictIsoUtcTimestamp(value) ? value : false;
}

function readOptionalMissingDataReason(
  value: unknown,
): McpRealReviewCockpitSummaryMissingDataReasonV1 | undefined | false {
  if (value === undefined) return undefined;
  return typeof value === "string" && SAFE_MISSING_DATA_REASON_VALUES.has(value)
    ? value
    : false;
}

function readVersionedRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(value);
  return record?.version === 1 ? record : undefined;
}

function readStringFields<T extends readonly string[]>(
  record: Record<string, unknown>,
  keys: T,
): { [K in T[number]]: string } | undefined {
  const values = {} as { [K in T[number]]: string };
  for (const key of keys) {
    if (typeof record[key] !== "string") return undefined;
    values[key] = record[key];
  }
  return values;
}

function readSafeReviewCockpitRefFields(
  record: Record<string, unknown>,
  status: McpRealReviewCockpitSummaryStatusV1,
):
  | Readonly<{
      id: string;
      label: string;
      count: number;
      updatedAt?: string;
    }>
  | undefined {
  const stringFields = readStringFields(record, ["id", "label"]);
  const count = readCountField(record, "count");
  const updatedAt = readOptionalIsoUtcTimestamp(record.updatedAt);
  if (
    !stringFields ||
    count === undefined ||
    updatedAt === false ||
    record.status !== status ||
    record.category !== "review_cockpit"
  ) {
    return undefined;
  }
  return {
    id: stringFields.id,
    label: stringFields.label,
    count,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function readCountField(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  return isSafeCount(record[key]) ? record[key] : undefined;
}

function readCountFields<T extends readonly string[]>(
  record: Record<string, unknown>,
  keys: T,
): { [K in T[number]]: number } | undefined {
  const values = {} as { [K in T[number]]: number };
  for (const key of keys) {
    const count = readCountField(record, key);
    if (count === undefined) return undefined;
    values[key] = count;
  }
  return values;
}

function hasExactFieldValues<T extends Record<string, string>>(
  record: Record<string, unknown>,
  expected: T,
): boolean {
  return Object.entries(expected).every(
    ([key, value]) => record[key] === value,
  );
}

function readRequiredEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
): T | undefined {
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : undefined;
}

function readOptionalEnumFields<
  T extends readonly [string, ReadonlySet<string>][],
>(
  record: Record<string, unknown>,
  specs: T,
): Record<string, string> | undefined {
  const values: Record<string, string> = {};
  for (const [key, allowed] of specs) {
    const value = readOptionalEnum(record[key], allowed);
    if (value === false) return undefined;
    if (value !== undefined) values[key] = value;
  }
  return values;
}

function readOptionalEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
): T | undefined | false {
  if (value === undefined) return undefined;
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : false;
}

function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStrictIsoUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isPlainObjectCandidate(
  value: unknown,
): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !isArrayValue(value as object)
  );
}

function isArrayValue(value: object): boolean {
  try {
    return Array.isArray(value);
  } catch {
    return true;
  }
}

function hasPlainObjectPrototype(value: Record<string, unknown>): boolean {
  try {
    return Object.getPrototypeOf(value) === Object.prototype;
  } catch {
    return false;
  }
}

function hasOnlyEnumerableDataProperties(
  value: Record<string, unknown>,
): boolean {
  try {
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (descriptor) =>
        descriptor.enumerable &&
        !("get" in descriptor) &&
        !("set" in descriptor),
    );
  } catch {
    return false;
  }
}

function hasSymbolKeys(value: Record<string, unknown>): boolean {
  try {
    return Object.getOwnPropertySymbols(value).length > 0;
  } catch {
    return true;
  }
}
