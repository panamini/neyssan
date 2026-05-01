import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentsPage } from "../DocumentsPage";

const navigateMock = vi.fn();
const deleteProposalMock = vi.fn();
const loadCvMock = vi.fn(() => true);
const deleteCvMock = vi.fn();
const proposalsMock = vi.fn();
const cvsMock = vi.fn();

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
    loadCv: loadCvMock,
    deleteCv: deleteCvMock,
  }),
}));

vi.mock("../../lib/proposal-workspace-state", () => ({
  createProposalWorkspaceResetState: () => ({ reset: true }),
  readStoredProposalComposeDraft: () => ({
    jobTitle: "Draft product designer",
    sourceJobDescription: "Draft job context.",
  }),
  startFreshProposalWorkspace: vi.fn(),
}));

vi.mock("../../lib/proposal-output-draft", () => ({
  readStoredProposalOutputDraft: () => null,
}));

describe("DocumentsPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    deleteProposalMock.mockClear();
    loadCvMock.mockClear();
    loadCvMock.mockReturnValue(true);
    deleteCvMock.mockClear();
    proposalsMock.mockReturnValue([
      {
        _id: "proposal_1",
        _creationTime: Date.now(),
        title: "Senior Frontend Engineer · Linear",
        content: "Saved cover letter body.",
        status: "saved",
        metadata: { voicePreset: "engaging" },
      },
    ]);
    cvsMock.mockReturnValue([
      {
        id: "cv_1",
        title: "Frontend Engineer · Editorial v3",
        metadata: { updatedAt: "2026-05-01T12:00:00.000Z" },
        sections: [],
      },
    ]);
  });

  it("combines proposals, CVs, and drafts in one skeleton documents route", () => {
    render(
      <MemoryRouter initialEntries={["/documents"]}>
        <DocumentsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByText("Senior Frontend Engineer · Linear")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer · Editorial v3")).toBeInTheDocument();
    expect(screen.getByText("Draft product designer")).toBeInTheDocument();
    expect(screen.queryByText(/76%/)).not.toBeInTheDocument();
  });

  it("filters unified documents by type and opens CVs through the library loader", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/documents"]}>
        <DocumentsPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "CVs" }));
    expect(screen.queryByText("Senior Frontend Engineer · Linear")).toBeNull();
    const cvCard = screen.getByText("Frontend Engineer · Editorial v3").closest("article");
    expect(cvCard).toBeTruthy();

    await user.click(within(cvCard as HTMLElement).getByText("Frontend Engineer · Editorial v3"));
    expect(loadCvMock).toHaveBeenCalledWith("cv_1");
    expect(navigateMock).toHaveBeenCalledWith("/cv?id=cv_1");
  });
});
