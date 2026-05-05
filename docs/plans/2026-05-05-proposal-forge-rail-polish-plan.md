# Proposal Forge rail polish plan

## Scope
Polish the current Proposal Forge rail based on the 13:19 screenshots. This plan is for UI fixes first, plus a no-fix audit of the generation failure message.

## Confirmed from current code/screenshots
- `Job context` is currently open by default in `my-app/src/components/proposal/ProposalRail.tsx`.
- The rail uses literal `▾` glyphs instead of the project Phosphor icon wrapper from `my-app/src/lib/icons.tsx`.
- Collapsed `Header details` and `Length` are native `<details>` sections styled as black pill rows; user reports they cannot expand.
- The rail match card reuses `MatchReadBlock` / `JobMatchPanel`, which brings the `Verdict` eyebrow and explanatory copy into the tight rail.
- The generation failure copy comes from `my-app/src/lib/proposal-generation-ui.ts` when the backend reports controlled proposal finalization failure. It is a real grounding guardrail, not a disabled-button UI state.

## Implementation plan

### 1. Job context collapsed summary
- Make `Job context` collapsed by default.
- Keep the job title visible in the collapsed header.
- Use a compact two-line max summary under or beside the title:
  - prefer canonical job summary / imported source summary when available,
  - otherwise synthesize a short summary from company, location, and source platform,
  - never fall back to proposal/draft title as if it were the job title when canonical job data exists.
- Keep job/source links available in the expanded body, but remove filler helper sentences.

### 2. Icons and drawer affordance
- Import `ChevronDown` from `@/lib/icons` in `ProposalRail.tsx`.
- Replace all literal `▾` rail chevrons with the Phosphor-backed icon.
- Add a rotation style for open state so collapsed/expanded state is clear.

### 3. Remove noisy job-match content in the rail
- Stop rendering the full `MatchReadBlock` card inside the rail.
- Add a rail-specific compact match cartouche or adapter that shows only the useful match state.
- Remove the `Verdict` eyebrow, long explanatory paragraph, breakdown rows, and keyword pills from the rail.
- Keep the fuller `MatchReadBlock` behavior untouched for the Jobs page / larger contexts.

### 4. Fix Header details and Length expand/collapse
- Replace the brittle native `<details>` pill treatment with a small controlled drawer pattern, or minimally fix the `<details>/<summary>` CSS so it is visibly and reliably expandable.
- Use the same summary-row structure and Phosphor chevron as Job context.
- Keep `Header details` collapsed by default, but expandable even before a draft exists; when no draft exists, show the existing hint inside the expanded panel.
- Keep `Length` collapsed by default or compact by default, but expandable and fully keyboard accessible.

### 5. Generation failure audit only — no behavior change
- Trace the payload used by `handleGenerateFromCollapsedToolbar` into the hidden `ProposalInputForm` submit path:
  - attached CV id/title,
  - candidate context presence,
  - canonical job id/title,
  - role description / source job description,
  - draft title vs job title separation.
- Classify the observed error:
  - **normal guardrail** if the CV/job data is too thin or genuinely mismatched,
  - **regression trigger** if the rail/title changes are sending polluted job title or draft title as job context.
- Do not change backend guardrail behavior in this pass.

## Verification
- Narrow RTL test for collapsed Job context showing title + summary.
- RTL test that Header details and Length can expand via click and keyboard.
- RTL test that rail no longer renders `Verdict` or keyword pills.
- Typecheck: `rtk sh -lc 'cd my-app && pnpm exec tsc --noEmit'`.
- Stylelint scoped CSS: `rtk sh -lc 'cd my-app && pnpm exec stylelint src/styles/product-proposal.css --allow-empty-input'`.

## Out of scope
- Backend proposal guardrail changes.
- Changing whether generation is allowed for weak CV/job matches.
- Broad redesign of the Proposal Forge layout.
