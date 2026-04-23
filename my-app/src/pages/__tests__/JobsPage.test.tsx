import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { JobsPage } from "../JobsPage";

const approveReviewItemMock = vi.fn().mockResolvedValue(null);
const archiveJobMock = vi.fn().mockResolvedValue(null);
const duplicateJobMock = vi.fn().mockResolvedValue({ jobId: "job_duplicate" });
const markOpenedMock = vi.fn().mockResolvedValue(null);
const recordFirstRunPathMock = vi.fn().mockResolvedValue(null);
const seedSampleJobMock = vi.fn().mockResolvedValue({ jobId: "job_sample" });
const trackEventMock = vi.fn().mockResolvedValue(null);
const updateFieldMock = vi.fn().mockResolvedValue(null);
const windowOpenMock = vi.fn();
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

const jobsList = [
  {
    id: "job_alpha",
    title: "Operations Associate",
    company: "Acme",
    location: "Paris",
    isSample: false,
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

const selectedJob = {
  id: "job_alpha",
  title: "Operations Associate",
  company: "Acme",
  location: "Paris",
  isSample: false,
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
    method: "keyword-overlap",
    fallback: "none",
  },
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
let selectedJobResult: typeof selectedJob | null | undefined = selectedJob;
let listError: Error | null = null;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (reference: string, args?: { jobId?: string } | "skip") => {
    if (reference === "jobsPublic.listForUser") {
      if (listError) {
        throw listError;
      }
      return listResult;
    }
    if (reference === "jobsPublic.getById") {
      if (args === "skip" || !args?.jobId) {
        return undefined;
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
    if (reference === "jobsPublic.duplicateJob") {
      return duplicateJobMock;
    }
    if (reference === "jobsPublic.recordFirstRunPath") {
      return recordFirstRunPathMock;
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
      duplicateJob: "jobsPublic.duplicateJob",
      recordFirstRunPath: "jobsPublic.recordFirstRunPath",
      seedSampleJob: "jobsPublic.seedSampleJob",
      trackEvent: "jobsPublic.trackEvent",
      markOpened: "jobsPublic.markOpened",
      updateField: "jobsPublic.updateField",
    },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    cvs: [{ id: "cv_alpha", title: "Primary resume", sections: [] }],
    currentCv: null,
  }),
}));

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return <div data-testid="jobs-location">{`${location.pathname}${location.search}`}</div>;
}

