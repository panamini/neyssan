# Job Scraper Extension — Quick Test & Install Guide

This file explains the canonical local Chrome workflow for the extension, the sync-host sign-in flow, and the generate → Proposal Forge handoff path.

Prerequisites
- Node 18+
- Chrome (or Chromium-based browser)
- Convex dev & web app running locally (see my-app README)

1) Start the web app + Convex backend
- Open a terminal and run:
  cd my-app
  npm install        # only first time
  npm run dev
- Wait until you see Convex ready and Vite serving the local app at `http://localhost:5173`.

2) Build the canonical local Chrome dev extension
- Open a second terminal and run:
  cd clerk-chrome-extension-final
  npm install        # only first time
  npm run build:local
- This is the only local build folder you should load in Chrome:
  - `build/chrome-mv3-dev`
- The canonical build script prunes any non-canonical build folders after the build completes.
- Do not load legacy folders such as:
  - `build/chrome-mv3-dev-dev`
  - `build/chrome-mv3-dev-prod`
- Do not load the source repo root directly.

3) Load the extension in Chrome
- Open `chrome://extensions` in Chrome.
- Enable "Developer mode" (top-right).
- Click "Load unpacked".
- Select the folder: `<repo-root>/clerk-chrome-extension-final/build/chrome-mv3-dev`
- The extension will appear in the toolbar.

4) Authenticate the extension (popup)
- Click the extension icon → popup.
- Click `Sign in`, then `Open web app sign-in`.
- The extension should open the app’s direct sign-in route:
  - `http://localhost:5173/sign-in`
- Complete sign-in in the web app.
- Re-open or refresh the popup so it picks up the synced Clerk session.
- After sign-in, the popup stores an `authToken` in `chrome.storage.local`.
- Verify token stored:
  - Open the extension entry in `chrome://extensions` → click "Service worker" → Inspect.
  - In the console, run: `chrome.storage.local.get('authToken', console.log)`.
  - You should see `{ authToken: "<JWT>" }`.

5) Test generate → preview → save / handoff (on a job page)
- Open a supported job page (Upwork, LinkedIn, Indeed, or Fiverr).
- The Proposal Preview UI should be injected (bottom-right).
- Click "Generate".
- After generation, the proposal textarea should populate.
- Click `Open in Proposal Forge`.
  - The opened URL should start with:
    - `http://localhost:5173/proposal?handoffId=...`
- Proposal Forge is the CV-aware path. The inline extension `Generate` path is not CV-aware.

6) Scraper sanity checks
- Upwork should scrape the real job description rather than the outer page shell.
- Indeed should prefer `jobDescriptionText` / job component description containers.
- LinkedIn should prefer `jobs-description__content` / `jobs-box__html-content` and avoid notification/nav text.

Troubleshooting
- If `authToken` is missing:
  - Re-open popup and complete the web-app sign-in flow again.
  - Confirm the app sign-in was completed at `http://localhost:5173/sign-in`.
- If the generate call returns an error:
  - Open Convex dev terminal where `npm run dev` is running and look for server stack traces.
  - Ensure OPENAI_API_KEY / MISTRAL_API_KEY (if required) are available in your runtime (local `.env` or Convex Cloud env).
- If the wrong extension folder is loaded:
  - Remove the unpacked extension and reload only `build/chrome-mv3-dev`.
