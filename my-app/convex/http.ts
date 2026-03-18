import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { ingestProfileHandler, llmRefineHandler } from "./http_actions";






const http = httpRouter();

// Simple health check route to verify HTTP route registration (ping)
http.route({
  path: "/ner-smoke",
  method: "POST",
  handler: httpAction(async ({ runAction }, request) => {
    try {
      const origin = request.headers.get("Origin");
      const headers = corsHeadersForOrigin(origin);
      let body: any = null;
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const text = typeof body?.text === "string" ? body.text : undefined;
      const result = await runAction((api as any)["actions/nerSmokeTest"]?.nerSmokeTest, { text });
      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (err: any) {
      const origin = request.headers.get("Origin");
      const headers = corsHeadersForOrigin(origin);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
    }
  }),
});

http.route({
  path: "/ner-smoke",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => preflightResponse(request.headers.get("Origin"))),
});

http.route({
  path: "/ping",
  method: "GET",
  handler: httpAction(async () => {
    return new Response("pong", { status: 200, headers: { "Content-Type": "text/plain" } });
  }),
});

http.route({
  path: "/test/generate",
  method: "POST",
  handler: httpAction(async ({ runAction }, request) => {
    try {
      const body = await request.json();
      const jobTitle = body.jobTitle ?? "Test Job";
      const jobDescription = body.jobDescription ?? "This is a test job description.";
      const proposalType = body.proposalType ?? "technical";
      const formalityLevel = body.formalityLevel ?? "formal";
      const creativity = body.creativity ?? "standard";
      const modelType = body.modelType ?? "mistral-small-latest";

      // Call the existing action to generate a proposal (use any-cast to avoid generated-api mismatch)
      const result = await runAction((internal as any).functions?.generateProposal, {
        jobTitle,
        jobDescription,
        proposalType,
        formalityLevel,
        creativity,
        modelType,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("HTTP test/generate error:", err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
  }),
});

// Clean profile ingestion endpoint for client-side parsed data
http.route({
  path: "/ingestProfile",
  method: "POST",
  handler: httpAction(ingestProfileHandler),
});

// CORS origin (use environment variable in Convex dashboard for production)
const PROD_ORIGIN = process.env.CLIENT_ORIGIN;

// Helper to create a pre-flight OPTIONS response
const preflightResponse = (origin: string | null) => {
  // During development, allow any localhost port to support dynamic port selection by Vite.
  // In production, strictly enforce the CLIENT_ORIGIN environment variable.
  const isDev = /^http:\/\/localhost:\d+$/.test(origin ?? "");
  const allowedOrigin = PROD_ORIGIN ?? (isDev ? origin! : "http://localhost:5173");

  // If the request origin is not allowed, return a standard response without CORS headers.
  if (!PROD_ORIGIN && !isDev) {
    // Note: for production, you would likely return a 403 Forbidden error here,
    // but for local dev, we respond gently to allow browser dev tools to report the error.
    return new Response("Origin not allowed", { status: 403 });
  }

  return new Response(null, {
    status: 204, // No Content
    headers: new Headers({
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    }),
  });
};

// OPTIONS handler for /ingestProfile (preflight)
http.route({
  path: "/ingestProfile",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => preflightResponse(request.headers.get("Origin"))),
});

// POST route delegates to http_actions.ingestProfileHandler
// (already registered above)

// /llm-refine routes delegate to http_actions
http.route({
  path: "/llm-refine",
  method: "POST",
  handler: httpAction(llmRefineHandler),
});

http.route({
  path: "/llm-refine",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => preflightResponse(request.headers.get("Origin"))),
});

/**
 * Strict extraction HTTP endpoints (site fallbacks)
 * - POST /extract-profile-strict-with-spans  -> calls actions/extractProfileStrictWithSpans
 * - POST /extract-profile-strict             -> calls actions/extractProfileStrict
 * - OPTIONS preflights mirror existing CORS behavior
 */

// Helper to build CORS response headers (mirrors preflight behavior)
function corsHeadersForOrigin(origin: string | null): HeadersInit {
  const isDev = /^http:\/\/localhost:\d+$/.test(origin ?? "");
  const allowedOrigin = PROD_ORIGIN ?? (isDev ? (origin ?? "") : "http://localhost:5173");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

// with-spans POST
http.route({
  path: "/extract-profile-strict-with-spans",
  method: "POST",
  handler: httpAction(async ({ runAction }, request) => {
    try {
      const origin = request.headers.get("Origin");
      const headers = corsHeadersForOrigin(origin);
      let body: any = null;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
      }
      const rawText = typeof body?.rawText === "string" ? body.rawText : "";
      if (!rawText.trim()) {
        return new Response(JSON.stringify({ error: "missing_rawText" }), { status: 400, headers });
      }
      // Call Convex action (tolerant any-cast to avoid generated-api mismatch)
      const result = await runAction(
        (api as any)["actions/extractProfileStrictWithSpans"]?.extractProfileStrictWithSpans,
        { rawText }
      );
      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (err: any) {
      const origin = request.headers.get("Origin");
      const headers = corsHeadersForOrigin(origin);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
    }
  }),
});

// with-spans OPTIONS
http.route({
  path: "/extract-profile-strict-with-spans",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => preflightResponse(request.headers.get("Origin"))),
});

// strict-only POST
http.route({
  path: "/extract-profile-strict",
  method: "POST",
  handler: httpAction(async ({ runAction }, request) => {
    try {
      const origin = request.headers.get("Origin");
      const headers = corsHeadersForOrigin(origin);
      let body: any = null;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
      }
      const rawText = typeof body?.rawText === "string" ? body.rawText : "";
      if (!rawText.trim()) {
        return new Response(JSON.stringify({ error: "missing_rawText" }), { status: 400, headers });
      }
      const result = await runAction(
        (api as any)["actions/extractProfileStrict"]?.extractProfileStrict,
        { rawText }
      );
      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (err: any) {
      const origin = request.headers.get("Origin");
      const headers = corsHeadersForOrigin(origin);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
    }
  }),
});

// strict-only OPTIONS
http.route({
  path: "/extract-profile-strict",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => preflightResponse(request.headers.get("Origin"))),
});

export default http;
