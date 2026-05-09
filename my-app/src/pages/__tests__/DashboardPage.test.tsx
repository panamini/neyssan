import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { DashboardPage } from "../DashboardPage";

const useQueryMock = vi.fn();

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalsPublic: { default: "proposalsPublic.default" },
    jobsPublic: { listForUser: "jobsPublic.listForUser" },
  },
}));

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="dashboard-location">
      {`${location.pathname}${location.search}::${JSON.stringify(location.state ?? null)}`}
    </div>
  );
}

const now = Date.now();

const draftProposal = {
  _id: "draft-1",
  title: "Staff Designer draft",
  content: "Draft body",
  status: "draft",
  updatedAt: now - 1_000,
  createdAt: now - 2_000,
  _creationTime: now - 2_000,
  metadata: {
    jobId: "job-1",
    sourceCvId: "cv-1",
  },
};

const savedProposal = {
  _id: "saved-1",
  title: "Product Engineer",
  content: "Saved body",
  status: "saved",
  updatedAt: now - 5_000,
  createdAt: now - 6_000,
  _creationTime: now - 6_000,
  metadata: {
    jobId: "job-2",
    sourceCvId: "cv-1",
  },
};

const sentProposal = {
  _id: "sent-1",
  title: "Senior Frontend Engineer",
  content: "Sent body",
  status: "sent",
  updatedAt: now - 10_000,
  createdAt: now - 11_000,
  _creationTime: now - 11_000,
  metadata: {
    jobId: "job-3",
    sourceCvId: "cv-1",
  },
};

const strongJob = {
  id: "job-strong",
  title: "Senior Frontend Engineer",
  company: "Linear",
  status: "active",
  matchTier: "strong",
  matchRead: { tier: "strong" },
  matchReview: { verdict: "strong_lead" },
  reviewState: "ready",
  linkedDocumentCount: 0,
  updatedAt: now - 20_000,
  importedAt: now - 21_000,
  lastActivityAt: now - 20_000,
};

const linkedDraftJob = {
  ...strongJob,
  id: "job-1",
  title: "Building Security Guard",
  company: "AM",
  linkedDocumentCount: 1,
};

const worthJob = {
  ...strongJob,
  id: "job-worth",
  title: "Product Engineer",
  company: "Stripe",
  matchTier: "partial",
  matchRead: { tier: "partial" },
  matchReview: { verdict: "possible_lead" },
  updatedAt: now - 30_000,
  importedAt: now - 31_000,
  lastActivityAt: now - 30_000,
};

const reviewJob = {
  ...strongJob,
  id: "job-review",
  title: "Staff Designer",
  company: "Vercel",
  matchTier: "unknown",
  matchRead: { tier: "unknown" },
  matchReview: { verdict: "not_enough_signal" },
  reviewState: "needs_review",
  linkedDocumentCount: 1,
  updatedAt: now - 40_000,
  importedAt: now - 41_000,
  lastActivityAt: now - 40_000,
};

