# App skeleton refactor plan

**Date:** 2026-04-29
**Status:** ready for PR-sized implementation sessions

## Source of truth

Use these files before any implementation:

- `.agents/skills/twoweeks-app-skeleton/SKILL.md`
- `docs/UI/CODEX-HANDOFF.md`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/APP-SKELETON.html`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/SKELETON-AUDIT.md`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/REFONTE-AUDIT.md`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/FEATURES-KEEP-VS-REMOVE.md`
- `docs/UI/SKELETON.html` only for DS v2 primitive styling

`.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/APP-SKELETON.html` is the real app UX target. `docs/UI/SKELETON.html` is a DS v2 primitives skeleton, not the app page skeleton. The markdown files exist to turn the app HTML into PR contracts and preserve/restore/remove decisions.

## Implementation sequence

1. **PR1 shell/dashboard:** app grid shell, collapsed sidebar, mixed recents, topbar context, command palette, Dashboard, Quick Start, Next Best Action, onboarding entry.
2. **PR2 proposal forge:** split active `ProposalForge.tsx`, preserve live render/autosave/export/history, align rail/stage/share/safe-send/floating toolbar with skeleton, then delete `ProposalForgeNext.tsx` after consolidation.
3. **PR3 jobs:** split-view jobs workspace, 360px list, sticky filters, favorites, paste URL/capture entry points, verdict labels, inline match panel.
4. **PR4 CV forge:** document-first CV forge, rail tabs, import review banner/sheet, section organizer, section editor sheets, ATS badge, per-document style, section-scoped Ask AI.
5. **PR5 documents/templates/settings/auth:** unified Documents, Templates, Settings inner nav and simplified Document style, Sign-in polish.
6. **PR6 parity:** browser-backed skeleton parity pass and drift cleanup.

## Current implementation facts

- `product.css` has already been split and is no longer the old 17k-line blocker.
- DS primitives already exist for sheets, menus, toasts, cards, AI suggestions, AI stages, and floating AI toolbar.
- Active routes still start from `/cv`, not a skeleton Dashboard.
- `ProposalForge.tsx`, `JobsPage.tsx`, `CvForge.tsx`, and `SettingsPage.tsx` remain active refactor targets.
- `ProposalForgeNext.tsx` is legacy but informative; `/proposal-next` redirects to `/proposal`.

## Decisions

- Light/Dark only. No System theme.
- One Quick Start, using the `Capture jobs` step.
- No user-facing numeric match percentages.
- Six-step onboarding.
- Hidden CV sections stay editable but are excluded from export.
- Custom sections start as rich text.
- Per-document style overrides persist with the document.
- Onboarding replay is command-palette first.
- PR3 keeps the backend extraction readiness fix in scope when it is required for Jobs detail-pane acceptance. Treat language-localization output as follow-up work, not part of PR3.
- Keep `All jobs` as the default Jobs filter until live data proves that `Worth+ a shot` should be the default for signed-in users with CV signals.

## Verification

For each PR, run the narrowest relevant test scope first. For rendered UI changes, use browser verification and record the exact path, viewport, and behavior checked.
