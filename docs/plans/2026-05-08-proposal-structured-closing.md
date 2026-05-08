# Proposal Structured Closing Plan

## Context

The supplied plan is architecturally sound: proposal signature visibility should not depend on generated prose containing a parsable closing. In the active code, the fragility is visible in the current path:

- `my-app/src/components/proposal-render/ProposalDocumentRenderer.tsx` parses `content` via `parseProposalDocumentContent()`, and `buildProposalDocumentBlocks()` only emits a closing block when `parsedDocument.signOff || parsedDocument.signatureName` exists.
- `renderSignature()` returns `null` without a parsed `signatureName`, so configured Settings signature styles are unused when generated body text has no closing.
- `my-app/src/lib/document-export-models.ts` builds export body blocks from parsed content with `buildProposalBodyBlocks()`, so export/DOCX/PDF parity inherits the same parser dependency.
- `my-app/src/lib/proposal-output-draft.ts`, `my-app/src/pages/ProposalForge.tsx`, and Convex proposal metadata currently persist style/header state, but no document-owned closing state.
- `my-app/convex/lib/proposals/proposalRenderer.ts` already has deterministic sign-off defaults (`ENGLISH_SIGNOFFS`, `FRENCH_SIGNOFFS`) but currently composes them into text for cover letters; the implementation should move that authority into structured proposal document data for renderer/export parity.

## Approach

Introduce a structured, sanitized proposal closing model owned by the proposal document. Treat prose parsing as a legacy migration/fallback only. The renderer, print route, and export models should consume the same structured closing state and render the configured Settings signature style whenever `closing.enabled` is true and a signature name can be resolved.

Recommended shape:

```ts
type ProposalClosingSource = "settings" | "document" | "legacy";

type ProposalClosingRef = {
  enabled: boolean;
  signOff: string;
  signatureName: string;
  source: ProposalClosingSource;
};
```

Defaults should be resolved from existing data:

- `enabled: true` for cover letters; likely `false` or omitted for short application messages/freelance proposals unless product wants signatures there too.
- `signOff`: locale + voice/template default from existing `ENGLISH_SIGNOFFS` / `FRENCH_SIGNOFFS` behavior.
- `signatureName`: proposal applicant/profile name, falling back to parsed legacy signature if present.
- `source: "settings"` for default-linked closing, `"document"` for future local overrides, `"legacy"` when migrated from parsed content.

## Files to modify

- `my-app/src/lib/proposal-closing.ts` — add `ProposalClosingRef`, sanitizer/resolver helpers, defaults, and legacy extraction helpers.
- `my-app/src/components/proposal-render/ProposalDocumentRenderer.tsx` — accept `closing`/`documentClosing` prop; build closing blocks from structured data instead of only parsed content.
- `my-app/src/lib/document-export-models.ts` — add closing to preview/print/export source types and build `ProposalPrintBlock` closing from structured data.
- `my-app/src/lib/export-renderers.ts` — ensure HTML/PDF/DOCX render structured closing/signature blocks using existing `resolveProposalSignatureRender()`.
- `my-app/src/pages/ProposalPrintPage.tsx` — pass closing payload into `ProposalDocumentRenderer`.
- `my-app/src/components/ProposalDisplay.tsx` and `my-app/src/components/ProposalsList.tsx` — pass structured closing for live and saved previews.
- `my-app/src/pages/ProposalForge.tsx` — resolve, persist, restore, autosave, and save structured closing metadata.
- `my-app/src/lib/proposal-output-draft.ts` and `my-app/src/lib/proposal-workspace-state.ts` — persist closing through local/session draft state.
- `my-app/convex/schema.ts`, `my-app/convex/createProposalPublic.ts`, `my-app/convex/updateProposalPublic.ts`, and `my-app/convex/proposalsPublic.ts` — add closing metadata validators.
- `my-app/convex/lib/proposals/proposalRenderer.ts` / generation save path — stop relying on final generated text as the signature authority; preserve existing body-only prompt behavior and use deterministic defaults as structured metadata.

## Reuse

- `ENGLISH_SIGNOFFS` / `FRENCH_SIGNOFFS` in `my-app/convex/lib/proposals/proposalRenderer.ts` for locale/voice sign-off defaults.
- `extractProposalClosingBlockFromParagraphs()`, `parseProposalClosingBlock()`, and `stripInlineProposalMarkdown()` in `my-app/src/lib/proposal-closing.ts` for legacy migration/fallback.
- `resolveProposalSignatureRender()` and `sanitizeProposalSignatureSettings()` in `my-app/src/lib/proposal-signature-settings.ts` for the actual rendered signature style.
- Existing header/style persistence patterns in `my-app/src/pages/ProposalForge.tsx` and `my-app/src/lib/proposal-output-draft.ts` for adding closing state consistently.

## Steps

- [ ] Add structured closing types plus sanitizer/default resolver in `proposal-closing.ts`.
- [ ] Extend Convex proposal metadata validators with an optional `closing` object and keep backward compatibility with rows that lack it.
- [ ] Resolve a single effective closing in `ProposalForge`: metadata closing > legacy parsed closing > default closing from applicant/profile/settings.
- [ ] Persist effective closing in output draft state, autosave snapshots, saved proposal metadata, and reopen/restore flows.
- [ ] Update `ProposalDocumentRenderer` to receive structured closing, remove legacy closing paragraphs from rendered body when detected, and append one deterministic closing block when `enabled` is true.
- [ ] Update preview print source, print route payload, `buildProposalExportSource()`, and export renderers to render the same structured closing block.
- [ ] Adjust generation/composition so the LLM remains body-only and the app/server save path stores closing metadata rather than requiring closing lines in `content`.
- [ ] Add minimal UI later only after the invisible deterministic path works: on/off, sign-off selector, reset to Settings, optional local name override.

## Verification

- Unit tests:
  - Body text with no closing still renders configured signature in `ProposalDocumentRenderer`.
  - Settings image signature renders in Proposal Forge when body has no sign-off.
  - `buildProposalExportSource()` includes a closing block from structured metadata, not parsed text.
  - Legacy `Sincerely,\nName` content migrates/renders without duplicate closing.
  - `enabled: false` removes closing from preview, print, PDF, and DOCX.
- Persistence tests:
  - Proposal output draft save/read round-trips closing metadata.
  - Saved proposal reload keeps signature visible.
  - Changing Settings updates default-linked closing/signature unless the proposal has a document override.
- End-to-end/manual:
  - Generate a fresh body-only cover letter; confirm live preview, saved view, print route, PDF, and DOCX all show identical closing/signature.
  - Open an older saved proposal with an embedded closing; confirm no duplicate signature and metadata becomes structured on next save.

## Review notes on the supplied plan

- Keep the central decision exactly as written: `LLM writes proposal body only; app owns boundaries/signature`.
- Tighten the implementation detail from “probably in proposal metadata/draft state” to “must be in Convex proposal metadata plus local/session draft state and print/export payloads.”
- Include the existing deterministic sign-off tables in reuse so the change does not introduce new locale/voice defaults.
- Be careful with `source: "settings"`: Settings currently stores signature style, not the actual applicant name/sign-off. The resolver should treat Settings as a link mode/default source, while document metadata still stores enough resolved state for refresh/reopen/export.
- Prefer implementing invisible defaults first; UI controls can follow after parity and persistence tests pass.
