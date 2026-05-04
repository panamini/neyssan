# Features — keep, restore, remove, or defer

**Updated:** 2026-04-29
**Companion:** [REFONTE-AUDIT.md](./REFONTE-AUDIT.md)
**Visual authority:** [APP-SKELETON.html](./APP-SKELETON.html)

This file tells implementation sessions which existing features must survive the app skeleton refactor, which missing features must come back, which old surfaces are intentionally killed, and which decisions are deferred.

Rule for Codex: if active code contains behavior not listed here, surface it before deleting. Do not silently drop functionality.

---

## 1. Global product rules

- The skeleton direction wins over old UI shape.
- Keep old behavior only when listed as KEEP/RESTORE or required by active call sites.
- Do not add a primary `Application package` data model or nav item. Use package language only as a soft status/display concept.
- Use verdict labels instead of user-facing numeric match percentages.
- User reviews every send. Do not auto-send or auto-apply final AI changes.
- Use DS primitives before custom markup: `Button`, `Input`, `Card`, `Pill`, `Toast`, `Dialog`, `Sheet`, `Menu`, `AiSuggestionCard`, `AiStageList`, `DiffBlock`, `FloatingAiToolbar`.
- Use existing tokens. Do not introduce new design tokens without stopping and flagging why.
- Keep UI copy sentence case, direct, and quiet.

---

## 2. KEEP — must survive refactor

### App shell, navigation, and dashboard

- Clerk/Convex providers and authenticated account behavior.
- One root `ToastProvider` / toast region.
- Sidebar access to CV, proposal, jobs, documents/libraries, settings, and account.
- Theme toggle, but Light/Dark only.
- Current onboarding/quick-start state behavior where it is already wired.
- Dashboard quick actions for Import CV and New proposal.

### Proposal forge

- Live document render. Edits and variable changes update the on-screen document.
- WYSIWYG paper as the rendered document.
- Edit/Page preview toggle, where Page preview is pagination-faithful.
- Floating AI toolbar above text selections: Rewrite, Shorten, Fix, Ask.
- Mobile fallback for the floating toolbar: bottom-sticky when selection rects are unreliable.
- `AiSuggestionCard` preview-before-apply for Rewrite/Strengthen/Ask.
- No auto-apply for AI suggestions.
- Rail Ask AI free-form prompt, scoped to the whole proposal.
- Tone selector: Warm, Formal, Natural.
- Length selector: Short, Medium, Long.
- Job context panel: role title, company, location, posted date, skill pills.
- Source CV picker and attached-CV sync.
- Export to PDF, Print, and Copy as text.
- Undo/Redo stack with keyboard shortcuts.
- Autosave/draft persistence.
- Version history access through menu or sheet.
- Save to library and saved proposal hydration.

### Jobs

- Capture-from-extension API. Chrome is the primary supported browser; Edge/Brave/Arc may work; Firefox is not committed.
- Paste URL as fallback ingestion path.
- Search across title, company, and skills.
- Verdict label per job: Strong match, Worth a shot, Maybe, Probably skip.
- Match analysis: verdict, plain-English explanation, skills/seniority/location/gap breakdown.
- Filters: verdict tier, Favorites, Remote, Seniority, and custom/additional filters.
- Favorite toggle in list rows and detail header.
- Save for later.
- View source/original posting.
- Generate proposal.
- Resume/CV association where active code already supports it.

### CV forge

- Live document render.
- WYSIWYG paper as the rendered document.
- Edit/Page preview toggle, where Page preview is pagination-faithful.
- Import entry points: Upload PDF, Paste text, Start blank.
- Mistral/structured import wiring.
- Export to PDF and existing authoritative export behavior.
- ATS-ready status, with warning variant when export/parseability is not trusted.
- Section reordering.
- Section hide/show.
- Section delete.
- Add section with presets: Projects, Certifications, Publications, Awards, Volunteer, References, Custom.
- Custom section creation.
- Section-level item editing.
- Hidden sections stay in editor state and are excluded from export.
- Template selection: Editorial, Minimal, Bold, Classic, Compact, Letterpress where supported by active templates.
- Per-document style override for template/font pair/accent.
- Section-scoped Ask AI.
- Active section highlighting in the rail/document where feasible.

