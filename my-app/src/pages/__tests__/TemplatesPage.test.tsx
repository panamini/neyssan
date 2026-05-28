import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCvTemplate } from "../../lib/cv-template";
import { TemplateDocumentPreview, TemplatesPage } from "../TemplatesPage";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("TemplatesPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    navigateMock.mockClear();
  });

  it("renders cover-letter templates with document previews by default", () => {
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Templates" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cover letters" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByText("Minimal")).toBeInTheDocument();
    expect(screen.getByText("French")).toBeInTheDocument();
    expect(screen.getByText("Editorial", { selector: ".dasti-template-card__title" })).toBeInTheDocument();
    expect(screen.getByText("Director Letterhead")).toBeInTheDocument();
    expect(screen.getByText("Volk Letterhead")).toBeInTheDocument();
    expect(screen.getByText("Film und Foto Letterhead")).toBeInTheDocument();
    expect(screen.getAllByText("Cover letter")).toHaveLength(6);
    expect(document.querySelector(".dasti-template-card__badge")).toBeNull();
    expect(screen.queryByRole("tab", { name: "CVs" })).toBeNull();
    expect(screen.getAllByTestId("template-document-preview")).toHaveLength(6);
  });

  it("renders template chrome in French without renaming templates", () => {
    window.localStorage.setItem("twoweeks:ui-language", "fr");
    window.localStorage.setItem("twoweeks:document-language", "es");

    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Modèles" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Lettres" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Personnaliser le style" })).toBeInTheDocument();
    expect(screen.getAllByText("Lettre", { selector: ".dasti-template-card__kind" })).toHaveLength(6);
    expect(screen.queryByText("Espacement calme, hiérarchie nette.")).not.toBeInTheDocument();
    expect(screen.queryByText("Ouverture directe, ton net.")).not.toBeInTheDocument();
    expect(screen.queryByText("Plus chaleureux, plus personnel.")).not.toBeInTheDocument();
    expect(screen.getByText("Editorial", { selector: ".dasti-template-card__title" })).toBeInTheDocument();
    expect(screen.queryByText(/Proposition|proposition/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("es");
  });

  it("renders template chrome in Spanish", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("twoweeks:ui-language", "es");
    window.localStorage.setItem("twoweeks:document-language", "fr");

    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Plantillas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cartas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Personalizar estilo" })).toBeInTheDocument();
    expect(screen.getAllByText("Carta", { selector: ".dasti-template-card__kind" })).toHaveLength(6);
    expect(screen.queryByText("Espaciado sobrio, jerarquía clara.")).not.toBeInTheDocument();
    expect(screen.queryByText("Apertura directa, tono claro.")).not.toBeInTheDocument();
    expect(screen.queryByText("Más cercano, más personal.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Propuesta|propuesta/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "CV" }));

    expect(screen.queryByText("Claro, legible, seguro.")).not.toBeInTheDocument();
    expect(screen.queryByText("Diseño europeo estructurado.")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("fr");
  });

  it("filters to resume templates and links style customization to settings", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Resume" }));
    expect(screen.getByText("Minimal", { selector: ".dasti-template-card__title" })).toBeInTheDocument();
    expect(screen.getByText("French", { selector: ".dasti-template-card__title" })).toBeInTheDocument();
    expect(screen.queryByText("Two-column")).toBeNull();
    expect(screen.queryByText("Classic")).toBeNull();
    expect(screen.queryByText("Compact")).toBeNull();
    expect(screen.queryByText("Workshop one-col")).toBeNull();
    expect(screen.queryByText("Workshop two-col")).toBeNull();
    expect(screen.getAllByTestId("template-document-preview")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Customize style" }));
    expect(navigateMock).toHaveBeenCalledWith("/settings?tab=docstyle");
  });

  it("opens a cover-letter template action surface without navigating", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const editorialCard = screen
      .getByText("Editorial", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(editorialCard).toBeTruthy();

    await user.click(editorialCard as HTMLElement);

    expect(navigateMock).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", {
      name: "Editorial",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Create new proposal" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Apply to current proposal" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByTestId("selected-template-document-preview"),
    ).toBeInTheDocument();
  });

  it("creates a new proposal from the selected template with reset state", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const editorialCard = screen
      .getByText("Editorial", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(editorialCard).toBeTruthy();
    await user.click(editorialCard as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Create new proposal" }));

    expect(navigateMock).toHaveBeenCalledWith(
      "/proposal?templateId=editorial",
      {
        state: expect.objectContaining({
          proposalWorkspaceResetToken: expect.any(String),
        }),
      },
    );
  });

  it("applies a cover-letter template without proposal reset state", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const editorialCard = screen
      .getByText("Editorial", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(editorialCard).toBeTruthy();
    await user.click(editorialCard as HTMLElement);
    await user.click(
      screen.getByRole("button", { name: "Apply to current proposal" }),
    );

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/proposal?templateId=editorial");
  });

  it("keeps template cards compact without an explicit arrow action", () => {
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const selectedCard = screen
      .getByText("Minimal", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(selectedCard).toBeTruthy();
    expect(selectedCard).toHaveAccessibleName("Use Minimal template");
    expect(selectedCard?.querySelector(".dasti-template-card__quick-action")).toBeNull();

    const frenchCard = screen
      .getByText("French", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(frenchCard).toBeTruthy();
    expect(frenchCard?.querySelector(".dasti-template-card__quick-action")).toBeNull();
  });

  it("opens a resume template action surface without creating a blank CV", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Resume" }));
    const frenchCard = screen
      .getByText("French", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(frenchCard).toBeTruthy();
    await user.click(frenchCard as HTMLElement);

    expect(navigateMock).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", {
      name: "French",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Apply to current CV" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Create new CV" }),
    ).toBeInTheDocument();
  });

  it("creates a new CV from the selected resume template", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Resume" }));
    const frenchCard = screen
      .getByText("French", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(frenchCard).toBeTruthy();
    await user.click(frenchCard as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Create new CV" }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith(
      "/cv?cvForgeAction=createBlank&templateId=french",
    );
  });

  it("opens the action surface from keyboard selection", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const minimalCard = screen.getByRole("button", {
      name: "Use Minimal template",
    });
    minimalCard.focus();
    await user.keyboard("{Enter}");

    expect(navigateMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Minimal" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    minimalCard.focus();
    await user.keyboard(" ");

    expect(
      screen.getByRole("dialog", { name: "Minimal" }),
    ).toBeInTheDocument();
  });

  it("starts cover-letter creation with the selected template intent", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const editorialCard = screen
      .getByText("Editorial", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(editorialCard).toBeTruthy();
    await user.click(editorialCard as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Create new proposal" }));

    expect(navigateMock).toHaveBeenCalledWith(
      "/proposal?templateId=editorial",
      {
        state: expect.objectContaining({
          proposalWorkspaceResetToken: expect.any(String),
        }),
      },
    );
    expect(navigateMock.mock.calls[0]?.[1]?.state).not.toHaveProperty(
      "proposalEntryIntent",
    );
  });

  it("starts cover-letter creation with a selected letterhead template id", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const directorCard = screen
      .getByText("Director Letterhead", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(directorCard).toBeTruthy();
    await user.click(directorCard as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Create new proposal" }));

    expect(navigateMock).toHaveBeenCalledWith(
      "/proposal?templateId=director-letterhead",
      {
        state: expect.objectContaining({
          proposalWorkspaceResetToken: expect.any(String),
        }),
      },
    );
    expect(navigateMock.mock.calls[0]?.[1]?.state).not.toHaveProperty(
      "proposalEntryIntent",
    );
  });

  it("keeps template previews as square-framed A4 paper with meta underneath", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Resume" }));

    const previews = screen.getAllByTestId("template-document-preview");
    expect(previews).toHaveLength(2);
    for (const preview of previews) {
      expect(preview.querySelector(".resume-template-renderer")).toBeTruthy();
      expect(preview.querySelector(".resume-template-page-canvas")).toBeTruthy();
      expect(
        preview.querySelectorAll(
          ".resume-template-renderer > .resume-template-page-shell",
        ),
      ).toHaveLength(1);
    }

    const stylesPath = path.resolve(
      __dirname,
      "../../styles/product-libraries.css",
    );
    const styles = fs.readFileSync(stylesPath, "utf8");
    const settingsStyles = fs.readFileSync(
      path.resolve(__dirname, "../../styles/product-settings.css"),
      "utf8",
    );
    expect(styles).not.toMatch(
      /\.dasti-template-card__document-scale\s+\.resume-template-page-shell/,
    );
    expect(styles).toMatch(
      /\.dasti-template-card__preview\s*\{[\s\S]*inline-size:\s*fit-content;[\s\S]*padding:\s*var\(--template-frame-pad\);[\s\S]*border-radius:\s*0;[\s\S]*background:\s*var\(--template-frame-bg\);/,
    );
    expect(styles).toMatch(
      /\.dasti-template-card__document-scale\s*\{[\s\S]*aspect-ratio:\s*210 \/ 297;[\s\S]*border-radius:\s*0;/,
    );
    expect(styles).toMatch(
      /\.dasti-template-card__head\s*\{[\s\S]*inline-size:\s*min\(100%,\s*var\(--template-frame-inline\)\);[\s\S]*padding-block-start:\s*var\(--space-1\);[\s\S]*border-block-end:/,
    );
    expect(styles).toMatch(
      /\.dasti-documents-grid\.projects-grid,\s*\.dasti-template-grid\s*\{[\s\S]*--library-gallery-row-gap:\s*clamp\(var\(--space-6\),\s*3vw,\s*var\(--space-9\)\);[\s\S]*--library-gallery-column-gap:\s*clamp\(var\(--space-6\),\s*3\.4vw,\s*var\(--space-9\)\);/,
    );
    expect(styles).toMatch(
      /\.dasti-template-grid\s*\{[\s\S]*gap:\s*var\(--library-gallery-row-gap\)\s*var\(--library-gallery-column-gap\);/,
    );
    expect(styles).toMatch(
      /\.dasti-template-preview\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;[\s\S]*z-index:\s*var\(--z-modal\);/,
    );
    expect(styles).toMatch(
      /\.dasti-template-preview__panel\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*auto;[\s\S]*background:\s*var\(--sfr\);/,
    );
    expect(settingsStyles).not.toMatch(
      /^\.dasti-template-card(?:__preview|__title|__description|\s|\{)/m,
    );
  });

  it("forces resume gallery cards to render their own workshop template ids", () => {
    const previewCv = generateCvTemplate("Preview CV with saved two-column style");
    previewCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "geist-baskervville",
      palette: "sauge",
      resumeTemplateId: "workshop_resume_twocol_ats",
    };

    const { rerender } = render(
      <TemplateDocumentPreview
        kind="Resume"
        family="workshop-onecol"
        previewCv={previewCv}
      />,
    );

    expect(screen.getByTestId("resume-template-renderer")).toHaveAttribute(
      "data-resume-template-id",
      "workshop_resume_onecol_ats",
    );
    expect(
      screen.queryByTestId("resume-template-page")?.getAttribute(
        "data-resume-template-layout",
      ),
    ).not.toBe("workshop-two-column");

    rerender(
      <TemplateDocumentPreview
        kind="Resume"
        family="workshop-twocol"
        previewCv={previewCv}
      />,
    );

    expect(screen.getByTestId("resume-template-renderer")).toHaveAttribute(
      "data-resume-template-id",
      "workshop_resume_twocol_ats",
    );
    expect(screen.getByTestId("resume-template-page")).toHaveAttribute(
      "data-resume-template-layout",
      "workshop-two-column",
    );
  });
});
