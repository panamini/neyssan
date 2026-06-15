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
  },
  returns: v.union(v.null(), resolvedServerOnlyAccountLinkValidator),
  handler: async (ctx, args) => {
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
    if (!hasRequiredScopes(row.grantedReadScopes, args.requiredReadScopes)) return null;

    return {
      kind: "mcp_account_link_server_only_owner_resolution",
      provider: "stytch",
      twoweeksClerkId: row.twoweeksClerkId,
      grantedReadScopes: [...row.grantedReadScopes],
      grantRef: row.grantRef,
      consentRef: row.consentRef,
      auditReasonCode: row.auditReasonCode,
      version: 1,
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
    createdAt: number;
    updatedAt: number;
    lastVerifiedAt: number;
    auditReasonCode: string;
  }>,
): void {
  assertDistinctAccountLinkOwner(record);
  assertRequiredAccountLinkScopes(record.grantedReadScopes);
  assertRequiredAccountLinkRefs(record);
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
}

function assertAccountLinkTimestamps(
  record: Readonly<{
    createdAt: number;
    updatedAt: number;
    lastVerifiedAt: number;
  }>,
): void {
  if (record.updatedAt < record.createdAt || record.lastVerifiedAt < record.createdAt) {
    throw new Error("MCP account link timestamps are invalid");
  }
}

function hasRequiredScopes(
  grantedReadScopes: readonly string[],
  requiredReadScopes: readonly string[],
): boolean {
  const granted = new Set(grantedReadScopes);
  return requiredReadScopes.every((scope) => granted.has(scope));
}
