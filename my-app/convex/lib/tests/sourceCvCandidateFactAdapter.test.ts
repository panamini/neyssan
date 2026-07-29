import { describe, expect, it } from "vitest";

import type { CvDocument } from "../../../src/types/cvDocument";
import { buildCandidateCvFacts } from "../../../src/modules/candidate-evidence/candidateCvFacts";
import { buildCandidateCvItemReferences } from "../../../src/modules/candidate-evidence/cvItemReferences";
import { buildCandidateFactHash } from "../../../src/modules/candidate-evidence/fingerprints";
import type {
  CandidateFactV1,
  CandidateSourceDocumentV1,
} from "../../../src/modules/candidate-evidence/schema";
import type { JobDemandV1 } from "../../../src/modules/evidence-graph/schema";
import type { ApplicationContextV1 } from "../../../src/modules/application-harness/schema";
import {
  buildSourceCvCandidateFactApplicationComposition,
  type CandidateEvidencePersistencePortV1,
} from "../sourceCvCandidateFactAdapter";

const T = Date.UTC(2026, 6, 29);

function sourceCv(experienceText = "Customer service"): CvDocument {
  return {
    id: "cv-source-1",
    title: "Source CV",
    metadata: {
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
      version: 1,
    },
    sections: [
      {
        id: "section-experience",
        title: "Experience",
        type: "experience",
        blocks: [],
        structuredContent: [
          {
            id: "exp-bakery",
            company: "Bakery One",
            position: "Sales associate",
            startDate: "2024-01-01",
            responsibilityBullets: [experienceText],
          },
        ],
      },
      {
        id: "section-skills",
        title: "Skills",
        type: "skills",
        blocks: [],
        structuredContent: [
          {
            id: "skill-typescript",
            name: "TypeScript",
            level: "Advanced",
          },
        ],
      },
    ],
  };
}

function applicationContext(
  overrides: Partial<ApplicationContextV1> = {},
): ApplicationContextV1 {
  return {
    id: "application-context:job-source-cv",
    userId: "user-owner",
    job: {
      jobId: "job-bakery-1",
      rawTextHash: "job-brief-hash",
    },
    candidate: {
      sourceKind: "cv",
      cvId: "cv-source-1",
      candidateHash: "candidate-hash",
    },
    settingsHash: "settings-hash",
    contextHash: "context-hash",
    reviewState: "approved",
    sourceRefs: [],
    createdAt: T,
    updatedAt: T,
    version: 1,
    ...overrides,
  };
}

function demands(): readonly JobDemandV1[] {
  return [
    {
      id: "demand:customer-service",
      kind: "skill",
      label: "Customer service",
      required: "required",
      source: "job",
      sourcePath: "job.mustHaves",
      version: 1,
    },
    {
      id: "demand:typescript",
      kind: "skill",
      label: "TypeScript",
      required: "preferred",
      source: "job",
      sourcePath: "job.keywords",
      version: 1,
    },
  ];
}

function sourceDocument(
  id: string,
  overrides: Partial<CandidateSourceDocumentV1> = {},
): CandidateSourceDocumentV1 {
  return {
    id,
    userId: "user-owner",
    canonicalCvId: "cv-source-1",
    sourceType: "uploaded_cv",
    textHash: `text:${id}`,
    sourceHash: `source:${id}`,
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: T,
    updatedAt: T,
    version: 1,
    ...overrides,
  };
}

async function currentFactsForSource(
  document: CvDocument,
  documentId: string,
): Promise<readonly CandidateFactV1[]> {
  return buildCandidateCvFacts({
    userId: "user-owner",
    sourceDocumentId: documentId,
    document,
    references: buildCandidateCvItemReferences(document),
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: T,
    updatedAt: T,
  });
}

