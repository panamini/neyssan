import { validateLocalMcpConsentGate } from "./mcpConsentGate";
import { buildLocalMcpRedactedAuditEntry } from "./mcpRedactedAuditLog";
import { validateLocalMcpRetentionDeletionBoundary } from "./mcpRetentionDeletionBoundary";
import {
  projectLocalMcpSafeConvexSelectorRef,
  type LocalMcpSafeConvexSelectorProjectionRefClassV1,
  type LocalMcpSafeConvexSelectorProjectionStatusV1,
} from "./mcpSafeConvexSelectorProjectionBoundary";
import type {
  McpProductionAccountLinkPersistenceResultV1,
  McpProductionAccountLinkReadScopeV1,
} from "./mcpProductionAccountLinkPersistenceBoundary";
import type {
  McpProductionStytchOAuthConfigBoundaryResultV1,
  McpProductionStytchOAuthReadScopeV1,
} from "./mcpProductionStytchOAuthConfigBoundary";

export type McpReadOnlyTwoweeksDataRefCategoryV1 =
  | "application_package"
  | "evidence_graph"
  | "resume_variant_plan"
  | "review_cockpit";

export type McpReadOnlyTwoweeksDataRefV1 = Readonly<{
  id: string;
  label: string;
  status: LocalMcpSafeConvexSelectorProjectionStatusV1;
  category: McpReadOnlyTwoweeksDataRefCategoryV1;
  count: number;
  updatedAt?: string;
  version: 1;
}>;

export type McpReadOnlyTwoweeksDataBlockedRefClassV1 = Readonly<{
  refClass: LocalMcpSafeConvexSelectorProjectionRefClassV1;
  reason: "missing_class_scope";
  version: 1;
}>;

type McpReadOnlyTwoweeksDataAccountLinkResolutionV1 = Readonly<{
  kind: "mcp_account_link_server_only_owner_resolution";
  provider: "stytch";
  twoweeksClerkId: string;
  grantedReadScopes: readonly McpProductionAccountLinkReadScopeV1[];
  grantRef: string;
  consentRef: string;
  auditReasonCode: string;
  version: 1;
}>;

export type McpReadOnlyTwoweeksDataAdapterInputV1 = Readonly<{
  kind: "mcp_read_only_twoweeks_data_adapter_input";
  authBoundary: McpProductionStytchOAuthConfigBoundaryResultV1;
  accountLinkBoundary: McpProductionAccountLinkPersistenceResultV1;
  accountLinkResolution: unknown;
  consent?: unknown;
  retentionRecord: unknown;
  readOnlyDataRefs: unknown;
  now?: Date;
  version: 1;
}>;

export type McpReadOnlyTwoweeksDataAdapterBlockedReasonV1 =
  | "invalid_input"
  | "auth_required"
  | "account_link_required"
  | "missing_required_scope"
  | "consent_required"
  | "retention_blocked"
  | "data_refs_blocked"
  | "unsafe_projection_blocked";

