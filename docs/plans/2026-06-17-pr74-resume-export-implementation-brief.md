# PR74 Implementation Brief

## Current PR

- Title: PR74 - Resume Export
- Repository: `panamini/neyssan`
- Base branch: `application-os-foundation`
- Head branch: `codex/pr74-resume-export`
- Start status: `READY_TO_IMPLEMENT`

## Base Preconditions

- PR73 is merged: [#199](https://github.com/panamini/neyssan/pull/199) `PR73: Export/Download Policy Implementation`
- PR73 merge commit: `a0e503d525d944402ce1cdfad312a0de1c3b157c`
- PR73 merged at: `2026-06-17T18:05:12Z`
- Local branch `application-os-foundation` was fast-forward checked against `origin/application-os-foundation`.
- Current branch `codex/pr74-resume-export` starts at `a0e503d525d944402ce1cdfad312a0de1c3b157c`.
- Worktree was clean before this brief was created.
- `stash@{0}: pre-pr61-untracked-docs-quarantine` is present and must remain untouched.

## Roadmap Position

- Phase 10 is the Local MCP generated artifact export/download sequence.
- PR73 provides export/download policy metadata only and is now merged.
- PR74 implements resume-only local export representation for an approved, fresh, policy-allowed resume variant.
- PR75 remains separate for cover letter and application package export behavior.

## Allowed Scope

- Add deterministic local MCP resume export boundary logic.
- Accept only `resume_variant`.
- Require PR73 export/download policy result as input.
- Require explicit human confirmation for resume export.
- Require approved, fresh, retention/delete/rollback-satisfied inputs.
- Produce a controlled local file-export representation for resume content only.
- Keep file payload separate from safe summary, component, model, audit, debug, and bridge surfaces.
- Add exact component data policy keys, enums, and tests only if required by PR74 safe metadata.
- Update the roadmap ledger to mark PR73 merged and PR74 active.

## Forbidden Scope

- No PR75 cover letter or application package export.
- No send, submit, apply, upload, email, external egress, production connector, signed URL, object URL, or filesystem write behavior.
- No package, lockfile, schema, Convex, UI runtime, server runtime, tool registry, or transport changes.
- No PDF, DOCX, binary exporter, dependency addition, or external service.
- No full resume text in safe summary, content metadata, props, bridge state, model context, audit, debug, refusal, or component surfaces.
- Do not restore, inspect, delete, or commit the protected PR61 quarantine stash.

## Proposed Files

- `my-app/src/modules/local-mcp/mcpResumeExport.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpResumeExport.test.ts`
- `my-app/src/modules/local-mcp/mcpComponentDataPolicy.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpComponentDataPolicy.test.ts`
- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-17-pr74-resume-export-implementation-brief.md`

## Verification Plan

- Focused PR74 Vitest coverage.
- Related PR73, PR72, PR71, PR70, PR69, PR68, PR67, and PR65 local MCP tests.
- Full local MCP Vitest suite if focused tests pass.
- `rtk npx tsc --noEmit`
- `rtk npx convex codegen`
- Fallow read-only review on changed code after implementation.
- `rtk git diff --check`
- After PR creation, `rtk gh pr diff --name-only`

## Rollback

- Revert the PR74 branch commit to remove the new resume export boundary, tests, policy surface additions, ledger update, and this brief.
- No runtime schema, dependency, external state, file write, or production connector rollback is expected because those changes are out of scope.
