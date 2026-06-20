export type McpProductionAccountLinkReadScopeV1 =
  | "twoweeks.mcp.read"
  | "twoweeks.application_package.read"
  | "twoweeks.evidence_graph.read"
  | "twoweeks.resume_variant_plan.read"
  | "twoweeks.review_cockpit.read";

export type McpProductionAccountLinkRecordStateV1 = "active" | "revoked" | "stale";

export type McpProductionAccountLinkRecordV1 = Readonly<{
  kind: "local_mcp_account_link_record";
  version: 1;
  provider: "stytch";
  providerSubject: string;
  twoweeksClerkId: string;
  clientId: string;
  grantedReadScopes: readonly McpProductionAccountLinkReadScopeV1[];
  grantRef: string;
  consentRef: string;
  state: McpProductionAccountLinkRecordStateV1;
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt: number;
  revokedAt?: number;
  staleAt?: number;
  auditReasonCode: string;
}>;

export type McpProductionAccountLinkPersistenceBoundaryInputV1 = Readonly<{
  kind: "mcp_production_account_link_persistence_boundary_input";
  providerSubject: string;
  clientId: string;
  requiredReadScopes: readonly McpProductionAccountLinkReadScopeV1[];
  accountLinks: readonly unknown[];
  now?: number;
  maxLinkAgeMs?: number;
  version: 1;
}>;

export type McpProductionAccountLinkPersistenceReasonV1 =
  | "invalid_input"
  | "malformed_record"
  | "missing_account_link"
  | "provider_mismatch"
  | "client_mismatch"
  | "revoked_account_link"
  | "stale_account_link"
  | "expired_account_link"
  | "ambiguous_account_link"
  | "missing_required_read_scope";

export type McpProductionAccountLinkPersistenceCapabilitiesV1 = Readonly<{
  accountLinkPersistence: "blocked" | "server_only";
  provider: "stytch";
  modelVisibility: "blocked";
  dataReads: "blocked";
  dataWrites: "blocked";
  handlerExecution: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  credentialStorage: "none";
  tokenStorage: "none";
  writeActions: "blocked";
  version: 1;
}>;

export type McpProductionAccountLinkPersistenceSafeRefusalV1 = Readonly<{
  code: "production_account_link_persistence_boundary_blocked";
  message: "Refused. Account-link persistence boundary blocked.";
  safeForModel: true;
  stytchSubjectExposed: false;
  clerkIdExposed: false;
  rawClaimsExposed: false;
  tokenEchoed: false;
  version: 1;
}>;

export type McpProductionAccountLinkPersistenceResultV1 = Readonly<
  | {
      kind: "mcp_production_account_link_persistence_result";
      allowed: true;
      reason: "verified_server_only";
      serverOnly: {
        provider: "stytch";
        linkState: "active";
        ownerBinding: "twoweeks_owner_resolved_server_only_not_returned";
        clientCategory: "approved_ai_client";
        grantedReadScopes: readonly McpProductionAccountLinkReadScopeV1[];
        requiredReadScopes: readonly McpProductionAccountLinkReadScopeV1[];
        grantState: "grant_and_consent_refs_present";
        auditReasonCode: string;
        version: 1;
      };
      capabilities: McpProductionAccountLinkPersistenceCapabilitiesV1;
      modelVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_production_account_link_persistence_result";
      allowed: false;
      reason: McpProductionAccountLinkPersistenceReasonV1;
      safeRefusal: McpProductionAccountLinkPersistenceSafeRefusalV1;
      capabilities: McpProductionAccountLinkPersistenceCapabilitiesV1;
      modelVisible: false;
      version: 1;
    }
>;

export type McpProductionAccountLinkRedactedAuditEventV1 = Readonly<{
  kind: "mcp_production_account_link_redacted_audit_event";
  eventType:
    | "account_link_verified"
    | "account_link_refused"
    | "account_link_revoked"
    | "account_link_marked_stale";
  clientCategory: "approved_ai_client" | "unknown_client";
  scopeCategory: "mcp_read" | "data_class_read" | "insufficient";
  linkState: McpProductionAccountLinkRecordStateV1 | "missing" | "ambiguous" | "malformed";
  reasonCode: string;
  safeForModel: true;
  version: 1;
}>;

const APPROVED_READ_SCOPES = [
  "twoweeks.application_package.read",
  "twoweeks.evidence_graph.read",
  "twoweeks.mcp.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
] as const satisfies readonly McpProductionAccountLinkReadScopeV1[];

