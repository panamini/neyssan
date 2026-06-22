import {
  validateLocalMcpComponentDataPolicy,
  type LocalMcpComponentDataPolicyResultV1,
  type LocalMcpComponentDataSurfaceV1,
} from "./mcpComponentDataPolicy";

export type McpComponentErrorLoadingRefusalUxReasonV1 =
  | "loading"
  | "missing_consent"
  | "missing_auth"
  | "missing_account_link"
  | "expired_auth"
  | "privacy_blocked"
  | "unavailable_review_data"
  | "budget_exceeded"
  | "unsafe_action_refused"
  | "safe_unavailable"
  | "safe_refusal";

export type McpComponentErrorLoadingRefusalUxCategoryV1 =
  | "loading"
  | "unavailable"
  | "error"
  | "refusal";

export type McpComponentErrorLoadingRefusalUxStatusV1 =
  | "pending"
  | "onboarding_required"
  | "no_data_available"
  | "blocked";

export type McpComponentErrorLoadingRefusalUxActionLabelV1 =
  | "add_application_context"
  | "ready_for_review"
  | "refresh_inputs"
  | "review_blockers";

export type McpComponentErrorLoadingRefusalUxContentBlockV1 = Readonly<{
  type: "text";
  text: string;
}>;

export type McpComponentErrorLoadingRefusalUxStateV1 = Readonly<{
  kind: "mcp_component_error_loading_refusal_ux_state";
  allowed: true;
  status: McpComponentErrorLoadingRefusalUxStatusV1;
  reason: McpComponentErrorLoadingRefusalUxReasonV1;
  category: McpComponentErrorLoadingRefusalUxCategoryV1;
  title: string;
  message: string;
  safeSummary: string;
  nextUserAction: McpComponentErrorLoadingRefusalUxActionLabelV1;
  refIds: readonly string[];
  safeCounts: McpComponentErrorLoadingRefusalUxCountsV1;
  safeFlags: McpComponentErrorLoadingRefusalUxFlagsV1;
  modelVisible: true;
  componentVisible: true;
  version: 1;
}>;

export type McpComponentErrorLoadingRefusalUxCountsV1 = Readonly<{
  blockers: number;
  warnings: number;
  version: 1;
}>;

export type McpComponentErrorLoadingRefusalUxFlagsV1 = Readonly<{
  approvalNeeded: boolean;
  staleData: boolean;
  overLimit: boolean;
  version: 1;
}>;

export type McpComponentErrorLoadingRefusalUxSurfacePayloadsV1 = Readonly<{
  structuredContent: McpComponentErrorLoadingRefusalUxStateV1;
  content: readonly McpComponentErrorLoadingRefusalUxContentBlockV1[];
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
  bridgePayload: Record<string, unknown>;
  stateSnapshot: Record<string, unknown>;
  modelContextUpdate: Record<string, unknown>;
  actionLabel: McpComponentErrorLoadingRefusalUxActionLabelV1;
}>;