async function withPersistedProvenance(
  fact: CandidateFactV1,
  provenance: Readonly<{
    sourceQuote: string;
    confidence: number;
    createdAt?: number;
    updatedAt?: number;
  }>,
): Promise<CandidateFactV1> {
  const hash = await buildCandidateFactHash({
    userId: fact.userId,
    sourceDocumentId: fact.sourceDocumentId,
    sourcePath: fact.sourcePath,
    sourceQuote: provenance.sourceQuote,
    factType: fact.factType,
    value: fact.value,
    ...(fact.normalizedText ? { normalizedText: fact.normalizedText } : {}),
  });

  return {
    ...fact,
    id: `candidate-fact:${hash}`,
    sourceQuote: provenance.sourceQuote,
    confidence: provenance.confidence,
    ...(provenance.createdAt !== undefined
      ? { createdAt: provenance.createdAt }
      : {}),
    ...(provenance.updatedAt !== undefined
      ? { updatedAt: provenance.updatedAt }
      : {}),
  };
}

type Tables = Readonly<{
  sourceDocuments: readonly CandidateSourceDocumentV1[];
  facts: readonly CandidateFactV1[];
}>;

function makeDb(tables: Tables, ignoreScope = false) {
  const queries: Array<{
    operation: string;
    scope: Record<string, string>;
  }> = [];

  const persistence: CandidateEvidencePersistencePortV1 = {
    async listSourceDocumentsForCanonicalCv(scope) {
      queries.push({
        operation: "listSourceDocumentsForCanonicalCv",
        scope: { ...scope },
      });
      return ignoreScope
        ? tables.sourceDocuments
        : tables.sourceDocuments.filter(
            (sourceDocument) =>
              sourceDocument.userId === scope.userId &&
              sourceDocument.canonicalCvId === scope.canonicalCvId,
          );
    },
    async listFactsForSourceDocument(scope) {
      queries.push({
        operation: "listFactsForSourceDocument",
        scope: { ...scope },
      });
      return ignoreScope
        ? tables.facts
        : tables.facts.filter(
            (fact) =>
              fact.userId === scope.userId &&
              fact.sourceDocumentId === scope.sourceDocumentId,
          );
    },
  };

  return { queries, persistence };
}

function adapterInput(
  persistence: ReturnType<typeof makeDb>["persistence"],
  document = sourceCv(),
) {
  return {
    persistence,
    callerUserId: "user-owner",
    applicationContext: applicationContext(),
    sourceCv: document,
    demands: demands(),
    careerKnowledgeRules: [],
    createdAt: T,
    updatedAt: T,
  } as const;
}

