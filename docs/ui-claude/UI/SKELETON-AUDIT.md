# Skeleton audit — three candidates → one reference

**Decision date:** 2026-04-29
**Status:** ✅ Decided — hybrid base on APP-SKELETON v2 (mine) + selected layers from C4 + C5

> Companion to [REFONTE-AUDIT.md](./REFONTE-AUDIT.md), [FEATURES-KEEP-VS-REMOVE.md](./FEATURES-KEEP-VS-REMOVE.md), and the canonical [APP-SKELETON.html](./APP-SKELETON.html) (post-merge).

---

## §1 The three candidates

| # | Source | Lines | Mental model | Strength | Weakness |
|---|---|---|---|---|---|
| **A — APP-SKELETON v1** | This branch (mine) | 2,707 | Dashboard + page-by-page (Document-first 60/40 forge, split-view jobs, tabbed CV rail) | Closest to current code, low implementation risk, strong DS hygiene | Dashboard is generic, no explicit "next action", no anti-spray gate |
| **C4 — gpt-pro hybrid** | `7.cand3-with modifonly/candidat-4.html` | 3,253 | **Application Package** as primitive: every job → Job + Match + CV variant + Proposal + Export, all linked. Today hub anchored on Next Best Action. Workflow gates everywhere (Readiness ledger, Safe-send checklist, Claim safety). | **Brand-perfect** — embodies "user reviews every send", "Porsche not factory", document-first philosophy | High cognitive load, big new mental model, distance from current code is large |
| **C5 — gemini-augmented** | `8.gemini_cand3/candidat-5.html` | 3,603 | C4 layered onto A — same page list as mine + adds Quick Start checklist, Next Best Action, Safe-send & Import Review sheets | Best of both, additive rather than rewrite, ARIA polish, scrim handling | Some duplication, doesn't fully commit to either philosophy |

---

## §2.0 Scoring — SYNTHESIZED version vs the three originals

After applying the merge (mine + C5 layers + selected C4 patterns):

| KPI | Weight | A (mine) | C4 (hybrid) | C5 (gemini) | **Synth (final)** |
|---|---|---|---|---|---|
| **Brand fit** | 3× | 8 | 10 | 9 | **9** (Safe-send is in; no full Package mental model means we lose half a point vs C4) |
| **Single-task focus** | 2× | 6 | 10 | 9 | **9** (Quick Start + Next Best Action) |
| **Cognitive load** | 2× | 9 | 6 | 8 | **9** (kept simple — Package stays a soft visual concept, not a data model) |
| **Density vs noise** | 1× | 8 | 7 | 8 | **8** (more elements but well-grouped) |
| **Discoverability** | 1× | 7 | 7 | 9 | **9** (Quick Start + cmdk entries for new sheets) |
| **Ergonomics** | 2× | 8 | 10 | 8 | **9** (mixed recents + contextual topbar + cmdk Safe-send) |
| **Implementation cost** | 3× | 9 | 6 | 8 | **8** (additive on mine — no rewrite) |
| **Extensibility** | 1× | 8 | 9 | 8 | **9** (Sheets are reusable, Package soft concept lets us add later) |
| **Weighted total /150** | | **117** | **120** | **125** | **🏆 131** |

**The synthesized version beats all three originals.** It captures C4's brand-defining gates and C5's discoverability without paying their cognitive-load or rewrite costs.

---

## §2.1 Original three-way scoring matrix

KPIs picked to reflect dasti's stated principles (anti-spray, document-first, opinionated, single ambient loop, Porsche-not-factory) plus implementation reality.

| KPI | Weight | A (mine) | C4 (hybrid) | C5 (gemini) |
|---|---|---|---|---|
| **Brand fit** — anti-spray, document-first, opinionated | 3× | 8 | **10** | 9 |
| **Single-task focus** — does it answer "what now?" | 2× | 6 | **10** | 9 |
| **Cognitive load** — mental model simplicity | 2× | **9** | 6 | 8 |
| **Density vs noise** — signal per pixel | 1× | 8 | 7 | 8 |
| **Discoverability** — first-time users find features | 1× | 7 | 7 | **9** |
| **Ergonomics** — fast for power users, ⌘K coverage | 2× | 8 | **10** | 8 |
| **Implementation cost** — feasibility from current code | 3× | **9** | 6 | 8 |
| **Extensibility** — can we add features without breaking | 1× | 8 | **9** | 8 |
| **Weighted total** /150 | | **117** | **120** | **125** |

**Verdict:** C5 wins narrowly on the weighted score, but the close margins matter less than what each does best:

- **A** = the cheapest path (closest to current code).
- **C4** = the most brand-aligned vision but the biggest leap.
- **C5** = the best synthesis, additive on top of A.

