import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";

const mockCurrentProposalSettings = {
  voicePreset: "signature",
  savedVoicePreset: "signature",
  templateId: "editorial_wide",
  styleChoice: "balanced",
  paletteOverride: null,
  accentHex: null,
  fontPairId: null,
  verbatiStyle: {
    familyId: "workshop",
    layout: "workshop",
    typography: "doto-code",
    palette: "sauge",
  },
  sourceMode: "proposal_local",
} as const;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (query: string) => {
    if (query === "proposalSettings.getCurrent") {
      return mockCurrentProposalSettings;
    }
    return null;
  },
  useMutation: () => vi.fn().mockResolvedValue(undefined),
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
  getActiveLocalPersonalizationSource: () => ({
    title: null,
    personalizationContext: null,
  }),
  getLocalActiveCvSnapshotById: () => null,
  getLocalCvDocumentById: () => null,
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
  getProposalAttachedCvId: () => null,
  getProposalAttachedCvLocalDocument: () => null,
  listLocalCvPickerOptions: () => [],
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: () => <div>Proposal input</div>,
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: () => <div>Compose toolbar</div>,
}));

vi.mock("../../components/EmbeddedStyleInspector", () => ({
  default: () => <div>Style inspector</div>,
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    stylePreset,
    templateId,
  }: {
    stylePreset?: {
      layout?: string | null;
      typography?: string | null;
      palette?: string | null;
    } | null;
    templateId?: string | null;
  }) => (
    <div data-testid="proposal-settings-style">
      {stylePreset?.layout ?? "none"}|{stylePreset?.typography ?? "none"}|
      {stylePreset?.palette ?? "none"}|{templateId ?? "none"}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge settings style round-trip", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps workshop proposal settings stable across reloads", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|doto-code|sauge|workshop_proposal_margin",
      );
    });

    unmount();

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|doto-code|sauge|workshop_proposal_margin",
      );
    });
  });
});
