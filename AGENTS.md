# Codex Project Instructions

## Baseline
- Treat `v1` as the active development baseline.
- Prioritize the product goal:
  - CV ingestion/parsing -> canonical saved profile/CV data -> personalized proposal generation.

## Scope Control
- Do not perform large architectural rewrites unless explicitly requested.
- Prefer small, testable, reversible changes.

## Architecture Authority Rules
When making architecture decisions, treat the following as non-authoritative or obsolete by default:
- `pdf-ingest/`
- spaCy/training-oriented legacy parser code
- `*.bak` files
- backup component trees
- archive folders

## Documentation Requirements
- For audits: save a Markdown report under `docs/audits/`.
- For technical decisions: document them under `docs/decisions/`.
- For implementation plans: save them under `docs/plans/`.


## Skills
@everything-claude-code/skills
## Ambiguity Handling
When uncertainty exists, explicitly classify findings as:
- active code
- legacy but informative code
- obsolete/dead code

Do not present assumptions as settled facts. Mark uncertainty clearly.
# Testing Guidelines

## Framework

- We use Playwright with TypeScript for all e2e tests.
- Tests live in the `tests/` directory.
- Page objects are in `tests/pages/`.

## Conventions

- Use `test.describe` blocks to group related tests.
- Use role-based locators (`getByRole`, `getByLabel`, `getByTestId`) over CSS selectors.
- Every test must have a meaningful name describing the user action and expected result.
- Use `test.beforeEach` for common navigation and setup.

## Running tests

- Run all tests: `npx playwright test`
- Run specific file: `npx playwright test tests/checkout.spec.ts`
- Run in headed mode: `npx playwright test --headed`

## Dependencies

- Run `npm ci` to install all dependencies.
- Run `npx playwright install --with-deps` to install browser binaries.

## Test reporting

- We use TestDino for test result reporting.

- Reporter is configured in playwright.config.ts.

- Environment variable TESTDINO_TOKEN must be set before running tests.

- Use `npx tdpw test` to run tests with reporting enabled.