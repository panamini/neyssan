import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { createQuickStartLocationState } from "../lib/quick-start-routing";

const {
  importCvMock,
  createNewCvMock,
  importFileMock,
  cvLibraryState,
} = vi.hoisted(() => ({
  importCvMock: vi.fn(),
  createNewCvMock: vi.fn(),
  importFileMock: vi.fn(),
  cvLibraryState: {
    currentCvId: null as string | null,
  },
}));

vi.mock("convex/react", () => ({
  Unauthenticated: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: false,
  }),
  useQuery: () => null,
}));

vi.mock("@clerk/clerk-react", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <button type="button">User menu</button>,
  useAuth: () => ({ isSignedIn: false }),
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("../components/ConvexStatusBanner", () => ({
  ConvexStatusBanner: () => <div>Convex banner</div>,
}));

vi.mock("../components/Sidebar", () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}));

vi.mock("../pages/CvForge", () => ({
  CvForge: () => <div>CV forge</div>,
}));

vi.mock("../pages/CvsLibrary", () => ({
  CvsLibrary: () => <div>CV library</div>,
}));

vi.mock("../pages/ProposalForge", () => ({
  ProposalForge: () => <div>Proposal forge</div>,
}));

vi.mock("../pages/ProposalsLibrary", () => ({
  ProposalsLibrary: () => <div>Proposal library</div>,
}));

vi.mock("../pages/StyleForge", () => ({
  StyleForge: () => <div>Style forge</div>,
}));

vi.mock("../pages/SettingsPage", () => ({
  SettingsPage: () => <div>Settings</div>,
}));

vi.mock("../pages/ResumePrintPage", () => ({
  ResumePrintPage: () => <div>Resume print</div>,
}));

vi.mock("../pages/ProposalPrintPage", () => ({
  ProposalPrintPage: () => <div>Proposal print</div>,
}));

vi.mock("../pages/ResumeFontParityHarnessPage", () => ({
  ResumeFontParityHarnessPage: () => <div>Resume parity</div>,
}));

vi.mock("../pages/PdfRasterHarnessPage", () => ({
  PdfRasterHarnessPage: () => <div>PDF raster</div>,
}));

vi.mock("../contexts/CvLibraryContext", () => ({
  CvLibraryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCvLibrary: () => ({
    currentCv: null,
    currentCvId: cvLibraryState.currentCvId,
    cvs: [],
    importCv: importCvMock,
    createNewCv: createNewCvMock,
    loadCv: vi.fn(),
  }),
}));

vi.mock("../components/useStructuredMistralImport", () => ({
  useStructuredMistralImport: () => ({
    enableMistral: true,
    importFile: importFileMock,
  }),
  beginStructuredImportTimingTrace: (_source: string, fileName?: string | null) => ({
    id: "trace-1",
    source: "quick_start",
    fileName: fileName ?? null,
    startedAt: 0,
  }),
  logStructuredImportTiming: vi.fn(),
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT:
    ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg",
}));

vi.mock("../lib/onboarding-state", () => ({
  markQuickStartCompleted: vi.fn(),
}));

vi.mock("../lib/proposal-personalization", () => ({
  clearActiveLocalCvId: vi.fn(),
  setProposalAttachedCvId: vi.fn(),
}));

vi.mock("../lib/proposal-workspace-state", () => ({
  startFreshProposalWorkspace: vi.fn(),
  createProposalWorkspaceResetState: vi.fn(() => ({ reset: true })),
  PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT: "dasti:proposal-compose-draft-updated",
  readStoredProposalComposeDraft: vi.fn(() => null),
}));

vi.mock("../lib/proposal-output-draft", () => ({
  PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT: "dasti:proposal-output-draft-updated",
  readStoredProposalOutputDraft: vi.fn(() => null),
}));

vi.mock("../lib/proposal-saved-fixtures", () => ({
  readStoredSavedProposalFixtures: () => [],
}));

vi.mock("../lib/storage-diagnostics", () => ({
  installStorageDiagnostics: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    proposalsPublic: { default: "proposalsPublic.default" },
  },
}));

describe("App Quick Start pane", () => {
  beforeEach(() => {
    importCvMock.mockReset();
    createNewCvMock.mockReset();
    importFileMock.mockReset();
    cvLibraryState.currentCvId = null;
    window.history.replaceState(
      {
        usr: createQuickStartLocationState(null),
        key: "quick-start-test",
        idx: 0,
      },
      "",
      "/proposal",
    );
  });

  it("replaces the routed content pane while keeping sidebar chrome visible", () => {
    render(<App />);

    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Convex banner")).toBeInTheDocument();
    expect(screen.getByTestId("quick-start-pane")).toBeInTheDocument();
    expect(
      within(document.querySelector(".app-pages") as HTMLElement).queryByText("Proposal forge"),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".dasti-dialog-root")).toBeNull();
    expect(document.querySelector(".dasti-dialog-overlay")).toBeNull();
  });

  it("closes back to the routed content pane without changing the pathname", async () => {
    render(<App />);

    await userEvent.click(screen.getByLabelText("Close"));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/proposal");
      expect(
        within(document.querySelector(".app-pages") as HTMLElement).getByText("Proposal forge"),
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId("quick-start-pane")).not.toBeInTheDocument();
  });

  it("clears cover-letter start intent when closing the quick start pane", async () => {
    window.history.replaceState(
      {
        usr: createQuickStartLocationState({
          proposalEntryIntent: "cover-letter-start",
          jobImportFocus: "supported-sites",
          proposalWorkspaceResetToken: "reset-1",
        }),
        key: "quick-start-cover-letter-test",
        idx: 0,
      },
      "",
      "/proposal",
    );

    render(<App />);

    await userEvent.click(screen.getByLabelText("Close"));

    await waitFor(() => {
      expect(
        within(document.querySelector(".app-pages") as HTMLElement).getByText("Proposal forge"),
      ).toBeInTheDocument();
    });
    expect(window.history.state.usr).toEqual({
      proposalWorkspaceResetToken: "reset-1",
    });
  });

  it("keeps the pane active while a resume import is busy", async () => {
    importFileMock.mockImplementation(
      () =>
        new Promise(() => {
          // Hold the import open so the close control stays disabled.
        }),
    );

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /^Resume\b/i }));
    await screen.findByRole("button", { name: /^Upload PDF or image\b/i });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "busy-import.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await screen.findByTestId("quick-start-import-status");

    expect(screen.getByLabelText("Close")).toBeDisabled();
    expect(screen.getByTestId("quick-start-pane")).toBeInTheDocument();
    expect(
      within(document.querySelector(".app-pages") as HTMLElement).queryByText("Proposal forge"),
    ).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/proposal");
  });
});
