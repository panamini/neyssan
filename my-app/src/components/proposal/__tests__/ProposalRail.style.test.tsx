import React from "react";
import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalRail } from "../ProposalRail";
import ProposalDesignFields from "../ProposalDesignFields";
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

const baseDesignProps = {
  proposalTemplateId: CANONICAL_PROPOSAL_TEMPLATE_ID,
  onSelectProposalLayout: vi.fn(),
  stylePreset: baseProps.stylePreset,
  styleTemplateBundleId: baseProps.styleTemplateBundleId,
  onSelectStyleBundle: vi.fn(),
  onSelectStyleTypography: vi.fn(),
  onSelectStylePalette: vi.fn(),
  onSelectStyleCustomAccent: vi.fn(),
};

function renderDesignFields(
  props: Partial<React.ComponentProps<typeof ProposalDesignFields>> = {},
) {
  return render(<ProposalDesignFields {...baseDesignProps} {...props} />);
}

describe("ProposalRail style tab", () => {
  it("keeps document heading and style out of the right rail tabs", () => {
    render(<ProposalRail {...baseProps} />);

    expect(screen.getByRole("tab", { name: "Draft" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ask" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Style" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Heading" })).not.toBeInTheDocument();
  });

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

  it("opens attached CV actions through the shared sidecar menu contract", async () => {
    render(
      <ProposalRail
        {...baseProps}
        sourceCvTitle="Porphyre profile"
        sourceCvMeta="Updated today"
      />,
    );

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1180,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 780,
    });
    const trigger = screen.getByRole("button", { name: /Porphyre profile/i });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      x: 840,
      y: 180,
      top: 180,
      left: 840,
      right: 1120,
      bottom: 224,
      width: 280,
      height: 44,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Source CV" });
    vi.spyOn(menu, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 240,
      width: 320,
      height: 240,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent(window, new Event("resize"));

    expect(menu).toHaveClass("dasti-proposal-skeleton-rail__cv-action-menu");
    await waitFor(() => expect(menu).toHaveAttribute("data-side", "left"));
    expect(
      within(menu).getByRole("menuitem", { name: "Create new CV" }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Import PDF" }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Remove attached CV" }),
    ).toBeInTheDocument();
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
    expect(screen.getByText("Open job sites")).toBeInTheDocument();
    expect(
      within(jobSites)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["LinkedIn", "Indeed", "Upwork", "ZipRecruiter", "HelloWork"]);

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

    renderDesignFields({
      signaturePresent: false,
      onChooseSignature,
    });
    fireEvent.click(screen.getByRole("switch", { name: "Printed name" }));

    expect(onChooseSignature).toHaveBeenCalledTimes(1);
  });

  it("keeps the signature switch active when the draft content has not hydrated yet", () => {
    const onChooseSignature = vi.fn();

    renderDesignFields({
      signaturePresent: false,
      onChooseSignature,
    });
    const signatureSwitch = screen.getByRole("switch", { name: "Printed name" });

    expect(signatureSwitch).not.toBeDisabled();
    fireEvent.click(signatureSwitch);
    expect(onChooseSignature).toHaveBeenCalledTimes(1);
  });

  it("shows when the structured signature is already present", () => {
    renderDesignFields({
      signaturePresent: true,
      onChooseSignature: vi.fn(),
    });

    expect(screen.getByRole("switch", { name: "Printed name" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("toggles off the structured signature when already present", () => {
    const onChooseSignature = vi.fn();
    const onToggleSignature = vi.fn();

    renderDesignFields({
      signaturePresent: true,
      onChooseSignature,
      onToggleSignature,
    });
    fireEvent.click(screen.getByRole("switch", { name: "Printed name" }));

    expect(onToggleSignature).toHaveBeenCalledWith(false);
    expect(onChooseSignature).not.toHaveBeenCalled();
  });

  it("toggles hand-drawn signature placement when an image signature is available", () => {
    const onToggleHandwrittenSignature = vi.fn();

    renderDesignFields({
      signaturePresent: true,
      handwrittenSignatureAvailable: true,
      handwrittenSignatureEnabled: false,
      onChooseSignature: vi.fn(),
      onToggleHandwrittenSignature,
    });
    fireEvent.click(screen.getByRole("switch", { name: "Signature" }));

    expect(onToggleHandwrittenSignature).toHaveBeenCalledWith(true);
  });

  it("shows the proposal Style tab and calls proposal-scoped style callbacks", () => {
    const onSelectStyleBundle = vi.fn();
    const onSelectStylePalette = vi.fn();
    const onSelectStyleCustomAccent = vi.fn();

    renderDesignFields({
      onSelectStyleBundle,
      onSelectStylePalette,
      onSelectStyleCustomAccent,
    });

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
    expect(screen.getByText("Style", { selector: ".forge__rail-label" })).toBeInTheDocument();
    expect(screen.queryByTestId("proposal-design-live-preview")).not.toBeInTheDocument();
    expect(screen.getByText("Layout", { selector: ".forge__rail-label" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Minimal layout",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    const styleLabel = screen.getByText("Style", { selector: ".forge__rail-label" });
    const layoutLabel = screen.getByText("Layout", { selector: ".forge__rail-label" });
    expect(
      styleLabel.compareDocumentPosition(layoutLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Typography", { selector: ".forge__rail-label" })).toBeInTheDocument();
    expect(screen.getByText("Color", { selector: ".forge__rail-label" })).toBeInTheDocument();
    expect(screen.getByText("Signature", { selector: ".forge__rail-label" })).toBeInTheDocument();
    const accentLabel = screen.getByText("Color", { selector: ".forge__rail-label" });
    const signatureLabel = screen.getByText("Signature", { selector: ".forge__rail-label" });
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

  it("uses compact pills for proposal style selection instead of live thumbnails", () => {
    renderDesignFields();

    const styleGroup = screen.getByLabelText("Proposal style presets");
    expect(styleGroup).toHaveClass("dasti-proposal-skeleton-rail__style-pills");
    expect(styleGroup).toHaveClass("dasti-proposal-design-style-pills");
    expect(within(styleGroup).getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByTestId("proposal-design-live-preview")).not.toBeInTheDocument();
    expect(document.querySelector(".dasti-proposal-design-preview")).toBeNull();
    expect(document.querySelector(".dasti-proposal-document")).toBeNull();
  });

  it("keeps proposal style selection isolated from proposal body content", () => {
    const onSelectStyleBundle = vi.fn();
    renderDesignFields({
      onSelectStyleBundle,
    });
    fireEvent.click(screen.getByRole("button", { name: "Style 2" }));

    expect(onSelectStyleBundle).toHaveBeenCalledWith("magazine_editorial");
    expect(screen.queryByTestId("proposal-design-live-preview")).not.toBeInTheDocument();
    expect(document.querySelector(".dasti-proposal-document")).toBeNull();
  });

  it("keeps proposal style selector CSS aligned with the CV Forge pill model", () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "src/styles/product-proposal.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.dasti-proposal-skeleton-rail__style-pills,[\s\S]*\.dasti-proposal-skeleton-rail__style-swatches\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*wrap;[\s\S]*gap:\s*var\(--space-2\);/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-skeleton-rail__style-pills button\s*\{[\s\S]*min-height:\s*28px;[\s\S]*border:\s*1px solid var\(--border-soft\);[\s\S]*border-radius:\s*var\(--radius-pill\);/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-skeleton-rail__style-pills button\[data-selected="true"\]\s*\{[\s\S]*color:\s*var\(--ac\);[\s\S]*border-color:\s*var\(--ac\);[\s\S]*background:\s*var\(--am-soft\);/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-design-style-pills button\s*\{[\s\S]*position:\s*relative;/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-design-fields__reset\s*\{[\s\S]*min-height:\s*var\(--control-sm\);[\s\S]*padding:\s*0 var\(--space-2\);[\s\S]*border:\s*1px solid var\(--border-soft\);[\s\S]*border-radius:\s*var\(--radius-pill\);[\s\S]*background:\s*var\(--sf1\);/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-skeleton-rail__signature-toggles\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*var\(--space-1\);[\s\S]*\}/,
    );
    expect(css).not.toContain("dasti-proposal-design-preview");
    expect(css).not.toContain("proposal-design-preview-inline-size");
  });

  it("selects the canonical proposal layout from the Style tab", () => {
    const onSelectProposalLayout = vi.fn();

    renderDesignFields({
      proposalTemplateId: null,
      onSelectProposalLayout,
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Minimal layout",
      }),
    );

    expect(onSelectProposalLayout).toHaveBeenCalledWith(
      CANONICAL_PROPOSAL_TEMPLATE_ID,
    );
  });

  it("keeps Style 3 selected, highlights ink, and exposes reset when the bundle is customized", () => {
    const onResetStyleBundle = vi.fn();

    renderDesignFields({
      styleTemplateBundleId: "grid_mono",
      stylePreset: {
        layout: "workshop",
        typography: "geist-baskervville",
        palette: "ink",
      },
      onResetStyleBundle,
    });

    expect(screen.getByRole("button", { name: "Style 3" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("Style 3 · Custom")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Customized")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Ink accent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const styleGrid = screen.getByLabelText("Proposal style presets");
    const style3 = screen.getByRole("button", { name: "Style 3" });
    const reset = screen.getByRole("button", { name: "Reset Style 3" });
    expect(reset).toHaveTextContent("Reset style");
    expect(reset.parentElement).toBe(styleGrid);
    expect(
      style3.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);

    fireEvent.click(reset);
    expect(onResetStyleBundle).toHaveBeenCalledWith("grid_mono");
  });

  it("compares custom state against the current Settings-backed bundle style", () => {
    const onResetStyleBundle = vi.fn();

    renderDesignFields({
      styleTemplateBundleId: "swiss_serif",
      stylePreset: getProposalTemplateBundleDefinition("swiss_serif").stylePreset,
      styleTemplateBundleBaseStyle: {
        ...getProposalTemplateBundleDefinition("swiss_serif").stylePreset,
        palette: "cobalt",
      },
      onResetStyleBundle,
    });

    expect(screen.queryByText("Style 1 · Custom")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Customized")).toBeInTheDocument();
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
        <ProposalDesignFields
          {...baseDesignProps}
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
    expect(screen.queryByText("Style 3 · Custom")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Customized")).toBeInTheDocument();
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
