# Non-Paper White Usage Audit

Date: 2026-03-28

## Scope

This pass excludes true document paper surfaces already moved to `--paper`.

Target hierarchy:
- canvas = `--bg`
- raised panel/card = `--sfr`
- document paper = `--paper`

## Replacements Made

| Path | Usage | Semantic role | Replacement |
| --- | --- | --- | --- |
| `my-app/src/features/verbati/style.ts:316,333,353` | Verbati raised surface source | raised panel/card | Removed hardcoded `#ffffff`; `surfaceRaised` is now derived from existing neutral surfaces (`surface` + `canvas`) so `--sfr` stays distinct from both `--bg` and `--paper`. |
| `my-app/src/features/verbati/VerbatiCvPreviewPanel.tsx:177-178` | preview panel background | raised panel/card | Replaced white-mixed gradient with `linear-gradient(180deg, var(--sfr), var(--sf1))`. |
| `my-app/src/features/verbati/VerbatiCvPreviewPanel.tsx:197-198` | preview panel background | raised panel/card | Replaced white-mixed gradient with `linear-gradient(180deg, var(--sfr), var(--sf1))`. |
| `my-app/src/features/verbati/resume/resume-preview.css:119` | `.resume-preview-back` | control chrome | Replaced white-mix fill with `var(--color-surface)`. |
| `my-app/src/features/verbati/resume/ResumePage.tsx:747` | `QUIRE_SIDEBAR_TEXT_PRIMARY` | content accent on dark sidebar | Replaced hardcoded `#ffffff` with `var(--color-on-accent)`. |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3896-3898` | `PhotoOrInitials` inline color | content accent on dark avatar chip | Replaced `white` text with `var(--color-on-accent)`. |

Active `#ffffff` literals left in live `src/` surface/chrome paths after this pass: none.

## Remaining Active Non-Paper White Usages

### Keep As White-Alpha / Highlight Behavior

| Path | Usage | Semantic role | Decision |
| --- | --- | --- | --- |
| `my-app/src/styles/foundation.css:313-317` | `--section-hover-shadow` | top-edge sheen on hovered panels | remain white-alpha |
| `my-app/src/styles/foundation.css:506-507` | dark `--section-hover-shadow` | dark-mode gloss line on hovered panels | remain white-alpha |
| `my-app/src/styles/foundation.css:515-516` | `--document-viewer-frame-shadow` | frame sheen on document shell panel | remain white-alpha |
| `my-app/src/styles/utilities.css:421-423` | `.dasti-stage-card` shadow | stage/chassis highlight | remain white-alpha |
| `my-app/src/styles/primitives.css:674` | `.dasti-menu-option__icon` | icon-chip top light | remain white-alpha |
| `my-app/src/styles/primitives.css:850` | `.dasti-segmented-control` | control chrome highlight | remain white-alpha |
| `my-app/src/styles/product.css:2428-2430` | `.styleforge-choice-card--active` | active-card inset highlight | remain white-alpha |
| `my-app/src/styles/product.css:2446-2448` | `.styleforge-active-cv-control--loaded`, `.dasti-proposal-chip--active`, `.dasti-proposal-cv-switch--active` | active control inset highlight | remain white-alpha |
| `my-app/src/styles/product.css:2470-2472` | dark `.styleforge-active-cv-control--loaded` | dark active control inset highlight | remain white-alpha |
| `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx:69` | active card shadow | active-card gloss | remain white-alpha |
| `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx:97` | active topbar button shadow | active-control gloss | remain white-alpha |
| `my-app/src/features/verbati/VerbatiStyleWorkspace.tsx:86` | active card shadow | active-card gloss | remain white-alpha |
| `my-app/src/features/verbati/VerbatiStyleWorkspace.tsx:114` | active topbar button shadow | active-control gloss | remain white-alpha |
| `my-app/src/features/verbati/VerbatiStyleWorkspace.tsx:145` | active color-card shadow | color chip gloss | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:745` | `QUIRE_SIDEBAR_RULE` | separator rule on dark sidebar | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:746` | `QUIRE_SIDEBAR_LABEL_COLOR` | subdued meta labels on dark sidebar | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:748` | `QUIRE_SIDEBAR_TEXT_SECONDARY` | secondary copy on dark sidebar | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:1023` | inline text color | subdued highlight text on dark treatment | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:2791` | photo frame fill | translucent photo plate inside document content | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3681-3682` | photo frame border/fill | translucent photo frame inside document content | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3875` | inline text color | bright on-dark content accent | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3889-3890` | avatar shell background/border | translucent shell inside document content | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3898` | avatar inner background | translucent fill inside document content | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3923` | inline text color | subdued on-dark content accent | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3956` | inline text color | subdued on-dark content accent | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3983` | inline text color | subdued on-dark content accent | remain white-alpha |
| `my-app/src/features/verbati/resume/ResumePage.tsx:4008` | inline text color | subdued on-dark content accent | remain white-alpha |

