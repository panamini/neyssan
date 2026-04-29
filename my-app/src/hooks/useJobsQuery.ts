import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type JobsQueryListItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  isSample: boolean;
  isFavorite: boolean;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  parseStatus: string;
  reviewState: string;
  matchTier: "strong" | "partial" | "weak" | "unknown";
  status: string;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  lastActivityAt: number;
  linkedDocumentCount: number;
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
} {
  const jobsListReference = React.useMemo(
    () =>
      ((api as any).jobsPublic?.listForUser ?? "jobsPublic.listForUser") as any,
    [],
  );
  const archivedJobsListReference = React.useMemo(
    () =>
      ((api as any).jobsPublic?.listArchivedForUser ??
        "jobsPublic.listArchivedForUser") as any,
    [],
  );
  const jobByIdReference = React.useMemo(
    () => ((api as any).jobsPublic?.getById ?? "jobsPublic.getById") as any,
    [],
  );
  const queryArgs = isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip";

  const jobs = useQuery(
    jobsListReference,
    queryArgs,
  ) as JobsQueryListItem[] | undefined;
  const archivedJobs = useQuery(
    archivedJobsListReference,
    queryArgs,
  ) as JobsQueryListItem[] | undefined;
  const selectedJobRecord = useQuery(
    jobByIdReference,
    selectedJobId && isLoaded && isSignedIn && isConvexAuthenticated
      ? { jobId: selectedJobId, clientRefreshKey: selectedJobRefreshKey }
      : "skip",
  ) as JobsQueryDetail | undefined;

  return {
    jobs,
    archivedJobs,
    selectedJobRecord,
  };
}
