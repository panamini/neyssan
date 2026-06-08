import { describe, expect, it } from "vitest";
import { buildStableHash, stableSerialize } from "../fingerprints";
import { buildApplicationRunIdempotencyKey } from "../idempotency";
import type { ApplicationRunV1 } from "../schema";

const CREATED_AT_MS = Date.UTC(2026, 5, 8, 0, 0, 0, 0);

describe("application-harness idempotency", () => {
  it("produces the same idempotency key for the same operation input", async () => {
    const input = {
      userId: "user_123",
      operation: "draft_cover_letter" as const,
      contextHash: "context_hash",
      inputHash: "input_hash",
    };

    await expect(buildApplicationRunIdempotencyKey(input)).resolves.toBe(
      await buildApplicationRunIdempotencyKey({ ...input }),
    );
  });

  it("changes the idempotency key when the operation changes", async () => {
    const baseInput = {
      userId: "user_123",
      contextHash: "context_hash",
      inputHash: "input_hash",
    };

    await expect(
      buildApplicationRunIdempotencyKey({
        ...baseInput,
        operation: "draft_cover_letter",
      }),
    ).resolves.not.toBe(
      await buildApplicationRunIdempotencyKey({
        ...baseInput,
        operation: "create_artifact",
      }),
    );
  });

  it("does not mutate idempotency inputs", async () => {
    const input = {
      userId: "user_123",
      operation: "build_context" as const,
      contextHash: "context_hash",
      inputHash: "input_hash",
    };
    const before = stableSerialize(input);

    await buildApplicationRunIdempotencyKey(input);

    expect(stableSerialize(input)).toBe(before);
  });

  it("application run shell fixture compiles and hashes predictably", async () => {
    const run: ApplicationRunV1 = {
      id: "run_123",
      userId: "user_123",
      contextId: "context_123",
      operation: "build_context",
      inputHash: "input_hash",
      idempotencyKey: await buildApplicationRunIdempotencyKey({
        userId: "user_123",
        operation: "build_context",
        contextHash: "context_hash",
        inputHash: "input_hash",
      }),
      status: "queued",
      attemptCount: 0,
      resultIds: ["context_123"],
      error: "",
      createdAt: CREATED_AT_MS,
      updatedAt: CREATED_AT_MS,
      version: 1,
    };

    const equivalentRun = {
      version: 1,
      updatedAt: CREATED_AT_MS,
      createdAt: CREATED_AT_MS,
      error: "",
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

    expect(await buildStableHash(run)).toBe(await buildStableHash(equivalentRun));
    await expect(buildStableHash({ ...run, status: "running" })).resolves.not.toBe(
      await buildStableHash(run),
    );
  });
});
