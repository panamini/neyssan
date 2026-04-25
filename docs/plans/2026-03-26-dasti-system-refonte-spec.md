# DASTI System Refonte Spec

Date: 2026-03-26
Status: active implementation spec for `my-app`
Scope: routed product UI only (`/cv`, `/cvs`, `/proposal`, `/proposals`, `/style`)

## Intent

This refonte uses the DASTI references as a quality model, not as a second system to copy literally.

The goal is to make the live interface more disciplined in:

- token readability
- spacing and grid consistency
- typography hierarchy
- radius and border hierarchy
- reusable component recipes
- clear separation between shared primitives and product-specific exceptions

The goal is not to erase useful product exceptions when those exceptions are part of the interface behavior.

## Classification

### Active code

- `src/styles/foundation.css`
- `src/styles/base.css`
- `src/styles/utilities.css`
- `src/styles/primitives.css`
- `src/styles/product.css`
- `src/styles/globals.css`
- shared UI wrappers in `src/components/ui/`
- routed app shell pages and active feature shells

### Legacy but informative

- `../UI/UI-SPEC/css-audit/dasti_design_system_restructure.md`
- `../UI/UI-SPEC/css-audit/dasti_specv3_2203_systemUI.tsx`
- `../UI/UI-SPEC/css-audit/dasti-production-backup/dasti-rewrite-pack-v1`
- `DESIGN_SYSTEM.md`

These files are useful for system direction, naming, hierarchy, and recipes. They are not the runtime source of truth.

### Obsolete or non-authoritative

- `pdf-ingest/`
- parser/training legacy trees
- `*.bak`
- archive and backup component trees

## Design Thesis

The product should feel calm, editorial, and premium, with soft contour lines instead of hard frames.

The system should optimize for memorability and team usability:

- rounded spacing values
- readable semantic aliases
- explicit component recipes
- limited exceptions
- no formula-derived component geometry

## Canonical Layering

### 1. Foundation

Source of truth:

- spacing scale `4 / 8 / 12 / 16 / 24 / 32 / 40 / 64 / 80`
- type sizes `12 / 14 / 16 / 20 / 26 / 32`
- line heights `16 / 20 / 24 / 30 / 40`
- radius scale `8 / 12 / 16 / 20 / pill`
- control heights `32 / 40 / 44`
- containers `480 / 640 / 768 / 1024 / 1280`
- gutters `16 / 24 / 32`
- motion and z-index

Readable authoring tokens are canonical:

- `--space-*`
- `--font-size-*`
- `--line-*`
- `--radius-*`
- `--control-*`
- `--duration-*`
- `--ease-*`
- `--container-*`
- `--gutter-*`
- `--z-*`
- `--color-*`

Legacy short aliases remain compatibility only:

- `--s1` to `--s9`
- `--tx`, `--ts`, `--tb`, `--tm`, `--tl`, `--tx2`
- `--rx`, `--rs`, `--rm`, `--rl`, `--rp`
- `--bo`, `--bm`
- Tailwind bridge aliases such as `--background`, `--foreground`, `--primary`

### 2. Base

Base sets:

- body and root typography
- scrollbar tokens
- focus treatment
- editor content defaults

Base must not contain product layout recipes.

### 3. Utilities

Utilities are generic layout primitives only:

- `container`, `container-wide`
- `stack-1` to `stack-6`
- `gap-1` to `gap-6`
- `cluster-1` to `cluster-4`
- `cluster-between`, `cluster-start`, `cluster-end`
- `grid-1` to `grid-4`
- `grid-fit-sm`, `grid-fit-md`, `grid-fit-lg`
- `flow-1` to `flow-5`
- `inset-1` to `inset-6`
- `scroll-region`
- DASTI page-shell helpers

Utilities must stay neutral and reusable.

### 4. Primitives

Primitives define shared component anatomy:

- text roles
- buttons
- icon buttons
- cards and panels
- fields and selects
- segmented controls
- pills
- statuses
- theme switch
- toasts
- modal shell

### 5. Product exceptions

