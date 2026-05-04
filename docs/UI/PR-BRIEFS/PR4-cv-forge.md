# PR4 — `refactor(cv): skeleton CV forge rail, import review, and section sheets`

**Risk:** high
**Order:** after PR2 if sharing document stage; otherwise after PR1
**Estimate:** 2–3 sessions
**Skeleton authority:** [`APP-SKELETON.html` lines 1861–2081](../APP-SKELETON.html), import-review sheet 2680–2746

> **Defensive note for the implementer:** every selector, line range, file path, import, and token quoted here was best-effort against the spec. If active code disagrees, **trust the code, not this brief**. Fix it and call out the correction in the PR description. The CV import + parser pipeline must NOT regress — read the existing `useStructuredMistralImport.ts` and parser-adjacent tests before refactoring.

---

## 1. What this PR is

Convert the existing `CvForge.tsx` (~1.3k LOC) into a thin orchestrator that mounts:

- a **document-first 60/40 stage** (paper + 360px tabbed rail),
- a **review banner** above the paper when import has unresolved issues,
- an **Import Review sheet** with original-vs-parsed compare blocks,
- a **rail with three tabs**: Sections, Ask AI, Style,
- a **collapsed AI stream** visible across tabs while AI is running,
- **section editor sheets** — one Sheet primitive with type-specific editor inside,
- a **Share menu + Safe-send sheet** matching PR2's pattern.

What this PR is **not**: a parser refactor, a verdict-engine change, an export-pipeline rebuild. The Mistral import API, ATS export logic, and authoritative export behavior must keep working.

---

## 2. Files

### Touch

| File | Change |
|---|---|
| `my-app/src/pages/CvForge.tsx` | Reduce to an orchestrator (≤ 500 LOC). Renders `<DocumentStage>` + `<CvRail>`. |
| `my-app/src/components/document/DocumentStage.tsx` | If extracted from PR2, share between Proposal and CV forges. Otherwise duplicate the proposal stage's layout. |
| `my-app/src/components/cv/CvStageBar.tsx` (new) | Status, ATS-ready badge, tone, Edit/Page-preview, Version history, Share menu. |
| `my-app/src/components/cv/CvReviewBanner.tsx` (new) | Warning banner above paper. Spec §3.3. |
| `my-app/src/components/cv/CvRail.tsx` (new) | 3-tab rail with collapsed AI stream + footer Import row. |
| `my-app/src/components/cv/CvRailTabSections.tsx` (new) | Section drag list + add-section anchored menu. |
| `my-app/src/components/cv/CvRailTabAskAi.tsx` (new) | Section-scoped Ask AI. **Never offers whole-CV scope.** |
| `my-app/src/components/cv/CvRailTabStyle.tsx` (new) | Per-document template / font pair / accent override. |
| `my-app/src/components/cv/SectionEditorSheet.tsx` (new) | One Sheet primitive that switches its body by section type. |
| `my-app/src/components/cv/sectionEditors/*` (new) | One file per section type: `HeaderEditor`, `ExperienceEditor`, `EducationEditor`, `SkillsEditor`, `ProjectsEditor`, `CustomEditor`, etc. Move existing skills-drawer logic in. |
| `my-app/src/components/cv/ImportReviewSheet.tsx` (new) | DS Sheet with compare-grid review blocks. Spec §6. |
| `my-app/src/components/cv/SafeSendSheet.tsx` | Reuse PR2's component; do not duplicate. Import the same module. |
| `my-app/src/styles/product-cv.css` | Add classes from §7. |

### Reuse (do not edit)

| File | Reason |
|---|---|
| `my-app/src/components/structured-blocks/SkillsDrawer.tsx` | Migrate **callers** to `SectionEditorSheet` instead of editing in place. The drawer can be deleted only once nothing imports it. |
| `my-app/src/components/AddSectionBottomSheet.tsx` | Replace with the `Sheet` primitive + section-editor sheet model. Delete after migration verified. |
| `my-app/src/components/useStructuredMistralImport.ts` | Frozen. Consume the existing API. |
| `my-app/src/components/ProfileReviewCard.tsx`, `ProfileReviewModal.tsx`, `ImportCvPreviewModal.tsx`, `ImportRecoveryPanel.tsx`, `ImportWarningBanner.tsx` | These represent the current import-review surface. Read them, then **port** the data flow into `ImportReviewSheet.tsx` — do not edit them in place. They become deletable in PR6 after parity is verified. |
| `my-app/src/components/ai/*` and `my-app/src/lib/ai/*` | Frozen. |

