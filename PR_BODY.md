# feat/extension-e2e-fix — Extension E2E integration & UX polish

Status update
-------------
Completed requested cleanup: fixed TypeScript/ESLint issues, stabilized hooks, started local dev server and verified smoke tests. Changes were pushed to branch `feat/profile-ingest-mvp` (commit ab9d400 + follow-ups). The branch is ready for PR review.

PR details to open:
- Title: chore: fix TypeScript & ESLint errors for profile-ingest MVP
- Body: See PR_BODY.md for summary (includes changes, test plan, notes)
- Compare URL: https://github.com/panamini/neyssan/compare/main...feat/profile-ingest-mvp
- Command to open PR (if you have gh): gh pr create --title "chore: fix TypeScript & ESLint errors for profile-ingest MVP" --body-file PR_BODY.md --base main --head feat/profile-ingest-mvp


Summary
-------
This PR wires the Chrome extension → backend → LLM → storage end-to-end and polishes the extension UI. It also removes sensitive debug logging from the backend action and includes a small convenience mutation for dev user creation.

What I changed
---------------
- Extension background:
  - clerk-chrome-extension-final/src/background/index.ts
    - Use ConvexHttpClient pointed to the project cloud (dev host).
    - Robust token handling: read from chrome.storage, refresh with timeout, periodic refresh.
    - Prefer public Convex mutation (profilesPublic) to ingest profiles; fallback to HTTP route /api/http/profiles/ingest.
    - Use convex.action(api.functions.generateProposal, ...) for generation.
    - Use convex.mutation(api.saveJobAndProposal.default, ...) for saving proposals.
    - Safer logging (no env secret dumps).
- Extension content UI:
  - clerk-chrome-extension-final/src/contents/content.tsx
    - Injected Proposal Preview UI (Generate / Save / Copy / PDF).
    - UX polish: spinner, transient toast notifications.
    - Copy/PDF buttons appear only after a proposal is generated and are aligned with Save.
- Backend:
  - my-app/convex/generateProposalMutation.ts
    - Removed process.env debug logging.
    - Tolerant parsing and fallback preserved.
  - my-app/convex/createUserFromClient.ts
    - Dev helper mutation to create/update userProfiles from the authenticated client identity (for local dev).
  - my-app/convex/profilesPublic.ts
    - Public mutation used by the extension to ingest structured profile payloads.
  - my-app/convex/http.ts
    - HTTP actions added (POST /test/generate and POST /profiles/ingest) as testing/fallback endpoints.
  - my-app/convex/test_generate_http.ts
    - HTTP test endpoint to call the generate action for quick testing.
- Frontend:
  - my-app/src/components/ProposalInputForm.tsx
    - Calls generateProposal action and then saves a draft via saveJobAndProposal mutation.
    - Added loading state and error handling.
- Cleanup:
  - Removed my-app/scripts/call_generate_proposal.js (test artifact).
- Docs:
  - PROJECT_ROADMAP.md updated to reflect current status and next steps.

Files changed (high level)
--------------------------
See branch `feat/extension-e2e-fix` for full diff. Key files:
- clerk-chrome-extension-final/src/background/index.ts
- clerk-chrome-extension-final/src/contents/content.tsx
- my-app/convex/generateProposalMutation.ts
- my-app/convex/createUserFromClient.ts
- my-app/convex/profilesPublic.ts
- my-app/convex/http.ts
- my-app/convex/test_generate_http.ts
- my-app/src/components/ProposalInputForm.tsx
- PROJECT_ROADMAP.md
- Removed: my-app/scripts/call_generate_proposal.js

Why
---
- Provide a working E2E flow so extension users can generate proposals, preview, copy/export, and save them to the app.
- Align extension and web app to use the same backend action for consistent behavior.
- Improve UX and robustness of the extension (token handling, timeouts, spinner/toast feedback).

Manual testing steps (what I ran and recommend reviewers run)
-------------------------------------------------------------
1. Start dev (convex + frontend):
   cd my-app
   npm install
   npm run dev

2. Load extension (development):
   - chrome://extensions → Developer mode → Load unpacked → select `clerk-chrome-extension-final` (or its built `dist` folder)
   - Open extension popup → Sign in (Clerk dev keys in repo; use test account)

3. Extension E2E:
   - Visit a supported job page (Upwork, LinkedIn, Indeed, Fiverr)
   - Proposal preview should inject in the page bottom-right
   - Click "Generate" → spinner appears → background logs show:
     - "Message received: { action: 'generateProposal' }" and token/convex call logs
     - "Action result: { proposalContent, proposalId }"
   - After generation, Copy & PDF buttons are enabled.
   - Click "Save" → background logs show:
     - "Calling mutation: saveJobAndProposal"
     - "Proposal saved successfully"
   - Verify proposal appears in Convex DB (Dashboard) under `proposals`.

4. Web app E2E:
   - Open the web app (http://localhost:5176), sign in with Clerk.
   - Fill the ProposalInputForm and submit (Generate).
   - The form calls the same backend action and returns proposalContent; ProposalDisplay shows it.
   - The generated proposal is saved as a draft (saveJobAndProposal) and appears in the DB.

Security & cleanup notes
-------------------------
- Do NOT keep production API keys in repo .env. Set OPENAI_API_KEY / MISTRAL_API_KEY in Convex Cloud for production.
- Do NOT log process.env in production (removed those logs).
- Consider rotating keys if they were ever accidentally committed.

PR checklist (for reviewer)
---------------------------
- [ ] Code compiles locally and Convex dev starts without errors
- [ ] Extension background handles tokens and the generate/save flow
- [ ] Content UI UX works on supported job pages
- [ ] Backend action generateProposal returns valid proposal and stores it
- [ ] No sensitive logs or secrets are present in changed files
- [ ] Update docs or README with extension install + test instructions (optional follow-up)

Next steps after merge (recommended)
-----------------------------------
1. Consolidate docs in docs/proposal_doc/ — archive duplicates and mark canonical files.
2. Add profile ingestion pipeline (scraping-server or Convex HTTP action) for robust LinkedIn/CV parsing.
3. Implement proposals list/edit UI in web app (next immediate feature).
4. Add tests (unit for LangChain adapters; E2E for auth→generate→save).
5. Prepare production deployment: set Convex Cloud env vars and Clerk webhook secret.

---

If you want, I can now create the PR on GitHub for branch `feat/extension-e2e-fix` with this body. Confirm and I will run the GitHub CLI to open the PR.
