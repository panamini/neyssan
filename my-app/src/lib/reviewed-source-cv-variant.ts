import type { CvDocument } from "../types/cvDocument";

export const REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX = "source-cv-variant:v1:";

export type ReviewedSourceCvVariantBinding = Readonly<{
  sourceCvId: string;
  jobId: string;
  reviewedPlanId: string | null;
}>;

export function isReviewedSourceCvVariantId(id: unknown): boolean {
  return (
    typeof id === "string" &&
    id.startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX)
  );
}

export function readReviewedSourceCvVariantBinding(
  cv: CvDocument,
): ReviewedSourceCvVariantBinding | null {
  const reviewedSourceCvVariant = cv.metadata?.reviewedSourceCvVariant;
  if (!reviewedSourceCvVariant || typeof reviewedSourceCvVariant !== "object") {
    return null;
  }

  const candidate = reviewedSourceCvVariant as {
    sourceCvId?: unknown;
    jobId?: unknown;
    reviewedPlanId?: unknown;
  };
  const sourceCvId =
    typeof candidate.sourceCvId === "string" ? candidate.sourceCvId.trim() : "";
  const jobId =
    typeof candidate.jobId === "string" ? candidate.jobId.trim() : "";
  const reviewedPlanId =
    typeof candidate.reviewedPlanId === "string" &&
    candidate.reviewedPlanId.trim().length > 0
      ? candidate.reviewedPlanId.trim()
      : null;

  return sourceCvId && jobId
    ? { sourceCvId, jobId, reviewedPlanId }
    : null;
}

export function isReviewedSourceCvVariant(cv: CvDocument): boolean {
  return (
    isReviewedSourceCvVariantId(String(cv.id)) ||
    readReviewedSourceCvVariantBinding(cv) !== null
  );
}
