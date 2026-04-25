import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { JobsPage } from "../JobsPage";

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
const trackEventMock = vi.fn().mockResolvedValue(null);
const updateFieldMock = vi.fn().mockResolvedValue(null);
const debugInspectMatchInputMock = vi.fn();
const convexClientMock = {
  query: debugInspectMatchInputMock,
};
const windowOpenMock = vi.fn();
const showToastMock = vi.fn();
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

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
let selectedJobResultByRefreshKey: Record<number, typeof selectedJob | null> =
  {};
let debugPayload: Record<string, unknown> | null = null;
let listError: Error | null = null;
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
  useCvLibrary: () => cvLibraryResult,
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
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
    debugInspectMatchInputMock.mockImplementation(async () => debugPayload);
    cvLibraryResult = {
      cvs: [{ id: "cv_alpha", title: "Primary resume", sections: [] }],
      currentCv: null,
    };
    listError = null;
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
      await screen.findByRole("heading", { name: "Jobs" }),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText("Operations Associate")).length,
    ).toBeGreaterThan(0);
    expect(await screen.findByText("Support Specialist")).toBeInTheDocument();
    expect(await screen.findByText("Acme · Paris")).toBeInTheDocument();
    expect(
      await screen.findByText("Northwind · Location unavailable"),
    ).toBeInTheDocument();
    expect((await screen.findAllByText("Match")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
    expect(await screen.findByText("Weak")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open match" }));
    expect(
      (await screen.findAllByText("Cross-functional communication")).length,
    ).toBeGreaterThan(0);
    expect(await screen.findByText("EXTRACTION. PAUSED.")).toBeInTheDocument();
    expect(screen.getByText(/Job read is out of order/i)).toBeInTheDocument();
    expect(screen.queryByText("Responsibilities")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("link", {
        name: /Open linked proposal Operations Associate cover letter/i,
      }),
    ).toHaveAttribute("href", "/proposal?view=saved&id=proposal_1");
    expect(await screen.findByText("Check fields")).toBeInTheDocument();
    expect(screen.queryByText("Review state")).not.toBeInTheDocument();
    const jobActions = screen.getByLabelText("Job actions");
    expect(
      within(jobActions).getByRole("button", {
        name: "Draft Proposal",
      }),
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
    expect(screen.getAllByText("LLM visible requirement").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("llm keyword").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Check").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByRole("button", { name: "Keep" })).toHaveLength(3);
    expect(screen.getAllByText("Summary").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Requirements").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Keywords").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Edit Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Requirements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Keywords" })).toBeInTheDocument();
    expect(screen.queryByText("Responsibilities")).not.toBeInTheDocument();
    expect(screen.queryByText("EXTRACTION. PAUSED.")).not.toBeInTheDocument();
    expect(screen.queryByText("Run recurring workflows")).not.toBeInTheDocument();
    expect(screen.getByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.getAllByText("Match").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("AI extracted")).not.toBeInTheDocument();
    expect(screen.queryByText("visibleExtractionSource")).not.toBeInTheDocument();
    expect(screen.queryByText("Extraction dashboard")).not.toBeInTheDocument();
  });

  it("shows a branded unavailable state instead of heuristic extraction fallback", async () => {
    selectedJobResult = {
      ...selectedJob,
      summary: "Heuristic summary should stay hidden.",
      visibleSummary: "Heuristic visible summary should stay hidden.",
      mustHaves: ["Heuristic requirement should stay hidden"],
      visibleRequirements: ["Heuristic visible requirement should stay hidden"],
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
          suggestedValue: ["At Texas Roadhouse, we are a people-first company."],
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

    expect(await screen.findByText("EXTRACTION. PAUSED.")).toBeInTheDocument();
    expect(screen.getByText(/Job read is out of order/i)).toBeInTheDocument();
    expect(screen.getByText(/Posting stays intact/i)).toBeInTheDocument();
    expect(screen.getByText("Imported Posting")).toBeInTheDocument();
    expect(
      screen.queryByText("Raw source remains visible for this job."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Posting" }));
    expect(screen.getByText("Raw source remains visible for this job.")).toBeInTheDocument();
    expect(screen.queryByText("Heuristic summary should stay hidden.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Heuristic visible requirement should stay hidden"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("location, status, compensation")).not.toBeInTheDocument();
    expect(screen.queryByText("location status compensation")).not.toBeInTheDocument();
    expect(screen.queryByText("Responsibilities")).not.toBeInTheDocument();
    expect(
      screen.queryByText("At Texas Roadhouse, we are a people-first company."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.getAllByText("Match").length).toBeGreaterThanOrEqual(1);
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

    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
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

    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.queryByTestId("jobs-structured-shadow-internal-panel")).toBeNull();
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

    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.queryByTestId("jobs-structured-shadow-internal-panel")).toBeNull();
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

    const panel = await screen.findByTestId("jobs-structured-shadow-internal-panel");
    expect(within(panel).getByText("Current match")).toBeInTheDocument();
    expect(within(panel).getByText("Structured shadow")).toBeInTheDocument();
    expect(
      within(panel).getByText("Production score remains the current match score."),
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
    expect(within(panel).getByText(/hard-gate missing\s+0/)).toBeInTheDocument();
    expect(within(panel).getByText(/metadata leaks\s+0/)).toBeInTheDocument();
    expect(within(panel).getByText("language preserved")).toBeInTheDocument();
    expect(within(panel).getByText("provenance complete")).toBeInTheDocument();
    expect(screen.getByText("Partial · 50%")).toBeInTheDocument();
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

    const panel = await screen.findByTestId("jobs-structured-preview-advisory-panel");
    expect(screen.queryByTestId("jobs-structured-shadow-internal-panel")).toBeNull();
    expect(within(panel).getAllByText("Structured preview").length).toBeGreaterThan(0);
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
    expect(screen.getByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft Proposal" })).toBeInTheDocument();
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

    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.queryByTestId("jobs-structured-preview-advisory-panel")).toBeNull();
    expect(screen.queryByText("Structured score is used when available. Missing extraction stays pending instead of using keyword fallback.")).toBeNull();
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

    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.queryByTestId("jobs-structured-preview-advisory-panel")).toBeNull();
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

    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
    expect(await screen.findByTestId("jobs-structured-preview-advisory-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft Proposal" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Match Strong" }));

    expect(screen.getByText("0 of 2")).toBeInTheDocument();
    expect(
      screen.getByText(/No jobs match this search/i),
    ).toBeInTheDocument();
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

    const panel = await screen.findByTestId("jobs-structured-shadow-internal-panel");
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
    expect(screen.getByText("Partial · 50%")).toBeInTheDocument();
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

    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.queryByTestId("jobs-structured-shadow-internal-panel")).toBeNull();
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

    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.queryByTestId("jobs-structured-preview-advisory-panel")).toBeNull();
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
    expect(screen.getByText("Production score remains current match score")).toBeInTheDocument();
    expect(within(block).getByText("internal_viewer_required")).toBeInTheDocument();
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
    expect(within(block).getByText("Cross-functional communication")).toBeInTheDocument();
    expect(screen.getByText("Partial · 50%")).toBeInTheDocument();
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
    fireEvent.click(
      within(matchRegion).getByRole("button", {
        name: "Missing 1",
      }),
    );
    expect(within(matchRegion).getByText("Customer-facing experience")).toBeInTheDocument();
    expect(
      within(matchRegion).queryByText("Paris"),
    ).toBeNull();
    expect(
      within(matchRegion).queryByText("Compensation"),
    ).toBeNull();
    expect(
      within(matchRegion).queryByText("Acme"),
    ).toBeNull();
    expect(
      within(matchRegion).queryByText(
        "Equal opportunity employer",
      ),
    ).toBeNull();
    expect(screen.getByText("Partial · 50%")).toBeInTheDocument();
    expect(screen.getAllByText("Match").length).toBeGreaterThanOrEqual(1);
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
    expect(within(matchRegion).getByText("Partial · 68%")).toBeInTheDocument();
    expect(
      within(matchRegion).getByText("Partial match. A few checks left."),
    ).toBeInTheDocument();
    expect(within(matchRegion).getByText("Apply")).toBeInTheDocument();
    expect(
      within(matchRegion).getByText(
        "Operations overlaps.",
      ),
    ).toBeInTheDocument();
    expect(
      within(matchRegion).getByText(
        "Coordination overlaps.",
      ),
    ).toBeInTheDocument();
    expect(
      within(matchRegion).getByText(
        "Airtable overlaps.",
      ),
    ).toBeInTheDocument();
    expect(
      within(matchRegion).queryByText("This fourth reason should stay hidden."),
    ).toBeNull();
    expect(within(matchRegion).queryByText("Possible lead · 68%")).toBeNull();
    expect(within(matchRegion).queryByText("Partial · 50%")).toBeNull();
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
    expect(within(matchRegion).getByText("Partial · 62%")).toBeInTheDocument();
    expect(within(matchRegion).getByText("Apply if true")).toBeInTheDocument();
    expect(
      within(matchRegion).getByText(
        "Guard card/license unclear.",
      ),
    ).toBeInTheDocument();
    expect(
      within(matchRegion).getByText(
        "Weekend availability is a check.",
      ),
    ).toBeInTheDocument();
    expect(
      within(matchRegion).queryByText("This third watch-out should stay hidden."),
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
    expect(within(matchRegion).getByText("Partial · 50%")).toBeInTheDocument();
    expect(within(matchRegion).getByText("Matched")).toBeInTheDocument();
    expect(within(matchRegion).queryByText("Partial · 68%")).toBeNull();
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
    expect(within(matchRegion).getByText("Partial · 50%")).toBeInTheDocument();
    expect(within(matchRegion).getByText("Matched")).toBeInTheDocument();
    expect(within(matchRegion).queryByText("Not enough signal · 0%")).toBeNull();
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

  it("opens the source URL from the job detail header and keeps the brief card title out of the embedded panel", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

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
      await screen.findByRole("button", { name: "Draft Proposal" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal?jobId=job_alpha",
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
      expect(screen.getByText("Strong · 100%")).toBeInTheDocument();
      expect(
        (screen.getByLabelText("Match input debug output") as HTMLTextAreaElement)
          .value,
      ).toContain('"lastResumeId": "cv_alpha"');
    });
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

    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
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
      expect(screen.getByText("Strong · 100%")).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Attached resume: Secondary resume",
        }),
      ).toBeInTheDocument();
      expect(
        (screen.getByLabelText("Match input debug output") as HTMLTextAreaElement)
          .value,
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
      expect(
        screen.getByText("Resume did not load."),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Attach resume" }).length,
      ).toBeGreaterThan(0);
      expect(
        (screen.getByLabelText("Match input debug output") as HTMLTextAreaElement)
          .value,
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
      expect(screen.getByText("Partial · 68%")).toBeInTheDocument();
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
        name: "Draft Proposal",
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
  });

  it("toggles favorite on from the jobs list row", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Mark Operations Associate as favorite",
      }),
    );

    await waitFor(() => {
      expect(setJobFavoriteMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        isFavorite: true,
      });
    });
    expect(screen.getAllByText("Favorite").length).toBeGreaterThan(0);
  });

  it("toggles favorite off from the jobs list row", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs?view=list"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Remove Support Specialist from favorites",
      }),
    );

    await waitFor(() => {
      expect(setJobFavoriteMock).toHaveBeenCalledWith({
        jobId: "job_beta",
        isFavorite: false,
      });
    });
    expect(
      screen.getByRole("button", {
        name: "Mark Support Specialist as favorite",
      }),
    ).toHaveAttribute("aria-pressed", "false");
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

    expect(
      await screen.findByRole("button", { name: "Remove job from favorites" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Favorite").length).toBeGreaterThan(0);
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

    expect(await screen.findByText("Extracted summary")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));

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

  it("composes the library chips for match tier, docs, and needs review", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await screen.findByRole("list");
    expect(
      within(jobsListElement).getByText("Operations Associate"),
    ).toBeInTheDocument();
    expect(
      within(jobsListElement).getByText("Support Specialist"),
    ).toBeInTheDocument();
    expect(
      within(jobsListElement).getAllByRole("button", {
        name: /More actions for/i,
      }),
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Match Weak" }));

    await waitFor(() => {
      expect(
        within(jobsListElement).getByText("Support Specialist"),
      ).toBeInTheDocument();
      expect(
        within(jobsListElement).queryByText("Operations Associate"),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Has docs" }));

    expect(
      await screen.findByText("No jobs match this search"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Match Weak" }));
    fireEvent.click(screen.getByRole("button", { name: "All tiers" }));
    fireEvent.click(screen.getByRole("button", { name: "Has docs" }));
    fireEvent.click(screen.getByRole("button", { name: "Needs review" }));

    await waitFor(() => {
      expect(
        within(jobsListElement).getByText("Operations Associate"),
      ).toBeInTheDocument();
      expect(
        within(jobsListElement).queryByText("Support Specialist"),
      ).not.toBeInTheDocument();
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

    const jobsListElement = await screen.findByRole("list");
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

    const jobsListElement = await screen.findByRole("list");
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

    const jobsListElement = await screen.findByRole("list");
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

    const jobsListElement = await screen.findByRole("list");
    fireEvent.click(
      within(jobsListElement).getByRole("button", {
        name: "More actions for Operations Associate",
      }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Delete forever" }),
    );
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

    const jobsListElement = await screen.findByRole("list");
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

    const jobsListElement = await screen.findByRole("list");
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

    const jobsListElement = await screen.findByRole("list");
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

    const jobsListElement = await screen.findByRole("list");
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
        within(screen.getByRole("list")).getByText("Operations Associate Copy"),
      ).toBeInTheDocument();
    });
  });

  it("shows the first-run panel and routes import clicks directly to Capture the role", async () => {
    listResult = [];
    selectedJobResult = null;

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/proposal" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Start with one job."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Import job" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/proposal",
      );
    });
    const locationState = JSON.parse(
      screen.getByTestId("jobs-location").dataset.state ?? "null",
    );
    expect(locationState).toEqual(
      expect.objectContaining({
        proposalEntryIntent: "cover-letter-start",
        jobImportFocus: "supported-sites",
      }),
    );
    expect(locationState.proposalWorkspaceResetToken).toEqual(
      expect.any(String),
    );
    expect(recordFirstRunPathMock).toHaveBeenCalledWith({ path: "import" });
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
    expect(
      screen.queryByText("Start with one job."),
    ).not.toBeInTheDocument();
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

    expect(
      await screen.findByText("Start with one job."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try a sample" }));

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

    expect(
      await screen.findByText("Start with one job."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try a sample" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sample failed.",
    );
    expect(screen.queryByText("Convex sample seed failed")).toBeNull();
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
});
