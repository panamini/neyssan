# Resume Persistence Audit

Date: 2026-04-02

Scope: Verify whether CV/resume documents are saved durably enough for long-term recovery.

## Classification

- Active code
  - `src/contexts/CvLibraryContext.tsx`
  - `src/adapters/StorageAdapter.ts`
  - `convex/profiles.ts`
  - `convex/profilesPublic.ts`
  - `convex/activeCvSnapshots.ts`
- Legacy but informative
  - `convex/mutations/upsertProfile.ts`
  - `convex/mutations/updateUserProfile.ts`
- Obsolete/dead
  - Not used for this audit

## What Is Reliable Today

- Local persistence is real and active.
  - The CV library index is mirrored to `localStorage` in `CvLibraryContext`.
  - Each CV document is also cached per-document in `localStorage`.
  - The active editor path keeps the local cache fresh without waiting for the debounced save path.
- Remote writes do happen.
  - `CvLibraryContext.performSave()` calls `adapter.save()`.
  - `ConvexStorageAdapter.save()` calls `api.profiles.patch` with `profileId = cv.id`.
- Full remote document snapshots are now persisted.
  - The save path stores a `cvDocument` snapshot alongside the normalized profile fields.
  - The load path now prefers that full snapshot before falling back to profile-field reconstruction.
- `activeCvSnapshots` stores a lightweight personalization snapshot remotely.
  - This helps proposal personalization.
  - It is not a full-fidelity resume backup.
- Remote library hydration is now available for authenticated users.
  - The frontend can repopulate the library from Convex instead of relying only on localStorage.

## Current Risk

Long-term resume recovery is materially improved, with one remaining legacy edge case.

- New rows created through the autosave path are now tied back to the authenticated user through `clerkId`.
- The active remote load path is now `profileId`-aware.
- The library can now discover the authenticated user's saved resumes remotely.
- Remaining edge case:
  - Older rows created before the ownership fix and still missing `clerkId` will not appear in the remote library list until they are re-saved.
  - If the exact `profileId` is known, the `getByProfileId` path can still recover that row.

## Practical Outcome

- Same browser, same machine: good chance the resume remains available because `localStorage` caching is active.
- Cross-device recovery for newly saved resumes is now supported through the authenticated remote library and `profileId`-aware loads.
- Very old orphaned rows may still require one new save from a signed-in session to become fully attached to the account.

## Conclusion

The app now has both local persistence and a viable long-term remote retrieval path for authenticated resumes, including full-document remote snapshots.

## Recommended Follow-Up

- Backfill legacy unclaimed rows by attaching `clerkId` where ownership can be established safely.
- Add a targeted regression test around remote library hydration if this area keeps evolving.
