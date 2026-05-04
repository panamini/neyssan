# PR2 — `refactor(proposal): skeleton Proposal forge surfaces`

**Risk:** high
**Order:** after PR1
**Estimate:** 2–3 sessions, with state extraction the riskiest part
**Skeleton authority:** [`APP-SKELETON.html` lines 1604–1756](../APP-SKELETON.html), §06b Sheet, §06c Menu

> **Defensive note for the implementer:** every selector, line range, file path, import, and token quoted in this brief was best-effort against the spec. If active code disagrees — wrong import path, renamed primitive, missing utility — **trust the code, not this brief**. Fix it and call out the correction in the PR description. Do not invent new tokens or DS primitives to satisfy a quoted name that turns out to be wrong.

---

## 1. What this PR is

Convert the existing ~7.2k-LOC `ProposalForge.tsx` into a thin orchestrator that mounts:

- a **document-first 60/40 stage** (paper + 360px rail),
- a **DS-anchored Share menu** that opens a Safe-send Sheet,
- a **selection-scoped FloatingAiToolbar** (already implemented — reuse, do not re-author),
- a **collapsed AI stream** that expands on click,
- a **single rail Ask AI** that scopes to the whole proposal (no scope picker).

What this PR is **not**: a backend, parser, AI rulebook, export-engine, or auth refactor. The visible API of `lib/ai/*`, `useProposalDraft`, `useProposalExport`, parser, and Convex/Clerk providers must not change.

---

## 2. Files

### Touch

| File | Change |
|---|---|
| `my-app/src/pages/ProposalForge.tsx` | Reduce to an orchestrator (≤ 500 LOC after extraction). Owns route-level state and providers. Renders `<ProposalDocumentStage>` + `<ProposalRail>`. |
| `my-app/src/components/proposal/ProposalDocumentStage.tsx` (new) | Stage column. Contains stage bar, paper, live-render footer line. |
| `my-app/src/components/proposal/ProposalStageBar.tsx` (new) | The strip above the paper (status pill, tone pill, segmented Edit/Page-preview, Undo, Redo, anchored Share menu). |
| `my-app/src/components/proposal/ProposalRail.tsx` (new) | Right rail. Linear (no tabs). Renders the 7 sections in order from §3. |
| `my-app/src/components/proposal/ProposalAIStream.tsx` (new) | Collapsed/expanded AI stage list. Shared shape with the CV forge (PR4 may extract). |
| `my-app/src/components/proposal/ProposalShareMenu.tsx` (new) | Anchored DS `Menu` triggered by the Share button. |
| `my-app/src/components/proposal/SafeSendSheet.tsx` (new) | DS `Sheet` portaled to `<body>`. Spec §6. |
| `my-app/src/styles/product-proposal.css` | Add or extend with the classes listed in §7. If the file does not exist, create it and import in the same place existing product CSS is imported. |

### Leave alone

| File | Reason |
|---|---|
| `my-app/src/lib/ai/*` | Frozen. Use as-is. |
| `my-app/src/components/FloatingAiToolbar.tsx` | DS-3/DS-4 already aligned its visuals. Reuse. If you find an inconsistency with the skeleton's ai-toolbar contract, fix it in a separate scoped commit, not as part of PR2. |
| `my-app/src/components/ai/AiSuggestionCard.tsx`, `AiStageList.tsx`, `DiffBlock.tsx` | Already implemented per `CODEX-HANDOFF.md` §0. Mount them; do not edit. |
| Parser, export, autosave, version-history APIs | Out of scope. |

### Delete only after consolidation

| File | When |
|---|---|
| `my-app/src/pages/ProposalForgeNext.tsx` (~69.5K) | Only after every behavior surviving on it is folded into the new modules. The route `/proposal-next` already redirects to `/proposal`. |

---

## 3. Visible behavior — line-by-line against APP-SKELETON.html

### 3.1 Layout shell — lines 1604–1756

```
<section class="app-page" data-page-id="proposal">
  <div class="forge">
    <div class="forge__stage"> … </div>
    <aside class="forge__rail"> … </aside>
  </div>
</section>
```

**Required:** CSS grid `grid-template-columns: 1fr 360px; gap: var(--s4)` (or whatever `--s4` evaluates to in `foundation.css`). Stage column centers a `max-width: 760px` paper. Rail is sticky, scrolls independently.

