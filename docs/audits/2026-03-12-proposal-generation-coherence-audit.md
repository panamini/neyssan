# Proposal-Generation Coherence Audit

Date: 2026-03-12

Scope: web app Proposal Forge vs extension inline proposal generation only.

## 1. Root cause

The main coherence issue is not that app and extension use completely different generation systems. The active problem is that both repos still converge on one shared Convex action, but they call it through different generations of caller contracts.

- Active app Proposal Forge uses the newer proposal vocabulary: `cover_letter`, `application_message`, `freelance_proposal`, plus visible controls for formality, creativity, model, and CV selection.
- Active extension inline generation still uses the older proposal vocabulary: `technical` / `creative`, hidden defaults, and an `explicit_only` personalization mode.
- The backend action intentionally supports both vocabularies, which keeps compatibility, but that also means different callers hit different prompt branches and different defaults.
- A second active app path, `ProposalsList` regenerate, still uses the older `technical` path and fixed defaults, so the app itself is internally mixed between old and new proposal-generation assumptions.

Net effect: there is already a shared backend, but the extension is aligned to the older simplified contract while Proposal Forge is aligned to the newer richer contract.

## 2. Relevant current code paths

### Active code

- Web app Proposal Forge page:
  - `src/pages/ProposalForge.tsx`
  - `src/components/ProposalInputForm.tsx`
  - `src/components/ProposalInputForm.schemas.ts`
  - `src/components/ProposalDisplay.tsx`
- Shared backend action:
  - `convex/functions.ts`
  - `convex/generateProposalMutation.ts`
- Web app CV personalization source:
  - `src/lib/proposal-personalization.ts`
  - `src/contexts/CvLibraryContext.tsx`
  - `convex/activeCvSnapshots.ts`
- Web app secondary regenerate path:
  - `src/components/ProposalsList.tsx`
- Extension inline generation:
  - `../clerk-chrome-extension-final/src/contents/content.tsx`
  - `../clerk-chrome-extension-final/src/background/index.ts`
- Extension to app handoff and shared save path:
  - `convex/proposalHandoffs.ts`
  - `convex/saveJobAndProposal.ts`

### Legacy but informative

- `src/components.bak.*`
- `src/proposainputform.bak`
- `../clerk-chrome-extension-final/src/background/indexv0.md`
- `convex/generateProposalAction.md`

These are useful for history, but they are not authoritative for current behavior.

### Obsolete or non-authoritative for this audit

- `convex/http.ts` `/test/generate` route. It shows older defaults (`technical`, `formal`, `standard`) but it is not the active Proposal Forge path.

## 3. What is already shared

- Same active backend action name:
  - both app and extension call `api.functions.generateProposal`
- Same backend argument surface:
  - the action accepts both old and new proposal types, formality, creativity, model choice, and optional personalization fields
- Same model default in active callers:
  - both Proposal Forge and extension default to `mistral-small-latest`
- Same save mutation:
  - both end up using `saveJobAndProposal`
- Same extension-to-app handoff bridge:
  - extension writes a handoff record, app reads it on `/proposal`
- Same active CV snapshot bridge:
  - app syncs the current CV snapshot to Convex, extension reads that same snapshot

Shared prompt path is conditional, not absolute:

- If app and extension send the same `proposalType`, `modelType`, and personalization fields, they do hit the same backend code path.
- In practice today, they usually do not send the same values, so they often diverge inside the same action.

One shared quirk:

- the UI label `chatgpt` does not map to GPT-4 in code. The adapter currently uses `gpt-3.5-turbo-1106`.

One uncertainty:

- the extension hardcodes a Convex URL in its background script.
- the app reads its Convex URL from runtime env.
- committed repo docs reference a different deployment than the extension hardcode, but committed docs are not enough to prove the live local env. So "same backend deployment in practice" is probable by intent but not fully proven from committed active code alone.

## 4. What is diverging today

### Web app controls today

Active Proposal Forge exposes:

- proposal type:
  - `cover_letter`
  - `application_message`
  - `freelance_proposal`
- formality:
  - `formal`
  - `neutral`
  - `informal`
- creativity:
  - `low`
  - `medium`
  - `high`