describe("JobsPage", () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    approveReviewItemMock.mockClear();
    archiveJobMock.mockClear();
    duplicateJobMock.mockClear();
    markOpenedMock.mockClear();
    recordFirstRunPathMock.mockClear();
    seedSampleJobMock.mockReset();
    seedSampleJobMock.mockResolvedValue({ jobId: "job_sample" });
    trackEventMock.mockClear();
    updateFieldMock.mockClear();
    windowOpenMock.mockReset();
    vi.stubGlobal("open", windowOpenMock);
    listResult = jobsList;
    selectedJobResult = selectedJob;
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

    expect(await screen.findByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    expect((await screen.findAllByText("Operations Associate")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Support Specialist")).toBeInTheDocument();
    expect(await screen.findByText("Acme · Paris")).toBeInTheDocument();
    expect(await screen.findByText("Northwind · Location unavailable")).toBeInTheDocument();
    expect(await screen.findByText("Match")).toBeInTheDocument();
    expect(await screen.findByText("Partial · 50%")).toBeInTheDocument();
    expect(await screen.findByText("Weak")).toBeInTheDocument();
    expect(
      (await screen.findAllByText("Cross-functional communication")).length,
    ).toBeGreaterThan(0);
    expect((await screen.findAllByText("Responsibilities")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: /Open linked proposal Operations Associate cover letter/i })).toHaveAttribute(
      "href",
      "/proposal?view=saved&id=proposal_1",
    );
    expect(await screen.findByText("Review state")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open resume with this job" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Common next steps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save for later" })).toBeInTheDocument();
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
    const rawSource = screen.getByText("Raw source");
    expect(
      linkedDocuments.compareDocumentPosition(rawSource) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    });
    expect(approveReviewItemMock).toHaveBeenCalledWith({
      jobId: "job_alpha",
      reviewItemId: "review_1",
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      event: "import_accepted",
      jobId: "job_alpha",
      fieldKey: "responsibilities",
    });
    expect(markOpenedMock).toHaveBeenCalledWith({ jobId: "job_alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Open resume with this job" }));

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent(
        "/cv?jobId=job_alpha",
      );
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      event: "job_decision_made",
      jobId: "job_alpha",
      outcome: "resume",
      timeToDecisionMs: expect.any(Number),
      tier: "partial",
    });
  });

  it("closes to list view when save for later is selected", async () => {
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

    expect(await screen.findByRole("button", { name: "Save for later" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save for later" }));

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent("/jobs?view=list");
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      event: "job_decision_made",
      jobId: "job_alpha",
      outcome: "save_for_later",
      timeToDecisionMs: expect.any(Number),
      tier: "partial",
    });
  });

  it("saves summary edits inline from the brief card", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Extracted summary")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));

    const summaryEditor = screen.getByRole("textbox");
    fireEvent.change(summaryEditor, {
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

  it("composes the library chips for match tier, docs, and needs review", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const jobsListElement = await screen.findByRole("list");
    expect(within(jobsListElement).getByText("Operations Associate")).toBeInTheDocument();
    expect(within(jobsListElement).getByText("Support Specialist")).toBeInTheDocument();
    expect(
      within(jobsListElement).getAllByRole("button", { name: /More actions for/i }),
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Match Weak" }));

    await waitFor(() => {
      expect(within(jobsListElement).getByText("Support Specialist")).toBeInTheDocument();
      expect(within(jobsListElement).queryByText("Operations Associate")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Has docs" }));

    expect(await screen.findByText("No jobs match this search")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Match Weak" }));
    fireEvent.click(screen.getByRole("button", { name: "All tiers" }));
    fireEvent.click(screen.getByRole("button", { name: "Has docs" }));
    fireEvent.click(screen.getByRole("button", { name: "Needs review" }));

    await waitFor(() => {
      expect(within(jobsListElement).getByText("Operations Associate")).toBeInTheDocument();
      expect(within(jobsListElement).queryByText("Support Specialist")).not.toBeInTheDocument();
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
      listResult = jobsList.filter((job) => job.id !== jobId);
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
      expect(screen.getByTestId("jobs-location")).toHaveTextContent("/jobs?view=list");
    });
  });

  it("duplicates a job from the row overflow menu and navigates to the duplicate", async () => {
    duplicateJobMock.mockImplementation(async ({ jobId }: { jobId: string }) => {
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

    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    await waitFor(() => {
      expect(duplicateJobMock).toHaveBeenCalledWith({ jobId: "job_alpha" });
      expect(screen.getByTestId("jobs-location")).toHaveTextContent("/jobs/job_duplicate");
    });
  });

  it("shows the first-run panel and routes import clicks into the existing parse flow", async () => {
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

    expect(await screen.findByText("Start with one job decision")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Import your first job" }));

    await waitFor(() => {
      expect(screen.getByTestId("jobs-location")).toHaveTextContent("/proposal");
    });
    expect(recordFirstRunPathMock).toHaveBeenCalledWith({ path: "import" });
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

    expect(await screen.findByText("Start with one job decision")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try a sample job" }));

    expect(await screen.findAllByText("Sample")).not.toHaveLength(0);
    expect(seedSampleJobMock).toHaveBeenCalledWith({});
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

    expect(await screen.findByText("Jobs backend is out of sync")).toBeInTheDocument();
    expect(
      screen.getByText(/Start or restart the local Convex dev server/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copy: npm run dev:backend/i }),
    ).toBeInTheDocument();
  });
});
