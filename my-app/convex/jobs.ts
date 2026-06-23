/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { listProfilesForClerk } from "./lib/userProfiles";

const PROPOSAL_GENERATION_JOB_KIND = "proposal_generation";

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

    // Lightweight non-crypto short hash for observability (snippet-based).
    function shortHash(s: string) {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 16777619);
      }
      return (h >>> 0).toString(16);
    }

    const rawStr = String(rawText ?? "");
    const rawSnippet = rawStr.slice(0, 200);
    const rawHash = shortHash(rawSnippet);
  
    // Log creation metadata to help diagnose duplicate submissions.
    console.log(
      `[start] creating job profile=${String(profileId)} rawHash=${rawHash} rawLen=${rawStr.length} options=${JSON.stringify(
        options
      )} ts=${now}`
    );
  
    // Server-side short-window dedupe:
    // - Look for a recent job with the same rawHash created within the last `DEDUP_WINDOW_MS`
    // - Only reuse jobs that are still queued or processing to avoid returning stale results.
    // This is a defensive fallback in case multiple clients or flows enqueue nearly-identical jobs.
    const DEDUP_WINDOW_MS = 10_000; // 10 seconds
    try {
      // Read a small recent window of jobs and perform in-memory filter (works without a dedicated index).
      // Limit to a modest number to avoid scanning too much data.
      const recentCandidates = await ctx.db.query("llmJobs").take(50);
      const existing = recentCandidates.find((j: any) => {
        try {
          const jRaw = String((j).rawText ?? "").slice(0, 200);
          const jHash = shortHash(jRaw);
          const age = now - ((j).createdAt ?? 0);
          const status = (j).status ?? "";
          // Dedupe only when the profileId and rawHash match within the short window.
          // Prevents accidentally reusing a job created for a different profile.
          return (
            String(j.profileId) === String(profileId) &&
            jHash === rawHash &&
            age >= 0 &&
            age <= DEDUP_WINDOW_MS &&
            (status === "queued" || status === "processing")
          );
        } catch {
          return false;
        }
      });
      if (existing) {
        console.log(`[start] dedupe hit - reusing recent job ${String(existing._id)} profile=${String(existing.profileId)} rawHash=${rawHash} ageMs=${now - (existing.createdAt ?? 0)}`);
        return existing._id;
      }
    } catch (e) {
      // If dedupe scanning fails for any reason, log and continue to create a new job.
      console.warn("[start] dedupe scan failed, proceeding to create job:", String(e));
    }
  
    // Persist a copy of the caller-provided options with an internal trace field
    // so we don't need to change the llmJobs schema. This embeds the short hash
    // inside options for future debugging while keeping the DB shape stable.
    const optionsWithTrace = options ? { ...options, __rawHash: rawHash } : undefined;
  
    const jobId = await ctx.db.insert("llmJobs", {
      profileId,
      status: "queued",
      rawText,
      options: optionsWithTrace,
      createdAt: now,
      updatedAt: now,
    });
  
    // Schedule the refine internal action (worker) to run immediately.
    await ctx.scheduler.runAfter(0, internal.llm.refine, { jobId });
  
    console.log(`[start] job created jobId=${String(jobId)} profile=${String(profileId)} rawHash=${rawHash}`);
  
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

