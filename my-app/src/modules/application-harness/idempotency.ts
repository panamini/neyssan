import type { ApplicationOperationV1 } from "./schema";
import { buildStableHash } from "./fingerprints";

export type BuildApplicationRunIdempotencyKeyInput = Readonly<{
  userId: string;
  operation: ApplicationOperationV1;
  contextHash: string;
  inputHash: string;
}>;

export function buildApplicationRunIdempotencyKey(
  input: BuildApplicationRunIdempotencyKeyInput,
): Promise<string> {
  return buildStableHash({
    namespace: "application-harness",
    type: "application-run-idempotency",
    version: 1,
    input,
  });
}
