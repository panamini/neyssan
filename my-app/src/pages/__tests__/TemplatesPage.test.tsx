import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplatesPage } from "../TemplatesPage";

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

  it("renders template chrome and descriptions in French without renaming templates", () => {
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
    expect(screen.getAllByText("Espacement calme, hiérarchie nette.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ouverture directe, ton net.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Plus chaleureux, plus personnel.").length).toBeGreaterThan(0);
    expect(screen.getByText("Editorial", { selector: ".dasti-template-card__title" })).toBeInTheDocument();
    expect(screen.queryByText(/Proposition|proposition/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("es");
  });

  it("renders template chrome and descriptions in Spanish", async () => {
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
    expect(screen.getAllByText("Espaciado sobrio, jerarquía clara.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Apertura directa, tono claro.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Más cercano, más personal.").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Propuesta|propuesta/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "CV" }));

    expect(screen.getByText("Claro, legible, seguro.")).toBeInTheDocument();
    expect(screen.getByText("Diseño europeo estructurado.")).toBeInTheDocument();
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

  it("keeps resume template previews to card plus real paper without a shell frame", async () => {
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
    expect(styles).not.toMatch(
      /\.dasti-template-card__document-scale\s+\.resume-template-page-shell/,
    );
  });
});
