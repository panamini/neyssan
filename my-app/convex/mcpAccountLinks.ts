import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const mcpReadScopeValidator = v.union(
  v.literal("twoweeks.mcp.read"),
  v.literal("twoweeks.application_package.read"),
  v.literal("twoweeks.evidence_graph.read"),
  v.literal("twoweeks.resume_variant_plan.read"),
  v.literal("twoweeks.review_cockpit.read"),
);

const TWOWEEKS_APPLICATIONS_READ_SCOPE = "twoweeks:applications:read" as const;
const MCP_AUTH_VERIFIED_BY_PROVIDER_ADAPTER_PROOF = "already_verified_by_provider_adapter" as const;
const MCP_ACCOUNT_LINK_LIFECYCLE_DEFAULT_CLOCK_SKEW_SECONDS = 300;
const MCP_ACCOUNT_LINK_LIFECYCLE_LEGACY_BASE_SCOPES = ["twoweeks.mcp.read"] as const;
const MAX_SAFE_EPOCH_SECONDS_FOR_MILLISECONDS = Math.floor(Number.MAX_SAFE_INTEGER / 1_000);

const mcpAccountLinkStateValidator = v.union(
  v.literal("active"),
  v.literal("revoked"),
  v.literal("stale"),
);

const mcpAccountLinkRecordValidator = v.object({
  kind: v.literal("local_mcp_account_link_record"),
  version: v.literal(1),
  provider: v.literal("stytch"),
  providerSubject: v.string(),
  twoweeksClerkId: v.string(),
  clientId: v.string(),
  grantedReadScopes: v.array(mcpReadScopeValidator),
  grantRef: v.string(),
  consentRef: v.string(),
  state: mcpAccountLinkStateValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  lastVerifiedAt: v.number(),
  revokedAt: v.optional(v.number()),
  staleAt: v.optional(v.number()),
  auditReasonCode: v.string(),
  issuer: v.optional(v.string()),
  providerEnvironment: v.optional(v.string()),
  canonicalGrantedScopes: v.optional(v.array(v.string())),
  expiresAtEpochSeconds: v.optional(v.number()),
  canonicalAccountLinkVersion: v.optional(v.literal(1)),
});

const resolvedServerOnlyAccountLinkValidator = v.object({
  kind: v.literal("mcp_account_link_server_only_owner_resolution"),
  provider: v.literal("stytch"),
  twoweeksClerkId: v.string(),
  grantedReadScopes: v.array(mcpReadScopeValidator),
  grantRef: v.string(),
  consentRef: v.string(),
  auditReasonCode: v.string(),
  version: v.literal(1),
});

const mcpAuthPolicyAccountLinkCandidateValidator = v.object({
  kind: v.literal("mcp_auth_policy_account_link_record"),
  issuer: v.string(),
  subject: v.string(),
  providerEnvironment: v.string(),
  clientId: v.string(),
  twoweeksClerkId: v.string(),
  grantedScopes: v.array(v.literal(TWOWEEKS_APPLICATIONS_READ_SCOPE)),
  state: mcpAccountLinkStateValidator,
  createdAtEpochSeconds: v.number(),
  updatedAtEpochSeconds: v.number(),
  expiresAtEpochSeconds: v.number(),
  version: v.literal(1),
});

const mcpAuthPolicyAccountLinkLookupMalformedCandidateValidator = v.object({
  kind: v.literal("mcp_auth_policy_account_link_lookup_malformed_candidate"),
  reason: v.union(
    v.literal("malformed_lookup_input"),
    v.literal("malformed_storage_record"),
    v.literal("candidate_overflow"),
  ),
  version: v.literal(1),
});

const mcpTrustedAccountLinkOwnerValidator = v.object({
  kind: v.literal("mcp_trusted_account_link_owner"),
  twoweeksClerkId: v.string(),
  version: v.literal(1),
});

const mcpVerifiedAccountLinkEvidenceValidator = v.object({
  kind: v.literal("mcp_verified_account_link_evidence"),
  provider: v.literal("stytch"),
  issuer: v.string(),
  subject: v.string(),
  providerEnvironment: v.string(),
  clientId: v.string(),
  resource: v.string(),
  grantedScopes: v.array(v.string()),
  expiresAtEpochSeconds: v.number(),
  verifiedAtEpochSeconds: v.number(),
  cryptographicVerification: v.literal(MCP_AUTH_VERIFIED_BY_PROVIDER_ADAPTER_PROOF),
  version: v.literal(1),
});

const mcpAccountLinkLifecycleConfigValidator = v.object({
  kind: v.literal("mcp_account_link_lifecycle_config"),
  expectedIssuer: v.string(),
  expectedResource: v.string(),
  expectedProviderEnvironment: v.string(),
  allowedClientIds: v.array(v.string()),
  clockSkewSeconds: v.optional(v.number()),
  version: v.literal(1),
});

const mcpAccountLinkLifecycleIdentityValidator = v.object({
  kind: v.literal("mcp_account_link_lifecycle_identity"),
  issuer: v.string(),
  subject: v.string(),
  providerEnvironment: v.string(),
  clientId: v.string(),
  version: v.literal(1),
});

const MCP_ACCOUNT_LINK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,191}$/u;
const MCP_ACCOUNT_LINK_AUDIT_REASON_CODE_PATTERN = /^[a-z][a-z0-9_]{2,80}$/u;
const FORBIDDEN_MCP_ACCOUNT_LINK_STORED_TEXT_PATTERN =
  /@|bearer\s+\S+|authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|credential|cookie|session|raw[_-]?(cv|resume|job|proposal|claims)|private[_-]?fact|never[_-]?use|source[_-]?(text|quote)|structured[_-]?shadow|convex[_-]?(id|document)|debug[_-]?payload/iu;
export const MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES = 25;
const ACCOUNT_LINK_RECORD_ALLOWED_KEYS = [
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
  "issuer",
  "providerEnvironment",
  "canonicalGrantedScopes",
  "expiresAtEpochSeconds",
  "canonicalAccountLinkVersion",
] as const;
const ACCOUNT_LINK_STORAGE_DOCUMENT_ALLOWED_KEYS = [
  ...ACCOUNT_LINK_RECORD_ALLOWED_KEYS,
  "_id",
  "_creationTime",
] as const;
const CANONICAL_ACCOUNT_LINK_FIELD_KEYS = [
  "issuer",
  "providerEnvironment",
  "canonicalGrantedScopes",
  "expiresAtEpochSeconds",
  "canonicalAccountLinkVersion",
] as const;
const TRUSTED_OWNER_KEYS = ["kind", "twoweeksClerkId", "version"] as const;
const VERIFIED_ACCOUNT_LINK_EVIDENCE_KEYS = [
  "kind",
  "provider",
  "issuer",
  "subject",
  "providerEnvironment",
  "clientId",
  "resource",
  "grantedScopes",
  "expiresAtEpochSeconds",
  "verifiedAtEpochSeconds",
  "cryptographicVerification",
  "version",
] as const;
const LIFECYCLE_CONFIG_KEYS = [
  "kind",
  "expectedIssuer",
  "expectedResource",
  "expectedProviderEnvironment",
  "allowedClientIds",
  "clockSkewSeconds",
  "version",
] as const;
const LIFECYCLE_IDENTITY_KEYS = [
  "kind",
  "issuer",
  "subject",
  "providerEnvironment",
  "clientId",
  "version",
] as const;

export type McpAccountLinkCanonicalStorageClassificationV1 =
  | "canonical_ready"
  | "legacy_missing_canonical_fields"
  | "malformed";

export type McpAccountLinkCanonicalPolicyCandidateV1 = Readonly<{
  kind: "mcp_auth_policy_account_link_record";
  issuer: string;
  subject: string;
  providerEnvironment: string;
  clientId: string;
  twoweeksClerkId: string;
  grantedScopes: [typeof TWOWEEKS_APPLICATIONS_READ_SCOPE];
  state: "active" | "revoked" | "stale";
  createdAtEpochSeconds: number;
  updatedAtEpochSeconds: number;
  expiresAtEpochSeconds: number;
  version: 1;
}>;

