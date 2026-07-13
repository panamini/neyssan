# MCP L4 submission-readiness dossier

Change Contract: `CC-20260713-mcp-l4-submission-readiness-v1`

## Status

- `SUBMISSION_DOCUMENTATION_READY`
- `OPENAI_SUBMISSION_NOT_STARTED`
- `LIVE_ENDPOINT_NOT_VERIFIED`
- `WEB_MOBILE_REVIEW_NOT_RUN`
- `OPENAI_REVIEW_NOT_RUN`
- `OPENAI_APPROVAL_NOT_GRANTED`
- `PUBLIC_LAUNCH_NOT_AUTHORIZED`

This dossier is an offline, fixture-backed reviewer map for the authenticated private-beta MCP surface. It is not deployment evidence, an OpenAI submission, an approval, or authorization to launch publicly.

## Scope

The candidate inventory is exactly six read-only tools: `search`, `fetch`, and four Twoweeks summary tools. The offline smoke contract requires that exact ordered inventory and requires every descriptor to advertise `readOnlyHint: true`, `destructiveHint: false`, and `openWorldHint: false`.

No scenario below loads live credentials, sends a provider request, writes application data, changes OAuth behavior, or calls the public endpoint. Authenticated route tests use synthetic in-memory bearer-token fixtures to exercise the existing OAuth boundary. The evidence is limited to deterministic tests and source inspection.

## Reviewer scenarios

| ID | Scenario | Expected result | Offline evidence |
| --- | --- | --- | --- |
| P1 | Search the safe summary catalog, then fetch the application-package entry. | Four fixed catalog entries are returned; fetch returns fixed safe metadata plus fixed explanatory text; the summary executor is not called. | `mcpOAuthProductionRouteAdapter.test.ts`: `executes safe search and fetch compatibility tools after bearer token`, including exact text and `content`/`structuredContent` mirror assertions |
| P2 | Read the application-package summary using its canonical safe ref. | One read-only status object is returned; no raw package content, owner identifier, token, provider data, or write effect is exposed. | Parametrized route test: `executes a safe read-only production tools/call summary...` |
| P3 | Read the evidence-graph summary using its canonical safe ref. | Same bounded status envelope and no-leak guarantees as P2. | Same parametrized route test, evidence-graph case |
| P4 | Read the resume-variant-plan summary using its canonical safe ref. | Same bounded status envelope and no-leak guarantees as P2. | Same parametrized route test, resume-variant-plan case |
| P5 | Read the review-cockpit summary using its canonical safe ref. | Same bounded status envelope and no-leak guarantees as P2. | Same parametrized route test, review-cockpit case |
| N1 | Call any summary with a stale or typo ref. | JSON-RPC invalid-arguments error; executor is not called; supplied ref and owner identity are not echoed. | Parametrized route test: `fails stale or typo production summary refs...` |
| N2 | Call an unknown tool name. | Safe unknown-tool error; executor is not called; no token, digest, or owner identity is exposed. | Route test: `fails unknown production tools/call tools distinctly...` |
| N3 | Request public-launch readiness while the surface is private beta. | Request is blocked before MCP policy dispatch and before summary execution. | Route test: `blocks public launch readiness requests before production MCP policy dispatch` |

Supporting negative coverage also rejects malformed arguments and non-allowlisted private-beta identities before summary execution.

## Data inventory

| Surface | Model-visible data | Explicitly excluded |
| --- | --- | --- |
| `tools/list` | Tool name, title, description, schemas, OAuth scope, and read-only annotations. | Runtime handlers, internal tool identifiers, tokens, owner identifiers, provider configuration. |
| `search` | Fixed summary-catalog identifiers, titles, and fixed catalog URLs. The tool mirrors its fixed result list in `structuredContent` and serialized `content[0].text`. | User documents, prompts, provider output, account data, arbitrary URLs. |
| `fetch` | One fixed summary-catalog identifier, title, category, source label `twoweeks_safe_summary_catalog`, explanatory text, and fixed catalog URL. The tool mirrors its fixed entry in `structuredContent` and serialized `content[0].text`. | User documents, prompts, provider output, account data, arbitrary URLs. |
| Four summary tools | Coarse status, canonical safe ref category, update timestamp, and fixed capability flags. | Raw CV, job, proposal, file bytes, prompt text, provider output, email, user ID, OAuth material, write effects. |

