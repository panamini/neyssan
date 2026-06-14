export type LocalMcpAccountLinkingStorageReadScopeV1 =
  | "twoweeks.mcp.read"
  | "twoweeks.application_package.read"
  | "twoweeks.evidence_graph.read"
  | "twoweeks.resume_variant_plan.read"
  | "twoweeks.review_cockpit.read";

type LocalMcpAccountLinkingStorageRecordStateV1 = "active" | "revoked" | "stale";

export type LocalMcpAccountLinkingStorageRecordShapeV1 = Readonly<{
  kind: "local_mcp_account_link_record";
  provider: "stytch";
  providerSubject: string;
  twoweeksClerkId: string;
  clientIdentity: string;
  grantedReadScopes: readonly LocalMcpAccountLinkingStorageReadScopeV1[];
  grantRef?: string;
  consentRef?: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  state: LocalMcpAccountLinkingStorageRecordStateV1;
  version: 1;
}>;

export type LocalMcpAccountLinkingStorageBoundaryInputV1 = Readonly<{
  kind: "local_mcp_account_linking_storage_boundary_input";
  providerSubject: string;
  clientIdentity: string;
  requiredReadScopes: readonly string[];
  accountLinks: readonly unknown[];
  version: 1;
}>;

export type LocalMcpAccountLinkingStorageBoundaryReasonV1 =
  | "invalid_input"
  | "missing_account_link"
  | "revoked_account_link"
  | "stale_account_link"
  | "ambiguous_account_link"
  | "provider_mismatch"
  | "provider_subject_mismatch"
  | "client_identity_mismatch"
  | "missing_required_read_scope"
  | "insufficient_scope_metadata";

export type LocalMcpAccountLinkingStorageCapabilitiesV1 = Readonly<{
  accountLinkingStorage: "blocked" | "server_only";
  dataReads: "blocked";
  dataWrites: "blocked";
  handlerExecution: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  writeActions: "blocked";
  credentialStorage: "none";
  consent: "not_evaluated";
  audit: "not_evaluated";
  retentionDeletion: "not_evaluated";
  version: 1;
}>;

export type LocalMcpAccountLinkingStorageSafeRefusalV1 = Readonly<{
  code: "account_linking_storage_boundary_blocked";
  message: "Refused. Account-linking storage boundary blocked.";
  safeForModel: true;
  fixtureOnly: true;
  version: 1;
}>;

export type LocalMcpAccountLinkingStorageResultV1 = Readonly<
  | {
      kind: "local_mcp_account_linking_storage_result";
      allowed: true;
      reason: "verified_server_only";
      serverOnly: {
        linkState: "verified_server_only";
        readScopeState: "read_only_verified";
        grantedReadScopes: readonly LocalMcpAccountLinkingStorageReadScopeV1[];
        version: 1;
      };
      capabilities: LocalMcpAccountLinkingStorageCapabilitiesV1;
      modelVisible: false;
      fixtureOnly: true;
      version: 1;
    }
  | {
      kind: "local_mcp_account_linking_storage_result";
      allowed: false;
      reason: LocalMcpAccountLinkingStorageBoundaryReasonV1;
      safeRefusal: LocalMcpAccountLinkingStorageSafeRefusalV1;
      capabilities: LocalMcpAccountLinkingStorageCapabilitiesV1;
      modelVisible: false;
      fixtureOnly: true;
      version: 1;
    }
>;

const ALLOWED_READ_SCOPES = [
  "twoweeks.application_package.read",
  "twoweeks.evidence_graph.read",
  "twoweeks.mcp.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
] as const satisfies readonly LocalMcpAccountLinkingStorageReadScopeV1[];

const BOUNDARY_KEYS = [
  "kind",
  "providerSubject",
  "clientIdentity",
  "requiredReadScopes",
  "accountLinks",
  "version",
] as const;

const RECORD_KEYS = [
  "kind",
  "provider",
  "providerSubject",
  "twoweeksClerkId",
  "clientIdentity",
  "grantedReadScopes",
  "grantRef",
  "consentRef",
  "createdAt",
  "updatedAt",
  "revokedAt",
  "state",
  "version",
] as const;

const RECORD_REQUIRED_KEYS = [
  "kind",
  "provider",
  "providerSubject",
  "twoweeksClerkId",
  "clientIdentity",
  "grantedReadScopes",
  "createdAt",
  "updatedAt",
  "state",
  "version",
] as const;

type ParsedLocalMcpAccountLinkingStorageRecordV1 = Readonly<{
  kind: "local_mcp_account_link_record";
  provider: string;
  providerSubject: string;
  twoweeksClerkId: string;
  clientIdentity: string;
  grantedReadScopes: readonly string[];
  grantRef?: string;
  consentRef?: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  state: LocalMcpAccountLinkingStorageRecordStateV1;
  scopeMetadataValid: boolean;
  version: 1;
}>;

