import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { ProposalForge as ProposalForgePage } from "../ProposalForge";
import {
  readStoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";
import { writeStoredDocumentPageSizePreference } from "../../lib/document-page-size";
import {
  PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
  readStoredProposalComposeDraft,
} from "../../lib/proposal-workspace-state";

const ATTACHED_CV_STORAGE_KEY = "dasti:proposal-attached-cv-id:v1";

const mockProposalTopbarState = vi.hoisted(() => ({
  registration: null as null | {
    onDuplicateProposal: () => void;
    onDeleteProposal: () => void;
    onPageSizePreferenceChange: (
      preference: "auto" | "a4" | "letter",
    ) => void;
  },
}));
const mockUpdateProposal = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("../../contexts/ProposalForgeTopbarContext", () => ({
  useRegisterProposalForgeTopbar: (
    registration: typeof mockProposalTopbarState.registration,
  ) => {
    mockProposalTopbarState.registration = registration;
  },
}));

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

const SAVED_PROPOSALS = [
  {
    _id: "proposal_beta",
    _creationTime: 1710000000000,
    title: "Saved proposal beta",
    content: "Dear team,\n\nSaved proposal content.\n\nBest,",
    status: "saved",
    updatedAt: 1710000000000,
    createdAt: 1710000000000,
    sections: [{ type: "text", content: "Saved proposal content." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      requestedVoicePreset: "signature",
      sourceCvId: "cv_alpha",
      styleLinkMode: "inherit_cv",
      templateId: "swiss_margin",
      templateBundleId: "swiss_serif",
      verbatiStyleSlotId: 1,
      verbatiStyleSlotSource: "factory",
      verbatiStyleSlotNameSnapshot: "Style 1",
      verbatiStyleBaseSnapshot: {
        typography: "signature",
        palette: "bordeaux",
      },
      documentStyleVersion: 1,
      pageSize: "letter",
      resolvedLanguage: "fr",
      verbatiStyle: {
        layout: "swiss",
        typography: "signature",
        palette: "bordeaux",
      },
      sourceUrl: "https://www.linkedin.com/jobs/view/123456",
      platform: "linkedin",
      sourceJobTitle: "Operations Lead",
      sourceJobDescription:
        "Lead recurring operations and keep cross-team communication on track.",
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
            text: "Saved proposal content.",
          },
          {
            id: "closing-1",
            type: "closing",
            signOff: "Best,",
            signatureName: "",
          },
        ],
      },
    },
  },
  {
    _id: "proposal_custom_salutation",
    _creationTime: 1710000000250,
    title: "Saved custom salutation",
    content: "o\n\nSaved proposal content.\n\nBest,",
    status: "saved",
    updatedAt: 1710000000250,
    createdAt: 1710000000250,
    sections: [{ type: "text", content: "Saved proposal content." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      requestedVoicePreset: "signature",
      proposalDocument: {
        schemaVersion: 1,
        kind: "letter",
        source: "structured",
        blocks: [
          {
            id: "salutation-custom",
            type: "salutation",
            text: "o",
          },
          {
            id: "paragraph-custom",
            type: "paragraph",
            text: "Saved proposal content.",
          },
          {
            id: "closing-custom",
            type: "closing",
            signOff: "Best,",
            signatureName: "",
          },
        ],
      },
    },
  },
  {
    _id: "proposal_local_saved",
    _creationTime: 1710000000500,
    title: "Saved proposal local",
    content: "Dear client,\n\nDetached saved proposal content.\n\nBest,",
    status: "saved",
    updatedAt: 1710000000500,
    createdAt: 1710000000500,
    sections: [{ type: "text", content: "Detached saved proposal content." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      requestedVoicePreset: "signature",
      sourceCvId: "cv_alpha",
      styleLinkMode: "proposal_local",
      templateId: "swiss_margin",
      verbatiStyle: {
        layout: "swiss",
        typography: "signature",
        palette: "bordeaux",
      },
      sourceUrl: "https://example.com/jobs/local-123",
      platform: "company_website",
      sourceJobDescription:
        "Build polished client proposals with stable saved styling.",
    },
  },
  {
    _id: "proposal_gamma",
    _creationTime: 1710000001000,
    title: "Saved proposal gamma",
    content:
      "Dear reader,\n\nSaved proposal without brief metadata.\n\nRegards,",
    status: "saved",
    updatedAt: 1710000001000,
    createdAt: 1710000001000,
    sections: [
      { type: "text", content: "Saved proposal without brief metadata." },
    ],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      requestedVoicePreset: "signature",
    },
  },
  {
    _id: "proposal_auto",
    _creationTime: 1710000002000,
    title: "Saved proposal auto",
    content: "Dear team,\n\nAuto tone saved proposal.\n\nBest,",
    status: "saved",
    updatedAt: 1710000002000,
    createdAt: 1710000002000,
    sections: [{ type: "text", content: "Auto tone saved proposal." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "expert",
      requestedVoicePreset: null,
      resolvedVoicePreset: "expert",
      sourceUrl: "https://example.com/jobs/operations-auto",
      platform: "company_website",
      sourceJobDescription:
        "Coordinate operations, keep processes clean, and support team communication.",
    },
  },
  {
    _id: "proposal_draft_restore",
    _creationTime: 1710000003000,
    title: "Draft restore title",
    content: "Dear team,\n\nRestored draft proposal content.\n\nBest,",
    status: "draft",
    updatedAt: 1710000003000,
    createdAt: 1710000003000,
    sections: [{ type: "text", content: "Restored draft proposal content." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      requestedVoicePreset: "signature",
      templateId: "swiss_margin",
      styleLinkMode: "proposal_local",
    },
  },
] as const;

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
  useMutation: (query: string) =>
    query === "updateProposalPublic.default"
      ? mockUpdateProposal
      : vi.fn().mockResolvedValue(undefined),
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
    window.localStorage.removeItem("dasti:proposal-attached-cv-id:v1");
  },
  getActiveLocalPersonalizationSource: () => ({
    title: mockAttachedCvId === "cv_alpha" ? "Alex Martin Resume" : null,
    personalizationContext: null,
  }),
  getLocalPersonalizationSourceByCvId: (id: string | null | undefined) => ({
    title: id === "cv_alpha" ? "Alex Martin Resume" : null,
    personalizationContext: null,
  }),
  getLocalActiveCvSnapshotById: (id: string) =>
    id === "cv_alpha" ? { title: "Alex Martin Resume" } : null,
  getLocalCvDocumentById: (id: string) =>
    id === "cv_alpha" ? mockSourceCv : null,
  listLocalCvPickerOptions: () => [
    {
      id: "cv_alpha",
      title: "Alex Martin Resume",
      subtitle: "Operations Associate",
      isActive: mockAttachedCvId === "cv_alpha",
    },
  ],
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
  getProposalAttachedCvId: () =>
    mockAttachedCvId ??
    window.localStorage.getItem("dasti:proposal-attached-cv-id:v1"),
  getProposalAttachedCvLocalDocument: () =>
    (mockAttachedCvId ??
      window.localStorage.getItem("dasti:proposal-attached-cv-id:v1")) ===
    "cv_alpha"
      ? mockSourceCv
      : null,
  PROPOSAL_ATTACHED_CV_STORAGE_KEY: "dasti:proposal-attached-cv-id:v1",
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
  setProposalAttachedCvId: (id: string) => {
    mockAttachedCvId = id;
    window.localStorage.setItem("dasti:proposal-attached-cv-id:v1", id);
  },
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: (props: {
    cvPickerOpen?: boolean;
    cvPickerRequestKey?: number;
    onValuesChange?: (values: any) => void;
  }) => {
    const storedDraft = JSON.parse(
      window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
    ) as {
      jobTitle?: string;
      jobDescription?: string;
      proposalType?: string;
      voicePreset?: string | null;
      toneTuning?: string | null;
      characterLimitMode?: string | null;
      characterLimitValue?: number | null;
    };

    React.useEffect(() => {
      props.onValuesChange?.({
        jobTitle: storedDraft.jobTitle ?? "",
        jobDescription: storedDraft.jobDescription ?? "",
        proposalType: storedDraft.proposalType ?? "cover_letter",
        voicePreset:
          storedDraft.voicePreset === undefined
            ? undefined
            : storedDraft.voicePreset,
        toneTuning: storedDraft.toneTuning ?? null,
        characterLimitMode: storedDraft.characterLimitMode ?? "none",
        characterLimitValue: storedDraft.characterLimitValue ?? null,
      });
    }, [
      props,
      storedDraft.characterLimitMode,
      storedDraft.characterLimitValue,
      storedDraft.jobDescription,
      storedDraft.jobTitle,
      storedDraft.proposalType,
      storedDraft.toneTuning,
      storedDraft.voicePreset,
    ]);

    return (
      <div>
        <div data-testid="compose-job-title">
          {storedDraft.jobTitle ?? "empty-title"}
        </div>
        <div data-testid="compose-job-description">
          {storedDraft.jobDescription ?? "empty-description"}
        </div>
        <div data-testid="compose-cv-picker-state">
          {props.cvPickerOpen ? "open" : "closed"}
        </div>
        <div data-testid="compose-cv-picker-request-key">
          {props.cvPickerRequestKey ?? 0}
        </div>
      </div>
    );
  },
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    proposalContent,
    proposalDocument,
    salutationValue,
    documentTitle,
    mode,
    stylePreset,
    templateId,
    documentLanguage,
    pageSize,
    onContentCommit,
  }: {
    proposalContent: string | null;
    proposalDocument?: { blocks?: Array<{ text?: string }> } | null;
    salutationValue?: string | null;
    documentTitle?: string | null;
    mode?: "preview" | "edit";
    stylePreset?: {
      layout?: string | null;
      palette?: string | null;
    } | null;
    templateId?: string | null;
    documentLanguage?: string | null;
    pageSize?: { id?: string | null } | null;
    onContentCommit?: (snapshot?: {
      proposalContent?: string | null;
      proposalDocument?: null;
    }) => void;
  }) => (
    <>
      <div data-testid="proposal-display-state">
        {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}|
        {mode ?? "preview"}|{stylePreset?.layout ?? "none"}|
        {stylePreset?.palette ?? "none"}|
        {templateId ?? "no-template"}|
        {proposalDocument?.blocks?.map((block) => block.text).join(" ") ?? "no-document"}
      </div>
      <div data-testid="proposal-salutation-state">
        {salutationValue ?? "empty"}
      </div>
      <div data-testid="proposal-document-language">
        {documentLanguage ?? "no-language"}
      </div>
      <div data-testid="proposal-page-size">{pageSize?.id ?? "no-size"}</div>
      {onContentCommit ? (
        <button
          type="button"
          onClick={() =>
            onContentCommit({
              proposalContent: "Edited saved proposal content.",
              proposalDocument: null,
            })
          }
        >
          Commit saved content edit
        </button>
      ) : null}
    </>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: ({
    selectedProposalId,
    savedViewActions,
  }: {
    selectedProposalId?: string | null;
    savedViewActions?: React.ReactNode;
  }) => (
    <div data-testid="saved-proposals-list">
      {savedViewActions ?? null}
      {selectedProposalId ?? "no-selection"}
    </div>
  ),
}));

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="proposal-location">
      {`${location.pathname}${location.search}`}
    </div>
  );
}

