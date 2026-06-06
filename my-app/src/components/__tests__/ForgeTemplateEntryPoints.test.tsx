import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ForgeTemplatePanel } from "../ForgeTemplatePanel";
import CvDesignFields from "../cv/CvDesignFields";
import CvStageBar from "../cv/CvStageBar";
import ProposalDesignFields from "../proposal/ProposalDesignFields";
import ProposalDocumentStage from "../proposal/ProposalDocumentStage";
import ProposalHeadingFields from "../proposal/ProposalHeadingFields";
import { CANONICAL_PROPOSAL_TEMPLATE_ID } from "../../../convex/lib/proposals/renderTemplates";
import { buildProposalRecipientDetails } from "../../lib/proposal-header";
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
      <RegisterCvSections />
      <RegisterCvDesign />
      <CvStageBar
        mode="edit"
        exporting={false}
        tone="natural"
        templatesOpen={open && activeSurface === "cv"}
        sectionsOpen={open && activeSurface === "cv-sections"}
        designOpen={open && activeSurface === "cv-design"}
        onModeChange={vi.fn()}
        onOpenSections={() => openSurface("cv-sections")}
        onOpenDesign={() => openSurface("cv-design")}
        onOpenTemplates={() => openSurface("cv")}
      />
    </>
  );
}

function RegisterCvSections(): null {
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "cv-sections" as const,
        title: "Sections",
        ariaLabel: "CV sections",
        renderContent: () => <div>Sections drawer content</div>,
      }),
      [],
    ),
  );
  return null;
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
      <RegisterProposalDraft />
      <ProposalDocumentStage
        mode="edit"
        hasProposalContent
        headingOpen={open && activeSurface === "proposal-heading"}
        onOpenHeading={() => openSurface("proposal-heading")}
        designOpen={open && activeSurface === "proposal-design"}
        onOpenDesign={() => openSurface("proposal-design")}
        templatesOpen={open && activeSurface === "proposal"}
        onOpenTemplates={() => openSurface("proposal")}
        onOpenDraft={() => openSurface("proposal-draft")}
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

function RegisterProposalDraft(): null {
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "proposal-draft" as const,
        title: "Draft",
        ariaLabel: "Proposal draft",
        renderContent: () => <div>Draft drawer content</div>,
      }),
      [],
    ),
  );
  return null;
}

