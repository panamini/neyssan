# Extension No-CV Premium Alignment Fix

Date: 2026-03-16

## Scope

- Chrome extension only
- no-CV `cover_letter` direct generation
- premium ChatGPT alignment

## Findings

- The premium no-CV backend path was already correct.
- The smallest truthful extension-side fix was to change direct no-CV `cover_letter` generation so that it explicitly defaults to `chatgpt` unless an explicit model was already requested.
- I did not change the Proposal Forge handoff shape in this pass because that would be a broader state-preservation change. The direct-generate path was the narrowest path that maps the visible no-CV option to actual premium behavior.

## Implementation

- Added a tiny pure helper in `clerk-chrome-extension-final/src/background/generateModelType.ts`.
- The helper returns:
  - `chatgpt` for direct no-CV `cover_letter`
  - the explicitly requested model when present
  - `mistral-small-latest` otherwise
- Updated the extension background `generateProposalHandler(...)` to use that helper when building the request sent to Convex.

## Validation

- Verified the helper logic with a direct `tsx` assertion run:
  - no-CV `cover_letter` -> `chatgpt`
  - CV-backed `cover_letter` -> `mistral-small-latest`
  - explicit model override stays respected
  - other formats remain unchanged
- Attempted a full extension TypeScript compile, but it is currently blocked by a pre-existing unrelated error in `src/background/index.ts`:
  - `background` is not a known property on the current `CreateClerkClientOptions` type

## Recommendation

- Keep this change.
- If a later pass is needed, the next narrow step should be handoff-state preservation for no-CV intent. That was intentionally left out here to keep the fix small and direct.
