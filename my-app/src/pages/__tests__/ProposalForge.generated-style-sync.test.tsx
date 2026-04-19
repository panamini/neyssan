import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import { PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY } from "../../lib/proposal-output-draft";

const mockUpdateProposal = vi.fn().mockResolvedValue(undefined);
const mockCreateProposal = vi.fn().mockResolvedValue("proposal_created");
let mockAttachedCvId: string | null = null;

const mockSourceCv = {
  id: "cv_alpha",
  title: "Alex Martin Resume",
  metadata: {
    verbatiStyle: {
      layout: "editorial",
      typography: "engaging",
      palette: "encre",
    },
  },
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
    if (reference === "createProposalPublic.default") {
      return mockCreateProposal;
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
    createProposalPublic: { default: "createProposalPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    cvs: [],
    currentCv: null,
    currentCvId: null,
    loadCv: vi.fn(),
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  clearActiveLocalCvId: () => {
    mockAttachedCvId = null;
  },
  getActiveLocalPersonalizationSource: () => ({
    title: mockAttachedCvId === "cv_alpha" ? "Alex Martin Resume" : null,
    personalizationContext: null,
  }),
  getLocalActiveCvSnapshotById: (id: string) =>
    id === "cv_alpha" ? { title: "Alex Martin Resume" } : null,
  getLocalCvDocumentById: (id: string) => (id === "cv_alpha" ? mockSourceCv : null),
  getProposalApplicantHeaderData: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
    email: "alex@example.com",
    phone: null,
    linkedin: null,
    website: null,
    location: null,
    tag: null,
  }),
  getProposalApplicantIdentity: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
  }),
  getProposalAttachedCvId: () => mockAttachedCvId,
  getProposalAttachedCvLocalDocument: () =>
    mockAttachedCvId === "cv_alpha" ? mockSourceCv : null,
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
  setProposalAttachedCvId: (id: string) => {
    mockAttachedCvId = id;
  },
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({ onSubmit, onValuesChange }: any) => (
    <button
      type="button"
      onClick={() => {
        const values = {
          jobTitle: "Operations Associate",
          jobDescription:
            "Support recurring processes and coordinate communication.",
          proposalType: "cover_letter",
          voicePreset: "signature",
          toneTuning: null,
          characterLimitMode: "none",
          characterLimitValue: null,
        };
        onValuesChange?.(values);
        onSubmit?.(
          values,
          "Freshly generated proposal body.",
          undefined,
          "proposal_generated",
        );
      }}
    >
      Generate proposal
    </button>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    proposalContent,
    documentTitle,
    templateId,
    stylePreset,
    railStartAddon,
    actions,
  }: {
    proposalContent: string | null;
    documentTitle?: string | null;
    templateId?: string | null;
    stylePreset?: {
      layout?: string | null;
      palette?: string | null;
      typography?: string | null;
    } | null;
    railStartAddon?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="proposal-display-state">
        {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}|
        {templateId ?? "no-template"}|{stylePreset?.layout ?? "none"}|
        {stylePreset?.typography ?? "none"}|{stylePreset?.palette ?? "none"}
      </div>
      {railStartAddon}
      {actions}
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
    <button type="button" onClick={() => onSelectPalette?.("bordeaux")}>
      Apply custom palette
    </button>
  ),
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: () => <div>Compose toolbar</div>,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge generated proposal style sync", () => {
  function readDisplayedProposalState() {
    const [title, content, templateId, layout, typography, palette] =
      (screen.getByTestId("proposal-display-state").textContent ?? "").split("|");

    return {
      title,
      content,
      templateId,
      layout,
      typography,
      palette,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    mockCreateProposal.mockClear();
    mockUpdateProposal.mockClear();
    mockAttachedCvId = "cv_alpha";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("backfills the live inherited style snapshot onto the generated server row before reload", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));
      await Promise.resolve();
    });

    const displayedState = readDisplayedProposalState();
    expect(displayedState.layout).toBe("editorial");
    expect(displayedState.palette).toBe("encre");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
      await Promise.resolve();
    });

    expect(mockUpdateProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "proposal_generated",
        title: displayedState.title,
        content: displayedState.content,
        status: "saved",
        metadata: expect.objectContaining({
          sourceCvId: "cv_alpha",
          styleLinkMode: "inherit_cv",
          templateId: displayedState.templateId,
          verbatiStyle: expect.objectContaining({
            layout: displayedState.layout,
            typography: displayedState.typography,
            palette: displayedState.palette,
          }),
        }),
      }),
    );
  });

  it("updates the same generated server row when save-to-library is triggered with an unchanged title and a preselected custom style", async () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Detached styled draft.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: "swiss_margin",
        proposalVerbatiStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "bordeaux",
        },
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "balanced",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Application for the Operations Associate role",
        proposalDocumentMeta: "alex@example.com",
        generatedProposalId: null,
        proposalOutputMode: "preview",
        paletteOverride: null,
        customAccentHex: null,
        templateBundleId: null,
        typographyOverride: "signature",
        layoutOverride: "swiss",
        proposalDocumentTitleManual: false,
        characterLimitMode: null,
        characterLimitValue: null,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));
      await Promise.resolve();
    });

    const displayedState = readDisplayedProposalState();
    expect(displayedState.layout).toBe("swiss");
    expect(displayedState.palette).toBe("bordeaux");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Save proposal to library" }),
      );
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save to Library" }));
      await Promise.resolve();
    });

    expect(mockUpdateProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "proposal_generated",
        title: displayedState.title,
        content: displayedState.content,
        status: "saved",
        metadata: expect.objectContaining({
          sourceCvId: "cv_alpha",
          styleLinkMode: "proposal_local",
          templateId: displayedState.templateId,
          verbatiStyle: expect.objectContaining({
            layout: displayedState.layout,
            typography: displayedState.typography,
            palette: displayedState.palette,
          }),
        }),
      }),
    );

    expect(mockCreateProposal).not.toHaveBeenCalled();
  });
});
