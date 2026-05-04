# PR briefs — Codex implementation contracts

**Created:** 2026-04-30
**Author of these briefs:** Claude (Opus 4.7), independent of Codex's PR work on `codex-ui-refactor-pr3`.
**Purpose:** strict, selector-level instructions for the structural skeleton refactor (PR2–PR6 from `REFONTE-AUDIT.md`).

> Companion docs (read in this order before starting any PR):
> 1. [APP-SKELETON.html](../APP-SKELETON.html) — visual + interaction authority. Open in a browser.
> 2. [SKELETON-AUDIT.md](../SKELETON-AUDIT.md) — synthesis decision and reject list.
> 3. [REFONTE-AUDIT.md](../REFONTE-AUDIT.md) — implementation contract, current-code baseline, hard rules.
> 4. [FEATURES-KEEP-VS-REMOVE.md](../FEATURES-KEEP-VS-REMOVE.md) — what survives, what dies, what defers.
> 5. The PR brief in this folder for the slice you are about to implement.

---

## Brief index

| File | PR | Surface | Risk | Status |
|---|---|---|---|---|
| [PR2-proposal-forge.md](./PR2-proposal-forge.md) | PR2 | Proposal forge | high | Spec |
| [PR3-jobs-split-view.md](./PR3-jobs-split-view.md) | PR3 | Jobs split-view | medium | Spec |
| [PR4-cv-forge.md](./PR4-cv-forge.md) | PR4 | CV forge + import review | high | Spec |
| [PR5-documents-templates-settings-auth.md](./PR5-documents-templates-settings-auth.md) | PR5 | Documents, Templates, Settings, Sign-in | medium | Spec |
| [PR6-parity-cleanup.md](./PR6-parity-cleanup.md) | PR6 | Skeleton parity + drift cleanup | medium | Spec |

PR0 (docs/skill scaffolding) and PR1 (shell/dashboard/cmdk) are out of scope for these briefs — they were specified in `REFONTE-AUDIT.md` and were the first slice.

---

## Why the briefs are structured this way

Each brief is a **codex-optimized contract**, not a tutorial. It tells the implementer:

1. **What** the slice is (one paragraph) and what it is **not**.
2. **Where** to read the spec (APP-SKELETON.html line ranges).
3. **Which files** to touch and which to leave alone.
4. **What CSS** the skeleton needs and where it should live (`product-{slice}.css`).
5. **Which DS primitives** to reuse vs author. The skeleton introduces `ds-*` classes (`ds-paper`, `ds-pill`, `ds-verdict`, `ds-sheet`, `ds-menu`, `ds-tone`, `ds-status`, `ds-banner`, `ds-card`, `ds-ats`, `ds-field`, `ds-icon-btn`, `ds-scrim`) that may not yet exist in the active app — each brief states whether the slice must add them.
6. **Behavior contracts** in numbered bullet form. No prose ambiguity.
7. **Keep / Restore / Remove** lifted from `FEATURES-KEEP-VS-REMOVE.md` for the slice's surface.
8. **Verification commands** — exact and copy-pasteable.
9. **Open-ended escape hatch:** if I misquoted a token, selector, file path, or import, **prefer active code over this brief**, fix it, and note the correction in the PR description.

---

## Hard rules (apply to every brief)

These re-state §3 of `REFONTE-AUDIT.md` so a Codex session that only opens the brief still sees them:

1. **Tokens only.** No new hex/rgb/hsl literals outside token files already exempted by stylelint.
2. **No new design tokens** without stopping and flagging why. Reuse existing tokens from `my-app/src/styles/foundation.css`.
3. **Use DS primitives** from `my-app/src/components/ui/`, `my-app/src/components/ai/` (existing) or scoped product CSS classes following the `ds-*` naming. Do not re-roll buttons, menus, sheets, toasts, cards, AI cards, AI stage lists, or the floating toolbar.
4. **Keep AI lib untouched.** `my-app/src/lib/ai/*` is frozen. The proposal/CV briefs depend on `applyAiSuggestion`, `interactionRulebook`, `aiInteractionTelemetry`, `editorAiJobContext` — call them, never edit them.
5. **One PR equals one merge-ready surface.** No half-finished feature flags.
6. **Preserve parser/export/auth APIs.** The refactor is structural and UX-facing, not a backend rewrite.
7. **No user-facing numeric match percentages.** Use verdict labels everywhere.
8. **UI copy:** sentence case, restrained, no exclamation marks, no emoji. Period-terminate marketing-style sentences.
9. **No idle decorative animation** outside the brand period (`<span class="ds-btn__period">.</span>`) and the "live render" status dot. Every animation must have a `@media (prefers-reduced-motion: reduce)` neutralization.
10. **No spinners.** Period pulse only.
11. **Maximum 4 actions** in `FloatingAiToolbar` (Rewrite / Shorten / Fix / Ask).
12. **No auto-apply** for Rewrite / Strengthen / Ask. The rulebook enforces this — do not bypass.
13. **Browser-facing changes require rendered verification.** Run `pnpm dev`, exercise the surface, and screenshot the critical states.
14. **Never bypass hooks** with `--no-verify`.

---

## Per-PR check (run before opening the PR)

```bash
rtk pnpm tsc --noEmit
rtk pnpm lint:css
rtk pnpm exec vite build
rtk pnpm test --run               # narrow to the touched surface where possible
```

Plus: a browser-rendered check of the surface in the brief, in both Light and Dark, at desktop (1440) and small-laptop (1280) widths.

---

## If something disagrees

Order of authority when sources conflict:

1. **Active code** wins on imports, data contracts, runtime behavior of `lib/ai/*`, parser, export, auth.
2. **`APP-SKELETON.html`** wins on visible structure, interaction states, page composition.
3. **`FEATURES-KEEP-VS-REMOVE.md`** wins on whether a feature survives.
4. **These briefs** win on the order, file split, and selector mapping for the slice — but **only when the above three agree**. If any of them contradict the brief, follow them and note the correction.

---

## Naming note

`PR1` (shell/dashboard) was implemented before these briefs were written, on branch `codex-ui-refactor-pr3` (commit `da5880a37`). PR2 (proposal) was also implemented on that branch (commit `65eadf8de`). PR3 (jobs) is in-flight on that branch (commits `05d146e8a`, `0467609f6`).

These briefs were authored on `claude/hungry-mcnulty-1722ea` **without reading** the implementation commits, to give an independent target the user can diff against their existing PRs.
