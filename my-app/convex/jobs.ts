import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Internal helpers for LLM jobs.
 *
 * - `start` creates a new job from a typed Convex Id and returns the inserted job _id.
 * - `enqueue` re-queues an existing job (validates ownership) and schedules processing.
 *
 * These are internal mutations and should be invoked only via `ctx.runMutation` from
 * public wrappers or internal actions, per Convex best-practices.
 */
export const start = internalMutation({
  args: {
    profileId: v.id("userProfiles"),
    rawText: v.string(),
    options: v.optional(v.any()),
    reason: v.optional(v.string()),
  },
  returns: v.id("llmJobs"),
  handler: async (ctx, { profileId, rawText, options }) => {
    const now = Date.now();
    const jobId = await ctx.db.insert("llmJobs", {
      profileId,
      status: "queued",
      rawText,
      options,
      createdAt: now,
      updatedAt: now,
    });
    // Schedule the refine internal action (worker) to run immediately.
    await ctx.scheduler.runAfter(0, internal.llm.refine, { jobId });
    return jobId;
  },
});

export const enqueue = internalMutation({
  args: {
    profileId: v.id("userProfiles"),
    jobId: v.id("llmJobs"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { profileId, jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    if (job.profileId !== profileId) {
      throw new Error("Job does not belong to this profile");
    }
    const now = Date.now();
    await ctx.db.patch(jobId, { status: "queued", updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.llm.refine, { jobId });
    return null;
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
    // Project allowed fields to satisfy the validator (exclude system fields like _creationTime).
    return jobs.map((job: any) => ({
      _id: job._id,
      profileId: job.profileId,
      placeholderId: job.placeholderId ?? undefined,
      status: job.status,
      rawText: job.rawText ?? undefined,
      options: job.options ?? undefined,
      requestedBy: job.requestedBy ?? undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }));
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
    if (!claimed) return null;
    // Project claimed job to exactly the fields declared in the return validator.
    return {
      _id: claimed._id,
      profileId: claimed.profileId,
      placeholderId: claimed.placeholderId ?? undefined,
      status: claimed.status,
      rawText: claimed.rawText ?? undefined,
      options: claimed.options ?? undefined,
      requestedBy: claimed.requestedBy ?? undefined,
      createdAt: claimed.createdAt,
      updatedAt: claimed.updatedAt,
      attempts: claimed.attempts ?? undefined,
      lockedBy: claimed.lockedBy ?? undefined,
      startedAt: claimed.startedAt ?? undefined,
    };
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
    // Project job document to only the fields specified by the validator.
    return {
      _id: job._id,
      profileId: job.profileId,
      placeholderId: job.placeholderId ?? undefined,
      status: job.status,
      rawText: job.rawText ?? undefined,
      options: job.options ?? undefined,
      requestedBy: job.requestedBy ?? undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      attempts: job.attempts ?? undefined,
      lockedBy: job.lockedBy ?? undefined,
      startedAt: job.startedAt ?? undefined,
      historyId: job.historyId ?? undefined,
      lastError: job.lastError ?? undefined,
    };
  },
});

export const getHistoryById = internalQuery({
  args: { historyId: v.id("llmHistory") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.historyId);
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
