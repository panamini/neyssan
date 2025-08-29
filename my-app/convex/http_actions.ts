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
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    let body: any;
    try {
      body = await request.json();
    } catch (err: any) {
      return new Response(JSON.stringify({ error: "invalid_json", details: String(err) }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (!isObject(body)) {
      return new Response(JSON.stringify({ error: "invalid_body", detail: "expected JSON object" }), { status: 400, headers: { "Content-Type": "application/json" } });
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

    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("ingestProfileHandler error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

/* ------------------------- Handler: llmRefine -------------------------
 *
 * Expected request JSON:
 *   { profileId: string, rawText?: string, options?: { provider?, model?, priority? } }
 *
 * Auth: authenticated user or service token (choose per your security model).
 *
 * Behavior:
 * 1. Validate request and ensure the caller is authorized to refine the profile.
 * 2. Enqueue an asynchronous refine job (via an internal mutation or by calling an external worker).
 *    - A common pattern: runMutation(internal.jobs.enqueueRefine, { profileId, rawText, options })
 * 3. Return { jobId?: string, placeholderId?: string } so the frontend can poll LLM history.
 *
 * NOTE: The actual enqueue implementation may live in a separate worker service.
 */
export async function llmRefineHandler(ctx: any, request: any) {
  try {
    const identity = await ctx.auth.getUserIdentity?.();
    if (!identity) {
      // Optionally allow service-to-service calls if you implement a service token check elsewhere
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    let body: any;
    try {
      body = await request.json();
    } catch (err: any) {
      return new Response(JSON.stringify({ error: "invalid_json", details: String(err) }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (!body || typeof body.profileId !== "string") {
      return new Response(JSON.stringify({ error: "missing_profileId" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Ownership check: use an internal query to fetch profile and validate ownership
    const profileDoc: any = await ctx.runQuery(internal.users.getProfileById, { profileId: body.profileId });
    if (!profileDoc) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (profileDoc.clerkId !== identity.subject) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const req: LLMRefineRequest = {
      profileId: body.profileId,
      rawText: typeof body.rawText === "string" ? body.rawText : undefined,
      options: isObject(body.options) ? body.options : undefined,
    };

    // Enqueue a job via the internal mutation (enqueueRefine)
    const enqueueResult = await ctx.runMutation(internal.jobs.enqueueRefine, {
      profileId: req.profileId,
      rawText: req.rawText ?? null,
      options: req.options ?? {},
      requestedBy: identity.subject,
    });

    return new Response(JSON.stringify({ status: "enqueued", ...(enqueueResult || {}) }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("llmRefineHandler error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
