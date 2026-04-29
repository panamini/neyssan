# Codex handoff — DS v2 + AI primitives styling

> **Read first:** [SKELETON.html](./SKELETON.html) (visual reference, validated by user) and [CODEX-DS-V2-PLAN.md](./CODEX-DS-V2-PLAN.md) (full spec — but several sections are now obsolete, see §0 below).

---

## §0 What's already in main (DO NOT rebuild)

The AI interaction backend was implemented before this DS work. The following files exist and are integrated. **Refactor styling only — keep the APIs intact.**

| File | Status | What to do |
|---|---|---|
| `my-app/src/components/ai/AiSuggestionCard.tsx` (253 LOC, last touched in `bfbed58e6`) | EXISTS, functional | **Refactor styling only.** Keep props API: `actionLabel`, `title`, `beforeText`, `afterText`, `status: "preview" \| "accepted"`, `compact`, `isApplying`, `onAccept`, `onDiscard`, `onUndo`. Replace inline styles with `ds-ai-card` classes. Add `state="loading" \| "ready" \| "error"` rendering — the existing card has `preview/accepted` only; loading + error are missing and required by the visual spec. |
| `my-app/src/components/FloatingAiToolbar.tsx` (767 LOC) | EXISTS, big | **Refactor in place.** Apply `ds-ai-toolbar` classes. Enforce max 4 actions visible (Rewrite/Shorten/Fix/Ask). Verify: no Rewrite/Strengthen/Ask auto-apply (rulebook should already prevent it — confirm with `interactionRulebook.ts`). Move to `components/ai/FloatingAiToolbar.tsx` only if low-risk; otherwise leave path. |
| `my-app/src/lib/ai/interactionRulebook.ts` | EXISTS | **Do not modify.** Source of truth for action behaviors. |
| `my-app/src/lib/ai/applyAiSuggestion.ts` | EXISTS | **Do not modify.** |
| `my-app/src/lib/ai/aiInteractionTelemetry.ts` | EXISTS | **Do not modify.** |
| `my-app/src/lib/ai/editorAiJobContext.ts` | EXISTS | **Do not modify.** |

**Existing tests must keep passing.** `__tests__/AiSuggestionCard.test.tsx`, `interactionRulebook.test.ts`, `applyAiSuggestion.test.ts`, `aiInteractionTelemetry.test.ts`.

---

## §1 What's already shipped by this PR (DS-1)

Already in this branch:

1. **Motion tokens added to `my-app/src/styles/foundation.css`** (appended at end).
   New tokens available globally:
   `--motion-duration-{micro,fast,normal,medium,panel,settle,reveal,brand}`,
   `--motion-ease-{standard,enter,exit,emphasized,breathe}`,
   `--motion-opacity-breathe-{low,high}`.
   Plus `@keyframes tw-breathe` and a `prefers-reduced-motion` override.
   **Use these tokens — do not redefine.**

2. **`docs/UI/SKELETON.html`** — visual reference, light + dark, all primitives validated.

3. **`docs/UI/CODEX-DS-V2-PLAN.md`** — full spec (CSS, component contracts, rules).
   Override notes for what's now different:

---

## §2 Token corrections vs the long plan

The long plan was written against `foundation.css` neyssan tokens which had drifted. **The skeleton + this handoff are authoritative.** Differences vs CODEX-DS-V2-PLAN.md:

| Topic | Long plan said | Use instead (from skeleton) |
|---|---|---|
| Theme attribute | `.dark` class | `[data-theme="dark"]` attribute (foundation.css already supports `.dark`; new code targets `[data-theme="dark"]`. Check existing usage with `grep -r "data-theme" my-app/src/styles` and follow whichever is wired up to ThemeProvider — do not switch the convention). |
| Document serif | (mentioned Baskervville/Fraunces vaguely) | **Baskervville** only — `var(--font-serif-display)` already declared. |
| Mono font | IBM Plex Mono in some refs | **SF Mono** primary, Geist Mono fallback. |
| Pill accent | mixed | `background: var(--am-soft); color: var(--ac);` — peach + terracotta. **No sage.** |
| Inputs | outlined white + glow | **Subtle-fill:** bg `var(--sf2)`, 2px transparent border, focus = border swap to `var(--ti)`, **no glow**. See SKELETON.html section 02. |
| Tone badges | not in plan | **NEW.** Warm / Formal / Natural — see SKELETON.html section 04. |
| Sidebar active | not in plan | **NEW signature.** Gradient `var(--ap) → transparent` + 2px inset stripe `var(--ac)`. See SKELETON.html section 07. |
| Paper | barely covered | Always `var(--paper)`. **In dark mode, paper text uses fixed dark inks (`#0F0C08` headings, `#2F2D29` body) — NOT `var(--ti)`.** See SKELETON.html section 08. |
| Native controls | not covered | Tinted globally via `accent-color: var(--ac)` on `html, body`. |

---

## §3 Open visual notes (low priority, fix during DS-2)

User-flagged details to address during DS-2 polish. Not blocking.

