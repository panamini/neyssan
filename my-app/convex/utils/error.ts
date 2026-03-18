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
