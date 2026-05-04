# PR6 — `test(refonte): skeleton parity and drift cleanup`

**Risk:** medium
**Order:** last
**Estimate:** 1–2 sessions
**Skeleton authority:** all of [`APP-SKELETON.html`](../APP-SKELETON.html)

> **Defensive note for the implementer:** if any item below contradicts active code or shipped product behavior, **trust the code, not this brief**. Surface the conflict as a finding in the PR description rather than rewriting the surface. PR6 is about closing gaps, not redesigning anything.

---

## 1. What this PR is

A **parity sweep** comparing every implemented surface against `APP-SKELETON.html`. Captures any drift introduced across PR1–PR5, deletes the corpses that were marked for removal, and lands focused regression tests for the most fragile interactions.

This PR has three modes:

1. **Diff sweep** — for each skeleton section, render the active app at the same surface and identify deltas.
2. **Cleanup** — delete files that earlier PRs left in place for transitional reasons.
3. **Test hardening** — add Playwright/Vitest specs for the failure modes most likely to regress (Share menu anchoring, Safe-send gating, Import review, command palette, Light/Dark, percent-leak).

What this PR is **not**: a feature PR. No new UI surfaces. No new tokens. No new primitives.

---

## 2. Files

### Touch (cleanup deletions)

| File | When safe to delete |
|---|---|
| `my-app/src/pages/ProposalForgeNext.tsx` | If PR2 confirmed all surviving behavior is on `ProposalForge.tsx`. Verify no imports remain. |
| `my-app/src/components/ProfileForm.tsx.bak`, `ProfileEditorUnified.tsx.bak`, `ProfileReviewModal.tsx.bak`, `SuggestionBlock.tsx.bak` | All `*.bak` under `my-app/`. |
| `my-app/src/components/ProfileForm copy.md` | Stray markdown copy. |
| `my-app/src/components/COLORPALETTE*.HTML` (if present) | Design exploration files in source. |
| `my-app/src/components/AddSectionBottomSheet.tsx` | Only after PR4's `SectionEditorSheet` migration is verified. Run `grep -rn "AddSectionBottomSheet"` before deleting. |
| `my-app/src/components/structured-blocks/SkillsDrawer.tsx` | Only after PR4's `SectionEditorSheet` covers Skills. |
| `my-app/src/components/ProfileReviewModal.tsx`, `ProfileReviewCard.tsx`, `ImportRecoveryPanel.tsx`, `ImportCvPreviewModal.tsx`, `ImportWarningBanner.tsx` | Only after PR4's `ImportReviewSheet` + `CvReviewBanner` cover the same flows. **Run the full CV import test suite first.** |
| Sidebar `Sign in (preview)` and `Onboarding (preview)` items | Already removed in PR1 ideally; if they're still there, kill them now. |

Each deletion runs a grep-then-delete pattern:

```bash
git grep -n '<exact-symbol-name>' -- my-app/src
# zero hits → safe to delete
```

### Touch (parity fixes)

Whatever delta the diff sweep finds. Examples likely to surface:

- Share menu hover/anchor behavior off-by-a-pixel.
- Safe-send sheet's `Continue to send` enable logic missing one row.
- Light/Dark theme: a paper text rendering with `var(--ti)` instead of fixed dark inks.
- A `%` numeric appearing in some library card subtitle.
- Onboarding counter reading `Step 1 of 5` while six panes exist.
- A missing `aria-label` or focus-trap on a sheet/dialog.
- A `prefers-reduced-motion` neutralization missing on a new animation.

### Add (tests)

| File | Coverage |
|---|---|
| `my-app/src/pages/__tests__/skeletonParity.layout.test.ts` | Asserts existence and ordering of stage-bar items, rail tabs, sidebar groups, topbar items. |
| `my-app/src/components/__tests__/safeSendSheet.gating.test.tsx` | Asserts `Continue to send` is disabled while any row is `warn` or `danger`. |
| `my-app/src/components/__tests__/shareMenu.anchoring.test.tsx` | Asserts the menu anchors under its trigger and closes on outside click + Escape. |
| `my-app/src/components/__tests__/cmdk.routes.test.tsx` | Asserts every Go-to and Action command resolves to a real route or sheet. |
| `tests/e2e/skeleton.parity.spec.ts` (Playwright) | Renders each page in Light + Dark; asserts no element matches `/\d+\s*%/` in user-visible text. |
| `tests/e2e/onboarding.replay.spec.ts` (Playwright) | Replays onboarding from cmdk, confirms 6 steps and counter advances. |

### Leave alone

| File | Reason |
|---|---|
| Anything not touched by PR1–PR5. PR6 is not a refactor. |

---

## 3. Diff sweep checklist

Walk every page in the skeleton and compare. Mark each as ✅ pass / ⚠ delta / ❌ break.

### 3.1 Sidebar (skeleton lines 1289–1386)

