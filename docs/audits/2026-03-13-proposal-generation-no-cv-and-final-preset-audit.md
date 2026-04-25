# Proposal Generation No-CV And Final Preset Audit

Date: 2026-03-13

Scope:

- Active Proposal Forge generation path only
- No auth redesign
- No scraping redesign
- No CV architecture redesign
- No extension behavior changes unless required by the no-CV bug

Classification:

- Active code:
  - `src/components/ProposalInputForm.tsx`
  - `src/components/ProposalsList.tsx`
  - `src/lib/proposal-personalization.ts`
  - `convex/generateProposalMutation.ts`
  - `convex/lib/proposals/voicePresets.ts`
- Legacy but informative code:
  - `convex/http.ts` test route
- Obsolete/dead code:
  - `*.bak`
  - backup component trees

## No-CV bug root cause

The app Proposal Forge path does not send `personalizationMode: "explicit_only"` when it calls `generateProposal`.

Because of that, when the user has no active local CV context, the backend falls back to `buildFallbackPersonalizationContext(userProfile)` inside `generateProposalMutation.ts`.

That means blank-CV generation is not actually blank. It can silently pull stale persisted profile data, including an old profile name such as `f`.

Important contrast:

- Extension path already sends `personalizationMode: "explicit_only"`.
- App path does not.

So the frontend and backend defaults are currently misaligned across app vs extension.

## Stale-state audit result

### Active profile / candidate context resolution

Proposal Forge currently resolves local candidate context through:

- `getActiveLocalPersonalizationSource()` in `src/lib/proposal-personalization.ts`

If that local source is empty, `ProposalInputForm` currently omits personalization fields entirely.
That omission is what allows backend profile fallback to take over.

### Saved proposal / regenerate leakage

Regenerate does not appear to leak prior proposal content into new generation.
It reuses:

- saved job description
- stored proposal metadata
- current local personalization source when present

However, regenerate has the same no-CV fallback problem as compose if no active local CV exists and the app omits personalization mode.

### Shared active snapshot

The app maintains `activeCvSnapshots`, but Proposal Forge generation does not currently depend on it.
Still, if the app has no active local CV, clearing the shared snapshot is a useful consistency correction because the app is the source of truth for CV context.

## Preset audit result

The preset architecture remains correct.

Remaining quality gap is behavioral:

- `signature` remains the healthiest baseline
- `expert` is acceptable and mostly stable
- `direct` still needs faster entry and less ceremonial language
- `engaging` still needs less stock cover-letter phrasing
- `storyteller` still needs a clearer past -> present -> target-role through-line

## Smallest safe implementation

1. On app-owned compose and regenerate paths, always send `personalizationMode: "explicit_only"`.
2. Preserve explicit local personalization context and richness when present.
3. When the app has no active local CV, clear the shared active CV snapshot to `null` from Proposal Forge so backend shared state does not remain stale.
4. Do one final compact backend prompt tuning pass for `direct`, `engaging`, and `storyteller`.
5. Preserve source-backed specificity and existing unsupported-claims guardrails.