export const startProposalGenerationRun = internalMutation({
  args: {
    profileId: v.id("userProfiles"),
    clientRunId: v.string(),
    requestedBy: v.string(),
  },
  returns: v.id("llmJobs"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("llmJobs", {
      profileId: args.profileId,
      placeholderId: args.clientRunId,
      status: "processing",
      rawText: "",
      options: {
        kind: PROPOSAL_GENERATION_JOB_KIND,
      },
      requestedBy: args.requestedBy,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getProposalGenerationRun = internalQuery({
  args: {
    jobId: v.id("llmJobs"),
  },
  returns: v.union(
    v.null(),
    v.object({
      status: v.string(),
      placeholderId: v.optional(v.string()),
      requestedBy: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.options?.kind !== PROPOSAL_GENERATION_JOB_KIND) {
      return null;
    }

    return {
      status: job.status,
      placeholderId: job.placeholderId ?? undefined,
      requestedBy: job.requestedBy ?? undefined,
    };
  },
});

export const finishProposalGenerationRun = internalMutation({
  args: {
    jobId: v.id("llmJobs"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.options?.kind !== PROPOSAL_GENERATION_JOB_KIND) {
      return null;
    }

    await ctx.db.patch(args.jobId, {
      status: args.status,
      lastError: args.error ?? job.lastError,
      updatedAt: Date.now(),
    });
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

    // Safety: enforce a retry budget so jobs do not re-process indefinitely.
    // If attempts exceed MAX_ATTEMPTS, mark the job failed and do not claim it.
    const MAX_ATTEMPTS = 3;
    const existingAttempts = (job as any).attempts ?? 0;
    if (existingAttempts >= MAX_ATTEMPTS) {
      console.log(`[claimJob] job ${String(args.jobId)} exceeded max attempts (${existingAttempts}) — marking failed`);
      await ctx.db.patch(args.jobId, {
        status: "failed",
        lastError: `max attempts (${MAX_ATTEMPTS}) exceeded`,
        updatedAt: Date.now(),
      });
      return null;
    }

    // Only claim if still queued
    if ((job as any).status !== "queued") {
      console.log(`[claimJob] job ${String(args.jobId)} not queued (status=${(job as any).status}) — not claiming`);
      return null;
    }

    const now = Date.now();
    const attempts = existingAttempts + 1;

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
    console.log(`[claimJob] claimed job ${String(args.jobId)} attempts=${attempts} lockedBy=${args.workerId}`);
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
 *
 * Extended to accept telemetry fields used for post-mortem analysis:
 * - provider_used: which provider was selected/used for this invocation (string|null)
 * - sanitized_for_repair: whether the raw provider response was sanitized before repair (boolean)
 * - repair_returned_provider_shape: whether the repair LLM returned a provider-shaped object (boolean)
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
    // Telemetry fields
    provider_used: v.optional(v.union(v.string(), v.null())),
    sanitized_for_repair: v.optional(v.boolean()),
    repair_returned_provider_shape: v.optional(v.boolean()),
    confidence: v.optional(v.union(v.number(), v.null())),
    merged: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
  },
  returns: v.id("llmHistory"),
  handler: async (ctx, args) => {
    const now = args.createdAt ?? Date.now();

    // Detect whether this job already has a history entry so we can flag the new history as merged.
    let jobHasHistory = false;
    if (args.jobId !== undefined && args.jobId !== null) {
      try {
        const job = await ctx.db.get(args.jobId as any);
        jobHasHistory = !!(job && (job as any).historyId);
      } catch {
        jobHasHistory = false;
      }
    }

    const doc: any = {
      profileId: args.profileId,
      ...(args.jobId !== undefined ? { jobId: args.jobId } : {}),
      ...(args.placeholderId !== undefined ? { placeholderId: args.placeholderId } : {}),
      ...(args.provider !== undefined ? { provider: args.provider } : {}),
      ...(args.model !== undefined ? { model: args.model } : {}),
      ...(args.full_response !== undefined ? { full_response: args.full_response } : {}),
      ...(args.patch !== undefined ? { patch: args.patch } : {}),
      // Telemetry persisted to llmHistory
      ...(args.provider_used !== undefined ? { provider_used: args.provider_used } : {}),
      ...(args.sanitized_for_repair !== undefined ? { sanitized_for_repair: args.sanitized_for_repair } : {}),
      ...(args.repair_returned_provider_shape !== undefined ? { repair_returned_provider_shape: args.repair_returned_provider_shape } : {}),
      ...(args.confidence !== undefined ? { confidence: args.confidence } : {}),
      // If caller didn't explicitly pass merged, infer it when an earlier history exists for this job.
      ...(args.merged !== undefined ? { merged: args.merged } : jobHasHistory ? { merged: true } : {}),
      createdAt: now,
    };
    const id = await ctx.db.insert("llmHistory", doc);
    const mergedFlag = args.merged !== undefined ? args.merged : jobHasHistory ? true : false;
    console.log(`[appendHistory] appended history ${String(id)} for profile ${String(args.profileId)} job=${String(args.jobId ?? "null")} merged=${mergedFlag}`);
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
    const job = await ctx.db.get(args.jobId);
    const now = args.updatedAt ?? Date.now();
    if (!job) return null;

    // If a historyId already exists for this job, preserve the original historyId to avoid
    // overwriting a previously accepted parse result. Update status/updatedAt but keep original history.
    if ((job as any).historyId) {
      console.log(`[markJobCompleted] job ${String(args.jobId)} already has historyId=${String((job as any).historyId)} — preserving original, updating status=${args.status ?? "finished"}`);
      await ctx.db.patch(args.jobId, {
        status: args.status ?? "finished",
        updatedAt: now,
      });
      return null;
    }

    console.log(`[markJobCompleted] setting historyId=${String(args.historyId)} on job ${String(args.jobId)} status=${args.status ?? "finished"}`);
    await ctx.db.patch(args.jobId, {
      status: args.status ?? "finished",
      updatedAt: now,
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

export const requestProposalGenerationCancel = mutation({
  args: {
    clientRunId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    if (profiles.length === 0) {
      return false;
    }

    const candidateGroups = await Promise.all(
      profiles.map((profile) =>
        ctx.db
          .query("llmJobs")
          .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
          .order("desc")
          .take(20),
      ),
    );
    const candidates = candidateGroups.flat();

    const run = candidates.find(
      (job) =>
        job.options?.kind === PROPOSAL_GENERATION_JOB_KIND &&
        job.placeholderId === args.clientRunId &&
        job.requestedBy === identity.subject,
    );

    if (!run) {
      return false;
    }

    if (
      run.status === "finished" ||
      run.status === "failed" ||
      run.status === "canceled"
    ) {
      return true;
    }

    await ctx.db.patch(run._id, {
      status: "cancel_requested",
      updatedAt: Date.now(),
    });
    return true;
  },
});
