export type LocalMcpComponentDataSurfaceV1 =
  | "model_visible_structured_content"
  | "model_visible_content"
  | "component_visible_structured_content"
  | "component_visible_content"
  | "component_visible_meta"
  | "component_visible_props"
  | "component_visible_bridge_payload"
  | "component_visible_state_snapshot"
  | "component_visible_model_context_update"
  | "component_visible_error"
  | "component_visible_action_label";

export type LocalMcpComponentDataPolicyClassificationV1 =
  | "safe_structured_content"
  | "safe_content"
  | "safe_meta"
  | "safe_props"
  | "safe_bridge_payload"
  | "safe_state_snapshot"
  | "safe_model_context_update"
  | "safe_error"
  | "safe_action_label";

export type LocalMcpComponentDataPolicyBlockedReasonV1 =
  | "invalid_input"
  | "unknown_surface"
  | "unknown_component_field"
  | "unsafe_component_payload"
  | "unsafe_component_text"
  | "unsafe_component_ref"
  | "unsafe_component_action"
  | "uninspectable_component_payload"
  | "component_payload_too_deep";

export type LocalMcpComponentDataPolicyCapabilitiesV1 = Readonly<{
  componentData: "blocked" | "policy_checked";
  componentRendering: "blocked";
  componentRuntime: "blocked";
  uiBridgeRuntime: "blocked";
  toolCalls: "blocked";
  modelContextRuntime: "blocked";
  dataWrites: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  rawDataProjection: "blocked";
  credentialStorage: "none";
  version: 1;
}>;

export type LocalMcpComponentDataPolicySafeRefusalV1 = Readonly<{
  code: "component_data_policy_blocked";
  message: "Refused. Component data policy blocked.";
  safeForModel: true;
  rawDataExposed: false;
  componentDataExposed: false;
  version: 1;
}>;

export type LocalMcpComponentDataPolicyInputV1 = Readonly<{
  kind: "local_mcp_component_data_policy_input";
  surface: LocalMcpComponentDataSurfaceV1;
  payload: unknown;
  version: 1;
}>;

export type LocalMcpComponentDataPolicyResultV1 = Readonly<
  | {
      kind: "local_mcp_component_data_policy_result";
      allowed: true;
      surface: LocalMcpComponentDataSurfaceV1;
      classification: LocalMcpComponentDataPolicyClassificationV1;
      safePayload: unknown;
      capabilities: LocalMcpComponentDataPolicyCapabilitiesV1;
      componentVisible: boolean;
      modelVisible: boolean;
      version: 1;
    }
  | {
      kind: "local_mcp_component_data_policy_result";
      allowed: false;
      reason: LocalMcpComponentDataPolicyBlockedReasonV1;
      safeRefusal: LocalMcpComponentDataPolicySafeRefusalV1;
      capabilities: LocalMcpComponentDataPolicyCapabilitiesV1;
      componentVisible: false;
      modelVisible: true;
      version: 1;
    }
>;

type ValidationResult = Readonly<{ ok: true }> | Readonly<{ ok: false; reason: LocalMcpComponentDataPolicyBlockedReasonV1 }>;

const INPUT_KEYS = ["kind", "surface", "payload", "version"] as const;
const INPUT_REQUIRED_KEYS = ["kind", "surface", "payload", "version"] as const;
const CONTENT_BLOCK_KEYS = ["type", "text"] as const;
const MAX_SAFE_TEXT_LENGTH = 500;
const MAX_SAFE_LABEL_LENGTH = 120;
const MAX_SAFE_CONTENT_TEXT_LENGTH = 180;
const MAX_SAFE_ARRAY_LENGTH = 25;
const MAX_SAFE_COUNT = 1000;
const MAX_COMPONENT_DATA_DEPTH = 7;

export const LOCAL_MCP_COMPONENT_DATA_POLICY_SURFACES_V1: readonly LocalMcpComponentDataSurfaceV1[] = [
  "model_visible_structured_content",
  "model_visible_content",
  "component_visible_structured_content",
  "component_visible_content",
  "component_visible_meta",
  "component_visible_props",
  "component_visible_bridge_payload",
  "component_visible_state_snapshot",
  "component_visible_model_context_update",
  "component_visible_error",
  "component_visible_action_label",
] as const;

