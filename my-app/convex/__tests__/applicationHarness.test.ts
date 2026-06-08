import { describe, expect, it, vi } from "vitest";

import { blockRun, completeRun, failRun } from "../applicationHarness";

type RunStatus = "queued" | "running" | "succeeded" | "failed" | "blocked";

function makeCtx(status: RunStatus) {
  const run = {
    _id: "run_doc_123",
    id: "run_123",
    userId: "user_123",
    status,
  };
  const patch = vi.fn().mockResolvedValue(undefined);
  const eq = vi.fn().mockReturnThis();
  const unique = vi.fn().mockResolvedValue(run);
  const withIndex = vi.fn(
    (_indexName: string, buildQuery: (query: { eq: typeof eq }) => unknown) => {
      buildQuery({ eq });
      return { unique };
    },
  );
  const query = vi.fn(() => ({ withIndex }));

  return {
    ctx: { db: { query, patch } },
    patch,
  };
}

describe("applicationHarness run lifecycle helpers", () => {
  it("completeRun accepts running runs", async () => {
    const { ctx, patch } = makeCtx("running");

    await expect(
      completeRun._handler(ctx as any, {
        userId: "user_123",
        id: "run_123",
        resultIds: ["artifact_123"],
        updatedAt: 2000,
      }),
    ).resolves.toBe("run_doc_123");

    expect(patch).toHaveBeenCalledWith("run_doc_123", {
      status: "succeeded",
      resultIds: ["artifact_123"],
      blockedReason: undefined,
      error: undefined,
      updatedAt: 2000,
    });
  });

  it("completeRun rejects non-running runs", async () => {
    const { ctx, patch } = makeCtx("failed");

    await expect(
      completeRun._handler(ctx as any, {
        userId: "user_123",
        id: "run_123",
        updatedAt: 2000,
      }),
    ).rejects.toThrow(/Cannot complete ApplicationRun/);

    expect(patch).not.toHaveBeenCalled();
  });

  it("failRun accepts running and blocked runs", async () => {
    for (const status of ["running", "blocked"] satisfies RunStatus[]) {
      const { ctx, patch } = makeCtx(status);

      await expect(
        failRun._handler(ctx as any, {
          userId: "user_123",
          id: "run_123",
          error: "run failed",
          updatedAt: 2000,
        }),
      ).resolves.toBe("run_doc_123");

      expect(patch).toHaveBeenCalledWith("run_doc_123", {
        status: "failed",
        blockedReason: undefined,
        error: "run failed",
        updatedAt: 2000,
      });
    }
  });

  it("failRun rejects completed runs", async () => {
    const { ctx, patch } = makeCtx("succeeded");

    await expect(
      failRun._handler(ctx as any, {
        userId: "user_123",
        id: "run_123",
        error: "late failure",
        updatedAt: 2000,
      }),
    ).rejects.toThrow(/Cannot fail ApplicationRun/);

    expect(patch).not.toHaveBeenCalled();
  });

  it("blockRun accepts queued and running runs", async () => {
    for (const status of ["queued", "running"] satisfies RunStatus[]) {
      const { ctx, patch } = makeCtx(status);

      await expect(
        blockRun._handler(ctx as any, {
          userId: "user_123",
          id: "run_123",
          blockedReason: "needs review",
          updatedAt: 2000,
        }),
      ).resolves.toBe("run_doc_123");

      expect(patch).toHaveBeenCalledWith("run_doc_123", {
        status: "blocked",
        blockedReason: "needs review",
        error: undefined,
        updatedAt: 2000,
      });
    }
  });

  it("blockRun rejects completed runs", async () => {
    const { ctx, patch } = makeCtx("succeeded");

    await expect(
      blockRun._handler(ctx as any, {
        userId: "user_123",
        id: "run_123",
        blockedReason: "late blocker",
        updatedAt: 2000,
      }),
    ).rejects.toThrow(/Cannot block ApplicationRun/);

    expect(patch).not.toHaveBeenCalled();
  });
});
