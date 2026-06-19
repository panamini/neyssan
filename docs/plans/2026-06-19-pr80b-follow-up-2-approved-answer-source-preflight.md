# PR80B Follow-up 2 Approved Answer Source Preflight

Date: 2026-06-19

Status:

```txt
BLOCKED_NO_AUTHORITATIVE_SOURCE
```

Scope: docs-only source decision for manual application handoff per-answer copy. This preflight makes no code, schema, UI, runtime, provider, package, or lockfile changes.

## Decision Summary

Confirmed facts:

- PR80B merged as GitHub PR #208 with merge commit `dd71c10b45582894c2f445db7443d7748618abab` at `2026-06-19T14:33:28Z`.
- PR80B-follow-up merged as GitHub PR #209 with head commit `9e4ed852c708eba75789c5df34091c8d27e0ee72` and merge commit `9cfc9accd691f6d9c69ade6164dff2b6e1aeb6f9` at `2026-06-19T17:25:07Z`.
- Current PR80B handoff code deliberately returns no approved answers and blocks `recordCopySucceeded` for answers with `Approved answer copy is blocked until approved answers are server-derived.`
- Approved artifact delivery exists for approved export representations, but approved per-answer copy does not have an authoritative source.
- No current active table, artifact kind, package item, or manual handoff record provides owner-scoped, human-approved, fresh, provider-question-bound answer text for manual copy cards.

Decision:

```txt
Do not implement per-answer copy from any existing source.
Keep approved answer copy blocked until a future source-model decision or code boundary creates an authoritative approved application-answer source.
```

## Files Inspected

Roadmap and decision files:

