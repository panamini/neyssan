1) ASCII architecture diagram (high-level)
Frontend (React SPA)                       Chrome extension
┌─────────────────────────┐                ┌─────────────────────────┐
| User browser            |                | Extension background -> |
| - Profile UI            | <---clicks---> | content script captures |
| - ProfileReviewModal    |                | job posting              |
| - client CV parser      |  parse CV/LL    |                         |
|   (browser-cv-parser.ts)|                | -> sends posting to     |
└─────────────────────────┘                |    backend/Convex or    |
         |  ^                              |    extension server     |
         |  | upload/parsed profile        └─────────────────────────┘
         |  |
         v  |
Convex HTTP endpoints (Convex HTTP action /api/ingestProfile, /api/llm-refine)
┌────────────────────────────────────────────────────────────────────────────┐
| Convex (auth via Clerk)                                                     |
| - HTTP action ingestProfile(payload: NormalizedProfile) -> run internal     |
|   mutation to upsert userProfiles                                           |
| - HTTP action /api/llm-refine -> enqueue LLM refine job (RQ/worker)         |
| - Internal mutations/queries: users.createOrUpdateUser, internal.profiles.* |
└────────────────────────────────────────────────────────────────────────────┘
         |                        |
         | persist                 | enqueue job (RQ / worker)
         v                        v
Database / Storage              Background worker (RQ/Gunicorn/Node/Cloud tasks)
- userProfiles table           ┌─────────────────────────────────────────────┐
- proposals table              | LLM worker (Python or Node)                  |
- llm_history table            | - Picks jobs from queue                       |
- _storage (files)             | - Optionally performs server-side parsing/OCR |
└──────────────────────────────┘ | - Calls LLMs (OpenAI / Mistral)               |
         ^                      | - Stores full_response, patch, confidence     |
         |                      | - Creates patch suggestions and writes to DB |
         |                      └─────────────────────────────────────────────┘
         |                                     |
         +-------------------------------------+
                     read/poll LLMHistory → Frontend shows refined output & patch UI

Architecture review and recommended plan for Neyssan (job-proposal generator)

1) ASCII architecture diagram (high-level)
Frontend (React SPA)                       Chrome extension
┌─────────────────────────┐                ┌─────────────────────────┐
| User browser            |                | Extension background -> |
| - Profile UI            | <---clicks---> | content script captures |
| - ProfileReviewModal    |                | job posting              |
| - client CV parser      |  parse CV/LL    |                         |
|   (browser-cv-parser.ts)|                | -> sends posting to     |
└─────────────────────────┘                |    backend/Convex or    |
         |  ^                              |    extension server     |
         |  | upload/parsed profile        └─────────────────────────┘
         |  |
         v  |
Convex HTTP endpoints (ingestProfile, llm-refine, merge)
┌────────────────────────────────────────────────────────────────────────────┐
| Convex (auth via Clerk)                                                     |
| - HTTP action ingestProfile(payload: NormalizedProfile) -> upsert userProfiles|
| - HTTP action llm-refine -> enqueue LLM refine job (returns job/placeholder) |
| - Internal mutations/queries: users.createOrUpdateUser, internal.profiles.*  |
└────────────────────────────────────────────────────────────────────────────┘
         |                        |
         | persist                 | enqueue job
         v                        v
Database / Storage              Background worker (RQ/worker)
- userProfiles table           ┌─────────────────────────────────────────────┐
- proposals table              | LLM worker (Python/Node)                    |
- llm_history table            | - Loads canonical full_raw_text             |
- storage for files            | - Calls LLMs (OpenAI / Mistral)             |
└──────────────────────────────┘ | - Saves full_response, patch, confidence    |
         ^                      | - Writes LLMHistory row / patch ops         |
         |                      └─────────────────────────────────────────────┘
         |                                     |
         +-------------------------------------+
                     frontend polls LLMHistory → UI shows refined output & patch UI