export type McpAccountLinkLookupMalformedCandidateV1 = Readonly<{
  kind: "mcp_auth_policy_account_link_lookup_malformed_candidate";
  reason: "malformed_lookup_input" | "malformed_storage_record" | "candidate_overflow";
  version: 1;
}>;

export type McpAccountLinkLookupCandidateV1 =
  | McpAccountLinkCanonicalPolicyCandidateV1
  | McpAccountLinkLookupMalformedCandidateV1;

export type McpTrustedAccountLinkOwnerV1 = Readonly<{
  kind: "mcp_trusted_account_link_owner";
  twoweeksClerkId: string;
  version: 1;
}>;

export type McpVerifiedAccountLinkEvidenceV1 = Readonly<{
  kind: "mcp_verified_account_link_evidence";
  provider: "stytch";
  issuer: string;
  subject: string;
  providerEnvironment: string;
  clientId: string;
  resource: string;
  grantedScopes: readonly string[];
  expiresAtEpochSeconds: number;
  verifiedAtEpochSeconds: number;
  cryptographicVerification: typeof MCP_AUTH_VERIFIED_BY_PROVIDER_ADAPTER_PROOF;
  version: 1;
}>;

export type McpAccountLinkLifecycleConfigV1 = Readonly<{
  kind: "mcp_account_link_lifecycle_config";
  expectedIssuer: string;
  expectedResource: string;
  expectedProviderEnvironment: string;
  allowedClientIds: readonly string[];
  clockSkewSeconds?: number;
  version: 1;
}>;

export type McpAccountLinkLifecycleIdentityV1 = Readonly<{
  kind: "mcp_account_link_lifecycle_identity";
  issuer: string;
  subject: string;
  providerEnvironment: string;
  clientId: string;
  version: 1;
}>;

export type McpAccountLinkLifecycleReasonV1 =
  | "linked"
  | "refreshed"
  | "revoked"
  | "already_linked"
  | "unchanged"
  | "not_found"
  | "invalid_owner"
  | "malformed_evidence"
  | "wrong_issuer"
  | "wrong_resource"
  | "wrong_environment"
  | "unknown_client"
  | "missing_canonical_scope"
  | "legacy_scope"
  | "expired_evidence"
  | "future_evidence"
  | "candidate_overflow"
  | "malformed_candidate"
  | "cross_owner_conflict"
  | "duplicate_account_link"
  | "mismatched_active_link"
  | "stale_evidence"
  | "expiry_regression"
  | "relink_required";

export type McpAccountLinkLifecycleResultV1 = Readonly<
  | {
      kind: "mcp_account_link_lifecycle_result";
      operation: "link" | "refresh" | "revoke";
      ok: true;
      reason: Extract<
        McpAccountLinkLifecycleReasonV1,
        "linked" | "refreshed" | "revoked" | "already_linked" | "unchanged"
      >;
      serverOnly: {
        twoweeksClerkId: string;
        provider: "stytch";
        subject: string;
        clientId: string;
        version: 1;
      };
      modelVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_account_link_lifecycle_result";
      operation: "link" | "refresh" | "revoke";
      ok: false;
      reason: Exclude<
        McpAccountLinkLifecycleReasonV1,
        "linked" | "refreshed" | "revoked" | "already_linked" | "unchanged"
      >;
      safeFailure: {
        code: "mcp_account_link_lifecycle_denied";
        message: "Account-link lifecycle denied.";
        safeForModel: true;
        tokenEchoed: false;
        identityEchoed: false;
        version: 1;
      };
      modelVisible: false;
      version: 1;
    }
>;

export type McpAccountLinkCanonicalProjectionV1 = Readonly<
  | {
      classification: "canonical_ready";
      policyCandidate: McpAccountLinkCanonicalPolicyCandidateV1;
      version: 1;
    }
  | {
      classification: Exclude<McpAccountLinkCanonicalStorageClassificationV1, "canonical_ready">;
      policyCandidate: null;
      version: 1;
    }
>;

type CanonicalAccountLinkFieldBag = Readonly<{
  issuer?: unknown;
  providerEnvironment?: unknown;
  canonicalGrantedScopes?: unknown;
  expiresAtEpochSeconds?: unknown;
  canonicalAccountLinkVersion?: unknown;
}>;
type LookupCandidateSortKey = string | number;

export const internalCreateMcpAccountLink = internalMutation({
  args: {
    record: mcpAccountLinkRecordValidator,
  },
  returns: v.id("mcpAccountLinks"),
  handler: async (ctx, args) => {
    assertValidAccountLinkRecord(args.record);

    const existingRows = await ctx.db
      .query("mcpAccountLinks")
      .withIndex("by_provider_subject_client", (q) =>
        q
          .eq("provider", args.record.provider)
          .eq("providerSubject", args.record.providerSubject)
          .eq("clientId", args.record.clientId),
      )
      .collect();

    if (existingRows.some((row) => row.state !== "revoked")) {
      throw new Error("MCP account link already has a non-revoked record");
    }

    return await ctx.db.insert("mcpAccountLinks", args.record);
  },
});

export const internalResolveActiveMcpAccountLink = internalQuery({
  args: {
    providerSubject: v.string(),
    clientId: v.string(),
    requiredReadScopes: v.array(mcpReadScopeValidator),
    now: v.optional(v.number()),
    maxLinkAgeMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), resolvedServerOnlyAccountLinkValidator),
  handler: async (ctx, args) => {
    if (!isSafeAccountLinkIdentifier(args.providerSubject) || !isSafeAccountLinkIdentifier(args.clientId)) {
      return null;
    }

    const rows = await ctx.db
      .query("mcpAccountLinks")
      .withIndex("by_provider_subject_client", (q) =>
        q
          .eq("provider", "stytch")
          .eq("providerSubject", args.providerSubject)
          .eq("clientId", args.clientId),
      )
      .collect();

    const nonRevokedRows = rows.filter((row) => row.state !== "revoked");
    if (nonRevokedRows.length !== 1) return null;

    const row = nonRevokedRows[0];
    if (row.state !== "active") return null;
    if (row.revokedAt !== undefined || row.staleAt !== undefined) return null;
    if (isExpiredAccountLink(row, { now: args.now, maxLinkAgeMs: args.maxLinkAgeMs })) return null;
    if (!hasRequiredScopes(row.grantedReadScopes, args.requiredReadScopes)) return null;

    return {
      kind: "mcp_account_link_server_only_owner_resolution" as const,
      provider: "stytch" as const,
      twoweeksClerkId: row.twoweeksClerkId,
      grantedReadScopes: [...row.grantedReadScopes],
      grantRef: row.grantRef,
      consentRef: row.consentRef,
      auditReasonCode: row.auditReasonCode,
      version: 1 as const,
    };
  },
});

export const internalLookupMcpAuthPolicyAccountLinkCandidates = internalQuery({
  args: {
    issuer: v.string(),
    subject: v.string(),
    providerEnvironment: v.string(),
    version: v.literal(1),
  },
  returns: v.array(
    v.union(
      mcpAuthPolicyAccountLinkCandidateValidator,
      mcpAuthPolicyAccountLinkLookupMalformedCandidateValidator,
    ),
  ),
  handler: async (ctx, args) => {
    if (
      !isSafeHttpsIssuer(args.issuer) ||
      !isSafeAccountLinkIdentifier(args.subject) ||
      !isSafeAccountLinkIdentifier(args.providerEnvironment)
    ) {
      return [malformedLookupCandidate("malformed_lookup_input")];
    }

    const rows = await ctx.db
      .query("mcpAccountLinks")
      .withIndex("by_provider_issuer_subject_environment", (q) =>
        q
          .eq("provider", "stytch")
          .eq("issuer", args.issuer)
          .eq("providerSubject", args.subject)
          .eq("providerEnvironment", args.providerEnvironment),
      )
      .take(MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES + 1);

    if (rows.length > MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES) {
      return [malformedLookupCandidate("candidate_overflow")];
    }

    return rows
      .map((row): McpAccountLinkLookupCandidateV1 => {
        const projection = projectMcpAccountLinkCanonicalStorageRecordToPolicyCandidate(row);
        return projection.classification === "canonical_ready" && projection.policyCandidate
          ? projection.policyCandidate
          : malformedLookupCandidate("malformed_storage_record");
      })
      .sort(compareLookupCandidates);
  },
});

