# Verbati Style Persistence Audit

Date: 2026-04-16

## Active code

- Frontend style persistence writes `metadata.verbatiStyle` in:
  - `my-app/src/features/verbati/useBoundVerbatiCvStyle.ts`
  - `my-app/src/features/verbati/VerbatiCvPreviewPanel.tsx`
  - `my-app/src/features/verbati/VerbatiStyleWorkspace.tsx`
- Frontend CV schema and normalization already allow and preserve `metadata.verbatiStyle`:
  - `my-app/src/schemas/cvDocument.schema.ts`
  - `my-app/src/lib/normalize-cv.ts`
- The active save path forwards that metadata into Convex:
  - `my-app/src/contexts/CvLibraryContext.tsx`
  - `my-app/src/adapters/StorageAdapter.ts`
  - `my-app/convex/profiles.ts` via `profiles.patch`

## Exact failure point

- The concrete runtime rejector was `userProfiles.metadata` in `my-app/convex/schema.ts`.
- That validator allowed:
  - `source`
  - `importedAt`
  - `confidence`
  - `filename`
- It did not allow:
  - `verbatiStyle`

## Additional drift found

- `my-app/convex/profilesPublic.ts` used a narrower `metadata` validator on read/public return.
- `my-app/convex/profiles.ts` legacy `profile.metadata` validator was narrower than the stored table schema.
- `my-app/convex/users.ts` `updateUserProfile.profileData.metadata` validator was also narrower.
- Older rows reconstructed through `my-app/src/adapters/profile-mapper.ts` could lose `metadata.verbatiStyle` when no embedded `cvDocument` snapshot was present.

## Fix direction implemented

- Added a shared precise Convex metadata validator for `userProfiles.metadata`.
- Added canonical-on-write helpers for:
  - legacy layout aliases
  - legacy typography aliases
- Allowed legacy aliases on read-compatible validator surfaces.
- Preserved strict validation for invalid layout/palette/typography/accentHex shapes.
- Updated the frontend fallback mapper to preserve and canonicalize `metadata.verbatiStyle` on read-back.

## Notes

- Canonical ids remain the write shape.
- Legacy aliases are accepted for compatibility and normalized on the next write.
- No UI workaround, fallback renderer, or duplicate persistence path was introduced.
