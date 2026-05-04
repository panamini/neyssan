# PR5 — `feat(documents-templates-settings-auth): remaining skeleton pages`

**Risk:** medium
**Order:** after PR1, can run in parallel with PR2–PR4 if route names are coordinated
**Estimate:** 2 sessions
**Skeleton authority:** [`APP-SKELETON.html` lines 2084–2596](../APP-SKELETON.html)

> **Defensive note for the implementer:** every selector, line range, file path, import, and token quoted here was best-effort against the spec. If active code disagrees, **trust the code, not this brief**. Fix it and call out the correction in the PR description. Auth especially — Clerk integration is real and must keep working; the skeleton's sign-in card is purely visual.

---

## 1. What this PR is

Stand up the four remaining skeleton pages so the app surface matches `APP-SKELETON.html` end-to-end:

- **Documents** — unified library (proposals + CVs + drafts) with tabs.
- **Templates** — rendered preview cards.
- **Settings** — inner-nav with 7 panes.
- **Sign in** — magic-link + Google card matching the skeleton, adapted to active Clerk capability.

What this PR is **not**: a Clerk migration, a billing-provider change, an export-pipeline refactor, or a parser change.

---

## 2. Files

### Touch

| File | Change |
|---|---|
| `my-app/src/pages/DocumentsPage.tsx` (new) | Unified library at `/documents`. |
| `my-app/src/pages/CvsLibrary.tsx` | Keep as adapter / filtered redirect for `/cvs`. Don't delete. |
| `my-app/src/pages/ProposalsLibrary.tsx` | Same as `CvsLibrary` — keep as adapter/redirect for `/proposals`. |
| `my-app/src/pages/TemplatesPage.tsx` (new or existing) | Rendered template preview cards. |
| `my-app/src/pages/SettingsPage.tsx` | Reduce to a router that loads the active inner-nav pane. ≤ 200 LOC. |
| `my-app/src/pages/settings/AccountPane.tsx` (new) | Profile + connected accounts. |
| `my-app/src/pages/settings/PreferencesPane.tsx` (new) | Theme (Light/Dark only) + Reduce motion. |
| `my-app/src/pages/settings/DocumentStylePane.tsx` (new) | Font pair / Layout / Accent / Page format / Signature. |
| `my-app/src/pages/settings/VoicePane.tsx` (new) | Default tone selection. |
| `my-app/src/pages/settings/BillingPane.tsx` (new) | Plan + manage. |
| `my-app/src/pages/settings/TeamPane.tsx` (new) | Members. |
| `my-app/src/pages/settings/DangerPane.tsx` (new) | Delete account. |
| `my-app/src/pages/SignInPage.tsx` | Reskin to match the skeleton card. Keep Clerk hooks. |
| `my-app/src/styles/product-libraries.css` | Documents + Templates styling. |
| `my-app/src/styles/product-settings.css` | Settings inner-nav + per-pane controls. |
| `my-app/src/App.tsx` | Add routes: `/documents`, `/templates`, redirects from `/cvs`, `/proposals`. Settings route accepts pane param: `/settings/:pane?`. |

### Leave alone

| File | Reason |
|---|---|
| Clerk auth setup, providers | Frozen. The Sign-in page consumes existing hooks. |
| Convex queries for libraries | Adapter — keep current signatures. |
| Billing provider integration (Stripe / wherever) | Frozen. The Billing pane shows status; `Manage` opens the provider portal as the active code already does. |
| `ProposalPrintPage.tsx`, `PdfRasterHarnessPage.tsx` | Out of scope. |

---

## 3. Documents page — lines 2084–2152

### 3.1 Layout

```
<section class="app-page" data-page-id="library">
  <div class="page-wrap">
    <div class="page-head">…title + Import + New…</div>
    <div class="row">…tabs + search…</div>
    <div class="library">…cards grid…</div>
  </div>
</section>
```

`.library` is a `display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--s4);`.

### 3.2 Page head — lines 2086–2095

```
<h1 class="page-head__title">Documents</h1>
<div class="page-head__sub">Proposals and CVs you've created.</div>
…
<button class="ds-btn ds-btn--md ds-btn--secondary">Import</button>
<button class="ds-btn ds-btn--md ds-btn--primary">New</button>
```

`Import` opens an anchored DS `Menu` with `Import CV (PDF)`, `Import CV (paste)`, `Capture job (URL)`. `New` opens a menu with `New proposal`, `New CV`.

### 3.3 Tabs + search — lines 2097–2107

```
<div class="library-tabs" role="tablist">
  <button data-active="true">All</button>
  <button>Proposals</button>
  <button>CVs</button>
  <button>Drafts</button>
</div>
…
<input class="ds-field" placeholder="Search..." style="width: 240px;" />
```

