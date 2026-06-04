# CV Persistence + Document Image Regression Escalation Report

Date: 2026-06-04  
Repo: `panamini/neyssan`  
App: `my-app`  
Branch: `codex/cv-forge-live-boundary-debug`  
Deployment checked: `prod:neat-starfish-33`

## Live symptom still happening

The user reports this is still broken after the latest local patches:

1. Hard reload `/cv?id=<profileId>`.
2. Edit Summary or Experience text.
3. Typing is very slow.
4. Hard refresh again.
5. Text is not persisted.
6. Add/upload a document image.
7. Image does not appear on the page anymore and does not survive reload.

Important: this live repro means the previous patches are not sufficient to explain or fix the real boundary. Treat the branch patches as useful context, not proof that the live problem is fixed.

## Production data evidence

Commands run against `prod:neat-starfish-33`:

```bash
rtk env CONVEX_DEPLOYMENT=prod:neat-starfish-33 ./node_modules/.bin/convex data profiles --limit 3 --format jsonArray
rtk env CONVEX_DEPLOYMENT=prod:neat-starfish-33 ./node_modules/.bin/convex data userProfiles --limit 10 --format jsonLines
rtk env CONVEX_DEPLOYMENT=prod:neat-starfish-33 ./node_modules/.bin/convex data _storage --limit 5 --format jsonArray
```

Observed:

- `profiles` is empty.
- `userProfiles` contains CV documents.
- `_storage` is empty.
- In the first 10 `userProfiles` rows, no `documentDecoration`, `assetId`, `resolvedUrl`, or `assetMissing` was found.

Interpretation:

- The active CV read/write table appears to be `userProfiles`, not `profiles`.
- If an image was actually uploaded to Convex File Storage, `_storage` should not remain empty.
- Because `_storage` is empty, the image issue is very likely at or before the browser POST to the Convex upload URL, not only in URL projection.

## Canonical persistence table audit

### Read path

`convex/profilesPublic.ts:getByProfileId` reads `userProfiles` by `profileId`:

```ts
const rows = await ctx.db
  .query("userProfiles")
  .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
  .collect();
```

Code reference:

- `convex/profilesPublic.ts:251`
- `convex/profilesPublic.ts:262`

It requires auth:

```ts
const identity = await ctx.auth.getUserIdentity();
if (!identity) {
  return null;
}
```

Code reference:

- `convex/profilesPublic.ts:257`

### Write path

`convex/profiles.ts:patch` also resolves rows from `userProfiles` by `profileId`:

```ts
const rows = await ctx.db
  .query("userProfiles")
  .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
  .collect();
existing = resolvePatchProfileRow(rows, identity?.subject);
```

Code reference:

- `convex/profiles.ts:307`
- `convex/profiles.ts:351`
- `convex/profiles.ts:357`

It patches `existing._id`, which is the `userProfiles` row:

```ts
await ctx.db.patch(existing._id, {
  metadata: md,
  updatedAt: now,
  version: (existing.version || 1) + 1,
});
```

Code reference:

- `convex/profiles.ts:493`

For full autosave payloads it accepts `cvDocument` as an allowed field:

```ts
const allowed = new Set([
  ...
  "metadata",
  "cvDocument",
  ...
]);
```

Code reference:

- `convex/profiles.ts:558`

Conclusion: I did not find a table mismatch in the current code. Both read and write paths are using `userProfiles`.

## Text save client path

Main save owner:

- `src/contexts/CvLibraryContext.tsx`

Full save function:

```ts
async function performSave(documentToSave: CvDocument, options?) {
  const normalizedResult = normalizeAndValidateCvDocument(coreDoc, ...);
  const docCopy: CvDocument = { ...normalizedCore, metadata: { ... } };
  await adapter.save(docCopy as any);
  setRemoteSaveStatus({ status: "synced", documentId: String(docCopy.id) });
  cacheDocumentLocally(docCopy);
}
```

Code reference:

- `src/contexts/CvLibraryContext.tsx:2202`
- `src/contexts/CvLibraryContext.tsx:2275`
- `src/contexts/CvLibraryContext.tsx:2293`
- `src/contexts/CvLibraryContext.tsx:2345`

Adapter save payload:

```ts
backendPayload.cvDocument = encodeCvDocumentForConvex(
  sanitizeRemoteCvDocument(cv),
);

await this._patchMutation({
  profileId: cv.id,
  patch: backendPayload,
});
```

Code reference:

- `src/adapters/StorageAdapter.ts:627`
- `src/adapters/StorageAdapter.ts:653`

Recent patch on this branch:

