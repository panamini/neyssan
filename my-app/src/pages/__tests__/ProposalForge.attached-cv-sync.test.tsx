import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import { writeStoredProposalOutputDraft } from "../../lib/proposal-output-draft";

const mockLoadCv = vi.fn();
const mockUpdateProposal = vi.fn().mockResolvedValue(undefined);

let mockActiveCvId: string | null = null;
const mockAttachedCv = {
  id: "cv_alpha",
  title: "Alex Martin Resume",
  metadata: {
    updatedAt: "2026-03-31T00:00:00.000Z",
  },
  sections: [
    {
      id: "profile",
      type: "profile",
      title: "Profile",
      blocks: [],
      structuredContent: [
        {
          id: "profile_1",
          name: "Alex Martin",
          desiredPosition: "Operations Associate",
        },
      ],
    },
  ],
} as any;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
  useMutation: (reference: string) => {
    if (reference === "updateProposalPublic.default") {
      return mockUpdateProposal;
    }
    return vi.fn().mockResolvedValue(undefined);
  },
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  clearActiveLocalCvId: () => {
    mockActiveCvId = null;
  },
  getProposalApplicantIdentity: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
  }),
  getProposalAttachedCvId: () => mockActiveCvId,
  getLocalActiveCvSnapshotById: (id: string) =>
    id === "cv_alpha"
      ? { title: "Operations Associate — Alex Martin" }
      : null,
  getProposalAttachedCvLocalDocument: () =>
    mockActiveCvId === "cv_alpha" ? mockAttachedCv : null,
  getActiveLocalPersonalizationSource: () => ({
    title: mockActiveCvId === "cv_alpha" ? "Operations Associate — Alex Martin" : null,
    personalizationContext:
      mockActiveCvId === "cv_alpha"
        ? {
            name: "Alex Martin",
            desiredPosition: "Operations Associate",
          }
        : null,
  }),
  getProposalApplicantHeaderData: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
    email: "alex@example.com",
    phone: null,
    location: null,
    website: null,
    linkedIn: null,
  }),
  listLocalCvPickerOptions: () =>
    mockActiveCvId === "cv_alpha"
      ? [
          {
            id: "cv_alpha",
            title: "Operations Associate — Alex Martin",
            isActive: true,
          },
        ]
      : [],
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    loadCv: mockLoadCv,
  }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({
    onActiveCvChange,
  }: {
    onActiveCvChange?: (cvId: string | null) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          mockActiveCvId = "cv_alpha";
          onActiveCvChange?.("cv_alpha");
        }}
      >
        Attach CV from form
      </button>
      <button
        type="button"
        onClick={() => {
          mockActiveCvId = null;
          onActiveCvChange?.(null);
        }}
      >
        Remove CV from form
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    railStartAddon,
  }: {
    railStartAddon?: React.ReactNode;
  }) => (
    <div>
      <div>Proposal output</div>
      {railStartAddon}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/EmbeddedStyleInspector", () => ({
  default: ({
    onSelectPalette,
  }: {
    onSelectPalette?: (palette: "bordeaux") => void;
  }) => (
    <button
      type="button"
      onClick={() => onSelectPalette?.("bordeaux")}
    >
      Direct style edit
    </button>
  ),
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: ({
    onClearCv,
    cvTitle,
    styleStatusLabel,
    canResetToCvStyle,
    onResetToCvStyle,
  }: {
    onClearCv?: () => void;
    cvTitle?: string | null;
    styleStatusLabel?: string | null;
    canResetToCvStyle?: boolean;
    onResetToCvStyle?: () => void;
  }) => (
    <div>
      <button type="button" aria-label={cvTitle ? `CV: ${cvTitle}` : "Pick CV"}>
        {cvTitle ?? "Pick CV"}
      </button>
      <div data-testid="proposal-style-status">
        {styleStatusLabel ?? "Default"}
      </div>
      {canResetToCvStyle ? (
        <button type="button" onClick={() => onResetToCvStyle?.()}>
          Reset to CV style
        </button>
      ) : null}
      <button type="button" onClick={() => onClearCv?.()}>
        Remove CV from toolbar
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge attached CV sync", () => {
  beforeEach(() => {
    mockActiveCvId = null;
    mockLoadCv.mockReset();
    mockUpdateProposal.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the proposal-level CV source control in sync with attach and remove actions", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();
    expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
      "Default",
    );

    fireEvent.click(screen.getByRole("button", { name: "Attach CV from form" }));

    expect(
      screen.getByRole("button", {
        name: /CV: Operations Associate — Alex Martin/i,
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
        "CV",
      );
    });
    expect(mockLoadCv).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove CV from form" }));

    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();
    expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
      "Default",
    );
  });

  it("clears the attached CV when the workspace toolbar remove action is used", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Attach CV from form" }));

    expect(screen.getByText("Operations Associate — Alex Martin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove CV from toolbar" }));

    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();
  });

  it("detaches the runtime proposal style after the first direct style edit", async () => {
    writeStoredProposalOutputDraft({
      proposalContent:
        "Dear Hiring Manager,\n\nGenerated proposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalContactLine: "alex@example.com",
      proposalLetterDate: "Paris, April 16, 2026",
      proposalRecipientDetails: "Hiring Manager\nStudio North",
      proposalDocumentTitle: "Generated proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Attach CV from form" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
        "CV",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Direct style edit" }));

    expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
      "Custom",
    );
  });

  it("resets a detached proposal back to cv style and persists inherit_cv on save", async () => {
    writeStoredProposalOutputDraft({
      proposalContent:
        "Dear Hiring Manager,\n\nGenerated proposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: {
        layout: "swiss",
        typography: "signature",
        palette: "pierre",
      },
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalContactLine: "alex@example.com",
      proposalLetterDate: "Paris, April 16, 2026",
      proposalRecipientDetails: "Hiring Manager\nStudio North",
      proposalDocumentTitle: "Generated proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Attach CV from form" }));
    await waitFor(() => {
    expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
      "Custom",
    );
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset to CV style" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
        "CV",
      );
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1100));
    });

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "proposal_live",
          metadata: expect.objectContaining({
            sourceCvId: "cv_alpha",
            styleLinkMode: "inherit_cv",
          }),
        }),
      );
    });
  });
});
