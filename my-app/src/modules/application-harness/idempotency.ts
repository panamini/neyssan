import type { ApplicationOperationV1 } from "./schema";
import { APPLICATION_HARNESS_HASH_NAMESPACE, buildStableHash } from "./fingerprints";

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
    namespace: APPLICATION_HARNESS_HASH_NAMESPACE,
    type: "application-run-idempotency",
    version: 1,
    input,
  });
}