function ProposalTopbarActionsProbe({
  includeReviewControls = false,
}: {
  includeReviewControls?: boolean;
}): JSX.Element {
  const navigate = useNavigate();
  return (
    <div role="group" aria-label="Saved proposal actions">
      <button
        type="button"
        onClick={() =>
          mockProposalTopbarState.registration?.onDuplicateProposal()
        }
      >
        Duplicate to draft
      </button>
      <button
        type="button"
        onClick={() => mockProposalTopbarState.registration?.onDeleteProposal()}
      >
        Delete proposal
      </button>
      {includeReviewControls ? (
        <>
          <button
            type="button"
            onClick={() =>
              mockProposalTopbarState.registration?.onPageSizePreferenceChange(
                "a4",
              )
            }
          >
            Use A4
          </button>
          <button
            type="button"
            onClick={() =>
              mockProposalTopbarState.registration?.onPageSizePreferenceChange(
                "auto",
              )
            }
          >
            Use Auto
          </button>
          <button type="button" onClick={() => navigate("/proposal")}>
            Return to compose
          </button>
        </>
      ) : null}
    </div>
  );
}

function ProposalForge({
  includeReviewControls = false,
}: {
  includeReviewControls?: boolean;
}): JSX.Element {
  return (
    <>
      <ProposalForgePage />
      <ProposalTopbarActionsProbe
        includeReviewControls={includeReviewControls}
      />
    </>
  );
}

