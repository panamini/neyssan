import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Bold")).toBeInTheDocument();
    expect(screen.queryByText("Editorial")).toBeNull();
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
    expect(screen.getByText("Workshop one-col")).toBeInTheDocument();
    expect(screen.getByText("Workshop two-col")).toBeInTheDocument();
    expect(screen.queryByText("Two-column")).toBeNull();
    expect(screen.queryByText("Classic")).toBeNull();
    expect(screen.queryByText("Compact")).toBeNull();
    expect(screen.queryByText("Letterpress")).toBeNull();
    expect(screen.getAllByTestId("template-document-preview")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Customize style" }));
    expect(navigateMock).toHaveBeenCalledWith("/settings?tab=docstyle");
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
