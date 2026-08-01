import React from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type JobsQueryListItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  rawDescription?: string | null;
  isSample: boolean;
  isFavorite: boolean;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  summary?: string | null;
  visibleSummary?: string | null;
  visibleRequirements?: string[];
  parseStatus: string;
  reviewState: string;
  reviewItems?: unknown[];
  matchTier: "strong" | "partial" | "weak" | "unknown";
  matchRead?: {
    tier: "strong" | "partial" | "weak" | "unknown";
  } | null;
  matchReview?: {
    verdict:
      | "strong_lead"
      | "possible_lead"
      | "probably_skip"
      | "not_enough_signal";
    score?: number | null;
  } | null;
  status: string;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  lastActivityAt: number;
  linkedDocumentCount: number;
  linkedProposalCount?: number;
  linkedProposals?: unknown[];
  sourceLanguage?: string | null;
  keywords?: string[];
  visibleKeywords?: string[];
  skills?: string[];
};

export type JobsQueryDetail = Record<string, unknown> | null;

type UseJobsQueryArgs = {
  isLoaded: boolean;
  isSignedIn: boolean;
  isConvexAuthenticated: boolean;
  selectedJobId?: string;
  selectedJobRefreshKey: number;
};

const JOBS_INBOX_PAGE_SIZE = 36;
const JOBS_READ_MODEL_STALL_LIMIT = 3;
const JOBS_READ_MODEL_YIELD_INTERVAL = 25;

type JobsPaginationState = {
  results?: JobsQueryListItem[];
  status:
    | "LoadingFirstPage"
    | "CanLoadMore"
    | "LoadingMore"
    | "Exhausted";
  loadMore: (numItems: number) => void;
};

