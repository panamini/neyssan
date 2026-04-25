# Premium Structured Output Runtime Envelope Audit

Date: 2026-03-17

## Scope

- premium `cover_letter` only
- ChatGPT / `gpt-5.4` only
- structured body-parts request/response handling

## Findings

- Active code: all premium presets share the same runtime path. `signature` and `expert` both call `generatePremiumCoverLetterBodyPartsWithOpenAI(...)` through the same writer slot in `generateProposalMutation.ts`.
- Active code: the live premium request path now includes `strict: true`, so the remaining failures are not explained by a missing strict-schema request on the path currently in use.
- Active code: the SDK path was still using `client.responses.create(...)` plus a custom extractor instead of the SDK’s `responses.parse(...)` structured-output helper.
- Active code: the custom extractor was brittle. It attempted `JSON.parse(...)` on the first `item.text` / `item.output_text` string it saw and threw immediately if that string was plain prose, even if the same envelope also contained parseable structured content elsewhere.
- Therefore the narrow remaining issue was at the parser/output-shape boundary, not premium eligibility, routing, or preset wiring.

## Classification

- Primary: `parser/output-shape issue`
- Secondary: `response-format/wrapper issue`

## Narrow fix

- Use the OpenAI SDK structured parser on the SDK path via `client.responses.parse(...)` with `zodTextFormat(...)`.
- Keep the fetch fallback path, but make the custom extractor tolerant of mixed envelopes by:
  - preferring `output_parsed`
  - accepting `item.parsed`
  - continuing past non-JSON plain-text items instead of failing immediately

## Validation

- `npm test -- premiumCoverLetter.test.ts`
- Added focused tests covering:
  - strict request contract
  - `output_parsed` extraction
  - mixed-envelope scanning after plain prose in an earlier content item