function RegisterDynamicProposalHeading(): JSX.Element {
  const { openSurface } = useForgeTemplatePanel();
  const [name, setName] = React.useState("Alex Martin");
  const [recipientFields, setRecipientFields] = React.useState({
    name: "Hiring Manager",
    role: "",
    company: "",
    address: "",
    email: "",
    city: "New",
  });
  const [recipientDetails, setRecipientDetails] = React.useState(
    buildProposalRecipientDetails(recipientFields),
  );

  const handleRecipientChange = React.useCallback(
    (field: keyof typeof recipientFields, value: string) => {
      setRecipientFields((current) => {
        const next = { ...current, [field]: value };
        setRecipientDetails(buildProposalRecipientDetails(next));
        return next;
      });
    },
    [],
  );

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
                value: name,
                onChange: setName,
              },
              {
                id: "recipient-city",
                label: "Recipient city / location",
                value: recipientFields.city,
                onChange: (value) => handleRecipientChange("city", value),
              },
            ]}
          />
        ),
      }),
      [handleRecipientChange, name, recipientFields.city],
    ),
  );

  return (
    <>
      <button type="button" onClick={() => openSurface("proposal-heading")}>
        Open heading
      </button>
      <output aria-label="Recipient details">{recipientDetails}</output>
    </>
  );
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
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens CV templates from the CV stage bar and keeps template selection wired", () => {
    const onSelect = vi.fn();
    renderEntryPoint("/cv", <CvTemplateEntryPoint onSelect={onSelect} />);

    const templates = screen.getByRole("button", { name: "Templates" });
    expect(templates).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(templates);

    expect(templates).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("complementary", { name: "CV templates" });
    expect(panel).toHaveAttribute("data-mode", "overlay");
    expect(within(panel).getByRole("button", { name: "Pin drawer" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Collapse drawer" })).toBeInTheDocument();
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
    expect(panel).toHaveAttribute("data-mode", "overlay");
    expect(within(panel).getByRole("button", { name: "Pin drawer" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Collapse drawer" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 1" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 2" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 3" })).toBeInTheDocument();
    expect(within(panel).getByText("Font pair")).toBeInTheDocument();
    const designLabels = Array.from(
      panel.querySelectorAll(".dasti-cv-rail-label"),
    ).map((label) => label.textContent?.trim());
    expect(designLabels).toContain("Accent");
    expect(within(panel).getByText("Bullets")).toBeInTheDocument();
    expect(within(panel).queryByText("List marker")).not.toBeInTheDocument();
  });

  it("opens CV sections from the CV stage bar as overlay", () => {
    renderEntryPoint("/cv", <CvTemplateEntryPoint onSelect={vi.fn()} />);

    const sections = screen.getByRole("button", { name: "Sections" });
    expect(sections).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(sections);

    expect(sections).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("complementary", { name: "CV sections" });
    expect(panel).toHaveAttribute("data-mode", "overlay");
    expect(within(panel).getByText("Sections drawer content")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Pin drawer" })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Collapse drawer" }));
    expect(
      screen.queryByRole("complementary", { name: "CV sections" }),
    ).not.toBeInTheDocument();
  });

  it("opens proposal templates from the proposal stage bar and keeps template selection wired", () => {
    const onSelect = vi.fn();
    renderEntryPoint(
      "/proposal",
      <ProposalTemplateEntryPoint onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Templates" }));

    const panel = screen.getByRole("complementary", {
      name: "Proposal templates",
    });
    expect(panel).toHaveAttribute("data-mode", "overlay");
    expect(within(panel).getByRole("button", { name: "Pin drawer" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Collapse drawer" })).toBeInTheDocument();
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
    expect(panel).toHaveAttribute("data-mode", "overlay");
    expect(within(panel).getByRole("button", { name: "Pin drawer" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Collapse drawer" })).toBeInTheDocument();
    expect(within(panel).getByText("Applicant details")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Full name")).toHaveValue("Alex Martin");
    expect(within(panel).queryByRole("tab", { name: "Ask" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("tab", { name: "Style" })).not.toBeInTheDocument();
  });

  it("keeps a focused heading text input mounted while its panel registration updates", () => {
    renderEntryPoint("/proposal", <RegisterDynamicProposalHeading />);

    fireEvent.click(screen.getByRole("button", { name: "Open heading" }));
    const input = screen.getByLabelText("Full name") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 0);

    fireEvent.change(input, {
      target: {
        value: "ZAlex Martin",
        selectionStart: 1,
        selectionEnd: 1,
      },
    });

    expect(screen.getByLabelText("Full name")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
  });

  it("preserves spaces and cursor position in structured recipient heading fields", () => {
    renderEntryPoint("/proposal", <RegisterDynamicProposalHeading />);

    fireEvent.click(screen.getByRole("button", { name: "Open heading" }));
    const input = screen.getByLabelText(
      "Recipient city / location",
    ) as HTMLInputElement;
    input.focus();
    input.setSelectionRange(3, 3);

    fireEvent.change(input, {
      target: {
        value: "New ",
        selectionStart: 4,
        selectionEnd: 4,
      },
    });

    expect(input).toHaveValue("New ");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(4);
    expect(screen.getByLabelText("Recipient details")).toHaveTextContent("New");
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
    expect(panel).toHaveAttribute("data-mode", "overlay");
    expect(within(panel).getByRole("button", { name: "Pin drawer" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Collapse drawer" })).toBeInTheDocument();
    expect(within(panel).queryByRole("tab")).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 1" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 2" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Style 3" })).toBeInTheDocument();
    expect(within(panel).queryByTestId("proposal-design-live-preview")).not.toBeInTheDocument();
    expect(panel.querySelector(".dasti-proposal-design-preview")).toBeNull();
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

  it("opens proposal draft from the proposal stage bar as overlay", () => {
    renderEntryPoint(
      "/proposal",
      <ProposalTemplateEntryPoint onSelect={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId("proposal-draft-button"));

    const panel = screen.getByRole("complementary", {
      name: "Proposal draft",
    });
    expect(panel).toHaveAttribute("data-mode", "overlay");
    expect(within(panel).getByText("Draft drawer content")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Pin drawer" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Collapse drawer" })).toBeInTheDocument();
  });

  it("keeps toolbar hover passive and reserves drawer opening for clicks", () => {
    renderEntryPoint("/cv", <CvTemplateEntryPoint onSelect={vi.fn()} />);

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Sections" }), {
      pointerType: "mouse",
    });
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Design" }), {
      pointerType: "mouse",
    });
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Templates" }), {
      pointerType: "mouse",
    });

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it.each([
    ["/cv", "Sections", "CV sections", <CvTemplateEntryPoint key="cv" onSelect={vi.fn()} />],
    ["/cv", "Design", "CV design", <CvTemplateEntryPoint key="cv" onSelect={vi.fn()} />],
    ["/cv", "Templates", "CV templates", <CvTemplateEntryPoint key="cv" onSelect={vi.fn()} />],
    [
      "/proposal",
      "Heading",
      "Proposal heading",
      <ProposalTemplateEntryPoint key="proposal" onSelect={vi.fn()} />,
    ],
    [
      "/proposal",
      "Design",
      "Proposal design",
      <ProposalTemplateEntryPoint key="proposal" onSelect={vi.fn()} />,
    ],
    [
      "/proposal",
      "Templates",
      "Proposal templates",
      <ProposalTemplateEntryPoint key="proposal" onSelect={vi.fn()} />,
    ],
    [
      "/proposal",
      "Draft proposal",
      "Proposal draft",
      <ProposalTemplateEntryPoint key="proposal" onSelect={vi.fn()} />,
    ],
  ])(
    "pins %s toolbar %s panel into docked mode",
    (path, buttonName, panelName, entryPoint) => {
      renderEntryPoint(path, entryPoint);

      fireEvent.click(screen.getByRole("button", { name: buttonName }));
      const panel = screen.getByRole("complementary", { name: panelName });
      expect(panel).toHaveAttribute("data-mode", "overlay");
      expect(
        within(panel).getByRole("button", { name: "Pin drawer" }),
      ).toBeInTheDocument();

      fireEvent.click(within(panel).getByRole("button", { name: "Pin drawer" }));

      expect(panel).toHaveAttribute("data-mode", "docked");
      expect(
        within(panel).queryByRole("button", { name: "Pin drawer" }),
      ).not.toBeInTheDocument();
      expect(
        within(panel).getByRole("button", { name: "Collapse drawer" }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    ["/cv", "Templates", "Sections", "CV sections", <CvTemplateEntryPoint key="cv" onSelect={vi.fn()} />],
    ["/cv", "Templates", "Design", "CV design", <CvTemplateEntryPoint key="cv" onSelect={vi.fn()} />],
    [
      "/proposal",
      "Templates",
      "Heading",
      "Proposal heading",
      <ProposalTemplateEntryPoint key="proposal" onSelect={vi.fn()} />,
    ],
    [
      "/proposal",
      "Templates",
      "Design",
      "Proposal design",
      <ProposalTemplateEntryPoint key="proposal" onSelect={vi.fn()} />,
    ],
  ])(
    "keeps %s toolbar %s panel docked when switching to %s",
    (path, firstButtonName, nextButtonName, nextPanelName, entryPoint) => {
      renderEntryPoint(path, entryPoint);

      fireEvent.click(screen.getByRole("button", { name: firstButtonName }));
      fireEvent.click(screen.getByRole("button", { name: "Pin drawer" }));
      expect(screen.getByRole("complementary")).toHaveAttribute(
        "data-mode",
        "docked",
      );

      fireEvent.click(screen.getByRole("button", { name: nextButtonName }));

      const nextPanel = screen.getByRole("complementary", {
        name: nextPanelName,
      });
      expect(nextPanel).toHaveAttribute("data-mode", "docked");
      expect(
        within(nextPanel).queryByRole("button", { name: "Pin drawer" }),
      ).not.toBeInTheDocument();
      expect(
        within(nextPanel).getByRole("button", { name: "Collapse drawer" }),
      ).toBeInTheDocument();
    },
  );

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

  it.each([
    {
      locale: "fr",
      templates: "Modèles",
      pin: "Épingler",
      openTemplates: "Ouvrir les modèles",
      collapse: "Replier le panneau",
    },
    {
      locale: "es",
      templates: "Plantillas",
      pin: "Fijar panel",
      openTemplates: "Abrir plantillas",
      collapse: "Contraer panel",
    },
  ])(
    "renders contextual template panel chrome in $locale",
    ({ locale, templates, pin, openTemplates, collapse }) => {
      window.localStorage.setItem("twoweeks:ui-language", locale);
      window.localStorage.setItem("twoweeks:document-language", "ar");

      renderEntryPoint("/cv", <CvTemplateEntryPoint onSelect={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: templates }));

      const panel = screen.getByRole("complementary", {
        name: "CV templates",
      });
      expect(within(panel).getByText(templates)).toBeInTheDocument();
      expect(within(panel).getByRole("button", { name: pin })).toBeInTheDocument();
      expect(
        within(panel).getByRole("button", { name: openTemplates }),
      ).toBeInTheDocument();
      expect(
        within(panel).getByRole("button", { name: collapse }),
      ).toBeInTheDocument();
      expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
        "ar",
      );
    },
  );
});
