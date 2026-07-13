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
let mockSavedProposals: any[] | null = null;
const mockForgePanelState = vi.hoisted(() => ({
  designRegistration: null as null | { renderContent: () => React.ReactNode },
}));

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

function ActiveForgePanelProbe(): JSX.Element | null {
  return mockForgePanelState.designRegistration
    ? <>{mockForgePanelState.designRegistration.renderContent()}</>
    : null;
}

vi.mock("../../contexts/ForgeTemplatePanelContext", () => ({
  useForgeTemplatePanel: () => ({
    open: false,
    openMode: "closed",
    activeSurface: null,
    dockedSurface: null,
    activeRegistration: null,
    openSurface: vi.fn(),
    closePanel: vi.fn(),
    queueOpenSurface: vi.fn(),
    queueClosePanel: vi.fn(),
    cancelPanelClose: vi.fn(),
  }),
  useRegisterForgeTemplates: vi.fn(),
  useRegisterForgePanel: (registration: {
    surface: string;
    renderContent: () => React.ReactNode;
  }) => {
    if (registration.surface === "proposal-design") {
      mockForgePanelState.designRegistration = registration;
    }
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (reference: string) => {
    if (reference === "proposalSettings.getCurrent") {
      return mockCurrentProposalSettings;
    }
    if (reference === "proposalsPublic.default") {
      return mockSavedProposals;
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
  getLocalPersonalizationSourceByCvId: (id: string | null | undefined) => ({
    title: id === "cv_alpha" ? "Alex Martin Resume" : null,
    personalizationContext: null,
  }),
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
    proposalDocument,
    salutationValue,
    documentTitle,
    stylePreset,
    onContentChange,
    onContentCommit,
    onProposalDocumentChange,
    onSalutationChange,
    onRecipientDetailsChange,
    onDocumentTitleChange,
    headerVisibility,
    railStartAddon,
    railEndAddon,
    actions,
  }: {
    proposalContent: string | null;
    proposalDocument?: { blocks?: Array<{ text?: string }> } | null;
    salutationValue?: string | null;
    documentTitle?: string | null;
    stylePreset?: {
      layout?: string | null;
      typography?: string | null;
      palette?: string | null;
    } | null;
    onContentChange?: (value: string) => void;
    onContentCommit?: (snapshot?: {
      proposalContent?: string | null;
      proposalDocument?: any | null;
    }) => void;
    onProposalDocumentChange?: (document: any) => void;
    onSalutationChange?: (value: string) => void;
    onRecipientDetailsChange?: (value: string) => void;
    onDocumentTitleChange?: (value: string) => void;
    headerVisibility?: {
      showRecipient?: boolean;
      showRecipientDetails?: boolean;
    } | null;
    railStartAddon?: React.ReactNode;
    railEndAddon?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="proposal-autosave-state">
        {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}
      </div>
      <div data-testid="proposal-document-state">
        {proposalDocument?.blocks?.map((block) => block.text).join(" ") ??
          "no-document"}
      </div>
      <div data-testid="proposal-salutation-state">
        {salutationValue ?? "empty"}
      </div>
      <div data-testid="proposal-recipient-visibility-state">
        {headerVisibility?.showRecipient ? "recipient-visible" : "recipient-hidden"}|
        {headerVisibility?.showRecipientDetails ? "details-visible" : "details-hidden"}
      </div>
      <div data-testid="proposal-autosave-style">
        {stylePreset?.layout ?? "none"}|{stylePreset?.typography ?? "none"}|
        {stylePreset?.palette ?? "none"}
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
        onClick={() => onContentChange?.("Whole draft rewritten by Ask AI.")}
      >
        Rewrite whole draft
      </button>
      <button
        type="button"
        onClick={() => {
          const proposalDocument = {
            schemaVersion: 1,
            kind: "letter",
            source: "structured",
            blocks: [
              {
                id: "salutation-1",
                type: "salutation",
                text: "ola,",
              },
              {
                id: "paragraph-1",
                type: "paragraph",
                text: "Preview committed draft body.",
              },
              {
                id: "closing-1",
                type: "closing",
                signOff: "Sincerely,",
                signatureName: "Alex Martin",
              },
            ],
          };
          const proposalContent =
            "ola,\n\nPreview committed draft body.\n\nSincerely,\nAlex Martin";
          onContentChange?.(proposalContent);
          onProposalDocumentChange?.(proposalDocument);
          onContentCommit?.({ proposalContent, proposalDocument });
        }}
      >
        Edit preview document
      </button>
      <button
        type="button"
        onClick={() => onDocumentTitleChange?.("Renamed autosave title")}
      >
        Edit title
      </button>
      <button
        type="button"
        onClick={() => onSalutationChange?.("Madame, Monsieur,")}
      >
        Edit salutation from heading
      </button>
      <button
        type="button"
        onClick={() =>
          onProposalDocumentChange?.({
            schemaVersion: 1,
            kind: "letter",
            source: "structured",
            blocks: [
              {
                id: "paragraph-1",
                type: "paragraph",
                text: "Preview committed draft body.",
              },
              {
                id: "closing-1",
                type: "closing",
                signOff: "Sincerely,",
                signatureName: "Alex Martin",
              },
            ],
          })
        }
      >
        Delete salutation inline
      </button>
      <button
        type="button"
        onClick={() =>
          onRecipientDetailsChange?.(
            "Hiring Manager\nHead of Talent\nNorthwind\nhiring@northwind.example\n12 Main Street\nBoston, MA",
          )
        }
      >
        Edit recipient details from heading
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
    mockForgePanelState.designRegistration = null;
    window.localStorage.clear();
    mockCreateProposal.mockClear();
    mockUpdateProposal.mockClear();
    mockAttachedCvId = null;
    mockCurrentProposalSettings = null;
    mockSavedProposals = null;
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
    await waitForAutosave();

    await waitFor(() => {
      expect(mockCreateProposal).toHaveBeenCalledTimes(1);
      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Original autosave title",
          content: "Second autosave draft.",
          status: "draft",
        }),
      );
      expect(mockUpdateProposal).not.toHaveBeenCalled();
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

  it("saves preview document edits with the edited snapshot before refresh can restore stale server content", async () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent:
          "Dear team,\n\nOriginal server draft body.\n\nSincerely,\nAlex Martin",
        proposalDocument: {
          schemaVersion: 1,
          kind: "letter",
          source: "structured",
          blocks: [
            {
              id: "salutation-1",
              type: "salutation",
              text: "Dear team,",
            },
            {
              id: "paragraph-1",
              type: "paragraph",
              text: "Original server draft body.",
            },
            {
              id: "closing-1",
              type: "closing",
              signOff: "Sincerely,",
              signatureName: "Alex Martin",
            },
          ],
        },
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "balanced",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Preview autosave title",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_preview_existing",
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
    mockUpdateProposal.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit preview document" }),
    );

    expect(screen.getByTestId("proposal-salutation-state")).toHaveTextContent(
      "ola,",
    );

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalled();
    });
    expect(mockUpdateProposal.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        id: "proposal_preview_existing",
        title: "Preview autosave title",
        content: expect.stringContaining("Preview committed draft body."),
        metadata: expect.objectContaining({
          proposalDocument: expect.objectContaining({
            blocks: expect.arrayContaining([
              expect.objectContaining({
                type: "salutation",
                text: "ola,",
              }),
              expect.objectContaining({
                text: "Preview committed draft body.",
              }),
            ]),
          }),
          proposalDocumentRevision: expect.any(Number),
          proposalDocumentUpdatedAt: expect.any(Number),
        }),
        status: "draft",
      }),
    );
    expect(
      mockUpdateProposal.mock.calls[0]?.[0].content.match(/^ola,$/gm),
    ).toHaveLength(1);

    mockUpdateProposal.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit salutation from heading" }),
    );
    expect(screen.getByTestId("proposal-salutation-state")).toHaveTextContent(
      "Madame, Monsieur,",
    );

    await waitForAutosave();

    const headingUpdate = mockUpdateProposal.mock.calls.at(-1)?.[0];
    expect(headingUpdate).toEqual(
      expect.objectContaining({
        content: expect.stringMatching(/^Madame, Monsieur,/),
        metadata: expect.objectContaining({
          proposalDocument: expect.objectContaining({
            blocks: expect.arrayContaining([
              expect.objectContaining({
                type: "salutation",
                text: "Madame, Monsieur,",
              }),
            ]),
          }),
        }),
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete salutation inline" }),
    );
    expect(screen.getByTestId("proposal-salutation-state")).toHaveTextContent(
      "empty",
    );
  });

  it("drops stale structured blocks when Ask AI rewrites the whole draft", async () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Dear team,\n\nOriginal structured body.",
        proposalDocument: {
          schemaVersion: 1,
          kind: "letter",
          source: "structured",
          blocks: [
            {
              id: "paragraph-1",
              type: "paragraph",
              text: "Original structured body.",
            },
          ],
        },
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "balanced",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Ask AI rewrite",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_rewrite_existing",
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
    mockUpdateProposal.mockClear();

    expect(screen.getByTestId("proposal-document-state")).toHaveTextContent(
      "Original structured body.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Rewrite whole draft" }),
    );

    expect(screen.getByTestId("proposal-document-state")).toHaveTextContent(
      "no-document",
    );
    await waitForAutosave();
    expect(mockUpdateProposal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "proposal_rewrite_existing",
        content: "Whole draft rewritten by Ask AI.",
      }),
    );
    expect(
      mockUpdateProposal.mock.calls.at(-1)?.[0]?.metadata,
    ).not.toHaveProperty("proposalDocument");
  });

  it("shows populated recipient contact details after the first heading edit", async () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Dear team,\n\nDraft body.",
        proposalType: "cover_letter",
        proposalTemplateId: "workshop_proposal_margin",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Recipient visibility",
        proposalOutputMode: "preview",
        proposalHeaderShowRecipient: false,
        proposalHeaderShowRecipientDetails: false,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByTestId("proposal-recipient-visibility-state"),
    ).toHaveTextContent("recipient-hidden|details-hidden");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit recipient details from heading",
      }),
    );

    expect(
      screen.getByTestId("proposal-recipient-visibility-state"),
    ).toHaveTextContent("recipient-visible|details-visible");
  });

  it("keeps a same-draft local structured snapshot when the saved draft query is stale after refresh", async () => {
    mockSavedProposals = [
      {
        _id: "proposal_preview_existing",
        title: "Preview autosave title",
        content: "Dear team,\n\nOld server draft body.\n\nSincerely,\nAlex Martin",
        sections: [{ type: "text", content: "Old server draft body." }],
        status: "draft",
        metadata: {
          proposalType: "cover_letter",
          voicePreset: "signature",
          resolvedVoicePreset: "signature",
        },
      },
    ];
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent:
          "Dear team,\n\nNew underlined client draft body.\n\nSincerely,\nAlex Martin",
        proposalDocument: {
          schemaVersion: 1,
          kind: "letter",
          source: "structured",
          blocks: [
            {
              id: "salutation-1",
              type: "salutation",
              text: "Dear team,",
            },
            {
              id: "paragraph-1",
              type: "paragraph",
              text: "New underlined client draft body.",
              richText: {
                runs: [
                  { text: "New underlined", underline: true },
                  { text: " client draft body." },
                ],
              },
            },
            {
              id: "closing-1",
              type: "closing",
              signOff: "Sincerely,",
              signatureName: "Alex Martin",
            },
          ],
        },
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "balanced",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Preview autosave title",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_preview_existing",
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
      <MemoryRouter initialEntries={["/proposal?draftId=proposal_preview_existing"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-autosave-state")).toHaveTextContent(
        "New underlined client draft body.",
      );
    });
    expect(screen.getByTestId("proposal-autosave-state")).not.toHaveTextContent(
      "Old server draft body.",
    );
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
          status: "draft",
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
    mockAttachedCvId = "cv_alpha";
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
        <ActiveForgePanelProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Use Ochre accent" }),
    );

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
              palette: "ochre",
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
          status: "draft",
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
          status: "draft",
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

  it("applies Style 3 and keeps its palette edit in the proposal state", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
        <ActiveForgePanelProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(await screen.findByRole("button", { name: "Style 3" }));

    expect(screen.getByTestId("proposal-autosave-style")).toHaveTextContent(
      "|ink",
    );

    fireEvent.click(screen.getByRole("button", { name: "Use Cobalt accent" }));

    expect(screen.getByTestId("proposal-autosave-style")).toHaveTextContent(
      "|cobalt",
    );
  });
});
