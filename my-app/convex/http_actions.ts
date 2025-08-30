/**
 * Convex HTTP action handler skeletons for profile ingestion and LLM refine.
 *
 * These are helper handler functions you can import from my-app/convex/http.ts
 * and expose as httpAction routes. They include:
 *  - TypeScript types describing the expected payloads
 *  - Small runtime validators (no external deps) to guard request shapes
 *  - Clear TODOs for wiring to internal Convex mutations/actions
 *
 * Usage (in my-app/convex/http.ts):
 *   import { ingestProfileHandler, llmRefineHandler } from "./http_actions";
 *
 *   http.route({
 *     path: "/ingestProfile",
 *     method: "POST",
 *     handler: httpAction(ingestProfileHandler)
 *   });
 *
 *   http.route({
 *     path: "/llm-refine",
 *     method: "POST",
 *     handler: httpAction(llmRefineHandler)
 *   });
 *
 * The handlers return a Response so they can be used directly with httpAction.
 */


import { internal } from "./_generated/api";

const corsResponse = (body: any, status: number = 200, origin: string | null = null) => {
  const allowedOrigin = origin ?? process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (allowedOrigin) headers["Access-Control-Allow-Origin"] = allowedOrigin;
  headers["Vary"] = "Origin";
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
};

// Resolve allowed origin from an allowlist environment variable.
// - If CLIENT_ORIGIN_WHITELIST is set, it's a comma-separated list of allowed origins.
// - Otherwise fall back to CLIENT_ORIGIN or localhost default.
const resolveAllowedOrigin = (origin: string | null) => {
  const rawList = process.env.CLIENT_ORIGIN_WHITELIST ?? process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  const allowed = rawList.split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin) return process.env.CLIENT_ORIGIN ?? allowed[0] ?? null;
  return allowed.includes(origin) ? origin : null;
};


/* ----------------------------- Types ----------------------------- */

export type NormalizedProfile = {
  id?: string;
  name?: string | null;
  email?: string | null;
  summary?: string | null;
  skills?: string[] | null;
  experience?: Array<Record<string, any>> | null;
  education?: Array<Record<string, any>> | null;
  linkedIn?: string | null;
  rawText?: string | null;
  confidence?: number | null;
  metadata?: Record<string, any> | null;
  version?: number | null;
};

export type LLMRefineRequest = {
  profileId: string;
  rawText?: string; // optional canonical raw text to use for refinement
  options?: {
    provider?: string;
    model?: string;
    priority?: "low" | "normal" | "high";
  };
};

/* -------------------------- Runtime utils ------------------------ */

function isObject(x: any): x is Record<string, any> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function isStringArray(x: any): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

/* ------------------------- Handler: ingestProfile -------------------------
 *
 * Expected request JSON: top-level NormalizedProfile object.
 * Auth: user must be authenticated (Clerk identity via Convex auth)
 *
 * Behavior (recommended):
 * 1. Validate request body shape (best-effort).
 * 2. Ensure user exists (runMutation(internal.users.createOrUpdateUser))
 * 3. Call an internal mutation to upsert the user's profile (with versioning)
 *    e.g. runMutation(internal.users.updateUserProfile, { clerkId, profileData })
 * 4. Return { status: "ok", id?: "<profileId>" }.
 *
 * NOTE: This is a skeleton. Replace internal mutation names with actual imports.
 */
export async function ingestProfileHandler(ctx: any, request: any) {
  const origin = request?.headers?.get?.("Origin") ?? null;
  const respond = (body: any, status: number = 200) => corsResponse(body, status, origin);

  // Validate origin against allowlist (deny early when origin is present but not allowed)
  const allowedOrigin = resolveAllowedOrigin(origin);
  if (origin && !allowedOrigin) {
    console.warn("ingestProfileHandler: disallowed origin", origin);
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  try {

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return respond({ error: "Not authenticated" }, 401);
    }

    let body: any;
    try {
      body = await request.json();
    } catch (err: any) {
      // Don't expose internal error details to clients; log server-side instead.
      console.error("ingestProfileHandler: invalid_json:", String(err));
      return respond({ error: "invalid_json" }, 400);
    }

    if (!isObject(body)) {
      return respond({ error: "invalid_body", detail: "expected JSON object" }, 400);
    }

    // Basic normalization — accept either camelCase or snake_case for rawText/raw_text
    const profile: NormalizedProfile = {
      name: body.name ?? body.full_name ?? null,
      email: body.email ?? null,
      summary: body.summary ?? null,
      skills: isStringArray(body.skills) ? body.skills : (isStringArray(body.skill) ? body.skill : null),
      experience: Array.isArray(body.experience) ? body.experience : null,
      education: Array.isArray(body.education) ? body.education : null,
      linkedIn: body.linkedIn ?? body.linkedin ?? null,
      rawText: body.rawText ?? body.raw_text ?? null,
      confidence: typeof body.confidence === "number" ? body.confidence : null,
      metadata: isObject(body.metadata) ? body.metadata : null,
    };

    // Ensure user exists (create or update)
    await ctx.runMutation(internal.users.createOrUpdateUser, {
      clerkId: identity.subject,
      email: identity.email ?? "unknown@example.com",
      name: identity.name ?? undefined,
    });

    // Persist profile data using the internal mutation.
    // internal.users.updateUserProfile should be implemented in your Convex functions.
    await ctx.runMutation(internal.users.updateUserProfile, {
      clerkId: identity.subject,
      profileData: profile,
    });
  
    return respond({ status: "ok" }, 200);
  } catch (err: any) {
    console.error("ingestProfileHandler error:", err);
    return respond({ error: "internal_server_error" }, 500);
  }
}

