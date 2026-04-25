# Proposal Forge Handoff Auth Readiness

Date: 2026-03-12

## Decision

- Keep the extension handoff write flow unchanged.
- Fix only the app-side handoff read path.
- Proposal Forge must treat extension handoff loading as auth-dependent and retryable.
- A missing handoff should only be considered final after app auth has settled.

## Reason

- The extension already waits for auth, writes the handoff record, and opens `/proposal?handoffId=...`.
- Proposal Forge previously performed a one-shot handoff fetch on mount.
- That fetch could run before Clerk/Convex auth was ready, receive `null`, and permanently drop the handoff until refresh.

## Scope Kept Intentionally Unchanged

- No extension background changes
- No auth redesign
- No scraping changes
- No Proposal Forge route or workspace redesign
- No CV, tone, or generation-flow changes
