import type { CvDocument } from "../../types/cvDocument";
import type { CareerKnowledgeRuleV1 } from "../career-knowledge/schema";
import { buildCandidateCvFacts } from "../candidate-evidence/candidateCvFacts";
import { buildCandidateCvItemReferences } from "../candidate-evidence/cvItemReferences";
import type {
  CandidateCvItemReferenceV1,
  CandidateFactV1,
} from "../candidate-evidence/schema";
import { buildEvidenceGraph } from "../evidence-graph/buildEvidenceGraph";
import type {
  EvidenceGraphV1,
  JobDemandV1,
} from "../evidence-graph/schema";
import type { ResumeVariantPlanV1 } from "../resume-variant-plan/schema";
import type { ApplicationContextV1 } from "./schema";
import {
  composeSourceCvVariantPlan,
  type SourceCvCompositionResultV1,
} from "./sourceCvComposition";

type SourceCvApplicationCompositionBaseInputV1 = Readonly<{
  callerUserId: string;
  applicationContext: ApplicationContextV1;
  sourceCv: Readonly<CvDocument>;
}>;

export type AutoRecommendedSourceCvApplicationCompositionInputV1 =
  SourceCvApplicationCompositionBaseInputV1 &
    Readonly<{
      mode?: "auto_recommended";
      sourceDocumentId: string;
      demands: readonly JobDemandV1[];
      authorizedCvItemReferenceIds: readonly string[];
      careerKnowledgeRules: readonly CareerKnowledgeRuleV1[];
      createdAt: number;
      updatedAt: number;
    }>;

export type FullSourceCvApplicationCompositionInputV1 =
  SourceCvApplicationCompositionBaseInputV1 &
    Readonly<{
      mode: "full_source_cv";
    }>;

export type SourceCvApplicationCompositionInputV1 =
  | AutoRecommendedSourceCvApplicationCompositionInputV1
  | FullSourceCvApplicationCompositionInputV1;

export type AutoRecommendedSourceCvApplicationCompositionResultV1 = Readonly<{
  mode: "auto_recommended";
  userId: string;
  applicationContextId: string;
  sourceCvId: string;
  sourceCvContextHash: string;
  cvItemReferences: readonly CandidateCvItemReferenceV1[];
  candidateFacts: readonly CandidateFactV1[];
  evidenceGraph: EvidenceGraphV1;
  plan: ResumeVariantPlanV1;
}>;

export type SourceCvApplicationCompositionResultV1 =
  | AutoRecommendedSourceCvApplicationCompositionResultV1
  | Extract<SourceCvCompositionResultV1, { mode: "full_source_cv" }>;

export async function buildSourceCvApplicationComposition(
  input: SourceCvApplicationCompositionInputV1,
): Promise<SourceCvApplicationCompositionResultV1> {
  assertCallerOwnsApplicationContext(input);
  if (input.mode === "full_source_cv") {
    const composition = await composeSourceCvVariantPlan(input);
    if (composition.mode !== "full_source_cv") {
      throw new TypeError("full source CV composition returned wrong mode");
    }
    return composition;
  }
  if (input.mode !== undefined && input.mode !== "auto_recommended") {
    throw new TypeError("unsupported source CV application composition mode");
  }

  assertAutoRecommendedInput(input);
  const allReferences = buildCandidateCvItemReferences(input.sourceCv);
  const authorizedReferences = resolveAuthorizedReferences(
    allReferences,
    input.authorizedCvItemReferenceIds,
  );
  const candidateFacts = await buildCandidateCvFacts({
    userId: input.applicationContext.userId,
    sourceDocumentId: input.sourceDocumentId,
    document: input.sourceCv,
    references: authorizedReferences,
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
  const evidenceGraph = await buildEvidenceGraph({
    userId: input.applicationContext.userId,
    applicationContextId: input.applicationContext.id,
    demands: input.demands,
    candidateFacts,
    careerKnowledgeRules: input.careerKnowledgeRules,
    createdAt: input.createdAt,
  });
  const referenceBySourcePath = new Map(
    authorizedReferences.map((reference) => [reference.sourcePath, reference]),
  );
  const composition = await composeSourceCvVariantPlan({
    mode: "auto_recommended",
    callerUserId: input.callerUserId,
    applicationContext: input.applicationContext,
    sourceCv: input.sourceCv,
    evidenceGraph,
    cvItemReferences: authorizedReferences,
    factReferenceBindings: candidateFacts.map((fact) => {
      const reference = referenceBySourcePath.get(fact.sourcePath);
      if (!reference) {
        throw new TypeError(
          `candidate fact lacks an authorized source CV reference: ${fact.id}`,
        );
      }
      return {
        candidateFactId: fact.id,
        cvItemReferenceId: reference.id,
      };
    }),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  if (composition.mode !== "auto_recommended") {
    throw new TypeError("automatic source CV composition returned wrong mode");
  }
  return {
    ...composition,
    cvItemReferences: authorizedReferences,
    candidateFacts,
    evidenceGraph,
  };
}

function assertCallerOwnsApplicationContext(
  input: SourceCvApplicationCompositionInputV1,
): void {
  if (
    !input.callerUserId?.trim() ||
    input.callerUserId !== input.applicationContext?.userId
  ) {
    throw new TypeError(
      "source CV application composition caller user does not own the application context",
    );
  }
}

function assertAutoRecommendedInput(
  input: AutoRecommendedSourceCvApplicationCompositionInputV1,
): void {
  if (!input.sourceDocumentId?.trim()) {
    throw new TypeError(
      "source CV application composition requires sourceDocumentId",
    );
  }
  if (
    !Array.isArray(input.demands) ||
    !Array.isArray(input.authorizedCvItemReferenceIds) ||
    !Array.isArray(input.careerKnowledgeRules)
  ) {
    throw new TypeError(
      "source CV application composition requires demands, authorizations, and career knowledge rules",
    );
  }
  if (!Number.isFinite(input.createdAt) || !Number.isFinite(input.updatedAt)) {
    throw new TypeError(
      "source CV application composition requires numeric timestamps",
    );
  }
}

function resolveAuthorizedReferences(
  references: readonly CandidateCvItemReferenceV1[],
  authorizedReferenceIds: readonly string[],
): readonly CandidateCvItemReferenceV1[] {
  const referencesById = new Map(
    references.map((reference) => [reference.id, reference]),
  );
  const seen = new Set<string>();
  const authorizedReferences = authorizedReferenceIds.map((referenceId) => {
    if (typeof referenceId !== "string" || !referenceId.trim()) {
      throw new TypeError(
        "authorized source CV item reference requires a stable ID",
      );
    }
    if (seen.has(referenceId)) {
      throw new TypeError(
        `duplicate authorized source CV item reference: ${referenceId}`,
      );
    }
    const reference = referencesById.get(referenceId);
    if (!reference) {
      throw new TypeError(
        `unknown authorized source CV item reference: ${referenceId}`,
      );
    }
    seen.add(referenceId);
    return reference;
  });

  return authorizedReferences.sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}
