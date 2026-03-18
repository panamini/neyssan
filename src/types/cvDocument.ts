// src/types/cvDocument.ts
/**
 * Canonical TypeScript types for the CV document model used across the app.
 *
 * This file exports named interfaces and types only.
 *
 * Keep changes here minimal and stable — other modules (adapters, parsers, schemas)
 * should rely on these canonical definitions.
 */

// Small Remirror JSON shape used for editor block content.
export type RemirrorJSON = {
  type: 'doc';
  content: unknown[];
};

/**
 * Known section type names used in the application.
 * Extend this union if you add new structured section types.
 */
export type KnownSectionTypes =
  | 'summary'
  | 'experience'
  | 'education'
  | 'achievements'
  | 'skills'
  | 'contact'
  | 'projects'
  | 'certifications'
  | 'text';

/**
 * A block within a section.
 *
 * - content: usually a RemirrorJSON doc but may be other shapes depending on adapters,
 *   so we allow RemirrorJSON | unknown for gradual migration.
 * - attributes: optional metadata for renderers (e.g. attributes.linkedStructuredId
 *   can point to a structured item referenced by this block).
 */
export interface CvBlock {
  id: string;
  title?: string;
  type: 'text' | string;
  /** Usually RemirrorJSON; may be null/undefined when not yet populated */
  content: RemirrorJSON | null | undefined;
  /** Optional metadata, e.g. attributes.linkedStructuredId to tie to structuredContent */
  attributes?: Record<string, unknown>;
  order?: number;
  plainText?: string | undefined;
}

/**
 * Structured item representing an experience entry.
 *
 * - startDate/endDate: ISO strings or null when unknown.
 * - responsibilities: can be rich RemirrorJSON or a plain string.
 * - other optional fields are kept minimal here but can be extended safely.
 */
export interface IExperienceItem {
  id: string;
  company?: string;
  position?: string;
  startDate: string | null;
  endDate?: string | null;
  location?: string;
  responsibilities?: RemirrorJSON | string | undefined;
  achievements?: string[] | undefined;
  currentlyWorking?: boolean | undefined;
  // Any other commonly useful optional fields (e.g., url, industry)
  url?: string | undefined;
  industry?: string | undefined;
}

/**
 * Structured item representing an education entry.
 */
export interface IEducationItem {
  id: string;
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
  grade?: string;
  description?: RemirrorJSON | string | undefined;
}

/**
 * Achievement item when structured as object.
 */
export interface AchievementItem {
  id: string;
  achievement: string;
}

/**
 * Achievements structured content may be either an array of strings or an array
 * of typed AchievementItem objects. Use this union when typing section.structuredContent
 * for achievements.
 */
export type Achievements = string[] | AchievementItem[];

/**
 * Typed structured content for an experience section.
 */
export interface ExperienceSectionStructured {
  items: IExperienceItem[];
}

/**
 * Typed structured content for an education section.
 */
export interface EducationSectionStructured {
  items: IEducationItem[];
}

/**
 * A section in the CV document.
 *
 * - structuredContent: when present for typed sections it will follow one of the
 *   typed interfaces above (e.g. ExperienceSectionStructured). For generic sections
 *   it may be unknown or null.
 * - blocks: required (use an empty array when there are no blocks).
 */
export interface CvSection {
  id: string;
  title: string;
  type: KnownSectionTypes | (string & {});
  blocks: CvBlock[];
  structuredContent?: ExperienceSectionStructured | EducationSectionStructured | Achievements | unknown | null;
  collapsed?: boolean;
  order?: number;
}

/**
 * Top-level CV document representation used across the app.
 *
 * - metadata: createdAt/updatedAt are ISO strings. version is a simple number.
 * - tags and summary are optional.
 */
export interface CvDocument {
  id: string;
  title: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    locale?: string | undefined;
    authorId?: string | undefined;
    lastEditedBy?: string | undefined;
  };
  sections: CvSection[];
  tags?: string[];
  summary?: string | undefined;
}