Tabs filter the cards. Search filters by title and meta. Combine — search applies within the active tab.

### 3.4 Cards — lines 2109–2143

Each card uses DS `Card`:

```
<div class="ds-card" data-interactive="true">
  <span class="ds-card__eyebrow">{Proposal | CV}</span>
  <div class="ds-card__title">{title}</div>
  <div class="ds-card__body">{one-line summary}</div>
  <div class="ds-card__footer">
    <span>{Updated relative time}</span>
    <span class="ds-verdict ds-verdict--{tier}">…</span>      <!-- proposals -->
    <span class="ds-pill ds-pill--{accent|neutral}">…</span>  <!-- status -->
  </div>
</div>
```

**No `match score 76%` text.** Replace with verdict label or a concise status string.

A trailing card is the empty-add affordance:

```
<div class="ds-card ds-card--muted" data-interactive="true">
  <span>+ New document</span>
</div>
```

Per-card actions: right-click or `…` menu (DS `Menu`) — Open, Duplicate, Archive, Export, Delete, where active APIs exist. Surface only the actions that are wired in active code; render the rest disabled with a `Soon` pill.

### 3.5 Empty state — lines 2145–2150

When the active tab+search returns zero items:

```
<div class="empty-state">
  <div class="empty-state__title">No proposals yet.</div>
  <div class="empty-state__desc">Pick a job from your library and twoweeks will draft a cover letter you can edit in the proposal forge.</div>
  <button class="ds-btn ds-btn--md ds-btn--primary">Browse jobs</button>
</div>
```

Tab-specific copy: `No CVs yet.` / `No drafts.` / `No documents yet.`. **No illustrations.**

### 3.6 Routes

- `/documents` — primary route.
- `/cvs` — redirect or filtered view (`?tab=cvs`).
- `/proposals` — redirect or filtered view (`?tab=proposals`).

Bookmarks must keep working. Existing tests against `/cvs` and `/proposals` should still pass.

---

## 4. Templates page — lines 2154–2272

### 4.1 Page head — lines 2156–2165

```
<h1 class="page-head__title">Templates</h1>
<div class="page-head__sub">Pick a starting point. Customize fonts and accent in document style.</div>
…
<button class="ds-btn ds-btn--md ds-btn--secondary">Customize style</button>   <!-- → /settings/docstyle -->
```

### 4.2 Filter row — lines 2167–2178

```
<div class="library-tabs" role="tablist">
  <button data-active="true">All</button>
  <button>Cover letters</button>
  <button>CVs</button>
</div>
<span class="spacer"></span>
<span class="ds-pill ds-pill--neutral">Editorial</span>
<span class="ds-pill ds-pill--neutral">Minimal</span>
<span class="ds-pill ds-pill--neutral">Classic</span>
<span class="ds-pill ds-pill--neutral">Bold</span>
```

Tabs filter by document type. Pills are read-only labels showing available templates.

### 4.3 Template cards — lines 2180–2270

Six cards: **Editorial**, **Minimal**, **Bold**, **Classic**, **Compact**, **Letterpress**.

```
<button class="tpl-card" [data-selected="true"]>
  <div class="tpl-card__preview {variant class}">
    …rendered mini preview using real fonts/styles…
  </div>
  <div class="tpl-card__meta">
    <span class="tpl-card__name">{name}</span>
    <span class="tpl-card__kind">{Cover letter | CV | Cover letter · CV}</span>
  </div>
</button>
```

The preview is **rendered**, not abstract — uses the actual font + accent + layout for that template at thumbnail scale. Skeleton lines 2181–2270 show the exact mini-layouts.

Selecting a card sets the user's default template for the relevant document kind. The selected card uses the `data-selected="true"` accent border per existing primitives.

---

## 5. Settings — lines 2275–2569

### 5.1 Layout

```
<section class="app-page" data-page-id="settings">
  <div class="settings">
    <nav class="settings__nav">…7 buttons…</nav>
    <div class="settings__content">…7 panes, only one visible…</div>
  </div>
</section>
```

`.settings { display: grid; grid-template-columns: 220px 1fr; gap: var(--s4); }`.

### 5.2 Inner nav — lines 2277–2285

Order matters:

1. Account
2. Preferences
3. Document style
4. Voice & tone
5. Billing
6. Team
7. Danger zone

Each is `<button class="settings__nav-item" data-active="…" onclick="setSettingsTab('{key}', this)">{label}</button>`.

Route mapping: `/settings/:pane?`. Default pane is `account`. `setSettingsTab` updates the URL so deep links work (`/settings/docstyle`).

### 5.3 Account pane — lines 2289–2327