export function useJobsQuery({
  isLoaded,
  isSignedIn,
  isConvexAuthenticated,
  selectedJobId,
  selectedJobRefreshKey,
}: UseJobsQueryArgs): {
  jobs: JobsQueryListItem[] | undefined;
  archivedJobs: JobsQueryListItem[] | undefined;
  selectedJobRecord: JobsQueryDetail | undefined;
  readModelState: "loading" | "ready" | "error";
  readModelError: string | null;
  retryReadModel: () => void;
  canLoadMoreJobs: boolean;
  isLoadingMoreJobs: boolean;
  loadMoreJobs: () => void;
  canLoadMoreArchivedJobs: boolean;
  isLoadingMoreArchivedJobs: boolean;
  loadMoreArchivedJobs: () => void;
} {
  const jobsListReference = React.useMemo(
    () =>
      (api as any).jobsPublic?.listPageForUser ??
      "jobsPublic.listPageForUser",
    [],
  );
  const archivedJobsListReference = React.useMemo(
    () =>
      (api as any).jobsPublic?.listArchivedForUser ??
      "jobsPublic.listArchivedForUser",
    [],
  );
  const jobByIdReference = React.useMemo(
    () => (api as any).jobsPublic?.getById ?? "jobsPublic.getById",
    [],
  );
  const readModelStatusReference = React.useMemo(
    () =>
      (api as any).jobsPublic?.jobsReadModelStatus ??
      "jobsPublic.jobsReadModelStatus",
    [],
  );
  const ensureReadModelReference = React.useMemo(
    () =>
      (api as any).jobsPublic?.ensureJobsReadModelPage ??
      "jobsPublic.ensureJobsReadModelPage",
    [],
  );
  const authenticated = isLoaded && isSignedIn && isConvexAuthenticated;
  const readModelStatus = useQuery(
    readModelStatusReference,
    authenticated ? {} : "skip",
  ) as { ownerKey: string; ready: boolean } | undefined;
  const ensureReadModelPage = useMutation(ensureReadModelReference) as (
    args: Record<string, never>,
  ) => Promise<{ done: boolean; progressToken: string }>;
  const [readModelError, setReadModelError] = React.useState<string | null>(null);
  const [retryToken, setRetryToken] = React.useState(0);
  const backfillRunRef = React.useRef<{
    ownerKey: string;
    generation: number;
    promise: Promise<void>;
  } | null>(null);
  const ownerGenerationRef = React.useRef({
    ownerKey: readModelStatus?.ownerKey ?? "authenticated-owner",
    generation: 0,
  });
  const resolvedOwnerKey =
    readModelStatus?.ownerKey ?? "authenticated-owner";

  React.useEffect(() => {
    if (ownerGenerationRef.current.ownerKey === resolvedOwnerKey) return;
    ownerGenerationRef.current = {
      ownerKey: resolvedOwnerKey,
      generation: ownerGenerationRef.current.generation + 1,
    };
    backfillRunRef.current = null;
    setReadModelError(null);
  }, [resolvedOwnerKey]);

  React.useEffect(() => {
    if (!authenticated || readModelStatus?.ready !== false) return;
    let cancelled = false;
    const generation = ownerGenerationRef.current.generation;
    if (
      !backfillRunRef.current ||
      backfillRunRef.current.ownerKey !== resolvedOwnerKey
    ) {
      const promise = (async () => {
        let previousProgress: string | null = null;
        let repeatedProgress = 0;
        let page = 0;
        while (true) {
          if (ownerGenerationRef.current.generation !== generation) return;
          const result = await ensureReadModelPage({});
          if (result.done) return;
          if (result.progressToken === previousProgress) repeatedProgress += 1;
          else repeatedProgress = 0;
          previousProgress = result.progressToken;
          if (repeatedProgress >= JOBS_READ_MODEL_STALL_LIMIT) {
            throw new Error("Jobs could not finish preparing. Please retry.");
          }
          page += 1;
          if (page % JOBS_READ_MODEL_YIELD_INTERVAL === 0) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
          }
        }
      })();
      backfillRunRef.current = {
        ownerKey: resolvedOwnerKey,
        generation,
        promise,
      };
      const clearCompletedRun = () => {
        if (backfillRunRef.current?.promise === promise) {
          backfillRunRef.current = null;
        }
      };
      void promise.then(clearCompletedRun, clearCompletedRun);
    }
    const run = backfillRunRef.current.promise;
    void run.then(
      () => {
        if (!cancelled) setReadModelError(null);
      },
      (error: unknown) => {
        if (!cancelled) {
          setReadModelError(
            error instanceof Error
              ? error.message
              : "Jobs could not be prepared. Try again.",
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [
    authenticated,
    ensureReadModelPage,
    readModelStatus?.ready,
    resolvedOwnerKey,
    retryToken,
  ]);

  const queryArgs = authenticated && readModelStatus?.ready ? {} : "skip";

  const jobsPage = usePaginatedQuery(jobsListReference, queryArgs, {
    initialNumItems: JOBS_INBOX_PAGE_SIZE,
  }) as JobsPaginationState | undefined;
  const archivedJobsPage = usePaginatedQuery(
    archivedJobsListReference,
    queryArgs,
    { initialNumItems: JOBS_INBOX_PAGE_SIZE },
  ) as JobsPaginationState | undefined;
  const selectedJobRecord = useQuery(
    jobByIdReference,
    selectedJobId && authenticated
      ? { jobId: selectedJobId, clientRefreshKey: selectedJobRefreshKey }
      : "skip",
  ) as JobsQueryDetail | undefined;
  const retryReadModel = React.useCallback(() => {
    setReadModelError(null);
    setRetryToken((current) => current + 1);
  }, []);
  const loadMoreJobs = React.useCallback(() => {
    if (jobsPage?.status === "CanLoadMore") {
      jobsPage.loadMore(JOBS_INBOX_PAGE_SIZE);
    }
  }, [jobsPage]);
  const loadMoreArchivedJobs = React.useCallback(() => {
    if (archivedJobsPage?.status === "CanLoadMore") {
      archivedJobsPage.loadMore(JOBS_INBOX_PAGE_SIZE);
    }
  }, [archivedJobsPage]);

  return {
    jobs: jobsPage?.results,
    archivedJobs: archivedJobsPage?.results,
    selectedJobRecord,
    readModelState: readModelError
      ? "error"
      : readModelStatus?.ready
        ? "ready"
        : "loading",
    readModelError,
    retryReadModel,
    canLoadMoreJobs: jobsPage?.status === "CanLoadMore",
    isLoadingMoreJobs: jobsPage?.status === "LoadingMore",
    loadMoreJobs,
    canLoadMoreArchivedJobs: archivedJobsPage?.status === "CanLoadMore",
    isLoadingMoreArchivedJobs: archivedJobsPage?.status === "LoadingMore",
    loadMoreArchivedJobs,
  };
}
