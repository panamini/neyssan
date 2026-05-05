# Proposal Forge rail follow-up plan

## Scope

Refine the active `v1` Proposal Forge rail/workbench based on the 2026-05-05 screenshot review. Keep the change local to the active Proposal Forge path and avoid reviving legacy compose UI.

## User-visible target

1. **Job context uses the real saved/imported job, not proposal output state**
   - Title must come from the LinkedIn/Upwork/source job offer record (`canonicalJobRecord` / source brief), not the generated proposal title.
   - Remove the current generic/derived pills that read like accidental keywords.
   - Replace them with a compact job-match cartouche plus a small keyword list only when keywords are meaningful.
   - Add a dropdown/disclosure control so the user can collapse this job context card.

2. **Source CV + process stream order**
   - Keep Source CV as the clear selector.
   - Put the `Writing draft` / AI process drawer immediately under Source CV.
   - Show it only during the active async phase (CV import / draft generation / error), then remove it once the import/generation has settled.
   - Do not leave a stale `Ready for edits` process drawer in the rail.

3. **Tone remains compact pills**
   - Keep Warm / Formal / Natural as visible pills.
   - Keep Auto only if it fits without clutter; otherwise prefer the three explicit tone pills and preserve Auto in internal defaults.

4. **Header details drawer replaces Variables**
   - Rename the visible rail label from `Variables` to `Header details`.
   - Keep editable header fields inside a collapsible drawer, not as a permanently expanded plain form.
   - The drawer can be open after generation but should clearly be a drawer/disclosure.

5. **Length becomes a real drawer setting**
   - Replace the current non-working/plain `Length status` / dropdown confusion with a compact drawer containing `Short`, `Medium`, `Long` options.
   - Wire these options to the existing proposal character-limit/draft-length state so selecting one affects the next generation.
   - Remove “custom style” / “style source” from this rail. It is not understandable in this context.

6. **Ask AI must actively modify proposal text**
   - Restore an active Ask AI surface in the rail, not only static help copy.
   - It should accept a user instruction and apply it to the current proposal text.
   - Preferred behavior: if text is selected in the paper, modify that selection; otherwise modify the current proposal body with a clear loading state.
   - Reuse existing proposal editor AI / selection-transform path where possible instead of adding a second AI implementation.

7. **Draft title / Role inline rename**
   - The generated proposal title sometimes visually overlaps or duplicates a previous title; clean up title ownership.
   - Separate:
     - job offer title = Job context title
     - proposal draft title = editable document title
   - Make the Draft setup `Role`/title row directly editable so clicking it renames the current proposal draft title.
   - Ensure the editable value persists through the existing proposal document commit path.

8. **Status pill visual consistency**
   - Align the top-left `Drafting` pill with the project’s existing semantic status-pill class family (`saved`, etc.) instead of the mismatched pill currently shown.

## Active files to inspect/change

- `my-app/src/pages/ProposalForge.tsx`
  - Data ownership: job title, proposal title, source URL, length state, AI stream gating, Ask AI callbacks.
- `my-app/src/components/proposal/ProposalRail.tsx`
  - Rail layout, Source CV, process drawer position, tone pills, header details drawer, length drawer, Ask AI surface.
- `my-app/src/components/proposal/ProposalAIStream.tsx`
  - Ensure stream summary is appropriate and does not persist as stale `Ready for edits`.
- `my-app/src/components/jobs/MatchReadBlock.tsx` and/or `JobMatchPanel.tsx`
  - Reuse compact job match UI or extract a smaller rail-friendly presentation.
- `my-app/src/components/ProposalDisplay.tsx`
  - Existing editor AI and title/header drawer integration; avoid duplicating edit flows.
- `my-app/src/styles/product-proposal.css`
  - Rail drawers, tone/length pills, job-match cartouche, status pill alignment.
- `my-app/src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx`
  - Update regression coverage.

## Implementation sequence

1. **Trace data ownership**
   - Confirm the active source for job offer title/company/location/source URL/keywords/match read.
   - Confirm the active source for generated proposal title/document title.
   - Identify where title overlap/double-render can occur before patching.

2. **Restructure rail rendering**
   - Job context becomes a collapsible card with real job title, source links, match cartouche, and meaningful keywords.
   - Source CV remains the selector.
   - AI stream moves directly under Source CV and only renders for active/loading/error states.

3. **Replace confusing settings**
   - Remove style/custom-style rail rows.
   - Add Length drawer with Short / Medium / Long controls wired to character-limit state.

4. **Restore active Ask AI**
   - Add rail Ask AI input + action button.
   - Reuse existing editor transform path for selected text when possible.
   - Add fallback whole-body rewrite behavior only if current architecture supports it safely; otherwise disable with explicit copy until selection exists.

5. **Inline draft title edit**
   - Convert Draft setup title/Role display to an inline input or edit-on-click field.
   - Persist through existing proposal document commit.
   - Keep job context title unchanged.

6. **Visual cleanup**
   - Align Drafting status pill class with existing app status tokens.
   - Tighten drawer spacing so rail remains compact.

7. **Verification**
   - Run focused Vitest for Proposal Forge workspace rail.
   - Run `tsc --noEmit`.
   - Run stylelint only on `src/styles/product-proposal.css`.
   - If browser verification is available, run a narrow rendered check for rail labels/order and process drawer disappearance.

## Acceptance criteria

- Job context title equals the imported/saved job offer title, not generated proposal title.
- No meaningless keyword pills in Job context.
- Job context can collapse.
- Job match cartouche is visible when match data exists.
- Source CV selector is not duplicated.
- `Writing draft` drawer appears under Source CV while working and disappears after settle.
- Header fields live inside `Header details` drawer, not `Variables`.
- Length is selectable as Short / Medium / Long and affects next generation state.
- Style/custom-style rail control is gone.
- Ask AI in rail can modify proposal text or clearly operates on selected text.
- Draft/proposal title is editable without overwriting job context title.
- Top-left Drafting status pill matches project status-pill visuals.

## Non-goals

- No parser rewrite.
- No large Proposal Forge architecture rewrite.
- No legacy compose UI revival.
- No broad styling cleanup outside Proposal Forge rail/workbench.
