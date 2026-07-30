import { describe, expect, it } from "vitest";

import {
  createOrReuseCandidateFact,
  createOrReuseCandidateImportBatch,
  createOrReuseCandidateSourceDocument,
  getCandidateSourceDocumentById,
  listCandidateFactsForSourceDocument,
  listCandidateSourceDocumentsForCanonicalCv,
  patchCandidateFactReviewState,
  patchCandidateFactVisibility,
  patchCandidateImportBatchStatus,
} from "../candidateEvidence";
import { stableSerialize } from "../../src/modules/application-harness/fingerprints";
import {
  buildCandidateFactHash,
  buildCandidateImportBatchHash,
  buildCandidateSourceDocumentHash,
  buildCandidateSourceDocumentTextHash,
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

async function buildCanonicalSourceDocumentFixture(
  canonicalCvId?: string,
  userId = "user_123",
): Promise<CandidateSourceDocumentV1> {
  const text = "Equivalent historical and linked source material.";
  const sourceHash = await buildCandidateSourceDocumentHash({
    userId,
    sourceType: "pasted_text",
    text,
    title: "Pasted profile notes",
    originalFilename: "profile-notes.txt",
    mimeType: "text/plain",
    ...(canonicalCvId ? { canonicalCvId } : {}),
  });

  return buildSourceDocumentFixture({
    id: `candidate-source-document:${sourceHash}`,
    userId,
    sourceHash,
    textHash: await buildCandidateSourceDocumentTextHash(text),
    ...(canonicalCvId ? { canonicalCvId } : {}),
  });
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
          collect: async () => matching,
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
  it("createOrReuseCandidateSourceDocument accepts canonical source document id", async () => {
    const { ctx, tables } = makeCtx();
    const sourceDocument = buildSourceDocumentFixture();

    const storageId = await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument,
    });

    expect(storageId).toBe("candidateSourceDocuments_1");
    expect(tables.candidateSourceDocuments[0].id).toBe(
      "candidate-source-document:source_hash_a",
    );
  });

  it("createOrReuseCandidateSourceDocument rejects a bare sourceHash id", async () => {
    const { ctx } = makeCtx();

    await expect(
      createOrReuseCandidateSourceDocument._handler(ctx as any, {
        sourceDocument: buildSourceDocumentFixture({ id: "source_hash_a" }),
      }),
    ).rejects.toThrow(/candidate-source-document id must be the canonical PR4 deterministic id/);
  });

  it("same canonical source document id/sourceHash still reuses", async () => {
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

  it("creates and reuses a source document linked to one canonical CV", async () => {
    const { ctx, tables } = makeCtx();
    const sourceDocument = buildSourceDocumentFixture({
      canonicalCvId: "cv-canonical-1",
    });

    const firstId = await createOrReuseCandidateSourceDocument._handler(
      ctx as any,
      { sourceDocument },
    );
    const secondId = await createOrReuseCandidateSourceDocument._handler(
      ctx as any,
      { sourceDocument },
    );

    expect(secondId).toBe(firstId);
    expect(tables.candidateSourceDocuments).toHaveLength(1);
    expect(tables.candidateSourceDocuments[0].canonicalCvId).toBe(
      "cv-canonical-1",
    );
  });

  it("keeps historical unlinked material while creating a separate linked identity", async () => {
    const { ctx, tables } = makeCtx();
    const historical = await buildCanonicalSourceDocumentFixture();
    const linked = await buildCanonicalSourceDocumentFixture(
      "cv-canonical-1",
    );

    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: historical,
    });
    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: linked,
    });

    expect(linked.id).not.toBe(historical.id);
    expect(linked.sourceHash).not.toBe(historical.sourceHash);
    expect(tables.candidateSourceDocuments).toHaveLength(2);
    expect(tables.candidateSourceDocuments[0]).not.toHaveProperty(
      "canonicalCvId",
    );
    expect(tables.candidateSourceDocuments[1]).toMatchObject({
      id: linked.id,
      canonicalCvId: "cv-canonical-1",
    });
  });

  it("rejects changing or implicitly backfilling a source document canonical CV", async () => {
    const { ctx, tables } = makeCtx();
    const unlinked = buildSourceDocumentFixture();
    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: unlinked,
    });

    await expect(
      createOrReuseCandidateSourceDocument._handler(ctx as any, {
        sourceDocument: {
          ...unlinked,
          canonicalCvId: "cv-canonical-1",
        },
      }),
    ).rejects.toThrow(/canonical CV identity/);
    expect(tables.candidateSourceDocuments[0]).not.toHaveProperty(
      "canonicalCvId",
    );

    const linked = buildSourceDocumentFixture({
      id: "candidate-source-document:source_hash_b",
      sourceHash: "source_hash_b",
      textHash: "text_hash_b",
      canonicalCvId: "cv-canonical-1",
    });
    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: linked,
    });
    await expect(
      createOrReuseCandidateSourceDocument._handler(ctx as any, {
        sourceDocument: {
          ...linked,
          canonicalCvId: "cv-canonical-2",
        },
      }),
    ).rejects.toThrow(/canonical CV identity/);
    await expect(
      createOrReuseCandidateSourceDocument._handler(ctx as any, {
        sourceDocument: {
          ...linked,
          canonicalCvId: undefined,
        },
      }),
    ).rejects.toThrow(/canonical CV identity/);
  });

  it("lists multiple linked sources by owner and canonical CV without unlinked documents", async () => {
    const { ctx } = makeCtx();
    const linkedA = buildSourceDocumentFixture({
      canonicalCvId: "cv-canonical-1",
    });
    const linkedB = buildSourceDocumentFixture({
      id: "candidate-source-document:source_hash_b",
      sourceHash: "source_hash_b",
      textHash: "text_hash_b",
      canonicalCvId: "cv-canonical-1",
    });
    const unlinked = buildSourceDocumentFixture({
      id: "candidate-source-document:source_hash_unlinked",
      sourceHash: "source_hash_unlinked",
      textHash: "text_hash_unlinked",
    });

    for (const sourceDocument of [linkedA, linkedB, unlinked]) {
      await createOrReuseCandidateSourceDocument._handler(ctx as any, {
        sourceDocument,
      });
    }

    const linked = await listCandidateSourceDocumentsForCanonicalCv._handler(
      ctx as any,
      {
        userId: "user_123",
        canonicalCvId: "cv-canonical-1",
      },
    );
    const historical = await getCandidateSourceDocumentById._handler(
      ctx as any,
      {
        userId: "user_123",
        id: unlinked.id,
      },
    );

    expect(linked.map((document: CandidateSourceDocumentV1) => document.id)).toEqual([
      linkedA.id,
      linkedB.id,
    ]);
    expect(historical).toMatchObject({ id: unlinked.id });
    expect(historical).not.toHaveProperty("canonicalCvId");
  });

  it("isolates the same canonical CV identifier between users", async () => {
    const { ctx } = makeCtx();
    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: buildSourceDocumentFixture({
        canonicalCvId: "cv-shared-name",
      }),
    });
    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: buildSourceDocumentFixture({
        userId: "user_456",
        canonicalCvId: "cv-shared-name",
      }),
    });

    const ownerSources =
      await listCandidateSourceDocumentsForCanonicalCv._handler(ctx as any, {
        userId: "user_123",
        canonicalCvId: "cv-shared-name",
      });

    expect(ownerSources).toHaveLength(1);
    expect(ownerSources[0].userId).toBe("user_123");
  });

  it("does not mutate CandidateFacts while linking or listing source documents", async () => {
    const { ctx, tables, patches } = makeCtx();
    const fact = await buildFactFixture({
      reviewState: "approved",
      visibility: "use_in_applications",
    });
    await createOrReuseCandidateFact._handler(ctx as any, { fact });
    const before = JSON.stringify(tables.candidateFacts);

    await createOrReuseCandidateSourceDocument._handler(ctx as any, {
      sourceDocument: buildSourceDocumentFixture({
        canonicalCvId: "cv-canonical-1",
      }),
    });
    await listCandidateSourceDocumentsForCanonicalCv._handler(ctx as any, {
      userId: "user_123",
      canonicalCvId: "cv-canonical-1",
    });

    expect(JSON.stringify(tables.candidateFacts)).toBe(before);
    expect(tables.candidateFacts[0]).toMatchObject({
      reviewState: "approved",
      visibility: "use_in_applications",
    });
    expect(patches).toEqual([]);
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
          ...buildSourceDocumentFixture({
            id: "candidate-source-document:source_hash_raw",
            sourceHash: "source_hash_raw",
          }),
          text: "raw source text must not be stored",
        } as any,
      }),
    ).rejects.toThrow(/raw source text/);
  });

  it("source document rejects non-finite timestamps before storage", async () => {
    const { ctx } = makeCtx();

    await expect(
      createOrReuseCandidateSourceDocument._handler(ctx as any, {
        sourceDocument: buildSourceDocumentFixture({ createdAt: Number.NaN }),
      }),
    ).rejects.toThrow(/CandidateSourceDocument createdAt must be a finite number/);
  });

  it("conflicting canonical source document id/sourceHash behavior still throws", async () => {
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
    ).rejects.toThrow(/canonical PR4 deterministic id/);
  });

  it("createOrReuseCandidateFact inserts once and reuses by id", async () => {
    const { ctx, tables } = makeCtx();
    const fact = await buildFactFixture();

    const firstId = await createOrReuseCandidateFact._handler(ctx as any, { fact });
    const secondId = await createOrReuseCandidateFact._handler(ctx as any, { fact });

    expect(firstId).toBe(secondId);
    expect(tables.candidateFacts).toHaveLength(1);
  });

  it("candidate fact rejects bare hash ids to preserve create-or-reuse idempotency", async () => {
    const { ctx } = makeCtx();
    const fact = await buildFactFixture();

    await expect(
      createOrReuseCandidateFact._handler(ctx as any, {
        fact: { ...fact, id: fact.id.replace("candidate-fact:", "") },
      }),
    ).rejects.toThrow(/canonical PR4 deterministic id/);
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
    ).rejects.toThrow(/canonical PR4 deterministic id|collision/);
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

  it("candidate fact rejects non-finite timestamps before storage", async () => {
    const { ctx } = makeCtx();
    const fact = await buildFactFixture({ updatedAt: Number.NEGATIVE_INFINITY });

    await expect(createOrReuseCandidateFact._handler(ctx as any, { fact })).rejects.toThrow(
      /CandidateFact updatedAt must be a finite number/,
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

  it("patchCandidateFactReviewState rejects non-finite updatedAt", async () => {
    const { ctx } = makeCtx();
    const fact = await buildFactFixture();
    await createOrReuseCandidateFact._handler(ctx as any, { fact });

    await expect(
      patchCandidateFactReviewState._handler(ctx as any, {
        userId: fact.userId,
        id: fact.id,
        reviewState: "approved",
        updatedAt: Number.NaN,
      }),
    ).rejects.toThrow(/CandidateFact updatedAt must be a finite number/);
  });

  it("patchCandidateFactVisibility rejects non-finite updatedAt", async () => {
    const { ctx } = makeCtx();
    const fact = await buildFactFixture();
    await createOrReuseCandidateFact._handler(ctx as any, { fact });

    await expect(
      patchCandidateFactVisibility._handler(ctx as any, {
        userId: fact.userId,
        id: fact.id,
        visibility: "use_in_applications",
        updatedAt: Number.POSITIVE_INFINITY,
      }),
    ).rejects.toThrow(/CandidateFact updatedAt must be a finite number/);
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

  it("createOrReuseCandidateImportBatch rejects bare hash ids to preserve create-or-reuse idempotency", async () => {
    const { ctx } = makeCtx();
    const importBatch = await buildImportBatchFixture();

    await expect(
      createOrReuseCandidateImportBatch._handler(ctx as any, {
        importBatch: {
          ...importBatch,
          id: importBatch.id.replace("candidate-import-batch:", ""),
        },
      }),
    ).rejects.toThrow(/canonical PR4 deterministic id/);
  });

  it("createOrReuseCandidateImportBatch rejects empty sourceDocumentIds", async () => {
    const { ctx } = makeCtx();
    const importBatch = await buildImportBatchFixture({ sourceDocumentIds: [] });

    await expect(
      createOrReuseCandidateImportBatch._handler(ctx as any, { importBatch }),
    ).rejects.toThrow(/sourceDocumentIds must not be empty/);
  });

  it("createOrReuseCandidateImportBatch rejects non-finite timestamps", async () => {
    const { ctx } = makeCtx();
    const importBatch = await buildImportBatchFixture({ createdAt: Number.POSITIVE_INFINITY });

    await expect(
      createOrReuseCandidateImportBatch._handler(ctx as any, { importBatch }),
    ).rejects.toThrow(/CandidateImportBatch createdAt must be a finite number/);
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

  it("patchCandidateImportBatchStatus rejects non-finite updatedAt", async () => {
    const { ctx } = makeCtx();
    const importBatch = await buildImportBatchFixture();
    await createOrReuseCandidateImportBatch._handler(ctx as any, { importBatch });

    await expect(
      patchCandidateImportBatchStatus._handler(ctx as any, {
        userId: importBatch.userId,
        id: importBatch.id,
        status: "processed",
        updatedAt: Number.NEGATIVE_INFINITY,
      }),
    ).rejects.toThrow(/CandidateImportBatch updatedAt must be a finite number/);
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
