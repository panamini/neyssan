import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ForgeTemplatePanel } from "../ForgeTemplatePanel";
import CvDesignFields from "../cv/CvDesignFields";
import CvStageBar from "../cv/CvStageBar";
import ProposalDesignFields from "../proposal/ProposalDesignFields";
import ProposalDocumentStage from "../proposal/ProposalDocumentStage";
import ProposalHeadingFields from "../proposal/ProposalHeadingFields";
import { CANONICAL_PROPOSAL_TEMPLATE_ID } from "../../../convex/lib/proposals/renderTemplates";
import { getProposalTemplateBundleDefinition } from "../../lib/proposal-template-bundles";
import {
  ForgeTemplatePanelProvider,
  useForgeTemplatePanel,
  useRegisterForgePanel,
  useRegisterForgeTemplates,
} from "../../contexts/ForgeTemplatePanelContext";

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function RegisterTemplates({
  surface,
  onSelect,
}: {
  surface: "cv" | "proposal";
  onSelect: (itemId: string) => void;
}): null {
  useRegisterForgeTemplates(
    React.useMemo(
      () => ({
        surface,
        title: surface === "cv" ? "CV templates" : "Proposal templates",
        activeItemId: "schematic",
        items: [{ id: "schematic", label: "Schematic" }],
        onSelect,
      }),
      [onSelect, surface],
    ),
  );
  return null;
}

function CvTemplateEntryPoint({
  onSelect,
}: {
  onSelect: (itemId: string) => void;
}): JSX.Element {
  const {
    activeSurface,
    open,
    openSurface,
  } = useForgeTemplatePanel();
  return (
    <>
      <RegisterTemplates surface="cv" onSelect={onSelect} />
      <RegisterCvDesign />
      <CvStageBar
        mode="edit"
        exporting={false}
        tone="natural"
        resumeOptions={[]}
        templatesOpen={open && activeSurface === "cv"}
        designOpen={open && activeSurface === "cv-design"}
        onModeChange={vi.fn()}
        onOpenDesign={() => openSurface("cv-design")}
        onOpenTemplates={() => openSurface("cv")}
        onPickResume={vi.fn()}
      />
    </>
  );
}

function RegisterCvDesign(): null {
  useRegisterForgePanel(
    React.useMemo(() => {
      const stylePreset = {
        layout: "workshop" as const,
        typography: "geist-baskervville" as const,
        palette: "terre" as const,
        resumeTemplateId: "workshop_resume_onecol_ats" as const,
      };

      return {
        surface: "cv-design" as const,
        title: "Design",
        ariaLabel: "CV design",
        renderContent: () => (
          <CvDesignFields
            stylePreset={stylePreset}
            selectedStyleSlot={1}
            selectedStyleSlotIsCustom={false}
            onSelectStyleSlot={vi.fn()}
            onResetStyleSlot={vi.fn()}
            onSelectTemplate={vi.fn()}
            onSelectFontPair={vi.fn()}
            onSelectAccent={vi.fn()}
            onSelectCustomAccent={vi.fn()}
          />
        ),
      };
    }, []),
  );
  return null;
}

function ProposalTemplateEntryPoint({
  onSelect,
}: {
  onSelect: (itemId: string) => void;
}): JSX.Element {
  const {
    activeSurface,
    open,
    openSurface,
  } = useForgeTemplatePanel();
  return (
    <>
      <RegisterTemplates surface="proposal" onSelect={onSelect} />
      <RegisterProposalHeading />
      <RegisterProposalDesign />
      <ProposalDocumentStage
        toneLabel="Natural"
        toneValue="natural"
        mode="edit"
        hasProposalContent
        headingOpen={open && activeSurface === "proposal-heading"}
        onOpenHeading={() => openSurface("proposal-heading")}
        designOpen={open && activeSurface === "proposal-design"}
        onOpenDesign={() => openSurface("proposal-design")}
        templatesOpen={open && activeSurface === "proposal"}
        onOpenTemplates={() => openSurface("proposal")}
        onModeChange={vi.fn()}
      >
        <div>Proposal paper</div>
      </ProposalDocumentStage>
    </>
  );
}

function RegisterProposalHeading(): null {
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "proposal-heading" as const,
        title: "Heading",
        ariaLabel: "Proposal heading",
        renderContent: () => (
          <ProposalHeadingFields
            variableFields={[
              {
                id: "applicant-name",
                label: "Full name",
                value: "Alex Martin",
                onChange: vi.fn(),
              },
              {
                id: "recipient-details",
                label: "Recipient information",
                value: "Northstar",
                multiline: true,
                onChange: vi.fn(),
              },
              {
                id: "proposal-subject",
                label: "Subject line",
                value: "Application",
                onChange: vi.fn(),
              },
            ]}
          />
        ),
      }),
      [],
    ),
  );
  return null;
}