export type McpComponentErrorLoadingRefusalUxCapabilitiesV1 = Readonly<{
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

export type McpComponentErrorLoadingRefusalUxSafeRefusalV1 = Readonly<{
  kind: "local_mcp_component_data_policy_safe_error";
  code: "component_error_loading_refusal_ux_blocked";
  message: "Refused. Component UX state blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpComponentErrorLoadingRefusalUxResultV1 = Readonly<
  | {
      kind: "mcp_component_error_loading_refusal_ux_result";
      allowed: true;
      reason: "safe_ux_state_projected";
      component: McpComponentErrorLoadingRefusalUxSurfacePayloadsV1;
      policy: McpComponentErrorLoadingRefusalUxPolicyStatusV1;
      capabilities: McpComponentErrorLoadingRefusalUxCapabilitiesV1;
      componentVisible: true;
      modelVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_component_error_loading_refusal_ux_result";
      allowed: false;
      reason: "invalid_input" | "policy_blocked";
      safeRefusal: McpComponentErrorLoadingRefusalUxSafeRefusalV1;
      policy?: LocalMcpComponentDataPolicyResultV1;
      capabilities: McpComponentErrorLoadingRefusalUxCapabilitiesV1;
      componentVisible: false;
      modelVisible: true;
      version: 1;
    }
>;

type McpComponentErrorLoadingRefusalUxPolicySurfaceV1 = Extract<
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

type McpComponentErrorLoadingRefusalUxPolicyStatusV1 = Readonly<
  Record<McpComponentErrorLoadingRefusalUxPolicySurfaceV1, "allowed">
>;

type ParsedInput = Readonly<{
  reason: McpComponentErrorLoadingRefusalUxReasonV1;
  refIds: readonly string[];
}>;

type SurfacePayload = Readonly<{
  surface: McpComponentErrorLoadingRefusalUxPolicySurfaceV1;
  payload: unknown;
}>;

type UxReasonConfig = Readonly<{
  category: McpComponentErrorLoadingRefusalUxCategoryV1;
  status: McpComponentErrorLoadingRefusalUxStatusV1;
  title: string;
  message: string;
  safeSummary: string;
  actionLabel: McpComponentErrorLoadingRefusalUxActionLabelV1;
  blockers: number;
  warnings: number;
  approvalNeeded: boolean;
  staleData: boolean;
  overLimit: boolean;
}>;

const DEFAULT_REF_IDS = ["mcp-safe-ref:review-cockpit:latest"] as const;
const MAX_REF_IDS = 25;

const UX_REASONS = new Set<McpComponentErrorLoadingRefusalUxReasonV1>([
  "loading",
  "missing_consent",
  "missing_auth",
  "missing_account_link",
  "expired_auth",
  "privacy_blocked",
  "unavailable_review_data",
  "budget_exceeded",
  "unsafe_action_refused",
  "safe_unavailable",
  "safe_refusal",
]);

const INPUT_KEYS = new Set(["kind", "uxState", "version"]);
const INPUT_REQUIRED_KEYS = ["kind", "uxState", "version"] as const;
const UX_STATE_INPUT_KEYS = new Set(["kind", "reason", "refIds", "version"]);
const UX_STATE_INPUT_REQUIRED_KEYS = ["kind", "reason", "version"] as const;

const UX_REASON_CONFIG: Record<
  McpComponentErrorLoadingRefusalUxReasonV1,
  UxReasonConfig
> = {
  loading: {
    category: "loading",
    status: "pending",
    title: "Review state pending",
    message: "Review state is loading.",
    safeSummary: "Review state is pending.",
    actionLabel: "refresh_inputs",
    blockers: 0,
    warnings: 0,
    approvalNeeded: false,
    staleData: false,
    overLimit: false,
  },
  missing_consent: {
    category: "unavailable",
    status: "onboarding_required",
    title: "Consent required",
    message: "Consent is required before review state can be shown.",
    safeSummary: "Review state is waiting for consent.",
    actionLabel: "add_application_context",
    blockers: 1,
    warnings: 0,
    approvalNeeded: true,
    staleData: false,
    overLimit: false,
  },
  missing_auth: {
    category: "unavailable",
    status: "onboarding_required",
    title: "Authorization required",
    message: "Authorization is required before review state can be shown.",
    safeSummary: "Review state is waiting for authorization.",
    actionLabel: "add_application_context",
    blockers: 1,
    warnings: 0,
    approvalNeeded: true,
    staleData: false,
    overLimit: false,
  },
  missing_account_link: {
    category: "unavailable",
    status: "onboarding_required",
    title: "Account link required",
    message: "Account link is required before review state can be shown.",
    safeSummary: "Review state is waiting for account link.",
    actionLabel: "add_application_context",
    blockers: 1,
    warnings: 0,
    approvalNeeded: true,
    staleData: false,
    overLimit: false,
  },
  expired_auth: {
    category: "unavailable",
    status: "onboarding_required",
    title: "Authorization refresh required",
    message: "Authorization refresh is required before review state can be shown.",
    safeSummary: "Review state is waiting for authorization refresh.",
    actionLabel: "add_application_context",
    blockers: 1,
    warnings: 0,
    approvalNeeded: true,
    staleData: false,
    overLimit: false,
  },
  privacy_blocked: {
    category: "refusal",
    status: "blocked",
    title: "Privacy policy blocked",
    message: "Privacy policy blocked this component state.",
    safeSummary: "Review state is blocked by privacy policy.",
    actionLabel: "review_blockers",
    blockers: 1,
    warnings: 0,
    approvalNeeded: false,
    staleData: false,
    overLimit: false,
  },
  unavailable_review_data: {
    category: "unavailable",
    status: "no_data_available",
    title: "Review data unavailable",
    message: "Review data is unavailable.",
    safeSummary: "No review state is available yet.",
    actionLabel: "add_application_context",
    blockers: 0,
    warnings: 1,
    approvalNeeded: false,
    staleData: false,
    overLimit: false,
  },
  budget_exceeded: {
    category: "error",
    status: "blocked",
    title: "Budget limit reached",
    message: "Budget limit reached for this component state.",
    safeSummary: "Review state is blocked by budget policy.",
    actionLabel: "review_blockers",
    blockers: 1,
    warnings: 0,
    approvalNeeded: false,
    staleData: false,
    overLimit: true,
  },
  unsafe_action_refused: {
    category: "refusal",
    status: "blocked",
    title: "Action refused",
    message: "Unsafe action was refused.",
    safeSummary: "Review state refused an unsafe action.",
    actionLabel: "review_blockers",
    blockers: 1,
    warnings: 0,
    approvalNeeded: false,
    staleData: false,
    overLimit: false,
  },
  safe_unavailable: {
    category: "unavailable",
    status: "no_data_available",
    title: "Review state unavailable",
    message: "Review state is unavailable.",
    safeSummary: "Review state is safely unavailable.",
    actionLabel: "ready_for_review",
    blockers: 0,
    warnings: 1,
    approvalNeeded: false,
    staleData: false,
    overLimit: false,
  },
  safe_refusal: {
    category: "refusal",
    status: "blocked",
    title: "Review state refused",
    message: "Review state was safely refused.",
    safeSummary: "Review state is safely refused.",
    actionLabel: "review_blockers",
    blockers: 1,
    warnings: 0,
    approvalNeeded: false,
    staleData: false,
    overLimit: false,
  },
};

export function buildMcpComponentErrorLoadingRefusalUx(
  input: unknown,
): McpComponentErrorLoadingRefusalUxResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput) return deny("invalid_input");

  const state = buildUxState(parsedInput);
  const component = buildComponentPayloads(state);
  const policy = validateComponentPayloads(component);
  if (!policy.ok) return deny("policy_blocked", policy.result);

  return {
    kind: "mcp_component_error_loading_refusal_ux_result",
    allowed: true,
    reason: "safe_ux_state_projected",
    component,
    policy: policy.surfaceStatus,
    capabilities: buildCapabilities("policy_checked", "view_model_only"),
    componentVisible: true,
    modelVisible: true,
    version: 1,
  };
}

