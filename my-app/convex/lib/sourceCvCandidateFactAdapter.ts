import type { CvDocument } from "../../src/types/cvDocument";
import type { CareerKnowledgeRuleV1 } from "../../src/modules/career-knowledge/schema";
import { buildCandidateCvFacts } from "../../src/modules/candidate-evidence/candidateCvFacts";
import { buildCandidateCvItemReferences } from "../../src/modules/candidate-evidence/cvItemReferences";
import { buildCandidateFactHash } from "../../src/modules/candidate-evidence/fingerprints";
import type {
  CandidateCvItemReferenceV1,
  CandidateFactV1,
  CandidateSourceDocumentV1,
} from "../../src/modules/candidate-evidence/schema";
import { buildEvidenceGraph } from "../../src/modules/evidence-graph/buildEvidenceGraph";
import type { JobDemandV1 } from "../../src/modules/evidence-graph/schema";
import { composeSourceCvVariantPlan } from "../../src/modules/application-harness/sourceCvComposition";
import type { AutoRecommendedSourceCvApplicationCompositionResultV1 } from "../../src/modules/application-harness/sourceCvApplicationComposition";
import type { ApplicationContextV1 } from "../../src/modules/application-harness/schema";

export type CandidateEvidencePersistencePortV1 = Readonly<{
  listSourceDocumentsForCanonicalCv(input: Readonly<{
    userId: string;
    canonicalCvId: string;
  }>): Promise<readonly CandidateSourceDocumentV1[]>;
  listFactsForSourceDocument(input: Readonly<{
    userId: string;
    sourceDocumentId: string;
  }>): Promise<readonly CandidateFactV1[]>;
}>;

export type BuildSourceCvCandidateFactApplicationCompositionInputV1 =
  Readonly<{
    persistence: CandidateEvidencePersistencePortV1;
    callerUserId: string;
    applicationContext: ApplicationContextV1;
    sourceCv: Readonly<CvDocument>;
    demands: readonly JobDemandV1[];
    careerKnowledgeRules: readonly CareerKnowledgeRuleV1[];
    createdAt: number;
    updatedAt: number;
  }>;

