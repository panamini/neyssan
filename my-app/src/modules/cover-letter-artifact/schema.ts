import type { ResumeVariantArtifactV1 } from "../resume-variant-artifact/schema";

export type CoverLetterArtifactStatusV1 =
  | "draft"
  | "needs_review"
  | "blocked"
  | "ready_for_review";

export type CoverLetterArtifactSourceKindV1 =
  | "existing_generated_output"
  | "manual_text"
  | "imported_text"
  | "unknown";

export type CoverLetterArtifactTextFormatV1 = "plain_text" | "markdown";

export type CoverLetterArtifactTextV1 = Readonly<{
  value: string;
  format: CoverLetterArtifactTextFormatV1;
  sourceKind: CoverLetterArtifactSourceKindV1;
  textHash: string;
  paragraphCount: number;
  characterCount: number;
  version: 1;
}>;

export type CoverLetterArtifactSourceMetadataV1 = Readonly<{
  sourceId?: string;
  proposalId?: string;
  generatorInputHash?: string;
  sourceLabel?: string;
  version: 1;
}>;

export type CoverLetterArtifactProvenanceV1 = Readonly<{
  applicationContextId: string;
  resumeVariantArtifactId: string;
  resumeVariantArtifactContentHash?: string;
  evidenceGraphId: string;
  evidenceGraphHash: string;
  resumeVariantPlanId: string;
  resumeVariantPlanHash: string;
  reviewCockpitId: string;
  sourceFactIds: readonly string[];
  allowedClaimIds: readonly string[];
  evidenceMatchIds: readonly string[];
  demandIds: readonly string[];
  riskFlagIds: readonly string[];
  reviewItemIds: readonly string[];
  version: 1;
}>;

export type CoverLetterArtifactV1 = Readonly<{
  id: string;
  userId: string;
  applicationContextId: string;
  language?: string;
  market?: string;
  status: CoverLetterArtifactStatusV1;
  text: CoverLetterArtifactTextV1;
  sourceMetadata?: CoverLetterArtifactSourceMetadataV1;
  warnings: readonly string[];
  blockedReason?: string;
  provenance: CoverLetterArtifactProvenanceV1;
  createdAt: number;
  updatedAt: number;
  version: 1;
}>;

export type CoverLetterArtifactContentV1 = Readonly<{
  kind: "cover_letter_artifact";
  artifact: CoverLetterArtifactV1;
  version: 1;
}>;

export type BuildCoverLetterArtifactInputV1 = Readonly<{
  userId: string;
  applicationContextId: string;
  resumeVariantArtifact: ResumeVariantArtifactV1;
  sourceText: string;
  sourceKind: CoverLetterArtifactSourceKindV1;
  format: CoverLetterArtifactTextFormatV1;
  sourceMetadata?: Omit<CoverLetterArtifactSourceMetadataV1, "version">;
  language?: string;
  market?: string;
  createdAt: number;
  updatedAt: number;
}>;