const INPUT_ALLOWED_KEYS = [
  "kind",
  "providerSubject",
  "clientId",
  "requiredReadScopes",
  "accountLinks",
  "now",
  "maxLinkAgeMs",
  "version",
] as const;

const INPUT_REQUIRED_KEYS = [
  "kind",
  "providerSubject",
  "clientId",
  "requiredReadScopes",
  "accountLinks",
  "version",
] as const;

const RECORD_ALLOWED_KEYS = [
  "kind",
  "version",
  "provider",
  "providerSubject",
  "twoweeksClerkId",
  "clientId",
  "grantedReadScopes",
  "grantRef",
  "consentRef",
  "state",
  "createdAt",
  "updatedAt",
  "lastVerifiedAt",
  "revokedAt",
  "staleAt",
  "auditReasonCode",
] as const;

const RECORD_REQUIRED_KEYS = [
  "kind",
  "version",
  "provider",
  "providerSubject",
  "twoweeksClerkId",
  "clientId",
  "grantedReadScopes",
  "grantRef",
  "consentRef",
  "state",
  "createdAt",
  "updatedAt",
  "lastVerifiedAt",
  "auditReasonCode",
] as const;

type ParsedAccountLinkRecord = Readonly<{
  provider: string;
  providerSubject: string;
  twoweeksClerkId: string;
  clientId: string;
  grantedReadScopes: readonly string[];
  grantRef: string;
  consentRef: string;
  state: McpProductionAccountLinkRecordStateV1;
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt: number;
  revokedAt?: number;
  staleAt?: number;
  auditReasonCode: string;
}>;

type ParsedAccountLinkIdentity = Pick<
  ParsedAccountLinkRecord,
  "provider" | "providerSubject" | "twoweeksClerkId" | "clientId"
>;

type ParsedAccountLinkGrant = Pick<
  ParsedAccountLinkRecord,
  "grantedReadScopes" | "grantRef" | "consentRef" | "auditReasonCode"
>;

type ParsedAccountLinkTiming = Pick<
  ParsedAccountLinkRecord,
  "state" | "createdAt" | "updatedAt" | "lastVerifiedAt" | "revokedAt" | "staleAt"
>;

type ParsedAccountLinkInputCore = Pick<
  McpProductionAccountLinkPersistenceBoundaryInputV1,
  "providerSubject" | "clientId" | "requiredReadScopes" | "accountLinks"
>;

type ParsedAccountLinkInputOptions = Pick<
  McpProductionAccountLinkPersistenceBoundaryInputV1,
  "now" | "maxLinkAgeMs"
>;

export function validateMcpProductionAccountLinkPersistenceBoundary(
  input: unknown,
): McpProductionAccountLinkPersistenceResultV1 {
  const parsedInput = parseInput(input);
  if (!parsedInput) return deny("invalid_input");
  if (parsedInput.accountLinks.length === 0) return deny("missing_account_link");

  const parsedRecords = parsedInput.accountLinks.map(parseAccountLinkRecord);
  if (parsedRecords.some((record) => record === undefined)) return deny("malformed_record");

  const records = parsedRecords as readonly ParsedAccountLinkRecord[];
  const providerMatches = records.filter((record) => record.provider === "stytch");
  if (providerMatches.length === 0) return deny("provider_mismatch");

  const subjectMatches = providerMatches.filter(
    (record) => record.providerSubject === parsedInput.providerSubject,
  );
  if (subjectMatches.length === 0) return deny("missing_account_link");

  const clientMatches = subjectMatches.filter((record) => record.clientId === parsedInput.clientId);
  if (clientMatches.length === 0) return deny("client_mismatch");

  const nonRevokedMatches = clientMatches.filter(
    (record) => record.state !== "revoked" && record.revokedAt === undefined,
  );
  if (nonRevokedMatches.length === 0) return deny("revoked_account_link");
  if (nonRevokedMatches.length > 1) return deny("ambiguous_account_link");

  const record = nonRevokedMatches[0];
  if (record.state === "stale" || record.staleAt !== undefined) return deny("stale_account_link");
  if (isExpired(record, parsedInput)) return deny("expired_account_link");

  const grantedReadScopes = normalizeReadScopes(record.grantedReadScopes);
  if (!grantedReadScopes || !hasRequiredScopes(grantedReadScopes, parsedInput.requiredReadScopes)) {
    return deny("missing_required_read_scope");
  }

  return {
    kind: "mcp_production_account_link_persistence_result",
    allowed: true,
    reason: "verified_server_only",
    serverOnly: {
      provider: "stytch",
      linkState: "active",
      ownerBinding: "twoweeks_owner_resolved_server_only_not_returned",
      clientCategory: "approved_ai_client",
      grantedReadScopes,
      requiredReadScopes: parsedInput.requiredReadScopes,
      grantState: "grant_and_consent_refs_present",
      auditReasonCode: record.auditReasonCode,
      version: 1,
    },
    capabilities: buildCapabilities("server_only"),
    modelVisible: false,
    version: 1,
  };
}