describe("ProposalForge saved view", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockAttachedCvId = null;
    mockProposalTopbarState.registration = null;
    mockUpdateProposal.mockClear();
  });

  it("restores the structured document stored on an opened saved proposal", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/proposal?view=saved&id=proposal_custom_salutation",
        ]}
      >
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).not.toHaveTextContent(
        "no-document",
      );
    });
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "o Saved proposal content.",
    );
    expect(screen.getByTestId("proposal-salutation-state")).toHaveTextContent(
      "o",
    );
  });

  it("keeps the selected saved letter loaded when applying a gallery template intent", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/proposal?view=saved&id=proposal_beta&templateId=modernist_signal&styleSlot=direct&pageSize=letter&templateStart=1",
        ]}
      >
        <LocationProbe />
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const state = screen.getByTestId("proposal-display-state");
      expect(state).toHaveTextContent("Saved proposal content.");
      expect(state).toHaveTextContent("modernist_signal");
    });
    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({ id: "proposal_beta" }),
      );
    });
    const persistedMetadata = mockUpdateProposal.mock.calls.find(
      ([input]) => input.id === "proposal_beta",
    )?.[0]?.metadata;
    expect(persistedMetadata).toEqual(
      expect.objectContaining({
        templateId: "modernist_signal",
        verbatiStyle: expect.objectContaining({
          typography: "quiet-editorial",
          palette: "ink",
        }),
        verbatiStyleSlotId: 2,
        verbatiStyleSlotSource: "factory",
        verbatiStyleSlotNameSnapshot: "Style 2",
        documentStyleVersion: 1,
      }),
    );
    expect(persistedMetadata).not.toHaveProperty("templateBundleId");
    await waitFor(() => {
      expect(screen.getByTestId("proposal-location")).toHaveTextContent(
        /^\/proposal\?view=saved&id=proposal_beta$/,
      );
    });
  });

  it("keeps a failed saved gallery template intent in the URL for retry", async () => {
    mockUpdateProposal.mockRejectedValueOnce(new Error("offline"));

    render(
      <MemoryRouter
        initialEntries={[
          "/proposal?view=saved&id=proposal_beta&templateId=modernist_signal",
        ]}
      >
        <LocationProbe />
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({ id: "proposal_beta" }),
      );
    });
    expect(screen.getByTestId("proposal-location")).toHaveTextContent(
      "/proposal?view=saved&id=proposal_beta&templateId=modernist_signal",
    );
  });

  it("restores a saved proposal's persisted page size", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("proposal-page-size")).toHaveTextContent(
      "letter",
    );
  });

  it("preserves the saved page size when committing a content edit", async () => {
    writeStoredDocumentPageSizePreference("a4");
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Commit saved content edit" }),
    );

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "proposal_beta",
          content: "Edited saved proposal content.",
          metadata: expect.objectContaining({ pageSize: "letter" }),
        }),
      );
    });
  });

  it("consumes a stale page-size query after the user changes the saved format", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/proposal?view=saved&id=proposal_beta&pageSize=letter",
        ]}
      >
        <LocationProbe />
        <ProposalForge includeReviewControls />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Use A4" }));

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "proposal_beta",
          metadata: expect.objectContaining({ pageSize: "a4" }),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("proposal-location")).toHaveTextContent(
        /^\/proposal\?view=saved&id=proposal_beta$/,
      );
    });
  });

  it("keeps Auto page size on a saved proposal without a compose autosave overwrite", async () => {
    writeStoredDocumentPageSizePreference("letter");
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge includeReviewControls />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Use Auto" }));

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "proposal_beta",
          clearMetadata: { pageSize: true },
          metadata: expect.not.objectContaining({ pageSize: expect.anything() }),
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1_200));
    });

    expect(mockUpdateProposal).toHaveBeenCalledTimes(1);
    expect(mockUpdateProposal.mock.calls[0]?.[0]?.metadata).not.toHaveProperty(
      "pageSize",
    );
  });

  it("keeps a saved layout change out of the active compose draft", async () => {
    writeStoredProposalOutputDraft({
      proposalContent: "Independent compose draft.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "editorial_wide",
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "balanced",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Independent compose draft",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_compose",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: null,
      characterLimitValue: null,
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/proposal?view=saved&id=proposal_beta&templateId=modernist_signal",
        ]}
      >
        <LocationProbe />
        <ProposalForge includeReviewControls />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({ id: "proposal_beta" }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Return to compose" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-location")).toHaveTextContent(
        /^\/proposal$/,
      );
      const state = screen.getByTestId("proposal-display-state");
      expect(state).toHaveTextContent("Independent compose draft.");
      expect(state).toHaveTextContent("editorial_wide");
      expect(state).not.toHaveTextContent("Saved proposal content.");
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1_200));
    });
    const savedUpdates = mockUpdateProposal.mock.calls.filter(
      ([payload]) => payload.id === "proposal_beta",
    );
    const composeUpdates = mockUpdateProposal.mock.calls.filter(
      ([payload]) => payload.id === "proposal_compose",
    );
    expect(savedUpdates.length).toBeGreaterThan(0);
    expect(savedUpdates).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            metadata: expect.objectContaining({
              templateId: "modernist_signal",
            }),
          }),
        ],
      ]),
    );
    expect(composeUpdates.length).toBeGreaterThan(0);
    for (const [payload] of composeUpdates) {
      expect(payload).toEqual(
        expect.objectContaining({
          content: "Independent compose draft.",
          metadata: expect.objectContaining({
            templateId: "editorial_wide",
          }),
        }),
      );
    }
  });

  it("renders a saved letter with its document locale instead of the UI locale", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-document-language")).toHaveTextContent(
        "fr",
      );
    });
  });

  it("opens a saved proposal without mutating the current draft", async () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Existing draft title",
        jobDescription: "Existing draft brief.",
        proposalType: "cover_letter",
        voicePreset: "signature",
      }),
    );
    writeStoredProposalOutputDraft({
      proposalContent: "Existing draft output.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Existing draft output",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_current_draft",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: null,
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <LocationProbe />
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "Saved proposal content.",
      );
    });

    expect(screen.getByTestId("proposal-location")).toHaveTextContent(
      "/proposal?view=saved&id=proposal_beta",
    );
    expect(readStoredProposalComposeDraft()).toMatchObject({
      jobTitle: "Existing draft title",
      jobDescription: "Existing draft brief.",
    });
    expect(readStoredProposalOutputDraft()).toMatchObject({
      proposalContent: "Existing draft output.",
      generatedProposalId: "proposal_current_draft",
    });
  });

  it("clears stale structured output when restoring a draftId proposal", async () => {
    writeStoredProposalOutputDraft({
      proposalContent: "Stale global output content.",
      proposalDocument: {
        schemaVersion: 1,
        kind: "letter",
        source: "structured",
        blocks: [
          {
            id: "stale",
            type: "paragraph",
            text: "Stale structured document from another letter.",
          },
        ],
      },
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Stale global title",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "stale_global_id",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: null,
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal?draftId=proposal_draft_restore"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const state = screen.getByTestId("proposal-display-state");
      expect(state).toHaveTextContent("Draft restore title");
      expect(state).toHaveTextContent("Restored draft proposal content.");
      expect(state).toHaveTextContent("no-document");
      expect(state).not.toHaveTextContent("Stale structured document");
    });
  });

  it("applies a gallery template intent after restoring a draftId proposal", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/proposal?draftId=proposal_draft_restore&templateId=modernist_signal&styleSlot=direct&pageSize=a4&templateStart=1",
        ]}
      >
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const state = screen.getByTestId("proposal-display-state");
      expect(state).toHaveTextContent("Restored draft proposal content.");
      expect(state).toHaveTextContent("modernist_signal");
      expect(state).not.toHaveTextContent("swiss_margin");
    });

    await waitFor(
      () => {
        expect(mockUpdateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "proposal_draft_restore",
            metadata: expect.objectContaining({
              pageSize: "a4",
              templateId: "modernist_signal",
            }),
          }),
        );
      },
      { timeout: 2_500 },
    );
  });

  it("exposes saved proposal actions through the document topbar", () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Back to draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Duplicate to draft" }),
    ).toBeInTheDocument();
    const toolbar = screen.getByRole("group", {
      name: "Saved proposal actions",
    });
    const actionButtons = within(toolbar)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(actionButtons).toEqual(["Duplicate to draft", "Delete proposal"]);
    expect(toolbar).not.toHaveTextContent("Based on CV: Alex Martin Resume");
    expect(
      within(toolbar).queryByRole("group", {
        name: "Saved proposal status",
      }),
    ).not.toBeInTheDocument();
  });

  it("treats bare proposal id links as saved view for backward compatibility", () => {
    render(
      <MemoryRouter initialEntries={["/proposal?id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Back to draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Duplicate to draft" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Saved proposal content.",
    );
  });

  it("copies saved proposal content and source brief back into the live draft explicitly", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "Saved proposal content.",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "Saved proposal beta",
      );
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "Saved proposal content.",
      );
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "|preview",
      );
      expect(screen.getByTestId("compose-job-title")).toHaveTextContent(
        "Operations Lead",
      );
    });
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "Lead recurring operations and keep cross-team communication on track.",
    );
    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({
      sourceUrl: "https://www.linkedin.com/jobs/view/123456",
      platform: "linkedin",
    });
    expect(screen.getByTestId("compose-cv-picker-state")).toHaveTextContent(
      "closed",
    );
    expect(
      screen.getByTestId("compose-cv-picker-request-key"),
    ).toHaveTextContent("0");
    expect(window.localStorage.getItem(ATTACHED_CV_STORAGE_KEY)).toBe(
      "cv_alpha",
    );
  });

  it("keeps saved proposal cv provenance visible on reopen even when the saved artifact is stable", () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const toolbar = screen.getByRole("group", {
      name: "Saved proposal actions",
    });
    expect(toolbar).not.toHaveTextContent("Based on CV: Alex Martin Resume");
    expect(
      within(toolbar as HTMLElement).queryByRole("group", {
        name: "Saved proposal status",
      }),
    ).not.toBeInTheDocument();
  });

  it("duplicates the persisted inherited-style row instead of a stale local draft when reopening the same proposal id", async () => {
    window.localStorage.setItem(ATTACHED_CV_STORAGE_KEY, "cv_alpha");
    mockAttachedCvId = "cv_alpha";
    writeStoredProposalOutputDraft({
      proposalContent: "Stale inherited draft body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "two_column_rail",
      proposalVerbatiStyle: {
        layout: "editorial",
        typography: "engaging",
        palette: "encre",
      },
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Stale inherited draft",
      proposalDocumentMeta: "Stale compose output",
      generatedProposalId: "proposal_beta",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: null,
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    await waitFor(() => {
      const state = screen.getByTestId("proposal-display-state");
      expect(state).toHaveTextContent("Saved proposal beta");
      expect(state).toHaveTextContent("Saved proposal content.");
      expect(state).toHaveTextContent("|preview|editorial|encre");
    });
  });

  it("duplicates the persisted local-style row instead of a stale inherited draft when reopening the same proposal id", async () => {
    window.localStorage.setItem(ATTACHED_CV_STORAGE_KEY, "cv_alpha");
    mockAttachedCvId = "cv_alpha";
    writeStoredProposalOutputDraft({
      proposalContent: "Stale detached draft body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "two_column_rail",
      proposalVerbatiStyle: {
        layout: "editorial",
        typography: "engaging",
        palette: "encre",
      },
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Stale detached draft",
      proposalDocumentMeta: "Stale compose output",
      generatedProposalId: "proposal_local_saved",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: null,
      characterLimitValue: null,
    });

    render(
      <MemoryRouter
        initialEntries={["/proposal?view=saved&id=proposal_local_saved"]}
      >
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    await waitFor(() => {
      const state = screen.getByTestId("proposal-display-state");
      expect(state).toHaveTextContent("Saved proposal local");
      expect(state).toHaveTextContent("Detached saved proposal content.");
      expect(state).toHaveTextContent("|preview|swiss|bordeaux");
    });
  });

  it("keeps the existing compose brief when the saved proposal lacks source brief metadata", async () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Marketing Specialist",
        jobDescription: "Existing compose brief should survive saved reopen.",
        proposalType: "cover_letter",
        voicePreset: "signature",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_gamma"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "Saved proposal without brief metadata.",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    await waitFor(() => {
      expect(screen.getByTestId("compose-job-title")).toHaveTextContent(
        "Saved proposal gamma",
      );
    });
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "Existing compose brief should survive saved reopen.",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Saved proposal gamma",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Saved proposal without brief metadata.",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "|preview",
    );
  });

  it("preserves Auto when a saved proposal is duplicated back into the live draft", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_auto"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "Auto tone saved proposal.",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ??
            "{}",
        ),
      ).toMatchObject({
        jobTitle: "Saved proposal auto",
        jobDescription:
          "Coordinate operations, keep processes clean, and support team communication.",
        proposalType: "cover_letter",
        voicePreset: null,
        sourceUrl: "https://example.com/jobs/operations-auto",
        platform: "company_website",
      });
    });

    await waitFor(() => {
      expect(readStoredProposalOutputDraft()).toEqual(
        expect.objectContaining({
          proposalVoicePreset: "expert",
          sourceComposeDraft: expect.objectContaining({
            voicePreset: null,
          }),
        }),
      );
    });
  });
});
