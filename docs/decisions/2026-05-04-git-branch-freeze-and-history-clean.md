# Decision: Keep Backup Branches as Protected Until Product Completion

Date: 2026-05-04
Status: Accepted
Owner: user-confirmed cleanup policy

## Scope

- Branch hygiene review in repository `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan`
- Verification of active history state before removing/merging branches
- Documentation of the current branch freeze policy

## What Was Verified

### 1) Working tree / sync state

- Current branch: `main`
- `git status --short --branch`:
  - `## main...origin/main`
- Interpretation: working tree is clean; no local uncommitted changes on `main`, and local `main` is aligned with `origin/main`.

### 2) Branch inventory

- Local branches:
  - `main`
  - `backup/main-before-pr1-merge-2026-04-29`
  - `backup/pre-align-20260501-180702`
  - `codex/secure-history-backup-620e01efd`
- Remote branches:
  - only `origin/main`

### 3) Merge analysis

- `git branch --merged main`:
  - `backup/main-before-pr1-merge-2026-04-29` (merged)
  - `codex/secure-history-backup-620e01efd` (merged)
- `git branch --no-merged main`:
  - `backup/pre-align-20260501-180702` (not merged)
- `git rev-list --left-right --count main...<branch>`:
  - `main...backup/main-before-pr1-merge-2026-04-29` -> `101 0` (only main has extra)
  - `main...codex/secure-history-backup-620e01efd` -> `9 0` (only main has extra)
  - `main...backup/pre-align-20260501-180702` -> `52 1` (branch has 1 non-main commit)

### 4) Why the single unique commit is not an active blocker yet

- `backup/pre-align-20260501-180702` contains old history/repository-shape cleanup plus
  `.gitignore` additions for sensitive env paths.
- A modern history path already contains the security-related ignore adjustments (including env hygiene work) in active commits.
- The unique commit there is therefore not required for current production flow and mainly exists as an archival cleanup point.

## Decision (requested)

- Do not delete any backup branches yet.
- Keep the following branches frozen as recovery/reference points:
  - `backup/main-before-pr1-merge-2026-04-29`
  - `codex/secure-history-backup-620e01efd`
  - `backup/pre-align-20260501-180702`
- Deletion is deferred "until end-product safe," as a reversible rollback/inspection path during the last-mile validation window.

## Risk Notes

- The repository currently has divergent historical branches; automatic cleanup is intentionally deferred to avoid losing recovery context.
- This freeze is temporary and tied to the current stabilization window. Once end-product safety is confirmed, a separate cleanup pass can remove branches that are no longer useful.
