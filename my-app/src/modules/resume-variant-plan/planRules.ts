import type {
  AllowedClaimTypeV1,
  EvidenceRiskFlagCategoryV1,
  EvidenceRiskFlagSeverityV1,
  JobDemandKindV1,
  MissingEvidenceSeverityV1,
} from "../evidence-graph/schema";
import type {
  ResumeVariantPlanActionV1,
  ResumeVariantPlanPriorityV1,
  ResumeVariantPlanReviewStateV1,
  ResumeVariantPlanSectionV1,
  ResumeVariantPlanWarningCategoryV1,
  ResumeVariantPlanWarningSeverityV1,
} from "./schema";

export const CLAIM_BACKED_RESUME_VARIANT_PLAN_ACTIONS: readonly ResumeVariantPlanActionV1[] = [
  "include",
  "reorder",
  "emphasize",
  "add_from_allowed_claim",
] as const;

export function isClaimBackedResumeVariantPlanAction(action: ResumeVariantPlanActionV1): boolean {
  return CLAIM_BACKED_RESUME_VARIANT_PLAN_ACTIONS.includes(action);
}

export function mapAllowedClaimTypeToResumeVariantPlanSection(
  claimType: AllowedClaimTypeV1,
): ResumeVariantPlanSectionV1 {
  switch (claimType) {
    case "skill":
      return "skills";
    case "experience":
      return "experience";
    case "achievement":
      return "achievements";
    case "education":
      return "education";
    case "language":
      return "languages";
    case "certification":
      return "certifications";
    case "project":
      return "projects";
    case "other":
      return "other";
  }
}

export function mapJobDemandKindToResumeVariantPlanSection(
  demandKind: JobDemandKindV1,
): ResumeVariantPlanSectionV1 {
  switch (demandKind) {
    case "skill":
      return "skills";
    case "experience":
    case "responsibility":
    case "seniority":
      return "experience";
    case "education":
      return "education";
    case "language":
      return "languages";
    case "certification":
      return "certifications";
    case "domain":
      return "skills";
    case "location":
    case "availability":
    case "other":
      return "other";
  }
}

export function mapRiskFlagCategoryToResumeVariantPlanWarningCategory(
  category: EvidenceRiskFlagCategoryV1,
): ResumeVariantPlanWarningCategoryV1 {
  switch (category) {
    case "missing_evidence":
      return "missing_evidence";
    case "unsupported_metric":
    case "unsupported_tool":
    case "unsupported_certification":
    case "unsupported_language":
      return "unsupported_claim";
    case "private_fact":
      return "private_fact";
    case "never_use_fact":
      return "never_use_fact";
    case "generated_text_as_fact":
      return "generated_text_as_fact";
    case "source_truth":
      return "source_truth";
    case "other":
      return "other";
  }
}

export function priorityFromWarningSeverity(
  severity: EvidenceRiskFlagSeverityV1 | MissingEvidenceSeverityV1,
): ResumeVariantPlanPriorityV1 {
  if (severity === "blocker") {
    return "required";
  }
  if (severity === "warning") {
    return "recommended";
  }
  return "optional";
}

export function reviewStateFromWarningSeverity(
  severity: EvidenceRiskFlagSeverityV1 | MissingEvidenceSeverityV1,
): ResumeVariantPlanReviewStateV1 {
  return severity === "blocker" ? "blocked" : "needs_review";
}

export function actionFromWarningSeverity(
  severity: EvidenceRiskFlagSeverityV1 | MissingEvidenceSeverityV1,
): ResumeVariantPlanActionV1 {
  return severity === "blocker" ? "block" : "needs_review";
}

export function normalizePlanIdSegment(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d'"`.,;:!?()[\]{}<>/\\|_\s]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "") || "empty";
}

export function sortUniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function isForbiddenResumeOrCoverLetterText(value: string): boolean {
  const normalized = value.normalize("NFKC").toLowerCase();
  return (
    /\bi am excited to apply\b/u.test(normalized) ||
    /\bdear hiring manager\b/u.test(normalized) ||
    /\bsincerely\b/u.test(normalized) ||
    /\bworld-class\b/u.test(normalized) ||
    /\bproven track record\b/u.test(normalized) ||
    /\b(increased|reduced|improved|boosted|grew|scaled)\b[^.]{0,120}\b\d+\s*%/u.test(normalized)
  );
}

export function warningSeverityFromEvidenceSeverity(
  severity: EvidenceRiskFlagSeverityV1 | MissingEvidenceSeverityV1,
): ResumeVariantPlanWarningSeverityV1 {
  return severity;
}