### 3.2 Stage bar — lines 1607–1631

Order, left to right, with `var(--s2)` gap:

1. `<span class="ds-status ds-status--accent">` with internal `<span class="ds-status__dot"></span>` + text `Drafting` / `Saved` / `Sent` / `Error`.
2. `<span class="ds-tone ds-tone--{warm|formal|natural}">{Warm|Formal|Natural} tone</span>`.
3. `<span class="spacer"></span>` (CSS `flex: 1`).
4. **Segmented Edit / Page preview** — `<div class="style-segmented">` with two `<button>`s. `data-selected="true"` on active.
5. `<button class="ds-btn ds-btn--sm ds-btn--ghost">Undo</button>` (disabled when no undo).
6. `<button class="ds-btn ds-btn--sm ds-btn--ghost">Redo</button>`.
7. **Anchored Share menu** — `<button class="ds-btn ds-btn--sm ds-btn--secondary">Share ▾</button>` wrapped in `<span style="position:relative;">`. The `<div class="ds-menu" hidden>` is its sibling and uses the `<Menu>` primitive (DS-10).

The Share menu items, in order (lines 1620–1628):

```
☑ Safe-send checklist…           → opens SafeSendSheet, closes menu
─ separator ─
[label] Send
✉ Send by email
⎘ Copy link
↗ Public preview link
─ separator ─
↗ Export PDF
¶ Copy as text
```

The menu must close on outside click and on Escape. Trap focus on the trigger when reopening.

### 3.3 Paper — lines 1633–1651

```
<article class="ds-paper" id="proposalPaper">
  <div class="ds-paper__meta">Cover letter — {role} · {company} · {date}</div>
  <h1 contenteditable>Hello {company} team,</h1>
  …contenteditable paragraphs…
  <p>— {signature}</p>
</article>
```

Live render: the rail's variable inputs (Company, Signature) bind to the paper through the existing draft hook. Do not re-implement variable replacement.

The active selection mock from line 1640–1648 (highlighted `<p>` with anchored ai-toolbar) is **only a static demo in the skeleton**. The real toolbar is rendered by `<FloatingAiToolbar>`, anchored above the user's actual selection rect. Do not copy the inline `style="position:absolute;left:50%;…"` — that is mock-only.

### 3.4 Live-render footer — lines 1652–1655

```
<div class="ds-status__dot" style="background: var(--ac); animation: tw-breathe…"></div>
Live render — type in the paper or change inputs in the rail. Toolbar above is contextual: appears on text selection, hides otherwise.
```

This is the **only** decorative animation on the surface besides the brand period. Reduced-motion must replace `animation: tw-breathe` with `none`.

### 3.5 Rail order — lines 1658–1754

Render in this exact order. Each is a `<div class="forge__rail-section">` separated by a 1px `var(--border-soft)` line.

1. **Job context** (1659–1668) — label, role title, `{company} · {location} · Posted {n} days ago`, then a row of `ds-pill ds-pill--accent` skill chips with a `+N` overflow `ds-pill ds-pill--neutral`.
2. **Source CV** (1670–1701) — secondary button containing a tiny paper-thumb + name/sub. Opens an anchored `<Menu>` with: pick CV rows (each row has thumb, name, sub-meta, optional `✓`), separator, `+ Create new CV` (`onClick → goto('cv')`), `↗ Import from file`.
3. **Collapsed AI stream** (1703–1716) — `<div class="ai-stream-collapsed">` with dot + label + count + caret. Toggling expands an `ai-stage-list` of stages with `data-state="done|active|pending"`.
4. **Tone** (1718–1725) — three `<span class="ds-tone ds-tone--{warm|formal|natural}">` chips, click to select.
5. **Variables** (1727–1738) — `ds-field-group`s for Company and Signature. Helper text below: `Edits sync to the document on the left.` Bind to existing draft state.
6. **Ask AI** (1740–1745) — label, `<textarea class="ds-field ds-field--textarea">`, `<button class="ds-btn ds-btn--md ds-btn--primary">Send<span class="ds-btn__period">.</span></button>`, helper text. **Whole-letter scope.** No scope picker. No "section / selection" radio.
7. **Settings** (1747–1753) — Length select with options `Short`, `Medium` (default), `Long`.

