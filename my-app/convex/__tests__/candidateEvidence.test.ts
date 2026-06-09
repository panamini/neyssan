import { describe, expect, it } from "vitest";

import {
  createOrReuseCandidateFact,
  createOrReuseCandidateImportBatch,
  createOrReuseCandidateSourceDocument,
  listCandidateFactsForSourceDocument,
  patchCandidateFactReviewState,
  patchCandidateFactVisibility,
  patchCandidateImportBatchStatus,
} from "../candidateEvidence";
import { stableSerialize } from "../../src/modules/application-harness/fingerprints";
import {
  buildCandidateFactHash,
  buildCandidateImportBatchHash,
} from "../../src/modules/candidate-evidence/fingerprints";
import type {
  CandidateFactV1,
  CandidateImportBatchV1,
  CandidateSourceDocumentV1,
} from "../../src/modules/candidate-evidence/schema";

const NOW = Date.UTC(2026, 5, 9, 0, 0, 0, 0);
const LATER = NOW + 1000;

type StoredDocument<T> = T & {
  _id: string;
  _creationTime: number;
};

type TableName =
  | "candidateSourceDocuments"
  | "candidateFacts"
  | "candidateImportBatches";

type Constraint = Readonly<{ field: string; value: unknown }>;

function buildSourceDocumentFixture(
  overrides: Partial<CandidateSourceDocumentV1> = {},
): CandidateSourceDocumentV1 {
  return {
    id: "candidate-source-document:source_hash_a",
    userId: "user_123",
    sourceType: "pasted_text",
    title: "Pasted profile notes",
    originalFilename: "profile-notes.txt",
    mimeType: "text/plain",
    textHash: "text_hash_a",
    sourceHash: "source_hash_a",
    reviewState: "pending",
    visibility: "private",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

async function buildFactFixture(
  overrides: Partial<CandidateFactV1> = {},
): Promise<CandidateFactV1> {
  const base = {
    userId: "user_123",
    sourceDocumentId: "candidate-source-document:source_hash_a",
    sourcePath: "document.experience[1].responsibilityBullets[0]",
    sourceQuote: "Built reliable application workflows.",
    factType: "experience" as const,
    value: { company: "Acme", responsibility: "Built reliable application workflows." },
    normalizedText: "Built reliable application workflows at Acme.",
  };
  const merged = {
    ...base,
    ...overrides,
  };
  const id =
    overrides.id ??
    `candidate-fact:${await buildCandidateFactHash({
      userId: merged.userId,
      sourceDocumentId: merged.sourceDocumentId,
      sourcePath: merged.sourcePath,
      ...(merged.sourceQuote ? { sourceQuote: merged.sourceQuote } : {}),
      factType: merged.factType,
      value: merged.value,
      ...(merged.normalizedText ? { normalizedText: merged.normalizedText } : {}),
    })}`;

  return {
    id,
    userId: merged.userId,
    sourceDocumentId: merged.sourceDocumentId,
    sourcePath: merged.sourcePath,
    ...(merged.sourceQuote ? { sourceQuote: merged.sourceQuote } : {}),
    factType: merged.factType,
    value: merged.value,
    ...(merged.normalizedText ? { normalizedText: merged.normalizedText } : {}),
    confidence: 0.91,
    reviewState: "pending",
    visibility: "private",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function buildUnsafeFactFixture(
  overrides: Partial<CandidateFactV1> = {},
): CandidateFactV1 {
  return {
    id: "candidate-fact:unsafe-invalid-source-material",
    userId: "user_123",
    sourceDocumentId: "candidate-source-document:source_hash_a",
    sourcePath: "document.experience[1].responsibilityBullets[0]",
    sourceQuote: "Built reliable application workflows.",
    factType: "experience",
    value: { company: "Acme", responsibility: "Built reliable application workflows." },
    normalizedText: "Built reliable application workflows at Acme.",
    confidence: 0.91,
    reviewState: "pending",
    visibility: "private",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

async function buildImportBatchFixture(
  overrides: Partial<CandidateImportBatchV1> = {},
): Promise<CandidateImportBatchV1> {
  const userId = overrides.userId ?? "user_123";
  const sourceDocumentIds = overrides.sourceDocumentIds ?? [
    "candidate-source-document:source_hash_a",
    "candidate-source-document:source_hash_b",
  ];
  const id =
    overrides.id ??
    `candidate-import-batch:${await buildCandidateImportBatchHash({
      userId,
      sourceDocumentIds,
    })}`;

  return {
    id,
    userId,
    sourceDocumentIds,
    status: "pending",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function makeCtx() {
  const tables: Record<TableName, StoredDocument<any>[]> = {
    candidateSourceDocuments: [],
    candidateFacts: [],
    candidateImportBatches: [],
  };
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
  let sequence = 0;

  function findByStorageId(id: string) {
    for (const tableName of Object.keys(tables) as TableName[]) {
      const document = tables[tableName].find((candidate) => candidate._id === id);
      if (document) {
        return document;
      }
    }
    return null;
  }

  function applyConstraints<T>(documents: StoredDocument<T>[], constraints: Constraint[]) {
    return documents.filter((document) =>
      constraints.every((constraint) => readField(document, constraint.field) === constraint.value),
    );
  }

  const db = {
    insert: async (tableName: TableName, document: any) => {
      sequence += 1;
      const stored = {
        _id: `${tableName}_${sequence}`,
        _creationTime: NOW + sequence,
        ...document,
      };
      tables[tableName].push(stored);
      return stored._id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      const document = findByStorageId(id);
      if (!document) {
        throw new Error(`missing document ${id}`);
      }
      patches.push({ id, patch });
      Object.assign(document, patch);
    },
    query: (tableName: TableName) => ({
      withIndex: (_indexName: string, buildQuery: (query: any) => unknown) => {
        const constraints: Constraint[] = [];
        const query = {
          eq(field: string, value: unknown) {
            constraints.push({ field, value });
            return query;
          },
        };
        buildQuery(query);
        const matching = applyConstraints(tables[tableName], constraints);
        return {
          unique: async () => {
            if (matching.length > 1) {
              throw new Error("expected unique result");
            }
            return matching[0] ?? null;
          },
          order: () => ({
            take: async (limit: number) => matching.slice(0, limit),
          }),
          take: async (limit: number) => matching.slice(0, limit),
        };
      },
    }),
  };

  return {
    ctx: { db },
    tables,
    patches,
  };
}

function readField(document: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, document);
}

describe("candidate evidence Convex shadow persistence", () => {
  it("createOrReuseCandidateSourceDocument inserts once and reuses by sourceHash", async () => {
    const { ctx, tables } = makeCtx();
    const sourceDocument = buildSourceDocumentFixture();

    const firstId = await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument,
    });
    const secondId = await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: { ...sourceDocument, title: "Ignored duplicate caller title" },
    });

    expect(firstId).toBe(secondId);
    expect(tables.candidateSourceDocuments).toHaveLength(1);
  });

  it("same sourceHash for different users does not collide", async () => {
    const { ctx, tables } = makeCtx();

    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: buildSourceDocumentFixture({ userId: "user_123" }),
    });
    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: buildSourceDocumentFixture({ userId: "user_456" }),
    });

    expect(tables.candidateSourceDocuments).toHaveLength(2);
    expect(tables.candidateSourceDocuments.map((document) => document.userId)).toEqual([
      "user_123",
      "user_456",
    ]);
  });

  it("source document stores hashes and metadata but not raw text", async () => {
    const { ctx, tables } = makeCtx();

    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: buildSourceDocumentFixture(),
    });

    expect(tables.candidateSourceDocuments[0]).toMatchObject({
      textHash: "text_hash_a",
      sourceHash: "source_hash_a",
      originalFilename: "profile-notes.txt",
      mimeType: "text/plain",
    });
    expect(tables.candidateSourceDocuments[0]).not.toHaveProperty("text");
    expect(tables.candidateSourceDocuments[0]).not.toHaveProperty("rawText");
    expect(tables.candidateSourceDocuments[0]).not.toHaveProperty("raw_text");
    await expect(
      createOrReuseCandidateSourceDocument._handler(ctx as any, {
        sourceDocument: {
          ...buildSourceDocumentFixture({ sourceHash: "source_hash_raw" }),
          text: "raw source text must not be stored",
        } as any,
      }),
    ).rejects.toThrow(/raw source text/);
  });

  it("conflicting source document id/sourceHash throws", async () => {
    const { ctx } = makeCtx();
    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: buildSourceDocumentFixture(),
    });

    await expect(
      createOrReuseCandidateSourceDocument._handler(ctx as any, {
        sourceDocument: buildSourceDocumentFixture({
          id: "candidate-source-document:different_id",
        }),
      }),
    ).rejects.toThrow(/sourceHash collision/);
  });

  it("createOrReuseCandidateFact inserts once and reuses by id", async () => {
    const { ctx, tables } = makeCtx();
    const fact = await buildFactFixture();

    const firstId = await createOrReuseCandidateFact._handler(ctx as any, { fact });
    const secondId = await createOrReuseCandidateFact._handler(ctx as any, { fact });

    expect(firstId).toBe(secondId);
    expect(tables.candidateFacts).toHaveLength(1);
  });

  it("conflicting fact id semantics throws", async () => {
    const { ctx } = makeCtx();
    const fact = await buildFactFixture();
    await createOrReuseCandidateFact._handler(ctx as any, { fact });

    await expect(
      createOrReuseCandidateFact._handler(ctx as any, {
        fact: {
          ...fact,
          value: { company: "Different", responsibility: "Different source value." },
        },
      }),
    ).rejects.toThrow(/derived from the PR4 deterministic hash helper|collision/);
  });

  it("candidate fact preserves sourcePath and sourceQuote", async () => {
    const { ctx, tables } = makeCtx();
    const fact = await buildFactFixture({
      sourcePath: "document.skills[0].name",
      sourceQuote: "TypeScript",
      factType: "skill",
      value: { name: "TypeScript" },
      normalizedText: "TypeScript",
    });

    await createOrReuseCandidateFact._handler(ctx as any, { fact });

    expect(tables.candidateFacts[0].sourcePath).toBe("document.skills[0].name");
    expect(tables.candidateFacts[0].sourceQuote).toBe("TypeScript");
  });

  it("invalid/generated sourcePath is rejected", async () => {
    const { ctx } = makeCtx();
    const fact = buildUnsafeFactFixture({
      sourcePath: "document.generatedResume.body",
      value: { summary: "Generated text" },
      normalizedText: "Generated text",
    });

    await expect(createOrReuseCandidateFact._handler(ctx as any, { fact })).rejects.toThrow(
      /generated artifacts|source material/,
    );
  });

  it("generated artifact-like fact values are rejected", async () => {
    const { ctx } = makeCtx();
    const fact = buildUnsafeFactFixture({
      value: { polishedText: "World-class leader who transforms everything." },
    });

    await expect(createOrReuseCandidateFact._handler(ctx as any, { fact })).rejects.toThrow(
      /generated artifact field/,
    );
  });

  it("non-finite candidate fact confidence is rejected before storage", async () => {
    const { ctx } = makeCtx();
    const fact = await buildFactFixture({ confidence: Number.POSITIVE_INFINITY });

    await expect(createOrReuseCandidateFact._handler(ctx as any, { fact })).rejects.toThrow(
      /confidence must be a finite number/,
    );
  });

  it("candidate fact persists reviewState and visibility including private and never_use", async () => {
    const { ctx, tables } = makeCtx();
    const privateFact = await buildFactFixture({ reviewState: "needs_review", visibility: "private" });
    const neverUseFact = await buildFactFixture({
      sourcePath: "document.skills[1].name",
      sourceQuote: "React",
      factType: "skill",
      value: { name: "React" },
      normalizedText: "React",
      reviewState: "rejected",
      visibility: "never_use",
    });

    await createOrReuseCandidateFact._handler(ctx as any, { fact: privateFact });
    await createOrReuseCandidateFact._handler(ctx as any, { fact: neverUseFact });

    expect(tables.candidateFacts.map((fact) => fact.reviewState)).toEqual([
      "needs_review",
      "rejected",
    ]);
    expect(tables.candidateFacts.map((fact) => fact.visibility)).toEqual([
      "private",
      "never_use",
    ]);
  });

  it("patchCandidateFactReviewState patches only reviewState and updatedAt", async () => {
    const { ctx, patches } = makeCtx();
    const fact = await buildFactFixture();
    await createOrReuseCandidateFact._handler(ctx as any, { fact });

    await expect(
      patchCandidateFactReviewState._handler(ctx as any, {
        userId: fact.userId,
        id: fact.id,
        reviewState: "approved",
        updatedAt: LATER,
      }),
    ).resolves.toBe("candidateFacts_1");

    expect(patches).toEqual([
      {
        id: "candidateFacts_1",
        patch: { reviewState: "approved", updatedAt: LATER },
      },
    ]);
  });

  it("patchCandidateFactVisibility patches only visibility and updatedAt", async () => {
    const { ctx, patches } = makeCtx();
    const fact = await buildFactFixture();
    await createOrReuseCandidateFact._handler(ctx as any, { fact });

    await expect(
      patchCandidateFactVisibility._handler(ctx as any, {
        userId: fact.userId,
        id: fact.id,
        visibility: "use_in_applications",
        updatedAt: LATER,
      }),
    ).resolves.toBe("candidateFacts_1");

    expect(patches).toEqual([
      {
        id: "candidateFacts_1",
        patch: { visibility: "use_in_applications", updatedAt: LATER },
      },
    ]);
  });

  it("listCandidateFactsForSourceDocument returns only matching sourceDocumentId facts", async () => {
    const { ctx } = makeCtx();
    const matching = await buildFactFixture();
    const other = await buildFactFixture({
      sourceDocumentId: "candidate-source-document:source_hash_other",
      sourcePath: "document.skills[0].name",
      sourceQuote: "TypeScript",
      factType: "skill",
      value: { name: "TypeScript" },
      normalizedText: "TypeScript",
    });
    await createOrReuseCandidateFact._handler(ctx as any, { fact: matching });
    await createOrReuseCandidateFact._handler(ctx as any, { fact: other });

    const results = await listCandidateFactsForSourceDocument._handler(ctx as any, {
      userId: "user_123",
      sourceDocumentId: "candidate-source-document:source_hash_a",
    });

    expect(results.map((fact: CandidateFactV1) => fact.id)).toEqual([matching.id]);
  });

  it("createOrReuseCandidateImportBatch inserts once and reuses by id", async () => {
    const { ctx, tables } = makeCtx();
    const importBatch = await buildImportBatchFixture();

    const firstId = await createOrReuseCandidateImportBatch._handler(ctx as any, {
      importBatch,
    });
    const secondId = await createOrReuseCandidateImportBatch._handler(ctx as any, {
      importBatch,
    });

    expect(firstId).toBe(secondId);
    expect(tables.candidateImportBatches).toHaveLength(1);
  });

  it("createOrReuseCandidateImportBatch rejects empty sourceDocumentIds", async () => {
    const { ctx } = makeCtx();
    const importBatch = await buildImportBatchFixture({ sourceDocumentIds: [] });

    await expect(
      createOrReuseCandidateImportBatch._handler(ctx as any, { importBatch }),
    ).rejects.toThrow(/sourceDocumentIds must not be empty/);
  });

  it("patchCandidateImportBatchStatus patches status and updatedAt only", async () => {
    const { ctx, patches } = makeCtx();
    const importBatch = await buildImportBatchFixture();
    await createOrReuseCandidateImportBatch._handler(ctx as any, { importBatch });

    await expect(
      patchCandidateImportBatchStatus._handler(ctx as any, {
        userId: importBatch.userId,
        id: importBatch.id,
        status: "processed",
        updatedAt: LATER,
      }),
    ).resolves.toBe("candidateImportBatches_1");

    expect(patches).toEqual([
      {
        id: "candidateImportBatches_1",
        patch: { status: "processed", updatedAt: LATER },
      },
    ]);
  });

  it("helpers do not mutate input fixtures", async () => {
    const { ctx } = makeCtx();
    const sourceDocument = buildSourceDocumentFixture();
    const fact = await buildFactFixture();
    const importBatch = await buildImportBatchFixture();
    const beforeSourceDocument = stableSerialize(sourceDocument);
    const beforeFact = stableSerialize(fact);
    const beforeImportBatch = stableSerialize(importBatch);

    await createOrReuseCandidateSourceDocument._handler(ctx as any, { sourceDocument });
    await createOrReuseCandidateFact._handler(ctx as any, { fact });
    await createOrReuseCandidateImportBatch._handler(ctx as any, { importBatch });

    expect(stableSerialize(sourceDocument)).toBe(beforeSourceDocument);
    expect(stableSerialize(fact)).toBe(beforeFact);
    expect(stableSerialize(importBatch)).toBe(beforeImportBatch);
  });
});
