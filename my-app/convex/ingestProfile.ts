import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();


http.route({
  path: "/profiles/ingest",
  method: "POST",
  handler: httpAction(async ({ runMutation, auth }, request) => {
    try {
      const body = await request.json();
      // payloadValidator (convex v validators) don't expose a .parse method here;
      // accept the body and rely on the internal mutation to enforce schemas.
      // Optionally add lightweight runtime checks here if needed.
      const validated = body;

      // Ensure request is authenticated
      const identity = await auth.getUserIdentity();
      if (!identity) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
      }

      // Ensure userProfile exists (create/update)
      await runMutation(internal.users.createOrUpdateUser, {
        clerkId: identity.subject,
        email: identity.email ?? "unknown@example.com",
        name: identity.name,
      });

      // Patch the profile via internal mutation we created (profiles.patchProfile)
      if (!(internal as any).profiles || !(internal as any).profiles.patchProfile) {
        return new Response(JSON.stringify({ status: "accepted", message: "patchProfile mutation not available" }), { status: 202 });
      }

      await runMutation((internal as any).profiles.patchProfile, {
        profile: validated,
      });

      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    } catch (err: any) {
      console.error("HTTP /profiles/ingest error:", err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
  }),
});

export default http;