- `AGENTS.md`
- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/plans/2026-06-19-pr80b-safe-application-handoff-while-ats-access-pending.md`
- `docs/plans/2026-06-17-pr70-cover-letter-application-message-preview-brief.md`
- `docs/plans/2026-06-17-pr71-human-approval-workflow-generated-artifacts-brief.md`
- `docs/plans/2026-06-17-pr72-artifact-revision-loop-brief.md`
- `docs/plans/2026-06-17-pr73-export-download-policy-brief.md`
- `docs/plans/2026-06-17-pr74-resume-export-brief.md`
- `docs/plans/2026-06-17-pr75-cover-letter-application-package-export-brief.md`

Active Convex and frontend surfaces:

- `my-app/convex/manualApplicationHandoff.ts`
- `my-app/convex/lib/manualApplicationHandoff.ts`
- `my-app/convex/__tests__/manualApplicationHandoff.test.ts`
- `my-app/convex/schema.ts`
- `my-app/convex/applicationPackages.ts`
- `my-app/convex/lib/applicationPackages.ts`
- `my-app/src/components/jobs/ManualApplicationHandoffPanel.tsx`
- `my-app/src/components/jobs/JobsWorkspace.tsx`
- `my-app/src/components/jobs/__tests__/ManualApplicationHandoffPanel.test.tsx`

Application package and artifact sources:

- `my-app/src/modules/application-package/schema.ts`
- `my-app/src/modules/application-package/buildApplicationPackage.ts`
- `my-app/src/modules/application-package/packageRules.ts`
- `my-app/src/modules/application-artifacts/resume-variant-artifact/schema.ts`
- `my-app/src/modules/application-artifacts/resume-variant-artifact/buildResumeVariantArtifact.ts`
- `my-app/src/modules/application-artifacts/cover-letter-artifact/schema.ts`
- `my-app/src/modules/application-artifacts/cover-letter-artifact/buildCoverLetterArtifact.ts`
- `my-app/convex/lib/applicationHarness.ts`
- `my-app/convex/applicationHarness.ts`

Local MCP boundaries checked as candidates or non-candidates:

- `my-app/src/modules/local-mcp/mcpGeneratedArtifactBoundary.ts`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactHumanApprovalWorkflow.ts`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactExportDownloadPolicy.ts`
- `my-app/src/modules/local-mcp/mcpResumeExport.ts`
- `my-app/src/modules/local-mcp/mcpCoverLetterApplicationPackageExport.ts`
- `my-app/src/modules/local-mcp/mcpApplicationMessageSend.ts`
- `my-app/src/modules/local-mcp/mcpJobPlatformApplyDryRun.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpJobPlatformApplyDryRun.test.ts`

External routing context was also read from `/Volumes/video/git/twoweeks-wiki` under the project `AGENTS.md` workflow.

## Current Active Boundary

`my-app/convex/manualApplicationHandoff.ts` is active code for the live manual handoff surface.

The current server contract is intentionally conservative:

- `getForJob` and `prepare` return `approvedAnswers: []`.
- `getDeliveryContentForHandoff` returns `approvedAnswers: []` plus `answerCopyBlockedReason`.
- `recordCopySucceeded` validates `answerRef` and `answerDigest`, verifies the handoff is confirmed and fresh, then throws the approved-answer block reason before appending an event.
- Handoff events may store `answerRef` and `answerDigest`, but not answer text.
- The redaction policy explicitly forbids persisted keys such as `answerText`, `clipboardContent`, free text, credentials, tokens, cookies, full URL parts, generated document text, and file bytes.

This is active code and must be preserved until an authoritative answer source exists.

## Source Decision Criteria

An authoritative approved answer source for manual copy must satisfy all criteria below:

- Owner-scoped through the existing authenticated Twoweeks owner model.
- Bound to a specific job and application context.
- Bound to an application package, package content hash, or equivalent freshness anchor.
- Bound to a provider question identity or provider question schema version.
- Carries exact approved answer text or a server-only retrievable equivalent.
- Records explicit human approval state, approver owner, and approval time.
- Proves freshness against source facts, generated artifact lineage, and provider question schema.
- Excludes private facts, `never_use` facts, stale generated text, raw job text, and unapproved generated content.
- Exposes only copy-card data to the component and records only refs/digests in handoff events.
- Keeps provider submission, provider verification, browser automation, and live apply out of scope.

No inspected existing source satisfies this full contract.

## Candidate Sources

| Candidate | Status | Decision |
| --- | --- | --- |
| Manual handoff records/events | Active but not a source | Rejected. They store handoff state, refs, digests, and redacted events only; they deliberately do not store answer text. |
| `applicationPackages` | Active package summary | Rejected. It stores package refs, content hashes, provenance, and artifact item metadata, but no provider-question answer text. It also asserts that application packages do not contain generated text. |
| Approved `applicationArtifacts` export payloads | Active for artifact delivery | Rejected for answer copy. Approved exports can deliver resume, cover letter, or application package representations, but they are document artifacts, not per-provider-question approved answers. |
| Cover letter artifact | Active generated artifact | Rejected. It can persist approved cover-letter text, but it is not provider-question-bound answer copy and cannot safely be sliced into per-answer text. |
| Resume variant artifact | Active factual plan artifact | Rejected. It is a source-backed resume variant plan/generation input, not approved screening answer text. |
| Local MCP PR79 dry-run approved answer fixture | Legacy but informative for shape | Rejected. It is explicitly non-production local fixture data with `integrationId: "local_fixture_job_platform_v1"` and `nonProduction: true`; it is not owner-scoped production data and is not persisted as an authoritative Twoweeks answer source. |
| `jobs.reviewItems` | Active job extraction review data | Rejected. These are job extraction review fields and optional approved extracted values, not application-answer approvals. They lack provider question binding, answer generation/approval lineage, and freshness semantics for manual copy. |
| `proposals` / application message preview | Active or local generated content depending on surface | Rejected. These are proposal/message/document texts, not per-question approved answers, and they do not satisfy the manual handoff answer-card contract. |

## Ownership Model

Existing owner checks in manual handoff are the correct boundary to reuse:

```txt
authenticated identity
-> listProfilesForClerk
-> owner profile id
-> owner-scoped job
-> owner-scoped application context/package/artifact checks
```

A future answer source must be resolved server-side under that same owner profile. The UI must not pass arbitrary answer text, owner ids, application package ids, or provider question ids as trust anchors. Client inputs can identify the job and expected answer ref only; the server must derive and verify ownership.

## Approval Model

The existing generated-artifact approval boundaries approve preview/export artifacts, not individual provider answers.

A valid future answer approval model must include:

- explicit human approval of the exact answer text;
- answer status such as `approved`, not `draft`, `needs_review`, `blocked`, or local preview-only approval;
- `answerRef` and `answerDigest` generated by the server from the approved answer;
- approver owner identity or owner profile id;
- approval timestamp and supersession behavior;
- source lineage proving the answer did not rely on private, `never_use`, stale, or unapproved text.

PR71 preview approval, PR73 export/download eligibility, and PR74/PR75 export representations are insufficient by themselves because they approve artifacts/documents, not provider-question answers.

## Freshness Model

Manual handoff already recomputes destination and package/manifest freshness for handoff state. A future answer source must add answer-specific freshness:

- provider question schema version or question digest still matches the answer;
- application package content hash still matches the approved answer lineage;
- resume variant, cover letter, and supporting provenance hashes are still current where used;
- source facts remain allowed and are not deleted, private, or marked `never_use`;
- answer approval has not been superseded by a newer package, provider schema, or user edit;
- stale answers return a blocked reason, not copyable text.

If any freshness input is unavailable, the server must fail closed.

## Privacy Classification

Approved application-answer text is sensitive user-facing generated or user-approved content.

Privacy rules:

- It may be component-visible only when the server returns an approved, fresh answer copy card for the owner.
- It must not be model-visible through MCP safe summaries or policy metadata.
- It must not be stored in manual handoff records or events.
- Copy-success events may store only `answerRef`, `answerDigest`, state, and redacted metadata.
- Logs and audits must not include raw answer text, clipboard contents, raw provider question text, raw job text, destination credentials, cookies, tokens, full URLs, or free-form user receipt text.
- UI copy must not imply provider submission or provider verification.

## Proposed Future Query Contract

This is a contract requirement, not an implementation approval.

```ts
type ApprovedApplicationAnswerForHandoff = {
  answerRef: string;
  answerDigest: string;
  label: string;
  answerText: string;
  questionRef: string;
  questionSchemaVersion: string;
  approvedAt: string;
  sourcePackageHash: string;
};

