import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useJobsQuery } from "../useJobsQuery";

const deferredRuns: Array<{
  resolve: (value: { done: boolean; progressToken?: string }) => void;
  reject: (error: Error) => void;
}> = [];
const ensureReadModelPage = vi.fn();
const loadMoreJobs = vi.fn();
const loadMoreArchivedJobs = vi.fn();
let statusOwnerKey = "clerk_a";
let readModelReady = false;
let paginatedResults: Array<{ id: string }> | undefined;
let paginatedStatus:
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted" = "LoadingFirstPage";
let initialNumItems: number | undefined;
let archivedResults: Array<{ id: string }> | undefined;
let archivedStatus: typeof paginatedStatus = "LoadingFirstPage";

vi.mock("convex/react", () => ({
  useQuery: (reference: string) =>
    reference === "jobsPublic.jobsReadModelStatus"
      ? {
          ownerKey: statusOwnerKey,
          ready: readModelReady,
          status: readModelReady ? "ready" : "backfill_required",
        }
      : undefined,
  useMutation: () => ensureReadModelPage,
  usePaginatedQuery: (
    reference: string,
    _args: Record<string, never> | "skip",
    options: { initialNumItems: number },
  ) => {
    initialNumItems = options.initialNumItems;
    return reference === "jobsPublic.listArchivedForUser"
      ? {
          results: archivedResults,
          status: archivedStatus,
          loadMore: loadMoreArchivedJobs,
        }
      : {
          results: paginatedResults,
          status: paginatedStatus,
          loadMore: loadMoreJobs,
        };
  },
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
    readModelReady = false;
    paginatedResults = undefined;
    paginatedStatus = "LoadingFirstPage";
    initialNumItems = undefined;
    loadMoreJobs.mockReset();
    loadMoreArchivedJobs.mockReset();
    archivedResults = undefined;
    archivedStatus = "LoadingFirstPage";
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

  it("keeps the first page at 36 and exposes bounded continuation state", () => {
    readModelReady = true;
    paginatedResults = Array.from({ length: 36 }, (_, index) => ({
      id: `job_${index}`,
    }));
    paginatedStatus = "CanLoadMore";

    const { result, rerender } = renderHook(() =>
      useJobsQuery({
        isLoaded: true,
        isSignedIn: true,
        isConvexAuthenticated: true,
        selectedJobRefreshKey: 0,
      }),
    );

    expect(initialNumItems).toBe(36);
    expect(result.current.jobs).toHaveLength(36);
    expect(result.current.canLoadMoreJobs).toBe(true);
    expect(result.current.isLoadingMoreJobs).toBe(false);

    act(() => result.current.loadMoreJobs());
    expect(loadMoreJobs).toHaveBeenCalledWith(36);

    paginatedStatus = "LoadingMore";
    rerender();
    expect(result.current.canLoadMoreJobs).toBe(false);
    expect(result.current.isLoadingMoreJobs).toBe(true);
    act(() => result.current.loadMoreJobs());
    expect(loadMoreJobs).toHaveBeenCalledTimes(1);

    paginatedResults = Array.from({ length: 52 }, (_, index) => ({
      id: `job_${index}`,
    }));
    paginatedStatus = "Exhausted";
    rerender();

    expect(result.current.jobs).toHaveLength(52);
    expect(result.current.canLoadMoreJobs).toBe(false);
  });

  it("continues past 800 advancing read-model pages and fails repeated stalls", async () => {
    let call = 0;
    ensureReadModelPage.mockImplementation(async () => {
      call += 1;
      return { done: call === 805, progressToken: `progress-${call}` };
    });
    const { result, unmount } = renderHook(() =>
      useJobsQuery({
        isLoaded: true,
        isSignedIn: true,
        isConvexAuthenticated: true,
        selectedJobRefreshKey: 0,
      }),
    );
    await waitFor(() => expect(call).toBe(805), { timeout: 5000 });
    expect(result.current.readModelError).toBeNull();
    unmount();

    call = 0;
    ensureReadModelPage.mockResolvedValue({
      done: false,
      progressToken: "stalled",
    });
    const stalled = renderHook(() =>
      useJobsQuery({
        isLoaded: true,
        isSignedIn: true,
        isConvexAuthenticated: true,
        selectedJobRefreshKey: 0,
      }),
    );
    await waitFor(() => expect(stalled.result.current.readModelState).toBe("error"));
    expect(stalled.result.current.readModelError).toContain("finish preparing");
  });

  it("exposes independent archived continuation", () => {
    readModelReady = true;
    archivedResults = Array.from({ length: 36 }, (_, index) => ({
      id: `archived_${index}`,
    }));
    archivedStatus = "CanLoadMore";
    const { result } = renderHook(() =>
      useJobsQuery({
        isLoaded: true,
        isSignedIn: true,
        isConvexAuthenticated: true,
        selectedJobRefreshKey: 0,
      }),
    );
    expect(result.current.archivedJobs).toHaveLength(36);
    expect(result.current.canLoadMoreArchivedJobs).toBe(true);
    act(() => result.current.loadMoreArchivedJobs());
    expect(loadMoreArchivedJobs).toHaveBeenCalledWith(36);
  });
});
