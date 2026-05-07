import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalRail } from "../ProposalRail";
import {
  getProposalTemplateBundleDefinition,
  type ProposalTemplateBundleId,
} from "../../../lib/proposal-template-bundles";
import type { VerbatiStylePreset } from "../../../features/verbati/types";

const baseProps = {
  jobTitle: "Operations Associate",
  company: "Acme",
  location: "Paris",
  jobHref: null,
  sourceLabel: null,
  sourceUrl: null,
  jobSummary: null,
  jobMatch: null,
  sourceCvTitle: null,
  sourceCvMeta: null,
  draftTitle: "Application draft",
  draftTitlePlaceholder: "Application draft",
  onDraftTitleChange: vi.fn(),
  onDraftTitleCommit: vi.fn(),
  toneLabel: "Auto",
  toneOptions: [
    {
      id: null,
      label: "Auto",
      description: "Use automatic tone.",
      tone: "auto" as const,
      selected: true,
    },
  ],
  onSelectTone: vi.fn(),
  lengthOptions: [
    {
      id: "medium" as const,
      label: "Standard",
      description: "Enough. No more.",
      selected: true,
    },
  ],
  onSelectLength: vi.fn(),
  stylePreset: {
    layout: "workshop" as const,
    typography: "geist-baskervville" as const,
    palette: "sauge" as const,
  },
  styleTemplateBundleId: "swiss_serif" as const,
  onSelectStyleBundle: vi.fn(),
  onSelectStyleTypography: vi.fn(),
  onSelectStylePalette: vi.fn(),
  onSelectStyleCustomAccent: vi.fn(),
  aiStream: null,
  variableFields: [],
  hasProposalContent: true,
  generateLabel: "Generate",
  generateDisabled: false,
  generateState: "idle" as const,
  onGenerateDraft: vi.fn(),
  cvOptions: [],
  onSelectCv: vi.fn(),
  onClearCv: vi.fn(),
  onCreateCv: vi.fn(),
  onImportCv: vi.fn(),
  askAiValue: "",
  askAiBusy: false,
  askAiDisabled: false,
  askAiPlaceholder: "Ask AI",
  askAiHint: "Applies to current draft.",
  onAskAiChange: vi.fn(),
  onAskAiSubmit: vi.fn(),
};

describe("ProposalRail style tab", () => {
  it("renders new and delete proposal actions under the generate button", () => {
    const onNewProposal = vi.fn();
    const onDeleteProposal = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        onNewProposal={onNewProposal}
        onDeleteProposal={onDeleteProposal}
      />,
    );

    const actions = screen.getByRole("group", { name: "Draft actions" });
    expect(within(actions).getByRole("button", { name: "New proposal" })).toHaveClass(
      "ds-btn--ghost",
    );
    expect(
      within(actions).getByRole("button", { name: "Delete proposal" }),
    ).toHaveClass("ds-btn--ghost");

    fireEvent.click(within(actions).getByRole("button", { name: "New proposal" }));
    fireEvent.click(within(actions).getByRole("button", { name: "Delete proposal" }));

    expect(onNewProposal).toHaveBeenCalledTimes(1);
    expect(onDeleteProposal).toHaveBeenCalledTimes(1);
  });

  it("shows the proposal Style tab and calls proposal-scoped style callbacks", () => {
    const onSelectStyleBundle = vi.fn();
    const onSelectStylePalette = vi.fn();
    const onSelectStyleCustomAccent = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        onSelectStyleBundle={onSelectStyleBundle}
        onSelectStylePalette={onSelectStylePalette}
        onSelectStyleCustomAccent={onSelectStyleCustomAccent}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));

    expect(
      screen.getAllByText((_, element) =>
        Boolean(
          element?.textContent?.includes(
            "Style inherited from selected CV when available.",
          ),
        ),
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Default settings/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "→ Document style" })).toBeInTheDocument();
    expect(screen.getByText("Template")).toBeInTheDocument();
    expect(screen.getByText("Font pair")).toBeInTheDocument();
    expect(screen.getByText("Accent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Style 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Style 2" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Style 3" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Style 3" }));
    expect(onSelectStyleBundle).toHaveBeenCalledWith("grid_mono");

    fireEvent.click(screen.getByRole("button", { name: "Use Ochre accent" }));
    expect(onSelectStylePalette).toHaveBeenCalledWith("ochre");

    fireEvent.click(screen.getByRole("button", { name: "Use Cobalt accent" }));
    expect(onSelectStylePalette).toHaveBeenCalledWith("cobalt");
    expect(onSelectStyleCustomAccent).not.toHaveBeenCalledWith("#2A78D6");

    expect(document.querySelector('input[type="color"]')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open custom color picker" }));
    expect(screen.getByRole("dialog", { name: "Custom accent color" })).toBeInTheDocument();
  });

  it("keeps Style 3 selected, highlights ink, and exposes reset when the bundle is customized", () => {
    const onResetStyleBundle = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        styleTemplateBundleId="grid_mono"
        stylePreset={{
          layout: "workshop",
          typography: "geist-baskervville",
          palette: "ink",
        }}
        onResetStyleBundle={onResetStyleBundle}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));

    expect(screen.getByRole("button", { name: "Style 3" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Style 3 · Custom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Ink accent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset Style 3" }));
    expect(onResetStyleBundle).toHaveBeenCalledWith("grid_mono");
  });

  it("marks the selected style custom immediately after a manual palette edit", () => {
    function StyleHarness(): JSX.Element {
      const [styleTemplateBundleId, setStyleTemplateBundleId] =
        React.useState<ProposalTemplateBundleId>("swiss_serif");
      const [stylePreset, setStylePreset] = React.useState<VerbatiStylePreset>(
        getProposalTemplateBundleDefinition("swiss_serif").stylePreset,
      );

      return (
        <ProposalRail
          {...baseProps}
          styleTemplateBundleId={styleTemplateBundleId}
          stylePreset={stylePreset}
          onSelectStyleBundle={(bundleId) => {
            const bundleDefinition = getProposalTemplateBundleDefinition(
              bundleId as ProposalTemplateBundleId,
            );
            setStyleTemplateBundleId(bundleDefinition.id);
            setStylePreset(bundleDefinition.stylePreset);
          }}
          onSelectStylePalette={(palette) => {
            setStylePreset((current) => ({
              ...current,
              palette,
              accentHex: undefined,
            }));
          }}
        />
      );
    }

    render(<StyleHarness />);

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));
    fireEvent.click(screen.getByRole("button", { name: "Style 3" }));
    expect(screen.getByRole("button", { name: "Style 3" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("Style 3 · Custom")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use Cobalt accent" }));

    expect(screen.getByRole("button", { name: "Style 3" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Style 3 · Custom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Cobalt accent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("ProposalRail length control", () => {
  it("removes Length from Draft while keeping it available in Ask", () => {
    render(<ProposalRail {...baseProps} />);

    expect(
      screen.queryByRole("button", { name: "Standard" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Ask" }));

    expect(
      screen.getByRole("button", { name: "Standard" }),
    ).toBeInTheDocument();
  });
});
