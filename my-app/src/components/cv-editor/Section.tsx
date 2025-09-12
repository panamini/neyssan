/**
 * Compatibility re-export for older imports.
 *
 * The canonical SectionEditor now lives at src/components/SectionEditor.tsx.
 * This file re-exports it to avoid breaking existing imports that referenced
 * src/components/cv-editor/Section.tsx.
 *
 * Keep this small and stable — real editing logic is in SectionEditor.
 */

/**
 * Default export passthrough for consumers that import the module as:
 *   import Section from '.../cv-editor/Section';
 *
 * Named export compatibility for consumers that import:
 *   import { SectionComponent } from '.../cv-editor/Section';
 */
export { default } from './../SectionEditor';
export { default as SectionComponent } from './../SectionEditor';