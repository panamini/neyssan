import React from "react";
import { useConvex, useConvexAuth, useMutation } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowSquareOut,
  ArrowLeft,
  ClipboardText,
  FileText,
  Plus,
} from "@/lib/icons";
import { api } from "../../convex/_generated/api";
import { ProposalBriefCard } from "../components/ProposalBriefCard";
import { MatchReadBlock } from "../components/jobs/MatchReadBlock";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import {
  PROPOSAL_EXTENSION_INSTALL_LINK,
  getProposalSourceLabel,
} from "../lib/proposal-source-platforms";
import { clearActiveLocalCvId } from "../lib/proposal-personalization";
import {
  createProposalWorkspaceResetState,
  startFreshProposalWorkspace,
} from "../lib/proposal-workspace-state";
import { createQuickStartLocationState } from "../lib/quick-start-routing";
import { formatUiDate } from "../lib/ui-date";

type JobsPageRouteParams = {
  jobId?: string;
};

type JobsPageListItem = {
  id: string;
  title: string;
  company: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  parseStatus: string;
  reviewState: string;
  status: string;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  lastActivityAt: number;
  linkedDocumentCount: number;
};

type JobsPageReviewItem = {
  id: string;
  fieldKey: string;
  label: string;
  reviewStatus: string;
  suggestedValue: unknown;
  approvedValue?: unknown;
  sourceText: string;
  confidence: number;
  updatedAt: number;
};

type JobsPageLinkedProposal = {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
};

type JobsPageDetail = {
  id: string;
  title: string;
  company: string;
  location: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  applicationUrl: string;
  parseStatus: string;
  reviewState: string;
  summary: string;
  rawDescription: string;
  responsibilities: string[];
  keywords: string[];
  mustHaves: string[];
  toneCues: string[];
  contacts: string[];
  status: string;
  matchRead: {
    tier: "strong" | "partial" | "weak" | "unknown";
    score: number | null;
    scoreVisible: boolean;
    confidence: "high" | "medium" | "low";
    matched: string[];
    missing: string[];
    basedOn: {
      profileId: string;
      profileLabel: string;
      jobId: string;
    };
    computedAt: number;
    method: "keyword-overlap";
    fallback:
      | "none"
      | "profile_missing"
      | "parse_failed"
      | "requirements_missing";
  } | null;
  linkedProposalCount: number;
  linkedProposals: JobsPageLinkedProposal[];
  reviewItems: JobsPageReviewItem[];
} | null;

type JobsSortOrder = "recent" | "oldest" | "title" | "company";
type JobsTrustFilter = "all" | "needs_review" | "ready" | "attention";

function isMissingJobsFunctionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("Could not find public function") &&
    (message.includes("jobsPublic:loadForUser") ||
      message.includes("jobsPublic:listForUser") ||
      message.includes("jobsPublic:getById"))
  );
}

function JobsBackendUnavailable(): JSX.Element {
  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-jobs-page">
        <div className="dasti-page-header">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title">Jobs</h1>
            <p className="dasti-stack__subtitle dasti-jobs-page__subtitle">
              The local Convex jobs functions are unavailable, so the Jobs
              workspace cannot load yet.
            </p>
          </div>
        </div>

        <div className="dasti-empty-state dasti-jobs-empty-state">
          <ClipboardText size={34} strokeWidth={1.25} aria-hidden="true" />
            <div className="dasti-empty-state__title">
            Jobs backend is out of sync
          </div>
          <p className="dasti-empty-state__subtitle">
            Start or restart the local Convex dev server so
            `jobsPublic:loadForUser` and related jobs functions are registered.
          </p>
          <div className="dasti-jobs-empty-state__actions">
            <button
              type="button"
              className="dasti-button dasti-button--primary dasti-button--pill"
              onClick={() => {
                void navigator.clipboard?.writeText("npm run dev:backend").catch(
                  () => {},
                );
              }}
            >
              Copy: npm run dev:backend
            </button>
            <button
              type="button"
              className="dasti-button dasti-button--pill"
              onClick={() => {
                void navigator.clipboard?.writeText("npx convex dev --local").catch(
                  () => {},
                );
              }}
            >
              Copy: npx convex dev --local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

class JobsPageRuntimeBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error !== null) {
      if (isMissingJobsFunctionError(this.state.error)) {
        return <JobsBackendUnavailable />;
      }
      throw this.state.error;
    }

    return this.props.children;
  }
}