2) Step-by-step workflow (end-to-end)
- User logs in (Clerk).
- User uploads CV or provides LinkedIn:
  - Primary: client-side parse via browser-cv-parser.ts (layout-aware, structured fields, OCR fallback).
  - Fallback: upload to server for server-side parsing/OCR if client fails/large file.
- User reviews parsed NormalizedProfile in ProfileReviewModal and edits.
- On Save: frontend POSTs top-level NormalizedProfile JSON to Convex HTTP action /api/ingestProfile.
  - Convex HTTP action authenticates user, creates/updates user & userProfiles row with versioning.
- For AI refinement: frontend calls /api/llm-refine (Convex HTTP action) → action enqueues async job.
  - Worker fetches full_raw_text, calls LLM(s), generates structured parsed output + patch ops + confidence, saves LLMHistory row.
  - Worker returns placeholderId/jobId; frontend polls LLMHistory to display refined results.
- User picks suggested patch ops → frontend posts /api/profiles/{id}/merge to apply selected ops with client_version for optimistic concurrency.
- Proposal generation:
  - Chrome extension captures a job posting and sends it to backend (Convex or server worker).
  - Backend composes LLM prompt using structured user profile + job text + user preferences, calls LLM, saves proposal, displays in UI.

3) Does the proposed plan integrate cleanly?
- Yes. Client-side parsing + Convex HTTP ingest is well-aligned with existing code (ProfileReviewModal, browser-cv-parser.ts, Convex mutations). The app already contains modal flows and endpoints to poll LLMHistory. The main integration work is ensuring the Convex HTTP action contract (top-level NormalizedProfile) and consistent field names, plus migration/cleanup of legacy ingestion.

4) Risks, bottlenecks, and missing pieces
- Client-side parsing limitations: large PDFs, scanned images, and long processing times on low-end devices; OCR in-browser can be slow.
- Upload/size/timeouts: file size / upload limits to Convex or proxy endpoints.
- LLM cost and latency: multiple LLM calls (refine + proposal) can increase cost and slow UX.
- Concurrency: race conditions when multiple changes/refines occur; need optimistic concurrency with profile.version.
- Hallucinations: LLM may invent data (fake companies/dates) — must make all LLM-suggested changes opt-in.
- Privacy & compliance: CVs contain PII; need secure storage, encryption, retention and deletion policies.
- Legacy Python service: may contain existing state and logs; requires careful deprecation/backfill.

5) Alternative approaches (trade-offs)
- Fully client-side parsing:
  - Pros: better privacy, instantaneous user feedback.
  - Cons: fragile for scanned/complex docs, CPU-heavy.
- Fully server-side parsing:
  - Pros: robust OCR, central improvements, easier to scale.
  - Cons: increased privacy surface, storage costs, latency.
- Hybrid (recommended):
  - Client-side quick parse for immediate UX; if fail (size or low confidence) upload to server and run robust server-side parse asynchronously.
- Pipeline optimizations:
  - Cache parsed outputs and embeddings; batch LLM calls; use cheaper models as fallback.

6) Concrete recommendations (actionable)
- API contracts (explicit):
  - POST /api/ingestProfile: accepts top-level NormalizedProfile JSON, authenticated; returns { id? }.
  - POST /api/llm-refine: { profileId, rawText? } → returns { jobId?, placeholderId? }.
  - GET /api/llm-history/{placeholderId} → returns LLMHistoryRow.
  - POST /api/profiles/{id}/merge → applies selected patch ops with client_version.
- Parsing strategy:
  - Primary: browser-cv-parser for instant feedback.
  - Fallback: server-side parse + OCR when client parsing fails or file > threshold.
- LLM worker:
  - Asynchronous queue (RQ/Redis or Cloud Tasks) that writes LLMHistory with full_response, patch ops, and confidence.
  - Minimal hallucination checks and patch ops are reviewed by the user before merge.