### AI surfaces

There are two AI input surfaces. Do not merge them.

| Surface | Scope | Use |
|---|---|---|
| Floating AI toolbar | Selected text only | Quick canned actions when text is selected in the paper. |
| Rail Ask AI | Whole proposal or active CV section | Open-ended prompt when no selected-text quick action is being used. |

Rules:

- Proposal rail Ask AI applies to the whole letter.
- CV rail Ask AI applies only to the active section.
- CV must not offer a `whole CV` rewrite scope.
- Floating toolbar renders only for a non-empty selection inside the paper.
- Reduced motion uses opacity-only toolbar appearance.

### Library / Documents

- Existing CV library open/create/delete behavior.
- Existing proposal library open/save/delete/export behavior.
- Combined Documents view in the skeleton: proposals, CVs, and drafts together.
- Tabs: All, Proposals, CVs, Drafts.
- Search within documents.
- Per-document actions through a menu: duplicate/archive/delete/export where active APIs exist.
- Status pills and verdict labels where applicable.

### Templates

- Rendered preview cards, not abstract empty cards.
- Template set shown in the skeleton: Editorial, Minimal, Bold, Classic, Compact, Letterpress.
- Template selection feeds proposal/CV style where supported.

### Settings

- Profile: name, email, headline.
- Connected accounts: Google, LinkedIn if supported by active auth/integrations.
- Preferences: Light/Dark and Reduce motion.
- Document style: font pair, layout, accent color, page format, signature.
- Voice & tone default.
- Billing management.
- Team pane if active product supports it.
- Danger zone / delete account.

### Auth

- Continue with Google.
- Magic link email sign-in if supported by active auth; otherwise preserve Clerk-compatible equivalent while matching skeleton styling.
- Sign out from command palette and account controls.
- Existing extension popup auth handoff behavior.

### Cross-cutting overlays

- Command palette, portal-mounted to body.
- Safe-send checklist sheet.
- Import review sheet.
- Section editor sheet.
- Toast notifications with live announcements.
- Onboarding replay from command palette.

---

## 3. RESTORE — must come back in the assigned PR

| Feature | PR | Target behavior |
|---|---|---|
| Dashboard route | PR1 | `/dashboard` and root default show the skeleton dashboard. |
| Mixed recents | PR1 | Expanded sidebar shows recent package/job/CV/proposal/document entries. |
| Contextual topbar line | PR1 | Forge pages show `Working on:` context and state pill. |
| Command palette | PR1 | `Cmd/Ctrl+K`, grouped create/go-to/action commands. |
| Browser extension install prompt | PR1 | Onboarding step 5 and Dashboard Quick Start step 3. |
| Quick Start checklist | PR1 | Four-step checklist, single instance, first-time/dismissible behavior. |
| Next Best Action | PR1 | Primary dashboard action block with two CTAs and status pills. |
| Share menu | PR2 and PR4 | Anchored DS `Menu` in both forge stage bars. |
| Safe-send checklist | PR2 and PR4 | DS `Sheet`, opened from Share and command palette. |
| Proposal version history | PR2 | Stage bar menu or sheet. |
| Jobs paste URL fetcher | PR3 | Add job/paste URL entry in Jobs filter/action area. |
| Favorites filter | PR3 | `Favorites` chip in Jobs filters. |
| Inline match panel | PR3 | Detail-side panel; no modal required for normal review. |
| CV import review banner | PR4 | Warning banner above paper when import has unresolved or weak fields. |
| CV import review sheet | PR4 | Side-by-side original fragment and parsed result with Accept/Edit/Delete. |
| CV rail tabs | PR4 | Sections, Ask AI, Style. |
| Section editor sheets | PR4 | One sheet primitive, type-specific forms. |
| Per-section wand | PR4 | Row action opens section-scoped Ask AI. |
| Per-document style override | PR4 | Style tab override persists with the document. |
| Signature picker | PR5 | Settings -> Document style includes five signature options. |
| Unified Documents route | PR5 | Proposals, CVs, and drafts together. |
| Templates route | PR5 | Rendered preview cards matching skeleton. |
| Settings inner nav | PR5 | Account, Preferences, Document style, Voice & tone, Billing, Team, Danger zone. |