---

## 3. Visible behavior — line-by-line against APP-SKELETON.html

### 3.1 Layout — lines 1861–2081

```
<section class="app-page" data-page-id="cv">
  <div class="forge">
    <div class="forge__stage">…stage bar…review banner…paper…</div>
    <aside class="forge__rail">…rail-tabs + 3 panes + footer Import row…</aside>
  </div>
</section>
```

Same `.forge` grid as PR2 (1fr / 360px). Stage centers a `max-width: 760px` paper.

### 3.2 Stage bar — lines 1864–1888

Order, left to right:

1. `<span class="ds-status ds-status--{success|accent|warning|danger}">` with internal dot. Default `Saved`.
2. `<span class="ds-ats" title="Parses cleanly into Applicant Tracking Systems."><span class="ds-ats__icon">✓</span>ATS-ready</span>`. Variants: `ds-ats--ready`, `ds-ats--warn`. Title text changes per variant.
3. `<span class="ds-tone ds-tone--formal">Formal tone</span>` (or whichever tone the doc is set to).
4. `<span class="spacer"></span>`
5. **Segmented Edit / Page preview** (`.style-segmented`) — same as PR2.
6. `<button class="ds-btn ds-btn--sm ds-btn--ghost">Version history</button>` (or anchored menu, follow active behavior).
7. **Share menu** — same anchored DS `Menu` as PR2, opening the same `SafeSendSheet`.

### 3.3 Review banner — lines 1889–1900

Renders **only when** the import pipeline has flagged an unresolved or weak block.

```
<div class="ds-banner ds-banner--warn">
  <div class="ds-banner__icon">!</div>
  <div class="ds-banner__body">
    <div class="ds-banner__title">Quick review needed.</div>
    <div class="ds-banner__desc">{N} sections need confirmation — {summary}.</div>
    <div class="ds-banner__actions">
      <button class="ds-btn ds-btn--sm ds-btn--secondary" onclick="openImportReview">Open import review</button>
      <button class="ds-btn ds-btn--sm ds-btn--ghost" onclick="dismissBanner">Dismiss</button>
    </div>
  </div>
</div>
```

Dismiss persists per-document, not globally. If the user re-imports, the banner returns.

### 3.4 Paper — lines 1902–1911

`<article class="ds-paper">` with structured blocks. Sections render in their stored order (Header / Experience / Education / Skills / …). Click a section heading or row in the rail's Sections list opens its `SectionEditorSheet`.

The "empty-state alternative" `<details>` block at lines 1913–1933 is **mock-only** in the skeleton — render it as the genuine empty state when the CV has zero sections, not as a `<details>` toggle.

Empty-state structure (`.cv-import-card`):

- `Upload PDF` — opens file picker, runs Mistral import.
- `Paste text` — opens a paste-text dialog.
- `Start blank` — creates a blank section list with a Header block.

### 3.5 Rail tabs — lines 1938–2078

Three tabs, only one pane visible at a time. **No accordion. No infinite-scroll.**

```
<div class="rail-tabs" role="tablist">
  <button data-active="true">Sections</button>
  <button>Ask AI</button>
  <button>Style</button>
</div>
```

#### 3.5.1 Collapsed AI stream — lines 1944–1955

Renders **above** the active pane, **between** the tabs and the pane. Visible across all three tabs while AI work is running; hidden when no AI work is active.

#### 3.5.2 Tab 1 — Sections (default) — lines 1958–2034

```
<div class="rail-pane" data-rail-pane="sections" data-active="true">
  Header row: "Sections" label + helper "Drag to reorder · ⌖ wand"
  <div class="org-list">
    <div class="org-row" [data-active] [data-hidden]>
      <span class="org-handle">⋮⋮</span>
      <span class="org-row__title">{name}</span>
      <span class="org-row__count">{n} items | hidden}</span>
      <span class="org-row__actions">
        <button class="org-row__action org-row__action--wand" title="Rewrite with AI">⌖</button>
        <button class="org-row__action" title="Hide|Show">{◐|●}</button>
        <button class="org-row__action" data-tone="danger" title="Delete">×</button>
      </span>
    </div>
    …
  </div>
  <button class="org-add">+ Add section</button>  → anchored menu
  Helper: "Click a section row to edit its items. Each section opens its own editor — Skills uses chips, Experience uses a list of jobs, etc."
</div>
```

