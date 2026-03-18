// my-app/src/types/cv.ts
//
// Centralized CV-related types used by the UI and tests. This file was
// expanded to include additional shapes (IDraftForm, ICvState controls, and
// ICvStateActions) which the refactored hooks/components expect.

import type { CvSection } from "../schemas/cvDocument.schema";

/**
 * Represents a single editable section.
 *
 * @deprecated This is now an alias for the Zod-derived CvSection type.
 * Prefer importing `CvSection` from `../schemas/cvDocument.schema` directly.
 */
export type Section = CvSection;

// Backwards/alternate alias used in some modules
export type ICvSection = Section;

/**
 * Draft form used by the ProfileReviewModal and other editors.
 * This is a narrow, frontend-only shape that represents user-entered text.
 */
export interface IDraftForm {
  name?: string;
  email?: string;
  summary?: string;
  skillsText?: string; // comma-separated skills for the draft UI
  experienceText?: string; // JSON or text representation used in the draft editor
  educationText?: string; // JSON or text representation used in the draft editor
  achievementsText?: string; // newline separated achievements
  metadata?: Record<string, any>;
  confidence?: number;
}

/**
 * CV UI controls that affect how reviewer sections are displayed.
 */
export interface ICvStateControls {
  showRaw: boolean;
  useMapperStripping: boolean;
}

/**
 * Lightweight snapshot used for undo/redo stacks. Kept intentionally small.
 */
export interface ICvStateSnapshot {
  ts: number;
  sections?: Section[];
  draftProfile?: Partial<import("./profile").INormalizedProfile> & IDraftForm;
}

/**
 * Represents a single CV document state used by the unified cvState hook.
 * This is intentionally broad — it holds both "raw" and "mapped" representations
 * the UI can toggle between.
 */
export interface ICvState {
  // Authoritative list of sections — each section.content is RemirrorJSON
  sections: Section[];
  // Backwards-compatible optional legacy fields — kept optional to ease migration.
  // Prefer `sections` as the single source of truth.
  rawSections?: Section[];
  mappedSections?: Section[];
  displayedSections?: Section[];
  history?: Section[][];
  // UI controls
  controls: ICvStateControls;
  // Draft canonical profile merged from form or loaded profile
  draftProfile: Partial<import("./profile").INormalizedProfile> & IDraftForm;
  // Source indicator
  source: "manual" | "loaded" | "none";
  // Undo/Redo stacks (optional, stored as small snapshots)
  undoStack?: ICvStateSnapshot[];
  redoStack?: ICvStateSnapshot[];
  // Dirty tracking & autosave metadata
  isDirty?: boolean;
  lastSavedAt?: string | null; // ISO date or null
}

/**
 * Actions exposed by useCvState for consumers to update or reset state.
 */
export interface ICvStateActions {
  updateManualInput: (formData: IDraftForm) => void;
  loadProfile: (profile: import("./profile").INormalizedProfile) => void;
  setControls: (updates: Partial<ICvStateControls>) => void;
  reset: () => void;
}

/**
 * Represents a single CV document as stored in the user's library.
 */
export interface CvLibraryItem {
  id: string; // Unique identifier for the library item
  title: string; // User-defined title (e.g., "Frontend Developer CV")
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  // cvState uses the unified ICvState so callers can rely on a single, typed shape.
  // Legacy persisted entries that previously used { sections, source, history } are
  // still compatible because ICvState includes optional legacy fields.
  cvState: ICvState;
}

// Backwards/alternate alias used in some modules
export type ICvLibraryItem = CvLibraryItem;