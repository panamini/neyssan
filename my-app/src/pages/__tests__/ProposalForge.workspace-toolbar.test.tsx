import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";

const proposalDisplaySpy = vi.fn();
const proposalInputFormSpy = vi.fn();
const proposalComposeToolbarSpy = vi.fn();
const useQueryMock = vi.fn(() => null);

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (...args: any[]) => useQueryMock(...args),
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

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: (props: Record<string, any>) => {
    proposalInputFormSpy(props);
    const submitFromBrief = React.useCallback(
      () =>
        props.onSubmit?.(
          {
            jobTitle: "Game UI Artist",
            jobDescription:
              "Detailed role description for the proposal brief capsule tests.",
            proposalType: "cover_letter",
            voicePreset: undefined,
            formalityLevel: undefined,
            creativity: undefined,
            toneTuning: null,
            characterLimitMode: "none",
            characterLimitValue: 1500,
            modelType: "chatgpt",
          },
          "Generated proposal body.",
        ),
      [props.onSubmit],
    );

    React.useEffect(() => {
      props.onGenerateControlChange?.({
        trigger: submitFromBrief,
        label: "Generate",
        disabled: false,
        state: "idle",
      });

      return () => {
        props.onGenerateControlChange?.(null);
      };
    }, [props.onGenerateControlChange, submitFromBrief]);

    return (
      <div data-testid="proposal-input-form">
        Mock compose shell
        {props.headerAction as React.ReactNode}
        <button type="button" onClick={submitFromBrief}>
          Generate sample proposal
        </button>
        <button
          type="button"
          onClick={() =>
            props.onValuesChange?.({
              jobTitle: "Game UI Artist",
              jobDescription:
                "Detailed role description for the proposal brief capsule tests.",
              proposalType: "cover_letter",
              voicePreset: "expert",
              formalityLevel: "formal",
              creativity: "low",
              toneTuning: null,
              characterLimitMode: "none",
              characterLimitValue: 1500,
              modelType: "chatgpt",
            })
          }
        >
          Set bottom tone
        </button>
      </div>
    );
  },
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: (props: Record<string, any>) => {
    proposalComposeToolbarSpy(props);
    return <div data-testid="proposal-compose-toolbar" />;
  },
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: (props: Record<string, unknown>) => {
    proposalDisplaySpy(props);
    return <div data-testid="proposal-display">Mock proposal display</div>;
  },
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

const renderProposalForge = (entry = "/proposal") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ProposalForge />
    </MemoryRouter>,
  );

