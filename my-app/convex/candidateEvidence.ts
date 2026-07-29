import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import {
  candidateEvidenceVisibilityValidator,
  candidateFactReviewStateValidator,
  candidateFactStoredValidator,
  candidateFactValidator,
  candidateImportBatchStatusValidator,
  candidateImportBatchStoredValidator,
  candidateImportBatchValidator,
  candidateSourceDocumentStoredValidator,
  candidateSourceDocumentValidator,
} from "./lib/candidateEvidence";
import { stableSerialize } from "../src/modules/application-harness/fingerprints";
import {
  buildCandidateFactHash,
  buildCandidateImportBatchHash,
} from "../src/modules/candidate-evidence/fingerprints";
import type {
  CandidateFactV1,
  CandidateImportBatchV1,
  CandidateSourceDocumentV1,
} from "../src/modules/candidate-evidence/schema";
import {
  assertFactUsesSourceMaterial,
  assertValidSourcePath,
} from "../src/modules/candidate-evidence/sourcePaths";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

type MutableCandidateImportBatchV1 = Omit<
  CandidateImportBatchV1,
  "sourceDocumentIds"
> & {
  sourceDocumentIds: string[];
};

function resolveListLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.max(1, Math.min(Math.floor(limit), MAX_LIST_LIMIT));
}

export const createOrReuseCandidateSourceDocument = internalMutation({
  args: {
    sourceDocument: candidateSourceDocumentValidator,
  },
  returns: v.id("candidateSourceDocuments"),
  handler: async (ctx, args) => {
    const sourceDocument = sanitizeCandidateSourceDocument(args.sourceDocument);

    const existingById = await ctx.db
      .query("candidateSourceDocuments")
      .withIndex("by_user_id_id", (q) =>
        q.eq("userId", sourceDocument.userId).eq("id", sourceDocument.id),
      )
      .unique();

    if (existingById) {
      assertSameSourceDocumentIdentity(existingById, sourceDocument);
      return existingById._id;
    }

    const existingBySourceHash = await ctx.db
      .query("candidateSourceDocuments")
      .withIndex("by_user_id_source_hash", (q) =>
        q.eq("userId", sourceDocument.userId).eq("sourceHash", sourceDocument.sourceHash),
      )
      .unique();

    if (existingBySourceHash) {
      if (existingBySourceHash.id !== sourceDocument.id) {
        throw new Error("CandidateSourceDocument sourceHash collision with different stable id");
      }

      return existingBySourceHash._id;
    }

    return await ctx.db.insert("candidateSourceDocuments", sourceDocument);
  },
});

export const getCandidateSourceDocumentById = internalQuery({
  args: {
    userId: v.string(),
    id: v.string(),
  },
  returns: v.union(v.null(), candidateSourceDocumentStoredValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidateSourceDocuments")
      .withIndex("by_user_id_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();
  },
});

export const getCandidateSourceDocumentBySourceHash = internalQuery({
  args: {
    userId: v.string(),
    sourceHash: v.string(),
  },
  returns: v.union(v.null(), candidateSourceDocumentStoredValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidateSourceDocuments")
      .withIndex("by_user_id_source_hash", (q) =>
        q.eq("userId", args.userId).eq("sourceHash", args.sourceHash),
      )
      .unique();
  },
});

export const listCandidateSourceDocumentsForUser = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(candidateSourceDocumentStoredValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidateSourceDocuments")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(resolveListLimit(args.limit));
  },
});

export const listCandidateSourceDocumentsForCanonicalCv = internalQuery({
  args: {
    userId: v.string(),
    canonicalCvId: v.string(),
  },
  returns: v.array(candidateSourceDocumentStoredValidator),
  handler: async (ctx, args) => {
    const canonicalCvId = normalizeCanonicalCvId(args.canonicalCvId);
    if (!canonicalCvId) {
      throw new TypeError(
        "CandidateSourceDocument canonicalCvId must be a non-empty string",
      );
    }

    return await ctx.db
      .query("candidateSourceDocuments")
      .withIndex("by_user_id_canonical_cv_id", (q) =>
        q
          .eq("userId", args.userId)
          .eq("canonicalCvId", canonicalCvId),
      )
      .collect();
  },
});

export const createOrReuseCandidateFact = internalMutation({
  args: {
    fact: candidateFactValidator,
  },
  returns: v.id("candidateFacts"),
  handler: async (ctx, args) => {
    const fact = await sanitizeCandidateFact(args.fact);

    const existingById = await ctx.db
      .query("candidateFacts")
      .withIndex("by_user_id_id", (q) => q.eq("userId", fact.userId).eq("id", fact.id))
      .unique();

    if (existingById) {
      assertSameFactSemantics(existingById, fact);
      return existingById._id;
    }

    return await ctx.db.insert("candidateFacts", fact);
  },
});