const COMPONENT_VISIBLE_SURFACES = new Set<LocalMcpComponentDataSurfaceV1>([
  "component_visible_structured_content",
  "component_visible_content",
  "component_visible_meta",
  "component_visible_props",
  "component_visible_bridge_payload",
  "component_visible_state_snapshot",
  "component_visible_model_context_update",
  "component_visible_error",
  "component_visible_action_label",
]);

const MODEL_VISIBLE_SURFACES = new Set<LocalMcpComponentDataSurfaceV1>([
  "model_visible_structured_content",
  "model_visible_content",
  "component_visible_model_context_update",
]);

const CLASSIFICATION_BY_SURFACE: Readonly<
  Record<LocalMcpComponentDataSurfaceV1, LocalMcpComponentDataPolicyClassificationV1>
> = {
  model_visible_structured_content: "safe_structured_content",
  model_visible_content: "safe_content",
  component_visible_structured_content: "safe_structured_content",
  component_visible_content: "safe_content",
  component_visible_meta: "safe_meta",
  component_visible_props: "safe_props",
  component_visible_bridge_payload: "safe_bridge_payload",
  component_visible_state_snapshot: "safe_state_snapshot",
  component_visible_model_context_update: "safe_model_context_update",
  component_visible_error: "safe_error",
  component_visible_action_label: "safe_action_label",
};

const ALLOWED_COMPONENT_DATA_KEYS = new Set([
  "adapter",
  "acceptedItems",
  "allowed",
  "allowedClaims",
  "applicationPackageRef",
  "applicationPackages",
  "approvalNeeded",
  "approvedFacts",
  "approvedReviews",
  "archivedEvidence",
  "artifactTextBlockers",
  "artifacts",
  "availability",
  "blockerCategory",
  "blockers",
  "blockedArtifacts",
  "blockedItems",
  "blockedPackages",
  "blockedReviews",
  "blockedRuns",
  "capabilities",
  "category",
  "candidateFacts",
  "claimBackedItems",
  "code",
  "componentDataExposed",
  "componentVisible",
  "count",
  "coverLetterArtifactStatus",
  "credentialStorage",
  "credentialsExposed",
  "dataReads",
  "dataWrites",
  "demands",
  "evidenceCoverage",
  "evidenceGraphRef",
  "evidenceMatches",
  "excludedFactBlockers",
  "exportActions",
  "failedRuns",
  "handlerExecution",
  "id",
  "kind",
  "label",
  "message",
  "missingDataReason",
  "missingEvidence",
  "missingInputCategory",
  "missingInputItems",
  "missingReviewCategory",
  "missingReviewItems",
  "modelCalls",
  "modelVisible",
  "networkAccess",
  "nextReviewHint",
  "nextUserAction",
  "ownerIdentityExposed",
  "ownerResolution",
  "ownerState",
  "overLimit",
  "overLimitCollections",
  "packageRef",
  "packageStatus",
  "packages",
  "pendingFacts",
  "pendingReviews",
  "planItems",
  "planStatus",
  "plans",
  "productionConnector",
  "provenanceCoverage",
  "provenanceLinks",
  "qualityStatus",
  "rawDataExposed",
  "rawDataProjection",
  "reason",
  "refIds",
  "rejectedFacts",
  "rejectedItems",
  "restrictedEvidence",
  "restrictedFactBlockers",
  "resumeVariantArtifactStatus",
  "resumeVariantPlanRef",
  "riskFlags",
  "reviewArtifacts",
  "reviewContexts",
  "reviewGateStatus",
  "reviewItems",
  "reviewNeededCategory",
  "reviewNeededItems",
  "reviewReadiness",
  "reviewRuns",
  "reviewCockpitRef",
  "safeBooleans",
  "safeCategories",
  "safeCounts",
  "safeFlags",
  "safeForModel",
  "safeRefusal",
  "safeRefs",
  "safeSummary",
  "sourceDocuments",
  "sourceFacts",
  "src",
  "staleData",
  "staleInputs",
  "staleSources",
  "status",
  "tailoringCompleteness",
  "targetDocumentKind",
  "text",
  "title",
  "tokenStorage",
  "type",
  "updatedAt",
  "version",
  "warnings",
  "writeActionExecuted",
  "writeActions",
]);