```ts
syncEditedDocumentLocally(nextDoc);
void scheduleSave(nextDoc);
```

Code reference:

- `src/contexts/CvLibraryContext.tsx:4321`

This was added because `updateCurrentCv({ sections })` previously updated current state/local cache but did not schedule a remote save. Tests prove the mutation payload now contains edited Summary/Experience text in `patch.cvDocument.sections`.

However, the live symptom says this is still not enough. That means at least one of these is likely true in the real browser flow:

1. The visible editor path is not actually calling `updateCurrentCv({ sections })`.
2. The mutation is not firing from the deployed/current bundle.
3. The mutation fires but fails auth/authorization.
4. The mutation fires with the right payload but writes a different `profileId` than the route uses.
5. A later remote hydration still overwrites the local edited doc with stale data.
6. The user is testing a deployed bundle that does not include these branch commits.

## Important adapter risk

`ConvexStorageAdapter.save` catches remote mutation errors and only rethrows when the error is not `Not authorized to access this profile`:

```ts
if (
  remoteSaveError &&
  !isUnauthorizedProfileAccessError(remoteSaveError)
) {
  throw remoteSaveError;
}
```

Code reference:

- `src/adapters/StorageAdapter.ts:682`

Risk:

- If live `profiles.patch` returns `Not authorized to access this profile`, the adapter keeps local cache but lets `performSave` mark the remote save as `synced`.
- This can make the UI report success while Convex did not write anything.
- This is a high-priority audit point in dashboard logs.

Ask Convex/GPT to check if `profiles.patch` executions are throwing:

- `Not authenticated`
- `Not authorized to access this profile`
- `User profile not found`
- `Value is too large`

## Image upload path

Expected flow:

```text
documentAssets.generateUploadUrl()
-> browser POST file to returned Convex upload URL
-> response returns { storageId }
-> save metadata.documentDecoration.assetId to userProfiles
-> profilesPublic.getByProfileId resolves assetId with ctx.storage.getUrl
-> client renders resolvedUrl
```

### Upload URL mutation

```ts
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.storage.generateUploadUrl();
  },
});
```

Code reference:

- `convex/documentAssets.ts:3`

### Browser POST

```ts
const uploadUrl = await generateUploadUrl();
const response = await fetch(uploadUrl, {
  method: "POST",
  headers: {
    "Content-Type": mimeType || file.type || "application/octet-stream",
  },
  body: file,
});

const payload = (await response.json()) as { storageId?: unknown };
```

Code reference:

- `src/pages/CvForge.tsx:228`

### Asset metadata save

```ts
const storageId = await uploadDocumentDecorationAsset(...);

const persistedDecoration = normalizeDocumentDecoration({
  source: "upload",
  assetId: storageId,
  ...
});

await updateCvDocumentDecoration(persistedDecoration);
```

Code reference:

- `src/pages/CvForge.tsx:6524`
- `src/pages/CvForge.tsx:6530`
- `src/pages/CvForge.tsx:6545`

`updateCvDocumentDecoration` calls `saveCurrentCvStyleOnly`, which writes a metadata-only patch:

```ts
await saveCurrentCvStyleOnly(stylePreset, {
  documentDecoration: { ...persistedDecoration, visible: persistedDecoration.visible },
  documentStyleVersion: DOCUMENT_STYLE_VERSION,
});
```

Code reference:

- `src/pages/CvForge.tsx:6440`
- `src/contexts/CvLibraryContext.tsx:3464`
- `src/contexts/CvLibraryContext.tsx:3511`

### Runtime URL projection

```ts
if (typeof record.assetId === "string" && record.assetId) {
  const storageUrl = await ctx.storage.getUrl(record.assetId as any);
  ...
  record.resolvedUrl = resolvedUrl;
}
```

Code reference:

- `convex/profilesPublic.ts:127`

Critical evidence:

- `_storage` is empty on `prod:neat-starfish-33`.
- If the upload POST completed, `_storage` should contain a file row.
- Therefore the most important image debug target is browser Network:
  - Did `documentAssets.generateUploadUrl` return a URL?
  - Did the browser POST to that exact Convex upload URL?
  - What was the POST status?
  - Did the POST response include `storageId`?
  - Did `profiles.patch` then receive `metadata.documentDecoration.assetId`?

## What Convex Help should inspect in logs

Filter by the exact repro timestamp and profile id.

Functions:

- `documentAssets:generateUploadUrl`
- `profiles:patch`
- `profilesPublic:getByProfileId`

For `documentAssets:generateUploadUrl`:

