# Application Message ChatGPT Quality Audit

Date: 2026-03-17

## Scope

- `application_message` only
- ChatGPT path first
- audit of active generation quality and the narrowest justified fix

## Active code findings

- The active ChatGPT `application_message` path in `convex/generateProposalMutation.ts` was not using the richer format-specific inline writer prompt already built in the mutation.
- Instead, it fell through to `ProposalService.generateCreativeProposal(...)`.
- That service uses the legacy `creative` prompt template in `convex/langchain/prompts/templates/index.ts`, which says:
  - `Write a complete application letter or message body ...`
  - `Keep it natural, specific, and complete.`
- The same ChatGPT path also instantiates `GPT4Adapter`, which currently wraps `ChatOpenAI` with `gpt-3.5-turbo-1106` in `convex/langchain/models/gpt4_adapter.ts`.

## Reviewed output set

Reviewed saved real outputs from:

- `application-strong-support`
- `application-adjacent-admin`
- `application-no-context-support`

Representative outputs:

- `application-strong-support / gpt-4o-mini`
  - `I am excited to apply ... I believe my experience aligns well with your needs ...`
- `application-adjacent-admin / gpt-5-nano`
  - `I excel at organizing schedules ...`
- `application-no-context-support / gpt-5-nano`
  - `I will support the team by ensuring that information is accurately tracked ...`

## Quality conclusion

- The mode is materially weaker than premium `cover_letter`.
- The dominant visible issue is that it reads like a mini cover letter or a generic profile blurb rather than a concise native application message.
- Secondary issue:
  - the no-context case overreaches into unsupported contribution language
- Primary layer:
  - prompt/body-contract issue
- Secondary layer:
  - routing/wiring mismatch inside the ChatGPT path, because the format-specific inline prompt existed but was not being used.

## Narrow fix

- Keep the ChatGPT branch.
- For `application_message`, route ChatGPT generation through the existing inline application-message prompt instead of the legacy creative-proposal service.
- Do not redesign routing, fallback, parsing, or model selection in this patch.