export function buildMcpProductionAccountLinkPersistenceSafeRefusal(): McpProductionAccountLinkPersistenceSafeRefusalV1 {
  return {
    code: "production_account_link_persistence_boundary_blocked",
    message: "Refused. Account-link persistence boundary blocked.",
    safeForModel: true,
    stytchSubjectExposed: false,
    clerkIdExposed: false,
    rawClaimsExposed: false,
    tokenEchoed: false,
    version: 1,
  };
}

export function buildMcpProductionAccountLinkRedactedAuditEvent(
  input: Readonly<{
    eventType: McpProductionAccountLinkRedactedAuditEventV1["eventType"];
    clientApproved: boolean;
    requiredReadScopes: readonly string[];
    linkState: McpProductionAccountLinkRedactedAuditEventV1["linkState"];
    reasonCode: string;
  }>,
): McpProductionAccountLinkRedactedAuditEventV1 {
  return {
    kind: "mcp_production_account_link_redacted_audit_event",
    eventType: input.eventType,
    clientCategory: input.clientApproved ? "approved_ai_client" : "unknown_client",
    scopeCategory: resolveScopeCategory(input.requiredReadScopes),
    linkState: input.linkState,
    reasonCode: readAuditReasonCode(input.reasonCode) ?? "account_link_boundary_refused",
    safeForModel: true,
    version: 1,
  };
}

function parseInput(
  value: unknown,
): McpProductionAccountLinkPersistenceBoundaryInputV1 | undefined {
  const record = readDescriptorSafeRecordWithKeys(value, INPUT_ALLOWED_KEYS, INPUT_REQUIRED_KEYS);
  if (!record) return undefined;
  if (
    record.kind !== "mcp_production_account_link_persistence_boundary_input" ||
    record.version !== 1
  ) {
    return undefined;
  }

  const core = parseInputCore(record);
  const options = parseInputOptions(record);
  if (!core || !options) return undefined;

  return {
    kind: "mcp_production_account_link_persistence_boundary_input",
    ...core,
    ...options,
    version: 1,
  };
}

function parseInputCore(record: Record<string, unknown>): ParsedAccountLinkInputCore | undefined {
  const providerSubject = readOpaqueIdentifier(record.providerSubject);
  const clientId = readOpaqueIdentifier(record.clientId);
  const requiredReadScopes = readRequiredReadScopes(record.requiredReadScopes);
  if (!providerSubject || !clientId || !requiredReadScopes) return undefined;
  if (!Array.isArray(record.accountLinks)) return undefined;
  return {
    providerSubject,
    clientId,
    requiredReadScopes,
    accountLinks: [...record.accountLinks],
  };
}

function parseInputOptions(
  record: Record<string, unknown>,
): ParsedAccountLinkInputOptions | undefined {
  if (record.now !== undefined && !isFiniteTimestamp(record.now)) return undefined;
  if (
    record.maxLinkAgeMs !== undefined &&
    (!Number.isInteger(record.maxLinkAgeMs) || record.maxLinkAgeMs <= 0)
  ) {
    return undefined;
  }

  return {
    ...(record.now !== undefined ? { now: record.now } : {}),
    ...(record.maxLinkAgeMs !== undefined ? { maxLinkAgeMs: record.maxLinkAgeMs } : {}),
  };
}

function parseAccountLinkRecord(value: unknown): ParsedAccountLinkRecord | undefined {
  const record = readDescriptorSafeRecordWithKeys(value, RECORD_ALLOWED_KEYS, RECORD_REQUIRED_KEYS);
  if (!record) return undefined;
  if (record.kind !== "local_mcp_account_link_record" || record.version !== 1) return undefined;

  const identity = parseAccountLinkIdentity(record);
  const grant = parseAccountLinkGrant(record);
  const timing = parseAccountLinkTiming(record);
  if (!identity || !grant || !timing) return undefined;

  return {
    ...identity,
    ...grant,
    ...timing,
  };
}

