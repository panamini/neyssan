export type CandidateEvidenceTimestampV1 = number;

export type CandidateSourceDocumentTypeV1 =
  | "pasted_text"
  | "markdown"
  | "linkedin_export"
  | "linkedin_pdf"
  | "uploaded_cv"
  | "manual_entry"
  | "portfolio_material"
  | "freelance_export";

export type CandidateSourceDocumentReviewStateV1 =
  | "pending"
  | "approved"
  | "rejected"
  | "archived";

export type CandidateEvidenceVisibilityV1 =
  | "private"
  | "use_in_applications"
  | "never_use";

export type CandidateFactTypeV1 =
  | "identity"
  | "contact"
  | "skill"
  | "experience"
  | "education"
  | "language"
  | "achievement"
  | "project"
  | "certification"
  | "portfolio"
  | "preference"
  | "availability"
  | "other";

export type CandidateFactReviewStateV1 =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_review";

export type CandidateImportBatchStatusV1 =
  | "pending"
  | "processed"
  | "failed"
  | "cancelled";

export type CandidateSourceDocumentV1 = Readonly<{
  id: string;
  userId: string;
  sourceType: CandidateSourceDocumentTypeV1;
  title?: string;
  originalFilename?: string;
  mimeType?: string;
  textHash: string;
  sourceHash: string;
  createdAt: CandidateEvidenceTimestampV1;
  updatedAt: CandidateEvidenceTimestampV1;
  reviewState: CandidateSourceDocumentReviewStateV1;
  visibility: CandidateEvidenceVisibilityV1;
  version: 1;
}>;

export type CandidateFactV1 = Readonly<{
  id: string;
  userId: string;
  sourceDocumentId: string;
  sourcePath: string;
  sourceQuote?: string;
  factType: CandidateFactTypeV1;
  value: unknown;
  normalizedText?: string;
  confidence?: number;
  reviewState: CandidateFactReviewStateV1;
  visibility: CandidateEvidenceVisibilityV1;
  createdAt: CandidateEvidenceTimestampV1;
  updatedAt: CandidateEvidenceTimestampV1;
  version: 1;
}>;

export type CandidateImportBatchV1 = Readonly<{
  id: string;
  userId: string;
  sourceDocumentIds: readonly string[];
  status: CandidateImportBatchStatusV1;
  createdAt: CandidateEvidenceTimestampV1;
  updatedAt: CandidateEvidenceTimestampV1;
  version: 1;
}>;
