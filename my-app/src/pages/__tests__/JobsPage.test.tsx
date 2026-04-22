import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { JobsPage } from "../JobsPage";

const approveReviewItemMock = vi.fn().mockResolvedValue(null);
const ensureCanonicalProfileMock = vi.fn().mockResolvedValue(null);
const markOpenedMock = vi.fn().mockResolvedValue(null);
const updateFieldMock = vi.fn().mockResolvedValue(null);
const windowOpenMock = vi.fn();
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

const jobsList = [
  {
    id: "job_alpha",
    title: "Operations Associate",
    company: "Acme",
    sourceUrl: "https://www.linkedin.com/jobs/view/alpha",
    sourceDomain: "linkedin.com",
    sourceType: "linkedin",
    parseStatus: "parsed",
    reviewState: "needs_review",
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
    sourceUrl: "https://www.indeed.com/viewjob?jk=beta",
    sourceDomain: "indeed.com",
    sourceType: "indeed",
    parseStatus: "parsed",
    reviewState: "ready",
    status: "active",
    importedAt: 1710000000000,
    updatedAt: 1710001000000,
    lastOpenedAt: 1710002000000,
    lastActivityAt: 1710002000000,
    linkedDocumentCount: 1,
  },
];

const selectedJob = {
  id: "job_alpha",
  title: "Operations Associate",
  company: "Acme",
  location: "Paris",
  sourceUrl: "https://www.linkedin.com/jobs/view/alpha",
  sourceDomain: "linkedin.com",
  sourceType: "linkedin",
  applicationUrl: "https://www.linkedin.com/jobs/view/alpha/apply",
  parseStatus: "parsed",
  reviewState: "needs_review",
  summary: "Support recurring operations and unblock coordination work.",
  rawDescription: "Coordinate internal workflows and keep teams aligned.",
  responsibilities: ["Run recurring workflows", "Coordinate team updates"],
  keywords: ["operations", "coordination"],
  mustHaves: ["Cross-functional communication"],
  toneCues: ["clear", "dependable"],
  contacts: ["Hiring Manager"],
  status: "active",
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
const convexMock = {
  query: async (reference: string, args?: { jobId?: string }) => {
    if (reference === "jobsPublic.listForUser") {
      if (listError) {
        throw listError;
      }
      return listResult;
    }
    if (reference === "jobsPublic.getById") {
      if (!args?.jobId) {
        return undefined;
      }
      return selectedJobResult;
    }
    return null;
  },
};

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useConvex: () => convexMock,
  useMutation: (reference: string) => {
    if (reference === "jobsPublic.approveReviewItem") {
      return approveReviewItemMock;
    }
    if (reference === "jobsPublic.ensureCanonicalProfile") {
      return ensureCanonicalProfileMock;
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
      ensureCanonicalProfile: "jobsPublic.ensureCanonicalProfile",
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
    ensureCanonicalProfileMock.mockClear();
    markOpenedMock.mockClear();
    updateFieldMock.mockClear();
    listResult = jobsList;
    selectedJobResult = selectedJob;
    listError = null;
    windowOpenMock.mockReset();
    vi.stubGlobal("open", windowOpenMock);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders the list-detail inbox and updates trust immediately on approve", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job_alpha"]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobsPage />} />
          <Route path="/proposal" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    expect((await screen.findAllByText("Operations Associate")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Support Specialist")).toBeInTheDocument();
    expect((await screen.findAllByText("Responsibilities")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Run recurring workflows")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Open linked proposal Operations Associate cover letter/i })).toHaveAttribute(
      "href",
      "/proposal?view=saved&id=proposal_1",
    );
    expect(await screen.findByText("Review state")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    });
    expect(approveReviewItemMock).toHaveBeenCalledWith({
      jobId: "job_alpha",
      reviewItemId: "review_1",
    });
    expect(markOpenedMock).toHaveBeenCalledWith({ jobId: "job_alpha" });
  });

  it("shows the guided empty state when no jobs are saved", async () => {
    listResult = [];
    selectedJobResult = null;

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("No saved jobs yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Install TwoWeeks extension/i }),
    ).toHaveAttribute("href", "https://chromewebstore.google.com/");
    expect(
      screen.getByRole("button", { name: /Paste job manually/i }),
    ).toBeInTheDocument();
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