### Keep As Tokenized White Mix / Neutral Lift

| Path | Usage | Semantic role | Decision |
| --- | --- | --- | --- |
| `my-app/src/styles/foundation.css:303-306` | `--section-hover-surface` | raised panel hover surface | remain unchanged |
| `my-app/src/styles/foundation.css:364-367` | `--gradient-canvas` | app canvas atmosphere | remain unchanged |
| `my-app/src/styles/foundation.css:369-372` | `--gradient-sidebar` | sidebar panel gradient | remain unchanged |
| `my-app/src/styles/foundation.css:374-382` | `--gradient-surface`, `--gradient-stage` | panel/stage lift | remain unchanged |
| `my-app/src/styles/foundation.css:392-395` | `--sidebar-active-bg` | active sidebar chrome | remain unchanged |
| `my-app/src/styles/foundation.css:496-504` | dark `--section-hover-surface`, `--section-hover-border` | dark hover polish | remain unchanged |
| `my-app/src/styles/primitives.css:269` | `.dasti-button--success:hover` | semantic action hover tint | remain unchanged |
| `my-app/src/styles/primitives.css:273` | `.dasti-button--warning:hover` | semantic action hover tint | remain unchanged |
| `my-app/src/styles/primitives.css:672` | `.dasti-menu-option__icon` | neutral icon chip fill | remain unchanged |
| `my-app/src/styles/utilities.css:379` | `.dasti-drop-surface:hover .dasti-drop-surface__zone`, `.dasti-drop-surface--active .dasti-drop-surface__zone` | accent dropzone border lift | remain unchanged |
| `my-app/src/styles/product.css:2571-2572` | `.styleforge-active-color-card` | active color-card panel gradient | remain unchanged |
| `my-app/src/styles/product.css:2606` | `.styleforge-active-color-card__swatch` | swatch ring lift | remain unchanged |
| `my-app/src/styles/product.css:3395` | `.dark .dasti-section-dismiss-pill` | on-dark control copy lift | remain unchanged |
| `my-app/src/styles/product.css:3532` | `.dasti-import-button:hover:not(:disabled)` | hover fill on import control | remain unchanged |
| `my-app/src/styles/product.css:3536` | `.dasti-import-button--drop` | drop target accent border | remain unchanged |
| `my-app/src/styles/product.css:3606` | `.cv-photo-upload-trigger` | upload control fill | remain unchanged |
| `my-app/src/styles/product.css:3620` | `.cv-photo-upload-trigger:hover`, `.cv-photo-upload-trigger:focus-visible` | upload control hover fill | remain unchanged |
| `my-app/src/styles/product.css:3635` | `.cv-photo-upload-trigger--drag` | upload drag border accent | remain unchanged |

### Keep Unchanged As Content Accent

| Path | Usage | Semantic role | Decision |
| --- | --- | --- | --- |
| `my-app/src/features/verbati/resume/ResumePage.tsx:458-459` | `PhotoOrInitials` fallback gradient | image/initial badge accent fill | remain unchanged |
| `my-app/src/features/verbati/resume/ResumePage.tsx:749-750` | `QUIRE_SIDEBAR_ACCENT` | accent text/chip color on dark sidebar | remain unchanged |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3469` | radial accent | decorative content accent | remain unchanged |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3697` | pill background | content accent chip | remain unchanged |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3753` | pill background | content accent chip | remain unchanged |
| `my-app/src/features/verbati/resume/ResumePage.tsx:4045` | accent color mix | content emphasis | remain unchanged |
| `my-app/src/components/dev/debug-toggle.tsx:53` | `text-white` | dev-only danger state | remain unchanged |
| `my-app/src/components/dev/debug-panel.tsx:247` | `text-white` | dev-only danger state | remain unchanged |

## Notes

- No non-document surface was remapped to `--paper`.
- The app still uses white mixes and white-alpha in several places, but they are now either:
  - highlight/gloss behavior
  - content accents on dark treatments
  - existing shared theme polish tokens
- The explicit hardcoded `#ffffff` panel/control/chrome values in live code were removed in this pass.