const NUMERIC_KEYS = new Set([
  "acceptedItems",
  "allowedClaims",
  "applicationPackages",
  "approvalNeeded",
  "approvedFacts",
  "approvedReviews",
  "archivedEvidence",
  "artifactTextBlockers",
  "artifacts",
  "blockers",
  "blockedArtifacts",
  "blockedItems",
  "blockedPackages",
  "blockedReviews",
  "blockedRuns",
  "candidateFacts",
  "claimBackedItems",
  "count",
  "demands",
  "evidenceMatches",
  "excludedFactBlockers",
  "failedRuns",
  "missingEvidence",
  "missingInputItems",
  "missingReviewItems",
  "overLimitCollections",
  "packages",
  "pendingFacts",
  "pendingReviews",
  "planItems",
  "plans",
  "provenanceLinks",
  "rejectedFacts",
  "rejectedItems",
  "restrictedEvidence",
  "restrictedFactBlockers",
  "riskFlags",
  "reviewArtifacts",
  "reviewContexts",
  "reviewItems",
  "reviewNeededItems",
  "reviewRuns",
  "sourceDocuments",
  "sourceFacts",
  "staleInputs",
  "staleSources",
  "warnings",
]);

const BOOLEAN_KEYS = new Set([
  "allowed",
  "approvalNeeded",
  "componentDataExposed",
  "componentVisible",
  "credentialsExposed",
  "modelVisible",
  "overLimit",
  "ownerIdentityExposed",
  "rawDataExposed",
  "safeForModel",
  "staleData",
  "writeActionExecuted",
]);

const TEXT_KEYS = new Set(["label", "message", "safeSummary", "text", "title"]);

const REF_ARRAY_KEYS = new Set(["refIds", "safeRefs"]);

const SAFE_ACTION_LABELS = new Set([
  "add_application_context",
  "approve_review_gate",
  "ready_for_review",
  "refresh_inputs",
  "refresh_stale_inputs",
  "review_blockers",
  "review_missing_inputs",
  "review_pending_items",
  "review_plan_items",
]);

const ALLOWED_SAFE_STRING_VALUES = new Set([
  "add_application_context",
  "add_candidate_evidence",
  "application_package",
  "application_package_not_available",
  "application_package_ref_missing",
  "available",
  "blocked",
  "blocked_artifact",
  "blocked_package",
  "blocked_run",
  "component_data_policy_blocked",
  "complete",
  "convex_application_package_summary",
  "convex_evidence_graph_summary",
  "convex_resume_variant_plan_summary",
  "convex_review_cockpit_summary",
  "cv",
  "draft",
  "evidence_graph",
  "evidence_graph_not_available",
  "evidence_graph_ref_missing",
  "failed_run",
  "generated_text_as_fact",
  "missing",
  "missing_application_package",
  "missing_claims",
  "missing_evidence",
  "missing_input",
  "missing_plan_items",
  "missing_review_artifact",
  "missing_review_context",
  "needs_review",
  "needs_user_review",
  "never_use_fact",
  "no_data_available",
  "no_plan",
  "none",
  "onboarding_required",
  "owner_onboarding_required",
  "partial",
  "pending_review_items",
  "private_fact",
  "pr59_read_only_adapter",
  "pr59_read_only_adapter_verified",
  "ready",
  "ready_for_generation",
  "ready_for_review",
  "resolved",
  "resume",
  "resume_variant_plan",
  "resume_variant_plan_not_available",
  "resume_variant_plan_ref_missing",
  "restricted_evidence",
  "review_blockers",
  "review_items",
  "review_missing_evidence",
  "review_missing_inputs",
  "review_pending_items",
  "review_plan_items",
  "review_restricted_evidence",
  "review_warnings",
  "review_cockpit",
  "review_cockpit_not_available",
  "review_cockpit_ref_missing",
  "server_only",
  "source_truth",
  "stale_sources",
  "summary_unavailable",
  "text",
  "unknown",
  "unsupported",
]);

