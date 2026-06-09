import { buildStableHash } from "../application-harness/fingerprints";
import type {
  CandidateFactTypeV1,
  CandidateImportBatchV1,
  CandidateSourceDocumentTypeV1,
} from "./schema";
import { assertFactUsesSourceMaterial, assertValidSourcePath } from "./sourcePaths";

export const CANDIDATE_EVIDENCE_HASH_NAMESPACE = "candidate-evidence";

export type BuildCandidateSourceDocumentHashInput = Readonly<{
  userId: string;
  sourceType: CandidateSourceDocumentTypeV1;
  text: string;
  title?: string;
  originalFilename?: string;
  mimeType?: string;
}>;

export type BuildCandidateFactHashInput = Readonly<{
  userId: string;
  sourceDocumentId: string;
  sourcePath: string;
  sourceQuote?: string;
  factType: CandidateFactTypeV1;
  value: unknown;
  normalizedText?: string;
}>;

export type BuildCandidateImportBatchHashInput = Readonly<{
  userId: string;
  sourceDocumentIds: readonly string[];
}>;

export async function buildCandidateSourceDocumentHash(
  input: BuildCandidateSourceDocumentHashInput,
): Promise<string> {
  assertCandidateSourceDocumentHashInput(input);

  const textHash = await buildCandidateSourceDocumentTextHash(input.text);

  return buildStableHash({
    namespace: CANDIDATE_EVIDENCE_HASH_NAMESPACE,
    type: "candidate-source-document",
    version: 1,
    input: {
      userId: input.userId,
      sourceType: input.sourceType,
      textHash,
      ...(input.title ? { title: input.title } : {}),
      ...(input.originalFilename ? { originalFilename: input.originalFilename } : {}),
      ...(input.mimeType ? { mimeType: input.mimeType } : {}),
    },
  });
}

export function buildCandidateSourceDocumentTextHash(text: string): Promise<string> {
  if (typeof text !== "string") {
    throw new TypeError("buildCandidateSourceDocumentTextHash requires text to be a string");
  }

  return buildStableHash({
    namespace: CANDIDATE_EVIDENCE_HASH_NAMESPACE,
    type: "candidate-source-document-text",
    version: 1,
    text,
  });
}

export function buildCandidateFactHash(input: BuildCandidateFactHashInput): Promise<string> {
  assertCandidateFactHashInput(input);

  const sourcePath = assertValidSourcePath(input.sourcePath);

  return buildStableHash({
    namespace: CANDIDATE_EVIDENCE_HASH_NAMESPACE,
    type: "candidate-fact",
    version: 1,
    input: {
      userId: input.userId,
      sourceDocumentId: input.sourceDocumentId,
      sourcePath,
      factType: input.factType,
      value: input.value,
      ...(input.sourceQuote ? { sourceQuote: input.sourceQuote } : {}),
      ...(input.normalizedText ? { normalizedText: input.normalizedText } : {}),
    },
  });
}

export function buildCandidateImportBatchHash(
  input: BuildCandidateImportBatchHashInput,
): Promise<string> {
  assertCandidateImportBatchHashInput(input);

  return buildStableHash({
    namespace: CANDIDATE_EVIDENCE_HASH_NAMESPACE,
    type: "candidate-import-batch",
    version: 1,
    input,
  });
}

export function buildCandidateImportBatchHashFromBatch(
  batch: Pick<CandidateImportBatchV1, "userId" | "sourceDocumentIds">,
): Promise<string> {
  return buildCandidateImportBatchHash({
    userId: batch.userId,
    sourceDocumentIds: batch.sourceDocumentIds,
  });
}

function assertCandidateSourceDocumentHashInput(
  input: BuildCandidateSourceDocumentHashInput,
): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("buildCandidateSourceDocumentHash requires an input object");
  }

  if (!input.userId) {
    throw new TypeError("buildCandidateSourceDocumentHash requires userId");
  }

  if (!input.sourceType) {
    throw new TypeError("buildCandidateSourceDocumentHash requires sourceType");
  }

  if (typeof input.text !== "string") {
    throw new TypeError("buildCandidateSourceDocumentHash requires text to be a string");
  }
}

function assertCandidateFactHashInput(input: BuildCandidateFactHashInput): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("buildCandidateFactHash requires an input object");
  }

  if (!input.userId) {
    throw new TypeError("buildCandidateFactHash requires userId");
  }

  if (!input.sourceDocumentId) {
    throw new TypeError("buildCandidateFactHash requires sourceDocumentId");
  }

  if (!input.factType) {
    throw new TypeError("buildCandidateFactHash requires factType");
  }

  assertFactUsesSourceMaterial({
    sourcePath: input.sourcePath,
    value: input.value,
  });
}

function assertCandidateImportBatchHashInput(input: BuildCandidateImportBatchHashInput): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("buildCandidateImportBatchHash requires an input object");
  }

  if (!input.userId) {
    throw new TypeError("buildCandidateImportBatchHash requires userId");
  }

  if (!Array.isArray(input.sourceDocumentIds)) {
    throw new TypeError("buildCandidateImportBatchHash requires sourceDocumentIds array");
  }

  for (const sourceDocumentId of input.sourceDocumentIds) {
    if (typeof sourceDocumentId !== "string" || !sourceDocumentId) {
      throw new TypeError("buildCandidateImportBatchHash requires non-empty sourceDocumentIds");
    }
  }
}
