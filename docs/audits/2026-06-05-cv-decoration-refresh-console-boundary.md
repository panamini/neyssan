# CV Decoration Refresh Console Boundary Audit

## Question

Why does the CV decoration image render before hard refresh, then disappear after refresh?

## Confirmed from pasted console logs

- After refresh, the renderer repeatedly logs `[cv-decoration-render:missing-url]`.
- The render input has an `assetId`, but no `dataUrl` and no `resolvedUrl`.
- Two pasted runs show different asset ids:
  - `kg228zq6ah21dt8gm9frg28q55882wm0`
  - `kg24baptb6ktgbfgf6x6a0e5v5882dhj`
- Both ids exist in local Convex `_storage` as `image/png` objects.
- The page also logs `[cv-decoration-load-remote-state]` with `source: "loadFn"` for CV id `ee9b8dc7-7151-484a-acd9-3b8bfe4d2fbc`.
- The pasted browser console collapses that adapter payload as `{…}`, so the pasted evidence does not prove whether `loadRemoteState` returned `hasResolvedUrl: true` or `false`.
- In one pasted run, a metadata-only `profiles.patch` happens after the missing-url render loop, with `hasDecorationAssetId: true`, `hasCvDocument: false`, and `existingFound: true`.

## Active code path

This is active code.

1. Before refresh, CV Forge can render the draft decoration through `draftCvDocumentDecoration`, which may contain a temporary `blob:` `resolvedUrl`.
2. On refresh, durable local cache intentionally strips runtime image URLs. The cached decoration can only contain durable fields such as `assetId`, file metadata, placement, and visibility.
3. The renderer in `my-app/src/lib/document-decoration.ts` requires `dataUrl` or `resolvedUrl`. If it receives only `assetId`, it returns `null` and logs `[cv-decoration-render:missing-url]`.
4. The intended recovery path is `StorageAdapter.loadRemoteState -> profilesPublic.getByProfileId -> ctx.storage.getUrl(assetId) -> metadata.documentDecoration.resolvedUrl -> currentCv`.
5. The pasted logs show `StorageAdapter.loadRemoteState` is reached, but they do not show the expanded `hasResolvedUrl` value.

## Why before refresh works

Before refresh, the image can render from runtime-only draft state:

- upload creates/uses a local preview URL
- `draftCvDocumentDecoration` is renderable
- `getRenderableDocumentDecoration` sees `resolvedUrl` or `dataUrl`

That state is intentionally not durable.

## Why after refresh fails

After refresh, the first render starts from durable state. Durable state has `assetId` but no runtime URL. That is expected initially.

The failure is that the remote runtime URL does not become the winning render input after the remote load marker fires. The current evidence narrows the loss to one of these client-side boundaries:

1. `loadRemoteState` returns a mapped document that still lacks `resolvedUrl`.
2. `loadRemoteState` returns `resolvedUrl`, but `CvLibraryContext` skips applying it.
3. `CvLibraryContext` applies it briefly, then a later local state or metadata-only style save restores asset-id-only decoration.

The pasted console cannot distinguish these three because `[cv-decoration-load-remote-state]` logs `document: {…}` as a collapsed nested object.

## Important non-root-causes

- This is not a failed upload for the pasted asset ids. Both ids are present in `_storage`.
- This is not a renderer mystery. The renderer is doing exactly what it is coded to do: it refuses to render an asset-id-only decoration.
- This is not proven to be a Convex storage `getUrl` failure from the pasted logs. The decisive value is hidden inside the collapsed adapter log.

## Final root cause

The failing boundary was client-side mapping and refresh application, not Convex storage.

Live console proved:

- `profilesPublic.getByProfileId` resolved the current top-level decoration asset with `storageUrlFound: true`.
- The embedded `cvDocument` still had an older decoration asset.
- Before the final mapper fix, `StorageAdapter.loadRemoteState` returned a mapped CV with `hasDecoration: false`, so the renderer kept seeing only the durable local `assetId`.

Two client bugs combined:

1. When `mapPersistedProfileToCvDocument` could not use the embedded `cvDocument` snapshot and fell back to profile mapping, it dropped top-level `metadata.documentDecoration`.
2. Local durable cache writes rewrote `metadata.updatedAt` to `now`, so an asset-id-only local cache could look newer than the remote profile. In that skip path, the context did not previously overlay runtime decoration metadata from the remote response.

## Fix

This is active code.

- `StorageAdapter.mapPersistedProfileToCvDocument` now overlays top-level profile metadata, including runtime `documentDecoration.resolvedUrl`, on both embedded-document and fallback mapping paths.
- `CvLibraryContext` now preserves durable `metadata.updatedAt` when caching locally.
- `CvLibraryContext` now applies a metadata-only runtime decoration overlay when full background refresh is skipped but the remote profile has the same decoration asset with `resolvedUrl` or `assetMissing`.

The renderer still correctly refuses to render asset-id-only decoration input. The fix is to hydrate the runtime URL before rendering wins.