export function validateLocalMcpAccountLinkingStorageBoundary(
  input: unknown,
): LocalMcpAccountLinkingStorageResultV1 {
  const parsedInput = parseBoundaryInput(input);
  if (!parsedInput) return deny("invalid_input");

  if (parsedInput.accountLinks.length === 0) return deny("missing_account_link");

  const parsedRecords = parsedInput.accountLinks.map(parseAccountLinkRecord);
  if (parsedRecords.some((record) => record === undefined)) return deny("invalid_input");

  const records = parsedRecords as readonly ParsedLocalMcpAccountLinkingStorageRecordV1[];

  const providerMatches = records.filter((record) => record.provider === "stytch");
  if (providerMatches.length === 0) return deny("provider_mismatch");

  const providerSubjectMatches = providerMatches.filter(
    (record) => record.providerSubject === parsedInput.providerSubject,
  );
  if (providerSubjectMatches.length === 0) return deny("provider_subject_mismatch");

  const clientIdentityMatches = providerSubjectMatches.filter(
    (record) => record.clientIdentity === parsedInput.clientIdentity,
  );
  if (clientIdentityMatches.length === 0) return deny("client_identity_mismatch");

  if (clientIdentityMatches.length > 1) return deny("ambiguous_account_link");

  const record = clientIdentityMatches[0];
  if (record.state === "revoked" || record.revokedAt !== undefined) return deny("revoked_account_link");
  if (record.state === "stale") return deny("stale_account_link");

  if (!record.scopeMetadataValid) return deny("insufficient_scope_metadata");
  const grantedReadScopes = normalizeReadScopes(record.grantedReadScopes);
  if (grantedReadScopes === undefined) return deny("insufficient_scope_metadata");
  if (!hasRequiredScopes(grantedReadScopes, parsedInput.requiredReadScopes)) {
    return deny("missing_required_read_scope");
  }

  return {
    kind: "local_mcp_account_linking_storage_result",
    allowed: true,
    reason: "verified_server_only",
    serverOnly: {
      linkState: "verified_server_only",
      readScopeState: "read_only_verified",
      grantedReadScopes,
      version: 1,
    },
    capabilities: buildCapabilities("server_only"),
    modelVisible: false,
    fixtureOnly: true,
    version: 1,
  };
}

export function buildLocalMcpAccountLinkingStorageSafeRefusal(): LocalMcpAccountLinkingStorageSafeRefusalV1 {
  return {
    code: "account_linking_storage_boundary_blocked",
    message: "Refused. Account-linking storage boundary blocked.",
    safeForModel: true,
    fixtureOnly: true,
    version: 1,
  };
}

function parseBoundaryInput(input: unknown): LocalMcpAccountLinkingStorageBoundaryInputV1 | undefined {
  const record = isExactRecord(input, BOUNDARY_KEYS);
  if (!record || record.kind !== "local_mcp_account_linking_storage_boundary_input" || record.version !== 1) {
    return undefined;
  }

  const providerSubject = readText(record.providerSubject);
  if (!providerSubject) return undefined;

  const clientIdentity = readText(record.clientIdentity);
  if (!clientIdentity) return undefined;

  const requiredReadScopes = readTextList(record.requiredReadScopes);
  if (requiredReadScopes === undefined || requiredReadScopes.length === 0) return undefined;

  const accountLinks = readUnknownList(record.accountLinks);
  if (accountLinks === undefined) return undefined;

  return {
    kind: "local_mcp_account_linking_storage_boundary_input",
    providerSubject,
    clientIdentity,
    requiredReadScopes,
    accountLinks,
    version: 1,
  };
}

function parseAccountLinkRecord(value: unknown): ParsedLocalMcpAccountLinkingStorageRecordV1 | undefined {
  const record = isRecordWithAllowedKeys(value, RECORD_KEYS);
  if (!record || record.kind !== "local_mcp_account_link_record" || record.version !== 1) return undefined;
  if (!hasOwnRequiredKeys(record, RECORD_REQUIRED_KEYS)) return undefined;

  const identity = parseAccountLinkIdentity(record);
  if (!identity) return undefined;

  const grant = parseAccountLinkGrant(record);
  if (!grant) return undefined;

  const timing = parseAccountLinkTiming(record);
  if (!timing) return undefined;

  return {
    kind: "local_mcp_account_link_record",
    ...identity,
    ...grant,
    ...timing,
    scopeMetadataValid: hasValidScopeMetadata(identity.provider, grant),
    version: 1,
  };
}

function normalizeReadScopes(value: readonly string[]): readonly LocalMcpAccountLinkingStorageReadScopeV1[] | undefined {
  const normalized = new Set<LocalMcpAccountLinkingStorageReadScopeV1>();
  for (const scope of value) {
    if (!isAllowedReadScope(scope)) return undefined;
    normalized.add(scope);
  }
  return [...normalized].sort();
}

