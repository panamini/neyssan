# Neyssan — Project Roadmap (Plan Mode)

Date: 2025-08-19  
Author: Cline (audit & roadmap)

---

## Project Context (short)
Neyssan is a job-proposal generator that helps users log in, ingest their profile (LinkedIn/CV), and generate tailored job proposals for postings (LinkedIn, Indeed, Upwork, etc.) using LLMs. A Chrome extension captures job postings, the backend calls an LLM (OpenAI / Mistral) to produce a proposal personalized to the user's profile, and proposals are saved and displayed in the web app.

Intended workflow:
1. User creates account and logs in (Clerk).
2. App ingests user profile (LinkedIn or CV).
3. Chrome extension scans job posting and sends job data to backend.
4. Backend calls LLM and generates a personalized proposal.
5. Proposal is shown to user in the app and can be saved/exported.

---

## High-level Status Snapshot
- What I checked (codebase + docs): my-app (Convex backend + frontend), two chrome extension code trees, docs/ (lots of plans and implementation notes).
- Major completed backend pieces: LLM integration service (langchain folder), Convex mutations/actions for proposals & users, webhook handler for Clerk (exists), proposal storage (proposals.ts), saveJobAndProposal mutation.
- Major gaps: frontend not calling generateProposal (no convex action wiring), extension↔backend auth & call flow not fully wired, profile ingestion pipeline missing, environment mismatches in docs vs code, docs duplication and outdated files.

---

## Step-by-step Roadmap (tasks with statuses)

Legend: ✅ Done / ⚠️ In Progress / ❌ Missing

1) Docs audit
- Status: ✅ Done (high-priority docs inspected)
- Description: Read core planning docs: convex_schema.md, Convex_Clerk_implementation_plan.md, LANGCHAIN_IMPLEMENTATION.md, DEPLOYMENT_CHECKLIST.md, README and extension plans. Identified conflicts and canonical doc candidates.

2) Fix Convex client env (frontend)
- Status: ⚠️ In Progress (identified; not yet applied)
- Description: Add `VITE_CONVEX_URL` to `my-app/.env` (frontend expects this). Current .env uses `NEXT_PUBLIC_CONVEX_URL` — causes Convex client instantiation to fail.

3) Ensure user profile creation on sign-in
- Status: ⚠️ In Progress / two options
- Description: Convex webhook exists (my-app/convex/clerk_webhook.ts) but requires `CLERK_WEBHOOK_SECRET` set in Convex env and webhook registration in Clerk. For rapid dev, add `createUserFromClient` mutation and call it from client after login.

4) Wire frontend UI → backend generate action
- Status: ❌ Missing
- Description: Make ProposalInputForm/App call `generateProposal` action (Convex action). Show loading, errors, and store returned content.

5) Chrome extension integration (auth + generate + save)
- Status: ❌ Missing / partially scaffolded
- Description: Decide canonical integration pattern (recommended: ConvexHttpClient + setAuth in background). Implement popup to get Clerk token, store `authToken`, background to call generate endpoint and call saveJobAndProposal mutation.

6) Profile ingestion (LinkedIn / CV)
- Status: ❌ Missing
- Description: Implement scraping-server or ingestion endpoint that parses LinkedIn/CV into structured profile fields and stores them in `userProfiles` (extend schema + migration).

7) Proposals management UI (list, edit, re-generate)
- Status: ❌ Missing
- Description: Use `proposals.ts` queries (listUserProposals, updateProposal) to build the saved proposals view and editing workflow.

8) Rate-limiting / Scheduler / Monitoring
- Status: ⚠️ Partially implemented (skeletons present)
- Description: Files exist (scheduler, monitoring, metrics) — need integration, configuration, and Sentry/Prometheus setup per DEPLOYMENT_CHECKLIST.

9) Tests & Deployment
- Status: ❌ Missing
- Description: Add E2E tests for auth → generate flow, load tests, and finalize deployment scripts. Push Convex schema and set production env vars.

---

## Phase-Based Execution Plan (detailed, sequential)

Phase 0 — Pre-conditions (before code edits)
- Confirm you'll allow me to switch to Act Mode for changes and tests.
- Collect/provide these values (or confirm existing):
  - VITE_CLERK_PUBLISHABLE_KEY (frontend)
  - VITE_CONVEX_URL (Convex public URL or local)
  - OPENAI_API_KEY and/or MISTRAL_API_KEY (LLM)
  - CLERK_WEBHOOK_SECRET (Svix secret from Clerk) — for production webhook
  - Any Convex admin keys if you plan to push schema

Phase 1 — Small, safe fixes & auth smoke test (aim: make login → user profile work)
1. (A) Environment fix — one-line edit
   - File: my-app/.env
   - Add: `VITE_CONVEX_URL=https://giddy-basilisk-88.convex.cloud` (or your Convex URL)
   - Why: main.tsx reads `import.meta.env.VITE_CONVEX_URL`; without it Convex client is undefined.
   - Verification: Start app, no Convex client init errors.

2. (B) Quickly ensure a userProfiles row appears after sign-in (dev shortcut)
   - Add server mutation: `my-app/convex/createUserFromClient.ts` (content prepared).
   - Add client call: call `convex.mutation('createUserFromClient')` after login in App.tsx using `useConvex`.
   - Restart dev, sign-in, verify userProfiles row in Convex DB.
   - Alternate (production path): Configure Clerk webhook (register webhook URL `/clerk-users-webhook`, set `CLERK_WEBHOOK_SECRET` in Convex env) to create users automatically.