function RegisterProposalDesign(): null {
  useRegisterForgePanel(
    React.useMemo(() => {
      const stylePreset = getProposalTemplateBundleDefinition("swiss_serif").stylePreset;

      return {
        surface: "proposal-design" as const,
        title: "Design",
        ariaLabel: "Proposal design",
        renderContent: () => (
          <ProposalDesignFields
            proposalTemplateId={CANONICAL_PROPOSAL_TEMPLATE_ID}
            onSelectProposalLayout={vi.fn()}
            stylePreset={stylePreset}
            styleTemplateBundleId="swiss_serif"
            onSelectStyleBundle={vi.fn()}
            onResetStyleBundle={vi.fn()}
            onSelectStyleTypography={vi.fn()}
            onSelectStylePalette={vi.fn()}
            onSelectStyleCustomAccent={vi.fn()}
          />
        ),
      };
    }, []),
  );
  return null;
}

function renderEntryPoint(
  path: string,
  children: React.ReactNode,
): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ForgeTemplatePanelProvider>
        {children}
        <ForgeTemplatePanel />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </ForgeTemplatePanelProvider>
    </MemoryRouter>,
  );
}

describe("forge template entry points", () => {
  it("opens CV templates from the CV stage bar and keeps template selection wired", () => {
    const onSelect = vi.fn();
    renderEntryPoint("/cv", <CvTemplateEntryPoint onSelect={onSelect} />);

    const templates = screen.getByRole("button", { name: "Templates" });
    expect(templates).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(templates);

    expect(templates).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("complementary", { name: "CV templates" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("listitem", { name: "Schematic" }));
    expect(onSelect).toHaveBeenCalledWith("schematic");
  });

  it("opens CV design from the CV stage bar as a left drawer panel", () => {
    renderEntryPoint("/cv", <CvTemplateEntryPoint onSelect={vi.fn()} />);

    const design = screen.getByRole("button", { name: "Design" });
    expect(design).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(design);

    expect(design).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("complementary", { name: "CV design" });
    expect(within(panel).getByRole("button", { name: "Style 1" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 2" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 3" })).toBeInTheDocument();
    expect(within(panel).getByText("Font pair")).toBeInTheDocument();
    expect(within(panel).getByText("Accent")).toBeInTheDocument();
  });

  it("opens proposal templates from the proposal stage bar and keeps template selection wired", () => {
    const onSelect = vi.fn();
    renderEntryPoint(
      "/proposal",
      <ProposalTemplateEntryPoint onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Templates" }));

    expect(
      screen.getByRole("complementary", { name: "Proposal templates" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("listitem", { name: "Schematic" }));
    expect(onSelect).toHaveBeenCalledWith("schematic");
  });

  it("opens proposal heading from the proposal stage bar as a current document panel", () => {
    renderEntryPoint(
      "/proposal",
      <ProposalTemplateEntryPoint onSelect={vi.fn()} />,
    );

    const heading = screen.getByRole("button", { name: "Heading" });
    expect(heading).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(heading);

    expect(heading).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("complementary", {
      name: "Proposal heading",
    });
    expect(within(panel).getByText("Applicant details")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Full name")).toHaveValue("Alex Martin");
    expect(within(panel).queryByRole("tab", { name: "Ask" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("tab", { name: "Style" })).not.toBeInTheDocument();
  });

  it("opens proposal design from the proposal stage bar as one scrollable current document panel", () => {
    renderEntryPoint(
      "/proposal",
      <ProposalTemplateEntryPoint onSelect={vi.fn()} />,
    );

    const design = screen.getByRole("button", { name: "Design" });
    expect(design).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(design);

    expect(design).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("complementary", {
      name: "Proposal design",
    });
    expect(within(panel).queryByRole("tab")).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 1" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 2" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 3" })).toBeInTheDocument();
    expect(within(panel).getAllByTestId("proposal-design-live-preview")).toHaveLength(3);
    expect(within(panel).getByText("Typography")).toBeInTheDocument();
    expect(within(panel).getByText("Color")).toBeInTheDocument();
    expect(within(panel).getByText("Layout")).toBeInTheDocument();
    expect(
      within(panel).getByText("Signature", {
        selector: ".forge__rail-label",
      }),
    ).toBeInTheDocument();
    expect(within(panel).queryByText("Modified")).not.toBeInTheDocument();
    expect(within(panel).queryByText("Customize")).not.toBeInTheDocument();
    expect(within(panel).queryByText("Templates")).not.toBeInTheDocument();
  });

  it("browse all templates from a contextual panel goes to the global route", () => {
    renderEntryPoint(
      "/cv",
      <CvTemplateEntryPoint onSelect={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Templates" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Templates" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/templates");
    expect(
      screen.queryByRole("complementary", { name: "CV templates" }),
    ).not.toBeInTheDocument();
  });
});
