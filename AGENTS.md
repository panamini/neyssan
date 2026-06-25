# Codex Project Instructions

Reference: RTK.md
Required reference path: `@/Users/pana/.codex/RTK.md`

## Project Focus

Treat `v1` as the active development baseline.

## Shared Project Memory

The canonical shared memory vault for twoweeks/Neyssan context is:

`/Volumes/video/git/twoweeks-wiki` (configured for this environment; configurable if needed, e.g. `../twoweeks-wiki`)

Before non-trivial product, design, architecture, parser, jobs, proposal, resume, export, brand, or local workflow work, read the vault in this order:

1. `TWOWEEKS_WIKI_PATH/WIKI_SCHEMA.md`
2. `TWOWEEKS_WIKI_PATH/AGENTS.md` and/or `TWOWEEKS_WIKI_PATH/CLAUDE.md`
3. `TWOWEEKS_WIKI_PATH/wiki/hot.md` if present
4. `TWOWEEKS_WIKI_PATH/wiki/index.md`
5. 1-3 targeted current durable pages found through `hot.md` / `index.md`
6. recent `TWOWEEKS_WIKI_PATH/wiki/log.md` entries only when history matters

Set `TWOWEEKS_WIKI_PATH` to your local twoweeks wiki path for portability.
If `wiki/hot.md` is missing in a worktree, fall back to `TWOWEEKS_WIKI_PATH/WIKI_SCHEMA.md`, then `TWOWEEKS_WIKI_PATH/CLAUDE.md`, then `TWOWEEKS_WIKI_PATH/wiki/overview.md` and `TWOWEEKS_WIKI_PATH/wiki/index.md`.
Do not read the whole wiki blindly. Treat `wiki/hot.md` as a routing cache, not truth. If `hot.md` conflicts with current durable pages, trust the durable page.
Do not mutate `twoweeks-wiki` unless the task is explicitly memory/wiki update, ingest, lint, or save-output. If mutating it, follow its `CLAUDE.md` / `SKILL.md` write-time contract and update `wiki/index.md`, `wiki/log.md`, and `wiki/hot.md` when the contract requires it.

Optimize for the core product flow:

1. CV ingestion/parsing
2. canonical saved profile/CV data
3. personalized proposal generation

Prefer work that directly improves or protects this end-to-end path.

## Operating Rules

- Prefer small, testable, reversible changes.
- Do not perform large architectural rewrites unless explicitly requested.
- Do not present assumptions as facts. Mark uncertainty clearly.
- Inspect the active code path before proposing or making changes.
- Prefer the smallest change that solves the actual issue.
- Preserve existing patterns unless they directly block the task.
- Avoid reviving legacy parser or ingest paths without explicit approval.
- Do not remove or repurpose the `docs/` or `tests/` directories.

## Shell And Tooling

- `rtk` is mandatory for shell commands.
- Prefer `rtk rg` and `rtk rg --files` for search.
- Prefer existing project scripts over ad hoc commands when both are available.
- If a command must bypass `rtk`, explain why in the final response.
- Use the narrowest command that can prove or disprove the current hypothesis.
- Do not run broad or destructive commands unless the task explicitly requires them.

## Browser Policy

When browser automation or inspection is needed, use this order of preference:

1. the current Codex runtime's built-in browser tooling, if it is available and can complete the task
2. a headless browser session
3. headless Playwright

Additional rules:

- Do not use a headed browser unless the user explicitly asks for it.
- Prefer installed Chrome or Chrome Canary for headless browser runs when a real browser is needed.
- Prefer reproducible browser checks over manual visual inspection.
- For end-to-end coverage, default to Playwright with TypeScript.
- Choose one browser strategy and stay within that execution boundary unless it is proven unavailable.
- If the chosen browser path cannot reach the target page or environment, say so clearly instead of pretending verification happened.
- For browser-only issues, verify with rendered-page evidence when possible:
  - DOM structure
  - relevant attributes
  - computed layout values
  - console errors
  - network failures when relevant
- If browser-based verification was required but not run, state that clearly.

## Codebase Authority

Assume the following are non-authoritative by default unless current call sites prove otherwise:

- `pdf-ingest/`
- spaCy or training-oriented legacy parser code
- `*.bak` files
- backup component trees
- archive folders

When reporting findings, classify each relevant area as one of:

- active code
- legacy but informative code
- obsolete/dead code

Use current imports, current call sites, runtime behavior, and active tests to determine what is authoritative.

## Change Strategy

- Start by identifying the live code path before changing anything.
- Prefer the smallest change that solves the actual issue.
- Keep changes local unless the task clearly requires a broader edit.
- Do not broaden scope during debugging without a concrete reason.
- If a temporary diagnostic is added, remove it before finishing unless the user asks to keep it.
- Do not make blind patches when runtime verification is realistically available.

