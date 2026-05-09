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
    expect(screen.getByText("Editorial")).toBeInTheDocument();
    expect(screen.queryByText("Cover letter")).toBeNull();
    expect(screen.queryByRole("tab", { name: "CVs" })).toBeNull();
    expect(screen.getAllByTestId("template-document-preview")).toHaveLength(3);
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

  it("selects template cards without navigating", async () => {
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
    expect(editorialCard).toHaveAttribute("data-selected", "true");
  });

  it("shows a quiet arrow use-template action on the selected card", () => {
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const selectedCard = screen
      .getByText("Minimal", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(selectedCard).toBeTruthy();
    const useButton = within(selectedCard as HTMLElement).getByRole("button", {
      name: "Use Minimal template",
    });
    expect(useButton).toBeInTheDocument();
    expect(useButton).toHaveAttribute("data-toolbar-tooltip", "Use this template");
    expect(useButton).toHaveAttribute("aria-describedby");
    expect(within(selectedCard as HTMLElement).queryByLabelText("Selected")).toBeNull();

    const frenchCard = screen
      .getByText("French", { selector: ".dasti-template-card__title" })
      .closest(".dasti-template-card");
    expect(frenchCard).toBeTruthy();
    expect(
      within(frenchCard as HTMLElement).queryByRole("button", {
        name: "Use French template",
      }),
    ).toBeNull();
  });

  it("uses the selected resume template from the arrow on the first click", async () => {
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

    await user.click(
      within(frenchCard as HTMLElement).getByRole("button", {
        name: "Use French template",
      }),
    );

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith(
      "/cv?cvForgeAction=createBlank&templateId=french",
    );
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

    await user.click(
      within(editorialCard as HTMLElement).getByRole("button", {
        name: "Use Editorial template",
      }),
    );

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
