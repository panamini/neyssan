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
  proposalTypeLabel: "Letter",
  proposalTypeOptions: [
    {
      id: "cover_letter" as const,
      label: "Letter",
      description: "A focused cover letter.",
      selected: true,
    },
    {
      id: "freelance_proposal" as const,
      label: "Proposal",
      description: "A freelance proposal.",
      selected: false,
    },
    {
      id: "application_message" as const,
      label: "Message",
      description: "A short application note.",
      selected: false,
    },
  ],
  onSelectProposalType: vi.fn(),
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

  it("keeps document lifecycle actions out of the Draft panel", () => {
    render(<ProposalRail {...baseProps} />);

    expect(
      screen.queryByRole("button", { name: "New proposal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save proposal to library" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete proposal" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  it("opens the Type row as a document type selector", async () => {
    const onSelectProposalType = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        onSelectProposalType={onSelectProposalType}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Document type" }));
    const menu = await screen.findByRole("menu", { name: "Document type" });

    expect(
      within(menu).getByRole("menuitemradio", { name: "Letter" }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(
      within(menu).getByRole("menuitemradio", { name: "Proposal" }),
    );

    expect(onSelectProposalType).toHaveBeenCalledWith("freelance_proposal");
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

  it("renders the Ask composer as a prompt surface without removing Draft", async () => {
    const onAskAiChange = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
        askAiValue=""
        askAiPlaceholder="Rewrite instruction"
        askAiHint="Apply change"
        onAskAiChange={onAskAiChange}
      />,
    );

    expect(screen.queryByRole("tab", { name: "Draft" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Ask AI", { selector: ".forge__rail-label" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Canva/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/one clear prompt is enough/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Rewrite instruction")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "data-toolbar-tooltip",
      "Apply change",
    );
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "data-toolbar-tooltip-placement",
      "below",
    );
    expect(screen.getByRole("button", { name: "Send" })).toHaveClass(
      "dasti-proposal-skeleton-rail__ask-send",
    );

    const suggestions = screen.getByLabelText("Ask suggestions");
    expect(within(suggestions).getByRole("button", { name: "Make it warmer" })).toBeInTheDocument();
    expect(within(suggestions).getByRole("button", { name: "Shorten it" })).toBeInTheDocument();

    fireEvent.click(within(suggestions).getByRole("button", { name: "Strengthen the close" }));
    expect(onAskAiChange).toHaveBeenCalledWith("Strengthen the close");
  });

  it("hides Ask suggestion rows after an instruction is typed", () => {
    render(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
        askAiValue="Make the opening more direct"
        askAiPlaceholder="Rewrite instruction"
      />,
    );

    expect(screen.queryByLabelText("Ask suggestions")).not.toBeInTheDocument();
  });

  it("autosizes the Ask textarea so long instructions grow the drawer content", async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight",
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 188,
    });

    render(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
        askAiValue={"Add concrete evidence.\n".repeat(8)}
        askAiPlaceholder="Rewrite instruction"
      />,
    );

    const textarea = screen.getByPlaceholderText(
      "Rewrite instruction",
    ) as HTMLTextAreaElement;

    await waitFor(() => {
      expect(textarea.style.height).toBe("188px");
    });

    if (scrollHeightDescriptor) {
      Object.defineProperty(
        HTMLTextAreaElement.prototype,
        "scrollHeight",
        scrollHeightDescriptor,
      );
    } else {
      delete (HTMLTextAreaElement.prototype as { scrollHeight?: number })
        .scrollHeight;
    }
  });

  it("renders Rail Ask review results with explicit apply and discard actions", () => {
    const onAskAiApply = vi.fn();
    const onAskAiDiscard = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
        askAiValue="Make it tighter"
        askAiReview={{
          status: "ready",
          resultText: "A tighter proposal draft.",
        }}
        onAskAiApply={onAskAiApply}
        onAskAiDiscard={onAskAiDiscard}
      />,
    );

    expect(screen.getByText("Suggested draft")).toBeInTheDocument();
    expect(
      screen.getByText("This will replace the current draft."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Rail Ask suggested draft")).toHaveTextContent(
      "A tighter proposal draft.",
    );
    expect(screen.queryByDisplayValue("Make it tighter")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(baseProps.askAiPlaceholder),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onAskAiDiscard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Apply to draft" }));
    expect(onAskAiApply).toHaveBeenCalledTimes(1);
  });

  it("keeps source controls available while Rail Ask review hides the composer", async () => {
    render(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
        hasExistingDraft
        askAiValue="Shorten it"
        askAiReview={{
          status: "ready",
          resultText: "A tighter proposal draft.",
        }}
      />,
    );

    expect(screen.getByText("Suggested draft")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Shorten it")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send" }),
    ).not.toBeInTheDocument();
    const sourceTrigger = screen.getByRole("button", {
      name: "Change source",
    });
    expect(sourceTrigger).toBeInTheDocument();

    fireEvent.click(sourceTrigger);
    const sourceMenu = await screen.findByRole("menu", {
      name: "Change source",
    });
    expect(sourceMenu).toHaveClass(
      "dasti-proposal-skeleton-rail__composer-menu",
    );
    expect(
      within(sourceMenu).getByRole("menuitem", { name: "Change job" }),
    ).toBeInTheDocument();
    expect(
      within(sourceMenu).getByRole("menuitem", { name: "Regenerate draft" }),
    ).toBeInTheDocument();
    expect(
      within(sourceMenu).getByRole("menuitem", { name: "Change CV" }),
    ).toBeInTheDocument();
  });

  it("requires confirmation before regenerating an existing draft", async () => {
    const onGenerateDraft = vi.fn();
    const onOpenCvs = vi.fn();

    render(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
        hasExistingDraft
        sourceCvTitle="Current CV"
        sourceCvMeta="Attached"
        cvOptions={[
          {
            id: "cv-next",
            title: "Updated CV",
            description: "Imported today",
            selected: false,
          },
        ]}
        onGenerateDraft={onGenerateDraft}
        onOpenCvs={onOpenCvs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Change source" }));
    let sourceMenu = await screen.findByRole("menu", {
      name: "Change source",
    });
    fireEvent.click(
      within(sourceMenu).getByRole("menuitem", { name: "Change CV" }),
    );
    expect(onOpenCvs).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("menuitemradio", { name: "Updated CV" }),
    ).not.toBeInTheDocument();
    expect(onGenerateDraft).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Change source" }));
    sourceMenu = await screen.findByRole("menu", { name: "Change source" });
    fireEvent.click(
      within(sourceMenu).getByRole("menuitem", { name: "Regenerate draft" }),
    );

    expect(onGenerateDraft).not.toHaveBeenCalled();
    expect(screen.getByText("Replace current draft?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onGenerateDraft).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Change source" }));
    sourceMenu = await screen.findByRole("menu", { name: "Change source" });
    fireEvent.click(
      within(sourceMenu).getByRole("menuitem", { name: "Regenerate draft" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Replace current draft" }),
    );
    expect(onGenerateDraft).toHaveBeenCalledTimes(1);
  });

  it("renders Rail Ask loading, error, and applied undo states compactly", () => {
    const onAskAiUndo = vi.fn();
    const { rerender } = render(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
        askAiBusy
        askAiValue="Make it tighter"
        askAiReview={{ status: "loading" }}
      />,
    );

    expect(screen.getByText("Working...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    rerender(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
        askAiValue="Make it tighter"
        askAiReview={{
          status: "error",
          errorMessage: "Ask AI returned no text.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ask AI returned no text.",
    );

    rerender(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
        askAiValue=""
        askAiReview={{ status: "applied", canUndo: true }}
        onAskAiUndo={onAskAiUndo}
      />,
    );

    expect(screen.getByText("Applied.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAskAiUndo).toHaveBeenCalledTimes(1);
  });

  it("keeps the Draft panel available outside the Ask drawer", () => {
    render(<ProposalRail {...baseProps} />);

    expect(screen.getByRole("tab", { name: "Draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Document type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(screen.getByText("Job context")).toBeInTheDocument();
  });

  it("opens Ask compact menus upward above the composer drawer", async () => {
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

    render(
      <ProposalRail
        {...baseProps}
        activeTab="ask"
        hideTabs
      />,
    );

    const lengthTrigger = screen.getByRole("button", { name: "Standard" });
    vi.spyOn(lengthTrigger, "getBoundingClientRect").mockReturnValue({
      x: 760,
      y: 520,
      top: 520,
      left: 760,
      right: 860,
      bottom: 552,
      width: 100,
      height: 32,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.click(lengthTrigger);
    const lengthMenu = await screen.findByRole("menu", { name: "Length" });
    vi.spyOn(lengthMenu, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 220,
      bottom: 120,
      width: 220,
      height: 120,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent(window, new Event("resize"));

    await waitFor(() => expect(lengthMenu).toHaveAttribute("data-side", "top"));
    await waitFor(() => expect(lengthMenu.style.left).toBe("640px"));
    expect(lengthMenu).toHaveClass(
      "dasti-proposal-skeleton-rail__composer-menu",
    );
    expect(lengthMenu).toHaveClass("dasti-composer-drawer-menu");

    const toneTrigger = screen.getByRole("button", { name: "Auto" });
    vi.spyOn(toneTrigger, "getBoundingClientRect").mockReturnValue({
      x: 868,
      y: 520,
      top: 520,
      left: 868,
      right: 968,
      bottom: 552,
      width: 100,
      height: 32,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.click(toneTrigger);
    const toneMenu = await screen.findByRole("menu", { name: "Tone" });
    vi.spyOn(toneMenu, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 220,
      bottom: 160,
      width: 220,
      height: 160,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent(window, new Event("resize"));

    await waitFor(() => expect(toneMenu).toHaveAttribute("data-side", "top"));
    await waitFor(() => expect(toneMenu.style.left).toBe("748px"));
    expect(toneMenu).toHaveClass(
      "dasti-proposal-skeleton-rail__composer-menu",
    );
    expect(toneMenu).toHaveClass("dasti-composer-drawer-menu");

    const productCss = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product.css"),
      "utf8",
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-skeleton-rail__composer-menu\s*\{[\s\S]*z-index:\s*calc\(var\(--z-modal\) \+ 2\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-composer-drawer-menu\s*\{[\s\S]*min-width:\s*144px;[\s\S]*max-width:\s*min\(168px,\s*calc\(100vw - \(var\(--space-2\) \* 2\)\)\);[\s\S]*padding:\s*var\(--space-1\);/,
    );
    expect(productCss).toMatch(
      /\.dasti-composer-drawer-menu\s+\.ds-menu__item\s*\{[\s\S]*min-height:\s*var\(--control-sm\);[\s\S]*padding:\s*0 var\(--space-2\);[\s\S]*gap:\s*var\(--space-2\);/,
    );
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
    expect(screen.queryByText("Capture, paste, or choose a job.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose from Job Forge" })).toHaveAttribute(
      "data-toolbar-tooltip",
      "Choose or paste a job.",
    );
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

  it("renders document image details only inside the Inspect popover", () => {
    const onDocumentDecorationChange = vi.fn();

    renderDesignFields({
      documentDecoration: {
        visible: true,
        source: "upload",
        dataUrl: "data:image/png;base64,AAAA",
        fileName: "mark.png",
        mimeType: "image/png",
        alt: "Company mark",
        sizePreset: "custom",
        customSizeMm: 49,
        fit: "contain",
        placementMode: "custom",
        xMm: 17,
        yMm: 35,
      },
      onDocumentDecorationChange,
    });

    expect(screen.getByText("Image", { selector: ".forge__rail-label" })).toBeInTheDocument();
    expect(screen.getByText("mark.png")).toBeInTheDocument();
    expect(screen.getByText("Contain • Medium")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Large" })).toBeNull();

    const uploadInput = screen.getByLabelText("Upload decoration image");
    expect(uploadInput).toHaveAttribute(
      "accept",
      ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml",
    );

    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const popover = screen.getByRole("dialog", { name: "Image controls" });

    fireEvent.click(within(popover).getByRole("button", { name: "Large" }));
    const presetCall = onDocumentDecorationChange.mock.calls.at(-1)?.[0];
    expect(presetCall.sizePreset).toBe(52);
    expect(presetCall.visible).toBe(true);
    expect(presetCall).not.toHaveProperty("customSizeMm");

    fireEvent.click(within(popover).getByRole("button", { name: "Cover" }));
    expect(onDocumentDecorationChange).toHaveBeenCalledWith(
      expect.objectContaining({ fit: "cover", visible: true }),
    );

    fireEvent.click(within(popover).getByRole("button", { name: "Remove image" }));
    expect(onDocumentDecorationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dataUrl: undefined,
        fileName: undefined,
        mimeType: undefined,
      }),
    );
  });

  it("renders the add image cell when no proposal image exists", () => {
    const onDocumentDecorationChange = vi.fn();

    renderDesignFields({
      documentDecoration: {
        visible: false,
        source: "upload",
        sizePreset: 35,
        fit: "contain",
        placementMode: "default",
        xMm: 17,
        yMm: 35,
      },
      onDocumentDecorationChange,
    });

    expect(screen.getByText("Image", { selector: ".forge__rail-label" })).toBeInTheDocument();
    expect(screen.getByText("Add image")).toBeInTheDocument();
    expect(screen.getByText("PNG or JPEG")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload decoration image")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inspect" })).toBeNull();
  });

  it("shows the Editorial flower mark only in the Editorial decoration drawer", () => {
    renderDesignFields({
      proposalTemplateId: "editorial_wide",
      documentDecoration: null,
    });

    expect(screen.getByText("Flower template mark.svg")).toBeInTheDocument();
    expect(
      document.querySelector(".dasti-proposal-design-image__thumb img"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inspect" })).toBeInTheDocument();
  });

  it("does not show the Editorial flower mark in the Minimal decoration drawer", () => {
    renderDesignFields({
      proposalTemplateId: "swiss_margin",
      documentDecoration: {
        visible: true,
        source: "upload",
        dataUrl: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
        fileName: "Flower template mark.svg",
        mimeType: "image/svg+xml",
        alt: "Template flower mark",
        sizePreset: 18,
        fit: "contain",
        placementMode: "default",
        xMm: 157,
        yMm: 18,
      },
    });

    expect(screen.getByText("Add image")).toBeInTheDocument();
    expect(screen.queryByText("Flower template mark.svg")).not.toBeInTheDocument();
    expect(
      document.querySelector(".dasti-proposal-design-fields__decoration-thumb"),
    ).toBeNull();
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
      screen.queryByText(/Style inherited from selected CV when available/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Default settings/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "→ Document style" })).not.toBeInTheDocument();
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
      /\.dasti-proposal-skeleton-rail__style-swatches\s*\{[\s\S]*overflow:\s*visible;[\s\S]*padding:\s*4px;[\s\S]*\}/,
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
      /\.dasti-proposal-design-style-pills__label--compact\s*\{[\s\S]*display:\s*none;[\s\S]*\}/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-skeleton-rail__style-pills\.dasti-proposal-design-style-pills\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[\s\S]*align-items:\s*stretch;[\s\S]*\}/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-skeleton-rail__style-pills\.dasti-proposal-design-style-pills--with-reset\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[\s\S]*\}/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-design-style-pills \.dasti-proposal-design-fields__reset\s*\{[\s\S]*align-self:\s*stretch;[\s\S]*justify-self:\s*stretch;[\s\S]*margin:\s*0;[\s\S]*\}/,
    );
    expect(css).toMatch(
      /@media \(min-width:\s*760px\)\s*\{[\s\S]*\.dasti-proposal-design-image__popover\s*\{[\s\S]*inset-inline-end:\s*0;[\s\S]*inset-block-start:\s*calc\(100% \+ var\(--space-2\)\);[\s\S]*\}/,
    );
    expect(css).not.toContain(
      ".dasti-proposal-design-image__popover {\n    inset-inline-end: calc(100% + var(--space-3));",
    );
    expect(css).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.dasti-proposal-design-style-pills__label--full\s*\{[\s\S]*display:\s*none;[\s\S]*\}/,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.dasti-proposal-design-style-pills__label--compact\s*\{[\s\S]*display:\s*inline;[\s\S]*\}/,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.dasti-proposal-design-style-pills__reset-label\s*\{[\s\S]*display:\s*none;[\s\S]*\}/,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.dasti-proposal-design-style-pills button\s*\{[\s\S]*min-height:\s*28px;[\s\S]*\}/,
    );
    expect(css).not.toMatch(
      /\.dasti-proposal-design-style-pills button\s*\{\s*min-height:\s*42px;/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-design-fields__reset\s*\{[\s\S]*min-height:\s*var\(--control-sm\);[\s\S]*padding:\s*0 var\(--space-2\);[\s\S]*border:\s*1px solid var\(--border-soft\);[\s\S]*border-radius:\s*var\(--radius-pill\);[\s\S]*background:\s*var\(--sf1\);/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-skeleton-rail__style-pills\.dasti-proposal-design-fields__decoration-pills\s*\{[\s\S]*display:\s*grid;[\s\S]*align-items:\s*stretch;[\s\S]*\}/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-design-fields__decoration-pills--size\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[\s\S]*\}/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-design-fields__decoration-pills--size[\s\S]*\.dasti-proposal-design-fields__decoration-custom-size\s*\{[\s\S]*grid-column:\s*1 \/ -1;[\s\S]*\}/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-design-fields__decoration-pills--fit\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[\s\S]*\}/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-skeleton-rail__style-swatch--custom:not\([\s\S]*\[data-selected="true"\][\s\S]*\)\s*\{[\s\S]*border:\s*0;[\s\S]*background:\s*var\(--custom-accent-gradient\);[\s\S]*box-shadow:\s*none;/,
    );
    expect(css).toMatch(
      /\.dasti-proposal-skeleton-rail__signature-toggles\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*gap:\s*var\(--space-1\);[\s\S]*\}/,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.dasti-proposal-design-fields__decoration-toggle[\s\S]*\.dasti-theme-switch__label\s*\{[\s\S]*display:\s*none;[\s\S]*\}/,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.dasti-proposal-design-fields__decoration-toggle[\s\S]*\.dasti-theme-switch__rail\s*\{[\s\S]*display:\s*none;[\s\S]*\}/,
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

  it("selects the editorial proposal layout from the Style tab", () => {
    const onSelectProposalLayout = vi.fn();

    renderDesignFields({
      proposalTemplateId: CANONICAL_PROPOSAL_TEMPLATE_ID,
      onSelectProposalLayout,
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Editorial layout",
      }),
    );

    expect(onSelectProposalLayout).toHaveBeenCalledWith("editorial_wide");
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
    expect(reset).toHaveTextContent("Reset");
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
