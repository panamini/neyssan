import type { CoverLetterArtifactV1 } from "../cover-letter-artifact/schema";
import type { ResumeVariantArtifactV1 } from "../resume-variant-artifact/schema";

export type ApplicationPackageStatusV1 = "draft" | "needs_review" | "blocked" | "ready_for_review";

export type ApplicationPackageWarningsV1 = readonly string[];

export type ApplicationPackageItemKindV1 =
  | "resume_variant"
  | "cover_letter"
  | "supporting_provenance"
  | "warning"
  | "blocker";

export type ApplicationPackageItemStatusV1 = ApplicationPackageStatusV1 | "included" | "notice";

export type ApplicationPackageItemV1 = Readonly<{
  id: string;
  kind: ApplicationPackageItemKindV1;
  artifactId?: string;
  artifactContentHash?: string;
  status: ApplicationPackageItemStatusV1;
  label: string;
  note: string;
  sourceFactIds: readonly string[];
  allowedClaimIds: readonly string[];
  evidenceMatchIds: readonly string[];
  demandIds: readonly string[];
  riskFlagIds: readonly string[];
  reviewItemIds: readonly string[];
  version: 1;
}>;

export type ApplicationPackageArtifactRefV1 = Readonly<{
  id: string;
  kind: "resume_variant_artifact" | "cover_letter_artifact";
  contentHash?: string;
  status: string;
  version: 1;
}>;

export type ApplicationPackageProvenanceV1 = Readonly<{
  applicationContextId: string;
  resumeVariantArtifactId: string;
  coverLetterArtifactId: string;
  sourceFactIds: readonly string[];
  allowedClaimIds: readonly string[];
  evidenceMatchIds: readonly string[];
  demandIds: readonly string[];
  riskFlagIds: readonly string[];
  reviewItemIds: readonly string[];
  version: 1;
}>;

export type ApplicationPackageV1 = Readonly<{
  id: string;
  userId: string;
  applicationContextId: string;
  status: ApplicationPackageStatusV1;
  artifacts: readonly ApplicationPackageArtifactRefV1[];
  items: readonly ApplicationPackageItemV1[];
  warnings: ApplicationPackageWarningsV1;
  blockedReason?: string;
  provenance: ApplicationPackageProvenanceV1;
  createdAt: number;
  updatedAt: number;
  version: 1;
}>;

export type ApplicationPackageContentV1 = Readonly<{
  kind: "application_package";
  package: ApplicationPackageV1;
  version: 1;
}>;

export type BuildApplicationPackageInputV1 = Readonly<{
  userId: string;
  applicationContextId: string;
  resumeVariantArtifact: ResumeVariantArtifactV1;
  coverLetterArtifact: CoverLetterArtifactV1;
  createdAt: number;
  updatedAt: number;
}>;
