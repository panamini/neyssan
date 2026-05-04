# Refonte audit — twoweeks.ai app skeleton implementation

**Updated:** 2026-04-29
**Status:** implementation contract for PR-sized refactor sessions

> Read first: [APP-SKELETON.html](./APP-SKELETON.html), [SKELETON-AUDIT.md](./SKELETON-AUDIT.md), [FEATURES-KEEP-VS-REMOVE.md](./FEATURES-KEEP-VS-REMOVE.md), [CODEX-HANDOFF.md](./CODEX-HANDOFF.md), and [CODEX-DS-V2-PLAN.md](./CODEX-DS-V2-PLAN.md).
>
> `APP-SKELETON.html` is the target for visible structure, interaction behavior, and page composition. Current app code remains authoritative for imports, data contracts, active APIs, and test boundaries.

---

## 1. Current active-code baseline

Confirmed from active `my-app` on 2026-04-29:

| Area | Current fact | Refactor consequence |
|---|---|---|
| `my-app/src/styles/product.css` | About 1.6k LOC, not 17k. | The old purge PR is stale. Treat style work as cleanup/parity, not a giant split. |
| Feature CSS splits | `product-proposal.css`, `product-jobs.css`, `product-cv.css`, `product-settings.css`, and `product-libraries.css` already exist. | Keep using these files unless a new shell/dashboard CSS file is justified. |
| Stylelint | Hex/rgb/hsl bans already exist for most app CSS, with token-file overrides. | PRs must preserve this guardrail. |
| DS primitives | `Button`, `Input`, `Card`, `Pill`, `Toast`, `Dialog`, `Sheet`, `Menu`, `AiSuggestionCard`, `AiStageList`, `DiffBlock`, and `FloatingAiToolbar` exist. | Do not re-roll these primitives. |
| App shell | `App.tsx` uses a flex shell with `Sidebar`; the skeleton uses grid shell, topbar, collapsed sidebar, mixed recents, cmdk, and dashboard. | Shell/dashboard becomes the first implementation slice. |
| Routes | Root redirects to `/cv`. Active routes include `/cv`, `/cvs`, `/proposal`, `/jobs`, `/proposals`, `/style`, `/settings`, `/sign-in`. | Add skeleton routes deliberately. Keep legacy routes as redirects/adapters where needed. |
| `ProposalForge.tsx` | About 7.2k LOC and active. | Split is still required. |
| `ProposalForgeNext.tsx` | Exists but `/proposal-next` redirects to `/proposal`. | Legacy but informative. Delete only after PR2 consolidates surviving behavior. |
| `JobsPage.tsx` | About 2.8k LOC and active. Favorites and split-detail patterns already partially exist. | Refactor toward exact skeleton split; do not assume features are absent. |
| `CvForge.tsx` | About 1.3k LOC and active. Import/export/style behavior exists. | Align layout and rail model without regressing parser/export flow. |
| `SettingsPage.tsx` | About 1.3k LOC and active. | Split into skeleton inner-nav panes. |

---

## 2. Skeleton authority rules

1. Use `APP-SKELETON.html` as the visual and interaction contract for PR1-PR6.
2. If docs conflict with the HTML, follow the HTML for layout/behavior and update the docs or flag the conflict.
3. If existing app behavior is not listed in `FEATURES-KEEP-VS-REMOVE.md`, surface it before deleting.
4. Do not keep old UI because it is familiar. Keep it only when it is listed as KEEP/RESTORE or when current call sites prove it is required.
5. Do not introduce a primary `Application package` navigation model. The package concept remains a soft label/status only.
6. Do not copy inline static-HTML styles into React. Translate the skeleton into DS primitives, existing tokens, and scoped product CSS.

Known skeleton cleanup decisions:

| Skeleton issue | Implementation decision |
|---|---|
| Quick Start appears twice | Implement one Quick Start, using the version with `Capture jobs` as step 3. |
| Settings contains `System` theme | Do not implement System mode. Light/Dark only. |
| Library card says `match score 76%` | Replace with verdict/status text. No user-facing percentages. |
| Onboarding counter says step 1 of 5 while six panes exist | Implement six steps and a six-step counter. |
| Safe-send row count differs across docs | Implement the HTML's visible row semantics first. Add extra detector rows only if active code already supports them. |
| Sidebar includes preview links for Sign in and Onboarding | Do not ship preview labels. Production entry points must be normal nav/account/cmdk actions. |

---

## 3. Hard rules for every PR

1. **Tokens only.** No new hex/rgb/hsl literals outside token files already exempted by stylelint.
2. **No new design tokens without a stop-and-flag.** Reuse existing tokens first.
3. **Use DS primitives.** Do not re-create buttons, menus, sheets, toasts, cards, AI cards, AI stage lists, or floating toolbar behavior.
4. **Keep AI lib untouched.** `my-app/src/lib/ai/*` is frozen unless the user explicitly scopes AI behavior changes.
5. **One PR equals one merge-ready surface.** No half-finished permanent feature flags.
6. **Preserve parser/export/auth APIs.** The refactor is structural and UX-facing, not a backend rewrite.
7. **No user-facing numeric match percentages.** Use verdict labels.
8. **UI copy:** sentence case, restrained, no exclamation marks, no emoji.
9. **Browser-facing changes require rendered verification.** Use the project browser policy from `AGENTS.md`.

Baseline verification per PR:

```bash
rtk pnpm tsc --noEmit
rtk pnpm lint:css
rtk pnpm exec vite build
```

Then run the narrowest Vitest/Playwright scope for the touched surface. If a listed command is unavailable or blocked by known environment issues, record the exact boundary.

---

## 4. PR sequence

### PR0 — `docs(refonte): skeleton contract + project skill`

**Risk:** low
**Order:** before implementation
**Status:** this documentation slice

Files:

- `.agents/skills/twoweeks-app-skeleton/SKILL.md`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/REFONTE-AUDIT.md`
- `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/FEATURES-KEEP-VS-REMOVE.md`
- `docs/plans/2026-04-29-app-skeleton-refactor.md`

Success criteria:

- Future sessions have a named skill and exact PR contracts.
- Current-code baseline no longer claims stale CSS/LOC facts.
- Skeleton contradictions are documented with implementation decisions.

---

### PR1 — `feat(shell-dashboard): app shell, command palette, and dashboard`

**Risk:** high
**Order:** first code PR
**Primary skeleton sections:** sidebar, topbar, dashboard, command palette, onboarding entry

Files likely touched:

- `my-app/src/App.tsx`
- `my-app/src/components/Sidebar.tsx`
- New `my-app/src/components/CommandPalette.tsx`
- New `my-app/src/lib/commands.ts`
- New `my-app/src/pages/DashboardPage.tsx`
- Existing onboarding files under `my-app/src/components/onboarding/`
- Scoped CSS in `product.css` or a new imported product shell/dashboard CSS file

Required behavior:

- Root route opens Dashboard, not CV forge.
- Sidebar is collapsed by default, expands on hover or pin, and keeps the skeleton Workspace/Library/System grouping.
- Expanded sidebar includes mixed recents: job, CV, proposal/document/package-like status entries.
- Topbar includes breadcrumb, cmdk trigger, Light/Dark toggle, profile/account action, and forge-only context line.
- Command palette opens with `Cmd/Ctrl+K`, closes with Escape, portals to body, and includes create/go-to/action commands from the skeleton.
- Dashboard includes greeting, quick CTAs, one Quick Start checklist, Next Best Action, stats trio, recent activity, quick actions, and cmdk tip.
- Quick Start step 3 is `Capture jobs`, with extension or paste URL.
- Onboarding replay is available through cmdk. Sidebar preview-only onboarding link should not ship as production nav.

Keep/restore:

- Preserve Clerk/Convex providers and existing `QuickStartFlow` entry behavior where still active.
- Preserve sidebar access to CV/proposal creation and authenticated account controls.
- Preserve one root `ToastProvider`.

Success criteria:

- `/dashboard` exists and `/` redirects or resolves to Dashboard.
- Existing active routes still work.
- `Cmd/Ctrl+K` opens from every app route.
- Sidebar collapsed/expanded states match skeleton dimensions and behavior.
- Dashboard visually matches the skeleton structure without duplicate Quick Start.

Suggested verification:

- Unit/component tests for command registry and palette open/close.
- Existing sidebar tests.
- Browser check for `/dashboard`, `/cv`, `/proposal`, `/jobs`, and `/settings`.

---

### PR2 — `refactor(proposal): skeleton Proposal forge surfaces`

**Risk:** high
**Order:** after PR1
**Primary skeleton section:** Proposal forge

Files likely touched:

- `my-app/src/pages/ProposalForge.tsx`
- New `my-app/src/components/proposal/ProposalDocumentStage.tsx`
- New `my-app/src/components/proposal/ProposalRail.tsx`
- New `my-app/src/components/proposal/ProposalAIStream.tsx`
- New or existing `my-app/src/hooks/useProposalDraft.ts`
- New or existing `my-app/src/hooks/useProposalExport.ts`
- `my-app/src/pages/ProposalForgeNext.tsx` after consolidation
- `my-app/src/styles/product-proposal.css`

Required behavior:

- Document-first 60/40 forge: paper stage plus 360px rail.
- Stage bar includes status, tone, Edit/Page preview, Undo/Redo, and anchored Share menu.
- Share menu uses DS `Menu`, is anchored to trigger, and opens Safe-send via DS `Sheet`.
- Paper remains WYSIWYG; Page preview is pagination-faithful, not a separate old preview mode.
- Floating AI toolbar remains selection-scoped and hides when selection clears.
- Proposal rail order: job context, source CV picker, collapsed AI stream, tone, variables, Ask AI, length/settings.
- Rail Ask AI scopes to the whole proposal. No scope picker.
- AI stage display uses `AiStageList`/collapsed stream, not progress bars.

Keep/restore:

- Live render, autosave, export PDF, print, copy as text, undo/redo, version history, job context, source CV linking, length/tone selectors, preview-before-apply AI suggestions.
- Existing tests for draft persistence, export behavior, job/CV scope, saved view, provider busy state, and style sync.

Remove:

- `ProposalForgeNext.tsx` only after all surviving behavior is consolidated.
- Symmetric 50/50 form-vs-preview layout.
- Per-stage spinners/progress bars.
- Proposal rail scope picker.

Success criteria:

- `ProposalForge.tsx` becomes an orchestrator, preferably under 500 LOC after state extraction.
- New files stay narrowly scoped and under 800 LOC unless justified.
- Proposal creation, AI generation, selection toolbar, save, export, and saved-view hydration still work.
- Safe-send sheet opens from Share and blocks send when checks fail.

Suggested verification:

- Existing ProposalForge Vitest files relevant to changed behavior.
- Browser check for selection toolbar and Share menu anchoring.

---

### PR3 — `refactor(jobs): skeleton split-view jobs workspace`

**Risk:** medium
**Order:** after PR1, independent of PR2
**Primary skeleton section:** Jobs

Files likely touched:

- `my-app/src/pages/JobsPage.tsx`
- New `my-app/src/components/jobs/JobsList.tsx`
- New `my-app/src/components/jobs/JobDetail.tsx`
- New `my-app/src/components/jobs/JobMatchPanel.tsx`
- New or existing `my-app/src/hooks/useJobsQuery.ts`
- `my-app/src/styles/product-jobs.css`

Required behavior:

- Split view: 360px list column plus detail column.
- Sticky filters at top of list.
- Filters include search, verdict tier, Favorites, Remote, Senior, and custom/additional filter affordance.
- Favorite toggle exists in list rows and detail header.
- Job row uses verdict labels, not percentages.
- Detail header includes title, company/location/verdict, Save, View source, Favorite, and Generate proposal.
- Match analysis is inline/sticky in detail, with verdict, plain-English explanation, skills/seniority/location/gap rows, and `See full breakdown`.
- Paste URL and browser-extension capture entry points remain available.

Keep/restore:

- Existing capture-from-extension API and paste URL ingestion.
- Search across title/company/skills.
- Save for later and Generate proposal.
- Existing favorites behavior if already active.

Remove:

- Modal-based match analysis.
- Progress bars for match quality.
- User-facing numeric match percentages.

Success criteria:

- `JobsPage.tsx` becomes a layout shell, preferably under 400 LOC after extraction.
- Match analysis is visible without opening a modal.
- Favorites filter and toggles work with optimistic state.
- No public route shows `%` match scores.

Suggested verification:

- Existing `JobsPage` tests and `JobsPage.layout.contract.test.ts`.
- Browser check for desktop split and responsive single-column behavior.

---

### PR4 — `refactor(cv): skeleton CV forge rail, import review, and section sheets`

**Risk:** high
**Order:** after PR2 if sharing document stage, otherwise after PR1
**Primary skeleton section:** CV forge

Files likely touched:

- `my-app/src/pages/CvForge.tsx`
- New `my-app/src/components/document/DocumentStage.tsx` if extracted from proposal
- New `my-app/src/components/cv/CvRail.tsx`
- New `my-app/src/components/cv/CvAIStream.tsx`
- New `my-app/src/components/cv/SectionEditorSheet.tsx`
- Existing `ProfileReviewCard.tsx` / import review components as needed
- `my-app/src/styles/product-cv.css`

Required behavior:

- Document-first 60/40 forge: paper stage plus 360px tabbed rail.
- Stage bar includes saved/status, ATS-ready badge, tone, Edit/Page preview, Version history, anchored Share menu.
- Review banner appears above paper when import is incomplete or fields are weak.
- Import review opens as DS `Sheet`, showing original fragment beside parsed result with Accept/Edit/Delete.
- Rail tabs are `Sections`, `Ask AI`, and `Style`.
- Collapsed AI stream is visible across tabs only while AI work is running.
- Sections tab includes drag handles, active row, hide/show, delete, wand, add section menu, and hidden row treatment.
- Click section row opens a section-specific editor sheet.
- Ask AI is always active-section scoped. Never offer whole-CV rewrite.
- Style tab provides per-document template/font pair/accent override and links to Settings -> Document style.
- Footer utility buttons keep Import PDF and Paste text always reachable.

Keep/restore:

- Live render/export, Mistral import, paste text/start blank, section hide/delete/reorder, custom section, style presets, authoritative export, ATS export status.
- Existing parser/import tests and export tests.

Remove:

- Generic accordion rail.
- Skills-only drawer as the only section editor.
- Whole-CV AI scope.
- Old preview mode language that conflicts with Edit/Page preview.

Success criteria:

- `CvForge.tsx` becomes an orchestrator, preferably under 500 LOC after extraction.
- Import review sheet and review banner match skeleton behavior.
- Section visibility excludes hidden sections from export while keeping them visible in editor state.
- ATS badge has ready and warning variants.

Suggested verification:

- Existing `CvForge` export/status/workspace tests.
- Import review component tests.
- Browser check for rail tabs, section sheet, and import review sheet.

---

### PR5 — `feat(documents-templates-settings-auth): remaining skeleton pages`

**Risk:** medium
**Order:** after PR1, can run in parallel with PR2-PR4 if routes are coordinated
**Primary skeleton sections:** Documents, Templates, Settings, Sign in

Files likely touched:

- New `my-app/src/pages/DocumentsPage.tsx`
- Existing `my-app/src/pages/ProposalsLibrary.tsx`
- Existing `my-app/src/pages/CvsLibrary.tsx`
- New or existing `my-app/src/pages/TemplatesPage.tsx`
- `my-app/src/pages/SettingsPage.tsx`
- New `my-app/src/pages/settings/*`
- `my-app/src/pages/SignInPage.tsx`
- `my-app/src/styles/product-libraries.css`
- `my-app/src/styles/product-settings.css`

Required behavior:

- Unified Documents page contains proposals, CVs, and drafts with tabs All/Proposals/CVs/Drafts.
- Existing `/cvs` and `/proposals` remain as compatibility redirects, filtered views, or adapters.
- Document cards use DS `Card`, status/verdict pills, last-updated metadata, search, and menu actions.
- Templates page shows rendered preview cards for Editorial, Minimal, Bold, Classic, Compact, and Letterpress.
- Settings uses inner nav: Account, Preferences, Document style, Voice & tone, Billing, Team, Danger zone.
- Preferences has Light/Dark only plus Reduce motion.
- Document style includes font pair, layout, accent color, page format, and signature only.
- Sign-in supports Continue with Google and magic link styling from skeleton, adapted to active Clerk/auth capabilities.

Keep/restore:

- Existing libraries' create/open/delete/export behavior.
- Existing print pages and fixed paper inks.
- Existing auth handoff behavior required by extension popup.

Remove:

- Separate UX that forces users to choose CV library vs proposal library before seeing documents.
- Heading weight/body size/line-height/margin pickers.
- System theme mode unless explicitly re-approved.
- Illustration-heavy empty states.

Success criteria:

- `/documents` and `/templates` exist.
- Settings route can deep-link to each pane or maintains stable inner nav state.
- Old library routes still do not break bookmarks/tests.
- Sign-in remains compatible with Clerk.

Suggested verification:

- Existing library/settings/sign-in tests.
- Browser check for `/documents`, `/templates`, `/settings`, `/sign-in`.

---

### PR6 — `test(refonte): skeleton parity and drift cleanup`

**Risk:** medium
**Order:** last
**Primary skeleton sections:** all

Files likely touched:

- Focused tests in `my-app/src/**/__tests__`
- Playwright specs under `tests/` or existing e2e location
- Small CSS/markup parity fixes from rendered checks

Required behavior:

- Compare every skeleton page/sheet/palette against active app behavior.
- Verify no duplicate Quick Start.
- Verify six-step onboarding counter.
- Verify Light/Dark only.
- Verify no public `%` match score UI.
- Verify Share menus are anchored and Safe-send opens in both forges.
- Verify Import review sheet opens from CV review banner and safe-send row.
- Verify command palette opens globally.
- Verify documents/templates/settings routes match skeleton structure.

Success criteria:

- A browser-backed parity checklist is attached to the PR.
- Any deliberate skeleton deviation is documented in `SKELETON-AUDIT.md` or this file.
- No known user-facing skeleton contradictions remain untracked.

---

## 5. Dependency graph

```text
PR0 docs/skill
  |
  v