Product CSS is allowed for:

- sidebar-specific navigation states
- proposal CV selection pills
- document card delete-reveal behavior
- page-specific orchestration

Product CSS is not allowed to redefine global token hierarchy.

## Radius and Border Canon

### Radius hierarchy

- inline affordance: `8px`
- control: `12px`
- card: `16px`
- surface/panel/modal/stage: `20px`
- pill/chip/capsule only: `999px`

Mapped semantic roles:

- `--radius-inline`
- `--radius-control`
- `--radius-card`
- `--radius-surface`
- `--radius-pill`

### Border hierarchy

Light mode:

- `--border-soft: hsla(30, 10%, 12%, 0.07)`
- `--border-field: hsla(30, 10%, 12%, 0.11)`
- `--border-strong: hsla(30, 10%, 12%, 0.16)`

Dark mode:

- `--border-soft: hsla(46, 12%, 86%, 0.10)`
- `--border-field: hsla(46, 12%, 86%, 0.16)`
- `--border-strong: hsla(46, 12%, 86%, 0.22)`

Usage:

- cards and panels use `soft`
- fields, segmented rails, and control shells use `field`
- selected, active, and structural emphasis use `strong`

## Spacing Canon

The system keeps the current rounded ladder and rejects phi-based spacing for authoring.

Core spacing scale:

- `4`
- `8`
- `12`
- `16`
- `24`
- `32`
- `40`
- `64`
- `80`

Decision aliases:

- `--gap-tight`
- `--gap-default`
- `--gap-roomy`
- `--section-gap-sm`
- `--section-gap-md`
- `--section-gap-lg`
- `--container-pad-sm`
- `--container-pad-md`
- `--container-pad-lg`
- `--flow-1` to `--flow-5`

Rules:

- layout rhythm can be richer than text rhythm
- text flow stays simple
- component paddings are recipes, not formulas
- top-vs-bottom optical correction is allowed only inside component recipes

## Typography Canon

### Families

- heading/editorial: `Fraunces`
- body/UI: `Source Sans 3`
- mono: `IBM Plex Mono`

### Weights

- body default: `400`
- label/strong UI: `600`
- heading: `600`

### Tracking

- display: `-0.02em`
- heading/title: `-0.01em`
- default: `0`
- overline: `0.14em`

### Semantic text roles

- `dasti-text-overline`
- `dasti-text-caption`
- `dasti-text-label`
- `dasti-text-body-sm`
- `dasti-text-body`
- `dasti-text-title`
- `dasti-text-display`

Role line-height strategy:

- display: `1.15`-like optical result via `32/40`
- titles: `20/30`
- body: `16/24`
- body-sm and labels: `14/20`
- caption and overline: `12/16`

## Layout Canon

### Containers

- `container`: standard application reading width
- `container-wide`: wider product workspace width
- `dasti-page-shell`: canonical routed page wrapper
- app sidebar shell widths:
  - expanded: `248px`
  - compact expanded: `232px`
  - collapsed rail: `52px`

### Stack and flow

- `stack-*` is for layout separation
- `flow-*` is for text rhythm
- do not interchange them casually

### Cluster

Use cluster for:

- action groups
- pills and status wraps
- inline metadata rows

### Grid

Use:

- `grid-1` to `grid-4` for fixed desktop grids
- `grid-fit-*` for auto-fit cards and chooser layouts
- `dasti-grid-split` for main workspace split panes

### Sidebar shell

The sidebar is part of the canonical shell, not a free-form product fragment.

Sidebar tokens define:

- expanded width
- compact expanded width
- collapsed width
- nav item height
- action row height
- icon size
- nav label size
- section label size and tracking
- indent values for doc rows and “view all” rows

Rules:

- collapsed mode keeps the same icon rail and centers controls
- compact and default expanded modes share the same geometry family
- icon size stays fixed across modes
- section labels collapse fully instead of partially truncating
- only one navigational item may be active at a time within a section
- parent entries like `Studio` or `Compose` are active only on their base route, never at the same time as a selected document row
- sidebar rows use shell tokens and shared surface logic, not ad hoc values

