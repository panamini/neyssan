CvDocumentDisplay V4 Plan (Final)

Core Principles:

Context-Driven – Only consumes CvLibraryContext (currentCv) and uses context actions; no local state.

Component Reuse – Uses BlockRenderer and SelectedBlockInspector to maintain consistent UI.

Schema-Accurate UI – Each block type renders fields defined in cvDocument.schema.ts.

Collapsed View Handling – Collapsed Experience and Education blocks render rich summaries via RichSummary.tsx.

Architecture:

CvLibraryProvider manages state (currentCv and actions like updateStructuredItem, flushPendingEdits).

CvDocumentDisplay → renders sections via SectionDisplay → renders blocks via BlockRenderer.

BlockRenderer enhanced to:

useMemo lookup of linkedItem from currentCv.sections.structuredContent.

Conditional rendering: collapsed blocks → RichSummary, expanded → Remirror editor.

Detailed Steps:

Scaffolding: Create CvDocumentDisplay.tsx, SectionDisplay.tsx, RichSummary.tsx.

Mapping Components: CvDocumentDisplay and SectionDisplay iterate over currentCv.sections and section.blocks.

BlockRenderer Enhancements: Render RichSummary for collapsed blocks with linkedItem.

RichSummary.tsx: Schema-driven UI for experience, education, and summary/contact.

Flush Verification: Ensure flushPendingEdits() runs before updateStructuredItem in SelectedBlockInspector.

Integration & Testing:

Wrap CvDocumentDisplay in CvLibraryProvider.

Test collapsed summaries, edits, and immediate context-driven updates.

Optional Notes:

Performance: For very large documents, consider building a sectionId -> Map(linkedId → item) once per currentCv update for faster lookup.

Styling: Tailwind classes for collapsed summaries; dark mode handled.

Testing: Unit tests for RichSummary and edge cases.