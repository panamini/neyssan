import { v } from "convex/values";

export const candidateSourceDocumentTypeValidator = v.union(
  v.literal("pasted_text"),
  v.literal("markdown"),
  v.literal("linkedin_export"),
  v.literal("linkedin_pdf"),
  v.literal("uploaded_cv"),
  v.literal("manual_entry"),
  v.literal("portfolio_material"),
  v.literal("freelance_export"),
);

export const candidateSourceDocumentReviewStateValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("archived"),
);

export const candidateEvidenceVisibilityValidator = v.union(
  v.literal("private"),
  v.literal("use_in_applications"),
  v.literal("never_use"),
);

export const candidateFactTypeValidator = v.union(
  v.literal("identity"),
  v.literal("contact"),
  v.literal("skill"),
  v.literal("experience"),
  v.literal("education"),
  v.literal("language"),
  v.literal("achievement"),
  v.literal("project"),
  v.literal("certification"),
  v.literal("portfolio"),
  v.literal("preference"),
  v.literal("availability"),
  v.literal("other"),
);

export const candidateFactReviewStateValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("needs_review"),
);

export const candidateImportBatchStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const candidateSourceDocumentFields = {
  id: v.string(),
  userId: v.string(),
  sourceType: candidateSourceDocumentTypeValidator,
  title: v.optional(v.string()),
  originalFilename: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  textHash: v.string(),
  sourceHash: v.string(),
  reviewState: candidateSourceDocumentReviewStateValidator,
  visibility: candidateEvidenceVisibilityValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.literal(1),
};

export const candidateSourceDocumentValidator = v.object(
  candidateSourceDocumentFields,
);

export const candidateSourceDocumentStoredValidator = v.object({
  _id: v.id("candidateSourceDocuments"),
  _creationTime: v.number(),
  ...candidateSourceDocumentFields,
});

export const candidateFactFields = {
  id: v.string(),
  userId: v.string(),
  sourceDocumentId: v.string(),
  sourcePath: v.string(),
  sourceQuote: v.optional(v.string()),
  factType: candidateFactTypeValidator,
  // Candidate facts intentionally store source-truth JSON values whose shape varies by factType.
  // Runtime helpers validate source material and Convex-compatible JSON before insert.
  value: v.any(),
  normalizedText: v.optional(v.string()),
  confidence: v.optional(v.number()),
  reviewState: candidateFactReviewStateValidator,
  visibility: candidateEvidenceVisibilityValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.literal(1),
};

export const candidateFactValidator = v.object(candidateFactFields);

export const candidateFactStoredValidator = v.object({
  _id: v.id("candidateFacts"),
  _creationTime: v.number(),
  ...candidateFactFields,
});

export const candidateImportBatchFields = {
  id: v.string(),
  userId: v.string(),
  sourceDocumentIds: v.array(v.string()),
  status: candidateImportBatchStatusValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.literal(1),
};

export const candidateImportBatchValidator = v.object(
  candidateImportBatchFields,
);

export const candidateImportBatchStoredValidator = v.object({
  _id: v.id("candidateImportBatches"),
  _creationTime: v.number(),
  ...candidateImportBatchFields,
});
