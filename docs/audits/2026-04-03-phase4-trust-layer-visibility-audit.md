# Phase 4 Trust Layer Visibility Audit

Date: 2026-04-03

## Scope

- Audit why the Phase 4 trust-layer text is not visible in CV Forge.
- No implementation changes.

## Findings

### 1. The Phase 4 text is gated entirely by `inspectCvImportSignals(currentCv)`

Active code:

- `ProfileReviewCard` computes `importSignals` from `inspectCvImportSignals(currentCv)`.
- The banner only renders when `importSignals.length > 0` and the banner has not been dismissed.
- The detailed inline review list only renders when `importSignals.length > 0`.

Relevant code:

- `my-app/src/components/ProfileReviewCard.tsx:212-214`
- `my-app/src/components/ProfileReviewCard.tsx:603-618`

Consequence:

- If the detector returns `[]`, none of the Phase 4 copy appears.
- This is true even if the preview pane visually shows resume text.

### 2. The CV preview text is not the trust layer source of truth

Active code:

- `VerbatiCvPreviewPanel` falls back to `resumeMock` whenever the current CV does not produce renderable resume data.
- In that case, the preview can still show document text even when the actual CV sections are empty or incomplete.

Relevant code:

- `my-app/src/features/verbati/VerbatiCvPreviewPanel.tsx:46-65`

Consequence:

- Seeing text on the right preview does not mean Phase 4 should disappear.
- The preview text and the trust-layer signals come from different sources.

### 3. The banner text is also session-dismissable

Active code:

- `ProfileReviewCard` stores the current signal signature in `sessionStorage`.
- If the same CV id and same signal set were dismissed earlier in the session, the banner text stays hidden.
- The inline review list is not suppressed by dismissal, only the banner.

Relevant code:

- `my-app/src/components/ProfileReviewCard.tsx:216-234`
- `my-app/src/components/ProfileReviewCard.tsx:603-607`

Consequence:

- One possible state is:
  - signals exist
  - banner text is hidden
  - detailed inline review still exists

### 4. For the screen you showed, the missing Phase 4 surface means the detector is likely not seeing a suspicious `currentCv`

Because the screenshot-like state shows a mostly blank imported CV, at least one of these signals should normally exist:

- `document-title-generic`
- `document-template-skeleton`

Relevant detector rules:

- `my-app/src/lib/cv-import-signals.ts:225-235`
- `my-app/src/lib/cv-import-signals.ts:276-290`

So if you see no Phase 4 text at all in that state, the root-cause chain is likely one of:

1. `currentCv.title` is not actually the generic title the UI label suggests.
2. `currentCv` reaching `ProfileReviewCard` is not the same effective document state the preview is showing.
3. The current CV data is populated enough to suppress skeleton detection, even though the editor still looks visually sparse.

## Conclusion

The core root cause is architectural, not CSS:

- The Phase 4 trust layer is driven only by `inspectCvImportSignals(currentCv)`.
- The visible preview text in CV Forge can come from `resumeMock` instead.

That means the Phase 4 copy can be absent while the preview still looks populated. The audit does not show a missing mount point or missing stylesheet. It shows a data-path mismatch between:

- the trust-layer detector source: `currentCv`
- the visible preview source: `currentCv` or `resumeMock`

## Highest-value next check

Inspect the live `currentCv` object on the failing screen and compare:

- `currentCv.title`
- `currentCv.sections`
- `inspectCvImportSignals(currentCv)`
- whether the preview is using active data or `resumeMock`

Without that runtime capture, the strongest confirmed root cause is the source mismatch above.
