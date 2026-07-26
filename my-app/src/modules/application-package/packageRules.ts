import type { CoverLetterArtifactStatusV1 } from "../cover-letter-artifact/schema";
import type { ResumeVariantArtifactStatusV1 } from "../resume-variant-artifact/schema";
import type { ApplicationPackageStatusV1 } from "./schema";

export const APPLICATION_PACKAGE_STATUSES: readonly ApplicationPackageStatusV1[] = [
  "draft",
  "needs_review",
  "blocked",
  "ready_for_review",
] as const;

export const APPLICATION_PACKAGE_WARNING_ORDER: readonly string[] = [
  "package_missing_resume_variant_artifact",
  "package_missing_cover_letter_artifact",
  "resume_variant_artifact_blocked",
  "resume_variant_artifact_needs_review",
  "resume_variant_artifact_draft",
  "cover_letter_artifact_blocked",
  "cover_letter_artifact_needs_review",
  "cover_letter_artifact_draft",
] as const;

export const RESUME_VARIANT_ARTIFACT_STATUSES_FOR_APPLICATION_PACKAGE: readonly ResumeVariantArtifactStatusV1[] = [
  "draft",
  "needs_review",
  "blocked",
  "ready_for_generation",
] as const;

export const COVER_LETTER_ARTIFACT_STATUSES_FOR_APPLICATION_PACKAGE: readonly CoverLetterArtifactStatusV1[] = [
  "draft",
  "needs_review",
  "blocked",
  "ready_for_review",
] as const;

export function isApplicationPackageStatus(value: unknown): value is ApplicationPackageStatusV1 {
  return typeof value === "string" && APPLICATION_PACKAGE_STATUSES.includes(value as ApplicationPackageStatusV1);
}

export function isResumeVariantArtifactStatusForApplicationPackage(
  value: unknown,
): value is ResumeVariantArtifactStatusV1 {
  return (
    typeof value === "string" &&
    RESUME_VARIANT_ARTIFACT_STATUSES_FOR_APPLICATION_PACKAGE.includes(value as ResumeVariantArtifactStatusV1)
  );
}

export function isCoverLetterArtifactStatusForApplicationPackage(
  value: unknown,
): value is CoverLetterArtifactStatusV1 {
  return (
    typeof value === "string" &&
    COVER_LETTER_ARTIFACT_STATUSES_FOR_APPLICATION_PACKAGE.includes(value as CoverLetterArtifactStatusV1)
  );
}

export function deriveApplicationPackageStatus(
  resumeVariantArtifactStatus: ResumeVariantArtifactStatusV1,
  coverLetterArtifactStatus: CoverLetterArtifactStatusV1,
): ApplicationPackageStatusV1 {
  if (resumeVariantArtifactStatus === "blocked") return "blocked";
  if (coverLetterArtifactStatus === "blocked") return "blocked";
  if (resumeVariantArtifactStatus === "needs_review") return "needs_review";
  if (resumeVariantArtifactStatus === "draft") return "needs_review";
  if (coverLetterArtifactStatus === "needs_review") return "needs_review";
  if (coverLetterArtifactStatus === "draft") return "needs_review";
  if (
    resumeVariantArtifactStatus === "ready_for_generation" &&
    coverLetterArtifactStatus === "ready_for_review"
  ) {
    return "ready_for_review";
  }
  return "draft";
}

export function deriveApplicationPackageBlockedReason(
  resumeVariantArtifactStatus: ResumeVariantArtifactStatusV1,
  coverLetterArtifactStatus: CoverLetterArtifactStatusV1,
): string | undefined {
  if (resumeVariantArtifactStatus === "blocked") return "resume_variant_artifact_blocked";
  if (coverLetterArtifactStatus === "blocked") return "cover_letter_artifact_blocked";
  return undefined;
}

export function warningForResumeVariantArtifactStatus(
  status: ResumeVariantArtifactStatusV1,
): string | undefined {
  if (status === "blocked") return "resume_variant_artifact_blocked";
  if (status === "needs_review") return "resume_variant_artifact_needs_review";
  if (status === "draft") return "resume_variant_artifact_draft";
  return undefined;
}

export function warningForCoverLetterArtifactStatus(
  status: CoverLetterArtifactStatusV1,
): string | undefined {
  if (status === "blocked") return "cover_letter_artifact_blocked";
  if (status === "needs_review") return "cover_letter_artifact_needs_review";
  if (status === "draft") return "cover_letter_artifact_draft";
  return undefined;
}

export function sortApplicationPackageWarnings(values: readonly string[]): readonly string[] {
  const order = new Map(APPLICATION_PACKAGE_WARNING_ORDER.map((warning, index) => [warning, index]));
  return [...new Set(values)].sort((a, b) => {
    const aOrder = order.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b) ?? Number.MAX_SAFE_INTEGER;
    return aOrder === bOrder ? compareAscii(a, b) : aOrder - bOrder;
  });
}

function compareAscii(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
