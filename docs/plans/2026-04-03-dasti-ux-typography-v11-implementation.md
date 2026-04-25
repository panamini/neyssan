# Dasti UX + Typography v1.1 Implementation

Date: 2026-04-03

Reviewed checklist:
- Done: removed the separate sidebar current-workspace model and kept active state inside the existing resume/proposal lists.
- Done: split proposal draft and saved-proposal markers so only the opened item is fully active; draft availability now uses a muted marker.
- Done: added document context to the topbar and browser titles, including library labels such as `All resumes (n)` and `All proposals (n)`.
- Done: stopped generic proposal length toasts when no explicit limit mode is active.
- Done: applied proposal defaults from settings for style choice, palette/accent, and the new curated font-pair setting.
- Done: added a local font catalog with auto-discovery from `src/assets/fonts`, curated font-pair options, and legacy typography migration.
- Done: expanded settings with a persisted default font-pair control and simplified the palette auto swatch.
- Done: redesigned the settings defaults view around a live business-card preview, arrow navigation for font pairs, and clearer style cards.
- Done: added a proposal composer relationship cue for attached resumes.
- Done: replaced the CV forge exhausted add-section state with `Manage sections` and per-section removal actions.
- Done: added non-blocking import review signals inside the CV editor for suspicious parse output.
- Done: hardened the actual structured-upload canonicalization path against bad inferred names from skills data.
- Done: tightened the CV forge edit canvas, made the preview-eye rail sticky while scrolling, and reduced the live preview shell padding.
- Done: removed the inline resume-rename pen action from the CV forge header row.
- Done: kept the CV library card cleanup, but rolled back the redundant metadata duplication and simplified the title/subtitle structure.
- Done: removed the unnecessary library page eyebrows.
- Done: aligned the topbar wordmark and breadcrumb label on a shared baseline.

Deferred on purpose:
- First-run onboarding and guided CV -> proposal flow.
- Full parser rewrite or blocking import review modal.
- Proposal history/portfolio view and AI usefulness feedback loop.
- Shipping actual local font files; the catalog auto-registers them when files are added under `src/assets/fonts`.
