# Extension And Proposal Forge Output Coherence Audit

Date: 2026-03-12

## Scope

- Audit only.
- No behavior changes.
- Focus on output coherence between direct extension generation and Proposal Forge generation.

## Active Code

### Extension direct generation

- `clerk-chrome-extension-final/src/contents/content.tsx`
  - The content UI sends `jobData` with only `platform`, `title`, `description`, and `url`.
  - There is no extension UI for proposal type, model type, or tone.
- `clerk-chrome-extension-final/src/background/index.ts`
  - The background accepts optional legacy `proposalType`, `formalityLevel`, `creativity`, and `modelType`.
  - When the extension generates directly, it defaults to:
    - `proposalType: "technical"`
    - `modelType: "mistral-small-latest"`
  - It also forces `personalizationMode: "explicit_only"`.
  - When the user opens Proposal Forge instead, the handoff only includes job data and source metadata, not proposal format defaults.

### Proposal Forge generation

- `my-app/src/components/ProposalInputForm.tsx`
  - Proposal Forge explicitly sends:
    - `proposalType`
    - `modelType`
    - `formalityLevel`
    - `creativity`
    - `personalizationContext`
    - `personalizationRichness`
  - Current defaults are:
    - `proposalType: "cover_letter"`
    - `modelType: "mistral-small-latest"`
    - `formalityLevel: "neutral"`
    - `creativity: "medium"`
- `my-app/src/components/ProposalInputForm.schemas.ts`
  - The format/model/tone fields are explicit user-controlled inputs in Proposal Forge.

### Shared backend

- `my-app/convex/generateProposalMutation.ts`
  - Both surfaces hit the same active backend action.
  - The backend normalizes proposal types into output formats:
    - `technical -> freelance_proposal`
    - `creative -> cover_letter`
    - `cover_letter -> cover_letter`
    - `application_message -> application_message`
    - `freelance_proposal -> freelance_proposal`
  - Mistral uses one inline prompt with format-specific instructions for:
    - cover letters
    - application messages
    - freelance proposals
  - Proposal Forge-style personalization can merge explicit CV context with fallback profile context depending on richness.
  - Extension direct generation does not do that merge because it forces `explicit_only`.

### Presentation

- `my-app/src/components/ProposalDisplay.tsx`
  - Proposal Forge renders `cover_letter` and `application_message` outputs as plain letter-like paragraphs.
  - It renders non-letter outputs differently.
- `clerk-chrome-extension-final/src/contents/content.tsx`
  - The extension shows the generated output in a raw textarea.

## Conclusions

### What is already coherent

- Both surfaces use the same active backend action.
- Both default to `mistral-small-latest` today.
- Both now share the same backend-owned tone baseline when tone is missing.
- Both can use the same active CV source after the recent active-CV sync fix.
- Opening Proposal Forge from the extension carries the same scraped job title and description.

### What still diverges

- The biggest divergence is proposal format intent:
  - direct extension generation still defaults to legacy `technical`
  - Proposal Forge defaults to explicit `cover_letter`
- That format difference maps to different backend output instructions:
  - extension default => `freelance_proposal`
  - Proposal Forge default => `cover_letter`
- The extension still has a simpler caller contract:
  - no UI for format/model/tone
  - hidden defaults remain in the background
- Personalization behavior also differs:
  - extension forces `explicit_only`
  - Proposal Forge usually sends `personalizationRichness` and does not force `explicit_only`
- Presentation differs secondarily:
  - Proposal Forge renders letter-like outputs as formatted paragraphs
  - the extension shows raw text
- Provider-specific branch differences still exist if the model changes:
  - Mistral uses the newer inline format-specific prompt
  - ChatGPT non-freelance output still goes through the older creative chain/template path

## Smallest Safe Next Step

- Keep the extension UI simple.
- Align the hidden extension default output intent with Proposal Forge, instead of leaving the extension on legacy `technical`.
- The safest narrow move is:
  - make extension direct generation use the same default output style as Proposal Forge for standard employment-style flows
  - do not add new controls yet
  - do not rewrite prompt architecture
- After that, only if needed, consider aligning the extension personalization contract so it can send the same richness hint Proposal Forge already sends.

## What Should Stay Unchanged For Now

- Auth/session plumbing
- Scraping behavior
- Current-CV sync flow
- Backend tone resolver
- Proposal Forge UI controls
- Model benchmarking or prompt architecture rewrites
