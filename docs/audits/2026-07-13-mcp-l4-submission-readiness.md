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

This dossier is an offline reviewer map for the authenticated private-beta MCP surface. It is not deployment evidence, an OpenAI submission, an approval, or authorization to launch publicly.

## Scope

The candidate inventory is exactly six read-only tools: `search`, `fetch`, and four Twoweeks summary tools. The offline smoke contract requires that exact ordered inventory and requires every descriptor to advertise `readOnlyHint: true`, `destructiveHint: false`, and `openWorldHint: false`.

No scenario below uses credentials, sends a provider request, writes application data, changes OAuth behavior, or calls the public endpoint. The evidence is limited to existing deterministic tests and source inspection.

## Reviewer scenarios

| ID | Scenario | Expected result | Offline evidence |
| --- | --- | --- | --- |
| P1 | Search the safe summary catalog, then fetch the application-package entry. | Four fixed catalog entries are returned; fetch returns only fixed safe metadata; the summary executor is not called. | `mcpOAuthProductionRouteAdapter.test.ts`: `executes safe search and fetch compatibility tools after bearer token` |
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
| `search` / `fetch` | Fixed summary-catalog identifiers, titles, categories, and fixed catalog URLs. | User documents, prompts, provider output, account data, arbitrary URLs. |
| Four summary tools | Coarse status, canonical safe ref category, update timestamp, and fixed capability flags. | Raw CV, job, proposal, file bytes, prompt text, provider output, email, user ID, OAuth material, write effects. |

The current summary response includes timestamps and internal read-category labels. Their necessity and wording require a separate data-minimization decision before any public submission. The fixed catalog URLs also require a separate reviewer-usability decision; this dossier does not claim that they are user-openable pages.

## Submission prerequisites

OpenAI's current submission guidance requires a real publicly reachable non-testing MCP endpoint, organization verification and app-management permissions, a qualifying published privacy policy, tool scanning, test prompts and responses, localization information, and an exact-domain CSP for a plugin containing an app. The submission project must use global data residency; projects with EU data residency are currently ineligible. The portal, automated scan, and manual review remain external gates.

| Area | Current offline status | Required before submission |
| --- | --- | --- |
| Private-beta auth and subject isolation | Covered by existing focused tests; L1 hardening is tracked separately. | Merge and deploy the approved digest-based allowlist migration, then re-prove live auth. |
| Tool inventory and annotations | Enforced by the L2 offline CI contract. | Confirm the deployed endpoint scans to the same exact inventory. |
| Privacy policy | Internal policy material exists but no qualifying published policy URL is established here. | Publish and review a policy that states personal-data categories, purposes, recipient categories, retention timelines, and user controls. |
| Output minimization | Raw private content is excluded by tests. | Resolve whether timestamps, read-category labels, and fixed catalog URLs are necessary. |
| Domain and endpoint | No live check in this dossier. | Use a public, non-testing endpoint and complete portal tool scanning. |
| CSP and UI | No MCP UI resource is claimed by this dossier, but CSP remains a submission requirement for a plugin containing an app. | Define and verify an exact-domain CSP for the submitted app contract. Record screenshots as not applicable only if the submitted app has no UI. |
| Web and mobile | Not run. | Execute reviewer scenarios on supported web and mobile surfaces. |
| Reviewer access | No credentials are stored or documented here. | Provide the portal a login and password for a fully featured demo account with sample data, no MFA, sign-up, or inaccessible verification step; transmit them only through the approved submission secret channel. |
| Data residency | Not checked. | Use and verify an OpenAI project with global data residency; EU-data-residency projects are currently ineligible for app review. |
| OpenAI review and approval | Not started. | Submit only after separate public-launch authorization; record the portal result without overstating it. |

## Verification commands

Run from the repository root without loading credentials:

```bash
rtk node --test tests/mcp-private-beta-smoke.test.mjs
rtk npm --prefix my-app run test -- \
  src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts --run \
  --testNamePattern='executes safe search and fetch|executes a safe read-only production tools/call summary|fails stale or typo production summary refs|fails unknown production tools/call tools distinctly|blocks public launch readiness requests'
rtk npm --prefix my-app run test -- \
  src/modules/local-mcp/__tests__/mcpProductionReadonlySummaryExecutor.test.ts \
  src/modules/local-mcp/__tests__/mcpProductionToolsCallBoundary.test.ts --run
rtk git diff --check
```

## References

- OpenAI Apps SDK, [Prepare and maintain an app for plugin submission](https://developers.openai.com/apps-sdk/deploy/submission)
- OpenAI Apps SDK, [App guidelines](https://developers.openai.com/apps-sdk/app-guidelines)
- OpenAI Apps SDK, [Build your MCP server](https://developers.openai.com/apps-sdk/build/mcp-server)
- `scripts/mcp-private-beta-smoke.mjs`
- `tests/mcp-private-beta-smoke.test.mjs`
- `my-app/src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts`

## Stop condition

This leaf is complete when the single document is reviewed and its offline evidence passes. Deployment, live endpoint verification, web/mobile validation, portal submission, OpenAI review, approval, and public launch remain separate explicitly authorized changesets.
