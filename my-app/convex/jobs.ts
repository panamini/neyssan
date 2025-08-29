import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Enqueue a refine job: insert a job into llmJobs and return a placeholder id.
 */
export const enqueueRefine = internalMutation({
  args: {
    profileId: v.id("userProfiles"),
    rawText: v.union(v.string(), v.null()),
    options: v.optional(v.any()),
    requestedBy: v.optional(v.string()),
  },
  returns: v.object({
    placeholderId: v.string(),
    jobId: v.id("llmJobs"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const placeholderId = `ph_${now}_${Math.floor(Math.random() * 100000)}`;

    const jobId = await ctx.db.insert("llmJobs", {
      profileId: args.profileId,
      placeholderId,
      status: "queued",
      ...(args.rawText !== null && args.rawText !== undefined ? { rawText: args.rawText } : {}),
      ...(args.options !== undefined ? { options: args.options } : {}),
      ...(args.requestedBy !== undefined ? { requestedBy: args.requestedBy } : {}),
      createdAt: now,
      updatedAt: now,
    });

    return { placeholderId, jobId };
  },
});

/**
 * List pending jobs (queued) up to batchSize.
 * Returns an array of job documents (limited fields).
 */
export const listPendingJobs = internalQuery({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("llmJobs"),
      profileId: v.id("userProfiles"),
      placeholderId: v.optional(v.string()),
      status: v.string(),
      rawText: v.optional(v.string()),
      options: v.optional(v.any()),
      requestedBy: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const size = args.batchSize ?? 5;
    // Query by status index "by_status" for "queued" jobs
    const jobs = await ctx.db
      .query("llmJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(size);
    return jobs;
  },
});

/**
 * Claim a job atomically: if job is queued, mark it processing and return the claimed doc.
 * Returns null if it couldn't be claimed (already processed / claimed).
 */
export const claimJob = internalMutation({
  args: {
    jobId: v.id("llmJobs"),
    workerId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("llmJobs"),
      profileId: v.id("userProfiles"),
      placeholderId: v.optional(v.string()),
      status: v.string(),
      rawText: v.optional(v.string()),
      options: v.optional(v.any()),
      requestedBy: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      // optional fields that may be added
      attempts: v.optional(v.number()),
      lockedBy: v.optional(v.string()),
      startedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    // Only claim if still queued
    if ((job as any).status !== "queued") return null;

    const now = Date.now();
    const attempts = (job as any).attempts ? (job as any).attempts + 1 : 1;

    await ctx.db.patch(args.jobId, {
      status: "processing",
      lockedBy: args.workerId,
      startedAt: now,
      attempts,
      updatedAt: now,
    });

    const claimed = await ctx.db.get(args.jobId);
    return claimed ?? null;
  },
});

export const getJob = internalQuery({
  args: {
    jobId: v.id("llmJobs"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("llmJobs"),
      profileId: v.id("userProfiles"),
      placeholderId: v.optional(v.string()),
      status: v.string(),
      rawText: v.optional(v.string()),
      options: v.optional(v.any()),
      requestedBy: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      attempts: v.optional(v.number()),
      lockedBy: v.optional(v.string()),
      startedAt: v.optional(v.number()),
      historyId: v.optional(v.id("llmHistory")),
      lastError: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    return job as any;
  },
});

/**
 * Append a history record (llmHistory). Returns the new history _id.
 */
export const appendHistory = internalMutation({
  args: {
    profileId: v.id("userProfiles"),
    jobId: v.optional(v.union(v.id("llmJobs"), v.null())),
    placeholderId: v.optional(v.union(v.string(), v.null())),
    provider: v.optional(v.union(v.string(), v.null())),
    model: v.optional(v.union(v.string(), v.null())),
    full_response: v.optional(v.any()),
    patch: v.optional(v.any()),
    confidence: v.optional(v.union(v.number(), v.null())),
    merged: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
  },
  returns: v.id("llmHistory"),
  handler: async (ctx, args) => {
    const now = args.createdAt ?? Date.now();
    const doc: any = {
      profileId: args.profileId,
      ...(args.jobId !== undefined ? { jobId: args.jobId } : {}),
      ...(args.placeholderId !== undefined ? { placeholderId: args.placeholderId } : {}),
      ...(args.provider !== undefined ? { provider: args.provider } : {}),
      ...(args.model !== undefined ? { model: args.model } : {}),
      ...(args.full_response !== undefined ? { full_response: args.full_response } : {}),
      ...(args.patch !== undefined ? { patch: args.patch } : {}),
      ...(args.confidence !== undefined ? { confidence: args.confidence } : {}),
      ...(args.merged !== undefined ? { merged: args.merged } : {}),
      createdAt: now,
    };
    const id = await ctx.db.insert("llmHistory", doc);
    return id;
  },
});

/**
 * Mark job completed and link to historyId
 */
export const markJobCompleted = internalMutation({
  args: {
    jobId: v.id("llmJobs"),
    historyId: v.id("llmHistory"),
    status: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status ?? "finished",
      updatedAt: args.updatedAt ?? Date.now(),
      historyId: args.historyId,
    });
    return null;
  },
});

/**
 * Mark job failed and store last error.
 */
export const markJobFailed = internalMutation({
  args: {
    jobId: v.id("llmJobs"),
    error: v.string(),
    updatedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      lastError: args.error,
      updatedAt: args.updatedAt ?? Date.now(),
    });
    return null;
  },
});
