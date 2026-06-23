/* eslint-disable @typescript-eslint/no-explicit-any -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_ARGUMENT'
  | 'ALREADY_EXISTS'
  | 'FAILED_PRECONDITION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export interface ErrorMetadata {
  message: string;
  metadata?: Record<string, any>;
}

export class ConvexError extends Error {
  constructor(
    public code: ErrorCode,
    public details: ErrorMetadata
  ) {
    super(details.message);
    this.name = 'ConvexError';
  }
}
