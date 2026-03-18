import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

async function main() {
  const CONVEX_URL = process.env.CONVEX_URL ?? "http://127.0.0.1:8787";
  const CONVEX_KEY = process.env.CONVEX_KEY;
  if (!CONVEX_KEY) {
    console.error("CONVEX_KEY not set in environment. Cannot call Convex.");
    process.exit(2);
  }

  const convex = new ConvexHttpClient(CONVEX_URL, { auth: CONVEX_KEY });

  try {
    // 1) Create/upsert a test profile with an external profileId string so startRefineByString can find it.
    const externalProfileId = "test-profile-enqueue-001";
    const idempotencyKey = `enqueue-test-${Date.now()}`;
    console.log("Calling upsertProfile to create test profile:", externalProfileId);
    const upsertResp = await convex.action(api["mutations/upsertProfile"].upsertProfile, {
      profileId: externalProfileId,
      idempotencyKey,
      source: "enqueue-test",
      version: 1,
      profile: {
        name: "Test Enqueue User",
        email: "test-enqueue@example.com",
        summary: "This is a synthetic profile for testing the LLM worker enqueue flow.",
        rawText: "Test CV content. Expérience: Ingénieur logiciel chez Exemple (2020-2023). Compétences: TypeScript, Node.js"
      }
    });
    console.log("upsertProfile response:", upsertResp);

    // 2) Start a refine job by string (this will internally call internal.jobs.start and schedule the internal refine action)
    console.log("Calling llm.startRefineByString to enqueue a job for profile:", externalProfileId);
    const jobId = await convex.action(api.llm.startRefineByString, {
      profileId: externalProfileId,
      rawText: "Synthetic CV text for test job. Use French headings: PROFIL, EXPÉRIENCE, COMPÉTENCES, COORDONNÉES.",
      options: { provider: "mistral", model: "mistral-small-latest" }
    });
    console.log("Enqueued jobId:", String(jobId));

    // 3) Optionally poll the job once for status via workerGateway.processJobRequest list/claim flow is internal to worker.
    // Instead, return success info.
    process.exit(0);
  } catch (err) {
    console.error("Error enqueuing test job:", String(err));
    process.exit(1);
  }
}

main();