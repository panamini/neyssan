import React from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardText,
  DotsThree,
  FileText,
  Paperclip,
  Star,
  X,
} from "@/lib/icons";
import { api } from "../../convex/_generated/api";
import { ProposalBriefCard } from "../components/ProposalBriefCard";
import { FirstRunPanel } from "../components/jobs/FirstRunPanel";
import { MatchReadBlock } from "../components/jobs/MatchReadBlock";
import { NextStepBlock } from "../components/jobs/NextStepBlock";
import { useToast } from "../components/ui/toast";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { getProposalSourceLabel } from "../lib/proposal-source-platforms";
import { clearActiveLocalCvId } from "../lib/proposal-personalization";
import { formatCvDisplayTitle } from "../lib/proposal-personalization";
import {
  createProposalWorkspaceResetState,
  startFreshProposalWorkspace,
} from "../lib/proposal-workspace-state";
import { createQuickStartLocationState } from "../lib/quick-start-routing";
import type { CvDocument } from "../types/cvDocument";
import { formatUiDate } from "../lib/ui-date";

type JobsPageRouteParams = {
  jobId?: string;
};

type JobsPageListItem = {
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

type JobResumePickerOption = {
  id: string;
  title: string;
  dateLabel: string | null;
  dateSortValue: number;
};

type JobsPageDetail = {
  id: string;
  title: string;
  company: string;
  location: string;
  isSample: boolean;
  isFavorite: boolean;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  applicationUrl: string;
  parseStatus: string;
  reviewState: string;
  summary: string;
  summaryExtraction?: {
    value: string;
    confidence: number;
    sourceSpan: {
      start: number;
      end: number;
    } | null;
  };
  rawDescription: string;
  responsibilities: string[];
  keywords: string[];
  mustHaves: string[];
  toneCues: string[];
  contacts: string[];
  status: string;
  resumeId?: string;
  resumeName?: string;
  resumeSource?: "job" | "default";
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
    method: "keyword-overlap" | "llm";
    fallback:
      | "none"
      | "profile_missing"
      | "parse_failed"
      | "requirements_missing";
  } | null;
  nextStepBlock: {
    headline: string;
    usesCohortData: boolean;
    actions: Array<"cover_letter" | "resume" | "save_for_later">;
  } | null;
  linkedProposalCount: number;
  linkedProposals: JobsPageLinkedProposal[];
  reviewItems: JobsPageReviewItem[];
} | null;

type JobsSortOrder = "recent" | "oldest" | "title" | "company";
type JobsMatchFilter = "all" | "strong" | "partial" | "weak" | "unknown";

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

function matchesListFilters(
  job: JobsPageListItem,
  matchFilter: JobsMatchFilter,
  hasDocsOnly: boolean,
  needsReviewOnly: boolean,
  favoritesOnly: boolean,
  optimisticReviewState?: string,
  optimisticFavorite?: boolean,
): boolean {
  const reviewState = optimisticReviewState ?? job.reviewState;
  const isFavorite = optimisticFavorite ?? job.isFavorite;
  if (matchFilter !== "all" && job.matchTier !== matchFilter) {
    return false;
  }
  if (hasDocsOnly && job.linkedDocumentCount === 0) {
    return false;
  }
  if (needsReviewOnly && reviewState !== "needs_review") {
    return false;
  }
  if (favoritesOnly && !isFavorite) {
    return false;
  }
  return true;
}

