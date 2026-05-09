import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalRail } from "../ProposalRail";
import {
  getProposalTemplateBundleDefinition,
  type ProposalTemplateBundleId,
} from "../../../lib/proposal-template-bundles";
import { CANONICAL_PROPOSAL_TEMPLATE_ID } from "../../../../convex/lib/proposals/renderTemplates";
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
  proposalTemplateId: CANONICAL_PROPOSAL_TEMPLATE_ID,
  onSelectProposalLayout: vi.fn(),
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
  it("renders new, save, and delete proposal actions under the generate button", () => {
    const onNewProposal = vi.fn();
    const onSaveToLibrary = vi.fn();
    const onDeleteProposal = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        onNewProposal={onNewProposal}
        onSaveToLibrary={onSaveToLibrary}
        onDeleteProposal={onDeleteProposal}
      />,
    );

    const actions = screen.getByRole("group", { name: "Draft actions" });
    expect(within(actions).getByRole("button", { name: "New proposal" })).toHaveClass(
      "ds-btn--ghost",
    );
    expect(
      within(actions).getByRole("button", { name: "Save proposal to library" }),
    ).toHaveClass("ds-btn--ghost");
    expect(
      within(actions).getByRole("button", { name: "Delete proposal" }),
    ).toHaveClass("ds-btn--ghost");

    fireEvent.click(within(actions).getByRole("button", { name: "New proposal" }));
    fireEvent.click(within(actions).getByRole("button", { name: "Save proposal to library" }));
    fireEvent.click(within(actions).getByRole("button", { name: "Delete proposal" }));

    expect(onNewProposal).toHaveBeenCalledTimes(1);
    expect(onSaveToLibrary).toHaveBeenCalledTimes(1);
    expect(onDeleteProposal).toHaveBeenCalledTimes(1);
  });

  it("disables save and delete proposal actions when the draft has no content", () => {
    render(
      <ProposalRail
        {...baseProps}
        hasProposalContent={false}
        onSaveToLibrary={vi.fn()}
        onDeleteProposal={vi.fn()}
      />,
    );

    const actions = screen.getByRole("group", { name: "Draft actions" });
    expect(within(actions).getByRole("button", { name: "Save proposal to library" })).toBeDisabled();
    expect(within(actions).getByRole("button", { name: "Delete proposal" })).toBeDisabled();
  });

  it("opens the empty job context drawer with a clear empty hierarchy", () => {
    const onOpenJobs = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        jobTitle=""
        company={null}
        location={null}
        jobHref={null}
        sourceUrl={null}
        jobSummary={null}
        onOpenJobs={onOpenJobs}
      />,
    );

    expect(screen.getByText("No job loaded")).toBeInTheDocument();
    expect(screen.getByText("Capture, paste, or choose a job.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste a job offer...")).toBeInTheDocument();

    const jobSites = screen.getByLabelText("Job sites");
    expect(
      within(jobSites)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["LinkedIn", "Indeed", "Upwork", "ZipRecruiter", "Hellowork"]);

    fireEvent.click(screen.getByRole("button", { name: "Choose from Job Forge" }));
    expect(onOpenJobs).toHaveBeenCalledTimes(1);
  });

  it("shows pasted job text as a compact context with edit and clear actions", () => {
    const onClearJobContext = vi.fn();

    const { rerender } = render(
      <ProposalRail
        {...baseProps}
        jobTitle=""
        company={null}
        location={null}
        jobHref={null}
        sourceUrl={null}
        jobSummary={null}
        onClearJobContext={onClearJobContext}
      />,
    );

    expect(screen.queryByRole("button", { name: "Clear job context" })).toBeNull();
    expect(screen.getByLabelText("Job sites")).toBeInTheDocument();

    rerender(
      <ProposalRail
        {...baseProps}
        jobTitle=""
        company={null}
        location={null}
        jobHref={null}
        sourceUrl={null}
        jobSummary={null}
        jobOfferText="Write support workflows and coordinate customer operations."
        onClearJobContext={onClearJobContext}
      />,
    );

    expect(screen.getByText("Job offer added")).toBeInTheDocument();
    expect(screen.getAllByText("Pasted context")).toHaveLength(2);
    expect(
      screen.getByText("Write support workflows and coordinate customer operations."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Job sites")).toBeNull();
    expect(screen.queryByPlaceholderText("Paste a job offer...")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit job text" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit job text" }));
    expect(screen.getByLabelText("Edit pasted job offer")).toHaveValue(
      "Write support workflows and coordinate customer operations.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear job context" }));
    expect(onClearJobContext).toHaveBeenCalledTimes(1);
  });

  it("keeps the job textarea open after typing the first character", () => {
    const onJobOfferTextChange = vi.fn();

    const { rerender } = render(
      <ProposalRail
        {...baseProps}
        jobTitle=""
        company={null}
        location={null}
        jobHref={null}
        sourceUrl={null}
        jobSummary={null}
        jobOfferText=""
        onJobOfferTextChange={onJobOfferTextChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Paste a job offer"), {
      target: { value: "a" },
    });

    rerender(
      <ProposalRail
        {...baseProps}
        jobTitle=""
        company={null}
        location={null}
        jobHref={null}
        sourceUrl={null}
        jobSummary={null}
        jobOfferText="a"
        onJobOfferTextChange={onJobOfferTextChange}
      />,
    );

    expect(screen.getByLabelText("Edit pasted job offer")).toHaveValue("a");
    expect(document.querySelector(".dasti-proposal-skeleton-rail__job-preview")).toBeNull();
    expect(onJobOfferTextChange).toHaveBeenCalledWith("a");
  });

  it("shows loaded Job Forge context with change and clear actions", () => {
    const onOpenJobs = vi.fn();
    const onClearJobContext = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        jobTitle="Senior Product Designer"
        company="Studio Vale"
        location="Remote"
        sourceLabel="LinkedIn"
        sourceUrl="https://www.linkedin.com/jobs/view/123"
        jobSummary="Lead proposal workflows and collaborate with product engineering."
        onOpenJobs={onOpenJobs}
        onClearJobContext={onClearJobContext}
      />,
    );

    expect(screen.getByText("Senior Product Designer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Job context/i }));
    expect(screen.getByText("Studio Vale · LinkedIn · Remote")).toBeInTheDocument();
    expect(
      screen.getAllByText("Lead proposal workflows and collaborate with product engineering."),
    ).toHaveLength(2);
    expect(screen.queryByLabelText("Job sites")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Change job" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear job context" }));

    expect(onOpenJobs).toHaveBeenCalledTimes(1);
    expect(onClearJobContext).toHaveBeenCalledTimes(1);
  });

  it("shows signature action in the Style tab and calls the callback", () => {
    const onChooseSignature = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        signaturePresent={false}
        onChooseSignature={onChooseSignature}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));
    fireEvent.click(screen.getByRole("switch", { name: "Printed name" }));

    expect(onChooseSignature).toHaveBeenCalledTimes(1);
  });

  it("keeps the signature switch active when the draft content has not hydrated yet", () => {
    const onChooseSignature = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        hasProposalContent={false}
        signaturePresent={false}
        onChooseSignature={onChooseSignature}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));
    const signatureSwitch = screen.getByRole("switch", { name: "Printed name" });

    expect(signatureSwitch).not.toBeDisabled();
    fireEvent.click(signatureSwitch);
    expect(onChooseSignature).toHaveBeenCalledTimes(1);
  });

  it("shows when the structured signature is already present", () => {
    render(
      <ProposalRail
        {...baseProps}
        signaturePresent
        onChooseSignature={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));

    expect(screen.getByRole("switch", { name: "Printed name" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("toggles off the structured signature when already present", () => {
    const onChooseSignature = vi.fn();
    const onToggleSignature = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        signaturePresent
        onChooseSignature={onChooseSignature}
        onToggleSignature={onToggleSignature}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));
    fireEvent.click(screen.getByRole("switch", { name: "Printed name" }));

    expect(onToggleSignature).toHaveBeenCalledWith(false);
    expect(onChooseSignature).not.toHaveBeenCalled();
  });

  it("toggles hand-drawn signature placement when an image signature is available", () => {
    const onToggleHandwrittenSignature = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        signaturePresent
        handwrittenSignatureAvailable
        handwrittenSignatureEnabled={false}
        onChooseSignature={vi.fn()}
        onToggleHandwrittenSignature={onToggleHandwrittenSignature}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));
    fireEvent.click(screen.getByRole("switch", { name: "Signature" }));

    expect(onToggleHandwrittenSignature).toHaveBeenCalledWith(true);
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
    expect(screen.getByRole("link", { name: "→ Document style" })).toHaveAttribute(
      "href",
      "/settings?tab=docstyle",
    );
    expect(screen.getByText("Layout", { selector: ".forge__rail-label" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Workshop layout",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Style", { selector: ".forge__rail-label" })).toBeInTheDocument();
    expect(screen.getByText("Font pair")).toBeInTheDocument();
    expect(screen.getByText("Accent", { selector: ".forge__rail-label" })).toBeInTheDocument();
    expect(screen.getByText("Printed name", { selector: ".forge__rail-label" })).toBeInTheDocument();
    const accentLabel = screen.getByText("Accent", { selector: ".forge__rail-label" });
    const signatureLabel = screen.getByText("Printed name", { selector: ".forge__rail-label" });
    expect(
      accentLabel.compareDocumentPosition(signatureLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
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

  it("selects the canonical proposal layout from the Style tab", () => {
    const onSelectProposalLayout = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        proposalTemplateId={null}
        onSelectProposalLayout={onSelectProposalLayout}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Workshop layout",
      }),
    );

    expect(onSelectProposalLayout).toHaveBeenCalledWith(
      CANONICAL_PROPOSAL_TEMPLATE_ID,
    );
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

  it("compares custom state against the current Settings-backed bundle style", () => {
    const onResetStyleBundle = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        styleTemplateBundleId="swiss_serif"
        stylePreset={getProposalTemplateBundleDefinition("swiss_serif").stylePreset}
        styleTemplateBundleBaseStyle={{
          ...getProposalTemplateBundleDefinition("swiss_serif").stylePreset,
          palette: "cobalt",
        }}
        onResetStyleBundle={onResetStyleBundle}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Style" }));

    expect(screen.getByText("Style 1 · Custom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset Style 1" }));
    expect(onResetStyleBundle).toHaveBeenCalledWith("swiss_serif");
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