export const getCandidateFactById = internalQuery({
  args: {
    userId: v.string(),
    id: v.string(),
  },
  returns: v.union(v.null(), candidateFactStoredValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidateFacts")
      .withIndex("by_user_id_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();
  },
});

export const listCandidateFactsForSourceDocument = internalQuery({
  args: {
    userId: v.string(),
    sourceDocumentId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(candidateFactStoredValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidateFacts")
      .withIndex("by_user_id_source_document_id", (q) =>
        q.eq("userId", args.userId).eq("sourceDocumentId", args.sourceDocumentId),
      )
      .order("desc")
      .take(resolveListLimit(args.limit));
  },
});

export const listCandidateFactsForUserByReviewState = internalQuery({
  args: {
    userId: v.string(),
    reviewState: candidateFactReviewStateValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(candidateFactStoredValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidateFacts")
      .withIndex("by_user_id_review_state", (q) =>
        q.eq("userId", args.userId).eq("reviewState", args.reviewState),
      )
      .order("desc")
      .take(resolveListLimit(args.limit));
  },
});

export const patchCandidateFactReviewState = internalMutation({
  args: {
    userId: v.string(),
    id: v.string(),
    reviewState: candidateFactReviewStateValidator,
    updatedAt: v.number(),
  },
  returns: v.id("candidateFacts"),
  handler: async (ctx, args) => {
    const updatedAt = assertFiniteTimestamp(args.updatedAt, "CandidateFact updatedAt");
    const fact = await ctx.db
      .query("candidateFacts")
      .withIndex("by_user_id_id", (q) =>
        q.eq("userId", args.userId).eq("id", args.id),
      )
      .unique();

    if (!fact) {
      throw new Error("CandidateFact not found");
    }

    await ctx.db.patch(fact._id, {
      reviewState: args.reviewState,
      updatedAt,
    });

    return fact._id;
  },
});

export const patchCandidateFactVisibility = internalMutation({
  args: {
    userId: v.string(),
    id: v.string(),
    visibility: candidateEvidenceVisibilityValidator,
    updatedAt: v.number(),
  },
  returns: v.id("candidateFacts"),
  handler: async (ctx, args) => {
    const updatedAt = assertFiniteTimestamp(args.updatedAt, "CandidateFact updatedAt");
    const fact = await ctx.db
      .query("candidateFacts")
      .withIndex("by_user_id_id", (q) =>
        q.eq("userId", args.userId).eq("id", args.id),
      )
      .unique();

    if (!fact) {
      throw new Error("CandidateFact not found");
    }

    await ctx.db.patch(fact._id, {
      visibility: args.visibility,
      updatedAt,
    });

    return fact._id;
  },
});

export const createOrReuseCandidateImportBatch = internalMutation({
  args: {
    importBatch: candidateImportBatchValidator,
  },
  returns: v.id("candidateImportBatches"),
  handler: async (ctx, args) => {
    const importBatch = await sanitizeCandidateImportBatch(args.importBatch);

    const existingById = await ctx.db
      .query("candidateImportBatches")
      .withIndex("by_user_id_id", (q) =>
        q.eq("userId", importBatch.userId).eq("id", importBatch.id),
      )
      .unique();

    if (existingById) {
      assertSameImportBatchIdentity(existingById, importBatch);
      return existingById._id;
    }

    return await ctx.db.insert("candidateImportBatches", importBatch);
  },
});

export const getCandidateImportBatchById = internalQuery({
  args: {
    userId: v.string(),
    id: v.string(),
  },
  returns: v.union(v.null(), candidateImportBatchStoredValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidateImportBatches")
      .withIndex("by_user_id_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();
  },
});

export const patchCandidateImportBatchStatus = internalMutation({
  args: {
    userId: v.string(),
    id: v.string(),
    status: candidateImportBatchStatusValidator,
    updatedAt: v.number(),
  },
  returns: v.id("candidateImportBatches"),
  handler: async (ctx, args) => {
    const updatedAt = assertFiniteTimestamp(args.updatedAt, "CandidateImportBatch updatedAt");
    const importBatch = await ctx.db
      .query("candidateImportBatches")
      .withIndex("by_user_id_id", (q) => q.eq("userId", args.userId).eq("id", args.id))
      .unique();

    if (!importBatch) {
      throw new Error("CandidateImportBatch not found");
    }

    await ctx.db.patch(importBatch._id, {
      status: args.status,
      updatedAt,
    });

    return importBatch._id;
  },
});

function sanitizeCandidateSourceDocument(
  sourceDocument: CandidateSourceDocumentV1,
): CandidateSourceDocumentV1 {
  if (hasRawSourceText(sourceDocument)) {
    throw new Error("CandidateSourceDocument persistence must not store raw source text");
  }

  assertAcceptedDeterministicId(
    sourceDocument.id,
    sourceDocument.sourceHash,
    "candidate-source-document",
  );

  return {
    id: sourceDocument.id,
    userId: sourceDocument.userId,
    ...projectCanonicalCvId(sourceDocument.canonicalCvId),
    sourceType: sourceDocument.sourceType,
    ...(sourceDocument.title ? { title: sourceDocument.title } : {}),
    ...(sourceDocument.originalFilename
      ? { originalFilename: sourceDocument.originalFilename }
      : {}),
    ...(sourceDocument.mimeType ? { mimeType: sourceDocument.mimeType } : {}),
    textHash: sourceDocument.textHash,
    sourceHash: sourceDocument.sourceHash,
    reviewState: sourceDocument.reviewState,
    visibility: sourceDocument.visibility,
    createdAt: assertFiniteTimestamp(
      sourceDocument.createdAt,
      "CandidateSourceDocument createdAt",
    ),
    updatedAt: assertFiniteTimestamp(
      sourceDocument.updatedAt,
      "CandidateSourceDocument updatedAt",
    ),
    version: 1,
  };
}

async function sanitizeCandidateFact(fact: CandidateFactV1): Promise<CandidateFactV1> {
  const sourcePath = assertValidSourcePath(fact.sourcePath);
  const value = cloneConvexCompatibleJson(fact.value);

  assertFactUsesSourceMaterial({
    sourcePath,
    value,
  });

  const candidateFact: CandidateFactV1 = {
    id: fact.id,
    userId: fact.userId,
    sourceDocumentId: fact.sourceDocumentId,
    sourcePath,
    ...(fact.sourceQuote ? { sourceQuote: fact.sourceQuote } : {}),
    factType: fact.factType,
    value,
    ...(fact.normalizedText ? { normalizedText: fact.normalizedText } : {}),
    ...projectCandidateFactConfidence(fact.confidence),
    reviewState: fact.reviewState,
    visibility: fact.visibility,
    createdAt: assertFiniteTimestamp(fact.createdAt, "CandidateFact createdAt"),
    updatedAt: assertFiniteTimestamp(fact.updatedAt, "CandidateFact updatedAt"),
    version: 1,
  };

  const expectedFactHash = await buildCandidateFactHash({
    userId: candidateFact.userId,
    sourceDocumentId: candidateFact.sourceDocumentId,
    sourcePath: candidateFact.sourcePath,
    ...(candidateFact.sourceQuote ? { sourceQuote: candidateFact.sourceQuote } : {}),
    factType: candidateFact.factType,
    value: candidateFact.value,
    ...(candidateFact.normalizedText ? { normalizedText: candidateFact.normalizedText } : {}),
  });

  assertAcceptedDeterministicId(candidateFact.id, expectedFactHash, "candidate-fact");

  return candidateFact;
}

async function sanitizeCandidateImportBatch(
  importBatch: CandidateImportBatchV1,
): Promise<MutableCandidateImportBatchV1> {
  const sourceDocumentIds = [...importBatch.sourceDocumentIds];
  if (sourceDocumentIds.length === 0) {
    throw new TypeError("CandidateImportBatch sourceDocumentIds must not be empty");
  }

  for (const sourceDocumentId of sourceDocumentIds) {
    if (typeof sourceDocumentId !== "string" || !sourceDocumentId) {
      throw new TypeError("CandidateImportBatch requires non-empty string sourceDocumentIds");
    }
  }

  const candidateImportBatch: MutableCandidateImportBatchV1 = {
    id: importBatch.id,
    userId: importBatch.userId,
    sourceDocumentIds,
    status: importBatch.status,
    createdAt: assertFiniteTimestamp(importBatch.createdAt, "CandidateImportBatch createdAt"),
    updatedAt: assertFiniteTimestamp(importBatch.updatedAt, "CandidateImportBatch updatedAt"),
    version: 1,
  };

  const expectedImportBatchHash = await buildCandidateImportBatchHash({
    userId: candidateImportBatch.userId,
    sourceDocumentIds: candidateImportBatch.sourceDocumentIds,
  });

  assertAcceptedDeterministicId(
    candidateImportBatch.id,
    expectedImportBatchHash,
    "candidate-import-batch",
  );

  return candidateImportBatch;
}

function assertAcceptedDeterministicId(id: string, hash: string, prefix: string): void {
  const expectedId = `${prefix}:${hash}`;
  if (id !== expectedId) {
    throw new Error(`${prefix} id must be the canonical PR4 deterministic id (${prefix}:hash)`);
  }
}

function assertSameSourceDocumentIdentity(
  existing: CandidateSourceDocumentV1,
  incoming: CandidateSourceDocumentV1,
): void {
  if (existing.sourceHash !== incoming.sourceHash) {
    throw new Error("CandidateSourceDocument stable id collision");
  }

  if (existing.textHash !== incoming.textHash || existing.sourceType !== incoming.sourceType) {
    throw new Error("CandidateSourceDocument sourceHash reused with conflicting source metadata");
  }

  if (existing.canonicalCvId !== incoming.canonicalCvId) {
    throw new Error(
      "CandidateSourceDocument canonical CV identity cannot change during create/reuse",
    );
  }
}

function assertSameFactSemantics(existing: CandidateFactV1, incoming: CandidateFactV1): void {
  if (
    existing.sourceDocumentId !== incoming.sourceDocumentId ||
    existing.sourcePath !== incoming.sourcePath ||
    existing.sourceQuote !== incoming.sourceQuote ||
    existing.factType !== incoming.factType ||
    existing.normalizedText !== incoming.normalizedText ||
    stableSerialize(existing.value) !== stableSerialize(incoming.value)
  ) {
    throw new Error("CandidateFact stable id collision with conflicting source semantics");
  }
}

function assertSameImportBatchIdentity(
  existing: CandidateImportBatchV1,
  incoming: CandidateImportBatchV1,
): void {
  if (stableSerialize(existing.sourceDocumentIds) !== stableSerialize(incoming.sourceDocumentIds)) {
    throw new Error("CandidateImportBatch stable id collision with conflicting source documents");
  }
}

function projectCandidateFactConfidence(
  confidence: CandidateFactV1["confidence"],
): { confidence?: number } {
  if (confidence === undefined) {
    return {};
  }

  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    throw new TypeError("CandidateFact confidence must be a finite number");
  }

  return { confidence };
}

function projectCanonicalCvId(
  canonicalCvId: CandidateSourceDocumentV1["canonicalCvId"],
): { canonicalCvId?: string } {
  const normalized = normalizeCanonicalCvId(canonicalCvId);
  return normalized ? { canonicalCvId: normalized } : {};
}

function normalizeCanonicalCvId(
  canonicalCvId: CandidateSourceDocumentV1["canonicalCvId"],
): string | undefined {
  if (canonicalCvId === undefined) {
    return undefined;
  }

  const normalized = canonicalCvId.trim();
  if (!normalized) {
    throw new TypeError(
      "CandidateSourceDocument canonicalCvId must be a non-empty string",
    );
  }
  return normalized;
}

function assertFiniteTimestamp(value: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }

  return value;
}

function hasRawSourceText(value: object): boolean {
  return (
    Object.prototype.hasOwnProperty.call(value, "text") ||
    Object.prototype.hasOwnProperty.call(value, "rawText") ||
    Object.prototype.hasOwnProperty.call(value, "raw_text") ||
    Object.prototype.hasOwnProperty.call(value, "content")
  );
}

function cloneConvexCompatibleJson(value: unknown): unknown {
  assertConvexCompatibleJson(value, "value", new WeakSet<object>());
  return cloneJsonLike(value);
}

function assertConvexCompatibleJson(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): void {
  if (value === null) {
    return;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} must be a finite number`);
    }
    return;
  }

  if (value === undefined) {
    throw new TypeError(`${path} must not contain undefined`);
  }

  if (typeof value === "bigint") {
    throw new TypeError(`${path} must not contain bigint values`);
  }

  if (typeof value === "symbol") {
    throw new TypeError(`${path} must not contain symbols`);
  }

  if (typeof value === "function") {
    throw new TypeError(`${path} must not contain functions`);
  }

  if (typeof value !== "object") {
    throw new TypeError(`${path} must be Convex-compatible JSON`);
  }

  if (value instanceof Date) {
    throw new TypeError(`${path} must not contain Date instances`);
  }

  if (value instanceof Map) {
    throw new TypeError(`${path} must not contain Map instances`);
  }

  if (value instanceof Set) {
    throw new TypeError(`${path} must not contain Set instances`);
  }

  if (value instanceof RegExp) {
    throw new TypeError(`${path} must not contain RegExp instances`);
  }

  if (typeof (value as { then?: unknown }).then === "function") {
    throw new TypeError(`${path} must not contain Promise instances`);
  }

  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new TypeError(`${path} must contain only arrays and plain objects`);
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol keys`);
  }

  if (seen.has(value)) {
    throw new TypeError(`${path} must not contain circular references`);
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new TypeError(`${path} must not contain sparse arrays`);
        }
        assertConvexCompatibleJson(value[index], `${path}[${index}]`, seen);
      }
      return;
    }

    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      assertConvexCompatibleJson(record[key], `${path}.${key}`, seen);
    }
  } finally {
    seen.delete(value);
  }
}

function cloneJsonLike(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonLike(item));
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record).map((key) => [key, cloneJsonLike(record[key])]),
  );
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
