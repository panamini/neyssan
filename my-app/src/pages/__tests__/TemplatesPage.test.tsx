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
    expect(screen.getByText("Minimal · US Letter")).toBeInTheDocument();
    expect(screen.getByText("French · A4")).toBeInTheDocument();
    expect(screen.getByText("Editorial", { selector: ".dasti-template-card__title" })).toBeInTheDocument();
    expect(screen.getByText("Twoweeks Letterhead")).toBeInTheDocument();
    expect(screen.getByText("Director Letterhead")).toBeInTheDocument();
    expect(screen.getByText("Volk Letterhead")).toBeInTheDocument();
    expect(screen.getByText("Film und Foto Letterhead")).toBeInTheDocument();
    expect(screen.getByText("MoMA Bauhaus Letterhead")).toBeInTheDocument();
    expect(screen.getByText("Joella Frame Letterhead")).toBeInTheDocument();
    expect(screen.getByText("Bayer")).toBeInTheDocument();
    expect(screen.getAllByText("Cover letter")).toHaveLength(10);
    expect(document.querySelector(".dasti-template-card__badge")).toBeNull();
    expect(screen.queryByRole("tab", { name: "CVs" })).toBeNull();
    expect(screen.getAllByTestId("template-document-preview")).toHaveLength(10);
    const editorialCard = screen
      .getByText("Editorial", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(editorialCard).toBeTruthy();
    expect(
      editorialCard?.querySelector(".proposal-cover-letter--editorial"),
    ).toBeTruthy();
  });

  it("previews the US layout on Letter and the French layout on A4", () => {
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const minimalCard = screen
      .getByText("Minimal · US Letter", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    const frenchCard = screen
      .getByText("French · A4", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    const minimalDocument = minimalCard?.querySelector<HTMLElement>(
      ".dasti-proposal-document--workshop-proposal-margin",
    );
    const frenchDocument = frenchCard?.querySelector<HTMLElement>(
      ".dasti-proposal-document--modernist-signal",
    );

    expect(
      minimalDocument?.style.getPropertyValue("--proposal-page-width-mm"),
    ).toBe("215.9");
    expect(
      minimalDocument?.style.getPropertyValue("--proposal-page-height-mm"),
    ).toBe("279.4");
    expect(
      frenchDocument?.style.getPropertyValue("--proposal-page-width-mm"),
    ).toBe("210");
    expect(
      frenchDocument?.style.getPropertyValue("--proposal-page-height-mm"),
    ).toBe("297");
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
    expect(screen.getAllByText("Lettre", { selector: ".dasti-template-card__kind" })).toHaveLength(10);
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
    expect(screen.getAllByText("Carta", { selector: ".dasti-template-card__kind" })).toHaveLength(10);
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
    expect(screen.getByText("Sanat", { selector: ".dasti-template-card__title" })).toBeInTheDocument();
    expect(screen.getByText("Maggie", { selector: ".dasti-template-card__title" })).toBeInTheDocument();
    expect(screen.getByText("Editorial Sidebar", { selector: ".dasti-template-card__title" })).toBeInTheDocument();
    expect(screen.queryByText("Two-column")).toBeNull();
    expect(screen.queryByText("Classic")).toBeNull();
    expect(screen.queryByText("Compact")).toBeNull();
    expect(screen.queryByText("Workshop one-col")).toBeNull();
    expect(screen.queryByText("Workshop two-col")).toBeNull();
    expect(screen.getAllByTestId("template-document-preview")).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "Customize style" }));
    expect(navigateMock).toHaveBeenCalledWith("/settings?tab=docstyle");
  });

  it("starts blank CV creation with the Maggie Letter resume template id", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Resume" }));
    const maggieCard = screen
      .getByText("Maggie", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(maggieCard).toBeTruthy();
    await user.click(maggieCard as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Create new CV" }));

    expect(navigateMock).toHaveBeenCalledWith(
      "/cv?cvForgeAction=createBlank&templateId=maggie_letter_resume",
    );
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
      "/proposal?templateId=editorial_wide",
      {
        state: expect.objectContaining({
          proposalWorkspaceResetToken: expect.any(String),
        }),
      },
    );
  });

  it.each([
    {
      label: "Minimal · US Letter",
      href: "/proposal?templateId=workshop_proposal_margin",
    },
    { label: "French · A4", href: "/proposal?templateId=modernist_signal" },
  ])(
    "creates $label without overriding the saved page format",
    async ({ label, href }) => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/templates"]}>
          <TemplatesPage />
        </MemoryRouter>,
      );

      const templateCard = screen
        .getByText(label, { selector: ".dasti-template-card__title" })
        .closest(".dasti-template-card");
      expect(templateCard).toBeTruthy();
      await user.click(templateCard as HTMLElement);
      await user.click(
        screen.getByRole("button", { name: "Create new proposal" }),
      );

      expect(navigateMock).toHaveBeenCalledWith(href, {
        state: expect.objectContaining({
          proposalWorkspaceResetToken: expect.any(String),
        }),
      });
    },
  );

  it("applies a cover-letter template back to the current saved proposal", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/templates",
            state: {
              proposalReturnTo: "/proposal?view=saved&id=proposal_beta",
            },
          },
        ]}
      >
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
    expect(navigateMock).toHaveBeenCalledWith(
      "/proposal?view=saved&id=proposal_beta&templateId=editorial_wide",
    );
  });

  it("keeps template cards compact without an explicit arrow action", () => {
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const selectedCard = screen
      .getByText("Minimal · US Letter", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(selectedCard).toBeTruthy();
    expect(selectedCard).toHaveAccessibleName("Use Minimal · US Letter template");
    expect(selectedCard?.querySelector(".dasti-template-card__quick-action")).toBeNull();

    const frenchCard = screen
      .getByText("French · A4", { selector: ".dasti-template-card__title" })
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

  it("creates a new editorial sidebar CV from the selected resume template", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Resume" }));
    const editorialSidebarCard = screen
      .getByText("Editorial Sidebar", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(editorialSidebarCard).toBeTruthy();
    await user.click(editorialSidebarCard as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Create new CV" }));

    expect(navigateMock).toHaveBeenCalledWith(
      "/cv?cvForgeAction=createBlank&templateId=editorial-sidebar",
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
      name: "Use Minimal · US Letter template",
    });
    minimalCard.focus();
    await user.keyboard("{Enter}");

    expect(navigateMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Minimal · US Letter" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    minimalCard.focus();
    await user.keyboard(" ");

    expect(
      screen.getByRole("dialog", { name: "Minimal · US Letter" }),
    ).toBeInTheDocument();
  });

  it("starts cover-letter creation with the selected direct template id", async () => {
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
      "/proposal?templateId=editorial_wide",
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

  it.each([
    ["Twoweeks Letterhead", "twoweeks-letterhead"],
    ["Director Letterhead", "director-letterhead"],
    ["MoMA Bauhaus Letterhead", "moma-bauhaus-letterhead"],
    ["Joella Frame Letterhead", "joella-frame-letterhead"],
    ["Bayer", "bayer-letterhead"],
  ])(
    "starts cover-letter creation with selected %s template id",
    async (label, templateId) => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const letterheadCard = screen
      .getByText(label, { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(letterheadCard).toBeTruthy();
    await user.click(letterheadCard as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Create new proposal" }));

    expect(navigateMock).toHaveBeenCalledWith(
      `/proposal?templateId=${templateId}`,
      {
        state: expect.objectContaining({
          proposalWorkspaceResetToken: expect.any(String),
        }),
      },
    );
    expect(navigateMock.mock.calls[0]?.[1]?.state).not.toHaveProperty(
      "proposalEntryIntent",
    );
    },
  );

  it("keeps template previews as square-framed A4 paper with meta underneath", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Resume" }));

    const previews = screen.getAllByTestId("template-document-preview");
    expect(previews).toHaveLength(5);
    for (const preview of previews) {
      const workshopRenderer = preview.querySelector(".resume-template-renderer");
      const legacyResumePage = preview.querySelector(".resume-page");

      expect(workshopRenderer || legacyResumePage).toBeTruthy();
      if (workshopRenderer) {
        expect(preview.querySelector(".resume-template-page-canvas")).toBeTruthy();
        expect(preview.querySelectorAll(".resume-template-renderer > .resume-template-page-shell")).toHaveLength(1);
      } else {
        expect(legacyResumePage).toBeTruthy();
      }
    }

    const stylesPath = path.resolve(
      __dirname,
      "../../styles/product-libraries.css",
    );
    const styles = fs.readFileSync(stylesPath, "utf8");
    const foundationStyles = fs.readFileSync(
      path.resolve(__dirname, "../../styles/foundation.css"),
      "utf8",
    );
    const productStyles = fs.readFileSync(
      path.resolve(__dirname, "../../styles/product.css"),
      "utf8",
    );
    const proposalStyles = fs.readFileSync(
      path.resolve(__dirname, "../../styles/product-proposal.css"),
      "utf8",
    );
    const settingsStyles = fs.readFileSync(
      path.resolve(__dirname, "../../styles/product-settings.css"),
      "utf8",
    );
    expect(styles).not.toMatch(
      /\.dasti-template-card__document-scale\s+\.resume-template-page-shell/,
    );
    expect(styles).toMatch(
      /--library-preview-frame-bg:\s*color-mix\(in srgb,\s*var\(--sf2\) 82%,\s*var\(--sf1\)\);/,
    );
    expect(styles).toMatch(
      /\.dark\s*\{[\s\S]*--library-preview-frame-bg:\s*color-mix\(in srgb,\s*var\(--sf2\) 86%,\s*var\(--sfr\)\);/,
    );
    expect(styles).toMatch(
      /\.dasti-template-card\s*\{[\s\S]*--template-frame-bg:\s*var\(--library-preview-frame-bg\);/,
    );
    expect(styles).toMatch(
      /\.dasti-template-card__preview\s*\{[\s\S]*inline-size:\s*fit-content;[\s\S]*padding:\s*var\(--template-frame-pad\);[\s\S]*border-radius:\s*0;[\s\S]*background:\s*var\(--template-frame-bg\);[\s\S]*transition:\s*transform var\(--motion-duration-fast\) var\(--motion-ease-standard\);/,
    );
    expect(styles).toMatch(
      /\.dasti-template-card:hover\s+\.dasti-template-card__preview,[\s\S]*?\.dasti-template-card:focus-visible\s+\.dasti-template-card__preview\s*\{[\s\S]*transform:\s*translateY\(-1px\);/,
    );
    expect(styles).not.toMatch(
      /\.dasti-template-card:hover\s+\.dasti-template-card__document-scale,[\s\S]*?\.dasti-template-card:focus-visible\s+\.dasti-template-card__document-scale\s*\{[\s\S]*border-color:/,
    );
    expect(styles).toMatch(
      /\.dasti-template-card__document-scale\s*\{[\s\S]*aspect-ratio:\s*210 \/ 297;[\s\S]*border-radius:\s*0;/,
    );
    expect(styles).toMatch(
      /\.dasti-template-card__head\s*\{[\s\S]*inline-size:\s*min\(100%,\s*var\(--template-frame-inline\)\);[\s\S]*padding-block-start:\s*var\(--space-1\);[\s\S]*border-block-end:/,
    );
    expect(foundationStyles).toMatch(
      /--library-gallery-row-gap:\s*clamp\(var\(--space-6\),\s*3vw,\s*var\(--space-9\)\);[\s\S]*--library-gallery-column-gap:\s*clamp\(var\(--space-6\),\s*3\.4vw,\s*var\(--space-9\)\);/,
    );
    expect(styles).toMatch(
      /\.dasti-template-grid\s*\{[\s\S]*gap:\s*var\(--library-gallery-row-gap\)\s*var\(--library-gallery-column-gap\);/,
    );
    expect(styles).not.toMatch(
      /\.dasti-template-grid[\s\S]*minmax\(min\(100%,\s*304px\),\s*1fr\)/,
    );
    expect(styles).not.toMatch(
      /\.dasti-template-grid,\s*\.dasti-template-grid\[data-template-filter="resume"\]\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
    expect(proposalStyles).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.dasti-proposal-document__page,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
    expect(styles).toMatch(
      /\.dasti-template-card__document-scale\s+\.dasti-proposal-document__page,[\s\S]*?\.dasti-template-card__document-scale\s+\.dasti-proposal-document--quiet-margin\s+\.dasti-proposal-document__page\s*\{[\s\S]*?grid-template-columns:\s*calc\(var\(--proposal-inline-mm\) \* var\(--proposal-template-left-zone-mm\)\)\s*minmax\(0,\s*1fr\);[\s\S]*?row-gap:\s*0;/,
    );
    expect(productStyles).toMatch(
      /\.today-recent-grid\s*\{[\s\S]*gap:\s*var\(--library-gallery-row-gap\)\s*var\(--library-gallery-column-gap\);/,
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

    rerender(
      <TemplateDocumentPreview
        kind="Resume"
        family="maggie-letter"
        previewCv={previewCv}
      />,
    );

    expect(screen.getByTestId("resume-template-renderer")).toHaveAttribute(
      "data-resume-template-id",
      "maggie_letter_resume",
    );
    expect(screen.getByTestId("resume-template-page")).toHaveAttribute(
      "data-resume-template-layout",
      "maggie-letter",
    );
  });

  it("renders the editorial sidebar resume template through the legacy ResumePage path", () => {
    render(
      <TemplateDocumentPreview
        kind="Resume"
        family="editorial-sidebar"
        previewCv={generateCvTemplate("Editorial sidebar preview CV")}
      />,
    );

    expect(screen.queryByTestId("resume-template-renderer")).not.toBeInTheDocument();
    expect(document.querySelector(".resume-page--editorialsidebar")).toBeTruthy();
  });

  it("renders the Sanat resume thumbnail with the Sanat template renderer", () => {
    render(
      <TemplateDocumentPreview
        kind="Resume"
        family="sanat-asymmetric"
        previewCv={generateCvTemplate("Sanat preview CV")}
      />,
    );

    expect(screen.getByTestId("resume-template-renderer")).toHaveAttribute(
      "data-resume-template-id",
      "sanat_asymmetric_resume",
    );
    expect(screen.getByTestId("resume-template-page")).toHaveAttribute(
      "data-resume-template-layout",
      "sanat-asymmetric",
    );
  });
});