---

## 4. REMOVE — intentionally killed during the refactor

| Feature/code | Reason | PR |
|---|---|---|
| `ProposalForgeNext.tsx` | Abandoned migration; `/proposal-next` already redirects. Consolidate any surviving behavior first. | PR2 |
| `proposainputform.bak` and `*.bak` under `my-app/` | Backup/dead files. | Touching PR or cleanup |
| `COLORPALETTE.HTML`, `COLORPALETTE2.HTML` under app source | Design exploration files do not belong in source. | Touching PR or cleanup |
| Symmetric 50/50 form-vs-preview forge layouts | Replaced by document-first 60/40 skeleton. | PR2/PR4 |
| Separate old preview mode language | Replaced by WYSIWYG Edit/Page preview. | PR2/PR4 |
| Proposal rail scope picker | Proposal Ask AI applies to whole letter. | PR2 |
| Whole-CV AI rewrite scope | CV Ask AI is section-scoped only. | PR4 |
| Skills-only drawer as the only section editor | Replaced by section editor sheets for all section types. | PR4 |
| Modal-first job match analysis | Replaced by inline detail match panel. | PR3 |
| Public numeric match percentages | Misleading; replaced by verdict labels. | All PRs |
| Match progress bars | Replaced by verdict/explanation rows. | PR3 |
| Per-stage AI spinners/progress bars | Replaced by `AiStageList`/collapsed AI stream. | PR2/PR4 |
| Heading weight/body size/line-height/margin pickers | Replaced by font pairs, layouts, page format, accent, signature. | PR5 |
| System theme mode | Rejected in `SKELETON-AUDIT.md`; support burden not justified. | PR1/PR5 |
| Illustration-heavy empty states | Replaced by minimalist prompt/action empty states. | PR5/PR6 |
| Preview-only sidebar links | Static skeleton affordances; do not ship `Sign in (preview)` or `Onboarding (preview)`. | PR1 |
| Title Case/exclamation-mark UI strings | Voice rule violation. | All PRs |
| Idle decorative animations | Only the brand period/status dot breathes. | All PRs |
| Hard-coded app colors outside token files | Drift prevention; stylelint enforces. | All PRs |

---

## 5. DEFER — do not build in this refactor

| Feature | Revisit |
|---|---|
| Full Application Package data model | After core v1 flow is stable and user demand proves it. |
| Real-time collaboration | Post-launch. |
| Native mobile apps | Web-first for now. |
| AI agent that fully auto-applies to jobs | Against product principle. |
| Community template marketplace | After core templates settle. |
| Resume / cover letter A/B analytics | Needs real usage data first. |
| Arbitrary structured fields for custom sections | Start with rich text custom section; revisit after section editor usage. |
| Firefox extension support | After Chrome flow is stable. |

---

## 6. Implementation defaults from prior open questions

These are defaults for implementation. The user can still override them before a PR starts.

| Question | Default decision |
|---|---|
| Hidden sections and export | Hidden sections remain visible/greyed in editor state and are excluded from export. |
| Custom section structure | Custom section starts as a user-named rich text body. Structured custom fields are deferred. |
| Per-document style override persistence | Persist override with the document. It does not change global defaults. |
| Quick Start dismiss | Persist dismissal for the user/workspace. Provide replay/reset through command palette or onboarding entry, not a permanent dashboard duplicate. |
| Onboarding replay | Production replay is command-palette first. Sidebar preview link from static HTML should not ship. |
| Safe-send row count | Implement the HTML row semantics first; add extra detector rows only when active code supports them. |
| Legacy `/cvs` and `/proposals` routes | Keep as redirects/adapters/filtered views when adding unified Documents. Do not break bookmarks. |

---

## 7. How Codex should use this file

1. Read this before editing any PR from `REFONTE-AUDIT.md`.
2. For the target surface, preserve every KEEP item.
3. Restore every RESTORE item assigned to that PR.
4. Remove only the REMOVE items assigned to that PR, or items the user explicitly approves deleting.
5. If active code contains behavior not covered here, report it before deletion.
6. If `APP-SKELETON.html` conflicts with this file, follow the HTML for visible UX and update/flag the doc conflict.
