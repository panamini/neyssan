# Post-merge Stage 3 MCP proof

Date: 2026-07-02
Branch: `codex/mcp-stage3-postmerge-proof`
Base: `application-os-foundation`
Change Contract: `CC-20260702-mcp-stage3-postmerge-proof v1`
Scope: local synthetic proof for merged PR302 Stage 3 MCP read-side materialization

## Status banner

This PR is proof-only.

This PR grants no runtime permission.

This PR grants no production permission.

This PR grants no public-launch permission.

This PR grants no provider-call, write-action, refresh-token, billing, entitlement, account-link lifecycle, migration, schema, dependency, or lockfile permission.

The separate `twoweeks-wiki` roadmap still needs a wiki-only truth-sync changeset if durable cross-repo roadmap state should mention PR302.

## Live baseline

- `origin/application-os-foundation`: `262444e5ea4ed24e493fd93599452ddb56a0c317`
- PR302 state: merged into `application-os-foundation`
- PR302 head: `2ced854ff64d2707c73b97e827297f2d2fe3306b`
- PR302 merge commit: `262444e5ea4ed24e493fd93599452ddb56a0c317`
- Dirty saved checkout: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan-new` was not used for edits because it had pre-existing unrelated changes.
- Isolated proof worktree: `/Users/pana/.codex/worktrees/2623/neyssan-new`

## Active code path

This proof targets active merged code:

- `my-app/convex/mcpReadSideMaterialization.ts`
- `my-app/convex/createProposalPublic.ts`
- `my-app/convex/updateProposalPublic.ts`
- `my-app/convex/deleteProposalPublic.ts`
- `my-app/convex/proposals.ts`
- `my-app/convex/__tests__/mcpReadSideMaterialization.test.ts`

Legacy parser, `pdf-ingest/`, backup files, and archive folders are not part of this proof.

## Proof coverage

The merged Stage 3 materialization suite covers and asserts these local synthetic behaviors:

- internal proposal save creates a safe `applicationContexts` row and `applicationPackages` row;
- direct materialization creates owner-bound context/package rows without embedding raw CV, job, proposal, model, email, Clerk, or URL secret fragments;
- repeated materialization reuses the same deterministic context/package;
- content-only or formatting-only proposal updates refresh the package content hash and freshness timestamps;
- invalid/non-normalizable job ids delete stale deterministic packages instead of calling `db.get` with legacy external ids;
- deleted jobs delete stale packages and orphan contexts;
- deleted owner profiles delete stale packages and orphan contexts;
- owner-mismatched jobs do not materialize cross-owner packages;
- proposal deletion removes the derived package and deletes the context only when no package, run, or artifact still references it;
- best-effort failures remain non-blocking and emit generic, payload-free warning metadata;
- the materialization producer stays free of generated API imports, `ctx.runMutation`, `ctx.runAction`, `fetch`, provider, token, and secret execution surfaces.

## Local evidence commands

Run from `my-app/` in the isolated worktree:

```bash
rtk npx vitest --run convex/__tests__/mcpReadSideMaterialization.test.ts
rtk npx vitest --run convex/__tests__/mcpApplicationPackageSummary.test.ts convex/__tests__/mcpReadOnlyTwoweeksDataRefs.test.ts convex/__tests__/mcpReviewCockpitSummary.test.ts
rtk npx tsc -p tsconfig.node.json --pretty false
rtk npx convex codegen --dry-run --typecheck disable
```

Run from the repo root:

```bash
rtk git diff --check
```

## Local evidence status

The isolated worktree had no installed dependencies. For verification only, `my-app/node_modules` was temporarily symlinked to an existing sibling worktree dependency tree and left ignored by Git.

- `rtk npx tsc -p tsconfig.node.json --pretty false`: passed.
- `rtk git diff --check`: passed.
- `rtk npx convex codegen --dry-run --typecheck disable`: blocked before generation because no `CONVEX_DEPLOYMENT` is set.
- `rtk npx vitest --run convex/__tests__/mcpReadSideMaterialization.test.ts`: blocked before test collection because ignored `convex/_generated/server` files are absent.
- `rtk npx vitest --run convex/__tests__/mcpApplicationPackageSummary.test.ts convex/__tests__/mcpReadOnlyTwoweeksDataRefs.test.ts convex/__tests__/mcpReviewCockpitSummary.test.ts`: blocked before test collection for the same missing `convex/_generated/server` baseline.

The repository CI generates `convex/_generated` with `CONVEX_DEPLOY_KEY` before running JavaScript tests. This proof did not use deployment secrets or generate local Convex files.

## Limitations

- This proof uses local synthetic fixtures only.
- This proof does not call providers, outbound HTTP, model APIs, production Convex, shared databases, or real user data.
- This proof does not update the separate `twoweeks-wiki` repository.
- This proof does not mark the branch ready for review and does not merge it.

## Recovery

Revert this proof PR's commit or remove this markdown file plus the added focused regression test. No runtime rollback is required because this PR changes no production behavior.
