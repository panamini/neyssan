import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import { PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY } from "../../lib/proposal-output-draft";

const mockUpdateProposal = vi.fn().mockResolvedValue(undefined);
const mockCreateProposal = vi.fn().mockResolvedValue("proposal_created");
let mockAttachedCvId: string | null = null;
let mockCurrentProposalSettings: Record<string, unknown> | null = null;

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
  useQuery: (reference: string) => {
    if (reference === "proposalSettings.getCurrent") {
      return mockCurrentProposalSettings;
    }
    return null;
  },
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
  getLocalCvDocumentById: (id: string) =>
    id === "cv_alpha" ? mockSourceCv : null,
  listLocalCvPickerOptions: () => [],
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
  default: ({
    onActiveCvChange,
  }: {
    onActiveCvChange?: (cvId: string | null) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        mockAttachedCvId = "cv_alpha";
        onActiveCvChange?.("cv_alpha");
      }}
    >
      Attach CV from form
    </button>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    proposalContent,
    documentTitle,
    onContentChange,
    onDocumentTitleChange,
    railStartAddon,
    railEndAddon,
    actions,
  }: {
    proposalContent: string | null;
    documentTitle?: string | null;
    onContentChange?: (value: string) => void;
    onDocumentTitleChange?: (value: string) => void;
    railStartAddon?: React.ReactNode;
    railEndAddon?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="proposal-autosave-state">
        {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}
      </div>
      <button
        type="button"
        onClick={() => onContentChange?.("First autosave draft.")}
      >
        Edit content once
      </button>
      <button
        type="button"
        onClick={() => onContentChange?.("Second autosave draft.")}
      >
        Edit content twice
      </button>
      <button
        type="button"
        onClick={() => onDocumentTitleChange?.("Renamed autosave title")}
      >
        Edit title
      </button>
      {railStartAddon}
      {railEndAddon}
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
      Direct style edit
    </button>
  ),
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: ({
    saveStatus,
    styleStatusLabel,
  }: {
    saveStatus?: string;
    styleStatusLabel?: string | null;
  }) => (
    <div>
      <div data-testid="compose-save-status">{saveStatus ?? "idle"}</div>
      <div data-testid="compose-style-status">
        {styleStatusLabel ?? "Default"}
      </div>
    </div>
  ),
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge autosave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockCreateProposal.mockClear();
    mockUpdateProposal.mockClear();
    mockAttachedCvId = null;
    mockCurrentProposalSettings = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function waitForAutosave() {
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1100));
    });
  }

  it("creates once for rapid compose edits, then updates the same proposal on later title edits", async () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Original proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "balanced",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Original autosave title",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: null,
        proposalOutputMode: "preview",
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

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit content once" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit content twice" }));
    expect(screen.getByTestId("compose-save-status")).toHaveTextContent(
      "saving",
    );

    await waitForAutosave();

    await waitFor(() => {
      expect(mockCreateProposal).toHaveBeenCalledTimes(1);
      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Original autosave title",
          content: "Second autosave draft.",
          status: "saved",
        }),
      );
      expect(mockUpdateProposal).not.toHaveBeenCalled();
      expect(screen.getByTestId("compose-save-status")).toHaveTextContent(
        "saved",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit title" }));

    await waitForAutosave();

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "proposal_created",
          title: "Renamed autosave title",
          content: "Second autosave draft.",
        }),
      );
    });
  });

  it("strips familyId from workshop settings styles when creating proposal drafts", async () => {
    mockCurrentProposalSettings = {
      voicePreset: "signature",
      savedVoicePreset: "signature",
      templateId: "editorial_wide",
      styleChoice: "balanced",
      paletteOverride: null,
      accentHex: null,
      fontPairId: "doto-code",
      verbatiStyle: {
        familyId: "workshop",
        layout: "workshop",
        typography: "doto-code",
        palette: "pierre",
      },
      sourceMode: "proposal_local",
    };

    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Workshop autosave body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "balanced",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Workshop autosave title",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: null,
        proposalOutputMode: "preview",
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

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit content once" }));

    await waitForAutosave();

    await waitFor(() => {
      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Workshop autosave title",
          content: "First autosave draft.",
          status: "saved",
          metadata: expect.objectContaining({
            templateId: "workshop_proposal_margin",
            styleLinkMode: "proposal_local",
            verbatiStyle: {
              layout: "workshop",
              typography: "doto-code",
              palette: "pierre",
            },
          }),
        }),
      );
    });
  });

  it("preserves source cv and detached style semantics when autosaving direct style edits", async () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Styled autosave body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: {
          layout: "editorial",
          typography: "engaging",
          palette: "encre",
        },
        proposalStyleLinkMode: "inherit_cv",
        proposalStyleChoice: "auto",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Styled autosave title",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_existing",
        proposalOutputMode: "preview",
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

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Attach CV from form" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Direct style edit" }));

    await waitForAutosave();

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "proposal_existing",
          metadata: expect.objectContaining({
            sourceCvId: "cv_alpha",
            templateId: expect.any(String),
            styleLinkMode: "proposal_local",
            verbatiStyle: expect.objectContaining({
              palette: "bordeaux",
            }),
          }),
        }),
      );
    });
  });

  it("repairs an inherited-style generated row after reload when the draft has a server id but no persisted save token", async () => {
    mockAttachedCvId = "cv_alpha";
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Reloaded inherited proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: "editorial_wide",
        proposalVerbatiStyle: {
          layout: "editorial",
          typography: "engaging",
          palette: "encre",
        },
        proposalStyleLinkMode: "inherit_cv",
        proposalStyleChoice: "auto",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Reloaded inherited proposal",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_existing_inherit",
        proposalOutputMode: "preview",
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

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitForAutosave();

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "proposal_existing_inherit",
          title: "Reloaded inherited proposal",
          content: expect.stringContaining("Reloaded inherited proposal body."),
          status: "saved",
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
    });
  });

  it("repairs a detached local-style generated row after reload when the draft has a server id but no persisted save token", async () => {
    mockAttachedCvId = "cv_alpha";
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Reloaded detached proposal body.",
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
        proposalDocumentTitle: "Reloaded detached proposal",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_existing_local",
        proposalOutputMode: "preview",
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

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitForAutosave();

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "proposal_existing_local",
          title: "Reloaded detached proposal",
          content: expect.stringContaining("Reloaded detached proposal body."),
          status: "saved",
          metadata: expect.objectContaining({
            sourceCvId: "cv_alpha",
            templateId: "swiss_margin",
            styleLinkMode: "proposal_local",
            verbatiStyle: expect.objectContaining({
              layout: "swiss",
              typography: "quiet-editorial",
              palette: "bordeaux",
            }),
          }),
        }),
      );
    });
  });
});
