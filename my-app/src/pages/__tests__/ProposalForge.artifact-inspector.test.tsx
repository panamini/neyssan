import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import { readStoredProposalOutputDraft } from "../../lib/proposal-output-draft";

const proposalDisplaySpy = vi.fn();
let mockVoicePreset: "signature" | null = "signature";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
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
          voicePreset: mockVoicePreset,
          toneTuning: null,
          characterLimitMode: "none",
          characterLimitValue: null,
        };
        onValuesChange?.(values);
        onSubmit?.(
          values,
          "Generated proposal body.",
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
  default: (props: Record<string, any>) => {
    proposalDisplaySpy(props);
    return (
      <div>
        <div data-testid="proposal-display-state">
          {props.templateId ?? "no-template"}|{props.stylePreset?.layout ?? "no-layout"}|
          {props.stylePreset?.palette ?? "no-palette"}|
          {props.stylePreset?.accentHex ?? "no-accent"}
        </div>
        <div data-testid="proposal-display-addon">{props.railStartAddon}</div>
      </div>
    );
  },
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalArtifactInspector", () => ({
  ProposalArtifactInspector: ({
    onStyleBundleChange,
    onPaletteOverrideChange,
  }: Record<string, any>) => (
    <div>
      <button
        type="button"
        aria-label="Style"
        onClick={() => onStyleBundleChange?.("magazine_editorial")}
      >
        Style
      </button>
      <button
        type="button"
        aria-label="Color"
        onClick={() => onPaletteOverrideChange?.("encre")}
      >
        Color
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge artifact inspector integration", () => {
  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    mockVoicePreset = "signature";
    window.localStorage.clear();
  });

  it("mounts the artifact inspector on the live output and persists style and palette choices", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    expect(screen.getByRole("button", { name: "Style" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Color" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Style" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "|editorial|",
      );
      expect(readStoredProposalOutputDraft()).toMatchObject({
        templateBundleId: "magazine_editorial",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Color" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "|encre|",
      );
      expect(readStoredProposalOutputDraft()).toMatchObject({
        paletteOverride: "encre",
        templateBundleId: "magazine_editorial",
      });
    });
  });

  it("keeps Auto visible in the output meta when auto tone was requested", async () => {
    mockVoicePreset = null;

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    await waitFor(() => {
      const lastCall =
        proposalDisplaySpy.mock.calls[proposalDisplaySpy.mock.calls.length - 1]?.[0];
      expect(lastCall?.documentMeta).toContain("Auto");
    });
  });
});