- **Drag** uses dnd-kit if available; reorder persists to draft state.
- **Active row** (`data-active="true"`) — driven by which section is currently focused in the paper. Bidirectional: clicking a row in the paper highlights its rail row; clicking a rail row scrolls the paper to the section and opens the section editor sheet.
- **Hidden row** (`data-hidden="true"`) — greyed, count shows `hidden`, hide-action becomes "show".
- **Wand `⌖`** — opens the Ask AI tab pre-scoped to that section.
- **Delete `×`** — confirmation toast with Undo (use the existing toast region).

Add Section menu — anchored, same DS `Menu` primitive as elsewhere:

```
[label] Add a section
Projects · Certifications · Publications · Awards · Volunteer · References
─ separator ─
+ Custom section…
```

`+ Custom section…` opens an inline naming flow — defaults to a rich-text body per `FEATURES-KEEP-VS-REMOVE.md` §6 (structured custom fields are deferred).

#### 3.5.3 Tab 2 — Ask AI (always section-scoped) — lines 2037–2048

```
<div class="rail-pane" data-rail-pane="ai">
  <div class="forge__rail-label">Ask AI — {Section name}</div>
  <div>Editing the section selected in the paper. Click another section header to switch — or use the ⌖ wand on any row.</div>
  <textarea class="ds-field ds-field--textarea" placeholder="Tighten the second bullet, drop the buzzwords."></textarea>
  <div class="row" style="gap: var(--s2);">
    <span class="ds-tone ds-tone--warm">Warm</span>
    <span class="ds-tone ds-tone--formal">Formal</span>
    <span class="ds-tone ds-tone--natural">Natural</span>
  </div>
  <button class="ds-btn ds-btn--md ds-btn--primary">Apply to {Section name}<span class="ds-btn__period">.</span></button>
  <div>CVs are edited section-by-section. To rewrite multiple sections, run them one at a time.</div>
</div>
```

**Hard rule from FEATURES-KEEP-VS-REMOVE.md §2:** the CV must not offer a whole-CV rewrite scope. The label always names a specific section. If no section is selected, the textarea is disabled with helper `Pick a section in the paper or rail to start.`

Result of the AI run: feeds an `<AiSuggestionCard>` preview before applying — same rulebook as the proposal forge. Never auto-applies for Rewrite/Strengthen/Ask.

#### 3.5.4 Tab 3 — Style (per-document override) — lines 2051–2072

```
<div class="rail-pane" data-rail-pane="style">
  Helper: "Per-document style. Defaults come from Settings → Document style."
  Template — three pills: Editorial (selected by default per current template) · Minimal · Classic
  Font pair — <select> with: "Baskervville × Geist" (default), "Geist × Geist", "Iowan × Geist", "Georgia × SF Mono"
  Accent — six swatches: Terre #A84E2E (default), Ink #0F0C08, Cobalt #2A78D6, Sauge #3B6E4E, Plum #7A4FA0, Ochre #B8843A
</div>
```

The hex literals above are **example values shown by the swatch buttons in the skeleton**. In the real app:

- Use existing accent tokens from `foundation.css` if defined. Likely `--accent-terre`, `--accent-ink`, etc. — check before adding.
- If foundation tokens for these accents do not exist yet, the swatches must reference token-only values. **Do not inline hex literals into `product-cv.css`** — add the tokens to `foundation.css` (which is exempted by stylelint) under the `[data-theme]` blocks, then reference them.

Per-document style override persists with the document (per `FEATURES-KEEP-VS-REMOVE.md` §6 default).

#### 3.5.5 Footer Import row — lines 2074–2078

Always visible across all tabs. Sticky to the bottom of the rail.

```
<div style="margin-top: auto; padding-top: var(--s3); border-top: 1px solid var(--border-soft); display: flex; gap: var(--s2);">
  <button class="ds-btn ds-btn--sm ds-btn--ghost" style="flex:1;">↗ Import PDF</button>
  <button class="ds-btn ds-btn--sm ds-btn--ghost" style="flex:1;">¶ Paste text</button>
</div>
```

Both buttons trigger the existing import flows. Successful import re-parses sections and surfaces the review banner if any block is uncertain.

---

## 4. Section editor sheets

One DS `Sheet` primitive (`SectionEditorSheet.tsx`) that switches its body by section type. Right drawer on desktop, bottom on mobile. Portaled to `<body>`.

### 4.1 Open paths

- Click a section row in the rail's Sections tab.
- Click a section heading inside the paper.
- Command palette: `Edit {section}` (deferred).

### 4.2 Per-type editors