- Was there a call?
- Was `ctx.auth.getUserIdentity()` present?
- Did it throw `Not authenticated`?
- Did it return an upload URL?

For the browser file POST:

- Was there a Network request to a Convex upload URL?
- Status code?
- Response body keys?
- Was `{ storageId }` returned?

For `profiles:patch`:

- Was there a call after text edit?
- Was there a call after image upload?
- What is `identity.subject`?
- What is `args.profileId`?
- Does `args.profileId` match `/cv?id=<profileId>`?
- What are `Object.keys(args.patch)`?
- Does text edit payload include `cvDocument`?
- Does `cvDocument.sections` contain edited Summary/Experience text?
- Does image payload include `metadata.documentDecoration.assetId`?
- Does it return `{ written: true }`, or throw?

For `profilesPublic:getByProfileId`:

- Does it read the row just patched?
- Does returned payload include `cvDocument.sections` with edited text?
- Does returned payload include `metadata.documentDecoration.assetId`?
- If assetId exists, does it include `resolvedUrl` or `assetMissing: true`?

## What GPT/code reviewer should inspect next

Highest-priority code questions:

1. Which actual component path is used when typing in Summary/Experience on `/cv?id=<profileId>`?
   - Does it call `updateCurrentCv`, `updateStructuredItem`, `updateBlockContent`, or a local editor-only buffer?
   - If it uses buffered editor state, is `flushPendingEdits()` firing before save/reload?

2. Is `profiles.patch` called after each edit debounce?
   - If not, trace from the editor event handler to context.

3. Is `remoteSaveStatus` truthful?
   - `StorageAdapter.save` can swallow `Not authorized to access this profile`.
   - If that happens, UI may believe save succeeded.

4. Is profile id consistent?
   - Route id: `/cv?id=<profileId>`
   - Adapter mutation id: `profileId: cv.id`
   - Stored row: `userProfiles.profileId`
   - If any one differs, writes and reads can split.

5. Is a background refresh overwriting local edits?
   - Inspect `shouldApplyBackgroundRefresh`.
   - Confirm local edited doc has newer `metadata.updatedAt` before remote refresh returns.

6. For images, why is `_storage` empty?
   - This is likely not a projection-only issue.
   - Need Network proof for upload URL POST.

## Minimal additional instrumentation recommended

Gate with `window.__CV_EDITOR_DEBUG__ === true` or a dev-only flag.

Client before mutation:

```ts
console.info("[cv-save-debug]", {
  routeId: new URLSearchParams(location.search).get("id"),
  docId: docCopy.id,
  patchKeys: Object.keys(backendPayload),
  hasCvDocument: Boolean(backendPayload.cvDocument),
  sectionCount: backendPayload.cvDocument?.sections?.length,
  payloadContainsEditedText: JSON.stringify(backendPayload.cvDocument).includes("<typed marker>"),
});
```

Convex mutation:

```ts
console.log("[profiles.patch]", {
  profileId: args.profileId,
  identity: identity?.subject ?? null,
  patchKeys: args.patch ? Object.keys(args.patch) : [],
  hasCvDocument: Boolean(args.patch?.cvDocument),
  sectionCount: args.patch?.cvDocument?.sections?.length,
  hasDecorationAssetId: Boolean(args.patch?.metadata?.documentDecoration?.assetId),
  existingId: existing?._id,
  existingProfileId: existing?.profileId,
});
```

Upload:

```ts
console.info("[cv-image-upload]", {
  generatedUploadUrl: Boolean(uploadUrl),
  postStatus: response.status,
  responseKeys: Object.keys(payload ?? {}),
  storageId: payload.storageId ?? null,
});
```

Remove or keep gated after diagnosis.

## Current bottom line

Confirmed:

- Active table is `userProfiles`.
- `_storage` is empty.
- Current code has a valid-looking upload flow, but production data says no file is being stored.
- Current code has a valid-looking text save flow, but live behavior says the real edit path is not producing a durable remote write or a later read overwrites it.

Not confirmed:

- Whether live `profiles.patch` is called after typing.
- Whether live `profiles.patch` has valid auth.
- Whether live `profiles.patch` receives the edited `cvDocument`.
- Whether the upload URL POST happens at all.
- Whether the deployed/live bundle includes the latest branch commits.

Most likely live boundaries:

1. Real editor path does not call durable save for Summary/Experience.
2. `profiles.patch` auth/authorization failure is being swallowed or not surfaced.
3. Route `profileId` and saved `cv.id` differ.
4. Image upload POST never completes, explaining empty `_storage`.
5. A stale remote hydration still overwrites local content after edit.

