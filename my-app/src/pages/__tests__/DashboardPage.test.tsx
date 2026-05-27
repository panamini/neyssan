import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { DashboardPage } from "../DashboardPage";

const useQueryMock = vi.fn();
const deleteProposalMock = vi.fn();
const loadCvMock = vi.fn(() => true);
const deleteCvMock = vi.fn();
const downloadLibraryItemsMock = vi.fn();

const cvLibraryState = {
  cvs: [] as any[],
  currentCv: null as any,
  currentCvId: null as string | null,
  loadCv: loadCvMock,
  deleteCv: deleteCvMock,
};

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
  useMutation: () => deleteProposalMock,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalsPublic: { default: "proposalsPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
    jobsPublic: { listForUser: "jobsPublic.listForUser" },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => cvLibraryState,
}));

vi.mock("../../lib/library-download", async () => {
  const actual = await vi.importActual<typeof import("../../lib/library-download")>(
    "../../lib/library-download",
  );
  return {
    ...actual,
    downloadLibraryItems: (...args: unknown[]) => downloadLibraryItemsMock(...args),
  };
});

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="dashboard-location">
      {`${location.pathname}${location.search}::${JSON.stringify(location.state ?? null)}`}
    </div>
  );
}

const now = Date.now();

const currentCv = {
  id: "cv-1",
  title: "Aurelien CV",
  metadata: {
    updatedAt: new Date(now - 3_000).toISOString(),
    createdAt: new Date(now - 10_000).toISOString(),
  },
  sections: [
    {
      id: "summary",
      title: "Profile",
      type: "summary",
      blocks: [],
      structuredContent: [{ summary: "Product engineer with proposal systems experience." }],
    },
  ],
};

const summaryOnlyCv = {
  id: "cv-summary",
  title: "Summary-only CV",
  metadata: {
    createdAt: new Date(now - 12_000).toISOString(),
    updatedAt: new Date(now - 4_000).toISOString(),
    version: 1,
    librarySummaryOnly: true,
  },
  sections: [
    {
      id: "profile-cv-summary",
      title: "Profile",
      type: "profile",
      blocks: [],
      structuredContent: [{ id: "profile-item", name: "Summary Only" }],
    },
  ],
};

const cachedFullCv = {
  ...summaryOnlyCv,
  title: "Hydrated Today CV",
  metadata: {
    createdAt: new Date(now - 12_000).toISOString(),
    updatedAt: new Date(now - 2_000).toISOString(),
    version: 1,
    verbatiStyle: {
      familyId: "workshop",
      typography: "geist-baskervville",
      palette: "sauge",
      resumeTemplateId: "workshop_resume_twocol_ats",
    },
  },
  sections: [
    {
      id: "summary",
      title: "Profile",
      type: "summary",
      blocks: [],
      structuredContent: [{ summary: "Hydrated Today resume summary." }],
    },
    {
      id: "experience",
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: [
        {
          role: "Hydrated Engineer",
          company: "Today Renderer Co",
          startDate: "2025",
          endDate: "Present",
          bullets: ["This Today line only exists in the full cached document."],
        },
      ],
    },
  ],
};

