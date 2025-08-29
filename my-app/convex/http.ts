import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { ingestProfileHandler, llmRefineHandler } from "./http_actions";






const http = httpRouter();

// Simple health check route to verify HTTP route registration (ping)
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

http.route({
  path: "/llm-refine",
  method: "POST",
  handler: httpAction(llmRefineHandler),
});

export default http;