function hasRequiredScopes(
  grantedReadScopes: readonly LocalMcpAccountLinkingStorageReadScopeV1[],
  requiredReadScopes: readonly string[],
): boolean {
  const granted = new Set(grantedReadScopes);
  return requiredReadScopes.every((scope) => isAllowedReadScope(scope) && granted.has(scope));
}

function buildCapabilities(
  accountLinkingStorage: LocalMcpAccountLinkingStorageCapabilitiesV1["accountLinkingStorage"],
): LocalMcpAccountLinkingStorageCapabilitiesV1 {
  return {
    accountLinkingStorage,
    dataReads: "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    credentialStorage: "none",
    consent: "not_evaluated",
    audit: "not_evaluated",
    retentionDeletion: "not_evaluated",
    version: 1,
  };
}

function deny(reason: LocalMcpAccountLinkingStorageBoundaryReasonV1): LocalMcpAccountLinkingStorageResultV1 {
  return {
    kind: "local_mcp_account_linking_storage_result",
    allowed: false,
    reason,
    safeRefusal: buildLocalMcpAccountLinkingStorageSafeRefusal(),
    capabilities: buildCapabilities("blocked"),
    modelVisible: false,
    fixtureOnly: true,
    version: 1,
  };
}

function isAllowedReadScope(value: string): value is LocalMcpAccountLinkingStorageReadScopeV1 {
  return (ALLOWED_READ_SCOPES as readonly string[]).includes(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === "string" && /\S/u.test(value) ? value : undefined;
}

function parseAccountLinkIdentity(
  value: Record<string, unknown>,
): Readonly<{
  provider: string;
  providerSubject: string;
  twoweeksClerkId: string;
  clientIdentity: string;
}> | undefined {
  const provider = readText(value.provider);
  const providerSubject = readText(value.providerSubject);
  const twoweeksClerkId = readText(value.twoweeksClerkId);
  const clientIdentity = readText(value.clientIdentity);
  if (!provider || !providerSubject || !twoweeksClerkId || !clientIdentity) return undefined;

  return { provider, providerSubject, twoweeksClerkId, clientIdentity };
}

function parseAccountLinkGrant(
  value: Record<string, unknown>,
): Readonly<{
  grantedReadScopes: readonly string[];
  grantRef?: string;
  consentRef?: string;
}> | undefined {
  const grantedReadScopes = readTextList(value.grantedReadScopes);
  if (grantedReadScopes === undefined) return undefined;
  const grantRef = readText(value.grantRef);
  const consentRef = readText(value.consentRef);

  return {
    grantedReadScopes,
    ...(grantRef !== undefined ? { grantRef } : {}),
    ...(consentRef !== undefined ? { consentRef } : {}),
  };
}

function parseAccountLinkTiming(
  value: Record<string, unknown>,
): Readonly<{
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  state: LocalMcpAccountLinkingStorageRecordStateV1;
}> | undefined {
  const createdAt = readIsoUtcText(value.createdAt);
  const updatedAt = readIsoUtcText(value.updatedAt);
  const revokedAt = value.revokedAt === undefined ? undefined : readIsoUtcText(value.revokedAt);
  const state = readRecordStateValue(value.state);
  if (!createdAt || !updatedAt || !state) return undefined;
  if (value.revokedAt !== undefined && !revokedAt) return undefined;

  return {
    createdAt,
    updatedAt,
    ...(revokedAt !== undefined ? { revokedAt } : {}),
    state,
  };
}

function hasValidScopeMetadata(
  provider: string,
  grant: Readonly<{
    grantedReadScopes: readonly string[];
    grantRef?: string;
    consentRef?: string;
  }>,
): boolean {
  return (
    provider === "stytch" &&
    grant.grantedReadScopes.every(isAllowedReadScope) &&
    grant.grantRef !== undefined &&
    grant.consentRef !== undefined
  );
}

function isExactRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(value);
  if (!record) return undefined;
  const seen = new Set(Object.keys(record));
  if (seen.size !== allowedKeys.length) return undefined;
  for (const key of allowedKeys) {
    if (!seen.delete(key)) return undefined;
  }
  return seen.size === 0 ? record : undefined;
}

function isRecordWithAllowedKeys(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(value);
  if (!record) return undefined;
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) return undefined;
  }
  return record;
}

function readPlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  return value as Record<string, unknown>;
}

function hasOwnRequiredKeys(record: Record<string, unknown>, requiredKeys: readonly string[]): boolean {
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function readTextList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const textValues: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !/\S/u.test(item)) return undefined;
    textValues.push(item);
  }
  return textValues;
}

function readUnknownList(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? [...value] : undefined;
}

function readIsoUtcText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(trimmed)) return undefined;
  return Number.isFinite(Date.parse(trimmed)) ? trimmed : undefined;
}

function readRecordStateValue(value: unknown): LocalMcpAccountLinkingStorageRecordStateV1 | undefined {
  switch (value) {
    case "active":
    case "revoked":
    case "stale":
      return value;
    default:
      return undefined;
  }
}