function parseAccountLinkIdentity(
  record: Record<string, unknown>,
): ParsedAccountLinkIdentity | undefined {
  const provider = readOpaqueIdentifier(record.provider);
  const providerSubject = readOpaqueIdentifier(record.providerSubject);
  const twoweeksClerkId = readOpaqueIdentifier(record.twoweeksClerkId);
  const clientId = readOpaqueIdentifier(record.clientId);
  if (!provider || !providerSubject || !twoweeksClerkId || !clientId) return undefined;
  if (providerSubject === twoweeksClerkId) return undefined;
  return { provider, providerSubject, twoweeksClerkId, clientId };
}

function parseAccountLinkGrant(record: Record<string, unknown>): ParsedAccountLinkGrant | undefined {
  const grantedReadScopes = readStringList(record.grantedReadScopes);
  const grantRef = readOpaqueIdentifier(record.grantRef);
  const consentRef = readOpaqueIdentifier(record.consentRef);
  const auditReasonCode = readAuditReasonCode(record.auditReasonCode);
  if (!grantedReadScopes || !grantRef || !consentRef || !auditReasonCode) return undefined;
  return { grantedReadScopes, grantRef, consentRef, auditReasonCode };
}

function parseAccountLinkTiming(
  record: Record<string, unknown>,
): ParsedAccountLinkTiming | undefined {
  const state = readRecordState(record.state);
  if (!state) return undefined;
  const timestamps = readAccountLinkTimestamps(record);
  if (!timestamps) return undefined;

  return {
    state,
    ...timestamps,
  };
}

function readAccountLinkTimestamps(
  record: Record<string, unknown>,
): Omit<ParsedAccountLinkTiming, "state"> | undefined {
  const required = readRequiredAccountLinkTimestamps(record);
  const optional = readOptionalAccountLinkTimestamps(record);
  if (!required || !optional) return undefined;
  if (required.updatedAt < required.createdAt || required.lastVerifiedAt < required.createdAt) {
    return undefined;
  }
  return { ...required, ...optional };
}

function readRequiredAccountLinkTimestamps(
  record: Record<string, unknown>,
): Pick<ParsedAccountLinkTiming, "createdAt" | "updatedAt" | "lastVerifiedAt"> | undefined {
  const createdAt = readFiniteTimestamp(record.createdAt);
  const updatedAt = readFiniteTimestamp(record.updatedAt);
  const lastVerifiedAt = readFiniteTimestamp(record.lastVerifiedAt);
  if (createdAt === undefined || updatedAt === undefined || lastVerifiedAt === undefined) {
    return undefined;
  }
  return { createdAt, updatedAt, lastVerifiedAt };
}

function readOptionalAccountLinkTimestamps(
  record: Record<string, unknown>,
): Pick<ParsedAccountLinkTiming, "revokedAt" | "staleAt"> | undefined {
  const revokedAt = readOptionalFiniteTimestamp(record.revokedAt);
  const staleAt = readOptionalFiniteTimestamp(record.staleAt);
  if (revokedAt === false || staleAt === false) return undefined;
  return {
    ...(revokedAt !== undefined ? { revokedAt } : {}),
    ...(staleAt !== undefined ? { staleAt } : {}),
  };
}

function isExpired(
  record: ParsedAccountLinkRecord,
  input: McpProductionAccountLinkPersistenceBoundaryInputV1,
): boolean {
  if (input.maxLinkAgeMs === undefined) return false;
  const now = input.now ?? Date.now();
  return now - record.lastVerifiedAt > input.maxLinkAgeMs;
}

function normalizeReadScopes(
  scopes: readonly string[],
): readonly McpProductionAccountLinkReadScopeV1[] | undefined {
  const normalized = new Set<McpProductionAccountLinkReadScopeV1>();
  for (const scope of scopes) {
    if (!isApprovedReadScope(scope)) return undefined;
    normalized.add(scope);
  }
  return [...normalized].sort();
}

function readRequiredReadScopes(
  value: unknown,
): readonly McpProductionAccountLinkReadScopeV1[] | undefined {
  const normalized = normalizeReadScopes(readStringList(value) ?? []);
  if (!normalized || normalized.length === 0) return undefined;
  if (!normalized.includes("twoweeks.mcp.read")) return undefined;
  return normalized;
}

