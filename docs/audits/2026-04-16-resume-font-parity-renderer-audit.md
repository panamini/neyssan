# Resume Font Parity Renderer Audit

## Root cause

The first broken boundary was in the active one-column renderer branch:

- file: `my-app/src/features/verbati/resume/ResumePage.tsx`
- component: `SwissMinimaPage`

`SwissMinimaPage` mounted the page root on `var(--font-heading-family)` and also styled the dominant summary/body probe with `var(--font-heading-family)`. That caused distinct typography presets to collapse visually in both preview and `/print/resume`, even though state, persistence, theme-var generation, and print payload wiring were already aligned.

## Exact broken boundary

The live chain before the fix was:

`stylePreset.typography`
-> `resolveVerbatiFontPairId(...)`
-> `buildVerbatiThemeVars(...)`
-> correct `--font-heading-family` and `--font-body-family`
-> preview and print roots both received those vars
-> `SwissMinimaPage` body content still consumed `var(--font-heading-family)`

That made one-column preview and print appear frozen on the same font character.

## Fix

The Swiss branch was corrected in `ResumePage.tsx` by:

- moving the page root/article font family back to `var(--font-body-family)`
- marking the Swiss heading probe on the actual name heading
- moving the Swiss body probe back to `var(--font-body-family)`
- keeping the main experience role heading on `var(--font-heading-family)`

No fallback renderer, export-only override, or persistence workaround was added.

## Robial / two-column outcome

Robial was re-checked after the Swiss fix.

- preview/print theme vars still change with typography preset changes
- Robial selectors in `resume-preview.css` still route headings/body copy to the shared vars
- no second Robial branch-local font-family fix was required from the current checkout

If Robial parity regresses later, treat it as a separate renderer-consumption bug rather than reopening persistence or export payload wiring by default.

## Fastest checks

1. Preview debug route:
   - `/debug/resume-font-parity?layout=swiss&typography=quiet-editorial`
   - `/debug/resume-font-parity?layout=swiss&typography=mono-signal`
   - `/debug/resume-font-parity?layout=two-column&typography=quiet-editorial`
   - `/debug/resume-font-parity?layout=two-column&typography=mono-signal`
2. In the browser console inspect:
   - `window.__DASTI_RESUME_FONT_PARITY_STATUS__`
   - `window.__DASTI_RESUME_PRINT_STATUS__`
3. Confirm:
   - `fontHeadingCssVar` / `fontBodyCssVar` match the selected preset
   - Swiss `headingFontFamilyComputed` and `bodyFontFamilyComputed` consume different shared vars
   - Robial heading/body selectors still point at the shared vars in `resume-preview.css`

## Tests that cover this

- `my-app/src/features/verbati/resume/__tests__/ResumePage.test.tsx`
- `my-app/src/features/verbati/resume/__tests__/resume-preview.css.test.ts`
- `my-app/src/pages/__tests__/ResumePrintPage.test.tsx`
