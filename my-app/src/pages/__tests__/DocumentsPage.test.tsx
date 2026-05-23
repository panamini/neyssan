import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentsPage } from "../DocumentsPage";

const navigateMock = vi.fn();
const deleteProposalMock = vi.fn();
const loadCvMock = vi.fn(() => true);
const deleteCvMock = vi.fn();
const proposalsMock = vi.fn();
const cvsMock = vi.fn();
const clearStoredProposalWorkspaceStateMock = vi.fn();
const startFreshProposalWorkspaceMock = vi.fn();
const downloadLibraryItemsMock = vi.fn();

let localComposeDraft: any = {
  jobTitle: "Draft product designer",
  jobDescription: "Draft job context.",
};
let localOutputDraft: any = null;
let currentCvId: string | null = "cv_1";

const { api } = vi.hoisted(() => ({
  api: {
    proposalsPublic: { default: {} },
    deleteProposalPublic: { default: {} },
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("convex/react", () => ({
  useQuery: () => proposalsMock(),
  useMutation: () => deleteProposalMock,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

vi.mock("../../../convex/_generated/api", () => ({ api }));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    cvs: cvsMock(),
    currentCvId,
    loadCv: loadCvMock,
    deleteCv: deleteCvMock,
  }),
}));

vi.mock("../../lib/proposal-workspace-state", () => ({
  clearStoredProposalWorkspaceState: () => clearStoredProposalWorkspaceStateMock(),
  createProposalWorkspaceResetState: () => ({ reset: true }),
  readStoredProposalComposeDraft: () => localComposeDraft,
  startFreshProposalWorkspace: () => startFreshProposalWorkspaceMock(),
}));

vi.mock("../../lib/proposal-output-draft", () => ({
  readStoredProposalOutputDraft: () => localOutputDraft,
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

const savedProposal = {
  _id: "proposal_1",
  _creationTime: Date.now() - 4_000,
  updatedAt: Date.now() - 4_000,
  title: "Senior Frontend Engineer · Linear",
  content: "Saved cover letter body.",
  status: "saved",
  metadata: {
    sourceJobTitle: "Senior Frontend Engineer",
    sourceJobDescription: "Build product surfaces.",
    sourceCvId: "cv_1",
  },
};

const draftProposal = {
  _id: "draft_1",
  _creationTime: Date.now() - 8_000,
  updatedAt: Date.now() - 8_000,
  title: "Staff Designer draft",
  content: "Draft proposal body.",
  status: "draft",
  metadata: {
    sourceJobTitle: "Staff Designer",
    sourceJobDescription: "Design product systems.",
  },
};

const cvRecord = {
  id: "cv_1",
  title: "Frontend Engineer · Editorial v3",
  metadata: { updatedAt: "2026-05-01T12:00:00.000Z" },
  sections: [
    {
      id: "summary",
      title: "Profile",
      type: "summary",
      blocks: [],
      structuredContent: [{ summary: "Frontend engineer focused on editorial systems." }],
    },
    {
      id: "experience",
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: [
        {
          role: "Frontend Engineer",
          company: "Two Weeks",
          startDate: "2024",
          endDate: "Present",
          bullets: ["Built proposal and CV surfaces."],
        },
      ],
    },
  ],
};

const summaryOnlyCvRecord = {
  id: "cv_summary",
  title: "Summary-only CV",
  metadata: {
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
    version: 1,
    librarySummaryOnly: true,
  },
  sections: [
    {
      id: "profile-cv_summary",
      title: "Profile",
      type: "profile",
      blocks: [],
      structuredContent: [{ id: "profile-item", name: "Summary Only" }],
    },
  ],
};

const fullCachedCvRecord = {
  ...summaryOnlyCvRecord,
  title: "Hydrated CV",
  metadata: {
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-02T12:00:00.000Z",
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
      structuredContent: [{ summary: "Hydrated full resume summary." }],
    },
    {
      id: "experience",
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: [
        {
          role: "Hydrated Engineer",
          company: "Real Renderer Co",
          startDate: "2024",
          endDate: "Present",
          bullets: ["This line only exists in the full cached document."],
        },
      ],
    },
  ],
};

function renderProjects() {
  return render(
    <MemoryRouter initialEntries={["/documents"]}>
      <DocumentsPage />
    </MemoryRouter>,
  );
}

function typeTabs(): HTMLElement {
  return screen.getByRole("tablist", { name: "Type" });
}

function viewTabs(): HTMLElement {
  return screen.getByRole("tablist", { name: "View" });
}

describe("DocumentsPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    navigateMock.mockClear();
    deleteProposalMock.mockClear();
    loadCvMock.mockClear();
    loadCvMock.mockReturnValue(true);
    deleteCvMock.mockClear();
    downloadLibraryItemsMock.mockClear();
    downloadLibraryItemsMock.mockResolvedValue({ downloaded: 1, skipped: 0 });
    clearStoredProposalWorkspaceStateMock.mockClear();
    startFreshProposalWorkspaceMock.mockClear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    localComposeDraft = {
      jobTitle: "Draft product designer",
      jobDescription: "Draft job context.",
    };
    localOutputDraft = null;
    currentCvId = "cv_1";
    proposalsMock.mockReturnValue([savedProposal, draftProposal]);
    cvsMock.mockReturnValue([cvRecord]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders Projects identity on the /documents route", () => {
    renderProjects();

    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Documents" })).not.toBeInTheDocument();
    expect(screen.getByText("Jobs, CVs, and proposals in one place.")).toBeInTheDocument();
  });

  it("does not render Applications or Drafts as primary filters", () => {
    renderProjects();

    expect(within(typeTabs()).getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(within(typeTabs()).getByRole("tab", { name: "CVs" })).toBeInTheDocument();
    expect(within(typeTabs()).getByRole("tab", { name: "Proposals" })).toBeInTheDocument();
    expect(within(typeTabs()).queryByRole("tab", { name: "Applications" })).not.toBeInTheDocument();
    expect(within(typeTabs()).queryByRole("tab", { name: "Drafts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: /Status/i })).not.toBeInTheDocument();
  });

  it("renders real CV and proposal work without Application cards", () => {
    renderProjects();

    expect(screen.getByRole("heading", { name: "Recent work" })).toBeInTheDocument();
    expect(screen.getAllByText("Senior Frontend Engineer · Linear").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Staff Designer draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Frontend Engineer · Editorial v3").length).toBeGreaterThan(0);
    expect(screen.queryByText("Application")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".projects-card").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".library-doc-preview").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".library-doc-preview--rendered").length).toBeGreaterThan(0);
    expect(document.querySelector(".forge-rail-document-tile")).not.toBeInTheDocument();
    expect(document.querySelector(".forge-rail-drawer")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".dasti-proposal-document").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".library-doc-preview--resume-rendered").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("resume-template-renderer").length).toBeGreaterThan(0);
    expect(document.querySelector(".library-doc-preview--cv-crop")).not.toBeInTheDocument();
  });

  it("keeps offscreen grid cards lightweight instead of mounting every preview", () => {
    proposalsMock.mockReturnValue([]);
    cvsMock.mockReturnValue(
      Array.from({ length: 8 }, (_, index) => ({
        ...cvRecord,
        id: `cv_${index + 1}`,
        title: `Frontend Engineer · Editorial v${index + 1}`,
      })),
    );

    renderProjects();

    expect(document.querySelectorAll(".projects-card")).toHaveLength(8);
    expect(document.querySelectorAll(".library-doc-preview--deferred")).toHaveLength(4);
    expect(screen.queryAllByTestId("resume-template-renderer")).toHaveLength(4);
  });

  it("loads visible grid previews in batches of four", () => {
    vi.useFakeTimers();
    const observerCallbacks: IntersectionObserverCallback[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((callback: IntersectionObserverCallback) => {
        observerCallbacks.push(callback);
        return {
          observe: vi.fn(),
          disconnect: vi.fn(),
          unobserve: vi.fn(),
          takeRecords: vi.fn(() => []),
        };
      }),
    );
    proposalsMock.mockReturnValue([]);
    cvsMock.mockReturnValue(
      Array.from({ length: 12 }, (_, index) => ({
        ...cvRecord,
        id: `cv_${index + 1}`,
        title: `Frontend Engineer · Editorial v${index + 1}`,
      })),
    );

    renderProjects();

    expect(screen.queryAllByTestId("resume-template-renderer")).toHaveLength(4);
    act(() => {
      observerCallbacks.forEach((callback) => {
        callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
    });
    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(screen.queryAllByTestId("resume-template-renderer")).toHaveLength(8);
    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(screen.queryAllByTestId("resume-template-renderer")).toHaveLength(12);
    vi.useRealTimers();
  });

  it("hydrates summary-only CVs from the full cached CV before rendering previews", () => {
    currentCvId = "cv_summary";
    cvsMock.mockReturnValue([summaryOnlyCvRecord]);
    proposalsMock.mockReturnValue([]);
    window.localStorage.setItem("cv:cv_summary", JSON.stringify(fullCachedCvRecord));

    renderProjects();

    expect(screen.getAllByText("Hydrated CV").length).toBeGreaterThan(0);
    expect(screen.getByText("Hydrated full resume summary.")).toBeInTheDocument();
    expect(screen.queryByText("Summary Only")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".library-doc-preview--resume-rendered").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("resume-template-renderer").length).toBeGreaterThan(0);
  });

  it("supports grid selection, download, and the floating bulk action bar", async () => {
    const user = userEvent.setup();
    renderProjects();

    const checkbox = screen.getByLabelText("Select proposal Senior Frontend Engineer · Linear");
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(checkbox.closest(".projects-card")).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("status", { name: "1 item selected" })).toBeInTheDocument();
    expect(screen.getByText("1 item selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(downloadLibraryItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "proposal:proposal_1",
        type: "proposal",
        title: "Senior Frontend Engineer · Linear",
      }),
    ], expect.any(Object));

    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByRole("status", { name: /item selected/ })).not.toBeInTheDocument();
  });

  it("bulk download passes multiple selected items for ZIP download", async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.click(screen.getByLabelText("Select proposal Senior Frontend Engineer · Linear"));
    await user.click(screen.getByLabelText("Select cv Frontend Engineer · Editorial v3"));
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(downloadLibraryItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: "proposal:proposal_1", type: "proposal" }),
      expect.objectContaining({ id: "cv:cv_1", type: "cv" }),
    ], expect.any(Object));
  });

  it("card menu Download PDF works for CV and proposal items", async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.click(
      screen.getByRole("button", {
        name: "More actions for Senior Frontend Engineer · Linear",
      }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Download PDF" }));
    expect(downloadLibraryItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: "proposal:proposal_1", type: "proposal" }),
    ], expect.any(Object));

    downloadLibraryItemsMock.mockClear();
    await user.click(
      screen.getByRole("button", {
        name: "More actions for Frontend Engineer · Editorial v3",
      }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Download PDF" }));
    expect(downloadLibraryItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: "cv:cv_1", type: "cv" }),
    ], expect.any(Object));
  });

  it("bulk delete confirms and deletes selected supported items", async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.click(screen.getByLabelText("Select proposal Senior Frontend Engineer · Linear"));
    await user.click(screen.getByLabelText("Select cv Frontend Engineer · Editorial v3"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(window.confirm).toHaveBeenCalledWith("Delete 2 selected items?");
    expect(deleteProposalMock).toHaveBeenCalledWith({ id: "proposal_1" });
    expect(deleteCvMock).toHaveBeenCalledWith("cv_1");
    expect(screen.queryByRole("status", { name: /item selected/ })).not.toBeInTheDocument();
  });

  it("type filter CVs shows CVs only", async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.click(within(typeTabs()).getByRole("tab", { name: "CVs" }));

    expect(screen.getAllByText("Frontend Engineer · Editorial v3").length).toBeGreaterThan(0);
    expect(screen.queryByText("Senior Frontend Engineer · Linear")).not.toBeInTheDocument();
    expect(screen.queryByText("Staff Designer draft")).not.toBeInTheDocument();
  });

  it("type filter Proposals shows saved, draft, and local generated proposals", async () => {
    const user = userEvent.setup();
    localOutputDraft = {
      proposalDocumentTitle: "Local generated proposal",
      proposalContent: "Local proposal text.",
      sourceComposeDraft: {
        jobTitle: "Security Officer",
        jobDescription: "Guard building access.",
      },
    };
    renderProjects();

    await user.click(within(typeTabs()).getByRole("tab", { name: "Proposals" }));

    expect(screen.getAllByText("Senior Frontend Engineer · Linear").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Staff Designer draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Local generated proposal").length).toBeGreaterThan(0);
    expect(screen.queryByText("Frontend Engineer · Editorial v3")).not.toBeInTheDocument();
  });

  it("does not show compose-only job context as a proposal", async () => {
    const user = userEvent.setup();
    proposalsMock.mockReturnValue([]);
    cvsMock.mockReturnValue([]);
    localOutputDraft = null;
    localComposeDraft = {
      jobTitle: "Draft product designer",
      jobDescription: "Draft job context.",
    };
    renderProjects();

    await user.click(within(typeTabs()).getByRole("tab", { name: "Proposals" }));

    expect(screen.queryByText("Draft product designer")).not.toBeInTheDocument();
    expect(screen.getByText("NO WORK YET.")).toBeInTheDocument();
  });

  it("shows factual proposal job and CV context", async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.click(within(typeTabs()).getByRole("tab", { name: "Proposals" }));

    expect(screen.getAllByText("Job linked · CV: Frontend Engineer · Editorial v3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Job linked · No CV linked").length).toBeGreaterThan(0);
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByText("Drafting")).not.toBeInTheDocument();
  });

  it("search matches visible context and text", async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.type(screen.getByLabelText("Search projects"), "editorial");
    expect(screen.getAllByText("Frontend Engineer · Editorial v3").length).toBeGreaterThan(0);
    expect(screen.queryByText("Staff Designer draft")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search projects"));
    await user.type(screen.getByLabelText("Search projects"), "no cv linked");
    expect(screen.getAllByText("Staff Designer draft").length).toBeGreaterThan(0);
    expect(screen.queryByText("Frontend Engineer · Editorial v3")).not.toBeInTheDocument();
  });

  it("list view renders rows with expected columns", async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.click(within(viewTabs()).getByRole("tab", { name: /List/ }));

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Context" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Updated" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Action" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Projects list" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "More actions for Senior Frontend Engineer · Linear",
      }),
    ).toBeInTheDocument();
  });

  it("list view supports row selection", async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.click(within(viewTabs()).getByRole("tab", { name: /List/ }));
    const checkbox = screen.getByLabelText("Select proposal Staff Designer draft");
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(checkbox.closest(".projects-list__row")).toHaveAttribute("data-selected", "true");
    expect(screen.getByText("1 item selected")).toBeInTheDocument();
  });

  it("opens CVs and proposals through existing routes", async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.click(within(typeTabs()).getByRole("tab", { name: "CVs" }));
    await user.click(screen.getAllByText("Frontend Engineer · Editorial v3").at(-1)!);
    expect(loadCvMock).toHaveBeenCalledWith("cv_1");
    expect(navigateMock).toHaveBeenCalledWith("/cv?id=cv_1");

    navigateMock.mockClear();
    await user.click(within(typeTabs()).getByRole("tab", { name: "Proposals" }));
    await user.click(screen.getAllByText("Staff Designer draft").at(-1)!);
    expect(navigateMock).toHaveBeenCalledWith("/proposal?draftId=draft_1");

    navigateMock.mockClear();
    await user.click(screen.getAllByText("Senior Frontend Engineer · Linear").at(-1)!);
    expect(navigateMock).toHaveBeenCalledWith("/proposal?view=saved&id=proposal_1");
  });

  it("delete actions call existing proposal, CV, and local clear handlers", async () => {
    const user = userEvent.setup();
    localOutputDraft = {
      proposalDocumentTitle: "Local generated proposal",
      proposalContent: "Local proposal text.",
    };
    renderProjects();

    await user.click(within(typeTabs()).getByRole("tab", { name: "Proposals" }));
    await user.click(
      screen.getByRole("button", {
        name: "More actions for Senior Frontend Engineer · Linear",
      }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(deleteProposalMock).toHaveBeenCalledWith({ id: "proposal_1" });

    await user.click(
      screen.getByRole("button", {
        name: "More actions for Local generated proposal",
      }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(clearStoredProposalWorkspaceStateMock).toHaveBeenCalled();

    await user.click(within(typeTabs()).getByRole("tab", { name: "CVs" }));
    await user.click(
      screen.getByRole("button", {
        name: "More actions for Frontend Engineer · Editorial v3",
      }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(deleteCvMock).toHaveBeenCalledWith("cv_1");
  });
});
