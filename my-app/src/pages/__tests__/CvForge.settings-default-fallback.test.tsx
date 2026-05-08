import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { CvForge } from "../CvForge";

const { useCvLibraryMock } = vi.hoisted(() => ({
  useCvLibraryMock: vi.fn(),
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
          palette: "ink",
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
      return {
        preset1: null,
        preset2: {
          fontPairId: "quiet-editorial",
          styleChoice: "balanced",
          paletteOverride: "ink",
          accentHex: null,
          voicePreset: null,
          name: "Style 2",
          verbatiStyle: {
            familyId: "workshop",
            layout: "workshop",
            typography: "quiet-editorial",
            palette: "ink",
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
    }

    return args === "skip" ? undefined : undefined;
  }),
}));

vi.mock("../../components/ProfileReviewCard", () => ({
  ProfileReviewCard: ({ cvId }: { cvId?: string }) => (
    <div>Mock profile editor {cvId ?? "none"}</div>
  ),
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

describe("CvForge settings style fallback", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCvLibraryMock.mockReset();
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

    expect(screen.getByText(/Preview style: .*quiet-editorial.*ink/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Preview style: .*geist-baskervville/i),
    ).not.toBeInTheDocument();
  });
});