- **Input danger border in dark** reads slightly "ghosted pink." Try lowering saturation to ~30% or thickening to 2px solid.
- **Secondary button border in dark** feels muddy. Test `var(--border-stronger)` instead of `var(--border-strong)`, or remove border in dark and rely on `--shb` only.

---

## §4 Stylelint guardrail (BLOCKED — Codex must add)

A `pre-commit` hook on this machine blocked the creation of `.stylelintrc.json` from this orchestrator session. **Codex must add it manually as part of DS-2.** Use the config from CODEX-DS-V2-PLAN.md §11. Important: ignore `src/styles/{product,primitives,utilities,base,tailwind,themes}.css` initially — those are legacy and will fail.

Add `"lint:css": "stylelint 'src/styles/ds-v2.css' 'src/components/ds/**/*.css'"` to `package.json` scripts.

Install:
```
pnpm add -D stylelint stylelint-config-standard stylelint-declaration-strict-value
```

---

## §5 Recommended PR sequence (revised)

| PR | Title | Files |
|---|---|---|
| **DS-2** | `feat(ds-v2): primitives layer + ds-v2.css + stylelint guardrail` | `src/styles/ds-v2.css`, `src/index.css` (import), `src/components/ui/{button,input,textarea,card,pill,tone-badge,status-badge,toast,dialog,skeleton}.tsx`, `.stylelintrc.json`, `package.json` |
| **DS-3** | `refactor(ai): align AiSuggestionCard with ds-v2 + add loading/error states + DiffBlock + AiStageList` | `src/components/ai/AiSuggestionCard.tsx` (refactor only), new `src/components/ai/{AiStageList,DiffBlock}.tsx`. **Do not touch** `lib/ai/*`. |
| **DS-4** | `refactor(ai): FloatingAiToolbar visual alignment + 4-action enforcement` | `src/components/FloatingAiToolbar.tsx` (refactor in place — too big to move safely without separate PR). |
| **DS-5** | `feat(ai): UndoToast helper + integrate into toast provider` | `src/components/ai/UndoToast.tsx`, `src/components/ui/toast.tsx`. |
| **DS-6** | `feat(layout): subtle-fill inputs + sidebar gradient/stripe + tone badges (rollout)` | Migrate page-level usages to new primitives where mechanical. |
| **DS-7** | `chore: remove .bak files and dead duplicates` | Remove `*.bak`, `COLORPALETTE*.HTML`, `proposainputform.bak`, `ProfileForm copy.md`. |
| **DS-8** | `test(ds-v2): playwright visual baselines for SKELETON-equivalent stories` | `e2e/ds-v2.spec.ts`. |
| **DS-9** | `feat(ds-v2): Sheet primitive (right drawer + bottom sheet) + migrate SkillsDrawer/AddSectionBottomSheet` | New `src/components/ui/sheet.tsx`, append CSS from `SKELETON.html` §06b to `src/styles/ds-v2.css`, refactor `src/components/structured-blocks/SkillsDrawer.tsx` and `src/components/AddSectionBottomSheet.tsx` to use `<Sheet>`. **Portal to `document.body`** to escape stacking contexts. See plan §4.7b. |
| **DS-10** | `feat(ds-v2): Menu primitive (dropdown anchored to trigger) + migrate ad-hoc menus` | New `src/components/ui/menu.tsx`, append CSS from `SKELETON.html` §06c to `src/styles/ds-v2.css`, migrate `LibraryFilterMenu.tsx` and inline popover/menu markup in `ProposalDisplay.tsx`, `ProposalComposeToolbar.tsx`, `SectionEditor.tsx`, `ProposalArtifactInspector.tsx`, `EmbeddedStyleInspector.tsx`. **Portal to `document.body`**. See plan §4.7c. |

Dependencies: DS-2 → DS-3 → DS-4 → DS-5 → DS-6 → DS-7 → DS-8.

---

## §6 Hard rules (Codex MUST NOT violate)

1. **No new tokens.** Use `var(--*)` from `foundation.css` only.
2. **No emoji, no Title Case, no exclamation marks** in UI strings (sentence case + period).
3. **No spinners.** Period pulse only (`<span class="ds-btn__period">.</span>`).
4. **No icons in `FloatingAiToolbar` action buttons.** Text only.
5. **No auto-apply** for Rewrite / Strengthen / Ask. The rulebook (`interactionRulebook.ts`) already enforces this — Codex must not bypass.
6. **No idle decorative animation** anywhere except the brand period.
7. **Block-level diff animation only.** Never per-character.
8. **Maximum 4 actions** in `FloatingAiToolbar`.
9. **One toast region** mounted once at root.
10. **Don't structurally refactor** `ProposalForge.tsx`, `JobsPage.tsx`, `CvForge.tsx`, `SettingsPage.tsx` in these PRs — only swap class names / imports where mechanical.
11. **Reduced-motion**: every animation must have a `@media (prefers-reduced-motion: reduce)` neutralization.
12. **Existing AI lib (`lib/ai/*`) untouched.**

---

## §7 Pre-PR check (every PR)

```
pnpm tsc --noEmit
pnpm test --run
pnpm build
pnpm lint:css      # only after DS-2 lands the config
```

All must exit 0. If a hook fails, fix root cause — do not bypass with `--no-verify`.
