# CV Forge PR4 closure audit

Date: 2026-05-01  
Scope: `/cv` only. Audit only; no implementation in this slice.

## References

- PR4 checklist: `docs/UI/PR-BRIEFS/PR4-cv-forge.md`.
- Carry-forward checklist: `docs/plans/2026-04-30-cv-forge-pr4-remaining-tasks.md`.
- Active route: `my-app/src/App.tsx` routes `/cv` to `CvForge`.
- Active code inspected:
  - `my-app/src/pages/CvForge.tsx`
  - `my-app/src/components/cv/CvRail.tsx`
  - `my-app/src/components/cv/CvStageBar.tsx`
  - `my-app/src/components/cv/CvReviewBanner.tsx`
  - `my-app/src/components/cv/ImportReviewSheet.tsx`
  - `my-app/src/components/cv/SectionEditorSheet.tsx`
  - `my-app/src/features/verbati/VerbatiResumePreview.tsx`
  - `my-app/src/features/verbati/resume/ResumeTemplateRenderer.tsx`
  - `my-app/src/features/verbati/resume/ResumeOneColAtsPage.tsx`
  - `my-app/src/lib/resume/resumePagination.ts`

## Current active state

- `/cv` uses the PR4 document-first skeleton frame: stage plus right rail in `CvForge`, with `CvStageBar`, `CvReviewBanner`, `VerbatiResumePreview`, `CvRail`, `SectionEditorSheet`, and `ImportReviewSheet` mounted from the active route.
- The rail has Sections, Ask, and Style tabs. Sections are reorderable, hide/showable, deletable, and can open section-specific sheet editors.
- The paper is now an edit/focus surface in edit mode and uses the same canonical section update paths for inline field edits.
- Page preview routes through the live `VerbatiResumePreview` canvas path and the workshop template renderer when the active style resolves to `workshop_resume_onecol_ats`.
- The save-size / Convex payload risk called out in the carry-forward checklist is only partially mitigated: backend stripping removed some oversized metadata fields, but style edits still route through the same full `profiles:patch` CV document path and can still trigger the 1 MiB ceiling on large CVs.
- The latest Proposal-to-CV entry action fix is outside this audit but now routes `Create new CV` / `Import new CV` directly to CV Forge.

## PR4 checklist status

| Area | Status | Notes |
| --- | --- | --- |
| Stage + rail shell | Mostly complete | Active `/cv` renders a PR4-style stage/rail. `CvForge.tsx` is still a large orchestrator rather than the brief's thin orchestrator goal, but the visible route is the intended PR4 route. |
| Stage bar | Mostly complete | Saved/ATS/tone/edit-preview/version/share/import/new actions exist. Version history remains disabled. Safe-send rows are mostly detection-pending placeholders. |
| Review banner | Partial | Banner renders only when pending import recovery blocks exist. Dismiss is local component state, not persisted per document. |
| Paper render/edit | Partial | Direct paper editing exists. Remaining risk is page-end rendering/pagination fidelity, not whether the paper can edit. |
| Rail tabs | Partial | Sections/Ask/Style tabs exist. The collapsed AI stream is tied to import progress only and uses static stage copy; it is not a general live AI stream across all AI work. |
| Sections tab | Mostly complete | Reorder, active row, hide/show, delete, add section, and per-row Ask/wand exist. Delete undo remains missing. Add menu omits some PR4 requested presets such as Publications, Awards, Volunteer, and References. |
| Ask AI tab | Partial | It is section-scoped and does not offer whole-CV rewrite. Structured suggestions exist for Skills/Languages/Hobbies. Some item/editor AI paths live in `SectionEditorSheet`. Default tone wiring is incomplete; see below. |
| Style tab | Partial | Per-document style controls exist and persist through `useBoundVerbatiCvStyle`. Active selector flow is workshop-based (`familyId/layout === workshop`) and the active UI exposes only the Workshop template family; legacy layout aliases are preserved only as compatibility normalization for existing docs, not as active style selectors. It also uses component-level accent hex values for swatches rather than a fully tokenized selector contract. |
| Footer import row | Partial | Sticky Import PDF exists. PR4 Paste text footer entry is not present. Empty state has Upload PDF and Start blank, but no Paste text action. |
| Section editor sheet | Mostly complete | A single sheet switches by section type and covers profile/contact, summary, experience, education, projects, skills/languages/hobbies, achievements, certifications, and generic text. Some PR4 generic list families still fall through to text/generic behavior. |
| Import review sheet | Partial | UI shape exists with compare blocks and local Accept/Edit/Delete. Actions currently mutate only sheet-local state; they do not commit to active CV state or update `metadata.importRecoverySession.reviewStatus`. Export is not blocked by unresolved import blocks. |
| Safe-send | Partial | Share menu and Safe-send sheet exist. Only import issue count and page preview status are active-ish signals; several rows remain detection pending. |
| Browser verification | Deferred | No latest browser light/dark/mobile screenshots were captured in this environment. |

## Default tone wiring audit

Current wiring:

- `CvForge` reads `proposalSettings.getCurrent` and maps `savedVoicePreset` / `voicePreset` to `cvTone` with `mapDefaultVoicePresetToCvTone`.
- `CvStageBar` displays the mapped default tone badge.
- `CvRail` receives `selectedTone={cvTone}`.
- Rail-driven Summary Ask passes `tone` into `handleRunAskAiForSection`, and Summary Ask includes `Tone preference: {tone}.` in the action instruction.
- There is test coverage proving an `engaging` saved voice preset maps to `warm` and reaches the rail Summary Ask instruction.

