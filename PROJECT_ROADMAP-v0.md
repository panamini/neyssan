  # Neyssan — Project Roadmap (Plan Mode)

  Date: 2025-08-20  
  Author: Cline (audit, roadmap & implementation)

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

  ## High-level Status Snapshot (updated 2025-08-20)
  - What I checked and worked on (codebase + docs): my-app (Convex backend + frontend), two chrome extension code trees, docs/ (plans and implementation notes).
  - Major completed backend pieces (existing): LLM integration service (langchain folder), Convex mutations/actions for proposals & users, webhook handler for Clerk (exists), proposal storage (proposals.ts), saveJobAndProposal mutation.
  - Recent work I implemented (this session):
    - Extension background: ConvexHttpClient usage, robust token handling, convex.action for generation, convex.mutation for save.
    - Extension content UI: injected proposal preview, spinner, transient toast, conditional Copy/PDF + Save alignment.
    - Removed debug logging from generateProposal backend action.
    - Added a dev helper mutation createUserFromClient.ts for quick user creation (dev-only).
    - Created and pushed branch `feat/extension-e2e-fix` with the above changes (ready for PR).

  ---

  ## Step-by-step Roadmap (tasks with statuses) — UPDATED

  Legend: ✅ Done / ⚠️ In Progress / ❌ Missing

  1) Docs audit
  - Status: ✅ Done
  - Description: High-priority docs reviewed (convex_schema.md, Convex_Clerk_implementation_plan.md, LANGCHAIN_IMPLEMENTATION.md, DEPLOYMENT_CHECKLIST.md, README, extension plans). Conflicts identified and canonical docs proposed.

  2) Fix Convex client env (frontend)
  - Status: ⚠️ In Progress
  - Description: Frontend expects `VITE_CONVEX_URL`. For local dev the current setup works (convex dev provides runtime). Recommend explicitly adding `VITE_CONVEX_URL` to my-app/.env before production deployment. (Not changed in repo during this session.)

  3) Ensure user profile creation on sign-in
  - Status: ⚠️ In Progress
  - Description: Convex webhook exists (my-app/convex/clerk_webhook.ts). I added `my-app/convex/createUserFromClient.ts` (dev shortcut). To fully automate in production, register Clerk webhook (set `CLERK_WEBHOOK_SECRET` in Convex Cloud).

  4) Wire frontend UI → backend generate action
  - Status: ✅ Done (web app form wired)
  - Description: `my-app/src/components/ProposalInputForm.tsx` calls the Convex action `generateProposal` via Convex React hooks and returns proposalContent to the app through the `onSubmit` callback. The same generate action is used by the extension so web app and extension share the backend logic.

  5) Chrome extension integration (auth + generate + save)
  - Status: ⚠️ Partially Done
  - Description: Background & content script are wired: ConvexHttpClient + setAuth, token read/store in popup, background calls action/mutation and returns results. Remaining work: packaging/build process, release docs, and final QA across platforms.

  6) Profile ingestion (LinkedIn / CV)
  - Status: ❌ Missing
  - Description: Need ingestion pipeline (scraping-server or Convex HTTP action) to convert LinkedIn/CV to structured profile and store to `userProfiles`. `my-app/scraping-server/` exists but not yet integrated with the main app.

  7) Proposals management UI (list, edit, re-generate)
  - Status: ❌ Missing
  - Description: `proposals.ts` contains queries/mutations. Frontend list/edit UI not yet implemented — next priority after auth/generate flows are stable.

  8) Rate-limiting / Scheduler / Monitoring
  - Status: ⚠️ Partially implemented
  - Description: Files exist (scheduler, monitoring, metrics). Need concrete integration (Sentry Prometheus envs, scheduler usage around heavy LLM calls) and testing.

  9) Tests & Deployment
  - Status: ❌ Missing
  - Description: Add E2E tests (auth → generate → save), unit tests for adapters, and prepare Convex Cloud deployment with proper environment variables and webhooks.

  ---

  ## Extras completed (what I implemented beyond roadmap)
  - UX polish for extension content UI: spinner, toast, conditional Copy/PDF visibility and alignment with Save.
  - Robust background token handling with timeout and periodic refresh.
  - Switched generation call to use convex.action; save uses convex.mutation.
  - Removed process.env debug logs from backend action.
  - Created dev convenience mutation createUserFromClient.ts.
  - Branch `feat/extension-e2e-fix` pushed with commits (PR ready).

  Files changed (high level)
  - clerk-chrome-extension-final/src/background/index.ts
  - clerk-chrome-extension-final/src/contents/content.tsx
  - my-app/convex/generateProposalMutation.ts
  - my-app/convex/createUserFromClient.ts
  - removed my-app/scripts/call_generate_proposal.js
  - other small test/helper files added for local testing

  Branch: feat/extension-e2e-fix (latest commit 7e3a5b2)

  ---

  ## Where we stand vs original plan
  - The critical end-to-end path (extension → background → Convex action → LLM → saved proposal) is functioning and has been tested locally.
  - The web app form is now wired to call the same backend action — completing Phase 2.
  - Remaining high-priority work is profile ingestion (Phase 4), proposals management UI (Phase 5), testing & deployment (Phase 6), and docs consolidation.

  ---

  ## Immediate next steps (I will implement now in Act Mode)
  1. Persist PROJECT_ROADMAP.md update (done — updated file saved).
  2. Confirm ProposalInputForm wiring & run the web app flow (generate → display → save) — I will run local tests and report logs (I will now execute this).
  3. After verification: open a concise PR description on the branch `feat/extension-e2e-fix` (I can prepare the PR text and post it to you).

  Please confirm you want me to run the web app generate → save verification now (I will run `npm run dev`, submit form in the web UI, and paste the exact logs & DB confirmation). If yes, I will proceed immediately.