const ALLOWED_KIND_VALUES = new Set([
  "local_mcp_component_data_policy_safe_bridge_payload",
  "local_mcp_component_data_policy_safe_error",
  "local_mcp_component_data_policy_safe_meta",
  "local_mcp_component_data_policy_safe_model_context_update",
  "local_mcp_component_data_policy_safe_props",
  "local_mcp_component_data_policy_safe_state_snapshot",
  "mcp_real_application_package_summary_result",
  "mcp_real_evidence_graph_summary_result",
  "mcp_real_resume_variant_plan_summary_result",
  "mcp_real_review_cockpit_summary_result",
]);

const ALLOWED_CAPABILITY_VALUES = new Set([
  "blocked",
  "convex_application_package_summary",
  "convex_evidence_graph_summary",
  "convex_resume_variant_plan_summary",
  "convex_review_cockpit_summary",
  "none",
  "pr59_read_only_adapter_verified",
  "server_only",
]);

const FORBIDDEN_KEY_TOKENS = new Set([
  "_id",
  "accesstoken",
  "accountid",
  "authorization",
  "bearer",
  "calltoolresult",
  "claims",
  "clerkid",
  "content",
  "coverletter",
  "cvtext",
  "debug",
  "debugpayload",
  "documentid",
  "email",
  "fullgeneratedartifact",
  "generatedartifact",
  "jobdescription",
  "mcp_tool_result",
  "mcpToolResult",
  "metadata",
  "neveruse",
  "outputtemplate",
  "privatefact",
  "proposaltext",
  "providersubject",
  "raw",
  "rawclaims",
  "rawcvtext",
  "rawdescription",
  "rawjobtext",
  "rawmeta",
  "rawpayload",
  "rawresume",
  "rawresumetext",
  "rawtext",
  "refreshtoken",
  "resumecontent",
  "resumesections",
  "resumetext",
  "securityschemes",
  "sessionid",
  "sourcequote",
  "sourcequotes",
  "sourcetext",
  "structuredshadow",
  "stytchsubject",
  "sub",
  "subject",
  "token",
  "userid",
]);

const FORBIDDEN_TEXT_PATTERNS: readonly RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /\bbearer\s+[A-Za-z0-9._-]+/iu,
  /\b(?:access|refresh)[_-]?token\b/iu,
  /\braw[_ -]?(?:cv|resume|job|proposal|application|text)\b/iu,
  /\b(?:cv|resume|job|proposal|application|cover\s+letter)\s+text\b/iu,
  /\b(?:cv|resume|job|proposal|coverLetter)(?:Text|Content|Description|Sections?)\b/u,
  /\bsource[_ -]?(?:text|quote|quotes)\b/iu,
  /\bprivate[_ -]?fact(?:\s+detail)?\b/iu,
  /\bnever[_ -]?use(?:\s+fact(?:\s+detail)?)?\b/iu,
  /\bfull[_ -]?(?:generated|proposal|artifact)\b/iu,
  /\bgenerated[_ -]?(?:resume[_ -]?variant|application|artifact|cover[_ -]?letter)\s+content\b/iu,
  /\bdear\s+hiring\s+manager\b/iu,
  /\bwe\s+are\s+looking\s+for\b/iu,
  /\b(?:work\s+experience|education|skills)\s*[:\n]/iu,
  /\b(?:clerk|session|stytch|user|account)[_-][a-z0-9._:-]+/iu,
  /\brawClaims\b/u,
  /\bstructured[_ -]?shadow\b/iu,
  /\bdebug\s+payload\b/iu,
  /\bDO_NOT_EXPOSE\b/u,
];