export type McpReadOnlyTwoweeksDataAdapterSafeRefusalV1 = Readonly<{
  code: "read_only_twoweeks_data_adapter_blocked";
  message: "Refused. Read-only Twoweeks data adapter blocked.";
  safeForModel: true;
  rawDataExposed: false;
  credentialsExposed: false;
  ownerIdentityExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpReadOnlyTwoweeksDataAdapterCapabilitiesV1 = Readonly<{
  auth: "blocked" | "production_stytch_verified";
  accountLink: "blocked" | "server_only_owner_resolved";
  consent: "blocked" | "future_real_data_read";
  audit: "not_evaluated" | "redacted_boundary_checked";
  retention: "blocked" | "boundary_checked";
  dataReads: "blocked" | "convex_read_only_refs";
  dataWrites: "blocked";
  handlerExecution: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  writeActions: "blocked";
  rawDataProjection: "blocked";
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

export type McpReadOnlyTwoweeksDataAdapterResultV1 = Readonly<
  | {
      kind: "mcp_read_only_twoweeks_data_adapter_result";
      allowed: true;
      reason: "read_only_refs_projected" | "read_only_refs_unavailable";
      refs: Readonly<
        Partial<Record<LocalMcpSafeConvexSelectorProjectionRefClassV1, McpReadOnlyTwoweeksDataRefV1>>
      >;
      blockedRefClasses: readonly McpReadOnlyTwoweeksDataBlockedRefClassV1[];
      availabilitySummary: {
        available: number;
        noData: number;
        onboarding: number;
        blocked: number;
        version: 1;
      };
      audit: {
        checked: true;
        persisted: false;
        rawPayloadLogged: false;
        eventId: string;
        redactionCount: number;
        version: 1;
      };
      capabilities: McpReadOnlyTwoweeksDataAdapterCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_read_only_twoweeks_data_adapter_result";
      allowed: false;
      reason: McpReadOnlyTwoweeksDataAdapterBlockedReasonV1;
      safeRefusal: McpReadOnlyTwoweeksDataAdapterSafeRefusalV1;
      capabilities: McpReadOnlyTwoweeksDataAdapterCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
>;

type ParsedDataRefsResult = Readonly<{
  ownerState: "resolved" | "onboarding_required";
  refs: readonly ParsedDataRefCandidate[];
  blockedRefClasses: readonly McpReadOnlyTwoweeksDataBlockedRefClassV1[];
  ownerResolvedServerOnly: boolean;
}>;

type ParsedDataRefCandidate = Readonly<{
  refClass: LocalMcpSafeConvexSelectorProjectionRefClassV1;
  refId: string;
  label: string;
  status: LocalMcpSafeConvexSelectorProjectionStatusV1;
  category: McpReadOnlyTwoweeksDataRefCategoryV1;
  count: number;
  updatedAt?: string;
}>;

type AdapterGateState = Readonly<{
  now: Date;
  grantedScopeSets: readonly (readonly McpProductionStytchOAuthReadScopeV1[])[];
  auditEntry: ReturnType<typeof buildLocalMcpRedactedAuditEntry>;
}>;

type CandidateProjectionResult = Readonly<
  | {
      ok: true;
      refs: Partial<
        Record<LocalMcpSafeConvexSelectorProjectionRefClassV1, McpReadOnlyTwoweeksDataRefV1>
      >;
      blockedRefClasses: readonly McpReadOnlyTwoweeksDataBlockedRefClassV1[];
    }
  | {
      ok: false;
      reason: "unsafe_projection_blocked";
    }
>;

const DATA_REFS_RESULT_KEYS = [
  "kind",
  "ownerState",
  "refs",
  "blockedRefClasses",
  "capabilities",
  "modelVisible",
  "version",
] as const;

const DATA_REF_KEYS = [
  "kind",
  "refClass",
  "refId",
  "label",
  "status",
  "category",
  "count",
  "updatedAt",
  "version",
] as const;

const DATA_REF_REQUIRED_KEYS = [
  "kind",
  "refClass",
  "refId",
  "label",
  "status",
  "category",
  "count",
  "version",
] as const;

const BLOCKED_REF_CLASS_KEYS = ["refClass", "reason", "version"] as const;

const DATA_REFS_CAPABILITY_KEYS = [
  "ownerResolvedServerOnly",
  "dataReads",
  "dataWrites",
  "handlerExecution",
  "productionConnector",
  "networkAccess",
  "modelCalls",
  "writeActions",
  "rawDataProjection",
  "version",
] as const;

const ACCOUNT_LINK_RESOLUTION_KEYS = [
  "kind",
  "provider",
  "twoweeksClerkId",
  "grantedReadScopes",
  "grantRef",
  "consentRef",
  "auditReasonCode",
  "version",
] as const;

const ADAPTER_INPUT_KEYS = [
  "kind",
  "authBoundary",
  "accountLinkBoundary",
  "accountLinkResolution",
  "consent",
  "retentionRecord",
  "readOnlyDataRefs",
  "now",
  "version",
] as const;

const ADAPTER_INPUT_REQUIRED_KEYS = [
  "kind",
  "authBoundary",
  "accountLinkBoundary",
  "accountLinkResolution",
  "retentionRecord",
  "readOnlyDataRefs",
  "version",
] as const;

const MAX_SAFE_COUNT = 100;

const CLASS_SCOPE: Record<
  LocalMcpSafeConvexSelectorProjectionRefClassV1,
  Exclude<McpProductionStytchOAuthReadScopeV1, "twoweeks.mcp.read">
> = {
  applicationPackageRef: "twoweeks.application_package.read",
  evidenceGraphRef: "twoweeks.evidence_graph.read",
  resumeVariantPlanRef: "twoweeks.resume_variant_plan.read",
  reviewCockpitRef: "twoweeks.review_cockpit.read",
};

export function projectMcpReadOnlyTwoweeksDataAdapter(
  input: unknown,
): McpReadOnlyTwoweeksDataAdapterResultV1 {
  const parsedInput = parseAdapterInput(input);
  if (!parsedInput) return deny("invalid_input");

  const gateState = evaluateAdapterGates(parsedInput);
  if (!gateState.ok) return gateState.result;

  const dataRefs = parseDataRefsResult(parsedInput.readOnlyDataRefs);
  if (!dataRefs) {
    return deny(
      containsUnsafeProjectionMaterial(parsedInput.readOnlyDataRefs)
        ? "unsafe_projection_blocked"
        : "data_refs_blocked",
    );
  }
  if (!dataRefs.ownerResolvedServerOnly) return deny("data_refs_blocked");

  const candidateProjection = projectDataRefCandidates(dataRefs, gateState.grantedScopeSets);
  if (!candidateProjection.ok) return deny(candidateProjection.reason);

  const availabilitySummary = summarizeAvailability(
    candidateProjection.refs,
    candidateProjection.blockedRefClasses,
  );

  return {
    kind: "mcp_read_only_twoweeks_data_adapter_result",
    allowed: true,
    reason: availabilitySummary.available > 0 ? "read_only_refs_projected" : "read_only_refs_unavailable",
    refs: candidateProjection.refs,
    blockedRefClasses: candidateProjection.blockedRefClasses,
    availabilitySummary,
    audit: {
      checked: true,
      persisted: false,
      rawPayloadLogged: false,
      eventId: gateState.auditEntry.eventId,
      redactionCount: gateState.auditEntry.redactions.length,
      version: 1,
    },
    capabilities: buildCapabilities({
      auth: "production_stytch_verified",
      accountLink: "server_only_owner_resolved",
      consent: "future_real_data_read",
      audit: "redacted_boundary_checked",
      retention: "boundary_checked",
      dataReads: "convex_read_only_refs",
    }),
    modelVisible: true,
    version: 1,
  };
}

export function buildMcpReadOnlyTwoweeksDataAdapterSafeRefusal(): McpReadOnlyTwoweeksDataAdapterSafeRefusalV1 {
  return {
    code: "read_only_twoweeks_data_adapter_blocked",
    message: "Refused. Read-only Twoweeks data adapter blocked.",
    safeForModel: true,
    rawDataExposed: false,
    credentialsExposed: false,
    ownerIdentityExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function isAuthorized(
  result: McpProductionStytchOAuthConfigBoundaryResultV1,
): result is Extract<McpProductionStytchOAuthConfigBoundaryResultV1, { allowed: true }> {
  return result.allowed === true && result.serverOnly.authState === "verified_access_token";
}

function isAccountLinkAllowed(
  result: McpProductionAccountLinkPersistenceResultV1,
): result is Extract<McpProductionAccountLinkPersistenceResultV1, { allowed: true }> {
  return result.allowed === true && result.serverOnly.linkState === "active";
}

function parseAdapterInput(value: unknown): McpReadOnlyTwoweeksDataAdapterInputV1 | undefined {
  const record = readExactRecord(value, ADAPTER_INPUT_KEYS, ADAPTER_INPUT_REQUIRED_KEYS);
  if (!record || !isAdapterInputEnvelope(record)) return undefined;

  return {
    kind: "mcp_read_only_twoweeks_data_adapter_input",
    authBoundary: record.authBoundary as McpProductionStytchOAuthConfigBoundaryResultV1,
    accountLinkBoundary:
      record.accountLinkBoundary as McpProductionAccountLinkPersistenceResultV1,
    accountLinkResolution: record.accountLinkResolution,
    ...(record.consent !== undefined ? { consent: record.consent } : {}),
    retentionRecord: record.retentionRecord,
    readOnlyDataRefs: record.readOnlyDataRefs,
    ...(record.now !== undefined ? { now: record.now } : {}),
    version: 1,
  };
}

function evaluateAdapterGates(
  input: McpReadOnlyTwoweeksDataAdapterInputV1,
): { ok: true } & AdapterGateState | { ok: false; result: McpReadOnlyTwoweeksDataAdapterResultV1 } {
  if (!isAuthorized(input.authBoundary)) return { ok: false, result: deny("auth_required") };
  if (!isAccountLinkAllowed(input.accountLinkBoundary)) {
    return { ok: false, result: deny("account_link_required") };
  }

  const accountLinkResolution = parseAccountLinkResolution(input.accountLinkResolution);
  if (!accountLinkResolution) return { ok: false, result: deny("account_link_required") };

  const grantedScopeSets = buildGrantedScopeSets(input, accountLinkResolution);
  if (!hasBaseReadScope(grantedScopeSets)) {
    return { ok: false, result: deny("missing_required_scope") };
  }

  const now = input.now ?? new Date();
  if (!isConsentSatisfied(input.consent, now)) {
    return { ok: false, result: deny("consent_required") };
  }
  if (!isRetentionSatisfied(input.retentionRecord, now)) {
    return { ok: false, result: deny("retention_blocked") };
  }

  return {
    ok: true,
    now,
    grantedScopeSets,
    auditEntry: buildAdapterAuditEntry(now),
  };
}

function isAdapterInputEnvelope(
  record: Record<string, unknown>,
): record is Record<string, unknown> & { now?: Date } {
  return Boolean(
    record.kind === "mcp_read_only_twoweeks_data_adapter_input" &&
      record.version === 1 &&
      (record.now === undefined || record.now instanceof Date),
  );
}

function buildGrantedScopeSets(
  input: McpReadOnlyTwoweeksDataAdapterInputV1,
  accountLinkResolution: McpReadOnlyTwoweeksDataAccountLinkResolutionV1,
): readonly (readonly McpProductionStytchOAuthReadScopeV1[])[] {
  return [
    input.authBoundary.serverOnly.grantedReadScopes,
    input.accountLinkBoundary.serverOnly.grantedReadScopes,
    accountLinkResolution.grantedReadScopes,
  ];
}

function hasBaseReadScope(
  grantedScopeSets: readonly (readonly McpProductionStytchOAuthReadScopeV1[])[],
): boolean {
  return grantedScopeSets.every((scopes) => scopes.includes("twoweeks.mcp.read"));
}

function isConsentSatisfied(consent: unknown, now: Date): boolean {
  return validateLocalMcpConsentGate(
    {
      kind: "local_mcp_consent_gate_input",
      requestedSurface: "future_real_data_read",
      ...(consent !== undefined ? { consent } : {}),
      version: 1,
    },
    now,
  ).allowed;
}

function isRetentionSatisfied(retentionRecord: unknown, now: Date): boolean {
  return validateLocalMcpRetentionDeletionBoundary(
    {
      kind: "local_mcp_retention_deletion_input",
      record: retentionRecord,
      version: 1,
    },
    now,
  ).allowed;
}

function buildAdapterAuditEntry(now: Date): ReturnType<typeof buildLocalMcpRedactedAuditEntry> {
  return buildLocalMcpRedactedAuditEntry({
    eventId: "redacted-audit:mcp-read-only-data-refs",
    eventType: "consent_boundary_checked",
    occurredAt: now.toISOString(),
    outcome: "boundary_only",
    toolName: "twoweeks.application_package.summarize",
    localToolId: "local_mcp.application_package.summarize",
    safeSummary: "Read-only data adapter boundaries checked.",
    consentBoundarySatisfied: true,
  });
}

function parseAccountLinkResolution(
  value: unknown,
): McpReadOnlyTwoweeksDataAccountLinkResolutionV1 | undefined {
  const record = readExactRecord(value, ACCOUNT_LINK_RESOLUTION_KEYS, ACCOUNT_LINK_RESOLUTION_KEYS);
  if (!record) return undefined;
  if (!isAccountLinkResolutionShape(record)) return undefined;

  return {
    kind: "mcp_account_link_server_only_owner_resolution",
    provider: "stytch",
    twoweeksClerkId: record.twoweeksClerkId,
    grantedReadScopes: [...record.grantedReadScopes],
    grantRef: record.grantRef,
    consentRef: record.consentRef,
    auditReasonCode: record.auditReasonCode,
    version: 1,
  };
}

function parseDataRefsResult(value: unknown): ParsedDataRefsResult | undefined {
  const record = readExactRecord(value, DATA_REFS_RESULT_KEYS, DATA_REFS_RESULT_KEYS);
  if (!record) return undefined;
  if (!isDataRefsResultEnvelope(record)) return undefined;

  const capabilities = parseDataRefsCapabilities(record.capabilities);
  if (!capabilities) return undefined;

  const refs = record.refs.map(parseDataRefCandidate);
  const blockedRefClasses = record.blockedRefClasses.map(parseBlockedRefClass);
  if (refs.some((ref) => ref === undefined) || blockedRefClasses.some((item) => item === undefined)) {
    return undefined;
  }

  return {
    ownerState: record.ownerState,
    refs: refs as ParsedDataRefCandidate[],
    blockedRefClasses: blockedRefClasses as McpReadOnlyTwoweeksDataBlockedRefClassV1[],
    ownerResolvedServerOnly: capabilities.ownerResolvedServerOnly,
  };
}

function parseDataRefsCapabilities(value: unknown): { ownerResolvedServerOnly: boolean } | undefined {
  const record = readExactRecord(value, DATA_REFS_CAPABILITY_KEYS, DATA_REFS_CAPABILITY_KEYS);
  if (!record) return undefined;
  if (!isDataRefsCapabilitiesShape(record)) return undefined;
  return { ownerResolvedServerOnly: record.ownerResolvedServerOnly };
}

function parseDataRefCandidate(value: unknown): ParsedDataRefCandidate | undefined {
  const record = readExactRecord(value, DATA_REF_KEYS, DATA_REF_REQUIRED_KEYS);
  if (!record) return undefined;
  if (!isDataRefCandidateShape(record)) return undefined;

  return {
    refClass: record.refClass,
    refId: record.refId,
    label: record.label,
    status: record.status,
    category: record.category,
    count: record.count,
    ...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
  };
}

function parseBlockedRefClass(value: unknown): McpReadOnlyTwoweeksDataBlockedRefClassV1 | undefined {
  const record = readExactRecord(value, BLOCKED_REF_CLASS_KEYS, BLOCKED_REF_CLASS_KEYS);
  if (!record || !isBlockedRefClassShape(record)) return undefined;
  return { refClass: record.refClass, reason: "missing_class_scope", version: 1 };
}

function isAccountLinkResolutionShape(record: Record<string, unknown>): boolean {
  return [
    record.kind === "mcp_account_link_server_only_owner_resolution",
    record.provider === "stytch",
    record.version === 1,
    hasVisibleText(record.twoweeksClerkId),
    hasVisibleText(record.grantRef),
    hasVisibleText(record.consentRef),
    hasVisibleText(record.auditReasonCode),
    Array.isArray(record.grantedReadScopes),
    Array.isArray(record.grantedReadScopes) && record.grantedReadScopes.every(isReadScope),
  ].every(Boolean);
}

function isDataRefsResultEnvelope(record: Record<string, unknown>): boolean {
  return [
    record.kind === "mcp_read_only_twoweeks_data_refs_result",
    isOwnerState(record.ownerState),
    Array.isArray(record.refs),
    Array.isArray(record.blockedRefClasses),
    record.modelVisible === true,
    record.version === 1,
  ].every(Boolean);
}

function isDataRefsCapabilitiesShape(
  record: Record<string, unknown>,
): record is Record<string, unknown> & { ownerResolvedServerOnly: boolean } {
  return [
    typeof record.ownerResolvedServerOnly === "boolean",
    record.dataReads === "convex_read_only_refs",
    record.dataWrites === "blocked",
    record.handlerExecution === "blocked",
    record.productionConnector === "blocked",
    record.networkAccess === "blocked",
    record.modelCalls === "blocked",
    record.writeActions === "blocked",
    record.rawDataProjection === "blocked",
    record.version === 1,
  ].every(Boolean);
}

function isDataRefCandidateShape(
  record: Record<string, unknown>,
): record is Record<string, unknown> & ParsedDataRefCandidate {
  return [
    record.kind === "mcp_read_only_twoweeks_data_ref_candidate",
    isRefClass(record.refClass),
    hasVisibleText(record.refId),
    hasVisibleText(record.label),
    isStatus(record.status),
    isCategory(record.category),
    isSafeCount(record.count),
    isOptionalIsoTimestamp(record.updatedAt),
    record.version === 1,
  ].every(Boolean);
}

function isBlockedRefClassShape(
  record: Record<string, unknown>,
): record is Record<string, unknown> & McpReadOnlyTwoweeksDataBlockedRefClassV1 {
  return [
    isRefClass(record.refClass),
    record.reason === "missing_class_scope",
    record.version === 1,
  ].every(Boolean);
}

function projectDataRefCandidates(
  dataRefs: ParsedDataRefsResult,
  grantedScopeSets: readonly (readonly McpProductionStytchOAuthReadScopeV1[])[],
): CandidateProjectionResult {
  const refs: Partial<
    Record<LocalMcpSafeConvexSelectorProjectionRefClassV1, McpReadOnlyTwoweeksDataRefV1>
  > = {};
  const blockedRefClasses: McpReadOnlyTwoweeksDataBlockedRefClassV1[] = [
    ...dataRefs.blockedRefClasses,
  ];

  for (const candidate of dataRefs.refs) {
    const projected = projectSingleDataRefCandidate(candidate, grantedScopeSets, blockedRefClasses);
    if (!projected.ok) return projected;
    if (projected.ref) refs[candidate.refClass] = projected.ref;
  }

  return { ok: true, refs, blockedRefClasses };
}

function projectSingleDataRefCandidate(
  candidate: ParsedDataRefCandidate,
  grantedScopeSets: readonly (readonly McpProductionStytchOAuthReadScopeV1[])[],
  blockedRefClasses: McpReadOnlyTwoweeksDataBlockedRefClassV1[],
):
  | { ok: true; ref?: McpReadOnlyTwoweeksDataRefV1 }
  | { ok: false; reason: "unsafe_projection_blocked" } {
  if (!hasClassScope(candidate.refClass, grantedScopeSets)) {
    addBlockedRefClass(blockedRefClasses, candidate.refClass);
    return { ok: true };
  }

  const projection = projectLocalMcpSafeConvexSelectorRef({
    kind: "local_mcp_safe_convex_selector_projection_candidate",
    refClass: candidate.refClass,
    refId: candidate.refId,
    label: candidate.label,
    status: candidate.status,
    ...(candidate.updatedAt ? { updatedAt: candidate.updatedAt } : {}),
    version: 1,
  });
  if (!projection.allowed) return { ok: false, reason: "unsafe_projection_blocked" };

  const projectedRef = projection.projection[candidate.refClass];
  if (!projectedRef) return { ok: false, reason: "unsafe_projection_blocked" };

  return {
    ok: true,
    ref: {
      id: projectedRef.id,
      label: projectedRef.label,
      status: projectedRef.status,
      category: candidate.category,
      count: candidate.count,
      ...(projectedRef.updatedAt ? { updatedAt: projectedRef.updatedAt } : {}),
      version: 1,
    },
  };
}

function hasClassScope(
  refClass: LocalMcpSafeConvexSelectorProjectionRefClassV1,
  grantedScopeSets: readonly (readonly McpProductionStytchOAuthReadScopeV1[])[],
): boolean {
  const requiredScope = CLASS_SCOPE[refClass];
  return grantedScopeSets.every(
    (scopes) => scopes.includes("twoweeks.mcp.read") && scopes.includes(requiredScope),
  );
}

function addBlockedRefClass(
  blockedRefClasses: McpReadOnlyTwoweeksDataBlockedRefClassV1[],
  refClass: LocalMcpSafeConvexSelectorProjectionRefClassV1,
): void {
  if (blockedRefClasses.some((item) => item.refClass === refClass)) return;
  blockedRefClasses.push({ refClass, reason: "missing_class_scope", version: 1 });
}

function summarizeAvailability(
  refs: Partial<Record<LocalMcpSafeConvexSelectorProjectionRefClassV1, McpReadOnlyTwoweeksDataRefV1>>,
  blockedRefClasses: readonly McpReadOnlyTwoweeksDataBlockedRefClassV1[],
): McpReadOnlyTwoweeksDataAdapterResultV1 extends { allowed: true; availabilitySummary: infer T }
  ? T
  : never {
  const values = Object.values(refs);
  return {
    available: values.filter((ref) => ref.status === "available").length,
    noData: values.filter((ref) => ref.status === "no_data_available").length,
    onboarding: values.filter((ref) => ref.status === "onboarding_required").length,
    blocked: blockedRefClasses.length,
    version: 1,
  } as McpReadOnlyTwoweeksDataAdapterResultV1 extends {
    allowed: true;
    availabilitySummary: infer T;
  }
    ? T
    : never;
}

function deny(
  reason: McpReadOnlyTwoweeksDataAdapterBlockedReasonV1,
): McpReadOnlyTwoweeksDataAdapterResultV1 {
  return {
    kind: "mcp_read_only_twoweeks_data_adapter_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpReadOnlyTwoweeksDataAdapterSafeRefusal(),
    capabilities: buildCapabilities({
      auth: "blocked",
      accountLink: "blocked",
      consent: "blocked",
      audit: "not_evaluated",
      retention: "blocked",
      dataReads: "blocked",
    }),
    modelVisible: true,
    version: 1,
  };
}

function buildCapabilities(
  overrides: Pick<
    McpReadOnlyTwoweeksDataAdapterCapabilitiesV1,
    "auth" | "accountLink" | "consent" | "audit" | "retention" | "dataReads"
  >,
): McpReadOnlyTwoweeksDataAdapterCapabilitiesV1 {
  return {
    ...overrides,
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
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
  const keys = Object.keys(record);
  if (!keys.every((key) => allowedKeys.includes(key))) return undefined;
  if (!requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))) {
    return undefined;
  }
  return record;
}

function readPlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  const descriptors = readPlainObjectDescriptors(value);
  return descriptors ? readDescriptorRecord(descriptors) : undefined;
}

function readPlainObjectDescriptors(
  value: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    return Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
}

function readDescriptorRecord(
  descriptors: Record<PropertyKey, PropertyDescriptor | undefined>,
): Record<string, unknown> | undefined {
  const record: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    const entry = readDescriptorEntry(key, descriptors[key]);
    if (!entry) return undefined;
    record[entry.key] = entry.value;
  }
  return record;
}

function readDescriptorEntry(
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): { key: string; value: unknown } | undefined {
  if (typeof key !== "string") return undefined;
  if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) return undefined;
  return { key, value: descriptor.value };
}

function containsUnsafeProjectionMaterial(value: unknown): boolean {
  return visitUnsafeProjectionMaterial(value, new WeakSet<object>(), 0);
}

function visitUnsafeProjectionMaterial(value: unknown, seen: WeakSet<object>, depth: number): boolean {
  if (depth > 5) return true;
  if (typeof value === "string") return containsUnsafeProjectionText(value);
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  const record = readPlainObjectRecord(value);
  if (!record) return true;
  seen.add(value);
  const unsafe = Object.entries(record).some(
    ([key, item]) =>
      containsUnsafeProjectionKey(key) || visitUnsafeProjectionMaterial(item, seen, depth + 1),
  );
  seen.delete(value);
  return unsafe;
}

function containsUnsafeProjectionKey(key: string): boolean {
  return /(?:raw|content|source|quote|private|never|debug|shadow|token|claims|email|clerk|subject|documentid)/iu.test(
    key,
  );
}

function containsUnsafeProjectionText(value: string): boolean {
  return /(?:raw[_ -]?(?:cv|job|resume|proposal|text)|source[_ -]?(?:text|quote)|private[_ -]?fact|never[_ -]?use|structured[_ -]?shadow|documentid|bearer\s+\S+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/iu.test(
    value,
  );
}

function isReadScope(value: unknown): value is McpProductionAccountLinkReadScopeV1 {
  return (
    value === "twoweeks.mcp.read" ||
    value === "twoweeks.application_package.read" ||
    value === "twoweeks.evidence_graph.read" ||
    value === "twoweeks.resume_variant_plan.read" ||
    value === "twoweeks.review_cockpit.read"
  );
}

function isOwnerState(value: unknown): value is ParsedDataRefsResult["ownerState"] {
  return value === "resolved" || value === "onboarding_required";
}

function isRefClass(value: unknown): value is LocalMcpSafeConvexSelectorProjectionRefClassV1 {
  return (
    value === "applicationPackageRef" ||
    value === "evidenceGraphRef" ||
    value === "resumeVariantPlanRef" ||
    value === "reviewCockpitRef"
  );
}

function isStatus(value: unknown): value is LocalMcpSafeConvexSelectorProjectionStatusV1 {
  return (
    value === "available" ||
    value === "no_data_available" ||
    value === "onboarding_required" ||
    value === "blocked"
  );
}

function isCategory(value: unknown): value is McpReadOnlyTwoweeksDataRefCategoryV1 {
  return (
    value === "application_package" ||
    value === "evidence_graph" ||
    value === "resume_variant_plan" ||
    value === "review_cockpit"
  );
}

function isSafeCount(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SAFE_COUNT;
}

function isOptionalIsoTimestamp(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
      Number.isFinite(Date.parse(value)))
  );
}

function hasVisibleText(value: unknown): value is string {
  return typeof value === "string" && /\S/u.test(value);
}
