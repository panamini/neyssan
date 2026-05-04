---
name: twoweeks-app-skeleton
description: Use when planning, implementing, or reviewing the twoweeks.ai app refonte against the full app skeleton at .claude/worktrees/hungry-mcnulty-1722ea/docs/UI/APP-SKELETON.html. Use docs/UI/SKELETON.html only for DS v2 primitive styling. Use especially for PR-sized work on navigation, dashboard, Proposal forge, Jobs, CV forge, Documents, Templates, Settings, Sign-in, Safe-send, Import review, command palette, or onboarding.
---

# Twoweeks App Skeleton

Use this skill for any frontend refactor work that must match the twoweeks app skeleton.

## Authority Order

1. Current active code decides runtime behavior, imports, data shape, auth, parser/import/export behavior, and verification scope.
2. `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/APP-SKELETON.html` is the full app visual and interaction contract for app refonte work.
3. `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/SKELETON-AUDIT.md`, `REFONTE-AUDIT.md`, `FEATURES-KEEP-VS-REMOVE.md`, and `PR-BRIEFS/*.md` are secondary PR checklists.
4. `docs/UI/SKELETON.html` is DS v2 primitives reference only. Do not use it as the app navigation/page skeleton.
5. `docs/UI/CODEX-HANDOFF.md` and the skeleton notes in `docs/UI/` capture DS/primitives handoff notes and local project decisions.

When these conflict, do not silently merge them. Use the conflict rules below, then flag anything unresolved.

## Required Sources

Read these files before implementation:

- `docs/UI/CODEX-HANDOFF.md`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/APP-SKELETON.html`

Load these references for conflict checks or PR-specific checklists:

- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/SKELETON-AUDIT.md`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/REFONTE-AUDIT.md`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/FEATURES-KEEP-VS-REMOVE.md`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/PR-BRIEFS/*.md`

Read `docs/UI/SKELETON.html` only when working on DS v2 primitive styling, tokens, sheets, menus, buttons, cards, dialogs, or AI primitive visual alignment. If a later session mirrors `APP-SKELETON.html` into `docs/UI/APP-SKELETON.html`, prefer that active repo copy and mention the path used.

## Skeleton Conflict Rules

- Quick Start appears twice in the HTML. Implement one Quick Start, using the version with `Capture jobs` as step 3.
- Theme is Light/Dark only. Do not add System mode unless the docs are explicitly changed.
- Numeric match percentages are not user-facing. Use verdict labels instead.
- Onboarding has 6 steps. Implement counters and state as 6, not 5.
- Safe-send is required from the Share menu in both forges. If the row count differs between docs and HTML, keep the HTML row semantics and flag the mismatch before merge.
- Treat `Application package` as a soft display concept, not a primary nav item or data model, unless explicitly requested.
- Do not copy inline styles or literal colors from the static HTML into app code. Translate them to existing DS primitives and tokens.

## Implementation Workflow

1. Identify the active route/component path before editing.
2. Compare app pages and workflows against `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/APP-SKELETON.html`.
3. Preserve all KEEP items for the touched surface.
4. Restore any RESTORE items assigned to that PR.
5. Remove only items explicitly listed for that PR, or ask before deleting.
6. Use DS primitives before custom markup: `Button`, `Input`, `Card`, `Pill`, `Toast`, `Dialog`, `Sheet`, `Menu`, `AiSuggestionCard`, `AiStageList`, `DiffBlock`, `FloatingAiToolbar`.
7. Keep AI library files under `my-app/src/lib/ai/*` untouched.
8. Run the narrowest relevant tests first, then browser verification for rendered UI changes.

## PR Boundaries

- Shell/dashboard work owns app grid, collapsed sidebar, mixed recents, topbar context, command palette, Dashboard, Quick Start, Next Best Action, onboarding entry.
- Proposal work owns Proposal forge split, document stage, proposal rail, share menu, safe-send trigger, floating toolbar verification, export/history preservation.
- Jobs work owns split list/detail, filters, favorites, verdict labels, inline match panel, paste URL/capture entry points.
- CV work owns CV forge split, rail tabs, section organizer, section editor sheets, import review, ATS badge, per-document style, section-scoped Ask AI.
- Documents/templates/settings/auth work owns unified Documents, Templates, Settings inner nav, Document style simplification, sign-in.
- Final parity work owns drift cleanup against `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/APP-SKELETON.html`.

## Reporting

In final responses, state:

- which skeleton source path was used
- which PR contract was touched
- what changed
- what was verified
- any skeleton/doc conflict still unresolved