export function validateLocalMcpComponentDataPolicy(input: unknown): LocalMcpComponentDataPolicyResultV1 {
  const record = readPlainObjectRecord(input);
  if (!record || !hasOnlyAllowedKeys(record, INPUT_KEYS) || !hasOwnRequiredKeys(record, INPUT_REQUIRED_KEYS)) {
    return deny("invalid_input");
  }
  if (record.kind !== "local_mcp_component_data_policy_input" || record.version !== 1) {
    return deny("invalid_input");
  }
  if (!isLocalMcpComponentDataSurface(record.surface)) {
    return deny("unknown_surface");
  }

  const surface = record.surface;
  const validation = validatePayloadForSurface(surface, record.payload);
  if (!validation.ok) return deny(validation.reason);

  return {
    kind: "local_mcp_component_data_policy_result",
    allowed: true,
    surface,
    classification: CLASSIFICATION_BY_SURFACE[surface],
    safePayload: cloneSafeComponentPayload(record.payload),
    capabilities: buildCapabilities("policy_checked"),
    componentVisible: COMPONENT_VISIBLE_SURFACES.has(surface),
    modelVisible: MODEL_VISIBLE_SURFACES.has(surface),
    version: 1,
  };
}

export function buildLocalMcpComponentDataPolicySafeRefusal(): LocalMcpComponentDataPolicySafeRefusalV1 {
  return {
    code: "component_data_policy_blocked",
    message: "Refused. Component data policy blocked.",
    safeForModel: true,
    rawDataExposed: false,
    componentDataExposed: false,
    version: 1,
  };
}

export function isLocalMcpComponentDataSurface(value: unknown): value is LocalMcpComponentDataSurfaceV1 {
  return (
    typeof value === "string" &&
    (LOCAL_MCP_COMPONENT_DATA_POLICY_SURFACES_V1 as readonly string[]).includes(value)
  );
}

function validatePayloadForSurface(surface: LocalMcpComponentDataSurfaceV1, payload: unknown): ValidationResult {
  if (surface === "component_visible_action_label") {
    return typeof payload === "string" && SAFE_ACTION_LABELS.has(payload)
      ? { ok: true }
      : { ok: false, reason: "unsafe_component_action" };
  }

  if (surface === "model_visible_content" || surface === "component_visible_content") {
    return validateContentBlocks(payload);
  }

  return validateSafeComponentValue(payload, undefined, 0, new WeakSet<object>());
}

function validateContentBlocks(payload: unknown): ValidationResult {
  if (!Array.isArray(payload) || payload.length > MAX_SAFE_ARRAY_LENGTH) {
    return { ok: false, reason: "unsafe_component_payload" };
  }

  for (const item of payload) {
    const record = readPlainObjectRecord(item);
    if (!record) return { ok: false, reason: "uninspectable_component_payload" };
    if (!hasOnlyAllowedKeys(record, CONTENT_BLOCK_KEYS) || !hasOwnRequiredKeys(record, CONTENT_BLOCK_KEYS)) {
      return { ok: false, reason: "unknown_component_field" };
    }
    if (record.type !== "text" || typeof record.text !== "string") {
      return { ok: false, reason: "unsafe_component_payload" };
    }
    if (!isSafeText(record.text, MAX_SAFE_CONTENT_TEXT_LENGTH)) {
      return { ok: false, reason: "unsafe_component_text" };
    }
  }

  return { ok: true };
}

function validateSafeComponentValue(
  value: unknown,
  key: string | undefined,
  depth: number,
  seen: WeakSet<object>,
): ValidationResult {
  if (depth > MAX_COMPONENT_DATA_DEPTH) return { ok: false, reason: "component_payload_too_deep" };

  if (typeof value === "string") return validateSafeComponentString(key, value);
  if (typeof value === "number") return isSafeCount(value) ? { ok: true } : { ok: false, reason: "unsafe_component_payload" };
  if (typeof value === "boolean") return { ok: true };
  if (value === null || value === undefined) return { ok: false, reason: "unsafe_component_payload" };
  if (typeof value !== "object") return { ok: false, reason: "unsafe_component_payload" };
  if (Array.isArray(value)) return validateSafeComponentArray(value, key, depth, seen);

  return validateSafeComponentRecord(value, depth, seen);
}