## Component Recipes

### Buttons

Canon:

- base: `dasti-button`
- sizes: `sm`, `md`, `lg`
- variants: `primary`, `secondary`, `ghost`, `accent`, `success`, `warning`, `danger`

Rules:

- controls are `12px` radius
- primary is the only strong accent-solid action
- accent is a softer accent support action
- ghost is chrome-light and depends on hover/state

### Icon buttons

Canon:

- `dasti-icon-button`
- `dasti-icon-button--compact`
- `dasti-icon-button--bare`

Rules:

- default icon buttons have light contour
- compact/bare icon buttons are allowed where a fully framed control would create visual noise

### Cards

Canon:

- `dasti-card`
- padding tiers `sm / md / lg`
- tones `default / muted / elevated`
- optional `interactive`

Rules:

- medium cards use `16px`
- large surfaces move to `20px`
- card hover should sharpen contour, not become flashy

### Panels and surfaces

Canon:

- `dasti-panel`
- `dasti-surface-panel`
- `dasti-stage-card`

Rules:

- large shell surfaces use `20px`
- panel borders remain hairline-light

### Fields and selects

Canon:

- `dasti-field`
- `dasti-select`
- size modifiers `sm / md / lg`
- state modifiers `ghost / error`

Rules:

- fields are slightly stronger than cards in border weight
- focused controls go to accent border plus shared focus ring
- large text areas can keep special editor behavior, but the shell still follows the field recipe

### Segmented controls

Canon:

- `dasti-segmented-control`
- `dasti-segmented-control__button`

Rules:

- rail uses `field` border strength
- active item uses raised surface and stronger contour

### Pills

Canon:

- `dasti-pill`
- tones: `neutral`, `accent`, `success`, `warning`, `danger`
- sizes: `sm`, `md`

Rules:

- pills remain full capsule
- do not use pill radius for ordinary buttons or fields

### Status

Canon:

- `dasti-status`
- tones: `info`, `success`, `warning`, `danger`

Rules:

- status is more explicit and slightly more assertive than a passive pill
- use status for operational state, not tagging

### Theme switch

Canon:

- `dasti-theme-switch`
- `dasti-theme-switch__rail`
- `dasti-theme-switch__thumb`
- `dasti-theme-switch__label`

Rules:

- product-specific switches may keep local markup, but they must visually follow this shared anatomy

### Toast

Canon:

- `dasti-toast`
- tones: `neutral`, `info`, `success`, `warning`, `danger`

Rules:

- toast shape follows card radius tier
- tone is expressed by surface fill and subtle border change, not by loud saturated blocks

## Shadow, Gradient, and Frost Canon

### Shadow

The product uses a restrained elevation ladder:

- `shadow-sm`: controls and quiet cards
- `shadow-md`: raised cards, hover lift, and stage surfaces
- `shadow-lg`: modals and stronger overlays
- `shadow-frost`: translucent and blurred overlays

Rules:

- more elevation means a larger and softer shadow, not a darker one
- dark mode still needs surface separation; shadows alone are not enough
- routine layout regions should default to border plus surface contrast before shadow

### Gradient

The system keeps gradients subtle and structural:

- `gradient-canvas`: application background wash
- `gradient-sidebar`: sidebar shell surface
- `gradient-surface`: raised panel or large card surface
- `gradient-stage`: preview and stage surfaces

Rules:

- gradients should support depth and atmosphere, not create decorative noise
- light mode should read as ivory or skin-paper, not plain white
- dark mode should read as black paper with diffuse dimmed light, not neon green tint
- only large shells and stage-like surfaces should keep persistent gradients
- everyday controls stay solid by default

### Frost

Frost is available as a system tool, not a default treatment:

- `frost-bg`
- `frost-surface`
- `frost-border`
- `frost-blur`
- `frost-saturate`
- utility class `dasti-frost`
- utility class `dasti-drop-surface`

Rules:

