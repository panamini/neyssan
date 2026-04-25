# Tone Resolver And CV Priority Verification

Date: 2026-03-12

## Scope

- Verify the active backend tone resolver behavior.
- Audit current CV priority across CV Forge, Proposal Forge, and the extension.
- Do not propose broader tone or CV architecture changes.

## Active Code Verified

### Tone Resolver

- `convex/lib/proposals/effectiveTone.ts`
  - Signature baseline is `neutral` + `medium`.
  - Legacy `creativity: "standard"` is normalized to `medium`.
  - Invalid or missing tone values fall back to the Signature baseline.
- `convex/generateProposalMutation.ts`
  - `formalityLevel` and `creativity` are optional at the active generation boundary.
  - The backend resolves effective tone before prompt construction.
  - Explicit valid tone values are still forwarded into the prompt/model paths.
- `convex/lib/proposals/__tests__/effectiveTone.test.ts`
  - Local test run passed on 2026-03-12.

### CV Priority

- `src/contexts/CvLibraryContext.tsx`
  - CV Forge owns the global in-app active CV (`currentCv`).
  - That active CV is synced to Convex through `activeCvSnapshots.setCurrent`.
  - The same context also mirrors the active CV id into local storage key `cvActiveId`.
- `src/lib/proposal-personalization.ts`
  - Proposal Forge reads CV context from local storage key `cvActiveId`.
  - Proposal Forge changes the selected CV by writing only to local storage.
- `src/components/ProposalInputForm.tsx`
  - "Change CV" uses the proposal-personalization local selector, not `CvLibraryContext`.
  - Proposal submission uses proposal-local personalization built from that local selector.
- `src/background/index.ts`
  - The extension fetches CV context from Convex `activeCvSnapshots.getCurrent`.
  - Extension generation uses that backend snapshot when `useCurrentCvContext` is enabled.

## Conclusions

### Tone Resolver

- Verified correct for the requested minimal behavior.
- Omitted tone fields resolve to Signature (`neutral`, `medium`).
- Legacy `creativity: "standard"` resolves safely to `medium`.
- Explicit valid Proposal Forge values remain respected in code.

### CV Priority

- Current user-facing rule is not coherent.
- CV Forge and the extension share the backend `activeCvSnapshots` source of truth.
- Proposal Forge "Change CV" does not update that backend source of truth.
- Proposal Forge currently changes proposal-local context, not the common active CV seen by the extension.

## Smallest Safe Next Fix

- Keep the tone work unchanged.
- Make Proposal Forge "Change CV" also update the same active CV source used by CV Forge and the extension.
- The smallest safe path is to route Proposal Forge CV selection through the shared active-CV setter that ultimately updates `activeCvSnapshots.setCurrent`, instead of only writing `cvActiveId` locally.