function validateSafeComponentArray(
  value: readonly unknown[],
  key: string | undefined,
  depth: number,
  seen: WeakSet<object>,
): ValidationResult {
  if (!key || !REF_ARRAY_KEYS.has(key) || value.length > MAX_SAFE_ARRAY_LENGTH) {
    return { ok: false, reason: "unsafe_component_payload" };
  }
  for (const item of value) {
    if (typeof item !== "string" || !isSafeOpaqueRefId(item)) return { ok: false, reason: "unsafe_component_ref" };
    const nested = validateSafeComponentValue(item, key, depth + 1, seen);
    if (!nested.ok) return nested;
  }
  return { ok: true };
}

function validateSafeComponentRecord(value: object, depth: number, seen: WeakSet<object>): ValidationResult {
  if (seen.has(value)) return { ok: false, reason: "unsafe_component_payload" };
  const record = readPlainObjectRecord(value);
  if (!record) return { ok: false, reason: "uninspectable_component_payload" };

  seen.add(value);
  for (const [key, item] of Object.entries(record)) {
    if (!isAllowedComponentDataKey(key)) {
      seen.delete(value);
      return { ok: false, reason: "unknown_component_field" };
    }

    const validation = validateComponentFieldValue(key, item, depth, seen);
    if (!validation.ok) {
      seen.delete(value);
      return validation;
    }
  }
  seen.delete(value);
  return { ok: true };
}

function validateComponentFieldValue(
  key: string,
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): ValidationResult {
  if (key === "version") return value === 1 ? { ok: true } : { ok: false, reason: "unsafe_component_payload" };
  if (NUMERIC_KEYS.has(key) || BOOLEAN_KEYS.has(key)) {
    const validNumber = NUMERIC_KEYS.has(key) && typeof value === "number" && isSafeCount(value);
    const validBoolean = BOOLEAN_KEYS.has(key) && typeof value === "boolean";
    return validNumber || validBoolean ? { ok: true } : { ok: false, reason: "unsafe_component_payload" };
  }
  return validateSafeComponentValue(value, key, depth + 1, seen);
}

function validateSafeComponentString(key: string | undefined, value: string): ValidationResult {
  if (!key) return validateSafeFreeText(value);

  const knownStringValidator = componentStringValidatorForKey(key);
  if (knownStringValidator) return knownStringValidator(value);
  if (REF_ARRAY_KEYS.has(key)) return validateSafeRefString(value);
  if (TEXT_KEYS.has(key)) return validateSafeTextFieldString(key, value);
  if (isCapabilityKey(key)) return validateCapabilityString(value);
  return validateAllowedSafeStringValue(value);
}

type ComponentStringValidator = (value: string) => ValidationResult;

function componentStringValidatorForKey(key: string): ComponentStringValidator | undefined {
  if (key === "kind") return validateKindString;
  if (key === "id") return validateSafeRefString;
  if (key === "updatedAt") return validateUpdatedAtString;
  if (key === "type") return validateTextBlockTypeString;
  return undefined;
}

function validateSafeFreeText(value: string): ValidationResult {
  return isSafeText(value, MAX_SAFE_TEXT_LENGTH) ? { ok: true } : { ok: false, reason: "unsafe_component_text" };
}

function validateKindString(value: string): ValidationResult {
  return ALLOWED_KIND_VALUES.has(value) ? { ok: true } : { ok: false, reason: "unsafe_component_payload" };
}

function validateSafeRefString(value: string): ValidationResult {
  return isSafeOpaqueRefId(value) ? { ok: true } : { ok: false, reason: "unsafe_component_ref" };
}

function validateUpdatedAtString(value: string): ValidationResult {
  return isStrictIsoUtcTimestamp(value) ? { ok: true } : { ok: false, reason: "unsafe_component_payload" };
}

function validateTextBlockTypeString(value: string): ValidationResult {
  return value === "text" ? { ok: true } : { ok: false, reason: "unsafe_component_payload" };
}

function validateSafeTextFieldString(key: string, value: string): ValidationResult {
  const maxLength = key === "label" || key === "title" ? MAX_SAFE_LABEL_LENGTH : MAX_SAFE_TEXT_LENGTH;
  return isSafeText(value, maxLength) ? { ok: true } : { ok: false, reason: "unsafe_component_text" };
}

