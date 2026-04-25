# CV Forge Preview Style UX Audit

Date: 2026-04-01

Scope:
- Active CV Forge route and live preview components only
- Code and git evidence only
- No archive or dead-code review

Reference guideline:
- Vercel Web Interface Guidelines: <https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md>

## Active Code Evidence

1. Preview mode is already the dedicated full-document review surface.
   - `src/pages/CvForge.tsx:126-134` renders `VerbatiCvPreviewPanel` in `hostMode="workspace"`.
   - That path owns the shared top-left document rail and has room for proposal-style controls.

2. Edit mode currently embeds a smaller supporting preview next to the profile editor.
   - `src/pages/CvForge.tsx:136-164` renders `VerbatiCvPreviewPanel` in `hostMode="panel"` beside `ProfileReviewCard`.
   - This is a split-view support surface, not the main document review surface.

3. Preview mode now exposes one coherent style toolbar model.
   - `src/features/verbati/VerbatiCvPreviewPanel.tsx:165-314` uses bundle-based style cycling plus the shared `EmbeddedStyleInspector` with only `Style` and `Color`.
   - That matches the proposal output pattern better than the older direct `Layout` + `Text` control model.

4. Edit mode still exposes an independent layout slideshow inside the mini render.
   - `src/features/verbati/VerbatiResumePreview.tsx:307-333` renders left/right overlay arrows through `panelNavigation`.
   - That control changes layout in the small render even though preview mode already owns the fuller appearance toolbar.

## Git Evidence

- `407c7b36` refined CV and proposal editor UX system.
- `33467759` polished CV review chrome and custom color swatches.
- `e02bab8c` fixed Proposal Forge auto tone submit and preserved Auto state, and also moved the resume workspace preview toward the shared proposal-style appearance model.

The direction in git history is consistent: proposal and resume preview chrome are converging toward a shared document rail, not two separate control systems.

## UX Findings

### 1. The small edit-mode render should not be a second full template configurator.

Reason:
- The small panel does not show enough document context to judge a real template change well.
- It sits beside editing tasks, so changing full appearance there competes with content-editing focus.
- Preview mode already exists as the larger, document-first surface where appearance decisions are easier to assess.

Recommendation:
- Treat the small live render as a mirror of the currently selected style.
- Keep appearance configuration centered in preview mode.

### 2. Duplicated control surfaces currently create a split mental model.

Active conflict:
- Preview mode uses bundle-oriented appearance controls (`Style`, `Color`, and now style-cycle arrows).
- Edit mode mini preview still exposes a layout-only slideshow.

Impact:
- The user can change appearance from two places, but not with the same vocabulary.
- One surface talks in bundles/styles; the other talks in raw layout steps.
- That makes the system feel inconsistent even when both paths technically work.

Recommendation:
- Keep the new workspace preview toolbar as the primary style control.
- Remove or disable the panel-mode slideshow in a follow-up if the product decision is to keep edit mode as mirror-only.

### 3. The correct primary keyboard path is the preview toolbar, not the mini render overlay.

Reason:
- Toolbar controls are visible, labeled, and consistent with the proposal viewer model.
- Arrow-key handling attached to the workspace style cycle aligns better with keyboard discoverability than hidden overlay controls in a small render.

Recommendation:
- Keep left/right style cycling in preview mode.
- Do not expand keyboard-only template switching inside the small edit preview unless edit mode is intentionally promoted to a full appearance workspace.

## Product Recommendation

Recommended model:
- Edit mode small render: reflect the chosen style only.
- Preview mode: own style/template changes.

Why this is the better split:
- It preserves one main decision surface for appearance.
- It avoids duplicate state-changing controls in two different scales.
- It better matches the proposal output interaction model, where document appearance is changed from the document preview rail.

## Minimal Follow-Up

If you want the UX fully aligned with this recommendation, the next change should be:
- remove the panel-mode `panelNavigation` arrows from `VerbatiResumePreview` when used inside CV Forge edit mode

I did not apply that removal in this patch because you asked first for the audit decision, not a broad workflow change.
