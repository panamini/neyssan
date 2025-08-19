import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

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

      // Call the existing action to generate a proposal
      // Use an any-cast to avoid generated-api typing mismatches in dev.
      const result = await runAction((internal as any).functions?.generateProposal as any, {
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
      console.error("Test generate endpoint error:", err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
  }),
});

export default http;