- **Profile** group: Full name, Email, Headline (each `ds-field-group`).
- **Connected accounts** group: Google (Disconnect), LinkedIn (Connect). Show only providers that the active Clerk integration supports; render others disabled.

### 5.4 Preferences pane — lines 2330–2353

- **Appearance** group:
  - Theme — `<div class="theme-switch">` with two buttons: `Light`, `Dark`. **No `System`.** (The skeleton shows three; this is a known cleanup decision in `REFONTE-AUDIT.md` §2.)
  - Reduce motion — `<input type="checkbox">`. Persists to user preferences and is consumed by the `prefers-reduced-motion` fallback in CSS-in-JS / class toggles.

### 5.5 Document style pane — lines 2356–2511

The longest pane. Five groups:

#### 5.5.1 Font pair — lines 2358–2387

`fontpair-grid` of four `<button class="fontpair">`s, each rendering a heading + body sample in the actual font:

- Baskervville × Geist (default selected)
- Geist × Geist (mono-font)
- Iowan × Geist
- Georgia × SF Mono

Helper: `Need finer control? Line height auto-adjusts only if a paragraph overflows a page during pagination.`

#### 5.5.2 Layout — lines 2389–2449

`layout-grid` of four `<button class="layout-card">`s with mini-previews drawn in CSS:

- Editorial (default selected)
- Two-column
- Centered
- Bold header

#### 5.5.3 Accent color — lines 2451–2465

Six `<button class="style-swatch">`s — Terre, Ink, Cobalt, Sauge, Plum, Ochre. Same token note as PR4 §3.5.4 — use foundation tokens, not hex literals.

#### 5.5.4 Page format — lines 2467–2476

`<div class="style-segmented">` with `A4` (selected) and `US Letter`.

#### 5.5.5 Signature — lines 2478–2510

`sig-grid` of five `<button class="sig-card">`s:

| Variant | Preview | Source |
|---|---|---|
| Brush — Snell Roundhand | rendered name in Snell Roundhand | font |
| Script — Pinyon | rendered in Pinyon Script | font |
| Mono — SF Mono | `— Aurélien` in mono | font |
| Auto — generated from your name | small SVG path generated server-side or client-side | algorithm |
| Draw — saved to your account | tap-to-draw canvas | user input |

**No "Heading weight / body size / line-height / margin" pickers.** These were explicitly removed per `FEATURES-KEEP-VS-REMOVE.md` §4.

### 5.6 Voice & tone pane — lines 2513–2526

Single group: Default tone — three `<span class="ds-tone ds-tone--…">` chips: Warm, Formal, Natural. Selecting one sets the default for new proposals.

### 5.7 Billing pane — lines 2528–2542

- **Plan** group: row showing current plan + price + renewal date, with a `Manage` button that opens the active billing portal (Stripe or whatever).

### 5.8 Team pane — lines 2544–2552

If the active product supports team workspaces, show the member list and invite controls. If not (current state per skeleton), show a static message:

```
<div style="font-size: var(--ts); color: var(--tm2);">Solo workspace. Invite teammates from the dashboard.</div>
```

### 5.9 Danger zone pane — lines 2554–2565

```
<h3>Delete account</h3>
<p>Removes all proposals, CVs, and account data. Cannot be undone.</p>
<button class="ds-btn ds-btn--md ds-btn--danger">Delete account</button>
```

`Delete account` opens a confirmation Dialog (DS `Dialog`, not `Sheet`). Confirms via typed-account-name match before invoking the existing delete flow.

---

## 6. Sign in — lines 2572–2596

```
<section class="app-page" data-page-id="signin">
  <div class="signin">
    <div class="signin__card">
      <div class="signin__brand">tw + twoweeks. + tagline</div>
      <div>
        <div class="signin__title">Sign in</div>
        <div class="signin__sub">Pick up where you left off.</div>
      </div>
      <button class="ds-btn ds-btn--lg ds-btn--secondary" style="width: 100%">Continue with Google</button>
      <div class="signin__divider">or</div>
      <div class="ds-field-group">
        <label class="ds-field-label">Email</label>
        <input class="ds-field" type="email" placeholder="you@work.com" />
      </div>
      <button class="ds-btn ds-btn--lg ds-btn--primary" style="width: 100%">Send magic link<span class="ds-btn__period">.</span></button>
      <div>No password. We'll email you a link.</div>
    </div>
  </div>
</section>
```

- **Adapt to Clerk capability:** if magic-link is not enabled in the active Clerk instance, replace the magic-link button with whatever Clerk supports (password, OAuth providers) while keeping the visual shape.
- Sign-out remains accessible from the command palette and from the Account pane (or wherever the active app already exposes it).

**Do not ship sidebar preview links** for `Sign in (preview)` or `Onboarding (preview)`. These were explicitly killed in `FEATURES-KEEP-VS-REMOVE.md` §4.