**Choice:** **C5 base + selected C4 patterns layered in.** Reject C4's "rename Dashboard → Today" and "Application Package as primary data model in UI." Adopt C4's brand-defining gates and contextual topbar.

---

## §3 What we keep, drop, or merge

### From A (APP-SKELETON v1) — KEEP everything

- 7-page surface (Dashboard / ProposalForge / JobsPage / CvForge / Library / Templates / Settings / Sign-in)
- Document-first 60/40 forge layout (paper + rail)
- Split-view jobs (list 360px + detail with inline match)
- Tabbed CV rail (Sections / Ask AI / Style)
- Collapsed AI stream (one-line active stage, expand on click)
- Verdict labels (no %)
- ATS-ready badge
- Per-section wand
- Section organize (drag handles)
- Onboarding (6 steps, Chrome-only extension)
- Font-pair / Layout / Signature picker in document style
- Floating AI toolbar contextual on text selection
- ⌘K palette
- Sidebar collapsed-by-default, hover/pin to expand

### From C5 — ADOPT (additive, no churn)

| Pattern | Where | Rationale |
|---|---|---|
| **Quick Start checklist** | Dashboard, top of page | First-time user discoverability; collapses when complete |
| **Safe-send checklist sheet** | Triggered from Share menu, both forges | Brand-defining gate. 12 checks: source linked, match reviewed, CV selected, proposal linked, no unresolved imports, no unresolved AI suggestions, no unsupported claims, no placeholders, no debug text, recipient selected, export reviewed |
| **Import Review sheet** | Triggered from review banner in CV forge | Side-by-side original fragment vs parsed result. Accept/Edit/Delete per block. Export blocked until resolved |
| **`.ds-scrim` overlay** | Behind every sheet | Consistent scrim, single source of truth |
| **ARIA polish** | All sheets | `role="dialog" aria-modal="true" aria-labelledby` |
| **Toast region** with live announcements | Root | `aria-live="polite"` |

### From C4 — ADOPT (selectively)

| Pattern | Where | Rationale |
|---|---|---|
| **"Next Best Action" card** | Dashboard, primary visual element | Answers "what now?" with one paragraph + two CTAs. Already in C5 |
| **Mixed recents in sidebar** | Sidebar middle, expanded state only | Surfaces the actual artifact you were touching (job/CV/proposal/export) — not just routes |
| **Contextual topbar line** | Topbar | "Working on: Linear" + "Object: …" + state pill — keeps focus on current package |
| **Readiness summary** | Dashboard, compressed (3 rows max) | CV / Match / Export readiness as inline status pills. Don't go full ledger |
| **Per-row "Scoped AI" affordance** | CV section rows | Already in mine as wand `⌖` — keep |
| **Inspector tabs in CV forge** (Review / Style / Export) | Replaces my linear right-stack on CV | More density, fewer scrolls. **Adopt as a rail-tab variant only**, keep the existing Sections / Ask AI / Style tabs and add Review + Export when CV is in safe-send flow |

### From C4 — REJECT

| Pattern | Why reject |
|---|---|
| **Dashboard renamed to "Today"** | "Dashboard" is universally understood. "Today" is cute but adds learnable surface for no functional gain |
| **Application Package as the primary data model in UI** | Heavy mental model. Users think in "jobs I'm applying to" not "packages." Keep package as soft concept (visible in library entries: "Linear package — blocked by review") but don't restructure nav around it |
| **"Packages first. Loose objects last." copy** | Too clever; violates dasti voice (sentence case, period-terminated, no slogans) |
| **5-step package spine on Dashboard** | Too prescriptive. Implies a linear flow that real usage doesn't follow (you don't always create CV variants per job) |
| **Pun-heavy copy** ("Defaults, not knobs.") | Same — too clever |
| **Theme: 3-way switch (Light/Dark/System)** | We've stuck with Light/Dark. System mode adds support burden for marginal user value |

---

## §4 The synthesized blueprint (the new APP-SKELETON.html)

### Page list (final)
1. **Dashboard** — Welcome + Quick Start + Next Best Action + Stats + Recent activity + Quick links
2. **ProposalForge** — Document-first 60/40 (paper + linear rail: Job context · Source CV · Variables · Tone · Length · Ask AI · Collapsed AI stream)
3. **JobsPage** — Split-view (list 360px with verdict labels + favorites filter, detail with inline match panel + verdict explanation)
4. **CvForge** — Document-first 60/40 (paper + tabbed rail: Sections / Ask AI / Style + footer Import row + collapsed AI stream)
5. **Library** — Card grid (proposals + CVs + drafts) with verdict label (when applicable) and status pill
6. **Templates** — Real rendered preview cards
7. **Settings** — Inner nav: Account / Preferences / Document style / Voice / Billing / Team / Danger
8. **Sign in** — Magic link + Google