PR1 shell/dashboard/cmdk
  |------------------|------------------|
  v                  v                  v
PR2 proposal      PR3 jobs           PR5 docs/templates/settings/auth
  |
  v
PR4 CV forge
  |
  v
PR6 parity cleanup
```

Notes:

- PR2 and PR3 can run independently after PR1 if routes/shell are stable.
- PR5 can run after PR1 but must coordinate route names with PR1.
- PR4 should wait for PR2 if `DocumentStage` is extracted there.
- PR6 is last.

---

## 6. Out of scope for this refonte

- Backend parser redesign.
- Convex environment fixes unrelated to touched UI.
- `structuredUpload` backend behavior changes unless a touched UI path requires a compile fix.
- AI auto-apply flows that bypass user review.
- Real-time collaboration.
- Native mobile apps.
- Community template marketplace.
- Resume/proposal A/B analytics.

---

## 7. Session instructions for Codex

Before starting a PR:

1. Use the `twoweeks-app-skeleton` skill.
2. Read `APP-SKELETON.html`, `SKELETON-AUDIT.md`, this file, and `FEATURES-KEEP-VS-REMOVE.md`.
3. Inspect active code paths before proposing edits.
4. State the PR slice and touched ownership boundary.
5. Implement only that PR slice.
6. Run the narrowest relevant tests and browser checks.
7. Report exact files changed, verification run, and unresolved drift.