| Section type | Body editor |
|---|---|
| `header` | Name, headline, contact fields. |
| `experience` | List of jobs (role / company / dates / bullets). Reuse existing structured-block models. |
| `education` | List of schools (degree / institution / dates / location). |
| `skills` | Chips editor — port the existing `SkillsDrawer` body. |
| `projects` | List of projects (title / description / link / dates). |
| `certifications`, `publications`, `awards`, `volunteer`, `references` | Generic list-of-items editor. |
| `custom` | User-named rich-text body (defer structured fields per §6 default). |

Each editor saves on close and on every input debounce — same autosave semantics as the rest of the forge.

### 4.3 Sheet structure (DS spec §06b in APP-SKELETON.html)

```
<aside class="ds-sheet" id="sectionEditorSheet" role="dialog" aria-modal="true" aria-labelledby="…">
  <div class="ds-sheet__head">
    <div>
      <div class="ds-sheet__title">{Section name}</div>
      <div class="ds-sheet__copy">{type-specific helper}</div>
    </div>
    <button class="ds-icon-btn" aria-label="Close">×</button>
  </div>
  <div class="ds-sheet__body">{type-specific editor body}</div>
  <div class="ds-sheet__actions">
    <button class="ds-btn ds-btn--md ds-btn--ghost">Cancel</button>
    <span class="spacer"></span>
    <button class="ds-btn ds-btn--md ds-btn--primary">Save<span class="ds-btn__period">.</span></button>
  </div>
</aside>
```

Cancel discards unsaved edits if the user explicitly typed. If autosave is already running, Cancel = Close.

---

## 5. Keep / Restore / Remove (from `FEATURES-KEEP-VS-REMOVE.md`)

### Keep

- Live document render
- WYSIWYG paper as the rendered document
- Edit / Page preview toggle (Page preview is pagination-faithful)
- Import entry points: Upload PDF, Paste text, Start blank
- Mistral / structured import wiring
- Export to PDF + authoritative export behavior
- ATS-ready status with warning variant
- Section reorder, hide/show, delete
- Add section presets (Projects, Certifications, Publications, Awards, Volunteer, References, Custom)
- Custom section creation
- Section-level item editing
- Hidden sections excluded from export but visible in editor state
- Template selection (Editorial, Minimal, Bold, Classic, Compact, Letterpress where supported)
- Per-document style override (template / font pair / accent)
- Section-scoped Ask AI
- Active section highlighting

### Restore

- Review banner above paper for incomplete imports
- Import review sheet (compare-grid Accept/Edit/Delete)
- Rail tabs (Sections / Ask AI / Style)
- Section editor sheets (one Sheet primitive, type-specific bodies)
- Per-section wand (Ask AI scoped)
- Per-document style override

### Remove

- Generic accordion rail
- Skills-only drawer as the **only** section editor (Skills becomes one of many sheet bodies)
- Whole-CV AI scope
- Old preview-mode language conflicting with Edit/Page preview

---

## 6. Import Review sheet — lines 2680–2746

Right drawer DS `Sheet`. Open from:

- Review banner's `Open import review` button.
- Safe-send sheet's `Unresolved import issues` row's `Resolve` button.
- Command palette: `Resolve import review`.

### 6.1 Body structure

1. **Top banner** (`ds-banner ds-banner--warn`) — `{N} uncertain blocks remain.` + descriptor.
2. **Per-block** `<div class="review-block">`:
   - Head: `<strong>{block name}</strong>` + `<span class="ds-pill ds-pill--warning">Uncertain</span>` (or `success` once resolved).
   - **Compare grid** (`.compare-grid`): two columns. Left: `Original fragment` (read-only `.fragment` div). Right: `Parsed result` (`<textarea class="ds-field ds-field--textarea">` editable).
   - Action row: `Accept` (primary) · `Edit` (secondary) · `Delete block` (danger). Accept commits the parsed-result text. Edit puts the textarea into focus mode without committing. Delete removes the block from the CV.

### 6.2 Footer

- `Close` (ghost).
- `Accept all clear` (primary) — commits all blocks not currently flagged uncertain.

### 6.3 Behavior

- Export stays blocked while any block is `Uncertain`. The Safe-send checklist's `Unresolved import issues` row reflects the count.
- Closing the sheet preserves in-progress edits as draft state — only `Accept` / `Accept all clear` commit.
- Empty state: `All blocks resolved.` + `Close` button.

---

## 7. CSS classes used by this PR

### Already expected to exist (PR1 / PR2)

