import { mutation, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
    const model = "mistral-large-latest";

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

/**
 * Public mutation called by the frontend to start a refinement.
 * It enqueues a job via internal.jobs.enqueueRefine and schedules the refine action.
 */
export const startRefine = mutation({
  args: {
    profileId: v.id("userProfiles"),
    rawText: v.union(v.string(), v.null()),
    options: v.optional(v.any()),
  },
  returns: v.object({
    jobId: v.id("llmJobs"),
    placeholderId: v.string(),
  }),
  handler: async (ctx, args) => {
    // Create the job via internal mutation using the typed Convex Id.
    const enqueueResult = await ctx.runMutation(internal.jobs.enqueueRefine, {
      profileId: args.profileId,
      rawText: args.rawText ?? null,
      options: args.options,
      requestedBy: undefined,
    });

    const { jobId, placeholderId } = enqueueResult as any;

    // Schedule the internal action to run immediately (worker will pick it up)
    await ctx.scheduler.runAfter(0, (internal as any).llm.refine, { jobId });

    return { jobId, placeholderId };
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
  returns: v.object({
    jobId: v.id("llmJobs"),
    placeholderId: v.string(),
  }),
  handler: async (ctx, args) => {
    // Normalize the incoming profileId string into a Convex Id<"userProfiles">.
    const normalizedProfileId = ctx.db.normalizeId("userProfiles", args.profileId);
    if (!normalizedProfileId) {
      throw new Error("Invalid profileId");
    }

    // Create the job via internal mutation using the normalized id
    const enqueueResult = await ctx.runMutation(internal.jobs.enqueueRefine, {
      profileId: normalizedProfileId,
      rawText: args.rawText ?? null,
      options: args.options,
      requestedBy: undefined,
    });

    const { jobId, placeholderId } = enqueueResult as any;

    // Schedule the internal action to run immediately (worker will pick it up)
    await ctx.scheduler.runAfter(0, (internal as any).llm.refine, { jobId });

    return { jobId, placeholderId };
  },
});