### 3.6 FloatingAiToolbar contract

Exists already. PR2's job is to mount it correctly and verify:

- Renders only when `window.getSelection()` is non-empty inside the `<article class="ds-paper">`.
- Hides on selection clear, scroll, or paper blur.
- Anchors above the selection's top-rect with a 12px gap. Falls back to bottom-sticky on viewports < 720px.
- Exactly four actions: Rewrite (primary), Shorten, Fix, Ask. No icons. No fifth button.
- All four go through `interactionRulebook.ts`. Rewrite/Ask preview before apply through `<AiSuggestionCard>`. Shorten/Fix may apply directly per the rulebook — verify in `interactionRulebook.test.ts`.
- Reduced-motion: opacity-only enter/exit.

If active rules disagree with anything above, the rulebook is authority — not this brief.

---

## 4. State extraction strategy

The current `ProposalForge.tsx` is ~7.2k LOC because it inlines:

- draft state + autosave,
- export and print flows,
- tone/length/variable wiring,
- AI generation + stage telemetry,
- saved-view hydration,
- selection toolbar bridge,
- version history sheet.

**Target shape:**

```
ProposalForge.tsx (orchestrator, ≤ 500 LOC)
├── useProposalDraft()         (hook — already exists or extract)
├── useProposalExport()        (hook — already exists or extract)
├── useProposalAiGeneration()  (extract if inlined; AI lib stays untouched)
├── <ProposalDocumentStage>
│   ├── <ProposalStageBar>
│   ├── <ds-paper> (contenteditable)  — bind to draft
│   └── live-render footer
├── <ProposalRail>
│   ├── JobContextSection
│   ├── SourceCvPickerSection
│   ├── ProposalAIStream
│   ├── ToneSection
│   ├── VariablesSection
│   ├── AskAiSection
│   └── LengthSection
├── <FloatingAiToolbar>        (mount, do not edit)
├── <SafeSendSheet>             (portaled, controlled by orchestrator)
└── <ShareMenu>                 (anchored)
```

Hooks return primitives + setters. Components are presentational. The orchestrator wires them.

---

## 5. Keep / Restore / Remove (from `FEATURES-KEEP-VS-REMOVE.md`)

### Keep (must survive)

- Live document render bound to rail inputs
- WYSIWYG paper as the rendered document
- Edit / Page preview toggle (Page preview is pagination-faithful)
- FloatingAiToolbar with Rewrite, Shorten, Fix, Ask
- Mobile fallback: bottom-sticky toolbar when selection rects are unreliable
- `AiSuggestionCard` preview-before-apply for Rewrite/Strengthen/Ask
- Rail Ask AI free-form prompt, scoped to whole proposal
- Tone selector: Warm, Formal, Natural
- Length selector: Short, Medium, Long
- Job context panel (role/company/location/posted/skills)
- Source CV picker + attached-CV sync
- Export PDF, Print, Copy as text
- Undo/Redo with keyboard shortcuts
- Autosave/draft persistence
- Version history (stage-bar menu or sheet)
- Save to library, saved proposal hydration

### Restore (this PR)

- Anchored Share menu in stage bar (DS `Menu`)
- Safe-send checklist sheet (DS `Sheet`, opened from Share + cmdk)
- Proposal version history accessible from stage bar

### Remove (this PR)

- `ProposalForgeNext.tsx` after consolidation
- Symmetric 50/50 form-vs-preview layout
- Per-stage AI spinners / progress bars (replace with `<AiStageList>` / collapsed stream)
- Proposal rail scope picker (whole-letter is the only scope)

---

## 6. Safe-send Sheet — lines 2603–2678

A DS `Sheet` portaled to `document.body`. Right drawer on desktop (≥ 720px), bottom sheet on mobile.

### 6.1 Structure

```
<aside class="ds-sheet" id="safeSendSheet" role="dialog" aria-modal="true" aria-labelledby="safeSendTitle">
  <div class="ds-sheet__head">
    <div>
      <div class="ds-sheet__title" id="safeSendTitle">Safe-send checklist</div>
      <div class="ds-sheet__copy">Trust gate for export, share, and send. Each row must be cleared before the package can leave your hands.</div>
    </div>
    <button class="ds-icon-btn" aria-label="Close safe-send checklist">×</button>
  </div>
  <div class="ds-sheet__body">
    <div class="safe-status">…blocked banner…</div>
    <div class="checklist">…rows…</div>
  </div>
  <div class="ds-sheet__actions">…cancel + review match + continue…</div>
</aside>
```

