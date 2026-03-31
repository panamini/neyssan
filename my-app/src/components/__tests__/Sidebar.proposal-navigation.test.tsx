import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Sidebar } from "../Sidebar";
import {
  PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
  readStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";
import {
  PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
  readStoredProposalComposeDraft,
} from "../../lib/proposal-workspace-state";
import { PROPOSAL_ATTACHED_CV_STORAGE_KEY } from "../../lib/proposal-personalization";

const mockCvLibraryState = {
  cvs: [] as Array<{ id: string; title: string; sections: unknown[] }>,
  currentCv: null as { id: string; title: string; sections: unknown[] } | null,
  currentCvId: null as string | null,
  loadCv: vi.fn(),
  createNewCv: vi.fn(),
  deleteCv: vi.fn(),
};

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (reference: string) => {
    if (reference === "proposalsPublic.default") {
      return [
        {
          _id: "proposal_draft",
          _creationTime: 1711000000000,
          title: "Server draft proposal",
          updatedAt: 1711000000000,
          status: "draft",
        },
        {
          _id: "proposal_saved",
          _creationTime: 1710000000000,
          title: "Saved proposal beta",
          updatedAt: 1710000000000,
          status: "saved",
        },
      ];
    }
    if (reference === "proposalsCountPublic.default") {
      return 1;
    }
    return null;
  },
  useMutation: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalsPublic: { default: "proposalsPublic.default" },
    proposalsCountPublic: { default: "proposalsCountPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
  }),
  useUser: () => ({
    user: {
      firstName: "Pana",
      username: "pana",
    },
  }),
  UserButton: () => <div data-testid="user-button" />,
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => mockCvLibraryState,
}));

function CvRoute(): JSX.Element {
  return <div>Resume workspace</div>;
}

function ProposalRouteProbe(): JSX.Element {
  const composeDraft = readStoredProposalComposeDraft();
  const outputDraft = readStoredProposalOutputDraft();

  return (
    <div>
      <div data-testid="proposal-compose-title">
        {composeDraft?.jobTitle ?? "empty-title"}
      </div>
      <div data-testid="proposal-compose-description">
        {composeDraft?.jobDescription ?? "empty-description"}
      </div>
      <div data-testid="proposal-output-content">
        {outputDraft?.proposalContent ?? "empty-output"}
      </div>
    </div>
  );
}

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

function writeProposalDraftToStorage(): void {
  window.localStorage.setItem(
    PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
    JSON.stringify({
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes and coordinate communication.",
      proposalType: "cover_letter",
      voicePreset: "signature",
    }),
  );
  window.localStorage.setItem(
    PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
    JSON.stringify({
      proposalContent: "Freshly generated proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Operations Associate Proposal",
      proposalDocumentMeta: "Cover letter · Signature",
      generatedProposalId: "proposal_new",
      proposalOutputMode: "edit",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: null,
      characterLimitValue: null,
    }),
  );
}

describe("Sidebar proposal navigation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setViewportWidth(1280);
    mockCvLibraryState.cvs = [];
    mockCvLibraryState.currentCv = null;
    mockCvLibraryState.currentCvId = null;
    mockCvLibraryState.loadCv.mockReset();
    mockCvLibraryState.createNewCv.mockReset();
    mockCvLibraryState.deleteCv.mockReset();
  });

  it("does not clear stored proposal draft when the collapsed proposals control re-enters the workspace", () => {
    setViewportWidth(640);
    window.localStorage.setItem("cvActiveId", "cv_beta");
    window.localStorage.setItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY, "cv_alpha");

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    writeProposalDraftToStorage();

    fireEvent.click(screen.getByRole("link", { name: "Proposals" }));

    expect(screen.getByTestId("proposal-compose-title")).toHaveTextContent(
      "Operations Associate",
    );
    expect(
      screen.getByTestId("proposal-compose-description"),
    ).toHaveTextContent(
      "Support recurring processes and coordinate communication.",
    );
    expect(screen.getByTestId("proposal-output-content")).toHaveTextContent(
      "Freshly generated proposal body.",
    );
    expect(window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY)).toBe(
      "cv_alpha",
    );
    expect(window.localStorage.getItem("cvActiveId")).toBe("cv_beta");
  });

  it("refreshes proposal workspace draft state when the window regains focus", async () => {
    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.queryByText("Operations Associate Proposal"),
    ).not.toBeInTheDocument();

    writeProposalDraftToStorage();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Operations Associate Proposal"),
      ).toBeInTheDocument();
    });
  });

  it("keeps the resume workspace item visible from currentCvId while proposal stays active", () => {
    mockCvLibraryState.cvs = [
      {
        id: "cv_alpha",
        title: "Alex Martin Resume",
        sections: [],
      },
    ];
    mockCvLibraryState.currentCvId = "cv_alpha";
    writeProposalDraftToStorage();

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Operations Associate Proposal")).toBeInTheDocument();
    expect(screen.getByText("Alex Martin Resume")).toBeInTheDocument();
  });

  it("uses the canonical saved proposal href in the sidebar list", () => {
    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Saved proposal beta").closest("a")).toHaveAttribute(
      "href",
      "/proposal?view=saved&id=proposal_saved",
    );
  });

  it("keeps draft proposals out of the saved proposal list", () => {
    writeProposalDraftToStorage();

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Operations Associate Proposal")).toBeInTheDocument();
    expect(screen.getByText("Saved proposal beta")).toBeInTheDocument();
    expect(screen.queryByText("Server draft proposal")).not.toBeInTheDocument();
  });

  it("shows the just-saved proposal in the saved list immediately when the saved route opens", () => {
    writeProposalDraftToStorage();

    const { container } = render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_new"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const savedLink = container.querySelector(
      'a[href="/proposal?view=saved&id=proposal_new"]',
    );

    expect(savedLink).not.toBeNull();
    expect(savedLink).toHaveTextContent("Operations Associate Proposal");
  });

  it("labels the active editing section as Current", () => {
    mockCvLibraryState.currentCv = {
      id: "cv_alpha",
      title: "Alex Martin Resume",
      sections: [],
    };
    mockCvLibraryState.currentCvId = "cv_alpha";
    writeProposalDraftToStorage();

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("Proposal")).toBeInTheDocument();
    expect(screen.getByText("Resume")).toBeInTheDocument();
  });
});