Remaining gaps:

1. `FloatingAiToolbar` / inline paper selection AI does **not** pass the default tone to `transformEditorSelectionAction`; it sends only `mode`, `instruction`, and `selectedText`.
2. `SectionEditorSheet` runs its own `runCvSectionAiAction` calls and does not receive `cvTone` as a prop. Its Summary rewrite path sends CV evidence but no tone instruction. Experience, achievement, project, education, and custom text editor actions also send no default tone.
3. Tone is correctly not persisted into CV metadata, which matches the carry-forward decision. The remaining work is request-time wiring only, and only for prose-heavy AI actions.

Closure requirement before PR4 can be called done:

- Decide the request contract for prose tone hints (`tone` param vs appended instruction) for `transformEditorSelectionAction` and `runCvSectionAiAction` callers.
- Wire default tone only to prose-heavy paths: Summary, custom/text sections, inline prose selection, experience responsibility phrasing, project description, and achievement line. Do not send tone to Skills/Languages/Hobbies chip suggestions unless backend support explicitly expects it.
- Add tests for inline paper AI and SectionEditorSheet Summary AI proving the default tone is included.

## Paper pagination / end-page rendering audit

Current wiring:

- Page preview uses `VerbatiResumePreview` with natural scroll inside the PR4 stage.
- Workshop template preview uses `ResumeTemplateRenderer`, which calls `planWorkshopResumePages` and renders committed page fragments through `ResumeOneColAtsPage`.
- `ResumeTemplateRenderer` reports stable page count back to the stage and renders scaled A4 page shells with `overflow: hidden`.
- There is meaningful unit/integration coverage around committed workshop boundaries, selected-project tails, dense skills/languages packing, hobbies before additional information, custom text after hobbies, and atomic non-experience continuity.

Remaining gaps:

1. Pagination is still estimator/planner-driven for the workshop renderer. The tests prove planner/render consistency for fixtures, but they do not replace browser visual QA for actual font metrics, zoom, and paper clipping.
2. Page shells use `overflow: hidden`, so any estimation miss can silently clip the end of a page. This is the main end-page rendering risk called out by the prior PR4 checklist.
3. The active CV paper has many inline edit controls and AI overlays in edit mode. Need browser QA to confirm controls do not affect page-end layout or obscure content near page breaks.
4. Styled export should be compared against Page preview for the same committed planner pages; this audit did not verify browser/export parity.

Closure requirement before PR4 can be called done:

- Browser-check a dense disposable CV in Page preview with long Summary, multi-page Experience, Selected Projects, Skills/Languages, Hobbies, and Additional information.
- Confirm no headings are orphaned at the page bottom, no final lines are clipped, continued labels read correctly, and hidden sections remain absent.
- Confirm styled PDF/export matches the preview page boundaries for the same fixture.
- If any clipping appears, fix planner estimates or rendering spacing before adding more page-end tests.

## Mobile / narrow verification audit

Current wiring:

- `product-cv.css` stacks `.dasti-cv-skeleton-forge` to one column at `max-width: 760px`; `.dasti-cv-rail` becomes `width: 100%`, `position: static`, and `max-height: none`.
- Existing tests include a narrow-width smoke proving Page preview stays on the same preview canvas path.

Remaining gaps:

1. No browser verification was captured for actual mobile layout, touch scrolling, or rail usability.
2. The PR4 checklist says the rail should stack below the paper intentionally on mobile; CSS appears to do this, but the active route still needs rendered verification.
3. Stage bar overflow, Sheet behavior, file import entry, section row DND/keyboard alternatives, and paper inline editing need mobile/touch QA.
4. The prior scroll/focus audit remains relevant: nested page/document scrolling needs explicit browser confirmation after the PR4 shell work.

Closure requirement before PR4 can be called done:

- Capture `/cv` at mobile and narrow desktop widths in edit and Page preview modes.
- Verify rail order below paper, tab switching, sticky/footer import row, section sheet as mobile sheet, import review sheet, and paper scrolling at page boundaries.
- Verify touch/keyboard alternatives for reorder/hide/delete and that focus does not trap page scrolling.

## Other remaining PR4 closure items

- Import Review persistence: Accept/Edit/Delete/Accept all clear must commit against active CV/import recovery state and update banner/Safe-send counts.
- Export gate: unresolved import issues should block or warn on export according to PR4 Safe-send rules. Current export path does not check `importReviewBlocks`.
- Paste text import: PR4 asks for Paste text in the empty state and sticky rail footer. Active UI currently exposes Import PDF only in the rail footer.
- Add-section preset parity: add or intentionally defer Publications, Awards, Volunteer, References, and any custom naming flow differences.
- Delete undo: section delete still needs undo if PR4 closure requires it.
- Reduced-motion/token cleanup: active CSS still has areas that should be checked against token/stylelint discipline before final merge.

## Recommended next implementation order

1. Default tone wiring for prose AI paths, with tests for inline paper AI and SectionEditorSheet Summary AI.
2. Import Review persistence and export/Safe-send count integration.
3. Paper pagination/end-page browser QA on a dense fixture; fix only observed clipping/orphaning issues.
4. Mobile/narrow browser QA; fix only observed shell, scroll, or sheet issues.
5. Small PR4 parity items: Paste text footer/empty action, missing add-section presets, delete undo, and any final style-token cleanup.

No CV implementation should begin until this audit is accepted as the active PR4 closure checklist.
