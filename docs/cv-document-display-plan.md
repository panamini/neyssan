# Implementation Plan: CvDocumentDisplay Component (V4 - Final)

This document is the definitive plan for the `CvDocumentDisplay` component, incorporating all previous feedback.

## 1. Core Principles

-   **Context-Driven**: The component will be a pure consumer of `CvLibraryContext`, rendering the `currentCv` and using context actions for all mutations.
-   **Component Reuse**: It will leverage the existing `BlockRenderer` and `SelectedBlockInspector` to maintain UI and functional consistency.
-   **Schema-Accurate UI**: The rendered output for each block type will accurately reflect the fields defined in `cvDocument.schema.ts`.
-   **Solve Collapsed View**: The `BlockRenderer` will be enhanced to show a rich, informative summary for collapsed Experience and Education items.

## 2. Architecture

The architecture relies on the existing `CvLibraryProvider` to manage state. `CvDocumentDisplay` consumes this state and orchestrates rendering via `SectionDisplay` and the enhanced `BlockRenderer`.

```mermaid
graph TD
    subgraph "Existing Context & State"
        A[CvLibraryProvider] --> B(currentCv);
        A --> C(Actions: openInspector, updateStructuredItem, etc.);
        A --> D(Logic: flushPendingEdits);
    end

    subgraph "New Display Surface"
        E[CvDocumentDisplay] -- uses --> B;
        E --> F[SectionDisplay];
        F --> G[BlockRenderer (Enhanced)];
    end
    
    subgraph "Interaction Flow"
       G -- onClick --> C;
       H[SelectedBlockInspector] -- triggered by --> C;
       H -- onSave respects --> D;
    end
```

## 3. Detailed Implementation Steps

1.  **Scaffolding**:
    *   Create `my-app/src/components/cv-display/CvDocumentDisplay.tsx`.
    *   Create `my-app/src/components/cv-display/SectionDisplay.tsx`.
    *   Create `my-app/src/components/cv-display/RichSummary.tsx` for the collapsed view.

2.  **`CvDocumentDisplay` & `SectionDisplay`**:
    *   These will be simple mapping components as previously planned, responsible for iterating over `currentCv.sections` and `section.blocks`. Their sole purpose is to pass data down to the `BlockRenderer`.

3.  **Enhance `BlockRenderer.tsx`**:
    *   This component will contain the primary new logic.
    *   It will use a `useMemo` hook to find the `linkedItem` from `currentCv.sections.structuredContent` using `block.attributes.linkedStructuredId`. This is a performance consideration.
    *   **Conditional Rendering**:
        *   If the block is collapsed and a `linkedItem` is found, it will render the new `<RichSummary item={linkedItem} sectionType={section.type} />` component.
        *   If the block is expanded, it will render its `Remirror` content as it does now.
        *   If it's a simple block with no `linkedItem`, it will behave as it currently does.

4.  **`RichSummary.tsx` - Schema-Driven UI**:
    *   This component will receive the `item` (e.g., `IExperienceItem` or `IEducationItem`) and `sectionType`.
    *   It will render specific fields based on the `sectionType`, ensuring the UI matches the schema:
        *   **If `sectionType` is `experience`**:
            *   **Job Title**: `item.position`
            *   **Company**: `item.company` & `item.location`
            *   **Dates**: Formatted `item.startDate` - `item.endDate` (or "Present").
        *   **If `sectionType` is `education`**:
            *   **Degree**: `item.degree` & `item.fieldOfStudy`
            *   **Institution**: `item.institution`
            *   **Dates**: Formatted `item.startDate` - `item.endDate`.
        *   **If `sectionType` is `summary`**:
            *   This is a special case. The component will render fields like `item.name`, `item.email`, `item.phone`, and links for `item.linkedin`, `item.github`, etc.
    *   The component will handle missing fields gracefully (e.g., not rendering a date if `item.startDate` is null).

5.  **Flush & Mutation Verification**:
    *   As a dedicated step, I will inspect the "Save" function inside `SelectedBlockInspector`. I will add logging to verify that `flushPendingEdits()` is called *before* `updateStructuredItem`. This guarantees that any concurrent edits are persisted before the inspector's changes are applied.

6.  **Integration & Testing**:
    *   The new `CvDocumentDisplay` will be integrated into `CvForge.tsx`, wrapped inside the `CvLibraryProvider`.
    *   A comprehensive test will be performed:
        1.  Load a CV with all section types.
        2.  Verify the `contact` / `summary` section displays correctly.
        3.  Collapse an `experience` item and verify its rich summary.
        4.  Click "Edit", modify data in the inspector, and save.
        5.  Verify the `CvDocumentDisplay` updates instantly and correctly, proving the entire context-driven loop is working.
