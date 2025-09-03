Profiles save paths — profilesPublic vs upsertProfile

Purpose
Provide a short, practical reference explaining the two public persistence paths in the repo, their differences, calling patterns, and recommended usage for the MVP.

Overview
There are two primary ways the frontend and external callers persist canonical profile data:

- The lightweight public mutation `profilesPublic` (intended for authenticated clients).
  See implementation: [`my-app/convex/profilesPublic.ts:147`]

- The idempotent backend mutation `upsertProfile` used by internal workers and some server-to-server routes.
  See implementation: [`my-app/convex/mutations/upsertProfile.ts:19`]

Quick comparison
- profilesPublic
  - Purpose: patch a single authenticated user's profile document (user-owned).
  - Auth: requires caller identity via Convex auth (the function checks ctx.auth.getUserIdentity()).
  - Typical callers: frontend editors (e.g., [`my-app/src/components/ProfileEditor.tsx:29`]) and browser extension flows.
  - Behavior: finds the current user's profiles row by clerkId and patches allowed fields. It updates version/updatedAt server-side.
  - Validation: uses Convex value validators for the public surface; payload is restricted to safe fields.

- upsertProfile
  - Purpose: idempotent upsert used by backend services to persist canonical profiles (external UUIDs supported).
  - Auth: internal mutation invoked directly by actions or HTTP endpoints (see `persistProfile` action).
    - HTTP endpoint that delegates to this mutation: [`my-app/convex/actions/persistProfile.ts:27`]
  - Typical callers: ingestion workers, Convex actions that act as authoritative writers, and services that need idempotency.
  - Behavior: accepts { profileId, idempotencyKey, source, version, profile } and will no-op if idempotencyKey already applied. It normalizes fields (dedupe skills, coerce experience/education arrays) before patch/insert.
  - Flexibility: accepts v.any() for profile payload and performs server-side normalization/defensive coercion.

When each should be used (MVP guidance)
- Use profilesPublic when:
  - The request originates from the authenticated user in the browser or extension.
  - You want a simple patch of the current user's profile (name, summary, skills, experience, education, metadata).
  - You do not need an externally-generated canonical profile id.
  - Example: edits made in the profile editor UI should call `profilesPublic` as implemented in [`my-app/src/components/ProfileEditor.tsx:68`].

- Use upsertProfile when:
  - Persistence originates from a backend process, worker, or external service with its own profileId semantics (e.g., an ingestion pipeline producing an external UUID).
  - You need idempotency (to avoid duplicated writes from retries).
  - You want server-side normalization to ensure consistent shape across diverse ingesters.
  - Example: a PDF ingestion worker calling the HTTP endpoint `/persistProfile` that delegates to `upsertProfile`: see [`my-app/convex/actions/persistProfile.ts:27`].

Example payloads (reference)
- profilesPublic mutation payload (in frontend code)
  {
    "profile": {
      "name": "Alice",
      "summary": "Senior frontend engineer",
      "raw_text": "Full resume text...",
      "skills": ["React","TypeScript"],
      "experience": [{ "company":"X", "title":"Engineer", "startDate": 1609459200000 }]
    }
  }
  Caller: `convex.mutation(api.profilesPublic.default, { profile })` as in [`my-app/src/components/ProfileEditor.tsx:68`].

- upsertProfile mutation args (server/worker)
  {
    "profileId": "external-uuid-1234",
    "idempotencyKey": "uuid-per-operation-456",
    "source": "worker_pdf_ingest",
    "version": 1,
    "profile": { /* canonical profile object (any) */ }
  }
  Caller: internal or HTTP -> `internal.mutations.upsertProfile` or HTTP route [`my-app/convex/actions/persistProfile.ts:27`].

Practical notes and gotchas
- Field naming inconsistencies:
  - Some client code uses `rawText` while server helpers use `raw_text`. Mutations normalize fields, but prefer consistent naming in new code to avoid confusion.
- Idempotency:
  - `upsertProfile` stores and checks `idempotencyKey` to avoid duplicated writes. When implementing ingestion, produce a stable idempotencyKey per unique input (e.g., hash of file + source).
- Autosave behavior:
  - The reviewer modal autosaves drafts aggressively (1s debounce by default). If using `profilesPublic` heavily, expect a higher frequency of writes; consider debouncing on the UI side if cost is a concern.
- Auth and tokens:
  - `profilesPublic` and `profiles` internal flows rely on Convex auth; HTTP fallbacks in the UI call Convex site endpoints using a Clerk token (see `authenticatedFetch` in [`my-app/src/components/ProfileReviewModal.tsx:234`]).
- Normalization:
  - `upsertProfile` performs defensive normalization (dedupeStrings, coerceExperience, coerceEducation) before persisting — this helps keep inconsistent ingesters producing consistent stored documents.

Recommended MVP approach
1. For user-driven edits from the browser UI, prefer `profilesPublic` (simple, minimal payload, authenticated).
2. For ingestion, worker flows, or external systems (including any pipeline that supplies its own profileId), prefer the idempotent `upsertProfile`.
3. Document which code path a particular caller uses when adding new integration to the repo — add a short comment near the calling code linking to either [`my-app/convex/profilesPublic.ts:147`] or [`my-app/convex/mutations/upsertProfile.ts:19`].

Where to look for examples in the repo
- UI save via profilesPublic: [`my-app/src/components/ProfileEditor.tsx:68`]
- Review modal save (uses upsertProfile via generated client mutation): [`my-app/src/components/ProfileReviewModal.tsx:654`]
- HTTP persist endpoint for server-to-server writes: [`my-app/convex/actions/persistProfile.ts:27`]
- upsertProfile implementation and idempotency behavior: [`my-app/convex/mutations/upsertProfile.ts:19`]

Change log
- Created by audit on 2025-09-02 to clarify public save paths for the MVP wiring.
