import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { JobsPage } from "../JobsPage";

const approveReviewItemMock = vi.fn().mockResolvedValue(null);
const markOpenedMock = vi.fn().mockResolvedValue(null);
const updateFieldMock = vi.fn().mockResolvedValue(null);
const windowOpenMock = vi.fn();

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

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (reference: string, args: unknown) => {
    if (reference === "jobsPublic.listForUser") {
      return listResult;
    }
    if (reference === "jobsPublic.getById") {
      if (args === "skip") {
        return undefined;
      }
      return selectedJobResult;
    }
    return null;
  },
  useMutation: (reference: string) => {
    if (reference === "jobsPublic.approveReviewItem") {
      return approveReviewItemMock;
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
    approveReviewItemMock.mockClear();
    markOpenedMock.mockClear();
    updateFieldMock.mockClear();
    listResult = jobsList;
    selectedJobResult = selectedJob;
    windowOpenMock.mockReset();
    vi.stubGlobal("open", windowOpenMock);
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

    expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    expect(screen.getAllByText("Operations Associate").length).toBeGreaterThan(0);
    expect(screen.getByText("Support Specialist")).toBeInTheDocument();
    expect(screen.getAllByText("Responsibilities").length).toBeGreaterThan(0);
    expect(screen.getByText("Run recurring workflows")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open linked proposal Operations Associate cover letter/i })).toHaveAttribute(
      "href",
      "/proposal?view=saved&id=proposal_1",
    );
    expect(screen.getByText("Review state")).toBeInTheDocument();

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

  it("shows the guided empty state when no jobs are saved", () => {
    listResult = [];
    selectedJobResult = null;

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("No saved jobs yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Install TwoWeeks extension/i }),
    ).toHaveAttribute("href", "https://chromewebstore.google.com/");
    expect(
      screen.getByRole("button", { name: /Paste job manually/i }),
    ).toBeInTheDocument();
  });
});
