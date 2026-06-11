# PR24 - MCP Privacy / Redaction Fixtures

Date: 2026-06-11
Status: implemented
Scope: pure TypeScript fixture and assertion helpers for Local MCP privacy redaction.

## Objective

Add reusable test fixtures that prove Local MCP safe outputs do not expose forbidden privacy material.

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
