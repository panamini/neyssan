# Run generateProposal locally (DEV_STUB)

Purpose: quick runbook for running the generateProposal Convex action locally using DEV_STUB.

Required environment variables (local dev):
- DEV_STUB=true (forces a deterministic stub response; avoids needing LLM API keys)
- VITE_CONVEX_URL=http://localhost:3000 (Convex site URL used by the frontend HTTP fallback)
- CONVEX_SERVICE_TOKEN=your_convex_service_token (optional, for server-to-server endpoints)
- MISTRAL_API_KEY=... (only needed when not using DEV_STUB)
- OPENAI_API_KEY=... (only needed when selecting chatgpt model)
- MISTRAL_AGENT_ID=... (only needed for mistral-agent model)

Why DEV_STUB? The server action contains a dev stub path that returns a placeholder proposal when DEV_STUB=true; see [`my-app/convex/generateProposalMutation.ts:69`].

Quick start (example shell commands)
export DEV_STUB=true
export VITE_CONVEX_URL=http://localhost:3000
export CONVEX_SERVICE_TOKEN=secret-token
# Optional when not using DEV_STUB:
# export MISTRAL_API_KEY=sk-...
# export OPENAI_API_KEY=sk-...

Start Convex dev (in repo root)
npx convex dev

Start frontend (in my-app)
cd my-app && npm run dev

Triggering a proposal
- Open the app UI, go to the proposal form (component [`my-app/src/components/ProposalInputForm.tsx:20`]) and submit a short job description.
- The frontend calls the Convex action exposed as `api.functions.generateProposal` (see [`my-app/src/components/ProposalInputForm.tsx:21`]).
- With DEV_STUB=true the action returns a dev proposal and the action stores it via `internal.proposals.storeProposal` (see [`my-app/convex/generateProposalMutation.ts:73`]).

Switching to real LLMs
- Remove DEV_STUB and set the appropriate API keys (MISTRAL_API_KEY or OPENAI_API_KEY).
- Re-run `npx convex dev` so Convex picks up environment changes (or set envs in the Convex dashboard for deployed env).

Troubleshooting
- If the Convex action is unavailable, ensure `npx convex dev` is running and the action file exists: [`my-app/convex/generateProposalMutation.ts:20`].
- Check console logs in Convex dev for errors and ensure required env vars are present.

References
- UI: [`my-app/src/components/ProposalInputForm.tsx:20`]
- Server action: [`my-app/convex/generateProposalMutation.ts:20`]