type ApprovedApplicationAnswersForHandoffResult =
  | {
      status: "available";
      answers: ApprovedApplicationAnswerForHandoff[];
    }
  | {
      status:
        | "blocked_no_authoritative_source"
        | "blocked_not_approved"
        | "blocked_stale"
        | "blocked_owner_mismatch"
        | "blocked_policy";
      answers: [];
      blockedReason: string;
    };
```

Required server inputs:

- authenticated Convex context;
- owner-derived job id;
- owner-derived application context id;
- owner-derived application package id and content hash;
- current destination/provider question schema digest, if available.

Forbidden trust inputs:

- client-supplied answer text;
- client-supplied approval state;
- client-supplied owner id;
- client-supplied package hash;
- browser-scraped question text;
- PR79 local fixture answer artifacts.

## Proposed UI Contract

The manual handoff UI may show per-answer copy controls only when the server result is `available`.

UI rules:

- Render server-returned answer cards exactly; do not synthesize answers from cover letters, proposals, resume text, job review items, or local MCP fixtures.
- Disable answer copy when the server returns any blocked status.
- Call answer copy telemetry with only `answerRef` and `answerDigest`.
- Never pass raw answer text back to `recordCopySucceeded`.
- Keep user-reported submission outcome labeled as unverified.
- Keep provider-verified, submit/apply, browser automation, destination fetch, and live external-action execution out of scope.

## Exact Future Tests

A future code PR can enable per-answer copy only after an authoritative source exists and must include tests for:

- missing authoritative answer source returns blocked status and no copyable answers;
- owner mismatch cannot read answer text or record answer copy;
- unapproved, draft, blocked, superseded, or stale answers are not copyable;
- provider question schema mismatch blocks copy;
- application package hash mismatch blocks copy;
- private, `never_use`, deleted, or stale source facts block copy;
- answer digest changes when approved answer text changes;
- copy-success event stores `answerRef` and `answerDigest` only;
- handoff records/events never persist `answerText` or clipboard content;
- UI renders disabled answer copy controls for blocked status;
- UI renders copy controls only for server-returned approved answers;
- user-reported outcome remains unverified and does not create provider-verified state;
- no PR80A `liveExternalActionExecutions` are reserved, dispatched, finalized, or mutated.

## Files For A Possible Future Code PR

Allowed only after a new decision returns `READY_TO_IMPLEMENT_EXISTING_SOURCE` or `READY_TO_IMPLEMENT_NARROW_BOUNDARY`:

- `my-app/convex/manualApplicationHandoff.ts`
- `my-app/convex/lib/manualApplicationHandoff.ts`
- `my-app/convex/__tests__/manualApplicationHandoff.test.ts`
- `my-app/src/components/jobs/ManualApplicationHandoffPanel.tsx`
- `my-app/src/components/jobs/JobsWorkspace.tsx`
- `my-app/src/components/jobs/__tests__/ManualApplicationHandoffPanel.test.tsx`
- a narrowly approved answer-source module or schema migration, if and only if that future decision authorizes it
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`

## Forbidden Files And Surfaces

Forbidden for this preflight and for any immediate follow-up without a new source decision:

- `pdf-ingest/`
- legacy parser/training paths
- PR79 local fixture answer artifacts as production source data
- package files and lockfiles
- OAuth callback, token exchange, refresh, revocation, or token storage
- provider API calls
- provider submit/apply behavior
- browser automation
- destination fetches
- outbound HTTP
- LLM/model calls
- generated answer persistence without explicit schema approval
- `liveExternalActionExecutions` mutation for manual handoff
- any code path that treats user-reported outcome as provider-submitted or provider-verified

## Rollback Plan

Revert this docs-only PR. It changes only the progress ledger and this preflight report. No code, schema, runtime, package, lockfile, provider, OAuth, browser automation, generated answer persistence, or live submit/apply behavior is changed.

## Verification Commands And Results

Ran before PR publication on branch `codex/pr80b-follow-up-2-approved-answer-source-preflight`:

```txt
rtk git diff --check
Result: PASS. No whitespace errors.

rtk git diff --name-only application-os-foundation...HEAD
Result: PASS. Changed files:
- docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
- docs/plans/2026-06-19-pr80b-follow-up-2-approved-answer-source-preflight.md

rtk npx fallow audit --changed-since application-os-foundation --format compact
Result: PASS. Fallow reported no issues in the 2 changed docs files. It also reported 19 inherited unused-dependency/dead-code findings outside the changed-file audit gate; no fixes were applied because this PR is docs-only.
```

## Final Decision

BLOCKED_NO_AUTHORITATIVE_SOURCE