/* ------------------------- Handler: llmRefine -------------------------
 *
 * Expected request JSON:
 *   { profileId: string, rawText?: string, options?: { provider?, model?, priority? } }
 *   OR { jobId: string } for polling
 *
 * Auth: authenticated user or service token (choose per your security model).
 *
 * Behavior:
 * 1. Validate request and ensure the caller is authorized to refine the profile.
 * 2. Enqueue an asynchronous refine job (via an internal mutation or by calling an external worker).
 *    - A common pattern: runMutation(internal.jobs.start, { profileId, rawText, options, reason })
 * 3. Return { status: "enqueued", jobId: string } for new jobs, or { status: "running"|"completed"|"failed", result?: any } for polling.
 *
 * NOTE: The actual enqueue implementation may live in a separate worker service.
 */
export async function llmRefineHandler(ctx: any, request: any) {
  // Use top-level corsResponse helper

  const origin = request?.headers?.get?.("Origin") ?? null;
  const jsonResponse = (body: any, status: number = 200) => corsResponse(body, status, origin);

  // Validate origin against allowlist
  const allowedOrigin = resolveAllowedOrigin(origin);
  if (origin && !allowedOrigin) {
    console.warn("llmRefineHandler: disallowed origin", origin);
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  try {

    const identity = await ctx.auth.getUserIdentity?.();
    if (!identity) {
      return jsonResponse({ error: "not_authenticated" }, 401);
    }

    let body: any;
    try {
      body = await request.json();
    } catch (err: any) {
      console.error("llmRefineHandler: invalid_json:", String(err));
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    // Check if we're starting a new job or polling an existing one
    const hasProfileId = body && typeof body.profileId === "string";
    const hasJobId = body && typeof body.jobId === "string";

    if (!hasProfileId && !hasJobId) {
      return jsonResponse({ error: "missing_parameters", message: "Provide either profileId to start a job or jobId to poll status" }, 400);
    }

    // Handle job status polling
    if (hasJobId) {
      const jobId = body.jobId;
      // Run the internal query directly — the internal.query will validate the id.
      let job: any = null;
      try {
        job = await ctx.runQuery(internal.jobs.getJob, { jobId });
      } catch (e: any) {
        return jsonResponse({ error: "invalid_id", message: "Invalid jobId format or validation failed" }, 400);
      }

      if (!job) {
        return jsonResponse({ error: "not_found", message: "Job not found" }, 404);
      }

      // Map internal status to public status
      const statusMap: Record<string, string> = {
        queued: "enqueued",
        processing: "running",
        finished: "completed",
        failed: "failed"
      };

      const publicStatus = statusMap[job.status] || job.status;

      // Return appropriate response based on status
      if (publicStatus === "completed") {
        let result = null;
        if (job.historyId) {
          try {
            result = await ctx.runQuery(internal.jobs.getHistoryById, { historyId: job.historyId });
          } catch (e) {
            result = { warning: "failed_to_load_history", error: String(e) };
          }
        }
        return jsonResponse({ status: "completed", result });
      } else if (publicStatus === "failed") {
        return jsonResponse({
          status: "failed",
          error: "job_failed",
          message: job.lastError || "Job processing failed"
        });
      } else {
        return jsonResponse({ status: publicStatus });
      }
    }

    // Handle new job creation
    if (hasProfileId) {
      const profileId = body.profileId;
  
      const rawText = typeof body.rawText === "string" ? body.rawText : "";
      const options = isObject(body.options) ? body.options : {};
  
      // Delegate normalization and ownership checks to a strict internal mutation
      // that accepts an external string id. This avoids calling ctx.db.normalizeId
      // from an httpAction context where ctx.db may be unavailable/undefined.
      try {
        const jobId = await ctx.runMutation((internal as any).llm.startRefineByString, {
          profileId,
          rawText,
          options,
        });
        return jsonResponse({ status: "enqueued", jobId: String(jobId) });
      } catch (err: any) {
        console.error("llmRefineHandler: failed to start job via startRefineByString", {
          error: String(err),
          profileId,
          caller: identity?.subject,
        });
        return jsonResponse({ error: "internal_server_error", message: "Failed to enqueue job" }, 500);
      }
    }

    // This should never be reached due to earlier validation
    return jsonResponse({ error: "invalid_request", message: "Invalid request parameters" }, 400);

  } catch (err: any) {
    console.error("llmRefineHandler error:", err);
    // Do not return internal error details to the client in production.
    return jsonResponse({
      error: "internal_server_error"
    }, 500);
  }
}
