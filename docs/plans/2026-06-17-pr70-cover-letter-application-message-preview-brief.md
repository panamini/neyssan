# PR70 Implementation Brief

PR: PR70 - Cover Letter / Application Message Preview

Base branch: `application-os-foundation`

Head branch: `codex/pr70-cover-letter-application-message-preview`

Controlling roadmap section:
`docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`,
Phase 9, PR70.

Current repo state:
- `origin/application-os-foundation` includes PR69 merge commit `676592c0cba3c1fca94ec2f2e9e576c67f5dd70a`.
- GitHub PR #195 is merged.
- Working tree was clean before branch creation.
- `stash@{0}: pre-pr61-untracked-docs-quarantine` exists and was not touched.

Allowed scope:
- Add deterministic local MCP preview boundary logic for cover letter preview and application message preview.
- Keep previews human-review-required and not approved for export, download, send, submit, or apply.
- Construct restricted generated artifacts internally and pass them through the PR68 generated artifact boundary.
- Return only safe summary metadata, refs, counts, flags, categories, and action labels.
- Add fail-closed validation for malformed, hostile, or unsafe input.
- Update PR65 component data policy only for exact PR70 safe enum/key support.
- Update the roadmap progress ledger for PR69 merged and PR70 active.

Forbidden scope:
- No PR71 human approval workflow or PR72 revision loop.
- No export, download, send, submit, apply, or persistence writes.
- No UI, React, iframe, bridge, runtime, server, route, listener, tools/list, or tools/call wiring.
- No Convex schema or mutation/action changes.
- No outbound HTTP, LLM/model calls, prompt templates, package changes, or lockfile changes.
- No raw CV/resume/job/proposal/application/cover-letter text, source quotes, private facts, never_use facts, identity fields, tokens, raw claims, Convex document IDs, raw debug payloads, raw `_meta`, or full generated artifacts in returned outputs.

Files proposed to touch:
- `docs/plans/2026-06-17-pr70-cover-letter-application-message-preview-brief.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `my-app/src/modules/local-mcp/mcpComponentDataPolicy.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpComponentDataPolicy.test.ts`
- `my-app/src/modules/local-mcp/mcpCoverLetterApplicationMessagePreview.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpCoverLetterApplicationMessagePreview.test.ts`

Files forbidden to touch:
- package and lock files.
- Convex schema files.
- runtime, route, listener, transport, tools/list, tools/call, UI, React, iframe, and widget files.
- PR68 and PR69 modules/tests unless strict integration proves necessary.

Expected tests:
- Focused PR70 Vitest coverage for cover letter and application message previews, safe projection, unsafe input refusal, hostile object refusal, determinism, and source guards.
- PR65 component data policy regression for PR70 safe enum/key support.
- Nearby PR68, PR69, and PR67 local MCP regression tests.
- Full local MCP test suite.

Expected grep/source guards:
- Raw source checks for forbidden package/schema/runtime imports.
- Stripped source checks for browser/runtime, network, model, Convex write, export/download/send/submit/apply, PR71 approval workflow, PR72 revision loop, resume-variant/review-notes generation, and prompt-template tokens.

Acceptance criteria:
- Cover letter preview returns only safe PR68-projected summary surfaces.
- Application message preview is represented as a restricted `application_package` generated artifact and returns only safe PR68-projected summary surfaces.
- Full draft bodies exist only before PR68 projection and never appear in model-visible, component-visible, `_meta`, content, props, bridge payload, state snapshot, model-context update, refusal, or serialized result surfaces.
- All preview outputs remain deterministic, local-only, human-review-required, and blocked for export/download/send/submit/apply.
- Local verification passes before PR creation.

Rollback plan:
- Revert the PR70 module, PR70 test, PR65 policy enum/key additions, policy regression test additions, brief, and ledger entry.
- No data migration, package change, schema change, or runtime cleanup is required.

Final status: READY_TO_IMPLEMENT
