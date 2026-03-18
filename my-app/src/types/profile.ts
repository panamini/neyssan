/**
 * Shared profile and reviewer interfaces
 * Use named exports and interfaces (not types) for consistency and clarity.
 */

export interface IExperienceItem {
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface IEducationItem {
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface INormalizedProfile {
  id?: string;
  name?: string | null;
  email?: string | null;
  // Added optional identity fields for consistency with backend parser
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
  skills?: string[] | null;
  experience?: IExperienceItem[] | null;
  education?: IEducationItem[] | null;
  achievements?: string[] | null;
  rawText?: string | null;
  confidence?: number;
  metadata?: Record<string, unknown> | null;
  version?: number;
}

/**
 * Props used by ProfileReviewModal (kept minimal and explicit)
 */
export interface IProfileReviewProps {
  visible: boolean;
  parsedProfile: INormalizedProfile | null;
  onClose: () => void;
  onSaved?: (result: any) => void;
}

/**
 * ReviewerSection is a minimal interface representing a parsed CV block
 * shown in the CVDocumentReviewer. We keep fieldKey generic (string) so
 * it can interoperate with the parser output (RefinedContent) without
 * introducing a circular dependency in types.
 */
export interface IReviewerSection {
  id: string;
  title: string;
  content: string;
  dismissed?: boolean;
  fieldKey?: string | "identity";
}