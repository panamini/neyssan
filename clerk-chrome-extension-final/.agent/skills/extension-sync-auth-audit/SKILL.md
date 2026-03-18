---
name: extension-sync-auth-audit
description: Use for Neyssan Chrome extension issues involving Clerk Sync Host auth, popup/background/content-script auth drift, session recovery, sign-in/sign-out propagation, local app handoff URL problems, and scraper regressions on Upwork/Indeed/LinkedIn/Fiverr. Do not use for broad redesigns.
---

## Purpose

Stabilize the Neyssan Chrome extension without redesigning the auth architecture.

This skill exists to stop patch drift and force Codex to debug the extension and web app in a disciplined way when issues involve:

- Clerk Sync Host auth
- popup vs background vs content-script auth inconsistency
- sign-in or sign-out propagation
- usable Convex token vs visual signed-in UI mismatch
- wrong local app URL / handoff URL
- scraping regressions on Upwork, Indeed, LinkedIn, and Fiverr
- small UX fixes tightly related to those flows

## Repositories

Work across both repos when needed:

- Extension repo:
  `/Volumes/video/kay/app/pouraurelien/neyssan/clerk-chrome-extension-final`
- Main app repo:
  `/Volumes/video/kay/app/pouraurelien/neyssan/my-app`

Do not assume the bug is only in one repo. Audit both if the flow crosses extension + web app.

## Non-goals

Do NOT:
- redesign auth architecture
- replace Clerk
- introduce a second auth flow
- add broad new features unless explicitly requested
- refactor unrelated UI
- “improve everything”
- change production deployment architecture unless explicitly requested

Keep scope tight and surgical.

## Source of truth rules

Treat these as hard rules:

1. Extension auth source of truth is **usable stored extension auth**, not optimistic popup-local visual state.
2. A user is only “signed in” if extension actions can actually use a valid auth token.
3. Popup, background, and content script must agree on auth state.
4. Sign-out must be reflected in UI and in action behavior.
5. Sign-in must not require unnecessary manual refresh steps if a small safe fix can remove them.
6. Sync Host must use one exact shared web-app origin. Never mix `localhost` and `127.0.0.1`.
7. Do not trust generated build folders as evidence until you verify which one is actually being loaded.
8. Prefer fixing source files, then rebuilding, then validating the actual loaded unpacked extension.

## Clerk-specific guidance

This project uses Clerk Chrome extension Sync Host behavior, not a separate embedded popup auth system.

Therefore:
- prefer web-app sign-in handoff over embedded popup auth UI
- remove auth remnants that conflict with Sync Host if they still appear
- treat session recovery as a shared-origin problem first
- if sign-out is inconsistent, inspect both storage clearing and Clerk session sync behavior
- do not assume popup-local Clerk hydration equals extension-auth readiness

When debugging auth:
- inspect popup auth UI
- inspect background sync/checkSession path
- inspect storage writes/removals for:
  - `authToken`
  - `userName`
  - `userEmail`
  - any cooldown/signed-out markers
- inspect content-script token reads and storage listeners
- inspect app sign-in route and shared host/origin assumptions

## Handoff URL guidance

When `Open in Proposal Forge` or web-app sign-in opens the wrong URL:

1. Find the real source of truth for app base URL.
2. Check env files actually used by the active extension build.
3. Check shared URL helper code before changing multiple files.
4. Prefer one normalized helper imported in all relevant places.
5. Keep local-dev behavior modular:
   - local value comes from env
   - production/server value also comes from env
6. Do not hardcode temporary ports in multiple files.

If local ports move often, prefer explaining and preserving the env-based design rather than inventing unreliable auto-detection.

## Scraper guidance

For Upwork, Indeed, LinkedIn, and Fiverr:

1. Prefer tight, platform-specific selectors.
2. Avoid broad fallbacks like:
   - `document.querySelector("p, div")`
   - giant container `.textContent`
3. Reject shell text aggressively:
   - nav text
   - footer/legal text
   - notification counters
   - bootstrap JSON
   - CSS blobs
   - category menus
   - “recommended” sidebars
4. On SPA-heavy sites like LinkedIn and Fiverr:
   - account for delayed render
   - account for in-page URL changes
   - use bounded retries or a short-lived observer if necessary
5. A weaker but clean partial description is better than a huge garbage scrape.
6. If a previous version scraped better on one site, compare before replacing the logic.

## Generate / profile / CV audit guidance

When asked whether extension `Generate` is CV-aware:

- inspect the actual request payload sent from extension background
- inspect whether `cvId`, selected CV, or `personalizationContext` is sent
- inspect the Proposal Forge path separately
- do not claim CV-awareness unless the payload proves it
- if the extension path is generic/fallback-profile-based, say so plainly

When asked about `Save profile`:

- inspect extraction fields in the content script
- inspect the background ingest path
- inspect storage/mutation target in the app backend
- distinguish clearly between:
  - saved profile fallback personalization
  - selected CV personalization
- do not conflate them

## Build discipline

Before concluding anything about runtime behavior:

1. Identify the canonical local build command.
2. Identify the exact unpacked extension folder to load.
3. Remove ambiguity between `dev`, `dev-dev`, `dev-prod`, or other generated folders.
4. Rebuild.
5. Verify the actual loaded output contains the intended change.
6. State explicitly which folder must be loaded in Chrome.

If build-folder sprawl reappears, prefer cleaning/normalizing scripts rather than debugging the wrong artifact.

## Working style

When using this skill:

1. Audit first.
2. Change the minimum number of files.
3. Preserve working fixes from earlier passes.
4. Do not re-open previously solved architecture debates unless the current bug truly requires it.
5. If a regression comes from a recent patch, prefer a targeted rollback of that patch rather than inventing a larger new mechanism.
6. If behavior is visually inconsistent, separate:
   - actual auth/action state
   - visual popup state
   - content-panel state
7. Always explain root cause in concrete code terms, not vague guesses.

## Expected output format

When asked to do a fix pass, return exactly:

1. root cause
2. files changed
3. concise implementation summary
4. visible behavior change in 4-8 bullets
5. manual verification steps

If no safe fix exists yet, say what was proven and what remains blocked.

## Trigger phrases

This skill should trigger when requests mention things like:

- Clerk Sync Host
- popup says signed in but actions fail
- signed out visually but actually still signed in
- sign-in works on web app but not in extension
- sign-out does not propagate
- Open in Proposal Forge opens wrong URL
- scraper broken on Upwork / Indeed / LinkedIn / Fiverr
- save profile meaning / CV awareness audit
- dev / dev-dev / dev-prod build confusion

This skill should NOT trigger for:
- general React styling
- unrelated backend work
- broad product ideation
- non-extension features