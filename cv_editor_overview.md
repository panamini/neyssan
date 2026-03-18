# CV Editor Project Overview

## Project Purpose:

The project is a React/TypeScript application for creating, editing, displaying, and reviewing CVs (Curriculum Vitae). It provides a user-friendly interface for managing CV sections, blocks, and structured content. The application also includes features for reviewing profiles and generating proposals.

## Core Components and Data Flow:

1.  **CV Editor:**
    *   The `CvEditor.tsx` component is the main entry point for the CV editing functionality.
    *   It uses components like `BlockEditor.tsx`, `BlockRenderer.tsx`, `Section.tsx`, and `SectionPanel.tsx` to manage the structure and content of the CV.
    *   The `types.ts` file in the `cv-editor` directory defines the data structures used for CV sections and blocks.
    *   The `RemirrorEditor.tsx` component, along with its `EditorToolbar.tsx` and `extensions`, provides a rich text editing experience for the CV content.
    *   Structured blocks like `SkillsBlock.tsx` and `SummaryBlock.tsx` provide pre-defined templates for specific CV sections.

2.  **CV Display:**
    *   The `CvDocumentDisplay.tsx` component is responsible for rendering the CV document in a visually appealing format.
    *   It uses components like `RichSummary.tsx` and `SectionDisplay.tsx` to display the CV sections and content.

3.  **Profile Review:**
    *   The `CVReviewerOverlay.tsx` component provides an overlay for reviewing the profile.
    *   It uses components like `ProfileReviewFooter.tsx`, `ProfileReviewForm.tsx`, and `ProfileReviewHeader.tsx` to manage the review process.

4.  **Data Flow:**
    *   The application uses React Context (`CvLibraryContext.tsx`) to manage the CV data.
    *   The CV data is structured according to the types defined in `src/types/cvDocument.ts` and `src/types/profile.ts`.
    *   The `StorageAdapter.ts` file handles the persistence of CV data to Convex and localStorage.
    *   The `convex` directory contains Convex functions for interacting with the backend.

## Directory Structure:

*   `src/components`: Contains the main React components for the application.
    *   `cv-editor`: Components for editing the CV.
    *   `cv-display`: Components for displaying the CV.
    *   `profile-review-modal`: Components for reviewing the profile.
    *   `remirror-editor`: Components for the Remirror editor.
    *   `structured-blocks`: Components for structured CV blocks.
*   `src/contexts`: Contains React Context providers for managing application state.
*   `src/hooks`: Contains custom React hooks for reusable logic.
*   `src/pages`: Contains the main pages of the application.
*   `src/types`: Contains TypeScript type definitions.
*   `src/utils`: Contains utility functions.
*   `convex`: Contains Convex functions for backend logic.

## Beginner-Friendly Guide:

Welcome to the CV Editor project! This guide will help you understand the project structure and how to get started with development.

### Step-by-Step Walkthrough of Main Features:

1.  **Editing a CV:**
    *   Navigate to the `CvForge.tsx` page. This is the main page for editing CVs.
    *   The `CvEditor.tsx` component will be rendered on this page.
    *   Use the `BlockEditor.tsx` and `SectionPanel.tsx` components to add, edit, and manage CV sections and blocks.
    *   Use the `RemirrorEditor.tsx` component to edit the content of each block.
    *   Experiment with different structured blocks like `SkillsBlock.tsx` and `SummaryBlock.tsx` to add pre-defined content.

2.  **Displaying a CV:**
    *   The `CvDocumentDisplay.tsx` component is used to display the CV in a visually appealing format.
    *   This component is likely used on a separate page or within a modal.

3.  **Reviewing a Profile:**
    *   The `ProfileReviewModal.tsx` component provides a modal for reviewing the profile.
    *   Use the `CVReviewerOverlay.tsx`, `ProfileReviewFooter.tsx`, `ProfileReviewForm.tsx`, and `ProfileReviewHeader.tsx` components to review the profile and provide feedback.

### Recommended Reading Order for Newcomers:

1.  `src/App.tsx`: This is the main entry point of the application. It defines the main routes and layout.
2.  `src/pages/CvForge.tsx`: This is the main page for editing CVs, accessible via the /cv route.
3.  `src/components/cv-editor/CvEditor.tsx`: This component manages the core CV editing functionality.
4.  `src/components/cv-editor/BlockEditor.tsx`: This component manages the blocks within a CV section.
5.  `src/components/remirror-editor/RemirrorEditor.tsx`: This component provides the rich text editing experience.
6.  `src/types/cvDocument.ts`: This file defines the data structures used for CV documents.
7.  `src/adapters/StorageAdapter.ts`: This file handles the persistence of CV data.

### Debugging Tips:

*   Use the `console.log` statement to debug the application and inspect the data.
*   Use the VS Code debugger to step through the code and identify issues.
*   Check the browser console for any error messages.
*   Use the `CvLibraryContext.tsx` to understand how the CV data is managed and shared across the application.
*   Look at the files in `src/components/dev` for debugging tools.

## Prioritized Essential Files:

1.  `src/pages/CvForge.tsx`: Main entry point for the CV editor.
2.  `src/components/cv-editor/CvEditor.tsx`: Core component for managing the CV editing interface.
3.  `src/components/cv-editor/BlockEditor.tsx`: Component for managing blocks within a CV section.
4.  `src/components/remirror-editor/RemirrorEditor.tsx`: Rich text editor component.
5.  `src/components/cv-display/CvDocumentDisplay.tsx`: Component for displaying the CV.
6.  `src/components/profile-review-modal/ProfileReviewModal.tsx`: Component for reviewing the profile.
7.  `src/types/cvDocument.ts`: Defines the data structures for CV documents.
8.  `src/adapters/StorageAdapter.ts`: Handles persistence of CV data to Convex and localStorage.

## Notes on Optional/Secondary Features:

*   Files with the `.bak` extension: These are likely backup files and not part of the working functionality.
*   Files with "legacy" in their name: These files might contain older code that is no longer used.
*   Files in the `src/components.bak.1756564393` directory: This directory seems to contain backup components.

It's important to focus on the files that are actively used in the application and skip these deprecated or non-functional parts.

## Detailed Architecture and Data Flow:

The CV editor project is structured around a central `CvState` object, which contains the entire CV document, including its sections and blocks. The `CvState` is managed by the `CvLibraryContext`, which provides functions for loading, saving, and updating the CV data.

The `CvEditor` component is the main entry point for the CV editing functionality. It receives the `CvState` from the `CvLibraryContext` and renders each section using the `SectionPanel` component.

The `SectionPanel` component allows adding, deleting, and reordering blocks within a section. It uses the `BlockEditor` component to render each block.

The `BlockEditor` component provides a basic editor for a single `CvBlock`. It uses the `RemirrorEditor` component for rich text editing.

The `RemirrorEditor` component is a controlled editor that receives sections from the parent component and emits changes through callbacks. It uses the `cv-section-node` extension to represent CV sections within the Remirror editor.

The `CvDocumentDisplay` component is used to render the CV document in a read-only format. It consumes the `CvLibraryContext.currentCv` and renders each section using the `SectionDisplay` component.

The `ProfileReviewModal` component provides an interface for reviewing and refining the extracted profile data. It uses the `CVReviewerOverlay`, `ProfileReviewHeader`, `ProfileReviewForm`, and `ProfileReviewFooter` components to manage the review process.

The data flow in the CV editor project can be summarized as follows:

1.  The `CvLibraryContext` loads the CV data from Convex or localStorage.
2.  The `CvEditor` component receives the `CvState` from the `CvLibraryContext`.
3.  The `CvEditor` component renders each section using the `SectionPanel` component.
4.  The `SectionPanel` component renders each block using the `BlockEditor` component.
5.  The `BlockEditor` component uses the `RemirrorEditor` component for rich text editing.
6.  When the user makes changes to the CV data, the `RemirrorEditor` component emits callbacks to the `BlockEditor` component.
7.  The `BlockEditor` component updates the `CvState` in the `CvLibraryContext`.
8.  The `CvLibraryContext` persists the updated CV data to Convex and localStorage.
9.  The `CvDocumentDisplay` component receives the updated `CvState` from the `CvLibraryContext` and re-renders the CV document.