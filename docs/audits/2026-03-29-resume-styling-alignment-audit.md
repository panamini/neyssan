# Resume Styling Alignment Audit

Date: 2026-03-29

Scope:
- resume editing workbench at `/cv`
- resume styling workbench at `/style`
- shared resume preview surface and shared style state
- alignment target: apply the proposal chrome cleanup patterns to resume styling
- explicit exclusion: resume does not need proposal tone-of-voice controls

## Active Code

- `src/pages/CvForge.tsx`
  Active resume workbench route for `/cv`. It owns the split layout between the resume editor and the live preview panel.
- `src/features/verbati/VerbatiCvPreviewPanel.tsx`
  Active live resume preview and style-persistence surface used inside `/cv`. It persists style changes back into the active CV metadata and renders the shared preview.
- `src/components/EmbeddedStyleInspector.tsx`
  Active reusable style control surface for resume styling. It currently owns layout, typography, palette, and optional command controls, but uses older form/pill UI rather than the newer proposal chrome.
- `src/features/verbati/VerbatiResumePreview.tsx`
  Active shared resume document surface. This is the strongest existing shared boundary for resume rendering.
- `src/features/verbati/resume/resume-preview.css`
  Active resume-specific preview styling for the rendered page/frame/comparison cards.
- `src/features/verbati/style.ts`
  Active shared style authority for resume and proposal render state.
- `src/styles/product.css`
  Active shared document-shell, viewer, toolbar, and token surface already used by both proposal and resume rendering.
- `src/pages/StyleForge.tsx`
  Active route wrapper for the styling workbench at `/style`.
- `src/features/verbati/VerbatiStyleWorkspace.tsx`
  Active styling workbench. It still contains a second resume styling UI with its own inline layout/type/color controls and a custom accent override path.

## Legacy But Informative

- `src/pages/CvsLibrary.tsx`
  Active library/index page for resumes, but not a styling surface. Informative for routing and entrypoints only.
- `src/features/verbati/VerbatiCvPreviewPanel.tsx` stacked/rail variants
  Still active, but mainly informative for how the resume preview has already been embedded in multiple page contexts.

## Obsolete Or Non-Authoritative

- `pdf-ingest/`
- legacy spaCy / training-oriented parser code
- backup and archive trees
- `*.bak` files

These remain non-authoritative per project instructions and were not used for architecture decisions.

## Findings

### 1. The shared resume document surface already exists

- `VerbatiResumePreview` is already the correct shared render boundary.
- It already uses shared document-shell primitives from `product.css`, including:
  - `dasti-doc-viewer-shell`
  - `dasti-proposal-sheet-frame`
  - `dasti-proposal-sheet`
  - `dasti-document-rail`
- This is the direct equivalent of the proposal-side `ProposalDisplay` role.

### 2. Resume styling controls are duplicated across two active pages

- `/cv` styles resumes through `EmbeddedStyleInspector` inside `VerbatiCvPreviewPanel`.
- `/style` styles resumes through custom inline controls inside `VerbatiStyleWorkspace`.
- Both surfaces ultimately mutate the same conceptual state:
  - layout
  - typography
  - palette
  - optional custom accent
- This is the main divergence that should be cleaned up next.

### 3. `/style` is active, but overlapping

- `StyleForge` is not dead code.
- It adds real behavior that `/cv` does not currently provide:
  - comparison mode
  - explicit resume/proposal render switching
  - exploratory style browsing workflow
- The problem is not that `/style` should be deleted blindly. The problem is that its resume-side control UI should stop diverging from the shared resume styling control system.

### 4. `EmbeddedStyleInspector` is the cleanest migration seam

- It is already reusable and already used in `/cv`.
- It already excludes tone/voice concepts.
- It already models the right resume styling axes:
  - style bundle
  - layout
  - typography
  - palette
- It is therefore a better consolidation seam than the current hand-built controls inside `VerbatiStyleWorkspace`.

### 5. Resume should inherit proposal chrome patterns selectively

- The proposal cleanup introduced useful chrome patterns that do apply to resume:
  - shared toolbar shell
  - shared drawer layering
  - shared tooltip suppression rules when drawers are open
  - shared spacing/radius hierarchy
  - shared document-surface anchoring discipline
- The tone cluster does not apply to resume and should not be ported.

### 6. Resume still has an older advanced color path

- `VerbatiStyleWorkspace` still exposes a custom accent override directly in its own control stack.
- That path does not yet use the cleaner proposal-style minimal picker behavior.
- If resume keeps custom accent at all, it should adopt the proposal-side simplified picker behavior rather than preserving the older inline override flow.

### 7. The likely target architecture is modular, not page-unified

- Keep separate page wrappers:
  - `CvForge` for live editing
  - `StyleForge` for exploratory style comparison
- Share the two key internals:
  - one shared resume surface module (`VerbatiResumePreview`)
  - one shared resume appearance control module (likely evolved from `EmbeddedStyleInspector`)
- Reuse one shared CSS chrome contract instead of page-specific toolbar styling.

## Architecture Recommendation

Preferred end state:

- Shared resume surface:
  - `VerbatiResumePreview`
- Shared resume appearance control:
  - evolve `EmbeddedStyleInspector` into the shared resume appearance toolbar/inspector
- Shared resume chrome contract in CSS:
  - reuse `product.css` toolbar, drawer, tooltip, radius, and spacing rules already proven on proposal
- Keep page-specific wrappers separate:
  - `CvForge`
  - `StyleForge`

Do not copy proposal tone controls into resume.