## Documentation Outputs

- Audits go in `docs/audits/`.
- Technical decisions go in `docs/decisions/`.
- Implementation plans go in `docs/plans/`.
- Keep documents short, concrete, and tied to the active code path.

Suggested filename style:

- `docs/audits/YYYY-MM-DD-topic.md`
- `docs/decisions/YYYY-MM-DD-topic.md`
- `docs/plans/YYYY-MM-DD-topic.md`

## Testing Guidelines

### Framework

- Use Playwright with TypeScript for end-to-end tests.
- Store tests in `tests/`.
- Store page objects in `tests/pages/`.

### Conventions

- Use `test.describe` to group related tests.
- Use `test.beforeEach` for shared navigation and setup.
- Prefer role-based locators such as `getByRole`, `getByLabel`, and `getByTestId` over CSS selectors.
- Give every test a specific name describing the user action and expected result.

### Execution

- Run tests with `rtk npx tdpw test`.
- When adding or changing behavior, run the narrowest relevant test scope first, then broaden if needed.
- When fixing a browser-facing bug, do not treat non-browser evidence as sufficient if the issue specifically depends on rendered browser behavior.

## Reporting Rules

When reporting findings:

- Separate confirmed facts from inference.
- Name the exact file, component, route, script, or test path involved.
- State what was verified and what remains uncertain.
- Do not describe legacy behavior as current behavior without proof.
- If blocked, state the exact boundary:
  - missing tool capability
  - environment access failure
  - unavailable runtime path
  - missing project dependency

Preferred wording examples:

- `This is active code.`
- `This appears to be legacy but informative.`
- `This looks obsolete/dead unless a current call site proves otherwise.`
- `I could not verify this in a browser from the current execution boundary.`

## Review guidelines

For PR, diff, branch, worktree, or changeset review, act as a high-signal senior reviewer. Review only the changed artifact plus the surrounding active code needed to prove impact.

Prioritize concrete regressions:

- runtime correctness
- security, auth, privacy, secrets, permissions, and data exposure
- data integrity, schema compatibility, migrations, persistence, and Convex query boundaries
- async, lifecycle, concurrency, stale closure, and state bugs
- API, MCP, local workflow, parser, proposal, resume, export, and public contract drift
- feature flag, environment, staging/production, and client/server boundary drift
- unbounded reads, expensive queries, and performance cliffs that create real product risk
- missing or misleading tests for changed behavior
- docs/runtime contradictions when the document is authoritative for the changed contract

Default to P0/P1 findings only. Include P2 only when explicitly requested. Do not report style, naming, formatting, broad cleanup, or subjective architecture comments unless they create a concrete bug or regression risk.

Every finding must include:

- severity: P0, P1, or explicitly requested P2
- exact file and line/range or changed hunk
- the changed code that introduced or exposed the risk
- proof from active code, call sites, tests, types, schema, config, runtime behavior, or authoritative docs
- concrete failure scenario
- smallest safe fix
- test to add/update, or proof an existing test already covers it

Drop findings that are speculative, weakly grounded, outside the diff, based on obsolete/dead code, or not actionable. Prefer `No P0/P1 issues found.` over noisy comments.

For substantial shared-code changes, run Fallow in read-only advisory mode when available, but do not apply its fixes unless explicitly requested.

If there are no P0/P1 issues, say:

"No P0/P1 issues found."

## Execution Discipline

- Do not simulate certainty.
- Do not claim runtime verification without runtime evidence.
- Do not switch tools or execution boundaries mid-investigation unless the current path is proven unavailable.
- Do not ask unnecessary follow-up questions when the repository or runtime can answer them directly.
- Stop once the task is solved and verified at the correct boundary.

## Default Workflow

For most tasks, follow this order:

1. identify the active `v1` path
2. inspect the current implementation
3. confirm the real boundary where the issue exists
4. make the smallest viable change
5. run the narrowest relevant verification
6. broaden verification only if needed
7. report what changed, what was verified, and any remaining uncertainty

Before pushing a branch, opening a PR, or merging after substantial implementation work, run Fallow in read-only review mode on the changed code. Treat Fallow as an advisory report only. Do not apply its fixes unless explicitly requested. Skip this for tiny localized edits unless they touch shared, public, or dependency-facing code.

## Non-Goals Unless Explicitly Requested

- large architectural rewrites
- reviving archived or backup implementations
- broad parser retraining work
- speculative cleanup outside the task scope
- replacing active flows with legacy ones

## Skills

- `@everything-claude-code/skills`
- `@/Users/pana/.codex/RTK.md`

Use them in ways that support the active `v1` path and the scope limits above.
