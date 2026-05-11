import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ForgeTemplatePanel } from "../ForgeTemplatePanel";
import CvStageBar from "../cv/CvStageBar";
import ProposalDocumentStage from "../proposal/ProposalDocumentStage";
import ProposalHeadingFields from "../proposal/ProposalHeadingFields";
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
      <CvStageBar
        mode="edit"
        exporting={false}
        tone="natural"
        resumeOptions={[]}
        templatesOpen={open && activeSurface === "cv"}
        onModeChange={vi.fn()}
        onOpenTemplates={() => openSurface("cv")}
        onPickResume={vi.fn()}
      />
    </>
  );
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
      <ProposalDocumentStage
        toneLabel="Natural"
        toneValue="natural"
        mode="edit"
        exporting={false}
        hasProposalContent
        headingOpen={open && activeSurface === "proposal-heading"}
        onOpenHeading={() => openSurface("proposal-heading")}
        templatesOpen={open && activeSurface === "proposal"}
        onOpenTemplates={() => openSurface("proposal")}
        onModeChange={vi.fn()}
        onCopyText={vi.fn()}
        onExportPdf={vi.fn()}
        onExportDocx={vi.fn()}
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