describe("ProposalForge workbench layout", () => {
  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    proposalInputFormSpy.mockClear();
    proposalComposeToolbarSpy.mockClear();
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue(null);
    window.localStorage.clear();
    window.localStorage.setItem(
      "dasti:proposal-compose-draft:v1",
      JSON.stringify({
        jobTitle: "Game UI Artist",
        jobDescription:
          "Detailed role description for the proposal brief capsule tests.",
      }),
    );
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
      writable: true,
    });
    window.dispatchEvent(new Event("resize"));
  });

  it("anchors the proposal document in a single stage toolbar surface", () => {
    renderProposalForge();

    const lastCall =
      proposalDisplaySpy.mock.calls[proposalDisplaySpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({
      previewAnchor: "top",
      documentHeaderMode: "hidden",
      showModeToggle: false,
      showZoomControls: false,
    });
    expect(lastCall.actions).toBeUndefined();
    expect(proposalComposeToolbarSpy).not.toHaveBeenCalled();
  });

  it("consolidates share, export, and safe-send risk checks in the stage menu", async () => {
    renderProposalForge();

    const stage = screen.getByLabelText("Proposal document stage");
    fireEvent.click(within(stage).getByRole("button", { name: /share/i }));

    const menu = await screen.findByRole("menu", { name: "Share proposal" });
    expect(
      within(menu).getByRole("menuitem", { name: "Safe-send checklist…" }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Send by email" }),
    ).toBeDisabled();
    expect(
      within(menu).getByRole("menuitem", { name: "Export PDF" }),
    ).toBeDisabled();
    expect(
      within(menu).getByRole("menuitem", { name: "Copy as text" }),
    ).toBeDisabled();

    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Safe-send checklist…" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Safe-send checklist",
    });
    expect(within(dialog).getByText("Source job linked")).toBeInTheDocument();
    expect(within(dialog).getByText("Match review not accepted")).toBeInTheDocument();
    expect(within(dialog).getByText("Unsupported claim")).toBeInTheDocument();
    expect(
      within(dialog).getAllByText("Detection pending", { selector: "span" })
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(dialog).getByRole("button", { name: "Continue to send" }),
    ).toBeDisabled();

    const sourceJobRow = within(dialog)
      .getByText("Source job linked")
      .closest(".dasti-proposal-safe-send__row");
    expect(sourceJobRow).toHaveAttribute("data-state", "clear");
  });

  it("renders the skeleton rail with lightweight setup and no visible legacy compose controls", () => {
    const { container } = renderProposalForge();

    const rail = screen.getByLabelText("Proposal rail");
    const railLabels = Array.from(
      rail.querySelectorAll(".dasti-proposal-skeleton-rail__label"),
    ).map((label) => label.textContent);

    expect(railLabels).toEqual([
      "Job context",
      "Source CV",
      "Tone",
      "Variables",
      "Ask AI",
      "Settings",
    ]);
    expect(within(rail).getByText("Draft setup")).toBeInTheDocument();
    expect(within(rail).getByText("Role")).toBeInTheDocument();
    expect(within(rail).getByText("CV")).toBeInTheDocument();
    expect(within(rail).getAllByText("Tone").length).toBeGreaterThan(0);
    expect(within(rail).getByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(
      within(rail).getByText("Generate a draft to edit document variables here."),
    ).toBeInTheDocument();
    expect(within(rail).queryByRole("textbox", { name: /ask ai/i })).toBeNull();
    expect(within(rail).queryByRole("button", { name: "Send" })).toBeNull();
    expect(screen.queryByTestId("proposal-compose-toolbar")).toBeNull();
    expect(container.querySelector(".dasti-proposal-compose-panel-stage")).toBeNull();
  });

  it("keeps generation behavior behind the lightweight Draft setup boundary", async () => {
    const { container } = renderProposalForge();

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByLabelText("Applicant name")).toBeInTheDocument();
    expect(screen.getByLabelText("Contact line")).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-proposal-skeleton-rail__variables"),
    ).toBeTruthy();
    expect(screen.getByTestId("proposal-input-form").closest("[hidden]")).toBeTruthy();
  });

  it("keeps the hidden compose runtime wired to rail CV and tone state", () => {
    renderProposalForge();

    let lastInputCall =
      proposalInputFormSpy.mock.calls[proposalInputFormSpy.mock.calls.length - 1]?.[0];
    expect(lastInputCall).toMatchObject({
      suppressCvPicker: true,
      cvPickerOpen: false,
      externalVoicePreset: null,
    });

    act(() => {
      lastInputCall.onValuesChange?.({
        jobTitle: "Game UI Artist",
        jobDescription:
          "Detailed role description for the proposal brief capsule tests.",
        proposalType: "cover_letter",
        voicePreset: "expert",
        formalityLevel: "formal",
        creativity: "low",
        toneTuning: null,
        characterLimitMode: "none",
        characterLimitValue: 1500,
        modelType: "chatgpt",
      });
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Choose a CV Attach one to personalize the draft.",
      }),
    );

    lastInputCall =
      proposalInputFormSpy.mock.calls[proposalInputFormSpy.mock.calls.length - 1]?.[0];
    expect(lastInputCall).toMatchObject({
      cvPickerOpen: true,
      externalVoicePreset: "expert",
    });
    expect(screen.queryByRole("button", { name: /pick cv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Balanced" })).not.toBeInTheDocument();
  });

  it("keeps the skeleton workbench constrained on desktop and compact widths", () => {
    const { container } = renderProposalForge();

    const workbenchFrame = container.querySelector(".dasti-flow") as HTMLElement | null;
    const skeletonGrid = container.querySelector(
      ".dasti-proposal-skeleton-forge",
    ) as HTMLElement | null;
    const outputShell = container.querySelector(
      ".dasti-proposal-output-shell",
    ) as HTMLElement | null;

    expect(workbenchFrame?.style.maxWidth).toBe(
      "calc(var(--proposal-workspace-output-shell-inline-size) + var(--proposal-workspace-output-shell-inline-size) + var(--layout-card-grid))",
    );
    expect(skeletonGrid?.style.getPropertyValue("--grid-columns")).toBe(
      "minmax(0, 1fr) 360px",
    );
    expect(outputShell?.style.width).toBe("100%");

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1000,
        writable: true,
      });
      window.dispatchEvent(new Event("resize"));
    });

    expect(workbenchFrame?.style.maxWidth).toBe("560px");
    expect(skeletonGrid?.style.getPropertyValue("--grid-columns")).toBe(
      "minmax(0, 1fr)",
    );
  });

  it("keeps ProposalDisplay output actions out of the legacy output toolbar in preview mode", () => {
    window.localStorage.setItem(
      "dasti:proposal-output-draft:v1",
      JSON.stringify({
        proposalContent: "Generated proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "inherit_cv",
        proposalStyleChoice: "auto",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Generated proposal",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_live",
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

    renderProposalForge();

    const lastCall =
      proposalDisplaySpy.mock.calls[proposalDisplaySpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({
      documentHeaderMode: "hidden",
      showModeToggle: false,
      showZoomControls: false,
    });
    expect(lastCall.actions).toBeUndefined();
    expect(proposalComposeToolbarSpy).not.toHaveBeenCalled();
  });

  it("keeps ProposalDisplay output/header controls out of the legacy output toolbar in edit mode", () => {
    window.localStorage.setItem(
      "dasti:proposal-output-draft:v1",
      JSON.stringify({
        proposalContent: "Generated proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "custom",
        proposalStyleChoice: "custom",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Generated proposal",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_live",
        proposalOutputMode: "edit",
        paletteOverride: "bordeaux",
        customAccentHex: null,
        templateBundleId: null,
        typographyOverride: null,
        layoutOverride: null,
        proposalDocumentTitleManual: false,
        characterLimitMode: null,
        characterLimitValue: null,
      }),
    );

    renderProposalForge();

    const lastCall =
      proposalDisplaySpy.mock.calls[proposalDisplaySpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({
      documentHeaderMode: "hidden",
      showModeToggle: false,
      showZoomControls: false,
    });
    expect(lastCall.actions).toBeUndefined();
    expect(proposalComposeToolbarSpy).not.toHaveBeenCalled();
  });
});