function renderDashboard({
  proposals = [],
  jobs = [],
}: {
  proposals?: unknown[];
  jobs?: unknown[];
} = {}) {
  useQueryMock.mockImplementation((reference) => {
    if (reference === "proposalsPublic.default") return proposals;
    if (reference === "jobsPublic.listForUser") return jobs;
    return undefined;
  });

  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <>
              <DashboardPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/proposal" element={<LocationProbe />} />
        <Route path="/jobs" element={<LocationProbe />} />
        <Route path="/cv" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useQueryMock.mockReset();
  });

  it("renders the dashboard without mock metric values", () => {
    const { container } = renderDashboard();

    expect(screen.getByRole("heading", { name: /Dashboard/i })).toBeInTheDocument();
    const metricValues = [...container.querySelectorAll(".dash-stat__num")].map(
      (node) => node.textContent,
    );
    expect(metricValues).not.toContain("14");
    expect(metricValues).not.toContain("3");
    expect(metricValues).not.toContain("28");
    expect(screen.queryByText("Replies waiting")).not.toBeInTheDocument();
    expect(screen.queryByText(/Senior Frontend Engineer · Linear/)).not.toBeInTheDocument();
    expect(screen.getByText("No captured jobs yet.")).toBeInTheDocument();
  });

  it("routes Import CV to the CV Forge PDF picker", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Import CV" }));

    expect(screen.getByTestId("dashboard-location")).toHaveTextContent(
      "/cv?cvForgeAction=importCv::null",
    );
  });

  it("opens the latest existing proposal draft", () => {
    renderDashboard({ proposals: [savedProposal, draftProposal], jobs: [linkedDraftJob] });

    expect(screen.getByRole("heading", { name: "Continue draft." })).toBeInTheDocument();
    expect(screen.getByText("Building Security Guard · Letter draft")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open draft" })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole("button", { name: "Open draft" })[0]);

    expect(screen.getByTestId("dashboard-location")).toHaveTextContent(
      "/proposal?draftId=draft-1",
    );
  });

  it("shows missing job context in the draft subtitle when no linked job exists", () => {
    const missingJobDraft = {
      ...draftProposal,
      _id: "draft-without-job",
      metadata: { jobId: null, sourceCvId: "cv-1" },
    };

    renderDashboard({ proposals: [missingJobDraft] });

    expect(screen.getByRole("heading", { name: "Add job context." })).toBeInTheDocument();
    expect(screen.getByText("Letter draft · Missing job context")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open draft" })).toBeInTheDocument();
  });

  it("starts the proposal template quick-start flow when no draft exists", () => {
    renderDashboard({ proposals: [] });

    expect(screen.getByRole("heading", { name: "Write first proposal" })).toBeInTheDocument();
    expect(screen.getByText("Start with a job or blank letter.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Start proposal" })[0]);

    const locationText = screen.getByTestId("dashboard-location").textContent ?? "";
    expect(locationText).toContain("/proposal?templateId=minimal");
    expect(locationText).toContain("proposalWorkspaceResetToken");
  });

  it("links strong matches to the filtered Jobs view", () => {
    renderDashboard({ proposals: [], jobs: [strongJob] });

    expect(screen.getByText("Captured jobs ready to review.")).toBeInTheDocument();
    expect(screen.getByText("Review matches")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /1 strong match/i }));

    expect(screen.getByTestId("dashboard-location")).toHaveTextContent(
      "/jobs?match=worth_plus",
    );
  });

  it("renders secondary Quick actions without duplicating Open draft", () => {
    renderDashboard({ proposals: [draftProposal] });

    const quickActionsTitle = screen.getByText("Quick actions");
    const quickActions = quickActionsTitle.closest(".ds-card") as HTMLElement;

    expect(within(quickActions).getByRole("button", { name: "Import CV" })).toBeInTheDocument();
    expect(within(quickActions).getByRole("button", { name: "Review jobs" })).toBeInTheDocument();
    expect(within(quickActions).getByRole("button", { name: "New proposal" })).toBeInTheDocument();
    expect(within(quickActions).queryByRole("button", { name: "Open draft" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open draft" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Import CV" })).toHaveLength(1);
  });

  it("renders live metric and activity icons as decorative", () => {
    renderDashboard({
      proposals: [sentProposal],
      jobs: [strongJob],
    });

    expect(screen.queryByRole("button", { name: /Proposals sent \(30d\)/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 strong match/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Strong Senior Frontend Engineer/i }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThan(0);
  });

  it("shows captured jobs and caps Blocked to two items with View all", () => {
    const missingContextDraft = {
      ...draftProposal,
      _id: "draft-missing-context",
      title: "Draft missing context",
      updatedAt: now,
      metadata: { jobId: null, sourceCvId: null },
    };

    renderDashboard({
      proposals: [missingContextDraft],
      jobs: [strongJob, worthJob, reviewJob],
    });

    expect(screen.getByText("Captured jobs")).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(screen.getByText("Worth a shot")).toBeInTheDocument();
    expect(screen.queryByText("Worth review")).not.toBeInTheDocument();
    expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Review all jobs" })).toBeInTheDocument();

    const blockedTitle = screen
      .getAllByText("Blocked")
      .find((element) => element.classList.contains("ds-card__title")) as HTMLElement;
    const blockedSection = blockedTitle.closest(".ds-card") as HTMLElement;
    expect(
      within(blockedSection).getByText("4 need context. Start with these."),
    ).toBeInTheDocument();
    expect(blockedSection.querySelectorAll(".dash-row")).toHaveLength(2);
    expect(
      within(blockedSection).getByRole("button", { name: "Resolve next" }),
    ).toBeInTheDocument();
    expect(
      within(blockedSection)
        .getByRole("button", { name: "Resolve next" })
        .querySelector("svg[aria-hidden='true']"),
    ).toBeInTheDocument();
    expect(
      within(blockedSection).getByRole("button", { name: "View all" }),
    ).toBeInTheDocument();
  });
});
