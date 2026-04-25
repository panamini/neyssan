# Proposal-Next Template System And CV Simplification

## Scope

- `proposal-next` now owns CV attachment in one place only: the artifact inspector.
- Explicit `Local / Linked` UI was removed from `proposal-next` and Settings.
- Template selection, typography override, layout override, palette override, and custom accent now form the proposal-local visual refinement stack.
- Proposal title is now editable as a proposal artifact title, separate from the job title.
- Saved proposal rename was added to sidebar and library surfaces.

## Precedence Model

The active proposal render state now resolves in this order:

1. `customAccentHex`
2. `paletteOverride`
3. `typographyOverride`
4. `layoutOverride`
5. `templateBundleId`
6. attached CV baseline
7. Settings bundled default
8. app default bundled style

## Notes

- Attaching or replacing a CV clears local visual overrides and uses the CV as the new baseline.
- Removing a CV clears the CV baseline and restores Settings defaults, falling back to the app default bundled style when Settings are absent.
- Settings remain bundled-default only in this pass. Separate typography/layout defaults are deferred.
- Saved proposal render metadata and local draft storage now persist:
  - `templateBundleId`
  - `typographyOverride`
  - `layoutOverride`
  - merged `verbatiStyle` including palette/custom accent

## Verification

- `npx tsc --noEmit --pretty false`
- `npx vitest run src/lib/__tests__/proposal-voice-label.test.ts src/lib/__tests__/proposal-output-draft.test.ts src/lib/__tests__/proposal-render-state.test.ts`
