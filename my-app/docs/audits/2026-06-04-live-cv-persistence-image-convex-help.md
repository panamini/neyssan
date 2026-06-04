# Live CV Persistence / Image Issue For Convex Help

Date: 2026-06-04  
Branch: `codex/cv-forge-live-boundary-debug`  
Latest commits:

- `37da7287 fix(cv): defer route hydration until Convex auth settles`
- `fef463df fix(cv): preserve autosaved CV hydration state`

## Current user-visible repro

1. Hard reload `/cv?id=<profileId>`.
2. Edit text in an Experience field.
3. Typing becomes very slow.
4. Refresh the page.
5. The edited text is not persisted.
6. Upload/add a document image.
7. The image does not appear after the page reloads.

## Confirmed deployment checks

Deployment used: `prod:neat-starfish-33`.

Commands run:

```bash
rtk env CONVEX_DEPLOYMENT=prod:neat-starfish-33 ./node_modules/.bin/convex data profiles --limit 3 --format jsonArray
rtk env CONVEX_DEPLOYMENT=prod:neat-starfish-33 ./node_modules/.bin/convex data userProfiles --limit 10 --format jsonLines
rtk env CONVEX_DEPLOYMENT=prod:neat-starfish-33 ./node_modules/.bin/convex data _storage --limit 5 --format jsonArray
```

Results:

- `profiles` is empty.
- `userProfiles` contains CV documents and is the active persistence table for this flow.
- `_storage` is empty.
- In the first 10 `userProfiles` rows, no `documentDecoration`, `assetId`, `resolvedUrl`, or `assetMissing` field was found.

This means the currently visible image failure is not just "URL resolution failed". For the sampled rows, there is no stored file and no stored metadata reference to resolve.

## Active client/server path

Text persistence path:

- Client state owner: `src/contexts/CvLibraryContext.tsx`
- Save adapter: `src/adapters/StorageAdapter.ts`
- Remote mutation: `convex/profiles.ts` -> `profiles.patch`
- Active table: `userProfiles`
- Remote read: `convex/profilesPublic.ts` -> `profilesPublic.getByProfileId`

Image persistence path:

- Upload URL mutation: `convex/documentAssets.ts` -> `documentAssets.generateUploadUrl`
- Browser upload: `src/pages/CvForge.tsx` -> `uploadDocumentDecorationAsset`
- Metadata write: `src/pages/CvForge.tsx` -> `saveCurrentCvStyleOnly(..., { documentDecoration })`
- Metadata-only mutation: `src/contexts/CvLibraryContext.tsx` -> `adapter.saveMetadataPatch`
- Runtime URL projection: `convex/profilesPublic.ts` -> `ctx.storage.getUrl(assetId)` and `metadata.documentDecoration.resolvedUrl`

## Already fixed locally on this branch

Two client-side guard fixes are already pushed:

1. `updateCurrentCv({ sections })` now treats section patches as real `CvDocument` updates instead of legacy `cvState`.
2. `/cv?id=...` hydration now waits for Convex auth. A first unauthenticated `getByProfileId = null` should no longer clear the active CV before the authenticated query returns.

Verification already passed:

```bash
rtk npx vitest run src/contexts/__tests__/CvLibraryContext.test.tsx
rtk npx vitest run src/adapters/__tests__/StorageAdapter.test.ts
rtk npx tsc --noEmit
```

## What still needs Convex-side/live-boundary diagnosis

The live repro still shows no durable write after refresh. The highest-signal questions for Convex Help are:

1. For `profiles.patch`, do recent executions show `Not authenticated`, `Not authorized to access this profile`, `Value is too large`, or successful writes?
2. Does `profiles.patch` write to `userProfiles` for the exact `profileId` opened in `/cv?id=...`?
3. When the text edit is made, does the mutation payload include `patch.cvDocument.sections[*].structuredContent`, or only metadata/style fields?
4. Does `documentAssets.generateUploadUrl` execute successfully when the image is selected?
5. After the upload POST, does Convex File Storage create a row in `_storage`? Current check shows `_storage` is empty.
6. After image upload, does `profiles.patch` receive `patch.metadata.documentDecoration.assetId`?
7. If the mutation succeeds, does `profilesPublic.getByProfileId` return `metadata.documentDecoration.assetId` and a `resolvedUrl`?

## Current working hypothesis

This is probably two related live-boundary failures:

- Text edits are not reaching `profiles.patch`, or they are reaching it with a weak/stale payload that does not include the edited `cvDocument`.
- Image upload is not producing a durable Convex File Storage object, or the later metadata-only patch is not writing `documentDecoration.assetId` to `userProfiles`.

The main invariant needed is:

`A meaningful local cvDocument edit must be written to userProfiles before any style/image metadata patch can make the remote profile look newer.`

For images:

`Upload must create a _storage object, then profiles.patch must persist metadata.documentDecoration.assetId, then profilesPublic.getByProfileId must project resolvedUrl via ctx.storage.getUrl(assetId).`

## Suggested Convex dashboard filters

Filter logs around the exact repro timestamp for:

- `documentAssets:generateUploadUrl`
- `profiles:patch`
- `profilesPublic:getByProfileId`

Useful fields to compare:

- auth identity subject
- `profileId`
- mutation result: `{ written, reason, convexId, updatedAt }`
- payload keys: `cvDocument`, `metadata`, `documentDecoration`, `assetId`
- storage POST result: `storageId`
- return payload contains `metadata.documentDecoration.resolvedUrl`