export async function buildSourceCvCandidateFactApplicationComposition(
  input: BuildSourceCvCandidateFactApplicationCompositionInputV1,
): Promise<AutoRecommendedSourceCvApplicationCompositionResultV1> {
  assertOwningSourceCvContext(input);

  const userId = input.applicationContext.userId;
  const canonicalCvId = input.applicationContext.candidate.cvId;
  const sourceDocuments =
    await input.persistence.listSourceDocumentsForCanonicalCv({
      userId,
      canonicalCvId,
    });
  const sortedSourceDocuments = validateAndSortSourceDocuments(
    sourceDocuments,
    userId,
    canonicalCvId,
  );
  const persistedFacts = (
    await Promise.all(
      sortedSourceDocuments.map(async (sourceDocument) => {
        return input.persistence.listFactsForSourceDocument({
          userId,
          sourceDocumentId: sourceDocument.id,
        });
      }),
    )
  ).flat();

  const factsBySourceDocumentId = validateAndGroupCandidateFacts(
    persistedFacts,
    sortedSourceDocuments,
    userId,
  );
  const allReferences = buildCandidateCvItemReferences(input.sourceCv);
  const referenceBySourcePath = buildReferenceBySourcePath(allReferences);
  const selectedFactByReferenceId = new Map<string, CandidateFactV1>();

  for (const sourceDocument of sortedSourceDocuments) {
    const usablePersistedFacts = (
      factsBySourceDocumentId.get(sourceDocument.id) ?? []
    )
      .filter(isAllowedApplicationFact)
      .sort((left, right) => left.id.localeCompare(right.id));
    const currentFacts = await buildCandidateCvFacts({
      userId,
      sourceDocumentId: sourceDocument.id,
      document: input.sourceCv,
      references: allReferences,
      reviewState: "approved",
      visibility: "use_in_applications",
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    });

    for (const currentFact of currentFacts) {
      const persistedFact = await findCurrentPersistedFact(
        usablePersistedFacts,
        currentFact,
      );
      if (!persistedFact) {
        continue;
      }
      const reference = referenceBySourcePath.get(currentFact.sourcePath);
      if (!reference) {
        throw new TypeError(
          `current candidate fact lacks a stable source CV reference: ${currentFact.id}`,
        );
      }
      if (!selectedFactByReferenceId.has(reference.id)) {
        selectedFactByReferenceId.set(reference.id, persistedFact);
      }
    }
  }

  const eligibleEntries = [...selectedFactByReferenceId.entries()].sort(
    ([leftReferenceId], [rightReferenceId]) =>
      leftReferenceId.localeCompare(rightReferenceId),
  );
  const eligibleCandidateFacts = eligibleEntries.map(([, fact]) => fact);
  const preliminaryEvidenceGraph = await buildEvidenceGraph({
    userId,
    applicationContextId: input.applicationContext.id,
    demands: input.demands,
    candidateFacts: eligibleCandidateFacts,
    careerKnowledgeRules: input.careerKnowledgeRules,
    createdAt: input.createdAt,
  });
  const referencedCandidateFactIds = new Set([
    ...preliminaryEvidenceGraph.matches.map((match) => match.candidateFactId),
    ...preliminaryEvidenceGraph.allowedClaims.flatMap(
      (claim) => claim.candidateFactIds,
    ),
  ]);
  const selectedEntries = eligibleEntries.filter(([, fact]) =>
    referencedCandidateFactIds.has(fact.id),
  );
  const candidateFacts = selectedEntries.map(([, fact]) => fact);
  const cvItemReferences = selectedEntries.map(([referenceId]) => {
    const reference = allReferences.find(
      (candidate) => candidate.id === referenceId,
    );
    if (!reference) {
      throw new TypeError(
        `selected candidate fact lacks a current CV reference: ${referenceId}`,
      );
    }
    return reference;
  });
  const evidenceGraph =
    selectedEntries.length === eligibleEntries.length
      ? preliminaryEvidenceGraph
      : await buildEvidenceGraph({
          userId,
          applicationContextId: input.applicationContext.id,
          demands: input.demands,
          candidateFacts,
          careerKnowledgeRules: input.careerKnowledgeRules,
          createdAt: input.createdAt,
        });
  const composition = await composeSourceCvVariantPlan({
    mode: "auto_recommended",
    callerUserId: input.callerUserId,
    applicationContext: input.applicationContext,
    sourceCv: input.sourceCv,
    evidenceGraph,
    cvItemReferences,
    factReferenceBindings: selectedEntries.map(
      ([cvItemReferenceId, fact]) => ({
        candidateFactId: fact.id,
        cvItemReferenceId,
      }),
    ),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  if (composition.mode !== "auto_recommended") {
    throw new TypeError(
      "candidate-fact adapter returned the wrong source CV composition mode",
    );
  }

  return {
    ...composition,
    cvItemReferences,
    candidateFacts,
    evidenceGraph,
  };
}

function assertOwningSourceCvContext(
  input: BuildSourceCvCandidateFactApplicationCompositionInputV1,
): void {
  if (
    !input?.callerUserId?.trim() ||
    input.callerUserId !== input.applicationContext?.userId
  ) {
    throw new TypeError(
      "source CV candidate-fact adapter caller does not own the application context",
    );
  }
  if (
    input.applicationContext.candidate?.sourceKind !== "cv" ||
    !input.applicationContext.candidate.cvId?.trim() ||
    !input.sourceCv?.id?.trim() ||
    input.applicationContext.candidate.cvId !== input.sourceCv.id
  ) {
    throw new TypeError(
      "source CV does not match the candidate-fact adapter application context",
    );
  }
  if (
    !Array.isArray(input.demands) ||
    !Array.isArray(input.careerKnowledgeRules) ||
    !Number.isFinite(input.createdAt) ||
    !Number.isFinite(input.updatedAt)
  ) {
    throw new TypeError(
      "source CV candidate-fact adapter requires demands, rules, and numeric timestamps",
    );
  }
}

function validateAndSortSourceDocuments(
  sourceDocuments: readonly CandidateSourceDocumentV1[],
  userId: string,
  canonicalCvId: string,
): readonly CandidateSourceDocumentV1[] {
  const seenIds = new Set<string>();
  for (const sourceDocument of sourceDocuments) {
    if (
      sourceDocument.userId !== userId ||
      sourceDocument.canonicalCvId !== canonicalCvId
    ) {
      throw new TypeError(
        "candidate source document is outside the owning user/CV scope",
      );
    }
    if (seenIds.has(sourceDocument.id)) {
      throw new TypeError(
        `duplicate candidate source document identity: ${sourceDocument.id}`,
      );
    }
    seenIds.add(sourceDocument.id);
  }

  const eligibleSourceDocuments = sourceDocuments.filter(
    (sourceDocument) =>
      sourceDocument.reviewState === "approved" &&
      sourceDocument.visibility === "use_in_applications",
  );
  if (eligibleSourceDocuments.length === 0) {
    throw new TypeError(
      "no approved application-visible source document is available for source CV plan preparation",
    );
  }

  return [...eligibleSourceDocuments].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function validateAndGroupCandidateFacts(
  facts: readonly CandidateFactV1[],
  sourceDocuments: readonly CandidateSourceDocumentV1[],
  userId: string,
): ReadonlyMap<string, readonly CandidateFactV1[]> {
  const sourceDocumentIds = new Set(
    sourceDocuments.map((sourceDocument) => sourceDocument.id),
  );
  const seenFactIds = new Set<string>();
  const factsBySourceDocumentId = new Map<string, CandidateFactV1[]>();

  for (const fact of facts) {
    if (
      fact.userId !== userId ||
      !sourceDocumentIds.has(fact.sourceDocumentId)
    ) {
      throw new TypeError(
        "candidate fact is outside the owning source-document scope",
      );
    }
    if (seenFactIds.has(fact.id)) {
      throw new TypeError(`duplicate persisted candidate fact: ${fact.id}`);
    }
    seenFactIds.add(fact.id);
    const grouped = factsBySourceDocumentId.get(fact.sourceDocumentId) ?? [];
    grouped.push(fact);
    factsBySourceDocumentId.set(fact.sourceDocumentId, grouped);
  }

  return factsBySourceDocumentId;
}

function buildReferenceBySourcePath(
  references: readonly CandidateCvItemReferenceV1[],
): ReadonlyMap<string, CandidateCvItemReferenceV1> {
  const referenceBySourcePath = new Map<
    string,
    CandidateCvItemReferenceV1
  >();
  for (const reference of references) {
    if (referenceBySourcePath.has(reference.sourcePath)) {
      throw new TypeError(
        `duplicate source CV reference path: ${reference.sourcePath}`,
      );
    }
    referenceBySourcePath.set(reference.sourcePath, reference);
  }
  return referenceBySourcePath;
}

function isAllowedApplicationFact(fact: CandidateFactV1): boolean {
  return (
    fact.reviewState === "approved" &&
    fact.visibility === "use_in_applications"
  );
}

async function findCurrentPersistedFact(
  persistedFacts: readonly CandidateFactV1[],
  currentFact: CandidateFactV1,
): Promise<CandidateFactV1 | undefined> {
  for (const persistedFact of persistedFacts) {
    if (
      persistedFact.userId !== currentFact.userId ||
      persistedFact.sourceDocumentId !== currentFact.sourceDocumentId ||
      persistedFact.sourcePath !== currentFact.sourcePath ||
      persistedFact.factType !== currentFact.factType
    ) {
      continue;
    }

    const expectedHash = await buildCandidateFactHash({
      userId: currentFact.userId,
      sourceDocumentId: currentFact.sourceDocumentId,
      sourcePath: currentFact.sourcePath,
      ...(persistedFact.sourceQuote
        ? { sourceQuote: persistedFact.sourceQuote }
        : {}),
      factType: currentFact.factType,
      value: currentFact.value,
      ...(persistedFact.normalizedText && currentFact.normalizedText
        ? { normalizedText: currentFact.normalizedText }
        : {}),
    });
    if (persistedFact.id === `candidate-fact:${expectedHash}`) {
      return projectCandidateFactContract(persistedFact);
    }
  }

  return undefined;
}

function projectCandidateFactContract(
  fact: CandidateFactV1,
): CandidateFactV1 {
  return {
    id: fact.id,
    userId: fact.userId,
    sourceDocumentId: fact.sourceDocumentId,
    sourcePath: fact.sourcePath,
    ...(fact.sourceQuote !== undefined
      ? { sourceQuote: fact.sourceQuote }
      : {}),
    factType: fact.factType,
    value: fact.value,
    ...(fact.normalizedText !== undefined
      ? { normalizedText: fact.normalizedText }
      : {}),
    ...(fact.confidence !== undefined ? { confidence: fact.confidence } : {}),
    reviewState: fact.reviewState,
    visibility: fact.visibility,
    createdAt: fact.createdAt,
    updatedAt: fact.updatedAt,
    version: fact.version,
  };
}
