import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";

const proposalDisplayProps: any[] = [];
let mockAttachedCvId: string | null = null;

const CV_SOURCES = {
  cv_alpha: {
    title: "Operations Associate — Alex Martin",
    name: "Alex Martin",
    role: "Operations Associate",
    email: "alex@example.com",
    phone: "+33 6 11 11 11 11",
    location: "Paris",
    linkedin: "linkedin.com/in/alex",
    website: "alex.example",
  },
  cv_beta: {
    title: "Product Lead — Bea Laurent",
    name: "Bea Laurent",
    role: "Product Lead",
    email: "bea@example.com",
    phone: "+33 6 22 22 22 22",
    location: "Lyon",
    linkedin: "linkedin.com/in/bea",
    website: "bea.example",
  },
} as const;

function sourceFor(id: string | null) {
  return id ? CV_SOURCES[id as keyof typeof CV_SOURCES] : null;
}

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: () => null,
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: { generateProposal: "functions.generateProposal" },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: {
      getCurrent: "proposalSettings.getCurrent",
      getPresets: "proposalSettings.getPresets",
    },
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
    importCv: vi.fn(),
    hydrateCvDocument: vi.fn().mockResolvedValue(null),
    deleteCv: vi.fn(),
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../components/useStructuredMistralImport", () => ({
  useStructuredMistralImport: () => ({
    enableMistral: true,
    importFile: vi.fn(),
  }),
  beginStructuredImportTimingTrace: () => null,
  logStructuredImportTiming: vi.fn(),
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT: ".pdf",
}));

vi.mock("../../lib/proposal-personalization", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/proposal-personalization")>();
  return {
    ...actual,
    buildAppProposalPersonalizationPayload: () => ({}),
    getProposalAttachedCvId: () => mockAttachedCvId,
    setProposalAttachedCvId: (id: string | null) => {
      mockAttachedCvId = id;
    },
    clearProposalAttachedCvId: () => {
      mockAttachedCvId = null;
    },
    getLocalActiveCvSnapshotById: (id: string) => {
      const source = sourceFor(id);
      return source
        ? { title: source.title, personalizationContext: null }
        : null;
    },
    getLocalCvDocumentById: (id: string | null) => {
      const source = sourceFor(id);
      return source
        ? {
            id,
            title: source.title,
            metadata: {},
            sections: [],
          }
        : null;
    },
    getLocalPersonalizationSourceByCvId: (id: string | null) => {
      const source = sourceFor(id);
      return {
        title: source?.title ?? null,
        personalizationContext: source
          ? { name: source.name, desiredPosition: source.role }
          : null,
        email: source?.email ?? null,
        phone: source?.phone ?? null,
        location: source?.location ?? null,
        linkedin: source?.linkedin ?? null,
        website: source?.website ?? null,
      };
    },
    getProposalApplicantIdentity: (source: any) => ({
      name: source.personalizationContext?.name ?? null,
      role: source.personalizationContext?.desiredPosition ?? null,
    }),
    getProposalApplicantHeaderData: (source: any) => ({
      name: source.personalizationContext?.name ?? null,
      role: source.personalizationContext?.desiredPosition ?? null,
      email: source.email ?? null,
      phone: source.phone ?? null,
      location: source.location ?? null,
      linkedin: source.linkedin ?? null,
      website: source.website ?? null,
      tag: null,
    }),
    listLocalCvPickerOptions: () =>
      Object.entries(CV_SOURCES).map(([id, source]) => ({
        id,
        title: source.title,
        isActive: id === mockAttachedCvId,
      })),
  };
});

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({
    onActiveCvChange,
  }: {
    onActiveCvChange?: (cvId: string | null) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onActiveCvChange?.("cv_alpha")}>
        Attach Alex CV
      </button>
      <button type="button" onClick={() => onActiveCvChange?.("cv_beta")}>
        Attach Bea CV
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: (props: any) => {
    proposalDisplayProps.push(props);
    return (
      <div data-testid="proposal-display">
        <button
          type="button"
          onClick={() => props.onContentChange?.("Typed body before CV.")}
        >
          Type body
        </button>
        <button
          type="button"
          onClick={() => props.onRailTitleChange?.("Manual Applicant")}
        >
          Edit applicant name
        </button>
      </div>
    );
  },
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

describe("ProposalForge heading reactivity", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockAttachedCvId = null;
    proposalDisplayProps.length = 0;
  });

  function pickCv(title: string): void {
    fireEvent.click(
      screen.getByRole("button", {
        name: /(?:Pick a CV|Attached to this draft)/,
      }),
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: title }));
  }

  it("hydrates heading from an attached CV even after body text was typed first", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Type body" }));
    pickCv("Operations Associate — Alex Martin");

    await waitFor(() => {
      expect(proposalDisplayProps.at(-1)).toMatchObject({
        railTitle: "Alex Martin",
        railMeta: "Operations Associate",
        contactLine:
          "alex@example.com · +33 6 11 11 11 11 · Paris · linkedin.com/in/alex · alex.example",
      });
    });
  });

  it("updates auto-managed heading fields when the attached CV changes", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    pickCv("Operations Associate — Alex Martin");
    await waitFor(() => {
      expect(proposalDisplayProps.at(-1)?.railTitle).toBe("Alex Martin");
    });

    pickCv("Product Lead — Bea Laurent");

    await waitFor(() => {
      expect(proposalDisplayProps.at(-1)).toMatchObject({
        railTitle: "Bea Laurent",
        railMeta: "Product Lead",
        contactLine:
          "bea@example.com · +33 6 22 22 22 22 · Lyon · linkedin.com/in/bea · bea.example",
      });
    });
  });

  it("preserves a manually edited heading field while refreshing the other CV-owned fields", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    pickCv("Operations Associate — Alex Martin");
    await waitFor(() => {
      expect(proposalDisplayProps.at(-1)?.railTitle).toBe("Alex Martin");
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit applicant name" }));
    pickCv("Product Lead — Bea Laurent");

    await waitFor(() => {
      expect(proposalDisplayProps.at(-1)).toMatchObject({
        railTitle: "Manual Applicant",
        railMeta: "Product Lead",
        contactLine:
          "bea@example.com · +33 6 22 22 22 22 · Lyon · linkedin.com/in/bea · bea.example",
      });
    });
  });
});
