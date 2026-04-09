import type { CvSection } from "./cvDocument";

export const IMPORT_RECOVERY_SECTION_TYPES = [
  "profile",
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "projects",
  "certifications",
  "achievements",
  "additional_information",
  "affiliations",
  "hobbies",
  "custom",
] as const;

export type ImportRecoverySectionType =
  (typeof IMPORT_RECOVERY_SECTION_TYPES)[number];

export const IMPORT_RECOVERY_SECTION_LABELS: Record<
  ImportRecoverySectionType,
  string
> = {
  profile: "Profile",
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  languages: "Languages",
  projects: "Projects",
  certifications: "Certifications",
  achievements: "Achievements",
  additional_information: "Additional Information",
  affiliations: "Affiliations",
  hobbies: "Hobbies",
  custom: "Add your own",
};

export const IMPORT_RECOVERY_REVIEW_LIMIT = 12;

export type ImportRecoveryConfidenceScore = "high" | "medium" | "low";

export type ImportRecoveryIssueFlag =
  | "glyphIssue"
  | "bulletIssue"
  | "duplicate"
  | "unknownSection"
  | "weakSectionMatch"
  | "ambiguousStructure";

export type ImportRecoveryReviewStatus =
  | "pending"
  | "accepted"
  | "reassigned"
  | "ignored";

export type ImportRecoverySelectionSource = "cleaned" | "raw";

export interface ImportRecoverySpan {
  start: number;
  end: number;
}

export interface ImportRecoveryFragmentAssignment {
  fragmentId: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  selectionSource: ImportRecoverySelectionSource;
  targetSection: ImportRecoverySectionType;
  targetSectionTitle?: string | null;
  status: "assigned" | "removed";
  createdAt: string;
}

export interface ImportRecoveryItem {
  blockId: string;
  rawText: string;
  cleanedText: string;
  displayTextSource: ImportRecoverySelectionSource;
  predictedSection: ImportRecoverySectionType;
  confidenceScore: ImportRecoveryConfidenceScore;
  confidenceValue: number | null;
  issueFlags: ImportRecoveryIssueFlag[];
  reviewStatus: ImportRecoveryReviewStatus;
  selectedSection?: ImportRecoverySectionType;
  selectedSectionTitle?: string | null;
  sourceSectionTitle?: string | null;
  sourceFieldKey?: string | null;
  sourceLabel?: string | null;
  sourceSpan?: ImportRecoverySpan | null;
  fragmentAssignments: ImportRecoveryFragmentAssignment[];
}

export interface ImportRecoveryPayload {
  items: ImportRecoveryItem[];
  reviewRequired: boolean;
  totalItems: number;
  overflowCount: number;
  reviewLimit: number;
  reviewNormalized?: Record<string, unknown> | null;
  diagnostics?: ImportRecoveryRoutingDiagnostics | null;
}

export interface ImportRecoveryRoutingDiagnostics {
  sourceSectionCount: number;
  splitFragmentCount: number;
  directImportItemCount: number;
  recoveryItemCount: number;
  countsByPredictedSection: Partial<Record<ImportRecoverySectionType, number>>;
  countsByIssueFlag: Partial<Record<ImportRecoveryIssueFlag, number>>;
  countsByConfidenceBand: Partial<Record<ImportRecoveryConfidenceScore, number>>;
  unknownResidualCount: number;
  largeRecoveryBlobCount: number;
  splitAttempts: number;
  suppressedTinyFragments: number;
  processingTimeMs: number;
}

export interface ImportRecoverySession {
  status: "pending" | "completed";
  updatedAt: string;
  items: ImportRecoveryItem[];
  overflowCount: number;
  reviewLimit: number;
  baseSectionsSnapshot?: CvSection[];
}

export interface ImportRecoveryBlockMetadata {
  blockId: string;
  predictedSection: ImportRecoverySectionType;
  resolvedSection: ImportRecoverySectionType;
  resolvedSectionTitle?: string | null;
  reviewStatus: Exclude<ImportRecoveryReviewStatus, "pending"> | "accepted";
  confidenceScore: ImportRecoveryConfidenceScore;
  confidenceValue: number | null;
  issueFlags: ImportRecoveryIssueFlag[];
  sourceSectionTitle?: string | null;
  sourceFieldKey?: string | null;
  sourceLabel?: string | null;
  selectedText?: string | null;
  selectionSource?: ImportRecoverySelectionSource;
  selectionOffsets?: ImportRecoverySpan | null;
  fragmentId?: string | null;
}