- DB/schema:
  - Ensure userProfiles include version, raw_text and pointer to full_raw_text storage.
  - Add llm_history table for job results and patches.
- Security:
  - Encrypt sensitive data at rest; implement data retention and delete endpoints; show user consent for processing.
- Observability & cost control:
  - Track model usage per user, rate limits, and fallbacks to cheaper models.
- Deprecation of legacy Python service:
  - Run in parallel as fallback, backfill missing data, instrument, then decommission after verification.

7) Short prioritized MVP checklist
- [ ] Finalize Convex HTTP action signatures and validators (ingestProfile, llm-refine, merge)
- [x] Integrate client-side parsing in ProfileReviewModal (done)
- [x] Ensure frontend posts top-level payload to /api/ingestProfile (done)
- [ ] Implement Convex internal mutation to upsert userProfiles (with versioning)
- [ ] Implement llm-refine enqueue endpoint + worker to write LLMHistory
- [ ] Server-side parse fallback / storage
- [ ] Monitoring, rate-limiting, and privacy controls
- [ ] Controlled decommissioning of legacy Python ingestion

8) Final recommendation
- Proceed with the current plan (client-side parsing + Convex HTTP ingest + async LLM worker) but adopt a hybrid parsing fallback and strong safety guardrails:
  1) Client-side parser for fast UX; server-side parse/OCR for failures/large docs.
  2) Enqueue LLM refine jobs asynchronously; return placeholder IDs for reliable polling.
  3) Require explicit user approval of LLM-suggested patch ops before merging.
  4) Use optimistic concurrency (profile.version) and log model usage for cost control.
  5) Keep legacy Python service as a fallback only during migration; plan and execute a staged decommission.

Next steps I can implement for you (pick one):
- Generate Convex HTTP action code skeletons for ingestProfile and llm-refine (TypeScript with validators).
- Produce DB migration snippets (schema additions for llm_history and profile fields).
- Draft a worker implementation sketch (Python or Node) with sample LLM prompts for refine & proposal generation.
- Add server-side parsing endpoint + upload-to-storage flow.

Choose which of the above you want me to produce next and I'll switch to Act mode and create the code/files.




MINOR SECURITY FIX TO ADD (not implemented yet)
The Flaw and Its Fix
The issue is that the code currently trusts the entire profileData object coming directly from the client. A malicious user could add extra fields to the JSON body that are not part of the expected schema, and the mutation might save them. While not immediately dangerous, this can lead to a polluted database and potential bugs.
To fix this, you should explicitly define the data shape of the incoming payload. This is a best practice for API security and data integrity.
Here's a revised version of the handler that validates the incoming data before passing it to the mutation.

JavaScript

// Clean profile ingestion endpoint for client-side parsed data
http.route({
  path: "/ingestProfile",
  method: "POST",
  handler: httpAction(async ({ runMutation, auth }, request) => {
    try {
      const identity = await auth.getUserIdentity();
      if (!identity) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
      }

      const body = await request.json();
      
      // Explicitly define and validate the expected data shape
      const profileData = {
        name: body.name,
        email: body.email,
        summary: body.summary,
        skills: body.skills,
        experience: body.experience,
        education: body.education,
        linkedIn: body.linkedIn,
        raw_text: body.rawText,
        metadata: {
          source: body.metadata?.source || "cv_upload",
          confidence: body.metadata?.confidence,
          importedAt: Date.now(),
        }
      };

      // Ensure user exists
      await runMutation(internal.users.createOrUpdateUser, {
        clerkId: identity.subject,
        email: identity.email ?? "unknown@example.com",
        name: identity.name,
      });

      // Update user profile with validated data
      await runMutation(internal.users.updateUserProfile, {
        clerkId: identity.subject,
        profileData: profileData // Pass the validated object
      });

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("HTTP /ingestProfile error:", err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
  }),
});
The rest of the code, including the ping and test/generate routes, is correct and ready.