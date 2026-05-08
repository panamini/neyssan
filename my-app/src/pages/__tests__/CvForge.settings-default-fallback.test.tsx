import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { CvForge } from "../CvForge";

const { useCvLibraryMock, mockDocumentStylePresets } = vi.hoisted(() => ({
  useCvLibraryMock: vi.fn(),
  mockDocumentStylePresets: {
    current: {
      preset1: null,
      preset2: {
        fontPairId: "quiet-editorial",
        styleChoice: "balanced",
        paletteOverride: "cobalt",
        accentHex: null,
        voicePreset: null,
        name: "Style 2",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "cobalt",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
        signatureSettings: {
          mode: "auto",
          fontId: null,
          imageDataUrl: null,
        },
      },
      preset3: null,
      activeSlot: 2,
    },
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    jobsPublic: {
      getById: "jobsPublic.getById",
      setResumeForJob: "jobsPublic.setResumeForJob",
      setDefaultResume: "jobsPublic.setDefaultResume",
    },
    proposalSettings: {
      getCurrent: "proposalSettings.getCurrent",
      getPresets: "proposalSettings.getPresets",
    },
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
  })),
  useMutation: vi.fn(() => vi.fn(async () => undefined)),
  useAction: vi.fn(() => vi.fn(async () => undefined)),
  useQuery: vi.fn((reference: string, args?: unknown) => {
    if (reference === "proposalSettings.getCurrent") {
      return {
        voicePreset: "engaging",
        savedVoicePreset: "engaging",
        templateId: "proposal_standard",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
        signatureSettings: {
          mode: "auto",
          fontId: null,
          imageDataUrl: null,
        },
      };
    }

    if (reference === "proposalSettings.getPresets") {
      return mockDocumentStylePresets.current;
    }

    return args === "skip" ? undefined : undefined;
  }),
}));

vi.mock("../../components/ProfileReviewCard", () => ({
  ProfileReviewCard: ({ cvId }: { cvId?: string }) => (
    <div>Mock profile editor {cvId ?? "none"}</div>
  ),
}));

vi.mock("../../components/ProposalColorPickerPopover", () => ({
  ProposalColorPickerPopover: ({
    isOpen,
    onHexChange,
  }: {
    isOpen: boolean;
    onHexChange: (hex: string) => void;
  }) =>
    isOpen ? (
      <button
        type="button"
        onClick={() => onHexChange("#A1B2C3")}
      >
        Pick custom #A1B2C3
      </button>
    ) : null,
}));

