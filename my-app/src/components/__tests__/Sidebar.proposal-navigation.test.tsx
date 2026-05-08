import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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
  createNewCv: vi.fn(async () => {}),
  deleteCv: vi.fn(),
};

const mockAuthState = {
  isSignedIn: true,
};

let mockThemeMode: "light" | "dark" = "light";

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
    isSignedIn: mockAuthState.isSignedIn,
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

vi.mock("../../lib/theme-mode", () => ({
  useThemeMode: () => ({
    mode: mockThemeMode,
    toggle: vi.fn(),
  }),
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

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="sidebar-location">
      {`${location.pathname}${location.search}::${JSON.stringify(location.state ?? null)}`}
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

function pinSidebar(): void {
  const openButton = screen.queryByRole("button", { name: "Open sidebar" });
  if (openButton) {
    fireEvent.click(openButton);
  }
  const pinButton = screen.queryByRole("button", { name: "Open sidebar" });
  if (pinButton) {
    fireEvent.click(pinButton);
  }
}

describe("Sidebar proposal navigation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setViewportWidth(1280);
    mockThemeMode = "light";
    mockCvLibraryState.cvs = [];
    mockCvLibraryState.currentCv = null;
    mockCvLibraryState.currentCvId = null;
    mockCvLibraryState.loadCv.mockReset();
    mockCvLibraryState.createNewCv.mockReset();
    mockCvLibraryState.deleteCv.mockReset();
    mockAuthState.isSignedIn = true;
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

    fireEvent.click(screen.getByRole("link", { name: "Proposal forge" }));

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

  it("renders the settings trigger in the sidebar footer", () => {
    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("does not render the footer theme toggle on the settings route", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Sidebar />
        <Routes>
          <Route path="/settings" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", {
        name: /dark mode|light mode|toggle dark theme|toggle light theme/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("does not render authenticated recents when signed out", () => {
    mockAuthState.isSignedIn = false;

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
          <Route path="/sign-in" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    pinSidebar();

    expect(screen.getByText("Saved proposal beta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("shows the sidebar brand label only when hovered or pinned open", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const toggle = screen.getByRole("button", { name: "Open sidebar" });
    const lightCollapsedLogo = toggle.querySelector(
      ".sb-toggle__collapsed-logo",
    ) as HTMLImageElement | null;
    const lightCollapsedLogoShell = toggle.querySelector(
      ".sb-toggle__collapsed-logo-shell",
    ) as HTMLSpanElement | null;
    expect(lightCollapsedLogoShell).not.toBeNull();
    expect(lightCollapsedLogo).not.toBeNull();
    expect(lightCollapsedLogo?.getAttribute("src")).toContain(
      "two-weeks-logo.png",
    );
    expect(lightCollapsedLogo).not.toHaveClass("sb-toggle__collapsed-logo--dark");
    expect(screen.queryByText("two weeks")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    const expandedToggle = screen.getByRole("button", { name: "Close sidebar" });
    expect(expandedToggle).toHaveClass("sb-toggle--labeled");
    expect(expandedToggle).toHaveTextContent("two weeks.");
    expect(screen.getByText("two weeks")).toHaveClass("sb-toggle__label");

    unmount();
    setViewportWidth(640);
    mockThemeMode = "dark";
    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const collapsedToggle = screen.getByRole("button", {
      name: "Open sidebar",
    });
    const darkCollapsedLogo = collapsedToggle.querySelector(
      ".sb-toggle__collapsed-logo",
    ) as HTMLImageElement | null;
    const darkCollapsedLogoShell = collapsedToggle.querySelector(
      ".sb-toggle__collapsed-logo-shell",
    ) as HTMLSpanElement | null;
    expect(darkCollapsedLogoShell).not.toBeNull();
    expect(darkCollapsedLogo).not.toBeNull();
    expect(darkCollapsedLogo?.getAttribute("src")).toContain(
      "two-weeks-logo.png",
    );
    expect(darkCollapsedLogo).toHaveClass("sb-toggle__collapsed-logo--dark");
    expect(collapsedToggle.querySelector("svg")).toBeNull();
    expect(screen.queryByText("two weeks")).not.toBeInTheDocument();
  });

  it("keeps expanded sidebar content mounted until the unpin collapse animation completes", () => {
    vi.useFakeTimers();

    try {
      const { container } = render(
        <MemoryRouter initialEntries={["/cv"]}>
          <Sidebar />
          <Routes>
            <Route path="/cv" element={<CvRoute />} />
            <Route path="/proposal" element={<ProposalRouteProbe />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(container.querySelector(".sb__nav--stack")).toBeNull();
      expect(container.querySelector(".sb__nav--rail")).not.toBeNull();

      pinSidebar();

      expect(container.querySelector(".sb__nav--stack")).not.toBeNull();
      expect(container.querySelector(".sb__nav--rail")).toBeNull();

      fireEvent.click(screen.getAllByRole("button", { name: "Close sidebar" })[0]);

      expect(container.querySelector(".sb--collapsed")).not.toBeNull();
      expect(container.querySelector(".sb__nav--stack")).toBeNull();
      expect(container.querySelector(".sb__nav--rail")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders a top-level Jobs navigation entry", () => {
    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
          <Route path="/jobs" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    pinSidebar();

    expect(screen.getByRole("link", { name: /Jobs/ })).toHaveClass(
      "sb-section__action",
    );
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText(/Onboarding \(preview\)/i)).not.toBeInTheDocument();
  });

  it("fully removes the sidebar from layout on very narrow mobile widths", () => {
    setViewportWidth(440);

    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(container.querySelector("aside.sb")).toBeNull();
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

    pinSidebar();
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

  it("does not ship the static skeleton onboarding preview link", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    pinSidebar();

    expect(screen.queryByText("Onboarding (preview)")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Replay onboarding" }),
    ).not.toBeInTheDocument();
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

    pinSidebar();

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

    pinSidebar();

    expect(screen.getByText("Saved proposal beta").closest("a")).toHaveAttribute(
      "href",
      "/proposal?view=saved&id=proposal_saved",
    );
  });

  it("keeps recents focused on saved proposal rows", () => {
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

    pinSidebar();

    expect(screen.queryByText("Server draft proposal")).not.toBeInTheDocument();
    expect(screen.getByText("Saved proposal beta").closest("a")).toHaveAttribute(
      "href",
      "/proposal?view=saved&id=proposal_saved",
    );
  });

  it("shows the just-saved proposal in the saved list immediately when the saved route opens", () => {
    writeProposalDraftToStorage();

    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_new"]}>
        <Sidebar />
        <Routes>
          <Route path="/cv" element={<CvRoute />} />
          <Route path="/proposal" element={<ProposalRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    pinSidebar();

    expect(screen.queryByText("Operations Associate Proposal")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Proposal forge/ })).toHaveAttribute(
      "href",
      "/proposal?view=saved&id=proposal_new",
    );
  });

  it("uses in-place active rows instead of a separate Current section", () => {
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

    pinSidebar();

    expect(screen.queryByText("Current")).not.toBeInTheDocument();
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(
      screen.getByText("Operations Associate Proposal").closest("a"),
    ).toHaveAttribute("aria-current", "page");
  });
});