function hasRequiredScopes(
  grantedReadScopes: readonly McpProductionAccountLinkReadScopeV1[],
  requiredReadScopes: readonly McpProductionAccountLinkReadScopeV1[],
): boolean {
  const granted = new Set(grantedReadScopes);
  return requiredReadScopes.every((scope) => granted.has(scope));
}

function resolveScopeCategory(
  requiredReadScopes: readonly string[],
): McpProductionAccountLinkRedactedAuditEventV1["scopeCategory"] {
  if (!requiredReadScopes.every(isApprovedReadScope)) return "insufficient";
  return requiredReadScopes.length > 1 ? "data_class_read" : "mcp_read";
}

function deny(
  reason: McpProductionAccountLinkPersistenceReasonV1,
): McpProductionAccountLinkPersistenceResultV1 {
  return {
    kind: "mcp_production_account_link_persistence_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpProductionAccountLinkPersistenceSafeRefusal(),
    capabilities: buildCapabilities("blocked"),
    modelVisible: false,
    version: 1,
  };
}

function buildCapabilities(
  accountLinkPersistence: McpProductionAccountLinkPersistenceCapabilitiesV1["accountLinkPersistence"],
): McpProductionAccountLinkPersistenceCapabilitiesV1 {
  return {
    accountLinkPersistence,
    provider: "stytch",
    modelVisibility: "blocked",
    dataReads: "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    writeActions: "blocked",
    version: 1,
  };
}

function isApprovedReadScope(value: unknown): value is McpProductionAccountLinkReadScopeV1 {
  return (APPROVED_READ_SCOPES as readonly string[]).includes(String(value));
}

function readRecordState(value: unknown): McpProductionAccountLinkRecordStateV1 | undefined {
  return value === "active" || value === "revoked" || value === "stale" ? value : undefined;
}

function readDescriptorSafeRecordWithKeys(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | undefined {
  const record = readDescriptorSafePlainObjectRecord(value);
  if (!record) return undefined;
  const actualKeys = Reflect.ownKeys(record);
  if (!actualKeys.every((key) => typeof key === "string" && allowedKeys.includes(key))) {
    return undefined;
  }
  if (!requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))) {
    return undefined;
  }
  return record;
}

function readDescriptorSafePlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  const descriptors = readDescriptorSafePlainObjectDescriptors(value);
  return descriptors ? readDescriptorValues(descriptors) : undefined;
}

function readDescriptorSafePlainObjectDescriptors(
  value: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;

    return Object.getOwnPropertyDescriptors(value) as Record<
      PropertyKey,
      PropertyDescriptor | undefined
    >;
  } catch {
    return undefined;
  }
}

function readDescriptorValues(
  descriptors: Record<PropertyKey, PropertyDescriptor | undefined>,
): Record<string, unknown> | undefined {
  const record: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    const entry = readDescriptorValue(key, descriptors[key]);
    if (!entry) return undefined;
    record[entry.key] = entry.value;
  }
  return record;
}

function readDescriptorValue(
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): { key: string; value: unknown } | undefined {
  if (typeof key !== "string") return undefined;
  if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) return undefined;
  return { key, value: descriptor.value };
}

function readStringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !/\S/u.test(item)) return undefined;
    strings.push(item);
  }
  return strings;
}

function readOpaqueIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,191}$/u.test(trimmed)) return undefined;
  if (containsForbiddenStoredText(trimmed)) return undefined;
  return trimmed;
}

function readAuditReasonCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^[a-z][a-z0-9_]{2,80}$/u.test(trimmed) ? trimmed : undefined;
}

function readFiniteTimestamp(value: unknown): number | undefined {
  return isFiniteTimestamp(value) ? value : undefined;
}

function readOptionalFiniteTimestamp(value: unknown): number | undefined | false {
  if (value === undefined) return undefined;
  return isFiniteTimestamp(value) ? value : false;
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function containsForbiddenStoredText(value: string): boolean {
  return /@|bearer\s+\S+|authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|credential|cookie|session|raw[_-]?(cv|resume|job|proposal|claims)|private[_-]?fact|never[_-]?use|source[_-]?(text|quote)|structured[_-]?shadow|convex[_-]?(id|document)|debug[_-]?payload/iu.test(
    value,
  );
}