vi.mock("../../features/verbati/VerbatiResumePreview", () => ({
  VerbatiResumePreview: ({
    stylePreset,
  }: {
    stylePreset?: {
      layout?: string;
      typography?: string;
      palette?: string;
      accentHex?: string;
    } | null;
  }) => (
    <div>
      Preview style: {stylePreset?.layout ?? "none"}|
      {stylePreset?.typography ?? "none"}|{stylePreset?.palette ?? "none"}|
      {stylePreset?.accentHex ?? "none"}
    </div>
  ),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../components/useStructuredMistralImport", () => ({
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT: ".pdf",
  useStructuredMistralImport: () => ({
    importFile: vi.fn(),
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => useCvLibraryMock(),
}));

function buildBlankCv(id = "cv_blank") {
  const now = "2026-04-17T12:00:00.000Z";
  return {
    id,
    title: "Untitled CV",
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    sections: [],
  };
}

function buildCvLibraryState(overrides: Record<string, unknown> = {}) {
  return {
    currentCv: null,
    currentCvId: null,
    createNewCv: vi.fn(async () => undefined),
    importCv: vi.fn(),
    cvs: [],
    isLibraryHydrated: true,
    lastLibraryFetchFailed: false,
    loadCv: vi.fn(() => true),
    saveCurrentCvStyleOnly: vi.fn(async () => undefined),
    ...overrides,
  };
}

function getStyleSlotButton(slot: 1 | 2 | 3): HTMLButtonElement {
  const label = `Style ${slot}`;
  const button = screen
    .getAllByRole("button")
    .find((element): element is HTMLButtonElement =>
      element.textContent?.startsWith(label) ?? false,
    );
  if (!button) {
    throw new Error(`Missing ${label} button`);
  }
  return button;
}

describe("CvForge settings style fallback", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCvLibraryMock.mockReset();
    mockDocumentStylePresets.current = {
      preset1: null,
      preset2: {
        fontPairId: "quiet-editorial",
        styleChoice: "balanced",
        paletteOverride: "cobalt",
        accentHex: null,
        voicePreset: null,
        name: "Style 2",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "cobalt",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
        signatureSettings: {
          mode: "auto",
          fontId: null,
          imageDataUrl: null,
        },
      },
      preset3: null,
      activeSlot: 2,
    };
  });

  it("uses the active Settings style for a styleless CV instead of the factory default", async () => {
    const user = userEvent.setup();
    const currentCv = buildBlankCv("cv_styleless");
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({ currentCv, cvs: [currentCv] }),
    );

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_styleless"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));

    expect(screen.getByText(/Preview style: .*quiet-editorial.*cobalt/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Preview style: .*geist-baskervville/i),
    ).not.toBeInTheDocument();
  });

  it("applies Settings Style 2 Cobalt when selecting the Style 2 pill", async () => {
    const user = userEvent.setup();
    const currentCv = {
      ...buildBlankCv("cv_sage"),
      metadata: {
        ...buildBlankCv("cv_sage").metadata,
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      },
    };
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({ currentCv, cvs: [currentCv] }),
    );

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_sage"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));
    await user.click(screen.getByRole("tab", { name: "Style" }));
    await user.click(getStyleSlotButton(2));

    expect(screen.getByText(/Preview style: .*quiet-editorial.*cobalt/i)).toBeInTheDocument();
    expect(screen.queryByText(/Preview style: .*sauge/i)).not.toBeInTheDocument();
  });

  it("marks a selected Settings style custom after Settings changed and resets to the latest Settings style", async () => {
    const user = userEvent.setup();
    const saveCurrentCvStyleOnly = vi.fn(async () => undefined);
    const currentCv = {
      ...buildBlankCv("cv_old_style_2"),
      metadata: {
        ...buildBlankCv("cv_old_style_2").metadata,
        verbatiStyleSlotId: 2,
        verbatiStyleSlotSource: "settings",
        verbatiStyleSlotNameSnapshot: "Style 2",
        verbatiStyleBaseSnapshot: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      },
    };
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv,
        cvs: [currentCv],
        saveCurrentCvStyleOnly,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_old_style_2"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));
    await user.click(screen.getByRole("tab", { name: "Style" }));

    expect(getStyleSlotButton(2)).toHaveTextContent(
      "Style 2 · Custom",
    );

    await user.click(screen.getByRole("button", { name: "Reset Style 2" }));

    expect(screen.getByText(/Preview style: .*quiet-editorial.*cobalt/i)).toBeInTheDocument();
    expect(saveCurrentCvStyleOnly).toHaveBeenCalledWith(
      expect.objectContaining({
        typography: "quiet-editorial",
        palette: "cobalt",
        resumeTemplateId: "workshop_resume_twocol_ats",
      }),
      expect.objectContaining({
        verbatiStyleSlotId: 2,
        verbatiStyleSlotSource: "settings",
      }),
    );
  });

  it("reselects a custom selected Style 2 from latest Settings instead of preserving stale Sage", async () => {
    const user = userEvent.setup();
    const saveCurrentCvStyleOnly = vi.fn(async () => undefined);
    const currentCv = {
      ...buildBlankCv("cv_reselect_old_style_2"),
      metadata: {
        ...buildBlankCv("cv_reselect_old_style_2").metadata,
        verbatiStyleSlotId: 2,
        verbatiStyleSlotSource: "settings",
        verbatiStyleSlotNameSnapshot: "Style 2",
        verbatiStyleBaseSnapshot: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      },
    };
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv,
        cvs: [currentCv],
        saveCurrentCvStyleOnly,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_reselect_old_style_2"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));
    await user.click(screen.getByRole("tab", { name: "Style" }));

    expect(getStyleSlotButton(2)).toHaveTextContent("Style 2 · Custom");

    await user.click(getStyleSlotButton(2));

    expect(screen.getByText(/Preview style: .*quiet-editorial.*cobalt/i)).toBeInTheDocument();
    expect(screen.queryByText(/Preview style: .*sauge/i)).not.toBeInTheDocument();
    expect(saveCurrentCvStyleOnly).toHaveBeenCalledWith(
      expect.objectContaining({
        typography: "quiet-editorial",
        palette: "cobalt",
        resumeTemplateId: "workshop_resume_twocol_ats",
      }),
      expect.objectContaining({
        verbatiStyleSlotId: 2,
        verbatiStyleSlotSource: "settings",
        verbatiStyleBaseSnapshot: expect.objectContaining({
          palette: "cobalt",
        }),
      }),
    );
  });

  it("lets CV Forge pick a custom color for a selected Settings style", async () => {
    const user = userEvent.setup();
    const saveCurrentCvStyleOnly = vi.fn(async () => undefined);
    const currentCv = buildBlankCv("cv_custom_color");
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv,
        cvs: [currentCv],
        saveCurrentCvStyleOnly,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_custom_color"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));
    await user.click(screen.getByRole("tab", { name: "Style" }));
    await user.click(getStyleSlotButton(2));
    await user.click(
      screen.getByRole("button", { name: "Open custom color picker" }),
    );
    await user.click(screen.getByRole("button", { name: "Pick custom #A1B2C3" }));

    expect(getStyleSlotButton(2)).toHaveTextContent("Style 2 · Custom");
    expect(screen.getByText(/Preview style: .*custom.*#A1B2C3/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open custom color picker" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