Phase 2 — Wire generation flow (backend → frontend)
1. Implement client-side service call to action `generateProposal`:
   - File to edit: `my-app/src/components/ProposalInputForm.tsx` or `my-app/src/services/convex.ts`
   - Use `convex.action` or `convex.mutate` per Convex SDK (example included in notes).
2. On success, set App state so `ProposalDisplay` shows the content; save proposal id if returned.
3. Add error handling for missing LLM keys (server already throws helpful errors).

Phase 3 — Chrome extension integration
1. Standardize on ConvexHttpClient + `client.setAuth(authToken)` in background.
2. Popup: use Clerk to get token and save it to `chrome.storage.local` (current popup code already suggests this).
3. Background: read `authToken`, call backend generate action (POST to Convex action or use ConvexHttpClient pattern), return proposal to content script and optionally call `client.mutation(api.saveJobAndProposal, ...)`.
4. Test by building extension, loading unpacked, login via popup, visiting a job page, and generating a proposal.

Phase 4 — Profile ingestion & schema updates
1. Extend schema: add profile fields to `userProfiles` (skills, experience, education, summary).
2. Implement ingestion endpoint:
   - Option A: Use `my-app/scraping-server` to parse a LinkedIn URL server-side and call `profiles.upsert` mutation.
   - Option B: Allow extension content script to POST parsed profile to a new Convex HTTP action which upserts profile.
3. Add UI for upload/paste URL in frontend and ingestion progress UI.

Phase 5 — UX, persistence, and quality
1. Implement proposals listing / edit / re-generate (frontend).
2. Integrate scheduler for queued LLM calls (use existing scheduler.ts) and apply rate-limits.
3. Add monitoring & error reporting (Sentry, Prometheus) and follow `DEPLOYMENT_CHECKLIST.md`.
4. Add tests: unit for service & adapters, integration for action + convext, E2E for auth→generate.

Phase 6 — Clean docs & deploy
1. Consolidate docs: mark duplicates as archived, keep canonical docs:
   - `docs/proposal_doc/docs/convex_schema.md`
   - `docs/proposal_doc/docs/Convex_Clerk_implementation_plan.md`
   - `docs/proposal_doc/docs/LANGCHAIN_IMPLEMENTATION.md`
   - `docs/proposal_doc/docs/DEPLOYMENT_CHECKLIST.md`
   - `docs/proposal_doc/docs/convex-clerk-integration.md`
2. Update README and `PROJECT_ROADMAP.md` with final env and deploy steps.
3. Push Convex schema and deploy; perform post-deploy verifications.

---

## Notes / Conflicts / Blockers (concrete)
- Env mismatch: `VITE_CONVEX_URL` vs `NEXT_PUBLIC_CONVEX_URL`. Must be unified before Convex client will initialize.
- Webhook setup required for production user sync: `CLERK_WEBHOOK_SECRET` must be set in Convex Cloud and webhook URL registered in Clerk.
- LLM API keys required for generation: OPENAI/MISTRAL keys needed in Convex env for generateProposalMutation; missing keys lead to server errors.
- Extension auth flow ambiguous across docs: choose ConvexHttpClient + setAuth (recommended). Docs show both axios POST and Convex client usage — the repo contains examples of both. Update docs to a single canonical approach.
- Duplicate/outdated docs: many `proposal_doc` files are variants and can confuse implementers. I recommend consolidating to 4–6 canonical docs and archiving the rest.
- Sensitive secrets in repo sample .env: remove or rotate secrets if any real keys are present (I noticed some placeholder-looking keys in my-app/.env; ensure these are not real and rotate if necessary).

---

## Minimal actionable first two tasks (copy/paste ready)
These two tasks are the minimal required to move from Plan → Act and run the auth/profile smoke test.

Task A — Add VITE_CONVEX_URL
- Open `my-app/.env` and add (exact line):
```
VITE_CONVEX_URL=https://giddy-basilisk-88.convex.cloud
```

Task B — Add quick user creation mutation (dev-only)
- Create file `my-app/convex/createUserFromClient.ts` with this exact content:

```ts
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";

export default mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const clerkId = identity.subject;
    const email = identity.email ?? "unknown@example.com";
    const name = identity.name;
    return await ctx.runMutation(internal.users.createOrUpdateUser, {
      clerkId,
      email,
      ...(name ? { name } : {}),
    });
  },
});
```

- Then open `my-app/src/App.tsx` and add (imports and useEffect):

```ts
import { useConvex } from "convex/react";
// inside component
const convex = useConvex();

React.useEffect(() => {
  async function ensureUser() {
    try {
      await convex.mutation('createUserFromClient');
      console.log('createUserFromClient OK');
    } catch (err) {
      console.error('createUserFromClient failed', err);
    }
  }
  ensureUser();
}, [convex]);
```

- Commands to run:
```
cd my-app
npm install     # first time only
npm run dev
```

- Verification:
  - Sign in with Clerk in browser.
  - Open Convex DB console and verify `userProfiles` row was created for your clerk id/email.

---

## Acceptance criteria for Plan → Act handover
- You approve this PROJECT_ROADMAP.md and the two initial tasks A + B above.
- You will allow me to switch to Act Mode to implement those tasks and run the local dev server.
- Once A + B applied, we will proceed with Phase 2 (wire generation) and Phase 3 (extension) in small, testable increments.

---

If you approve this plan I will:
1. Switch to Act Mode,
2. Apply Task A and Task B,
3. Run `npm run dev`,
4. Perform the sign-in test and report console output, exact DB insert confirmation, and next tasks.

Approve and I will start.
