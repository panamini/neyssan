# CvForge Typography Consistency Audit

Date: 2026-03-21

## Scope

Audit focused on the active `CvForge` rendering paths to identify where typography and spacing still diverge between blank sections and imported/linked previews.

## Classification

- Active code:
  - `src/components/SectionEditor.tsx`
  - `src/components/cv-editor/BlockRenderer.tsx`
  - `src/components/cv-display/RichSummary.tsx`
  - `src/components/cv-display/ReadOnlyRichDoc.tsx`
  - `src/styles/globals.css`
- Legacy but informative:
  - `src/components/cv-editor/Section.tsx` re-export only
  - `src/components/cv-display/SectionDisplay.tsx` because it still routes through `BlockRenderer`
- Obsolete/dead:
  - `src/components/cv-editor/Section.legacy.tsx`

## Current State

### Stable

- `Experience` and `Education` header rows now share the same visual primitives across blank and imported states:
  - `cv-entry-summary`
  - `cv-entry-title`
  - `cv-entry-subtitle`
  - `cv-entry-date`
- Read-only rich responsibilities now have a dedicated renderer:
  - `ReadOnlyRichDoc`
  - `cv-rich-preview`

### Still Divergent

1. `Summary` and `Profile` preview surfaces still use local Tailwind utility classes in `SectionEditor.tsx`.
   - Examples:
     - `text-lg font-semibold`
     - `text-sm`
     - `text-base font-semibold`
   - Result: they do not fully share the same tokenized hierarchy as imported/linked previews.

2. `RichSummary.tsx` contact rendering still uses hardcoded utility classes instead of the shared `cv-entry-*` system.
   - This is not currently the most visible mismatch, but it keeps the system inconsistent.

3. Section headers in `SectionEditor.tsx` still rely on repeated local heading classes.
   - Example: `h3.text-lg.font-semibold`
   - A dedicated shared heading class already exists in CSS:
     - `cv-section-heading`

4. `ReadOnlyRichDoc` and `achievements-display` share paragraph metrics in CSS, which is good, but the surrounding containers in `SectionEditor.tsx` still vary in padding and stack rhythm between section types.

## Likely Minimal-Impact Next Steps

### Step 1

Replace repeated section heading utilities in `SectionEditor.tsx` with `cv-section-heading`.

Expected impact:
- low risk
- immediate typography consistency across `Summary`, `Profile`, `Experience`, `Education`, `Achievements`

### Step 2

Create one shared preview text stack for blank `Summary` / `Profile` collapsed states.

Expected impact:
- medium visual gain
- low behavioral risk

### Step 3

Refactor contact rendering in `RichSummary.tsx` to shared semantic classes instead of local Tailwind utilities.

Expected impact:
- moderate system consistency
- low user-facing urgency

## Recommendation

Do not reopen `Experience` parsing or preview architecture in this pass. The most efficient next move is a typography-only cleanup in `SectionEditor.tsx`, starting with shared section headings and shared preview text stacks.
