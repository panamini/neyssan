import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { JobsPage } from "../JobsPage";
import {
  PROPOSAL_EXTENSION_INSTALL_LINK,
  getProposalExtensionSourceLinks,
} from "../../lib/proposal-source-platforms";
import { generateCvTemplateV1 } from "../../lib/cv-template";

const approveReviewItemMock = vi.fn().mockResolvedValue(null);
const archiveJobMock = vi.fn().mockResolvedValue(null);
const deleteArchivedJobMock = vi.fn().mockResolvedValue(null);
const duplicateJobMock = vi.fn().mockResolvedValue({ jobId: "job_duplicate" });
const markOpenedMock = vi.fn().mockResolvedValue(null);
const recordStructuredMatchReviewMock = vi.fn().mockResolvedValue({
  reviewId: "structured_review_1",
});
const refreshStructuredMatchMock = vi.fn().mockResolvedValue({ queued: true });
const recordFirstRunPathMock = vi.fn().mockResolvedValue(null);
const restoreArchivedJobMock = vi.fn().mockResolvedValue(null);
const seedSampleJobMock = vi.fn().mockResolvedValue({ jobId: "job_sample" });
const setJobFavoriteMock = vi.fn().mockResolvedValue(null);
const setJobResumeMock = vi.fn().mockResolvedValue(null);
const prepareCvTailoringReviewMock = vi.fn();
const submitCvTailoringReviewMock = vi.fn();
const materializeCvTailoringReviewMock = vi.fn();
const hydrateCvDocumentMock = vi.fn();
const trackEventMock = vi.fn().mockResolvedValue(null);
const updateFieldMock = vi.fn().mockResolvedValue(null);
const debugInspectMatchInputMock = vi.fn();
const convexClientMock = {
  query: debugInspectMatchInputMock,
};
const windowOpenMock = vi.fn();
const showToastMock = vi.fn();
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let rerenderJobsDetail: (() => void) | null = null;

async function findJobsListElement(): Promise<HTMLElement> {
  const jobsPane = await screen.findByLabelText("Jobs list");
  return within(jobsPane).getByRole("list");
}

const jobsList = [
  {
    id: "job_alpha",
    title: "Operations Associate",
    company: "Acme",
    location: "Paris",
    isSample: false,
    isFavorite: false,
    sourceUrl: "https://www.linkedin.com/jobs/view/alpha",
    sourceDomain: "linkedin.com",
    sourceType: "linkedin",
    parseStatus: "parsed",
    reviewState: "needs_review",
    matchTier: "partial",
    status: "active",
    importedAt: 1711000000000,
    updatedAt: 1711001000000,
    lastOpenedAt: 1711002000000,
    lastActivityAt: 1711002000000,
    linkedDocumentCount: 2,
  },
  {
    id: "job_beta",
    title: "Support Specialist",
    company: "Northwind",
    location: "",
    isSample: false,
    isFavorite: true,
    sourceUrl: "https://www.indeed.com/viewjob?jk=beta",
    sourceDomain: "indeed.com",
    sourceType: "indeed",
    parseStatus: "parsed",
    reviewState: "ready",
    matchTier: "weak",
    status: "active",
    importedAt: 1710000000000,
    updatedAt: 1710001000000,
    lastOpenedAt: 1710002000000,
    lastActivityAt: 1710002000000,
    linkedDocumentCount: 0,
  },
];

const archivedJobsList = [
  {
    ...jobsList[0],
    status: "active",
    updatedAt: 1711004000000,
    lastActivityAt: 1711004000000,
  },
];

type JobsPageMatchReview = {
  verdict:
    | "strong_lead"
    | "possible_lead"
    | "probably_skip"
    | "not_enough_signal";
  score: number;
  confidence: number;
  one_liner: string;
  why_this_may_interest_you: string[];
  watch_out: string[];
  suggested_next_step:
    | "apply"
    | "apply_if_requirement_true"
    | "improve_profile_first"
    | "skip"
    | "review_manually";
  missing_or_unclear_requirements: Array<{
    requirement: string;
    severity: "minor" | "important" | "blocking" | "unclear";
    reason: string;
  }>;
  evidence: Array<{
    job_signal: string;
    profile_signal: string;
    explanation: string;
  }>;
};

function buildMatchReview(
  overrides: Partial<JobsPageMatchReview> = {},
): JobsPageMatchReview {
  return {
    verdict: "possible_lead",
    score: 68,
    confidence: 0.65,
    one_liner: "Partial match. A few checks left.",
    why_this_may_interest_you: ["Operations overlaps."],
    watch_out: [],
    suggested_next_step: "apply",
    missing_or_unclear_requirements: [],
    evidence: [
      {
        job_signal: "Operations",
        profile_signal: "recurring operations ownership",
        explanation: "The role needs recurring operations work.",
      },
    ],
    ...overrides,
  };
}

const selectedJob = {
  id: "job_alpha",
  title: "Operations Associate",
  company: "Acme",
  location: "Paris",
  isSample: false,
  isFavorite: false,
  sourceUrl: "https://www.linkedin.com/jobs/view/alpha",
  sourceDomain: "linkedin.com",
  sourceType: "linkedin",
  applicationUrl: "https://www.linkedin.com/jobs/view/alpha/apply",
  parseStatus: "parsed",
  reviewState: "needs_review",
  summary: "Support recurring operations and unblock coordination work.",
  summaryExtraction: {
    value: "Support recurring operations and unblock coordination work.",
    confidence: 0.82,
    sourceSpan: null,
  },
  rawDescription: "Coordinate internal workflows and keep teams aligned.",
  responsibilities: ["Run recurring workflows", "Coordinate team updates"],
  keywords: ["operations", "coordination"],
  mustHaves: ["Cross-functional communication"],
  toneCues: ["clear", "dependable"],
  contacts: ["Hiring Manager"],
  status: "active",
  resumeId: undefined,
  resumeName: undefined,
  resumeSource: undefined,
  matchRead: {
    tier: "partial",
    score: 50,
    scoreVisible: true,
    confidence: "medium",
    matched: ["operations"],
    missing: ["Cross-functional communication"],
    basedOn: {
      profileId: "profile_alpha",
      profileLabel: "Your profile",
      jobId: "job_alpha",
    },
    computedAt: 1711003000000,
    method: "llm",
    fallback: "none",
  },
  matchReview: null as JobsPageMatchReview | null,
  nextStepBlock: {
    headline: "Common next steps",
    usesCohortData: false,
    actions: ["cover_letter", "resume", "save_for_later"],
  },
  linkedProposalCount: 2,
  linkedProposals: [
    {
      id: "proposal_1",
      title: "Operations Associate cover letter",
      status: "saved",
      updatedAt: 1711003000000,
    },
  ],
  reviewItems: [
    {
      id: "review_1",
      fieldKey: "responsibilities",
      label: "Responsibilities",
      reviewStatus: "pending",
      suggestedValue: ["Run recurring workflows", "Coordinate team updates"],
      approvedValue: undefined,
      sourceText: "Coordinate internal workflows and keep teams aligned.",
      confidence: 0.52,
      updatedAt: 1711003000000,
    },
  ],
};

let listResult: typeof jobsList | undefined = jobsList;
let archivedListResult: typeof archivedJobsList | undefined = [];
let selectedJobResult: typeof selectedJob | null | undefined = selectedJob;
let selectedJobResultByRefreshKey: Record<
  number,
  typeof selectedJob | null | undefined
> = {};
let jobDetailQueryResultById: Record<string, typeof selectedJob | null> = {};
let debugPayload: Record<string, unknown> | null = null;
let listError: Error | null = null;
let selectedJobError: Error | null = null;
let cvLibraryResult = {
  cvs: [{ id: "cv_alpha", title: "Primary resume", sections: [] }],
  currentCv: null,
};
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useConvex: () => convexClientMock,
  useQuery: (
    reference: string,
    args?: { jobId?: string; clientRefreshKey?: number } | "skip",
  ) => {
    if (reference === "jobsPublic.listForUser") {
      if (listError) {
        throw listError;
      }
      return listResult;
    }
    if (reference === "jobsPublic.listArchivedForUser") {
      return archivedListResult;
    }
    if (reference === "jobsPublic.getById") {
      if (args === "skip" || !args?.jobId) {
        return undefined;
      }
      if (selectedJobError) {
        throw selectedJobError;
      }
      if (
        args.clientRefreshKey !== undefined &&
        args.clientRefreshKey in selectedJobResultByRefreshKey
      ) {
        return selectedJobResultByRefreshKey[args.clientRefreshKey];
      }
      return selectedJobResult;
    }
    return undefined;
  },
  useMutation: (reference: string) => {
    if (reference === "jobsPublic.approveReviewItem") {
      return approveReviewItemMock;
    }
    if (reference === "jobsPublic.archiveJob") {
      return archiveJobMock;
    }
    if (reference === "jobsPublic.deleteArchivedJob") {
      return deleteArchivedJobMock;
    }
    if (reference === "jobsPublic.duplicateJob") {
      return duplicateJobMock;
    }
    if (reference === "jobsPublic.recordFirstRunPath") {
      return recordFirstRunPathMock;
    }
    if (reference === "jobsPublic.restoreArchivedJob") {
      return restoreArchivedJobMock;
    }
    if (reference === "jobsPublic.seedSampleJob") {
      return seedSampleJobMock;
    }
    if (reference === "jobsPublic.trackEvent") {
      return trackEventMock;
    }
    if (reference === "jobsPublic.markOpened") {
      return markOpenedMock;
    }
    if (reference === "jobsPublic.recordStructuredMatchReview") {
      return recordStructuredMatchReviewMock;
    }
    if (reference === "jobsPublic.refreshStructuredMatch") {
      return refreshStructuredMatchMock;
    }
    if (reference === "jobsPublic.setResumeForJob") {
      return setJobResumeMock;
    }
    if (reference === "jobsPublic.setJobFavorite") {
      return setJobFavoriteMock;
    }
    if (reference === "jobsPublic.prepareCvTailoringReview") {
      return prepareCvTailoringReviewMock;
    }
    if (reference === "jobsPublic.submitCvTailoringReview") {
      return submitCvTailoringReviewMock;
    }
    if (reference === "jobsPublic.materializeCvTailoringReview") {
      return materializeCvTailoringReviewMock;
    }
    if (reference === "jobsPublic.updateField") {
      return updateFieldMock;
    }
    return vi.fn();
  },
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    profilesPublic: {
      getByProfileId: "profilesPublic.getByProfileId",
    },
    jobsPublic: {
      listForUser: "jobsPublic.listForUser",
      getById: "jobsPublic.getById",
      approveReviewItem: "jobsPublic.approveReviewItem",
      archiveJob: "jobsPublic.archiveJob",
      deleteArchivedJob: "jobsPublic.deleteArchivedJob",
      duplicateJob: "jobsPublic.duplicateJob",
      recordFirstRunPath: "jobsPublic.recordFirstRunPath",
      restoreArchivedJob: "jobsPublic.restoreArchivedJob",
      seedSampleJob: "jobsPublic.seedSampleJob",
      listArchivedForUser: "jobsPublic.listArchivedForUser",
      trackEvent: "jobsPublic.trackEvent",
      markOpened: "jobsPublic.markOpened",
      recordStructuredMatchReview: "jobsPublic.recordStructuredMatchReview",
      refreshStructuredMatch: "jobsPublic.refreshStructuredMatch",
      setResumeForJob: "jobsPublic.setResumeForJob",
      setJobFavorite: "jobsPublic.setJobFavorite",
      prepareCvTailoringReview: "jobsPublic.prepareCvTailoringReview",
      submitCvTailoringReview: "jobsPublic.submitCvTailoringReview",
      materializeCvTailoringReview: "jobsPublic.materializeCvTailoringReview",
      updateField: "jobsPublic.updateField",
    },
  },
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    ...cvLibraryResult,
    hydrateCvDocument: hydrateCvDocumentMock,
  }),
}));

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div
      data-testid="jobs-location"
      data-state={JSON.stringify(location.state ?? null)}
    >
      {`${location.pathname}${location.search}`}
    </div>
  );
}