function validateCapabilityString(value: string): ValidationResult {
  return ALLOWED_CAPABILITY_VALUES.has(value) ? { ok: true } : { ok: false, reason: "unsafe_component_payload" };
}

function validateAllowedSafeStringValue(value: string): ValidationResult {
  const isAllowed = ALLOWED_SAFE_STRING_VALUES.has(value) && !containsForbiddenText(value);
  return isAllowed ? { ok: true } : { ok: false, reason: "unsafe_component_text" };
}

function isAllowedComponentDataKey(key: string): boolean {
  return ALLOWED_COMPONENT_DATA_KEYS.has(key) && !FORBIDDEN_KEY_TOKENS.has(normalizeKeyToken(key));
}

function isCapabilityKey(key: string): boolean {
  return (
    key === "adapter" ||
    key === "credentialStorage" ||
    key === "dataReads" ||
    key === "dataWrites" ||
    key === "exportActions" ||
    key === "handlerExecution" ||
    key === "modelCalls" ||
    key === "networkAccess" ||
    key === "ownerResolution" ||
    key === "productionConnector" ||
    key === "rawDataProjection" ||
    key === "tokenStorage" ||
    key === "writeActions"
  );
}

function deny(reason: LocalMcpComponentDataPolicyBlockedReasonV1): LocalMcpComponentDataPolicyResultV1 {
  return {
    kind: "local_mcp_component_data_policy_result",
    allowed: false,
    reason,
    safeRefusal: buildLocalMcpComponentDataPolicySafeRefusal(),
    capabilities: buildCapabilities("blocked"),
    componentVisible: false,
    modelVisible: true,
    version: 1,
  };
}

function buildCapabilities(
  componentData: LocalMcpComponentDataPolicyCapabilitiesV1["componentData"],
): LocalMcpComponentDataPolicyCapabilitiesV1 {
  return {
    componentData,
    componentRendering: "blocked",
    componentRuntime: "blocked",
    uiBridgeRuntime: "blocked",
    toolCalls: "blocked",
    modelContextRuntime: "blocked",
    dataWrites: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    version: 1,
  };
}

function cloneSafeComponentPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneSafeComponentPayload);
  if (!value || typeof value !== "object") return value;
  const record = readPlainObjectRecord(value);
  if (!record) return undefined;
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, cloneSafeComponentPayload(item)]));
}

function isSafeCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SAFE_COUNT;
}

function isSafeOpaqueRefId(value: string): boolean {
  return (
    /^mcp-safe-ref:(?:application-package|evidence-graph|resume-variant-plan|review-cockpit):[a-z0-9][a-z0-9._:-]{0,64}$/u.test(
      value,
    ) && !containsForbiddenText(value)
  );
}

function isSafeText(value: string, maxLength: number): boolean {
  return typeof value === "string" && /\S/u.test(value) && value.length <= maxLength && !containsForbiddenText(value);
}

function containsForbiddenText(value: string): boolean {
  if (ALLOWED_SAFE_STRING_VALUES.has(value)) return false;
  const normalized = value.normalize("NFKC");
  return FORBIDDEN_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isStrictIsoUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function hasOnlyAllowedKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(record).every((key) => allowedKeys.includes(key));
}

function hasOwnRequiredKeys(record: Record<string, unknown>, requiredKeys: readonly string[]): boolean {
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function readPlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = readObjectPrototype(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  return readEnumerableDataRecord(value);
}

function readObjectPrototype(value: object): object | null | undefined {
  try {
    return Object.getPrototypeOf(value) as object | null;
  } catch {
    return undefined;
  }
}

function readEnumerableDataRecord(value: object): Record<string, unknown> | undefined {
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<PropertyKey, PropertyDescriptor>;
    const record: Record<string, unknown> = Object.create(null);

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = descriptors[key];
      if (!isEnumerableDataDescriptor(descriptor)) return undefined;
      record[key] = descriptor.value;
    }

    return record;
  } catch {
    return undefined;
  }
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return descriptor !== undefined && descriptor.enumerable === true && "value" in descriptor;
}

function normalizeKeyToken(key: string): string {
  return key.normalize("NFKC").replace(/[\s_/-]/gu, "").toLowerCase();
}
