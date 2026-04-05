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
        <button
          type="button"
          aria-label="Toggle proposal mode"
          onClick={() =>
            props.onModeChange?.(props.mode === "preview" ? "edit" : "preview")
          }
        >
          Toggle mode
        </button>
        <div data-testid="proposal-display-addon">{props.railStartAddon}</div>
      </div>
    );
  },
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/EmbeddedStyleInspector", () => ({
  default: ({
    onSelectLayout,
    onSelectPalette,
  }: Record<string, any>) => (
    <div>
      <button
        type="button"
        aria-label="Open layout controls"
        onClick={() => onSelectLayout?.("volk-register")}
      >
        Layout
      </button>
      <button
        type="button"
        aria-label="Open palette controls"
        onClick={() => onSelectPalette?.("encre")}
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

  it("mounts the output style controls and persists direct layout and palette choices", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    expect(
      screen.getByRole("button", { name: "Open layout controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open palette controls" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open layout controls" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "volk_register|volk-register|",
      );
      expect(readStoredProposalOutputDraft()).toMatchObject({
        proposalTemplateId: "volk_register",
        proposalVerbatiStyle: expect.objectContaining({
          layout: "volk-register",
        }),
        templateBundleId: null,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Open palette controls" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "|encre|",
      );
      expect(readStoredProposalOutputDraft()).toMatchObject({
        proposalVerbatiStyle: expect.objectContaining({
          layout: "volk-register",
          palette: "encre",
        }),
        paletteOverride: null,
        templateBundleId: null,
      });
    });
  });

  it("keeps the selected direct layout and typography fields across preview/edit mode switches", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Open layout controls" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "volk_register|volk-register|",
      );
      expect(readStoredProposalOutputDraft()).toMatchObject({
        proposalTemplateId: "volk_register",
        proposalVerbatiStyle: expect.objectContaining({
          layout: "volk-register",
        }),
        typographyOverride: expect.any(String),
        layoutOverride: null,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Toggle proposal mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle proposal mode" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
        "volk_register|volk-register|",
      );
      expect(readStoredProposalOutputDraft()).toMatchObject({
        proposalTemplateId: "volk_register",
        proposalVerbatiStyle: expect.objectContaining({
          layout: "volk-register",
        }),
        typographyOverride: expect.any(String),
      });
    });
  });

  it("uses the applicant header contract instead of tone metadata in the output preview", async () => {
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
      expect(lastCall?.documentTitle).toContain("Application for the");
      expect(lastCall?.applicantHeader).toMatchObject({
        name: "Elena Marlowe",
        role: "Senior Product Designer",
        email: "elena@sample.design",
      });
    });
  });
});