function JobsLifecycleRouteControls(): JSX.Element {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/jobs?view=list")}>
        Test route away
      </button>
      <button type="button" onClick={() => navigate("/jobs/job_alpha")}>
        Test route back
      </button>
    </>
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const pendingCvTailoringReview = {
  mode: "auto_recommended" as const,
  sourceCv: {
    id: "cv_alpha",
    contextHash: "source-cv-context-alpha",
  },
  plan: {
    id: "resume-variant-plan:pending",
    blocked: false,
    requiredDemandIds: ["job-demand:operations"],
    items: [
      {
        id: "resume-variant-plan-item:experience",
        section: "experience" as const,
        action: "include" as const,
        priority: "required" as const,
        reviewState: "pending" as const,
        displayLabel: "Operations Lead · Example Co",
        demandIds: ["job-demand:operations"],
        sourceCvItemReferenceIds: ["candidate-cv-item:v1:experience"],
        reason: "Matches the required operations demand.",
      },
      {
        id: "resume-variant-plan-item:skill",
        section: "skills" as const,
        action: "include" as const,
        priority: "optional" as const,
        reviewState: "pending" as const,
        displayLabel: "Process mapping",
        demandIds: [],
        sourceCvItemReferenceIds: ["candidate-cv-item:v1:skill"],
        reason: "Available in the attached resume.",
      },
    ],
    warnings: [],
  },
};

const reviewedCvTailoringReview = {
  ...pendingCvTailoringReview,
  plan: {
    ...pendingCvTailoringReview.plan,
    id: "resume-variant-plan:reviewed",
    items: [
      {
        ...pendingCvTailoringReview.plan.items[0],
        reviewState: "accepted" as const,
      },
      {
        ...pendingCvTailoringReview.plan.items[1],
        reviewState: "rejected" as const,
      },
    ],
  },
};

function readyJobWithAttachedResume() {
  return {
    ...selectedJob,
    reviewState: "ready",
    visibleSummary: selectedJob.summary,
    visibleRequirements: selectedJob.mustHaves,
    visibleKeywords: selectedJob.keywords,
    visibleExtractionSource: "llm",
    resumeId: "cv_alpha",
    resumeName: "Primary resume",
    resumeSource: "job" as const,
    reviewItems: [],
  };
}

function reviewedVariantCv({
  jobId = "job_alpha",
  summaryOnly = false,
}: {
  jobId?: string;
  summaryOnly?: boolean;
} = {}) {
  return {
    id: "source-cv-variant:v1:reviewed",
    title: "Primary resume",
    metadata: {
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
      version: 1,
      ...(summaryOnly ? { librarySummaryOnly: true } : {}),
      reviewedSourceCvVariant: {
        kind: "reviewed_source_cv_variant",
        sourceCvId: "cv_alpha",
        jobId,
        applicationContextId: `application-context:${jobId}`,
        applicationContextHash: `application-context-hash:${jobId}`,
        reviewedPlanId: "resume-variant-plan:reviewed",
        version: 1,
      },
    },
    sections: [],
  };
}

function renderJobsDetail(
  initialEntry = "/jobs/job_alpha",
): ReturnType<typeof render> {
  const buildElement = () => (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/jobs/:jobId"
          element={
            <>
              <JobsPage />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/jobs"
          element={
            <>
              <JobsPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/proposal" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
  const result = render(buildElement());
  rerenderJobsDetail = () => result.rerender(buildElement());
  return result;
}

function enableJobsMatchDebug(): void {
  (
    window as Window & {
      __JOBS_MATCH_READ_DEBUG__?: boolean;
    }
  ).__JOBS_MATCH_READ_DEBUG__ = true;
}

function buildStructuredShadowSummary(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    flagEnabled: true,
    internalViewer: true,
    uiEnabled: true,
    advisoryBetaEnabled: false,
    advisoryBetaViewer: false,
    status: "available",
    reason: null,
    oldScore: 50,
    oldTier: "partial",
    structuredScore: 78,
    structuredTier: "strong",
    matchedCount: 3,
    partialCount: 1,
    missingCount: 0,
    unknownCount: 2,
    hardGateMissingCount: 0,
    metadataLeakCount: 0,
    languagePreserved: true,
    provenanceComplete: true,
    jobRequirementCount: 6,
    jobConstraintCount: 1,
    profileEvidenceCount: 12,
    profileConstraintCount: 0,
    ...overrides,
  };
}

describe("JobsPage", () => {
  beforeEach(() => {
    rerenderJobsDetail = null;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    approveReviewItemMock.mockClear();
    archiveJobMock.mockClear();
    deleteArchivedJobMock.mockClear();
    duplicateJobMock.mockClear();
    markOpenedMock.mockClear();
    recordStructuredMatchReviewMock.mockClear();
    refreshStructuredMatchMock.mockClear();
    recordFirstRunPathMock.mockClear();
    restoreArchivedJobMock.mockClear();
    seedSampleJobMock.mockReset();
    seedSampleJobMock.mockResolvedValue({ jobId: "job_sample" });
    setJobFavoriteMock.mockClear();
    setJobResumeMock.mockClear();
    prepareCvTailoringReviewMock.mockReset();
    submitCvTailoringReviewMock.mockReset();
    materializeCvTailoringReviewMock.mockReset();
    hydrateCvDocumentMock.mockReset();
    hydrateCvDocumentMock.mockImplementation(async (id: string) =>
      id.startsWith("source-cv-variant:v1:")
        ? { ...reviewedVariantCv(), id }
        : {
            id,
            title: "Hydrated resume",
            sections: [],
          },
    );
    showToastMock.mockClear();
    trackEventMock.mockClear();
    updateFieldMock.mockClear();
    windowOpenMock.mockReset();
    vi.stubGlobal("open", windowOpenMock);
    delete (
      window as Window & {
        __JOBS_MATCH_READ_DEBUG__?: boolean;
        __STRUCTURED_MATCH_READ_DEBUG__?: boolean;
      }
    ).__JOBS_MATCH_READ_DEBUG__;
    delete (
      window as Window & {
        __JOBS_MATCH_READ_DEBUG__?: boolean;
        __STRUCTURED_MATCH_READ_DEBUG__?: boolean;
      }
    ).__STRUCTURED_MATCH_READ_DEBUG__;
    listResult = jobsList;
    archivedListResult = [];
    selectedJobResult = {
      ...selectedJob,
      resumeId: undefined,
      resumeName: undefined,
      resumeSource: undefined,
      isFavorite: false,
    };
    selectedJobResultByRefreshKey = {};
    jobDetailQueryResultById = {};
    debugPayload = {
      jobId: "job_alpha",
      lastResumeId: null,
      resolvedProfileId: "profile_alpha",
      profileSkills: ["operations"],
      profileKeywords: ["operations"],
      summary: "Operations profile",
      experience: [],
      raw_text: "operations",
      derivedKeywords: ["operations"],
      matchReadFallback: "none",
      score: 50,
      matchedSignals: ["operations"],
      missingSignals: ["Cross-functional communication"],
    };
    debugInspectMatchInputMock.mockReset();
    debugInspectMatchInputMock.mockImplementation(
      async (reference: string, args?: { jobId?: string }) => {
        if (reference === "jobsPublic.getById" && args?.jobId) {
          return (
            jobDetailQueryResultById[args.jobId] ??
            (args.jobId === "job_alpha" ? selectedJobResult : null)
          );
        }
        return debugPayload;
      },
    );
    cvLibraryResult = {
      cvs: [{ id: "cv_alpha", title: "Primary resume", sections: [] }],
      currentCv: null,
    };
    listError = null;
    selectedJobError = null;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders the list-detail inbox and updates trust immediately on approve", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route
            path="/jobs/:jobId"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/proposal" element={<LocationProbe />} />
          <Route path="/cv" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("region", { name: "Jobs list" }),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText("Operations Associate")).length,
    ).toBeGreaterThan(0);
    expect((await screen.findAllByText("Acme")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Paris")).length).toBeGreaterThan(0);
    const matchVerdict = await screen.findByLabelText(
      "Current match: Worth a shot",
    );
    expect(matchVerdict).toBeInTheDocument();
    expect(
      matchVerdict.closest(".dasti-job-match-panel__verdict-badge"),
    ).toHaveClass("ds-verdict");
    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "See full breakdown" }));
    expect(
      (await screen.findAllByText("Cross-functional communication")).length,
    ).toBeGreaterThan(0);
    expect(
      await screen.findByText(
        "Support recurring operations and unblock coordination work.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Responsibilities")).toBeInTheDocument();
    expect(
      screen.getAllByLabelText("Needs your review").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: "Confirm Responsibilities" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("EXTRACTION. PAUSED.")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("link", {
        name: /Open linked proposal Operations Associate cover letter/i,
      }),
    ).toHaveAttribute("href", "/proposal?view=saved&id=proposal_1");
    expect(
      document.querySelector(".dasti-jobs-detail__status-line"),
    ).toHaveTextContent(/Review needed\s*·\s*2 linked documents/);
    expect(
      (await screen.findAllByText("Review needed")).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Check fields")).not.toBeInTheDocument();
    expect(screen.queryByText("Review state")).not.toBeInTheDocument();
    const jobActions = screen.getByLabelText("Job actions");
    const generateProposalAction = within(jobActions).getByRole("button", {
      name: "Generate proposal",
    });
    expect(generateProposalAction).toBeInTheDocument();
    expect(generateProposalAction).toHaveClass(
      "dasti-jobs-detail__header-action",
      "dasti-jobs-detail__header-action--proposal",
    );
    expect(generateProposalAction).not.toHaveClass("ds-btn");
    expect(generateProposalAction.querySelector("svg")).toBeNull();
    expect(generateProposalAction.querySelector(".ds-btn__period")).toBeNull();
    expect(
      within(jobActions).getByRole("button", { name: "Skip and archive job" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Common next steps")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Next step" })).toBeNull();
    expect(
      within(jobActions).getAllByRole("button", { name: "Attach resume" })
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Add to favorites" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark favorite" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Do both" }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith({
        event: "job_opened",
        jobId: "job_alpha",
        hasMatchRead: true,
        reviewState: "needs_review",
      });
    });
    const linkedDocuments = screen.getByText("Linked documents");
    const importedPosting = screen.getByText("Imported Posting");
    expect(
      linkedDocuments.compareDocumentPosition(importedPosting) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(markOpenedMock).toHaveBeenCalledWith({ jobId: "job_alpha" });
  });

  it("renders visible extraction fields on the selected detail without changing score UI", async () => {
    selectedJobResult = {
      ...selectedJob,
      visibleSummary: "LLM visible summary for the selected job.",
      visibleRequirements: ["LLM visible requirement"],
      visibleKeywords: ["llm keyword"],
      visibleExtractionSource: "llm",
      reviewItems: [
        {
          id: "summary",
          fieldKey: "summary",
          label: "Summary",
          reviewStatus: "pending",
          suggestedValue: "LLM visible summary for the selected job.",
          approvedValue: undefined,
          sourceText: "LLM visible summary for the selected job.",
          confidence: 0.9,
          updatedAt: 1711003000000,
        },
        {
          id: "must_haves",
          fieldKey: "mustHaves",
          label: "Requirements",
          reviewStatus: "pending",
          suggestedValue: ["LLM visible requirement"],
          approvedValue: undefined,
          sourceText: "LLM visible requirement",
          confidence: 0.9,
          updatedAt: 1711003000000,
        },
        {
          id: "keywords",
          fieldKey: "keywords",
          label: "Keywords",
          reviewStatus: "pending",
          suggestedValue: ["llm keyword"],
          approvedValue: undefined,
          sourceText: "llm keyword",
          confidence: 0.9,
          updatedAt: 1711003000000,
        },
      ],
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("LLM visible summary for the selected job."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Extracted summary")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("LLM visible requirement").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("llm keyword").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Check")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Keep" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByLabelText("Needs your review").length,
    ).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("Summary").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Requirements").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("Keywords").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: "Edit Summary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Requirements" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Keywords" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Responsibilities")).not.toBeInTheDocument();
    expect(screen.queryByText("EXTRACTION. PAUSED.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Run recurring workflows"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    expect(screen.queryByText("Verdict")).not.toBeInTheDocument();
    expect(screen.queryByText("AI extracted")).not.toBeInTheDocument();
    expect(
      screen.queryByText("visibleExtractionSource"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Extraction dashboard")).not.toBeInTheDocument();
  });

  it("keeps heuristic extraction visible and reviewable while preserving the posting", async () => {
    selectedJobResult = {
      ...selectedJob,
      summary: "Heuristic summary remains reviewable.",
      visibleSummary: "Heuristic visible summary remains reviewable.",
      mustHaves: ["Heuristic requirement remains reviewable"],
      visibleRequirements: ["Heuristic visible requirement remains reviewable"],
      keywords: ["location", "status", "compensation"],
      visibleKeywords: ["location", "status", "compensation"],
      visibleExtractionSource: "heuristic",
      rawDescription: "Raw source remains visible for this job.",
      reviewItems: [
        {
          id: "review_heuristic_keywords",
          fieldKey: "keywords",
          label: "Keywords",
          reviewStatus: "pending",
          suggestedValue: ["location", "status", "compensation"],
          approvedValue: undefined,
          sourceText: "location status compensation",
          confidence: 0.42,
          updatedAt: 1711003000000,
        },
        {
          id: "review_heuristic_responsibilities",
          fieldKey: "responsibilities",
          label: "Responsibilities",
          reviewStatus: "pending",
          suggestedValue: [
            "At Texas Roadhouse, we are a people-first company.",
          ],
          approvedValue: undefined,
          sourceText: "At Texas Roadhouse, we are a people-first company.",
          confidence: 0.52,
          updatedAt: 1711003000000,
        },
      ],
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Heuristic visible summary remains reviewable."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Heuristic visible requirement remains reviewable"),
    ).toBeInTheDocument();
    expect(screen.getByText("location")).toBeInTheDocument();
    expect(screen.getByText("status")).toBeInTheDocument();
    expect(screen.getByText("compensation")).toBeInTheDocument();
    expect(screen.getByText("Responsibilities")).toBeInTheDocument();
    expect(
      screen.getByText("At Texas Roadhouse, we are a people-first company."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText("Needs your review").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByRole("button", { name: /^Confirm / }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("EXTRACTION. PAUSED.")).not.toBeInTheDocument();
    expect(screen.getByText("Imported Posting")).toBeInTheDocument();
    expect(
      screen.queryByText("Raw source remains visible for this job."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Posting" }));
    expect(
      screen.getByText("Raw source remains visible for this job."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Job read is out of order/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    expect(screen.queryByText("Verdict")).not.toBeInTheDocument();
  });

  it("does not show the structured shadow comparison for normal detail data", async () => {
    debugPayload = {
      ...debugPayload,
      structuredShadowSummary: buildStructuredShadowSummary(),
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Structured shadow comparison")).toBeNull();
    expect(screen.queryByTestId("jobs-match-input-debug-panel")).toBeNull();
    expect(debugInspectMatchInputMock).not.toHaveBeenCalled();
  });

  it("hides the internal structured panel when the shadow flag is off", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary({
        flagEnabled: false,
        status: "unavailable",
        reason: "shadow_disabled",
      }),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("jobs-structured-shadow-internal-panel"),
    ).toBeNull();
    expect(screen.queryByText("Structured shadow")).toBeNull();
  });

  it("hides the internal structured panel for a non-allowlisted user", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary({
        internalViewer: false,
        status: "unavailable",
        reason: "internal_viewer_required",
      }),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("jobs-structured-shadow-internal-panel"),
    ).toBeNull();
    expect(screen.queryByText("Structured shadow")).toBeNull();
  });

  it("shows allowlisted reviewers the current match beside structured shadow without forbidden copy", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary(),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const panel = await screen.findByTestId(
      "jobs-structured-shadow-internal-panel",
    );
    expect(within(panel).getByText("Current match")).toBeInTheDocument();
    expect(within(panel).getByText("Structured shadow")).toBeInTheDocument();
    expect(
      within(panel).getByText(
        "Production score remains the current match score.",
      ),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText("Structured shadow is internal review only."),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/score\s+50/)).toBeInTheDocument();
    expect(within(panel).getByText(/tier\s+partial/)).toBeInTheDocument();
    expect(within(panel).getByText(/score\s+78/)).toBeInTheDocument();
    expect(within(panel).getByText(/tier\s+strong/)).toBeInTheDocument();
    expect(within(panel).getByText(/matched\s+3/)).toBeInTheDocument();
    expect(within(panel).getByText(/partial\s+1/)).toBeInTheDocument();
    expect(within(panel).getByText(/unknown\s+2/)).toBeInTheDocument();
    expect(
      within(panel).getByText(/hard-gate missing\s+0/),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/metadata leaks\s+0/)).toBeInTheDocument();
    expect(within(panel).getByText("language preserved")).toBeInTheDocument();
    expect(within(panel).getByText("provenance complete")).toBeInTheDocument();
    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    expect(screen.queryByText(/AI score/i)).toBeNull();
    expect(screen.queryByText(/New score/i)).toBeNull();
    expect(screen.queryByText(/Better score/i)).toBeNull();
    expect(screen.queryByText(/Recommended score/i)).toBeNull();
  });

  it("shows advisory beta users a structured preview without changing product behavior", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary({
        internalViewer: false,
        uiEnabled: false,
        advisoryBetaEnabled: true,
        advisoryBetaViewer: true,
      }),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const panel = await screen.findByTestId(
      "jobs-structured-preview-advisory-panel",
    );
    expect(
      screen.queryByTestId("jobs-structured-shadow-internal-panel"),
    ).toBeNull();
    expect(
      within(panel).getAllByText("Structured preview").length,
    ).toBeGreaterThan(0);
    expect(within(panel).getByText("Current match")).toBeInTheDocument();
    expect(
      within(panel).getByText(
        "Structured score is used when available. Missing extraction stays pending instead of using keyword fallback.",
      ),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/score\s+50/)).toBeInTheDocument();
    expect(within(panel).getByText(/tier\s+partial/)).toBeInTheDocument();
    expect(within(panel).getByText(/score\s+78/)).toBeInTheDocument();
    expect(within(panel).getByText(/tier\s+strong/)).toBeInTheDocument();
    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/AI score/i)).toBeNull();
    expect(screen.queryByText(/New score/i)).toBeNull();
    expect(screen.queryByText(/Better score/i)).toBeNull();
    expect(screen.queryByText(/Recommended score/i)).toBeNull();
  });

  it("hides advisory structured preview when the advisory beta flag is off", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary({
        internalViewer: false,
        uiEnabled: false,
        advisoryBetaEnabled: false,
        advisoryBetaViewer: true,
      }),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("jobs-structured-preview-advisory-panel"),
    ).toBeNull();
    expect(
      screen.queryByText(
        "Structured score is used when available. Missing extraction stays pending instead of using keyword fallback.",
      ),
    ).toBeNull();
  });

  it("hides advisory structured preview for non-beta users", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary({
        internalViewer: false,
        uiEnabled: false,
        advisoryBetaEnabled: true,
        advisoryBetaViewer: false,
      }),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("jobs-structured-preview-advisory-panel"),
    ).toBeNull();
    expect(screen.queryByText("Structured preview")).toBeNull();
  });

  it("keeps structured preview out of match filtering and list badges", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary({
        internalViewer: false,
        uiEnabled: false,
        advisoryBetaEnabled: true,
        advisoryBetaViewer: true,
        structuredTier: "strong",
        structuredScore: 92,
      }),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("jobs-structured-preview-advisory-panel"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Filters" }));
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Strong match" }),
    );

    expect(screen.getByText("0 of 2")).toBeInTheDocument();
    expect(screen.getByText(/No jobs match this search/i)).toBeInTheDocument();
  });

  it("logs an internal review label and extraction verdicts without affecting the production score or tier", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary(),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const panel = await screen.findByTestId(
      "jobs-structured-shadow-internal-panel",
    );
    fireEvent.change(within(panel).getByLabelText("Reviewer label"), {
      target: { value: "false weak" },
    });
    fireEvent.change(within(panel).getByLabelText("Summary verdict"), {
      target: { value: "too_vague" },
    });
    fireEvent.change(within(panel).getByLabelText("Requirements verdict"), {
      target: { value: "incomplete" },
    });
    fireEvent.change(within(panel).getByLabelText("Keywords verdict"), {
      target: { value: "noisy" },
    });
    fireEvent.change(within(panel).getByLabelText("Review notes"), {
      target: { value: "Needs another evidence pass." },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Log review" }));

    await waitFor(() => {
      expect(recordStructuredMatchReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        label: "false weak",
        extractionSummaryVerdict: "too_vague",
        extractionRequirementsVerdict: "incomplete",
        extractionKeywordsVerdict: "noisy",
        notes: "Needs another evidence pass.",
      });
    });
    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    expect(within(panel).getByText(/tier\s+partial/)).toBeInTheDocument();
  });

  it("hides the structured panel when rollback disables the internal UI flag", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary({
        uiEnabled: false,
      }),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("jobs-structured-shadow-internal-panel"),
    ).toBeNull();
  });

  it("hides the advisory structured preview when rollback disables advisory beta", async () => {
    selectedJobResult = {
      ...selectedJob,
      structuredShadowSummary: buildStructuredShadowSummary({
        internalViewer: false,
        uiEnabled: false,
        advisoryBetaEnabled: false,
        advisoryBetaViewer: true,
      }),
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("jobs-structured-preview-advisory-panel"),
    ).toBeNull();
  });

  it("shows debug-only unavailable reasons without structured result values", async () => {
    enableJobsMatchDebug();
    debugPayload = {
      ...debugPayload,
      structuredShadowSummary: {
        flagEnabled: true,
        internalViewer: false,
        status: "unavailable",
        reason: "internal_viewer_required",
        oldScore: 50,
        oldTier: "partial",
        structuredScore: null,
        structuredTier: null,
        matchedCount: 0,
        partialCount: 0,
        missingCount: 0,
        unknownCount: 0,
        metadataLeakCount: 0,
        provenanceComplete: false,
        jobRequirementCount: 0,
        jobConstraintCount: 0,
        profileEvidenceCount: 0,
        profileConstraintCount: 0,
      },
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const debugOutput = (
        screen.getByLabelText("Match input debug output") as HTMLTextAreaElement
      ).value;
      expect(debugOutput).toContain("structuredShadowSummary");
      expect(debugOutput).toContain("internal_viewer_required");
    });
    const block = await screen.findByTestId("jobs-structured-shadow-debug");
    expect(screen.getByText("Internal debug only")).toBeInTheDocument();
    expect(
      screen.getByText("Production score remains current match score"),
    ).toBeInTheDocument();
    expect(
      within(block).getByText("internal_viewer_required"),
    ).toBeInTheDocument();
    expect(within(block).queryByText("Structured shadow")).toBeNull();
  });

  it("shows old-vs-structured comparison only from allowed debug output", async () => {
    enableJobsMatchDebug();
    debugPayload = {
      ...debugPayload,
      structuredShadowSummary: {
        flagEnabled: true,
        internalViewer: true,
        status: "available",
        reason: null,
        oldScore: 50,
        oldTier: "partial",
        structuredScore: 78,
        structuredTier: "strong",
        matchedCount: 3,
        partialCount: 1,
        missingCount: 0,
        unknownCount: 2,
        metadataLeakCount: 0,
        provenanceComplete: true,
        jobRequirementCount: 6,
        jobConstraintCount: 1,
        profileEvidenceCount: 12,
        profileConstraintCount: 0,
      },
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const block = await screen.findByTestId("jobs-structured-shadow-debug");
    expect(within(block).getByText("Old match")).toBeInTheDocument();
    expect(within(block).getByText("Structured shadow")).toBeInTheDocument();
    expect(within(block).getByText(/score\s+50/)).toBeInTheDocument();
    expect(within(block).getByText(/tier\s+partial/)).toBeInTheDocument();
    expect(within(block).getByText(/score\s+78/)).toBeInTheDocument();
    expect(within(block).getByText(/tier\s+strong/)).toBeInTheDocument();
    expect(within(block).getByText(/matched\s+3/)).toBeInTheDocument();
    expect(within(block).getByText(/partial\s+1/)).toBeInTheDocument();
    expect(within(block).getByText(/missing\s+0/)).toBeInTheDocument();
    expect(within(block).getByText(/unknown\s+2/)).toBeInTheDocument();
    expect(within(block).getByText(/metadata leaks\s+0/)).toBeInTheDocument();
    expect(within(block).getByText("provenance complete")).toBeInTheDocument();
    expect(within(block).getByText("operations")).toBeInTheDocument();
    expect(
      within(block).getByText("Cross-functional communication"),
    ).toBeInTheDocument();
    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    expect(screen.queryByText(/AI score/i)).toBeNull();
    expect(screen.queryByText(/new score/i)).toBeNull();
  });

  it("cleans the displayed missing requirements without changing score or tier", async () => {
    selectedJobResult = {
      ...selectedJob,
      visibleRequirements: ["Customer-facing experience"],
      matchRead: {
        ...selectedJob.matchRead,
        tier: "partial",
        score: 50,
        missing: [
          "Paris",
          "Compensation",
          "Acme",
          "Equal opportunity employer",
          "Customer-facing experience",
        ],
      },
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const matchRegion = screen.getByLabelText("Match");
    const breakdownButton = within(matchRegion).getByRole("button", {
      name: "See full breakdown",
    });
    expect(breakdownButton).toHaveClass("ds-btn", "ds-btn--sm");
    expect(breakdownButton).not.toHaveClass("ds-btn--accent");
    fireEvent.click(breakdownButton);
    expect(
      within(matchRegion).getByText("Customer-facing experience"),
    ).toBeInTheDocument();
    expect(within(matchRegion).getByText(/Paris · match/)).toBeInTheDocument();
    expect(within(matchRegion).queryByText("Compensation")).toBeNull();
    expect(within(matchRegion).queryByText("Acme")).toBeNull();
    expect(
      within(matchRegion).queryByText("Equal opportunity employer"),
    ).toBeNull();
    expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    expect(screen.queryByText("Verdict")).not.toBeInTheDocument();
    expect(screen.queryByText("AI extracted")).not.toBeInTheDocument();
  });

  it("renders the matchReview one-liner as the primary detail match explanation", async () => {
    selectedJobResult = {
      ...selectedJob,
      matchReview: buildMatchReview({
        verdict: "possible_lead",
        score: 68,
        one_liner: "Partial match. A few checks left.",
        why_this_may_interest_you: [
          "Operations overlaps.",
          "Coordination overlaps.",
          "Airtable overlaps.",
          "This fourth reason should stay hidden.",
        ],
        suggested_next_step: "apply",
      }),
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const matchRegion = await screen.findByLabelText("Match");
    expect(
      within(matchRegion).getByText("Partial match. A few checks left."),
    ).toBeInTheDocument();
    expect(within(matchRegion).getByText("Skills")).toBeInTheDocument();
    expect(
      within(matchRegion).getByText("Operations overlaps."),
    ).toBeInTheDocument();
    expect(
      within(matchRegion).queryByText("Coordination overlaps."),
    ).toBeNull();
    expect(within(matchRegion).queryByText("Airtable overlaps.")).toBeNull();
    expect(
      within(matchRegion).queryByText("This fourth reason should stay hidden."),
    ).toBeNull();
    expect(within(matchRegion).queryByText("Partial · 68%")).toBeNull();
    expect(
      within(matchRegion).queryByText("Worth a shot — review."),
    ).toBeNull();
  });

  it("uses matchReview as the shared visible verdict authority for list card and detail", async () => {
    const conflictingReview = buildMatchReview({
      verdict: "possible_lead",
      score: 68,
      one_liner: "Partial match. A few checks left.",
      suggested_next_step: "apply",
    });
    listResult = [
      {
        ...jobsList[0],
        matchTier: "weak",
        matchRead: {
          tier: "weak",
        },
        matchReview: conflictingReview,
      },
    ] as any;
    selectedJobResult = {
      ...selectedJob,
      matchRead: {
        ...selectedJob.matchRead,
        tier: "weak",
      },
      matchReview: conflictingReview,
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    const selectedRow = within(jobsListElement)
      .getByText("Operations Associate")
      .closest("article");
    expect(
      within(selectedRow as HTMLElement).getByText("Worth a shot"),
    ).toBeInTheDocument();
    expect(
      within(selectedRow as HTMLElement).queryByText("Probably skip"),
    ).toBeNull();

    const matchRegion = await screen.findByLabelText("Match");
    expect(
      within(matchRegion).getByText("Partial match. A few checks left."),
    ).toBeInTheDocument();
    expect(within(matchRegion).queryByText(/Probably skip/)).toBeNull();
  });

  it("renders matchReview watch-out copy for an unclear credential", async () => {
    selectedJobResult = {
      ...selectedJob,
      matchReview: buildMatchReview({
        verdict: "possible_lead",
        score: 62,
        watch_out: [
          "Guard card/license unclear.",
          "Weekend availability is a check.",
          "This third watch-out should stay hidden.",
        ],
        suggested_next_step: "apply_if_requirement_true",
        missing_or_unclear_requirements: [
          {
            requirement: "Guard card/license preferred",
            severity: "unclear",
            reason: "The profile does not show it explicitly.",
          },
        ],
      }),
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const matchRegion = await screen.findByLabelText("Match");
    expect(
      within(matchRegion).getByText(/Guard card\/license unclear/),
    ).toBeInTheDocument();
    expect(within(matchRegion).getByText("Skills")).toBeInTheDocument();
    expect(
      within(matchRegion).getByText(/Guard card\/license unclear/),
    ).toBeInTheDocument();
    expect(
      within(matchRegion).queryByText("Weekend availability is a check."),
    ).toBeNull();
    expect(
      within(matchRegion).queryByText(
        "This third watch-out should stay hidden.",
      ),
    ).toBeNull();
  });

  it("falls back to the existing matchRead block when matchReview is null", async () => {
    selectedJobResult = {
      ...selectedJob,
      matchReview: null,
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const matchRegion = await screen.findByLabelText("Match");
    expect(
      within(matchRegion).getByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(within(matchRegion).getByText("Skills")).toBeInTheDocument();
    expect(
      within(matchRegion).queryByText("Partial match. A few checks left."),
    ).toBeNull();
  });

  it("falls back to the existing matchRead block when matchReview has not enough signal", async () => {
    selectedJobResult = {
      ...selectedJob,
      matchReview: buildMatchReview({
        verdict: "not_enough_signal",
        score: 0,
        one_liner:
          "Not enough signal: the job or profile data is not ready for a useful review.",
        watch_out: ["Structured review unavailable: extraction pending."],
        suggested_next_step: "review_manually",
      }),
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const matchRegion = await screen.findByLabelText("Match");
    expect(
      within(matchRegion).getByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(within(matchRegion).getByText("Skills")).toBeInTheDocument();
    expect(
      within(matchRegion).queryByText("Not enough signal · 0%"),
    ).toBeNull();
    expect(
      within(matchRegion).queryByText(
        "Structured review unavailable: extraction pending.",
      ),
    ).toBeNull();
  });

  it("opens the paperclip picker from the job detail header", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route
            path="/jobs/:jobId"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Attach resume" }))[0],
    );

    expect(
      screen.getByRole("dialog", { name: "Attach resume" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Attach Primary resume" }),
    ).toBeInTheDocument();
  });

  it("strips parser punctuation from the selected job title", async () => {
    selectedJobResult = {
      ...selectedJob,
      title: "Junior Web Developer:",
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findAllByText("Junior Web Developer")).not.toHaveLength(
      0,
    );
    expect(screen.queryByText("Junior Web Developer:")).not.toBeInTheDocument();
  });

  it("opens the source URL from the job detail header and keeps the brief card title out of the embedded panel", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "View on LinkedIn" }),
    ).not.toBeInTheDocument();
    const sourceButton = await screen.findByRole("button", {
      name: "Open original job offer on LinkedIn",
    });
    fireEvent.click(sourceButton);

    expect(windowOpenMock).toHaveBeenCalledWith(
      "https://www.linkedin.com/jobs/view/alpha",
      "_blank",
      "noopener",
    );
    expect(
      screen.queryByRole("heading", { name: "Operations Associate" }),
    ).not.toBeInTheDocument();
  });

  it("navigates to the canonical Proposal Forge job route from the job page", async () => {
    selectedJobResult = {
      ...selectedJob,
      resumeId: "cv_alpha",
      resumeName: "Operations Associate — Alex Martin",
      resumeSource: "job",
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route
            path="/jobs/:jobId"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/proposal" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Generate proposal" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      event: "job_decision_made",
      jobId: "job_alpha",
      outcome: "cover_letter",
      timeToDecisionMs: expect.any(Number),
      tier: "partial",
    });
  });

  it("cancels an in-flight proposal handoff as soon as another resume attachment begins", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        { id: "cv_beta", title: "Secondary resume", sections: [] },
      ],
      currentCv: null,
    };
    const hydration = createDeferred<{
      id: string;
      title: string;
      sections: never[];
    }>();
    const attachment = createDeferred<null>();
    hydrateCvDocumentMock.mockReturnValueOnce(hydration.promise);
    setJobResumeMock.mockReturnValueOnce(attachment.promise);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate proposal" }),
    );
    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith("cv_alpha");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Attached resume: Primary resume" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach Secondary resume" }),
    );
    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_beta",
        resumeName: "Secondary resume",
      });
    });

    await act(async () => {
      hydration.resolve({
        id: "cv_alpha",
        title: "Primary resume",
        sections: [],
      });
      await Promise.resolve();
    });
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );

    await act(async () => {
      attachment.resolve(null);
      await Promise.resolve();
    });
  });

  it("cancels an in-flight proposal handoff as soon as a Job Brief mutation begins", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    const hydration = createDeferred<{
      id: string;
      title: string;
      sections: never[];
    }>();
    const briefMutation = createDeferred<null>();
    hydrateCvDocumentMock.mockReturnValueOnce(hydration.promise);
    updateFieldMock.mockReturnValueOnce(briefMutation.promise);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate proposal" }),
    );
    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith("cv_alpha");
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit Summary" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated while proposal readiness is pending" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));
    await waitFor(() => {
      expect(updateFieldMock).toHaveBeenCalled();
    });

    await act(async () => {
      hydration.resolve({
        id: "cv_alpha",
        title: "Primary resume",
        sections: [],
      });
      await Promise.resolve();
    });
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );

    await act(async () => {
      briefMutation.resolve(null);
      await Promise.resolve();
    });
  });

  it("routes a job card directly to Proposal Forge in proposal selection mode", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs?selectFor=proposal"]}>
        <Routes>
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/proposal" element={<LocationProbe />} />
          <Route path="/jobs/:jobId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Choose a job for this proposal."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pick one job to attach it to your draft."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Select job").length).toBeGreaterThan(0);

    const jobsListElement = await findJobsListElement();
    fireEvent.click(within(jobsListElement).getByText("Operations Associate"));

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("loads the target job detail before proposal-selection handoff when the list omits resume selection", async () => {
    jobDetailQueryResultById.job_alpha = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv(),
      ],
      currentCv: null,
    };
    materializeCvTailoringReviewMock.mockResolvedValueOnce({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: true,
    });

    render(
      <MemoryRouter initialEntries={["/jobs?selectFor=proposal"]}>
        <Routes>
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/proposal" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(within(jobsListElement).getByText("Operations Associate"));

    await waitFor(() => {
      expect(debugInspectMatchInputMock).toHaveBeenCalledWith(
        "jobsPublic.getById",
        { jobId: "job_alpha" },
      );
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith(
        "source-cv-variant:v1:reviewed",
      );
      expect(materializeCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        expectedPlanId: "resume-variant-plan:reviewed",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("hydrates a tailored resume before proposal-selection navigation", async () => {
    const hydration = createDeferred<ReturnType<typeof reviewedVariantCv>>();
    listResult = jobsList.map((job) =>
      job.id === "job_alpha"
        ? {
            ...job,
            resumeId: "source-cv-variant:v1:reviewed",
            resumeName: "Primary resume · Operations Associate",
          }
        : job,
    );
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv({ summaryOnly: true }),
      ],
      currentCv: null,
    };
    jobDetailQueryResultById.job_alpha = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    hydrateCvDocumentMock.mockReturnValueOnce(hydration.promise);
    materializeCvTailoringReviewMock.mockResolvedValueOnce({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: true,
    });

    render(
      <MemoryRouter initialEntries={["/jobs?selectFor=proposal"]}>
        <Routes>
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/proposal" element={<LocationProbe />} />
          <Route path="/jobs/:jobId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(within(jobsListElement).getByText("Operations Associate"));

    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith(
        "source-cv-variant:v1:reviewed",
      );
    });
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs?selectFor=proposal",
    );

    hydration.resolve(reviewedVariantCv());
    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("blocks proposal-selection navigation for another job's tailored resume", async () => {
    listResult = jobsList.map((job) =>
      job.id === "job_alpha"
        ? {
            ...job,
            resumeId: "source-cv-variant:v1:reviewed",
            resumeName: "Primary resume · Other job",
          }
        : job,
    );
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv({ jobId: "job_beta" }),
      ],
      currentCv: null,
    };
    jobDetailQueryResultById.job_alpha = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Other job",
    };

    render(
      <MemoryRouter initialEntries={["/jobs?selectFor=proposal"]}>
        <Routes>
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/proposal" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(within(jobsListElement).getByText("Operations Associate"));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.stringMatching(/belongs to another job/i),
        { variant: "error" },
      );
    });
    expect(hydrateCvDocumentMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs?selectFor=proposal",
    );
  });

  it("keeps normal job card clicks opening job detail outside proposal selection mode", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/jobs/:jobId"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(within(jobsListElement).getByText("Operations Associate"));

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/jobs/job_alpha",
      );
    });
  });

  it("attaches a resume only to the selected job from the paperclip picker", async () => {
    enableJobsMatchDebug();
    selectedJobResultByRefreshKey[1] = {
      ...selectedJob,
      resumeId: "cv_alpha",
      resumeName: "Primary resume",
      resumeSource: "job",
      matchRead: {
        ...selectedJob.matchRead,
        tier: "strong",
        score: 100,
        confidence: "high",
        matched: ["Primary resume keyword"],
        missing: [],
        basedOn: {
          ...selectedJob.matchRead.basedOn,
          profileId: "cv_alpha",
        },
      },
    };
    setJobResumeMock.mockImplementation(async () => {
      debugPayload = {
        jobId: "job_alpha",
        lastResumeId: "cv_alpha",
        resolvedProfileId: "cv_alpha",
        matchReadFallback: "none",
        score: 100,
        matchedSignals: ["Primary resume keyword"],
        missingSignals: [],
      };
      return null;
    });

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Attach resume" }))[0],
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach Primary resume" }),
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
      expect(
        screen.getByRole("button", { name: "Attached resume: Primary resume" }),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Current match: Strong match"),
      ).toBeInTheDocument();
      expect(
        (
          screen.getByLabelText(
            "Match input debug output",
          ) as HTMLTextAreaElement
        ).value,
      ).toContain('"lastResumeId": "cv_alpha"');
    });
  });

  it("requires a projected default resume to be attached to the job before tailoring", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeSource: "default",
    };
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);

    renderJobsDetail();

    const tailorButton = await screen.findByRole("button", {
      name: "Tailor resume",
    });
    expect(tailorButton).toBeDisabled();
    expect(
      screen.getByText(/attach this resume to this job before tailoring/i),
    ).toBeInTheDocument();
    expect(prepareCvTailoringReviewMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Attached resume: Primary resume" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach Primary resume" }),
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
      expect(tailorButton).toBeEnabled();
    });

    fireEvent.click(tailorButton);
    await waitFor(() => {
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "auto_recommended",
      });
    });
  });

  it("keeps every Job action inside the available 375px detail width", async () => {
    const initialViewportWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });

    try {
      selectedJobResult = readyJobWithAttachedResume();
      renderJobsDetail();

      expect(
        await screen.findByRole("button", { name: "Back to jobs" }),
      ).toBeInTheDocument();
      const jobActions = screen.getByLabelText("Job actions");
      expect(jobActions.style.inlineSize).toBe("100%");
      expect(jobActions.style.maxInlineSize).toBe("100%");
      expect(jobActions.style.minInlineSize).toBe("0px");
      expect(jobActions.style.boxSizing).toBe("border-box");

      for (const action of within(jobActions).getAllByRole("button")) {
        expect(action.style.maxInlineSize).toBe("100%");
        expect(action.style.boxSizing).toBe("border-box");
      }

      const useCompleteResumeAction = within(jobActions).getByRole("button", {
        name: "Use my complete resume without tailoring",
      });
      expect(useCompleteResumeAction).toHaveTextContent(/^Use complete resume$/);
      expect(useCompleteResumeAction).toHaveAttribute(
        "title",
        "Use my complete resume without tailoring",
      );
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: initialViewportWidth,
      });
    }
  });

  it("detaches the selected job resume from the paperclip picker", async () => {
    selectedJobResult = {
      ...selectedJob,
      resumeId: "cv_alpha",
      resumeName: "Primary resume",
      resumeSource: "job",
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove attached resume" }),
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: null,
        resumeName: null,
      });
    });
    expect(
      screen.getAllByRole("button", { name: "Attach resume" }).length,
    ).toBeGreaterThan(0);
  });

  it("refreshes match and debug output on the same job after switching and detaching resumes", async () => {
    enableJobsMatchDebug();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        { id: "cv_beta", title: "Secondary resume", sections: [] },
      ],
      currentCv: null,
    };
    selectedJobResult = {
      ...selectedJob,
      resumeId: "cv_alpha",
      resumeName: "Primary resume",
      resumeSource: "job",
      matchRead: {
        ...selectedJob.matchRead,
        tier: "partial",
        score: 50,
        matched: ["operations"],
        missing: ["Retail design"],
        basedOn: {
          ...selectedJob.matchRead.basedOn,
          profileId: "cv_alpha",
        },
      },
    };
    selectedJobResultByRefreshKey[1] = {
      ...selectedJob,
      resumeId: "cv_beta",
      resumeName: "Secondary resume",
      resumeSource: "job",
      matchRead: {
        ...selectedJob.matchRead,
        tier: "strong",
        score: 100,
        confidence: "high",
        matched: ["Retail design", "Miami"],
        missing: [],
        basedOn: {
          ...selectedJob.matchRead.basedOn,
          profileId: "cv_beta",
        },
      },
    };
    selectedJobResultByRefreshKey[2] = {
      ...selectedJob,
      resumeId: undefined,
      resumeName: undefined,
      resumeSource: undefined,
      matchRead: {
        ...selectedJob.matchRead,
        tier: "unknown",
        score: null,
        scoreVisible: false,
        matched: [],
        missing: ["Retail design"],
        fallback: "profile_missing",
        basedOn: {
          ...selectedJob.matchRead.basedOn,
          profileId: "",
        },
      },
    };
    setJobResumeMock.mockImplementation(
      async ({ resumeId }: { resumeId: string | null }) => {
        debugPayload =
          resumeId === "cv_beta"
            ? {
                jobId: "job_alpha",
                lastResumeId: "cv_beta",
                resolvedProfileId: "cv_beta",
                matchReadFallback: "none",
                score: 100,
                matchedSignals: ["Retail design", "Miami"],
                missingSignals: [],
              }
            : {
                jobId: "job_alpha",
                lastResumeId: null,
                resolvedProfileId: null,
                matchReadFallback: "profile_missing",
                score: null,
                matchedSignals: [],
                missingSignals: ["Retail design"],
              };
        return null;
      },
    );

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach Secondary resume" }),
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_beta",
        resumeName: "Secondary resume",
      });
      expect(
        screen.getByLabelText("Current match: Strong match"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Attached resume: Secondary resume",
        }),
      ).toBeInTheDocument();
      expect(
        (
          screen.getByLabelText(
            "Match input debug output",
          ) as HTMLTextAreaElement
        ).value,
      ).toContain('"lastResumeId": "cv_beta"');
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Secondary resume",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove attached resume" }),
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: null,
        resumeName: null,
      });
      expect(screen.getByText("Resume did not load.")).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Attach resume" }).length,
      ).toBeGreaterThan(0);
      expect(
        (
          screen.getByLabelText(
            "Match input debug output",
          ) as HTMLTextAreaElement
        ).value,
      ).toContain('"lastResumeId": null');
    });
  });

  it("queues structured extraction before refetching match on refresh", async () => {
    selectedJobResult = {
      ...selectedJob,
      matchRead: {
        ...selectedJob.matchRead,
        tier: "unknown",
        score: null,
        scoreVisible: false,
        matched: [],
        missing: [],
        method: "llm",
        fallback: "structured_pending",
      },
    };
    selectedJobResultByRefreshKey[1] = {
      ...selectedJob,
      matchRead: {
        ...selectedJob.matchRead,
        tier: "partial",
        score: 68,
        confidence: "medium",
        method: "llm",
        matched: ["Security Guard", "security guard license"],
        missing: [],
        fallback: "none",
      },
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Match pending")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh match" }));

    await waitFor(() => {
      expect(refreshStructuredMatchMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
      });
      expect(screen.getByText("Compatibility analysis")).toBeInTheDocument();
    });
  });

  it("keeps favorite actions out of job actions while exposing the resume picker", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route
            path="/jobs/:jobId"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const jobActions = await screen.findByLabelText("Job actions");
    expect(
      within(jobActions).getByRole("button", {
        name: "Generate proposal",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Next step" })).toBeNull();
    expect(
      within(jobActions).getAllByRole("button", { name: "Attach resume" })
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(jobActions).queryByRole("button", { name: "Add to favorites" }),
    ).not.toBeInTheDocument();
    expect(
      within(jobActions).queryByRole("button", { name: "Mark favorite" }),
    ).not.toBeInTheDocument();
    expect(
      within(jobActions).queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();

    const favoriteToggle = screen.getByRole("button", { name: "Favorite" });
    expect(favoriteToggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(favoriteToggle);
    expect(setJobFavoriteMock).toHaveBeenCalledWith({
      jobId: "job_alpha",
      isFavorite: true,
    });
  });

  it("keeps the favorite action out of jobs list rows", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    expect(
      within(jobsListElement).queryByRole("button", {
        name: "Mark Operations Associate as favorite",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(jobsListElement).queryByRole("button", {
        name: "Remove Support Specialist from favorites",
      }),
    ).not.toBeInTheDocument();
  });

  it("opens a selected job from the list into the non-mobile right detail pane", async () => {
    selectedJobResult = {
      ...selectedJob,
      visibleSummary: "LLM visible summary for the selected job.",
      visibleRequirements: ["LLM visible requirement"],
      visibleKeywords: ["llm keyword"],
      visibleExtractionSource: "llm",
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/jobs/:jobId"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Operations Associate"));

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/jobs/job_alpha",
      );
    });

    const detailPane = await screen.findByRole("region", {
      name: "Job detail",
    });
    expect(within(detailPane).getByLabelText("Match")).toBeInTheDocument();
    expect(
      within(detailPane).getByText("LLM visible summary for the selected job."),
    ).toBeInTheDocument();
    expect(
      within(detailPane).getByText("Compatibility analysis"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Selected job detail" }),
    ).toBeNull();
  });

  it("renders favorite state as row meta instead of a row action", async () => {
    listResult = jobsList.map((job) =>
      job.id === "job_beta"
        ? {
            ...job,
            location: "Miami, FL · 1 month ago · 19 people clicked apply",
          }
        : job,
    );

    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    const supportRow = within(jobsListElement)
      .getByText("Support Specialist")
      .closest("article");
    expect(
      within(supportRow as HTMLElement).getByLabelText("Favorite"),
    ).toBeInTheDocument();
    expect(
      within(supportRow as HTMLElement).getByText("Miami, FL"),
    ).toBeInTheDocument();
    expect(
      within(supportRow as HTMLElement).queryByText(/people clicked apply/i),
    ).toBeNull();
    expect(
      within(supportRow as HTMLElement).queryByRole("button", {
        name: "Remove Support Specialist from favorites",
      }),
    ).not.toBeInTheDocument();
  });

  it("rehydrates favorite state from JobsPage query results", async () => {
    listResult = jobsList.map((job) =>
      job.id === "job_alpha" ? { ...job, isFavorite: true } : job,
    );
    selectedJobResult = {
      ...selectedJob,
      isFavorite: true,
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    const operationsRow = within(jobsListElement)
      .getByText("Operations Associate")
      .closest("article");
    expect(
      within(operationsRow as HTMLElement).getByLabelText("Favorite"),
    ).toBeInTheDocument();
    expect(
      within(operationsRow as HTMLElement).queryByRole("button", {
        name: "Remove Operations Associate from favorites",
      }),
    ).not.toBeInTheDocument();
  });

  it("filters favorites to favorited jobs only", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Favorites" }));

    await waitFor(() => {
      expect(screen.getByText("Support Specialist")).toBeInTheDocument();
      expect(
        screen.queryByText("Operations Associate"),
      ).not.toBeInTheDocument();
    });
  });

  it("clears Jobs search with the custom clear action", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const search = await screen.findByRole("searchbox", {
      name: "Search jobs",
    });
    fireEvent.change(search, { target: { value: "support" } });
    expect(search).toHaveValue("support");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(search).toHaveValue("");
  });

  it("opens extension and job board links from the Jobs list Add job menu", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: "+ Add job" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Paste URL" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Capture with extension" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Worth a shot" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Favorites" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ Filters" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Add job" }));
    expect(
      screen.getByRole("menuitem", { name: "Install Chrome extension" }),
    ).toBeInTheDocument();
    for (const link of getProposalExtensionSourceLinks()) {
      expect(
        screen.getByRole("menuitem", { name: link.label }),
      ).toBeInTheDocument();
    }

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Install Chrome extension" }),
    );
    expect(windowOpenMock).toHaveBeenCalledWith(
      PROPOSAL_EXTENSION_INSTALL_LINK.href,
      "_blank",
      "noopener,noreferrer",
    );

    fireEvent.click(screen.getByRole("button", { name: "+ Add job" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "LinkedIn" }));
    expect(windowOpenMock).toHaveBeenCalledWith(
      getProposalExtensionSourceLinks().find((link) => link.key === "linkedin")
        ?.href,
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("keeps moved Jobs list filters in the separate filter menu", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: "+ Add job" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Filters" }));
    expect(
      screen.getByRole("menuitemradio", { name: "Remote" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Senior" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Has docs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "No docs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Strong match" }),
    ).toBeInTheDocument();
  });

  it("saves summary edits inline from the brief card", async () => {
    selectedJobResult = {
      ...selectedJob,
      visibleSummary: selectedJob.summary,
      visibleRequirements: selectedJob.mustHaves,
      visibleKeywords: selectedJob.keywords,
      visibleExtractionSource: "llm",
    } as typeof selectedJob;

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Summary")).toBeInTheDocument();
    expect(screen.queryByText("Extracted summary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Summary" }));

    const summaryEditor = screen
      .getAllByRole("textbox")
      .find(
        (element) =>
          element.getAttribute("aria-label") !== "Match input debug output",
      );
    expect(summaryEditor).toBeDefined();
    fireEvent.change(summaryEditor as HTMLElement, {
      target: { value: "Updated summary for the saved job brief." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));

    await waitFor(() => {
      expect(updateFieldMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        fieldKey: "summary",
        value: "Updated summary for the saved job brief.",
      });
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      event: "field_corrected",
      jobId: "job_alpha",
      fieldKey: "summary",
      beforeConfidence: 0.82,
    });
  });

  it("shows the attached resume in the paperclip header affordance", async () => {
    selectedJobResult = {
      ...selectedJob,
      resumeId: "cv_alpha",
      resumeName: "Primary resume",
      resumeSource: "job",
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    ).toBeInTheDocument();
  });

  it("reflects the same job-scoped resume after Proposal Forge has already attached it", async () => {
    selectedJobResult = {
      ...selectedJob,
      resumeId: "cv_alpha",
      resumeName: "Operations Associate — Alex Martin",
      resumeSource: "job",
    };

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", {
        name: "Attached resume: Operations Associate — Alex Martin",
      }),
    ).toBeInTheDocument();
  });

  it("composes the library chips for match tier, docs, and viewed state", async () => {
    listResult = jobsList.map((job) =>
      job.id === "job_beta" ? { ...job, lastOpenedAt: 0 } : job,
    );

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    expect(
      within(jobsListElement).getAllByText("Operations Associate").length,
    ).toBeGreaterThan(0);
    expect(
      within(jobsListElement).getByText("Support Specialist"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Worth a shot" }),
    ).not.toHaveClass("dasti-jobs-filter-chip--active");
    expect(screen.getByRole("button", { name: "+ Filters" })).toBeEnabled();
    const supportRow = within(jobsListElement)
      .getByText("Support Specialist")
      .closest("article");
    expect(
      within(supportRow as HTMLElement)
        .getByText("Probably skip")
        .closest(".dasti-jobs-row__rail"),
    ).toBeTruthy();
    expect(
      within(supportRow as HTMLElement).getByLabelText("Favorite"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Worth a shot" }));

    await waitFor(() => {
      expect(
        within(jobsListElement).getAllByText("Operations Associate").length,
      ).toBeGreaterThan(0);
      expect(
        within(jobsListElement).queryByText("Support Specialist"),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Filters" }));
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Probably skip" }),
    );

    await waitFor(() => {
      expect(
        within(jobsListElement).getByText("Support Specialist"),
      ).toBeInTheDocument();
      expect(
        within(jobsListElement).queryByText("Operations Associate"),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Filters" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Has docs" }));

    expect(
      await screen.findByText("No jobs match this search"),
    ).toBeInTheDocument();
  });

  it("filters unviewed jobs and marks opened jobs as viewed", async () => {
    listResult = jobsList.map((job) =>
      job.id === "job_beta" ? { ...job, lastOpenedAt: 0 } : job,
    );

    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(screen.getByRole("button", { name: "New" }));

    await waitFor(() => {
      expect(
        within(jobsListElement).queryByText("Operations Associate"),
      ).not.toBeInTheDocument();
      expect(
        within(jobsListElement).getByText("Support Specialist"),
      ).toBeInTheDocument();
    });

    fireEvent.click(within(jobsListElement).getByText("Support Specialist"));

    await waitFor(() => {
      expect(markOpenedMock).toHaveBeenCalledWith({ jobId: "job_beta" });
      expect(screen.getByText("No jobs match this search")).toBeInTheDocument();
    });
  });

  it("opens the source URL from the row overflow menu", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(
      within(jobsListElement).getByRole("button", {
        name: "More actions for Operations Associate",
      }),
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Open source" }));

    expect(windowOpenMock).toHaveBeenCalledWith(
      "https://www.linkedin.com/jobs/view/alpha",
      "_blank",
      "noopener",
    );
  });

  it("archives a job from the row overflow menu and closes the selected detail view", async () => {
    archiveJobMock.mockImplementation(async ({ jobId }: { jobId: string }) => {
      const archivedJob = jobsList.find((job) => job.id === jobId);
      listResult = jobsList.filter((job) => job.id !== jobId);
      archivedListResult = archivedJob ? [archivedJob] : [];
      if (selectedJobResult?.id === jobId) {
        selectedJobResult = null;
      }
      return null;
    });

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route
            path="/jobs/:jobId"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(
      within(jobsListElement).getByRole("button", {
        name: "More actions for Operations Associate",
      }),
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));

    await waitFor(() => {
      expect(archiveJobMock).toHaveBeenCalledWith({ jobId: "job_alpha" });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/jobs?view=list",
      );
    });

    expect(screen.queryByText("Operations Associate")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archived" }));

    expect(await screen.findByText("Operations Associate")).toBeInTheDocument();
  });

  it("renders archived jobs in a dedicated Archived view", async () => {
    listResult = [jobsList[1]];
    archivedListResult = archivedJobsList;
    selectedJobResult = null;

    render(
      <MemoryRouter initialEntries={["/jobs?view=archived"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: "Archived" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Archived" })).toHaveClass(
      "dasti-jobs-view-toggle__button",
      "dasti-jobs-filter-chip--active",
    );
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("Operations Associate")).toBeInTheDocument();
    expect(screen.queryByText("Support Specialist")).not.toBeInTheDocument();
  });

  it("restores an archived job back to the active list", async () => {
    listResult = [jobsList[1]];
    archivedListResult = archivedJobsList;
    selectedJobResult = null;
    restoreArchivedJobMock.mockImplementation(
      async ({ jobId }: { jobId: string }) => {
        const restoredJob = archivedListResult?.find((job) => job.id === jobId);
        archivedListResult = (archivedListResult ?? []).filter(
          (job) => job.id !== jobId,
        );
        listResult = restoredJob
          ? [restoredJob, ...(listResult ?? [])]
          : listResult;
        return null;
      },
    );

    render(
      <MemoryRouter initialEntries={["/jobs?view=archived"]}>
        <Routes>
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(
      within(jobsListElement).getByRole("button", {
        name: "More actions for Operations Associate",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Restore" }));

    await waitFor(() => {
      expect(restoreArchivedJobMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/jobs?view=list",
      );
    });
    expect(await screen.findByText("Operations Associate")).toBeInTheDocument();
  });

  it("permanently deletes an archived job only after confirmation", async () => {
    listResult = [jobsList[1]];
    archivedListResult = archivedJobsList;
    selectedJobResult = null;
    deleteArchivedJobMock.mockImplementation(
      async ({ jobId }: { jobId: string }) => {
        archivedListResult = (archivedListResult ?? []).filter(
          (job) => job.id !== jobId,
        );
        return null;
      },
    );

    render(
      <MemoryRouter initialEntries={["/jobs?view=archived"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(
      within(jobsListElement).getByRole("button", {
        name: "More actions for Operations Associate",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete forever" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Confirm" }));

    await waitFor(() => {
      expect(deleteArchivedJobMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
      });
      expect(
        screen.queryByText("Operations Associate"),
      ).not.toBeInTheDocument();
    });
  });

  it("does not expose permanent delete in the active jobs view", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(
      within(jobsListElement).getByRole("button", {
        name: "More actions for Operations Associate",
      }),
    );

    expect(
      screen.getByRole("menuitem", { name: "Archive" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Duplicate" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Delete forever" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces row action mutation failures instead of swallowing them", async () => {
    archiveJobMock.mockRejectedValueOnce(new Error("Job not found"));

    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(
      within(jobsListElement).getByRole("button", {
        name: "More actions for Operations Associate",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Archive failed.", {
        variant: "error",
        description: "Job not found",
      });
    });
  });

  it("duplicates a job from the row overflow menu and navigates to the duplicate", async () => {
    duplicateJobMock.mockImplementation(
      async ({ jobId }: { jobId: string }) => {
        const sourceJob = jobsList.find((job) => job.id === jobId)!;
        listResult = [
          {
            ...sourceJob,
            id: "job_duplicate",
            title: `${sourceJob.title} Copy`,
            importedAt: sourceJob.importedAt + 1,
            updatedAt: sourceJob.updatedAt + 1,
            lastOpenedAt: sourceJob.lastOpenedAt + 1,
            lastActivityAt: sourceJob.lastActivityAt + 1,
          },
          ...jobsList,
        ];
        selectedJobResult = {
          ...selectedJob,
          id: "job_duplicate",
          title: "Operations Associate Copy",
        };
        return { jobId: "job_duplicate" };
      },
    );

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route
            path="/jobs/:jobId"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(
      within(jobsListElement).getByRole("button", {
        name: "More actions for Operations Associate",
      }),
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    await waitFor(() => {
      expect(duplicateJobMock).toHaveBeenCalledWith({ jobId: "job_alpha" });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/jobs/job_duplicate",
      );
    });
  });

  it("does not render the duplicate row before duplicate navigation completes", async () => {
    const duplicateDeferred = createDeferred<{ jobId: string }>();
    duplicateJobMock.mockImplementation(
      async ({ jobId }: { jobId: string }) => {
        const sourceJob = jobsList.find((job) => job.id === jobId)!;
        listResult = [
          {
            ...sourceJob,
            id: "job_duplicate",
            title: `${sourceJob.title} Copy`,
            importedAt: sourceJob.importedAt + 1,
            updatedAt: sourceJob.updatedAt + 1,
            lastOpenedAt: sourceJob.lastOpenedAt + 1,
            lastActivityAt: sourceJob.lastActivityAt + 1,
          },
          ...jobsList,
        ];
        return duplicateDeferred.promise;
      },
    );

    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route
            path="/jobs/:jobId"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/jobs"
            element={
              <>
                <JobsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await findJobsListElement();
    fireEvent.click(
      within(jobsListElement).getByRole("button", {
        name: "More actions for Operations Associate",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    await waitFor(() => {
      expect(duplicateJobMock).toHaveBeenCalledWith({ jobId: "job_alpha" });
    });

    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
    expect(
      within(jobsListElement).queryAllByText("Operations Associate Copy"),
    ).toHaveLength(0);

    duplicateDeferred.resolve({ jobId: "job_duplicate" });

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/jobs/job_duplicate",
      );
      expect(
        within(jobsListElement).getByText("Operations Associate Copy"),
      ).toBeInTheDocument();
    });
  });

  it("shows the first-run panel and opens onboarding jobs from Add a job", async () => {
    listResult = [];
    selectedJobResult = null;
    const onboardingReplayListener = vi.fn();
    window.addEventListener(
      "twoweeks:open-onboarding-replay",
      onboardingReplayListener,
    );

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Start with one job.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Add a job\b/i }));

    await waitFor(() => {
      expect(onboardingReplayListener).toHaveBeenCalled();
    });
    const event = onboardingReplayListener.mock.calls[0]?.[0] as CustomEvent<{
      stepId?: string;
    }>;
    expect(event.detail).toEqual({ stepId: "jobs" });
    expect(recordFirstRunPathMock).toHaveBeenCalledWith({ path: "import" });
    window.removeEventListener(
      "twoweeks:open-onboarding-replay",
      onboardingReplayListener,
    );
  });

  it("holds the first-run panel until the jobs query resolves", () => {
    listResult = undefined;
    selectedJobResult = null;

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading jobs")).toBeInTheDocument();
    expect(screen.queryByText("Start with one job.")).not.toBeInTheDocument();
  });

  it("seeds a sample job, refreshes the list, and marks the sample visibly", async () => {
    listResult = [];
    selectedJobResult = null;
    const sampleJobListItem = {
      id: "job_sample",
      title: "Content Operations Coordinator",
      company: "TwoWeeks Studio",
      location: "Remote",
      isSample: true,
      sourceUrl: "https://twoweeks.app/sample-job",
      sourceDomain: "twoweeks.app",
      sourceType: "sample",
      parseStatus: "parsed",
      reviewState: "ready",
      matchTier: "unknown",
      status: "active",
      importedAt: 1712000000000,
      updatedAt: 1712000000000,
      lastOpenedAt: 1712000000000,
      lastActivityAt: 1712000000000,
      linkedDocumentCount: 0,
    };
    const sampleJobDetail = {
      ...selectedJob,
      id: "job_sample",
      title: "Content Operations Coordinator",
      company: "TwoWeeks Studio",
      location: "Remote",
      isSample: true,
      sourceUrl: "https://twoweeks.app/sample-job",
      sourceDomain: "twoweeks.app",
      sourceType: "sample",
      reviewState: "ready",
      matchRead: null,
      nextStepBlock: null,
      linkedProposalCount: 0,
      linkedProposals: [],
      reviewItems: [],
    };
    seedSampleJobMock.mockImplementation(async () => {
      listResult = [sampleJobListItem];
      selectedJobResult = sampleJobDetail;
      return { jobId: "job_sample" };
    });

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Start with one job.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Try a sample/ }));

    expect(await screen.findAllByText("Sample")).not.toHaveLength(0);
    expect(seedSampleJobMock).toHaveBeenCalledWith({});
  });

  it("shows compact first-run copy when sample seeding fails", async () => {
    listResult = [];
    selectedJobResult = null;
    seedSampleJobMock.mockRejectedValue(new Error("Convex sample seed failed"));

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Start with one job.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Try a sample/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sample failed.",
    );
    expect(screen.queryByText("Convex sample seed failed")).toBeNull();
  });

  it("prepares attached ready jobs with the fixed auto mode and checks pending recommendations by default", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);

    renderJobsDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );

    await waitFor(() => {
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "auto_recommended",
      });
    });
    expect(
      await screen.findByRole("checkbox", {
        name: /Operations Lead · Example Co/i,
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Process mapping/i }),
    ).toBeChecked();
  });

  it("submits decisions only for pending selectable items and materializes with the returned reviewed plan id", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    selectedJobResultByRefreshKey[1] = undefined;
    const sourceCvBefore = JSON.stringify(cvLibraryResult.cvs[0]);
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);
    submitCvTailoringReviewMock.mockResolvedValue(reviewedCvTailoringReview);
    materializeCvTailoringReviewMock.mockResolvedValue({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: false,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("checkbox", { name: /Process mapping/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create tailored resume" }),
    );

    await waitFor(() => {
      expect(submitCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        expectedPlanId: "resume-variant-plan:pending",
        decisions: [
          {
            planItemId: "resume-variant-plan-item:experience",
            reviewState: "accepted",
          },
          {
            planItemId: "resume-variant-plan-item:skill",
            reviewState: "rejected",
          },
        ],
      });
      expect(materializeCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        expectedPlanId: "resume-variant-plan:reviewed",
      });
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith(
        "source-cv-variant:v1:reviewed",
      );
    });
    expect(JSON.stringify(cvLibraryResult.cvs[0])).toBe(sourceCvBefore);
    expect(screen.getByText("Tailored resume ready")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeEnabled();
    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "job_decision_made",
          jobId: "job_alpha",
          outcome: "resume",
        }),
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Continue to proposal" }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });

    for (const [input] of [
      ...prepareCvTailoringReviewMock.mock.calls,
      ...submitCvTailoringReviewMock.mock.calls,
      ...materializeCvTailoringReviewMock.mock.calls,
    ]) {
      expect(input).not.toHaveProperty("userId");
      expect(input).not.toHaveProperty("candidateFacts");
      expect(input).not.toHaveProperty("cvDocument");
      expect(input).not.toHaveProperty("evidenceGraph");
      expect(input).not.toHaveProperty("sourceAuthorization");
    }
  });

  it("does not offer proposal continuation until the materialized resume is hydrated", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    selectedJobResultByRefreshKey[1] = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready",
    };
    prepareCvTailoringReviewMock.mockResolvedValue(reviewedCvTailoringReview);
    materializeCvTailoringReviewMock.mockResolvedValue({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: false,
    });
    hydrateCvDocumentMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(reviewedVariantCv());

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create tailored resume" }),
    );

    expect(
      await screen.findByText(/created.*could not be loaded.*reload/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue to proposal" }),
    ).not.toBeInTheDocument();
    const generateProposalButton = screen.getByRole("button", {
      name: "Generate proposal",
    });
    expect(generateProposalButton).toBeDisabled();
    fireEvent.click(generateProposalButton);
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "job_decision_made",
          jobId: "job_alpha",
          outcome: "resume",
        }),
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Reload recommendations" }),
    );

    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledTimes(3);
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledTimes(1);
      expect(materializeCvTailoringReviewMock).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole("button", { name: "Continue to proposal" }),
      ).toBeInTheDocument();
    });
  });

  it("recovers materialized proposal authority during hydration without requiring a reload", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    selectedJobResultByRefreshKey[1] = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready",
    };
    prepareCvTailoringReviewMock.mockResolvedValue(reviewedCvTailoringReview);
    materializeCvTailoringReviewMock.mockResolvedValue({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: false,
    });
    const hydratedVariant = reviewedVariantCv();
    const recoveredHydration = createDeferred<typeof hydratedVariant>();
    hydrateCvDocumentMock
      .mockResolvedValueOnce(null)
      .mockReturnValueOnce(recoveredHydration.promise);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create tailored resume" }),
    );

    expect(
      await screen.findByText(/created.*could not be loaded.*reload/i),
    ).toBeInTheDocument();
    const generateProposalButton = screen.getByRole("button", {
      name: "Generate proposal",
    });
    expect(generateProposalButton).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume · Operations Associate",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(selectedJob.summary, { exact: true }),
    ).toHaveLength(1);

    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv({ summaryOnly: true }),
      ],
      currentCv: null,
    };
    rerenderJobsDetail?.();
    await act(async () => {
      recoveredHydration.resolve(hydratedVariant);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledTimes(2);
      expect(generateProposalButton).toBeEnabled();
    });
    expect(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume · Operations Associate",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(selectedJob.summary, { exact: true }),
    ).toHaveLength(1);
  });

  it("keeps successful duplicate hydration ready when the direct request fails later", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    selectedJobResultByRefreshKey[1] = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready",
    };
    prepareCvTailoringReviewMock.mockResolvedValue(reviewedCvTailoringReview);
    materializeCvTailoringReviewMock.mockResolvedValue({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: false,
    });
    const directHydration = createDeferred<null>();
    const duplicateHydration = createDeferred<
      ReturnType<typeof reviewedVariantCv>
    >();
    hydrateCvDocumentMock
      .mockReturnValueOnce(directHydration.promise)
      .mockReturnValueOnce(duplicateHydration.promise);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create tailored resume" }),
    );

    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      duplicateHydration.resolve(reviewedVariantCv());
      await Promise.resolve();
    });

    await act(async () => {
      directHydration.resolve(null);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generate proposal" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Continue to proposal" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/tailored resume could not be loaded/i),
    ).not.toBeInTheDocument();
  });

  it("keeps successful direct hydration ready when the duplicate request fails later", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    selectedJobResultByRefreshKey[1] = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready",
    };
    prepareCvTailoringReviewMock.mockResolvedValue(reviewedCvTailoringReview);
    materializeCvTailoringReviewMock.mockResolvedValue({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: false,
    });
    const directHydration = createDeferred<ReturnType<typeof reviewedVariantCv>>();
    const duplicateHydration = createDeferred<null>();
    hydrateCvDocumentMock
      .mockReturnValueOnce(directHydration.promise)
      .mockReturnValueOnce(duplicateHydration.promise);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create tailored resume" }),
    );

    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      directHydration.resolve(reviewedVariantCv());
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generate proposal" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Continue to proposal" }),
      ).toBeInTheDocument();
    });

    await act(async () => {
      duplicateHydration.resolve(null);
      await Promise.resolve();
    });

    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeEnabled();
    expect(
      screen.queryByText(/tailored resume could not be loaded/i),
    ).not.toBeInTheDocument();
  });

  it("keeps proposal navigation disabled for a summary-only derived attachment", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    cvLibraryResult = {
      cvs: [
        {
          id: "cv_alpha",
          title: "Primary resume",
          sections: [],
        },
        {
          id: "source-cv-variant:v1:reviewed",
          title: "Primary resume",
          metadata: {
            createdAt: "2026-07-30T00:00:00.000Z",
            updatedAt: "2026-07-30T00:00:00.000Z",
            version: 1,
            librarySummaryOnly: true,
            reviewedSourceCvVariant: {
              sourceCvId: "cv_alpha",
              jobId: "job_alpha",
            },
          },
          sections: [],
        },
      ],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockReturnValueOnce(new Promise(() => {}));

    renderJobsDetail();

    const generateProposalButton = await screen.findByRole("button", {
      name: "Generate proposal",
    });
    expect(generateProposalButton).toBeDisabled();
    fireEvent.click(generateProposalButton);
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
  });

  it("hydrates a summary-only derived attachment before enabling proposal navigation", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready",
    };
    const summaryVariant = reviewedVariantCv({ summaryOnly: true });
    const hydratedVariant = reviewedVariantCv();
    const hydration = createDeferred<typeof hydratedVariant>();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        summaryVariant,
      ],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockReturnValueOnce(hydration.promise);

    renderJobsDetail();

    const generateProposalButton = await screen.findByRole("button", {
      name: "Generate proposal",
    });
    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith(
        "source-cv-variant:v1:reviewed",
      );
    });
    expect(generateProposalButton).toBeDisabled();

    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        hydratedVariant,
      ],
      currentCv: null,
    };
    hydration.resolve(hydratedVariant);
    rerenderJobsDetail?.();

    await waitFor(() => {
      expect(generateProposalButton).toBeEnabled();
    });
  });

  it("requires authoritative hydration in addition to reviewed proposal authority after reload", async () => {
    const reviewedJob = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready" as const,
    };
    const generatedReviewedVariant = generateCvTemplateV1("Primary resume");
    const reviewedBinding = reviewedVariantCv().metadata.reviewedSourceCvVariant;
    const fullReviewedVariant = {
      ...generatedReviewedVariant,
      id: "source-cv-variant:v1:reviewed",
      title: "Primary resume",
      metadata: {
        ...generatedReviewedVariant.metadata,
        reviewedSourceCvVariant: reviewedBinding,
      },
    };
    const summaryReviewedVariant = {
      ...fullReviewedVariant,
      metadata: {
        ...fullReviewedVariant.metadata,
        librarySummaryOnly: true,
      },
      sections: [],
    };
    selectedJobResult = reviewedJob;
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        summaryReviewedVariant,
      ],
      currentCv: null,
    };
    const hydration = createDeferred<typeof fullReviewedVariant>();
    hydrateCvDocumentMock.mockReturnValue(hydration.promise);
    materializeCvTailoringReviewMock.mockResolvedValue({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: true,
    });

    renderJobsDetail();
    const generateProposalButton = await screen.findByRole("button", {
      name: "Generate proposal",
    });
    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledTimes(1);
    });
    expect(generateProposalButton).toBeDisabled();
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );

    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        fullReviewedVariant,
      ],
      currentCv: null,
    };
    await act(async () => {
      hydration.resolve(fullReviewedVariant);
      await Promise.resolve();
    });
    rerenderJobsDetail?.();

    await waitFor(() => {
      expect(generateProposalButton).toBeEnabled();
    });
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
    fireEvent.click(generateProposalButton);
    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("replaces stale reviewed provenance before full-source reload recovery", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready" as const,
    };
    const staleVariant = reviewedVariantCv();
    staleVariant.metadata.reviewedSourceCvVariant = {
      ...staleVariant.metadata.reviewedSourceCvVariant,
      sourceCvId: "cv_stale_wrong_source",
      reviewedPlanId: "resume-variant-plan:stale",
    };
    const authoritativeVariant = reviewedVariantCv();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        staleVariant,
      ],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockImplementation(async (id: string) => {
      if (id === authoritativeVariant.id) return authoritativeVariant;
      if (id === "cv_alpha") {
        return { id: "cv_alpha", title: "Primary resume", sections: [] };
      }
      return null;
    });
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();
    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith(
        authoritativeVariant.id,
      );
    });

    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        authoritativeVariant,
      ],
      currentCv: null,
    };
    rerenderJobsDetail?.();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("hydrates an attached tailored resume that is absent from the bounded library page", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready",
    };
    const hydratedVariant = reviewedVariantCv();
    const hydration = createDeferred<typeof hydratedVariant>();
    cvLibraryResult = {
      cvs: [{ id: "cv_alpha", title: "Primary resume", sections: [] }],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockReturnValueOnce(hydration.promise);
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();

    const generateProposalButton = await screen.findByRole("button", {
      name: "Generate proposal",
    });
    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith(
        "source-cv-variant:v1:reviewed",
      );
    });
    expect(generateProposalButton).toBeDisabled();

    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        hydratedVariant,
      ],
      currentCv: null,
    };
    hydration.resolve(hydratedVariant);
    rerenderJobsDetail?.();

    await waitFor(() => {
      expect(generateProposalButton).toBeEnabled();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );
    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("keeps a failed derived hydration blocked with recoverable guidance", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv({ summaryOnly: true }),
      ],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockRejectedValueOnce(new Error("Hydration failed"));

    renderJobsDetail();

    expect(
      await screen.findByText(/tailored resume.*could not be loaded.*reload/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeDisabled();
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
  });

  it("ignores a stale derived hydration after the same job attaches its source CV", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    const hydration = createDeferred<ReturnType<typeof reviewedVariantCv>>();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv({ summaryOnly: true }),
      ],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockReturnValueOnce(hydration.promise);

    renderJobsDetail();
    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith(
        "source-cv-variant:v1:reviewed",
      );
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume · Operations Associate",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach Primary resume" }),
    );
    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
    });

    hydration.resolve(reviewedVariantCv());

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generate proposal" }),
      ).toBeEnabled();
    });
    expect(
      screen.queryByText(/tailored resume.*could not be loaded/i),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
  });

  it("blocks an empty review plan before materialization", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue({
      ...pendingCvTailoringReview,
      plan: {
        ...pendingCvTailoringReview.plan,
        requiredDemandIds: [],
        items: [],
      },
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );

    expect(
      await screen.findByText(/no resume items are available to tailor/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create tailored resume" }),
    ).toBeDisabled();
    expect(submitCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();
  });

  it("blocks tailoring when every selectable recommendation is unchecked", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue({
      ...pendingCvTailoringReview,
      plan: {
        ...pendingCvTailoringReview.plan,
        requiredDemandIds: [],
      },
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: /Operations Lead · Example Co/i,
      }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Process mapping/i }));

    expect(
      screen.getByText(/keep at least one resume item/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create tailored resume" }),
    ).toBeDisabled();
    expect(submitCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();
  });

  it("blocks submission when a checked selection leaves a required demand uncovered", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: /Operations Lead · Example Co/i,
      }),
    );

    expect(
      screen.getByText(/Keep at least one recommendation for every required/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create tailored resume" }),
    ).toBeDisabled();
    expect(submitCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();
  });

  it("preserves settled decisions and materializes a fully reviewed resumed plan without resubmitting", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(reviewedCvTailoringReview);
    materializeCvTailoringReviewMock.mockResolvedValue({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: true,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );

    expect(
      await screen.findByRole("checkbox", {
        name: /Operations Lead · Example Co/i,
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Operations Lead · Example Co/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /Process mapping/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Process mapping/i }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Create tailored resume" }),
    );

    await waitFor(() => {
      expect(materializeCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        expectedPlanId: "resume-variant-plan:reviewed",
      });
    });
    expect(submitCvTailoringReviewMock).not.toHaveBeenCalled();
  });

  it("fails closed for blocked and stale reviews with a recoverable reload action", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValueOnce({
      ...pendingCvTailoringReview,
      plan: {
        ...pendingCvTailoringReview.plan,
        blocked: true,
        blockedReason: "Required evidence is missing.",
      },
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Required evidence is missing.",
    );
    expect(
      screen.getByRole("button", { name: "Create tailored resume" }),
    ).toBeDisabled();

    prepareCvTailoringReviewMock.mockResolvedValueOnce(
      pendingCvTailoringReview,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reload recommendations" }),
    );
    await screen.findByRole("checkbox", { name: /Process mapping/i });
    submitCvTailoringReviewMock.mockRejectedValue(
      new Error("stale ResumeVariantPlan review"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create tailored resume" }),
    );

    expect(
      await screen.findByText(/review changed.*reload/i),
    ).toBeInTheDocument();
    expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Process mapping/i }));
    expect(screen.getByText(/review changed.*reload/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload recommendations" }),
    ).toBeInTheDocument();
  });

  it("disables proposal navigation throughout the tailoring transaction", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);
    let resolveSubmit: (
      value: typeof reviewedCvTailoringReview,
    ) => void = () => {};
    submitCvTailoringReviewMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create tailored resume" }),
    );

    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeDisabled();
    resolveSubmit(reviewedCvTailoringReview);
  });

  it("rejects a reviewed derived attachment as a new tailoring source and labels it in the picker", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume",
    };
    cvLibraryResult = {
      cvs: [
        {
          id: "cv_alpha",
          title: "Primary resume",
          sections: [],
        },
        {
          id: "source-cv-variant:v1:reviewed",
          title: "Primary resume",
          metadata: {
            createdAt: "2026-07-30T00:00:00.000Z",
            updatedAt: "2026-07-30T00:00:00.000Z",
            version: 1,
            reviewedSourceCvVariant: {
              sourceCvId: "cv_alpha",
              jobId: "job_alpha",
              sourceCvContextHash: "source-cv-context-alpha",
            },
          },
          sections: [],
        },
      ],
      currentCv: null,
    };

    renderJobsDetail();

    expect(
      screen.getByRole("button", { name: "Tailor resume" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    expect(
      screen.getByRole("button", {
        name: "Attach Tailored resume · Primary resume",
      }),
    ).toBeInTheDocument();
    expect(prepareCvTailoringReviewMock).not.toHaveBeenCalled();
  });

  it("validates full_source_cv with only prepare and then reuses the existing proposal route", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    const sourceCvBefore = JSON.stringify(cvLibraryResult.cvs[0]);
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    await waitFor(() => {
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
    expect(submitCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(JSON.stringify(cvLibraryResult.cvs[0])).toBe(sourceCvBefore);
  });

  it("hydrates a summary-only complete resume before full-source proposal handoff", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    const hydration = createDeferred<{
      id: string;
      title: string;
      sections: unknown[];
    }>();
    cvLibraryResult = {
      cvs: [
        {
          id: "cv_alpha",
          title: "Primary resume",
          metadata: { librarySummaryOnly: true },
          sections: [],
        },
      ],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockReturnValueOnce(hydration.promise);
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    await waitFor(() => {
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith("cv_alpha");
    });
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );

    hydration.resolve({
      id: "cv_alpha",
      title: "Primary resume",
      sections: [],
    });
    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("keeps full-source proposal handoff blocked when the complete resume cannot hydrate", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    cvLibraryResult = {
      cvs: [
        {
          id: "cv_alpha",
          title: "Primary resume",
          metadata: { librarySummaryOnly: true },
          sections: [],
        },
      ],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockResolvedValueOnce(null);
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    expect(
      await screen.findByText(/complete resume could not be loaded/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
  });

  it("fails closed when a derived attachment has no available source provenance", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    hydrateCvDocumentMock.mockResolvedValue(null);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /original resume.*unavailable/i,
    );
    expect(prepareCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(setJobResumeMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
  });

  it("restores the provenance source CV after reloading with a derived attachment", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    cvLibraryResult = {
      cvs: [
        {
          id: "cv_alpha",
          title: "Primary resume",
          sections: [],
        },
        {
          id: "source-cv-variant:v1:reviewed",
          title: "Primary resume",
          metadata: {
            createdAt: "2026-07-30T00:00:00.000Z",
            updatedAt: "2026-07-30T00:00:00.000Z",
            version: 1,
            reviewedSourceCvVariant: {
              sourceCvId: "cv_alpha",
              jobId: "job_alpha",
              sourceCvContextHash: "source-cv-context-alpha",
            },
          },
          sections: [],
        },
      ],
      currentCv: null,
    };
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("cancels an in-flight tailored proposal before restoring the full source CV", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    const reviewedVariant = reviewedVariantCv();
    const proposalHydration = createDeferred<typeof reviewedVariant>();
    const sourceRestore = createDeferred<null>();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariant,
      ],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockReturnValueOnce(proposalHydration.promise);
    setJobResumeMock.mockReturnValueOnce(sourceRestore.promise);
    materializeCvTailoringReviewMock.mockResolvedValue({
      jobId: "job_alpha",
      resumeId: reviewedVariant.id,
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: true,
    });
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate proposal" }),
    );
    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith(reviewedVariant.id);
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );
    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
    });

    await act(async () => {
      proposalHydration.resolve(reviewedVariant);
      await Promise.resolve();
    });
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );

    await act(async () => {
      sourceRestore.resolve(null);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("hydrates a provenance source omitted from the bounded library page before restoring it", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    cvLibraryResult = {
      cvs: [reviewedVariantCv()],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockImplementation(async (id: string) =>
      id === "cv_alpha"
        ? { id: "cv_alpha", title: "Primary resume", sections: [] }
        : reviewedVariantCv(),
    );
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith("cv_alpha");
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("waits for an absent attached variant before restoring its provenance source", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    const hydration = createDeferred<ReturnType<typeof reviewedVariantCv>>();
    cvLibraryResult = {
      cvs: [{ id: "cv_alpha", title: "Primary resume", sections: [] }],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockImplementation(async (id: string) => {
      if (id === "source-cv-variant:v1:reviewed") {
        return hydration.promise;
      }
      return { id: "cv_alpha", title: "Primary resume", sections: [] };
    });
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    await waitFor(() => {
      expect(hydrateCvDocumentMock).toHaveBeenCalledWith(
        "source-cv-variant:v1:reviewed",
      );
    });
    expect(setJobResumeMock).not.toHaveBeenCalled();
    expect(prepareCvTailoringReviewMock).not.toHaveBeenCalled();

    await act(async () => {
      hydration.resolve(reviewedVariantCv());
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("navigates full-source after restoring from a still-unhydrated derived attachment", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    const hydration = createDeferred<ReturnType<typeof reviewedVariantCv>>();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv({ summaryOnly: true }),
      ],
      currentCv: null,
    };
    hydrateCvDocumentMock.mockReturnValueOnce(hydration.promise);
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
    hydration.resolve(reviewedVariantCv());
  });

  it("excludes a reviewed variant from another job's resume picker", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      id: "job_beta",
      title: "Support Specialist",
      company: "Northwind",
    };
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv({ jobId: "job_alpha" }),
      ],
      currentCv: null,
    };

    renderJobsDetail("/jobs/job_beta");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );

    expect(
      screen.queryByRole("button", {
        name: "Attach Tailored resume · Primary resume",
      }),
    ).not.toBeInTheDocument();
    expect(setJobResumeMock).not.toHaveBeenCalled();
  });

  it("rejects a reviewed variant when its provenance changes before attachment", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    const reviewedVariant = reviewedVariantCv();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariant,
      ],
      currentCv: null,
    };

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    const attachVariant = screen.getByRole("button", {
      name: "Attach Tailored resume · Primary resume",
    });
    reviewedVariant.metadata.reviewedSourceCvVariant.jobId = "job_beta";
    fireEvent.click(attachVariant);

    expect(setJobResumeMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /tailored resume belongs to another job.*cannot be attached/i,
    );
  });

  it("continues full-source validation when restoring the source refreshes the selected job", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
    };
    cvLibraryResult = {
      cvs: [
        {
          id: "cv_alpha",
          title: "Primary resume",
          sections: [],
        },
        {
          id: "source-cv-variant:v1:reviewed",
          title: "Primary resume",
          metadata: {
            createdAt: "2026-07-30T00:00:00.000Z",
            updatedAt: "2026-07-30T00:00:00.000Z",
            version: 1,
            reviewedSourceCvVariant: {
              sourceCvId: "cv_alpha",
              jobId: "job_alpha",
              sourceCvContextHash: "source-cv-context-alpha",
            },
          },
          sections: [],
        },
      ],
      currentCv: null,
    };
    prepareCvTailoringReviewMock.mockResolvedValue({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });
    setJobResumeMock.mockImplementationOnce(async () => {
      selectedJobResult = {
        ...selectedJobResult,
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
        resumeSource: "job",
      };
      rerenderJobsDetail?.();
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    await waitFor(() => {
      expect(prepareCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("reattaches the authoritative source CV before full-source proposal handoff after materialization", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock
      .mockResolvedValueOnce(reviewedCvTailoringReview)
      .mockResolvedValueOnce({
        mode: "full_source_cv",
        sourceCv: {
          id: "cv_alpha",
          contextHash: "source-cv-context-alpha",
        },
        plan: null,
      });
    materializeCvTailoringReviewMock.mockResolvedValue({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: false,
    });

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create tailored resume" }),
    );
    await screen.findByText("Tailored resume ready");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Primary resume",
      });
      expect(prepareCvTailoringReviewMock).toHaveBeenLastCalledWith({
        jobId: "job_alpha",
        mode: "full_source_cv",
      });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
  });

  it("invalidates a derived handoff immediately when the Job Brief summary changes", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready" as const,
    };
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv(),
      ],
      currentCv: null,
    };

    renderJobsDetail();
    expect(
      await screen.findByRole("button", { name: "Generate proposal" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit Summary" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated canonical summary" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));

    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /job brief changed.*restore.*complete resume.*tailor again/i,
    );
    expect(updateFieldMock).toHaveBeenCalledWith({
      jobId: "job_alpha",
      fieldKey: "summary",
      value: "Updated canonical summary",
    });
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
  });

  it("revalidates a persisted derived attachment before proposal handoff after reload", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready",
    };
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv(),
      ],
      currentCv: null,
    };
    materializeCvTailoringReviewMock.mockRejectedValueOnce(
      new Error(
        "Persisted ApplicationContext does not match the attached source CV",
      ),
    );

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate proposal" }),
    );

    await waitFor(() => {
      expect(materializeCvTailoringReviewMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        expectedPlanId: "resume-variant-plan:reviewed",
      });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /job brief changed.*restore.*complete resume.*tailor again/i,
    );
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
  });

  it("does not mark the complete source resume stale when an open review is invalidated by a Brief edit", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    await screen.findByRole("checkbox", {
      name: /Operations Lead · Example Co/i,
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit Summary" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated canonical summary" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha&drawer=proposal-draft",
      );
    });
    expect(
      screen.queryByText(/restore the complete resume/i),
    ).not.toBeInTheDocument();
  });

  it("invalidates a derived handoff when a Job Brief review item is corrected", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      reviewItems: selectedJob.reviewItems,
    };
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv(),
      ],
      currentCv: null,
    };

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Responsibilities" }),
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Run corrected workflows" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save Responsibilities" }),
    );

    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /job brief changed.*restore.*complete resume.*tailor again/i,
    );
    expect(updateFieldMock).toHaveBeenCalledWith({
      jobId: "job_alpha",
      fieldKey: "responsibilities",
      value: ["Run corrected workflows"],
    });
  });

  it("restores the prior tailoring review when a Job Brief mutation fails", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);
    updateFieldMock.mockRejectedValueOnce(new Error("Job update failed"));

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    expect(
      await screen.findByRole("checkbox", {
        name: /Operations Lead · Example Co/i,
      }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Edit Summary" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Mutation that will fail" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", {
          name: /Operations Lead · Example Co/i,
        }),
      ).toBeChecked();
    });
    expect(
      screen.queryByText(/job brief changed.*tailor again/i),
    ).not.toBeInTheDocument();
    expect(showToastMock).toHaveBeenCalledWith("Job Brief update failed.", {
      variant: "error",
    });
  });

  it("keeps a tailored handoff invalidated when an older concurrent Brief mutation fails", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      reviewItems: selectedJob.reviewItems,
    };
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv(),
      ],
      currentCv: null,
    };
    const firstUpdate = createDeferred<null>();
    const secondUpdate = createDeferred<null>();
    updateFieldMock
      .mockReturnValueOnce(firstUpdate.promise)
      .mockReturnValueOnce(secondUpdate.promise);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Summary" }),
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "First concurrent change" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Responsibilities" }),
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Second concurrent change" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save Responsibilities" }),
    );

    secondUpdate.resolve(null);
    await waitFor(() => {
      expect(updateFieldMock).toHaveBeenCalledTimes(2);
    });
    firstUpdate.reject(new Error("Older update failed"));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Job Brief update failed.", {
        variant: "error",
      });
    });
    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /job brief changed.*restore.*complete resume.*tailor again/i,
    );
  });

  it("restores the tailored handoff only after every concurrent Brief mutation fails", async () => {
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      resumeProposalAuthority: "reviewed_ready",
      reviewItems: selectedJob.reviewItems,
    };
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        reviewedVariantCv(),
      ],
      currentCv: null,
    };
    const firstUpdate = createDeferred<null>();
    const secondUpdate = createDeferred<null>();
    updateFieldMock
      .mockReturnValueOnce(firstUpdate.promise)
      .mockReturnValueOnce(secondUpdate.promise);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Summary" }),
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "First failed concurrent change" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Responsibilities" }),
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Second failed concurrent change" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save Responsibilities" }),
    );

    firstUpdate.reject(new Error("First update failed"));
    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole("button", { name: "Generate proposal" }),
    ).toBeDisabled();

    secondUpdate.reject(new Error("Second update failed"));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generate proposal" }),
      ).toBeEnabled();
    });
    expect(
      screen.queryByText(/job brief changed.*tailor again/i),
    ).not.toBeInTheDocument();
  });

  it("restores the review when a Brief update fails during materialization and ignores the stale result", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(reviewedCvTailoringReview);
    const materialization = createDeferred<{
      jobId: string;
      resumeId: string;
      resumeName: string;
      sourceCvId: string;
      reused: boolean;
    }>();
    materializeCvTailoringReviewMock.mockReturnValueOnce(
      materialization.promise,
    );
    updateFieldMock.mockRejectedValueOnce(new Error("Job update failed"));

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create tailored resume" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Summary" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Brief update that fails while tailoring" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));

    expect(
      await screen.findByRole("button", { name: "Create tailored resume" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("heading", { name: "Review recommendations" }),
    ).toBeInTheDocument();

    materialization.resolve({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: false,
    });
    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Job Brief update failed.", {
        variant: "error",
      });
    });
    expect(hydrateCvDocumentMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Tailored resume ready")).not.toBeInTheDocument();
  });

  it("does not let an in-flight tailoring response restore success after a Job Brief edit", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(reviewedCvTailoringReview);
    const materialization = createDeferred<{
      jobId: string;
      resumeId: string;
      resumeName: string;
      sourceCvId: string;
      reused: boolean;
    }>();
    materializeCvTailoringReviewMock.mockReturnValueOnce(
      materialization.promise,
    );

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create tailored resume" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Summary" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Brief changed during materialization" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save summary" }));

    materialization.resolve({
      jobId: "job_alpha",
      resumeId: "source-cv-variant:v1:reviewed",
      resumeName: "Primary resume · Operations Associate",
      sourceCvId: "cv_alpha",
      reused: false,
    });

    await waitFor(() => {
      expect(updateFieldMock).toHaveBeenCalled();
    });
    expect(hydrateCvDocumentMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Tailored resume ready")).not.toBeInTheDocument();
    expect(screen.getByTestId("jobs-location")).toHaveTextContent(
      "/jobs/job_alpha",
    );
  });

  it("does not prepare without an attached resume or a ready Job Brief", async () => {
    selectedJobResult = {
      ...selectedJob,
      reviewState: "ready",
      resumeId: undefined,
      resumeName: undefined,
    };
    const firstRender = renderJobsDetail();

    expect(
      await screen.findByText(/Attach a resume to tailor it for this job/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tailor resume" }),
    ).toBeDisabled();
    expect(prepareCvTailoringReviewMock).not.toHaveBeenCalled();

    firstRender.unmount();
    selectedJobResult = {
      ...readyJobWithAttachedResume(),
      reviewState: "needs_review",
    };
    renderJobsDetail();

    expect(
      await screen.findByText(
        /Review the highlighted Job Brief details before tailoring/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tailor resume" }),
    ).toBeDisabled();
    expect(prepareCvTailoringReviewMock).not.toHaveBeenCalled();
  });

  it("closing or changing the selected job never submits or materializes", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Close resume review" }),
    );
    fireEvent.click(screen.getByText("Support Specialist"));

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/jobs/job_beta",
      );
    });
    expect(submitCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();
  });

  it("invalidates an active review before attaching a different resume on the same job", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        { id: "cv_beta", title: "Alternate resume", sections: [] },
      ],
      currentCv: null,
    };
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);
    const attachment = createDeferred<null>();
    setJobResumeMock.mockReturnValueOnce(attachment.promise);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    await screen.findByRole("checkbox", {
      name: /Operations Lead · Example Co/i,
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach Alternate resume" }),
    );

    expect(
      screen.queryByRole("heading", { name: "Review recommendations" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /resume review reset.*prepare recommendations again/i,
    );
    expect(submitCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();

    attachment.resolve(null);
    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_beta",
        resumeName: "Alternate resume",
      });
    });
  });

  it("keeps the active review when the already-attached resume is selected", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    await screen.findByRole("heading", { name: "Review recommendations" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach Primary resume" }),
    );

    expect(
      screen.getByRole("heading", { name: "Review recommendations" }),
    ).toBeInTheDocument();
    expect(setJobResumeMock).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/resume review reset.*prepare recommendations again/i),
    ).not.toBeInTheDocument();
  });

  it("restores the active review when attaching another resume fails", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        { id: "cv_beta", title: "Alternate resume", sections: [] },
      ],
      currentCv: null,
    };
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);
    setJobResumeMock.mockRejectedValueOnce(new Error("attach failed"));

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    await screen.findByRole("heading", { name: "Review recommendations" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach Alternate resume" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Review recommendations" }),
    ).toBeInTheDocument();
    expect(showToastMock).toHaveBeenCalledWith("Attach failed.", {
      variant: "error",
    });
    expect(
      screen.queryByText(/resume review reset.*prepare recommendations again/i),
    ).not.toBeInTheDocument();
  });

  it("restores the active review when detaching the resume fails", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);
    setJobResumeMock.mockRejectedValueOnce(new Error("detach failed"));

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    await screen.findByRole("heading", { name: "Review recommendations" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove attached resume" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Review recommendations" }),
    ).toBeInTheDocument();
    expect(showToastMock).toHaveBeenCalledWith("Detach failed.", {
      variant: "error",
    });
    expect(
      screen.queryByText(/resume review reset.*prepare recommendations again/i),
    ).not.toBeInTheDocument();
  });

  it("invalidates an active review before detaching its resume on the same job", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    prepareCvTailoringReviewMock.mockResolvedValue(pendingCvTailoringReview);
    const detachment = createDeferred<null>();
    setJobResumeMock.mockReturnValueOnce(detachment.promise);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume" }),
    );
    await screen.findByRole("checkbox", {
      name: /Operations Lead · Example Co/i,
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove attached resume" }),
    );

    expect(
      screen.queryByRole("heading", { name: "Review recommendations" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /resume review reset.*prepare recommendations again/i,
    );
    expect(submitCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();

    detachment.resolve(null);
    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: null,
        resumeName: null,
      });
    });
  });

  it("ignores an in-flight full-source response after the attached resume changes", async () => {
    selectedJobResult = readyJobWithAttachedResume();
    cvLibraryResult = {
      cvs: [
        { id: "cv_alpha", title: "Primary resume", sections: [] },
        { id: "cv_beta", title: "Alternate resume", sections: [] },
      ],
      currentCv: null,
    };
    const fullSourceResponse = createDeferred<
      | typeof pendingCvTailoringReview
      | {
          mode: "full_source_cv";
          sourceCv: { id: string; contextHash: string };
          plan: null;
        }
    >();
    prepareCvTailoringReviewMock.mockReturnValueOnce(
      fullSourceResponse.promise,
    );
    setJobResumeMock.mockResolvedValueOnce(null);

    renderJobsDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Use my complete resume without tailoring",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Attached resume: Primary resume",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach Alternate resume" }),
    );

    fullSourceResponse.resolve({
      mode: "full_source_cv",
      sourceCv: {
        id: "cv_alpha",
        contextHash: "source-cv-context-alpha",
      },
      plan: null,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /resume review reset.*prepare recommendations again/i,
    );
    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/jobs/job_alpha",
      );
    });
    expect(submitCvTailoringReviewMock).not.toHaveBeenCalled();
    expect(materializeCvTailoringReviewMock).not.toHaveBeenCalled();
  });

  it("renders recovery guidance when the jobs query is missing from the local Convex runtime", async () => {
    listError = new Error(
      "[CONVEX Q(jobsPublic:listForUser)] Server Error Could not find public function for 'jobsPublic:listForUser'. Did you forget to run `npx convex dev`?",
    );

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Jobs backend is out of sync"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Start or restart the local Convex dev server/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copy: npm run dev:backend/i }),
    ).toBeInTheDocument();
  });

  it("renders a recoverable unavailable state when the selected job is inaccessible", async () => {
    selectedJobError = new Error(
      "[CONVEX Q(manualApplicationHandoff:getForJob)] Server Error Job not found",
    );

    render(
      <MemoryRouter initialEntries={["/jobs/job_missing"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Job unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/This offer is no longer available for this account/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to jobs" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(
      screen.queryByText(/manualApplicationHandoff|getForJob|Job not found/i),
    ).not.toBeInTheDocument();
  });
});
