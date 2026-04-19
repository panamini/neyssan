# Codex Project Instructions

Reference: RTK.md
Required reference path: `@/Users/pana/.codex/RTK.md`

## Project Focus

Treat `v1` as the active development baseline.

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
