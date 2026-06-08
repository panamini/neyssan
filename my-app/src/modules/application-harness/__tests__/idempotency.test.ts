import { describe, expect, it } from "vitest";
import { buildStableHash, stableSerialize } from "../fingerprints";
import { buildApplicationRunIdempotencyKey } from "../idempotency";
import type { ApplicationRunV1 } from "../schema";

describe("application-harness idempotency", () => {
  it("produces the same idempotency key for the same operation input", () => {
    const input = {
      userId: "user_123",
      operation: "draft_cover_letter" as const,
      contextHash: "context_hash",
      inputHash: "input_hash",
    };

    expect(buildApplicationRunIdempotencyKey(input)).toBe(
      buildApplicationRunIdempotencyKey({ ...input }),
    );
  });

  it("changes the idempotency key when the operation changes", () => {
    const baseInput = {
      userId: "user_123",
      contextHash: "context_hash",
      inputHash: "input_hash",
    };

    expect(
      buildApplicationRunIdempotencyKey({
        ...baseInput,
        operation: "draft_cover_letter",
      }),
    ).not.toBe(
      buildApplicationRunIdempotencyKey({
        ...baseInput,
        operation: "create_artifact",
      }),
    );
  });

  it("does not mutate idempotency inputs", () => {
    const input = {
      userId: "user_123",
      operation: "build_context" as const,
      contextHash: "context_hash",
      inputHash: "input_hash",
    };
    const before = stableSerialize(input);

    buildApplicationRunIdempotencyKey(input);

    expect(stableSerialize(input)).toBe(before);
  });

  it("application run shell fixture compiles and hashes predictably", () => {
    const run: ApplicationRunV1 = {
      id: "run_123",
      userId: "user_123",
      contextId: "context_123",
      operation: "build_context",
      inputHash: "input_hash",
      idempotencyKey: buildApplicationRunIdempotencyKey({
        userId: "user_123",
        operation: "build_context",
        contextHash: "context_hash",
        inputHash: "input_hash",
      }),
      status: "queued",
      attemptCount: 0,
      resultIds: ["context_123"],
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      version: 1,
    };

    const equivalentRun = {
      version: 1,
      updatedAt: "2026-06-08T00:00:00.000Z",
      createdAt: "2026-06-08T00:00:00.000Z",
      resultIds: ["context_123"],
      attemptCount: 0,
      status: "queued",
      idempotencyKey: run.idempotencyKey,
      inputHash: "input_hash",
      operation: "build_context",
      contextId: "context_123",
      userId: "user_123",
      id: "run_123",
    } satisfies ApplicationRunV1;

    expect(buildStableHash(run)).toBe(buildStableHash(equivalentRun));
    expect(buildStableHash({ ...run, status: "running" })).not.toBe(buildStableHash(run));
  });
});