const draftProposal = {
  _id: "draft-1",
  title: "Building Security Guard",
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

const linkedDraftJob = {
  id: "job-1",
  title: "Building Security Guard",
  company: "AM",
  status: "active",
  matchTier: "strong",
  matchRead: { tier: "strong" },
  matchReview: { verdict: "strong_lead" },
  reviewState: "ready",
  linkedDocumentCount: 1,
  updatedAt: now - 20_000,
  importedAt: now - 21_000,
  lastActivityAt: now - 20_000,
};

function resetCvLibrary(overrides: Partial<typeof cvLibraryState> = {}) {
  cvLibraryState.cvs = [];
  cvLibraryState.currentCv = null;
  cvLibraryState.currentCvId = null;
  Object.assign(cvLibraryState, overrides);
}

function renderToday({
  proposals = [],
  jobs = [],
  initialEntry = "/dashboard",
}: {
  proposals?: unknown[];
  jobs?: unknown[];
  initialEntry?: string;
} = {}) {
  useQueryMock.mockImplementation((reference) => {
    if (reference === "proposalsPublic.default") return proposals;
    if (reference === "jobsPublic.listForUser") return jobs;
    return undefined;
  });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
        <Route path="/templates" element={<LocationProbe />} />
        <Route path="/documents" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function sectionByHeading(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  return heading.closest("section") as HTMLElement;
}

describe("DashboardPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useQueryMock.mockReset();
    loadCvMock.mockClear();
    deleteProposalMock.mockClear();
    deleteCvMock.mockClear();
    downloadLibraryItemsMock.mockClear();
    downloadLibraryItemsMock.mockResolvedValue({ downloaded: 1, skipped: 0 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    resetCvLibrary();
  });

  it("renders Today instead of the old Dashboard analytics page", () => {
    resetCvLibrary({ currentCv, currentCvId: "cv-1", cvs: [currentCv] });
    renderToday({ proposals: [draftProposal], jobs: [linkedDraftJob] });

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText("Proposals sent (30d)")).not.toBeInTheDocument();
    expect(screen.queryByText("Replies waiting")).not.toBeInTheDocument();
    expect(screen.queryByText(/strong matches/i)).not.toBeInTheDocument();
  });

  it("renders the work-resumption sections and create actions", () => {
    renderToday();

    expect(screen.getByRole("heading", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent work" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Context" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Needs review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Active applications" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Proposal work" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create" })).toBeInTheDocument();
    const createSection = sectionByHeading("Create");
    expect(within(createSection).getByRole("button", { name: /Import CV/ })).toBeInTheDocument();
    expect(within(createSection).getByRole("button", { name: /Add job/ })).toBeInTheDocument();
    expect(within(createSection).getByRole("button", { name: /New proposal/ })).toBeInTheDocument();
    expect(within(createSection).getByRole("button", { name: /Start from template/ })).toBeInTheDocument();
  });

  it("renders Today create actions in French without touching document language", () => {
    window.localStorage.setItem("twoweeks:ui-language", "fr");
    window.localStorage.setItem("twoweeks:document-language", "es");

    renderToday();

    const createSection = sectionByHeading("Créer");
    expect(
      within(createSection).getByRole("button", { name: "Importer le CV" }),
    ).toBeInTheDocument();
    expect(
      within(createSection).getByRole("button", { name: "Ajouter une offre" }),
    ).toBeInTheDocument();
    expect(
      within(createSection).getByRole("button", { name: "Nouvelle lettre" }),
    ).toBeInTheDocument();
    expect(
      within(createSection).getByRole("button", { name: "Partir d'un modèle" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Proposition|proposition/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("es");
  });

  it("renders Today create actions in Spanish and keeps routing behavior", () => {
    window.localStorage.setItem("twoweeks:ui-language", "es");
    window.localStorage.setItem("twoweeks:document-language", "fr");

    renderToday();

    const createSection = sectionByHeading("Crear");
    expect(
      within(createSection).getByRole("button", { name: "Importar CV" }),
    ).toBeInTheDocument();
    expect(
      within(createSection).getByRole("button", { name: "Agregar empleo" }),
    ).toBeInTheDocument();
    expect(
      within(createSection).getByRole("button", { name: "Nueva carta" }),
    ).toBeInTheDocument();
    expect(
      within(createSection).getByRole("button", { name: "Usar plantilla" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Propuesta|propuesta/)).not.toBeInTheDocument();

    fireEvent.click(within(createSection).getByRole("button", { name: "Usar plantilla" }));

    expect(screen.getByTestId("dashboard-location")).toHaveTextContent("/templates::null");
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("fr");
  });

  it("shows real recent work from proposals and CV library data", () => {
    resetCvLibrary({ currentCv, currentCvId: "cv-1", cvs: [currentCv] });
    renderToday({ proposals: [sentProposal, savedProposal, draftProposal], jobs: [linkedDraftJob] });

    const recentTitle = screen.getByRole("heading", { name: "Recent work" });
    const recentSection = recentTitle.closest("section") as HTMLElement;
    expect(within(recentSection).queryByText("Building Security Guard")).not.toBeInTheDocument();
    expect(within(recentSection).queryByText("Product Engineer")).not.toBeInTheDocument();
    expect(within(recentSection).queryByText("Aurelien CV")).not.toBeInTheDocument();
    expect(within(recentSection).getAllByText("Senior Frontend Engineer").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".today-preview-card").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".today-preview-card__type").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".work-doc-preview").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".work-doc-preview--rendered").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".work-doc-preview--resume-rendered").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("resume-template-renderer").length).toBeGreaterThan(0);
    expect(document.querySelector(".work-doc-preview--cv-crop")).not.toBeInTheDocument();
    expect(document.querySelector(".today-continue-card")).not.toBeInTheDocument();
  });

  it("hydrates summary-only CVs from the full cached CV before rendering Today previews", () => {
    resetCvLibrary({
      currentCv: null,
      currentCvId: "cv-summary",
      cvs: [summaryOnlyCv],
    });
    window.localStorage.setItem("cv:cv-summary", JSON.stringify(cachedFullCv));

    renderToday();

    expect(screen.getAllByText("Hydrated Today CV").length).toBeGreaterThan(0);
    expect(screen.getByText("Hydrated Today resume summary.")).toBeInTheDocument();
    expect(screen.queryByText("Summary Only")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".work-doc-preview--resume-rendered").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("resume-template-renderer").length).toBeGreaterThan(0);
  });

  it("does not render fake recent work when no data exists", () => {
    renderToday();

    expect(screen.getByText("NO WORK YET.")).toBeInTheDocument();
    expect(screen.queryByText(/Staff Designer · Vercel/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Senior Frontend Engineer · Linear/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Elena Marlowe/)).not.toBeInTheDocument();
  });

  it("routes Import CV through the existing CV import action", () => {
    renderToday();

    fireEvent.click(screen.getAllByRole("button", { name: /Import CV/ })[0]);

    expect(screen.getByTestId("dashboard-location")).toHaveTextContent(
      "/cv?cvForgeAction=importCv::null",
    );
  });

  it("routes New proposal through the proposal reset flow", () => {
    renderToday();

    fireEvent.click(
      within(sectionByHeading("Create")).getByRole("button", {
        name: /New proposal/,
      }),
    );

    const locationText = screen.getByTestId("dashboard-location").textContent ?? "";
    expect(locationText).toContain("/proposal::");
    expect(locationText).toContain("proposalWorkspaceResetToken");
  });

  it("routes Start from template to the global templates page", () => {
    renderToday();

    fireEvent.click(screen.getByRole("button", { name: /Start from template/ }));

    expect(screen.getByTestId("dashboard-location")).toHaveTextContent("/templates::null");
  });

  it("opens the current proposal draft from Continue", () => {
    resetCvLibrary({ currentCv, currentCvId: "cv-1", cvs: [currentCv] });
    renderToday({ proposals: [savedProposal, draftProposal], jobs: [linkedDraftJob] });

    const continueTitle = screen.getByRole("heading", { name: "Continue" });
    const continueSection = continueTitle.closest("section") as HTMLElement;
    const draftTitle = within(continueSection).getAllByText("Building Security Guard").at(-1)!;
    expect(draftTitle).toBeInTheDocument();
    expect(within(continueSection).getAllByText("Draft body").length).toBeGreaterThan(0);
    fireEvent.click(draftTitle.closest("button") as HTMLButtonElement);

    expect(screen.getByTestId("dashboard-location")).toHaveTextContent(
      "/proposal?draftId=draft-1::null",
    );
  });

  it("deletes supported proposal and CV items from secondary menus", async () => {
    resetCvLibrary({ currentCv, currentCvId: "cv-1", cvs: [currentCv] });
    renderToday({ proposals: [draftProposal] });

    fireEvent.click(
      screen.getByRole("button", { name: "More actions for Building Security Guard" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(deleteProposalMock).toHaveBeenCalledWith({ id: "draft-1" });

    fireEvent.click(
      screen.getByRole("button", { name: "More actions for Aurelien CV" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(deleteCvMock).toHaveBeenCalledWith("cv-1");
  });

  it("downloads supported proposal and CV items from secondary menus", async () => {
    resetCvLibrary({ currentCv, currentCvId: "cv-1", cvs: [currentCv] });
    renderToday({ proposals: [draftProposal] });

    fireEvent.click(
      screen.getByRole("button", { name: "More actions for Building Security Guard" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Download PDF" }));
    expect(downloadLibraryItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: "proposal:draft-1", type: "proposal" }),
    ]);

    downloadLibraryItemsMock.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "More actions for Aurelien CV" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Download PDF" }));
    expect(downloadLibraryItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: "cv:cv-1", type: "cv" }),
    ]);
  });
});
