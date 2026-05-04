# CV forge edit-mode audit

Date: 2026-04-30

Scope: PR4 CV forge only. Active code is `my-app/src/pages/CvForge.tsx`, `my-app/src/components/cv/CvRail.tsx`, `my-app/src/components/cv/SectionEditorSheet.tsx`, and the old typed editor surfaces under `my-app/src/components/structured-blocks/`.

## Confirmed active behavior

- Edit mode renders the document-first CV forge frame and the same `VerbatiResumePreview` paper surface used for preview rendering.
- The paper is a focus/selection target, not a typed editor surface yet.
- Structured edits currently happen through `SectionEditorSheet`.
- Summary, Experience, Education, Skills, Languages, Achievements, Hobbies, and generic text sections already have safer structured update paths than direct paper mutation.
- `FloatingAiToolbar` exists and is proven in old editor/modal flows, but it is not wired into the PR4 CV paper surface.

## Feasibility

Direct paper editing is feasible as a staged PR4 follow-up, but not as one all-section pass.

Safe first pass:

- Summary, text, and custom sections can become paper-editable first.
- These should write through the same section update helpers used by `SectionEditorSheet`, not a parallel paper-only state path.
- The floating toolbar can attach to selected prose inside those editable paper regions.

Keep typed controls first:

- Experience and Education should keep item editors and per-entry wands before full inline paper editing.
- Skills, Languages, and Hobbies should stay chip/list based with add/remove suggestions.
- Achievements should use per-line controls before full rich inline editing.

## Recommended implementation path

1. Add a paper edit adapter in `CvForge.tsx` that maps section id + field id to the existing typed update shape.
2. Enable inline editing only for `summary`, `text`, and custom rich-text blocks.
3. Mount `FloatingAiToolbar` around selectable prose inside the paper edit surface.
4. Keep rail wand behavior as navigation/suggestion scope, not raw section rewriting.
5. Add tests that typing in paper summary updates `structuredContent[0].summary`, and selection AI accepts into the same field.
6. Only after that, add inline item controls for Experience/Education rows; do not mutate whole section prose.

## Main risk

The failure mode to avoid is two writers for the same section: paper prose and typed structured fields drifting apart. Every paper edit needs to hydrate the canonical structured field immediately.