describe("source CV candidate-fact persistence adapter", () => {
  it("selects only current approved application-visible facts through owner and CV scoped queries", async () => {
    const document = sourceCv();
    const linked = sourceDocument("candidate-source-document:linked");
    const linkedPrivate = sourceDocument(
      "candidate-source-document:private-skill",
    );
    const currentFacts = await currentFactsForSource(document, linked.id);
    const experience = currentFacts.find(
      (fact) => fact.factType === "experience",
    )!;
    const pendingSkill = {
      ...currentFacts.find((fact) => fact.factType === "skill")!,
      reviewState: "pending" as const,
    };
    const privateSkill = {
      ...(
        await currentFactsForSource(document, linkedPrivate.id)
      ).find((fact) => fact.factType === "skill")!,
      visibility: "private" as const,
    };
    const tables = {
      sourceDocuments: [linked, linkedPrivate],
      facts: [experience, pendingSkill, privateSkill],
    };
    const beforeTables = JSON.stringify(tables);
    const beforeCv = JSON.stringify(document);
    const { persistence, queries } = makeDb(tables);

    const result = await buildSourceCvCandidateFactApplicationComposition(
      adapterInput(persistence, document),
    );

    expect(result.candidateFacts.map((fact) => fact.id)).toEqual([
      experience.id,
    ]);
    expect(result.cvItemReferences).toHaveLength(1);
    const includedItems = result.plan.items.filter(
      (item) => item.action === "include",
    );
    expect(includedItems.length).toBeGreaterThan(0);
    expect(
      includedItems.every((item) => item.reviewState === "pending"),
    ).toBe(true);
    expect(queries).toContainEqual({
      operation: "listSourceDocumentsForCanonicalCv",
      scope: {
        userId: "user-owner",
        canonicalCvId: "cv-source-1",
      },
    });
    expect(queries).toContainEqual({
      operation: "listFactsForSourceDocument",
      scope: {
        userId: "user-owner",
        sourceDocumentId: linked.id,
      },
    });
    expect(JSON.stringify(tables)).toBe(beforeTables);
    expect(JSON.stringify(document)).toBe(beforeCv);
  });

  it.each([
    ["pending review", { reviewState: "pending" as const }],
    ["rejected review", { reviewState: "rejected" as const }],
    ["archived review", { reviewState: "archived" as const }],
    ["private visibility", { visibility: "private" as const }],
    ["never-use visibility", { visibility: "never_use" as const }],
  ])(
    "excludes a source with %s before fact lookup and fails when none remain",
    async (_label, overrides) => {
      const document = sourceCv();
      const ineligible = sourceDocument(
        "candidate-source-document:ineligible",
        overrides,
      );
      const tables = {
        sourceDocuments: [ineligible],
        facts: await currentFactsForSource(document, ineligible.id),
      };
      const beforeTables = JSON.stringify(tables);
      const beforeCv = JSON.stringify(document);
      const { persistence, queries } = makeDb(tables);

      await expect(
        buildSourceCvCandidateFactApplicationComposition(
          adapterInput(persistence, document),
        ),
      ).rejects.toThrow(/no approved application-visible source document/i);

      expect(
        queries.some(
          (query) => query.operation === "listFactsForSourceDocument",
        ),
      ).toBe(false);
      expect(JSON.stringify(tables)).toBe(beforeTables);
      expect(JSON.stringify(document)).toBe(beforeCv);
    },
  );

  it("uses only eligible sources when eligible and revoked documents are mixed", async () => {
    const document = sourceCv();
    const eligible = sourceDocument("candidate-source-document:eligible");
    const revoked = sourceDocument("candidate-source-document:revoked", {
      reviewState: "rejected",
      visibility: "never_use",
    });
    const eligibleFacts = await currentFactsForSource(document, eligible.id);
    const revokedFacts = await currentFactsForSource(document, revoked.id);
    const tables = {
      sourceDocuments: [revoked, eligible],
      facts: [...revokedFacts, ...eligibleFacts],
    };
    const beforeTables = JSON.stringify(tables);
    const beforeCv = JSON.stringify(document);
    const { persistence, queries } = makeDb(tables);

    const result = await buildSourceCvCandidateFactApplicationComposition(
      adapterInput(persistence, document),
    );

    expect(result.candidateFacts.length).toBeGreaterThan(0);
    expect(
      result.candidateFacts.every(
        (fact) => fact.sourceDocumentId === eligible.id,
      ),
    ).toBe(true);
    expect(
      queries
        .filter((query) => query.operation === "listFactsForSourceDocument")
        .map((query) => query.scope.sourceDocumentId),
    ).toEqual([eligible.id]);
    expect(JSON.stringify(tables)).toBe(beforeTables);
    expect(JSON.stringify(document)).toBe(beforeCv);
  });

  it("fails explicitly when no linked source document is eligible", async () => {
    const document = sourceCv();
    const empty = makeDb({ sourceDocuments: [], facts: [] });

    await expect(
      buildSourceCvCandidateFactApplicationComposition(
        adapterInput(empty.persistence, document),
      ),
    ).rejects.toThrow(/no approved application-visible source document/i);

    expect(empty.queries).toEqual([
      {
        operation: "listSourceDocumentsForCanonicalCv",
        scope: {
          userId: "user-owner",
          canonicalCvId: "cv-source-1",
        },
      },
    ]);
  });

  it("invalidates a persisted fact after the referenced CV item is edited", async () => {
    const historicalCv = sourceCv("Customer service");
    const currentCv = sourceCv("Inventory management");
    const linked = sourceDocument("candidate-source-document:linked");
    const staleFacts = await Promise.all(
      (await currentFactsForSource(historicalCv, linked.id))
        .filter((fact) => fact.factType === "experience")
        .map((fact) =>
          withPersistedProvenance(fact, {
            sourceQuote: "Customer service",
            confidence: 0.9,
          }),
        ),
    );
    const { persistence } = makeDb({
      sourceDocuments: [linked],
      facts: staleFacts,
    });

    const result = await buildSourceCvCandidateFactApplicationComposition(
      adapterInput(persistence, currentCv),
    );

    expect(result.candidateFacts).toEqual([]);
    expect(
      result.plan.items.some((item) => item.action === "include"),
    ).toBe(false);
  });

  it("ignores an approved current fact that is unrelated to every job demand", async () => {
    const document = sourceCv();
    const linked = sourceDocument("candidate-source-document:linked");
    const facts = await currentFactsForSource(document, linked.id);
    const { persistence } = makeDb({
      sourceDocuments: [linked],
      facts,
    });

    const result = await buildSourceCvCandidateFactApplicationComposition({
      ...adapterInput(persistence, document),
      demands: [demands()[0]!],
    });

    expect(result.candidateFacts).toHaveLength(1);
    expect(
      result.candidateFacts[0]?.normalizedText
        ?.toLocaleLowerCase()
        .includes("customer service"),
    ).toBe(true);
    expect(
      result.candidateFacts.some((fact) =>
        fact.normalizedText?.toLocaleLowerCase().includes("typescript"),
      ),
    ).toBe(false);
  });

  it("excludes historical unlinked and cross-user sources without querying their facts", async () => {
    const document = sourceCv();
    const linked = sourceDocument("candidate-source-document:linked");
    const unlinked = sourceDocument("candidate-source-document:unlinked", {
      canonicalCvId: undefined,
    });
    const otherUser = sourceDocument("candidate-source-document:other-user", {
      userId: "user-other",
    });
    const facts = (
      await Promise.all(
        [linked, unlinked, otherUser].map((source) =>
          buildCandidateCvFacts({
            userId: source.userId,
            sourceDocumentId: source.id,
            document,
            references: buildCandidateCvItemReferences(document),
            reviewState: "approved",
            visibility: "use_in_applications",
            createdAt: T,
            updatedAt: T,
          }),
        ),
      )
    ).flat();
    const { persistence, queries } = makeDb({
      sourceDocuments: [unlinked, otherUser, linked],
      facts,
    });

    const result = await buildSourceCvCandidateFactApplicationComposition(
      adapterInput(persistence, document),
    );

    expect(result.candidateFacts).not.toHaveLength(0);
    expect(
      result.candidateFacts.every(
        (fact) => fact.sourceDocumentId === linked.id,
      ),
    ).toBe(true);
    expect(
      queries
        .filter(
          (query) => query.operation === "listFactsForSourceDocument",
        )
        .map((query) => query.scope.sourceDocumentId),
    ).toEqual([linked.id]);
  });

  it("preserves persisted provenance and fact identity across run timestamps", async () => {
    const document = sourceCv();
    const linked = sourceDocument("candidate-source-document:linked");
    const persistedExperience = await withPersistedProvenance(
      (await currentFactsForSource(document, linked.id)).find(
        (fact) => fact.factType === "experience",
      )!,
      {
        sourceQuote: "Customer service",
        confidence: 0.93,
        createdAt: T - 2_000,
        updatedAt: T - 1_000,
      },
    );
    const persistedRow = {
      ...persistedExperience,
      _id: "convex-candidate-fact-id",
      _creationTime: T - 3_000,
    };
    const { persistence } = makeDb({
      sourceDocuments: [linked],
      facts: [persistedRow],
    });

    const first = await buildSourceCvCandidateFactApplicationComposition(
      adapterInput(persistence, document),
    );
    const second = await buildSourceCvCandidateFactApplicationComposition({
      ...adapterInput(persistence, document),
      createdAt: T + 10_000,
      updatedAt: T + 10_000,
    });

    expect(first.candidateFacts).toEqual([persistedExperience]);
    expect(first.candidateFacts[0]).not.toHaveProperty("_id");
    expect(first.candidateFacts[0]).not.toHaveProperty("_creationTime");
    expect(second.candidateFacts).toEqual(first.candidateFacts);
    expect(second.evidenceGraph.candidateEvidenceHash).toBe(
      first.evidenceGraph.candidateEvidenceHash,
    );
  });

  it("deduplicates equivalent authorized items deterministically across linked sources", async () => {
    const document = sourceCv();
    const firstSource = sourceDocument("candidate-source-document:a");
    const secondSource = sourceDocument("candidate-source-document:b");
    const firstFacts = await Promise.all(
      (await currentFactsForSource(document, firstSource.id)).map((fact) =>
        withPersistedProvenance(fact, {
          sourceQuote: `primary:${fact.factType}`,
          confidence: 0.7,
        }),
      ),
    );
    const secondFacts = await Promise.all(
      (await currentFactsForSource(document, secondSource.id)).map((fact) =>
        withPersistedProvenance(fact, {
          sourceQuote: `secondary:${fact.factType}`,
          confidence: 0.95,
        }),
      ),
    );
    const firstDb = makeDb({
      sourceDocuments: [secondSource, firstSource],
      facts: [...secondFacts, ...firstFacts],
    }).persistence;
    const secondDb = makeDb({
      sourceDocuments: [firstSource, secondSource],
      facts: [...firstFacts, ...secondFacts],
    }).persistence;

    const first = await buildSourceCvCandidateFactApplicationComposition(
      adapterInput(firstDb, document),
    );
    const second = await buildSourceCvCandidateFactApplicationComposition(
      adapterInput(secondDb, document),
    );

    expect(first.candidateFacts).toHaveLength(2);
    expect(second.candidateFacts.map((fact) => fact.id)).toEqual(
      first.candidateFacts.map((fact) => fact.id),
    );
    expect(
      first.candidateFacts.every(
        (fact) =>
          fact.sourceDocumentId === firstSource.id &&
          fact.sourceQuote?.startsWith("primary:"),
      ),
    ).toBe(true);
    expect(second.plan.items).toEqual(first.plan.items);
  });

  it("fails closed before persistence reads when caller or CV context does not match", async () => {
    const empty = makeDb({ sourceDocuments: [], facts: [] });

    await expect(
      buildSourceCvCandidateFactApplicationComposition({
        ...adapterInput(empty.persistence),
        callerUserId: "user-other",
      }),
    ).rejects.toThrow(/caller.*own/i);
    await expect(
      buildSourceCvCandidateFactApplicationComposition({
        ...adapterInput(empty.persistence),
        applicationContext: applicationContext({
          candidate: {
            sourceKind: "cv",
            cvId: "cv-other",
            candidateHash: "candidate-other",
          },
        }),
      }),
    ).rejects.toThrow(/source CV.*context/i);
    expect(empty.queries).toEqual([]);
  });

  it("fails closed if persistence returns a source or fact outside the owner/CV scope", async () => {
    const invalidSources = [
      sourceDocument("candidate-source-document:foreign", {
        userId: "user-other",
        reviewState: "rejected",
      }),
      sourceDocument("candidate-source-document:wrong-cv", {
        canonicalCvId: "cv-other",
        visibility: "private",
      }),
      sourceDocument("candidate-source-document:unlinked", {
        canonicalCvId: undefined,
        visibility: "never_use",
      }),
    ];

    for (const invalidSource of invalidSources) {
      const malicious = makeDb(
        {
          sourceDocuments: [invalidSource],
          facts: [],
        },
        true,
      );
      await expect(
        buildSourceCvCandidateFactApplicationComposition(
          adapterInput(malicious.persistence),
        ),
      ).rejects.toThrow(/source document.*owner|scope/i);
    }

    const linked = sourceDocument("candidate-source-document:linked");
    const crossUserFact = {
      ...(await currentFactsForSource(sourceCv(), linked.id))[0]!,
      userId: "user-other",
    };
    const maliciousFact = makeDb(
      {
        sourceDocuments: [linked],
        facts: [crossUserFact],
      },
      true,
    );
    await expect(
      buildSourceCvCandidateFactApplicationComposition(
        adapterInput(maliciousFact.persistence),
      ),
    ).rejects.toThrow(/candidate fact.*owner|scope/i);
  });
});
