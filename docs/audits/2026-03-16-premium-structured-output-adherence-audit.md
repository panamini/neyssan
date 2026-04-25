# Premium Structured Output Adherence Audit

Date: 2026-03-16

## Scope

- premium `cover_letter` only
- ChatGPT / `gpt-5.4` only
- structured body-parts generation contract

## Findings

- Active code: premium generation already asks the writer for `CoverLetterBodyParts` and validates the result against a strict four-field schema in `convex/lib/proposals/premiumCoverLetter.ts`.
- Active code: fallback to legacy happens because `generatePremiumCoverLetterBodyPartsWithOpenAI(...)` throws, which is caught in `generateProposalMutation.ts` and recorded as `premium_generation_failed`.
- The premium prompt was explicit about returning JSON only, but the OpenAI Responses request wrapper was not actually requesting strict schema enforcement.
- In the request body, `text.format.type = "json_schema"` was present, but `strict: true` was missing.
- OpenAI’s structured-output contract treats strictness as opt-in. Without strict enforcement, the model can still drift into a full freeform cover letter despite the prompt asking for JSON body parts.
- The parser then fail-closes by trying to parse the response as JSON body parts. That behavior is consistent with the premium architecture; the narrow problem was that the wrapper did not ask strongly enough for enforced structured output.

## Classification

- Primary: `response-format/wrapper issue`
- Secondary: `narrow recoverability gap`

## Narrow fix

- Keep the premium prompt/body architecture unchanged.
- Keep deterministic rendering unchanged.
- Set `strict: true` on the premium OpenAI `json_schema` response format so premium body-part generation requests exact schema adherence instead of relying on prompt obedience alone.

## Validation

- `npm test -- premiumCoverLetter.test.ts`
- Added a request-shape contract test asserting that premium OpenAI generation now sends strict JSON-schema formatting for `CoverLetterBodyParts`.
