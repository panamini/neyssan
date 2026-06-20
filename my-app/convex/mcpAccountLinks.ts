import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const mcpReadScopeValidator = v.union(
  v.literal("twoweeks.mcp.read"),
  v.literal("twoweeks.application_package.read"),
  v.literal("twoweeks.evidence_graph.read"),
  v.literal("twoweeks.resume_variant_plan.read"),
  v.literal("twoweeks.review_cockpit.read"),
);

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

const MCP_ACCOUNT_LINK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,191}$/u;
const MCP_ACCOUNT_LINK_AUDIT_REASON_CODE_PATTERN = /^[a-z][a-z0-9_]{2,80}$/u;
const FORBIDDEN_MCP_ACCOUNT_LINK_STORED_TEXT_PATTERN =
  /@|bearer\s+\S+|authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|credential|cookie|session|raw[_-]?(cv|resume|job|proposal|claims)|private[_-]?fact|never[_-]?use|source[_-]?(text|quote)|structured[_-]?shadow|convex[_-]?(id|document)|debug[_-]?payload/iu;

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
  }>,
): void {
  assertSafeAccountLinkIdentifier("provider subject", record.providerSubject);
  assertSafeAccountLinkIdentifier("Twoweeks owner", record.twoweeksClerkId);
  assertSafeAccountLinkIdentifier("client id", record.clientId);
  assertDistinctAccountLinkOwner(record);
  assertRequiredAccountLinkScopes(record.grantedReadScopes);
  assertRequiredAccountLinkRefs(record);
  assertSafeAuditReasonCode(record.auditReasonCode);
  assertAccountLinkTimestamps(record);
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
