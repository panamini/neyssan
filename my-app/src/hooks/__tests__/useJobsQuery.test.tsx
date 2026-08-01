import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useJobsQuery } from "../useJobsQuery";

const deferredRuns: Array<{
  resolve: (value: { done: boolean }) => void;
  reject: (error: Error) => void;
}> = [];
const ensureReadModelPage = vi.fn();
let statusOwnerKey = "clerk_a";

vi.mock("convex/react", () => ({
  useQuery: (reference: string) =>
    reference === "jobsPublic.jobsReadModelStatus"
      ? {
          ownerKey: statusOwnerKey,
          ready: false,
          status: "backfill_required",
        }
      : undefined,
  useMutation: () => ensureReadModelPage,
  usePaginatedQuery: () => ({
    results: undefined,
    status: "LoadingFirstPage",
    loadMore: vi.fn(),
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    jobsPublic: {
      listPageForUser: "jobsPublic.listPageForUser",
      listArchivedForUser: "jobsPublic.listArchivedForUser",
      getById: "jobsPublic.getById",
      jobsReadModelStatus: "jobsPublic.jobsReadModelStatus",
      ensureJobsReadModelPage: "jobsPublic.ensureJobsReadModelPage",
    },
  },
}));

describe("useJobsQuery read-model recovery", () => {
  beforeEach(() => {
    deferredRuns.length = 0;
    statusOwnerKey = "clerk_a";
    ensureReadModelPage.mockReset();
    ensureReadModelPage.mockImplementation(
      () =>
        new Promise<{ done: boolean }>((resolve, reject) => {
          deferredRuns.push({ resolve, reject });
        }),
    );
  });

  it("deduplicates StrictMode starts, handles failure, and retries explicitly", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <React.StrictMode>{children}</React.StrictMode>
    );
    const { result } = renderHook(
      () =>
        useJobsQuery({
          isLoaded: true,
          isSignedIn: true,
          isConvexAuthenticated: true,
          selectedJobRefreshKey: 0,
        }),
      { wrapper },
    );

    await waitFor(() => expect(ensureReadModelPage).toHaveBeenCalledTimes(1));
    expect(result.current.readModelState).toBe("loading");

    act(() => deferredRuns[0].reject(new Error("synthetic backfill failure")));
    await waitFor(() => expect(result.current.readModelState).toBe("error"));
    expect(result.current.readModelError).toContain("synthetic backfill failure");

    ensureReadModelPage.mockResolvedValueOnce({ done: true });
    act(() => result.current.retryReadModel());
    await waitFor(() => expect(ensureReadModelPage).toHaveBeenCalledTimes(2));
    expect(result.current.readModelError).toBeNull();
  });

  it("starts an isolated run when the authenticated owner changes", async () => {
    const { rerender } = renderHook(
      ({ ownerKey }: { ownerKey: string }) => {
        statusOwnerKey = ownerKey;
        return useJobsQuery({
          isLoaded: true,
          isSignedIn: true,
          isConvexAuthenticated: true,
          selectedJobRefreshKey: 0,
        });
      },
      { initialProps: { ownerKey: "clerk_a" } },
    );

    await waitFor(() => expect(ensureReadModelPage).toHaveBeenCalledTimes(1));
    rerender({ ownerKey: "clerk_b" });
    await waitFor(() => expect(ensureReadModelPage).toHaveBeenCalledTimes(2));

    act(() => {
      deferredRuns[0].resolve({ done: true });
      deferredRuns[1].resolve({ done: true });
    });
  });
});
