# Decision: Proposal AI Selector and Inline Diff Overlay

Date: 2026-05-06
Status: Accepted

## Context

ProposalForge now has three distinct AI surfaces that need to stay independent:

- proposal generation
- helper toolbar actions in the editor
- inline review of selected text in the proposal document

The selector work added a live model routing layer for helper actions and a default model override for the proposal form. The editor text review work replaced detached suggestion cards with an inline diff overlay inside `ProposalDisplay`.

## Routing Contract

### Proposal generation

- Proposal generation still uses OpenAI Responses.
- The default proposal writer model is `gpt-5.5`.
- The request includes `reasoning: { effort: "low" }` and `text: { verbosity: "medium" }`.
- Premium cover-letter writing still resolves through the same default writer model contract unless an environment override is supplied.

### Proposal form selector

- `ProposalInputForm` now accepts an env-driven default model type.
- Supported defaults come from `VITE_PROPOSAL_MODEL_TYPE` or `VITE_PROPOSAL_DEFAULT_MODEL_TYPE`.
- If neither env var is present, the visible default remains `chatgpt`.

### Editor helper actions

- Visible toolbar actions route through Qwen first.
- `rewrite`, `shorten`, `clarify`, `strengthen`, `expand`, `tailor_to_job`, and `custom` use `qwen-3.6-plus` first.
- `fix_grammar` uses `qwen-3.6-flash` first.
- Fallback order is Mistral first, then DeepSeek.
- The fallback models currently resolve to `mistral-small-latest` and `DeepSeek V4 Flash`.

### Provider wiring

- OpenAI uses `OPENAI_API_KEY`.
- Qwen uses `QWEN_API_KEY` plus `QWEN_CHAT_COMPLETIONS_URL` or `QWEN_BASE_URL`.
- DeepSeek uses `DEEPSEEK_API_KEY` plus `DEEPSEEK_CHAT_COMPLETIONS_URL` or `DEEPSEEK_BASE_URL`.
- Mistral uses `MISTRAL_API_KEY`.
- The jobs match-read synthesis path uses the Ministral/Mistral family for keyword and summary matching; the current default model is `ministral-3-3b-instruct-2512`.

## Inline Diff Contract

- Proposal document edits no longer render `AiSuggestionCard`.
- `ProposalDisplay` now mirrors the textarea content and overlays the selected range as an inline diff.
- The old text is struck through, the replacement text is inserted inline, and the controls sit in the same flow.
- Preview state uses `Accept` and `Discard`.
- Applied state uses `Undo` and `Close`.
- The textarea selection highlight is hidden while the overlay is active so the native highlight does not sit under the diff.
- The document text runs use the proposal document typography contract.
- The action controls stay on the app UI font path.

## Outcome

- Proposal generation stays on OpenAI `gpt-5.5`.
- Toolbar actions now have a clear primary/fallback chain across Qwen, Mistral, and DeepSeek.
- `fix_grammar` is not routed to Qwen Plus.
- Job summary/keyword match synthesis is on the Ministral/Mistral path, not the proposal writer path.
- The proposal editor now reviews text in place instead of in a detached suggestion card.

## Case Note

Security Guard Cover Letter Bench - Robert Cooper

- `G` = GPT
- `L` = Mistral Large
- `M` = Mistral Medium

Final ranking:

1. `L` / Mistral Large
2. `G` / GPT
3. `M` / Mistral Medium

Conclusion:

Mistral Large won this case because it gave the best recruiter-safe balance: grounded, concise, relevant, and not overly AI-like.
GPT was strongest for ATS coverage but too bloated.
Mistral Medium was readable but underdeveloped or slightly inflated.

## Files

- `my-app/config/llmConfig.ts`
- `my-app/convex/lib/editorAi.ts`
- `my-app/convex/generateProposalMutation.ts`
- `my-app/convex/langchain/models/openai_responses_adapter.ts`
- `my-app/convex/lib/proposals/premiumCoverLetter.ts`
- `my-app/src/components/ProposalInputForm.tsx`
- `my-app/src/components/ProposalDisplay.tsx`
- `my-app/src/styles/product-proposal.css`

## Verification

- `rtk npx vitest run convex/lib/__tests__/editorAi.test.ts convex/lib/proposals/__tests__/premiumCoverLetter.test.ts`
- `rtk npx tsc --noEmit --pretty false`