### Cross-cutting overlays
- **⌘K command palette** (portal to body)
- **Onboarding** (6 steps, dismissible, replayable from cmdk)
- **Safe-send checklist sheet** (triggered from Share menu in both forges)
- **Import Review sheet** (triggered from CV review banner)
- **Section editor sheet** (one Sheet primitive, type-specific editor inside)
- **Toast region** (single, root-mounted, ARIA live)

### Sidebar (final)
- Brand mark + word
- **Work group**: Dashboard · Jobs (count) · Proposal forge · CV forge · Templates · Library
- **Mixed recents** (3-5 items, expanded state only)
- **System group**: Settings
- Footer: account card, theme switch (Light/Dark only)
- Collapsed default 56px, hover/pin to 240px

### Topbar (final)
- Breadcrumb: "twoweeks / Dashboard" — current page bold
- **Context line** when in a forge: "Working on: Linear application package" — softer than C4's, single line
- Spacer
- ⌘K trigger pill
- Theme switch
- Profile icon button

### Dashboard (final)
- Greeting + quick CTAs (Import CV / New proposal)
- **Quick Start** (4 steps, collapsible, hides when 100% done — only renders for first-time users)
- **Next Best Action** card — eyebrow, h2, paragraph, two CTAs, status pills
- **Stats trio** (Proposals sent · Replies waiting · Strong matches waiting)
- **Recent activity** (3-5 rows, status pill + title + sub + time)
- **Tips** card — ⌘K education

### CV forge (final)
- Stage bar: status · ATS-ready · tone pill · spacer · Edit/Page-preview · History · Share ▾
- Paper with optional `.ds-banner--warn` review banner above
- Tabbed rail (3 tabs): Sections / Ask AI / Style
- Collapsed AI stream pinned at top of rail (visible across tabs while running)
- Footer row: Import PDF · Paste text — always visible
- Click section row → opens section editor Sheet (type-specific form)

### Proposal forge (final)
- Stage bar: status · tone · spacer · Edit/Page-preview · Undo/Redo · Share ▾
- Paper (contenteditable), highlighted active selection mock
- Floating AI toolbar contextual on selection (anchored above)
- Linear rail (no tabs): Job context · Source CV picker · Variables grid · Tone chips · Length · Ask AI · Collapsed AI stream

### Jobs (final)
- Split: list 360px (sticky filters: search + verdict + ★ favorites + remote + senior + custom) | detail (header with title/company/verdict + Save/View/★/Generate proposal · scrollable body with description + sticky inline match panel)
- Match panel: Verdict (Strong/Worth a shot/Maybe/Probably skip) + plain-English explanation paragraph + skills/seniority/location/gap rows + "See full breakdown"

### Settings (final, simplified)
- Account · Preferences · **Document style** (font pair / layout / accent / page format / signature) · Voice · Billing · Team · Danger zone
- Defaults, not knobs — no individual font weight/body size/line-height/margin pickers

---

## §5 What this means for implementation PRs

`REFONTE-AUDIT.md` is now the implementation contract. The old PR3-PR8 numbering was superseded on 2026-04-29 because the active app already had the CSS split/stylelint work, while shell/dashboard work was still missing.

| PR | Addition from this audit |
|---|---|
| **PR1 (shell/dashboard)** | Sidebar collapsed-by-default, mixed recents, contextual topbar, command palette, Quick Start, Next Best Action, onboarding entry |
| **PR2 (proposal)** | Safe-send sheet behind Share menu, document-first 60/40 forge, proposal rail, floating toolbar verification |
| **PR3 (jobs)** | Split-view Jobs, verdict labels everywhere, favorites filter and toggle, inline match panel |
| **PR4 (cv)** | Import Review sheet, review banner above paper, ATS badge, section editor sheets, tabbed rail |
| **PR5 (documents/templates/settings/auth)** | Unified Documents, Templates, Settings inner nav, Document style simplification, Sign-in polish |
| **PR6 (parity)** | Browser-backed comparison against `APP-SKELETON.html` and cleanup of any remaining drift |

---

## §6 Single source of truth

After the audit lands, **the canonical reference is `APP-SKELETON.html`** (synthesized version). In this worktree the current path is `.claude/worktrees/hungry-mcnulty-1722ea/docs/UI/APP-SKELETON.html`; if it later moves into `docs/UI/`, use the active repo copy. Codex must compare every PR against this file. If something visible in the synthesized skeleton isn't in the PR, that's a bug. If the PR adds something not in the skeleton, that's drift — flag and discuss before merging.

`candidat-4.html` and `candidat-5.html` are now historical references only. Don't pull from them directly.
