import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import {
  applicationHarnessArtifactValidator,
  applicationHarnessContextValidator,
  applicationHarnessRunValidator,
  applicationHarnessStoredArtifactValidator,
  applicationHarnessStoredContextValidator,
  applicationHarnessStoredRunValidator,
} from "./lib/applicationHarness";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

function resolveListLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.max(1, Math.min(Math.floor(limit), MAX_LIST_LIMIT));
}

function assertContextCandidateAnchor(candidate: {
  sourceKind: "cv" | "candidate_evidence_profile";
  cvId?: string;
  candidateEvidenceProfileId?: string;
}): void {
  if (candidate.sourceKind === "cv") {
    if (!candidate.cvId) {
      throw new Error('ApplicationContext candidate requires cvId for sourceKind "cv"');
    }
    return;
  }

  if (!candidate.candidateEvidenceProfileId) {
    throw new Error(
      'ApplicationContext candidate requires candidateEvidenceProfileId for sourceKind "candidate_evidence_profile"',
    );
  }
}

function assertRunStatusForPatch(
  run: { status: string },
  allowedStatuses: readonly string[],
  action: string,
): void {
  if (!allowedStatuses.includes(run.status)) {
    throw new Error(
      `Cannot ${action} ApplicationRun from status "${run.status}"; expected ${allowedStatuses
        .map((status) => `"${status}"`)
        .join(" or ")}`,
    );
  }
}

export const createContext = internalMutation({
  args: {
    context: applicationHarnessContextValidator,
  },
  returns: v.id("applicationContexts"),
  handler: async (ctx, args) => {
    assertContextCandidateAnchor(args.context.candidate);

    const existingById = await ctx.db
      .query("applicationContexts")
      .withIndex("by_user_id", (q) =>
        q.eq("userId", args.context.userId).eq("id", args.context.id),
      )
      .unique();

    if (existingById) {
      if (existingById.contextHash !== args.context.contextHash) {
        throw new Error("ApplicationContext stable id collision");
      }

      return existingById._id;
    }

    const existingByHash = await ctx.db
      .query("applicationContexts")
      .withIndex("by_user_context_hash", (q) =>
        q
          .eq("userId", args.context.userId)
          .eq("contextHash", args.context.contextHash),
      )
      .unique();

    if (existingByHash) {
      if (existingByHash.id !== args.context.id) {
        throw new Error("ApplicationContext contextHash collision with different stable id");
      }

      return existingByHash._id;
    }

    return await ctx.db.insert("applicationContexts", args.context);
  },
});

export const getContextById = internalQuery({
  args: {
    userId: v.string(),
    id: v.string(),
  },
  returns: v.union(v.null(), applicationHarnessStoredContextValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationContexts")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();
  },
});

export const getContextByHash = internalQuery({
  args: {
    userId: v.string(),
    contextHash: v.string(),
  },
  returns: v.union(v.null(), applicationHarnessStoredContextValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationContexts")
      .withIndex("by_user_context_hash", (q) =>
        q.eq("userId", args.userId).eq("contextHash", args.contextHash),
      )
      .unique();
  },
});

export const listContextsForUser = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(applicationHarnessStoredContextValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationContexts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(resolveListLimit(args.limit));
  },
});

export const createRun = internalMutation({
  args: {
    run: applicationHarnessRunValidator,
  },
  returns: v.id("applicationRuns"),
  handler: async (ctx, args) => {
    const existingById = await ctx.db
      .query("applicationRuns")
      .withIndex("by_user_id", (q) =>
        q.eq("userId", args.run.userId).eq("id", args.run.id),
      )
      .unique();

    if (existingById) {
      if (existingById.idempotencyKey !== args.run.idempotencyKey) {
        throw new Error("ApplicationRun stable id collision");
      }

      return existingById._id;
    }

    const existingByIdempotencyKey = await ctx.db
      .query("applicationRuns")
      .withIndex("by_user_idempotency_key", (q) =>
        q
          .eq("userId", args.run.userId)
          .eq("idempotencyKey", args.run.idempotencyKey),
      )
      .unique();

    if (existingByIdempotencyKey) {
      return existingByIdempotencyKey._id;
    }

    return await ctx.db.insert("applicationRuns", args.run);
  },
});

