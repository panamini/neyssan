import type { ResumeVariantArtifactStatusV1 } from "../resume-variant-artifact/schema";
import type {
  CoverLetterArtifactSourceKindV1,
  CoverLetterArtifactStatusV1,
  CoverLetterArtifactTextFormatV1,
} from "./schema";

export const COVER_LETTER_ARTIFACT_STATUSES: readonly CoverLetterArtifactStatusV1[] = [
  "draft",
  "needs_review",
  "blocked",
  "ready_for_review",
] as const;

export const COVER_LETTER_ARTIFACT_SOURCE_KINDS: readonly CoverLetterArtifactSourceKindV1[] = [
  "existing_generated_output",
  "manual_text",
  "imported_text",
  "unknown",
] as const;

export const COVER_LETTER_ARTIFACT_TEXT_FORMATS: readonly CoverLetterArtifactTextFormatV1[] = [
  "plain_text",
  "markdown",
] as const;

export const RESUME_VARIANT_ARTIFACT_STATUSES_FOR_COVER_LETTER: readonly ResumeVariantArtifactStatusV1[] = [
  "draft",
  "needs_review",
  "blocked",
  "ready_for_generation",
] as const;

export function isCoverLetterArtifactSourceKind(value: unknown): value is CoverLetterArtifactSourceKindV1 {
  return typeof value === "string" && COVER_LETTER_ARTIFACT_SOURCE_KINDS.includes(value as CoverLetterArtifactSourceKindV1);
}

export function isCoverLetterArtifactTextFormat(value: unknown): value is CoverLetterArtifactTextFormatV1 {
  return typeof value === "string" && COVER_LETTER_ARTIFACT_TEXT_FORMATS.includes(value as CoverLetterArtifactTextFormatV1);
}

export function isResumeVariantArtifactStatusForCoverLetter(value: unknown): value is ResumeVariantArtifactStatusV1 {
  return typeof value === "string" && RESUME_VARIANT_ARTIFACT_STATUSES_FOR_COVER_LETTER.includes(value as ResumeVariantArtifactStatusV1);
}

export function deriveCoverLetterArtifactStatus(
  resumeVariantArtifactStatus: ResumeVariantArtifactStatusV1,
  sourceText: string,
): CoverLetterArtifactStatusV1 {
  if (resumeVariantArtifactStatus === "blocked") return "blocked";
  if (sourceText.trim().length === 0) return "draft";
  if (resumeVariantArtifactStatus === "needs_review" || resumeVariantArtifactStatus === "draft") return "needs_review";
  return "ready_for_review";
}

export function countCoverLetterParagraphs(sourceText: string): number {
  const trimmed = sourceText.trim();
  return trimmed ? trimmed.split(/\n\s*\n+/u).filter((paragraph) => paragraph.trim().length > 0).length : 0;
}
