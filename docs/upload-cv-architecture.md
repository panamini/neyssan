
Unified CV Editor + Upload / Import Architecture

This document contains a unified Mermaid diagram that combines the current CV editor architecture, the flush/edit stabilization logic, the normalized CvDocument flow, and the optional upload/import paths. It also includes a simplified, reviewer-friendly diagram and short action items for implementation.

Full architecture (detailed)
```mermaid
flowchart TD
    %% Start of user interaction
    A[User Action] -->|Open CV Editor| B[Sidebar / CV List]

    %% CV selection
    B -->|Select CV| C[Load CV from Storage / Remote]
    B -->|Click Upload| D[UploadCvButton]
    D -->|Parse file| E[useCvParser]
    E -->|Generate CvDocument| F[normalizeCvDocument]
    F -->|Validated CV| C

    %% Load & normalization
    C -->|Loaded document| G[CV Library Context (CvLibraryContext)]
    G --> H{safeSetCurrentCv}
    H -->|Document differs| I[Update currentCv state]
    H -->|Document identical| J[Skip state update]

    %% Section / block operations
    I --> K[SectionEditor Component]
    I --> L[BlockEditor Component]

    %% Local buffering and flushing
    K -->|localTitle + Remirror content| M[flushPendingEdits]
    L -->|localBlockTitle| M

    %% Structural mutations
    M -->|Add Block / Section| N[Update CV Document in Context]
    N --> O[Debounced Autosave to LocalStorage]
    O --> P[Optional remote sync / persist]

    %% Feedback loop
    K -->|Typing| K
    L -->|Typing| L

    %% Optional future features
    P --> Q[Zod Validation (post-parser safety)]
    Q --> R[Prevent malformed uploads / imports]

    %% Notes
    classDef optional fill:#f9f,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5;
    class Q,R optional;
```

Reviewer-friendly simplified view
```mermaid
flowchart LR
  UI[User UI] --> Upload[UploadCvButton]
  UI --> Library[CV Library (CvLibraryContext)]
  Upload --> Parser[useCvParser -> normalizeCvDocument]
  Parser -->|zod validate| Library
  Library --> Editor[SectionEditor / BlockEditor]
  Editor -->|local buffers| Flush[flushPendingEdits]
  Flush --> Mutations[addBlock / addSection / reorder]
  Mutations --> Autosave[Debounced autosave & local cache]
  Autosave --> Remote[Optional remote persist via StorageAdapter]
```

Key file references (where to look / modify)
- Flush registration & context actions: [`my-app/src/contexts/CvLibraryContext.tsx`]
- Section editor + Remirror wiring: [`my-app/src/components/SectionEditor.tsx:124`]
- Block renderer (block-level editor): [`my-app/src/components/cv-editor/BlockRenderer.tsx:85`]
- Upload parser/hook: [`my-app/src/components/UploadCvButton.tsx:33`] and hook [`my-app/src/hooks/useCvParser.ts`]
- Conversion utilities (normalize -> Remirror JSON): [`my-app/src/components/remirror-editor/utils/conversion.ts:231`]
- Storage adapter + Zod validation entrypoint: [`my-app/src/adapters/StorageAdapter.ts:100`]

Design notes and rationale
- Keep the Library Context as the single source of truth for the canonical CvDocument (see safeSetCurrentCv). This prevents unnecessary re-renders by doing deep-equality checks before swapping `currentCv`.
- Editors (both SectionEditor and BlockRenderer) keep local buffers for titles and avoid emitting on every keystroke. They register a flush callback with the context so that structural mutations call `flushPendingEdits()` to atomically persist buffered fields before mutating the document structure.
- Debounced autosave ensures the backend isn't overwhelmed and keeps a localStorage cache as a rescue fallback.
- Upload/Import pipeline:
  - UploadCvButton delegates parsing to `useCvParser`.
  - The parser normalizes into `CvDocument` shape.
  - Apply Zod validation (post-parser) with the same schema used in the storage adapter (`parseCvDocumentStrict`) before calling `safeSetCurrentCv`.
  - On valid parses, call `createCvFromState` or `safeSetCurrentCv` to load into editor; otherwise show a graceful validation error in the UI.
- Logging: conversion tracing has an opt-in flag (`ENABLE_CONVERSION_TRACE`) to avoid noisy logs in normal use, but allow local debugging.

Actionable next steps (implementation)
1. Implement Upload flow safety (post-parser Zod validation):
   - Validate `CvDocument` produced by `useCvParser` with `parseCvDocumentStrict` (same schema used in storage adapter).
   - On validation failure show user-friendly errors and fallback to manual mapping UI.
   - File locations: [`my-app/src/components/UploadCvButton.tsx`], [`my-app/src/hooks/useCvParser.ts`].

2. Add test coverage for the critical flow:
   - Manual checklist created (docs/editor-stability-checklist.md).
   - Add an automated Playwright test for "type without blur → add block".

3. Monitor autosave behavior:
   - Ensure scheduleSave uses DEBOUNCE_MS constant and respects pending save promise to avoid races.

4. UX improvements (future):
   - Integrate UploadCvButton into Sidebar (non-destructive add).
   - Provide import preview and "accept mapped sections" workflow.

If you want, I will:
- Produce a simplified “PM-friendly” one-slide diagram (fewer nodes, highlighting stable vs optional) — I can add it to this doc.
- Implement the Upload pipeline Zod validation inside `useCvParser` and wire `UploadCvButton` to show validation feedback (non-destructive).
- Add the Playwright e2e test and an npm script test:e2e.

Please tell me which of the three you'd like next:
- Add simplified diagram (doc update).
- Implement parser-level Zod validation (code change).
- Add Playwright e2e and npm script (test change).
</result>
</attempt_completion>