- use frost for modal headers, floating bars, or overlay surfaces only
- use `dasti-drop-surface` for import or drag-target states where the surface should feel transient and photographic
- frost must combine translucency, blur, and tuned border contrast
- do not use frost as a substitute for normal card styling

## Shared Exceptions To Keep

The following remain valid exceptions as long as they stay isolated:

- sidebar nested-row spacing nuances for CV/proposal list depth
- sidebar inline theme switch markup
- proposal CV pill anatomy
- library delete-reveal controls
- Verbati resume renderer document CSS in `src/features/verbati/resume/resume-preview.css`

The resume renderer is a separate document-rendering subsystem. Its mm-based logic must not become the general app-shell model.

## Migration Rules

1. New shared work must author against readable semantic tokens, not old shorthand aliases.
2. Shared wrappers in `src/components/ui/` are the first migration target when normalizing component behavior.
3. Product-specific classes can keep special spacing or proportions if removing them would visibly regress the interface.
4. Exceptions must stay named and local. They must not leak back into foundation or utilities.
5. No new raw radius or border-color values should be introduced in shared app-shell code.

## What Is Implemented In This Pass

- canonical radius and border hierarchy
- typography family, weight, and tracking tokens
- generic container/stack/gap/cluster/grid/inset utilities
- sidebar shell width, density, icon, label, and indent tokens
- semantic text roles
- normalized shared button, input, card, segmented radio, toast, and theme-switch primitives
- canonical shadow, gradient, and frost tokens and utilities
- stronger field and segmented-control state logic
- shared pill and status recipes
- app-shell CSS entrypoint now includes utilities in the canonical import chain

## Remaining Work After This Pass

- migrate remaining inline-heavy editor sub-elements onto the shared primitives where safe
- normalize more status messaging surfaces outside the toast system
- finish typography cleanup inside older editor-adjacent components that still hardcode sizes or weights
- reduce remaining product inline styles where they are now covered by stable primitives

## Verification Plan

Visual verification:

- `/cv`
- `/cvs`
- `/proposal`
- `/proposals`
- `/style`

Check:

- control/card/panel radius ladder reads clearly
- borders remain light and quiet in light and dark mode
- buttons, fields, segmented controls, pills, and toasts share the same geometry family
- page gutters and shell spacing are consistent
- sidebar width, icon size, row height, and labels stay coherent in expanded and collapsed modes
- gradients remain subtle on canvas and large surfaces instead of disappearing or becoming loud

Static verification:

- no new raw border-radius values in shared app-shell code
- no new raw border colors in shared app-shell code
- compatibility aliases remain bridge-only

Boundary verification:

- Verbati resume preview stays isolated as a document renderer
- shared px/token/grid system stays the model for the app shell

## Refinement Addendum

This refinement pass tightens the system in four areas:

- `ProposalForge` output returns to the canonical sheet model with the title/header on top, while `copy`, `regenerate`, `delete`, `focus`, and `save to library` live in the header controls instead of as a floating overlay
- `Choose resume` in `ProposalForge` now follows the same toolbar-button language as the compose shell and truncates the visible CV label deliberately
- `StyleForge` removes the large hero header and keeps the active-CV switch inside the preview card header, while `Advanced tone` becomes a direct `Custom tone` zone that opens the live color picker
- the Verbati resume renderer uses the site typography more convincingly for `summary`, `experience`, `achievements`, and body copy, instead of reading like a generic fallback template

### Proposal Compose Rules

- no `Saved` tab inside `ProposalForge`
- generated output keeps its document header
- `Focus output` expands the generated sheet into a single-card compose view
- `Save to library` writes the current draft back through the shared proposal mutation path

### Resume Chooser Rules

- no edit icon inside the chooser cards
- chooser card click selects the candidate CV
- chooser action button means `use` for inactive CVs and `open` for the active CV
- the toolbar button itself only opens the chooser

### Icon System Rule

- active app-shell icons now resolve through `src/lib/icons.tsx`
- the runtime icon family is Phosphor
- legacy `lucide-react` remains only in test mocks until the tests are migrated