- [ ] Brand mark + word + period. Period dot uses `var(--ac)`.
- [ ] Workspace group: Dashboard, Proposal forge, CV forge, Jobs (with count badge).
- [ ] Library group: Documents (with count badge), Templates.
- [ ] Mixed recents: 3–4 entries, each with type-prefix dot, title, sub-meta. Visible only in expanded state.
- [ ] System group footer: Settings, account/profile, theme switch (Light/Dark only — no System).
- [ ] Pin sidebar toggle works.
- [ ] **No `Sign in (preview)` or `Onboarding (preview)`** entries in production.
- [ ] Collapsed default (56px), hover/pin to 240px.

### 3.2 Topbar (lines 1392–1413)

- [ ] Breadcrumb: `twoweeks / {Current page}`.
- [ ] Context line on forges only: `Working on: {target}` + state pill.
- [ ] Spacer.
- [ ] `Search or run command` cmdk pill with `⌘K` kbd.
- [ ] Theme switch (two buttons).
- [ ] Profile icon button.

### 3.3 Dashboard (lines 1418–1601)

- [ ] Greeting with brand period.
- [ ] Quick CTAs: `Import CV`, `New proposal`.
- [ ] Quick Start — **single instance**, four steps, step 3 is `Capture jobs`. Dismiss persists.
- [ ] Next Best Action card — eyebrow / h2 / paragraph / two CTAs / status pills.
- [ ] Stats trio: `Proposals sent (30d)`, `Replies waiting`, `Strong matches waiting`.
- [ ] Recent activity list: status pill + title + sub + relative time.
- [ ] Quick actions card.
- [ ] Tips card (cmdk education).

### 3.4 Proposal forge (lines 1604–1756) — see PR2 brief

- [ ] Stage bar order matches.
- [ ] Paper renders contenteditable.
- [ ] FloatingAiToolbar shows on selection, four actions only.
- [ ] Rail order: Job context · Source CV · AI stream · Tone · Variables · Ask AI · Settings.
- [ ] Ask AI is whole-letter scope. No scope picker.
- [ ] Share menu opens Safe-send sheet.

### 3.5 Jobs (lines 1759–1858) — see PR3 brief

- [ ] Two-column split.
- [ ] Sticky filters with verdict tier, Favorites, Remote, Senior, custom.
- [ ] List rows show verdict labels.
- [ ] Detail header has Favorite, Save, View source, Generate proposal.
- [ ] Inline match panel sticks while scrolling.
- [ ] **No `%` text anywhere on `/jobs`.**

### 3.6 CV forge (lines 1861–2081) — see PR4 brief

- [ ] Stage bar with ATS badge.
- [ ] Review banner appears when import has uncertain blocks.
- [ ] Rail tabs: Sections / Ask AI / Style.
- [ ] Section rows show drag handle, title, count, wand, hide, delete.
- [ ] Add-section anchored menu with all six presets + Custom.
- [ ] Section editor sheet opens for each section type.
- [ ] Ask AI is section-scoped only. No whole-CV option.
- [ ] Style tab Per-document override links to Settings → Document style.
- [ ] Footer Import row always visible.

### 3.7 Library / Documents (lines 2084–2152) — see PR5 brief

- [ ] Tabs: All / Proposals / CVs / Drafts.
- [ ] Cards use DS Card with eyebrow / title / body / footer.
- [ ] Verdict labels for proposals; **no `match score 76%` or any `%` numeric**.
- [ ] Empty state without illustration.

### 3.8 Templates (lines 2155–2272) — see PR5 brief

- [ ] Six rendered preview cards: Editorial, Minimal, Bold, Classic, Compact, Letterpress.
- [ ] Customize style button links to `/settings/docstyle`.

### 3.9 Settings (lines 2275–2569) — see PR5 brief

- [ ] Inner nav: Account, Preferences, Document style, Voice & tone, Billing, Team, Danger zone.
- [ ] Theme switch is Light/Dark only — **no System**.
- [ ] Document style has font pair, layout, accent, page format, signature. **No weight / line-height / margin pickers.**
- [ ] Deep links work (`/settings/docstyle`).

### 3.10 Sign in (lines 2572–2596) — see PR5 brief

- [ ] Skeleton card layout.
- [ ] Continue with Google.
- [ ] Magic link button (or Clerk-supported equivalent).

### 3.11 Cross-cutting overlays

- [ ] Command palette opens with `⌘K` from every route.
- [ ] All cmdk Go-to commands resolve.
- [ ] All cmdk Action commands resolve (`Open safe-send checklist`, `Resolve import review`, `Toggle theme`, `Replay onboarding`, `Export current document`, `Sign out`).
- [ ] Onboarding has six steps and the counter says `Step n of 6`.
- [ ] Toast region is mounted **once** at root (`grep -rn "<ToastProvider"` returns one hit).
- [ ] Every sheet has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, Escape close.
- [ ] `prefers-reduced-motion: reduce` neutralizes every animation.

---

## 4. Cleanup pass

Run, in order:

```bash
# 1. Find all .bak files under my-app
find my-app -name '*.bak' -print

# 2. Find dead exploration files
find my-app -iname 'COLORPALETTE*' -print
find my-app -iname '*proposainputform.bak*' -print
find my-app -iname 'ProfileForm copy.md' -print

# 3. Confirm zero imports of anything to be deleted
git grep -n 'AddSectionBottomSheet' -- my-app/src
git grep -n 'SkillsDrawer' -- my-app/src
git grep -n 'ProfileReviewModal' -- my-app/src
git grep -n 'ProfileReviewCard' -- my-app/src
git grep -n 'ImportRecoveryPanel' -- my-app/src
git grep -n 'ImportCvPreviewModal' -- my-app/src
git grep -n 'ImportWarningBanner' -- my-app/src
git grep -n 'ProposalForgeNext' -- my-app/src

# 4. Run the cleanup agent if available
# Otherwise delete each file manually after confirming zero imports
```

Each deletion is its own commit so revert is easy. After deletions:

```bash
rtk pnpm tsc --noEmit                # must stay green
rtk pnpm test --run                  # full suite must pass
rtk pnpm exec vite build             # must succeed
```

---

## 5. Test hardening

Add or extend the tests listed in §2 above. Each test is small and focused.

### 5.1 `safeSendSheet.gating.test.tsx`

```ts
it("disables Continue to send while any row is warn or danger", () => {
  // render SafeSendSheet with mixed-state rows
  // assert button[name=/Continue to send/] is disabled
});

it("enables Continue to send only when every row is clear", () => {
  // render with all rows clear
  // assert button is enabled
});
```

### 5.2 `shareMenu.anchoring.test.tsx`

```ts
it("opens anchored under the Share trigger", () => { … });
it("closes on outside click", () => { … });
it("closes on Escape and returns focus to the trigger", () => { … });
```

### 5.3 `cmdk.routes.test.tsx`

For each Go-to entry, assert the route resolves. For each Action entry, assert it dispatches the right side effect (sheet open, theme toggle, etc.).

### 5.4 Playwright `skeleton.parity.spec.ts`

```ts
test("no user-visible percentage match scores", async ({ page }) => {
  for (const route of ["/dashboard", "/jobs", "/proposal", "/cv", "/documents", "/templates"]) {
    await page.goto(route);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\d+\s*%/);
  }
});

test("Light and Dark render cleanly", async ({ page }) => { … });
test("command palette opens on Cmd+K from every route", async ({ page }) => { … });
```

### 5.5 Onboarding replay spec

```ts
test("six-step onboarding from command palette", async ({ page }) => {
  await page.goto("/dashboard");
  await page.keyboard.press("Meta+K");
  await page.getByText("Replay onboarding").click();
  for (let i = 1; i <= 6; i++) {
    await expect(page.getByText(new RegExp(`Step ${i} of 6`))).toBeVisible();
    if (i < 6) await page.getByRole("button", { name: /Continue/ }).click();
  }
});
```

---

## 6. Documentation pass

After the diff sweep + cleanup + tests:

1. Update `REFONTE-AUDIT.md` §1 (current active-code baseline) with the new LOC counts of the orchestrator pages.
2. Update `FEATURES-KEEP-VS-REMOVE.md` to mark anything in the REMOVE table as actually removed (with the commit SHA).
3. Update `SKELETON-AUDIT.md` if any synthesized-skeleton decision turned out wrong in implementation — flag it explicitly, do not silently revise.
4. Update this brief's PR-BRIEFS/README.md if the dependency graph changed.

---

## 7. Verification

```bash
rtk pnpm tsc --noEmit
rtk pnpm lint:css
rtk pnpm test --run
rtk pnpm exec vite build
rtk pnpm exec playwright test --project=chromium tests/e2e/skeleton.parity.spec.ts tests/e2e/onboarding.replay.spec.ts
```

Browser checks (rendered):

- Walk every page with the §3 checklist in hand. Any ❌ blocks the PR.
- Run the full delete pass and verify the build stays green between deletions.
- Take screenshots of each page in Light + Dark and attach to the PR description.

---

## 8. Definition of done

- [ ] Every checklist item in §3 is ✅ or has a documented deviation.
- [ ] Every cleanup file in §2 is either deleted or has a documented reason for staying.
- [ ] Every test in §5 lands and passes.
- [ ] No element on any user-visible route matches `/\d+\s*%/` (search-engine-style match scores).
- [ ] `pnpm test --run` is green.
- [ ] `pnpm exec playwright test` is green for the parity specs.
- [ ] PR description includes a parity checklist with screenshots.
- [ ] Documentation updates from §6 land in the same PR.

---

## 9. Out of scope for PR6

- Net-new features.
- Net-new design tokens.
- New primitive components.
- Backend cleanup (parser, Convex, billing).
- Mobile-only redesigns beyond fixing breaks.

If something looks like it belongs in PR6 but is actually a feature, surface it as a follow-up PR proposal in the description rather than absorbing it.