For each summary tool, the exact model-visible MCP envelope is `content[0].type`, a fixed status-only `content[0].text`, and `structuredContent.kind`, `status`, `toolName`, optional `summary`, and `version`. When `summary` is present, its allowed top-level fields are `kind`, `allowed`, `status`, exactly one canonical ref, `availability`, `safeCounts`, `safeCategories`, optional `safeFlags`, `updatedAt`, `missingDataReason`, `capabilities`, `modelVisible`, and `version`. The canonical ref exposes `id`, `label`, `status`, `category`, `count`, optional `updatedAt`, and `version`; availability exposes `source`, `ownerState`, and `version`; capabilities expose `ownerResolution`, `dataReads`, `dataWrites`, `handlerExecution`, `productionConnector`, `networkAccess`, `modelCalls`, `writeActions`, `rawDataProjection`, and `version`.

The authoritative leaf schemas are the result types and matching Convex validators in the four files below. Their model-visible container keys are:

| Summary tool | Authoritative schema | `safeCounts` | `safeCategories` / `safeFlags` |
| --- | --- | --- | --- |
| Application package | `my-app/convex/mcpApplicationPackageSummary.ts` | `packages`, `artifacts`, `provenanceLinks`, `reviewItems`, `warnings`, `blockers`, `version` | `packageStatus`, `resumeVariantArtifactStatus`, `coverLetterArtifactStatus`, `version`; no `safeFlags` |
| Evidence graph | `my-app/convex/mcpEvidenceGraphSummary.ts` | `sourceDocuments`, `candidateFacts`, `approvedFacts`, `pendingFacts`, `rejectedFacts`, `restrictedEvidence`, `archivedEvidence`, `provenanceLinks`, `evidenceMatches`, `allowedClaims`, `missingEvidence`, `riskFlags`, `staleSources`, `warnings`, `blockers`, `version` | `evidenceCoverage`, `provenanceCoverage`, `qualityStatus`, `blockerCategory`, `nextReviewHint`, `version`; no `safeFlags` |
| Resume variant plan | `my-app/convex/mcpResumeVariantPlanSummary.ts` | `plans`, `planItems`, `claimBackedItems`, `missingInputItems`, `reviewNeededItems`, `acceptedItems`, `rejectedItems`, `blockedItems`, `warnings`, `blockers`, `restrictedFactBlockers`, `excludedFactBlockers`, `artifactTextBlockers`, `allowedClaims`, `sourceFacts`, `evidenceMatches`, `demands`, `riskFlags`, `version` | `planStatus`, `targetDocumentKind`, `tailoringCompleteness`, `blockerCategory`, `missingInputCategory`, `reviewNeededCategory`, `nextReviewHint`, `version`; no `safeFlags` |
| Review cockpit | `my-app/convex/mcpReviewCockpitSummary.ts` | `reviewContexts`, `reviewRuns`, `reviewArtifacts`, `applicationPackages`, `pendingReviews`, `approvedReviews`, `blockedReviews`, `failedRuns`, `blockedRuns`, `blockedArtifacts`, `blockedPackages`, `missingReviewItems`, `approvalNeeded`, `staleInputs`, `overLimitCollections`, `version` | `reviewReadiness`, `reviewGateStatus`, `blockerCategory`, `missingReviewCategory`, `nextReviewHint`, `nextUserAction`, `version`; `safeFlags`: `approvalNeeded`, `staleData`, `overLimit`, `version` |

The current summary response includes timestamps and internal read-category labels. Their necessity and wording require a separate data-minimization decision before any public submission. Each fixed catalog URL must also be verified as an absolute user-openable HTTP(S) page or changed to an empty URL before submission; this dossier does not claim that the current URLs satisfy that requirement.

## Submission prerequisites

OpenAI's current plugin-submission guidance requires a real publicly reachable non-testing MCP endpoint, verified domain control, organization verification and app-management permissions, a qualifying published privacy policy, OAuth and demo credentials for an authenticated server, tool scanning, complete listing metadata, starter prompts, exactly five positive and three negative reviewer cases, country availability, release notes, policy attestations, and an exact-domain CSP for a plugin containing an app. The submission project must use global data residency; projects with EU data residency are currently ineligible. The portal, automated scan, and manual review remain external gates.

