"use node";

import { httpRouter } from "convex/server";
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

const http = httpRouter();

/**
 * HTTP action endpoint to accept backend-authoritative profile writes.
 *
 * Expected to be called server-to-server. If CONVEX_SERVICE_TOKEN is set in the
 * Convex environment, this route enforces Authorization: Bearer <token>.
 *
 * Body: JSON matching the worker -> Convex contract:
 * {
 *   profileId: string,
 *   idempotencyKey: string,
 *   source: string,
 *   version: number,
 *   profile: { ... }
 * }
 *
 * The route delegates to internal.mutations.upsertProfile for idempotent persistence.
 */
http.route({
  path: "/persistProfile",
  method: "POST",
  handler: httpAction(async ({ runMutation }, request) => {
    try {
      const expected = process.env.CONVEX_SERVICE_TOKEN;
      // If a service token is configured in the Convex environment, require it.
      if (expected) {
        const auth = request.headers.get("authorization") || "";
        const expectedHeader = `Bearer ${expected}`;
        if (auth !== expectedHeader) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
      }

      let body: any;
      try {
        body = await request.json();
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "invalid_json", details: String(err) }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      // Basic shape validation (presence of essential fields)
      if (!body || !body.profileId || !body.idempotencyKey || !body.profile) {
        return new Response(JSON.stringify({ error: "missing_fields", required: ["profileId","idempotencyKey","profile"] }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      // Delegate to internal mutation that performs idempotent upsert
      const result = await runMutation((internal as any).mutations.upsertProfile, {
        profileId: body.profileId,
        idempotencyKey: body.idempotencyKey,
        source: body.source || "unknown",
        version: typeof body.version === "number" ? body.version : 1,
        profile: body.profile,
      });

      // Ensure we return a definitive convexId at the top level so HTTP callers
      // (pdf-ingest or other services) can consistently use the internal Convex id.
      const convexId = (result)?.convexId ?? (result)?.profileId ?? null;
      return new Response(JSON.stringify({ status: "ok", convexId, result }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (err: any) {
      console.error("persistProfile action error:", err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }),
});

export default http;