- model:
  - `chatgpt`
  - `mistral-small-latest`
  - `mistral-large-latest`
  - `mistral-agent`
- other writing controls:
  - choose active CV locally
  - prefill from extension handoff job data
  - send `personalizationContext`
  - send `personalizationRichness`

Default Proposal Forge values today:

- proposal type: `cover_letter`
- formality: `neutral`
- creativity: `medium`
- model: `mistral-small-latest`

### Extension controls today

Active inline extension UI exposes only:

- job title
- job description
- `Use current CV context` checkbox
- `Generate`
- `Open in Proposal Forge`

The extension does not expose active UI controls for:

- proposal type
- tone/formality
- creativity
- model choice

The extension background has latent fields for those values, but nothing in the active content-script UI sets them.

Extension hidden defaults today:

- proposal type: `technical`
- formality: `formal`
- creativity: `standard`
- model: `mistral-small-latest`

### Prompt/template divergence

- New Proposal Forge types are normalized by the backend to output formats:
  - `cover_letter`
  - `application_message`
  - `freelance_proposal`
- Old extension types map like this:
  - `technical` -> `freelance_proposal`
  - `creative` -> `cover_letter`

So the extension default is effectively "freelance proposal", while the app default is "cover letter".

Model branch divergence:

- `mistral-small-latest`, `mistral-large-latest`, and `mistral-agent` use the inline prompt builder in `generateProposalMutation.ts`
- `chatgpt` uses the older `ProposalService` / LangChain chain path

That older `chatgpt` path is not symmetric:

- freelance-style output goes through the technical chain and does use formality + creativity
- cover-letter/application-message output goes through the creative chain and does not clearly use the same tone/creativity controls in the same structured way

### Personalization divergence

- App Proposal Forge sends local `personalizationContext` plus `personalizationRichness`
- App backend default mode is `default`, which can merge caller context with fallback profile data
- Extension inline generation forces `personalizationMode = "explicit_only"`
- If extension CV context is off, it explicitly disables fallback personalization and generates with no candidate context
- If extension CV context is on, it still uses only the synced snapshot, not the backend fallback merge path
- Extension does not send `personalizationRichness`, so it misses the app’s caution/strength prompt adjustments for minimal/sparse/rich CV detail

### UI assumption divergence

- App Proposal Forge explicitly distinguishes letter-like outputs from proposal-like outputs in display rendering
- Extension just shows editable raw text in a textarea
- App lets the user choose which CV to use at generation time
- Extension can only consume whatever CV snapshot the app already synced as current

### Internal app divergence that matters

- `ProposalsList` regenerate is active code and still hardcodes:
  - `proposalType: "technical"`
  - `formalityLevel: "neutral"`
  - `creativity: "medium"`
  - `modelType: "mistral-small-latest"`

So the app is already partially split between the new Proposal Forge contract and an older regenerate contract. The extension currently resembles that older regenerate path more than the main Proposal Forge path.

## 5. Smallest safe next step

Recommendation: keep the extension intentionally simpler than the app, but partially align it with the app’s active proposal contract.

Smallest safe step:

- change the extension inline caller contract and hidden defaults to match Proposal Forge’s active defaults
- specifically:
  - allow extension request types to use `cover_letter | application_message | freelance_proposal`
  - set hidden inline defaults to:
    - `proposalType: "cover_letter"`
    - `formalityLevel: "neutral"`
    - `creativity: "medium"`
    - `modelType: "mistral-small-latest"`
- do not add new inline UI controls yet
- keep `Open in Proposal Forge` as the richer path

Why this is the safest step:

- it keeps the extension simple
- it preserves the existing backend action
- it avoids auth, scraping, and CV-flow changes
- it moves extension output much closer to the active in-app generator by aligning the most important hidden defaults and proposal-type vocabulary first

What should explicitly not be changed yet:

- do not redesign auth
- do not redesign scraping
- do not redesign CV context flow or replace the active CV snapshot bridge
- do not rewrite the backend prompt system
- do not remove support for old `technical` / `creative` types from the backend yet
- do not try to give the extension full Proposal Forge parity in one step
- do not change LangChain vs Mistral branching yet; first align the extension caller contract