A `<div class="ds-scrim" id="dsScrim" data-open="false">` sits behind it. Clicking the scrim closes the sheet.

### 6.2 Checklist rows (HTML lines 2620–2669)

Each row is `<div class="check-row {clear|warn|danger}">` containing:

- `<span class="check-mark">✓ | ! | ×</span>` — derived from row state.
- `<div>` with `<span class="check-title">` and `<span class="check-meta">`.
- A trailing `<span class="ds-pill ds-pill--{success|warning|danger|accent}">` **or** `<button class="ds-btn ds-btn--sm ds-btn--secondary">Resolve</button>` for actionable rows.

**Initial row set (10 rows). If active detection logic does not yet support a row, render it disabled with a `Detection pending` pill rather than dropping it:**

| # | Title | State source |
|---|---|---|
| 1 | Source job linked | Proposal has a non-null linked job ID |
| 2 | Match review not accepted | Job verdict reviewed flag |
| 3 | CV variant selected | Source CV picked |
| 4 | Proposal linked | Always clear when in this view |
| 5 | Unresolved import issues | CV import review queue empty? Action button: `Resolve` → opens import-review sheet |
| 6 | Unresolved AI suggestion | Rulebook telemetry: any pending `<AiSuggestionCard>` |
| 7 | Unsupported claim | Detection pending if no detector yet — show as warn with `Detection pending` |
| 8 | No placeholder text | Heuristic: no `[company]`, `lorem`, empty variables |
| 9 | Recipient or export target | A send-target was picked |
| 10 | Final export reviewed | Page preview was opened at least once for the current draft |

### 6.3 Footer actions (lines 2672–2677)

- `Cancel` (ghost) — closes the sheet.
- `Review match` (secondary) — closes sheet, navigates to Jobs detail of the linked job.
- `Continue to send` (primary) — **disabled while any row is `warn` or `danger`**. Enabled only when every row is `clear`.

### 6.4 Open paths

- Stage-bar Share menu → `Safe-send checklist…` row.
- Command palette: `Open safe-send checklist` (`⌘⇧S`).
- Import-review sheet's Safe-send row (cross-link).

