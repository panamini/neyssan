# Job Scraper Extension — Quick Test & Install Guide

This file explains how to load the extension locally, sign in with Clerk (dev), and test the generate → preview → save workflow that integrates with the Neyssan backend.

Prerequisites
- Node 18+
- Chrome (or Chromium-based browser)
- Convex dev & web app running locally (see my-app README)
- Make sure branch `feat/extension-e2e-fix` is checked out for the latest extension code

1) Start the web app + Convex backend
- Open a terminal and run:
  cd my-app
  npm install        # only first time
  npm run dev
- Wait until you see "Convex functions ready!" and Vite serving (local URL printed, e.g. http://localhost:5175).

2) Load the extension in Chrome (development)
- Open `chrome://extensions` in Chrome.
- Enable "Developer mode" (top-right).
- Click "Load unpacked".
- Select the folder: `<repo-root>/clerk-chrome-extension-final` (the folder that contains manifest/build or the source; if you have a build step, choose the `build`/`dist` folder).
- The extension will appear in the toolbar.

3) Authenticate the extension (popup)
- Click the extension icon → popup.
- Sign in using the Clerk modal (dev keys are configured for local testing).
- After sign-in, the popup stores an `authToken` in `chrome.storage.local`.
- Verify token stored:
  - Open the extension entry in `chrome://extensions` → click "Service worker" → Inspect.
  - In the console, run: `chrome.storage.local.get('authToken', console.log)`.
  - You should see `{ authToken: "<JWT>" }`.

4) Test generate → preview → save (on a job page)
- Open a supported job page (Upwork, LinkedIn, Indeed, Fiverr).
- The Proposal Preview UI should be injected (bottom-right).
- Click "Generate".
  - The UI shows a spinner while generating.
  - Background logs (service worker) will show:
    - "Message received: { action: 'generateProposal' }"
    - "Token before action: <jwt>"
    - "Calling function generateProposal via action"
    - "Action result: { proposalContent, proposalId }"
- After generation:
  - Proposal textarea is populated.
  - Copy & PDF buttons are enabled.
- Click "Save".
  - Background logs show "Calling mutation: saveJobAndProposal" and "Proposal saved successfully".
- Confirm proposal persisted:
  - Open Convex Dashboard for your project (or check Convex dev DB) and inspect the `proposals` table for a new row.

5) Test web app flow (web UI)
- In the web app (http://localhost:5175/):
  - Sign in via Clerk.
  - Use the Proposal form to paste a job description and click the submit/generate button.
  - The web app uses the same backend `generateProposal` action; proposal should appear in the UI.
  - Save from the web UI (if supported) and check DB.

Troubleshooting
- If `authToken` is missing:
  - Re-open popup and sign in.
  - Check console for errors in the popup or service worker.
- If the generate call returns an error:
  - Open Convex dev terminal where `npm run dev` is running and look for server stack traces.
  - Ensure OPENAI_API_KEY / MISTRAL_API_KEY (if required) are available in your runtime (local `.env` or Convex Cloud env).
- If Copy/PDF buttons show before generation:
  - Update extension code: Copy/PDF are now conditional and appear only after generation in this branch.

Notes for reviewers
- Branch: `feat/extension-e2e-fix`
- Key files:
  - clerk-chrome-extension-final/src/background/index.ts
  - clerk-chrome-extension-final/src/contents/content.tsx
  - my-app/convex/generateProposalMutation.ts
  - my-app/convex/createUserFromClient.ts (dev helper)
- When ready to produce a production release:
  - Build the extension with your usual pipeline and upload the packaged extension to the Chrome Web Store (or distribute as CRX).
  - Ensure production Convex URL and Clerk settings are used (move dev keys out of repo before deploying).

If you want, I can:
- Add the same testing instructions to the main README or append a Quick Start section.
- Create a short checklist for reviewers to follow when approving the PR.
