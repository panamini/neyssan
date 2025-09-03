Proposal integration examples — call generateProposal and verify result

This quick reference shows two small examples to exercise the Convex proposal generation action and validate the result for local/manual E2E testing.

Prerequisites
- Start Convex dev: run `npx convex dev` in repo root so HTTP routes and actions are available.
- Start the frontend if you want to trigger from the UI: `cd my-app && npm run dev`
- For local testing without LLM keys, set:
  - DEV_STUB=true
  - VITE_CONVEX_URL=http://localhost:3000   (or your Convex site URL)
  Example:
    export DEV_STUB=true
    export VITE_CONVEX_URL=http://localhost:3000

1) Quick curl test (HTTP fallback)
- Endpoint: /test/generate (registered in [`my-app/convex/http.ts:22`])
- This endpoint calls the server action that generates + stores a proposal and returns { proposalId, proposalContent }.

Example curl:
curl -sS -X POST "${VITE_CONVEX_URL:-http://localhost:3000}/test/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "jobTitle": "Frontend Engineer",
    "jobDescription": "Build a React app using TypeScript and Convex. Experience with Tailwind and LLMs is a plus.",
    "proposalType": "technical",
    "formalityLevel": "formal",
    "creativity": "medium",
    "modelType": "mistral-small-latest"
  }' | jq

- Expected output (DEV_STUB=true): JSON with a stored proposal id and the proposal text, e.g.:
{
  "proposalId": "some-convex-id",
  "proposalContent": "DEV STUB PROPOSAL for \"Frontend Engineer\"..."
}

Notes:
- No auth is required for this test route.
- Use the returned proposalId to locate the stored document in the Convex dev UI (Database -> proposals) or in further API calls.

2) Node script example (POST + pretty-print)
Create a short Node script to POST and log the returned proposal:

// scripts/test-generate-proposal.js
const fetch = require("node-fetch");

async function run() {
  const CONVEX_SITE = process.env.VITE_CONVEX_URL || "http://localhost:3000";
  const res = await fetch(`${CONVEX_SITE}/test/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobTitle: "Frontend Engineer",
      jobDescription: "Build a React app using TypeScript and Convex.",
      proposalType: "technical",
      formalityLevel: "formal",
      creativity: "medium",
      modelType: "mistral-small-latest"
    })
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Request failed:", res.status, text);
    process.exit(1);
  }
  const json = await res.json();
  console.log("Result:", JSON.stringify(json, null, 2));
}
run().catch(err => { console.error(err); process.exit(1); });

Run:
VITE_CONVEX_URL=http://localhost:3000 DEV_STUB=true node scripts/test-generate-proposal.js

3) Validate the stored proposal
- The generateProposal action persists the proposal using the internal mutation `internal.proposals.storeProposal` (see [`my-app/convex/generateProposalMutation.ts:69` and 207`]).
- The HTTP response includes `proposalId`. Use that id to locate the document:
  - Open the Convex dev dashboard (started by `npx convex dev`) and view the `proposals` table, or
  - Use repository UI components / queries (e.g., call the public query `proposalsPublic` from the frontend when signed in) to list proposals for the authenticated user. See [`my-app/convex/proposalsPublic.ts:8`] for schema/usage.

4) Notes & troubleshooting
- If you see errors about missing API keys and you did not set DEV_STUB, configure MISTRAL_API_KEY or OPENAI_API_KEY depending on the model being used.
- If the HTTP endpoint is unreachable, ensure `npx convex dev` is running and the value of `VITE_CONVEX_URL` matches the dev site URL (ProfileReviewModal uses a similar pattern to build `${CONVEX_SITE_URL}/formatCompleteCV` — see [`my-app/src/components/ProfileReviewModal.tsx:28`]).
- For production-like testing, remove DEV_STUB and ensure valid LLM credentials are set in the Convex environment.

References (in repo)
- HTTP test/generate route: [`my-app/convex/http.ts:22`]
- Server action: [`my-app/convex/generateProposalMutation.ts:20`]
- Stored proposal helper: [`my-app/convex/proposals.ts:4`]
- Public proposal listing: [`my-app/convex/proposalsPublic.ts:8`]

This file provides a minimal set of examples to exercise the generateProposal action and confirm proposals are stored for the MVP core loop.