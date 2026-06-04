# CV Decoration Refresh Audit

## Invariant

After uploading a CV decoration image, a hard refresh must render the same image again.

## Confirmed Facts

- The Convex write path can persist `metadata.documentDecoration.assetId`.
- The immediate preview can render from a temporary `blob:` URL.
- The local durable CV cache intentionally strips runtime image URLs (`dataUrl`, `resolvedUrl`, `assetMissing`).
- The refresh console showed repeated `[cv-decoration-render:missing-url]` diagnostics with `assetId` present and both `dataUrl` / `resolvedUrl` absent.
- `profilesPublic.getByProfileId` is designed to resolve `assetId` through `ctx.storage.getUrl` and return a runtime `resolvedUrl`.

## Root Cause

The refresh failure was client-side hydration, not initial upload rendering.

Two active client paths could leave the renderer with an assetId-only decoration:

1. Restoring a full cached active CV on `/cv` without `?id=...` returned from hydration before a remote refresh could restore runtime `resolvedUrl`.
2. One `loadCv` background refresh branch ignored remote results when content matched and only metadata differed. A storage `resolvedUrl` is metadata-only, so the remote runtime URL was dropped.

## Fix

- Refresh the authenticated active CV after local hydration even when the URL has no route `id`.
- Keep the existing route-id safety check when a route `id` is present.
- Treat metadata-only remote differences as meaningful in the `loadCv` cached-document refresh path.
- Keep durable local cache behavior unchanged: runtime URLs are still not persisted locally.

## Verification

- Added a RED test for `/cv` hard refresh with local `assetId` only and remote `resolvedUrl`.
- Confirmed the RED test failed before the context fix and passed after.
- Adjacent image upload/rendering and Convex projection tests passed.

## Remaining Boundary

If a future console still shows `assetId` without `resolvedUrl` after this fix, the next boundary is server/storage: verify that `ctx.storage.getUrl(assetId)` returns a URL for that exact storage id.
