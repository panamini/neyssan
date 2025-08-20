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

// Profile ingest HTTP route
http.route({
  path: "/profiles/ingest",
  method: "POST",
  handler: httpAction(async ({ runMutation, auth }, request) => {
    try {
      const body = await request.json();
      // Basic payload acceptance; detailed validation is performed in internal mutation
      const profile = body;

      const identity = await auth.getUserIdentity();
      if (!identity) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
      }

      // Ensure user exists
      await runMutation(internal.users.createOrUpdateUser, {
        clerkId: identity.subject,
        email: identity.email ?? "unknown@example.com",
        name: identity.name,
      });

      // Call internal mutation to patch profile (internal.profiles.patchProfile)
      if ((internal as any).profiles && (internal as any).profiles.patchProfile) {
        await runMutation((internal as any).profiles.patchProfile, {
          profile,
        });
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      } else {
        // As a fallback, attempt to call public mutation if available
        if ((internal as any).profiles && (internal as any).profilesPublic) {
          await runMutation((internal as any).profilesPublic, {
            profile,
          });
          return new Response(JSON.stringify({ status: "ok", fallback: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ status: "accepted", message: "patchProfile not available" }), { status: 202 });
      }
    } catch (err: any) {
      console.error("HTTP /profiles/ingest error:", err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
  }),
});

export default http;