---

## 7. CSS classes used by this PR

### Already expected to exist (PR1 / PR2 / PR4)

- All `.ds-btn`, `.ds-field`, `.ds-pill`, `.ds-card`, `.ds-verdict`, `.ds-tone`, `.ds-status`, `.ds-menu`, `.ds-sheet`, `.theme-switch`, `.style-segmented`, `.spacer`, `.row`, `.col`.

### Added or extended in `product-libraries.css`

- `.page-wrap`, `.page-head`, `.page-head__title`, `.page-head__sub`, `.page-head__actions`
- `.library-tabs`
- `.library` (grid)
- `.empty-state`, `.empty-state__title`, `.empty-state__desc`
- `.tpl-filter`
- `.tpl-grid`
- `.tpl-card`, `.tpl-card[data-selected="true"]`, `.tpl-card__preview`, variants (`--minimal`, `--bold`, `--classic`, `--compact`, `--letterpress`), `.tpl-card__meta`, `.tpl-card__name`, `.tpl-card__kind`

### Added or extended in `product-settings.css`

- `.settings` (grid shell)
- `.settings__nav`, `.settings__nav-item`, `.settings__nav-item[data-active="true"]`
- `.settings__content`
- `.settings__pane`, `.settings__pane[data-active="true"]`
- `.settings__group`, `.settings__group-head`, `.settings__group-title`, `.settings__group-desc`, `.settings__row`, `.settings__row-label`, `.settings__row-desc`
- `.fontpair-grid`, `.fontpair`, `.fontpair[data-selected="true"]`, `.fontpair__heading`, `.fontpair__body`, `.fontpair__name`
- `.layout-grid`, `.layout-card`, `.layout-card[data-selected="true"]`, `.layout-card__preview`, `.layout-card__name`, `.layout-card__line`, `.layout-card__line--short`, `.layout-card__line--med`, `.layout-card__line--accent`
- `.style-swatches`, `.style-swatch`
- `.sig-grid`, `.sig-card`, `.sig-card[data-selected="true"]`, `.sig-card__sig`, variants (`--brush`, `--script`, `--mono`, `--auto`, `--draw`), `.sig-card__name`
- `.signin`, `.signin__card`, `.signin__brand`, `.signin__brand-mark`, `.signin__title`, `.signin__sub`, `.signin__divider`

---

## 8. Behavior contracts (testable)

1. `/documents` renders unified library; tabs filter by All / Proposals / CVs / Drafts.
2. Search input filters within the active tab.
3. Cards show DS verdict labels (proposals only) and status pills; never `%` numeric scores.
4. `/cvs` and `/proposals` URLs still resolve — either redirecting to `/documents?tab=…` or rendering a filtered view.
5. `/templates` shows six rendered preview cards; selecting one updates the user's default template.
6. `/settings` defaults to Account; `/settings/docstyle` deep-links to Document style.
7. Preferences theme switch shows two buttons (Light, Dark). No System.
8. Reduce motion checkbox round-trips to user preference.
9. Document style edits persist and round-trip across reloads.
10. Voice & tone selection sets the default for new proposals.
11. Billing pane's Manage button opens the active billing portal.
12. Danger zone's Delete account opens a Dialog with typed-confirmation gating.
13. `/sign-in` renders the skeleton card; Continue with Google triggers Clerk OAuth; magic-link button only renders if Clerk supports it.
14. No sidebar preview labels (`Sign in (preview)`, `Onboarding (preview)`) appear in production.
15. Light + Dark both clean across all four pages.

---

## 9. Verification

```bash
rtk pnpm tsc --noEmit
rtk pnpm lint:css
rtk pnpm test --run my-app/src/pages/__tests__/CvsLibrary*
rtk pnpm test --run my-app/src/pages/__tests__/ProposalsLibrary*
rtk pnpm test --run my-app/src/pages/__tests__/SettingsPage*
rtk pnpm test --run my-app/src/pages/__tests__/SignInPage*
rtk pnpm exec vite build
```

Browser checks (rendered):

- `/documents`, `/templates`, `/settings`, `/settings/docstyle`, `/sign-in` all render.
- Old `/cvs` and `/proposals` URLs still work.
- Documents tabs + search compose correctly.
- Templates cards render with real fonts/accents.
- Settings inner-nav deep-link works on direct visit.
- Document style — every picker (font pair, layout, accent, page format, signature) round-trips and updates a sample document.
- Sign-in matches the skeleton's visual proportions; Clerk flows still work.

---

## 10. Out of scope for PR5

- Clerk migration.
- Billing-provider migration.
- Adding new template designs.
- Custom signature drawing canvas backend.
- Mobile-only layout polish (acceptable target for PR6).