| Area | Current offline status | Required before submission |
| --- | --- | --- |
| Private-beta auth and subject isolation | Covered by existing focused tests; L1 hardening is tracked separately. | Merge and deploy the approved digest-based allowlist migration, then re-prove live auth. |
| Tool inventory and annotations | The L2 CI test proves that the smoke validator rejects fixture inventory drift. The active production projection is separately covered by an authenticated route-adapter `tools/list` production-code-path test using synthetic in-memory fixtures, but that test is not yet part of the L2 CI job. | Add the production projection test to CI before submission, then confirm the deployed endpoint scans to the same exact inventory. |
| Listing metadata and localization | Plugin name, short and long descriptions, logo, category, verified publisher identity, website, support, privacy-policy, terms URLs, and localization information are not finalized by this dossier. | Complete every required public listing and localization field with production-ready assets, translated copy where applicable, and public URLs matching the verified publisher. |
| Privacy policy | Internal policy material exists but no qualifying published policy URL is established here. | Publish and review a policy that states personal-data categories, purposes, recipient categories, retention timelines, and user controls. |
| Output minimization | Raw private content is excluded by tests, and the complete current leaf-key inventory is recorded above. | Review the necessity and privacy-policy treatment of every envelope, ref, availability, count, category, flag, timestamp, missing-data, capability, and fixed-source field listed above; remove unnecessary fields, and verify every catalog URL is user-openable or make it empty. |
| Domain and endpoint | No live check or domain challenge was completed by this dossier. | Use a public, non-testing endpoint, complete the portal's generated domain-verification challenge, and scan the tools again. |
| CSP and UI | No MCP UI resource is claimed by this dossier, but CSP remains a submission requirement for a plugin containing an app. | Define and verify an exact-domain CSP for the submitted app contract. Record screenshots as not applicable only if the submitted app has no UI. |
| Web and mobile | Not run. | Execute reviewer scenarios on supported web and mobile surfaces. |
| Reviewer access | No credentials are stored or documented here. | Provide the portal the configured OAuth client credentials plus a login and password for a fully featured demo account with sample data, no MFA, sign-up, or inaccessible verification step; transmit every credential only through the approved submission secret channel. |
| Prompts and reviewer cases | This dossier maps five positive and three negative scenarios to offline evidence, but it does not provide final user prompts, expected result shapes, negative-case rationales, or reviewer fixture instructions. | Submit exactly five positive and three negative cases with the portal-required prompt/scenario, expected behavior and result shape, reproducible account or fixture data, and, for every negative case, why the plugin must not complete the action. |
| Availability and submission controls | Countries, starter prompts, release notes, and policy attestations are not selected or completed here. | Select only supported countries, finalize realistic starter prompts and release notes, then complete attestations after rechecking the listing, server, tests, and availability. |
| Data residency | Not checked. | Use and verify an OpenAI project with global data residency; EU-data-residency projects are currently ineligible for app review. |
| OpenAI review and approval | Not started. | Submit only after separate public-launch authorization; record the portal result without overstating it. |

## Verification commands

Run from the repository root without loading live credentials. The route cases use synthetic in-memory OAuth fixtures:

```bash
rtk node --test tests/mcp-private-beta-smoke.test.mjs
rtk npm --prefix my-app run test -- \
  src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts --run \
  --testNamePattern='returns authenticated production tools/list metadata only after bearer verification|executes safe search and fetch|executes a safe read-only production tools/call summary|fails stale or typo production summary refs|fails unknown production tools/call tools distinctly|denies non-allowlisted private beta identities before tools/call validation|blocks public launch readiness requests'
rtk npm --prefix my-app run test -- \
  src/modules/local-mcp/__tests__/mcpProductionReadonlySummaryExecutor.test.ts \
  src/modules/local-mcp/__tests__/mcpProductionToolsCallBoundary.test.ts --run
rtk git diff --check
```

## References

- OpenAI Apps SDK, [Prepare and maintain an app for plugin submission](https://developers.openai.com/apps-sdk/deploy/submission)
- ChatGPT Learn, [Submit plugins](https://learn.chatgpt.com/docs/submit-plugins)
- OpenAI Apps SDK, [App guidelines](https://developers.openai.com/apps-sdk/app-guidelines)
- OpenAI Apps SDK, [Build your MCP server](https://developers.openai.com/apps-sdk/build/mcp-server)
- `scripts/mcp-private-beta-smoke.mjs`
- `tests/mcp-private-beta-smoke.test.mjs`
- `my-app/src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts`

## Stop condition

This leaf is complete when the single document is reviewed and its offline evidence passes. Deployment, live endpoint verification, web/mobile validation, portal submission, OpenAI review, approval, and public launch remain separate explicitly authorized changesets.