export const internalLinkCanonicalMcpAccount = internalMutation({
  args: {
    trustedOwner: mcpTrustedAccountLinkOwnerValidator,
    evidence: mcpVerifiedAccountLinkEvidenceValidator,
    config: mcpAccountLinkLifecycleConfigValidator,
    nowEpochSeconds: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpAccountLinkLifecycleResultV1> => {
    const owner = parseTrustedAccountLinkOwner(args.trustedOwner);
    if (!owner) return denyLifecycle("link", "invalid_owner");

    const evidence = parseMcpVerifiedAccountLinkEvidence(args.evidence, args.config, args.nowEpochSeconds);
    if (!evidence.ok) return denyLifecycle("link", evidence.reason);

    const candidates = await readLifecycleCandidates(ctx, evidence.value);
    if (!candidates.ok) return denyLifecycle("link", candidates.reason);

    const exactClientRowsRead = await readExactClientAccountLinkRows(ctx, evidence.value);
    if (!exactClientRowsRead.ok) return denyLifecycle("link", exactClientRowsRead.reason);

    const exactClientRows = exactClientRowsRead.rows;

    const exactClientLegacyNonRevoked = exactClientRows.some(
      (candidate) => candidate.classification === "legacy_missing_canonical_fields" && candidate.row.state !== "revoked",
    );
    if (exactClientLegacyNonRevoked) return denyLifecycle("link", "malformed_candidate");

    const exactClientCanonicalOutsideLifecycleIdentity = exactClientRows.some(
      (candidate) =>
        candidate.classification === "canonical_ready" &&
        candidate.row.state !== "revoked" &&
        (candidate.row.issuer !== evidence.value.issuer ||
          candidate.row.providerEnvironment !== evidence.value.providerEnvironment),
    );
    if (exactClientCanonicalOutsideLifecycleIdentity) return denyLifecycle("link", "duplicate_account_link");

    const canonicalRows = candidates.rows;
    if (canonicalRows.some((candidate) => candidate.policyCandidate.twoweeksClerkId !== owner.twoweeksClerkId)) {
      return denyLifecycle("link", "cross_owner_conflict");
    }

    if (canonicalRows.length > 1) return denyLifecycle("link", "duplicate_account_link");

    if (canonicalRows.length === 1) {
      const existing = canonicalRows[0];
      if (existing.policyCandidate.clientId !== evidence.value.clientId) {
        return denyLifecycle("link", "duplicate_account_link");
      }
      if (existing.row.state !== "active") return denyLifecycle("link", "relink_required");
      if (isSameEvidenceAsStored(existing.row, evidence.value)) {
        return allowLifecycle("link", "already_linked", owner.twoweeksClerkId, evidence.value);
      }
      return denyLifecycle("link", "duplicate_account_link");
    }

    const exactClientRevoked = exactClientRows.some((candidate) => candidate.row.state === "revoked");
    if (exactClientRevoked) return denyLifecycle("link", "relink_required");

    const record = buildCanonicalAccountLinkRecord(owner, evidence.value);
    assertValidAccountLinkRecord(record);
    await ctx.db.insert("mcpAccountLinks", record);

    return allowLifecycle("link", "linked", owner.twoweeksClerkId, evidence.value);
  },
});

export const internalRefreshCanonicalMcpAccountLink = internalMutation({
  args: {
    trustedOwner: mcpTrustedAccountLinkOwnerValidator,
    evidence: mcpVerifiedAccountLinkEvidenceValidator,
    config: mcpAccountLinkLifecycleConfigValidator,
    nowEpochSeconds: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpAccountLinkLifecycleResultV1> => {
    const owner = parseTrustedAccountLinkOwner(args.trustedOwner);
    if (!owner) return denyLifecycle("refresh", "invalid_owner");

    const evidence = parseMcpVerifiedAccountLinkEvidence(args.evidence, args.config, args.nowEpochSeconds);
    if (!evidence.ok) return denyLifecycle("refresh", evidence.reason);

    const candidates = await readLifecycleCandidates(ctx, evidence.value);
    if (!candidates.ok) return denyLifecycle("refresh", candidates.reason);
    if (candidates.rows.length === 0) return denyLifecycle("refresh", "not_found");
    if (candidates.rows.length > 1) return denyLifecycle("refresh", "duplicate_account_link");

    const existing = candidates.rows[0];
    if (existing.policyCandidate.twoweeksClerkId !== owner.twoweeksClerkId) {
      return denyLifecycle("refresh", "cross_owner_conflict");
    }
    if (existing.policyCandidate.clientId !== evidence.value.clientId) {
      return denyLifecycle("refresh", "mismatched_active_link");
    }
    if (existing.row.state !== "active") return denyLifecycle("refresh", "relink_required");

    const storedVerifiedAtEpochSeconds = toEpochSeconds(existing.row.lastVerifiedAt);
    if (evidence.value.verifiedAtEpochSeconds < storedVerifiedAtEpochSeconds) {
      return denyLifecycle("refresh", "stale_evidence");
    }
    if (evidence.value.verifiedAtEpochSeconds === storedVerifiedAtEpochSeconds) {
      if (evidence.value.expiresAtEpochSeconds === existing.policyCandidate.expiresAtEpochSeconds) {
        return allowLifecycle("refresh", "unchanged", owner.twoweeksClerkId, evidence.value);
      }
      return denyLifecycle("refresh", "stale_evidence");
    }
    if (evidence.value.expiresAtEpochSeconds < existing.policyCandidate.expiresAtEpochSeconds) {
      return denyLifecycle("refresh", "expiry_regression");
    }

    await ctx.db.patch(existing.row._id as Parameters<typeof ctx.db.patch>[0], {
      updatedAt: toEpochMilliseconds(evidence.value.verifiedAtEpochSeconds),
      lastVerifiedAt: toEpochMilliseconds(evidence.value.verifiedAtEpochSeconds),
      expiresAtEpochSeconds: evidence.value.expiresAtEpochSeconds,
      canonicalGrantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      canonicalAccountLinkVersion: 1,
      auditReasonCode: "account_link_refreshed",
    });

    return allowLifecycle("refresh", "refreshed", owner.twoweeksClerkId, evidence.value);
  },
});

export const internalRevokeCanonicalMcpAccountLink = internalMutation({
  args: {
    trustedOwner: mcpTrustedAccountLinkOwnerValidator,
    identity: mcpAccountLinkLifecycleIdentityValidator,
    nowEpochSeconds: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpAccountLinkLifecycleResultV1> => {
    const owner = parseTrustedAccountLinkOwner(args.trustedOwner);
    if (!owner) return denyLifecycle("revoke", "invalid_owner");

    const identity = parseLifecycleIdentity(args.identity, args.nowEpochSeconds);
    if (!identity) return denyLifecycle("revoke", "malformed_evidence");

    const candidates = await readLifecycleCandidates(ctx, {
      issuer: identity.issuer,
      subject: identity.subject,
      providerEnvironment: identity.providerEnvironment,
      clientId: identity.clientId,
    });
    if (!candidates.ok) return denyLifecycle("revoke", candidates.reason);
    if (candidates.rows.length === 0) return denyLifecycle("revoke", "not_found");

    const exactClientRows = candidates.rows.filter(
      (candidate) => candidate.policyCandidate.clientId === identity.clientId,
    );
    if (exactClientRows.length === 0) return denyLifecycle("revoke", "mismatched_active_link");
    if (exactClientRows.length > 1) return denyLifecycle("revoke", "duplicate_account_link");

    const existing = exactClientRows[0];
    if (existing.policyCandidate.twoweeksClerkId !== owner.twoweeksClerkId) {
      return denyLifecycle("revoke", "cross_owner_conflict");
    }
    if (existing.policyCandidate.clientId !== identity.clientId) {
      return denyLifecycle("revoke", "mismatched_active_link");
    }
    if (existing.row.state === "revoked") {
      return allowLifecycle("revoke", "unchanged", owner.twoweeksClerkId, {
        subject: identity.subject,
        clientId: identity.clientId,
      });
    }
    if (existing.row.state !== "active") return denyLifecycle("revoke", "relink_required");

    const revokedAt = toEpochMilliseconds(args.nowEpochSeconds);
    await ctx.db.patch(existing.row._id as Parameters<typeof ctx.db.patch>[0], {
      state: "revoked",
      updatedAt: revokedAt,
      revokedAt,
      auditReasonCode: "account_link_revoked",
    });

    return allowLifecycle("revoke", "revoked", owner.twoweeksClerkId, {
      subject: identity.subject,
      clientId: identity.clientId,
    });
  },
});

function parseTrustedAccountLinkOwner(value: unknown): McpTrustedAccountLinkOwnerV1 | undefined {
  if (!isPlainRecord(value) || !hasOnlyAllowedAccountLinkKeys(value, TRUSTED_OWNER_KEYS)) return undefined;
  if (value.kind !== "mcp_trusted_account_link_owner" || value.version !== 1) return undefined;
  if (!isSafeAccountLinkIdentifierValue(value.twoweeksClerkId)) return undefined;
  return {
    kind: "mcp_trusted_account_link_owner",
    twoweeksClerkId: value.twoweeksClerkId,
    version: 1,
  };
}

function parseMcpVerifiedAccountLinkEvidence(
  evidenceValue: unknown,
  configValue: unknown,
  nowEpochSeconds: number,
):
  | { ok: true; value: ParsedLifecycleEvidence }
  | {
      ok: false;
      reason:
        | "malformed_evidence"
        | "wrong_issuer"
        | "wrong_resource"
        | "wrong_environment"
        | "unknown_client"
        | "missing_canonical_scope"
        | "legacy_scope"
        | "expired_evidence"
        | "future_evidence";
    } {
  const evidence = readLifecycleEvidenceRecord(evidenceValue);
  const config = readLifecycleConfigRecord(configValue);
  if (!evidence || !config || !isSafeEpochSeconds(nowEpochSeconds)) {
    return { ok: false, reason: "malformed_evidence" };
  }

  if (evidence.issuer !== config.expectedIssuer) return { ok: false, reason: "wrong_issuer" };
  if (evidence.resource !== config.expectedResource) return { ok: false, reason: "wrong_resource" };
  if (evidence.providerEnvironment !== config.expectedProviderEnvironment) {
    return { ok: false, reason: "wrong_environment" };
  }
  if (!config.allowedClientIds.includes(evidence.clientId)) return { ok: false, reason: "unknown_client" };

  const scopeDecision = evaluateLifecycleScopes(evidence.grantedScopes);
  if (!scopeDecision.ok) return { ok: false, reason: scopeDecision.reason };

  if (evidence.expiresAtEpochSeconds <= evidence.verifiedAtEpochSeconds) {
    return { ok: false, reason: "malformed_evidence" };
  }
  if (evidence.expiresAtEpochSeconds <= nowEpochSeconds) return { ok: false, reason: "expired_evidence" };
  const clockSkewSeconds =
    config.clockSkewSeconds ?? MCP_ACCOUNT_LINK_LIFECYCLE_DEFAULT_CLOCK_SKEW_SECONDS;
  if (!Number.isFinite(clockSkewSeconds) || clockSkewSeconds < 0) {
    return { ok: false, reason: "malformed_evidence" };
  }
  if (evidence.verifiedAtEpochSeconds > nowEpochSeconds + clockSkewSeconds) {
    return { ok: false, reason: "future_evidence" };
  }

  return {
    ok: true,
    value: Object.freeze({
      issuer: evidence.issuer,
      subject: evidence.subject,
      providerEnvironment: evidence.providerEnvironment,
      clientId: evidence.clientId,
      resource: evidence.resource,
      expiresAtEpochSeconds: evidence.expiresAtEpochSeconds,
      verifiedAtEpochSeconds: evidence.verifiedAtEpochSeconds,
    }),
  };
}

function readLifecycleEvidenceRecord(value: unknown): McpVerifiedAccountLinkEvidenceV1 | undefined {
  if (!isPlainRecord(value) || !hasOnlyAllowedAccountLinkKeys(value, VERIFIED_ACCOUNT_LINK_EVIDENCE_KEYS)) {
    return undefined;
  }
  if (
    value.kind !== "mcp_verified_account_link_evidence" ||
    value.provider !== "stytch" ||
    value.cryptographicVerification !== MCP_AUTH_VERIFIED_BY_PROVIDER_ADAPTER_PROOF ||
    value.version !== 1
  ) {
    return undefined;
  }
  if (!isSafeHttpsIssuer(value.issuer)) return undefined;
  if (!isSafeAccountLinkIdentifierValue(value.subject)) return undefined;
  if (!isSafeAccountLinkIdentifierValue(value.providerEnvironment)) return undefined;
  if (!isSafeAccountLinkIdentifierValue(value.clientId)) return undefined;
  if (!isSafeHttpsIssuer(value.resource)) return undefined;
  if (!Array.isArray(value.grantedScopes) || !value.grantedScopes.every((scope) => typeof scope === "string")) {
    return undefined;
  }
  if (!isSafeEpochSeconds(value.expiresAtEpochSeconds) || !isSafeEpochSeconds(value.verifiedAtEpochSeconds)) {
    return undefined;
  }
  return {
    kind: "mcp_verified_account_link_evidence",
    provider: "stytch",
    issuer: value.issuer,
    subject: value.subject,
    providerEnvironment: value.providerEnvironment,
    clientId: value.clientId,
    resource: value.resource,
    grantedScopes: Object.freeze([...value.grantedScopes]),
    expiresAtEpochSeconds: value.expiresAtEpochSeconds,
    verifiedAtEpochSeconds: value.verifiedAtEpochSeconds,
    cryptographicVerification: MCP_AUTH_VERIFIED_BY_PROVIDER_ADAPTER_PROOF,
    version: 1,
  };
}

function readLifecycleConfigRecord(value: unknown): McpAccountLinkLifecycleConfigV1 | undefined {
  if (!isPlainRecord(value) || !hasOnlyAllowedAccountLinkKeys(value, LIFECYCLE_CONFIG_KEYS)) return undefined;
  if (value.kind !== "mcp_account_link_lifecycle_config" || value.version !== 1) return undefined;
  if (!isSafeHttpsIssuer(value.expectedIssuer)) return undefined;
  if (!isSafeHttpsIssuer(value.expectedResource)) return undefined;
  if (!isSafeAccountLinkIdentifierValue(value.expectedProviderEnvironment)) return undefined;
  if (!Array.isArray(value.allowedClientIds) || !value.allowedClientIds.every(isSafeAccountLinkIdentifierValue)) {
    return undefined;
  }
  if (value.clockSkewSeconds !== undefined && typeof value.clockSkewSeconds !== "number") return undefined;
  return {
    kind: "mcp_account_link_lifecycle_config",
    expectedIssuer: value.expectedIssuer,
    expectedResource: value.expectedResource,
    expectedProviderEnvironment: value.expectedProviderEnvironment,
    allowedClientIds: Object.freeze([...value.allowedClientIds]),
    ...(value.clockSkewSeconds !== undefined ? { clockSkewSeconds: value.clockSkewSeconds } : {}),
    version: 1,
  };
}

function evaluateLifecycleScopes(
  scopes: readonly string[],
): { ok: true } | { ok: false; reason: "missing_canonical_scope" | "legacy_scope" } {
  if (!scopes.includes(TWOWEEKS_APPLICATIONS_READ_SCOPE)) return { ok: false, reason: "missing_canonical_scope" };
  if (scopes.some((scope) => scope.includes(".") || scope !== TWOWEEKS_APPLICATIONS_READ_SCOPE)) {
    return { ok: false, reason: "legacy_scope" };
  }
  return { ok: true };
}

function parseLifecycleIdentity(
  value: unknown,
  nowEpochSeconds: number,
): Pick<ParsedLifecycleEvidence, "issuer" | "subject" | "providerEnvironment" | "clientId"> | undefined {
  if (!isPlainRecord(value) || !hasOnlyAllowedAccountLinkKeys(value, LIFECYCLE_IDENTITY_KEYS)) return undefined;
  if (value.kind !== "mcp_account_link_lifecycle_identity" || value.version !== 1) return undefined;
  if (!isSafeEpochSeconds(nowEpochSeconds)) return undefined;
  if (!isSafeHttpsIssuer(value.issuer)) return undefined;
  if (!isSafeAccountLinkIdentifierValue(value.subject)) return undefined;
  if (!isSafeAccountLinkIdentifierValue(value.providerEnvironment)) return undefined;
  if (!isSafeAccountLinkIdentifierValue(value.clientId)) return undefined;
  return {
    issuer: value.issuer,
    subject: value.subject,
    providerEnvironment: value.providerEnvironment,
    clientId: value.clientId,
  };
}

async function readLifecycleCandidates(
  ctx: unknown,
  evidence: Pick<ParsedLifecycleEvidence, "issuer" | "subject" | "providerEnvironment" | "clientId">,
): Promise<LifecycleCandidateRead> {
  const lifecycleCtx = ctx as LifecycleQueryCtx;
  const rows = await lifecycleCtx.db
    .query("mcpAccountLinks")
    .withIndex("by_provider_issuer_subject_environment", (q) =>
      q
        .eq("provider", "stytch")
        .eq("issuer", evidence.issuer)
        .eq("providerSubject", evidence.subject)
        .eq("providerEnvironment", evidence.providerEnvironment),
    )
    .take(MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES + 1);

  if (rows.length > MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES) {
    return { ok: false, reason: "candidate_overflow" };
  }

  const candidates = rows.map((row) => {
    const projection = projectMcpAccountLinkCanonicalStorageRecordToPolicyCandidate(row);
    if (projection.classification !== "canonical_ready" || !projection.policyCandidate) return undefined;
    if (!isLifecycleStorageRow(row)) return undefined;
    return {
      row,
      policyCandidate: projection.policyCandidate,
    };
  });

  if (candidates.some((candidate) => candidate === undefined)) {
    return { ok: false, reason: "malformed_candidate" };
  }

  return {
    ok: true,
    rows: Object.freeze(
      candidates.filter(
        (candidate): candidate is { row: LifecycleStorageRow; policyCandidate: McpAccountLinkCanonicalPolicyCandidateV1 } =>
          candidate !== undefined,
      ),
    ),
  };
}

async function readExactClientAccountLinkRows(
  ctx: unknown,
  evidence: Pick<ParsedLifecycleEvidence, "subject" | "clientId">,
): Promise<ExactClientAccountLinkRowsRead> {
  const lifecycleCtx = ctx as LifecycleQueryCtx;
  const rows = await lifecycleCtx.db
    .query("mcpAccountLinks")
    .withIndex("by_provider_subject_client", (q) =>
      q
        .eq("provider", "stytch")
        .eq("providerSubject", evidence.subject)
        .eq("clientId", evidence.clientId),
    )
    .take(MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES + 1);

  if (rows.length > MCP_AUTH_POLICY_ACCOUNT_LINK_LOOKUP_MAX_CANDIDATES) {
    return { ok: false, reason: "candidate_overflow" };
  }

  const candidates = rows.map((row): ExactClientLifecycleStorageRow | undefined => {
    const classification = classifyMcpAccountLinkCanonicalStorageRecord(row);
    if (!isLifecycleStorageRow(row) || classification === "malformed") return undefined;
    return { row, classification };
  });

  if (candidates.some((candidate) => candidate === undefined)) {
    return { ok: false, reason: "malformed_candidate" };
  }

  return {
    ok: true,
    rows: Object.freeze(
      candidates.filter((candidate): candidate is ExactClientLifecycleStorageRow => candidate !== undefined),
    ),
  };
}

function isLifecycleStorageRow(value: unknown): value is LifecycleStorageRow {
  const parsed = parseStorageAccountLinkRecord(value);
  return (
    parsed !== undefined &&
    isPlainRecord(value) &&
    typeof value._id === "string" &&
    value.kind === "local_mcp_account_link_record" &&
    value.version === 1 &&
    typeof value.grantRef === "string" &&
    typeof value.consentRef === "string" &&
    typeof value.auditReasonCode === "string"
  );
}

function buildCanonicalAccountLinkRecord(
  owner: McpTrustedAccountLinkOwnerV1,
  evidence: ParsedLifecycleEvidence,
) {
  const verifiedAtMilliseconds = toEpochMilliseconds(evidence.verifiedAtEpochSeconds);
  return {
    kind: "local_mcp_account_link_record" as const,
    version: 1 as const,
    provider: "stytch" as const,
    providerSubject: evidence.subject,
    twoweeksClerkId: owner.twoweeksClerkId,
    clientId: evidence.clientId,
    grantedReadScopes: [...MCP_ACCOUNT_LINK_LIFECYCLE_LEGACY_BASE_SCOPES],
    grantRef: "mcp_lifecycle_grant_v1",
    consentRef: "mcp_lifecycle_consent_v1",
    state: "active" as const,
    createdAt: verifiedAtMilliseconds,
    updatedAt: verifiedAtMilliseconds,
    lastVerifiedAt: verifiedAtMilliseconds,
    auditReasonCode: "account_link_verified",
    issuer: evidence.issuer,
    providerEnvironment: evidence.providerEnvironment,
    canonicalGrantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    expiresAtEpochSeconds: evidence.expiresAtEpochSeconds,
    canonicalAccountLinkVersion: 1 as const,
  };
}

function isSameEvidenceAsStored(row: LifecycleStorageRow, evidence: ParsedLifecycleEvidence): boolean {
  return (
    row.issuer === evidence.issuer &&
    row.providerSubject === evidence.subject &&
    row.providerEnvironment === evidence.providerEnvironment &&
    row.clientId === evidence.clientId &&
    row.lastVerifiedAt === toEpochMilliseconds(evidence.verifiedAtEpochSeconds) &&
    row.expiresAtEpochSeconds === evidence.expiresAtEpochSeconds &&
    row.canonicalGrantedScopes?.length === 1 &&
    row.canonicalGrantedScopes[0] === TWOWEEKS_APPLICATIONS_READ_SCOPE &&
    row.canonicalAccountLinkVersion === 1
  );
}

function allowLifecycle(
  operation: "link" | "refresh" | "revoke",
  reason: Extract<
    McpAccountLinkLifecycleReasonV1,
    "linked" | "refreshed" | "revoked" | "already_linked" | "unchanged"
  >,
  twoweeksClerkId: string,
  identity: Pick<ParsedLifecycleEvidence, "subject" | "clientId">,
): McpAccountLinkLifecycleResultV1 {
  return Object.freeze({
    kind: "mcp_account_link_lifecycle_result",
    operation,
    ok: true,
    reason,
    serverOnly: Object.freeze({
      twoweeksClerkId,
      provider: "stytch" as const,
      subject: identity.subject,
      clientId: identity.clientId,
      version: 1 as const,
    }),
    modelVisible: false,
    version: 1,
  });
}

function denyLifecycle(
  operation: "link" | "refresh" | "revoke",
  reason: Exclude<
    McpAccountLinkLifecycleReasonV1,
    "linked" | "refreshed" | "revoked" | "already_linked" | "unchanged"
  >,
): McpAccountLinkLifecycleResultV1 {
  return Object.freeze({
    kind: "mcp_account_link_lifecycle_result",
    operation,
    ok: false,
    reason,
    safeFailure: Object.freeze({
      code: "mcp_account_link_lifecycle_denied" as const,
      message: "Account-link lifecycle denied." as const,
      safeForModel: true as const,
      tokenEchoed: false as const,
      identityEchoed: false as const,
      version: 1 as const,
    }),
    modelVisible: false,
    version: 1,
  });
}

export const internalMarkMcpAccountLinkState = internalMutation({
  args: {
    providerSubject: v.string(),
    clientId: v.string(),
    state: v.union(v.literal("revoked"), v.literal("stale")),
    changedAt: v.number(),
    auditReasonCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertSafeAccountLinkIdentifier("provider subject", args.providerSubject);
    assertSafeAccountLinkIdentifier("client id", args.clientId);
    assertFiniteAccountLinkTimestamp(args.changedAt);
    assertSafeAuditReasonCode(args.auditReasonCode);

    const rows = await ctx.db
      .query("mcpAccountLinks")
      .withIndex("by_provider_subject_client", (q) =>
        q
          .eq("provider", "stytch")
          .eq("providerSubject", args.providerSubject)
          .eq("clientId", args.clientId),
      )
      .collect();

    const nonRevokedRows = rows.filter((row) => row.state !== "revoked");
    if (nonRevokedRows.length !== 1) return null;

    const row = nonRevokedRows[0];
    if (row.state === args.state) return null;

    await ctx.db.patch(row._id, {
      state: args.state,
      updatedAt: args.changedAt,
      auditReasonCode: args.auditReasonCode,
      ...(args.state === "revoked" ? { revokedAt: args.changedAt } : {}),
      ...(args.state === "stale" ? { staleAt: args.changedAt } : {}),
    });

    return null;
  },
});

function assertValidAccountLinkRecord(
  record: Readonly<{
    providerSubject: string;
    twoweeksClerkId: string;
    clientId: string;
    grantedReadScopes: readonly string[];
    grantRef: string;
    consentRef: string;
    state: "active" | "revoked" | "stale";
    createdAt: number;
    updatedAt: number;
    lastVerifiedAt: number;
    revokedAt?: number;
    staleAt?: number;
    auditReasonCode: string;
    issuer?: string;
    providerEnvironment?: string;
    canonicalGrantedScopes?: readonly string[];
    expiresAtEpochSeconds?: number;
    canonicalAccountLinkVersion?: 1;
  }>,
): void {
  if (!hasOnlyAllowedAccountLinkKeys(record, ACCOUNT_LINK_RECORD_ALLOWED_KEYS)) {
    throw new Error("MCP account link record contains unsupported fields");
  }
  assertSafeAccountLinkIdentifier("provider subject", record.providerSubject);
  assertSafeAccountLinkIdentifier("Twoweeks owner", record.twoweeksClerkId);
  assertSafeAccountLinkIdentifier("client id", record.clientId);
  assertDistinctAccountLinkOwner(record);
  assertRequiredAccountLinkScopes(record.grantedReadScopes);
  assertRequiredAccountLinkRefs(record);
  assertSafeAuditReasonCode(record.auditReasonCode);
  assertAccountLinkTimestamps(record);
  assertCanonicalAccountLinkFields(record);
}

function assertDistinctAccountLinkOwner(
  record: Readonly<{
    providerSubject: string;
    twoweeksClerkId: string;
  }>,
): void {
  if (record.providerSubject === record.twoweeksClerkId) {
    throw new Error("MCP account link provider subject must differ from Twoweeks owner");
  }
}

function assertRequiredAccountLinkScopes(grantedReadScopes: readonly string[]): void {
  if (!grantedReadScopes.includes("twoweeks.mcp.read")) {
    throw new Error("MCP account link requires base read scope");
  }
}

function assertRequiredAccountLinkRefs(
  record: Readonly<{
    grantRef: string;
    consentRef: string;
    auditReasonCode: string;
  }>,
): void {
  if (!record.grantRef || !record.consentRef || !record.auditReasonCode) {
    throw new Error("MCP account link requires grant, consent, and audit refs");
  }
  assertSafeAccountLinkIdentifier("grant ref", record.grantRef);
  assertSafeAccountLinkIdentifier("consent ref", record.consentRef);
}

function assertAccountLinkTimestamps(
  record: Readonly<{
    state: "active" | "revoked" | "stale";
    createdAt: number;
    updatedAt: number;
    lastVerifiedAt: number;
    revokedAt?: number;
    staleAt?: number;
  }>,
): void {
  if (!hasValidAccountLinkTimestamps(record)) {
    throw new Error("MCP account link timestamps are invalid");
  }
}

function hasValidAccountLinkTimestamps(
  record: Readonly<{
    state: "active" | "revoked" | "stale";
    createdAt: number;
    updatedAt: number;
    lastVerifiedAt: number;
    revokedAt?: number;
    staleAt?: number;
  }>,
): boolean {
  return (
    hasValidAccountLinkBaseTimestamps(record) &&
    hasValidAccountLinkTerminalTimestamp(record.revokedAt, record.createdAt) &&
    hasValidAccountLinkTerminalTimestamp(record.staleAt, record.createdAt) &&
    hasRequiredAccountLinkTerminalTimestamp(record)
  );
}

function hasValidAccountLinkBaseTimestamps(
  record: Readonly<{ createdAt: number; updatedAt: number; lastVerifiedAt: number }>,
): boolean {
  return (
    isFiniteAccountLinkTimestamp(record.createdAt) &&
    isFiniteAccountLinkTimestamp(record.updatedAt) &&
    isFiniteAccountLinkTimestamp(record.lastVerifiedAt) &&
    record.updatedAt >= record.createdAt &&
    record.lastVerifiedAt >= record.createdAt
  );
}

function hasValidAccountLinkTerminalTimestamp(value: number | undefined, createdAt: number): boolean {
  return value === undefined || (isFiniteAccountLinkTimestamp(value) && value >= createdAt);
}

function hasRequiredAccountLinkTerminalTimestamp(
  record: Readonly<{ state: "active" | "revoked" | "stale"; revokedAt?: number; staleAt?: number }>,
): boolean {
  if (record.state === "active") return record.revokedAt === undefined && record.staleAt === undefined;
  if (record.state === "revoked") return record.revokedAt !== undefined;
  if (record.state === "stale") return record.staleAt !== undefined;
  return true;
}

function assertSafeAccountLinkIdentifier(label: string, value: string): void {
  if (!isSafeAccountLinkIdentifier(value)) {
    throw new Error(`MCP account link ${label} is invalid`);
  }
}

function isSafeAccountLinkIdentifier(value: string): boolean {
  return MCP_ACCOUNT_LINK_ID_PATTERN.test(value) && !FORBIDDEN_MCP_ACCOUNT_LINK_STORED_TEXT_PATTERN.test(value);
}

export function classifyMcpAccountLinkCanonicalStorageRecord(
  value: unknown,
): McpAccountLinkCanonicalStorageClassificationV1 {
  const parsed = parseStorageAccountLinkRecord(value);
  if (!parsed) return "malformed";
  return hasAnyCanonicalAccountLinkField(parsed)
    ? hasCompleteCanonicalAccountLinkFields(parsed) && hasValidCanonicalAccountLinkFields(parsed)
      ? "canonical_ready"
      : "malformed"
    : "legacy_missing_canonical_fields";
}

export function projectMcpAccountLinkCanonicalStorageRecordToPolicyCandidate(
  value: unknown,
): McpAccountLinkCanonicalProjectionV1 {
  const parsed = parseStorageAccountLinkRecord(value);
  const classification = classifyMcpAccountLinkCanonicalStorageRecord(value);
  if (!parsed) {
    return {
      classification: "malformed",
      policyCandidate: null,
      version: 1,
    };
  }
  if (classification === "legacy_missing_canonical_fields" || classification === "malformed") {
    return {
      classification,
      policyCandidate: null,
      version: 1,
    };
  }
  if (!isCanonicalReadyParsedAccountLinkRecord(parsed)) {
    return {
      classification: "malformed",
      policyCandidate: null,
      version: 1,
    };
  }

  return {
    classification,
    policyCandidate: {
      kind: "mcp_auth_policy_account_link_record",
      issuer: parsed.issuer,
      subject: parsed.providerSubject,
      providerEnvironment: parsed.providerEnvironment,
      clientId: parsed.clientId,
      twoweeksClerkId: parsed.twoweeksClerkId,
      grantedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      state: parsed.state,
      createdAtEpochSeconds: toEpochSeconds(parsed.createdAt),
      updatedAtEpochSeconds: toEpochSeconds(parsed.updatedAt),
      expiresAtEpochSeconds: parsed.expiresAtEpochSeconds,
      version: 1,
    },
    version: 1,
  };
}

function malformedLookupCandidate(
  reason: McpAccountLinkLookupMalformedCandidateV1["reason"],
): McpAccountLinkLookupMalformedCandidateV1 {
  return {
    kind: "mcp_auth_policy_account_link_lookup_malformed_candidate",
    reason,
    version: 1,
  };
}

function compareLookupCandidates(
  left: McpAccountLinkLookupCandidateV1,
  right: McpAccountLinkLookupCandidateV1,
): number {
  return compareLookupCandidateSortKeys(
    getLookupCandidateSortKeys(left),
    getLookupCandidateSortKeys(right),
  );
}

function getLookupCandidateSortKeys(
  candidate: McpAccountLinkLookupCandidateV1,
): readonly LookupCandidateSortKey[] {
  if (candidate.kind === "mcp_auth_policy_account_link_lookup_malformed_candidate") {
    return [candidate.kind, candidate.reason];
  }
  return [
    candidate.kind,
    candidate.issuer,
    candidate.subject,
    candidate.providerEnvironment,
    candidate.clientId,
    candidate.twoweeksClerkId,
    candidate.state,
    candidate.createdAtEpochSeconds,
    candidate.updatedAtEpochSeconds,
    candidate.expiresAtEpochSeconds,
  ];
}

function compareLookupCandidateSortKeys(
  left: readonly LookupCandidateSortKey[],
  right: readonly LookupCandidateSortKey[],
): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const comparison = compareLookupCandidateSortKey(left[index], right[index]);
    if (comparison !== 0) return comparison;
  }
  return compareNumber(left.length, right.length);
}

function compareLookupCandidateSortKey(
  left: LookupCandidateSortKey,
  right: LookupCandidateSortKey,
): number {
  return typeof left === "number" && typeof right === "number"
    ? compareNumber(left, right)
    : compareText(String(left), String(right));
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareNumber(left: number, right: number): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

type ParsedStorageAccountLinkRecord = Readonly<{
  provider: "stytch";
  providerSubject: string;
  twoweeksClerkId: string;
  clientId: string;
  grantedReadScopes: readonly string[];
  state: "active" | "revoked" | "stale";
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt: number;
  revokedAt?: number;
  staleAt?: number;
  issuer?: string;
  providerEnvironment?: string;
  canonicalGrantedScopes?: readonly string[];
  expiresAtEpochSeconds?: number;
  canonicalAccountLinkVersion?: 1;
}>;

type LifecycleStorageRow = ParsedStorageAccountLinkRecord &
  Readonly<{
    _id: string;
    kind: "local_mcp_account_link_record";
    version: 1;
    grantRef: string;
    consentRef: string;
    auditReasonCode: string;
  }>;

type CanonicalReadyParsedStorageAccountLinkRecord = ParsedStorageAccountLinkRecord &
  Readonly<{
    issuer: string;
    providerEnvironment: string;
    canonicalGrantedScopes: readonly [typeof TWOWEEKS_APPLICATIONS_READ_SCOPE, ...string[]];
    expiresAtEpochSeconds: number;
    canonicalAccountLinkVersion: 1;
  }>;

type ParsedStorageAccountLinkTiming = Pick<
  ParsedStorageAccountLinkRecord,
  "state" | "createdAt" | "updatedAt" | "lastVerifiedAt" | "revokedAt" | "staleAt"
>;

type ParsedLifecycleEvidence = Readonly<{
  issuer: string;
  subject: string;
  providerEnvironment: string;
  clientId: string;
  resource: string;
  expiresAtEpochSeconds: number;
  verifiedAtEpochSeconds: number;
}>;

type LifecycleCandidateRead =
  | {
      ok: true;
      rows: readonly {
        row: LifecycleStorageRow;
        policyCandidate: McpAccountLinkCanonicalPolicyCandidateV1;
      }[];
    }
  | {
      ok: false;
      reason: "candidate_overflow" | "malformed_candidate";
    };
type ExactClientLifecycleStorageRow = Readonly<{
  row: LifecycleStorageRow;
  classification: Exclude<McpAccountLinkCanonicalStorageClassificationV1, "malformed">;
}>;
type ExactClientAccountLinkRowsRead =
  | {
      ok: true;
      rows: readonly ExactClientLifecycleStorageRow[];
    }
  | {
      ok: false;
      reason: "candidate_overflow" | "malformed_candidate";
    };
type LifecycleIndexBuilder = {
  eq(fieldName: string, value: unknown): LifecycleIndexBuilder;
};
type LifecycleIndexedQuery = {
  take(limit: number): Promise<unknown[]>;
};
type LifecycleTableQuery = {
  withIndex(indexName: string, buildQuery: (query: LifecycleIndexBuilder) => unknown): LifecycleIndexedQuery;
};
type LifecycleQueryCtx = {
  db: {
    query(tableName: "mcpAccountLinks"): LifecycleTableQuery;
  };
};

function parseStorageAccountLinkRecord(value: unknown): ParsedStorageAccountLinkRecord | undefined {
  const record = readStorageAccountLinkRecord(value);
  if (!record) return undefined;

  const identity = parseStorageAccountLinkIdentity(record);
  if (!identity) return undefined;

  const timing = parseStorageAccountLinkTiming(record);
  if (!timing) return undefined;

  const canonicalFields = parseCanonicalAccountLinkFields(record);
  if (canonicalFields === false) return undefined;

  return {
    provider: "stytch" as const,
    ...identity,
    ...timing,
    ...canonicalFields,
  };
}

function readStorageAccountLinkRecord(value: unknown): Record<string, unknown> | undefined {
  if (!isPlainRecord(value)) return undefined;
  if (!hasOnlyAllowedAccountLinkKeys(value, ACCOUNT_LINK_STORAGE_DOCUMENT_ALLOWED_KEYS)) return undefined;
  if (value.kind !== "local_mcp_account_link_record" || value.version !== 1 || value.provider !== "stytch") {
    return undefined;
  }
  return value;
}

function parseStorageAccountLinkIdentity(
  record: Record<string, unknown>,
):
  | Pick<
      ParsedStorageAccountLinkRecord,
      "providerSubject" | "twoweeksClerkId" | "clientId" | "grantedReadScopes"
    >
  | undefined {
  if (!isSafeAccountLinkIdentifierValue(record.providerSubject)) return undefined;
  if (!isSafeAccountLinkIdentifierValue(record.twoweeksClerkId)) return undefined;
  if (!isSafeAccountLinkIdentifierValue(record.clientId)) return undefined;
  if (!Array.isArray(record.grantedReadScopes) || !record.grantedReadScopes.every(isLegacyMcpReadScope)) {
    return undefined;
  }
  return {
    providerSubject: record.providerSubject,
    twoweeksClerkId: record.twoweeksClerkId,
    clientId: record.clientId,
    grantedReadScopes: [...record.grantedReadScopes],
  };
}

function parseStorageAccountLinkTiming(
  record: Record<string, unknown>,
): ParsedStorageAccountLinkTiming | undefined {
  if (!isAccountLinkState(record.state)) return undefined;

  const baseTiming = parseStorageAccountLinkBaseTiming(record);
  if (!baseTiming) return undefined;

  const terminalTiming = parseStorageAccountLinkTerminalTiming(record);
  if (!terminalTiming) return undefined;

  const timing = {
    state: record.state,
    ...baseTiming,
    ...terminalTiming,
  };
  return hasValidAccountLinkTimestamps(timing) ? timing : undefined;
}

function parseStorageAccountLinkBaseTiming(
  record: Record<string, unknown>,
): Pick<ParsedStorageAccountLinkRecord, "createdAt" | "updatedAt" | "lastVerifiedAt"> | undefined {
  const { createdAt, updatedAt, lastVerifiedAt } = record;
  if (typeof createdAt !== "number" || typeof updatedAt !== "number" || typeof lastVerifiedAt !== "number") {
    return undefined;
  }
  return { createdAt, updatedAt, lastVerifiedAt };
}

function parseStorageAccountLinkTerminalTiming(
  record: Record<string, unknown>,
): Pick<ParsedStorageAccountLinkRecord, "revokedAt" | "staleAt"> | undefined {
  if (!isOptionalAccountLinkTimestamp(record.revokedAt) || !isOptionalAccountLinkTimestamp(record.staleAt)) {
    return undefined;
  }
  return {
    ...(record.revokedAt !== undefined ? { revokedAt: record.revokedAt } : {}),
    ...(record.staleAt !== undefined ? { staleAt: record.staleAt } : {}),
  };
}

function parseCanonicalAccountLinkFields(
  record: Record<string, unknown>,
):
  | Pick<
      ParsedStorageAccountLinkRecord,
      | "issuer"
      | "providerEnvironment"
      | "canonicalGrantedScopes"
      | "expiresAtEpochSeconds"
      | "canonicalAccountLinkVersion"
    >
  | Record<string, never>
  | false {
  if (!hasAnyCanonicalAccountLinkField(record)) return {};
  if (!hasCompleteCanonicalAccountLinkFields(record)) return false;
  if (!hasValidCanonicalAccountLinkFields(record)) return false;
  return {
    issuer: record.issuer,
    providerEnvironment: record.providerEnvironment,
    canonicalGrantedScopes: [...record.canonicalGrantedScopes],
    expiresAtEpochSeconds: record.expiresAtEpochSeconds,
    canonicalAccountLinkVersion: 1,
  };
}

function assertCanonicalAccountLinkFields(
  record: Readonly<{
    issuer?: string;
    providerEnvironment?: string;
    canonicalGrantedScopes?: readonly string[];
    expiresAtEpochSeconds?: number;
    canonicalAccountLinkVersion?: 1;
  }>,
): void {
  if (!hasAnyCanonicalAccountLinkField(record)) return;
  if (!hasCompleteCanonicalAccountLinkFields(record) || !hasValidCanonicalAccountLinkFields(record)) {
    throw new Error("MCP account link canonical fields are invalid");
  }
}

function hasAnyCanonicalAccountLinkField(value: CanonicalAccountLinkFieldBag): boolean {
  return (
    value.issuer !== undefined ||
    value.providerEnvironment !== undefined ||
    value.canonicalGrantedScopes !== undefined ||
    value.expiresAtEpochSeconds !== undefined ||
    value.canonicalAccountLinkVersion !== undefined
  );
}

function hasCompleteCanonicalAccountLinkFields(
  value: CanonicalAccountLinkFieldBag,
): value is {
  issuer: string;
  providerEnvironment: string;
  canonicalGrantedScopes: readonly string[];
  expiresAtEpochSeconds: number;
  canonicalAccountLinkVersion: 1;
} {
  return CANONICAL_ACCOUNT_LINK_FIELD_KEYS.every((key) => value[key] !== undefined);
}

function hasValidCanonicalAccountLinkFields(
  value: CanonicalAccountLinkFieldBag,
): value is {
  issuer: string;
  providerEnvironment: string;
  canonicalGrantedScopes: readonly [typeof TWOWEEKS_APPLICATIONS_READ_SCOPE, ...string[]];
  expiresAtEpochSeconds: number;
  canonicalAccountLinkVersion: 1;
} {
  return (
    isSafeHttpsIssuer(value.issuer) &&
    isSafeAccountLinkIdentifierValue(value.providerEnvironment) &&
    Array.isArray(value.canonicalGrantedScopes) &&
    value.canonicalGrantedScopes.length > 0 &&
    value.canonicalGrantedScopes.every((scope) => scope === TWOWEEKS_APPLICATIONS_READ_SCOPE) &&
    isSafeEpochSeconds(value.expiresAtEpochSeconds) &&
    value.canonicalAccountLinkVersion === 1
  );
}

function isCanonicalReadyParsedAccountLinkRecord(
  value: ParsedStorageAccountLinkRecord,
): value is CanonicalReadyParsedStorageAccountLinkRecord {
  return hasCompleteCanonicalAccountLinkFields(value) && hasValidCanonicalAccountLinkFields(value);
}

function isSafeHttpsIssuer(value: unknown): value is string {
  if (typeof value !== "string" || !/\S/u.test(value)) return false;
  if (FORBIDDEN_MCP_ACCOUNT_LINK_STORED_TEXT_PATTERN.test(value)) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.hash;
}

function isSafeAccountLinkIdentifierValue(value: unknown): value is string {
  return typeof value === "string" && isSafeAccountLinkIdentifier(value);
}

function isLegacyMcpReadScope(value: unknown): value is string {
  switch (value) {
    case "twoweeks.mcp.read":
    case "twoweeks.application_package.read":
    case "twoweeks.evidence_graph.read":
    case "twoweeks.resume_variant_plan.read":
    case "twoweeks.review_cockpit.read":
      return true;
    default:
      return false;
  }
}

function isAccountLinkState(value: unknown): value is "active" | "revoked" | "stale" {
  return value === "active" || value === "revoked" || value === "stale";
}

function isSafeEpochSeconds(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_SAFE_EPOCH_SECONDS_FOR_MILLISECONDS
  );
}

function toEpochSeconds(epochMilliseconds: number): number {
  return Math.floor(epochMilliseconds / 1_000);
}

function toEpochMilliseconds(epochSeconds: number): number {
  if (!isSafeEpochSeconds(epochSeconds)) {
    throw new Error("MCP account link epoch seconds are invalid");
  }
  return epochSeconds * 1_000;
}

function isOptionalAccountLinkTimestamp(value: unknown): value is number | undefined {
  return value === undefined || typeof value === "number";
}

function hasOnlyAllowedAccountLinkKeys(
  value: object,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertSafeAuditReasonCode(value: string): void {
  if (!MCP_ACCOUNT_LINK_AUDIT_REASON_CODE_PATTERN.test(value)) {
    throw new Error("MCP account link audit reason code is invalid");
  }
}

function assertFiniteAccountLinkTimestamp(value: number): void {
  if (!isFiniteAccountLinkTimestamp(value)) {
    throw new Error("MCP account link timestamp is invalid");
  }
}

function isFiniteAccountLinkTimestamp(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isExpiredAccountLink(
  row: Readonly<{ lastVerifiedAt: number }>,
  options: Readonly<{ now?: number; maxLinkAgeMs?: number }>,
): boolean {
  if (!isFiniteAccountLinkTimestamp(row.lastVerifiedAt)) return true;
  if (options.now !== undefined && !isFiniteAccountLinkTimestamp(options.now)) return true;
  if (options.maxLinkAgeMs !== undefined && (!Number.isFinite(options.maxLinkAgeMs) || options.maxLinkAgeMs <= 0)) {
    return true;
  }
  if (options.maxLinkAgeMs === undefined) return false;
  if (options.now === undefined) return true;
  return options.now - row.lastVerifiedAt > options.maxLinkAgeMs;
}

function hasRequiredScopes(
  grantedReadScopes: readonly string[],
  requiredReadScopes: readonly string[],
): boolean {
  const granted = new Set(grantedReadScopes);
  return requiredReadScopes.every((scope) => granted.has(scope));
}