export function buildMcpComponentErrorLoadingRefusalUxSafeRefusal(): McpComponentErrorLoadingRefusalUxSafeRefusalV1 {
  return {
    kind: "local_mcp_component_data_policy_safe_error",
    code: "component_error_loading_refusal_ux_blocked",
    message: "Refused. Component UX state blocked.",
    safeForModel: true,
    rawDataExposed: false,
    componentDataExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseInput(input: unknown): ParsedInput | undefined {
  const record = readPlainObjectRecord(input);
  if (!record) return undefined;
  if (!hasOnlyAllowedKeys(record, INPUT_KEYS)) return undefined;
  if (!hasOwnRequiredKeys(record, INPUT_REQUIRED_KEYS)) return undefined;
  if (
    record.kind !== "mcp_component_error_loading_refusal_ux_input" ||
    record.version !== 1
  ) {
    return undefined;
  }

  return parseUxState(record.uxState);
}

function parseUxState(input: unknown): ParsedInput | undefined {
  const record = readPlainObjectRecord(input);
  if (!record) return undefined;
  if (!hasOnlyAllowedKeys(record, UX_STATE_INPUT_KEYS)) return undefined;
  if (!hasOwnRequiredKeys(record, UX_STATE_INPUT_REQUIRED_KEYS))
    return undefined;
  if (
    record.kind !== "mcp_component_error_loading_refusal_ux_state_input" ||
    record.version !== 1 ||
    !isUxReason(record.reason)
  ) {
    return undefined;
  }

  const refIds =
    record.refIds === undefined ? DEFAULT_REF_IDS : readSafeRefIds(record.refIds);
  return refIds ? { reason: record.reason, refIds } : undefined;
}

function buildUxState({
  reason,
  refIds,
}: ParsedInput): McpComponentErrorLoadingRefusalUxStateV1 {
  const config = UX_REASON_CONFIG[reason];
  return {
    kind: "mcp_component_error_loading_refusal_ux_state",
    allowed: true,
    status: config.status,
    reason,
    category: config.category,
    title: config.title,
    message: config.message,
    safeSummary: config.safeSummary,
    nextUserAction: config.actionLabel,
    refIds,
    safeCounts: {
      blockers: config.blockers,
      warnings: config.warnings,
      version: 1,
    },
    safeFlags: {
      approvalNeeded: config.approvalNeeded,
      staleData: config.staleData,
      overLimit: config.overLimit,
      version: 1,
    },
    modelVisible: true,
    componentVisible: true,
    version: 1,
  };
}

function buildComponentPayloads(
  state: McpComponentErrorLoadingRefusalUxStateV1,
): McpComponentErrorLoadingRefusalUxSurfacePayloadsV1 {
  const shared = {
    status: state.status,
    reason: state.reason,
    category: state.category,
    nextUserAction: state.nextUserAction,
    refIds: state.refIds,
    safeCounts: state.safeCounts,
    safeFlags: state.safeFlags,
    version: 1,
  } as const;

  return {
    structuredContent: state,
    content: [
      { type: "text", text: state.message },
      { type: "text", text: actionText(state.nextUserAction) },
    ],
    meta: {
      kind: "local_mcp_component_data_policy_safe_meta",
      ...shared,
    },
    props: {
      kind: "local_mcp_component_data_policy_safe_props",
      title: state.title,
      message: state.message,
      safeSummary: state.safeSummary,
      ...shared,
    },
    bridgePayload: {
      kind: "local_mcp_component_data_policy_safe_bridge_payload",
      ...shared,
    },
    stateSnapshot: {
      kind: "local_mcp_component_data_policy_safe_state_snapshot",
      title: state.title,
      safeSummary: state.safeSummary,
      safeRefs: state.refIds,
      ...shared,
    },
    modelContextUpdate: {
      kind: "local_mcp_component_data_policy_safe_model_context_update",
      safeSummary: state.safeSummary,
      ...shared,
    },
    actionLabel: state.nextUserAction,
  };
}

function validateComponentPayloads(
  component: McpComponentErrorLoadingRefusalUxSurfacePayloadsV1,
):
  | Readonly<{
      ok: true;
      surfaceStatus: McpComponentErrorLoadingRefusalUxPolicyStatusV1;
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
    McpComponentErrorLoadingRefusalUxPolicySurfaceV1,
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

function actionText(
  actionLabel: McpComponentErrorLoadingRefusalUxActionLabelV1,
): string {
  switch (actionLabel) {
    case "add_application_context":
      return "Next action: add app ctx.";
    case "refresh_inputs":
      return "Next action: refresh inputs.";
    case "review_blockers":
      return "Next action: review blockers.";
    case "ready_for_review":
      return "Next action: review ready state.";
  }
}

function isUxReason(
  value: unknown,
): value is McpComponentErrorLoadingRefusalUxReasonV1 {
  return (
    typeof value === "string" &&
    UX_REASONS.has(value as McpComponentErrorLoadingRefusalUxReasonV1)
  );
}

function readSafeRefIds(value: unknown): readonly string[] | undefined {
  try {
    if (!Array.isArray(value) || value.length > MAX_REF_IDS) return undefined;

    const items: string[] = [];
    for (const item of value) {
      if (typeof item !== "string" || !isSafeOpaqueRefId(item)) return undefined;
      items.push(item);
    }
    return Object.freeze(items);
  } catch {
    return undefined;
  }
}

function deny(
  reason: "invalid_input" | "policy_blocked",
  policy?: LocalMcpComponentDataPolicyResultV1,
): McpComponentErrorLoadingRefusalUxResultV1 {
  return {
    kind: "mcp_component_error_loading_refusal_ux_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpComponentErrorLoadingRefusalUxSafeRefusal(),
    ...(policy ? { policy } : {}),
    capabilities: buildCapabilities("blocked", "blocked"),
    componentVisible: false,
    modelVisible: true,
    version: 1,
  };
}

function buildCapabilities(
  componentData: McpComponentErrorLoadingRefusalUxCapabilitiesV1["componentData"],
  componentRendering: McpComponentErrorLoadingRefusalUxCapabilitiesV1["componentRendering"],
): McpComponentErrorLoadingRefusalUxCapabilitiesV1 {
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

function readPlainObjectRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || isArrayValue(value))
    return undefined;
  const prototype = readObjectPrototype(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  return readEnumerableDataRecord(value);
}

function isArrayValue(value: object): boolean {
  try {
    return Array.isArray(value);
  } catch {
    return true;
  }
}

function readObjectPrototype(value: object): object | null | undefined {
  try {
    return Object.getPrototypeOf(value) as object | null;
  } catch {
    return undefined;
  }
}

function readEnumerableDataRecord(
  value: object,
): Record<string, unknown> | undefined {
  const entries = readEnumerableDataEntries(value);
  if (!entries) return undefined;

  const record: Record<string, unknown> = Object.create(null);
  for (const [key, item] of entries) {
    record[key] = item;
  }
  return record;
}

function readEnumerableDataEntries(
  value: object,
): readonly (readonly [string, unknown])[] | undefined {
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
      PropertyKey,
      PropertyDescriptor | undefined
    >;
    const entries: [string, unknown][] = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = descriptors[key];
      if (!isEnumerableDataDescriptor(descriptor)) return undefined;
      const directValue = (value as Record<string, unknown>)[key];
      if (directValue !== descriptor.value) return undefined;
      entries.push([key, descriptor.value]);
    }
    return entries;
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

function hasOnlyAllowedKeys(
  record: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function hasOwnRequiredKeys(
  record: Record<string, unknown>,
  requiredKeys: readonly string[],
): boolean {
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) return false;
  }
  return true;
}

function isSafeOpaqueRefId(value: string): boolean {
  const safeRefPattern =
    /^mcp-safe-ref:(?:application-package|evidence-graph|resume-variant-plan|review-cockpit):[a-z0-9][a-z0-9._:-]{0,64}$/u;
  return safeRefPattern.test(value);
}