export const getRunById = internalQuery({
  args: {
    userId: v.string(),
    id: v.string(),
  },
  returns: v.union(v.null(), applicationHarnessStoredRunValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationRuns")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();
  },
});

export const getRunByIdempotencyKey = internalQuery({
  args: {
    userId: v.string(),
    idempotencyKey: v.string(),
  },
  returns: v.union(v.null(), applicationHarnessStoredRunValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationRuns")
      .withIndex("by_user_idempotency_key", (q) =>
        q.eq("userId", args.userId).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
  },
});

export const listRunsForUser = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(applicationHarnessStoredRunValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationRuns")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(resolveListLimit(args.limit));
  },
});

export const completeRun = internalMutation({
  args: {
    userId: v.string(),
    id: v.string(),
    resultIds: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  },
  returns: v.id("applicationRuns"),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("applicationRuns")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();

    if (!run) {
      throw new Error("ApplicationRun not found");
    }

    assertRunStatusForPatch(run, ["running"], "complete");

    await ctx.db.patch(run._id, {
      status: "succeeded",
      ...(args.resultIds ? { resultIds: args.resultIds } : {}),
      blockedReason: undefined,
      error: undefined,
      updatedAt: args.updatedAt,
    });

    return run._id;
  },
});

export const failRun = internalMutation({
  args: {
    userId: v.string(),
    id: v.string(),
    error: v.string(),
    updatedAt: v.number(),
  },
  returns: v.id("applicationRuns"),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("applicationRuns")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();

    if (!run) {
      throw new Error("ApplicationRun not found");
    }

    assertRunStatusForPatch(run, ["running", "blocked"], "fail");

    await ctx.db.patch(run._id, {
      status: "failed",
      blockedReason: undefined,
      error: args.error,
      updatedAt: args.updatedAt,
    });

    return run._id;
  },
});

export const blockRun = internalMutation({
  args: {
    userId: v.string(),
    id: v.string(),
    blockedReason: v.string(),
    updatedAt: v.number(),
  },
  returns: v.id("applicationRuns"),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("applicationRuns")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();

    if (!run) {
      throw new Error("ApplicationRun not found");
    }

    assertRunStatusForPatch(run, ["queued", "running"], "block");

    await ctx.db.patch(run._id, {
      status: "blocked",
      blockedReason: args.blockedReason,
      error: undefined,
      updatedAt: args.updatedAt,
    });

    return run._id;
  },
});

export const createArtifact = internalMutation({
  args: {
    artifact: applicationHarnessArtifactValidator,
  },
  returns: v.id("applicationArtifacts"),
  handler: async (ctx, args) => {
    const existingById = await ctx.db
      .query("applicationArtifacts")
      .withIndex("by_user_id", (q) =>
        q.eq("userId", args.artifact.userId).eq("id", args.artifact.id),
      )
      .unique();

    if (existingById) {
      if (existingById.contextId !== args.artifact.contextId) {
        throw new Error("ApplicationArtifact stable id collision");
      }

      return existingById._id;
    }

    return await ctx.db.insert("applicationArtifacts", args.artifact);
  },
});

export const getArtifactById = internalQuery({
  args: {
    userId: v.string(),
    id: v.string(),
  },
  returns: v.union(v.null(), applicationHarnessStoredArtifactValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationArtifacts")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();
  },
});

export const listArtifactsForContext = internalQuery({
  args: {
    userId: v.string(),
    contextId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(applicationHarnessStoredArtifactValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationArtifacts")
      .withIndex("by_user_context", (q) =>
        q.eq("userId", args.userId).eq("contextId", args.contextId),
      )
      .order("desc")
      .take(resolveListLimit(args.limit));
  },
});

export const listArtifactsForUser = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(applicationHarnessStoredArtifactValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationArtifacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(resolveListLimit(args.limit));
  },
});
