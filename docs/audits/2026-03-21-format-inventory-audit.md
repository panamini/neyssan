# Format Inventory Audit

Date: 2026-03-21

## Scope
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvsLibrary.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalsLibrary.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/ProfileModal.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/SummaryModal.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/ExperienceEducationModal.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/AchievementsModal.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/SkillsModal.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/LanguagesModal.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/SectionEditor.tsx`

## Format Inventory

### 1. CV Forge page canvas

- Page shell:
  - max width: `960px`
  - layout: single column
  - spacing: `var(--space-panel-stack)`
  - source: `CvForge.tsx`

This is a page canvas, not a card format.

### 2. Section cards inside CV Forge

Active shell:
- class: `.section-container`
- width: fluid / full available width
- height: content-driven
- radius: `var(--rm)`
- background: `var(--sfr)`
- no explicit aspect ratio
- source: `globals.css`

Used by:
- Summary
- Profile
- Experience
- Education
- Achievements

Implication:
- there is no stable card ratio here
- these are vertical content containers, not fixed-format cards

Subformats inside this family:

- Summary collapsed:
  - no fixed height
  - text preview only
- Profile expanded:
  - no fixed card ratio
  - has a photo tile at `var(--s8)` × `calc(var(--s8) + var(--s4))`
  - effectively `64 × 80`
- Experience / Education:
  - no fixed height
  - structured list stack or block-rendered stack
- Achievements:
  - no fixed height
  - stacked lines

Conclusion:
- this family is coherent as a "content section" family
- it is not yet a ratio-based card family

### 3. Shared modal family

Active shell:
- class: `.dasti-modal`
- width: `100%`
- max width: `720px`
- max height: `90vh`
- radius: `var(--rl)`
- layout: scrollable dialog, content-driven height
- source: `globals.css`

Used by:
- ProfileModal
- SummaryModal
- ExperienceModal
- EducationModal

Parallel but slightly separate shells:
- AchievementsModal: `w-full max-w-2xl max-h-[90vh]`
- SkillsModal: `w-full max-w-2xl max-h-[90vh]`
- LanguagesModal: `w-full max-w-2xl max-h-[90vh]`

Notes:
- `max-w-2xl` is effectively close to the `720px` family
- these are almost one single modal format already

### 4. Proposal compose / generated / saved document sheet family

Shared sheet:
- class: `.dasti-proposal-sheet`
- width: `min(100%, 560px)`
- aspect ratio: `1 / 1.41421356`
- min height: `420px`
- max height: `min(72vh, 780px)`
- radius: `var(--rm)`
- source: `globals.css`

This is the clearest ratio-based format in the app:
- portrait document sheet
- explicitly root-2 / A4-like

Used by:
- generated proposal in `ProposalDisplay`
- saved proposal editor in `ProposalsList`

Composer variant:
- class: `.dasti-proposal-sheet--composer`
- width: `100%`
- aspect ratio: `auto`
- height: `clamp(300px, 44vh, 520px)`
- min height: `300px`
- max height: `min(58vh, 520px)`

So currently:
- generated/saved document = stable portrait sheet family
- composer = flexible writing well, not ratio-bound

### 5. Proposal Forge split panels

Outer panel shell:
- class: `.dasti-surface-panel`
- no explicit aspect ratio
- content-driven
- radius: `var(--rl)`
- source: `globals.css`

Compose view layout:
- desktop: `1fr 1fr`
- compact: `1 column`
- gap: `var(--space-split-gap)`
- page max width: `1200px` desktop, `1000px` narrow laptop, `720px` compact
- source: `ProposalForge.tsx`

This means:
- the panel shells are not the document format
- the real format sits inside them (`.dasti-proposal-sheet`)

### 6. Saved proposals view

Split layout in `ProposalsList`:
- desktop columns: `260px 1fr`
- compact: `1 column`
- gap: `var(--s5)`

Left title/meta card:
- not a standalone ratio card
- it is a fixed-width metadata rail
- width: `260px`
- height: content-driven
- title editor uses `rows={2}` but the panel itself is still variable-height

Right content panel:
- fluid width
- contains the same `dasti-proposal-sheet` family as generated proposal

Conclusion:
- saved proposal title panel is a rail, not a card format
- this is one of the places where a canonical horizontal format is still missing

### 7. Library cards

Shared shell:
- class: `.dasti-doc-card`
- width: `100%`
- min height: `calc(var(--s8) + var(--s3))`
- current min height resolves to `76px`
- no max height
- no aspect ratio
- source: `globals.css`

Library grids:
- `Resume Library`: `repeat(auto-fill, minmax(280px, 1fr))`
- `Proposal Library`: `repeat(auto-fill, minmax(280px, 1fr))`

Implication:
- width is bounded by the grid
- height is still content-driven
- cards with 1-line titles and cards with 2-line titles can diverge vertically

This is the specific issue visible right now.

### 8. Resume chooser cards

Shell:
- class: `.dasti-doc-card--chooser`
- grid columns: `minmax(0, 1fr) auto`
- mobile: collapses to one column under `620px`
- no explicit aspect ratio
- no stable fixed height

Dialog container:
- `Dialog` class `max-w-2xl`

Conclusion:
- chooser cards belong to the document-card family
- but they are currently a functional variant, not a stable format

## State of the hierarchy today

There is already a partial hierarchy, but it is incomplete:

### Strong / clear formats

1. Portrait document sheet
   - `560px`
   - A4 / root-2
   - generated proposal / saved proposal body

2. Modal shell
   - `max-width 720px`
   - scrollable, content-driven
   - fairly consistent already

### Weak / unstable formats

3. Document cards
   - libraries
   - chooser
   - saved title rail
   - currently width-bounded but height not normalized

4. CV Forge section cards
   - treated as containers
   - no ratio system yet
   - probably should remain content containers, not be forced into document-card ratios

## Recommendation

For a cleaner hierarchy, keep only 3 main format families:

### A. Document sheet

- portrait
- root-2 / A4
- use for generated / saved document content

### B. Document card

- landscape
- fixed or tightly bounded height
- use for libraries and chooser
- width can stay responsive (`minmax(280px, 1fr)`), but height should be normalized

Most plausible target:
- fixed height or min/max bounded height in the `190–230px` band
- plus a reserved 2-line title slot

The key idea is:
- do not let total card height depend on title wrapping
- reserve the title block height even when the title fits on one line

### C. Content section / modal container

- no strict aspect ratio
- content-driven vertical growth
- use for CV Forge section cards and edit modals

## Smallest high-impact next change

Normalize the library card title area instead of trying to ratio-ize everything at once.

That means:
- reserve a fixed 2-line title slot
- then set a stable card height for library cards
- keep chooser as a variant of the same height family

This would solve the visible mismatch immediately without forcing CV Forge section cards into an artificial ratio system.
