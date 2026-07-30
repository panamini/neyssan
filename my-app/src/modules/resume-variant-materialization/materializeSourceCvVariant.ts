import type { ApplicationContextV1 } from "../application-harness/schema";
import { buildStableHash } from "../application-harness/fingerprints";
import {
  buildReviewableCandidateCvItemReferences,
  resolveReviewableCandidateCvItemReference,
} from "../candidate-evidence/cvItemReferences";
import type {
  ResumeVariantPlanItemV1,
  ResumeVariantPlanSectionV1,
  ResumeVariantPlanV1,
} from "../resume-variant-plan/schema";
import type { CvDocument, CvSection } from "../../types/cvDocument";

const MATERIALIZATION_ID_PREFIX = "source-cv-variant:v1:";
const FILTERED_SECTION_TYPES = new Set<CvSection["type"]>([
  "experience",
  "education",
  "skills",
]);

export type ReviewedSourceCvVariantProvenanceV1 = Readonly<{
  kind: "reviewed_source_cv_variant";
  sourceCvId: string;
  jobId: string;
  applicationContextId: string;
  applicationContextHash: string;
  reviewedPlanId: string;
  version: 1;
}>;

export type MaterializedSourceCvVariantV1 = Readonly<{
  id: string;
  name: string;
  document: CvDocument;
  provenance: ReviewedSourceCvVariantProvenanceV1;
}>;

export async function materializeSourceCvVariant(input: Readonly<{
  applicationContext: ApplicationContextV1;
  sourceCv: Readonly<CvDocument>;
  reviewedPlan: ResumeVariantPlanV1;
}>): Promise<MaterializedSourceCvVariantV1> {
  assertMaterializationInput(input);

  const references = buildReviewableCandidateCvItemReferences(input.sourceCv);
  const referencesById = new Map(
    references.map((reference) => [reference.id, reference]),
  );
  const acceptedItemsBySection = new Map<CvSection, Set<object>>();
  const reviewedReferenceIds = new Set<string>();

  for (const item of input.reviewedPlan.items) {
    const referenceId = requireSingleSourceReference(item);
    if (reviewedReferenceIds.has(referenceId)) {
      throw new TypeError(
        "reviewed source CV plan contains a duplicate stable reference",
      );
    }
    reviewedReferenceIds.add(referenceId);
    const reference = referencesById.get(referenceId);
    if (
      !reference ||
      item.section !== planSectionForReference(reference.sectionType)
    ) {
      throw new TypeError(
        "reviewed source CV plan does not match the canonical source CV",
      );
    }
    if (item.reviewState !== "accepted") {
      continue;
    }
    const resolved = resolveReviewableCandidateCvItemReference(
      input.sourceCv,
      reference,
    );
    const accepted =
      acceptedItemsBySection.get(resolved.section) ?? new Set<object>();
    accepted.add(resolved.item as object);
    acceptedItemsBySection.set(resolved.section, accepted);
  }

  if (
    reviewedReferenceIds.size !== references.length ||
    references.some((reference) => !reviewedReferenceIds.has(reference.id))
  ) {
    throw new TypeError(
      "reviewed source CV plan must decide every canonical source CV item",
    );
  }

  const provenance: ReviewedSourceCvVariantProvenanceV1 = {
    kind: "reviewed_source_cv_variant",
    sourceCvId: input.sourceCv.id,
    jobId: input.applicationContext.job.jobId,
    applicationContextId: input.applicationContext.id,
    applicationContextHash: input.applicationContext.contextHash,
    reviewedPlanId: input.reviewedPlan.id,
    version: 1,
  };
  const id = `${MATERIALIZATION_ID_PREFIX}${await buildStableHash({
    namespace: "reviewed-source-cv-variant-materialization",
    version: 1,
    applicationContext: input.applicationContext,
    sourceCv: input.sourceCv,
    reviewedPlan: input.reviewedPlan,
  })}`;
  const sections = input.sourceCv.sections.flatMap((section) => {
    if (!FILTERED_SECTION_TYPES.has(section.type)) {
      return [section];
    }
    const selected = acceptedItemsBySection.get(section) ?? new Set<object>();
    const structuredContent = Array.isArray(section.structuredContent)
      ? section.structuredContent.filter(
          (item) =>
            Boolean(item) &&
            typeof item === "object" &&
            selected.has(item as object),
        )
      : [];
    return structuredContent.length > 0
      ? [
          {
            ...section,
            blocks: [],
            structuredContent,
          } as CvSection,
        ]
      : [];
  });
  const document: CvDocument = {
    ...input.sourceCv,
    id,
    metadata: {
      ...input.sourceCv.metadata,
      reviewedSourceCvVariant: provenance,
    },
    sections,
  };

  return {
    id,
    name: document.title,
    document,
    provenance,
  };
}

function assertMaterializationInput(input: Readonly<{
  applicationContext: ApplicationContextV1;
  sourceCv: Readonly<CvDocument>;
  reviewedPlan: ResumeVariantPlanV1;
}>): void {
  const context = input?.applicationContext;
  const sourceCv = input?.sourceCv;
  const plan = input?.reviewedPlan;
  if (
    !context ||
    context.version !== 1 ||
    context.candidate.sourceKind !== "cv" ||
    !context.contextHash ||
    !context.job.jobId ||
    !sourceCv?.id ||
    context.candidate.cvId !== sourceCv.id
  ) {
    throw new TypeError(
      "source CV materialization requires the current ApplicationContext",
    );
  }
  if (
    !plan ||
    plan.version !== 1 ||
    plan.userId !== context.userId ||
    plan.applicationContextId !== context.id ||
    plan.targetDocumentKind !== "cv" ||
    plan.sourceCvId !== sourceCv.id ||
    plan.blocked ||
    plan.items.length === 0 ||
    plan.sourceFactIds.length > 0 ||
    plan.allowedClaimIds.length > 0 ||
    plan.riskFlagIds.length > 0
  ) {
    throw new TypeError(
      "source CV materialization requires the current application-scoped reviewed plan",
    );
  }
  for (const item of plan.items) {
    if (
      item.action !== "include" ||
      (item.reviewState !== "accepted" &&
        item.reviewState !== "rejected") ||
      item.allowedClaimIds.length > 0 ||
      item.candidateFactIds.length > 0 ||
      item.evidenceMatchIds.length > 0 ||
      item.riskFlagIds.length > 0
    ) {
      throw new TypeError(
        "source CV materialization requires a fully reviewed source selection plan",
      );
    }
  }
}

function requireSingleSourceReference(
  item: ResumeVariantPlanItemV1,
): string {
  const referenceIds = item.sourceCvItemReferenceIds;
  const referenceId =
    referenceIds?.length === 1 ? referenceIds[0]?.trim() : "";
  if (!referenceId) {
    throw new TypeError(
      "reviewed source CV plan item requires one stable source reference",
    );
  }
  return referenceId;
}

function planSectionForReference(
  sectionType: "experience" | "education" | "skill",
): ResumeVariantPlanSectionV1 {
  return sectionType === "skill" ? "skills" : sectionType;
}