function resolveMatchTierLabel(
  tier: JobsPageListItem["matchTier"],
): string {
  if (tier === "unknown") {
    return "—";
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function resolveLocationModeLabel(value: string): string {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || "Location unavailable";
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

function readCvPickerProfilePreview(
  cv: CvDocument,
): Record<string, unknown> | null {
  const profileSection = Array.isArray(cv.sections)
    ? cv.sections.find((section) => String(section.type) === "profile")
    : null;
  const profileEntry = Array.isArray(profileSection?.structuredContent)
    ? profileSection.structuredContent[0]
    : null;

  return profileEntry && typeof profileEntry === "object"
    ? (profileEntry as Record<string, unknown>)
    : null;
}

function readCvPickerString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function toResumePickerTimestamp(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatShortRelativeAge(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) {
    return "now";
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    return `${Math.max(1, Math.floor(diffMs / minute))}m`;
  }
  if (diffMs < day) {
    return `${Math.max(1, Math.floor(diffMs / hour))}h`;
  }

  return `${Math.max(1, Math.floor(diffMs / day))}d`;
}

function buildJobResumePickerOption(cv: CvDocument): JobResumePickerOption {
  const profilePreview = readCvPickerProfilePreview(cv);
  const profileName = readCvPickerString(profilePreview?.name);
  const desiredPosition =
    readCvPickerString(profilePreview?.desiredPosition) ??
    readCvPickerString(profilePreview?.title);
  const dateSource =
    typeof cv.metadata?.updatedAt === "string"
      ? cv.metadata.updatedAt
      : typeof cv.metadata?.createdAt === "string"
        ? cv.metadata.createdAt
        : undefined;
  const relativeAge = formatShortRelativeAge(dateSource);
  const exactDate = formatUiDate(dateSource);

  return {
    id: String(cv.id),
    title: formatCvDisplayTitle({
      title: String(cv.title ?? "Untitled CV"),
      profileName,
      desiredPosition,
      email: readCvPickerString(profilePreview?.email),
      phone: readCvPickerString(profilePreview?.phone),
      linkedin: readCvPickerString(profilePreview?.linkedin),
      website: readCvPickerString(profilePreview?.website),
      location: readCvPickerString(profilePreview?.location),
    }),
    dateLabel:
      relativeAge && exactDate ? `${relativeAge} · ${exactDate}` : relativeAge ?? exactDate ?? null,
    dateSortValue: toResumePickerTimestamp(dateSource),
  };
}

function JobsPageContent(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId: selectedJobId } = useParams<JobsPageRouteParams>();
  const { cvs, currentCv } = useCvLibrary();
  const { showToast } = useToast();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const holdListViewOpen = React.useMemo(
    () => new URLSearchParams(location.search).get("view") === "list",
    [location.search],
  );
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [matchFilter, setMatchFilter] =
    React.useState<JobsMatchFilter>("all");
  const [hasDocsOnly, setHasDocsOnly] = React.useState(false);
  const [needsReviewOnly, setNeedsReviewOnly] = React.useState(false);
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState<JobsSortOrder>("recent");
  const [optimisticActivityById, setOptimisticActivityById] =
    React.useState<Record<string, number>>({});
  const [optimisticReviewStateById, setOptimisticReviewStateById] =
    React.useState<Record<string, string>>({});
  const [optimisticFavoriteById, setOptimisticFavoriteById] =
    React.useState<Record<string, boolean>>({});
  const [optimisticSelectedJob, setOptimisticSelectedJob] =
    React.useState<JobsPageDetail>(null);
  const [isSeedingSample, setIsSeedingSample] = React.useState(false);
  const [firstRunError, setFirstRunError] = React.useState<string | null>(null);
  const lastMarkedJobIdRef = React.useRef<string | null>(null);
  const jobDecisionSessionRef = React.useRef<{
    jobId: string;
    openedAt: number;
    decisionRecorded: boolean;
  } | null>(null);
  const rowMenuRef = React.useRef<HTMLDivElement | null>(null);
  const resumePickerRef = React.useRef<HTMLDivElement | null>(null);
  const [openRowMenuJobId, setOpenRowMenuJobId] = React.useState<string | null>(null);
  const [isResumePickerOpen, setIsResumePickerOpen] = React.useState(false);

  const jobsListReference = React.useMemo(
    () => ((api as any).jobsPublic?.listForUser ?? "jobsPublic.listForUser") as any,
    [],
  );
  const jobByIdReference = React.useMemo(
    () => ((api as any).jobsPublic?.getById ?? "jobsPublic.getById") as any,
    [],
  );
  const approveReviewItem = useMutation(
    ((api as any).jobsPublic?.approveReviewItem ?? "jobsPublic.approveReviewItem") as any,
  );
  const seedSampleJob = useMutation(
    ((api as any).jobsPublic?.seedSampleJob ?? "jobsPublic.seedSampleJob") as any,
  );
  const trackJobsEvent = useMutation(
    ((api as any).jobsPublic?.trackEvent ?? "jobsPublic.trackEvent") as any,
  );
  const markJobOpened = useMutation(
    ((api as any).jobsPublic?.markOpened ?? "jobsPublic.markOpened") as any,
  );
  const archiveJob = useMutation(
    ((api as any).jobsPublic?.archiveJob ?? "jobsPublic.archiveJob") as any,
  );
  const duplicateJob = useMutation(
    ((api as any).jobsPublic?.duplicateJob ?? "jobsPublic.duplicateJob") as any,
  );
  const updateJobField = useMutation(
    ((api as any).jobsPublic?.updateField ?? "jobsPublic.updateField") as any,
  );
  const setJobResume = useMutation(
    ((api as any).jobsPublic?.setResumeForJob ?? "jobsPublic.setResumeForJob") as any,
  );
  const setJobFavorite = useMutation(
    ((api as any).jobsPublic?.setJobFavorite ?? "jobsPublic.setJobFavorite") as any,
  );
  const jobs = useQuery(
    jobsListReference,
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  ) as JobsPageListItem[] | undefined;
  const selectedJobRecord = useQuery(
    jobByIdReference,
    selectedJobId && isLoaded && isSignedIn && isConvexAuthenticated
      ? { jobId: selectedJobId }
      : "skip",
  ) as JobsPageDetail | undefined;

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
    if (!openRowMenuJobId) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !rowMenuRef.current?.contains(target)) {
        setOpenRowMenuJobId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenRowMenuJobId(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openRowMenuJobId]);

  React.useEffect(() => {
    if (!isResumePickerOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !resumePickerRef.current?.contains(target)) {
        setIsResumePickerOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsResumePickerOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isResumePickerOpen]);

  React.useEffect(() => {
    setIsResumePickerOpen(false);
  }, [selectedJobId]);

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
        matchesListFilters(
          job,
          matchFilter,
          hasDocsOnly,
          needsReviewOnly,
          favoritesOnly,
          optimisticReviewStateById[job.id],
          optimisticFavoriteById[job.id],
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
    optimisticFavoriteById,
    optimisticReviewStateById,
    favoritesOnly,
    hasDocsOnly,
    matchFilter,
    needsReviewOnly,
    searchQuery,
    sortOrder,
  ]);

  const isMobileJobsLayout = viewportWidth < 760;

  React.useEffect(() => {
    if (
      !selectedJobId &&
      filteredJobs.length > 0 &&
      !isMobileJobsLayout &&
      !holdListViewOpen
    ) {
      void navigate(buildJobsRoute(filteredJobs[0].id), { replace: true });
    }
  }, [filteredJobs, holdListViewOpen, isMobileJobsLayout, navigate, selectedJobId]);

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
  const resumePickerOptions = React.useMemo(
    () =>
      cvs
        .map((cv) => buildJobResumePickerOption(cv))
        .sort((left, right) => right.dateSortValue - left.dateSortValue),
    [cvs],
  );

  const recordJobDecision = React.useCallback(
    (
      outcome: "cover_letter" | "resume" | "bounce",
      jobId: string,
    ) => {
      const session = jobDecisionSessionRef.current;
      if (!session || session.jobId !== jobId || session.decisionRecorded) {
        return;
      }

      session.decisionRecorded = true;
      void trackJobsEvent({
        event: "job_decision_made",
        jobId,
        outcome,
        timeToDecisionMs: Math.max(0, Date.now() - session.openedAt),
        tier: selectedJob?.matchRead?.tier ?? "unknown",
      }).catch(() => {});
    },
    [selectedJob?.matchRead?.tier, trackJobsEvent],
  );

  React.useEffect(() => {
    if (!selectedJob?.id) {
      return undefined;
    }

    const openedAt = Date.now();
    jobDecisionSessionRef.current = {
      jobId: selectedJob.id,
      openedAt,
      decisionRecorded: false,
    };
    void trackJobsEvent({
      event: "job_opened",
      jobId: selectedJob.id,
      hasMatchRead: Boolean(selectedJob.matchRead),
      reviewState: selectedJob.reviewState,
    }).catch(() => {});

    return () => {
      const session = jobDecisionSessionRef.current;
      if (!session || session.jobId !== selectedJob.id || session.decisionRecorded) {
        return;
      }

      session.decisionRecorded = true;
      void trackJobsEvent({
        event: "job_decision_made",
        jobId: selectedJob.id,
        outcome: "bounce",
        timeToDecisionMs: Math.max(0, Date.now() - session.openedAt),
        tier: selectedJob.matchRead?.tier ?? "unknown",
      }).catch(() => {});
    };
  }, [selectedJob?.id, selectedJob?.matchRead?.tier, trackJobsEvent]);

  const handleCreateProposal = React.useCallback(
    (jobId: string) => {
      recordJobDecision("cover_letter", jobId);
      clearActiveLocalCvId();
      startFreshProposalWorkspace();
      void navigate(buildProposalRoute(jobId), {
        state: createProposalWorkspaceResetState({
          entryIntent: "cover-letter-start",
        }),
      });
    },
    [navigate, recordJobDecision],
  );

  const handleImportFirstJob = React.useCallback(() => {
    clearActiveLocalCvId();
    startFreshProposalWorkspace();
    void navigate("/proposal", {
      state: createProposalWorkspaceResetState({
        entryIntent: "cover-letter-start",
        jobImportFocus: "supported-sites",
      }),
    });
  }, [navigate]);

  const handleTrySampleJob = React.useCallback(async () => {
    setIsSeedingSample(true);
    setFirstRunError(null);

    try {
      const result = await seedSampleJob({});
      await navigate(buildJobsRoute(result.jobId));
    } catch (error) {
      setFirstRunError(
        error instanceof Error ? error.message : "Sample job could not be created.",
      );
    } finally {
      setIsSeedingSample(false);
    }
  }, [navigate, seedSampleJob]);

  const handleOpenResumeWithJob = React.useCallback(
    (jobId: string) => {
      recordJobDecision("resume", jobId);
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
    [hasResumeWorkspace, location.state, navigate, recordJobDecision],
  );

  const handleAttachResumeToJob = React.useCallback(
    async (resumeId: string) => {
      if (!selectedJob?.id) {
        return;
      }

      const selectedOption =
        resumePickerOptions.find((option) => option.id === resumeId) ?? null;
      const resumeName = selectedOption?.title ?? null;

      try {
        await setJobResume({
          jobId: selectedJob.id,
          resumeId,
          resumeName,
        });
        setOptimisticSelectedJob((current) =>
          current && current.id === selectedJob.id
            ? {
                ...current,
                resumeId,
                resumeName: resumeName ?? undefined,
                resumeSource: "job",
              }
            : current,
        );
        setIsResumePickerOpen(false);
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : "Could not attach the selected resume.",
          { variant: "error" },
        );
      }
    },
    [resumePickerOptions, selectedJob?.id, setJobResume, showToast],
  );

  const handleDetachResumeFromJob = React.useCallback(async () => {
    if (!selectedJob?.id) {
      return;
    }

    try {
      await setJobResume({
        jobId: selectedJob.id,
        resumeId: null,
        resumeName: null,
      });
      setOptimisticSelectedJob((current) =>
        current && current.id === selectedJob.id
          ? {
              ...current,
              resumeId: undefined,
              resumeName: undefined,
              resumeSource: undefined,
            }
          : current,
      );
      setIsResumePickerOpen(false);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not detach the resume.",
        { variant: "error" },
      );
    }
  }, [selectedJob?.id, setJobResume, showToast]);

  const handleSetJobFavorite = React.useCallback(
    async (jobId: string, nextFavorite: boolean) => {
      const previousFavorite =
        optimisticFavoriteById[jobId] ??
        (selectedJob?.id === jobId ? selectedJob.isFavorite : undefined) ??
        (jobs ?? []).find((job) => job.id === jobId)?.isFavorite ??
        false;

      setOptimisticFavoriteById((current) => ({
        ...current,
        [jobId]: nextFavorite,
      }));
      setOptimisticSelectedJob((current) =>
        current && current.id === jobId
          ? {
              ...current,
              isFavorite: nextFavorite,
            }
          : current,
      );

      try {
        await setJobFavorite({ jobId, isFavorite: nextFavorite });
      } catch (error) {
        setOptimisticFavoriteById((current) => ({
          ...current,
          [jobId]: previousFavorite,
        }));
        setOptimisticSelectedJob((current) =>
          current && current.id === jobId
            ? {
                ...current,
                isFavorite: previousFavorite,
              }
            : current,
        );
        showToast(
          error instanceof Error ? error.message : "Could not update favorite.",
          { variant: "error" },
        );
      }
    },
    [
      jobs,
      optimisticFavoriteById,
      selectedJob?.id,
      selectedJob?.isFavorite,
      setJobFavorite,
      showToast,
    ],
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
      void trackJobsEvent({
        event: "import_accepted",
        jobId: selectedJobId,
        fieldKey: item.fieldKey,
      }).catch(() => {});
    },
    [approveReviewItem, selectedJobId, trackJobsEvent],
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
      void trackJobsEvent({
        event: "field_corrected",
        jobId: selectedJobId,
        fieldKey: item.fieldKey,
        beforeConfidence: item.confidence,
      }).catch(() => {});
      void trackJobsEvent({
        event: "import_rejected",
        jobId: selectedJobId,
        fieldKey: item.fieldKey,
      }).catch(() => {});
    },
    [selectedJobId, trackJobsEvent, updateJobField],
  );

  const handleSaveField = React.useCallback(
    async (fieldKey: string, nextValue: string | string[]) => {
      setOptimisticSelectedJob((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          [fieldKey]: nextValue,
        } as JobsPageDetail;
      });

      if (!selectedJobId) {
        return;
      }

      await updateJobField({
        jobId: selectedJobId,
        fieldKey,
        value: nextValue,
      });
      void trackJobsEvent({
        event: "field_corrected",
        jobId: selectedJobId,
        fieldKey,
        beforeConfidence:
          fieldKey === "summary"
            ? Number(selectedJob?.summaryExtraction?.confidence ?? 0.35)
            : 0,
      }).catch(() => {});
    },
    [selectedJob, selectedJobId, trackJobsEvent, updateJobField],
  );

  const handleOpenJobSource = React.useCallback((sourceUrl: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = String(sourceUrl ?? "").trim();
    if (!nextUrl) {
      return;
    }

    window.open(nextUrl, "_blank", "noopener");
  }, []);

  const handleArchiveJob = React.useCallback(
    async (jobId: string) => {
      await archiveJob({ jobId });
      if (selectedJobId === jobId) {
        await navigate("/jobs?view=list");
      }
    },
    [archiveJob, navigate, selectedJobId],
  );

  const handleDuplicateJob = React.useCallback(
    async (jobId: string) => {
      const result = await duplicateJob({ jobId });
      await navigate(buildJobsRoute(result.jobId));
    },
    [duplicateJob, navigate],
  );

  const authStatusMessage = !isLoaded || isConvexAuthLoading
    ? "Loading…"
    : !isSignedIn || !isConvexAuthenticated
      ? "Sign in to view jobs."
      : null;
  const isJobsListLoading =
    !authStatusMessage &&
    isLoaded &&
    isSignedIn &&
    isConvexAuthenticated &&
    jobs === undefined;
  const hasJobs = (jobs?.length ?? 0) > 0;
  const selectedSourceLabel = getProposalSourceLabel(
    selectedJob?.sourceType ?? selectedJobSummary?.sourceType,
    selectedJob?.sourceUrl ?? selectedJobSummary?.sourceUrl,
  );
  const shouldShowListPane = !isMobileJobsLayout || !selectedJobId;
  const shouldShowDetailPane = !isMobileJobsLayout || Boolean(selectedJobId);

  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-jobs-page">
        <div className="dasti-page-header">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title">Jobs</h1>
            <p className="dasti-stack__subtitle dasti-jobs-page__subtitle">
              Reopen opportunities, review trust, and launch document work
              without turning the workspace into a CRM.
            </p>
          </div>
        </div>

        {authStatusMessage ? (
          <div className="dasti-hint" style={{ padding: "var(--space-5) 0" }}>
            {authStatusMessage}
          </div>
        ) : null}

        {isJobsListLoading ? (
          <div className="dasti-hint" style={{ padding: "var(--space-5) 0" }}>
            Loading jobs…
          </div>
        ) : null}

        {!authStatusMessage && !isJobsListLoading && !hasJobs ? (
          <FirstRunPanel
            onImportFirstJob={handleImportFirstJob}
            onTrySampleJob={handleTrySampleJob}
            isSeedingSample={isSeedingSample}
            errorMessage={firstRunError}
          />
        ) : null}

        {!authStatusMessage && !isJobsListLoading && hasJobs ? (
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
                    ? `${jobs?.length ?? 0} jobs`
                    : `${filteredJobs.length} of ${jobs?.length ?? 0}`}
                </span>
              </div>
              <div className="dasti-jobs-filter-chips" aria-label="Job filters">
                <button
                  type="button"
                  className={[
                    "dasti-jobs-filter-chip",
                    matchFilter === "all" ? "dasti-jobs-filter-chip--active" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setMatchFilter("all")}
                >
                  All tiers
                </button>
                {(["strong", "partial", "weak", "unknown"] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    className={[
                      "dasti-jobs-filter-chip",
                      matchFilter === tier ? "dasti-jobs-filter-chip--active" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setMatchFilter(tier)}
                  >
                    {tier === "unknown"
                      ? "Match —"
                      : `Match ${resolveMatchTierLabel(tier)}`}
                  </button>
                ))}
                <button
                  type="button"
                  className={[
                    "dasti-jobs-filter-chip",
                    hasDocsOnly ? "dasti-jobs-filter-chip--active" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setHasDocsOnly((current) => !current)}
                >
                  Has docs
                </button>
                <button
                  type="button"
                  className={[
                    "dasti-jobs-filter-chip",
                    needsReviewOnly ? "dasti-jobs-filter-chip--active" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setNeedsReviewOnly((current) => !current)}
                >
                  Needs review
                </button>
                <button
                  type="button"
                  className={[
                    "dasti-jobs-filter-chip",
                    favoritesOnly ? "dasti-jobs-filter-chip--active" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setFavoritesOnly((current) => !current)}
                >
                  Favorites
                </button>
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
                    const isActive = job.id === selectedJobId;
                    const title = job.title.trim() || "Untitled job";
                    const company = job.company.trim() || "Unknown company";
                    const locationLabel = resolveLocationModeLabel(job.location);
                    const lastActivityLabel =
                      formatUiDate(
                        optimisticActivityById[job.id] ?? job.lastActivityAt,
                      ) ?? "Recent";
                    const reviewState =
                      optimisticReviewStateById[job.id] ?? job.reviewState;
                    const isFavorite =
                      optimisticFavoriteById[job.id] ?? job.isFavorite;
                    const matchLabel = resolveMatchTierLabel(job.matchTier);
                    const isRowMenuOpen = openRowMenuJobId === job.id;

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
                        onClick={() => void navigate(buildJobsRoute(job.id))}
                      >
                        <div className="dasti-jobs-row__copy">
                          <div className="dasti-jobs-row__title">
                            <span>{title}</span>
                            {job.isSample ? (
                              <span className="dasti-jobs-sample-badge">Sample</span>
                            ) : null}
                            {isFavorite ? (
                              <span className="dasti-jobs-sample-badge">Favorite</span>
                            ) : null}
                          </div>
                          <div className="dasti-jobs-row__company">
                            {company}
                            {` · ${locationLabel}`}
                          </div>
                          <div className="dasti-jobs-row__meta">
                            <span className="dasti-jobs-match-chip">
                              {matchLabel}
                            </span>
                            <span className="dasti-jobs-row__meta-pill">
                              <FileText size={12} strokeWidth={1.7} aria-hidden="true" />
                              <span>{job.linkedDocumentCount}</span>
                            </span>
                            <span>Last activity {lastActivityLabel}</span>
                            {reviewState === "needs_review" ? (
                              <span
                                className="dasti-jobs-review-dot"
                                aria-label="Needs review"
                                title="Needs review"
                              />
                            ) : null}
                          </div>
                        </div>
                        <div className="dasti-jobs-row__controls">
                          <button
                            type="button"
                            className="dasti-icon-button dasti-jobs-row__favorite"
                            aria-pressed={isFavorite}
                            aria-label={
                              isFavorite
                                ? `Remove ${title} from favorites`
                                : `Mark ${title} as favorite`
                            }
                            title={isFavorite ? "Remove from favorites" : "Mark favorite"}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleSetJobFavorite(job.id, !isFavorite);
                            }}
                          >
                            <Star
                              size={16}
                              strokeWidth={1.8}
                              weight={isFavorite ? "fill" : "regular"}
                              aria-hidden="true"
                            />
                          </button>
                          {isActive ? (
                            <div
                              ref={resumePickerRef}
                              className="dasti-jobs-detail__resume-picker dasti-jobs-row__resume-picker"
                            >
                              <div
                                className={
                                  selectedJob?.resumeName
                                    ? "styleforge-active-cv-control styleforge-active-cv-control--loaded dasti-jobs-row__cv-control"
                                    : "styleforge-active-cv-control styleforge-active-cv-control--ghost dasti-jobs-row__cv-control"
                                }
                              >
                                <button
                                  type="button"
                                  className="styleforge-active-cv-control__icon-button"
                                  aria-label={
                                    selectedJob?.resumeName
                                      ? "Remove attached resume"
                                      : "Open resume picker"
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (selectedJob?.resumeName) {
                                      void handleDetachResumeFromJob();
                                      return;
                                    }
                                    setIsResumePickerOpen((current) => !current);
                                  }}
                                >
                                  <span
                                    className="styleforge-active-cv-control__icon styleforge-active-cv-control__icon--base"
                                    aria-hidden
                                  >
                                    <Paperclip size={15} strokeWidth={1.8} />
                                  </span>
                                  {selectedJob?.resumeName ? (
                                    <span
                                      className="styleforge-active-cv-control__icon styleforge-active-cv-control__icon--hover"
                                      aria-hidden
                                    >
                                      <X size={15} strokeWidth={1.8} />
                                    </span>
                                  ) : null}
                                </button>
                                <button
                                  type="button"
                                  className="styleforge-active-cv-control__body"
                                  aria-controls={`job-resume-picker-${job.id}`}
                                  aria-expanded={isResumePickerOpen}
                                  aria-haspopup="dialog"
                                  aria-label={
                                    selectedJob?.resumeName
                                      ? `Attached resume: ${selectedJob.resumeName}`
                                      : "Attach a resume"
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setIsResumePickerOpen((current) => !current);
                                  }}
                                >
                                  <span className="dasti-proposal-chip__label dasti-proposal-chip__label--resume">
                                    {selectedJob?.resumeName ?? "Attach CV"}
                                  </span>
                                </button>
                              </div>
                              {isResumePickerOpen ? (
                                <div
                                  id={`job-resume-picker-${job.id}`}
                                  role="dialog"
                                  aria-label="Attach a resume"
                                  className="dasti-jobs-detail__resume-popover dasti-toolbar-drawer-surface"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                >
                                  {resumePickerOptions.length === 0 ? (
                                    <div className="dasti-jobs-detail__resume-empty">
                                      No local resumes found yet. Create or import one in
                                      CvForge.
                                    </div>
                                  ) : (
                                    <div className="dasti-jobs-detail__resume-popover-list">
                                      {resumePickerOptions.map((option) => (
                                        <button
                                          key={option.id}
                                          type="button"
                                          className={[
                                            "dasti-jobs-detail__resume-option",
                                            option.id === selectedJob?.resumeId
                                              ? "dasti-jobs-detail__resume-option--active"
                                              : "",
                                          ]
                                            .filter(Boolean)
                                            .join(" ")}
                                          aria-label={`Attach ${option.title}`}
                                          onClick={() => {
                                            void handleAttachResumeToJob(option.id);
                                          }}
                                        >
                                          <span className="dasti-jobs-detail__resume-option-title">
                                            {option.title}
                                          </span>
                                          {option.dateLabel ? (
                                            <span className="dasti-jobs-detail__resume-option-meta">
                                              {option.dateLabel}
                                            </span>
                                          ) : null}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div
                            ref={isRowMenuOpen ? rowMenuRef : null}
                            className="dasti-import-dropdown dasti-jobs-row__menu"
                            data-open={isRowMenuOpen ? "true" : "false"}
                          >
                          <button
                            type="button"
                            className="dasti-icon-button dasti-jobs-row__menu-trigger"
                            aria-label={`More actions for ${title}`}
                            aria-expanded={isRowMenuOpen}
                            aria-haspopup="menu"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenRowMenuJobId((current) =>
                                current === job.id ? null : job.id,
                              );
                            }}
                          >
                            <DotsThree size={16} strokeWidth={1.7} aria-hidden="true" />
                          </button>
                          {isRowMenuOpen ? (
                            <div
                              className="dasti-import-dropdown__menu dasti-import-dropdown__menu--compact dasti-toolbar-drawer-surface dasti-jobs-row__menu-surface"
                              role="menu"
                              aria-label={`Actions for ${title}`}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="dasti-cv-style-presets__option"
                                disabled={!job.sourceUrl}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenRowMenuJobId(null);
                                  handleOpenJobSource(job.sourceUrl);
                                }}
                              >
                                <span className="dasti-cv-style-presets__option-copy">
                                  <span className="dasti-cv-style-presets__option-title">
                                    Open source
                                  </span>
                                </span>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="dasti-cv-style-presets__option"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenRowMenuJobId(null);
                                  void handleArchiveJob(job.id);
                                }}
                              >
                                <span className="dasti-cv-style-presets__option-copy">
                                  <span className="dasti-cv-style-presets__option-title">
                                    Archive
                                  </span>
                                </span>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="dasti-cv-style-presets__option"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenRowMenuJobId(null);
                                  void handleDuplicateJob(job.id);
                                }}
                              >
                                <span className="dasti-cv-style-presets__option-copy">
                                  <span className="dasti-cv-style-presets__option-title">
                                    Duplicate
                                  </span>
                                </span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        </div>
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
                    This job could not be loaded. Open another job from the
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
                        <span>{selectedJob.title || "Untitled job"}</span>
                        {selectedJob.isSample ? (
                          <span className="dasti-jobs-sample-badge">Sample</span>
                        ) : null}
                        {selectedJob.isFavorite ? (
                          <span className="dasti-jobs-sample-badge">Favorite</span>
                        ) : null}
                      </div>
                      <div className="dasti-jobs-detail__meta">
                        <span>{selectedJob.company || "Unknown company"}</span>
                        <>
                          <span>·</span>
                          <span>{resolveLocationModeLabel(selectedJob.location)}</span>
                        </>
                        {selectedSourceLabel ? (
                          <>
                            <span>·</span>
                            <span>{selectedSourceLabel}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="dasti-icon-button"
                      aria-pressed={selectedJob.isFavorite}
                      aria-label={
                        selectedJob.isFavorite
                          ? "Remove job from favorites"
                          : "Mark job as favorite"
                      }
                      title={
                        selectedJob.isFavorite
                          ? "Remove from favorites"
                          : "Mark favorite"
                      }
                      onClick={() => {
                        void handleSetJobFavorite(
                          selectedJob.id,
                          !selectedJob.isFavorite,
                        );
                      }}
                    >
                      <Star
                        size={17}
                        strokeWidth={1.8}
                        weight={selectedJob.isFavorite ? "fill" : "regular"}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {selectedJob.matchRead ? (
                    <MatchReadBlock matchRead={selectedJob.matchRead} />
                  ) : null}

                  {selectedJob.nextStepBlock ? (
                    <NextStepBlock
                      headline={selectedJob.nextStepBlock.headline}
                      usesCohortData={selectedJob.nextStepBlock.usesCohortData}
                      actions={selectedJob.nextStepBlock.actions.map((action) => ({
                        id: action,
                        label:
                          action === "cover_letter"
                            ? "Generate cover letter"
                            : action === "resume"
                              ? "Open resume with this job"
                              : "Add to favorites",
                      }))}
                      onSelectAction={(actionId) => {
                        if (actionId === "cover_letter") {
                          handleCreateProposal(selectedJob.id);
                          return;
                        }
                        if (actionId === "resume") {
                          handleOpenResumeWithJob(selectedJob.id);
                          return;
                        }
                        void handleSetJobFavorite(selectedJob.id, true);
                      }}
                    />
                  ) : null}

                  <ProposalBriefCard
                    sourceJobTitle={selectedJob.title}
                    outputDocumentTitle={null}
                    jobDescription={selectedJob.rawDescription}
                    sourceUrl={selectedJob.sourceUrl}
                    sourcePlatform={selectedJob.sourceType}
                    summaryText={selectedJob.summary}
                    parseStatus={selectedJob.parseStatus}
                    trustState={selectedJob.reviewState}
                    linkedDocumentCount={selectedJob.linkedProposalCount}
                    linkedProposals={selectedJob.linkedProposals}
                    reviewItems={selectedJob.reviewItems}
                    onSaveField={handleSaveField}
                    onApproveReviewItem={handleApproveReviewItem}
                    onSaveReviewItem={handleSaveReviewItem}
                  />
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