function resolveJobsTrustLabel(args: {
  parseStatus?: string | null;
  reviewState?: string | null;
}): string {
  if (args.parseStatus === "failed") {
    return "Needs attention";
  }
  if (args.reviewState === "ready") {
    return "Ready";
  }
  if (args.reviewState === "needs_review") {
    return "Needs review";
  }
  if (args.parseStatus === "parsed") {
    return "Parsed";
  }
  return "Imported";
}

function matchesTrustFilter(
  job: JobsPageListItem,
  filter: JobsTrustFilter,
  optimisticReviewState?: string,
): boolean {
  const reviewState = optimisticReviewState ?? job.reviewState;
  if (filter === "all") {
    return true;
  }
  if (filter === "needs_review") {
    return reviewState === "needs_review";
  }
  if (filter === "ready") {
    return reviewState === "ready";
  }
  return job.parseStatus === "failed";
}

function resolveOptimisticReviewState(
  currentReviewState: string,
  reviewItems: JobsPageReviewItem[],
): string {
  if (reviewItems.length === 0) {
    return currentReviewState;
  }
  return reviewItems.every((item) => item.reviewStatus === "approved")
    ? "ready"
    : "needs_review";
}

function formatCollection(value: string[]): string[] {
  return value.map((entry) => entry.trim()).filter(Boolean);
}

function applyApprovedValueToJob(
  current: JobsPageDetail,
  item: JobsPageReviewItem,
  nextValue: unknown,
): JobsPageDetail {
  return {
    ...current,
    [item.fieldKey]: nextValue,
  } as JobsPageDetail;
}

function buildProposalRoute(jobId: string): string {
  return `/proposal?jobId=${encodeURIComponent(jobId)}`;
}

function buildResumeRoute(jobId: string): string {
  return `/cv?jobId=${encodeURIComponent(jobId)}`;
}

function buildJobsRoute(jobId: string): string {
  return `/jobs/${encodeURIComponent(jobId)}`;
}

function JobInfoSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}): JSX.Element | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="dasti-jobs-detail-section">
      <div className="dasti-jobs-detail-section__label">{title}</div>
      <div className="dasti-jobs-detail-section__stack">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="dasti-jobs-detail-section__item">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function JobsPageContent(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId: selectedJobId } = useParams<JobsPageRouteParams>();
  const { cvs, currentCv } = useCvLibrary();
  const convex = useConvex();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [trustFilter, setTrustFilter] =
    React.useState<JobsTrustFilter>("all");
  const [sortOrder, setSortOrder] = React.useState<JobsSortOrder>("recent");
  const [optimisticActivityById, setOptimisticActivityById] =
    React.useState<Record<string, number>>({});
  const [optimisticReviewStateById, setOptimisticReviewStateById] =
    React.useState<Record<string, string>>({});
  const [optimisticSelectedJob, setOptimisticSelectedJob] =
    React.useState<JobsPageDetail>(null);
  const [jobs, setJobs] = React.useState<JobsPageListItem[] | undefined>(undefined);
  const [jobsRuntimeUnavailable, setJobsRuntimeUnavailable] = React.useState(false);
  const [selectedJobRecord, setSelectedJobRecord] =
    React.useState<JobsPageDetail | undefined>(undefined);
  const lastMarkedJobIdRef = React.useRef<string | null>(null);

  const jobsLoadReference = React.useMemo(
    () => ((api as any).jobsPublic?.loadForUser ?? "jobsPublic.loadForUser") as any,
    [],
  );
  const jobByIdReference = React.useMemo(
    () => ((api as any).jobsPublic?.getById ?? "jobsPublic.getById") as any,
    [],
  );
  const loadJobsForUser = useMutation(jobsLoadReference);
  const approveReviewItem = useMutation(
    ((api as any).jobsPublic?.approveReviewItem ?? "jobsPublic.approveReviewItem") as any,
  );
  const markJobOpened = useMutation(
    ((api as any).jobsPublic?.markOpened ?? "jobsPublic.markOpened") as any,
  );
  const updateJobField = useMutation(
    ((api as any).jobsPublic?.updateField ?? "jobsPublic.updateField") as any,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn || !isConvexAuthenticated) {
      setJobs(undefined);
      setJobsRuntimeUnavailable(false);
      return;
    }

    let cancelled = false;
    setJobs(undefined);
    setJobsRuntimeUnavailable(false);

    void Promise.resolve(loadJobsForUser({}))
      .then((result) => {
        if (cancelled) {
          return;
        }
        setJobs((result ?? []) as JobsPageListItem[]);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if (isMissingJobsFunctionError(error)) {
          setJobsRuntimeUnavailable(true);
          setJobs([]);
          return;
        }
        throw error;
      });

    return () => {
      cancelled = true;
    };
  }, [
    isConvexAuthenticated,
    isLoaded,
    isSignedIn,
    loadJobsForUser,
  ]);

  React.useEffect(() => {
    if (!selectedJobId || !isLoaded || !isSignedIn || !isConvexAuthenticated) {
      setSelectedJobRecord(undefined);
      return;
    }

    if (jobsRuntimeUnavailable) {
      setSelectedJobRecord(null);
      return;
    }

    let cancelled = false;
    setSelectedJobRecord(undefined);

    void convex
      .query(jobByIdReference, { jobId: selectedJobId })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setSelectedJobRecord((result ?? null) as JobsPageDetail);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if (isMissingJobsFunctionError(error)) {
          setJobsRuntimeUnavailable(true);
          setSelectedJobRecord(null);
          return;
        }
        throw error;
      });

    return () => {
      cancelled = true;
    };
  }, [
    convex,
    isConvexAuthenticated,
    isLoaded,
    isSignedIn,
    jobByIdReference,
    jobsRuntimeUnavailable,
    selectedJobId,
  ]);

  React.useEffect(() => {
    if (selectedJobRecord === undefined) {
      return;
    }
    setOptimisticSelectedJob(selectedJobRecord);
    if (selectedJobRecord?.id) {
      setOptimisticReviewStateById((current) => ({
        ...current,
        [selectedJobRecord.id]: selectedJobRecord.reviewState,
      }));
    }
  }, [selectedJobRecord]);

  const filteredJobs = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const baseList = [...(jobs ?? [])]
      .filter((job) =>
        matchesTrustFilter(
          job,
          trustFilter,
          optimisticReviewStateById[job.id],
        ),
      )
      .filter((job) => {
        if (!normalizedQuery) {
          return true;
        }

        const searchableText = [
          job.title,
          job.company,
          job.sourceDomain,
          job.sourceType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      });

    baseList.sort((left, right) => {
      if (sortOrder === "oldest") {
        return (
          (optimisticActivityById[left.id] ?? left.lastActivityAt) -
          (optimisticActivityById[right.id] ?? right.lastActivityAt)
        );
      }
      if (sortOrder === "title") {
        return left.title.localeCompare(right.title);
      }
      if (sortOrder === "company") {
        return left.company.localeCompare(right.company);
      }
      return (
        (optimisticActivityById[right.id] ?? right.lastActivityAt) -
        (optimisticActivityById[left.id] ?? left.lastActivityAt)
      );
    });

    return baseList;
  }, [
    jobs,
    optimisticActivityById,
    optimisticReviewStateById,
    searchQuery,
    sortOrder,
    trustFilter,
  ]);

  const isMobileJobsLayout = viewportWidth < 760;

  React.useEffect(() => {
    if (!selectedJobId && filteredJobs.length > 0 && !isMobileJobsLayout) {
      void navigate(buildJobsRoute(filteredJobs[0].id), { replace: true });
    }
  }, [filteredJobs, isMobileJobsLayout, navigate, selectedJobId]);

  React.useEffect(() => {
    if (!selectedJobId || !isLoaded || !isSignedIn || !isConvexAuthenticated) {
      return;
    }

    if (lastMarkedJobIdRef.current === selectedJobId) {
      return;
    }

    lastMarkedJobIdRef.current = selectedJobId;
    const now = Date.now();
    setOptimisticActivityById((current) => ({
      ...current,
      [selectedJobId]: now,
    }));
    void markJobOpened({ jobId: selectedJobId });
  }, [
    isConvexAuthenticated,
    isLoaded,
    isSignedIn,
    markJobOpened,
    selectedJobId,
  ]);

  const selectedJobSummary = React.useMemo(
    () =>
      selectedJobId
        ? (jobs ?? []).find((job) => job.id === selectedJobId) ?? null
        : null,
    [jobs, selectedJobId],
  );
  const selectedJob = optimisticSelectedJob ?? selectedJobRecord ?? null;
  const selectedJobIsLoading =
    Boolean(selectedJobId) &&
    selectedJobRecord === undefined &&
    optimisticSelectedJob === null;
  const hasResumeWorkspace = cvs.length > 0 || Boolean(currentCv);

  const handleCreateProposal = React.useCallback(
    (jobId: string) => {
      clearActiveLocalCvId();
      startFreshProposalWorkspace();
      void navigate(buildProposalRoute(jobId), {
        state: createProposalWorkspaceResetState({
          entryIntent: "cover-letter-start",
        }),
      });
    },
    [navigate],
  );

  const handleTailorResume = React.useCallback(
    (jobId: string) => {
      const target = buildResumeRoute(jobId);
      if (hasResumeWorkspace) {
        void navigate(target);
        return;
      }

      void navigate(target, {
        state: createQuickStartLocationState(location.state, {
          createType: "resume",
          resumeMode: "upload-only",
        }),
      });
    },
    [hasResumeWorkspace, location.state, navigate],
  );

  const handleDoBoth = React.useCallback(
    (jobId: string) => {
      if (typeof window !== "undefined") {
        window.open(buildResumeRoute(jobId), "_blank", "noopener");
      }
      handleCreateProposal(jobId);
    },
    [handleCreateProposal],
  );

  const handleApproveReviewItem = React.useCallback(
    async (item: JobsPageReviewItem) => {
      setOptimisticSelectedJob((current) => {
        if (!current) {
          return current;
        }

        const nextReviewItems = current.reviewItems.map((reviewItem) =>
          reviewItem.id === item.id
            ? {
                ...reviewItem,
                reviewStatus: "approved",
                approvedValue:
                  reviewItem.approvedValue ?? reviewItem.suggestedValue,
              }
            : reviewItem,
        );
        const nextReviewState = resolveOptimisticReviewState(
          current.reviewState,
          nextReviewItems,
        );

        setOptimisticReviewStateById((prev) => ({
          ...prev,
          [current.id]: nextReviewState,
        }));

        return applyApprovedValueToJob(
          {
            ...current,
            reviewItems: nextReviewItems,
            reviewState: nextReviewState,
          },
          item,
          item.approvedValue ?? item.suggestedValue,
        );
      });

      if (!selectedJobId) {
        return;
      }

      await approveReviewItem({ jobId: selectedJobId, reviewItemId: item.id });
    },
    [approveReviewItem, selectedJobId],
  );

  const handleSaveReviewItem = React.useCallback(
    async (item: JobsPageReviewItem, nextValue: string | string[]) => {
      setOptimisticSelectedJob((current) => {
        if (!current) {
          return current;
        }

        const nextReviewItems = current.reviewItems.map((reviewItem) =>
          reviewItem.id === item.id
            ? {
                ...reviewItem,
                reviewStatus: "approved",
                approvedValue: nextValue,
              }
            : reviewItem,
        );
        const nextReviewState = resolveOptimisticReviewState(
          current.reviewState,
          nextReviewItems,
        );

        setOptimisticReviewStateById((prev) => ({
          ...prev,
          [current.id]: nextReviewState,
        }));

        return applyApprovedValueToJob(
          {
            ...current,
            reviewItems: nextReviewItems,
            reviewState: nextReviewState,
          },
          item,
          nextValue,
        );
      });

      if (!selectedJobId) {
        return;
      }

      await updateJobField({
        jobId: selectedJobId,
        fieldKey: item.fieldKey,
        value: nextValue,
      });
    },
    [selectedJobId, updateJobField],
  );

  const authStatusMessage = !isLoaded || isConvexAuthLoading
    ? "Loading…"
    : !isSignedIn || !isConvexAuthenticated
      ? "Sign in to view saved jobs."
      : null;

  if (jobsRuntimeUnavailable) {
    return <JobsBackendUnavailable />;
  }

  const hasJobs = (jobs?.length ?? 0) > 0;
  const selectedSourceLabel = getProposalSourceLabel(
    selectedJob?.sourceType ?? selectedJobSummary?.sourceType,
    selectedJob?.sourceUrl ?? selectedJobSummary?.sourceUrl,
  );
  const selectedKeywords = formatCollection(selectedJob?.keywords ?? []);
  const selectedMustHaves = formatCollection(selectedJob?.mustHaves ?? []);
  const selectedToneCues = formatCollection(selectedJob?.toneCues ?? []);
  const selectedResponsibilities = formatCollection(
    selectedJob?.responsibilities ?? [],
  );
  const selectedContacts = formatCollection(selectedJob?.contacts ?? []);
  const shouldShowListPane = !isMobileJobsLayout || !selectedJobId;
  const shouldShowDetailPane = !isMobileJobsLayout || Boolean(selectedJobId);

  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-jobs-page">
        <div className="dasti-page-header">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title">Jobs</h1>
            <p className="dasti-stack__subtitle dasti-jobs-page__subtitle">
              Reopen saved opportunities, review trust, and launch document work
              without turning the workspace into a CRM.
            </p>
          </div>
        </div>

        {authStatusMessage ? (
          <div className="dasti-hint" style={{ padding: "var(--space-5) 0" }}>
            {authStatusMessage}
          </div>
        ) : null}

        {!authStatusMessage && !hasJobs ? (
          <div className="dasti-empty-state dasti-jobs-empty-state">
            <ClipboardText size={34} strokeWidth={1.25} aria-hidden="true" />
            <div className="dasti-empty-state__title">No saved jobs yet</div>
            <p className="dasti-empty-state__subtitle">
              Save a role from the extension or paste a job description into the
              app to create your first Job Brief.
            </p>
            <div className="dasti-jobs-empty-state__actions">
              <a
                href={PROPOSAL_EXTENSION_INSTALL_LINK.href}
                target="_blank"
                rel="noreferrer"
                className="dasti-button dasti-button--primary dasti-button--pill"
              >
                <ArrowSquareOut size={14} strokeWidth={1.7} aria-hidden="true" />
                {PROPOSAL_EXTENSION_INSTALL_LINK.label}
              </a>
              <button
                type="button"
                className="dasti-button dasti-button--pill"
                onClick={() => {
                  clearActiveLocalCvId();
                  startFreshProposalWorkspace();
                  void navigate("/proposal", {
                    state: createProposalWorkspaceResetState({
                      entryIntent: "cover-letter-start",
                    }),
                  });
                }}
              >
                <Plus size={14} strokeWidth={1.7} aria-hidden="true" />
                Paste job manually
              </button>
            </div>
          </div>
        ) : null}

        {!authStatusMessage && hasJobs ? (
          <div
            className={[
              "dasti-jobs-layout",
              isMobileJobsLayout && selectedJobId
                ? "dasti-jobs-layout--mobile-detail"
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {shouldShowListPane ? (
            <section className="dasti-jobs-list-pane" aria-label="Jobs list">
              <div className="dasti-jobs-toolbar">
                <label className="dasti-jobs-toolbar__search">
                  <span className="sr-only">Search jobs</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search jobs"
                    aria-label="Search jobs"
                    className="dasti-select dasti-select--sm"
                  />
                </label>
                <label className="dasti-jobs-toolbar__select">
                  <span className="sr-only">Filter jobs by trust</span>
                  <select
                    value={trustFilter}
                    onChange={(event) =>
                      setTrustFilter(event.target.value as JobsTrustFilter)
                    }
                    aria-label="Filter jobs by trust"
                    className="dasti-select dasti-select--sm"
                  >
                    <option value="all">All trust states</option>
                    <option value="needs_review">Needs review</option>
                    <option value="ready">Ready</option>
                    <option value="attention">Needs attention</option>
                  </select>
                </label>
                <label className="dasti-jobs-toolbar__select">
                  <span className="sr-only">Sort jobs</span>
                  <select
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value as JobsSortOrder)
                    }
                    aria-label="Sort jobs"
                    className="dasti-select dasti-select--sm"
                  >
                    <option value="recent">Recent activity</option>
                    <option value="oldest">Oldest first</option>
                    <option value="title">Title</option>
                    <option value="company">Company</option>
                  </select>
                </label>
                <span className="dasti-jobs-toolbar__count">
                  {filteredJobs.length === (jobs?.length ?? 0)
                    ? `${jobs?.length ?? 0} saved`
                    : `${filteredJobs.length} of ${jobs?.length ?? 0}`}
                </span>
              </div>

              {filteredJobs.length === 0 ? (
                <div className="dasti-empty-state dasti-empty-state--panel">
                  <FileText size={28} strokeWidth={1.2} aria-hidden="true" />
                  <div className="dasti-empty-state__title">
                    No jobs match this search
                  </div>
                  <p className="dasti-empty-state__subtitle">
                    Try a broader query or reset the trust filter.
                  </p>
                </div>
              ) : (
                <div className="dasti-jobs-list" role="list">
                  {filteredJobs.map((job) => {
                    const trustLabel = resolveJobsTrustLabel({
                      parseStatus: job.parseStatus,
                      reviewState: optimisticReviewStateById[job.id] ?? job.reviewState,
                    });
                    const sourceLabel =
                      getProposalSourceLabel(job.sourceType, job.sourceUrl) ??
                      job.sourceDomain ??
                      "Imported source";
                    const isActive = job.id === selectedJobId;
                    const title = job.title.trim() || "Untitled job";
                    const company = job.company.trim() || "Unknown company";
                    const lastActivityLabel =
                      formatUiDate(
                        optimisticActivityById[job.id] ?? job.lastActivityAt,
                      ) ?? "Recent";

                    return (
                      <article
                        key={job.id}
                        className={[
                          "dasti-jobs-row",
                          isActive ? "dasti-jobs-row--active" : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        role="listitem"
                      >
                        <div className="dasti-jobs-row__copy">
                          <div className="dasti-jobs-row__title">{title}</div>
                          <div className="dasti-jobs-row__company">{company}</div>
                          <div className="dasti-jobs-row__meta">
                            <span>{sourceLabel}</span>
                            <span>·</span>
                            <span>{trustLabel}</span>
                          </div>
                          <div className="dasti-jobs-row__meta">
                            <span>Last activity {lastActivityLabel}</span>
                            <span>·</span>
                            <span>
                              {job.linkedDocumentCount} linked document
                              {job.linkedDocumentCount === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="dasti-button dasti-button--pill dasti-button--sm dasti-jobs-row__open"
                          onClick={() => void navigate(buildJobsRoute(job.id))}
                          aria-current={isActive ? "page" : undefined}
                        >
                          Open
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            ) : null}

            {shouldShowDetailPane ? (
            <section className="dasti-jobs-detail-pane" aria-label="Job detail">
              {!selectedJobId ? null : selectedJobIsLoading ? (
                <div className="dasti-empty-state dasti-empty-state--panel">
                  <div className="dasti-empty-state__title">Loading job…</div>
                </div>
              ) : !selectedJob ? (
                <div className="dasti-empty-state dasti-empty-state--panel">
                  <div className="dasti-empty-state__title">Job unavailable</div>
                  <p className="dasti-empty-state__subtitle">
                    This saved job could not be loaded. Open another job from the
                    list to continue.
                  </p>
                </div>
              ) : (
                <div className="dasti-jobs-detail">
                  {isMobileJobsLayout ? (
                    <div className="dasti-jobs-detail__mobile-back">
                      <button
                        type="button"
                        className="dasti-button dasti-button--pill dasti-button--sm"
                        onClick={() => void navigate("/jobs")}
                      >
                        <ArrowLeft size={14} strokeWidth={1.7} aria-hidden="true" />
                        Back to jobs
                      </button>
                    </div>
                  ) : null}
                  <div className="dasti-jobs-detail__topline">
                    <div className="dasti-jobs-detail__identity">
                      <div className="dasti-jobs-detail__title">
                        {selectedJob.title || "Untitled job"}
                      </div>
                      <div className="dasti-jobs-detail__meta">
                        <span>{selectedJob.company || "Unknown company"}</span>
                        {selectedJob.location ? (
                          <>
                            <span>·</span>
                            <span>{selectedJob.location}</span>
                          </>
                        ) : null}
                        {selectedSourceLabel ? (
                          <>
                            <span>·</span>
                            <span>{selectedSourceLabel}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="dasti-jobs-detail__actions">
                      <button
                        type="button"
                        className="dasti-button dasti-button--primary dasti-button--pill"
                        onClick={() => handleCreateProposal(selectedJob.id)}
                      >
                        Generate cover letter
                      </button>
                      <button
                        type="button"
                        className="dasti-button dasti-button--pill"
                        onClick={() => handleTailorResume(selectedJob.id)}
                      >
                        Tailor resume
                      </button>
                      <button
                        type="button"
                        className="dasti-button dasti-button--pill"
                        onClick={() => handleDoBoth(selectedJob.id)}
                      >
                        Do both
                      </button>
                    </div>
                  </div>

                  {selectedJob.matchRead ? (
                    <MatchReadBlock matchRead={selectedJob.matchRead} />
                  ) : null}

                  <ProposalBriefCard
                    documentTitle={selectedJob.title}
                    jobDescription={selectedJob.rawDescription}
                    sourceUrl={selectedJob.sourceUrl}
                    sourcePlatform={selectedJob.sourceType}
                    summaryText={selectedJob.summary}
                    parseStatus={selectedJob.parseStatus}
                    trustState={selectedJob.reviewState}
                    linkedDocumentCount={selectedJob.linkedProposalCount}
                    linkedProposals={selectedJob.linkedProposals}
                    reviewItems={selectedJob.reviewItems}
                    onApproveReviewItem={handleApproveReviewItem}
                    onSaveReviewItem={handleSaveReviewItem}
                  />

                  <div className="dasti-jobs-detail-grid">
                    <JobInfoSection
                      title="Responsibilities"
                      items={selectedResponsibilities}
                    />
                    <JobInfoSection
                      title="Keywords"
                      items={selectedKeywords}
                    />
                    <JobInfoSection
                      title="Must-haves"
                      items={selectedMustHaves}
                    />
                    <JobInfoSection title="Tone cues" items={selectedToneCues} />
                    <JobInfoSection title="Contacts" items={selectedContacts} />
                  </div>
                </div>
              )}
            </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function JobsPage(): JSX.Element {
  return (
    <JobsPageRuntimeBoundary>
      <JobsPageContent />
    </JobsPageRuntimeBoundary>
  );
}