- All `.ds-btn`, `.ds-field`, `.ds-pill`, `.ds-status`, `.ds-tone`, `.ds-card`, `.ds-sheet`, `.ds-menu`, `.ds-scrim` from earlier briefs.
- `.forge`, `.forge__stage`, `.forge__rail`, `.forge__stage-bar`, `.forge__rail-section`, `.forge__rail-label`, `.ds-paper`, `.ds-paper__meta`, `.style-segmented`, `.ai-stream-collapsed`, `.ai-stream-expanded`, `.ai-stage`, `.spacer`, `.row`, `.col` from PR2.

### Added or extended in this PR (in `product-cv.css`)

- `.ds-ats`, `.ds-ats__icon`, `.ds-ats--ready`, `.ds-ats--warn`
- `.ds-banner`, `.ds-banner--warn`, `.ds-banner__icon`, `.ds-banner__body`, `.ds-banner__title`, `.ds-banner__desc`, `.ds-banner__actions`
- `.rail-tabs`, `.rail-pane`, `[data-active]` selectors for both
- `.org-list`, `.org-row`, `.org-row[data-active]`, `.org-row[data-hidden]`, `.org-handle`, `.org-row__title`, `.org-row__count`, `.org-row__actions`, `.org-row__action`, `.org-row__action--wand`, `.org-row__action[data-tone="danger"]`
- `.org-add` (+ Add section button)
- `.cv-import-card`, `.cv-import-choice`, `.cv-import-choice__icon`, `.cv-import-choice__title`, `.cv-import-choice__desc` (empty state)
- `.style-swatches`, `.style-swatch`, `.style-swatch[data-selected="true"]`
- `.review-block`, `.review-block__head`, `.compare-grid`, `.fragment`, `.ba-label`
- (If shared with PR2's safe-send: prefer to put these in `product-document.css` — a new shared file imported by both forges.)

---

## 8. Behavior contracts (testable)

1. `/cv` renders the new layout with stage + 3-tab rail.
2. Default tab is Sections.
3. Tab clicks switch panes without scrolling the page.
4. Collapsed AI stream renders only while AI work is in flight; otherwise the slot is empty.
5. Clicking a section row in the rail opens that section's editor sheet — the same Sheet primitive with the right body.
6. Clicking the per-row wand opens Ask AI tab with the section pre-selected.
7. Hidden sections render greyed in the editor and **are excluded from the rendered paper and from the export PDF**.
8. Ask AI tab never offers a whole-CV scope. With no section selected, the textarea is disabled.
9. Import review banner appears whenever the import pipeline marks any block uncertain. Dismissing persists per-document.
10. Import review sheet's Accept commits a single block; the banner updates to reflect the new count.
11. Page preview toggles paginated rendering with visible page breaks; switching back restores flow view.
12. ATS badge has both `Ready` and `Warn` variants, each with a tooltip explaining why.
13. Per-document style override changes the paper rendering immediately and persists when the document reopens.
14. Reduced-motion disables every animation introduced by this PR.

---

## 9. Verification

```bash
rtk pnpm tsc --noEmit
rtk pnpm lint:css
rtk pnpm test --run my-app/src/pages/__tests__/CvForge*
rtk pnpm test --run my-app/src/components/cv/__tests__/*
rtk pnpm test --run my-app/src/components/structured-blocks/__tests__/*
rtk pnpm test --run my-app/src/components/__tests__/SkillsDrawer*       # if any
rtk pnpm test --run my-app/src/components/ProfileReviewModal*           # if any
rtk pnpm exec vite build
```

Browser checks (rendered):

- `/cv` shows stage + 3-tab rail. Tabs switch.
- Importing a sample PDF surfaces the review banner; opening the sheet shows compare-grid blocks.
- Accept/Edit/Delete each work; banner count updates.
- Section editor sheet opens for each section type; Skills editor uses chips.
- Ask AI applied to one section affects only that section.
- Hidden sections do not render in Page preview or in the exported PDF.
- Style tab override changes paper rendering live.
- Share menu + Safe-send sheet behave the same as PR2.
- Light + Dark both clean.

---

## 10. Out of scope for PR4

- Mistral parser changes.
- Backend `structuredUpload` mutations.
- Custom section structured fields (deferred per §6 default).
- Rebuilding `ProfileReviewCard.tsx` / `ImportRecoveryPanel.tsx` themselves — they get **replaced by `ImportReviewSheet.tsx`** in this PR; deletion is PR6 cleanup.
- AI rulebook changes.
- Export-pipeline changes.
