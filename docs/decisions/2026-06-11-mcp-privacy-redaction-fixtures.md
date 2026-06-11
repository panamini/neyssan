# PR24 - MCP Privacy / Redaction Fixtures

Date: 2026-06-11
Status: implemented
Scope: pure TypeScript fixture and assertion helpers for Local MCP privacy redaction.

## Objective

Add reusable test fixtures that prove Local MCP safe outputs do not expose forbidden privacy material.

## Product Privacy Boundary Clarification

PR24 must not be interpreted as a global product ban on generating, storing, previewing, or returning a complete resume/CV or cover letter.

The privacy checker added in this PR applies only to Local MCP safe outputs and other output-like objects that may be exposed outside Twoweeks as summaries, errors, audit-safe messages, dry-run results, schema previews, diagnostic output, or fixture output.

Allowed future product behavior, out of scope for PR24:

- the user may request a job search;
- Twoweeks may use the user's approved career context and the selected job context;
- Twoweeks may generate a complete tailored resume/CV and cover letter;
- the user may view, edit, copy, export, or send those generated artifacts in a future dedicated PR;
- ChatGPT, Claude, MCP, or another assistant may receive bounded tool results or artifact references according to the approved integration design.

Privacy rule:

- raw source documents, raw resume/CV text, raw arguments, private facts, `never_use` facts, secrets, session details, stack traces, sourceQuote dumps, and complete generated resume/cover letter text must not appear in generic safe outputs, logs, errors, summaries, audit-safe messages, schema projections, or dry-run summaries;
- complete generated resume/cover letter text may only appear in an explicitly user-authorized generation/artifact surface designed for that purpose;
- future PRs must define that dedicated artifact boundary separately.

PR24 does not implement the artifact boundary. The fixture wording and tests are scoped to Local MCP safe outputs and must not be read as banning the core Twoweeks job-application workflow.

## Delivered

- Closed privacy sentinel categories.
- Recursive output-like value checks over strings, arrays, plain objects, and object keys.
- Safe assertion helper with category-only error text.
- Deterministic text redaction helper.
- Bounded safe output builder and deliberately unsafe fixture builder.
- Integration tests against PR19 error results and PR20 safe argument summaries.

## Non-goals

- No runtime sanitizer.
- No ChatGPT App.
- No MCP server.
- No real handlers.
- No export, send, submit, or apply behavior.
- No product runtime, route, Convex, transport, OAuth, network, or UI changes.

## Fixture Categories

- `private_fact`
- `never_use_fact`
- `raw_source_document`
- `raw_resume_text`
- `source_quote_dump`
- `raw_arguments`
- `secret`
- `session_detail`
- `stack_trace`
- `generated_full_text`

## Redaction Check Model

The checker scans only bounded strings and object keys for exact sentinel values. It does not stringify whole payloads, does not dump raw values into findings, and tolerates circular references.

## Integration Points

The fixtures are test-oriented and can be reused by future Local MCP policy modules. They currently validate existing PR19 error tool results and PR20 safe argument summaries.

## Risks

- The fixtures prove sentinel absence, not full semantic privacy.
- Future output schemas need dedicated tests that use this checker.
- This is not a production privacy filter.

## Tests

Run:

```txt
rtk npx vitest --run src/modules/local-mcp/__tests__/privacyRedactionFixtures.test.ts
rtk npx vitest --run src/modules/local-mcp/__tests__/*.test.ts
rtk npx tsc --noEmit
rtk git diff --check
```

## Rollback

Rollback is deletion-only:

- `docs/decisions/2026-06-11-mcp-privacy-redaction-fixtures.md`
- `my-app/src/modules/local-mcp/privacyRedactionFixtures.ts`
- `my-app/src/modules/local-mcp/__tests__/privacyRedactionFixtures.test.ts`
