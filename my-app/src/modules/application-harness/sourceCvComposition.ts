import type { CvDocument } from "../../types/cvDocument";
import type { CandidateCvItemReferenceV1 } from "../candidate-evidence/schema";
import { resolveCandidateCvItemReference } from "../candidate-evidence/cvItemReferences";
import type { EvidenceGraphV1 } from "../evidence-graph/schema";
import { buildResumeVariantPlan } from "../resume-variant-plan/buildResumeVariantPlan";
import type {
  ResumeVariantPlanSourceCvFactBindingV1,
  ResumeVariantPlanV1,
} from "../resume-variant-plan/schema";
import type { ApplicationContextV1 } from "./schema";

type SourceCvCompositionBaseInputV1 = Readonly<{
  callerUserId: string;
  applicationContext: ApplicationContextV1;
  sourceCv: Readonly<CvDocument>;
}>;

export type AutoRecommendedSourceCvCompositionInputV1 =
  SourceCvCompositionBaseInputV1 &
    Readonly<{
      mode?: "auto_recommended";
      evidenceGraph: EvidenceGraphV1;
      cvItemReferences: readonly CandidateCvItemReferenceV1[];
      factReferenceBindings: readonly Readonly<{
        candidateFactId: string;
        cvItemReferenceId: string;
      }>[];
      createdAt: number;
      updatedAt: number;
    }>;

export type FullSourceCvCompositionInputV1 =
  SourceCvCompositionBaseInputV1 &
    Readonly<{
      mode: "full_source_cv";
    }>;

export type SourceCvCompositionInputV1 =
  | AutoRecommendedSourceCvCompositionInputV1
  | FullSourceCvCompositionInputV1;

type SourceCvCompositionIdentityV1 = Readonly<{
  userId: string;
  applicationContextId: string;
  sourceCvId: string;
  sourceCvContextHash: string;
}>;

export type SourceCvCompositionResultV1 =
  | (SourceCvCompositionIdentityV1 &
      Readonly<{
        mode: "auto_recommended";
        plan: ResumeVariantPlanV1;
      }>)
  | (SourceCvCompositionIdentityV1 &
      Readonly<{
        mode: "full_source_cv";
        plan: null;
      }>);

export async function composeSourceCvVariantPlan(
  input: SourceCvCompositionInputV1,
): Promise<SourceCvCompositionResultV1> {
  const identity = assertSourceCvContext(input);

  if (input.mode === "full_source_cv") {
    return {
      mode: "full_source_cv",
      ...identity,
      plan: null,
    };
  }
  if (input.mode !== undefined && input.mode !== "auto_recommended") {
    throw new TypeError("unsupported source CV composition mode");
  }

  assertAutoRecommendedContext(input, identity);
  const sourceCvFactBindings = buildValidatedSourceCvFactBindings(input);
  const plan = await buildResumeVariantPlan({
    userId: identity.userId,
    applicationContextId: identity.applicationContextId,
    targetDocumentKind: "cv",
    language: input.applicationContext.candidate.selectedLanguage,
    market: input.applicationContext.candidate.market,
    evidenceGraph: input.evidenceGraph,
    sourceCvId: identity.sourceCvId,
    sourceCvFactBindings,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  return {
    mode: "auto_recommended",
    ...identity,
    plan,
  };
}

function assertSourceCvContext(
  input: SourceCvCompositionInputV1,
): SourceCvCompositionIdentityV1 {
  if (!input || typeof input !== "object") {
    throw new TypeError("source CV composition requires an input object");
  }

  const context = input.applicationContext;
  if (
    !input.callerUserId?.trim() ||
    input.callerUserId !== context?.userId
  ) {
    throw new TypeError(
      "source CV composition caller user does not own the application context",
    );
  }
  if (!context?.id?.trim() || !context.userId?.trim()) {
    throw new TypeError(
      "source CV composition requires an owning user and application context",
    );
  }
  if (
    context.candidate?.sourceKind !== "cv" ||
    !context.candidate.cvId?.trim() ||
    !context.candidate.candidateHash?.trim()
  ) {
    throw new TypeError(
      "source CV composition requires a CV-backed application context",
    );
  }
  if (
    !input.sourceCv?.id?.trim() ||
    input.sourceCv.id !== context.candidate.cvId
  ) {
    throw new TypeError(
      "source CV does not match the owning application context",
    );
  }

  return {
    userId: context.userId,
    applicationContextId: context.id,
    sourceCvId: context.candidate.cvId,
    sourceCvContextHash: context.candidate.candidateHash,
  };
}

function assertAutoRecommendedContext(
  input: AutoRecommendedSourceCvCompositionInputV1,
  identity: SourceCvCompositionIdentityV1,
): void {
  if (input.evidenceGraph?.userId !== identity.userId) {
    throw new TypeError(
      "EvidenceGraph user does not match the owning application context",
    );
  }
  if (
    input.evidenceGraph.applicationContextId !==
    identity.applicationContextId
  ) {
    throw new TypeError(
      "EvidenceGraph application context does not match the owning context",
    );
  }
  if (
    !Array.isArray(input.cvItemReferences) ||
    !Array.isArray(input.factReferenceBindings)
  ) {
    throw new TypeError(
      "auto_recommended composition requires CV references and fact bindings",
    );
  }
  if (!Number.isFinite(input.createdAt) || !Number.isFinite(input.updatedAt)) {
    throw new TypeError(
      "auto_recommended composition requires numeric timestamps",
    );
  }
}

function buildValidatedSourceCvFactBindings(
  input: AutoRecommendedSourceCvCompositionInputV1,
): readonly ResumeVariantPlanSourceCvFactBindingV1[] {
  const referencesById = new Map<string, CandidateCvItemReferenceV1>();
  for (const reference of input.cvItemReferences) {
    if (referencesById.has(reference.id)) {
      throw new TypeError(
        `duplicate source CV item reference: ${reference.id}`,
      );
    }
    const resolved = resolveCandidateCvItemReference(input.sourceCv, reference);
    referencesById.set(resolved.reference.id, resolved.reference);
  }

  const graphCandidateFactIds = new Set([
    ...input.evidenceGraph.matches.map((match) => match.candidateFactId),
    ...input.evidenceGraph.allowedClaims.flatMap(
      (claim) => claim.candidateFactIds,
    ),
  ]);
  const boundCandidateFactIds = new Set<string>();
  const bindings = input.factReferenceBindings.map((binding) => {
    if (
      !binding?.candidateFactId?.trim() ||
      !binding.cvItemReferenceId?.trim()
    ) {
      throw new TypeError(
        "source CV fact binding requires stable fact and reference IDs",
      );
    }
    if (!graphCandidateFactIds.has(binding.candidateFactId)) {
      throw new TypeError(
        `source CV fact binding references an unknown fact: ${binding.candidateFactId}`,
      );
    }
    if (!referencesById.has(binding.cvItemReferenceId)) {
      throw new TypeError(
        `source CV fact binding references an unknown CV item: ${binding.cvItemReferenceId}`,
      );
    }
    if (boundCandidateFactIds.has(binding.candidateFactId)) {
      throw new TypeError(
        `duplicate source CV fact binding: ${binding.candidateFactId}`,
      );
    }
    boundCandidateFactIds.add(binding.candidateFactId);

    return {
      candidateFactId: binding.candidateFactId,
      sourceCvItemReferenceId: binding.cvItemReferenceId,
    };
  });

  return bindings.sort((left, right) =>
    left.candidateFactId.localeCompare(right.candidateFactId),
  );
}
