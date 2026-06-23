/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars, no-empty -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { mutation, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { llmConfig } from "../config/llmConfig";
import runFormatCompleteCV from "./actions/formatCompleteCV";

// pipeline-note: central entry for Convex LLM orchestration (formatting and
// section extraction). hybridParser.ts, workerGateway.ts, and canonicalize.ts
// depend on these mutations/actions wiring into the parser pipeline.

/**
 * Runtime fetch instrumentation (debug only)
 *
 * Purpose:
 * - Capture and log a small stack-trace + URL every time `fetch` is invoked inside the Convex server
 *   runtime. This helps identify the exact callsite when Convex warns about "unawaited operation: [fetch]".
 * - The wrapper is intentionally lightweight and non-blocking: it returns the original Promise
 *   unchanged while attaching metadata to the returned promise for correlation.
 *
 * Safety:
 * - All logging is wrapped in try/catch to avoid crashing runtime if console isn't available.
 * - We only install the wrapper once per process.
 */
try {
  const globalAny: any = globalThis as any;
  const origFetch = globalAny.fetch;
  if (typeof origFetch === "function" && !globalAny.__fetchInstrumented) {
    globalAny.__fetchInstrumented = true;
    globalAny.fetch = function fetchInstrumented(...args: any[]) {
      // Capture a lightweight stack for correlation
      const url = args && args[0];
      let stack: string | undefined = undefined;
      try {
        // Create an Error and grab its stack - this is cheap and fine for debug
        stack = (new Error("fetch-instrument")).stack;
      } catch { /* ignore */ }
      try {
        // Use console.info so these are visible in dev logs; keep payload small
        console.info("[fetch-instrument] fetch called", { url: String(url).slice(0, 200), ts: Date.now() });
      } catch { /* ignore */ }

      // Call original fetch and attach metadata to the returned promise for later correlation.
      const p = origFetch.apply(this, args);
      try {
        // Non-enumerable attach metadata so it doesn't break code that iterates keys
        Object.defineProperty(p, "__fetch_instrumentation", {
          value: { url: String(url).slice(0, 200), stack, ts: Date.now() },
          configurable: true,
          writable: false,
          enumerable: false
        });
      } catch {
        // best-effort only
      }
      return p;
    };
  }
} catch (e) {
  try { console.warn("[fetch-instrument] failed to install instrumentation:", String(e)); } catch {}
}

/**
 * Internal mutation: atomically insert an llmHistory row and mark the job completed.
 * This consolidates appendHistory + markJobCompleted into one server-side mutation.
 */
/*
  storeResult removed — callers should use internal.jobs.appendHistory + internal.jobs.markJobCompleted
  This file previously contained a compatibility wrapper that inserted directly into llmHistory and patched
  the job row. To ensure all job completions go through the centralized lifecycle (attempts tracking /
  idempotency), any remaining code that used llm.storeResult should be updated to:

    const historyId = await ctx.runMutation(internal.jobs.appendHistory, { ... });
    await ctx.runMutation(internal.jobs.markJobCompleted, { jobId, historyId });

  The wrapper was removed to avoid circular type inference and to enforce the single canonical path.
*/

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

    // Ensure processing goes through the claim/worker lifecycle so attempts are tracked.
    // Try to claim the job atomically; if claim fails (already processing/claimed), abort.
    // Use a deterministic workerId for the refine action so claims are attributable.
    const WORKER_ID = `refine-${String(args.jobId)}`;
    const claimed = await ctx.runMutation(internal.jobs.claimJob, {
      jobId: args.jobId,
      workerId: WORKER_ID,
    });
    if (!claimed) {
      // Another worker claimed this job or it is no longer queued; abort refine.
      return null;
    }

    // Use rawText from the claimed job (may be null/undefined)
    const rawText: string | null = (claimed as any).rawText ?? null;

    // Choose model (default). Use shared llmConfig to keep model selection consistent across services.
    const model = llmConfig.mistralModel ?? llmConfig.model ?? process.env.MISTRAL_MODEL ?? "mistral-small-latest";
 
    // Ensure API key exists
    const apiKey = llmConfig.mistralKey ?? process.env.MISTRAL_API_KEY;
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

    // Persist the result through the job lifecycle mutations so attempts and idempotency
    // handling is consistent across all processing paths.
    // Defensive: try to extract a usable text payload from the provider response and run
    // the same formatCompleteCV repair path server-side so the history contains a normalized parse.
    const extractProviderText = (resp: any): string | null => {
      if (!resp) return null;
      // Common shapes to try in order:
      // - choices[0].message.content
      // - text
      // - output (string)
      // - output[0].content or output[0].text
      // - output?.[0]?.content?.text or output?.[0]?.content?.message
      // - fallback to null (we avoid always stringifying huge objects here)
      try {
        const c = resp?.choices?.[0]?.message?.content;
        if (typeof c === "string" && c.trim().length > 0) return c;
      } catch {}
      try {
        if (typeof resp?.text === "string" && resp.text.trim().length > 0) return resp.text;
      } catch {}
      try {
        if (typeof resp?.output === "string" && resp.output.trim().length > 0) return resp.output;
      } catch {}
      try {
        const o0 = resp?.output?.[0];
        if (typeof o0?.content === "string" && o0.content.trim().length > 0) return o0.content;
        if (typeof o0?.text === "string" && o0.text.trim().length > 0) return o0.text;
        if (typeof o0?.content?.text === "string" && o0.content.text.trim().length > 0) return o0.content.text;
      } catch {}
      return null;
    };

    let normalizedParse: any = null;
    let sanitizedForRepair = false;
    let repairReturnedProviderShape = false;
    try {
      const providerText = extractProviderText(full_response);
      if (providerText) {
        try {
          // Run server-side normalized parse to produce reviewer-ready shape
          const repaired = await runFormatCompleteCV({ rawText: providerText });
          if (repaired && repaired.result) {
            normalizedParse = repaired.result;
            repairReturnedProviderShape = true;
            sanitizedForRepair = true;
          }
        } catch (e) {
          // Log and continue — we'll still persist the raw full_response
          console.warn(`[refine] server-side formatCompleteCV failed for job ${String(args.jobId)}: ${String(e)}`);
        }
      }
    } catch (e) {
      console.warn(`[refine] providerText extraction/parsing failed for job ${String(args.jobId)}: ${String(e)}`);
    }

    // Ensure we persist a minimal, parseable patch even when repair fails so the client
    // can treat the job as terminal and surface a helpful message (defense-in-depth).
    const originalPatch = full_response?.patch ?? null;
    const minimalNormalized = normalizedParse ?? {
      // Minimal structure for the client to detect a failed repair and show a fallback UI.
      // Keep it small to avoid storing huge raw blobs.
      warning: "repair_failed",
      // Provide a small snippet of the provider's textual payload to aid debugging/in-UI display.
      rawTextSnippet: (typeof full_response === "string" ? String(full_response).slice(0, 800) : (full_response?.text ?? (rawText ?? "") ).toString().slice(0, 800)),
      // Preserve diagnostic flags so telemetry/UX can show reason
      diagnostics: {
        sanitizedForRepair,
        repairReturnedProviderShape,
        confidence: confidence ?? full_response?.parsed?.confidence ?? null
      }
    };

    const patchToPersist = normalizedParse
      ? { normalized: normalizedParse, originalPatch }
      : { normalized: minimalNormalized, originalPatch };

    const historyId = await ctx.runMutation(internal.jobs.appendHistory, {
      profileId: job.profileId,
      jobId: args.jobId,
      placeholderId: job.placeholderId ?? null,
      provider: "mistral",
      model,
      full_response,
      patch: patchToPersist,
      // Telemetry: persist provider selection and repair diagnostics (best-effort)
      provider_used: "mistral",
      sanitized_for_repair: sanitizedForRepair,
      repair_returned_provider_shape: repairReturnedProviderShape,
      confidence: confidence ?? full_response?.parsed?.confidence ?? null,
      merged: false,
      createdAt: Date.now(),
    });

    // Link the job to the persisted history record using the centralized mutation which
    // preserves the first accepted historyId and avoids overwriting on retries.
    await ctx.runMutation(internal.jobs.markJobCompleted, {
      jobId: args.jobId,
      historyId,
      status: "finished",
      updatedAt: Date.now(),
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
      // If no matching userProfiles doc exists for the external profileId, create a lightweight
      // placeholder document to allow downstream processing to continue. This improves tolerance
      // for callers that pass newly-issued external IDs that haven't yet been upserted.
      // The placeholder mirrors the minimal shape produced by upsertProfile to satisfy schema constraints.
      try {
        const now = Date.now();
        const placeholder: any = {
          profileId: args.profileId,
          idempotencyKeys: [],
          email: "",
          skills: [],
          experience: [],
          education: [],
          achievements: [],
          version: 1,
          createdAt: now,
          updatedAt: now,
          preferences: {
            writingStyle: "professional",
            tonePreference: "formal",
            autoSend: false,
          },
        };
        const convexId = await ctx.db.insert("userProfiles", placeholder);
        normalizedProfileId = convexId as Id<"userProfiles">;
        console.info(`[startRefineByString] created placeholder userProfiles row for external profileId="${args.profileId}" -> convexId=${String(normalizedProfileId)}`);
      } catch (e) {
        // If insertion fails for any reason, throw the original clear error.
        throw new Error(`Invalid profileId: "${args.profileId}". Could not normalize to a Convex id nor find a userProfiles document with that external profileId.`);
      }
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
