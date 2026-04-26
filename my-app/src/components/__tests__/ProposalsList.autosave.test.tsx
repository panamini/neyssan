import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProposalsList from "../ProposalsList";

const mockUpdateProposal = vi.fn().mockResolvedValue(undefined);

const SAVED_PROPOSALS = [
  {
    _id: "proposal_saved",
    _creationTime: 1710000000000,
    title: "Saved proposal",
    content: "Saved proposal body.",
    status: "saved",
    metadata: {
      proposalType: "cover_letter",
      sourceCvId: "cv_alpha",
      templateId: "editorial_wide",
      styleLinkMode: "inherit_cv",
      verbatiStyle: {
        layout: "editorial",
        typography: "engaging",
        palette: "encre",
        familyId: "editorial",
      },
    },
  },
] as any;

const mockSourceCv = {
  id: "cv_alpha",
  title: "Alex Martin Resume",
  metadata: {
    verbatiStyle: {
      layout: "swiss",
      typography: "signature",
      palette: "pierre",
    },
  },
} as any;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (query: string) => {
    if (query === "proposalsPublic.default") {
      return SAVED_PROPOSALS;
    }
    return null;
  },
  useMutation: (reference: string) => {
    if (reference === "updateProposalPublic.default") {
      return mockUpdateProposal;
    }
    return vi.fn().mockResolvedValue(undefined);
  },
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
  }),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  getActiveLocalPersonalizationSource: () => ({
    title: "Alex Martin Resume",
    personalizationContext: null,
  }),
  getLocalCvDocumentById: (id: string) => (id === "cv_alpha" ? mockSourceCv : null),
  getProposalAttachedCvId: () => "cv_alpha",
  getProposalApplicantHeaderData: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
    email: "alex@example.com",
    phone: null,
    website: null,
    location: null,
    linkedIn: null,
  }),
}));

vi.mock("../ProposalDisplay", () => ({
  default: ({
    onDocumentTitleChange,
    onContentChange,
    detachedActionHeaderSupplement,
    actions,
    stylePreset,
  }: {
    onDocumentTitleChange?: (value: string) => void;
    onContentChange?: (value: string) => void;
    detachedActionHeaderSupplement?: React.ReactNode;
    actions?: React.ReactNode;
    stylePreset?: {
      layout?: string | null;
      palette?: string | null;
    } | null;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onDocumentTitleChange?.("Renamed saved proposal")}
      >
        Edit saved title
      </button>
      <button
        type="button"
        onClick={() => onContentChange?.("Updated saved proposal body.")}
      >
        Edit saved content
      </button>
      <div data-testid="saved-render-style">
        {stylePreset?.layout ?? "none"}|{stylePreset?.palette ?? "none"}
      </div>
      {detachedActionHeaderSupplement}
      {actions}
    </div>
  ),
}));

vi.mock("../SavedProposalForgeToolbarPreview", () => ({
  SavedProposalForgeToolbarPreview: ({
    onModeChange,
    onPaletteOverrideChange,
    saveStatus,
  }: {
    onModeChange?: (mode: "preview" | "edit") => void;
    onPaletteOverrideChange?: (value: "bordeaux") => void;
    saveStatus?: string;
  }) => (
    <div>
      <div data-testid="saved-save-status">{saveStatus ?? "idle"}</div>
      <button type="button" onClick={() => onModeChange?.("edit")}>
        Switch saved edit mode
      </button>
      <button type="button" onClick={() => onPaletteOverrideChange?.("bordeaux")}>
        Change saved palette
      </button>
    </div>
  ),
}));

describe("ProposalsList autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUpdateProposal.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("autosaves title/content edits and persists style/source-cv metadata through the same update path", async () => {
    render(
      <ProposalsList
        selectedProposalId="proposal_saved"
        onSelectedProposalIdChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("saved-render-style")).toHaveTextContent(
      "editorial|encre",
    );
    expect(screen.getByTestId("saved-render-style")).not.toHaveTextContent(
      "pierre",
    );
    expect(screen.getByText("Alex Martin Resume")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Source CV Alex Martin Resume"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Source CV:\s*Alex Martin Resume/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Switch saved edit mode" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Proposal title" }), {
      target: { value: "Renamed saved proposal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit saved content" }));
    expect(screen.getByTestId("saved-save-status")).toHaveTextContent("saving");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    expect(mockUpdateProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "proposal_saved",
        title: "Renamed saved proposal",
        content: "Updated saved proposal body.",
        metadata: expect.objectContaining({
          sourceCvId: "cv_alpha",
          templateId: "editorial_wide",
          styleLinkMode: "inherit_cv",
          verbatiStyle: expect.objectContaining({
            layout: "editorial",
            typography: "soft-serif",
            palette: "encre",
          }),
        }),
      }),
    );
    expect(
      mockUpdateProposal.mock.calls.at(-1)?.[0]?.metadata?.verbatiStyle,
    ).not.toHaveProperty("familyId");

    fireEvent.click(screen.getByRole("button", { name: "Change saved palette" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    expect(screen.getByTestId("saved-render-style")).toHaveTextContent(
      "editorial|bordeaux",
    );

    expect(mockUpdateProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "proposal_saved",
        metadata: expect.objectContaining({
          sourceCvId: "cv_alpha",
          templateId: "editorial_wide",
          styleLinkMode: "proposal_local",
          verbatiStyle: expect.objectContaining({
            layout: "editorial",
            typography: "soft-serif",
            palette: "bordeaux",
          }),
        }),
      }),
    );
    expect(
      mockUpdateProposal.mock.calls.at(-1)?.[0]?.metadata?.verbatiStyle,
    ).not.toHaveProperty("familyId");
    expect(screen.getByTestId("saved-save-status")).toHaveTextContent("saved");
  });
});