### 6.5 Accessibility

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby="safeSendTitle"`.
- Focus trapped within sheet on open. Restored to trigger on close.
- Escape closes.
- Toast region (single root) announces blocker count on open: `aria-live="polite"`.

---

## 7. CSS classes used by this PR

If any of these classes are not yet defined in `my-app/src/styles/`, add them to `product-proposal.css` (or `product.css` if they're generic). Keep stylelint clean — tokens only.

### Already expected to exist (from PR1 / DS-v2 work)

- `.ds-btn`, `.ds-btn--sm`, `.ds-btn--md`, `.ds-btn--primary`, `.ds-btn--secondary`, `.ds-btn--ghost`, `.ds-btn--accent`, `.ds-btn__period`
- `.ds-icon-btn`
- `.ds-field`, `.ds-field--textarea`, `.ds-field-group`, `.ds-field-label`
- `.ds-pill`, `.ds-pill--accent`, `.ds-pill--neutral`, `.ds-pill--success`, `.ds-pill--warning`, `.ds-pill--danger`
- `.ds-status`, `.ds-status--accent`, `.ds-status--success`, `.ds-status--neutral`, `.ds-status__dot`
- `.ds-tone`, `.ds-tone--warm`, `.ds-tone--formal`, `.ds-tone--natural`
- `.ds-card`, `.ds-card__title`, `.ds-card__eyebrow`, `.ds-card__body`, `.ds-card__footer`
- `.ds-scrim`
- `.ds-sheet`, `.ds-sheet__head`, `.ds-sheet__title`, `.ds-sheet__copy`, `.ds-sheet__body`, `.ds-sheet__actions`
- `.ds-menu`, `.ds-menu__item`, `.ds-menu__label`, `.ds-menu__separator`

If any are missing in active code, **add them in a token-only style block at the top of `product-proposal.css`**, ported verbatim from `APP-SKELETON.html` (`<style>` blocks at top of file). Do **not** introduce new tokens.

### Proposal-scoped (this PR adds them)

- `.forge` — `display: grid; grid-template-columns: 1fr 360px; gap: var(--s4); height: calc(100vh - var(--topbar-h));`
- `.forge__stage` — column flex, centers paper.
- `.forge__rail` — sticky, scrolls; vertical padding `var(--s4)`; sections separated by `1px solid var(--border-soft)`.
- `.forge__rail-section`, `.forge__rail-label`, `.forge__rail-title`
- `.forge__stage-bar`
- `.ds-paper`, `.ds-paper__meta`
- `.style-segmented` (Edit / Page preview)
- `.ai-stream-collapsed`, `.ai-stream-collapsed__dot`, `.ai-stream-collapsed__label`, `.ai-stream-collapsed__count`, `.ai-stream-collapsed__caret`
- `.ai-stream-expanded`, `.ai-stage-list`, `.ai-stage`, `.ai-stage__dot`
- `.ai-toolbar` (only if FloatingAiToolbar's existing styles do not cover this; otherwise leave the toolbar alone)
- `.spacer { flex: 1; }`
- `.row { display: flex; gap: var(--s2); align-items: center; }`
- `.col { display: flex; flex-direction: column; gap: var(--s3); }`
- `.check-row`, `.check-row.clear`, `.check-row.warn`, `.check-row.danger`, `.check-mark`, `.check-title`, `.check-meta`
- `.safe-status`
- `.review-block`, `.review-block__head`, `.compare-grid`, `.fragment`, `.ba-label` (**these are also used by PR4** — port to a shared file or duplicate; prefer a shared file like `product-document.css`)

---

## 8. Behavior contracts (testable)

1. Mounting `/proposal` renders the stage + rail layout. No 50/50 form layout.
2. Typing in the paper updates draft state within 100ms (existing autosave debounces it further).
3. Changing the Company variable updates `<span id="paperCompany">` in the paper synchronously.
4. Pressing `⌘Z` on the paper invokes the existing undo stack.
5. Clicking Share opens the menu anchored under the trigger. Outside-click closes it.
6. Selecting `Safe-send checklist…` from the menu opens the Sheet and closes the menu in the same tick.
7. The Safe-send `Continue to send` button is disabled until every row is `clear`.
8. Selecting text in the paper renders FloatingAiToolbar within 50ms; clearing the selection hides it.
9. The collapsed AI stream renders even when `data-state="pending"` for all stages — never an empty rail block while AI is running.
10. Reduced-motion media query disables the live-render dot animation, the brand period pulse, and any sheet/menu transitions.

---

## 9. Verification

```bash
rtk pnpm tsc --noEmit
rtk pnpm lint:css
rtk pnpm test --run my-app/src/pages/__tests__/ProposalForge*           # narrow
rtk pnpm test --run my-app/src/components/proposal/__tests__/*           # if added
rtk pnpm test --run my-app/src/components/ai/__tests__/                  # frozen, must still pass
rtk pnpm exec vite build
```

Browser checks (rendered):

- `/proposal` renders the new layout in Light + Dark.
- Share menu anchors correctly on a 1280-wide viewport (does not overflow right edge).
- Safe-send opens, scrim shows, Escape closes, focus returns to Share trigger.
- FloatingAiToolbar appears on selection, four buttons only, anchored above selection, hides on click-outside.
- Page preview toggle paginates the paper (visible page break) and switches back to flow view.
- `ProposalForgeNext` route still resolves (redirect intact).

Do not delete `ProposalForgeNext.tsx` until a separate consolidation pass confirms no surviving behavior is on it.

---

## 10. Out of scope for PR2

- PR4's CV forge (handled separately).
- New AI capabilities or rulebook changes.
- Backend parser changes.
- Any modification to `AiSuggestionCard.tsx`, `AiStageList.tsx`, `DiffBlock.tsx`, `FloatingAiToolbar.tsx`, `interactionRulebook.ts`, `applyAiSuggestion.ts`, `aiInteractionTelemetry.ts`, `editorAiJobContext.ts`.

If any of those files genuinely block PR2, surface the conflict in the PR description and stop — do not edit them.
