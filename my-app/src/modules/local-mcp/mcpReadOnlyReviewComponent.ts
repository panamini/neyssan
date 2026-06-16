import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";
import type {
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
      policy: Readonly<Record<LocalMcpComponentDataSurfaceV1, "allowed">>;
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

type SurfacePayload = Readonly<{
  surface: LocalMcpComponentDataSurfaceV1;
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

function readSafeReviewSummary(value: unknown): SafeReviewSummary | undefined {
  const policyResult = validateSurface(
    "component_visible_structured_content",
    value,
  );
  if (!policyResult.allowed) return undefined;
  const record = readPlainObjectRecord(value);
  if (!record) return undefined;
  if (!isSafeReviewSummaryEnvelope(record)) return undefined;
  if (!hasSafeReviewSummaryStatus(record.status)) return undefined;
  return value as SafeReviewSummary;
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
      surfaceStatus: Readonly<
        Record<LocalMcpComponentDataSurfaceV1, "allowed">
      >;
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
  const surfaceStatus = {} as Record<LocalMcpComponentDataSurfaceV1, "allowed">;
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

function hasSafeReviewSummaryStatus(value: unknown): boolean {
  return (
    value === "available" ||
    value === "no_data_available" ||
    value === "onboarding_required"
  );
}

function isPlainObjectCandidate(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasPlainObjectPrototype(value: Record<string, unknown>): boolean {
  return Object.getPrototypeOf(value) === Object.prototype;
}

function hasOnlyEnumerableDataProperties(
  value: Record<string, unknown>,
): boolean {
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) =>
      descriptor.enumerable && !("get" in descriptor) && !("set" in descriptor),
  );
}

function hasSymbolKeys(value: Record<string, unknown>): boolean {
  return Object.getOwnPropertySymbols(value).length > 0;
}
