import type {
  ResumeVariantArtifactItemKindV1,
  ResumeVariantArtifactItemV1,
  ResumeVariantArtifactSectionKindV1,
  ResumeVariantArtifactStatusV1,
} from "./schema";
import type {
  ResumeVariantPlanActionV1,
  ResumeVariantPlanPriorityV1,
  ResumeVariantPlanSectionV1,
} from "../resume-variant-plan/schema";

export const RESUME_VARIANT_ARTIFACT_SECTION_ORDER: readonly ResumeVariantArtifactSectionKindV1[] = [
  "profile",
  "summary",
  "skills",
  "experience",
  "education",
  "languages",
  "certifications",
  "achievements",
  "projects",
  "portfolio",
  "other",
] as const;

export const RESUME_VARIANT_ARTIFACT_ITEM_KIND_ORDER: readonly ResumeVariantArtifactItemKindV1[] = [
  "source_backed_claim",
  "plan_instruction",
  "missing_evidence_notice",
  "risk_notice",
  "blocked_claim_notice",
  "review_notice",
] as const;

export const RESUME_VARIANT_ARTIFACT_STATUS_ORDER: readonly ResumeVariantArtifactStatusV1[] = [
  "draft",
  "needs_review",
  "blocked",
  "ready_for_generation",
] as const;

const PLAN_PRIORITY_ORDER: readonly ResumeVariantPlanPriorityV1[] = [
  "required",
  "recommended",
  "optional",
] as const;

const PLAN_ACTION_ORDER: readonly ResumeVariantPlanActionV1[] = [
  "include",
  "add_from_allowed_claim",
  "emphasize",
  "reorder",
  "deemphasize",
  "exclude",
  "needs_review",
  "block",
] as const;

export function mapPlanSectionToResumeVariantArtifactSection(
  section: ResumeVariantPlanSectionV1,
): ResumeVariantArtifactSectionKindV1 {
  return section;
}

export function titleForResumeVariantArtifactSection(
  section: ResumeVariantArtifactSectionKindV1,
): string {
  switch (section) {
    case "profile":
      return "Profile";
    case "summary":
      return "Summary";
    case "skills":
      return "Skills";
    case "experience":
      return "Experience";
    case "education":
      return "Education";
    case "languages":
      return "Languages";
    case "certifications":
      return "Certifications";
    case "achievements":
      return "Achievements";
    case "projects":
      return "Projects";
    case "portfolio":
      return "Portfolio";
    case "other":
      return "Other";
  }
}

export function labelForResumeVariantArtifactItem(kind: ResumeVariantArtifactItemKindV1): string {
  switch (kind) {
    case "source_backed_claim":
      return "Source-backed claim reserved for future resume generation.";
    case "plan_instruction":
      return "Plan instruction reserved for review.";
    case "missing_evidence_notice":
      return "Missing evidence blocks safe resume generation.";
    case "risk_notice":
      return "Evidence risk requires review before generation.";
    case "blocked_claim_notice":
      return "Blocked claim requires source review.";
    case "review_notice":
      return "Review cockpit notice preserved for provenance.";
  }
}

export function noteForResumeVariantArtifactItem(kind: ResumeVariantArtifactItemKindV1): string {
  switch (kind) {
    case "source_backed_claim":
      return "Allowed claim has source support.";
    case "plan_instruction":
      return "Planning metadata is preserved without final resume copy.";
    case "missing_evidence_notice":
      return "Missing evidence is preserved as a notice instead of generated content.";
    case "risk_notice":
      return "Risk provenance is preserved and must be reviewed before later generation.";
    case "blocked_claim_notice":
      return "Blocked claim is preserved only as a notice and cannot become normal resume content.";
    case "review_notice":
      return "Review metadata is preserved without approval, export, or final copy.";
  }
}

export function compareResumeVariantArtifactSectionKind(
  a: ResumeVariantArtifactSectionKindV1,
  b: ResumeVariantArtifactSectionKindV1,
): number {
  return sectionOrder(a) - sectionOrder(b) || a.localeCompare(b);
}

export function compareResumeVariantArtifactItems(
  a: ResumeVariantArtifactItemV1,
  b: ResumeVariantArtifactItemV1,
  planMetaById: ReadonlyMap<string, Readonly<{ priority: ResumeVariantPlanPriorityV1; action: ResumeVariantPlanActionV1 }>>,
): number {
  const aPlanMeta = a.planItemId ? planMetaById.get(a.planItemId) : undefined;
  const bPlanMeta = b.planItemId ? planMetaById.get(b.planItemId) : undefined;

  return (
    itemKindOrder(a.kind) - itemKindOrder(b.kind) ||
    priorityOrder(aPlanMeta?.priority) - priorityOrder(bPlanMeta?.priority) ||
    actionOrder(aPlanMeta?.action) - actionOrder(bPlanMeta?.action) ||
    (a.planItemId ?? "").localeCompare(b.planItemId ?? "") ||
    a.id.localeCompare(b.id)
  );
}

function sectionOrder(section: ResumeVariantArtifactSectionKindV1): number {
  const index = RESUME_VARIANT_ARTIFACT_SECTION_ORDER.indexOf(section);
  return index === -1 ? RESUME_VARIANT_ARTIFACT_SECTION_ORDER.length : index;
}

function itemKindOrder(kind: ResumeVariantArtifactItemKindV1): number {
  const index = RESUME_VARIANT_ARTIFACT_ITEM_KIND_ORDER.indexOf(kind);
  return index === -1 ? RESUME_VARIANT_ARTIFACT_ITEM_KIND_ORDER.length : index;
}

function priorityOrder(priority: ResumeVariantPlanPriorityV1 | undefined): number {
  if (!priority) {
    return PLAN_PRIORITY_ORDER.length;
  }

  const index = PLAN_PRIORITY_ORDER.indexOf(priority);
  return index === -1 ? PLAN_PRIORITY_ORDER.length : index;
}

function actionOrder(action: ResumeVariantPlanActionV1 | undefined): number {
  if (!action) {
    return PLAN_ACTION_ORDER.length;
  }

  const index = PLAN_ACTION_ORDER.indexOf(action);
  return index === -1 ? PLAN_ACTION_ORDER.length : index;
}
