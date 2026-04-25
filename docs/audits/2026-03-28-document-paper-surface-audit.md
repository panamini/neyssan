# Document Paper Surface Audit

Date: 2026-03-28

## Scope

Audit target:
- proposal preview
- CV preview
- letter preview
- document sheet / A4 preview
- print-like document surfaces
- pure white or paper-like backgrounds in those paths

Classification legend:
- active code
- legacy but informative
- obsolete/dead

## Active Code

| Path | Component / class / token | Surface type | Finding | Status |
| --- | --- | --- | --- | --- |
| `my-app/src/styles/foundation.css:221` | `--paper` | document paper | Dedicated paper token introduced as `#FAF9F5`. | changed |
| `my-app/src/styles/foundation.css:222` | `--proposal-document-paper` | document paper | Light theme document paper now resolves through `var(--paper)` instead of inheriting canvas. | changed |
| `my-app/src/styles/foundation.css:518-519` | `--paper`, `--proposal-document-paper` | document paper | Dark theme document paper now resolves through `var(--paper)` instead of inheriting raised surface. | changed |
| `my-app/src/styles/product.css:1061-1068` | `.dasti-proposal-sheet` | panel surface | Proposal viewer shell uses `var(--document-viewer-frame-surface)`. This is the panel/frame layer, not the paper. | unchanged |
| `my-app/src/styles/product.css:1517-1528` | `.dasti-doc-viewport--resume` | app canvas | Resume stage background mixes canvas and raised surface. This is the stage/canvas behind the page, not the page itself. | unchanged |
| `my-app/src/styles/product.css:1786-1793` | `.dasti-proposal-sheet__preview-page`, `.dasti-document-stage__canvas[data-document-page="true"]` | document paper | Shared proposal/resume page surface pulls from `var(--proposal-document-paper)`. | changed indirectly via token |
| `my-app/src/styles/product.css:1796-1807` | `.dasti-proposal-editor-page` | document paper | Editor page gradient still rides the document token, but its white mix now points at `var(--paper)`. | changed |
| `my-app/src/styles/product.css:1830-1831` | `.dasti-proposal-sheet__preview-page--editable` | document paper | Editable preview page background inherits the dedicated paper token. | changed indirectly via token |
| `my-app/src/styles/product.css:1898` | `.dasti-proposal-document__page` | document paper | Rendered proposal document page background inherits the dedicated paper token. | changed indirectly via token |
| `my-app/src/components/ProposalDisplay.tsx:1048-1054` | plain text preview body inline style | document paper | Plain preview / letter fallback block background inherits `var(--proposal-document-paper)`. | changed indirectly via token |
| `my-app/src/features/verbati/style.ts:121` | `NEUTRAL_THEME.surfaceRaised` | panel surface | Verbati raised surface remains `#ffffff`. This still feeds panel surfaces and must not be treated as paper. | unchanged, flagged |
| `my-app/src/features/verbati/style.ts:344-345` | `buildVerbatiThemeVars()` | document paper | Verbati proposal/resume document paper now resolves through `--paper` instead of reusing `surfaceRaised`. | changed |
| `my-app/src/features/verbati/style.ts:394-395` | `buildVerbatiProposalDocumentVars()` | document paper | Linked proposal document vars now resolve through `--paper` instead of reusing `surfaceRaised`. | changed |
| `my-app/src/components/cv-display/CvDocumentDisplay.tsx:44` | `CvDocumentDisplay` wrapper | panel surface | Legacy read-only CV display uses `var(--sfr)` as a card/panel container, not as document paper. | unchanged |
| `my-app/src/components/profile-review-modal/CVReviewerOverlay.tsx:43` | `CVReviewerOverlay` wrapper | panel surface | Reviewer overlay body uses `var(--sfr)` as modal chrome, not as document paper. | unchanged |
| `my-app/src/components/ImportCvPreviewModal.tsx:105` | `ImportCvPreviewModal` wrapper | panel surface | Import preview modal uses `var(--sfr)` panel chrome. | unchanged |
| `my-app/src/components/ImportCvPreviewModal.tsx:132-143` | section cards / block cards | panel surface | Import preview inner cards use `bg-muted/5` and `bg-background`; these are panel layers, not document sheets. | unchanged |

## Active White Surfaces Left Intact

These are active but were not changed because they are not the document-paper layer.

| Path | Component / token | Surface type | Why left alone |
| --- | --- | --- | --- |
| `my-app/src/features/verbati/style.ts:121` | `NEUTRAL_THEME.surfaceRaised = "#ffffff"` | panel surface | This is still the Verbati raised/panel token source. Replacing it would flatten panel hierarchy and violate the canvas/panel/document split. |
| `my-app/src/features/verbati/resume/resume-preview.css:114-120` | `.resume-preview-back` | panel surface | Back button chrome uses a mostly-raised-surface mix with `white 6%`; it is control chrome, not page paper. |
| `my-app/src/features/verbati/resume/ResumePage.tsx:2791` | photo frame fill | in-document content | Semi-transparent white photo plate inside the page content, not the page background. |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3681-3682` | circular photo frame border/fill | in-document content | White alpha framing inside the document layout, not the paper token. |
| `my-app/src/features/verbati/resume/ResumePage.tsx:3889-3896` | Quire avatar shell / inner fill | in-document content | Decorative white-alpha treatment inside the document layout, not the page background. |

## Legacy But Informative

| Path | Why it matters |
| --- | --- |
| `my-app/docs/SKILLS/SPACING/dasti_UI_SPEC/dasti-spec-v2.md:34` | Describes the intended model explicitly: document mode should read as white paper inside a darker frame. |
| `my-app/docs/SKILLS/SPACING/dasti_UI_SPEC/dasti-spec-v2.md:610` | Contains the older `.docpaper` concept and confirms paper is a distinct surface. |
| `my-app/docs/plans/2026-03-26-dasti-system-refonte-spec.md:493` | Notes that light mode should read as ivory / skin-paper rather than plain white. |

## Obsolete / Dead

| Path | Why it is not authoritative |
| --- | --- |
| `my-app/src/proposainputform.bak` | Backup file; excluded by project rules. |
| `my-app/src/components/ProfileReviewModal.tsx.bak` | Backup file with older Tailwind `bg-white` usage; not live. |
| `my-app/src/components/SuggestionBlock.tsx.bak` | Backup file with `bg-white`; not live. |
| `my-app/src/COLORPALETTE.HTML` | Standalone palette prototype, not runtime product code. |
| `my-app/src/COLORPALETTE2.HTML` | Standalone palette prototype, not runtime product code. |

## Result

- The active document-paper path is now dedicated instead of borrowing canvas or raised-surface tokens.
- Proposal preview, editable letter/document preview, and Verbati resume/proposal pages all inherit the same paper token.
- App canvas and panel surfaces remain unchanged.
