import { mutation, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Internal mutation: atomically insert an llmHistory row and mark the job completed.
 * This consolidates appendHistory + markJobCompleted into one server-side mutation.
 */
export const storeResult = internalMutation({
  args: {
    jobId: v.id("llmJobs"),
    profileId: v.id("userProfiles"),
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
    // Insert history record
    const now = args.createdAt ?? Date.now();
    const historyDoc: any = {
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

    const historyId = await ctx.db.insert("llmHistory", historyDoc);

    // Mark the job finished and link to historyId atomically (same mutation)
    await ctx.db.patch(args.jobId, {
      status: "finished",
      updatedAt: Date.now(),
      historyId,
    });

    return historyId;
  },
});

/**
 * Internal action to run the external LLM call.
 * This action should only call the third-party API and then persist results via internal mutations.
 * It intentionally does not directly access ctx.db for reading/writing jobs (it uses internal queries/mutations).
 */
export const refine = internalAction({
  args: {
    jobId: v.id("llmJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Load job details via internal query
    const job = await ctx.runQuery(internal.jobs.getJob, { jobId: args.jobId });
    if (!job) {
      throw new Error("Job not found");
    }

    // Use rawText from job (may be null/undefined)
    const rawText: string | null = (job as any).rawText ?? null;

    // Choose model (default). You can extend startRefine to accept model/options later.
    const model = "ministral-8b-2410";

    // Ensure API key exists
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      // Mark job failed and return
      await ctx.runMutation(internal.jobs.markJobFailed, {
        jobId: args.jobId,
        error: "MISTRAL_API_KEY not configured",
        updatedAt: Date.now(),
      });
      return null;
    }

    // Prepare request body according to the requested format
    const requestBody = {
      model,
      messages: [{ role: "user", content: rawText ?? "" }],
    };

    let full_response: any = null;
    let confidence: number | null = null;

    try {
      // Call Mistral HTTP API. Adjust endpoint if your infra uses a different base.
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const msg = `Mistral API error: ${res.status} ${res.statusText} ${text}`;
        await ctx.runMutation(internal.jobs.markJobFailed, {
          jobId: args.jobId,
          error: msg,
          updatedAt: Date.now(),
        });
        return null;
      }

      const json = await res.json();
      full_response = json;

      // Try to derive a confidence value if the provider includes it (best-effort)
      confidence = (json?.usage?.confidence as number) ?? (json?.choices?.[0]?.message?.confidence as number) ?? null;
    } catch (err) {
      await ctx.runMutation(internal.jobs.markJobFailed, {
        jobId: args.jobId,
        error: (err as Error).message ?? "LLM call failed",
        updatedAt: Date.now(),
      });
      return null;
    }

    // Persist the result using the atomic internal mutation defined above.
    await ctx.runMutation((internal as any).llm.storeResult, {
      jobId: args.jobId,
      profileId: job.profileId,
      placeholderId: job.placeholderId ?? null,
      provider: "mistral",
      model,
      full_response,
      patch: full_response?.patch ?? null,
      confidence: confidence ?? full_response?.parsed?.confidence ?? null,
      merged: false,
      createdAt: Date.now(),
    });

    return null;
  },
});

export const startRefine = mutation({
  args: {
    profileId: v.id("userProfiles"),
    rawText: v.union(v.string(), v.null()),
    options: v.optional(v.any()),
  },
  returns: v.id("llmJobs"),
  handler: async (ctx, args): Promise<Id<"llmJobs">> => {
    // Create the job via the strict internal mutation.
    const jobId: Id<"llmJobs"> = await ctx.runMutation(internal.jobs.start, {
      profileId: args.profileId,
      rawText: args.rawText ?? "",
      options: args.options,
      reason: undefined,
    });

    // Return the Convex Id directly.
    return jobId;
  },
});

/**
 * Compatibility wrapper: accept an external profileId string (UUID or other)
 * and normalize it to a Convex Id<"userProfiles"> before enqueuing.
 *
 * This preserves backward compatibility for clients that still provide the
 * external profileId (e.g., the value returned by upsertProfile) while keeping
 * startRefine strict (v.id("userProfiles")).
 */
export const startRefineByString = mutation({
  args: {
    profileId: v.string(),
    rawText: v.union(v.string(), v.null()),
    options: v.optional(v.any()),
  },
  returns: v.id("llmJobs"),
  handler: async (ctx, args): Promise<Id<"llmJobs">> => {
    // Attempt to normalize the incoming profileId string into a Convex Id<"userProfiles">.
    // Many callers still provide the external UUID (profileId) produced by the pdf-ingest
    // service. In that case, ctx.db.normalizeId will return falsy. To remain tolerant we:
    // 1) try normalizeId (happy path)
    // 2) if that fails, query userProfiles.by_profileId index for a row whose profileId field
    //    matches the provided external id and use its Convex _id
    // 3) if both fail, throw a clear error
    let normalizedProfileId: Id<"userProfiles"> | null = null;
    try {
      normalizedProfileId = ctx.db.normalizeId("userProfiles", args.profileId);
    } catch (e) {
      // normalizeId might throw in some environments; swallow and fallback to lookup
      normalizedProfileId = null;
    }
 
    if (!normalizedProfileId) {
      // Fallback: find a profiles document whose external `profileId` matches the string.
      try {
        const rows = await ctx.db
          .query("userProfiles")
          .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
          .take(1);
        if (rows && rows.length > 0) {
          normalizedProfileId = rows[0]._id as Id<"userProfiles">;
        }
      } catch (e) {
        // If the query fails, keep normalizedProfileId as null and handle below.
        normalizedProfileId = null;
      }
    }
 
    if (!normalizedProfileId) {
      throw new Error(`Invalid profileId: "${args.profileId}". Could not normalize to a Convex id nor find a userProfiles document with that external profileId.`);
    }
 
    // Defensive: check that the normalized id actually exists in the database.
    const profileDoc = await ctx.db.get(normalizedProfileId);
    if (!profileDoc) {
      throw new Error(`Profile not found for id "${normalizedProfileId}" (original: "${args.profileId}").`);
    }
 
    // Create the job via the strict internal mutation and return the job id directly.
    const jobId: Id<"llmJobs"> = await ctx.runMutation(internal.jobs.start, {
      profileId: normalizedProfileId,
      rawText: args.rawText ?? "",
      options: args.options,
      reason: undefined,
    });
 
    return jobId;
  },
});

/**
 * Public: re-enqueue an existing job by string IDs (normalizes strings -> Convex Ids).
 * Returns null at the boundary (Convex uses null for no-data mutations).
 */
export const enqueueRefine = mutation({
  args: {
    profileId: v.string(),
    jobId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { profileId, jobId, reason }): Promise<null> => {
    const normalizedProfileId = ctx.db.normalizeId("userProfiles", profileId);
    if (!normalizedProfileId) {
      throw new Error(`Invalid profileId: "${profileId}"`);
    }
    const normalizedJobId = ctx.db.normalizeId("llmJobs", jobId);
    if (!normalizedJobId) {
      throw new Error(`Invalid jobId: "${jobId}"`);
    }

    await ctx.runMutation(internal.jobs.enqueue, {
      profileId: normalizedProfileId,
      jobId: normalizedJobId,
      reason,
    });
    return null;
  },
});
